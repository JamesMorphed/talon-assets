/*!
 * Talon Pixel Scatter v1.0.0
 * Rollover (desktop) / tap (touch) effect for the TALON hero wordmark.
 * At rest the wordmark is drawn solid, identical to the SVG. Under the cursor
 * it breaks into small square pixels that move out of the way, then settle back.
 *
 * Targets: .tl-hero .tl-word svg (filled by tlHero) and any [data-tl-scatter] svg.
 * Waits for the hero intro overlay (.tl-over) to finish before mounting.
 * Leaves the SVG untouched (only hidden) so it is the fallback if anything fails.
 * Skipped entirely for prefers-reduced-motion.
 * Options via attributes on .tl-word / [data-tl-scatter]:
 *   data-scatter-cell   pixel size in CSS px (default: auto from width)
 *   data-scatter-radius radius as a multiple of the wordmark height (default .36 desktop / .5 touch)
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.requestAnimationFrame) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var N = 16; // trail length
  var THRESH = 0.07; // field value where the solid letter gives way to pixels
  var K = 2.2; // gaussian falloff
  var coarse = window.matchMedia && matchMedia('(hover: none)').matches;

  function Scatter(host, svg) {
    this.host = host;
    this.svg = svg;
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !vb[2]) return;
    this.vb = vb;
    this.paths = [].slice.call(svg.querySelectorAll('path')).map(function (p) {
      try { return new Path2D(p.getAttribute('d')); } catch (e) { return null; }
    }).filter(Boolean);
    if (!this.paths.length) return;

    var cv = document.createElement('canvas');
    cv.className = 'tl-scatter';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;pointer-events:none;display:block;z-index:1';
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    if (!this.ctx) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(cv);

    this.trail = [];
    for (var i = 0; i < N; i++) this.trail.push({ x: -1e5, y: -1e5, s: 0, w: 1, tap: false });
    this.head = 0; this.last = null; this.hover = false; this.running = false; this.prev = 0;
    this.layout();
    svg.style.visibility = 'hidden';

    var self = this;
    this.loop = function (t) { self.frame(t); };
    if (window.ResizeObserver) new ResizeObserver(function () { self.layout(); }).observe(svg);
    else addEventListener('resize', function () { self.layout(); });
    addEventListener('pointermove', function (e) { self.move(e); }, { passive: true });
    addEventListener('pointerdown', function (e) { self.down(e); }, { passive: true });
    document.addEventListener('pointerleave', function () { self.hover = false; });
    addEventListener('blur', function () { self.hover = false; });
  }

  Scatter.prototype.layout = function () {
    var r = this.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.pad = Math.round(r.height * 0.6); // room for pixels pushed past the letters
    var hr = this.host.getBoundingClientRect(); // svg box inside host
    this.ox = r.left - hr.left - this.host.clientLeft; this.oy = r.top - hr.top - this.host.clientTop;
    var cw = r.width + this.pad * 2, ch = r.height + this.pad * 2;
    this.cv.style.left = (this.ox - this.pad) + 'px';
    this.cv.style.top = (this.oy - this.pad) + 'px';
    this.cv.style.width = cw + 'px';
    this.cv.style.height = ch + 'px';
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    this.dpr = dpr;
    this.sc = r.width / this.vb[2];
    this.color = getComputedStyle(this.svg).color || '#f2f1ed';

    var a = this.host.getAttribute('data-scatter-cell');
    this.cell = a ? +a : Math.max(3, Math.min(7, Math.round(r.width / 290)));
    a = this.host.getAttribute('data-scatter-radius');
    this.rad = r.height * (a ? +a : (coarse ? 0.5 : 0.36));

    // sample the letters on a square grid
    var m = document.createElement('canvas'), mw = Math.ceil(r.width), mh = Math.ceil(r.height);
    m.width = mw; m.height = mh;
    var mx = m.getContext('2d');
    this.paint(mx, 1, 0);
    var d = mx.getImageData(0, 0, mw, mh).data, pts = [], c = this.cell;
    for (var y = c / 2; y < mh; y += c) {
      for (var x = c / 2; x < mw; x += c) {
        if (d[((y | 0) * mw + (x | 0)) * 4 + 3] > 127) pts.push(x + this.pad, y + this.pad, 0.7 + Math.random() * 0.6);
      }
    }
    this.pts = new Float32Array(pts);
    this.draw();
  };

  // draw the solid wordmark; off = canvas padding
  Scatter.prototype.paint = function (ctx, dpr, off) {
    var vb = this.vb, s = this.sc;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (off - vb[0] * s), dpr * (off - vb[1] * s));
    ctx.fillStyle = this.color;
    for (var i = 0; i < this.paths.length; i++) ctx.fill(this.paths[i]);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  Scatter.prototype.local = function (e) {
    var r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  };

  Scatter.prototype.push = function (p, tap) {
    this.head = (this.head + 1) % N;
    var t = this.trail[this.head];
    t.x = p.x; t.y = p.y; t.s = 1; t.w = tap ? 0.5 : 1; t.tap = tap;
    this.last = t;
  };

  Scatter.prototype.move = function (e) {
    if (e.pointerType === 'touch') return;
    var p = this.local(e);
    if (!p.inside) { this.hover = false; return; }
    this.hover = true;
    var l = this.last;
    if (!l || l.tap || Math.hypot(p.x - l.x, p.y - l.y) > 14) this.push(p, false);
    else { l.x = p.x; l.y = p.y; l.s = 1; }
    this.kick();
  };

  Scatter.prototype.down = function (e) {
    if (e.pointerType !== 'touch') return;
    var p = this.local(e);
    if (!p.inside) return;
    this.push(p, true);
    this.kick();
  };

  Scatter.prototype.kick = function () {
    if (this.running) return;
    this.running = true; this.prev = performance.now();
    requestAnimationFrame(this.loop);
  };

  Scatter.prototype.frame = function (now) {
    var dt = Math.min((now - this.prev) / 1000, 0.05), live = false;
    this.prev = now;
    for (var i = 0; i < N; i++) {
      var p = this.trail[i];
      if (p === this.last && this.hover && !p.tap) p.s = 1;
      else if (p.tap) { p.w += dt * 1.1; p.s *= Math.exp(-dt / 0.75); }
      else p.s *= Math.exp(-dt / 0.42);
      if (p.s < 0.004) p.s = 0; else live = true;
    }
    this.draw();
    if (live || this.hover) requestAnimationFrame(this.loop);
    else this.running = false;
  };

  Scatter.prototype.draw = function () {
    var ctx = this.ctx, dpr = this.dpr, T = this.trail, R = this.rad;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.paint(ctx, dpr, this.pad);

    var act = [];
    for (var i = 0; i < N; i++) if (T[i].s > THRESH) act.push(T[i]);
    if (!act.length) return;

    // cut holes where the field passes the threshold
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    for (i = 0; i < act.length; i++) {
      var r = R * act[i].w * Math.sqrt(Math.log(act[i].s / THRESH) / K);
      ctx.moveTo((act[i].x + r) * dpr, act[i].y * dpr);
      ctx.arc(act[i].x * dpr, act[i].y * dpr, r * dpr, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // pixels
    var P = this.pts, c = this.cell, n = P.length;
    ctx.fillStyle = this.color;
    for (var j = 0; j < n; j += 3) {
      var x = P[j], y = P[j + 1], f = 0, px = 0, py = 0;
      for (i = 0; i < act.length; i++) {
        var q = act[i], rr = R * q.w, dx = x - q.x, dy = y - q.y, d2 = dx * dx + dy * dy;
        if (d2 > rr * rr * 4) continue;
        var k = q.s * Math.exp(-K * d2 / (rr * rr));
        f += k;
        var d = Math.sqrt(d2) || 1, m = k * rr * 0.42 / d;
        px += dx * m; py += dy * m;
      }
      if (f < THRESH) continue;
      if (f > 1) f = 1;
      var jit = P[j + 2], sz = c * (1 - 0.55 * f);
      x += px * jit; y += py * jit;
      ctx.fillRect(Math.round((x - sz / 2) * dpr), Math.round((y - sz / 2) * dpr), Math.max(1, Math.round(sz * dpr)), Math.max(1, Math.round(sz * dpr)));
    }
  };

  function mountAll() {
    var hosts = [].slice.call(document.querySelectorAll('.tl-hero .tl-base .tl-word, [data-tl-scatter]'));
    hosts.forEach(function (h) {
      if (h.__tlScatter) return;
      var svg = h.tagName.toLowerCase() === 'svg' ? null : h.querySelector('svg');
      if (!svg) return;
      h.__tlScatter = new Scatter(h, svg);
    });
    return hosts.length && hosts.every(function (h) { return h.__tlScatter; });
  }

  function ready() {
    // wait for tlHero to draw the SVG and for the intro overlay to be removed
    var tries = 0;
    (function check() {
      var busy = document.querySelector('.tl-over');
      if (!busy && mountAll()) return;
      if (++tries < 80) setTimeout(check, 150);
    })();
  }

  window.addEventListener('talon:hero-reveal', function () { setTimeout(ready, 1100); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();

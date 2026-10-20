/*!
 * Talon Colour Wake v1.0.0
 * Rollover (desktop) / tap (touch) effect for the TALON hero wordmark.
 * At rest the wordmark is drawn solid, identical to the SVG. Moving the cursor
 * across it leaves a soft gradient trail of colour inside the letters that fades
 * back to the wordmark colour.
 *
 * Colours come from data-brand on .tl-hero (same key tlHero uses):
 *   group (default)  red > blue > amber > green, cursor to tail
 *   scaffolding      red    roofing  blue
 *   environmental    amber  compliance green
 * Override with data-wake-colors="#hex,#hex,..." on .tl-word or [data-tl-wake].
 *
 * Targets .tl-hero .tl-base .tl-word svg (filled by tlHero) and any [data-tl-wake] svg.
 * Waits for the hero intro overlay (.tl-over) to finish before mounting.
 * The SVG stays in the DOM (only hidden), so it is the fallback if anything fails.
 * Skipped for prefers-reduced-motion.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.requestAnimationFrame || !window.Path2D) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var C = { red: '#ed1c24', blue: '#0000f9', amber: '#ffb900', green: '#00ad0d' };
  var PALETTES = {
    group: [C.red, C.blue, C.amber, C.green],
    scaffolding: [C.red],
    roofing: [C.blue],
    environmental: [C.amber],
    compliance: [C.green]
  };
  var LIFE = 1.25; // seconds a trail point lasts
  var MAX = 140; // trail points kept
  var coarse = window.matchMedia && matchMedia('(hover: none)').matches;

  function hexRgb(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }

  function palette(host) {
    var o = host.getAttribute('data-wake-colors');
    if (o) return o.split(',').map(hexRgb);
    var hero = host.closest('.tl-hero');
    var key = ((hero && hero.getAttribute('data-brand')) || 'group').toLowerCase().replace(/^talon-/, '').trim();
    return (PALETTES[key] || PALETTES.group).map(hexRgb);
  }

  function Wake(host, svg) {
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || !vb[2]) return;
    var clip = new Path2D(), n = 0;
    [].forEach.call(svg.querySelectorAll('path'), function (p) {
      try { clip.addPath(new Path2D(p.getAttribute('d'))); n++; } catch (e) {}
    });
    if (!n) return;
    var cv = document.createElement('canvas');
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    this.host = host; this.svg = svg; this.vb = vb; this.clip = clip; this.cv = cv; this.ctx = ctx;
    this.stops = palette(host);
    this.pts = []; this.hover = false; this.running = false; this.lastPos = null;

    cv.className = 'tl-wake';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;pointer-events:none;display:block;z-index:1';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(cv);
    this.layout();
    svg.style.visibility = 'hidden';

    var self = this;
    this.loop = function () { self.frame(); };
    if (window.ResizeObserver) new ResizeObserver(function () { self.layout(); }).observe(svg);
    else addEventListener('resize', function () { self.layout(); });
    addEventListener('pointermove', function (e) { self.move(e); }, { passive: true });
    addEventListener('pointerdown', function (e) { self.down(e); }, { passive: true });
    document.addEventListener('pointerleave', function () { self.hover = false; self.lastPos = null; });
    addEventListener('blur', function () { self.hover = false; self.lastPos = null; });
  }

  Wake.prototype.layout = function () {
    var r = this.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var hr = this.host.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = r.width; this.h = r.height;
    this.sc = r.width / this.vb[2];
    this.color = getComputedStyle(this.svg).color || '#f2f1ed';
    this.R = r.height * (coarse ? 0.42 : 0.32);
    var s = this.cv.style;
    s.left = (r.left - hr.left - this.host.clientLeft) + 'px';
    s.top = (r.top - hr.top - this.host.clientTop) + 'px';
    s.width = r.width + 'px'; s.height = r.height + 'px';
    this.cv.width = Math.round(r.width * this.dpr);
    this.cv.height = Math.round(r.height * this.dpr);
    this.draw(performance.now() / 1000);
  };

  Wake.prototype.colAt = function (t) {
    var st = this.stops;
    if (st.length === 1) return st[0];
    var x = Math.min(0.9999, Math.max(0, t)) * (st.length - 1), i = Math.floor(x), f = x - i, a = st[i], b = st[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };

  Wake.prototype.local = function (e) {
    var r = this.cv.getBoundingClientRect(), py = r.height * 0.35;
    return {
      x: e.clientX - r.left, y: e.clientY - r.top,
      inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top - py && e.clientY <= r.bottom + py
    };
  };

  Wake.prototype.add = function (x, y, tap) {
    this.pts.push({ x: x, y: y, b: performance.now() / 1000, tap: tap });
    if (this.pts.length > MAX) this.pts.shift();
  };

  Wake.prototype.move = function (e) {
    if (e.pointerType === 'touch') return;
    var p = this.local(e);
    if (!p.inside) { this.hover = false; this.lastPos = null; return; }
    this.hover = true;
    var l = this.lastPos;
    if (l) {
      var dx = p.x - l.x, dy = p.y - l.y, d = Math.sqrt(dx * dx + dy * dy), step = Math.max(4, this.R * 0.12);
      if (d >= step) {
        var n = Math.min(24, Math.floor(d / step));
        for (var i = 1; i <= n; i++) this.add(l.x + dx * i / n, l.y + dy * i / n, false);
        this.lastPos = p;
      }
    } else { this.add(p.x, p.y, false); this.lastPos = p; }
    this.kick();
  };

  Wake.prototype.down = function (e) {
    if (e.pointerType !== 'touch') return;
    var p = this.local(e);
    if (!p.inside) return;
    this.add(p.x, p.y, true);
    this.kick();
  };

  Wake.prototype.kick = function () {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.loop);
  };

  Wake.prototype.frame = function () {
    var now = performance.now() / 1000, pts = this.pts, lp = this.lastPos;
    if (this.hover && lp) {
      var l = pts[pts.length - 1];
      if (l && !l.tap && Math.abs(l.x - lp.x) < 1 && Math.abs(l.y - lp.y) < 1) l.b = now; // keep a glow under a still cursor
      else this.add(lp.x, lp.y, false);
    }
    this.pts = pts.filter(function (p) { return now - p.b < (p.tap ? LIFE * 1.4 : LIFE); });
    this.draw(now);
    if (this.pts.length || this.hover) requestAnimationFrame(this.loop);
    else { this.running = false; this.draw(now); }
  };

  Wake.prototype.draw = function (now) {
    var ctx = this.ctx, dpr = this.dpr, sc = this.sc, vb = this.vb, R = this.R;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(dpr * sc, 0, 0, dpr * sc, -vb[0] * dpr * sc, -vb[1] * dpr * sc);
    ctx.fillStyle = this.color;
    ctx.fill(this.clip);
    if (!this.pts.length) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }
    ctx.save();
    ctx.clip(this.clip);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // oldest first, so the freshest colour sits on top
    for (var i = 0; i < this.pts.length; i++) {
      var p = this.pts[i], life = p.tap ? LIFE * 1.4 : LIFE, t = (now - p.b) / life;
      if (t >= 1 || t < 0) continue;
      var c = this.colAt(t), a = Math.pow(1 - t, 1.1) * (p.tap ? 0.9 : 0.75);
      var r = p.tap ? R * (0.4 + 1.6 * t) : R * (0.55 + 0.55 * t);
      var rgb = (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0);
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
      g.addColorStop(0.55, 'rgba(' + rgb + ',' + (a * 0.55) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };

  function mountAll() {
    var hosts = [].slice.call(document.querySelectorAll('.tl-hero .tl-base .tl-word, [data-tl-wake]'));
    hosts.forEach(function (h) {
      if (h.__tlWake) return;
      var svg = h.querySelector('svg');
      if (!svg || !svg.querySelector('path')) return;
      h.__tlWake = new Wake(h, svg);
    });
    return hosts.length && hosts.every(function (h) { return h.__tlWake; });
  }

  function ready() {
    // wait for tlHero to draw the SVG and for the intro overlay to be removed
    var tries = 0;
    (function check() {
      if (!document.querySelector('.tl-over') && mountAll()) return;
      if (++tries < 80) setTimeout(check, 150);
    })();
  }

  window.addEventListener('talon:hero-reveal', function () { setTimeout(ready, 1100); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
})();

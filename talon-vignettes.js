function __talonLib() {
  if (!window.THREE) return;
  const T3 = THREE;
  const COL = { prim: 0xb4bfce, sec: 0x8693a6, g1: 0x243041, g2: 0x161e29 };
  const L = (a, b, t) => a + (b - a) * t;

  function Builder(accent) {
    this.accent = new T3.Color(accent || '#ed1c24');
    this.dim = this.accent.clone().multiplyScalar(0.62);
    this.prim = []; this.sec = []; this.acc = []; this.tubes = []; this.boards = []; this.extra = [];
  }
  const B = Builder.prototype;
  const seg = (arr, a, b) => arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  B.P = function (a, b) { seg(this.prim, a, b); return this; };
  B.S = function (a, b) { seg(this.sec, a, b); return this; };
  B.A = function (a, b) { seg(this.acc, a, b); return this; };
  B.T = function (a, b) { this.tubes.push([a, b]); return this; };
  B.Bd = function (a, b) { this.boards.push([a, b]); return this; };
  B.poly = function (k, pts, closed) {
    if (closed === undefined) closed = true;
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) this[k](pts[i], pts[(i + 1) % pts.length]);
    return this;
  };
  B.box = function (k, x0, y0, z0, x1, y1, z1) {
    const b = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]];
    const t = b.map((p) => [p[0], y1, p[2]]);
    this.poly(k, b); this.poly(k, t); b.forEach((p, i) => this[k](p, t[i]));
    return this;
  };
  B.circle = function (k, c, r, axis, n) {
    n = n || 24; const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, u = Math.cos(a) * r, v = Math.sin(a) * r;
      if (axis === 'z') pts.push([c[0] + u, c[1] + v, c[2]]);
      else if (axis === 'x') pts.push([c[0], c[1] + u, c[2] + v]);
      else pts.push([c[0] + u, c[1], c[2] + v]);
    }
    return this.poly(k, pts);
  };
  B.mesh = function (geo, pos, dim, rot) { this.extra.push({ geo, pos, dim, rot }); return this; };
  B.sheet = function (pts, opacity) { this.panel(pts, opacity); return this.poly('A', pts); };
  B.panel = function (pts, opacity) { this.extra.push({ quad: pts, opacity: opacity == null ? 0.2 : opacity }); return this; };

  B.bounds = function () {
    const box = new T3.Box3(), v = new T3.Vector3();
    const addArr = (arr) => { for (let i = 0; i < arr.length; i += 3) box.expandByPoint(v.set(arr[i], arr[i + 1], arr[i + 2])); };
    addArr(this.prim); addArr(this.sec); addArr(this.acc);
    this.tubes.concat(this.boards).forEach(([a, b]) => { box.expandByPoint(v.set(a[0], a[1], a[2])); box.expandByPoint(v.set(b[0], b[1], b[2])); });
    this.extra.forEach((e) => { if (e.quad) e.quad.forEach((p) => box.expandByPoint(v.set(p[0], p[1], p[2]))); else box.expandByPoint(v.set(e.pos[0], e.pos[1], e.pos[2])); });
    return box;
  };

  B.build = function () {
    const g = new T3.Group();
    const lines = (arr, color, op) => {
      if (!arr.length) return;
      const geo = new T3.BufferGeometry();
      geo.setAttribute('position', new T3.Float32BufferAttribute(arr, 3));
      g.add(new T3.LineSegments(geo, new T3.LineBasicMaterial({ color, transparent: true, opacity: op })));
    };
    lines(this.prim, COL.prim, 0.75);
    lines(this.sec, COL.sec, 0.34);
    lines(this.acc, this.accent, 0.95);
    const up = new T3.Vector3(0, 1, 0), M = new T3.Matrix4();
    const inst = (list, r, color) => {
      if (!list.length) return;
      const geo = new T3.CylinderGeometry(r, r, 1, 6, 1);
      geo.translate(0, 0.5, 0);
      const m = new T3.InstancedMesh(geo, new T3.MeshBasicMaterial({ color }), list.length);
      m.frustumCulled = false;
      list.forEach(([a, b], i) => {
        const A = new T3.Vector3(a[0], a[1], a[2]);
        const d = new T3.Vector3(b[0], b[1], b[2]).sub(A);
        const len = d.length() || 0.0001;
        const q = new T3.Quaternion().setFromUnitVectors(up, d.normalize());
        M.compose(A, q, new T3.Vector3(1, len, 1));
        m.setMatrixAt(i, M);
      });
      g.add(m);
    };
    inst(this.tubes, 0.05, this.accent);
    inst(this.boards, 0.026, this.dim);
    this.extra.forEach((e) => {
      if (e.quad) {
        const p = e.quad, geo = new T3.BufferGeometry();
        geo.setAttribute('position', new T3.Float32BufferAttribute([].concat(p[0], p[1], p[2], p[0], p[2], p[3]), 3));
        g.add(new T3.Mesh(geo, new T3.MeshBasicMaterial({ color: this.accent, transparent: true, opacity: e.opacity, side: T3.DoubleSide, depthWrite: false })));
        return;
      }
      const m = new T3.Mesh(e.geo, new T3.MeshBasicMaterial({ color: e.dim ? this.dim : this.accent }));
      m.position.set(e.pos[0], e.pos[1], e.pos[2]);
      if (e.rot) m.rotation.set(e.rot[0], e.rot[1], e.rot[2]);
      g.add(m);
    });
    return g;
  };

  /* ---------- shared pieces ---------- */
  const plate = (x, z, s) => { s = s || 0.12; return [[x - s, 0, z - s], [x + s, 0, z - s], [x + s, 0, z + s], [x - s, 0, z + s]]; };

  // Grey façade on z = 0 with depth returns, storey lines and windows
  function wall(b, x0, x1, h, depth) {
    depth = depth == null ? 1.6 : depth;
    b.poly('P', [[x0, 0, 0], [x1, 0, 0], [x1, h, 0], [x0, h, 0]]);
    b.P([x0, h, 0], [x0, h, -depth]); b.P([x1, h, 0], [x1, h, -depth]);
    b.P([x0, 0, 0], [x0, 0, -depth]); b.P([x1, 0, 0], [x1, 0, -depth]);
    b.S([x0, h, -depth], [x1, h, -depth]); b.S([x0, 0, -depth], [x0, h, -depth]); b.S([x1, 0, -depth], [x1, h, -depth]);
    for (let y = 3; y < h - 0.5; y += 3) b.S([x0, y, 0], [x1, y, 0]);
    for (let s = 0; s * 3 + 2.4 < h; s++) {
      const y0 = s * 3 + 0.9, y1 = y0 + 1.4;
      for (let x = x0 + 0.6; x + 1.0 < x1 - 0.3; x += 2.0) b.poly('S', [[x, y0, 0], [x + 1.0, y0, 0], [x + 1.0, y1, 0], [x, y1, 0]]);
    }
  }

  // Independent tied scaffold run along x, standards at zi / zo
  function run(b, o) {
    const x0 = o.x0 || 0, n = o.n || 3, w = o.w || 2, lifts = o.lifts || 3, h = o.h || 2;
    const zi = o.zi == null ? 0.3 : o.zi, zo = o.zo == null ? 1.55 : o.zo;
    const skip = o.skip || (() => false), guard = o.guard !== false, top = o.top !== false, brace = o.brace !== false;
    for (let j = 1; j <= lifts; j++) {
      const y = j * h, yb = (j - 1) * h;
      for (let i = 0; i <= n; i++) {
        const x = x0 + i * w;
        if (!skip('std', j, i)) { b.T([x, yb, zi], [x, y, zi]); b.T([x, yb, zo], [x, y, zo]); }
        if (!skip('tr', j, i)) b.T([x, y, zi], [x, y, zo]);
        if (j === lifts && top && !skip('topstd', j, i)) { b.T([x, y, zi], [x, y + 1.1, zi]); b.T([x, y, zo], [x, y + 1.1, zo]); }
        if (j === 1) { b.poly('S', plate(x, zi)); b.poly('S', plate(x, zo)); }
      }
      for (let i = 0; i < n; i++) {
        const x = x0 + i * w, x2 = x + w;
        if (!skip('led', j, i)) { b.T([x, y, zi], [x2, y, zi]); b.T([x, y, zo], [x2, y, zo]); }
        if (!skip('brd', j, i)) [0.15, 0.38, 0.62, 0.85].forEach((t) => { const z = L(zi, zo, t); b.Bd([x, y + 0.03, z], [x2, y + 0.03, z]); });
        if (guard && !skip('gr', j, i)) {
          b.T([x, y + 1.0, zo], [x2, y + 1.0, zo]);
          b.Bd([x, y + 0.5, zo], [x2, y + 0.5, zo]);
          b.Bd([x, y + 0.15, zo], [x2, y + 0.15, zo]);
        }
        if (brace && i % 2 === 0 && !skip('br', j, i)) { const upw = j % 2 === 1; b.T([upw ? x : x2, yb, zo], [upw ? x2 : x, y, zo]); }
      }
    }
  }


  // Flat-roofed block with optional parapet; roof surface sits at h
  function flat(b, x0, x1, z0, z1, h, p) {
    b.box('P', x0, 0, z0, x1, h, z1);
    const R = (y, i) => [[x0 + i, y, z0 + i], [x1 - i, y, z0 + i], [x1 - i, y, z1 - i], [x0 + i, y, z1 - i]];
    if (p) { b.poly('P', R(h + p, 0)); R(h, 0).forEach((q) => b.P(q, [q[0], h + p, q[2]])); b.poly('S', R(h + p, 0.2)); b.poly('S', R(h, 0.2)); }
    for (let s = 0; s * 3 + 2.2 < h; s++) for (let x = x0 + 0.6; x + 1.2 < x1 - 0.2; x += 2.0) b.poly('S', [[x, s * 3 + 0.9, z1], [x + 1.2, s * 3 + 0.9, z1], [x + 1.2, s * 3 + 2.1, z1], [x, s * 3 + 2.1, z1]]);
  }

  // Gabled house, ridge along x, front slope faces +z; returns a point on the front slope
  function house(b, x0, x1, hd, eave, ridge) {
    b.box('P', x0, 0, -hd, x1, eave, hd);
    b.P([x0, ridge, 0], [x1, ridge, 0]);
    [x0, x1].forEach((x) => { b.P([x, eave, hd], [x, ridge, 0]); b.P([x, eave, -hd], [x, ridge, 0]); });
    for (let x = x0 + 0.6; x + 0.9 < x1; x += 1.8) b.poly('S', [[x, 0.8, hd], [x + 0.9, 0.8, hd], [x + 0.9, 2.1, hd], [x, 2.1, hd]]);
    return (x, t) => [x, eave + (ridge - eave) * t, hd * (1 - t)];
  }

  // Polythene enclosure: faint sheet faces with accent edges
  function encl(b, x0, y0, z0, x1, y1, z1, op) {
    const f = (p) => b.panel(p, op);
    f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]); f([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]);
    f([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]); f([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]);
    f([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
    b.box('A', x0, y0, z0, x1, y1, z1);
  }

  /* ---------- scenes ---------- */
  const SCENES = {
    /* ---------- scaffolding ---------- */
    'scaffold-design-and-planning': function (b) {
      const W = 7.2, D = 5.6;
      b.poly('P', [[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, 0, D / 2], [-W / 2, 0, D / 2]]);
      b.poly('S', [[-W / 2 + 0.2, 0, -D / 2 + 0.2], [W / 2 - 0.2, 0, -D / 2 + 0.2], [W / 2 - 0.2, 0, D / 2 - 0.2], [-W / 2 + 0.2, 0, D / 2 - 0.2]]);
      for (let x = -3; x <= 3.01; x += 1) b.S([x, 0, -D / 2 + 0.2], [x, 0, D / 2 - 0.2]);
      for (let z = -2; z <= 2.01; z += 1) b.S([-W / 2 + 0.2, 0, z], [W / 2 - 0.2, 0, z]);
      // title block
      b.poly('S', [[1.6, 0, 1.9], [3.4, 0, 1.9], [3.4, 0, 2.6], [1.6, 0, 2.6]]);
      b.S([1.6, 0, 2.25], [3.4, 0, 2.25]); b.S([2.5, 0, 1.9], [2.5, 0, 2.25]);
      // building
      const bx0 = -2.2, bx1 = 1.2;
      b.box('P', bx0, 0, -1.8, bx1, 3.6, 0);
      [0.9].forEach((y0) => { for (let x = bx0 + 0.4; x < bx1 - 0.6; x += 1.2) b.poly('S', [[x, y0, 0], [x + 0.6, y0, 0], [x + 0.6, y0 + 0.8, 0], [x, y0 + 0.8, 0]]); });
      [2.5].forEach((y0) => { for (let x = bx0 + 0.4; x < bx1 - 0.6; x += 1.2) b.poly('S', [[x, y0, 0], [x + 0.6, y0, 0], [x + 0.6, y0 + 0.8, 0], [x, y0 + 0.8, 0]]); });
      // the design: scaffold drawn as red linework, not tube
      const zi = 0.3, zo = 1.3, xs = [bx0, -0.5, bx1];
      xs.forEach((x) => { b.A([x, 0, zi], [x, 4.6, zi]); b.A([x, 0, zo], [x, 4.6, zo]); [1.8, 3.6].forEach((y) => b.A([x, y, zi], [x, y, zo])); });
      [1.8, 3.6].forEach((y) => { b.A([bx0, y, zi], [bx1, y, zi]); b.A([bx0, y, zo], [bx1, y, zo]); });
      b.A([bx0, 4.6, zo], [bx1, 4.6, zo]); b.A([bx0, 4.1, zo], [bx1, 4.1, zo]);
      b.A([bx0, 0, zo], [-0.5, 1.8, zo]); b.A([-0.5, 1.8, zo], [bx0, 3.6, zo]);
      // dimension lines
      const dz = zo + 0.7;
      b.P([bx0, 0, dz], [bx1, 0, dz]);
      [bx0, -0.5, bx1].forEach((x) => b.P([x - 0.08, 0, dz + 0.08], [x + 0.08, 0, dz - 0.08]));
      b.S([bx0, 0, zo], [bx0, 0, dz + 0.15]); b.S([bx1, 0, zo], [bx1, 0, dz + 0.15]);
      const dx = bx1 + 0.6;
      b.P([dx, 0, zo], [dx, 4.6, zo]);
      [0, 1.8, 3.6, 4.6].forEach((y) => b.P([dx - 0.08, y - 0.08, zo], [dx + 0.08, y + 0.08, zo]));
    },

    'erection-and-dismantling': function (b) {
      wall(b, -0.6, 6.6, 7.4);
      run(b, {
        x0: 0, n: 3, w: 2, lifts: 3, h: 2,
        skip: (k, j, i) => j === 3 && (
          (k === 'led' && i === 2) || (k === 'brd' && i >= 1) || k === 'gr' || k === 'br' ||
          (k === 'std' && i === 3) || k === 'topstd' || (k === 'tr' && i >= 2))
      });
      // tube being passed up, and a dismantled stack on the ground
      b.T([6.05, 4.3, 1.75], [6.3, 6.3, 1.75]);
      for (let k = 0; k < 6; k++) b.T([0.6, 0.05 + (k % 2) * 0.09, 2.4 + k * 0.11], [3.8, 0.05 + (k % 2) * 0.09, 2.4 + k * 0.11]);
      for (let k = 0; k < 4; k++) b.Bd([4.4, 0.03 + k * 0.05, 2.5], [6.2, 0.03 + k * 0.05, 2.5]);
    },

    'tube-and-fitting-scaffolding': function (b) {
      const hd = 2, ridge = 4.6, eave = 3, roof = (z) => ridge - ((ridge - eave) / hd) * Math.abs(z);
      const x0 = -2, x1 = 2.4;
      b.poly('P', [[x0, 0, -hd], [x1, 0, -hd], [x1, 0, hd], [x0, 0, hd]]);
      [[x0, -hd], [x1, -hd], [x1, hd], [x0, hd]].forEach(([x, z]) => b.P([x, 0, z], [x, eave, z]));
      b.poly('P', [[x0, eave, -hd], [x1, eave, -hd], [x1, eave, hd], [x0, eave, hd]]);
      b.P([x0, ridge, 0], [x1, ridge, 0]);
      [x0, x1].forEach((x) => { b.P([x, eave, hd], [x, ridge, 0]); b.P([x, eave, -hd], [x, ridge, 0]); });
      for (let x = x0 + 0.4; x < x1; x += 0.4) b.S([x, ridge, 0], [x, eave, hd]);
      for (let x = x0 + 0.5; x < x1 - 0.9; x += 1.6) b.poly('S', [[x, 0.9, hd], [x + 0.9, 0.9, hd], [x + 0.9, 2.2, hd], [x, 2.2, hd]]);
      // chimney
      b.box('P', 0.5, roof(0.35) - 0.1, -0.35, 1.2, 5.7, 0.35);
      b.circle('P', [0.7, 5.7, 0], 0.1, 'y', 14); b.circle('P', [1.0, 5.7, 0], 0.1, 'y', 14);
      b.P([0.7, 5.7, 0], [0.7, 5.95, 0]); b.P([1.0, 5.7, 0], [1.0, 5.95, 0]);
      // bespoke tube and fitting around the stack
      const xs = [-0.05, 1.75], zs = [-0.9, 0.9], yb = roof(0.9);
      xs.forEach((x) => zs.forEach((z) => b.T([x, yb, z], [x, 6.3, z])));
      [5.0, 6.1].forEach((y) => {
        b.T([xs[0], y, zs[0]], [xs[1], y, zs[0]]); b.T([xs[0], y, zs[1]], [xs[1], y, zs[1]]);
        b.T([xs[0], y, zs[0]], [xs[0], y, zs[1]]); b.T([xs[1], y, zs[0]], [xs[1], y, zs[1]]);
      });
      b.Bd([xs[0], 5.55, zs[1]], [xs[1], 5.55, zs[1]]); b.Bd([xs[0], 5.55, zs[0]], [xs[1], 5.55, zs[0]]);
      [-0.75, -0.55, 0.55, 0.75].forEach((z) => b.Bd([xs[0], 5.03, z], [xs[1], 5.03, z]));
      [0.12, 0.32, 1.38, 1.58].forEach((x) => b.Bd([x, 5.03, -0.4], [x, 5.03, 0.4]));
      // rakers down to the eaves and a facade brace
      b.T([xs[0], 5.0, zs[1]], [-0.5, eave + 0.05, hd]); b.T([xs[1], 5.0, zs[1]], [2.2, eave + 0.05, hd]);
      b.T([xs[0], 5.0, zs[0]], [-0.5, eave + 0.05, -hd]); b.T([xs[1], 5.0, zs[0]], [2.2, eave + 0.05, -hd]);
      b.T([xs[0], yb + 0.05, zs[1]], [xs[1], 5.0, zs[1]]);
      // couplers
      const cg = new T3.BoxGeometry(0.13, 0.13, 0.13);
      [5.0, 6.1].forEach((y) => xs.forEach((x) => zs.forEach((z) => b.mesh(cg, [x, y, z]))));
    },

    'system-scaffolding': function (b) {
      wall(b, -0.6, 4.6, 5.6);
      run(b, { x0: 0, n: 2, w: 2, lifts: 2, h: 2 });
      // ring rosettes every 0.5 m, the signature of system scaffold
      const rg = new T3.CylinderGeometry(0.11, 0.11, 0.035, 10);
      [0, 2, 4].forEach((x) => [0.3, 1.55].forEach((z) => { for (let y = 0.5; y <= 5.01; y += 0.5) b.mesh(rg, [x, y, z]); }));
    },

    'scaffold-towers': function (b) {
      const xs = [0, 2.5], zs = [0, 1.35], yb = 0.32, top = 6;
      xs.forEach((x) => zs.forEach((z) => {
        b.T([x, yb, z], [x, top + 1.1, z]);
        b.circle('P', [x, 0.15, z], 0.14, 'x', 16);
        b.S([x, 0.15, z], [x, yb, z]);
        const sx = x === 0 ? -1 : 1, sz = z === 0 ? -1 : 1;
        b.T([x, 1.7, z], [x + sx * 0.95, 0.03, z + sz * 0.95]);
      }));
      const ring = (y, fn) => { fn([0, y, 0], [2.5, y, 0]); fn([0, y, 1.35], [2.5, y, 1.35]); fn([0, y, 0], [0, y, 1.35]); fn([2.5, y, 0], [2.5, y, 1.35]); };
      [0.45, 2, 4, 6].forEach((y) => ring(y, (a, c) => b.T(a, c)));
      ring(top + 1.0, (a, c) => b.T(a, c));
      ring(top + 0.5, (a, c) => b.Bd(a, c));
      ring(top + 0.15, (a, c) => b.Bd(a, c));
      [[0.45, 2], [2, 4], [4, 6]].forEach(([y0, y1], k) => {
        const f = k % 2 === 0;
        b.T([f ? 0 : 2.5, y0, 0], [f ? 2.5 : 0, y1, 0]);
        b.T([f ? 2.5 : 0, y0, 1.35], [f ? 0 : 2.5, y1, 1.35]);
      });
      [0.2, 0.45, 0.7, 0.95, 1.15].forEach((z) => b.Bd([0, top + 0.03, z], [2.5, top + 0.03, z]));
      // internal ladder
      b.Bd([0.25, 0.45, 0.45], [0.25, top, 0.45]); b.Bd([0.25, 0.45, 0.9], [0.25, top, 0.9]);
      for (let y = 0.75; y < top; y += 0.3) b.S([0.25, y, 0.45], [0.25, y, 0.9]);
    },

    'temporary-roofs-and-weather-protection': function (b) {
      b.box('P', -3, 0, -2, 3, 4, 2);
      for (let x = -2.4; x < 2.2; x += 1.6) [2, -2].forEach((z) => [0.8, 2.6].forEach((y) => b.poly('S', [[x, y, z], [x + 0.9, y, z], [x + 0.9, y + 0.9, z], [x, y + 0.9, z]])));
      b.S([-3, 2, 2], [3, 2, 2]); b.S([-3, 2, -2], [3, 2, -2]);
      run(b, { x0: -3.5, n: 5, w: 1.4, lifts: 2, h: 2.2, zi: 2.3, zo: 3.4 });
      run(b, { x0: -3.5, n: 5, w: 1.4, lifts: 2, h: 2.2, zi: -2.3, zo: -3.4 });
      const yc = 5.6, ya = 7.3, zr = 3.4;
      for (let k = 0; k <= 5; k++) {
        const x = -3.5 + k * 1.4;
        b.T([x, yc, -zr], [x, yc, zr]);
        b.T([x, yc, -zr], [x, ya, 0]); b.T([x, yc, zr], [x, ya, 0]);
        b.Bd([x, yc, 0], [x, ya, 0]);
        [1, -1].forEach((s) => { const ym = L(yc, ya, 0.5); b.Bd([x, yc, s * zr * 0.5], [x, ym, s * zr * 0.5]); b.Bd([x, yc, s * zr * 0.5], [x, ya, 0]); });
      }
      [0.2, 0.5, 0.8].forEach((t) => [1, -1].forEach((s) => { const z = s * zr * (1 - t), y = L(yc, ya, t); b.Bd([-3.5, y, z], [3.5, y, z]); }));
      b.panel([[-3.5, yc, zr], [3.5, yc, zr], [3.5, ya, 0], [-3.5, ya, 0]], 0.16);
      b.panel([[-3.5, yc, -zr], [3.5, yc, -zr], [3.5, ya, 0], [-3.5, ya, 0]], 0.16);
    },

    'scaffold-staircases': function (b) {
      wall(b, -0.6, 3.6, 7.4);
      const zi = 0.4, zo = 1.8, xs = [0, 1.5, 3];
      for (let j = 1; j <= 3; j++) {
        const y = j * 2, yb = y - 2;
        xs.forEach((x) => { b.T([x, yb, zi], [x, y, zi]); b.T([x, yb, zo], [x, y, zo]); b.T([x, y, zi], [x, y, zo]); if (j === 3) { b.T([x, y, zi], [x, y + 1.1, zi]); b.T([x, y, zo], [x, y + 1.1, zo]); } if (j === 1) { b.poly('S', plate(x, zi)); b.poly('S', plate(x, zo)); } });
        b.T([0, y, zi], [3, y, zi]); b.T([0, y, zo], [3, y, zo]);
        b.T([0, y + 1, zo], [3, y + 1, zo]); b.Bd([0, y + 0.5, zo], [3, y + 0.5, zo]);
        [0.1, 0.25, 0.4, 2.6, 2.75, 2.9].forEach((x) => b.Bd([x, y + 0.03, zi], [x, y + 0.03, zo]));
        // flight: alternate direction and side each lift
        const odd = j % 2 === 1, xsF = odd ? 0.45 : 2.55, xeF = odd ? 2.55 : 0.45;
        const za = odd ? 0.45 : 1.1, zb = odd ? 1.1 : 1.75, zOut = odd ? za : zb;
        b.T([xsF, yb, za], [xeF, y, za]); b.T([xsF, yb, zb], [xeF, y, zb]);
        for (let s = 1; s < 10; s++) { const x = L(xsF, xeF, s / 10), yy = L(yb, y, s / 10); b.Bd([x, yy, za], [x, yy, zb]); }
        b.T([xsF, yb + 0.95, zOut], [xeF, y + 0.95, zOut]);
        b.T([odd ? 0 : 3, yb, zo], [odd ? 1.5 : 1.5, y, zo]);
      }
      b.P([0.9, 0, 0], [0.9, 2.2, 0]); b.P([2.1, 0, 0], [2.1, 2.2, 0]); b.P([0.9, 2.2, 0], [2.1, 2.2, 0]);
    },

    'birdcage-scaffolding': function (b) {
      const rx0 = -0.8, rx1 = 6.8, rz0 = -0.8, rz1 = 4.8, rh = 6.2;
      b.box('P', rx0, 0, rz0, rx1, rh, rz1);
      for (let x = rx0 + 1.5; x < rx1; x += 1.5) b.S([x, rh, rz0], [x, rh, rz1]);
      for (let x = 0.4; x < 6; x += 2) b.poly('S', [[x, 1.6, rz0], [x + 1.0, 1.6, rz0], [x + 1.0, 4.4, rz0], [x, 4.4, rz0]]);
      const xs = [0, 1.5, 3, 4.5, 6], zs = [0, 2, 4], deck = 4;
      xs.forEach((x) => zs.forEach((z) => { b.T([x, 0, z], [x, deck + 1.1, z]); b.poly('S', plate(x, z)); }));
      [2, deck].forEach((y) => {
        zs.forEach((z) => b.T([0, y, z], [6, y, z]));
        xs.forEach((x) => b.T([x, y, 0], [x, y, 4]));
      });
      for (let z = 0.15; z < 4; z += 0.32) b.Bd([0, deck + 0.03, z], [6, deck + 0.03, z]);
      const per = [[0, 0], [6, 0], [6, 4], [0, 4]];
      [[deck + 1.0, 'T'], [deck + 0.5, 'Bd']].forEach(([y, k]) => per.forEach((p, i) => { const q = per[(i + 1) % 4]; b[k]([p[0], y, p[1]], [q[0], y, q[1]]); }));
      [0, 3].forEach((x) => { b.T([x, 0, 0], [x + 1.5, 2, 0]); b.T([x + 1.5, 2, 4], [x, deck, 4]); });
      b.T([0, 0, 0], [0, 2, 2]); b.T([6, 2, 2], [6, deck, 4]);
      b.Bd([5.5, 0, 0.7], [5.5, deck, 0.7]); b.Bd([5.5, 0, 1.2], [5.5, deck, 1.2]);
      for (let y = 0.3; y < deck; y += 0.3) b.S([5.5, y, 0.7], [5.5, y, 1.2]);
    },

    'loading-bays': function (b) {
      wall(b, -0.6, 6.6, 6.2);
      run(b, { x0: 0, n: 3, w: 2, lifts: 2, h: 2, skip: (k, j, i) => j === 2 && i === 1 && k === 'gr' });
      const zo = 1.55, zb = 3.75, y = 4;
      [2, 3, 4].forEach((x) => { b.T([x, 0, zb], [x, x === 3 ? y : y + 1.1, zb]); b.poly('S', plate(x, zb)); [2, y].forEach((yy) => b.T([x, yy, zo], [x, yy, zb])); b.T([x, y - 0.35, zo], [x, y - 0.35, zb]); });
      b.T([3, 0, zo], [3, y, zo]);
      [2, y].forEach((yy) => b.T([2, yy, zb], [4, yy, zb]));
      for (let x = 2.12; x < 3.95; x += 0.23) b.Bd([x, y + 0.03, zo], [x, y + 0.03, zb]);
      [2, 4].forEach((x) => { b.T([x, y + 1, zo], [x, y + 1, zb]); b.Bd([x, y + 0.5, zo], [x, y + 0.5, zb]); b.T([x, 0, zb], [x, 2, zo]); b.T([x, 2, zb], [x, y, zo]); });
      // up-and-over gate at the landing edge
      b.poly('T', [[2.1, y + 0.12, zb + 0.05], [3.9, y + 0.12, zb + 0.05], [3.9, y + 1.02, zb + 0.05], [2.1, y + 1.02, zb + 0.05]]);
      b.Bd([2.1, y + 0.12, zb + 0.05], [3.9, y + 1.02, zb + 0.05]); b.Bd([2.1, y + 1.02, zb + 0.05], [3.9, y + 0.12, zb + 0.05]);
      // pallet of block on the deck, and the load sign
      b.box('P', 2.45, y + 0.04, 2.2, 3.35, y + 0.62, 3.05);
      [y + 0.24, y + 0.43].forEach((yy) => b.poly('S', [[2.45, yy, 3.05], [3.35, yy, 3.05], [3.35, yy, 2.2], [2.45, yy, 2.2]]));
      b.panel([[3.6, 2.6, zb + 0.06], [3.95, 2.6, zb + 0.06], [3.95, 2.95, zb + 0.06], [3.6, 2.95, zb + 0.06]], 0.95);
    },

    'scaffold-hoists': function (b) {
      wall(b, -0.6, 6.6, 7.4);
      run(b, { x0: 0, n: 3, w: 2, lifts: 3, h: 2 });
      const mx0 = 7.9, mx1 = 8.35, mz0 = 0.8, mz1 = 1.25, mh = 8.6;
      [[mx0, mz0], [mx1, mz0], [mx1, mz1], [mx0, mz1]].forEach(([x, z]) => b.T([x, 0, z], [x, mh, z]));
      for (let y = 0; y < mh - 0.45; y += 0.45) {
        const f = Math.round(y / 0.45) % 2 === 0;
        b.Bd([f ? mx0 : mx1, y, mz1], [f ? mx1 : mx0, y + 0.45, mz1]);
        b.Bd([f ? mx0 : mx1, y, mz0], [f ? mx1 : mx0, y + 0.45, mz0]);
        b.Bd([mx0, y, f ? mz0 : mz1], [mx0, y + 0.45, f ? mz1 : mz0]);
      }
      b.T([mx0 + 0.2, mh, 1.02], [7.0, mh, 1.02]);
      [2, 4, 6].forEach((y) => {
        b.T([6, y, 1.55], [mx0, y, mz1]);
        b.poly('T', [[6.08, y + 0.1, 0.45], [6.08, y + 0.1, 1.4], [6.08, y + 1.05, 1.4], [6.08, y + 1.05, 0.45]]);
      });
      // car at the first landing
      const cx0 = 6.45, cx1 = 7.75, cz0 = 0.4, cz1 = 1.6, cy = 2.0;
      b.box('A', cx0, cy, cz0, cx1, cy + 1.1, cz1);
      b.panel([[cx0, cy, cz0], [cx1, cy, cz0], [cx1, cy, cz1], [cx0, cy, cz1]], 0.35);
      b.box('S', 6.2, 0, 0.1, 8.8, 2.0, 2.0);
    },

    'rubbish-chutes': function (b) {
      wall(b, -0.6, 4.6, 7.4);
      run(b, { x0: 0, n: 2, w: 2, lifts: 3, h: 2 });
      const cx = 1, cz = 2.3;
      const ring = (y, r) => b.circle('A', [cx, y, cz], r, 'y', 18);
      const cone = (yt, rt, yb, rb) => { ring(yt, rt); ring(yb, rb); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.A([cx + Math.cos(a) * rt, yt, cz + Math.sin(a) * rt], [cx + Math.cos(a) * rb, yb, cz + Math.sin(a) * rb]); } };
      cone(6.9, 0.48, 6.2, 0.3);
      for (let yt = 6.3; yt - 0.85 > 1.05; yt -= 0.78) cone(yt, 0.3, yt - 0.85, 0.24);
      [2, 4, 6].forEach((y) => { b.T([0, y, 1.55], [cx - 0.28, y, cz]); b.T([2, y, 1.55], [cx + 0.28, y, cz]); });
      b.S([cx, 6.9, cz], [cx, 7.4, 1.55]);
      // skip
      const bot = [[0.15, 0, 2.05], [1.85, 0, 2.05], [1.85, 0, 3.15], [0.15, 0, 3.15]];
      const tp = [[-0.25, 1.0, 1.85], [2.25, 1.0, 1.85], [2.25, 1.0, 3.35], [-0.25, 1.0, 3.35]];
      b.poly('P', bot); b.poly('P', tp); bot.forEach((p, i) => b.P(p, tp[i]));
      [[0.4, 0.85, 2.4, 0.9, 0.95, 2.7], [1.2, 0.9, 2.2, 1.6, 0.8, 2.9]].forEach((q) => b.S([q[0], q[1], q[2]], [q[3], q[4], q[5]]));
    },

    'scaffold-inspections': function (b) {
      wall(b, -0.8, 4.4, 5.8);
      run(b, { x0: 0, n: 2, w: 1.8, lifts: 2, h: 2 });
      // scaffold tag on the access standard
      const z = 1.62;
      b.poly('P', [[0.06, 1.3, z], [0.36, 1.3, z], [0.36, 1.82, z], [0.06, 1.82, z]]);
      b.panel([[0.09, 1.34, z + 0.005], [0.33, 1.34, z + 0.005], [0.33, 1.72, z + 0.005], [0.09, 1.72, z + 0.005]], 0.95);
      b.S([0, 1.76, 1.55], [0.21, 1.76, z]);
      [1.44, 1.52, 1.6].forEach((y) => b.P([0.13, y, z + 0.01], [0.29, y, z + 0.01]));
      // inspection checkpoints at key joints
      [[1.8, 2, 1.55], [3.6, 4, 1.55], [0, 4, 1.55]].forEach((c) => {
        b.circle('P', c, 0.24, 'z', 22);
        b.A([c[0] + 0.3, c[1] + 0.32, c[2]], [c[0] + 0.38, c[1] + 0.24, c[2]]);
        b.A([c[0] + 0.38, c[1] + 0.24, c[2]], [c[0] + 0.56, c[1] + 0.46, c[2]]);
      });
    },

    'emergency-scaffolding': function (b) {
      const outline = [[-3, 0, 0], [3, 0, 0], [3, 4.5, 0], [2.3, 4.6, 0], [2.0, 5.2, 0], [1.3, 5.45, 0], [0.7, 6.3, 0], [0, 6.8, 0], [-3, 4.5, 0]];
      b.poly('P', outline);
      [[-3, 0], [3, 0], [3, 4.5], [-3, 4.5]].forEach(([x, y]) => b.S([x, y, 0], [x, y, -3.5]));
      b.S([0, 6.8, 0], [0, 6.8, -3.5]); b.S([-3, 4.5, -3.5], [0, 6.8, -3.5]); b.S([-3, 0, -3.5], [-3, 4.5, -3.5]);
      b.poly('P', [[0.4, 1.0, 0.01], [0.75, 1.8, 0.01], [0.5, 2.5, 0.01], [1.05, 3.2, 0.01], [0.85, 3.9, 0.01], [1.5, 4.7, 0.01]], false);
      [[-2.4, 0.9], [-2.4, 2.9], [1.6, 0.9]].forEach(([x, y]) => b.poly('S', [[x, y, 0], [x + 0.9, y, 0], [x + 0.9, y + 1.2, 0], [x, y + 1.2, 0]]));
      // raking shores holding the gable
      const zw = 0.15;
      [-1.8, 0, 1.8].forEach((x) => {
        b.T([x, 0.2, zw], [x, 5.0, zw]);
        b.T([x, 0.1, 3.6], [x, 4.6, zw]);
        b.T([x, 0.1, 2.6], [x, 2.8, zw]);
        b.T([x, 0.1, zw], [x, 0.1, 3.8]);
        b.Bd([x, 0.1, 3.6], [x, 2.8, zw]);
      });
      const rakeY = (z) => L(0.1, 4.6, (3.6 - z) / (3.6 - zw));
      [2.2, 1.0].forEach((z) => b.T([-1.8, rakeY(z), z], [1.8, rakeY(z), z]));
      b.Bd([-1.8, rakeY(2.2), 2.2], [0, rakeY(1.0), 1.0]); b.Bd([1.8, rakeY(2.2), 2.2], [0, rakeY(1.0), 1.0]);
      // pedestrian barrier
      const zb = 4.6;
      for (let x = -3; x <= 3.01; x += 1.5) b.T([x, 0, zb], [x, 1.1, zb]);
      b.T([-3, 1.0, zb], [3, 1.0, zb]); b.Bd([-3, 0.5, zb], [3, 0.5, zb]);
      [[2.2, 0.6], [2.6, 1.2], [1.6, 0.9]].forEach(([x, z]) => b.S([x, 0.02, z], [x + 0.3, 0.02, z + 0.15]));
    }
  };

  const ROOFING = {
    /* ---------- roofing ---------- */
    'commercial-flat-roofing': function (b) {
      const h = 4; flat(b, -4, 4, -3, 3, h, 0.5);
      const y = h + 0.02;
      for (let x = 1.6; x < 3.75; x += 1.1) for (let z = -2.8; z < 2.75; z += 0.7) b.poly('S', [[x, y, z], [x + 1.1, y, z], [x + 1.1, y, z + 0.7], [x, y, z + 0.7]]);
      b.sheet([[-3.8, y, -2.8], [1.6, y, -2.8], [1.6, y, 2.8], [-3.8, y, 2.8]], 0.3);
      for (let x = -2.8; x < 1.6; x += 1.0) b.A([x, y + 0.005, -2.8], [x, y + 0.005, 2.8]);
      // membrane roll mid-unroll
      b.mesh(new T3.CylinderGeometry(0.26, 0.26, 5.6, 18), [1.86, y + 0.26, 0], false, [Math.PI / 2, 0, 0]);
      [-2.8, 2.8].forEach((z) => b.circle('A', [1.86, y + 0.26, z], 0.26, 'z', 18));
      // upstands, outlets, plant and downpipe
      b.A([-3.8, y + 0.18, -2.8], [-3.8, y + 0.18, 2.8]); b.A([-3.8, y + 0.18, -2.8], [1.6, y + 0.18, -2.8]); b.A([-3.8, y + 0.18, 2.8], [1.6, y + 0.18, 2.8]);
      [[-3.35, -2.35], [-3.35, 2.35]].forEach(([x, z]) => { b.circle('A', [x, y + 0.01, z], 0.15, 'y', 16); b.circle('A', [x, y + 0.01, z], 0.07, 'y', 12); });
      b.box('P', -1.8, y, -1.9, -0.4, y + 1.0, -0.8);
      b.T([-3.7, h, 3.12], [-3.7, 0.1, 3.12]);
    },

    'pitched-roofing-slating-and-tiling': function (b) {
      const pt = house(b, -3.2, 3.2, 2.2, 3, 5.2), dt = 0.07;
      for (let x = -3.2; x <= 3.21; x += 0.6) b.S(pt(x, 0), pt(x, 1));
      // tiled half: courses with staggered joints
      let k = 0;
      for (let t = 0; t < 0.999; t += dt, k++) {
        b.A(pt(-3.2, t), pt(0, t));
        for (let x = -3.2 + (k % 2 ? 0.15 : 0.3); x < -0.05; x += 0.3) b.A(pt(x, t), pt(x, Math.min(1, t + dt)));
      }
      b.panel([pt(-3.2, 0), pt(0, 0), pt(0, 1), pt(-3.2, 1)], 0.2);
      // stripped half: felt and battens ready for slates
      b.panel([pt(0, 0), pt(3.2, 0), pt(3.2, 1), pt(0, 1)], 0.07);
      for (let t = 0.04; t < 0.98; t += dt) b.Bd(pt(0, t), pt(3.2, t));
      b.T([-3.2, 5.27, 0], [0, 5.27, 0]);
      // slates stacked at the eaves
      for (let s = 0; s < 4; s++) b.poly('A', [pt(1.0, 0.1 + s * 0.012), pt(1.5, 0.1 + s * 0.012), pt(1.5, 0.19 + s * 0.012), pt(1.0, 0.19 + s * 0.012)]);
    },

    'metal-roofing-and-cladding': function (b) {
      const ze = 4, ye = 5, ya = 6.2, X = 10;
      for (let x = 0; x <= X + 0.01; x += 2.5) {
        b.P([x, 0, ze], [x, ye, ze]); b.P([x, 0, -ze], [x, ye, -ze]);
        b.P([x, ye, ze], [x, ya, 0]); b.P([x, ye, -ze], [x, ya, 0]);
      }
      [ze, -ze].forEach((z) => { b.P([0, ye, z], [X, ye, z]); b.P([0, 0, z], [X, 0, z]); });
      b.P([0, ya, 0], [X, ya, 0]);
      [0.25, 0.5, 0.75].forEach((t) => [1, -1].forEach((s) => b.S([0, L(ye, ya, t), s * ze * (1 - t)], [X, L(ye, ya, t), s * ze * (1 - t)])));
      [1.6, 3.3].forEach((y) => b.S([6, y, ze], [X, y, ze]));
      // profiled roof sheets and wall cladding on the first bays
      for (let x = 0; x <= 6.01; x += 0.3) b.A([x, ye, ze], [x, ya, 0]);
      b.panel([[0, ye, ze], [6, ye, ze], [6, ya, 0], [0, ya, 0]], 0.2);
      for (let x = 0; x <= 6.01; x += 0.3) b.A([x, 0.2, ze + 0.02], [x, ye, ze + 0.02]);
      b.panel([[0, 0.2, ze + 0.02], [6, 0.2, ze + 0.02], [6, ye, ze + 0.02], [0, ye, ze + 0.02]], 0.16);
      b.poly('P', [[7.2, 0, ze], [9.4, 0, ze], [9.4, 3.8, ze], [7.2, 3.8, ze]]);
      b.T([0, ye - 0.05, ze + 0.12], [X, ye - 0.05, ze + 0.12]);
    },

    'roof-coatings-and-refurbishment': function (b) {
      const h = 3.2; flat(b, -3.5, 3.5, -2.5, 2.5, h, 0.4);
      const y = h + 0.02;
      // tired felt: patches and cracks ahead of the coating
      [[1.2, -1.8, 0.9, 0.7], [2.2, 0.4, 0.8, 1.1], [1.0, 1.2, 0.7, 0.6]].forEach(([x, z, w, d]) => b.poly('S', [[x, y, z], [x + w, y, z], [x + w, y, z + d], [x, y, z + d]]));
      b.poly('P', [[1.3, y, -0.6], [1.7, y, -0.3], [1.6, y, 0.1], [2.1, y, 0.35]], false);
      b.poly('P', [[2.6, y, -1.9], [2.8, y, -1.4], [3.1, y, -1.2]], false);
      // coated, primed and the wet edge
      b.sheet([[-3.3, y, -2.3], [0.2, y, -2.3], [0.2, y, 2.3], [-3.3, y, 2.3]], 0.45);
      b.panel([[0.2, y, -2.3], [0.9, y, -2.3], [0.9, y, 2.3], [0.2, y, 2.3]], 0.12);
      b.A([0.9, y, -2.3], [0.9, y, 2.3]);
      // roller and tin
      b.mesh(new T3.CylinderGeometry(0.09, 0.09, 0.9, 14), [0.32, y + 0.09, 0.35], false, [Math.PI / 2, 0, 0]);
      b.T([0.42, y + 0.1, 0.35], [1.7, y + 1.25, 0.6]);
      b.circle('P', [1.5, y, -1.0], 0.2, 'y', 16); b.circle('P', [1.5, y + 0.35, -1.0], 0.2, 'y', 16);
      [0, 1, 2, 3].forEach((i) => { const a = (i / 4) * Math.PI * 2; b.P([1.5 + Math.cos(a) * 0.2, y, -1 + Math.sin(a) * 0.2], [1.5 + Math.cos(a) * 0.2, y + 0.35, -1 + Math.sin(a) * 0.2]); });
    },

    'roof-inspections-and-surveys': function (b) {
      const h = 4; flat(b, -4, 4, -3, 3, h, 0.4);
      const y = h + 0.02;
      for (let x = -3; x <= 3.01; x += 1) b.S([x, y, -2.8], [x, y, 2.8]);
      for (let z = -2; z <= 2.01; z += 1) b.S([-3.8, y, z], [3.8, y, z]);
      // drone and its camera footprint
      const d = [0.4, 7.4, 0.6];
      b.mesh(new T3.BoxGeometry(0.5, 0.12, 0.5), d);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const e = [d[0] + sx * 0.5, d[1] + 0.04, d[2] + sz * 0.5];
        b.A([d[0], d[1], d[2]], e); b.circle('A', e, 0.24, 'y', 18);
      });
      const patch = [[-1.6, y, -0.9], [2.4, y, -0.9], [2.4, y, 2.1], [-1.6, y, 2.1]];
      patch.forEach((p) => b.A([d[0], d[1] - 0.08, d[2]], p));
      b.panel(patch, 0.1); b.poly('A', patch);
      // defects marked for the report
      [[-0.9, 1.2], [1.6, -0.3], [3.0, -2.0]].forEach(([x, z]) => { b.circle('P', [x, y + 0.01, z], 0.3, 'y', 20); b.circle('A', [x, y + 0.01, z], 0.08, 'y', 10); });
    },

    'emergency-and-reactive-repairs': function (b) {
      const pt = house(b, -3, 3, 2.2, 3, 5.2);
      for (let t = 0.07; t < 0.99; t += 0.07) b.S(pt(-3, t), pt(3, t));
      b.poly('P', [pt(-1.1, 0.36), pt(-0.4, 0.33), pt(0.5, 0.4), pt(0.7, 0.55), pt(0.2, 0.7), pt(-0.6, 0.66), pt(-1.2, 0.52)]);
      [0.43, 0.5, 0.57].forEach((t) => b.S(pt(-1.0, t), pt(-0.2, t)));
      // tarpaulin battened down over the damage
      const off = (p) => [p[0], p[1] + 0.07, p[2] + 0.06];
      const tarp = [off(pt(-1.7, 0.27)), off(pt(1.1, 0.27)), off(pt(1.1, 0.8)), off(pt(-1.7, 0.8))];
      b.sheet(tarp, 0.45);
      b.T(tarp[0], tarp[1]); b.T(tarp[3], tarp[2]);
      b.A(tarp[0], [-2.0, 0, 3.4]); b.A(tarp[1], [1.4, 0, 3.4]);
      [[-2.3, 3.0], [0.9, 3.3], [1.6, 2.8]].forEach(([x, z]) => b.poly('S', [[x, 0.02, z], [x + 0.3, 0.02, z], [x + 0.3, 0.02, z + 0.2], [x, 0.02, z + 0.2]]));
    },

    'leadwork-and-chimney-repairs': function (b) {
      const hd = 2.2, ey = 3, ry = 5.2, pt = house(b, -3, 3, hd, ey, ry);
      const ys = (z) => ey + (ry - ey) * (1 - z / hd);
      for (let t = 0.07; t < 0.99; t += 0.07) b.S(pt(-3, t), pt(3, t));
      const cx0 = 0.5, cx1 = 1.3, cz0 = 0.3, cz1 = 1.0, top = 6.6;
      b.box('P', cx0, ys(cz1) - 0.05, cz0, cx1, top, cz1);
      for (let y = 4.45; y < top - 0.1; y += 0.25) b.S([cx0, y, cz1], [cx1, y, cz1]);
      [0.72, 1.08].forEach((x) => { b.circle('P', [x, top, 0.65], 0.1, 'y', 14); b.P([x, top, 0.65], [x, top + 0.25, 0.65]); });
      // front apron
      b.sheet([[cx0 - 0.15, ys(cz1), cz1 + 0.01], [cx1 + 0.15, ys(cz1), cz1 + 0.01], [cx1 + 0.15, ys(cz1) + 0.25, cz1 + 0.01], [cx0 - 0.15, ys(cz1) + 0.25, cz1 + 0.01]], 0.55);
      b.sheet([[cx0 - 0.15, ys(cz1), cz1 + 0.01], [cx1 + 0.15, ys(cz1), cz1 + 0.01], [cx1 + 0.15, ys(cz1 + 0.25), cz1 + 0.26], [cx0 - 0.15, ys(cz1 + 0.25), cz1 + 0.26]], 0.55);
      // stepped flashings and soakers on both cheeks
      [cx0 - 0.01, cx1 + 0.01].forEach((x) => {
        b.panel([[x, ys(cz1), cz1], [x, ys(cz0), cz0], [x, ys(cz0) + 0.22, cz0], [x, ys(cz1) + 0.22, cz1]], 0.45);
        const pts = [];
        for (let k = 0; k < 4; k++) { const za = cz1 - k * 0.175, zb = za - 0.175; pts.push([x, ys(za) + 0.22, za], [x, ys(za) + 0.22, zb]); }
        pts.push([x, ys(cz0) + 0.22, cz0]);
        b.poly('A', pts, false);
      });
      // back gutter
      b.sheet([[cx0 - 0.15, ys(cz0), cz0 - 0.01], [cx1 + 0.15, ys(cz0), cz0 - 0.01], [cx1 + 0.15, ys(cz0 - 0.25), cz0 - 0.26], [cx0 - 0.15, ys(cz0 - 0.25), cz0 - 0.26]], 0.4);
    },

    'fascias-soffits-and-guttering': function (b) {
      const X = 6, ye = 3.0, ov = 0.45;
      b.poly('P', [[0, 0, 0], [X, 0, 0], [X, ye, 0], [0, ye, 0]]);
      b.P([0, 0, 0], [0, 0, -1.8]); b.P([0, ye, 0], [0, ye, -1.8]); b.S([0, 0, -1.8], [0, ye, -1.8]);
      [[0.8, 0.9], [3.6, 0.9]].forEach(([x, y]) => b.poly('S', [[x, y, 0], [x + 1.2, y, 0], [x + 1.2, y + 1.3, 0], [x, y + 1.3, 0]]));
      // roof above, tiles to the eaves
      const rp = (x, t) => [x, L(ye + 0.3, 5.0, t), L(ov, -1.8, t)];
      b.P(rp(0, 0), rp(0, 1)); b.P(rp(X, 0), rp(X, 1)); b.P(rp(0, 1), rp(X, 1));
      for (let t = 0.12; t < 0.99; t += 0.12) b.S(rp(0, t), rp(X, t));
      // soffit and fascia
      b.sheet([[0, ye, 0], [X, ye, 0], [X, ye, ov], [0, ye, ov]], 0.32);
      for (let x = 0.6; x < X; x += 1.2) b.poly('S', [[x, ye - 0.005, 0.15], [x + 0.4, ye - 0.005, 0.15], [x + 0.4, ye - 0.005, 0.3], [x, ye - 0.005, 0.3]]);
      b.sheet([[0, ye, ov], [X, ye, ov], [X, ye + 0.3, ov], [0, ye + 0.3, ov]], 0.6);
      // half-round gutter, brackets and downpipe
      const gc = [ye + 0.18, ov + 0.12], gr = 0.11, prof = (x) => { const p = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; p.push([x, gc[0] - Math.sin(a) * gr, gc[1] + Math.cos(a) * gr]); } return p; };
      b.poly('A', prof(0), false); b.poly('A', prof(X), false);
      [0, 2, 4, 6, 8].forEach((i) => { const a = (i / 8) * Math.PI; b.A([0, gc[0] - Math.sin(a) * gr, gc[1] + Math.cos(a) * gr], [X, gc[0] - Math.sin(a) * gr, gc[1] + Math.cos(a) * gr]); });
      for (let x = 0.5; x < X; x += 1) b.A([x, gc[0] - gr, gc[1]], [x, ye + 0.3, ov]);
      const px = 5.4;
      b.T([px, gc[0] - gr, gc[1]], [px, 2.65, gc[1]]); b.T([px, 2.65, gc[1]], [px, 2.35, 0.1]); b.T([px, 2.35, 0.1], [px, 0.25, 0.1]); b.T([px, 0.25, 0.1], [px, 0.05, 0.3]);
      [2.0, 1.0].forEach((y) => b.circle('A', [px, y, 0.1], 0.09, 'y', 12));
    },

    'planned-roof-maintenance': function (b) {
      const h = 4; flat(b, -4, 4, -3, 3, h, 0.5);
      const y = h + 0.02;
      const stops = [[-3.3, -2.3], [-3.3, 2.3], [3.3, 2.3], [1.8, -1.4], [3.3, -2.3]];
      stops.forEach(([x, z], i) => { if (i !== 3) { b.circle('P', [x, y, z], 0.14, 'y', 14); b.circle('P', [x, y, z], 0.06, 'y', 10); } b.circle('A', [x, y + 0.01, z], 0.32, 'y', 22); });
      b.box('P', 1.0, y, -2.1, 2.6, y + 1.1, -0.9); b.circle('S', [1.8, y + 1.1, -1.5], 0.35, 'y', 18);
      b.poly('S', [[-1.0, y, 2.0], [-0.2, y, 2.0], [-0.2, y, 2.6], [-1.0, y, 2.6]]);
      // dashed inspection route from the hatch
      const route = [[-0.6, 2.3], [-3.3, 2.3], [-3.3, -2.3], [1.8, -2.3], [1.8, -1.4], [3.3, -1.4], [3.3, 2.3]];
      for (let i = 0; i < route.length - 1; i++) {
        const [ax, az] = route[i], [bx, bz] = route[i + 1], len = Math.hypot(bx - ax, bz - az);
        for (let s = 0; s < len - 0.05; s += 0.45) { const t0 = s / len, t1 = Math.min(1, (s + 0.25) / len); b.A([L(ax, bx, t0), y + 0.02, L(az, bz, t0)], [L(ax, bx, t1), y + 0.02, L(az, bz, t1)]); }
      }
      // ticks on the stops already done
      stops.slice(0, 3).forEach(([x, z]) => { b.A([x + 0.36, y + 0.35, z], [x + 0.44, y + 0.27, z]); b.A([x + 0.44, y + 0.27, z], [x + 0.62, y + 0.5, z]); });
    },

    'rooflights-and-skylights': function (b) {
      const h = 4; flat(b, -4, 4, -3, 3, h, 0.4);
      const y = h;
      for (let x = -3; x <= 3.01; x += 1.5) b.S([x, y + 0.01, -2.8], [x, y + 0.01, 2.8]);
      // domed rooflights on kerbs
      [[-2.2, -1.2], [-2.2, 1.3]].forEach(([x, z]) => {
        b.box('P', x - 0.6, y, z - 0.6, x + 0.6, y + 0.3, z + 0.6);
        const c = [x, y + 0.3, z], r = 0.55;
        [0, 0.35, 0.75, 1.15].forEach((ph) => b.circle('A', [c[0], c[1] + r * Math.sin(ph) * 0.7, c[2]], r * Math.cos(ph), 'y', 22));
        for (let m = 0; m < 8; m++) {
          const th = (m / 8) * Math.PI * 2, pts = [];
          for (let s = 0; s <= 6; s++) { const ph = (s / 6) * (Math.PI / 2); pts.push([c[0] + r * Math.cos(ph) * Math.cos(th), c[1] + r * Math.sin(ph) * 0.7, c[2] + r * Math.cos(ph) * Math.sin(th)]); }
          b.poly('A', pts, false);
        }
      });
      // roof lantern
      const kx0 = 0.4, kx1 = 3.2, kz0 = -1.2, kz1 = 1.2, ky = y + 0.35, ry = ky + 0.95, rx0 = 1.1, rx1 = 2.5;
      b.box('P', kx0, y, kz0, kx1, ky, kz1);
      b.A([rx0, ry, 0], [rx1, ry, 0]);
      [[kx0, kz0, rx0], [kx0, kz1, rx0], [kx1, kz0, rx1], [kx1, kz1, rx1]].forEach(([x, z, rx]) => b.A([x, ky, z], [rx, ry, 0]));
      b.poly('A', [[kx0, ky, kz0], [kx1, ky, kz0], [kx1, ky, kz1], [kx0, ky, kz1]]);
      for (let x = rx0 + 0.35; x < rx1; x += 0.35) { b.A([x, ky, kz0], [x, ry, 0]); b.A([x, ky, kz1], [x, ry, 0]); }
      b.panel([[kx0, ky, kz1], [kx1, ky, kz1], [rx1, ry, 0], [rx0, ry, 0]], 0.16);
      b.panel([[kx0, ky, kz0], [kx1, ky, kz0], [rx1, ry, 0], [rx0, ry, 0]], 0.16);
      b.panel([[kx0, ky, kz0], [kx0, ky, kz1], [rx0, ry, 0], [rx0, ry, 0]], 0.16);
      b.panel([[kx1, ky, kz0], [kx1, ky, kz1], [rx1, ry, 0], [rx1, ry, 0]], 0.16);
    },
  };
  Object.assign(SCENES, ROOFING);
  const ENVIRONMENTAL = {
    /* ---------- environmental ---------- */
    'asbestos-management-surveys': function (b) {
      // cutaway plan: three rooms with walls cut at 1.4 m
      const wh = 1.4;
      const walls = [[[0, 0], [7, 0]], [[7, 0], [7, 5]], [[7, 5], [0, 5]], [[0, 5], [0, 0]], [[3, 0], [3, 1.8]], [[3, 2.8], [3, 5]], [[3, 2.6], [4.8, 2.6]], [[5.8, 2.6], [7, 2.6]]];
      walls.forEach(([a, c]) => { b.P([a[0], 0, a[1]], [c[0], 0, c[1]]); b.P([a[0], wh, a[1]], [c[0], wh, c[1]]); b.S([a[0], 0, a[1]], [a[0], wh, a[1]]); b.S([c[0], 0, c[1]], [c[0], wh, c[1]]); });
      // located materials
      for (let x = 0.3; x < 2.8; x += 0.25) b.A([x, 0.01, 0.3], [x, 0.01, 2.2]);
      b.poly('A', [[0.3, 0.01, 0.3], [2.75, 0.01, 0.3], [2.75, 0.01, 2.2], [0.3, 0.01, 2.2]]);
      b.T([3.3, 1.1, 4.8], [6.8, 1.1, 4.8]);
      b.sheet([[4.0, 0.01, 0.4], [6.7, 0.01, 0.4], [6.7, 0.01, 2.3], [4.0, 0.01, 2.3]], 0.22);
      // sample points
      const sg = new T3.SphereGeometry(0.08, 10, 8);
      [[1.5, 1.2], [5.0, 4.8], [5.4, 1.3], [1.4, 3.8]].forEach(([x, z], i) => {
        b.A([x, 0, z], [x, 2.0, z]); b.mesh(sg, [x, 2.0, z], i === 3); b.circle('A', [x, 0.02, z], 0.2, 'y', 16);
      });
    },

    'pre-refurbishment-and-pre-demolition-surveys': function (b) {
      // room corner: floor, back wall, side wall, ceiling void
      const W = 5, D = 4, H = 2.8, V = 3.6;
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]]);
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, V, 0], [0, V, 0]]);
      b.poly('P', [[0, 0, 0], [0, 0, D], [0, V, D], [0, V, 0]]);
      for (let x = 0.4; x < W; x += 0.4) b.S([x, 0, 0], [x, 0, D]);
      // suspended ceiling grid with one tile lifted
      for (let x = 0; x <= W + 0.01; x += 1.25) b.S([x, H, 0], [x, H, D]);
      for (let z = 0; z <= D + 0.01; z += 1.0) b.S([0, H, z], [W, H, z]);
      b.poly('P', [[2.5, H, 1], [3.75, H, 1], [3.75, H, 2], [2.5, H, 2]]);
      b.poly('S', [[2.5, H + 0.05, 2], [3.75, H + 0.05, 2], [3.75, H + 0.75, 2.35], [2.5, H + 0.75, 2.35]]);
      // lagged pipe hidden in the void
      b.T([0.2, H + 0.4, 1.5], [W - 0.2, H + 0.4, 1.5]);
      for (let x = 0.6; x < W; x += 0.6) b.circle('A', [x, H + 0.4, 1.5], 0.12, 'x', 12);
      // wall opening revealing board behind
      b.poly('P', [[1.2, 0.9, 0.01], [2.2, 0.9, 0.01], [2.2, 1.8, 0.01], [1.2, 1.8, 0.01]]);
      b.panel([[1.25, 0.95, 0.005], [2.15, 0.95, 0.005], [2.15, 1.75, 0.005], [1.25, 1.75, 0.005]], 0.6);
      // lifted floorboards revealing old tiles below
      b.poly('P', [[3.2, 0.01, 2.6], [4.4, 0.01, 2.6], [4.4, 0.01, 3.4], [3.2, 0.01, 3.4]]);
      b.panel([[3.25, 0.005, 2.65], [4.35, 0.005, 2.65], [4.35, 0.005, 3.35], [3.25, 0.005, 3.35]], 0.55);
      for (let x = 3.45; x < 4.35; x += 0.3) b.A([x, 0.01, 2.65], [x, 0.01, 3.35]);
      b.poly('S', [[3.2, 0.02, 3.5], [4.4, 0.02, 3.5], [4.4, 0.25, 3.9], [3.2, 0.25, 3.9]]);
    },

    'asbestos-removal': function (b) {
      const W = 7, D = 4.2, H = 3;
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]]);
      [[0, 0], [W, 0], [0, D]].forEach(([x, z]) => b.P([x, 0, z], [x, H, z]));
      b.P([0, H, 0], [W, H, 0]); b.P([0, H, 0], [0, H, D]);
      // enclosure
      encl(b, 0.3, 0, 0.3, 4.4, 2.8, 3.6, 0.09);
      // ceiling board half removed
      for (let x = 0.3; x < 4.4; x += 0.6) b.S([x, 2.79, 0.3], [x, 2.79, 3.6]);
      for (let x = 0.3; x < 2.1; x += 0.6) for (let z = 0.3; z < 3.5; z += 1.1) b.panel([[x + 0.02, 2.78, z + 0.02], [x + 0.58, 2.78, z + 0.02], [x + 0.58, 2.78, z + 1.08], [x + 0.02, 2.78, z + 1.08]], 0.55);
      // three-stage airlock
      [0, 1, 2].forEach((k) => encl(b, 1.6, 0, 3.6 + k * 0.9, 2.6, 2.1, 4.5 + k * 0.9, 0.12));
      // negative pressure unit and duct out
      b.box('A', 3.4, 0, 0.6, 4.1, 0.8, 1.3);
      b.T([4.1, 0.5, 0.95], [W + 0.4, 0.5, 0.95]);
      // double-bagged waste
      const bag = new T3.BoxGeometry(0.4, 0.35, 0.4);
      [[1.0, 3.1], [1.45, 3.1], [1.2, 2.65]].forEach(([x, z]) => b.mesh(bag, [x, 0.18, z], true));
    },

    'air-monitoring-and-bulk-sample-testing': function (b) {
      b.poly('P', [[-3, 0, -2.5], [3, 0, -2.5], [3, 0, 2.5], [-3, 0, 2.5]]);
      for (let x = -2.4; x < 3; x += 0.6) b.S([x, 0, -2.5], [x, 0, 2.5]);
      b.poly('P', [[-3, 0, -2.5], [3, 0, -2.5], [3, 2.6, -2.5], [-3, 2.6, -2.5]]);
      // tripod air sampler
      const hy = 1.5;
      [0, 1, 2].forEach((k) => { const a = (k / 3) * Math.PI * 2 + 0.3; b.T([Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55], [0, hy, 0]); });
      b.mesh(new T3.BoxGeometry(0.34, 0.24, 0.24), [0, hy - 0.25, 0]);
      b.mesh(new T3.CylinderGeometry(0.06, 0.06, 0.12, 12), [0, hy + 0.08, 0]);
      [0.35, 0.6, 0.85].forEach((r) => b.circle('A', [0, hy + 0.1, 0], r, 'y', 28));
      // bench with bulk sample pots
      b.box('P', 1.2, 0, -2.3, 2.8, 0.9, -1.5);
      [1.5, 1.95, 2.4].forEach((x) => {
        b.circle('P', [x, 0.9, -1.9], 0.12, 'y', 14); b.circle('P', [x, 1.15, -1.9], 0.12, 'y', 14);
        b.P([x - 0.12, 0.9, -1.9], [x - 0.12, 1.15, -1.9]); b.P([x + 0.12, 0.9, -1.9], [x + 0.12, 1.15, -1.9]);
        b.mesh(new T3.CylinderGeometry(0.13, 0.13, 0.05, 14), [x, 1.18, -1.9]);
      });
      // clearance certificate
      b.poly('P', [[1.4, 0.91, -1.4], [2.0, 0.91, -1.4], [2.0, 0.91, -0.6], [1.4, 0.91, -0.6]]);
      [-1.25, -1.1, -0.95].forEach((z) => b.S([1.5, 0.92, z], [1.9, 0.92, z]));
      b.A([1.55, 0.92, -0.8], [1.65, 0.92, -0.72]); b.A([1.65, 0.92, -0.72], [1.85, 0.92, -0.9]);
    },

    'asbestos-management-plans-and-registers': function (b) {
      // exploded floor plans with recorded materials
      const sg = new T3.SphereGeometry(0.07, 10, 8), pins = [];
      [0, 1.7, 3.4].forEach((y, f) => {
        b.poly('P', [[0, y, 0], [6, y, 0], [6, y, 4], [0, y, 4]]);
        b.S([2.5, y, 0], [2.5, y, 4]); b.S([2.5, y, 2.2], [6, y, 2.2]); b.S([0, y, 1.6], [2.5, y, 1.6]);
        const m = [[[1.2, 2.8], [4.3, 1.0]], [[4.4, 3.2]], [[1.0, 0.8], [3.8, 1.2], [5.2, 3.0]]][f];
        m.forEach(([x, z]) => { b.circle('A', [x, y + 0.01, z], 0.22, 'y', 16); b.A([x, y, z], [x, y + 0.55, z]); b.mesh(sg, [x, y + 0.55, z]); pins.push([x, y + 0.55, z]); });
      });
      // register sheet beside the stack
      const rx = 7.2;
      b.poly('P', [[rx, 0.4, 0.4], [rx, 0.4, 3.6], [rx, 4.6, 3.6], [rx, 4.6, 0.4]]);
      for (let k = 0; k < 6; k++) { const y = 4.1 - k * 0.6; b.S([rx, y, 1.2], [rx, y, 3.3]); b.circle('A', [rx, y, 0.8], 0.12, 'x', 12); }
      pins.slice(0, 3).forEach((p, i) => { const y = 4.1 - i * 0.6, n = 10; for (let s = 0; s < n; s += 2) b.A([L(p[0], rx, s / n), L(p[1], y, s / n), L(p[2], 0.8, s / n)], [L(p[0], rx, (s + 1) / n), L(p[1], y, (s + 1) / n), L(p[2], 0.8, (s + 1) / n)]); });
    },

    'asbestos-waste-collection-and-disposal': function (b) {
      b.poly('S', [[-3.5, 0, -2.5], [4, 0, -2.5], [4, 0, 3], [-3.5, 0, 3]]);
      // lockable enclosed skip
      const bot = [[-2.6, 0, -1.0], [0.6, 0, -1.0], [0.6, 0, 1.0], [-2.6, 0, 1.0]];
      const top = [[-3.2, 1.6, -1.25], [1.2, 1.6, -1.25], [1.2, 1.6, 1.25], [-3.2, 1.6, 1.25]];
      b.poly('P', bot); b.poly('P', top); bot.forEach((p, i) => b.P(p, top[i]));
      b.sheet([[-3.2, 1.62, -1.25], [-1.0, 1.75, -1.25], [-1.0, 1.75, 1.25], [-3.2, 1.62, 1.25]], 0.5);
      b.sheet([[-1.0, 1.75, -1.25], [1.2, 1.62, -1.25], [1.2, 1.62, 1.25], [-1.0, 1.75, 1.25]], 0.5);
      b.panel([[-1.4, 0.6, 1.13], [-0.6, 0.6, 1.13], [-0.6, 1.1, 1.17], [-1.4, 1.1, 1.17]], 0.95);
      b.box('A', -1.08, 1.45, 1.2, -0.92, 1.62, 1.32);
      // wrapped and labelled bags on a pallet
      b.box('P', 1.8, 0, -0.6, 3.2, 0.15, 0.6);
      const bag = new T3.BoxGeometry(0.42, 0.36, 0.5);
      [[2.1, 0.33, -0.3], [2.6, 0.33, -0.3], [2.1, 0.33, 0.3], [2.6, 0.33, 0.3], [2.35, 0.69, 0]].forEach((p) => b.mesh(bag, p, true));
      // consignment note
      b.poly('P', [[2.2, 0.02, 1.5], [2.9, 0.02, 1.5], [2.9, 0.02, 2.4], [2.2, 0.02, 2.4]]);
      [1.7, 1.85, 2.0, 2.15].forEach((z) => b.S([2.3, 0.03, z], [2.8, 0.03, z]));
    },

    'asbestos-encapsulation-and-repair': function (b) {
      // low shed with corrugated cement roof
      const X = 6, z0 = -2, z1 = 2, yl = 2.4, yh = 3.0;
      b.box('P', 0, 0, z0, X, yl, z1);
      b.P([0, yl, z0], [0, yh, z0]); b.P([X, yl, z0], [X, yh, z0]);
      b.P([0, yh, z0 - 0.2], [X, yh, z0 - 0.2]); b.P([0, yl, z1 + 0.2], [X, yl, z1 + 0.2]);
      b.P([0, yh, z0 - 0.2], [0, yl, z1 + 0.2]); b.P([X, yh, z0 - 0.2], [X, yl, z1 + 0.2]);
      const sl = (x, t, o) => [x, L(yh, yl, t) + (o || 0), L(z0 - 0.2, z1 + 0.2, t)];
      for (let x = 0.15; x < X; x += 0.15) { const ridge = Math.round(x / 0.15) % 2 === 0 ? 0.04 : 0; (x < 3 ? b.A : b.S).call(b, sl(x, 0, ridge), sl(x, 1, ridge)); }
      b.panel([sl(0, 0, 0.05), sl(3, 0, 0.05), sl(3, 1, 0.05), sl(0, 1, 0.05)], 0.4);
      for (let x = 0.5; x < X; x += 1.5) b.S(sl(x, 0.5), sl(x + 0.4, 0.55));
      // spray lance and fan
      const n = sl(3.15, 0.45, 0.6);
      b.T([4.5, 0.9, 3.4], n);
      [[2.7, 0.3], [3.6, 0.3], [3.6, 0.65], [2.7, 0.65]].forEach(([x, t]) => b.A(n, sl(x, t, 0.06)));
      // labelled, encapsulated pipe on the gable
      b.P([X + 0.01, 0.4, -1.2], [X + 0.01, 0.4, 1.2]);
      for (let z = -1.0; z <= 1.01; z += 0.25) b.circle('A', [X + 0.12, 0.4, z], 0.1, 'z', 12);
      b.panel([[X + 0.02, 1.2, -0.4], [X + 0.02, 1.2, 0.2], [X + 0.02, 1.6, 0.2], [X + 0.02, 1.6, -0.4]], 0.95);
    },

    'soft-strip-and-enabling-works': function (b) {
      const W = 8, D = 5, H = 3;
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]]);
      b.poly('P', [[0, H, 0], [W, H, 0], [W, H, D], [0, H, D]]);
      [0, 4, 8].forEach((x) => [0, 5].forEach((z) => b.P([x, 0, z], [x, H, z])));
      // back half still fitted: ceiling grid and stud partitions
      for (let x = 0; x <= W + 0.01; x += 1.2) b.S([x, H - 0.4, 0], [x, H - 0.4, 2.2]);
      for (let z = 0; z <= 2.21; z += 0.6) b.S([0, H - 0.4, z], [W, H - 0.4, z]);
      for (let x = 0.4; x < 3.6; x += 0.4) b.S([x, 0, 2.2], [x, H - 0.4, 2.2]);
      b.S([0.4, 0, 2.2], [3.6, 0, 2.2]); b.S([0.4, H - 0.4, 2.2], [3.6, H - 0.4, 2.2]);
      // stripped zone taped off
      const zone = [[0.3, 0.02, 2.6], [7.7, 0.02, 2.6], [7.7, 0.02, 4.7], [0.3, 0.02, 4.7]];
      for (let i = 0; i < 4; i++) { const p = zone[i], q = zone[(i + 1) % 4], len = Math.hypot(q[0] - p[0], q[2] - p[2]); for (let s = 0; s < len; s += 0.5) { const t0 = s / len, t1 = Math.min(1, (s + 0.3) / len); b.A([L(p[0], q[0], t0), 0.02, L(p[2], q[2], t0)], [L(p[0], q[0], t1), 0.02, L(p[2], q[2], t1)]); } }
      // stacked strip-out boards and segregated waste bins
      for (let k = 0; k < 4; k++) b.panel([[1.0, 0.05 + k * 0.08, 3.2], [3.4, 0.05 + k * 0.08, 3.2], [3.4, 0.05 + k * 0.08, 4.2], [1.0, 0.05 + k * 0.08, 4.2]], 0.3);
      b.box('A', 1.0, 0, 3.2, 3.4, 0.32, 4.2);
      [4.4, 5.6, 6.8].forEach((x, i) => { b.box('P', x, 0, 3.4, x + 0.9, 1.0, 4.4); b.panel([[x + 0.2, 0.55, 4.41], [x + 0.7, 0.55, 4.41], [x + 0.7, 0.85, 4.41], [x + 0.2, 0.85, 4.41]], i === 0 ? 0.95 : 0.35); });
    },

    'asbestos-awareness-training': function (b) {
      // teaching cutaway: where asbestos hides in a typical building
      const hd = 2.2, ey = 3, ry = 5.2, pt = house(b, -3, 3, hd, ey, ry);
      b.S([-3, 1.5, hd], [3, 1.5, hd]);
      const sg = new T3.SphereGeometry(0.08, 10, 8);
      const call = (p, h) => { b.A(p, [p[0], p[1] + h, p[2]]); b.mesh(sg, [p[0], p[1] + h, p[2]]); b.circle('A', [p[0], p[1] + h, p[2]], 0.18, 'z', 16); };
      // cement roof sheets on part of the slope
      for (let x = -2.8; x < -0.8; x += 0.2) b.A(pt(x, 0.05), pt(x, 0.6));
      b.panel([pt(-2.9, 0.05), pt(-0.8, 0.05), pt(-0.8, 0.6), pt(-2.9, 0.6)], 0.3);
      call(pt(-1.9, 0.6), 0.9);
      // lagged pipe in the loft
      b.T([0.2, ey + 0.4, -0.6], [2.6, ey + 0.4, -0.6]);
      for (let x = 0.4; x < 2.6; x += 0.4) b.circle('A', [x, ey + 0.4, -0.6], 0.1, 'x', 10);
      call([1.4, ey + 0.5, -0.6], 1.1);
      // textured ceiling and floor tiles
      b.panel([[-2.8, 1.49, -2.0], [0, 1.49, -2.0], [0, 1.49, 2.0], [-2.8, 1.49, 2.0]], 0.22);
      call([-1.4, 1.5, 1.2], 0.6);
      for (let x = 0.3; x < 2.8; x += 0.35) b.A([x, 0.01, -1.8], [x, 0.01, 1.8]);
      for (let z = -1.8; z < 1.85; z += 0.35) b.A([0.3, 0.01, z], [2.75, 0.01, z]);
      call([1.5, 0.01, 1.6], 0.7);
    },

    'emergency-asbestos-response': function (b) {
      const W = 6, D = 4.5, H = 2.8;
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]]);
      [[0, 0], [W, 0], [0, D]].forEach(([x, z]) => b.P([x, 0, z], [x, H, z]));
      b.P([0, H, 0], [W, H, 0]); b.P([0, H, 0], [0, H, D]);
      // damaged ceiling board and debris below
      b.panel([[1.6, H, 0.8], [4.0, H, 0.8], [4.0, H, 2.6], [1.6, H, 2.6]], 0.35);
      b.poly('P', [[2.4, H - 0.01, 1.3], [2.9, H - 0.01, 1.1], [3.4, H - 0.01, 1.5], [3.2, H - 0.01, 2.1], [2.6, H - 0.01, 2.0]]);
      const frag = new T3.BoxGeometry(0.22, 0.03, 0.16);
      [[2.6, 1.5], [3.0, 1.9], [2.8, 1.2], [3.4, 1.7], [2.3, 1.9]].forEach(([x, z]) => b.mesh(frag, [x, 0.02, z], true));
      // exclusion zone with signs
      const posts = [[1.2, 0.5], [4.6, 0.5], [4.6, 3.2], [1.2, 3.2]];
      posts.forEach(([x, z]) => { b.T([x, 0, z], [x, 1.1, z]); b.poly('S', [[x - 0.15, 0, z - 0.15], [x + 0.15, 0, z - 0.15], [x + 0.15, 0, z + 0.15], [x - 0.15, 0, z + 0.15]]); });
      posts.forEach((p, i) => { const q = posts[(i + 1) % 4]; b.A([p[0], 1.0, p[1]], [q[0], 1.0, q[1]]); b.A([p[0], 0.6, p[1]], [q[0], 0.6, q[1]]); });
      b.panel([[2.6, 0.65, 3.21], [3.2, 0.65, 3.21], [3.2, 0.95, 3.21], [2.6, 0.95, 3.21]], 0.95);
      // air test pump at the zone edge
      [0, 1, 2].forEach((k) => { const a = (k / 3) * Math.PI * 2; b.Bd([5.2 + Math.cos(a) * 0.3, 0, 3.8 + Math.sin(a) * 0.3], [5.2, 1.2, 3.8]); });
      b.mesh(new T3.BoxGeometry(0.26, 0.18, 0.18), [5.2, 1.0, 3.8]);
    },
  };
  Object.assign(SCENES, ENVIRONMENTAL);
  const COMPLIANCE = {
    /* ---------- compliance ---------- */
    'cdm-2015-principal-designer-duties': function (b) {
      // design drawing with safety designed in
      const W = 8, D = 6;
      b.poly('P', [[-W / 2, 0, -D / 2], [W / 2, 0, -D / 2], [W / 2, 0, D / 2], [-W / 2, 0, D / 2]]);
      for (let x = -3; x <= 3.01; x += 1) b.S([x, 0, -D / 2 + 0.2], [x, 0, D / 2 - 0.2]);
      for (let z = -2; z <= 2.01; z += 1) b.S([-W / 2 + 0.2, 0, z], [W / 2 - 0.2, 0, z]);
      const x0 = -2.4, x1 = 1.8, z0 = -1.8, z1 = 1.2, h = 3.2;
      b.box('P', x0, 0, z0, x1, h, z1);
      for (let x = x0 + 0.5; x < x1 - 0.6; x += 1.2) [0.8, 2.1].forEach((y) => b.poly('S', [[x, y, z1], [x + 0.7, y, z1], [x + 0.7, y + 0.8, z1], [x, y + 0.8, z1]]));
      b.box('S', -1.0, h, -1.2, 0.4, h + 0.9, -0.2);
      // parapet edge protection, fixed access stair and route to plant
      const R = [[x0, h + 1.0, z0], [x1, h + 1.0, z0], [x1, h + 1.0, z1], [x0, h + 1.0, z1]];
      b.poly('A', R); R.forEach((p) => b.A([p[0], h, p[2]], p));
      b.poly('A', [[x0, h + 0.5, z0], [x1, h + 0.5, z0], [x1, h + 0.5, z1], [x0, h + 0.5, z1]]);
      const sx = x1 + 0.2;
      b.T([sx, 0, 0.9], [sx + 0.0, h, -0.6]); b.T([sx + 0.8, 0, 0.9], [sx + 0.8, h, -0.6]);
      for (let k = 1; k < 12; k++) { const t = k / 12; b.Bd([sx, t * h, L(0.9, -0.6, t)], [sx + 0.8, t * h, L(0.9, -0.6, t)]); }
      const route = [[x1 - 0.2, -0.6], [0.8, -0.6], [0.8, -0.7]];
      for (let s = 0; s < 1; s += 0.1) b.A([L(route[0][0], route[1][0], s), h + 0.02, -0.6], [L(route[0][0], route[1][0], s + 0.05), h + 0.02, -0.6]);
      // design risk register pins
      const sg = new T3.SphereGeometry(0.08, 10, 8);
      [[x0, h + 1.0, z1], [sx + 0.4, h, -0.6], [-0.3, h + 0.9, -0.7]].forEach((p) => { b.A(p, [p[0], p[1] + 0.8, p[2]]); b.mesh(sg, [p[0], p[1] + 0.8, p[2]]); });
    },

    'retained-health-and-safety-advisor': function (b) {
      // one advisor connected to every site in the portfolio
      b.box('P', -4.5, 0, -1.0, -2.5, 2.4, 1.0);
      b.box('P', -0.8, 0, -3.6, 1.0, 4.2, -2.0);
      b.box('P', 2.6, 0, 0.6, 4.8, 1.6, 2.6); b.P([2.6, 1.6, 1.6], [4.8, 1.6, 1.6]);
      b.box('P', -1.5, 0, 2.4, 0.3, 3.0, 3.8);
      [[-4.5, -2.5, -1.0, 1.0, 2.4], [-0.8, 1.0, -3.6, -2.0, 4.2], [-1.5, 0.3, 2.4, 3.8, 3.0]].forEach(([a, c, d, e, h]) => { for (let y = 1; y < h; y += 1) b.S([a, y, e], [c, y, e]); });
      const hub = [0, 5.2, 0];
      b.mesh(new T3.SphereGeometry(0.16, 14, 10), hub);
      b.circle('A', hub, 0.35, 'y', 24); b.circle('A', [0, 0.02, 0], 0.5, 'y', 24); b.A([0, 0, 0], hub);
      [[-3.5, 2.4, 0], [0.1, 4.2, -2.8], [3.7, 1.6, 1.6], [-0.6, 3.0, 3.1]].forEach((p) => {
        const n = 12; for (let s = 0; s < n; s += 2) b.A([L(hub[0], p[0], s / n), L(hub[1], p[1], s / n), L(hub[2], p[2], s / n)], [L(hub[0], p[0], (s + 1) / n), L(hub[1], p[1], (s + 1) / n), L(hub[2], p[2], (s + 1) / n)]);
        b.circle('A', p, 0.18, 'y', 14);
      });
    },

    'site-inspections-and-audits': function (b) {
      const W = 9, D = 6;
      // hoarding, frame and cabins
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]]);
      b.poly('S', [[0, 2.0, 0], [W, 2.0, 0], [W, 2.0, D], [0, 2.0, D]]);
      [[0, 0], [W, 0], [W, D], [0, D]].forEach(([x, z]) => b.S([x, 0, z], [x, 2.0, z]));
      for (let x = 2; x <= 6.01; x += 2) for (let z = 1.2; z <= 3.61; z += 2.4) b.P([x, 0, z], [x, 6, z]);
      [2, 4, 6].forEach((y) => b.poly('S', [[2, y, 1.2], [6, y, 1.2], [6, y, 3.6], [2, y, 3.6]]));
      b.box('P', 6.8, 0, 4.4, 8.6, 1.3, 5.6); b.box('P', 6.8, 1.3, 4.4, 8.6, 2.6, 5.6);
      // audit route and checkpoints
      const pts = [[0.8, 5.2], [0.8, 0.8], [6.6, 0.8], [6.6, 4.0], [7.7, 4.0]];
      for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az); for (let s = 0; s < len - 0.05; s += 0.45) { const t0 = s / len, t1 = Math.min(1, (s + 0.25) / len); b.A([L(ax, bx, t0), 0.02, L(az, bz, t0)], [L(ax, bx, t1), 0.02, L(az, bz, t1)]); } }
      const sg = new T3.SphereGeometry(0.08, 10, 8);
      [[0.8, 0.8, 0], [4, 0.8, 0], [6.6, 2.4, 0], [4, 6.02, 1.2], [7.7, 4.0, 0]].forEach(([x, z, y], i) => {
        b.A([x, y, z], [x, y + 0.9, z]); b.mesh(sg, [x, y + 0.9, z]); b.circle('A', [x, y + 0.02, z], 0.25, 'y', 18);
        if (i < 3) { b.A([x + 0.2, y + 1.15, z], [x + 0.28, y + 1.07, z]); b.A([x + 0.28, y + 1.07, z], [x + 0.46, y + 1.3, z]); }
      });
    },

    'risk-assessments-and-method-statements': function (b) {
      // 5 x 5 risk matrix on a stand
      const c = 0.6, gx = 0, gy = 0.8;
      for (let i = 0; i <= 5; i++) { b.P([gx + i * c, gy, 0], [gx + i * c, gy + 5 * c, 0]); b.P([gx, gy + i * c, 0], [gx + 5 * c, gy + i * c, 0]); }
      [[0.4, 0.4], [2.6, 0.4]].forEach(([x, z]) => b.P([x, 0, z], [x, gy, 0.02]));
      b.P([1.5, 0, -0.5], [1.5, gy + 2.5 * c, -0.02]);
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i + j < 4) b.panel([[gx + i * c + 0.03, gy + j * c + 0.03, 0.01], [gx + (i + 1) * c - 0.03, gy + j * c + 0.03, 0.01], [gx + (i + 1) * c - 0.03, gy + (j + 1) * c - 0.03, 0.01], [gx + i * c + 0.03, gy + (j + 1) * c - 0.03, 0.01]], 0.12 + (3 - i - j) * 0.1);
      // hazard moved from high to low by the controls
      const hi = [gx + 4.5 * c, gy + 4.5 * c, 0.05], lo = [gx + 0.5 * c, gy + 1.5 * c, 0.05];
      b.circle('P', hi, 0.14, 'z', 16);
      b.mesh(new T3.SphereGeometry(0.1, 12, 8), lo);
      for (let s = 0; s < 1; s += 0.1) b.A([L(hi[0], lo[0], s), L(hi[1], lo[1], s), 0.06], [L(hi[0], lo[0], s + 0.05), L(hi[1], lo[1], s + 0.05), 0.06]);
      // method statement stack with the approved sheet on top
      for (let k = 0; k < 4; k++) b.poly('P', [[3.6, 0.02 + k * 0.05, 0.6], [4.6, 0.02 + k * 0.05, 0.6], [4.6, 0.02 + k * 0.05, 1.9], [3.6, 0.02 + k * 0.05, 1.9]]);
      [0.85, 1.05, 1.25, 1.45].forEach((z) => b.S([3.75, 0.2, z], [4.45, 0.2, z]));
      b.A([3.8, 0.2, 1.65], [3.95, 0.2, 1.78]); b.A([3.95, 0.2, 1.78], [4.3, 0.2, 1.55]);
    },

    'health-and-safety-training': function (b) {
      b.poly('S', [[-3.5, 0, -2.5], [3.5, 0, -2.5], [3.5, 0, 3.5], [-3.5, 0, 3.5]]);
      // board with training matrix
      b.poly('P', [[-1.8, 0.9, -2], [1.8, 0.9, -2], [1.8, 2.9, -2], [-1.8, 2.9, -2]]);
      [[-1.5, 0], [1.5, 0]].forEach(([x]) => b.P([x, 0, -2], [x, 0.9, -2]));
      for (let i = 0; i <= 6; i++) b.S([-1.5 + i * 0.5, 1.1, -1.99], [-1.5 + i * 0.5, 2.7, -1.99]);
      for (let j = 0; j <= 4; j++) b.S([-1.5, 1.1 + j * 0.4, -1.99], [1.5, 1.1 + j * 0.4, -1.99]);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if ((i * 3 + j) % 4 !== 0) b.panel([[-1.47 + i * 0.5, 1.13 + j * 0.4, -1.98], [-1.03 + i * 0.5, 1.13 + j * 0.4, -1.98], [-1.03 + i * 0.5, 1.47 + j * 0.4, -1.98], [-1.47 + i * 0.5, 1.47 + j * 0.4, -1.98]], 0.55);
      // stools in an arc with hard hats
      const hat = new T3.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      for (let k = 0; k < 6; k++) {
        const a = Math.PI * (0.15 + 0.7 * (k / 5)), x = Math.cos(a) * 2.6, z = 1.0 + Math.sin(a) * 1.6 - 0.4;
        b.circle('P', [x, 0.45, z], 0.2, 'y', 14); b.P([x - 0.14, 0, z - 0.14], [x - 0.14, 0.45, z - 0.14]); b.P([x + 0.14, 0, z + 0.14], [x + 0.14, 0.45, z + 0.14]); b.P([x + 0.14, 0, z - 0.14], [x + 0.14, 0.45, z - 0.14]); b.P([x - 0.14, 0, z + 0.14], [x - 0.14, 0.45, z + 0.14]);
        b.mesh(hat, [x, 0.46, z]); b.circle('A', [x, 0.47, z], 0.26, 'y', 16);
      }
    },

    'fire-risk-assessments': function (b) {
      // floor plan cut at 1.4 m with stair core
      const wh = 1.4, segs = [[[0, 0], [9, 0]], [[9, 0], [9, 5]], [[9, 5], [0, 5]], [[0, 5], [0, 0]], [[0, 2], [2.4, 2]], [[3.4, 2], [5.6, 2]], [[6.6, 2], [9, 2]], [[0, 3], [2.4, 3]], [[3.4, 3], [9, 3]], [[3, 0], [3, 2]], [[6, 0], [6, 2]], [[4.5, 3], [4.5, 5]]];
      segs.forEach(([a, c]) => { b.P([a[0], 0, a[1]], [c[0], 0, c[1]]); b.P([a[0], wh, a[1]], [c[0], wh, c[1]]); b.S([a[0], 0, a[1]], [a[0], wh, a[1]]); b.S([c[0], 0, c[1]], [c[0], wh, c[1]]); });
      b.box('P', 7.0, 0, 3.2, 8.8, 3.4, 4.8);
      for (let k = 0; k < 9; k++) b.S([7.1, k * 0.37, 3.3 + k * 0.17], [8.0, k * 0.37, 3.3 + k * 0.17]);
      // fire doors
      [[2.4, 2], [5.6, 2], [2.4, 3]].forEach(([x, z]) => b.poly('A', [[x, 0, z], [x + 1.0, 0, z], [x + 1.0, 2.1, z], [x, 2.1, z]]));
      b.poly('A', [[7.0, 0, 3.6], [7.0, 0, 4.5], [7.0, 2.1, 4.5], [7.0, 2.1, 3.6]]);
      // escape route to the stair and final exit
      const route = [[1.5, 1.0], [1.5, 2.5], [6.5, 2.5], [6.5, 4.05], [7.8, 4.05]];
      for (let i = 0; i < route.length - 1; i++) { const [ax, az] = route[i], [bx, bz] = route[i + 1], len = Math.hypot(bx - ax, bz - az); for (let s = 0; s < len - 0.05; s += 0.45) { const t0 = s / len, t1 = Math.min(1, (s + 0.25) / len); b.A([L(ax, bx, t0), 0.03, L(az, bz, t0)], [L(ax, bx, t1), 0.03, L(az, bz, t1)]); } }
      b.A([7.5, 0.03, 3.85], [7.8, 0.03, 4.05]); b.A([7.5, 0.03, 4.25], [7.8, 0.03, 4.05]);
      // exit signs over the doors
      [[2.9, 2], [6.1, 2]].forEach(([x, z]) => b.panel([[x - 0.25, 2.25, z + 0.01], [x + 0.25, 2.25, z + 0.01], [x + 0.25, 2.5, z + 0.01], [x - 0.25, 2.5, z + 0.01]], 0.95));
      b.panel([[7.0, 2.25, 3.8], [7.0, 2.25, 4.3], [7.0, 2.5, 4.3], [7.0, 2.5, 3.8]], 0.95);
    },

    'coshh-assessments': function (b) {
      b.poly('S', [[-3, 0, -2], [3.5, 0, -2], [3.5, 0, 2.5], [-3, 0, 2.5]]);
      b.poly('P', [[-3, 0, -2], [3.5, 0, -2], [3.5, 3, -2], [-3, 3, -2]]);
      // substance shelving with labelled containers
      b.box('P', -2.8, 0, -1.95, -0.4, 2.4, -1.35);
      [0.8, 1.6].forEach((y) => b.poly('P', [[-2.8, y, -1.95], [-0.4, y, -1.95], [-0.4, y, -1.35], [-2.8, y, -1.35]]));
      [[0, 0.25], [0.8, 0.22], [1.6, 0.2]].forEach(([y, r], row) => {
        for (let k = 0; k < 4; k++) {
          const x = -2.45 + k * 0.58, z = -1.65;
          b.circle('P', [x, y + 0.02, z], r, 'y', 14); b.circle('P', [x, y + 0.6, z], r, 'y', 14);
          b.P([x - r, y + 0.02, z], [x - r, y + 0.6, z]); b.P([x + r, y + 0.02, z], [x + r, y + 0.6, z]);
          if ((k + row) % 2 === 0) b.panel([[x - r * 0.7, y + 0.2, z + r + 0.01], [x + r * 0.7, y + 0.2, z + r + 0.01], [x + r * 0.7, y + 0.45, z + r + 0.01], [x - r * 0.7, y + 0.45, z + r + 0.01]], 0.95);
        }
      });
      // workbench with local exhaust ventilation
      b.box('P', 0.6, 0, -1.6, 3.2, 0.9, -0.4);
      const hood = [[1.0, 1.6, -1.6], [2.8, 1.6, -1.6], [2.8, 1.6, -0.8], [1.0, 1.6, -0.8]];
      b.poly('A', hood); b.A(hood[0], [1.6, 2.1, -1.6]); b.A(hood[1], [2.2, 2.1, -1.6]); b.A(hood[2], [2.2, 2.1, -1.4]); b.A(hood[3], [1.6, 2.1, -1.4]);
      b.poly('A', [[1.6, 2.1, -1.6], [2.2, 2.1, -1.6], [2.2, 2.1, -1.4], [1.6, 2.1, -1.4]]);
      b.T([1.9, 2.1, -1.5], [1.9, 2.8, -1.5]); b.T([1.9, 2.8, -1.5], [1.9, 2.8, -1.95]);
      [0.3, 0.55].forEach((r) => b.circle('A', [1.9, 1.05, -1.2], r, 'y', 20));
    },

    'accident-investigation-and-riddor-reporting': function (b) {
      wall(b, -1, 6, 4.4);
      // fallen ladder
      b.P([1.2, 0.02, 1.0], [4.6, 0.02, 1.9]); b.P([1.05, 0.02, 1.45], [4.45, 0.02, 2.35]);
      for (let t = 0.08; t < 1; t += 0.09) b.P([L(1.2, 4.6, t), 0.02, L(1.0, 1.9, t)], [L(1.05, 4.45, t), 0.02, L(1.45, 2.35, t)]);
      b.S([1.0, 3.2, 0], [1.4, 3.2, 0.02]);
      // cordon
      const posts = [[0, 0.4], [5.6, 0.4], [5.6, 3.4], [0, 3.4]];
      posts.forEach(([x, z]) => b.T([x, 0, z], [x, 1.0, z]));
      posts.forEach((p, i) => { const q = posts[(i + 1) % 4]; b.A([p[0], 0.95, p[1]], [q[0], 0.95, q[1]]); });
      // evidence markers and measurements
      const cone = new T3.ConeGeometry(0.12, 0.26, 4);
      [[1.0, 0.8], [2.9, 2.6], [4.9, 1.6], [1.25, 0.15]].forEach(([x, z]) => b.mesh(cone, [x, 0.13, z]));
      [[[1.0, 0.8], [4.9, 1.6]], [[1.0, 0.8], [1.25, 0.15]]].forEach(([a, c]) => { const n = 14; for (let s = 0; s < n; s += 2) b.A([L(a[0], c[0], s / n), 0.03, L(a[1], c[1], s / n)], [L(a[0], c[0], (s + 1) / n), 0.03, L(a[1], c[1], (s + 1) / n)]); });
      // report sheet
      b.poly('P', [[3.6, 0.02, 2.7], [4.4, 0.02, 2.7], [4.4, 0.02, 3.3], [3.6, 0.02, 3.3]]);
      [2.85, 3.0, 3.15].forEach((z) => b.S([3.7, 0.03, z], [4.3, 0.03, z]));
    },

    'construction-phase-plans': function (b) {
      const W = 10, D = 7;
      b.poly('P', [[0, 0, 0], [W, 0, 0], [W, 0, D], [0, 0, D]]);
      [[0, 0], [W, 0], [W, D], [0, D]].forEach(([x, z]) => b.S([x, 0, z], [x, 1.8, z]));
      b.poly('S', [[0, 1.8, 0], [W, 1.8, 0], [W, 1.8, D], [0, 1.8, D]]);
      // building under construction, cabins, compound and crane
      b.box('P', 3, 0, 1, 7.5, 4, 4.5);
      [1.3, 2.6].forEach((y) => b.poly('S', [[3, y, 1], [7.5, y, 1], [7.5, y, 4.5], [3, y, 4.5]]));
      b.box('P', 0.4, 0, 5.4, 2.4, 1.2, 6.6); b.box('P', 0.4, 1.2, 5.4, 2.4, 2.4, 6.6);
      b.poly('P', [[8.2, 0, 0.4], [9.6, 0, 0.4], [9.6, 0, 2.4], [8.2, 0, 2.4]]);
      b.P([8.6, 0, 5.8], [8.6, 7, 5.8]); b.P([9.0, 0, 5.8], [9.0, 7, 5.8]); b.P([5.0, 7, 5.8], [10.2, 7, 5.8]);
      // the plan: routes, gate, muster and fire points
      const dash = (pts) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az); for (let s = 0; s < len - 0.05; s += 0.45) { const t0 = s / len, t1 = Math.min(1, (s + 0.25) / len); b.A([L(ax, bx, t0), 0.02, L(az, bz, t0)], [L(ax, bx, t1), 0.02, L(az, bz, t1)]); } } };
      dash([[4.5, D], [4.5, 5.2], [2.6, 5.2]]); dash([[3.0, 4.9], [7.8, 4.9], [7.8, 1.0]]);
      b.A([5.6, 0.02, D], [5.6, 0.02, 5.4]); b.A([7.4, 0.02, D], [7.4, 0.02, 5.4]); b.A([5.6, 0.02, 5.4], [7.4, 0.02, 5.4]);
      b.poly('A', [[5.4, 0, D], [7.6, 0, D], [7.6, 1.8, D], [5.4, 1.8, D]]);
      b.circle('A', [1.4, 0.02, 3.6], 0.6, 'y', 26); b.circle('A', [1.4, 0.02, 3.6], 0.3, 'y', 20);
      b.mesh(new T3.SphereGeometry(0.1, 10, 8), [8.9, 1.2, 3.2]); b.A([8.9, 0, 3.2], [8.9, 1.2, 3.2]);
    },

    'contractor-accreditation-support': function (b) {
      b.poly('S', [[-3, 0, -2], [3, 0, -2], [3, 0, 2.5], [-3, 0, 2.5]]);
      // evidence folders
      [[-2.5, 0], [-2.0, 0.08], [-1.55, 0.16]].forEach(([x, dz]) => b.box('P', x, 0, -1.4 + dz, x + 0.38, 1.4, -0.2 + dz));
      [-2.31, -1.81, -1.36].forEach((x) => b.panel([[x - 0.12, 0.9, -0.19], [x + 0.12, 0.9, -0.19], [x + 0.12, 1.15, -0.19], [x - 0.12, 1.15, -0.19]], 0.6));
      // certificate on a stand with the accreditation seal
      const cz = -0.6;
      b.poly('P', [[0, 0.5, cz], [2.2, 0.5, cz], [2.2, 3.4, cz], [0, 3.4, cz]]);
      b.poly('S', [[0.15, 0.65, cz], [2.05, 0.65, cz], [2.05, 3.25, cz], [0.15, 3.25, cz]]);
      [2.9, 2.7].forEach((y) => b.S([0.4, y, cz], [1.8, y, cz]));
      [[0.3, 0], [1.9, 0]].forEach(([x]) => b.P([x, 0, cz + 0.4], [x, 0.5, cz]));
      const c = [1.1, 1.6, cz + 0.02];
      b.circle('A', c, 0.45, 'z', 32); b.circle('A', c, 0.34, 'z', 28);
      b.panel([[c[0] - 0.12, c[1] - 0.4, c[2]], [c[0] - 0.02, c[1] - 0.4, c[2]], [c[0] - 0.12, c[1] - 0.95, c[2]], [c[0] - 0.24, c[1] - 0.85, c[2]]], 0.7);
      b.panel([[c[0] + 0.02, c[1] - 0.4, c[2]], [c[0] + 0.12, c[1] - 0.4, c[2]], [c[0] + 0.24, c[1] - 0.85, c[2]], [c[0] + 0.12, c[1] - 0.95, c[2]]], 0.7);
      b.A([c[0] - 0.16, c[1], c[2]], [c[0] - 0.04, c[1] - 0.12, c[2]]); b.A([c[0] - 0.04, c[1] - 0.12, c[2]], [c[0] + 0.2, c[1] + 0.16, c[2]]);
      // checklist with every line ticked
      b.poly('P', [[2.6, 0.02, 0.2], [3.0, 0.02, 0.2], [3.0, 0.02, 1.8], [2.6, 0.02, 1.8]].map((p) => [p[0] - 0.2, p[1], p[2]]));
      [0.45, 0.8, 1.15, 1.5].forEach((z) => { b.S([2.55, 0.03, z], [2.75, 0.03, z]); b.A([2.45, 0.03, z - 0.05], [2.48, 0.03, z]); b.A([2.48, 0.03, z], [2.52, 0.03, z - 0.1]); });
    },
  };
  Object.assign(SCENES, COMPLIANCE);

  /* ---------- runtime: one renderer, scissored per element ---------- */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer = null, canvas = null, header = null;
  const views = [];

  function makeView(el) {
    let key = (el.getAttribute('data-scene') || '').trim();
    if (!key || key === 'auto' || !SCENES[key]) {
      const item = el.closest('.w-dyn-item'), a = item && item.querySelector('a[href]');
      const path = (a ? a.getAttribute('href') : location.pathname).split('?')[0].replace(/\/+$/, '');
      const last = path.split('/').pop();
      if (SCENES[last]) key = last;
    }
    const fn = SCENES[key];
    if (!fn) return null;
    const b = new Builder(el.getAttribute('data-accent') || '#ed1c24');
    fn(b);
    const scene = new T3.Scene();
    scene.add(b.build());
    const box = b.bounds(), c = box.getCenter(new T3.Vector3()), size = box.getSize(new T3.Vector3());
    const span = Math.ceil((Math.max(size.x, size.z) * 1.7) / 0.6) * 0.6;
    const grid = new T3.GridHelper(span, Math.round(span / 0.6), COL.g1, COL.g2);
    grid.position.set(c.x, box.min.y - 0.01, c.z);
    scene.add(grid);
    const camera = new T3.PerspectiveCamera(30, 4 / 3, 0.1, 400);
    const radius = size.length() / 2;
    const v = {
      el, scene, camera, target: c, dist: (radius / Math.sin((30 * Math.PI) / 360)) * 0.78,
      yaw: parseFloat(el.getAttribute('data-yaw') || '0.62'), pitch: 0.36, drag: null, idle: 0
    };
    v.clip = el.closest('[data-vignette-clip]');
    const mouseOnly = el.getAttribute('data-drag') === 'mouse';
    if (mouseOnly) el.style.touchAction = 'auto';
    let moved = 0;
    el.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } moved = 0; }, true);
    el.addEventListener('dragstart', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      if (mouseOnly && e.pointerType !== 'mouse') return;
      moved = 0;
      v.drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', (e) => {
      if (!v.drag || v.drag.id !== e.pointerId) return;
      moved += Math.abs(e.clientX - v.drag.x) + Math.abs(e.clientY - v.drag.y);
      v.yaw -= (e.clientX - v.drag.x) * 0.008;
      if (e.pointerType === 'mouse') v.pitch = Math.min(1.15, Math.max(0.06, v.pitch + (e.clientY - v.drag.y) * 0.005));
      v.drag.x = e.clientX; v.drag.y = e.clientY;
    });
    const end = () => { v.drag = null; v.idle = performance.now() + 3500; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.tabIndex = 0;
    el.setAttribute('role', 'img');
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { v.yaw += 0.2; v.idle = performance.now() + 3500; }
      if (e.key === 'ArrowRight') { v.yaw -= 0.2; v.idle = performance.now() + 3500; }
    });
    return v;
  }

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    size();
    renderer.setScissorTest(false); renderer.clear();
    renderer.setScissorTest(true);
    const H = canvas.clientHeight, W = canvas.clientWidth;
    let top = 0;
    if (header) { const hs = getComputedStyle(header); if (hs.position === 'fixed' || hs.position === 'sticky') { const hr = header.getBoundingClientRect(); if (hr.top <= 0 && hr.bottom > 0) top = hr.bottom; } }
    views.forEach((v) => {
      const r = v.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W || r.width < 2) return;
      if (!reduce && !v.drag && now > v.idle) v.yaw += dt * 0.16;
      const cp = Math.cos(v.pitch);
      v.camera.position.set(
        v.target.x + v.dist * cp * Math.sin(v.yaw),
        v.target.y + v.dist * Math.sin(v.pitch),
        v.target.z + v.dist * cp * Math.cos(v.yaw));
      v.camera.lookAt(v.target);
      v.camera.aspect = r.width / r.height; v.camera.updateProjectionMatrix();
      let cl = 0, cr = W, ct = top, cb = H;
      if (v.clip) { const c = v.clip.getBoundingClientRect(); cl = Math.max(cl, c.left); cr = Math.min(cr, c.right); ct = Math.max(ct, c.top); cb = Math.min(cb, c.bottom); }
      const sl = Math.max(r.left, cl), sr = Math.min(r.right, cr), st = Math.max(r.top, ct), sb = Math.min(r.bottom, cb);
      if (sr - sl <= 1 || sb - st <= 1) return;
      renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
      renderer.setScissor(sl, H - sb, sr - sl, sb - st);
      renderer.render(v.scene, v.camera);
    });
    requestAnimationFrame(frame);
  }

  function mountAll(opts) {
    opts = opts || {};
    canvas = opts.canvas || document.getElementById('talon-vignette-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'talon-vignette-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;display:block';
      document.body.appendChild(canvas);
    }
    header = document.querySelector(opts.header || '[data-talon-nav], .navbar, .w-nav, header');
    try {
      renderer = new T3.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    document.querySelectorAll(opts.selector || '.talon-vignette').forEach((el) => { const v = makeView(el); if (v) views.push(v); });
    requestAnimationFrame(frame);
    return true;
  }

  window.TalonVignettes = { mountAll, scenes: Object.keys(SCENES) };
}

/* Talon Vignettes v1.0.1 | blueprint service models | Morphed Studio */
(function () {
  var els = document.querySelectorAll('.talon-vignette');
  if (!els.length) return;
  var style = document.createElement('style');
  style.textContent = '.talon-vignette{position:relative;aspect-ratio:4/3;max-width:100%;cursor:grab;touch-action:pan-y}.talon-vignette:active{cursor:grabbing}';
  document.head.appendChild(style);
  function go() { __talonLib(); window.TalonVignettes && window.TalonVignettes.mountAll(); }
  if (window.THREE && window.THREE.InstancedMesh) return go();
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  s.async = true; s.onload = go;
  document.head.appendChild(s);
})();

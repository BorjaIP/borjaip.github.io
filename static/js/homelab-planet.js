// Homelab hero: pixelated planet horizon with light crosses, drawn on a canvas.
// Technique borrowed from omp.sh: a large arc, grain, and dots, rendered at low resolution
// and shown with `image-rendering: pixelated`.
//
// Static layer (drawn once): planet, cross bodies, gray background dots, grain.
// Moving layer (every frame): pink dots flowing out of the crosses, and warm dots rising
// from the planet and fading into space.
(function () {
  'use strict';

  var canvas = document.querySelector('.homelab .hl-planet');
  if (!canvas || !canvas.getContext) return;

  var PIXEL = 1;         // CSS px per canvas pixel. 1 = finest dots, 2 = chunkier.
  var SPEED = 0.25;      // Flow speed multiplier. Lower = slower.
  var FPS = 30;
  var COLOR_FADE = 0.12; // The color is gone this fraction of H above the text row; full below it.
  var HALO_GAIN = 0.55;  // Peak intensity of the cross halo dots (1 = full pink). Lower = softer.

  var BG = [10, 10, 10];
  var BODY = [40, 21, 38];
  var PINK = [222, 115, 190];
  var ORANGE = [242, 166, 90];
  var PLUM = [138, 74, 134];
  var GRAY = [140, 140, 146];
  var CORE = [255, 230, 246];
  var PALETTE = [PINK, CORE, ORANGE, PLUM];   // indices used by particles

  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var W, H, img, base, planetMask, crossMask, rafId = 0, lastFrame = 0, t0 = 0;
  var crosses, coreFlag, sdB, sdA, lastSd;
  var colorNone, colorFull, textRight;
  var N, pX, pY, pDX, pDY, pTravel, pLife, pPhase, pBright, pCol, pKind, pJit;

  function hash(n) {
    n >>>= 0;
    n = Math.imul(n ^ (n >>> 16), 2146121005);
    n = Math.imul(n ^ (n >>> 15), 2221713035);
    return (n ^ (n >>> 16)) >>> 0;
  }
  function rnd(n) { return hash(n) / 4294967296; }
  function smooth(a, b, v) {
    var t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // Smooth 2D value noise in [0, 1].
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var h = function (a, b) { return rnd(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ 0x2545f491); };
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  }

  function setPx(data, o, c, k) {
    data[o] = c[0] * k; data[o + 1] = c[1] * k; data[o + 2] = c[2] * k; data[o + 3] = 255;
  }

  // One light pillar, as in the Evangelion reference: a long slender shaft that is a little wider
  // at the foot, a thin pointed arm near the top, a sharp tip above it and and a small flare where it meets the planet.
  function makeCross(x, baseY, h, seed, s) {
    var c = {
      x: x, base: baseY, top: baseY - h, h: h, sc: h / (0.72 * H), s: s,
      armY: baseY - h + 0.17 * h,
      half: 0.26 * h,
      wBase: Math.max(5 * s, 0.032 * h),
      wTop: Math.max(3 * s, 0.016 * h),
      wArm: Math.max(2.5 * s, 0.012 * h)
    };
    c.reach = c.half + 200 * s;
    return c;
  }

  // Signed distances (negative inside) to the shaft and to the arm.
  // Results go to sdB / sdA, and coreFlag marks the white interior.
  function shape(c, x, y) {
    var s = c.s;
    var yc = Math.max(c.top, Math.min(c.base, y));
    var tb = (yc - c.top) / (c.base - c.top);
    var hw = c.wTop + (c.wBase - c.wTop) * Math.pow(tb, 1.2);
    hw += 0.6 * c.wBase * Math.exp(-(c.base - yc) / (0.05 * c.h));     // small flare at the foot
    if (yc < c.armY) hw *= Math.pow((yc - c.top) / (c.armY - c.top), 0.8);   // sharp tip above the arm
    var sdx = Math.abs(x - c.x) - hw;
    var sdBeam = Math.hypot(Math.max(sdx, 0), Math.max(c.top - y, 0)) + Math.min(sdx, 0);

    var xc = Math.max(c.x - c.half, Math.min(c.x + c.half, x));
    var ta = Math.abs(xc - c.x) / c.half;
    var hwA = c.wArm * Math.pow(Math.max(0, 1 - ta), 1.3);
    var sdy = Math.abs(y - c.armY) - hwA;
    var sdArm = Math.hypot(Math.max(sdy, 0), Math.abs(x - xc)) + Math.min(sdy, 0);

    var wob = (vnoise(x / (40 * s), y / (40 * s)) - 0.5) * 2 * s;
    sdB = sdBeam + wob;
    sdA = sdArm + wob;
    // Thin pink line along the outside (a third of the local half-width, at least a few px); white inside.
    var halfW = sdB <= sdA ? hw : hwA;
    coreFlag = -Math.min(sdB, sdA) > Math.max(0.3 * halfW, 2.6 * s);
  }

  // Static probability of a cross pixel: the body only (the halo is moving particles).
  function crossBody(c, x, y) {
    lastSd = Infinity;
    if (Math.abs(x - c.x) > c.reach || y < c.top - 200 * c.s) return 0;
    shape(c, x, y);
    lastSd = Math.min(sdB, sdA);
    var p = Math.min(sdB, sdA) < 0 ? 1 : 0;

    return p;
  }

  // Color intensity of the planet halo: full below the text, fading gradually going up,
  // and sooner on the left where the text sits.
  function colorFactor(x, y) {
    var left = 1 - smooth(0.4 * textRight, textRight + 0.25 * W, x);
    return smooth(colorNone, colorFull, y - left * 0.2 * H);
  }

  var list;
  function addParticle(kind, x, y, dx, dy, travel, life, bright, col, jit) {
    list.push([kind, x, y, dx, dy, travel, life, bright, col, jit]);
  }

  function build() {
    var rect = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width / PIXEL));
    H = Math.max(1, Math.round(rect.height / PIXEL));
    canvas.width = W;
    canvas.height = H;

    var s = Math.max(0.5, Math.min(2, H / 780));   // feature scale in canvas px

    // Measure the hero text so the gradient lines up with it: full color below the text,
    // fading out gradually going up until nothing colored is left behind the text.
    var copyEl = canvas.parentNode.querySelector('.hl-hero-copy');
    var runsEl = canvas.parentNode.querySelector('.hl-runs');
    var copyBox = copyEl ? copyEl.getBoundingClientRect() : null;
    var runsBox = runsEl ? runsEl.getBoundingClientRect() : null;
    var textBottom = copyBox ? (copyBox.bottom - rect.top) / PIXEL : 0.76 * H;
    var colorTop = runsBox ? (runsBox.top - rect.top) / PIXEL : 0.7 * H;
    colorNone = colorTop - COLOR_FADE * H;
    colorFull = textBottom + 0.04 * H;
    textRight = copyBox ? (copyBox.right - rect.left) / PIXEL : 0.48 * W;

    var R = 1.5 * W;                               // planet radius: wide, gentle arc
    var hc = 0.24 * H;                             // crest height above the bottom edge
    var cx = 0.64 * W;
    var cy = H - hc + R;
    var surface = function (x) { return cy - Math.sqrt(Math.max(0, R * R - (x - cx) * (x - cx))); };

    var mainH = Math.min(0.72 * H, 0.9 * W);
    var px0 = 0.68 * W, px1 = 0.555 * W, px2 = 0.83 * W;
    crosses = [
      makeCross(px0, surface(px0), mainH, 13, s),
      makeCross(px1, surface(px1), mainH * 0.62, 101, s),
      makeCross(px2, surface(px2), mainH * 0.7, 211, s)
    ];

    // ---- Static layer ----
    var n = W * H;
    img = ctx.createImageData(W, H);
    base = new Uint8ClampedArray(n * 4);
    planetMask = new Uint8Array(n);
    crossMask = new Uint8Array(n);   // 1 inside a cross: nothing else is drawn there

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x, o = i * 4;
        var d = Math.hypot(x - cx, y - cy) - R;       // < 0 inside the planet

        if (d < 0) {
          planetMask[i] = 1;
          var depth = -d;
          var shade = 0.3 + 0.7 * Math.exp(-depth / (0.14 * H));
          var r = BG[0] + (BODY[0] - BG[0]) * shade;
          var g = BG[1] + (BODY[1] - BG[1]) * shade;
          var b = BG[2] + (BODY[2] - BG[2]) * shade;
          var glow = Math.exp(-depth / (7 * s)) * 0.3;     // soft rim light
          var rim = Math.exp(-depth / (1.1 * s));          // thin bright edge
          r += (PINK[0] - r) * glow + (ORANGE[0] - r) * rim * 0.9;
          g += (PINK[1] - g) * glow + (ORANGE[1] - g) * rim * 0.9;
          b += (PINK[2] - b) * glow + (ORANGE[2] - b) * rim * 0.9;
          // Surface texture: sparse plum speckles that fade with depth.
          if (rnd(i ^ 0x5bd1e995) < 0.05 * Math.exp(-depth / (70 * s))) {
            r += (PLUM[0] - r) * 0.55; g += (PLUM[1] - g) * 0.55; b += (PLUM[2] - b) * 0.55;
          }
          base[o] = r; base[o + 1] = g; base[o + 2] = b; base[o + 3] = 255;
        } else {
          base[o] = BG[0]; base[o + 1] = BG[1]; base[o + 2] = BG[2]; base[o + 3] = 255;

          // Gray dots in the background: static, subtle.
          var ga = 0.012 + 0.03 * Math.exp(-d / (350 * s));
          if (rnd(i ^ 0x1234567) < ga) setPx(base, o, GRAY, 0.25 + 0.35 * rnd(i ^ 0x7f4a7c15));

          // Cross bodies.
          var cp = 0, core = false, near = Infinity, nearScale = 1;
          for (var q = 0; q < crosses.length; q++) {
            coreFlag = false;
            var f = crossBody(crosses[q], x, y);
            if (f > cp) { cp = f; core = coreFlag; }
            if (lastSd < near) { near = lastSd; nearScale = Math.max(crosses[q].sc, 0.35); }
          }
          if (cp > 0) { setPx(base, o, core ? CORE : PINK, 1); crossMask[i] = 1; }
          else if (near < 260 * s) {
            // Diffuse glow hugging the silhouette: strongest at the edge, pink fading to plum.
            var glowI = Math.min(0.62, 0.5 * Math.exp(-near / (12 * s * nearScale)) + 0.2 * Math.exp(-near / (55 * s * nearScale)));
            glowI *= Math.max(0, 1 - near / (260 * s));   // reaches exactly zero at the cutoff: no visible edge
            var mixK = Math.min(1, near / (90 * s * nearScale));
            var gr0 = PINK[0] + (PLUM[0] - PINK[0]) * mixK, gg0 = PINK[1] + (PLUM[1] - PINK[1]) * mixK, gb0 = PINK[2] + (PLUM[2] - PINK[2]) * mixK;
            base[o] += (gr0 - base[o]) * glowI;
            base[o + 1] += (gg0 - base[o + 1]) * glowI;
            base[o + 2] += (gb0 - base[o + 2]) * glowI;
          }
        }

        // Static grain over everything.
        var gr = rnd(i ^ 0x27d4eb2f);
        if (gr < 0.04 && !crossMask[i]) {
          var k = gr < 0.02 ? -8 : 8;
          base[o] += k; base[o + 1] += k; base[o + 2] += k;
        }
      }
    }

    // ---- Moving particles ----
    list = [];
    var seed = 1;

    // Pink dots flowing out of each cross: start on its ragged edge and drift away from it.
    crosses.forEach(function (c) {
      var perim = 2 * c.h + 4 * c.half;
      var count = Math.round(perim * 14);
      var lam = s * Math.max(c.sc, 0.35);
      for (var j = 0; j < count; j++) {
        var useBeam = rnd(seed++) < (2 * c.h) / perim;
        var side = rnd(seed++) < 0.5 ? -1 : 1;
        var px, py, dx, dy, step = 0, lim = 400;
        if (useBeam) {
          py = c.top + (0.03 + 0.95 * rnd(seed++)) * (c.base - c.top);
          px = c.x;
          dx = side; dy = -0.18;
          while (step++ < lim) { shape(c, px, py); if (sdB >= 0) break; px += side; }
        } else {
          px = c.x + (rnd(seed++) * 2 - 1) * c.half * 0.97;
          py = c.armY;
          dx = side * 0.18 * (px < c.x ? -1 : 1); dy = side;
          while (step++ < lim) { shape(c, px, py); if (sdA >= 0) break; py += side; }
        }
        if (step >= lim) continue;
        var len = Math.hypot(dx, dy);
        var pr = rnd(seed++);
        // How far this dot travels: two exponential scales (tight glow + wide haze), so the
        // density falls off with distance from the cross like the old static halo did.
        var reach = Math.max(2 * s, -Math.log(1 - rnd(seed++) * 0.999) * (rnd(seed++) < 0.43 ? 10 : 36) * lam);
        addParticle(0, px, py, dx / len, dy / len, reach,
          3.5 + 3 * rnd(seed++), 0.8 + 0.2 * rnd(seed++), pr < 0.85 ? 0 : 1, 3 * s);
      }
    });

    // Warm dots rising from the planet surface and fading into space.
    var planetCount = Math.round(W * 64);
    for (var m = 0; m < planetCount; m++) {
      var wx = (rnd(seed++) * 1.4 - 0.2) * W;       // a bit beyond both edges so nothing is cut off
      var wy = surface(wx);
      if (wy > 1.3 * H || wy < 0) continue;
      var nx = (wx - cx) / R, ny = (wy - cy) / R;
      var cr = rnd(seed++);
      addParticle(1, wx, wy, nx, ny, (180 + 420 * rnd(seed++)) * s, 6 + 5 * rnd(seed++),
        0.45 + 0.55 * rnd(seed++), cr < 0.4 ? 2 : (cr < 0.75 ? 0 : 3), 16 * s);
    }

    N = list.length;
    pKind = new Uint8Array(N); pCol = new Uint8Array(N);
    pX = new Float32Array(N); pY = new Float32Array(N); pDX = new Float32Array(N); pDY = new Float32Array(N);
    pTravel = new Float32Array(N); pLife = new Float32Array(N); pPhase = new Float32Array(N);
    pBright = new Float32Array(N); pJit = new Float32Array(N);
    for (var p = 0; p < N; p++) {
      var e = list[p];
      pKind[p] = e[0]; pX[p] = e[1]; pY[p] = e[2]; pDX[p] = e[3]; pDY[p] = e[4];
      pTravel[p] = e[5]; pLife[p] = e[6]; pBright[p] = e[7]; pCol[p] = e[8]; pJit[p] = e[9];
      pPhase[p] = rnd(p * 2654435761 + 17) * e[6];
    }
    list = null;
  }

  function render(T) {
    var data = img.data;
    data.set(base);
    for (var p = 0; p < N; p++) {
      var life = pLife[p];
      var tt = T + pPhase[p];
      var cyc = Math.floor(tt / life);
      var u = (tt - cyc * life) / life;
      // Planet dots start slow and then drift away; cross dots move steadily along their path.
      var dist = pTravel[p] * (pKind[p] ? u * Math.sqrt(u) : u);
      var dx = pDX[p], dy = pDY[p];
      var lat = (((Math.imul(cyc + 1, 2654435761) ^ Math.imul(p + 1, 40503)) >>> 8) / 16777216 - 0.5) * pJit[p];
      var x = pX[p] + dx * dist - dy * lat;
      var y = pY[p] + dy * dist + dx * lat;
      var ix = Math.round(x), iy = Math.round(y);
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      var idx = iy * W + ix;
      if (planetMask[idx] || crossMask[idx]) continue;

      // Cross dots hold full brightness along their path and fade at the end; planet dots fade out gradually.
      var a = pKind[p]
        ? (1 - u) * Math.sqrt(1 - u) * pBright[p] * (u < 0.05 ? u / 0.05 : 1)
        : HALO_GAIN * pBright[p] * Math.pow(1 - u, 1.8) * (u < 0.2 ? u / 0.2 : 1);
      if (pKind[p] === 1) a *= colorFactor(ix, iy);
      if (a < 0.02) continue;

      var c = PALETTE[pCol[p]], o = idx * 4;
      var r = c[0], g = c[1], b = c[2];
      if (!pKind[p]) {
        // Cross dots also cool from pink toward plum as they drift away.
        var k = Math.min(1, u * 1.4);
        r += (PLUM[0] - r) * k; g += (PLUM[1] - g) * k; b += (PLUM[2] - b) * k;
      }
      data[o] += (r - data[o]) * a;
      data[o + 1] += (g - data[o + 1]) * a;
      data[o + 2] += (b - data[o + 2]) * a;
      if (!pKind[p]) {
        // Soft splat: a faint copy on the four neighbours so the dot has no hard edge.
        var a2 = a * 0.3;
        for (var nb = 0; nb < 4; nb++) {
          var nx = ix + (nb === 0 ? -1 : nb === 1 ? 1 : 0), ny = iy + (nb === 2 ? -1 : nb === 3 ? 1 : 0);
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var ni = ny * W + nx;
          if (planetMask[ni] || crossMask[ni]) continue;
          var no = ni * 4;
          data[no] += (r - data[no]) * a2;
          data[no + 1] += (g - data[no + 1]) * a2;
          data[no + 2] += (b - data[no + 2]) * a2;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < 1000 / FPS) return;
    lastFrame = now;
    render(((now - t0) / 1000) * SPEED);
  }
  function stop() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }
  function start() {
    stop();
    if (reduce.matches || document.hidden) { render(4); return; }
    t0 = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { build(); start(); }, 150);
  }, { passive: true });
  document.addEventListener('visibilitychange', start);
  if (reduce.addEventListener) reduce.addEventListener('change', start);

  build();
  start();
})();

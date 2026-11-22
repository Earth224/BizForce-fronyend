/* ══════════════════════════════════════════════════════════════════════════
   bf-abyss.js — THE ABYSS: the Termaximus chat box's deep-space starfield, in
   ONE place (FX3, Nov 22 2026).

   Moved here, unchanged, from scripts/termaximus-presence.js (createTmxStarfield,
   its lines 893-1144 at frontend e3e8ce0). Two pages of the app draw it:
     - the chat box (#tmx-chat-canvas, termaximus-presence.js), as before:
       three layers of 70, 35 and 16 stars over the box;
     - the HQ orbit's centre while ORACLE is open on a phone (scripts/bf-hq-views.js):
       the same engine over the centre's disc, at the SAME number of stars per
       area as the chat box's 288 x 340 (the owner's decision: the exact density,
       never more), so each layer holds round(count x area / (288 x 340)).
   Backend scripts/checkTermaximusPhone.js holds every number here equal to the
   chat's numbers at e3e8ce0.

   USE
     var abyss = window.BFAbyss.create(canvas);                     // the chat's counts
     var abyss = window.BFAbyss.create(canvas, { perArea: true });  // the chat's density
     abyss.start(); abyss.stop(); abyss.resize();
   start() runs it while the page is visible (it pauses on document.hidden and
   resumes); stop() ends it. Under prefers-reduced-motion it draws still: no drift,
   no twinkle.

   The engine mirrors oracle.html's #starCanvas engine (same makeStar/drawStarAt/
   drawStarWrapped, nebula, twinkle, and drift), adapted to a small box: sized to
   the canvas element's own box instead of the viewport, and all pointer/tilt
   parallax removed (stars still self-drift and twinkle, they just don't track
   input).
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFAbyss) return;

  /* The chat box the counts were made for, and its three layers' counts. */
  var BASE_W = 288, BASE_H = 340;
  var BASE_COUNTS = [70, 35, 16];

  /* A layer's count at the chat's density, for a box of w x h. */
  function countsFor(w, h) {
    var ratio = (w * h) / (BASE_W * BASE_H);
    return BASE_COUNTS.map(function (c) { return Math.round(c * ratio); });
  }

  function createAbyss(canvas, opts) {
    opts = opts || {};
    var perArea = opts.perArea === true;
    if (!canvas) return { start: function () {}, stop: function () {}, resize: function () {} };
    var ctx = canvas.getContext("2d");
    if (!ctx) return { start: function () {}, stop: function () {}, resize: function () {} };

    var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var DPR_CAP = 2;
    var cssWidth  = canvas.clientWidth  || 288;
    var cssHeight = canvas.clientHeight || 340;

    var nebulaCanvas = document.createElement("canvas");
    var nebulaCtx     = null;

    function renderNebula() {
      nebulaCanvas.width  = canvas.width;
      nebulaCanvas.height = canvas.height;
      nebulaCtx = nebulaCanvas.getContext("2d");
      var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      nebulaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var span = Math.max(cssWidth, cssHeight);
      var clouds = [
        { x: cssWidth * 0.18, y: cssHeight * 0.22, r: span * 0.55, color: "168,85,247",  alpha: 0.06 }, /* violet */
        { x: cssWidth * 0.82, y: cssHeight * 0.68, r: span * 0.5,  color: "34,211,238",  alpha: 0.05 }, /* cyan */
        { x: cssWidth * 0.52, y: cssHeight * 0.85, r: span * 0.4,  color: "52,211,153",  alpha: 0.035 } /* emerald whisper */
      ];

      clouds.forEach(function (c) {
        var g = nebulaCtx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, "rgba(" + c.color + "," + c.alpha + ")");
        g.addColorStop(1, "rgba(" + c.color + ",0)");
        nebulaCtx.fillStyle = g;
        nebulaCtx.fillRect(0, 0, cssWidth, cssHeight);
      });
    }

    function resize() {
      cssWidth  = canvas.clientWidth  || cssWidth;
      cssHeight = canvas.clientHeight || cssHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width  = Math.round(cssWidth  * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderNebula();
      if (perArea && LAYERS) populate();
    }
    resize();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    // ── Star generation ──────────────────────────────────────────────────
    var TINTS = [
      { r: 34,  g: 211, b: 238 }, /* cyan */
      { r: 139, g: 92,  b: 246 }, /* violet-blue */
      { r: 251, g: 191, b: 36  }  /* warm gold */
    ];

    function pickTint() {
      if (Math.random() < 1 / 6) {
        return TINTS[Math.floor(Math.random() * TINTS.length)];
      }
      return { r: 255, g: 255, b: 255 };
    }

    function makeStar(minR, maxR) {
      var r = minR + Math.random() * (maxR - minR);
      var baseAlpha = 0.12 + Math.pow(Math.random(), 2) * 0.8;
      var scintillates = Math.random() < 0.25;
      return {
        x: Math.random() * cssWidth,
        y: Math.random() * cssHeight,
        r: r,
        baseAlpha: baseAlpha,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        tint: pickTint(),
        spiked: (r > (minR + (maxR - minR) * 0.6)) && (baseAlpha > 0.6),
        scintillates: scintillates,
        twinkleDepth: scintillates ? 0.6 : 0.12
      };
    }

    var LAYERS = [
      { count: BASE_COUNTS[0], minR: 0.4, maxR: 0.9, parallax: 0.15, offsetX: 0, offsetY: 0, stars: [] }, /* far */
      { count: BASE_COUNTS[1], minR: 0.8, maxR: 1.6, parallax: 0.4,  offsetX: 0, offsetY: 0, stars: [] }, /* mid */
      { count: BASE_COUNTS[2], minR: 1.4, maxR: 2.6, parallax: 1.0,  offsetX: 0, offsetY: 0, stars: [] }  /* near */
    ];

    /* The chat's density over this box: each layer's count from its area, the
       stars placed again only when the area changes (a box first measured, or resized). */
    var populatedFor = "";
    function populate() {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      var key = cssWidth + "x" + cssHeight;
      if (key === populatedFor) return;
      populatedFor = key;
      var counts = countsFor(cssWidth, cssHeight);
      LAYERS.forEach(function (layer, i) {
        layer.count = counts[i];
        layer.stars = [];
        for (var j = 0; j < layer.count; j++) layer.stars.push(makeStar(layer.minR, layer.maxR));
      });
    }

    if (perArea) {
      populate();
    } else {
      LAYERS.forEach(function (layer) {
        for (var i = 0; i < layer.count; i++) {
          layer.stars.push(makeStar(layer.minR, layer.maxR));
        }
      });
    }

    var BASE_DRIFT_X = 8;    /* px/sec at parallax factor 1 */
    var BASE_DRIFT_Y = -4.5; /* px/sec at parallax factor 1 */

    // ── Rendering — identical to the Oracle engine (no parallax input) ────
    function drawStarAt(px, py, star, alpha) {
      var tint = star.tint;

      // (a) soft outer halo — the subtle bloom
      var haloR = star.r * 2.2;
      var halo = ctx.createRadialGradient(px, py, 0, px, py, haloR);
      halo.addColorStop(0, "rgba(" + tint.r + "," + tint.g + "," + tint.b + "," + (alpha * 0.5) + ")");
      halo.addColorStop(1, "rgba(" + tint.r + "," + tint.g + "," + tint.b + ",0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, haloR, 0, Math.PI * 2);
      ctx.fill();

      // diffraction spikes — bright stars only, drawn under the core
      if (star.spiked && alpha > 0.35) {
        var spikeLen   = star.r * 6;
        var spikeAlpha = alpha * 0.5;
        var spikeRgb   = tint.r + "," + tint.g + "," + tint.b;

        ctx.lineWidth = 0.8;

        var vSpike = ctx.createLinearGradient(px, py - spikeLen, px, py + spikeLen);
        vSpike.addColorStop(0,   "rgba(" + spikeRgb + ",0)");
        vSpike.addColorStop(0.5, "rgba(" + spikeRgb + "," + spikeAlpha + ")");
        vSpike.addColorStop(1,   "rgba(" + spikeRgb + ",0)");
        ctx.strokeStyle = vSpike;
        ctx.beginPath();
        ctx.moveTo(px, py - spikeLen);
        ctx.lineTo(px, py + spikeLen);
        ctx.stroke();

        var hSpike = ctx.createLinearGradient(px - spikeLen, py, px + spikeLen, py);
        hSpike.addColorStop(0,   "rgba(" + spikeRgb + ",0)");
        hSpike.addColorStop(0.5, "rgba(" + spikeRgb + "," + spikeAlpha + ")");
        hSpike.addColorStop(1,   "rgba(" + spikeRgb + ",0)");
        ctx.strokeStyle = hSpike;
        ctx.beginPath();
        ctx.moveTo(px - spikeLen, py);
        ctx.lineTo(px + spikeLen, py);
        ctx.stroke();
      }

      // (b) sharp core, on top — crisp bright point rather than a fuzzy ball
      var coreR = star.r * 0.7;
      var centerColor = tint;
      if (star.baseAlpha > 0.7) {
        centerColor = {
          r: Math.round(tint.r + (255 - tint.r) * 0.6),
          g: Math.round(tint.g + (255 - tint.g) * 0.6),
          b: Math.round(tint.b + (255 - tint.b) * 0.6)
        };
      }
      var core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
      core.addColorStop(0, "rgba(" + centerColor.r + "," + centerColor.g + "," + centerColor.b + "," + alpha + ")");
      core.addColorStop(1, "rgba(" + tint.r + "," + tint.g + "," + tint.b + "," + (alpha * 0.15) + ")");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawStarWrapped(star, px, py, alpha) {
      var glowR = star.r * 3.2;
      drawStarAt(px, py, star, alpha);
      if (px < glowR)                drawStarAt(px + cssWidth,  py, star, alpha);
      if (px > cssWidth - glowR)     drawStarAt(px - cssWidth,  py, star, alpha);
      if (py < glowR)                drawStarAt(px, py + cssHeight, star, alpha);
      if (py > cssHeight - glowR)    drawStarAt(px, py - cssHeight, star, alpha);
    }

    // ── Animation loop — no parallax; gated by start/stop (desired)
    // AND document.hidden ─────────────────────────────────────────────────
    var desired  = false;
    var running  = false;
    var rafId    = null;
    var lastTime = null;
    var elapsed  = 0;

    function frame(now) {
      if (!running) return;
      if (lastTime == null) lastTime = now;
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      if (!reducedMotion) elapsed += dt;

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      if (nebulaCtx) {
        ctx.drawImage(nebulaCanvas, 0, 0, canvas.width, canvas.height, 0, 0, cssWidth, cssHeight);
      }

      LAYERS.forEach(function (layer) {
        if (!reducedMotion) {
          layer.offsetX += BASE_DRIFT_X * layer.parallax * dt;
          layer.offsetY += BASE_DRIFT_Y * layer.parallax * dt;
        }

        layer.stars.forEach(function (star) {
          var px = ((star.x + layer.offsetX) % cssWidth  + cssWidth)  % cssWidth;
          var py = ((star.y + layer.offsetY) % cssHeight + cssHeight) % cssHeight;

          var alpha = star.baseAlpha;
          if (!reducedMotion) {
            var tw = Math.sin(elapsed * star.speed + star.phase);
            alpha = Math.max(0, Math.min(1, star.baseAlpha + tw * star.baseAlpha * star.twinkleDepth));
          }

          drawStarWrapped(star, px, py, alpha);
        });
      });

      rafId = requestAnimationFrame(frame);
    }

    function loopStart() {
      if (running) return;
      running = true;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    }

    function loopStop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { loopStop(); } else if (desired) { loopStart(); }
    });

    function start() {
      desired = true;
      if (!document.hidden) loopStart();
    }

    function stop() {
      desired = false;
      loopStop();
    }

    /* For the checks: what is drawn, read only. */
    function info() {
      return {
        running: running, desired: desired, width: cssWidth, height: cssHeight, reducedMotion: reducedMotion,
        counts: LAYERS.map(function (l) { return l.stars.length; })
      };
    }

    return { start: start, stop: stop, resize: resize, info: info };
  }

  window.BFAbyss = { create: createAbyss, countsFor: countsFor, BASE: { width: BASE_W, height: BASE_H, counts: BASE_COUNTS.slice() } };
}());

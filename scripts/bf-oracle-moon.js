/* ══════════════════════════════════════════════════════════════════════════
   bf-oracle-moon.js — the Oracle's moon on the dashboard (HQ1, Nov 19 2026).

   ONE MOON. The Oracle draws its moon inline in oracle.html (the moon block
   from "Moon phase (standard synodic-month calculation)": getMoonData, the
   live phase from GET /api/moon, the elliptical terminator, the small
   Celestial-panel moon and the realistic abyss moon, with MOON_IMG_URL). The
   Oracle pages are not to be edited, so this file holds an EXACT TEXT COPY of
   that block between the BEGIN COPY and END COPY lines below.
   scripts/checkHqViews.js fails if the copy and oracle.html's block ever differ
   by a single character.

   THE WRAPPER. The copy runs inside oracleMoonBlock(), which hands it its
   world: "now" (getActiveMoment, so the phase is today's at this minute), no
   chosen date (dateTimeInput null), the API base, and a document whose
   #abyssMoon is a staging box. renderAbyssMoon draws into the stage; paint()
   then copies that drawing into every target ([data-hq-moon]: the ORACLE
   orbit node and the ORACLE chip; NAMED, Nov 21 2026, FX2: the centre is the Sun now), each
   with its own SVG ids (a suffix per target), so no two masks share an id.

   THE PHASE is the Oracle's: GET /api/moon on start and every 30 minutes (as
   oracle.html asks it), the copy's synodic approximation until it answers
   or when it cannot.

   PHONE ONLY. Nothing runs above 760 px: no request, no drawing, no image.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var PHONE_QUERY = "(max-width: 760px)";
  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var REFRESH_MS = 30 * 60 * 1000;

  function oracleMoonBlock(document, getActiveMoment, dateTimeInput) {
    /* NAMED (Nov 20 2026, P2-2): BEFORE the base came in as a parameter, API_URL, which scripts/checkApiBase.js cannot
       see is the API's origin. AFTER the wrapper declares it here, outside the copy, in the form that check reads as the base;
       the value is the one the removed apiBase() gave. */
    var API_URL = (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK;
/* BEGIN COPY oracle.html MOON_IMG_URL (exact; scripts/checkHqViews.js holds it equal) */
    var MOON_IMG_URL = "https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg";
/* END COPY oracle.html MOON_IMG_URL */
/* BEGIN COPY oracle.html moon block (exact; scripts/checkHqViews.js holds it equal) */
    /* ── Moon phase (standard synodic-month calculation) ── */
    var SYNODIC_MONTH = 29.53058867;
    var KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);

    function getMoonData(date) {
      var daysSinceNew = (date.getTime() - KNOWN_NEW_MOON_UTC) / 86400000;
      var cycles = daysSinceNew / SYNODIC_MONTH;
      var phaseFraction = cycles - Math.floor(cycles);
      if (phaseFraction < 0) phaseFraction += 1;

      var illumPercent = Math.round((1 - Math.cos(phaseFraction * 2 * Math.PI)) / 2 * 100);

      var tol = 0.02;
      var phaseName;
      if (phaseFraction < tol || phaseFraction > 1 - tol) {
        phaseName = "New Moon";
      } else if (Math.abs(phaseFraction - 0.25) < tol) {
        phaseName = "First Quarter";
      } else if (Math.abs(phaseFraction - 0.5) < tol) {
        phaseName = "Full Moon";
      } else if (Math.abs(phaseFraction - 0.75) < tol) {
        phaseName = "Last Quarter";
      } else if (phaseFraction < 0.25) {
        phaseName = "Waxing Crescent";
      } else if (phaseFraction < 0.5) {
        phaseName = "Waxing Gibbous";
      } else if (phaseFraction < 0.75) {
        phaseName = "Waning Gibbous";
      } else {
        phaseName = "Waning Crescent";
      }

      return {
        phaseName: phaseName,
        illumPercent: illumPercent,
        phaseFraction: phaseFraction,
        waxing: phaseFraction < 0.5
      };
    }

    /* ── Real moon phase from the backend (GET /api/moon, astronomy-engine).
       Fetched once on load and every 30 minutes thereafter — the phase
       barely moves minute to minute, so there's no need to hit the API on
       every 1s renderClock tick. Falls back to null (and thus to the local
       synodic approximation above) on any network/response failure, and is
       only trusted for the CURRENT moment — if the user has picked a custom
       date/time via #celDateTime, getActiveMoment() is no longer "now", so
       real "right now" API data would misrepresent their chosen date. ── */
    var cachedRealMoonPhase = null;

    function fetchRealMoonPhase() {
      if (typeof API_URL === "undefined") return Promise.resolve(null);
      return fetch(API_URL + "/api/moon")
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data || data.error || data.illuminatedFraction == null) return null;
          return {
            illuminatedFraction: data.illuminatedFraction,
            waxing: !!data.waxing,
            phaseAngle: data.phaseAngle,
            phaseName: data.phaseName || null
          };
        })
        .catch(function () { return null; });
    }

    function refreshRealMoonPhase() {
      fetchRealMoonPhase().then(function (result) {
        if (result) {
          cachedRealMoonPhase = result;
          renderAbyssMoon(); /* repaint immediately once real data lands */
          renderMoon();      /* keep the small panel moon in lockstep */
        }
      });
    }

    /* ── Elliptical terminator path — replaces the old offset-circle shadow.
       The terminator (day/night boundary) projects onto the visible disc as
       a half-ellipse: semi-major axis = r (full vertical radius), semi-minor
       axis = r*|cos(phaseAngle)| (the horizontal bulge). Sign of cos(angle)
       flips which side the ellipse bulges toward:
         - crescent (0-90 / 270-360, cos > 0): illuminated < 50%, so the dark
           region is nearly the whole disc — the terminator bulges TOWARD
           the lit edge, leaving only a thin lit sliver.
         - gibbous (90-270, cos < 0): illuminated > 50%, so the dark region
           is a thin sliver — the terminator bulges TOWARD the dark edge.
         - quarter (angle ~90/270, cos ~0): rx ~0, terminator degenerates to
           a near-straight vertical line (SVG treats rx=0 as a straight line).
       The dark region is built as one closed path: a circular arc (radius r)
       for the true outer limb on the dark side, plus an elliptical arc
       (rx, r) for the terminator, filled black inside the mask. ── */
    function buildMoonTerminatorPath(cx, cy, r, phaseAngleDeg, waxing) {
      var theta = (phaseAngleDeg * Math.PI) / 180;
      var cosTheta = Math.cos(theta);
      var rx = Math.abs(r * cosTheta);
      var bulgeTowardLit = cosTheta > 0;

      var topX = cx, topY = cy - r;
      var bottomX = cx, bottomY = cy + r;

      // Outer limb (top -> bottom): waxing = dark on left (sweep 0),
      // waning = dark on right (sweep 1).
      var limbSweep = waxing ? 0 : 1;

      // Terminator (bottom -> top): bulge direction depends on which side
      // is lit AND whether this is a crescent or gibbous phase.
      var terminatorSweep = waxing
        ? (bulgeTowardLit ? 0 : 1)
        : (bulgeTowardLit ? 1 : 0);

      return "M " + topX + " " + topY + " " +
        "A " + r + " " + r + " 0 0 " + limbSweep + " " + bottomX + " " + bottomY + " " +
        "A " + rx + " " + r + " 0 0 " + terminatorSweep + " " + topX + " " + topY + " Z";
    }

    /* ── Small Celestial-panel moon — same elliptical-terminator geometry
       as the big ambient moon (buildMoonTerminatorPath), just lighter-
       weight: a flat stylized disc instead of the NASA photo, no glow
       halo. Takes its container directly rather than looking it up, so
       it stays reusable if the panel is ever redrawn from elsewhere. ── */
    function drawSmallMoonSVG(container, phaseAngleDeg, illuminatedFraction, waxing) {
      if (!container) return;

      var size = 100;
      var cx = 50, cy = 50, r = 38;
      var terminatorPath = buildMoonTerminatorPath(cx, cy, r, phaseAngleDeg, waxing);

      container.innerHTML =
        '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' +
          '<defs>' +
            '<filter id="smTerminatorBlur" x="-50%" y="-50%" width="200%" height="200%">' +
              '<feGaussianBlur stdDeviation="1.5"/>' +
            '</filter>' +
            '<mask id="smLitMask">' +
              '<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#000"/>' +
              '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.97) + '" fill="#fff"/>' +
              '<path d="' + terminatorPath + '" fill="#000" filter="url(#smTerminatorBlur)"/>' +
            '</mask>' +
            '<radialGradient id="smBackGlow" cx="50%" cy="50%" r="50%">' +
              '<stop offset="0%" stop-color="#cfe0ff" stop-opacity="0.5"/>' +
              '<stop offset="60%" stop-color="#cfe0ff" stop-opacity="0.18"/>' +
              '<stop offset="100%" stop-color="#cfe0ff" stop-opacity="0"/>' +
            '</radialGradient>' +
            '<radialGradient id="smBodyGlow" cx="42%" cy="40%" r="65%">' +
              '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>' +
              '<stop offset="70%" stop-color="#eef2ff" stop-opacity="0.1"/>' +
              '<stop offset="100%" stop-color="#eef2ff" stop-opacity="0"/>' +
            '</radialGradient>' +
          '</defs>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.1) + '" fill="url(#smBackGlow)" mask="url(#smLitMask)"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="rgba(10,14,26,0.9)"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.97) + '" fill="#f5f3e8" mask="url(#smLitMask)"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.97) + '" fill="url(#smBodyGlow)" mask="url(#smLitMask)" style="mix-blend-mode: screen;"/>' +
        '</svg>';
    }

    function renderMoon() {
      var moment = getActiveMoment();
      var moon = getMoonData(moment);
      var isNow = !(dateTimeInput && dateTimeInput.value);

      var waxing, phaseAngleDeg, illumPercent, phaseName;
      if (isNow && cachedRealMoonPhase) {
        waxing = cachedRealMoonPhase.waxing;
        phaseAngleDeg = cachedRealMoonPhase.phaseAngle;
        illumPercent = Math.round(cachedRealMoonPhase.illuminatedFraction * 100);
        phaseName = cachedRealMoonPhase.phaseName || moon.phaseName;
      } else {
        waxing = moon.waxing;
        phaseAngleDeg = moon.phaseFraction * 360;
        illumPercent = moon.illumPercent;
        phaseName = moon.phaseName;
      }

      var phaseEl = document.getElementById("celMoonPhase");
      var illumEl = document.getElementById("celMoonIllum");
      var stageEl = document.getElementById("celMoonStage");

      if (phaseEl) phaseEl.textContent = phaseName;
      if (illumEl) illumEl.textContent = illumPercent + "% illuminated";
      if (stageEl) {
        var descriptor = waxing ? "growing toward full" : "fading toward new";
        stageEl.textContent = (waxing ? "Waxing" : "Waning") + " · " + descriptor;
      }

      /* NAMED (Nov 26 2026, FX4A): BEFORE the small Celestial-panel moon was rebuilt on every call (once a second, open or
         not). AFTER it is drawn only while the panel is open, and again only when what it shows changes (the phase name,
         the rounded illumination, waxing or waning, or a new live phase angle). */
      var smallMoonEl = document.getElementById("celMoonSvg");
      var smallKey = (waxing ? "waxing" : "waning") + "|" + illumPercent + "|" + phaseName + "|" + (isNow && cachedRealMoonPhase ? "live " + phaseAngleDeg : "calc");
      if (smallMoonEl && smallMoonEl.closest && smallMoonEl.closest(".is-open") && smallKey !== smallMoonKey) {
        smallMoonKey = smallKey;
        drawSmallMoonSVG(smallMoonEl, phaseAngleDeg, illumPercent / 100, waxing);
      }
    }
    var smallMoonKey = null;
    var abyssMoonKey = null;

    /* ── Ambient realistic moon rendered into the abyss (.scene), behind
       all page content — reuses getMoonData/getActiveMoment, has its own
       element id so it never touches the panel's #celMoonSvg render. ── */
    function renderAbyssMoon() {
      var container = document.getElementById("abyssMoon");
      if (!container) return;

      var moment = getActiveMoment();
      var moon = getMoonData(moment);
      var isNow = !(dateTimeInput && dateTimeInput.value);

      var waxing, phaseAngleDeg;
      if (isNow && cachedRealMoonPhase) {
        waxing = cachedRealMoonPhase.waxing;
        phaseAngleDeg = cachedRealMoonPhase.phaseAngle;
      } else {
        waxing = moon.waxing;
        phaseAngleDeg = moon.phaseFraction * 360; /* same 0/90/180/270 convention as the real API */
      }

      /* NAMED (Nov 26 2026, FX4A): BEFORE every call (renderClock, once a second) rebuilt the whole SVG: its filters, its
         masks and a new <image> of the moon photo, which the browser decoded again each second (oracle.html's stutter).
         AFTER the moon is drawn once; a later call draws again only when what it shows changes (the phase name, the
         rounded illumination, waxing or waning, or a new live phase angle), and then moves the terminator in place, so
         the same <image> is kept and never decoded again. */
      var moonKey = (waxing ? "waxing" : "waning") + "|" + (isNow && cachedRealMoonPhase
        ? "live " + phaseAngleDeg + " " + Math.round(cachedRealMoonPhase.illuminatedFraction * 100) + " " + (cachedRealMoonPhase.phaseName || moon.phaseName)
        : "calc " + moon.illumPercent + " " + moon.phaseName);
      if (moonKey === abyssMoonKey && container.querySelector("svg")) return;
      abyssMoonKey = moonKey;

      var size = 200;
      var r = size / 2 - 10;
      var cx = size / 2;
      var cy = size / 2;
      var imgR = r * 1.18;
      var terminatorPath = buildMoonTerminatorPath(cx, cy, r, phaseAngleDeg, waxing);
      var drawnPaths = container.querySelectorAll("svg mask path");
      if (drawnPaths.length === 2 && container.querySelector("svg image")) {
        drawnPaths[0].setAttribute("d", terminatorPath);
        drawnPaths[1].setAttribute("d", terminatorPath);
        return;
      }

      container.innerHTML =
        '<svg viewBox="0 0 ' + size + ' ' + size + '" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">' +
          '<defs>' +
            '<filter id="moonTerminatorBlur" x="-50%" y="-50%" width="200%" height="200%">' +
              '<feGaussianBlur stdDeviation="4"/>' +
            '</filter>' +
            '<mask id="moonLitMask">' +
              '<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#000"/>' +
              '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.97) + '" fill="#fff"/>' +
              '<path d="' + terminatorPath + '" fill="#000" filter="url(#moonTerminatorBlur)"/>' +
            '</mask>' +
            '<filter id="glowMaskBlur" x="-50%" y="-50%" width="200%" height="200%">' +
              '<feGaussianBlur stdDeviation="8"/>' +
            '</filter>' +
            '<mask id="glowMask">' +
              '<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#000"/>' +
              '<g filter="url(#glowMaskBlur)">' +
                '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.05) + '" fill="#fff"/>' +
                '<path d="' + terminatorPath + '" fill="#000"/>' +
              '</g>' +
            '</mask>' +
            '<radialGradient id="moonGlowGrad" cx="50%" cy="50%" r="50%">' +
              '<stop offset="0%" stop-color="#bfe0ff" stop-opacity="0.75"/>' +
              '<stop offset="45%" stop-color="#9ec9ff" stop-opacity="0.55"/>' +
              '<stop offset="80%" stop-color="#9ec9ff" stop-opacity="0.12"/>' +
              '<stop offset="100%" stop-color="#9ec9ff" stop-opacity="0"/>' +
            '</radialGradient>' +
            '<filter id="moonGlowSoftBlur" x="-50%" y="-50%" width="200%" height="200%">' +
              '<feGaussianBlur stdDeviation="3"/>' +
            '</filter>' +
            '<radialGradient id="moonBodyGlow" cx="42%" cy="40%" r="65%">' +
              '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.35"/>' +
              '<stop offset="70%" stop-color="#eef2ff" stop-opacity="0.12"/>' +
              '<stop offset="100%" stop-color="#eef2ff" stop-opacity="0"/>' +
            '</radialGradient>' +
            '<filter id="moonEdgeGlow" x="-60%" y="-60%" width="220%" height="220%">' +
              '<feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#dfe8ff" flood-opacity="0.9"/>' +
            '</filter>' +
            '<radialGradient id="moonBackGlow" cx="50%" cy="50%" r="50%">' +
              '<stop offset="0%" stop-color="#cfe0ff" stop-opacity="0.55"/>' +
              '<stop offset="60%" stop-color="#cfe0ff" stop-opacity="0.2"/>' +
              '<stop offset="100%" stop-color="#cfe0ff" stop-opacity="0"/>' +
            '</radialGradient>' +
          '</defs>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.28) + '" fill="url(#moonGlowGrad)" mask="url(#glowMask)" filter="url(#moonGlowSoftBlur)" style="mix-blend-mode: screen;"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 1.15) + '" fill="url(#moonBackGlow)" mask="url(#moonLitMask)"/>' +
          '<image href="' + MOON_IMG_URL + '" x="' + (cx - imgR) + '" y="' + (cy - imgR) + '" width="' + (2 * imgR) + '" height="' + (2 * imgR) + '" preserveAspectRatio="xMidYMid slice" mask="url(#moonLitMask)" filter="url(#moonEdgeGlow)"/>' +
          '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.97) + '" fill="url(#moonBodyGlow)" mask="url(#moonLitMask)" style="mix-blend-mode: screen;"/>' +
        '</svg>';

      var imgEl = container.querySelector("image");
      if (imgEl) {
        imgEl.addEventListener("error", function () {
          container.style.display = "none";
        });
      }
    }
/* END COPY oracle.html moon block */
    return {
      getMoonData: getMoonData, fetchRealMoonPhase: fetchRealMoonPhase, refreshRealMoonPhase: refreshRealMoonPhase,
      buildMoonTerminatorPath: buildMoonTerminatorPath, drawSmallMoonSVG: drawSmallMoonSVG, renderMoon: renderMoon, renderAbyssMoon: renderAbyssMoon,
      MOON_IMG_URL: MOON_IMG_URL,
      setReal: function (r) { cachedRealMoonPhase = r; },
      real: function () { return cachedRealMoonPhase; }
    };
  }

  function phone() { try { return !!(window.matchMedia && window.matchMedia(PHONE_QUERY).matches); } catch (e) { return false; } }
  var stage = null, block = null, started = false, timer = null, serial = 0;
  function make() {
    if (block) return block;
    stage = { abyssMoon: window.document.createElement("div"), celMoonSvg: window.document.createElement("div") };
    var doc = { getElementById: function (id) { return Object.prototype.hasOwnProperty.call(stage, id) ? stage[id] : null; } };
    block = oracleMoonBlock(doc, function () { return new Date(); }, null);
    return block;
  }
  // Each target's own ids: id="x" becomes id="x-hqmN", and every url(#x) follows it.
  function uniquify(html, suffix) {
    return html.replace(/id="([^"]+)"/g, function (all, id) { return 'id="' + id + suffix + '"'; })
      .replace(/url\(#([^)]+)\)/g, function (all, id) { return "url(#" + id + suffix + ")"; });
  }
  function targets() { return Array.prototype.slice.call(window.document.querySelectorAll("[data-hq-moon]")); }
  /* FX3B (Nov 22 2026): NAMED BEFORE every paint showed the target again (el.hidden = false), so while the photo could not
     load each repaint (one per orbit draw) drew the whole moon, its masks and blurs, for a few frames until the error hid it
     once more: a flicker, and on a slow phone a stall (the first portal's settle jumped). AFTER a target whose photo has
     already failed stays hidden while it is drawn again, and a probe of the photo shows it once the photo loads. A target
     whose photo has not failed is painted exactly as before. */
  function paintOne(el, html) {
    if (!el.getAttribute("data-hq-moon-id")) el.setAttribute("data-hq-moon-id", "-hqm" + (++serial));
    var failed = el.getAttribute("data-hq-moon-failed") === "true", lost = false;
    el.innerHTML = uniquify(html, el.getAttribute("data-hq-moon-id"));
    el.hidden = failed;
    var img = el.querySelector("image");
    // As the Oracle does: if the photo cannot load, the moon is not shown (the target's own emblem stays).
    if (img) img.addEventListener("error", function () { lost = true; el.hidden = true; el.setAttribute("data-hq-moon-failed", "true"); });
    if (img && failed) {
      var probe = new window.Image();
      probe.onload = function () { if (!lost && img.parentNode && el.contains(img)) { el.hidden = false; el.removeAttribute("data-hq-moon-failed"); } };
      probe.src = img.getAttribute("href");
    }
  }
  function paint() {
    if (!phone()) return false;
    var b = make();
    b.renderAbyssMoon();
    var html = stage.abyssMoon.innerHTML;
    var r = b.real(), m = b.getMoonData(new Date());
    var phase = r ? { angle: r.phaseAngle, waxing: !!r.waxing, name: r.phaseName || m.phaseName, live: true } : { angle: m.phaseFraction * 360, waxing: m.waxing, name: m.phaseName, live: false };
    targets().forEach(function (el) {
      paintOne(el, html);
      el.setAttribute("data-moon-phase", phase.name);
      el.setAttribute("data-moon-angle", String(phase.angle));
      el.setAttribute("data-moon-live", phase.live ? "true" : "false");
      el.setAttribute("aria-hidden", "true");
    });
    return true;
  }
  function refresh() {
    var b = make();
    return b.fetchRealMoonPhase().then(function (result) {
      if (result) b.setReal(result);
      paint();
      return !!result;
    });
  }
  function start() {
    if (started || !phone()) return;
    started = true;
    paint();
    refresh();
    timer = setInterval(function () { if (phone()) refresh(); }, REFRESH_MS);
  }
  var mq = null;
  try { mq = window.matchMedia ? window.matchMedia(PHONE_QUERY) : null; } catch (e) { mq = null; }
  if (mq) { if (mq.addEventListener) mq.addEventListener("change", start); else if (mq.addListener) mq.addListener(start); }

  window.BFOracleMoon = {
    PHONE_QUERY: PHONE_QUERY, REFRESH_MS: REFRESH_MS, block: oracleMoonBlock, uniquify: uniquify,
    start: start, paint: paint, refresh: refresh, started: function () { return started; },
    phase: function () { var b = make(); var r = b.real(); var m = b.getMoonData(new Date()); return r ? { angle: r.phaseAngle, waxing: !!r.waxing, name: r.phaseName || m.phaseName, live: true } : { angle: m.phaseFraction * 360, waxing: m.waxing, name: m.phaseName, live: false }; }
  };
  start();
}());

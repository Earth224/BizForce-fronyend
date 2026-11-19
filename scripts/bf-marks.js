/* ══════════════════════════════════════════════════════════════════════════
   bf-marks.js — the BizForce brand marks, drawn from ONE place (LOGO1, Nov 18 2026)

   Three marks on a 120 x 120 viewBox, stroked with round joins and caps in
   the brand gradient (#22D3EE to #8B5CF6 on dark; #0891B2 to #6D28D9 on
   light), top-left to bottom-right:
     logo      Layered Stack: the company's mark (stroke 7; 10 at 64 px and under)
     approval  Force Hex: a hexagon and a bolt; "you approved it, it ran"
     agents    Agent Network: six agents around one centre; "the agents are working"

   Every inline mark on the site comes from here, so the copies cannot drift:
     BFMarks.svg(kind, { size, tone, tile, stroke, working, cls })  the SVG as a string
     <span data-bf-mark="approval" data-bf-mark-size="20"></span>     filled on load
   The icons/ PNGs, icons/icon.svg and brand/ are built from the same
   functions by the backend's scripts/buildBrandAssets.js.

   A mark is decoration beside words that already say the same thing, so
   every SVG is aria-hidden and never takes focus. "working" pulses the
   agents mark's centre dot; prefers-reduced-motion stops the pulse.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var TONES = { dark: ["#22D3EE", "#8B5CF6"], light: ["#0891B2", "#6D28D9"] };
  var TILE = "#070B18";
  var DOTS = { cyan: "#22D3EE", mid: "#5FA6F0", violet: "#8B5CF6" };
  var count = 0;

  function gradient(id, tone, units) {
    var t = Array.isArray(tone) ? tone : (TONES[tone] || TONES.dark);
    // The agents mark's spokes include level lines, whose bounding box has no
    // height; a gradient in bounding-box units would not paint them at all, so
    // they use the same diagonal across the whole viewBox in user space.
    var span = units === "user" ? ' gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="120" y2="120"' : ' x1="0" y1="0" x2="1" y2="1"';
    return '<linearGradient id="' + id + '"' + span + '><stop offset="0" stop-color="' + t[0] + '"/><stop offset="1" stop-color="' + t[1] + '"/></linearGradient>';
  }

  function logoBody(g, stroke) {
    return '<g fill="none" stroke="url(#' + g + ')" stroke-width="' + stroke + '" stroke-linejoin="round" stroke-linecap="round">' +
      '<polygon points="60,22 100,40 60,58 20,40"/>' +
      '<polyline points="20,58 60,76 100,58"/>' +
      '<polyline points="20,76 60,94 100,76"/>' +
      '</g>';
  }

  function approvalBody(g) {
    return '<polygon points="60,12 101,36 101,84 60,108 19,84 19,36" fill="none" stroke="url(#' + g + ')" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M67 28 L42 66 H59 L52 94 L80 52 H63 Z" fill="url(#' + g + ')" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  function agentsBody(g, gu, solid) {
    var D = solid ? { cyan: solid, mid: solid, violet: solid } : DOTS;
    var corners = [[98, 60, D.cyan], [79, 93, D.mid], [41, 93, D.violet], [22, 60, D.violet], [41, 27, D.mid], [79, 27, D.cyan]];
    return '<polygon points="98,60 79,93 41,93 22,60 41,27 79,27" fill="none" stroke="url(#' + gu + ')" stroke-width="3" stroke-opacity="0.55" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<g stroke="url(#' + gu + ')" stroke-width="3" stroke-linecap="round">' +
      corners.map(function (c) { return '<line x1="60" y1="60" x2="' + c[0] + '" y2="' + c[1] + '"/>'; }).join("") +
      '</g>' +
      corners.map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="8" fill="' + c[2] + '"/>'; }).join("") +
      '<circle class="bf-mark-core" cx="60" cy="60" r="13" fill="url(#' + g + ')"/>';
  }

  /* One mark as an SVG string.
     size     a number (px) or a CSS length ("1em"); omitted: no size (the container sizes it)
     tone     "dark" (default) or "light"
     tile     true: on the #070B18 tile, rounded; "square": the tile without rounding (apple-touch, maskable)
     scale    the glyph's scale about the centre (maskable icons keep it inside the safe circle)
     stroke   the Layered Stack's stroke width (default 7; 10 at 64 px and under)
     color    one solid colour instead of the gradient and the dots' colours: a mark ON the brand gradient (the
              gradient buttons, Approve and Launch) would vanish into it, so there it is drawn in white
     working  the agents mark only: its centre dot pulses
     ids      a prefix for the gradient ids (files); omitted: unique per page
     xmlns    true: a standalone file */
  function svg(kind, o) {
    o = o || {};
    var id = o.ids || ("bfm" + (++count));
    var g = id + "-g", gu = id + "-gu";
    var tone = o.color ? [o.color, o.color] : (o.tone === "light" ? "light" : "dark");
    var px = typeof o.size === "number" ? o.size : null;
    var body, defs;
    if (kind === "logo") {
      var stroke = o.stroke || (px !== null && px <= 64 ? 10 : 7);
      defs = gradient(g, tone);
      body = logoBody(g, stroke);
    } else if (kind === "approval") {
      defs = gradient(g, tone);
      body = approvalBody(g);
    } else if (kind === "agents") {
      defs = gradient(g, tone) + gradient(gu, tone, "user");
      body = agentsBody(g, gu, o.color);
    } else {
      return "";
    }
    if (o.scale && o.scale !== 1) {
      var t = 60 * (1 - o.scale);
      body = '<g transform="translate(' + t + ' ' + t + ') scale(' + o.scale + ')">' + body + '</g>';
    }
    var tile = o.tile ? '<rect width="120" height="120"' + (o.tile === "square" ? "" : ' rx="26" ry="26"') + ' fill="' + TILE + '"/>' : "";
    var size = o.size === undefined || o.size === null ? "" :
      (px !== null ? ' width="' + px + '" height="' + px + '"' : ' style="width:' + o.size + ';height:' + o.size + '"');
    var cls = "bf-mark bf-mark-" + kind + (o.working && kind === "agents" ? " bf-mark-working" : "") + (o.cls ? " " + o.cls : "");
    return '<svg' + (o.xmlns ? ' xmlns="http://www.w3.org/2000/svg"' : "") + ' viewBox="0 0 120 120"' + size +
      (o.xmlns ? "" : ' class="' + cls + '" aria-hidden="true" focusable="false"') + '>' +
      '<defs>' + defs + '</defs>' + tile + body + '</svg>';
  }

  var STYLE = ".bf-mark{display:inline-block;flex-shrink:0;vertical-align:-0.18em;overflow:visible}" +
    ".bf-mark-slot{display:inline-flex;align-items:center;vertical-align:middle;margin-right:.4em}" +
    ".bf-mark-slot>.bf-mark{vertical-align:0}" +
    ".bf-mark-inline{margin-right:.4em}" +
    ".bf-mark-host{display:inline-flex;align-items:center;justify-content:center}" +
    ".bf-mark-working .bf-mark-core{transform-box:fill-box;transform-origin:center;animation:bfMarkPulse 1.6s ease-in-out infinite}" +
    "@keyframes bfMarkPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.78)}}" +
    "@media (prefers-reduced-motion:reduce){.bf-mark-working .bf-mark-core{animation:none}}";

  /* Fills every empty [data-bf-mark] under node: data-bf-mark-size (px or a
     CSS length), data-bf-mark-working ("true"). */
  function fill(node) {
    var scope = node || (typeof document !== "undefined" ? document : null);
    if (!scope || !scope.querySelectorAll) return 0;
    var n = 0;
    Array.prototype.forEach.call(scope.querySelectorAll("[data-bf-mark]"), function (el) {
      if (el.getAttribute("data-bf-mark-done") === "true") return;
      var raw = el.getAttribute("data-bf-mark-size");
      var size = raw === null ? undefined : (/^\d+$/.test(raw) ? Number(raw) : raw);
      el.innerHTML = svg(el.getAttribute("data-bf-mark"), { size: size, working: el.getAttribute("data-bf-mark-working") === "true" });
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("data-bf-mark-done", "true");
      n++;
    });
    return n;
  }

  var api = { svg: svg, fill: fill, TONES: TONES, TILE: TILE, DOTS: DOTS, STYLE: STYLE };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.BFMarks = api;
    if (!document.getElementById("bf-marks-style")) {
      var st = document.createElement("style");
      st.id = "bf-marks-style";
      st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { fill(document); });
    else fill(document);
  }
})(this);

/* ══════════════════════════════════════════════════════════════════════════
   bf-marks.js — the BizForce logo, drawn from ONE place (LOGO1, Nov 18 2026)

   The Layered Stack on a 120 x 120 viewBox, stroked with round joins and
   caps in the brand gradient (#22D3EE to #8B5CF6 on dark; #0891B2 to
   #6D28D9 on light), top-left to bottom-right (stroke 7; 10 at 64 px and
   under).

   NAMED (Nov 19 2026, LOGO2): the owner took the Force Hex and Agent Network
   marks off the site (beside headings they threw off the centring). BEFORE
   this file drew all three marks for the pages. AFTER it draws only the
   Layered Stack, used on the site by the dashboard's top bar; the other two
   are drawn only for the brand/ files, by the backend's
   scripts/buildBrandAssets.js, which holds them.

     BFMarks.svg("logo", { size, tone, tile, scale, stroke, color, ids, xmlns, cls })  the SVG as a string
     <span data-bf-mark="logo" data-bf-mark-size="22"></span>                           filled on load
   The icons/ PNGs, icons/icon.svg and brand/ are built from the same
   function by the backend's scripts/buildBrandAssets.js.

   The mark is decoration beside words that already say the same thing, so
   every SVG is aria-hidden and never takes focus.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var TONES = { dark: ["#22D3EE", "#8B5CF6"], light: ["#0891B2", "#6D28D9"] };
  var TILE = "#070B18";
  var count = 0;

  function gradient(id, tone) {
    var t = Array.isArray(tone) ? tone : (TONES[tone] || TONES.dark);
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + t[0] + '"/><stop offset="1" stop-color="' + t[1] + '"/></linearGradient>';
  }

  function logoBody(g, stroke) {
    return '<g fill="none" stroke="url(#' + g + ')" stroke-width="' + stroke + '" stroke-linejoin="round" stroke-linecap="round">' +
      '<polygon points="60,22 100,40 60,58 20,40"/>' +
      '<polyline points="20,58 60,76 100,58"/>' +
      '<polyline points="20,76 60,94 100,76"/>' +
      '</g>';
  }

  /* The logo as an SVG string.
     size     a number (px) or a CSS length ("1em"); omitted: no size (the container sizes it)
     tone     "dark" (default) or "light"
     tile     true: on the #070B18 tile, rounded; "square": the tile without rounding (apple-touch, maskable)
     scale    the glyph's scale about the centre (maskable icons keep it inside the safe circle)
     stroke   the stroke width (default 7; 10 at 64 px and under)
     color    one solid colour instead of the gradient
     ids      a prefix for the gradient id (files); omitted: unique per page
     xmlns    true: a standalone file */
  function svg(kind, o) {
    if (kind !== "logo") return "";
    o = o || {};
    var g = (o.ids || ("bfm" + (++count))) + "-g";
    var tone = o.color ? [o.color, o.color] : (o.tone === "light" ? "light" : "dark");
    var px = typeof o.size === "number" ? o.size : null;
    var body = logoBody(g, o.stroke || (px !== null && px <= 64 ? 10 : 7));
    if (o.scale && o.scale !== 1) {
      var t = 60 * (1 - o.scale);
      body = '<g transform="translate(' + t + ' ' + t + ') scale(' + o.scale + ')">' + body + '</g>';
    }
    var tile = o.tile ? '<rect width="120" height="120"' + (o.tile === "square" ? "" : ' rx="26" ry="26"') + ' fill="' + TILE + '"/>' : "";
    var size = o.size === undefined || o.size === null ? "" :
      (px !== null ? ' width="' + px + '" height="' + px + '"' : ' style="width:' + o.size + ';height:' + o.size + '"');
    var cls = "bf-mark bf-mark-logo" + (o.cls ? " " + o.cls : "");
    return '<svg' + (o.xmlns ? ' xmlns="http://www.w3.org/2000/svg"' : "") + ' viewBox="0 0 120 120"' + size +
      (o.xmlns ? "" : ' class="' + cls + '" aria-hidden="true" focusable="false"') + '>' +
      '<defs>' + gradient(g, tone) + '</defs>' + tile + body + '</svg>';
  }

  var STYLE = ".bf-mark{display:inline-block;flex-shrink:0;vertical-align:-0.18em;overflow:visible}" +
    ".bf-mark-host{display:inline-flex;align-items:center;justify-content:center}";

  /* Fills every empty [data-bf-mark] under node: data-bf-mark-size (px or a CSS length). */
  function fill(node) {
    var scope = node || (typeof document !== "undefined" ? document : null);
    if (!scope || !scope.querySelectorAll) return 0;
    var n = 0;
    Array.prototype.forEach.call(scope.querySelectorAll("[data-bf-mark]"), function (el) {
      if (el.getAttribute("data-bf-mark-done") === "true") return;
      var raw = el.getAttribute("data-bf-mark-size");
      var size = raw === null ? undefined : (/^\d+$/.test(raw) ? Number(raw) : raw);
      el.innerHTML = svg(el.getAttribute("data-bf-mark"), { size: size });
      el.setAttribute("aria-hidden", "true");
      el.setAttribute("data-bf-mark-done", "true");
      n++;
    });
    return n;
  }

  var api = { svg: svg, fill: fill, TONES: TONES, TILE: TILE, STYLE: STYLE };

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

/* ══════════════════════════════════════════════════════════════════════════
   BF VERIFIED — the Verified badge (P3-2, Nov 21 2026).

   ONE MARK, DRAWN THE SAME EVERYWHERE: a 16 px circle with a tick, inline
   INSIDE the name element after its text (feed cards and the full-screen feed,
   Talk, suggestions, follow lists, the profile, the storefront, listings,
   card pages and the public post page /p/). The server writes the same markup
   for /p/ (backend lib/verified.js badgeHtml); the backend's
   checkVerifiedBadge holds the two equal, markup and rules.

   The API says which kind with a field named "verified": "member", "seller",
   "official" or null. Null draws nothing, so a page without a verified name
   is exactly as it was.

   A TAP shows a small sheet: "Verified: [kind]. This is not an endorsement."
   The mark is not focusable and not a link: its kind is its accessible name,
   read with the name. A tap on it never follows the link it sits in.

   USE
     window.bfVerified.html(reason)      the mark's markup, or "" for null
     window.bfVerified.sheetText(reason) the sheet's sentence
     window.bfVerified.open(reason)      opens the sheet
   Nothing is stored. Everything is written with textContent or from the
   fixed strings below.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.bfVerified) return;

  var REASONS = ["member", "seller", "official"];
  var LABELS = { member: "BizForce member", seller: "Verified seller", official: "Official BizForce account" };
  var NOT_ENDORSEMENT = "This is not an endorsement.";
  var SVG = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">' +
    '<circle cx="8" cy="8" r="8" fill="currentColor"></circle>' +
    '<path d="M4.6 8.3l2.2 2.2 4.6-4.7" fill="none" stroke="#070b18" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  /* The mark's rules: the same text as lib/verified.js CSS. */
  var CSS =
    ".bf-vb{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;width:16px;height:16px;margin:0 0 0 4px;padding:0;" +
    "border-radius:50%;color:var(--bf-accent-a, #22d3ee);line-height:0;vertical-align:-2px;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    ".bf-vb::after{content:\"\";position:absolute;left:50%;top:50%;width:44px;height:44px;transform:translate(-50%,-50%)}" +
    ".bf-vb svg{display:block;width:16px;height:16px}";
  /* The sheet's rules (this file only). */
  var SHEET_CSS =
    ".bf-vb-veil{position:fixed;inset:0;z-index:1100;background:rgba(3,5,12,.6);display:flex;align-items:flex-end;justify-content:center;padding:16px}" +
    ".bf-vb-sheet{width:100%;max-width:420px;box-sizing:border-box;padding:18px 18px 14px;border-radius:16px;background:var(--bf-bg,#070b18);" +
    "border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.35);color:var(--bf-text,#e8ecff);font:15px/1.5 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}" +
    ".bf-vb-sheet p{margin:0 0 12px}" +
    ".bf-vb-sheet button{min-height:44px;min-width:88px;padding:0 18px;border-radius:12px;border:1px solid var(--bf-accent-a, #22d3ee);background:transparent;" +
    "color:var(--bf-accent-a, #22d3ee);font:700 15px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}" +
    "@media (min-width: 761px){.bf-vb-veil{align-items:center}}";

  function isReason(r) { return REASONS.indexOf(r) !== -1; }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  /* The same markup as lib/verified.js badgeHtml. */
  function html(reason) {
    if (!isReason(reason)) return "";
    return '<span class="bf-vb" role="img" data-bf-verified="' + reason + '" aria-label="' + esc(LABELS[reason]) + '" title="' + esc(LABELS[reason]) + '">' + SVG + '</span>';
  }
  function sheetText(reason) { return isReason(reason) ? "Verified: " + LABELS[reason] + ". " + NOT_ENDORSEMENT : null; }

  function style() {
    if (document.getElementById("bf-verified-style")) return;
    var st = document.createElement("style");
    st.id = "bf-verified-style";
    st.textContent = CSS + SHEET_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var open_ = null;
  function close() {
    if (!open_) return;
    var o = open_;
    open_ = null;
    if (o.veil.parentNode) o.veil.parentNode.removeChild(o.veil);
    document.removeEventListener("keydown", o.onKey, true);
  }
  function open(reason) {
    var text = sheetText(reason);
    if (!text) return;
    close();
    style();
    var veil = document.createElement("div");
    veil.className = "bf-vb-veil";
    var sheet = document.createElement("div");
    sheet.className = "bf-vb-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "Verified");
    var p = document.createElement("p");
    p.setAttribute("data-bf-verified-text", "");
    p.textContent = text;
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = "Close";
    b.addEventListener("click", close);
    sheet.appendChild(p);
    sheet.appendChild(b);
    veil.appendChild(sheet);
    veil.addEventListener("click", function (e) { if (e.target === veil) close(); });
    var onKey = function (e) { if (e.key === "Escape") { e.preventDefault(); close(); } };
    document.addEventListener("keydown", onKey, true);
    open_ = { veil: veil, onKey: onKey };
    document.body.appendChild(veil);
    try { b.focus(); } catch (e) {}
  }

  /* A tap on a mark opens the sheet, and does not follow the link the mark sits in. */
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest(".bf-vb") : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    open(t.getAttribute("data-bf-verified"));
  }, true);

  style();
  window.bfVerified = { REASONS: REASONS.slice(), LABELS: LABELS, NOT_ENDORSEMENT: NOT_ENDORSEMENT, html: html, sheetText: sheetText, open: open, close: close };
})();

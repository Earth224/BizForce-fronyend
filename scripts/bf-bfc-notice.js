/* The one BizCash notice, for every page that shows a BFC balance or a BFC
   action (earn, send, buy, sell, donate, or a record of one).
   ─────────────────────────────────────────────────────────────────────────
   The sentence lives HERE and nowhere else in the frontend, so it cannot
   drift between pages. A page places an empty element where the notice
   belongs and loads this file right after it:

     <p class="bfc-notice" data-bfc-notice></p>
     <script src="/scripts/bf-bfc-notice.js"></script>

   The server sends the same sentence as bfcDisclaimer on GET /api/wallet and
   POST /api/wallet/transfer (BFC_NOTICE in server.js), and
   scripts/checkBfcNotice.js in the backend holds the two identical and fails
   when a page that shows BFC has no notice.

   Loaded as a classic script, so it runs in document order: every notice
   element above its tag is filled before the page goes on. */
(function (global) {
  "use strict";

  var BFC_NOTICE = "BizCash (BFC) is an in-app credit for use on BizForceAI only. It has no cash value, cannot be bought, sold, " +
    "exchanged or withdrawn for money, and its rules or availability may change.";

  /* A plain default look, written once; a page's own .bfc-notice rule wins. */
  function addStyle(doc) {
    if (doc.getElementById("bf-bfc-notice-style")) { return; }
    var style = doc.createElement("style");
    style.id = "bf-bfc-notice-style";
    style.textContent = ".bfc-notice{margin:12px 0 0;font-size:.8rem;line-height:1.55;color:#9aa6c8}";
    (doc.head || doc.documentElement).appendChild(style);
  }

  function fillBfcNotices(doc) {
    doc = doc || global.document;
    var els = doc.querySelectorAll("[data-bfc-notice]");
    if (els.length) { addStyle(doc); }
    for (var i = 0; i < els.length; i++) { els[i].textContent = BFC_NOTICE; }
    return els.length;
  }

  global.BF_BFC_NOTICE = BFC_NOTICE;
  global.bfFillBfcNotices = fillBfcNotices;
  fillBfcNotices(global.document);
})(window);

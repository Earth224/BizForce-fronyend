/* The one footer, on every page: Terms · Privacy · Refunds · Contact · Your data.
   ─────────────────────────────────────────────────────────────────────────
   A page places an empty element where the footer belongs and loads this file
   right after it:

     <footer class="bf-legal-footer" data-bf-legal-footer></footer>
     <script src="/scripts/bf-legal-footer.js"></script>

   The links live HERE and nowhere else in the frontend, so no page can drift.
   The four legal pages themselves are built by the backend
   (scripts/buildLegalPages.js from lib/legal.js), and the backend's
   scripts/checkLegalPages.js fails when a page has no footer.

   THE UPDATED-TERMS NOTICE. For a signed-in member, GET /api/me/terms says
   which version of the Terms is in force and which they accepted. When those
   differ, a small notice says "We've updated our Terms", links to them and
   offers Accept, which records the current version (POST
   /api/me/terms/accept). It never covers the page or blocks anything: the
   member can close it and go on using their data and Billing. Once accepted,
   the server stops asking. Signed out, or if the record cannot be read, no
   notice is shown. Nothing is stored on the device. */
(function (global) {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var LINKS = [
    ["Terms", "/terms"],
    ["Privacy", "/privacy"],
    ["Refunds", "/refund"],
    ["Contact", "/contact"],
    ["Your data", "/your-data.html"]
  ];

  function addStyle(doc) {
    if (doc.getElementById("bf-legal-footer-style")) { return; }
    var style = doc.createElement("style");
    style.id = "bf-legal-footer-style";
    style.textContent =
      ".bf-legal-footer{display:block;clear:both;max-width:860px;margin:32px auto 0;padding:18px 16px 28px;text-align:center;font:13px/1.6 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;color:#8e98c2}" +
      ".bf-legal-footer a{color:#8e98c2;text-decoration:none;margin:0 2px}" +
      ".bf-legal-footer a:hover{color:#22d3ee;text-decoration:underline}" +
      ".bf-legal-footer .sep{margin:0 6px;opacity:.6}" +
      ".bf-terms-notice{position:fixed;left:12px;right:12px;bottom:12px;z-index:9000;max-width:560px;margin:0 auto;padding:14px 44px 14px 16px;border-radius:14px;" +
      "background:#0d1328;border:1px solid rgba(34,211,238,.45);box-shadow:0 12px 32px rgba(0,0,0,.45);color:#e8e8ff;font:14px/1.5 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}" +
      ".bf-terms-notice a{color:#22d3ee}" +
      ".bf-terms-notice button{margin:10px 8px 0 0;padding:8px 14px;border:0;border-radius:9px;font-weight:700;cursor:pointer;background:#22d3ee;color:#04121a}" +
      ".bf-terms-notice .close{position:absolute;top:6px;right:8px;margin:0;padding:4px 8px;background:transparent;color:#8e98c2;font-size:18px}" +
      ".bf-terms-notice .err{color:#fca5a5;margin:8px 0 0}";
    (doc.head || doc.documentElement).appendChild(style);
  }

  function fillFooters(doc) {
    doc = doc || global.document;
    var els = doc.querySelectorAll("[data-bf-legal-footer]");
    if (els.length) { addStyle(doc); }
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      while (el.firstChild) { el.removeChild(el.firstChild); }
      var nav = doc.createElement("nav");
      nav.setAttribute("aria-label", "Legal");
      for (var j = 0; j < LINKS.length; j++) {
        if (j > 0) {
          var sep = doc.createElement("span");
          sep.className = "sep";
          sep.textContent = "·";
          nav.appendChild(sep);
        }
        var a = doc.createElement("a");
        a.href = LINKS[j][1];
        a.textContent = LINKS[j][0];
        nav.appendChild(a);
      }
      el.appendChild(nav);
    }
    return els.length;
  }

  function token() {
    try { return global.localStorage.getItem("bf_token") || ""; } catch (e) { return ""; }
  }

  function showTermsNotice(doc, terms) {
    if (doc.getElementById("bfTermsNotice")) { return; }
    addStyle(doc);
    var box = doc.createElement("div");
    box.id = "bfTermsNotice";
    box.className = "bf-terms-notice";
    box.setAttribute("role", "status");

    var text = doc.createElement("div");
    text.appendChild(doc.createTextNode("We've updated our Terms (" + (terms.updated || terms.current_version) + "). "));
    var read = doc.createElement("a");
    read.href = "/terms";
    read.textContent = "Read the Terms";
    text.appendChild(read);
    box.appendChild(text);

    var accept = doc.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept";
    box.appendChild(accept);

    var close = doc.createElement("button");
    close.type = "button";
    close.className = "close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", function () { box.parentNode && box.parentNode.removeChild(box); });
    box.appendChild(close);

    var err = doc.createElement("p");
    err.className = "err";
    err.hidden = true;
    box.appendChild(err);

    accept.addEventListener("click", function () {
      accept.disabled = true;
      err.hidden = true;
      global.fetch(API_URL + "/api/me/terms/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token() },
        body: JSON.stringify({ version: terms.current_version })
      }).then(function (r) {
        if (!r.ok) { throw new Error("not recorded"); }
        box.parentNode && box.parentNode.removeChild(box);
      }).catch(function () {
        accept.disabled = false;
        err.textContent = "Your acceptance could not be recorded just now. Try again in a moment.";
        err.hidden = false;
      });
    });

    (doc.body || doc.documentElement).appendChild(box);
  }

  function checkTerms(doc) {
    doc = doc || global.document;
    var t = token();
    if (!t || typeof global.fetch !== "function") { return null; }
    var p = global.fetch(API_URL + "/api/me/terms", { headers: { "Authorization": "Bearer " + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (terms) {
        if (terms && terms.needs_acceptance === true && terms.current_version) { showTermsNotice(doc, terms); }
        return terms;
      })
      .catch(function () { return null; });
    return p;
  }

  global.BFLegalFooter = { fillFooters: fillFooters, checkTerms: checkTerms, LINKS: LINKS };
  if (global.document) {
    fillFooters(global.document);
    checkTerms(global.document);
  }
})(typeof window !== "undefined" ? window : this);

/* ══════════════════════════════════════════════════════════════════════════
   BF PAYWALL NOTICE — saying what the paywall kept.

   Since backend 6f94afe, "Publishing needs a subscription; preparing does
   not", a route that puts something in front of strangers answers an account
   without a subscription with 402 and a body like

     { error: "Active subscription required", upgrade_required: true,
       message: "Your card is saved and you can keep editing it. …",
       billing_url: "/billing.html" }

   `message` says what was blocked AND WHAT WAS KEPT — the card is saved, the
   proposal is still pending, the listing is unchanged. Every page showed
   `error` instead, a bare "Active subscription required", in a toast that
   vanished, which reads as "something broke" to a person halfway through a
   task. This file is the one place that turns that answer into a notice.

   WHAT IT DOES AND DOES NOT DO
     - It shows `message`, falling back to `error`, and a link to Billing.
     - It never clears a form, closes a modal or reloads anything. The pages
       call it INSTEAD of their success path, and their success path is the
       only place their inputs are cleared, so a 402 leaves the work on
       screen, as the message says it is.
     - It builds DOM nodes with textContent. Nothing from the server is ever
       written as HTML.
     - billing_url is used only when it is a same-site path ("/…", not
       "//…"); anything else falls back to /billing.html, so a response can
       never point the link off-site.

   USE
     var notice = window.bfPaywall.from(res.status, body);  // null unless 402
     if (notice) { window.bfPaywall.show(anchorEl, notice); return; }
     window.bfPaywall.clear(anchorEl);                       // on a later success
     window.bfPaywall.render(el, notice);                    // into an existing element
   from() also accepts a 2xx certification answer carrying credit_withheld —
   the one partial refusal that is not a 402.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var DEFAULT_BILLING = "/billing.html";
  var FALLBACK_TEXT = "This needs an active subscription.";

  function safeBillingUrl(url) {
    return (typeof url === "string" && /^\/(?!\/)[A-Za-z0-9\/._?=&#-]*$/.test(url)) ? url : DEFAULT_BILLING;
  }

  /* The notice for a response, or null when it is not a paywall answer. */
  function from(status, body) {
    var b = (body && typeof body === "object") ? body : {};
    var isRefusal = status === 402;
    var isWithheld = status >= 200 && status < 300 && typeof b.credit_withheld === "string" && b.credit_withheld.length > 0;
    if (!isRefusal && !isWithheld) return null;
    var text = (typeof b.message === "string" && b.message.trim()) ? b.message.trim()
      : (typeof b.error === "string" && b.error.trim()) ? b.error.trim() + (isRefusal ? " Subscribe on Billing to continue." : "")
      : FALLBACK_TEXT;
    return { text: text, billingUrl: safeBillingUrl(b.billing_url), kind: isRefusal ? "refused" : "withheld" };
  }

  /* Fills `el` with the notice: its text, then an "Open Billing" link. */
  function render(el, notice) {
    if (!el || !notice) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(document.createTextNode(notice.text + " "));
    var a = document.createElement("a");
    a.setAttribute("href", notice.billingUrl);
    a.className = "bf-paywall-link";
    a.textContent = "Open Billing";
    el.appendChild(a);
  }

  var STYLE_ID = "bf-paywall-style";
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent =
      ".bf-paywall-notice{margin:12px 0 0;padding:10px 12px;border-radius:8px;font-size:.88rem;line-height:1.45;" +
      "background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.45);color:inherit}" +
      ".bf-paywall-notice .bf-paywall-link{font-weight:600;text-decoration:underline;color:inherit;white-space:nowrap}";
    (document.head || document.body).appendChild(s);
  }

  /* A notice placed right after `anchor` (a submit button, say), reused if one
     is already there, and left until the page clears it. */
  function show(anchor, notice) {
    if (!anchor || !notice || !anchor.parentNode) return null;
    ensureStyle();
    var next = anchor.nextSibling;
    var box = (next && next.className === "bf-paywall-notice") ? next : null;
    if (!box) {
      box = document.createElement("div");
      box.className = "bf-paywall-notice";
      box.setAttribute("role", "status");
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
    }
    render(box, notice);
    return box;
  }

  function clear(anchor) {
    if (!anchor) return;
    var next = anchor.nextSibling;
    if (next && next.className === "bf-paywall-notice" && next.parentNode) next.parentNode.removeChild(next);
  }

  window.bfPaywall = { from: from, render: render, show: show, clear: clear, safeBillingUrl: safeBillingUrl };
})();

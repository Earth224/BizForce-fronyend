/* The automatic-renewal box, beside the price, on every page that starts a
   subscription checkout (billing.html and app.html).
   ─────────────────────────────────────────────────────────────────────────
   A page places this directly beside the price, ahead of its Subscribe
   button, and loads this file after it:

     <label class="renew-consent" data-bf-renew-consent hidden><input type="checkbox" data-bf-renew-consent-box> <span data-bf-renew-consent-text></span></label>
     <script src="/scripts/bf-renew-consent.js"></script>

   The words are not written here or on the page. GET /api/billing/consent
   gives them, built by the server from PLAN_CONFIG ("I agree that All Access
   renews automatically every month at $199 until I cancel, and that I can
   cancel online at any time in Billing."), so they always state the price
   Stripe will charge. The box is never ticked for the member.

   BFRenewConsent.consent(document) is what the page's Subscribe button asks
   before it calls POST /api/stripe/checkout: { body } to add to the request
   when the box is ticked, or { error } to show instead of starting checkout.
   The server refuses a checkout without it all the same. The backend's
   scripts/checkAutoRenewConsent.js runs this file in jsdom. */
(function (global) {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var loaded = null;

  function load(doc) {
    var label = doc.querySelector("[data-bf-renew-consent]");
    if (!label || typeof global.fetch !== "function") { return Promise.resolve(null); }
    return global.fetch(API_URL + "/api/billing/consent?product=all_access")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        if (!c || typeof c.text !== "string" || !c.text || typeof c.version !== "string") { return null; }
        var text = label.querySelector("[data-bf-renew-consent-text]");
        var box = label.querySelector("[data-bf-renew-consent-box]");
        if (!text || !box) { return null; }
        text.textContent = c.text;
        box.checked = false;
        label.hidden = false;
        loaded = { text: c.text, version: c.version };
        return loaded;
      })
      .catch(function () { return null; });
  }

  function consent(doc) {
    doc = doc || global.document;
    if (!loaded) {
      return { error: "The automatic-renewal terms could not be loaded, so checkout cannot start yet. Reload the page and try again." };
    }
    var box = doc.querySelector("[data-bf-renew-consent-box]");
    if (!box || box.checked !== true) {
      return { error: "Tick the box beside the price to agree to automatic renewal before you subscribe." };
    }
    return { body: { auto_renew_consent: true, auto_renew_consent_text: loaded.text, auto_renew_consent_version: loaded.version } };
  }

  var ready = global.document ? load(global.document) : Promise.resolve(null);
  global.BFRenewConsent = { consent: consent, ready: ready };
})(window);

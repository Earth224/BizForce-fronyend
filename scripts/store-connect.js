/* ══════════════════════════════════════════════════════════════════════════
   Connect your store, on the Store agent's page (store-agent.html, #storeConnect).

   A member connects their OWN Shopify or WooCommerce store. BizForce reads
   products, stock and order summaries. It changes a price or stock level only
   when the member approves that change, and only on a store connected with
   "Let BizForce make changes I approve (prices and stock)" ticked (migrations
   175 and 176; scripts/store-changes.js). The server is the only source of
   truth: GET /api/store/connections (platform, store, status, permission,
   currency, location, since, last synced; never a key or a token).

   Shopify (migration 176): the shop's myshopify.com address and the box.
   "Connect Shopify" asks POST /api/store/shopify/start for Shopify's own
   authorization page and goes there. Shopify brings the member back here with
   ?code, ?state, ?shop, ?hmac and ?timestamp: the whole query is POSTed to
   /api/store/shopify/finish, the address bar is cleared with replaceState
   whatever the answer, then the answer is shown. When Shopify opens this page
   as the app's URL (?shop and ?hmac, no code), the shop is filled in and the
   member is asked to press Connect Shopify; nothing is sent.

   WooCommerce: the store's https address, and allow_changes from the box. The
   server answers the store's own authorization link (Read access, or
   Read/Write when the box is ticked), and the page goes there; the store
   comes back to ?store=woocommerce when the member has approved or declined.

   Etsy (Nov 8 2026, migration 181): the box only. "Connect Etsy" asks POST
   /api/store/etsy/start for Etsy's own authorization page, notes "etsy" in
   sessionStorage bf_store_return, and goes there. Etsy brings the member back
   with ?code and ?state only, so the marker says whose return it is: with it,
   code and state are POSTed to /api/store/etsy/finish; without it, nothing is
   sent and the member is asked to start again. A Shopify return is still
   known by its ?shop and ?hmac (Connect Shopify sets the marker to
   "shopify"). The address bar is cleared with replaceState on every return,
   and the marker is removed once read.

   Amazon (Nov 8 2026, migration 182): the marketplace (no default; the
   member must choose) and the box. "Connect Amazon" asks POST
   /api/store/amazon/start { marketplace_id, allow_changes } for Seller
   Central's own consent page, notes "amazon" in bf_store_return, and goes
   there. Amazon brings the member back with ?spapi_oauth_code, ?state and
   ?selling_partner_id: with the marker, all three are POSTed to
   /api/store/amazon/finish; without it, nothing is sent. While BizForce's
   Amazon app is a draft (amazon_draft), the page says only the account that
   registered BizForce can connect.

   Every server message is shown as the server wrote it, with textContent.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var LABEL = { shopify: "Shopify", woocommerce: "WooCommerce", etsy: "Etsy", amazon: "Amazon" };
  var PERMISSION_LABEL = { read: "Read only", read_write: "Changes allowed with your approval" };
  var SHOPIFY_UNSET = "Shopify connection isn't set up yet.";
  var ETSY_UNSET = "Etsy connection isn't set up yet.";
  var AMAZON_UNSET = "Amazon connection isn't set up yet.";
  var AMAZON_PICK = "Choose the Amazon marketplace you sell in.";
  var FINISH_HINT = "Press Connect Shopify to finish connecting.";
  var START_AGAIN = "Start the connection again.";
  // Which store's page the member left for: "etsy", "amazon" or "shopify" (sessionStorage, this tab only).
  var RETURN_KEY = "bf_store_return";

  function markReturn(p) {
    try { window.sessionStorage.setItem(RETURN_KEY, p); } catch (e) { /* the return then asks to start again */ }
  }
  /* The marker, read once and removed. No storage reads as no marker. */
  function takeReturn() {
    var v = null;
    try { v = window.sessionStorage.getItem(RETURN_KEY); } catch (e) { v = null; }
    try { window.sessionStorage.removeItem(RETURN_KEY); } catch (e) { /* nothing to remove */ }
    return v;
  }

  function tok() { return localStorage.getItem("bf_token") || ""; }

  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + tok() } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().then(
        function (d) { return { ok: r.ok, status: r.status, data: d }; },
        function () { return { ok: r.ok, status: r.status, data: {} }; }
      );
    });
  }
  function serverMessage(res) {
    return (res && res.data && typeof res.data.error === "string" && res.data.error) || ("HTTP " + (res && res.status));
  }
  function byId(id) { return document.getElementById(id); }
  function say(id, text, isError) {
    var el = byId(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "store-msg" + (isError ? " err" : "");
  }
  function dateText(iso) {
    if (!iso) return "an unknown date";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return String(iso); }
  }
  function timeText(iso) {
    if (!iso) return "not yet";
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var platform = "shopify";
  function choose(p) {
    platform = p;
    byId("storePickShopify").setAttribute("aria-pressed", p === "shopify" ? "true" : "false");
    byId("storePickWoo").setAttribute("aria-pressed", p === "woocommerce" ? "true" : "false");
    byId("storePickEtsy").setAttribute("aria-pressed", p === "etsy" ? "true" : "false");
    byId("storePickAmazon").setAttribute("aria-pressed", p === "amazon" ? "true" : "false");
    byId("storeShopifySection").hidden = p !== "shopify";
    byId("storeWooSteps").hidden = p !== "woocommerce";
    byId("storeWooSection").hidden = p !== "woocommerce";
    byId("storeEtsySection").hidden = p !== "etsy";
    byId("storeAmazonSection").hidden = p !== "amazon";
    if (p !== "woocommerce") byId("storeAllowChanges").checked = false;
    if (p !== "shopify") byId("storeShopifyAllow").checked = false;
    if (p !== "etsy") byId("storeEtsyAllow").checked = false;
    if (p !== "amazon") byId("storeAmazonAllow").checked = false;
    say("storeConnectMsg", "");
  }

  /* Shopify: where stock changes apply, or a picker to choose it. */
  function locationLine(c, msgId) {
    var wrap = el("div", "store-location");
    if (c.location_name) {
      wrap.appendChild(el("p", "store-quiet", "Stock changes apply at " + c.location_name + "."));
    } else {
      wrap.appendChild(el("p", "store-warn", "Choose a location for stock changes"));
    }
    if (c.status !== "connected") return wrap;
    var pick = el("button", "action-btn action-btn--ghost", c.location_name ? "Change location" : "Choose a location");
    pick.type = "button";
    pick.addEventListener("click", function () {
      pick.disabled = true;
      say(msgId, "Reading your locations...");
      api("GET", "/api/store/connections/" + encodeURIComponent(c.id) + "/locations").then(function (res) {
        pick.disabled = false;
        if (!res.ok) { say(msgId, serverMessage(res), true); return; }
        say(msgId, "");
        var list = Array.isArray(res.data.locations) ? res.data.locations : [];
        var select = el("select", "store-location-pick");
        list.forEach(function (l) {
          var opt = el("option", null, String(l.name || "Location"));
          opt.value = String(l.id);
          if (l.id === c.location_id) opt.selected = true;
          select.appendChild(opt);
        });
        var save = el("button", "action-btn", "Use this location");
        save.type = "button";
        save.addEventListener("click", function () {
          save.disabled = true;
          api("PUT", "/api/store/connections/" + encodeURIComponent(c.id) + "/location", { location_id: select.value }).then(function (r2) {
            save.disabled = false;
            if (!r2.ok) { say(msgId, serverMessage(r2), true); return; }
            say("storeConnectMsg", r2.data.note || "Saved.");
            load();
          }, function () { save.disabled = false; say(msgId, "The request failed. Nothing was changed.", true); });
        });
        pick.hidden = true;
        wrap.appendChild(select);
        wrap.appendChild(save);
      }, function () { pick.disabled = false; say(msgId, "The request failed. Nothing was changed.", true); });
    });
    wrap.appendChild(pick);
    return wrap;
  }

  function renderConnections(list) {
    var box = byId("storeConnections");
    box.textContent = "";
    if (!list.length) {
      box.appendChild(el("p", "store-quiet", "No store connected yet."));
      return;
    }
    list.forEach(function (c) {
      var row = el("div", "store-conn");
      var head = el("p");
      head.appendChild(el("span", "store-connected-as", "Connected to " + c.store));
      head.appendChild(document.createTextNode(" "));
      head.appendChild(el("span", "store-quiet", "(" + (LABEL[c.platform] || c.platform) + ", since " + dateText(c.connected_since) + ")"));
      row.appendChild(head);
      row.appendChild(el("p", "store-permission", PERMISSION_LABEL[c.permission === "read_write" ? "read_write" : "read"]));
      row.appendChild(el("p", "store-quiet", "Currency: " + (c.currency || "not read yet")));
      var msgId = "storeConnMsg-" + c.id;
      if (c.platform === "shopify") {
        row.appendChild(el("p", "store-quiet", c.stock_scope === "location" && c.location_name
          ? "Stock shown is what is available at " + c.location_name + "."
          : "Stock shown is the total across your locations."));
        row.appendChild(locationLine(c, msgId));
      }
      if (c.platform === "etsy" && c.shop_name) row.appendChild(el("p", "store-quiet", "Etsy shop: " + c.shop_name));
      if (c.platform === "amazon" && c.marketplace) row.appendChild(el("p", "store-quiet", "Amazon marketplace: " + c.marketplace));
      row.appendChild(el("p", "store-quiet", "Last synced: " + timeText(c.last_sync_at)));
      if (c.status === "needs_reconnect") {
        row.appendChild(el("p", "store-warn", (LABEL[c.platform] || c.platform) + " refused the saved key, so this store is not being read. " +
          "Connect it again below, or disconnect it."));
      }
      var actions = el("div", "store-row");
      if (c.status === "connected") {
        var sync = el("button", "action-btn action-btn--ghost", "Sync now");
        sync.type = "button";
        sync.addEventListener("click", function () {
          sync.disabled = true;
          say(msgId, "Reading your store...");
          api("POST", "/api/store/connections/" + encodeURIComponent(c.id) + "/sync").then(function (res) {
            sync.disabled = false;
            if (!res.ok) { say(msgId, serverMessage(res), true); if (res.status === 409) load(); return; }
            var s = res.data.synced || {};
            say(msgId, "Read " + (s.items_written || 0) + " item(s) and " + (s.orders || 0) + " order summary(ies)." +
              (s.skipped_sku_manual ? " " + s.skipped_sku_manual + " skipped: an item you entered already has that SKU, and yours was left as it is." : "") +
              (s.skipped_untracked ? " " + s.skipped_untracked + " skipped: the store does not track their stock." : "") +
              (s.skipped_not_at_location ? " " + s.skipped_not_at_location + " skipped: not stocked at the chosen location." : "") +
              (s.skipped_disabled ? " " + s.skipped_disabled + " skipped: turned off in the store." : "") +
              (s.skipped_id_too_long ? " " + s.skipped_id_too_long + " skipped: too many options to name." : ""));
            load();
          }, function () { sync.disabled = false; say(msgId, "The request failed. Nothing was changed.", true); });
        });
        actions.appendChild(sync);
      }
      var off = el("button", "action-btn action-btn--ghost", "Disconnect");
      off.type = "button";
      off.addEventListener("click", function () {
        off.disabled = true;
        api("DELETE", "/api/store/connections/" + encodeURIComponent(c.id)).then(function (res) {
          off.disabled = false;
          if (!res.ok) { say(msgId, serverMessage(res), true); return; }
          say("storeConnectMsg", res.data.note || "Disconnected.");
          load();
        }, function () { off.disabled = false; say(msgId, "The request failed. Nothing was changed.", true); });
      });
      actions.appendChild(off);
      row.appendChild(actions);
      var msg = el("div", "store-msg");
      msg.id = msgId;
      row.appendChild(msg);
      box.appendChild(row);
    });
  }

  function setShopifyAvailable(available) {
    byId("storeShopifyBtn").disabled = !available;
    byId("storeShopifyUnset").hidden = available;
    byId("storeShopifyUnset").textContent = SHOPIFY_UNSET;
  }
  function setEtsyAvailable(available) {
    byId("storeEtsyBtn").disabled = !available;
    byId("storeEtsyUnset").hidden = available;
    byId("storeEtsyUnset").textContent = ETSY_UNSET;
  }
  /* Amazon: the button, the unset line, and the draft line while BizForce's app is a draft. */
  function setAmazonAvailable(available, draft) {
    byId("storeAmazonBtn").disabled = !available;
    byId("storeAmazonUnset").hidden = available;
    byId("storeAmazonUnset").textContent = AMAZON_UNSET;
    byId("storeAmazonDraft").hidden = draft === false;
  }

  function load() {
    if (!tok()) return;
    api("GET", "/api/store/connections").then(function (res) {
      if (!res.ok) { say("storeStatusMsg", "Your store connections could not be loaded: " + serverMessage(res), true); return; }
      say("storeStatusMsg", "");
      if (window.bfStoreChanges) window.bfStoreChanges.reset();
      setShopifyAvailable(res.data.shopify_available === true);
      setEtsyAvailable(res.data.etsy_available === true);
      setAmazonAvailable(res.data.amazon_available === true, res.data.amazon_draft);
      renderConnections(Array.isArray(res.data.connections) ? res.data.connections : []);
    }, function () { say("storeStatusMsg", "Your store connections could not be loaded: the request failed.", true); });
  }

  function connectShopify() {
    var btn = byId("storeShopifyBtn");
    btn.disabled = true;
    say("storeConnectMsg", "Opening Shopify...");
    api("POST", "/api/store/shopify/start", { shop: byId("storeShop").value, allow_changes: byId("storeShopifyAllow").checked === true }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { say("storeConnectMsg", serverMessage(res), true); return; }
      if (res.data.authorize_url) { markReturn("shopify"); window.location.assign(res.data.authorize_url); return; }
      say("storeConnectMsg", "Shopify did not answer with its page. Nothing was saved.", true);
    }, function () { btn.disabled = false; say("storeConnectMsg", "The request failed. Nothing was saved.", true); });
  }

  function connectEtsy() {
    var etsyBtn = byId("storeEtsyBtn");
    etsyBtn.disabled = true;
    say("storeConnectMsg", "Opening Etsy...");
    api("POST", "/api/store/etsy/start", { allow_changes: byId("storeEtsyAllow").checked === true }).then(function (res) {
      etsyBtn.disabled = false;
      if (!res.ok) { say("storeConnectMsg", serverMessage(res), true); return; }
      if (res.data.authorize_url) { markReturn("etsy"); window.location.assign(res.data.authorize_url); return; }
      say("storeConnectMsg", "Etsy did not answer with its page. Nothing was saved.", true);
    }, function () { etsyBtn.disabled = false; say("storeConnectMsg", "The request failed. Nothing was saved.", true); });
  }

  function connectAmazon() {
    var market = byId("storeAmazonMarket").value;
    if (!market) { say("storeConnectMsg", AMAZON_PICK, true); return; }
    var amazonBtn = byId("storeAmazonBtn");
    amazonBtn.disabled = true;
    say("storeConnectMsg", "Opening Amazon Seller Central...");
    api("POST", "/api/store/amazon/start", { marketplace_id: market, allow_changes: byId("storeAmazonAllow").checked === true }).then(function (res) {
      amazonBtn.disabled = false;
      if (!res.ok) { say("storeConnectMsg", serverMessage(res), true); return; }
      if (res.data.authorize_url) { markReturn("amazon"); window.location.assign(res.data.authorize_url); return; }
      say("storeConnectMsg", "Amazon did not answer with its page. Nothing was saved.", true);
    }, function () { amazonBtn.disabled = false; say("storeConnectMsg", "The request failed. Nothing was saved.", true); });
  }

  function connect() {
    var body = { platform: "woocommerce", store_url: byId("storeUrl").value, allow_changes: byId("storeAllowChanges").checked === true };
    var btn = byId("storeConnectBtn");
    btn.disabled = true;
    say("storeConnectMsg", "Opening your store...");
    api("POST", "/api/store/connections", body).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { say("storeConnectMsg", serverMessage(res), true); return; }
      if (res.data.authorize_url) { window.location.href = res.data.authorize_url; return; }
      say("storeConnectMsg", "Connected. Press \"Sync now\" to read your products, stock and orders.");
      byId("storeUrl").value = "";
      load();
    }, function () { btn.disabled = false; say("storeConnectMsg", "The request failed. Nothing was saved.", true); });
  }

  /* Back from Shopify. The address bar is cleared whatever the answer, so the
     code never stays in it or in the history. */
  function stripQuery() {
    try { window.history.replaceState(null, "", "/store-agent.html"); } catch (e) { /* nothing to strip */ }
  }
  function handleShopifyReturn(q) {
    var params = {};
    q.forEach(function (value, key) { params[key] = value; });
    var shown = (q.get("shop") || "").replace(/[^a-z0-9.-]/gi, "");
    if (!q.get("code") || !q.get("state")) {
      // Shopify opened the app's URL (?shop and ?hmac, no code): fill the shop in; nothing is sent.
      stripQuery();
      choose("shopify");
      if (shown) byId("storeShop").value = shown;
      say("storeConnectMsg", FINISH_HINT);
      load();
      return;
    }
    choose("shopify");
    say("storeConnectMsg", "Finishing the Shopify connection...");
    api("POST", "/api/store/shopify/finish", { params: params }).then(function (res) {
      return res;
    }, function () {
      return null;
    }).then(function (res) {
      stripQuery();
      if (res && res.ok) {
        say("storeConnectMsg", "Connected to " + shown + ". Press \"Sync now\" to read your products, stock and orders.");
      } else {
        say("storeConnectMsg", res ? serverMessage(res) : "The request failed. Nothing was saved.", true);
      }
      load();
    });
    params = null;
  }

  /* Back from Etsy, with the "etsy" marker: the code and state are POSTed to
     /api/store/etsy/finish. The address bar is cleared first. */
  function handleEtsyReturn(q) {
    var etsyCode = q.get("code"), etsyState = q.get("state");
    stripQuery();
    choose("etsy");
    say("storeConnectMsg", "Finishing the Etsy connection...");
    api("POST", "/api/store/etsy/finish", { code: etsyCode, state: etsyState }).then(function (answer) {
      if (answer.ok) {
        var made = answer.data.connection || {};
        say("storeConnectMsg", "Connected to your Etsy shop" + (made.shop_name ? " " + made.shop_name : "") + ". Press \"Sync now\" to read your listings, stock and orders.");
      } else {
        say("storeConnectMsg", serverMessage(answer), true);
      }
      load();
    }, function () {
      say("storeConnectMsg", "The request failed. Nothing was saved.", true);
      load();
    });
    etsyCode = null;
    etsyState = null;
  }

  /* Back from Amazon, with the "amazon" marker: spapi_oauth_code, state and
     selling_partner_id are POSTed to /api/store/amazon/finish. The address
     bar is cleared first. */
  function handleAmazonReturn(q) {
    var amazonCode = q.get("spapi_oauth_code"), amazonState = q.get("state"), amazonSeller = q.get("selling_partner_id");
    stripQuery();
    choose("amazon");
    say("storeConnectMsg", "Finishing the Amazon connection...");
    api("POST", "/api/store/amazon/finish", { spapi_oauth_code: amazonCode, state: amazonState, selling_partner_id: amazonSeller }).then(function (answer) {
      if (answer.ok) {
        var made = answer.data.connection || {};
        say("storeConnectMsg", "Connected to your Amazon seller account" + (made.marketplace ? " in marketplace " + made.marketplace : "") +
          ". Press \"Sync now\" to read your listings, stock and orders.");
      } else {
        say("storeConnectMsg", serverMessage(answer), true);
      }
      load();
    }, function () {
      say("storeConnectMsg", "The request failed. Nothing was saved.", true);
      load();
    });
    amazonCode = null;
    amazonState = null;
    amazonSeller = null;
  }

  /* A return carrying code, state or error and no Shopify signature: Etsy's
     or Amazon's when the marker says so, otherwise nobody's, and nothing is
     sent. */
  function handleOtherReturn(q) {
    var marker = takeReturn();
    if (marker === "etsy" && q.get("code") && q.get("state")) { handleEtsyReturn(q); return; }
    if (marker === "amazon" && q.get("spapi_oauth_code") && q.get("state") && q.get("selling_partner_id")) { handleAmazonReturn(q); return; }
    stripQuery();
    if (marker === "etsy" && q.get("error")) {
      choose("etsy");
      say("storeConnectMsg", "Etsy did not connect your shop, so nothing was saved.", true);
    } else if (marker === "amazon" && q.get("error")) {
      choose("amazon");
      say("storeConnectMsg", "Amazon did not connect your seller account, so nothing was saved.", true);
    } else {
      say("storeConnectMsg", START_AGAIN, true);
    }
    load();
  }

  function init() {
    if (!byId("storeConnect")) return;
    byId("storePickShopify").addEventListener("click", function () { choose("shopify"); });
    byId("storePickWoo").addEventListener("click", function () { choose("woocommerce"); });
    byId("storeConnectBtn").addEventListener("click", connect);
    byId("storeShopifyBtn").addEventListener("click", connectShopify);
    byId("storePickEtsy").addEventListener("click", function () { choose("etsy"); });
    byId("storeEtsyBtn").addEventListener("click", connectEtsy);
    byId("storePickAmazon").addEventListener("click", function () { choose("amazon"); });
    byId("storeAmazonBtn").addEventListener("click", connectAmazon);
    choose("shopify");
    var q = new URLSearchParams(window.location.search);
    if (q.get("store") === "woocommerce") {
      say("storeConnectMsg", q.get("success") === "0"
        ? "WooCommerce did not hand over a key, so nothing was saved."
        : "Back from your store. If you approved the access BizForce asked for, it shows below as connected.");
    } else if (q.get("shop") && q.get("hmac")) {
      // Shopify is known by its own signed parameters; the marker is spent either way.
      takeReturn();
      handleShopifyReturn(q);
      return;
    } else if (q.get("code") || q.get("state") || q.get("error") || q.get("spapi_oauth_code") || q.get("selling_partner_id")) {
      handleOtherReturn(q);
      return;
    }
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

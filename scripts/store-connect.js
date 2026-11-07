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

   Every server message is shown as the server wrote it, with textContent.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var LABEL = { shopify: "Shopify", woocommerce: "WooCommerce" };
  var PERMISSION_LABEL = { read: "Read only", read_write: "Changes allowed with your approval" };
  var SHOPIFY_UNSET = "Shopify connection isn't set up yet.";
  var FINISH_HINT = "Press Connect Shopify to finish connecting.";

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
    byId("storeShopifySection").hidden = p !== "shopify";
    byId("storeWooSteps").hidden = p !== "woocommerce";
    byId("storeWooSection").hidden = p !== "woocommerce";
    if (p !== "woocommerce") byId("storeAllowChanges").checked = false;
    if (p !== "shopify") byId("storeShopifyAllow").checked = false;
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
              (s.skipped_not_at_location ? " " + s.skipped_not_at_location + " skipped: not stocked at the chosen location." : ""));
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

  function load() {
    if (!tok()) return;
    api("GET", "/api/store/connections").then(function (res) {
      if (!res.ok) { say("storeStatusMsg", "Your store connections could not be loaded: " + serverMessage(res), true); return; }
      say("storeStatusMsg", "");
      if (window.bfStoreChanges) window.bfStoreChanges.reset();
      setShopifyAvailable(res.data.shopify_available === true);
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
      if (res.data.authorize_url) { window.location.assign(res.data.authorize_url); return; }
      say("storeConnectMsg", "Shopify did not answer with its page. Nothing was saved.", true);
    }, function () { btn.disabled = false; say("storeConnectMsg", "The request failed. Nothing was saved.", true); });
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

  function init() {
    if (!byId("storeConnect")) return;
    byId("storePickShopify").addEventListener("click", function () { choose("shopify"); });
    byId("storePickWoo").addEventListener("click", function () { choose("woocommerce"); });
    byId("storeConnectBtn").addEventListener("click", connect);
    byId("storeShopifyBtn").addEventListener("click", connectShopify);
    choose("shopify");
    var q = new URLSearchParams(window.location.search);
    if (q.get("store") === "woocommerce") {
      say("storeConnectMsg", q.get("success") === "0"
        ? "WooCommerce did not hand over a key, so nothing was saved."
        : "Back from your store. If you approved the access BizForce asked for, it shows below as connected.");
    } else if (q.get("shop") && q.get("hmac")) {
      handleShopifyReturn(q);
      return;
    }
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

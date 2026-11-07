/* ══════════════════════════════════════════════════════════════════════════
   Connect your store, on the Store agent's page (store-agent.html, #storeConnect).

   A member connects their OWN Shopify or WooCommerce store. BizForce reads
   products, stock and order summaries. It changes a price or stock level only
   when the member approves that change, and only on a WooCommerce store
   connected with "Let BizForce make changes I approve (prices and stock)"
   ticked (migration 175; scripts/store-changes.js). Shopify is read-only. The
   server is the only source of truth: GET /api/store/connections (platform,
   store, status, permission, since, last synced; never the key).

   Shopify: the shop's myshopify.com address and the Admin API access token
   from a custom app the member made with read scopes only. The token is sent
   once, to POST /api/store/connections, and the field is cleared whatever the
   answer; it is never stored here, never read back and never shown.

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
    byId("storeShopifySteps").hidden = p !== "shopify";
    byId("storeWooSteps").hidden = p !== "woocommerce";
    byId("storeTokenField").hidden = p !== "shopify";
    byId("storeAllowField").hidden = p !== "woocommerce";
    if (p !== "woocommerce") byId("storeAllowChanges").checked = false;
    byId("storeUrl").placeholder = p === "shopify" ? "your-shop.myshopify.com" : "https://shop.example.com";
    say("storeConnectMsg", "");
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
      row.appendChild(el("p", "store-quiet", "Last synced: " + timeText(c.last_sync_at)));
      if (c.status === "needs_reconnect") {
        row.appendChild(el("p", "store-warn", (LABEL[c.platform] || c.platform) + " refused the saved key, so this store is not being read. " +
          "Connect it again below with a new key, or disconnect it."));
      }
      var actions = el("div", "store-row");
      var msgId = "storeConnMsg-" + c.id;
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
              (s.skipped_untracked ? " " + s.skipped_untracked + " skipped: the store does not track their stock." : ""));
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

  function load() {
    if (!tok()) return;
    api("GET", "/api/store/connections").then(function (res) {
      if (!res.ok) { say("storeStatusMsg", "Your store connections could not be loaded: " + serverMessage(res), true); return; }
      say("storeStatusMsg", "");
      if (window.bfStoreChanges) window.bfStoreChanges.reset();
      renderConnections(Array.isArray(res.data.connections) ? res.data.connections : []);
    }, function () { say("storeStatusMsg", "Your store connections could not be loaded: the request failed.", true); });
  }

  function connect() {
    var url = byId("storeUrl").value;
    var tokenEl = byId("storeToken");
    var body = { platform: platform, store_url: url };
    if (platform === "shopify") body.access_token = tokenEl.value;
    if (platform === "woocommerce") body.allow_changes = byId("storeAllowChanges").checked === true;
    tokenEl.value = "";
    var btn = byId("storeConnectBtn");
    btn.disabled = true;
    say("storeConnectMsg", platform === "shopify" ? "Checking the token with Shopify..." : "Opening your store...");
    api("POST", "/api/store/connections", body).then(function (res) {
      btn.disabled = false;
      if (!res.ok) { say("storeConnectMsg", serverMessage(res), true); return; }
      if (res.data.authorize_url) { window.location.href = res.data.authorize_url; return; }
      say("storeConnectMsg", "Connected. Press \"Sync now\" to read your products, stock and orders.");
      byId("storeUrl").value = "";
      load();
    }, function () { btn.disabled = false; say("storeConnectMsg", "The request failed. Nothing was saved.", true); });
  }

  function init() {
    if (!byId("storeConnect")) return;
    byId("storePickShopify").addEventListener("click", function () { choose("shopify"); });
    byId("storePickWoo").addEventListener("click", function () { choose("woocommerce"); });
    byId("storeConnectBtn").addEventListener("click", connect);
    choose("shopify");
    var q = new URLSearchParams(window.location.search);
    if (q.get("store") === "woocommerce") {
      say("storeConnectMsg", q.get("success") === "0"
        ? "WooCommerce did not hand over a key, so nothing was saved."
        : "Back from your store. If you approved the access BizForce asked for, it shows below as connected.");
    }
    load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

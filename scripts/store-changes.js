/* ══════════════════════════════════════════════════════════════════════════
   Store changes (migrations 175 and 176): propose, list and undo a price or
   stock change in a member's own WooCommerce, Shopify or Etsy store. Loaded by
   store-agent.html and inventory.html.

   NOTHING CHANGES IN THE STORE FROM THIS PAGE. "Propose" files a proposal
   (POST /api/store/changes/propose); the change is made only when the member
   approves it on the Approvals page, and only on a store connected with "Let
   BizForce make changes I approve (prices and stock)" ticked. Undo files a new
   proposal back to the old value (POST /api/store/changes/:id/undo), after the
   member confirms. A Shopify stock change applies at the location chosen on
   the Store Agent page. Prices are shown with the store's currency.

   Every server message is shown as the server wrote it, with textContent.
   Nothing here is set with innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var READ_ONLY_TEXT = "Read only: reconnect with changes allowed to propose changes";

  function tok() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + tok() } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().then(
        function (d) { return { ok: r.ok, status: r.status, data: d || {} }; },
        function () { return { ok: r.ok, status: r.status, data: {} }; }
      );
    });
  }
  function serverMessage(res) {
    return (res && res.data && typeof res.data.error === "string" && res.data.error) || ("The request failed (HTTP " + (res && res.status) + "). Nothing was changed.");
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function say(node, text, isError) {
    node.textContent = text || "";
    node.className = "store-msg" + (isError ? " err" : "");
  }
  function timeText(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  /* The member's connections, by id: { platform, permission, status, currency, location_name }. */
  var connections = null;
  function loadConnections() {
    if (connections) return connections;
    connections = api("GET", "/api/store/connections").then(function (res) {
      var map = {};
      if (res.ok && Array.isArray(res.data.connections)) {
        res.data.connections.forEach(function (c) { if (c && c.id) map[c.id] = c; });
      }
      return map;
    }, function () { return {}; });
    return connections;
  }
  function writable(c) {
    return !!c && (c.platform === "woocommerce" || c.platform === "shopify" || c.platform === "etsy") && c.permission === "read_write" && c.status === "connected";
  }
  /* "19.99 USD", or "19.99" when the store's currency is not known yet. */
  function priceText(value, currency) {
    return String(value) + (typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? " " + currency : "");
  }

  /* "Propose a change" for one synced item. prefill: { field, value }. */
  function proposeControl(conn, itemId, prefill) {
    var box = el("div", "store-change");
    var open = el("button", "action-btn action-btn--ghost store-change-open", "Propose a change");
    open.type = "button";
    var form = el("div", "store-change-form");
    form.hidden = true;
    var pick = el("select", "store-change-field");
    var currency = conn && typeof conn.currency === "string" && /^[A-Z]{3}$/.test(conn.currency) ? conn.currency : "";
    [["price", currency ? "New price (" + currency + ")" : "New price"], ["stock", "New stock level"]].forEach(function (o) {
      var opt = el("option", null, o[1]);
      opt.value = o[0];
      pick.appendChild(opt);
    });
    var input = el("input", "store-change-to");
    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    var send = el("button", "action-btn store-change-send", "Propose");
    send.type = "button";
    var msg = el("div", "store-msg");
    if (prefill && (prefill.field === "price" || prefill.field === "stock")) pick.value = prefill.field;
    if (prefill && prefill.value !== undefined && prefill.value !== null) input.value = String(prefill.value);
    pick.addEventListener("change", function () { input.step = pick.value === "stock" ? "1" : "0.01"; });
    input.step = pick.value === "stock" ? "1" : "0.01";
    open.addEventListener("click", function () { form.hidden = !form.hidden; });
    send.addEventListener("click", function () {
      send.disabled = true;
      say(msg, "Reading your store...");
      api("POST", "/api/store/changes/propose", { item_id: itemId, field: pick.value, to: input.value }).then(function (res) {
        send.disabled = false;
        if (!res.ok) { say(msg, serverMessage(res), true); return; }
        say(msg, (res.data.note || "Filed for approval.") + " Approve it on the Approvals page.");
      }, function () { send.disabled = false; say(msg, "The request failed. Nothing was proposed.", true); });
    });
    form.appendChild(pick);
    form.appendChild(input);
    form.appendChild(send);
    if (conn && conn.platform === "shopify") {
      form.appendChild(el("p", "store-quiet store-change-where", conn.location_name ? "Stock changes apply at " + conn.location_name + "."
        : "Choose a location for stock changes on the Store Agent page before proposing a stock change."));
    }
    // Etsy (Nov 8 2026, migration 181): an offering's quantity is 0 to 999.
    if (conn && conn.platform === "etsy") form.appendChild(el("p", "store-quiet store-change-where", "Etsy allows a stock level from 0 to 999."));
    box.appendChild(open);
    box.appendChild(form);
    box.appendChild(msg);
    return box;
  }

  /* The control for an item, or the read-only line, or nothing for a manual item. */
  function controlFor(conn, itemId, prefill) {
    if (!conn) return null;
    if (writable(conn)) return proposeControl(conn, itemId, prefill);
    return el("p", "store-quiet store-change-readonly", READ_ONLY_TEXT);
  }

  /* inventory.html: fills each [data-store-item] slot the row renderer left. */
  function decorateInventory(listEl) {
    if (!listEl) return;
    var slots = listEl.querySelectorAll("[data-store-item]");
    if (!slots.length) return;
    loadConnections().then(function (map) {
      Array.prototype.forEach.call(slots, function (slot) {
        slot.textContent = "";
        var conn = map[slot.getAttribute("data-store-conn")];
        var shownPrice = slot.getAttribute("data-store-price");
        if (conn && shownPrice && typeof conn.currency === "string" && /^[A-Z]{3}$/.test(conn.currency)) {
          slot.appendChild(el("p", "store-quiet store-currency", "Store price: " + priceText(shownPrice, conn.currency)));
        }
        var node = controlFor(conn, slot.getAttribute("data-store-item"),
          { field: "price", value: slot.getAttribute("data-store-price") });
        if (node) slot.appendChild(node);
      });
    });
  }

  /* Stock & Margin: under a result, a control for each row read from a store. */
  function decorateStockMargin(resultEl, data) {
    var rows = data && data.measured && Array.isArray(data.measured.stock) ? data.measured.stock : [];
    var synced = rows.filter(function (r) { return r && typeof r.store_item_id === "string" && r.source !== "manual"; });
    if (!resultEl || !synced.length) return;
    api("GET", "/api/inventory/items?limit=200").then(function (res) {
      var items = res.ok && Array.isArray(res.data.items) ? res.data.items : [];
      var byId = {};
      items.forEach(function (it) { if (it && it.id) byId[it.id] = it; });
      return loadConnections().then(function (map) {
        var wrap = el("div", "store-change-list");
        wrap.appendChild(el("h4", "store-change-head", "Propose a store change"));
        wrap.appendChild(el("p", "store-quiet", "Nothing changes in your store until you approve the proposal."));
        synced.forEach(function (r) {
          var it = byId[r.store_item_id];
          var conn = it ? map[it.store_connection_id] : null;
          var line = el("div", "store-change-row");
          line.appendChild(el("span", "store-change-name", String(r.name || "Untitled")));
          var node = controlFor(conn, r.store_item_id, { field: "price", value: r.unit_price });
          if (node) line.appendChild(node);
          else line.appendChild(el("span", "store-quiet", " (not found in your inventory)"));
          wrap.appendChild(line);
        });
        resultEl.appendChild(wrap);
      });
    }, function () {});
  }

  /* store-agent.html: the log of changes made with approval, with Undo. */
  function renderLog(box, before) {
    if (!box || !tok()) return;
    var path = "/api/store/changes" + (before ? "?before=" + encodeURIComponent(before) : "");
    api("GET", path).then(function (res) {
      if (!before) box.textContent = "";
      if (!res.ok) { box.appendChild(el("p", "store-msg err", "Your store changes could not be loaded: " + serverMessage(res))); return; }
      var list = Array.isArray(res.data.changes) ? res.data.changes : [];
      if (!list.length && !before) { box.appendChild(el("p", "store-quiet", "No changes made in your store yet.")); return; }
      list.forEach(function (c) {
        var row = el("div", "store-conn store-change-entry");
        row.appendChild(el("p", "store-change-what", String(c.item_name || "Untitled") + ": " + (c.field === "price"
          ? "price " + priceText(c.old_value, c.currency) + " to " + priceText(c.new_value, c.currency)
          : "stock " + String(c.old_value) + " to " + String(c.new_value) + (c.location_name ? " at " + String(c.location_name) : ""))));
        row.appendChild(el("p", "store-quiet", timeText(c.executed_at)));
        var actions = el("div", "store-row");
        var undo = el("button", "action-btn action-btn--ghost", "Undo");
        undo.type = "button";
        var sure = el("button", "action-btn", "Yes, propose changing it back");
        sure.type = "button";
        sure.hidden = true;
        var cancel = el("button", "action-btn action-btn--ghost", "Cancel");
        cancel.type = "button";
        cancel.hidden = true;
        var msg = el("div", "store-msg");
        undo.addEventListener("click", function () {
          undo.hidden = true; sure.hidden = false; cancel.hidden = false;
          say(msg, "This files a new proposal to change it back to " + (c.field === "price" ? priceText(c.old_value, c.currency) : String(c.old_value)) + ". Nothing changes until you approve it.");
        });
        cancel.addEventListener("click", function () { undo.hidden = false; sure.hidden = true; cancel.hidden = true; say(msg, ""); });
        sure.addEventListener("click", function () {
          sure.disabled = true;
          api("POST", "/api/store/changes/" + encodeURIComponent(c.id) + "/undo").then(function (r2) {
            sure.disabled = false; sure.hidden = true; cancel.hidden = true; undo.hidden = false;
            if (!r2.ok) { say(msg, serverMessage(r2), true); return; }
            say(msg, (r2.data.note || "Filed for approval.") + " Approve it on the Approvals page.");
          }, function () { sure.disabled = false; say(msg, "The request failed. Nothing was proposed.", true); });
        });
        actions.appendChild(undo);
        actions.appendChild(sure);
        actions.appendChild(cancel);
        row.appendChild(actions);
        row.appendChild(msg);
        box.appendChild(row);
      });
      if (res.data.has_more && res.data.next_before) {
        var more = el("button", "action-btn action-btn--ghost", "Show older changes");
        more.type = "button";
        more.addEventListener("click", function () { more.remove(); renderLog(box, res.data.next_before); });
        box.appendChild(more);
      }
    }, function () { box.appendChild(el("p", "store-msg err", "Your store changes could not be loaded: the request failed.")); });
  }

  window.bfStoreChanges = {
    READ_ONLY_TEXT: READ_ONLY_TEXT,
    decorateInventory: decorateInventory,
    decorateStockMargin: decorateStockMargin,
    renderLog: renderLog,
    reset: function () { connections = null; }
  };

  /* The Stock & Margin result hook (agent-profile.js calls window.bfAfterToolResult). */
  var earlier = typeof window.bfAfterToolResult === "function" ? window.bfAfterToolResult : null;
  window.bfAfterToolResult = function (agentType, toolId, data, resultEl) {
    if (earlier) earlier(agentType, toolId, data, resultEl);
    if (agentType === "store" && toolId === "stock-margin") decorateStockMargin(resultEl, data);
  };

  function init() {
    var box = document.getElementById("storeChanges");
    if (box) renderLog(box, null);
    // inventory.html may have drawn its rows before this script loaded.
    var inv = document.getElementById("itemList");
    if (inv) decorateInventory(inv);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

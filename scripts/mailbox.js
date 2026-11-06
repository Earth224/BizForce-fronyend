/* scripts/mailbox.js — mailbox.html, Your Inbox.
   Connect (POST /api/mailbox/connect: the server logs in to the mailbox and
   checks its outgoing server before it keeps the app password, encrypted),
   the connection's state (GET /api/mailbox/status), Disconnect
   (POST /api/mailbox/disconnect), and reading on request only: nothing loads
   when the page opens; "Show my inbox" lists the newest 30
   (GET /api/mailbox/inbox), "Show older" the 30 before them, and a row opens
   one message as plain text (GET /api/mailbox/inbox/:uid). The server opens
   the mailbox read-only and stores no message. The app password field is
   cleared after every answer. Every word from the server or a message is set
   with textContent, never innerHTML. */
(function () {
  "use strict";
  var API = "https://dynamic-prosperity-production-5382.up.railway.app";
  var OFFLINE = "Your inbox loads when you are back online.";
  var HELP = {
    gmail: "Google Account, Security, turn on 2-Step Verification, then App passwords.",
    yahoo: "Account security, then Generate app password.",
    icloud: "appleid.apple.com, Sign-In and Security, then App-Specific Passwords.",
    fastmail: "Settings, Privacy and Security, then App passwords.",
    other: "Your provider's help pages explain how to make an app password."
  };
  var HELP_SUFFIX = " Your provider may name these steps slightly differently.";
  var LABELS = { gmail: "Gmail", yahoo: "Yahoo Mail", icloud: "iCloud Mail", fastmail: "Fastmail", other: "Other" };
  var state = { status: null, nextBefore: null, busy: false };

  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function headers(json) {
    var h = { "Authorization": "Bearer " + token() };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function online() { return !(typeof navigator !== "undefined" && navigator.onLine === false); }
  function call(method, path, body) {
    var init = { method: method, headers: headers(body !== undefined), cache: "no-store" };
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetch(API + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, body: b || {} }; });
    });
  }
  function say(text, isError) {
    var s = $("mbStatus");
    s.textContent = text || "";
    s.className = "mb-status" + (isError ? " err" : "");
  }
  function reconnectText(address) {
    return "Your mailbox stopped accepting the app password saved for " + address + ", so BizForce can't read it. Make a new app password and connect again.";
  }
  function dateText(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try { return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return d.toISOString(); }
  }
  function sizeText(bytes) {
    var n = Number(bytes) || 0;
    if (n < 1024) return n + " bytes";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return Math.round(n / 104857.6) / 10 + " MB";
  }
  function whoText(who) {
    if (!who) return "";
    if (who.name && who.address) return who.name + " <" + who.address + ">";
    return who.name || who.address || "";
  }
  function listText(list) { return (list || []).map(whoText).filter(Boolean).join(", "); }

  /* ── connect ───────────────────────────────────────────────────────── */
  function showProvider() {
    var p = $("mbProvider").value;
    $("mbHelp").textContent = (HELP[p] || HELP.other) + HELP_SUFFIX;
    $("mbOtherFields").hidden = p !== "other";
  }

  function connect() {
    if (state.busy) return;
    if (!online()) { say(OFFLINE, true); return; }
    var provider = $("mbProvider").value;
    var form = {
      provider: provider,
      email_address: $("mbEmail").value.trim(),
      username: $("mbUsername").value.trim(),
      app_password: $("mbPassword").value
    };
    if (provider === "other") {
      form.imap_host = $("mbImapHost").value.trim();
      form.smtp_host = $("mbSmtpHost").value.trim();
      form.smtp_port = Number($("mbSmtpPort").value);
    }
    state.busy = true;
    $("mbConnectBtn").disabled = true;
    say("Checking your mailbox…");
    call("POST", "/api/mailbox/connect", form).then(function (r) {
      if (!r.ok) { say(r.body.error || "Your mailbox could not be connected.", true); return; }
      say("Connected.");
      render(r.body);
    }).catch(function () {
      say(online() ? "Your mailbox could not be connected." : OFFLINE, true);
    }).then(function () {
      form.app_password = null;
      $("mbPassword").value = "";
      state.busy = false;
      $("mbConnectBtn").disabled = false;
    });
  }

  function disconnect() {
    if (state.busy) return;
    if (!online()) { say(OFFLINE, true); return; }
    state.busy = true;
    $("mbDisconnectBtn").disabled = true;
    call("POST", "/api/mailbox/disconnect").then(function (r) {
      if (!r.ok) { say(r.body.error || "Your mailbox could not be disconnected.", true); return; }
      say(r.body.note || "Disconnected.");
      render(r.body);
    }).catch(function () {
      say(online() ? "Your mailbox could not be disconnected." : OFFLINE, true);
    }).then(function () {
      state.busy = false;
      $("mbDisconnectBtn").disabled = false;
    });
  }

  /* ── state ─────────────────────────────────────────────────────────── */
  function hideReading() {
    $("mbInbox").hidden = true;
    $("mbMessage").hidden = true;
    clear($("mbList"));
    state.nextBefore = null;
  }

  function render(status) {
    state.status = status || {};
    var s = state.status;
    hideReading();
    if (!s.provider) {
      $("mbConnected").hidden = true;
      $("mbConnect").hidden = false;
      return;
    }
    $("mbConnected").hidden = false;
    $("mbConnectedTitle").textContent = (LABELS[s.provider] || "Mailbox") + ": " + (s.email_address || "");
    if (s.status === "connected") {
      $("mbConnectedNote").textContent = s.since ? "Connected since " + dateText(s.since) + "." : "Connected.";
      $("mbShowBtn").hidden = false;
      $("mbConnect").hidden = true;
    } else {
      $("mbConnectedNote").textContent = reconnectText(s.email_address || "your mailbox");
      $("mbShowBtn").hidden = true;
      $("mbConnect").hidden = false;
      if (LABELS[s.provider]) $("mbProvider").value = s.provider;
      if (s.email_address && !$("mbEmail").value) $("mbEmail").value = s.email_address;
      showProvider();
    }
  }

  function loadStatus() {
    if (!online()) { say(OFFLINE); return; }
    call("GET", "/api/mailbox/status").then(function (r) {
      if (!r.ok) { say(r.body.error || "Your mailbox connection could not be read.", true); return; }
      render(r.body);
    }).catch(function () {
      say(online() ? "Your mailbox connection could not be read." : OFFLINE, true);
    });
  }

  /* ── reading, on request only ──────────────────────────────────────── */
  function readFailed(r) {
    if (r.body && r.body.code === "needs_reconnect") {
      render(Object.assign({}, state.status, { connected: false, status: "needs_reconnect" }));
    }
    say((r.body && r.body.error) || "Your inbox could not be read.", true);
  }

  function row(m) {
    var li = el("li");
    var b = el("button", { type: "button", "class": "mb-row" + (m.seen ? "" : " unread"), "data-uid": String(m.uid) });
    b.appendChild(el("span", { "class": "mb-from" }, whoText(m.from) || "(no sender)"));
    b.appendChild(el("span", { "class": "mb-date" }, dateText(m.date)));
    b.appendChild(el("span", { "class": "mb-subject" }, m.subject || "(no subject)"));
    b.addEventListener("click", function () { openMessage(m.uid); });
    li.appendChild(b);
    return li;
  }

  function showInbox(older) {
    if (state.busy) return;
    if (!online()) { say(OFFLINE); return; }
    state.busy = true;
    var btn = older ? $("mbOlderBtn") : $("mbShowBtn");
    btn.disabled = true;
    say("Reading your inbox…");
    var path = "/api/mailbox/inbox" + (older && state.nextBefore ? "?before=" + encodeURIComponent(String(state.nextBefore)) : "");
    call("GET", path).then(function (r) {
      if (!r.ok) { readFailed(r); return; }
      var list = $("mbList");
      if (!older) clear(list);
      var messages = r.body.messages || [];
      messages.forEach(function (m) { list.appendChild(row(m)); });
      if (!older && messages.length === 0) list.appendChild(el("li", { "class": "mb-note" }, "Your inbox is empty."));
      state.nextBefore = r.body.next_before || null;
      $("mbOlderBtn").hidden = !state.nextBefore;
      $("mbMessage").hidden = true;
      $("mbInbox").hidden = false;
      say("");
    }).catch(function () {
      say(online() ? "Your inbox could not be read." : OFFLINE, true);
    }).then(function () {
      state.busy = false;
      btn.disabled = false;
    });
  }

  function head(label, value) {
    var p = el("p", { "class": "mb-head" });
    p.appendChild(el("b", null, label + ": "));
    p.appendChild(document.createTextNode(value));
    return p;
  }

  function openMessage(uid) {
    if (state.busy) return;
    if (!online()) { say(OFFLINE); return; }
    state.busy = true;
    say("Opening the message…");
    call("GET", "/api/mailbox/inbox/" + encodeURIComponent(String(uid))).then(function (r) {
      if (!r.ok) { readFailed(r); return; }
      var m = r.body.message || {};
      $("mbMsgSubject").textContent = m.subject || "(no subject)";
      var heads = $("mbMsgHeads");
      clear(heads);
      heads.appendChild(head("From", whoText(m.from) || "(no sender)"));
      if (listText(m.to)) heads.appendChild(head("To", listText(m.to)));
      if (listText(m.cc)) heads.appendChild(head("Cc", listText(m.cc)));
      if (m.date) heads.appendChild(head("Date", dateText(m.date)));
      $("mbMsgText").textContent = m.text || "";
      $("mbMsgTruncated").hidden = !m.truncated;
      var att = $("mbMsgAttach");
      clear(att);
      (m.attachments || []).forEach(function (a) {
        att.appendChild(el("li", null, (a.name || "(unnamed)") + ", " + (a.type || "unknown type") + ", " + sizeText(a.size)));
      });
      $("mbInbox").hidden = true;
      $("mbMessage").hidden = false;
      say("");
    }).catch(function () {
      say(online() ? "The message could not be opened." : OFFLINE, true);
    }).then(function () {
      state.busy = false;
    });
  }

  function back() {
    $("mbMessage").hidden = true;
    $("mbInbox").hidden = false;
  }

  function start() {
    $("mbProvider").addEventListener("change", showProvider);
    $("mbConnectBtn").addEventListener("click", connect);
    $("mbDisconnectBtn").addEventListener("click", disconnect);
    $("mbShowBtn").addEventListener("click", function () { showInbox(false); });
    $("mbOlderBtn").addEventListener("click", function () { showInbox(true); });
    $("mbBackBtn").addEventListener("click", back);
    window.addEventListener("offline", function () { say(OFFLINE); });
    window.addEventListener("online", function () { if ($("mbStatus").textContent === OFFLINE) { say(""); loadStatus(); } });
    showProvider();
    loadStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

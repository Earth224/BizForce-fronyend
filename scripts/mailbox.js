/* scripts/mailbox.js — mailbox.html, Your Inbox.
   Connect (POST /api/mailbox/connect: the server logs in to the mailbox and
   checks its outgoing server before it keeps the app password, encrypted),
   the connection's state (GET /api/mailbox/status), Disconnect
   (POST /api/mailbox/disconnect), and reading on request only: nothing loads
   when the page opens; "Show my inbox" lists the newest 30
   (GET /api/mailbox/inbox), "Show older" the 30 before them, and a row opens
   one message as plain text (GET /api/mailbox/inbox/:uid). The server opens
   the mailbox read-only and stores no message. On an open message, "Draft a
   reply" asks for one (POST /api/mailbox/inbox/:uid/draft-reply) and shows it
   as text; "File for approval" files it (POST /api/mailbox/propose-reply), and
   it is sent only after it is approved on the Proposals page. The app password field is
   cleared after every answer. Every word from the server or a message is set
   with textContent, never innerHTML.
   SIGN IN WITH MICROSOFT (Outlook, Hotmail or Microsoft 365): choosing it hides
   the address and password fields; the button asks the server to start
   (POST /api/mailbox/microsoft/start) and goes to the Microsoft page it names.
   Microsoft sends the browser back here with ?code and ?state (or ?error);
   the page POSTs both to /api/mailbox/microsoft/finish as the signed-in
   member, then strips the query with history.replaceState whatever the
   answer, so the code never stays in the address bar or the history. */
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
  var LABELS = { gmail: "Gmail", yahoo: "Yahoo Mail", icloud: "iCloud Mail", fastmail: "Fastmail", outlook: "Outlook", other: "Other" };
  var MS_CANCELLED = "You cancelled the Microsoft sign-in.";
  var MS_NOT_FINISHED = "Microsoft sign-in didn't finish. Try again.";
  var MS_HOST = "https://login.microsoftonline.com/";
  var state = { status: null, nextBefore: null, busy: false, openUid: null, taskId: null };

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
  function reconnectText(address, provider) {
    if (provider === "outlook") {
      return "Microsoft stopped accepting BizForce's access to " + address + ", so BizForce can't read it. Sign in with Microsoft again.";
    }
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
    var ms = p === "outlook";
    $("mbPasswordFields").hidden = ms;
    $("mbOtherFields").hidden = p !== "other";
    $("mbHelp").hidden = ms;
    $("mbHelp").textContent = ms ? "" : (HELP[p] || HELP.other) + HELP_SUFFIX;
    $("mbConnectActions").hidden = ms;
    $("mbMicrosoft").hidden = !ms;
    showMicrosoftAvailability();
  }

  /* The button works only when the server says Outlook sign-in is set up. */
  function showMicrosoftAvailability() {
    var available = !!(state.status && state.status.outlook_available === true);
    $("mbMsBtn").disabled = !available || state.busy;
    $("mbMsUnavailable").hidden = available;
  }

  function signInWithMicrosoft() {
    if (state.busy) return;
    if (!online()) { say(OFFLINE, true); return; }
    state.busy = true;
    $("mbMsBtn").disabled = true;
    say("Opening Microsoft's sign-in page…");
    var leaving = false;
    call("POST", "/api/mailbox/microsoft/start", {}).then(function (r) {
      var url = r.body && typeof r.body.authorize_url === "string" ? r.body.authorize_url : "";
      if (!r.ok || url.indexOf(MS_HOST) !== 0) { say((r.body && r.body.error) || MS_NOT_FINISHED, true); return; }
      leaving = true;
      window.location.assign(url);
    }).catch(function () {
      say(online() ? MS_NOT_FINISHED : OFFLINE, true);
    }).then(function () {
      if (leaving) return;
      state.busy = false;
      showMicrosoftAvailability();
    });
  }

  /* Back from Microsoft: ?code and ?state, or ?error. The query is stripped
     with replaceState whatever the answer, before anything is shown. */
  function stripQuery() {
    try { window.history.replaceState(null, "", "/mailbox.html"); } catch (e) { /* nothing to strip */ }
  }
  function handleReturn() {
    var q;
    try { q = new URLSearchParams(window.location.search || ""); } catch (e) { return false; }
    var code = q.get("code"), returned = q.get("state"), error = q.get("error");
    if (!code && !returned && !error) return false;
    if (error || !code || !returned) {
      stripQuery();
      say(error === "access_denied" ? MS_CANCELLED : MS_NOT_FINISHED, true);
      return false;
    }
    if (!online()) { stripQuery(); say(OFFLINE, true); return false; }
    state.busy = true;
    say("Finishing the Microsoft sign-in…");
    call("POST", "/api/mailbox/microsoft/finish", { code: code, state: returned }).then(function (r) {
      return r;
    }, function () {
      return null;
    }).then(function (r) {
      stripQuery();
      state.busy = false;
      if (r && r.ok) { say("Connected."); render(r.body); return; }
      say(r ? ((r.body && r.body.error) || MS_NOT_FINISHED) : (online() ? MS_NOT_FINISHED : OFFLINE), true);
      loadStatus();
    });
    code = null;
    returned = null;
    return true;
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
    showMicrosoftAvailability();
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
      $("mbConnectedNote").textContent = reconnectText(s.email_address || "your mailbox", s.provider);
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
      state.openUid = uid;
      resetReply();
      $("mbInbox").hidden = true;
      $("mbMessage").hidden = false;
      say("");
    }).catch(function () {
      say(online() ? "The message could not be opened." : OFFLINE, true);
    }).then(function () {
      state.busy = false;
    });
  }

  /* ── a reply to the open message ── */
  function replySay(text, isError) {
    var s = $("mbReplyStatus");
    s.textContent = text || "";
    s.className = "mb-status" + (isError ? " err" : "");
  }
  function resetReply() {
    state.taskId = null;
    $("mbDraft").hidden = true;
    $("mbDraftText").textContent = "";
    $("mbDraftCount").textContent = "";
    $("mbFiled").hidden = true;
    $("mbDraftBtn").hidden = false;
    $("mbDraftBtn").disabled = false;
    replySay("");
  }
  function countText(n) { return n + (n === 1 ? " character" : " characters"); }

  function draftReply() {
    if (state.busy || !state.openUid) return;
    if (!online()) { replySay(OFFLINE); return; }
    state.busy = true;
    state.taskId = null;
    $("mbDraftBtn").disabled = true;
    $("mbRedraftBtn").disabled = true;
    $("mbFileBtn").disabled = true;
    $("mbFiled").hidden = true;
    replySay("Drafting a reply…");
    call("POST", "/api/mailbox/inbox/" + encodeURIComponent(String(state.openUid)) + "/draft-reply", {}).then(function (r) {
      if (!r.ok) { replySay((r.body && r.body.error) || "The reply could not be drafted.", true); return; }
      var reply = typeof r.body.reply === "string" ? r.body.reply : "";
      state.taskId = typeof r.body.task_id === "string" ? r.body.task_id : null;
      $("mbDraftText").textContent = reply;
      $("mbDraftCount").textContent = countText(reply.length);
      $("mbDraft").hidden = false;
      $("mbDraftBtn").hidden = true;
      replySay("");
    }).catch(function () {
      replySay(online() ? "The reply could not be drafted." : OFFLINE, true);
    }).then(function () {
      state.busy = false;
      $("mbDraftBtn").disabled = false;
      $("mbRedraftBtn").disabled = false;
      $("mbFileBtn").disabled = !state.taskId;
    });
  }

  function fileReply() {
    if (state.busy || !state.taskId) return;
    if (!online()) { replySay(OFFLINE); return; }
    state.busy = true;
    $("mbRedraftBtn").disabled = true;
    $("mbFileBtn").disabled = true;
    replySay("Filing the reply…");
    var filed = false;
    call("POST", "/api/mailbox/propose-reply", { task_id: state.taskId }).then(function (r) {
      if (!r.ok) { replySay((r.body && r.body.error) || "The reply could not be filed.", true); return; }
      filed = true;
      state.taskId = null;
      replySay("");
      $("mbFiled").hidden = false;
    }).catch(function () {
      replySay(online() ? "The reply could not be filed." : OFFLINE, true);
    }).then(function () {
      state.busy = false;
      $("mbRedraftBtn").disabled = false;
      $("mbFileBtn").disabled = filed || !state.taskId;
    });
  }

  function back() {
    $("mbMessage").hidden = true;
    $("mbInbox").hidden = false;
  }

  function start() {
    $("mbProvider").addEventListener("change", showProvider);
    $("mbConnectBtn").addEventListener("click", connect);
    $("mbMsBtn").addEventListener("click", signInWithMicrosoft);
    $("mbDisconnectBtn").addEventListener("click", disconnect);
    $("mbShowBtn").addEventListener("click", function () { showInbox(false); });
    $("mbOlderBtn").addEventListener("click", function () { showInbox(true); });
    $("mbBackBtn").addEventListener("click", back);
    $("mbDraftBtn").addEventListener("click", draftReply);
    $("mbRedraftBtn").addEventListener("click", draftReply);
    $("mbFileBtn").addEventListener("click", fileReply);
    window.addEventListener("offline", function () { say(OFFLINE); });
    window.addEventListener("online", function () { if ($("mbStatus").textContent === OFFLINE) { say(""); loadStatus(); } });
    showProvider();
    if (!handleReturn()) loadStatus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

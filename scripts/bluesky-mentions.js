/* ══════════════════════════════════════════════════════════════════════════
   Mentions, on the Social agent's page.

   The card in agents/social.html (#bskyMentions): the Bluesky posts that
   mention, reply to or quote the connected account. Nothing loads when the
   page opens; "Show my mentions" asks GET /api/social/bluesky/mentions once,
   and "Show older" asks again with the cursor it returned. BizForce does not
   store them.

   "Draft a reply" asks POST /api/social/bluesky/mentions/draft-reply with the
   post's address only. A draft shows its text and "N of 300"; "File for
   approval" sends POST /api/social/bluesky/mentions/propose-reply with the
   draft's task id, and the reply is posted only after it is approved on the
   proposals page. "Draft again" asks for a new draft.

   The card shows when the connection's status is connected, or, for the owner
   with no connection, once the route answers posts_as "platform". When the
   connection needs reconnecting it shows the reconnect wording instead.

   Every server and Bluesky string is set with textContent, never as HTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var MAX = 300;
  var REASONS = { mention: "Mentioned you", reply: "Replied to you", quote: "Quoted you" };
  var OFFLINE = "Mentions load when you are back online.";

  function tok() { return localStorage.getItem("bf_token") || ""; }
  function isPlainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function online() { return !(typeof navigator !== "undefined" && navigator.onLine === false); }

  // { ok, status, data, parsed }. A network failure rejects.
  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + tok() } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().then(
        function (d) { return { ok: r.ok, status: r.status, data: d, parsed: true }; },
        function () { return { ok: r.ok, status: r.status, data: {}, parsed: false }; }
      );
    });
  }
  function timeText(iso) {
    if (!iso) return "an unknown time";
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }
  // The server's own words; a 429 adds the time it says to wait until.
  function serverMessage(res) {
    var d = res && res.data;
    var text = (d && typeof d.error === "string" && d.error) || ("HTTP " + (res && res.status));
    if (res && res.status === 429 && d && typeof d.resumes_at === "string" && d.resumes_at) {
      text += " Try again after " + timeText(d.resumes_at) + ".";
    }
    return text;
  }
  function byId(id) { return document.getElementById(id); }
  function show(id, on) { var el = byId(id); if (el) el.hidden = !on; }
  function say(el, text, isError) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "bsky-msg" + (isError ? " err" : "");
  }
  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function button(label, ghost) {
    var b = el("button", "action-btn" + (ghost ? " action-btn--ghost" : ""), label);
    b.type = "button";
    return b;
  }

  var state = { cursor: null, loading: false };

  /* ── showing the card ──────────────────────────────────────────────────── */
  // Called by scripts/bluesky-connect.js whenever it draws the status.
  function statusChanged(st) {
    var s = isPlainObject(st) ? st : {};
    var connected = s.connected === true && s.status === "connected";
    var reconnect = s.status === "needs_reconnect";
    show("bskyMentionsReconnect", reconnect);
    show("bskyMentionsBody", !reconnect);
    if (reconnect) {
      byId("bskyMentionsReconnectText").textContent = "Bluesky stopped accepting the app password saved for " + s.handle +
        ", so nothing is being posted from it. Make a new app password in Bluesky and connect again below.";
    }
    if (connected || reconnect) {
      show("bskyMentions", true);
      return Promise.resolve();
    }
    // Not connected: only the owner, whose posts go out from the platform's
    // account, gets the button; the card stays only if the route answers so.
    clearList();
    return api("GET", "/api/auth/me").then(function (res) {
      var admin = res.ok && res.parsed && isPlainObject(res.data) && isPlainObject(res.data.user) && res.data.user.role === "admin";
      show("bskyMentions", admin);
    }, function () { show("bskyMentions", false); });
  }

  function clearList() {
    var list = byId("bskyMentionsList");
    if (list) list.textContent = "";
    state.cursor = null;
    show("bskyMentionsOlder", false);
  }

  /* ── the inbox ─────────────────────────────────────────────────────────── */
  function load(older) {
    var msg = byId("bskyMentionsMsg");
    if (!online()) { say(msg, OFFLINE, true); return Promise.resolve(false); }
    if (state.loading) return Promise.resolve(false);
    state.loading = true;
    var btn = byId(older ? "bskyMentionsOlder" : "bskyMentionsBtn");
    if (btn) btn.disabled = true;
    say(msg, "Reading your mentions from Bluesky…");
    var path = "/api/social/bluesky/mentions" + (older && state.cursor ? "?cursor=" + encodeURIComponent(state.cursor) : "");
    return api("GET", path).then(function (res) {
      state.loading = false;
      if (btn) btn.disabled = false;
      if (!res.ok || !res.parsed || !isPlainObject(res.data) || !Array.isArray(res.data.items)) {
        say(msg, serverMessage(res), true);
        if (res.status === 403) show("bskyMentions", false);
        return false;
      }
      var d = res.data;
      if (d.posts_as !== "member" && d.posts_as !== "platform") {
        say(msg, "The answer did not say which account it read. Nothing is shown.", true);
        return false;
      }
      show("bskyMentions", true);
      if (!older) clearList();
      var list = byId("bskyMentionsList");
      d.items.forEach(function (item) { if (isPlainObject(item)) list.appendChild(drawItem(item)); });
      state.cursor = typeof d.cursor === "string" && d.cursor ? d.cursor : null;
      show("bskyMentionsOlder", Boolean(state.cursor));
      var shown = list.children.length;
      say(msg, shown ? (d.posts_as === "platform" ? "From the platform's Bluesky account." : "") : "No mentions, replies or quotes yet.");
      return true;
    }, function (err) {
      state.loading = false;
      if (btn) btn.disabled = false;
      say(msg, online() ? "Your mentions could not be read: " + ((err && err.message) || "network error") + "." : OFFLINE, true);
      return false;
    });
  }

  function drawItem(item) {
    var li = el("li", "bsky-mention");
    var author = isPlainObject(item.author) ? item.author : {};
    var head = el("p", "bsky-quiet");
    head.appendChild(el("span", "bsky-connected-as", REASONS[item.reason] || ""));
    head.appendChild(document.createTextNode(" "));
    var who = (typeof author.displayName === "string" && author.displayName ? author.displayName + " " : "") +
      (typeof author.handle === "string" && author.handle ? "@" + author.handle : "");
    head.appendChild(el("span", "", who));
    head.appendChild(document.createTextNode(" · " + timeText(item.indexed_at)));
    li.appendChild(head);
    li.appendChild(el("p", "bsky-mention-text", typeof item.text === "string" ? item.text : ""));
    var row = el("div", "bsky-row");
    if (typeof item.link === "string" && /^https:\/\/bsky\.app\/profile\//.test(item.link)) {
      var a = el("a", "", "Open on Bluesky");
      a.href = item.link;
      a.target = "_blank";
      a.rel = "noopener";
      row.appendChild(a);
    }
    var draftBtn = button("Draft a reply", true);
    row.appendChild(draftBtn);
    li.appendChild(row);
    var box = el("div", "bsky-sub");
    box.hidden = true;
    li.appendChild(box);
    draftBtn.addEventListener("click", function () { draft(item.uri, box, draftBtn); });
    return li;
  }

  /* ── a reply ───────────────────────────────────────────────────────────── */
  function draft(uri, box, draftBtn) {
    box.hidden = false;
    box.textContent = "";
    var msg = el("div", "bsky-msg");
    box.appendChild(msg);
    if (!online()) { say(msg, OFFLINE, true); return Promise.resolve(false); }
    if (draftBtn) draftBtn.disabled = true;
    say(msg, "Drafting a reply…");
    return api("POST", "/api/social/bluesky/mentions/draft-reply", { uri: uri }).then(function (res) {
      if (draftBtn) draftBtn.disabled = false;
      if (!res.ok || !res.parsed || !isPlainObject(res.data) || typeof res.data.reply !== "string") {
        say(msg, serverMessage(res), true);
        return false;
      }
      drawDraft(uri, box, res.data, draftBtn);
      return true;
    }, function (err) {
      if (draftBtn) draftBtn.disabled = false;
      say(msg, online() ? "No reply was drafted: " + ((err && err.message) || "network error") + "." : OFFLINE, true);
      return false;
    });
  }

  function drawDraft(uri, box, d, draftBtn) {
    box.textContent = "";
    box.appendChild(el("p", "bsky-reply-text", d.reply));
    var graphemes = typeof d.graphemes === "number" ? d.graphemes : null;
    box.appendChild(el("p", "bsky-quiet", (graphemes === null ? "?" : String(graphemes)) + " of " + (typeof d.max === "number" ? d.max : MAX)));
    var row = el("div", "bsky-row");
    var fileBtn = button("File for approval", false);
    var againBtn = button("Draft again", true);
    row.appendChild(fileBtn);
    row.appendChild(againBtn);
    box.appendChild(row);
    var msg = el("div", "bsky-msg");
    box.appendChild(msg);
    againBtn.addEventListener("click", function () { draft(uri, box, draftBtn); });
    fileBtn.addEventListener("click", function () { file(d.task_id, row, msg); });
  }

  function file(taskId, row, msg) {
    if (!online()) { say(msg, OFFLINE, true); return Promise.resolve(false); }
    var buttons = row.querySelectorAll("button");
    Array.prototype.forEach.call(buttons, function (b) { b.disabled = true; });
    say(msg, "Filing…");
    return api("POST", "/api/social/bluesky/mentions/propose-reply", { task_id: taskId }).then(function (res) {
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
        say(msg, serverMessage(res), true);
        return false;
      }
      row.textContent = "";
      msg.textContent = "Filed. Approve it on the ";
      msg.className = "bsky-msg";
      var link = el("a", "", "Proposals page");
      link.href = "/proposals.html";
      msg.appendChild(link);
      msg.appendChild(document.createTextNode("."));
      return true;
    }, function (err) {
      Array.prototype.forEach.call(buttons, function (b) { b.disabled = false; });
      say(msg, online() ? "That could not be filed: " + ((err && err.message) || "network error") + "." : OFFLINE, true);
      return false;
    });
  }

  function mount() {
    if (!byId("bskyMentions")) return;
    var b = byId("bskyMentionsBtn"); if (b) b.addEventListener("click", function () { load(false); });
    var o = byId("bskyMentionsOlder"); if (o) o.addEventListener("click", function () { load(true); });
    if (!online()) say(byId("bskyMentionsMsg"), OFFLINE, true);
  }

  // For scripts/checkBlueskyMentions.js in the backend repo, and for
  // scripts/bluesky-connect.js, which tells this card the status it drew.
  window.bfBlueskyMentions = { statusChanged: statusChanged, load: load, draft: draft, file: file, mount: mount };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

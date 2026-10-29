/* ══════════════════════════════════════════════════════════════════════════
   Connect Bluesky, on the Social agent's page.

   The card in agents/social.html (#bskyConnect). A member connects their OWN
   Bluesky account with an app password made in Bluesky; posts they file then
   go out from it, through the proposals page, or at once when they turn on
   "Post approved drafts automatically". Profile edits always wait for approval.

   The server is the only source of truth: GET /api/social/bluesky/status
   (connected, handle, status, since) and GET /api/social/bluesky/automation.
   The app password is sent once, to POST /api/social/bluesky/connect, and the
   field is cleared whatever the answer; it is never stored here, never read
   back and never shown. Every server message is shown as the server wrote it,
   with textContent.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";

  function tok() { return localStorage.getItem("bf_token") || ""; }
  function isPlainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

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
  function serverMessage(res) {
    return (res && res.data && typeof res.data.error === "string" && res.data.error) || ("HTTP " + (res && res.status));
  }
  function byId(id) { return document.getElementById(id); }
  function show(id, on) { var el = byId(id); if (el) el.hidden = !on; }
  function say(id, text, isError) {
    var el = byId(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "bsky-msg" + (isError ? " err" : "");
  }
  function dateText(iso) {
    if (!iso) return "an unknown date";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return String(iso); }
  }
  function timeText(iso) {
    if (!iso) return "an unknown time";
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  // Filing under a Bluesky result asks who it posts as; a change here must be seen there.
  function accountChanged() {
    if (window.bfSocialPublish && typeof window.bfSocialPublish.forgetAccount === "function") window.bfSocialPublish.forgetAccount();
  }

  /* ── the card's state ──────────────────────────────────────────────────── */
  // One of: the form (not connected), connected, or needs reconnecting (the
  // form again, with the handle and Disconnect).
  function drawStatus(st) {
    var connected = st.connected === true && st.status === "connected";
    var reconnect = st.status === "needs_reconnect";
    show("bskyForm", !connected);
    show("bskyConnected", connected);
    show("bskyReconnect", reconnect);
    show("bskyDisconnectBtn", connected || reconnect);
    show("bskyAutomation", connected);
    show("bskyProfile", connected);
    if (connected) {
      byId("bskyConnectedAs").textContent = "Connected as " + st.handle;
      byId("bskySince").textContent = "since " + dateText(st.since);
    }
    if (reconnect) {
      byId("bskyReconnectText").textContent = "Bluesky stopped accepting the app password saved for " + st.handle +
        ", so nothing is being posted from it. Make a new app password in Bluesky and connect again below.";
    }
    if (connected) return loadAutomation();
    return Promise.resolve();
  }

  function loadStatus() {
    say("bskyStatusMsg", "Checking your Bluesky connection…");
    return api("GET", "/api/social/bluesky/status").then(function (res) {
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        say("bskyStatusMsg", "Your Bluesky connection could not be checked — reload to try again. (" + serverMessage(res) + ")", true);
        return;
      }
      say("bskyStatusMsg", "");
      return drawStatus(res.data);
    }, function (err) {
      say("bskyStatusMsg", "Your Bluesky connection could not be checked — reload to try again. (" + ((err && err.message) || "network error") + ")", true);
    });
  }

  /* ── connect and disconnect ────────────────────────────────────────────── */
  function connect() {
    var handleEl = byId("bskyHandle"), passEl = byId("bskyAppPassword"), btn = byId("bskyConnectBtn");
    var handle = handleEl ? handleEl.value : "";
    var appPassword = passEl ? passEl.value : "";
    // Sent once and cleared at once, whatever the answer.
    if (passEl) passEl.value = "";
    if (btn) btn.disabled = true;
    say("bskyConnectMsg", "Checking with Bluesky…");
    return api("POST", "/api/social/bluesky/connect", { handle: handle, app_password: appPassword }).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        say("bskyConnectMsg", serverMessage(res), true);
        return false;
      }
      say("bskyConnectMsg", "");
      accountChanged();
      return Promise.resolve(drawStatus(res.data)).then(function () { return true; });
    }, function (err) {
      if (btn) btn.disabled = false;
      say("bskyConnectMsg", "Bluesky could not be connected: " + ((err && err.message) || "network error") + ". Nothing was saved.", true);
      return false;
    });
  }

  function disconnect() {
    var btn = byId("bskyDisconnectBtn");
    if (btn) btn.disabled = true;
    say("bskyStatusMsg", "Disconnecting…");
    return api("POST", "/api/social/bluesky/disconnect").then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        say("bskyStatusMsg", serverMessage(res), true);
        return false;
      }
      say("bskyStatusMsg", typeof res.data.note === "string" ? res.data.note : "Disconnected.");
      accountChanged();
      return Promise.resolve(drawStatus(res.data)).then(function () { return true; });
    }, function (err) {
      if (btn) btn.disabled = false;
      say("bskyStatusMsg", "Bluesky could not be disconnected: " + ((err && err.message) || "network error") + ".", true);
      return false;
    });
  }

  /* ── "Post approved drafts automatically" ──────────────────────────────── */
  function drawAutomation(a) {
    var box = byId("bskyAutoPost");
    if (box) box.checked = a.auto_post === true;
    var last = Array.isArray(a.changes) && a.changes.length ? a.changes[0] : null;
    byId("bskyAutoLog").textContent = last
      ? "Turned " + (last.new_value ? "on" : "off") + " on " + timeText(last.changed_at) + "."
      : "Off since you connected; it has never been turned on.";
  }

  function loadAutomation() {
    return api("GET", "/api/social/bluesky/automation").then(function (res) {
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        say("bskyAutoMsg", "The automation setting could not be read — reload to try again. (" + serverMessage(res) + ")", true);
        var box = byId("bskyAutoPost");
        if (box) box.disabled = true;
        return;
      }
      var b = byId("bskyAutoPost");
      if (b) b.disabled = false;
      say("bskyAutoMsg", "");
      drawAutomation(res.data);
    }, function (err) {
      say("bskyAutoMsg", "The automation setting could not be read: " + ((err && err.message) || "network error") + ".", true);
    });
  }

  function setAutomation(on) {
    var box = byId("bskyAutoPost");
    if (box) box.disabled = true;
    say("bskyAutoMsg", "Saving…");
    return api("PUT", "/api/social/bluesky/automation", { auto_post: on }).then(function (res) {
      if (box) box.disabled = false;
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        say("bskyAutoMsg", serverMessage(res), true);
        // The server's answer, not the click, is what the switch shows.
        return loadAutomation().then(function () { return false; });
      }
      say("bskyAutoMsg", res.data.auto_post ? "On: a Bluesky post you file now posts at once, after every screen." : "Off: every post waits for your approval.");
      drawAutomation(res.data);
      accountChanged();
      return true;
    }, function (err) {
      if (box) box.disabled = false;
      say("bskyAutoMsg", "The setting could not be saved: " + ((err && err.message) || "network error") + ".", true);
      return loadAutomation().then(function () { return false; });
    });
  }

  /* ── a profile update, filed for approval ──────────────────────────────── */
  function proposeProfile() {
    var nameEl = byId("bskyDisplayName"), descEl = byId("bskyDescription"), btn = byId("bskyProfileBtn");
    var body = {};
    if (nameEl && nameEl.value.trim()) body.display_name = nameEl.value;
    if (descEl && descEl.value.trim()) body.description = descEl.value;
    if (btn) btn.disabled = true;
    say("bskyProfileMsg", "Filing…");
    return api("POST", "/api/social/bluesky/propose-profile", body).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !res.parsed || !isPlainObject(res.data)) {
        say("bskyProfileMsg", serverMessage(res), true);
        return false;
      }
      say("bskyProfileMsg", typeof res.data.note === "string" ? res.data.note : "Filed for approval.");
      show("bskyProfileLink", true);
      return true;
    }, function (err) {
      if (btn) btn.disabled = false;
      say("bskyProfileMsg", "That could not be filed: " + ((err && err.message) || "network error") + ".", true);
      return false;
    });
  }

  function mount() {
    if (!byId("bskyConnect")) return;
    var c = byId("bskyConnectBtn"); if (c) c.addEventListener("click", connect);
    var d = byId("bskyDisconnectBtn"); if (d) d.addEventListener("click", disconnect);
    var a = byId("bskyAutoPost"); if (a) a.addEventListener("change", function () { setAutomation(a.checked === true); });
    var p = byId("bskyProfileBtn"); if (p) p.addEventListener("click", proposeProfile);
    loadStatus();
  }

  // For scripts/checkBlueskyConnect.js in the backend repo, which runs this
  // file in a page. Nothing on the page reads it.
  window.bfBlueskyConnect = {
    loadStatus: loadStatus, connect: connect, disconnect: disconnect, setAutomation: setAutomation,
    loadAutomation: loadAutomation, proposeProfile: proposeProfile, mount: mount
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

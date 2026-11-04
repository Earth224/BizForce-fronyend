/* ══════════════════════════════════════════════════════════════════════════
   Connect Mastodon, on the Social agent's page.

   The card in agents/social.html (#mastoConnect). A member connects their OWN
   Mastodon account by naming their server and pasting a personal access token
   they made there (write:statuses and read:accounts only). Posts they file for
   Mastodon then go out from it, through the proposals page, or at once when
   they turn on "Post approved drafts automatically". There is no platform
   Mastodon account behind this card: without a connection, nothing posts.

   The server is the only source of truth: GET /api/social/mastodon/status
   (connected, account, status, since, max_characters) and
   GET /api/social/mastodon/automation. The token is sent once, to
   POST /api/social/mastodon/connect, and the field is cleared whatever the
   answer; it is never stored here, never read back and never shown. Every
   server message is shown as the server wrote it, with textContent.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";

  function tok() { return localStorage.getItem("bf_token") || ""; }
  function plainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }

  // { ok, status, data, parsed }. A network failure rejects.
  function call(method, path, body) {
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
  function errorOf(res) {
    return (res && res.data && typeof res.data.error === "string" && res.data.error) || ("HTTP " + (res && res.status));
  }
  function el(id) { return document.getElementById(id); }
  function showIf(id, on) { var node = el(id); if (node) node.hidden = !on; }
  function tell(id, text, isError) {
    var node = el(id);
    if (!node) return;
    node.textContent = text || "";
    node.className = "bsky-msg" + (isError ? " err" : "");
  }
  function dayText(iso) {
    if (!iso) return "an unknown date";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return String(iso); }
  }
  function momentText(iso) {
    if (!iso) return "an unknown time";
    try { return new Date(iso).toLocaleString(); } catch (e) { return String(iso); }
  }

  // Filing under a Mastodon result asks which account it posts as; a change here must be seen there.
  function mastodonAccountChanged() {
    if (window.bfSocialPublish && typeof window.bfSocialPublish.forgetMastodonAccount === "function") window.bfSocialPublish.forgetMastodonAccount();
  }

  /* ── the card's state ──────────────────────────────────────────────────── */
  function drawMastodon(st) {
    var connected = st.connected === true && st.status === "connected";
    var reconnect = st.status === "needs_reconnect";
    showIf("mastoForm", !connected);
    showIf("mastoConnected", connected);
    showIf("mastoReconnect", reconnect);
    showIf("mastoDisconnectBtn", connected || reconnect);
    showIf("mastoAutomation", connected);
    var account = typeof st.account === "string" ? st.account : "";
    if (connected) {
      el("mastoConnectedAs").textContent = "Connected as " + account;
      el("mastoSince").textContent = "since " + dayText(st.since);
      el("mastoLimit").textContent = typeof st.max_characters === "number"
        ? "Posts up to " + st.max_characters + " characters, each link counted as at least the length your server reserves for one."
        : "";
    }
    if (reconnect) {
      el("mastoReconnectText").textContent = "Mastodon stopped accepting the token saved for " + account +
        ", so nothing is being posted from it. Make a new token and connect again below.";
    }
    if (connected) return loadMastodonAutomation();
    return Promise.resolve();
  }

  function loadMastodonStatus() {
    tell("mastoStatusMsg", "Checking your Mastodon connection…");
    return call("GET", "/api/social/mastodon/status").then(function (res) {
      if (!res.ok || !res.parsed || !plainObject(res.data)) {
        tell("mastoStatusMsg", "Your Mastodon connection could not be checked. Reload to try again. (" + errorOf(res) + ")", true);
        return;
      }
      tell("mastoStatusMsg", "");
      return drawMastodon(res.data);
    }, function (err) {
      tell("mastoStatusMsg", "Your Mastodon connection could not be checked. Reload to try again. (" + ((err && err.message) || "network error") + ")", true);
    });
  }

  /* ── connect and disconnect ────────────────────────────────────────────── */
  function connectMastodon() {
    var hostEl = el("mastoInstance"), tokenEl = el("mastoToken"), btn = el("mastoConnectBtn");
    var instance = hostEl ? hostEl.value : "";
    var accessToken = tokenEl ? tokenEl.value : "";
    // Sent once and cleared at once, whatever the answer.
    if (tokenEl) tokenEl.value = "";
    if (btn) btn.disabled = true;
    tell("mastoConnectMsg", "Checking with your Mastodon server…");
    var sent = call("POST", "/api/social/mastodon/connect", { instance: instance, access_token: accessToken });
    accessToken = "";
    return sent.then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !res.parsed || !plainObject(res.data)) {
        tell("mastoConnectMsg", errorOf(res), true);
        return false;
      }
      tell("mastoConnectMsg", "");
      mastodonAccountChanged();
      return Promise.resolve(drawMastodon(res.data)).then(function () { return true; });
    }, function (err) {
      if (btn) btn.disabled = false;
      tell("mastoConnectMsg", "Mastodon could not be connected: " + ((err && err.message) || "network error") + ". Nothing was saved.", true);
      return false;
    });
  }

  function disconnectMastodon() {
    var btn = el("mastoDisconnectBtn");
    if (btn) btn.disabled = true;
    tell("mastoStatusMsg", "Disconnecting…");
    return call("POST", "/api/social/mastodon/disconnect").then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !res.parsed || !plainObject(res.data)) {
        tell("mastoStatusMsg", errorOf(res), true);
        return false;
      }
      tell("mastoStatusMsg", typeof res.data.note === "string" ? res.data.note : "Disconnected.");
      mastodonAccountChanged();
      return Promise.resolve(drawMastodon(res.data)).then(function () { return true; });
    }, function (err) {
      if (btn) btn.disabled = false;
      tell("mastoStatusMsg", "Mastodon could not be disconnected: " + ((err && err.message) || "network error") + ".", true);
      return false;
    });
  }

  /* ── "Post approved drafts automatically" ──────────────────────────────── */
  function drawMastodonAutomation(a) {
    var box = el("mastoAutoPost");
    if (box) box.checked = a.auto_post === true;
    var latest = Array.isArray(a.changes) && a.changes.length ? a.changes[0] : null;
    el("mastoAutoLog").textContent = latest
      ? "Turned " + (latest.new_value ? "on" : "off") + " on " + momentText(latest.changed_at) + "."
      : "Off since you connected; it has never been turned on.";
  }

  function loadMastodonAutomation() {
    return call("GET", "/api/social/mastodon/automation").then(function (res) {
      var box = el("mastoAutoPost");
      if (!res.ok || !res.parsed || !plainObject(res.data)) {
        tell("mastoAutoMsg", "The automation setting could not be read. Reload to try again. (" + errorOf(res) + ")", true);
        if (box) box.disabled = true;
        return;
      }
      if (box) box.disabled = false;
      tell("mastoAutoMsg", "");
      drawMastodonAutomation(res.data);
    }, function (err) {
      tell("mastoAutoMsg", "The automation setting could not be read: " + ((err && err.message) || "network error") + ".", true);
    });
  }

  function setMastodonAutomation(on) {
    var box = el("mastoAutoPost");
    if (box) box.disabled = true;
    tell("mastoAutoMsg", "Saving…");
    return call("PUT", "/api/social/mastodon/automation", { auto_post: on }).then(function (res) {
      if (box) box.disabled = false;
      if (!res.ok || !res.parsed || !plainObject(res.data)) {
        tell("mastoAutoMsg", errorOf(res), true);
        // The server's answer, not the click, is what the switch shows.
        return loadMastodonAutomation().then(function () { return false; });
      }
      tell("mastoAutoMsg", res.data.auto_post ? "On: a Mastodon post you file now posts at once, after every screen." : "Off: every Mastodon post waits for your approval.");
      drawMastodonAutomation(res.data);
      mastodonAccountChanged();
      return true;
    }, function (err) {
      if (box) box.disabled = false;
      tell("mastoAutoMsg", "The setting could not be saved: " + ((err && err.message) || "network error") + ".", true);
      return loadMastodonAutomation().then(function () { return false; });
    });
  }

  function mountMastodon() {
    if (!el("mastoConnect")) return;
    var c = el("mastoConnectBtn"); if (c) c.addEventListener("click", connectMastodon);
    var d = el("mastoDisconnectBtn"); if (d) d.addEventListener("click", disconnectMastodon);
    var a = el("mastoAutoPost"); if (a) a.addEventListener("change", function () { setMastodonAutomation(a.checked === true); });
    loadMastodonStatus();
  }

  // For scripts/checkMastodonConnect.js in the backend repo, which runs this
  // file in a page. Nothing on the page reads it.
  window.bfMastodonConnect = {
    loadStatus: loadMastodonStatus, connect: connectMastodon, disconnect: disconnectMastodon, setAutomation: setMastodonAutomation,
    loadAutomation: loadMastodonAutomation, mount: mountMastodon
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountMastodon);
  else mountMastodon();
})();

/* ══════════════════════════════════════════════════════════════════════════
   TikTok, on the Social agent's page (#ttConnect in agents/social.html).

   Connect TikTok: POST /api/tiktok/start names TikTok's page to go to (it
   must be https://www.tiktok.com/v2/auth/authorize/). Before leaving, the
   page sets sessionStorage "bf_oauth_return" to "tiktok": TikTok and Google
   both send the browser back to this page, and only the script the marker
   names handles ?code and ?state (scripts/youtube.js handles a return with
   no marker). The page POSTs both to POST /api/tiktok/finish as the
   signed-in member, clears the marker, and strips the query with
   history.replaceState WHATEVER the answer.

   Posting: the videos are the ones in "Your videos" (scripts/youtube.js
   draws the list and calls window.BFTikTok.decorate for each). A video whose
   file is here and that isn't on TikTok gets "Prepare TikTok post", which
   reads GET /api/tiktok/creator-info live and follows TikTok's rules:
     - the account's nickname is shown;
     - who can see it comes from TikTok's options, with NO default;
     - Allow comments, Allow duet and Allow stitch start unchecked, and are
       disabled, "Turned off in your TikTok settings", when the account
       turned them off;
     - "Disclose video content" starts off; on, it needs "Your brand",
       "Branded content" or both, and branded content can't be private;
     - the label and consent lines change with those choices, word for word.
   The server checks the same rules again when it files the post and again
   before it sends it. Nothing reaches TikTok until the member approves the
   proposal. There is no remove: "To remove a TikTok post, delete it in the
   TikTok app."

   The server is the only source of truth, and every server message is shown
   as it wrote it, with textContent. Nothing here uses innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var PAGE_PATH = "/agents/social.html";
  var AUTH_PREFIX = "https://www.tiktok.com/v2/auth/authorize/";
  var POST_URL_RE = /^https:\/\/www\.tiktok\.com\/player\/v1\/[0-9]{1,64}$/;
  var CAPTION_MAX = 2200;
  var RETURN_KEY = "bf_oauth_return";
  var NOT_SET_UP = "TikTok connection isn't set up yet.";
  var CANCELLED = "You cancelled the TikTok sign-in.";
  var NOT_FINISHED = "TikTok sign-in didn't finish. Try again.";
  var TURNED_OFF = "Turned off in your TikTok settings";
  var BRANDED_PRIVATE = "Branded content can't be private.";
  var PROMOTIONAL = "Your video will be labeled 'Promotional content'.";
  var PAID = "Your video will be labeled 'Paid partnership'.";
  var CONSENT = "By posting, you agree to TikTok's Music Usage Confirmation.";
  var CONSENT_BRANDED = "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation.";
  var SELF_ONLY = "SELF_ONLY";
  var state = { available: false, connected: false };

  function tok() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function plainObject(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function el(id) { return document.getElementById(id); }
  function showIf(id, on) { var node = el(id); if (node) node.hidden = !on; }
  function tell(id, text, isError) {
    var node = el(id);
    if (!node) return;
    node.textContent = text || "";
    node.className = "bsky-msg" + (isError ? " err" : "");
  }
  function make(tag, text, cls) {
    var node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }
  // { ok, status, data }. A network failure rejects.
  function call(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + tok() } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().then(
        function (d) { return { ok: r.ok, status: r.status, data: plainObject(d) ? d : {} }; },
        function () { return { ok: r.ok, status: r.status, data: {} }; }
      );
    });
  }
  function errorOf(res) {
    return (res && res.data && typeof res.data.error === "string" && res.data.error) || ("HTTP " + (res && res.status));
  }
  function dayText(iso) {
    if (!iso) return "an unknown date";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); } catch (e) { return String(iso); }
  }
  function videos() { return window.BFVideos && typeof window.BFVideos.reload === "function" ? window.BFVideos : null; }

  /* ── the connection ────────────────────────────────────────────────────── */
  function drawStatus(st) {
    state.available = st.tiktok_available === true;
    state.connected = st.connected === true && st.status === "connected";
    var reconnect = st.status === "needs_reconnect";
    showIf("ttUnavailable", !state.available);
    var btn = el("ttConnectBtn");
    if (btn) {
      btn.disabled = !state.available;
      btn.hidden = state.connected;
      btn.textContent = reconnect ? "Connect TikTok again" : "Connect TikTok";
    }
    showIf("ttConnected", state.connected);
    showIf("ttReconnect", reconnect);
    showIf("ttDisconnectBtn", state.connected || reconnect);
    if (state.connected) {
      el("ttName").textContent = "Connected to " + (typeof st.display_name === "string" ? st.display_name : "your TikTok account");
      el("ttSince").textContent = "since " + dayText(st.since);
    }
    if (reconnect) {
      el("ttReconnectText").textContent = typeof st.reconnect_message === "string" ? st.reconnect_message :
        "TikTok stopped accepting BizForce's access to your account, so nothing is being posted. Connect again.";
    }
    var v = videos();
    if (v) { v.setTiktokAvailable(state.available); v.reload(); }
  }

  function loadStatus() {
    tell("ttStatusMsg", "Checking your TikTok connection…");
    return call("GET", "/api/tiktok/status").then(function (res) {
      if (!res.ok) { tell("ttStatusMsg", "Your TikTok connection could not be checked. Reload to try again. (" + errorOf(res) + ")", true); return; }
      tell("ttStatusMsg", "");
      drawStatus(res.data);
    }, function () {
      tell("ttStatusMsg", "Your TikTok connection could not be checked. Reload to try again.", true);
    });
  }

  function connect() {
    if (!state.available) { tell("ttConnectMsg", NOT_SET_UP, true); return; }
    var btn = el("ttConnectBtn");
    if (btn) btn.disabled = true;
    tell("ttConnectMsg", "Opening TikTok…");
    call("POST", "/api/tiktok/start", {}).then(function (res) {
      var url = res.data && res.data.authorize_url;
      if (res.ok && typeof url === "string" && url.indexOf(AUTH_PREFIX) === 0) {
        try { sessionStorage.setItem(RETURN_KEY, "tiktok"); } catch (e) { /* the return then asks to start again */ }
        window.location.assign(url);
        return;
      }
      if (btn) btn.disabled = false;
      tell("ttConnectMsg", res.ok ? NOT_FINISHED : errorOf(res), true);
    }, function () {
      if (btn) btn.disabled = false;
      tell("ttConnectMsg", NOT_FINISHED, true);
    });
  }

  function disconnect() {
    var btn = el("ttDisconnectBtn");
    if (btn) btn.disabled = true;
    call("POST", "/api/tiktok/disconnect", {}).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("ttConnectMsg", errorOf(res), true); return; }
      tell("ttConnectMsg", typeof res.data.note === "string" ? res.data.note : "Disconnected.");
      drawStatus(res.data);
    }, function () {
      if (btn) btn.disabled = false;
      tell("ttConnectMsg", "Disconnecting didn't finish. Try again.", true);
    });
  }

  /* Back from TikTok, only when the marker says so. The query is stripped
     with replaceState whatever the answer. */
  function stripQuery() {
    try { window.history.replaceState(null, "", PAGE_PATH); } catch (e) { /* nothing to strip */ }
  }
  function handleReturn() {
    var q;
    try { q = new URLSearchParams(window.location.search || ""); } catch (e) { return false; }
    var code = q.get("code"), returned = q.get("state"), error = q.get("error");
    if (!code && !returned && !error) return false;
    var which = null;
    try { which = sessionStorage.getItem(RETURN_KEY); } catch (e) { which = null; }
    // Not TikTok's return: scripts/youtube.js handles it, and a return with no marker.
    if (which !== "tiktok") return false;
    try { sessionStorage.removeItem(RETURN_KEY); } catch (e) { /* nothing stored */ }
    if (error || !code || !returned) {
      stripQuery();
      tell("ttConnectMsg", error === "access_denied" ? CANCELLED : NOT_FINISHED, true);
      return false;
    }
    tell("ttConnectMsg", "Finishing the TikTok sign-in…");
    call("POST", "/api/tiktok/finish", { code: code, state: returned }).then(function (res) {
      return res;
    }, function () {
      return null;
    }).then(function (res) {
      stripQuery();
      if (res && res.ok) { tell("ttConnectMsg", "Connected."); drawStatus(res.data); return; }
      tell("ttConnectMsg", res ? errorOf(res) : NOT_FINISHED, true);
      loadStatus();
    });
    return true;
  }

  /* ── one video's TikTok side ───────────────────────────────────────────── */
  function statusWord(v) {
    if (v.tiktok_status === "posted") return "TikTok: posted";
    if (v.tiktok_status === "processing") return "TikTok: processing";
    if (v.tiktok_upload_unfinished) return "TikTok: upload unfinished";
    if (v.tiktok_status === "failed") return "TikTok: not posted";
    return "TikTok: not sent";
  }

  function decorate(li, v, msg) {
    var box = make("div", null, "bsky-sub");
    box.appendChild(make("p", statusWord(v), "bsky-quiet"));
    var row = make("div", null, "bsky-row");
    if (v.tiktok_status === "posted" && typeof v.tiktok_post_url === "string" && POST_URL_RE.test(v.tiktok_post_url)) {
      var link = make("a", v.tiktok_post_url, "masto-post-link");
      link.href = v.tiktok_post_url;
      link.target = "_blank";
      link.rel = "noopener";
      box.appendChild(link);
    }
    if (v.tiktok_status === "posted") box.appendChild(make("p", "To remove a TikTok post, delete it in the TikTok app.", "bsky-quiet"));
    if (v.tiktok_status === "initiated" || v.tiktok_status === "processing" || v.tiktok_status === "posted") {
      var check = make("button", "Check TikTok status", "action-btn action-btn--ghost");
      check.type = "button";
      row.appendChild(check);
      check.addEventListener("click", function () {
        check.disabled = true;
        call("GET", "/api/tiktok/videos/" + encodeURIComponent(v.id) + "/status").then(function (res) {
          check.disabled = false;
          if (!res.ok) { msg.textContent = errorOf(res); return; }
          var d = res.data;
          msg.textContent = "TikTok: " + (d.tiktok_status || "unknown") + (d.fail_reason ? " (" + d.fail_reason + ")" : "") + ".";
          var list = videos();
          if (list && d.tiktok_status !== v.tiktok_status) list.reload();
        }, function () { check.disabled = false; msg.textContent = "The status couldn't be checked. Try again."; });
      });
    }
    var form = null;
    if (v.status === "ready" && v.tiktok_status !== "posted" && v.tiktok_status !== "processing" && state.connected) {
      var prepare = make("button", "Prepare TikTok post", "action-btn");
      prepare.type = "button";
      row.appendChild(prepare);
      prepare.addEventListener("click", function () {
        if (form) { form.hidden = !form.hidden; return; }
        prepare.disabled = true;
        msg.textContent = "Asking TikTok what your account allows…";
        call("GET", "/api/tiktok/creator-info").then(function (res) {
          prepare.disabled = false;
          if (!res.ok) { msg.textContent = errorOf(res); return; }
          msg.textContent = "";
          form = postForm(v, res.data, msg);
          box.appendChild(form);
        }, function () { prepare.disabled = false; msg.textContent = "TikTok couldn't be asked just now. Try again."; });
      });
    }
    if (row.firstChild) box.appendChild(row);
    li.insertBefore(box, msg);
  }

  function field(labelText, control) {
    var label = make("label", labelText);
    label.appendChild(control);
    return label;
  }
  function checkbox(labelText) {
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = false;
    var label = make("label", null);
    label.appendChild(input);
    label.appendChild(document.createTextNode(" " + labelText));
    return { input: input, label: label };
  }

  function postForm(v, info, msg) {
    var box = make("div", null, "bsky-sub");
    var words = plainObject(info.privacy_words) ? info.privacy_words : {};
    var options = Array.isArray(info.privacy_level_options) ? info.privacy_level_options.filter(function (o) { return typeof o === "string"; }) : [];
    box.appendChild(make("p", "Posting as " + (typeof info.creator_nickname === "string" ? info.creator_nickname : "your TikTok account"), "bsky-connected-as"));
    box.appendChild(make("p", "Until TikTok reviews BizForce, TikTok keeps posts from BizForce visible only to you.", "bsky-quiet"));

    var caption = document.createElement("textarea");
    caption.rows = 4;
    var count = make("span", "0 of " + CAPTION_MAX, "bsky-quiet");
    var idea = document.createElement("textarea");
    idea.rows = 2; idea.maxLength = 1000; idea.placeholder = "What is the video about?";

    // Who can see it: TikTok's options only, and nothing chosen until the member chooses.
    var privacy = document.createElement("select");
    var none = make("option", "Choose who can see it");
    none.value = "";
    none.selected = true;
    privacy.appendChild(none);
    options.forEach(function (o) {
      var opt = make("option", typeof words[o] === "string" ? words[o] : o);
      opt.value = o;
      privacy.appendChild(opt);
    });

    var comment = checkbox("Allow comments");
    var duet = checkbox("Allow duet");
    var stitch = checkbox("Allow stitch");
    [[comment, info.comment_disabled], [duet, info.duet_disabled], [stitch, info.stitch_disabled]].forEach(function (pair) {
      if (pair[1] === true) {
        pair[0].input.disabled = true;
        pair[0].label.appendChild(make("span", " (" + TURNED_OFF + ")", "bsky-quiet"));
      }
    });

    var disclose = checkbox("Disclose video content");
    var brands = make("div", null, "bsky-sub");
    brands.hidden = true;
    var yours = checkbox("Your brand");
    var branded = checkbox("Branded content");
    brands.appendChild(yours.label);
    brands.appendChild(branded.label);
    var labelLine = make("p", "", "bsky-quiet");
    labelLine.hidden = true;
    var consent = make("p", CONSENT, "bsky-quiet");

    var fields = make("div", null, "bsky-fields");
    fields.appendChild(field("Caption", caption));
    fields.appendChild(count);
    fields.appendChild(field("Who can see it", privacy));
    box.appendChild(fields);
    box.appendChild(comment.label);
    box.appendChild(duet.label);
    box.appendChild(stitch.label);
    box.appendChild(disclose.label);
    box.appendChild(brands);
    box.appendChild(labelLine);
    box.appendChild(field("What it's about, for the AI draft", idea));
    box.appendChild(consent);

    function redraw() {
      count.textContent = Array.from(caption.value).length + " of " + CAPTION_MAX;
      brands.hidden = !disclose.input.checked;
      if (!disclose.input.checked) { yours.input.checked = false; branded.input.checked = false; }
      var paid = branded.input.checked;
      labelLine.textContent = paid ? PAID : (yours.input.checked ? PROMOTIONAL : "");
      labelLine.hidden = !labelLine.textContent;
      consent.textContent = paid ? CONSENT_BRANDED : CONSENT;
      // Branded content can't be private: "Only you" can't be chosen while it's on.
      for (var i = 0; i < privacy.options.length; i++) {
        if (privacy.options[i].value === SELF_ONLY) privacy.options[i].disabled = paid;
      }
    }
    [caption, privacy, disclose.input, yours.input, branded.input].forEach(function (n) {
      n.addEventListener("input", redraw);
      n.addEventListener("change", redraw);
    });

    var row = make("div", null, "bsky-row");
    var draft = make("button", "Draft with AI", "action-btn action-btn--ghost");
    draft.type = "button";
    var file = make("button", "File for approval", "action-btn");
    file.type = "button";
    row.appendChild(draft);
    row.appendChild(file);
    box.appendChild(row);

    draft.addEventListener("click", function () {
      draft.disabled = true;
      msg.textContent = "Drafting…";
      call("POST", "/api/tiktok/draft-caption", { video_id: v.id, idea: idea.value }).then(function (res) {
        draft.disabled = false;
        if (!res.ok || !plainObject(res.data.draft)) { msg.textContent = errorOf(res); return; }
        caption.value = typeof res.data.draft.caption === "string" ? res.data.draft.caption : "";
        redraw();
        msg.textContent = (res.data.note || "A draft only.") + (res.data.within_limits === false ? " It's over TikTok's limit; shorten it before filing." : "");
      }, function () { draft.disabled = false; msg.textContent = "The draft didn't finish. Try again."; });
    });

    file.addEventListener("click", function () {
      if (!privacy.value) { msg.textContent = "Choose who can see this post."; return; }
      if (disclose.input.checked && !yours.input.checked && !branded.input.checked) { msg.textContent = "Choose Your brand, Branded content, or both."; return; }
      if (branded.input.checked && privacy.value === SELF_ONLY) { msg.textContent = BRANDED_PRIVATE; return; }
      file.disabled = true;
      var body = {
        video_id: v.id,
        caption: caption.value,
        privacy_level: privacy.value,
        allow_comment: comment.input.checked,
        allow_duet: duet.input.checked,
        allow_stitch: stitch.input.checked,
        disclose: disclose.input.checked,
        brand_organic: yours.input.checked,
        brand_content: branded.input.checked
      };
      call("POST", "/api/tiktok/propose-post", body).then(function (res) {
        file.disabled = false;
        msg.textContent = res.ok ? (res.data.note || "Filed for approval.") : errorOf(res);
      }, function () { file.disabled = false; msg.textContent = "Filing didn't finish. Try again."; });
    });
    redraw();
    return box;
  }

  window.BFTikTok = { decorate: decorate };

  function init() {
    var btn = el("ttConnectBtn");
    if (!btn) return;
    btn.addEventListener("click", connect);
    var off = el("ttDisconnectBtn");
    if (off) off.addEventListener("click", disconnect);
    var returning = handleReturn();
    if (!returning) loadStatus();
    else call("GET", "/api/tiktok/status").then(function (res) {
      if (res.ok) {
        state.available = res.data.tiktok_available === true;
        var v = videos();
        if (v) v.setTiktokAvailable(state.available);
        showIf("ttUnavailable", !state.available);
      }
    }, function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

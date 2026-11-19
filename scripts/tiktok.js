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
   NAMED (Nov 7 2026, Instagram posting): the return is read in ONE place,
   scripts/oauth-return.js (loaded first). connect calls
   BFOAuthReturn.mark("tiktok"), and this script registers finishReturn under
   "tiktok"; it no longer reads ?code or ?state itself.

   Posting: the videos are the ones in "Your videos" (scripts/youtube.js
   draws the list; NAMED (Nov 12 2026, Social page clean-up): this script
   registers its side with window.BFVideos.register, BEFORE it was
   window.BFTikTok.decorate). A video whose file is here and that isn't on
   TikTok gets, while TikTok is connected, "Prepare for TikTok" (BEFORE
   "Prepare TikTok post"), which
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
  /* NAMED (Nov 17 2026, TK1), TikTok's content-sharing guidelines (developers.tiktok.com/docs/en/content-sharing-guidelines):
     - the declaration's two names link to TikTok's own pages (MUSIC_URL, BC_URL);
     - "hovering over it will display a prompt stating, "Branded content visibility cannot be set to private."" (PRIVATE_HOVER);
     - "it may take a few minutes for the content to process and be visible on their profile." (PROCESSING);
     - "All user accounts using the API client to post must be set to private at the time of posting." (REVIEWED). */
  var MUSIC_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
  var BC_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";
  var PRIVATE_HOVER = "Branded content visibility cannot be set to private.";
  var PROCESSING = "TikTok may take a few minutes to process this video before it appears on your profile.";
  var REVIEWED = "Until TikTok reviews BizForce, your TikTok account must be set to private, and TikTok keeps posts from BizForce visible only to you.";
  var CHOOSE_DISCLOSURE = "Choose Your brand, Branded content, or both.";
  /* NAMED (Nov 17 2026, TK1): "API clients should poll the publish/status/fetch API". A video TikTok is still processing
     is asked about on its own: one request per video at a time (polls), after 10 s, then 20, 40, 80 and 160 s, stopping
     at the first final answer (posted or failed). "Check TikTok status" stays for any time after. */
  var POLL_DELAYS = [10000, 20000, 40000, 80000, 160000];
  var polls = {};
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
  /* NAMED (Nov 17 2026, TK1): "45 s", "3 min", "2 min 5 s". */
  function lengthText(ms) {
    var total = Math.max(0, Math.round(Number(ms) / 1000));
    var h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60, parts = [];
    if (h) parts.push(h + " h");
    if (m) parts.push(m + " min");
    if (sec || !parts.length) parts.push(sec + " s");
    return parts.join(" ");
  }
  /* NAMED (Nov 17 2026, TK1): "API Clients should display a preview of the to-be-posted content." The member's own file
     from GET /api/videos/:id/preview: muted, with controls, never autoplaying; a deleted file says so. */
  var PREVIEW_START = "Preview shows the start of the video.";
  function preview(v) {
    var wrap = make("div", null, "sf-field tt-preview");
    wrap.appendChild(make("span", "Preview", "sf-label"));
    var note = make("p", "Loading the preview…", "bsky-quiet");
    wrap.appendChild(note);
    call("GET", "/api/videos/" + encodeURIComponent(v.id) + "/preview").then(function (res) {
      if (res.status === 410 || res.status === 404) { note.textContent = "This video's file was deleted, so it can't be previewed or posted."; return; }
      if (!res.ok || typeof res.data.url !== "string" || res.data.url.indexOf("https://") !== 0) {
        note.textContent = (typeof res.data.error === "string" && res.data.error) || "The preview couldn't be opened just now.";
        return;
      }
      var player = document.createElement("video");
      player.controls = true; player.muted = true; player.autoplay = false; player.preload = "metadata";
      player.setAttribute("playsinline", ""); player.setAttribute("muted", "");
      player.setAttribute("style", "display:block;max-width:100%;max-height:360px;border-radius:8px;background:#000");
      player.src = res.data.url;
      note.textContent = "";
      note.hidden = true;
      wrap.appendChild(player);
      // NAMED (Nov 18 2026, BV1): a video over 50 MB is kept as parts and the preview plays the first one, so it says so.
      if (res.data.partial === true) wrap.appendChild(make("p", PREVIEW_START, "bsky-quiet tt-preview-part"));
    }, function () { note.textContent = "The preview couldn't be opened just now."; });
    return wrap;
  }
  /* NAMED (Nov 17 2026, TK1): TikTok's declaration with each name linked to TikTok's own page; built node by node. */
  function declaration(node, branded) {
    while (node.firstChild) node.removeChild(node.firstChild);
    var link = function (text, href) { var a = make("a", text); a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; };
    node.appendChild(document.createTextNode("By posting, you agree to TikTok's "));
    if (branded) { node.appendChild(link("Branded Content Policy", BC_URL)); node.appendChild(document.createTextNode(" and ")); }
    node.appendChild(link("Music Usage Confirmation", MUSIC_URL));
    node.appendChild(document.createTextNode("."));
    node.setAttribute("data-says", branded ? CONSENT_BRANDED : CONSENT);
  }
  /* NAMED (Nov 17 2026, TK1): the status poll for one video (POLL_DELAYS). show(text) writes into the row's message. */
  function poll(v, show) {
    var p = polls[v.id];
    if (p) { p.show = show; if (p.text) show(p.text); return; }
    p = polls[v.id] = { tries: 0, busy: false, done: false, text: "", show: show };
    var say = function (text) { p.text = text; p.show(text); };
    var next = function () {
      if (p.done) return;
      if (p.tries >= POLL_DELAYS.length) { say("TikTok is still processing it. Use Check TikTok status later."); return; }
      setTimeout(ask, POLL_DELAYS[p.tries]);
    };
    var ask = function () {
      if (p.busy || p.done) return;
      p.busy = true; p.tries++;
      call("GET", "/api/tiktok/videos/" + encodeURIComponent(v.id) + "/status").then(function (res) {
        p.busy = false;
        var st = res.ok ? res.data.tiktok_status : null;
        if (st === "posted" || st === "failed") {
          p.done = true;
          say("TikTok: " + st + (res.data.fail_reason ? " (" + res.data.fail_reason + ")" : "") + ".");
          var list = videos();
          if (list) list.reload();
          return;
        }
        say(res.ok ? PROCESSING : errorOf(res));
        next();
      }, function () { p.busy = false; next(); });
    };
    say(PROCESSING);
    next();
  }
  function returns() { return window.BFOAuthReturn || null; }

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
    // NAMED (Nov 12 2026, Social page clean-up): TikTok's chip and buttons show in Your videos only while connected.
    if (v && typeof v.setConnected === "function") v.setConnected("tiktok", state.connected);
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
        if (returns()) returns().mark("tiktok");
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

  /* Back from TikTok: { code, state, error }, handed over by
     scripts/oauth-return.js only when the marker said "tiktok". The query is
     stripped with replaceState whatever the answer. */
  function stripQuery() {
    if (returns()) { returns().strip(); return; }
    try { window.history.replaceState(null, "", PAGE_PATH); } catch (e) { /* nothing to strip */ }
  }
  function finishReturn(answer) {
    var code = answer.code, returned = answer.state, error = answer.error;
    if (error || !code || !returned) {
      stripQuery();
      tell("ttConnectMsg", error === "access_denied" ? CANCELLED : NOT_FINISHED, true);
      return;
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
  }

  /* ── one video's TikTok side ───────────────────────────────────────────────
     NAMED (Nov 12 2026, Social page clean-up): BEFORE decorate() hung a box
     under every row of the list, connected or not ("TikTok: not sent" inside
     the YouTube card). AFTER this side registers with window.BFVideos: a chip
     in the same words, and "Prepare for TikTok" / "Check TikTok status", shown
     only while TikTok is connected. The form opens under the row (one at a
     time) with the header "TikTok post"; its rules are unchanged. */
  // NAMED (Nov 13 2026, S3): a filed post naming the video (GET /api/videos tiktok_proposal): "pending" or "publishing".
  function proposalOf(v) { return v.tiktok_proposal === "pending" || v.tiktok_proposal === "publishing" ? v.tiktok_proposal : null; }
  function statusWord(v) {
    if (v.tiktok_status === "posted") return "TikTok: posted";
    if (v.tiktok_status === "processing") return "TikTok: processing";
    if (proposalOf(v) === "pending") return "TikTok: waiting for your approval";
    if (proposalOf(v) === "publishing") return "TikTok: publishing";
    if (v.tiktok_upload_unfinished) return "TikTok: upload unfinished";
    if (v.tiktok_status === "failed") return "TikTok: not posted";
    return "TikTok: not sent";
  }
  function chipOf(v) {
    var tone = v.tiktok_status === "posted" ? "ok" :
      ((v.tiktok_status === "processing" || proposalOf(v) || v.tiktok_upload_unfinished) ? "wait" : (v.tiktok_status === "failed" ? "bad" : "off"));
    return { text: statusWord(v), tone: tone };
  }

  function actionsOf(v, row) {
    var msg = row.msg;
    if (v.tiktok_status === "posted" && typeof v.tiktok_post_url === "string" && POST_URL_RE.test(v.tiktok_post_url)) row.link(v.tiktok_post_url);
    if (v.tiktok_status === "posted") row.note("To remove a TikTok post, delete it in the TikTok app.");
    /* NAMED (Nov 13 2026, S3): BEFORE a posted or processing video had no TikTok button. AFTER the one button
       follows scripts/youtube.js BUTTON_RULES: processing or a filed post disables it with its reason; posted is
       "Post again on TikTok" (asked first; the filing says repost: true); failed is "Try again on TikTok". An
       upload that never finished stays "Prepare for TikTok" and is sent again as it was started. */
    if (v.status === "ready") {
      var st = proposalOf(v) || (v.tiktok_status === "processing" ? "publishing" :
        (v.tiktok_status === "posted" ? "posted" : (v.tiktok_status === "failed" ? "failed" : "new")));
      row.platform("tiktok", st, "TikTok post", function (shell, repost) {
        shell.msg.textContent = "Asking TikTok what your account allows…";
        call("GET", "/api/tiktok/creator-info").then(function (res) {
          if (!shell.isOpen()) return;
          if (!res.ok) { shell.msg.textContent = errorOf(res); return; }
          shell.msg.textContent = "";
          shell.body.appendChild(postForm(v, res.data, shell.msg, repost));
        }, function () { if (shell.isOpen()) shell.msg.textContent = "TikTok couldn't be asked just now. Try again."; });
      });
    }
    // NAMED (Nov 17 2026, TK1): a video TikTok is still processing is asked about on its own (poll), with the notice.
    if (v.tiktok_status === "processing") poll(v, function (text) { msg.textContent = text; });
    if (v.tiktok_status === "initiated" || v.tiktok_status === "processing" || v.tiktok_status === "posted") {
      var check = row.button("Check TikTok status", true);
      check.addEventListener("click", function () {
        check.disabled = true;
        call("GET", "/api/tiktok/videos/" + encodeURIComponent(v.id) + "/status").then(function (res) {
          check.disabled = false;
          if (!res.ok) { msg.textContent = errorOf(res); return; }
          var d = res.data;
          msg.textContent = "TikTok: " + (d.tiktok_status || "unknown") + (d.fail_reason ? " (" + d.fail_reason + ")" : "") + "." +
            (d.tiktok_status === "processing" ? " " + PROCESSING : "");
          var list = videos();
          if (list && d.tiktok_status !== v.tiktok_status) list.reload();
        }, function () { check.disabled = false; msg.textContent = "The status couldn't be checked. Try again."; });
      });
    }
  }

  /* The shared form style (.sf-control on every control, labels above). */
  var IDEA_LABEL = "Describe the video for the AI writer";
  var IDEA_PLACEHOLDER = "For example: a 30-second clip showing our herbal oil and how to use it";
  var formSeq = 0;
  function control(node) { node.className = "sf-control"; return node; }
  function field(labelText, ctl, id) {
    var wrap = make("div", null, "sf-field");
    var label = make("label", labelText, "sf-label");
    ctl.id = id;
    label.setAttribute("for", id);
    wrap.appendChild(label);
    wrap.appendChild(ctl);
    return wrap;
  }
  function checkbox(labelText) {
    var input = document.createElement("input");
    input.type = "checkbox";
    input.className = "sf-control";
    input.checked = false;
    var label = make("label", null, "sf-check");
    label.appendChild(input);
    label.appendChild(document.createTextNode(" " + labelText));
    return { input: input, label: label };
  }

  // repost: opened by a confirmed "Post again"; only then does the filing say repost: true.
  function postForm(v, info, msg, repost) {
    var box = make("div", null, "sf-form");
    var idp = "tt-" + v.id + "-" + (++formSeq) + "-";
    var words = plainObject(info.privacy_words) ? info.privacy_words : {};
    var options = Array.isArray(info.privacy_level_options) ? info.privacy_level_options.filter(function (o) { return typeof o === "string"; }) : [];
    box.appendChild(make("p", "Posting as " + (typeof info.creator_nickname === "string" ? info.creator_nickname : "your TikTok account"), "bsky-connected-as"));
    // NAMED (Nov 17 2026, TK1): BEFORE visible only to you. AFTER the private-account rule too.
    box.appendChild(make("p", REVIEWED, "bsky-quiet"));
    box.appendChild(preview(v));
    /* NAMED (Nov 17 2026, TK1): "API clients must check if the duration of the to-be-posted video follows the
       max_video_post_duration_sec returned in the creator_info API." Shown here; the server refuses it at filing and approval. */
    var maxSec = typeof info.max_video_post_duration_sec === "number" && info.max_video_post_duration_sec > 0 ? info.max_video_post_duration_sec : null;
    var lengthLine = make("p", "", "bsky-quiet tt-length");
    if (typeof v.duration_ms !== "number") lengthLine.textContent = "BizForce doesn't know this video's length, so TikTok can't be asked to post it. Delete it from Your videos and add it again.";
    else if (maxSec !== null && v.duration_ms > maxSec * 1000) lengthLine.textContent = "This video is " + lengthText(v.duration_ms) + " long, and TikTok lets this account post videos up to " + lengthText(maxSec * 1000) + ".";
    else lengthLine.textContent = "Length " + lengthText(v.duration_ms) + (maxSec !== null ? "; TikTok allows this account up to " + lengthText(maxSec * 1000) + "." : ".");
    box.appendChild(lengthLine);

    var idea = control(document.createElement("textarea"));
    idea.rows = 3; idea.maxLength = 1000; idea.placeholder = IDEA_PLACEHOLDER;
    var caption = control(document.createElement("textarea"));
    caption.rows = 4;
    var count = make("span", "0 of " + CAPTION_MAX, "bsky-quiet");

    // Who can see it: TikTok's options only, and nothing chosen until the member chooses.
    var privacy = control(document.createElement("select"));
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
    var brands = make("div", null, "sf-check-group");
    brands.hidden = true;
    var yours = checkbox("Your brand");
    var branded = checkbox("Branded content");
    brands.appendChild(yours.label);
    brands.appendChild(branded.label);
    var labelLine = make("p", "", "bsky-quiet");
    labelLine.hidden = true;
    var consent = make("p", null, "bsky-quiet tt-declaration");
    declaration(consent, false);

    var helper = field(IDEA_LABEL, idea, idp + "idea");
    var under = make("div", null, "sf-under");
    var draft = make("button", "Draft with AI", "action-btn action-btn--ghost");
    draft.type = "button";
    under.appendChild(draft);
    helper.appendChild(under);
    box.appendChild(helper);
    var capField = field("Caption", caption, idp + "caption");
    capField.appendChild(count);
    box.appendChild(capField);
    box.appendChild(field("Who can see it", privacy, idp + "privacy"));
    var interactions = make("div", null, "sf-check-group");
    interactions.appendChild(comment.label);
    interactions.appendChild(duet.label);
    interactions.appendChild(stitch.label);
    interactions.appendChild(disclose.label);
    box.appendChild(interactions);
    box.appendChild(brands);
    box.appendChild(labelLine);
    box.appendChild(consent);

    function redraw() {
      count.textContent = Array.from(caption.value).length + " of " + CAPTION_MAX;
      brands.hidden = !disclose.input.checked;
      if (!disclose.input.checked) { yours.input.checked = false; branded.input.checked = false; }
      var paid = branded.input.checked;
      labelLine.textContent = paid ? PAID : (yours.input.checked ? PROMOTIONAL : "");
      labelLine.hidden = !labelLine.textContent;
      declaration(consent, paid);
      // Branded content can't be private: "Only you" can't be chosen while it's on.
      // NAMED (Nov 17 2026, TK1): and, disabled, it says why on hover (PRIVATE_HOVER).
      for (var i = 0; i < privacy.options.length; i++) {
        if (privacy.options[i].value !== SELF_ONLY) continue;
        privacy.options[i].disabled = paid;
        privacy.options[i].title = paid ? PRIVATE_HOVER : "";
      }
      /* NAMED (Nov 17 2026, TK1): "If the commercial content disclosure toggle is turned on but no options are selected,
         the publish button should be disabled." */
      var unchosen = disclose.input.checked && !yours.input.checked && !branded.input.checked;
      file.disabled = unchosen || busy;
      file.title = unchosen ? CHOOSE_DISCLOSURE : "";
    }
    [caption, privacy, disclose.input, yours.input, branded.input].forEach(function (n) {
      n.addEventListener("input", redraw);
      n.addEventListener("change", redraw);
    });

    var busy = false;
    var row = make("div", null, "sf-actions");
    var file = make("button", "File for approval", "action-btn");
    file.type = "button";
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
      if (disclose.input.checked && !yours.input.checked && !branded.input.checked) { msg.textContent = CHOOSE_DISCLOSURE; return; }
      if (branded.input.checked && privacy.value === SELF_ONLY) { msg.textContent = BRANDED_PRIVATE; return; }
      busy = true;
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
      if (repost === true) body.repost = true;
      call("POST", "/api/tiktok/propose-post", body).then(function (res) {
        busy = false;
        redraw();
        msg.textContent = res.ok ? (res.data.note || "Filed for approval.") : errorOf(res);
      }, function () { busy = false; redraw(); msg.textContent = "Filing didn't finish. Try again."; });
    });
    redraw();
    return box;
  }

  var HOOK = { chip: chipOf, actions: actionsOf };
  window.BFTikTok = HOOK;
  if (window.BFVideos && typeof window.BFVideos.register === "function") window.BFVideos.register("tiktok", HOOK);

  function init() {
    var btn = el("ttConnectBtn");
    if (!btn) return;
    btn.addEventListener("click", connect);
    var off = el("ttDisconnectBtn");
    if (off) off.addEventListener("click", disconnect);
    var returning = returns() ? returns().register("tiktok", finishReturn) : false;
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

/* ══════════════════════════════════════════════════════════════════════════
   Facebook, on the Social agent's page (#fbConnect in agents/social.html).

   Connect Facebook: POST /api/facebook/start names Facebook's page to go to
   (it must be https://www.facebook.com/v26.0/dialog/oauth). Before leaving,
   the page calls BFOAuthReturn.mark("facebook") (scripts/oauth-return.js,
   loaded first); on the way back oauth-return.js hands ?code and ?state to
   finishReturn here, which POSTs both to POST /api/facebook/finish as the
   signed-in member and strips the query with history.replaceState WHATEVER
   the answer. One Page that can be posted to connects at once; with several,
   the member chooses one (GET /api/facebook/pages, POST
   /api/facebook/choose-page).

   Prepare Facebook post:
     - Text: the message alone;
     - Photos: up to 10 from the Media Library (scripts/media-picker.js, kind
       image). JPEG, PNG or GIF only: a WebP is refused here with the
       server's words, and the server checks the bytes again when it files
       and again before it sends;
     - Video: one of Your videos, MP4 or MOV (a WebM is shown, not choosable);
     - a message, "Draft with AI", and "File for approval".
   Recent Facebook posts: the status, the link once published, "Check
   status", and "Remove from Facebook", which asks first, then files the
   removal for approval.

   Nothing reaches Facebook until the member approves the proposal. The
   server is the only source of truth, and every server message is shown as
   it wrote it, with textContent. Nothing here uses innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var AUTH_PREFIX = "https://www.facebook.com/v26.0/dialog/oauth?";
  var PERMALINK_RE = /^https:\/\/www\.facebook\.com\/[A-Za-z0-9_\/.?=&%-]{1,270}$/;
  var MESSAGE_MAX = 63206;
  var ITEMS_MAX = 10;
  var NOT_SET_UP = "Facebook connection isn't set up yet.";
  var CANCELLED = "You cancelled the Facebook sign-in.";
  var NOT_FINISHED = "Facebook sign-in didn't finish. Try again.";
  var WEBP = "Facebook doesn't accept WebP photos. Choose a JPEG, PNG or GIF.";
  var PHOTO_TYPE = "Facebook accepts JPEG, PNG and GIF photos. Choose one of those.";
  var VIDEO_TYPE = "Facebook videos must be MP4 or MOV.";
  var PHOTO_MIMES = ["image/jpeg", "image/png", "image/gif"];
  var VIDEO_MIMES = ["video/mp4", "video/quicktime"];
  var KIND_WORDS = { text: "Text post", photo: "Photo post", photos: "Photos post", video: "Video" };
  var STATUS_WORDS = { creating: "sending to Facebook", publishing: "waiting for Facebook to confirm", published: "published", failed: "not published" };
  var state = { available: false, connected: false, photos: [] };

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
  function button(text, ghost) {
    var b = make("button", text, ghost ? "action-btn action-btn--ghost" : "action-btn");
    b.type = "button";
    return b;
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
  function sizeText(bytes) {
    var n = Number(bytes) || 0;
    return n >= 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  }
  function returns() { return window.BFOAuthReturn || null; }
  function videos() { return window.BFVideos && typeof window.BFVideos.setFacebookAvailable === "function" ? window.BFVideos : null; }

  /* ── the connection ────────────────────────────────────────────────────── */
  function drawStatus(st) {
    state.available = st.facebook_available === true;
    state.connected = st.connected === true && st.status === "connected";
    var reconnect = st.status === "needs_reconnect";
    var choosing = st.status === "choosing";
    showIf("fbUnavailable", !state.available);
    var btn = el("fbConnectBtn");
    if (btn) {
      btn.disabled = !state.available;
      btn.hidden = state.connected || choosing;
      btn.textContent = reconnect ? "Connect Facebook again" : "Connect Facebook";
    }
    showIf("fbConnected", state.connected);
    showIf("fbChoosing", choosing && state.available);
    showIf("fbReconnect", reconnect);
    showIf("fbDisconnectBtn", state.connected || reconnect || choosing);
    showIf("fbPrepare", state.connected);
    showIf("fbPosts", state.available && (state.connected || reconnect));
    if (state.connected) {
      el("fbName").textContent = "Posting to " + (typeof st.page_name === "string" && st.page_name ? st.page_name : "your Page");
      el("fbSince").textContent = "since " + dayText(st.since);
    }
    if (reconnect) {
      el("fbReconnectText").textContent = typeof st.reconnect_message === "string" ? st.reconnect_message :
        "Facebook stopped accepting BizForce's access to your Page, so nothing is being posted. Connect again.";
    }
    var v = videos();
    if (v) v.setFacebookAvailable(state.available);
    // NAMED (Nov 12 2026, Social page clean-up): Facebook's chip and "Prepare for Facebook" show in Your videos only while connected.
    if (v && typeof v.setConnected === "function") v.setConnected("facebook", state.connected);
    if (choosing && state.available) {
      if (Array.isArray(st.pages)) drawChoices(st.pages);
      else loadChoices();
    }
    if (state.available && (state.connected || reconnect)) loadPosts();
  }

  function loadStatus() {
    tell("fbStatusMsg", "Checking your Facebook connection…");
    return call("GET", "/api/facebook/status").then(function (res) {
      if (!res.ok) { tell("fbStatusMsg", "Your Facebook connection could not be checked. Reload to try again. (" + errorOf(res) + ")", true); return; }
      tell("fbStatusMsg", "");
      drawStatus(res.data);
    }, function () {
      tell("fbStatusMsg", "Your Facebook connection could not be checked. Reload to try again.", true);
    });
  }

  function connect() {
    if (!state.available) { tell("fbConnectMsg", NOT_SET_UP, true); return; }
    var btn = el("fbConnectBtn");
    if (btn) btn.disabled = true;
    tell("fbConnectMsg", "Opening Facebook…");
    call("POST", "/api/facebook/start", {}).then(function (res) {
      var url = res.data && res.data.authorize_url;
      if (res.ok && typeof url === "string" && url.indexOf(AUTH_PREFIX) === 0) {
        if (returns()) returns().mark("facebook");
        window.location.assign(url);
        return;
      }
      if (btn) btn.disabled = false;
      tell("fbConnectMsg", res.ok ? NOT_FINISHED : errorOf(res), true);
    }, function () {
      if (btn) btn.disabled = false;
      tell("fbConnectMsg", NOT_FINISHED, true);
    });
  }

  function disconnect() {
    var btn = el("fbDisconnectBtn");
    if (btn) btn.disabled = true;
    call("POST", "/api/facebook/disconnect", {}).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("fbConnectMsg", errorOf(res), true); return; }
      tell("fbConnectMsg", typeof res.data.note === "string" ? res.data.note : "Disconnected.");
      drawStatus(res.data);
    }, function () {
      if (btn) btn.disabled = false;
      tell("fbConnectMsg", "Disconnecting didn't finish. Try again.", true);
    });
  }

  /* ── choosing a Page ───────────────────────────────────────────────────── */
  function drawChoices(pages) {
    var select = el("fbPageSelect");
    if (!select) return;
    while (select.firstChild) select.removeChild(select.firstChild);
    var none = make("option", "Choose a Page");
    none.value = "";
    select.appendChild(none);
    pages.filter(plainObject).forEach(function (p) {
      if (typeof p.page_id !== "string" || typeof p.name !== "string") return;
      var opt = make("option", p.name);
      opt.value = p.page_id;
      select.appendChild(opt);
    });
  }

  function loadChoices() {
    tell("fbConnectMsg", "Listing your Pages…");
    call("GET", "/api/facebook/pages").then(function (res) {
      if (!res.ok) { tell("fbConnectMsg", errorOf(res), true); if (res.status === 410) loadStatus(); return; }
      tell("fbConnectMsg", "");
      drawChoices(Array.isArray(res.data.pages) ? res.data.pages : []);
    }, function () { tell("fbConnectMsg", "Your Pages could not be listed. Try again.", true); });
  }

  function choosePage() {
    var select = el("fbPageSelect"), btn = el("fbChooseBtn");
    if (!select || !select.value) { tell("fbConnectMsg", "Choose a Page first.", true); return; }
    if (btn) btn.disabled = true;
    call("POST", "/api/facebook/choose-page", { page_id: select.value }).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("fbConnectMsg", errorOf(res), true); if (res.status === 410) loadStatus(); return; }
      tell("fbConnectMsg", "Connected.");
      drawStatus(res.data);
    }, function () { if (btn) btn.disabled = false; tell("fbConnectMsg", "Choosing didn't finish. Try again.", true); });
  }

  /* Back from Facebook: { code, state, error }, handed over by
     scripts/oauth-return.js only when the marker said "facebook". */
  function finishReturn(answer) {
    var code = answer.code, returned = answer.state, error = answer.error;
    var strip = function () { if (returns()) returns().strip(); };
    if (error || !code || !returned) {
      strip();
      tell("fbConnectMsg", error === "access_denied" ? CANCELLED : NOT_FINISHED, true);
      return;
    }
    tell("fbConnectMsg", "Finishing the Facebook sign-in…");
    call("POST", "/api/facebook/finish", { code: code, state: returned }).then(function (res) {
      return res;
    }, function () {
      return null;
    }).then(function (res) {
      strip();
      if (res && res.ok) {
        tell("fbConnectMsg", res.data.status === "choosing" ? "Signed in. Choose the Page to post to." : "Connected.");
        drawStatus(res.data);
        return;
      }
      tell("fbConnectMsg", res ? errorOf(res) : NOT_FINISHED, true);
      loadStatus();
    });
  }

  /* ── preparing a post ──────────────────────────────────────────────────── */
  function kind() {
    if (el("fbKindPhotos") && el("fbKindPhotos").checked) return "photos";
    if (el("fbKindVideo") && el("fbKindVideo").checked) return "video";
    return "text";
  }
  // NAMED (Nov 12 2026, Social page clean-up): the AI helper names a video for a video post, a post otherwise.
  var IDEA_VIDEO = ["Describe the video for the AI writer", "For example: a 30-second clip showing our herbal oil and how to use it"];
  var IDEA_POST = ["Describe the post for the AI writer", "For example: our new herbal oil and how to use it"];
  // pick: a video id to choose once the list is read (from "Prepare for Facebook"); a change event passes none.
  function drawKind(pick) {
    var k = kind();
    showIf("fbPhotos", k === "photos");
    showIf("fbVideoPick", k === "video");
    var words = k === "video" ? IDEA_VIDEO : IDEA_POST;
    var label = el("fbIdeaLabel"), idea = el("fbIdea");
    if (label) label.textContent = words[0];
    if (idea) idea.placeholder = words[1];
    if (k === "video") loadVideoChoices(typeof pick === "string" ? pick : null);
  }

  /* NAMED (Nov 12 2026, Social page clean-up): a row of Your videos, while
     Facebook is connected, shows a chip (what the file allows: /api/videos
     says nothing of Facebook's side) and "Prepare for Facebook", which moves
     THIS form (#fbPrepare) under the row as a video post of that video, and
     puts it back in the Facebook card when it closes. Same routes, same payload. */
  function videoOk(v) { return VIDEO_MIMES.indexOf(v.mime) !== -1; }
  function setKind(k) {
    [["fbKindText", "text"], ["fbKindPhotos", "photos"], ["fbKindVideo", "video"]].forEach(function (pair) {
      var radio = el(pair[0]);
      if (radio) radio.checked = pair[1] === k;
    });
  }
  // NAMED (Nov 13 2026, S3): set while the form was opened by a confirmed "Post again" on that video.
  var repostFor = null;
  function prepareVideo(v, shell, repost) {
    var node = el("fbPrepare");
    if (!node) return;
    node.className = "bsky-sub sf-in-row";
    node.hidden = false;
    shell.body.appendChild(node);
    repostFor = repost === true ? String(v.id) : null;
    shell.onClose(function () {
      repostFor = null;
      node.className = "bsky-sub";
      var home = el("fbPrepareHome");
      if (home) home.appendChild(node);
      setKind("text");
      drawKind();
      node.hidden = !state.connected;
    });
    setKind("video");
    drawKind(String(v.id));
  }
  /* NAMED (Nov 13 2026, S2): the chip says what Facebook HAS of the video (GET /api/videos facebook_status,
     read from facebook_posts and pending proposals), not what the file allows. The file rule ("must be MP4 or
     MOV") stays as the disabled Prepare button's reason. Posted links the post, as YouTube and TikTok do. */
  var STATUS_CHIP = { posted: ["posted", "ok"], publishing: ["publishing", "wait"], pending: ["waiting for your approval", "wait"],
    failed: ["failed", "bad"], removed: ["removed", "off"], not_sent: ["not sent", "off"], unknown: ["status unavailable", "off"] };
  function statusOf(v) { return Object.prototype.hasOwnProperty.call(STATUS_CHIP, v.facebook_status) ? v.facebook_status : "not_sent"; }
  var HOOK = {
    chip: function (v) {
      var s = statusOf(v);
      if (s === "not_sent" && v.status !== "ready") return { text: "Facebook: file deleted", tone: "off" };
      return { text: "Facebook: " + STATUS_CHIP[s][0], tone: STATUS_CHIP[s][1] };
    },
    actions: function (v, row) {
      var s = statusOf(v);
      if (s === "posted" && typeof v.facebook_post_url === "string" && PERMALINK_RE.test(v.facebook_post_url)) row.link(v.facebook_post_url);
      if (s === "failed" && typeof v.facebook_error === "string" && v.facebook_error) row.note("Facebook didn't post it: " + v.facebook_error);
      if (v.status !== "ready") return;
      // NAMED (Nov 13 2026, S3): the button follows scripts/youtube.js BUTTON_RULES; the file rule still wins.
      // A post the member removed from Facebook is not there any more: "Prepare for Facebook".
      var p = v.facebook_proposal === "pending" || v.facebook_proposal === "publishing" ? v.facebook_proposal : null;
      var st = p || (s === "posted" || s === "pending" || s === "publishing" || s === "failed" ? s : "new");
      row.platform("facebook", st, "Facebook video post", function (shell, repost) { prepareVideo(v, shell, repost); }, videoOk(v) ? "" : VIDEO_TYPE);
    }
  };
  window.BFFacebook = { chip: HOOK.chip, actions: HOOK.actions, prepareVideo: prepareVideo };
  if (window.BFVideos && typeof window.BFVideos.register === "function") window.BFVideos.register("facebook", HOOK);

  function drawPhotos() {
    var list = el("fbPhotoList");
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    state.photos.forEach(function (item, i) {
      var li = make("li", null, "bsky-mention");
      if (typeof item.url === "string" && item.url.indexOf("https://") === 0) {
        var img = document.createElement("img");
        img.src = item.url;
        img.alt = item.alt_text || "";
        img.width = 64;
        img.height = 64;
        img.loading = "lazy";
        li.appendChild(img);
      }
      li.appendChild(make("p", (i + 1) + ". " + (item.label || "Untitled photo"), "bsky-connected-as"));
      var remove = button("Remove", true);
      remove.addEventListener("click", function () { state.photos.splice(i, 1); drawPhotos(); });
      li.appendChild(remove);
      list.appendChild(li);
    });
    var add = el("fbAddPhoto");
    if (add) add.disabled = state.photos.length >= ITEMS_MAX;
    var count = el("fbPhotoCount");
    if (count) count.textContent = state.photos.length + " of " + ITEMS_MAX + " photos";
  }

  function addPhoto() {
    if (state.photos.length >= ITEMS_MAX) { tell("fbPrepareMsg", "A Facebook post has at most 10 photos.", true); return; }
    if (!window.BFMediaPicker || typeof window.BFMediaPicker.open !== "function") { tell("fbPrepareMsg", "The Media Library couldn't be opened. Reload to try again.", true); return; }
    window.BFMediaPicker.open({ kind: "image", withItem: true }).then(function (picked) {
      if (!picked || !plainObject(picked.item)) return;
      var item = picked.item;
      if (item.mime === "image/webp") { tell("fbPrepareMsg", WEBP, true); return; }
      if (PHOTO_MIMES.indexOf(item.mime) === -1) { tell("fbPrepareMsg", PHOTO_TYPE, true); return; }
      if (state.photos.some(function (p) { return p.id === item.id; })) { tell("fbPrepareMsg", "That photo is already in this post.", true); return; }
      state.photos.push({ id: item.id, url: item.url, label: typeof item.label === "string" ? item.label : "",
        alt_text: typeof item.alt_text === "string" ? item.alt_text : "" });
      tell("fbPrepareMsg", "");
      drawPhotos();
    }, function () { tell("fbPrepareMsg", "The Media Library couldn't be opened. Try again.", true); });
  }

  function loadVideoChoices(pick) {
    var select = el("fbVideo");
    if (!select) return;
    call("GET", "/api/videos").then(function (res) {
      while (select.firstChild) select.removeChild(select.firstChild);
      var none = make("option", "Choose a video");
      none.value = "";
      select.appendChild(none);
      if (!res.ok) { tell("fbPrepareMsg", "Your videos could not be listed. (" + errorOf(res) + ")", true); return; }
      var list = Array.isArray(res.data.videos) ? res.data.videos : [];
      list.filter(function (v) { return plainObject(v) && v.status === "ready"; }).forEach(function (v) {
        var fits = VIDEO_MIMES.indexOf(v.mime) !== -1;
        var opt = make("option", (v.label || "Untitled video") + ", " + sizeText(v.bytes) + (fits ? "" : " (" + VIDEO_TYPE + ")"));
        opt.value = v.id;
        opt.disabled = !fits;
        select.appendChild(opt);
      });
      if (select.options.length === 1) tell("fbPrepareMsg", "Add an MP4 or MOV video in Your videos first.");
      if (pick) select.value = pick;
    }, function () { tell("fbPrepareMsg", "Your videos could not be listed. Try again.", true); });
  }

  function countMessage() {
    var message = el("fbMessage"), count = el("fbCount");
    if (message && count) count.textContent = Array.from(message.value).length + " of " + MESSAGE_MAX;
  }

  function draftMessage() {
    var btn = el("fbDraftBtn"), idea = el("fbIdea"), message = el("fbMessage");
    if (btn) btn.disabled = true;
    tell("fbPrepareMsg", "Drafting…");
    call("POST", "/api/facebook/draft-caption", { idea: idea ? idea.value : "" }).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !plainObject(res.data.draft)) { tell("fbPrepareMsg", errorOf(res), true); return; }
      if (message) message.value = typeof res.data.draft.message === "string" ? res.data.draft.message : "";
      countMessage();
      tell("fbPrepareMsg", res.data.note || "A draft only.");
    }, function () { if (btn) btn.disabled = false; tell("fbPrepareMsg", "The draft didn't finish. Try again.", true); });
  }

  function filePost() {
    var btn = el("fbFileBtn"), message = el("fbMessage");
    var body = { kind: kind(), message: message ? message.value : "" };
    if (body.kind === "text" && !body.message.trim()) { tell("fbPrepareMsg", "Write the post's text first.", true); return; }
    if (body.kind === "photos") {
      if (!state.photos.length) { tell("fbPrepareMsg", "Add at least one photo.", true); return; }
      body.media_ids = state.photos.map(function (p) { return p.id; });
    } else if (body.kind === "video") {
      var select = el("fbVideo");
      if (!select || !select.value) { tell("fbPrepareMsg", "Choose a video.", true); return; }
      body.video_id = select.value;
      if (repostFor && body.video_id === repostFor) body.repost = true;
    }
    if (btn) btn.disabled = true;
    tell("fbPrepareMsg", "Filing…");
    call("POST", "/api/facebook/propose-post", body).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("fbPrepareMsg", errorOf(res), true); return; }
      tell("fbPrepareMsg", res.data.note || "Filed for approval.");
      state.photos = [];
      drawPhotos();
    }, function () { if (btn) btn.disabled = false; tell("fbPrepareMsg", "Filing didn't finish. Try again.", true); });
  }

  /* ── recent posts ──────────────────────────────────────────────────────── */
  function postItem(p) {
    var li = make("li", null, "bsky-mention");
    var words = (KIND_WORDS[p.kind] || "Post") + ", " + dayText(p.created_at) + ": " + (STATUS_WORDS[p.status] || "unknown") +
      (p.removed_at ? ", then removed from Facebook" : "") + ".";
    li.appendChild(make("p", words, "bsky-connected-as"));
    if (p.status === "published" && !p.removed_at && typeof p.permalink === "string" && PERMALINK_RE.test(p.permalink)) {
      var link = make("a", p.permalink, "masto-post-link");
      link.href = p.permalink;
      link.target = "_blank";
      link.rel = "noopener";
      li.appendChild(link);
    }
    if (p.status === "failed" && typeof p.error === "string" && p.error) li.appendChild(make("p", p.error, "bsky-warn"));
    var msg = make("p", "", "bsky-quiet");
    var row = make("div", null, "bsky-row");
    if (!p.removed_at && p.status !== "failed") {
      var check = button("Check status", true);
      check.addEventListener("click", function () {
        check.disabled = true;
        msg.textContent = "Asking Facebook…";
        call("GET", "/api/facebook/posts/" + encodeURIComponent(p.id) + "/status").then(function (res) {
          check.disabled = false;
          if (!res.ok) { msg.textContent = errorOf(res); return; }
          msg.textContent = res.data.error || res.data.note || (typeof res.data.processing === "string" ? "Facebook says: " + res.data.processing : "Checked.");
          if (res.data.status && res.data.status !== p.status) loadPosts();
        }, function () { check.disabled = false; msg.textContent = "The status couldn't be checked. Try again."; });
      });
      row.appendChild(check);
    }
    if (p.status === "published" && !p.removed_at) {
      var remove = button("Remove from Facebook", true);
      var confirmBox = make("div", null, "bsky-row");
      confirmBox.hidden = true;
      confirmBox.appendChild(make("p", "Remove this post from your Page? The removal waits for your approval on the proposals page.", "bsky-quiet"));
      var yes = button("Yes, file the removal", false);
      var no = button("Cancel", true);
      confirmBox.appendChild(yes);
      confirmBox.appendChild(no);
      remove.addEventListener("click", function () { confirmBox.hidden = false; remove.disabled = true; });
      no.addEventListener("click", function () { confirmBox.hidden = true; remove.disabled = false; });
      yes.addEventListener("click", function () {
        yes.disabled = true;
        msg.textContent = "Filing the removal…";
        call("POST", "/api/facebook/posts/" + encodeURIComponent(p.id) + "/propose-delete", {}).then(function (res) {
          yes.disabled = false;
          confirmBox.hidden = true;
          remove.disabled = false;
          msg.textContent = res.ok ? (res.data.note || "Filed for approval.") : errorOf(res);
        }, function () { yes.disabled = false; msg.textContent = "Filing didn't finish. Try again."; });
      });
      row.appendChild(remove);
      li.appendChild(row);
      li.appendChild(confirmBox);
    } else {
      li.appendChild(row);
    }
    li.appendChild(msg);
    return li;
  }

  function loadPosts() {
    var list = el("fbPostList");
    if (!list) return;
    call("GET", "/api/facebook/posts").then(function (res) {
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!res.ok) { tell("fbPostsMsg", "Your Facebook posts could not be listed. (" + errorOf(res) + ")", true); return; }
      var posts = Array.isArray(res.data.posts) ? res.data.posts.filter(plainObject) : [];
      tell("fbPostsMsg", posts.length ? "" : "No Facebook posts yet.");
      posts.forEach(function (p) { list.appendChild(postItem(p)); });
    }, function () { tell("fbPostsMsg", "Your Facebook posts could not be listed. Try again.", true); });
  }

  function init() {
    var btn = el("fbConnectBtn");
    if (!btn) return;
    btn.addEventListener("click", connect);
    var off = el("fbDisconnectBtn");
    if (off) off.addEventListener("click", disconnect);
    var choose = el("fbChooseBtn");
    if (choose) choose.addEventListener("click", choosePage);
    ["fbKindText", "fbKindPhotos", "fbKindVideo"].forEach(function (id) {
      var radio = el(id);
      if (radio) radio.addEventListener("change", drawKind);
    });
    var add = el("fbAddPhoto");
    if (add) add.addEventListener("click", addPhoto);
    var message = el("fbMessage");
    if (message) message.addEventListener("input", countMessage);
    var draft = el("fbDraftBtn");
    if (draft) draft.addEventListener("click", draftMessage);
    var file = el("fbFileBtn");
    if (file) file.addEventListener("click", filePost);
    drawPhotos();
    var returning = returns() ? returns().register("facebook", finishReturn) : false;
    if (!returning) loadStatus();
    else call("GET", "/api/facebook/status").then(function (res) {
      if (res.ok) {
        state.available = res.data.facebook_available === true;
        showIf("fbUnavailable", !state.available);
        var v = videos();
        if (v) v.setFacebookAvailable(state.available);
      }
    }, function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

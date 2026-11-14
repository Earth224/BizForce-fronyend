/* ══════════════════════════════════════════════════════════════════════════
   Instagram, on the Social agent's page (#igConnect in agents/social.html).

   Connect Instagram: POST /api/instagram/start names Instagram's page to go
   to (it must be https://www.instagram.com/oauth/authorize). Before leaving,
   the page calls BFOAuthReturn.mark("instagram") (scripts/oauth-return.js,
   loaded first); on the way back oauth-return.js hands ?code and ?state to
   finishReturn here, which POSTs both to POST /api/instagram/finish as the
   signed-in member and strips the query with history.replaceState WHATEVER
   the answer. Instagram posting works with Business and Creator accounts.

   Prepare Instagram post:
     - Photos: up to 10 from the Media Library (scripts/media-picker.js, kind
       image). Each shows its alt text. Only JPEG photos are taken: any other
       is refused here with the server's words, and the server checks the
       bytes again when it files and again before it sends;
     - Reel: one of Your videos, MP4 or MOV (a WebM is shown, not choosable);
     - a caption, "Draft caption with AI", and "File for approval".
   Recent Instagram posts: the status, the link once published, and "Check
   status" while Instagram is still preparing one. There is no remove: "To
   remove an Instagram post, delete it in the Instagram app."

   Nothing reaches Instagram until the member approves the proposal. The
   server is the only source of truth, and every server message is shown as
   it wrote it, with textContent. Nothing here uses innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var AUTH_PREFIX = "https://www.instagram.com/oauth/authorize?";
  var PERMALINK_RE = /^https:\/\/www\.instagram\.com\/[A-Za-z0-9_\/.?=&-]{1,280}$/;
  var CAPTION_MAX = 2200;
  var ITEMS_MAX = 10;
  var NOT_SET_UP = "Instagram connection isn't set up yet.";
  var CANCELLED = "You cancelled the Instagram sign-in.";
  var NOT_FINISHED = "Instagram sign-in didn't finish. Try again.";
  var JPEG_ONLY = "Instagram accepts JPEG photos only. Choose a JPEG photo.";
  var REEL_TYPE = "Instagram Reels need an MP4 or MOV video.";
  var REEL_MIMES = ["video/mp4", "video/quicktime"];
  var KIND_WORDS = { image: "Photo post", carousel: "Carousel", reel: "Reel" };
  var STATUS_WORDS = { creating: "sending to Instagram", processing: "Instagram is preparing it", published: "published", failed: "not published" };
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
  function videos() { return window.BFVideos && typeof window.BFVideos.setInstagramAvailable === "function" ? window.BFVideos : null; }

  /* ── the connection ────────────────────────────────────────────────────── */
  function drawStatus(st) {
    state.available = st.instagram_available === true;
    state.connected = st.connected === true && st.status === "connected";
    var reconnect = st.status === "needs_reconnect";
    showIf("igUnavailable", !state.available);
    var btn = el("igConnectBtn");
    if (btn) {
      btn.disabled = !state.available;
      btn.hidden = state.connected;
      btn.textContent = reconnect ? "Connect Instagram again" : "Connect Instagram";
    }
    showIf("igConnected", state.connected);
    showIf("igReconnect", reconnect);
    showIf("igDisconnectBtn", state.connected || reconnect);
    showIf("igPrepare", state.connected);
    showIf("igPosts", state.available && (state.connected || reconnect));
    if (state.connected) {
      el("igName").textContent = "Connected as @" + (typeof st.username === "string" ? st.username : "your account");
      el("igSince").textContent = "since " + dayText(st.since);
    }
    if (reconnect) {
      el("igReconnectText").textContent = typeof st.reconnect_message === "string" ? st.reconnect_message :
        "Instagram stopped accepting BizForce's access to your account, so nothing is being posted. Connect again.";
    }
    var v = videos();
    if (v) v.setInstagramAvailable(state.available);
    // NAMED (Nov 12 2026, Social page clean-up): Instagram's chip and "Prepare for Instagram" show in Your videos only while connected.
    if (v && typeof v.setConnected === "function") v.setConnected("instagram", state.connected);
    if (state.available && (state.connected || reconnect)) loadPosts();
  }

  function loadStatus() {
    tell("igStatusMsg", "Checking your Instagram connection…");
    return call("GET", "/api/instagram/status").then(function (res) {
      if (!res.ok) { tell("igStatusMsg", "Your Instagram connection could not be checked. Reload to try again. (" + errorOf(res) + ")", true); return; }
      tell("igStatusMsg", "");
      drawStatus(res.data);
    }, function () {
      tell("igStatusMsg", "Your Instagram connection could not be checked. Reload to try again.", true);
    });
  }

  function connect() {
    if (!state.available) { tell("igConnectMsg", NOT_SET_UP, true); return; }
    var btn = el("igConnectBtn");
    if (btn) btn.disabled = true;
    tell("igConnectMsg", "Opening Instagram…");
    call("POST", "/api/instagram/start", {}).then(function (res) {
      var url = res.data && res.data.authorize_url;
      if (res.ok && typeof url === "string" && url.indexOf(AUTH_PREFIX) === 0) {
        if (returns()) returns().mark("instagram");
        window.location.assign(url);
        return;
      }
      if (btn) btn.disabled = false;
      tell("igConnectMsg", res.ok ? NOT_FINISHED : errorOf(res), true);
    }, function () {
      if (btn) btn.disabled = false;
      tell("igConnectMsg", NOT_FINISHED, true);
    });
  }

  function disconnect() {
    var btn = el("igDisconnectBtn");
    if (btn) btn.disabled = true;
    call("POST", "/api/instagram/disconnect", {}).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("igConnectMsg", errorOf(res), true); return; }
      tell("igConnectMsg", typeof res.data.note === "string" ? res.data.note : "Disconnected.");
      drawStatus(res.data);
    }, function () {
      if (btn) btn.disabled = false;
      tell("igConnectMsg", "Disconnecting didn't finish. Try again.", true);
    });
  }

  /* Back from Instagram: { code, state, error }, handed over by
     scripts/oauth-return.js only when the marker said "instagram". */
  function finishReturn(answer) {
    var code = answer.code, returned = answer.state, error = answer.error;
    var strip = function () { if (returns()) returns().strip(); };
    if (error || !code || !returned) {
      strip();
      tell("igConnectMsg", error === "access_denied" ? CANCELLED : NOT_FINISHED, true);
      return;
    }
    tell("igConnectMsg", "Finishing the Instagram sign-in…");
    call("POST", "/api/instagram/finish", { code: code, state: returned }).then(function (res) {
      return res;
    }, function () {
      return null;
    }).then(function (res) {
      strip();
      if (res && res.ok) { tell("igConnectMsg", "Connected."); drawStatus(res.data); return; }
      tell("igConnectMsg", res ? errorOf(res) : NOT_FINISHED, true);
      loadStatus();
    });
  }

  /* ── preparing a post ──────────────────────────────────────────────────── */
  function kind() { var reel = el("igKindReel"); return reel && reel.checked ? "reel" : "photos"; }
  // NAMED (Nov 12 2026, Social page clean-up): the AI helper names a video for a Reel, a post for photos.
  var IDEA_VIDEO = ["Describe the video for the AI writer", "For example: a 30-second clip showing our herbal oil and how to use it"];
  var IDEA_POST = ["Describe the post for the AI writer", "For example: three photos of our herbal oil and how to use it"];
  // pick: a video id to choose once the list is read (from "Prepare for Instagram"); a change event passes none.
  function drawKind(pick) {
    var k = kind();
    showIf("igPhotos", k === "photos");
    showIf("igReel", k === "reel");
    var words = k === "reel" ? IDEA_VIDEO : IDEA_POST;
    var label = el("igIdeaLabel"), idea = el("igIdea");
    if (label) label.textContent = words[0];
    if (idea) idea.placeholder = words[1];
    if (k === "reel") loadReelChoices(typeof pick === "string" ? pick : null);
  }

  /* NAMED (Nov 12 2026, Social page clean-up): a row of Your videos, while
     Instagram is connected, shows a chip (what the file allows: /api/videos
     says nothing of Instagram's side) and "Prepare for Instagram", which moves
     THIS form (#igPrepare) under the row as a Reel of that video, and puts it
     back in the Instagram card when it closes. Same routes, same payload. */
  function reelOk(v) { return REEL_MIMES.indexOf(v.mime) !== -1; }
  function setKind(reelOn) {
    var photos = el("igKindPhotos"), reel = el("igKindReel");
    if (photos) photos.checked = !reelOn;
    if (reel) reel.checked = reelOn;
  }
  // NAMED (Nov 13 2026, S3): set while the form was opened by a confirmed "Post again" on that video.
  var repostFor = null;
  function prepareReel(v, shell, repost) {
    var node = el("igPrepare");
    if (!node) return;
    node.className = "bsky-sub sf-in-row";
    node.hidden = false;
    shell.body.appendChild(node);
    repostFor = repost === true ? String(v.id) : null;
    shell.onClose(function () {
      repostFor = null;
      node.className = "bsky-sub";
      var home = el("igPrepareHome");
      if (home) home.appendChild(node);
      setKind(false);
      drawKind();
      node.hidden = !state.connected;
    });
    setKind(true);
    drawKind(String(v.id));
  }
  /* NAMED (Nov 13 2026, S2): the chip says what Instagram HAS of the video (GET /api/videos instagram_status,
     read from instagram_posts and pending proposals), not what the file allows. The file rule ("needs an MP4 or
     MOV") stays as the disabled Prepare button's reason. Posted links the post, as YouTube and TikTok do. */
  var STATUS_CHIP = { posted: ["posted", "ok"], publishing: ["publishing", "wait"], pending: ["waiting for your approval", "wait"],
    failed: ["failed", "bad"], not_sent: ["not sent", "off"], unknown: ["status unavailable", "off"] };
  function statusOf(v) { return Object.prototype.hasOwnProperty.call(STATUS_CHIP, v.instagram_status) ? v.instagram_status : "not_sent"; }
  var HOOK = {
    chip: function (v) {
      var s = statusOf(v);
      if (s === "not_sent" && v.status !== "ready") return { text: "Instagram: file deleted", tone: "off" };
      return { text: "Instagram: " + STATUS_CHIP[s][0], tone: STATUS_CHIP[s][1] };
    },
    actions: function (v, row) {
      var s = statusOf(v);
      if (s === "posted" && typeof v.instagram_post_url === "string" && PERMALINK_RE.test(v.instagram_post_url)) row.link(v.instagram_post_url);
      if (s === "failed" && typeof v.instagram_error === "string" && v.instagram_error) row.note("Instagram didn't post it: " + v.instagram_error);
      if (v.status !== "ready") return;
      // NAMED (Nov 13 2026, S3): the button follows scripts/youtube.js BUTTON_RULES; the file rule still wins.
      var p = v.instagram_proposal === "pending" || v.instagram_proposal === "publishing" ? v.instagram_proposal : null;
      var st = p || (s === "posted" || s === "pending" || s === "publishing" || s === "failed" ? s : "new");
      row.platform("instagram", st, "Instagram Reel", function (shell, repost) { prepareReel(v, shell, repost); }, reelOk(v) ? "" : REEL_TYPE);
    }
  };
  window.BFInstagram = { chip: HOOK.chip, actions: HOOK.actions, prepareReel: prepareReel };
  if (window.BFVideos && typeof window.BFVideos.register === "function") window.BFVideos.register("instagram", HOOK);

  function drawPhotos() {
    var list = el("igPhotoList");
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
      li.appendChild(make("p", item.alt_text ? "Alt text: " + item.alt_text :
        "No alt text. Add it in your Media Library so people using screen readers know what the photo shows.", "bsky-quiet"));
      var remove = make("button", "Remove", "action-btn action-btn--ghost");
      remove.type = "button";
      remove.addEventListener("click", function () { state.photos.splice(i, 1); drawPhotos(); });
      li.appendChild(remove);
      list.appendChild(li);
    });
    var add = el("igAddPhoto");
    if (add) add.disabled = state.photos.length >= ITEMS_MAX;
    var count = el("igPhotoCount");
    if (count) count.textContent = state.photos.length + " of " + ITEMS_MAX + " photos" + (state.photos.length > 1 ? " (a carousel)" : "");
  }

  function addPhoto() {
    if (state.photos.length >= ITEMS_MAX) { tell("igPrepareMsg", "An Instagram post has at most 10 photos.", true); return; }
    if (!window.BFMediaPicker || typeof window.BFMediaPicker.open !== "function") { tell("igPrepareMsg", "The Media Library couldn't be opened. Reload to try again.", true); return; }
    window.BFMediaPicker.open({ kind: "image", withItem: true }).then(function (picked) {
      if (!picked || !plainObject(picked.item)) return;
      var item = picked.item;
      if (item.mime !== "image/jpeg") { tell("igPrepareMsg", JPEG_ONLY, true); return; }
      if (state.photos.some(function (p) { return p.id === item.id; })) { tell("igPrepareMsg", "That photo is already in this post.", true); return; }
      state.photos.push({ id: item.id, url: item.url, label: typeof item.label === "string" ? item.label : "",
        alt_text: typeof item.alt_text === "string" ? item.alt_text : "" });
      tell("igPrepareMsg", "");
      drawPhotos();
    }, function () { tell("igPrepareMsg", "The Media Library couldn't be opened. Try again.", true); });
  }

  function loadReelChoices(pick) {
    var select = el("igVideo");
    if (!select) return;
    call("GET", "/api/videos").then(function (res) {
      while (select.firstChild) select.removeChild(select.firstChild);
      var none = make("option", "Choose a video");
      none.value = "";
      select.appendChild(none);
      if (!res.ok) { tell("igPrepareMsg", "Your videos could not be listed. (" + errorOf(res) + ")", true); return; }
      var list = Array.isArray(res.data.videos) ? res.data.videos : [];
      list.filter(function (v) { return plainObject(v) && v.status === "ready"; }).forEach(function (v) {
        var reelOk = REEL_MIMES.indexOf(v.mime) !== -1;
        var opt = make("option", (v.label || "Untitled video") + ", " + sizeText(v.bytes) + (reelOk ? "" : " (" + REEL_TYPE + ")"));
        opt.value = v.id;
        opt.disabled = !reelOk;
        select.appendChild(opt);
      });
      if (select.options.length === 1) tell("igPrepareMsg", "Add an MP4 or MOV video in Your videos first.");
      if (pick) select.value = pick;
    }, function () { tell("igPrepareMsg", "Your videos could not be listed. Try again.", true); });
  }

  function countCaption() {
    var caption = el("igCaption"), count = el("igCount");
    if (caption && count) count.textContent = Array.from(caption.value).length + " of " + CAPTION_MAX;
  }

  function draftCaption() {
    var btn = el("igDraftBtn"), idea = el("igIdea"), caption = el("igCaption");
    if (btn) btn.disabled = true;
    tell("igPrepareMsg", "Drafting…");
    call("POST", "/api/instagram/draft-caption", { idea: idea ? idea.value : "" }).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok || !plainObject(res.data.draft)) { tell("igPrepareMsg", errorOf(res), true); return; }
      if (caption) caption.value = typeof res.data.draft.caption === "string" ? res.data.draft.caption : "";
      countCaption();
      tell("igPrepareMsg", (res.data.note || "A draft only.") + (res.data.within_limits === false ? " It's over Instagram's limits; shorten it before filing." : ""));
    }, function () { if (btn) btn.disabled = false; tell("igPrepareMsg", "The draft didn't finish. Try again.", true); });
  }

  function filePost() {
    var btn = el("igFileBtn"), caption = el("igCaption");
    var body = { kind: kind(), caption: caption ? caption.value : "" };
    if (body.kind === "photos") {
      if (!state.photos.length) { tell("igPrepareMsg", "Add at least one JPEG photo.", true); return; }
      body.media_ids = state.photos.map(function (p) { return p.id; });
    } else {
      var select = el("igVideo");
      if (!select || !select.value) { tell("igPrepareMsg", "Choose a video for the Reel.", true); return; }
      body.video_id = select.value;
      if (repostFor && body.video_id === repostFor) body.repost = true;
    }
    if (btn) btn.disabled = true;
    tell("igPrepareMsg", "Filing…");
    call("POST", "/api/instagram/propose-post", body).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("igPrepareMsg", errorOf(res), true); return; }
      tell("igPrepareMsg", res.data.note || "Filed for approval.");
      state.photos = [];
      drawPhotos();
    }, function () { if (btn) btn.disabled = false; tell("igPrepareMsg", "Filing didn't finish. Try again.", true); });
  }

  /* ── recent posts ──────────────────────────────────────────────────────── */
  function postItem(p) {
    var li = make("li", null, "bsky-mention");
    li.appendChild(make("p", (KIND_WORDS[p.kind] || "Post") + ", " + dayText(p.created_at) + ": " + (STATUS_WORDS[p.status] || "unknown") + ".", "bsky-connected-as"));
    if (p.status === "published" && typeof p.permalink === "string" && PERMALINK_RE.test(p.permalink)) {
      var link = make("a", p.permalink, "masto-post-link");
      link.href = p.permalink;
      link.target = "_blank";
      link.rel = "noopener";
      li.appendChild(link);
    }
    if (p.status === "failed" && typeof p.error === "string" && p.error) li.appendChild(make("p", p.error, "bsky-warn"));
    var msg = make("p", "", "bsky-quiet");
    if (p.status === "processing" || p.status === "creating") {
      var check = make("button", "Check status", "action-btn action-btn--ghost");
      check.type = "button";
      check.addEventListener("click", function () {
        check.disabled = true;
        msg.textContent = "Asking Instagram…";
        call("GET", "/api/instagram/posts/" + encodeURIComponent(p.id) + "/status").then(function (res) {
          check.disabled = false;
          if (!res.ok) { msg.textContent = errorOf(res); return; }
          msg.textContent = res.data.error || res.data.note || "";
          if (res.data.status && res.data.status !== p.status) loadPosts();
        }, function () { check.disabled = false; msg.textContent = "The status couldn't be checked. Try again."; });
      });
      li.appendChild(check);
    }
    li.appendChild(msg);
    return li;
  }

  function loadPosts() {
    var list = el("igPostList");
    if (!list) return;
    call("GET", "/api/instagram/posts").then(function (res) {
      while (list.firstChild) list.removeChild(list.firstChild);
      if (!res.ok) { tell("igPostsMsg", "Your Instagram posts could not be listed. (" + errorOf(res) + ")", true); return; }
      var posts = Array.isArray(res.data.posts) ? res.data.posts.filter(plainObject) : [];
      tell("igPostsMsg", posts.length ? "" : "No Instagram posts yet.");
      posts.forEach(function (p) { list.appendChild(postItem(p)); });
    }, function () { tell("igPostsMsg", "Your Instagram posts could not be listed. Try again.", true); });
  }

  function init() {
    var btn = el("igConnectBtn");
    if (!btn) return;
    btn.addEventListener("click", connect);
    var off = el("igDisconnectBtn");
    if (off) off.addEventListener("click", disconnect);
    var photos = el("igKindPhotos"), reel = el("igKindReel");
    if (photos) photos.addEventListener("change", drawKind);
    if (reel) reel.addEventListener("change", drawKind);
    var add = el("igAddPhoto");
    if (add) add.addEventListener("click", addPhoto);
    var caption = el("igCaption");
    if (caption) caption.addEventListener("input", countCaption);
    var draft = el("igDraftBtn");
    if (draft) draft.addEventListener("click", draftCaption);
    var file = el("igFileBtn");
    if (file) file.addEventListener("click", filePost);
    drawPhotos();
    var returning = returns() ? returns().register("instagram", finishReturn) : false;
    if (!returning) loadStatus();
    else call("GET", "/api/instagram/status").then(function (res) {
      if (res.ok) {
        state.available = res.data.instagram_available === true;
        showIf("igUnavailable", !state.available);
        var v = videos();
        if (v) v.setInstagramAvailable(state.available);
      }
    }, function () {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

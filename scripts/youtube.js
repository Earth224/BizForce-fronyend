/* ══════════════════════════════════════════════════════════════════════════
   YouTube, on the Social agent's page (#ytConnect in agents/social.html).

   Connect YouTube: POST /api/youtube/start names the Google page to go to
   (it must be on accounts.google.com); Google sends the browser back here
   with ?code and ?state (or ?error). The page POSTs both to
   POST /api/youtube/finish as the signed-in member, then strips the query
   with history.replaceState WHATEVER the answer, so the code never stays in
   the address bar or the history.

   NAMED (Nov 7 2026, TikTok posting): TikTok's sign-in comes back to this
   same page, so before leaving, connect sets sessionStorage "bf_oauth_return"
   to "youtube" (scripts/tiktok.js sets "tiktok").
   NAMED (Nov 7 2026, Instagram posting): the return is now read in ONE place,
   scripts/oauth-return.js (loaded first): connect calls
   BFOAuthReturn.mark("youtube"), and this script registers finishReturn
   under "youtube" instead of reading ?code and ?state itself. With no
   marker, oauth-return.js strips the query and this script says "Start the
   connection again.".

   Your videos: a file of up to 50 MB (MP4, WebM or MOV) is checked here
   first, then PUT straight to the signed upload URL that
   POST /api/videos/upload-url makes, then POST /api/videos/finalize checks
   it on the server. A video whose file is here gets Delete, and while
   YouTube doesn't have it, "Prepare upload" (title, description, tags,
   privacy with Private first, "Made for kids?" required, "Draft with AI",
   "File for approval"); a video on YouTube, its YouTube link, "Check status"
   and "Remove from YouTube". NAMED (Nov 7 2026): the file status says only
   whether the FILE is here, so YouTube's side is read from youtube_video_id;
   scripts/tiktok.js adds TikTok's side to each video (window.BFTikTok), and
   the file input is on when YouTube OR TikTok is set up (window.BFVideos);
   NAMED (Nov 7 2026): or Instagram, whose Reels come from these videos.
   Nothing reaches YouTube until the member approves the proposal.

   The server is the only source of truth, and every server message is shown
   as it wrote it, with textContent. Nothing here uses innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var PAGE_PATH = "/agents/social.html";
  var GOOGLE_HOST = "https://accounts.google.com/";
  var MAX_BYTES = 50 * 1024 * 1024;
  var TYPES = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
  var MIMES = ["video/mp4", "video/webm", "video/quicktime"];
  var WATCH_RE = /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/;
  var NOT_SET_UP = "YouTube connection isn't set up yet.";
  var CANCELLED = "You cancelled the Google sign-in.";
  var NOT_FINISHED = "Google sign-in didn't finish. Try again.";
  var START_AGAIN = "Start the connection again.";
  var state = { available: false, connected: false, busy: false, tiktokAvailable: false, instagramAvailable: false };

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

  /* ── the connection ────────────────────────────────────────────────────── */
  function drawStatus(st) {
    state.available = st.youtube_available === true;
    state.connected = st.connected === true && st.status === "connected";
    var reconnect = st.status === "needs_reconnect";
    showIf("ytUnavailable", !state.available);
    var btn = el("ytConnectBtn");
    if (btn) {
      btn.disabled = !state.available;
      btn.hidden = state.connected;
      btn.textContent = reconnect ? "Connect YouTube again" : "Connect YouTube";
    }
    showIf("ytConnected", state.connected);
    showIf("ytReconnect", reconnect);
    showIf("ytDisconnectBtn", state.connected || reconnect);
    if (state.connected) {
      el("ytChannel").textContent = "Connected to " + (typeof st.channel_title === "string" ? st.channel_title : "your channel");
      el("ytSince").textContent = "since " + dayText(st.since);
    }
    if (reconnect) {
      el("ytReconnectText").textContent = typeof st.reconnect_message === "string" ? st.reconnect_message :
        "YouTube stopped accepting BizForce's access to your channel, so nothing is being uploaded. Connect again.";
    }
    fileSwitch();
  }

  // The file input: on when either platform a video can go to is set up.
  function fileSwitch() {
    var file = el("ytFile");
    if (file) file.disabled = !(state.available || state.tiktokAvailable || state.instagramAvailable);
  }
  function returns() { return window.BFOAuthReturn || null; }

  function loadStatus() {
    tell("ytStatusMsg", "Checking your YouTube connection…");
    return call("GET", "/api/youtube/status").then(function (res) {
      if (!res.ok) { tell("ytStatusMsg", "Your YouTube connection could not be checked. Reload to try again. (" + errorOf(res) + ")", true); return; }
      tell("ytStatusMsg", "");
      drawStatus(res.data);
      return loadVideos();
    }, function () {
      tell("ytStatusMsg", "Your YouTube connection could not be checked. Reload to try again.", true);
    });
  }

  function connect() {
    if (!state.available) { tell("ytConnectMsg", NOT_SET_UP, true); return; }
    var btn = el("ytConnectBtn");
    if (btn) btn.disabled = true;
    tell("ytConnectMsg", "Opening Google…");
    call("POST", "/api/youtube/start", {}).then(function (res) {
      var url = res.data && res.data.authorize_url;
      if (res.ok && typeof url === "string" && url.indexOf(GOOGLE_HOST) === 0) {
        if (returns()) returns().mark("youtube");
        window.location.assign(url);
        return;
      }
      if (btn) btn.disabled = false;
      tell("ytConnectMsg", res.ok ? NOT_FINISHED : errorOf(res), true);
    }, function () {
      if (btn) btn.disabled = false;
      tell("ytConnectMsg", NOT_FINISHED, true);
    });
  }

  function disconnect() {
    var btn = el("ytDisconnectBtn");
    if (btn) btn.disabled = true;
    call("POST", "/api/youtube/disconnect", {}).then(function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) { tell("ytConnectMsg", errorOf(res), true); return; }
      tell("ytConnectMsg", typeof res.data.note === "string" ? res.data.note : "Disconnected.");
      drawStatus(res.data);
    }, function () {
      if (btn) btn.disabled = false;
      tell("ytConnectMsg", "Disconnecting didn't finish. Try again.", true);
    });
  }

  /* Back from Google: { code, state, error }, handed over by
     scripts/oauth-return.js only when the marker said "youtube". The query is
     stripped with replaceState whatever the answer. */
  function stripQuery() {
    if (returns()) { returns().strip(); return; }
    try { window.history.replaceState(null, "", PAGE_PATH); } catch (e) { /* nothing to strip */ }
  }
  function finishReturn(answer) {
    var code = answer.code, returned = answer.state, error = answer.error;
    if (error || !code || !returned) {
      stripQuery();
      tell("ytConnectMsg", error === "access_denied" ? CANCELLED : NOT_FINISHED, true);
      return;
    }
    tell("ytConnectMsg", "Finishing the Google sign-in…");
    call("POST", "/api/youtube/finish", { code: code, state: returned }).then(function (res) {
      return res;
    }, function () {
      return null;
    }).then(function (res) {
      stripQuery();
      if (res && res.ok) { tell("ytConnectMsg", "Connected."); drawStatus(res.data); loadVideos(); return; }
      tell("ytConnectMsg", res ? errorOf(res) : NOT_FINISHED, true);
      loadStatus();
    });
  }

  /* ── adding a video ────────────────────────────────────────────────────── */
  function mimeOf(file) {
    if (MIMES.indexOf(file.type) !== -1) return file.type;
    var m = /\.([a-z0-9]+)$/i.exec(file.name || "");
    return m ? TYPES[m[1].toLowerCase()] || null : null;
  }

  // A PUT with a progress line. Resolves the status, or 0 for a network failure.
  function putFile(url, file, mime, onProgress) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", mime);
      xhr.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(Math.floor(e.loaded * 100 / e.total)); };
      xhr.onload = function () { resolve(xhr.status); };
      xhr.onerror = function () { resolve(0); };
      xhr.send(file);
    });
  }

  function addVideo() {
    var input = el("ytFile");
    var file = input && input.files && input.files[0];
    if (!file) return;
    var mime = mimeOf(file);
    var labelEl = el("ytLabel");
    var label = labelEl ? labelEl.value.trim() : "";
    if (!mime) { input.value = ""; tell("ytUploadMsg", "That file type isn't supported. Use MP4, WebM or MOV.", true); return; }
    if (file.size > MAX_BYTES) { input.value = ""; tell("ytUploadMsg", "A video is at most 50 MB.", true); return; }
    if (file.size < 1) { input.value = ""; tell("ytUploadMsg", "That file is empty.", true); return; }
    input.disabled = true;
    tell("ytUploadMsg", "Preparing the upload…");
    call("POST", "/api/videos/upload-url", { mime: mime, bytes: file.size, label: label }).then(function (res) {
      if (!res.ok || typeof res.data.upload_url !== "string" || typeof res.data.path !== "string") throw new Error(errorOf(res));
      var path = res.data.path;
      return putFile(res.data.upload_url, file, mime, function (pct) {
        tell("ytUploadMsg", "Uploading… " + pct + "%");
      }).then(function (status) {
        if (status < 200 || status >= 300) throw new Error("The upload didn't finish. Try again.");
        tell("ytUploadMsg", "Checking the file…");
        return call("POST", "/api/videos/finalize", { path: path, label: label, bytes: file.size });
      });
    }).then(function (res) {
      if (!res.ok) throw new Error(errorOf(res));
      tell("ytUploadMsg", "Added.");
      if (labelEl) labelEl.value = "";
      return loadVideos();
    }).catch(function (err) {
      tell("ytUploadMsg", (err && err.message) || "The upload didn't finish. Try again.", true);
    }).then(function () {
      input.value = "";
      fileSwitch();
    });
  }

  /* ── the list ──────────────────────────────────────────────────────────── */
  function loadVideos() {
    return call("GET", "/api/videos").then(function (res) {
      if (!res.ok) { tell("ytUploadMsg", "Your videos could not be listed. (" + errorOf(res) + ")", true); return; }
      drawVideos(Array.isArray(res.data.videos) ? res.data.videos : []);
    }, function () {
      tell("ytUploadMsg", "Your videos could not be listed. Reload to try again.", true);
    });
  }

  function drawVideos(videos) {
    var list = el("ytVideoList");
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!videos.length) { list.appendChild(make("li", "No videos yet.", "bsky-quiet")); return; }
    videos.forEach(function (v) { list.appendChild(videoItem(v)); });
  }

  function statusWord(v) {
    if (v.youtube_video_id) return "on YouTube";
    if (v.upload_unfinished) return "YouTube upload unfinished";
    if (v.status === "ready") return "not on YouTube";
    return "file deleted";
  }

  function videoItem(v) {
    var li = make("li");
    li.appendChild(make("p", (v.label || "Untitled video") + " · " + sizeText(v.bytes) + " · " + statusWord(v)));
    var msg = make("div", "", "bsky-msg");
    var row = make("div", null, "bsky-row");
    if (v.status === "ready") {
      if (!v.youtube_video_id) {
        var prepare = make("button", "Prepare upload", "action-btn");
        prepare.type = "button";
        row.appendChild(prepare);
        var form = uploadForm(v, msg);
        form.hidden = true;
        prepare.addEventListener("click", function () { form.hidden = !form.hidden; });
      }
      var del = make("button", "Delete", "action-btn action-btn--ghost");
      del.type = "button";
      row.appendChild(del);
      li.appendChild(row);
      if (form) li.appendChild(form);
      del.addEventListener("click", function () {
        del.disabled = true;
        call("DELETE", "/api/videos/" + encodeURIComponent(v.id)).then(function (res) {
          if (!res.ok) { del.disabled = false; msg.textContent = errorOf(res); return; }
          loadVideos();
        }, function () { del.disabled = false; msg.textContent = "Deleting didn't finish. Try again."; });
      });
    }
    if (v.youtube_video_id) {
      var ytRow = make("div", null, "bsky-row");
      if (typeof v.youtube_url === "string" && WATCH_RE.test(v.youtube_url)) {
        var link = make("a", v.youtube_url, "masto-post-link");
        link.href = v.youtube_url;
        link.target = "_blank";
        link.rel = "noopener";
        li.appendChild(link);
      }
      var check = make("button", "Check status", "action-btn action-btn--ghost");
      check.type = "button";
      var remove = make("button", "Remove from YouTube", "action-btn action-btn--ghost");
      remove.type = "button";
      ytRow.appendChild(check);
      ytRow.appendChild(remove);
      li.appendChild(ytRow);
      check.addEventListener("click", function () {
        check.disabled = true;
        call("GET", "/api/youtube/videos/" + encodeURIComponent(v.id) + "/status").then(function (res) {
          check.disabled = false;
          if (!res.ok) { msg.textContent = errorOf(res); return; }
          var d = res.data;
          msg.textContent = d.found === false ? (d.message || "YouTube no longer has this video.") :
            "Upload: " + (d.upload_status || "unknown") + ". Privacy: " + (d.privacy_status || "unknown") + ". Processing: " + (d.processing_status || "unknown") + ".";
        }, function () { check.disabled = false; msg.textContent = "The status couldn't be checked. Try again."; });
      });
      remove.addEventListener("click", function () {
        remove.disabled = true;
        call("POST", "/api/youtube/videos/" + encodeURIComponent(v.id) + "/propose-delete", {}).then(function (res) {
          remove.disabled = false;
          msg.textContent = res.ok ? (res.data.note || "Filed for approval.") : errorOf(res);
        }, function () { remove.disabled = false; msg.textContent = "Filing didn't finish. Try again."; });
      });
    }
    li.appendChild(msg);
    // TikTok's side of the same video, from scripts/tiktok.js.
    if (window.BFTikTok && typeof window.BFTikTok.decorate === "function") window.BFTikTok.decorate(li, v, msg);
    return li;
  }

  function field(labelText, control) {
    var label = make("label", labelText);
    label.appendChild(control);
    return label;
  }

  function uploadForm(v, msg) {
    var box = make("div", null, "bsky-sub");
    var title = document.createElement("input");
    title.type = "text"; title.maxLength = 100; title.autocomplete = "off";
    var description = document.createElement("textarea");
    description.rows = 5;
    var tags = document.createElement("input");
    tags.type = "text"; tags.autocomplete = "off"; tags.placeholder = "comma, separated, tags";
    var privacy = document.createElement("select");
    [["private", "Private"], ["unlisted", "Unlisted"], ["public", "Public"]].forEach(function (o, i) {
      var opt = make("option", o[1]);
      opt.value = o[0];
      if (i === 0) opt.selected = true;
      privacy.appendChild(opt);
    });
    var kidsName = "ytKids-" + v.id;
    var kids = make("fieldset");
    kids.appendChild(make("legend", "Made for kids?"));
    var yes = document.createElement("input"); yes.type = "radio"; yes.name = kidsName; yes.value = "yes"; yes.required = true;
    var no = document.createElement("input"); no.type = "radio"; no.name = kidsName; no.value = "no"; no.required = true;
    kids.appendChild(field("Yes", yes));
    kids.appendChild(field("No", no));
    var idea = document.createElement("textarea");
    idea.rows = 2; idea.maxLength = 1000; idea.placeholder = "What is the video about?";

    var fields = make("div", null, "bsky-fields");
    fields.appendChild(field("Title", title));
    fields.appendChild(field("Description", description));
    fields.appendChild(field("Tags", tags));
    fields.appendChild(field("Privacy", privacy));
    box.appendChild(fields);
    box.appendChild(kids);
    box.appendChild(field("What it's about, for the AI draft", idea));

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
      call("POST", "/api/youtube/draft-metadata", { video_id: v.id, idea: idea.value }).then(function (res) {
        draft.disabled = false;
        if (!res.ok || !plainObject(res.data.draft)) { msg.textContent = errorOf(res); return; }
        var d = res.data.draft;
        title.value = typeof d.title === "string" ? d.title : "";
        description.value = typeof d.description === "string" ? d.description : "";
        tags.value = Array.isArray(d.tags) ? d.tags.join(", ") : "";
        msg.textContent = (res.data.note || "A draft only.") + (res.data.within_limits === false ? " Part of it is over YouTube's limits; shorten it before filing." : "");
      }, function () { draft.disabled = false; msg.textContent = "The draft didn't finish. Try again."; });
    });

    file.addEventListener("click", function () {
      if (!yes.checked && !no.checked) { msg.textContent = "Answer \"Made for kids?\" with Yes or No."; return; }
      file.disabled = true;
      var body = {
        video_id: v.id,
        title: title.value,
        description: description.value,
        tags: tags.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean),
        privacy: privacy.value,
        made_for_kids: yes.checked
      };
      call("POST", "/api/youtube/propose-upload", body).then(function (res) {
        file.disabled = false;
        msg.textContent = res.ok ? (res.data.note || "Filed for approval.") : errorOf(res);
      }, function () { file.disabled = false; msg.textContent = "Filing didn't finish. Try again."; });
    });
    return box;
  }

  function init() {
    var btn = el("ytConnectBtn");
    if (!btn) return;
    btn.addEventListener("click", connect);
    var off = el("ytDisconnectBtn");
    if (off) off.addEventListener("click", disconnect);
    var file = el("ytFile");
    if (file) file.addEventListener("change", addVideo);
    var returning = false;
    var rt = returns();
    if (rt) {
      returning = rt.register("youtube", finishReturn);
      // A return no script was waiting for: oauth-return.js stripped it.
      if (rt.orphaned()) tell("ytConnectMsg", START_AGAIN, true);
    }
    if (!returning) loadStatus();
    else call("GET", "/api/youtube/status").then(function (res) { if (res.ok) drawStatus(res.data); }, function () {});
  }

  // For scripts/tiktok.js: the list drawn again, and whether TikTok is set up.
  window.BFVideos = {
    reload: function () { return loadVideos(); },
    setTiktokAvailable: function (on) { state.tiktokAvailable = on === true; fileSwitch(); },
    // NAMED (Nov 7 2026, Instagram posting): Reels come from these videos too.
    setInstagramAvailable: function (on) { state.instagramAvailable = on === true; fileSwitch(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

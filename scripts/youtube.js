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
   NAMED (Nov 12 2026, Social page clean-up): BEFORE the list sat in the
   YouTube card and "Prepare upload" showed on every ready video. AFTER it is
   the "Your videos" card (#videosCard), drawn here for every platform: chips
   and "Prepare for ..." buttons only for connected platforms (see
   BFVideos.register below), one form open at a time, all in the shared form
   style (.sf-control). The YouTube form's payload and rules are unchanged.
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
  var state = { available: false, connected: false, busy: false, tiktokAvailable: false, instagramAvailable: false, facebookAvailable: false };

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
    // NAMED (Nov 12 2026, Social page clean-up): YouTube's chip and buttons show in Your videos only while connected.
    setConnected("youtube", state.connected);
  }

  // The file input: on when either platform a video can go to is set up.
  function fileSwitch() {
    var file = el("ytFile");
    if (file) file.disabled = !(state.available || state.tiktokAvailable || state.instagramAvailable || state.facebookAvailable);
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

  /* ── Your videos: its own card ─────────────────────────────────────────────
     NAMED (Nov 12 2026, Social page clean-up): BEFORE, the list sat inside the
     YouTube card, said YouTube's side in words, and TikTok's script hung its own
     box under each row ("TikTok: not sent" inside YouTube). AFTER, #videosCard
     holds it. Each row is its label and size, one chip per CONNECTED platform,
     and that platform's buttons ("Prepare for YouTube", "Prepare for TikTok",
     "Prepare for Instagram", "Prepare for Facebook"), then Delete. A platform
     that is not connected shows no chip and no button; with none connected a
     ready row says "Connect a platform below to send this video.". Each
     platform script registers { chip(v), actions(v, row) } with
     window.BFVideos.register, and says whether it is connected with
     BFVideos.setConnected. A Prepare button opens that platform's form under
     its row, with a small header, and only one form is open at a time: opening
     another, or drawing the list again, closes it. The routes, the payloads and
     every rule are the ones each platform script always had. */
  var PLATFORMS = ["youtube", "tiktok", "instagram", "facebook"];
  var NONE_CONNECTED = "Connect a platform below to send this video.";
  var connected = { youtube: false, tiktok: false, instagram: false, facebook: false };
  var hooks = {};
  var lastVideos = null;
  var openForm = null;

  function loadVideos() {
    return call("GET", "/api/videos").then(function (res) {
      if (!res.ok) { tell("ytUploadMsg", "Your videos could not be listed. (" + errorOf(res) + ")", true); return; }
      drawVideos(Array.isArray(res.data.videos) ? res.data.videos : []);
    }, function () {
      tell("ytUploadMsg", "Your videos could not be listed. Reload to try again.", true);
    });
  }

  function closeOpenForm() {
    if (!openForm) return;
    var f = openForm;
    openForm = null;
    f.close();
  }

  function drawVideos(videos) {
    lastVideos = videos;
    closeOpenForm();
    var list = el("ytVideoList");
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!videos.length) { list.appendChild(make("li", "No videos yet.", "bsky-quiet")); return; }
    videos.forEach(function (v) { list.appendChild(videoItem(v)); });
  }
  function redraw() { if (lastVideos) drawVideos(lastVideos); }

  /* The one open form: a panel under the row, its header, its body and its own
     messages. The same button again closes it. */
  function toggleForm(key, slot, title, build) {
    var same = !!openForm && openForm.key === key;
    closeOpenForm();
    if (same) return;
    var panel = make("div", null, "sf-panel");
    panel.setAttribute("data-form", key);
    panel.appendChild(make("p", title, "sf-panel-head"));
    var body = make("div", null, "sf-panel-body");
    var fmsg = make("div", "", "bsky-msg");
    panel.appendChild(body);
    panel.appendChild(fmsg);
    slot.appendChild(panel);
    var onClose = [];
    var mine = {
      key: key,
      panel: panel,
      close: function () {
        onClose.forEach(function (f) { try { f(); } catch (e) { /* the panel still goes */ } });
        if (panel.parentNode) panel.parentNode.removeChild(panel);
      }
    };
    openForm = mine;
    build({ body: body, msg: fmsg, onClose: function (f) { onClose.push(f); }, isOpen: function () { return openForm === mine; } });
  }

  function videoItem(v) {
    var li = make("li");
    li.setAttribute("data-video-id", String(v.id));
    li.appendChild(make("p", (v.label || "Untitled video") + " · " + sizeText(v.bytes) + (v.status === "ready" ? "" : " · file deleted"), "sf-video-title"));
    var chips = make("div", null, "sf-chips");
    var links = make("div", null, "sf-links");
    var notes = make("div", null, "sf-notes");
    var actions = make("div", null, "bsky-row");
    var slot = make("div", null, "sf-slot");
    var msg = make("div", "", "bsky-msg");
    var row = {
      msg: msg,
      button: function (text, ghost) {
        var b = make("button", text, ghost ? "action-btn action-btn--ghost" : "action-btn");
        b.type = "button";
        actions.appendChild(b);
        return b;
      },
      link: function (url) {
        var a = make("a", url, "masto-post-link");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        links.appendChild(a);
        return a;
      },
      note: function (text) { notes.appendChild(make("p", text, "sf-note")); },
      prepare: function (platform, text, title, build) {
        var b = row.button(text, false);
        b.setAttribute("data-prepare", platform);
        b.addEventListener("click", function () { toggleForm(v.id + ":" + platform, slot, title, build); });
        return b;
      }
    };
    var any = false;
    PLATFORMS.forEach(function (name) {
      var hook = hooks[name];
      if (!connected[name] || !hook) return;
      any = true;
      var c = hook.chip(v);
      if (c) {
        var chip = make("span", c.text, "sf-chip sf-chip--" + (c.tone || "off"));
        chip.setAttribute("data-platform", name);
        chips.appendChild(chip);
      }
      hook.actions(v, row);
    });
    if (!any && v.status === "ready") row.note(NONE_CONNECTED);
    if (v.status === "ready") {
      var del = row.button("Delete", true);
      del.addEventListener("click", function () {
        del.disabled = true;
        call("DELETE", "/api/videos/" + encodeURIComponent(v.id)).then(function (res) {
          if (!res.ok) { del.disabled = false; msg.textContent = errorOf(res); return; }
          loadVideos();
        }, function () { del.disabled = false; msg.textContent = "Deleting didn't finish. Try again."; });
      });
    }
    if (chips.firstChild) li.appendChild(chips);
    if (links.firstChild) li.appendChild(links);
    if (notes.firstChild) li.appendChild(notes);
    if (actions.firstChild) li.appendChild(actions);
    li.appendChild(slot);
    li.appendChild(msg);
    return li;
  }

  /* YouTube's own side of a row. */
  hooks.youtube = {
    chip: function (v) {
      if (v.youtube_video_id) return { text: "YouTube: uploaded", tone: "ok" };
      if (v.upload_unfinished) return { text: "YouTube: upload unfinished", tone: "wait" };
      return { text: "YouTube: not sent", tone: "off" };
    },
    actions: function (v, row) {
      if (v.status === "ready" && !v.youtube_video_id) {
        row.prepare("youtube", "Prepare for YouTube", "YouTube upload", function (shell) { uploadForm(v, shell); });
      }
      if (!v.youtube_video_id) return;
      if (typeof v.youtube_url === "string" && WATCH_RE.test(v.youtube_url)) row.link(v.youtube_url);
      var msg = row.msg;
      var check = row.button("Check status", true);
      var remove = row.button("Remove from YouTube", true);
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
  };

  /* ── the YouTube upload form (the shared form style) ───────────────────── */
  var IDEA_LABEL = "Describe the video for the AI writer";
  var IDEA_PLACEHOLDER = "For example: a 30-second clip showing our herbal oil and how to use it";

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

  /* "Made for kids?": a segmented Yes / No built on two required radio inputs
     in a role="radiogroup", labelled above like every other field. The arrow
     keys move the choice; nothing is chosen until the member chooses. */
  function kidsChoice(name, labelId) {
    var wrap = make("div", null, "sf-field");
    var label = make("span", "Made for kids?", "sf-label");
    label.id = labelId;
    var group = make("div", null, "sf-seg");
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-labelledby", labelId);
    group.setAttribute("aria-required", "true");
    var radios = [];
    [["yes", "Yes"], ["no", "No"]].forEach(function (o) {
      var opt = make("label", null, "sf-seg-opt");
      var r = document.createElement("input");
      r.type = "radio"; r.name = name; r.value = o[0]; r.required = true;
      r.className = "sf-control sf-seg-input";
      opt.appendChild(r);
      opt.appendChild(make("span", o[1]));
      group.appendChild(opt);
      radios.push(r);
    });
    group.addEventListener("keydown", function (e) {
      var k = e && e.key;
      var step = (k === "ArrowRight" || k === "ArrowDown") ? 1 : ((k === "ArrowLeft" || k === "ArrowUp") ? -1 : 0);
      if (!step) return;
      if (typeof e.preventDefault === "function") e.preventDefault();
      var at = -1;
      radios.forEach(function (r, i) { if (r.checked) at = i; });
      var next = radios[at === -1 ? (step > 0 ? 0 : radios.length - 1) : (at + step + radios.length) % radios.length];
      radios.forEach(function (r) { r.checked = r === next; });
      if (typeof next.focus === "function") next.focus();
    });
    wrap.appendChild(label);
    wrap.appendChild(group);
    return { node: wrap, yes: radios[0], no: radios[1] };
  }

  function uploadForm(v, shell) {
    var msg = shell.msg;
    var form = make("div", null, "sf-form");
    var idp = "yt-" + v.id + "-";
    var idea = control(document.createElement("textarea"));
    idea.rows = 3; idea.maxLength = 1000; idea.placeholder = IDEA_PLACEHOLDER;
    var title = control(document.createElement("input"));
    title.type = "text"; title.maxLength = 100; title.autocomplete = "off";
    var description = control(document.createElement("textarea"));
    description.rows = 5;
    var tags = control(document.createElement("input"));
    tags.type = "text"; tags.autocomplete = "off"; tags.placeholder = "comma, separated, tags";
    var privacy = control(document.createElement("select"));
    [["private", "Private"], ["unlisted", "Unlisted"], ["public", "Public"]].forEach(function (o, i) {
      var opt = make("option", o[1]);
      opt.value = o[0];
      if (i === 0) opt.selected = true;
      privacy.appendChild(opt);
    });
    var kids = kidsChoice("ytKids-" + v.id, idp + "kids");
    var yes = kids.yes, no = kids.no;

    var helper = field(IDEA_LABEL, idea, idp + "idea");
    var under = make("div", null, "sf-under");
    var draft = make("button", "Draft with AI", "action-btn action-btn--ghost");
    draft.type = "button";
    under.appendChild(draft);
    helper.appendChild(under);
    form.appendChild(helper);
    form.appendChild(field("Title", title, idp + "title"));
    form.appendChild(field("Description", description, idp + "description"));
    form.appendChild(field("Tags", tags, idp + "tags"));
    form.appendChild(field("Privacy", privacy, idp + "privacy"));
    form.appendChild(kids.node);
    var actions = make("div", null, "sf-actions");
    var file = make("button", "File for approval", "action-btn");
    file.type = "button";
    actions.appendChild(file);
    form.appendChild(actions);
    shell.body.appendChild(form);

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
    return form;
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

  function setConnected(name, on) {
    if (!Object.prototype.hasOwnProperty.call(connected, name)) return;
    var was = connected[name];
    connected[name] = on === true;
    if (was !== connected[name]) redraw();
  }

  // For scripts/tiktok.js: the list drawn again, and whether TikTok is set up.
  window.BFVideos = {
    reload: function () { return loadVideos(); },
    // NAMED (Nov 12 2026, Social page clean-up): each video platform registers its side of a row, and says when it is connected.
    register: function (name, hook) {
      if (PLATFORMS.indexOf(name) === -1 || !hook || typeof hook.chip !== "function" || typeof hook.actions !== "function") return;
      hooks[name] = hook;
      redraw();
    },
    setConnected: setConnected,
    closeForm: function () { closeOpenForm(); },
    setTiktokAvailable: function (on) { state.tiktokAvailable = on === true; fileSwitch(); },
    // NAMED (Nov 7 2026, Instagram posting): Reels come from these videos too.
    setInstagramAvailable: function (on) { state.instagramAvailable = on === true; fileSwitch(); },
    // NAMED (Nov 7 2026, Facebook Pages posting): Facebook video posts come from these videos too.
    setFacebookAvailable: function (on) { state.facebookAvailable = on === true; fileSwitch(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

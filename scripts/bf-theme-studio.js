/* scripts/bf-theme-studio.js — Settings → Theme.

   The member builds a look from a spectrum (the top-left glow, the middle
   tone and the bottom-right glow, each with its opacity and size) and the
   middle backdrop (black, a colour, or their own photo, placed and softened
   in the photo editor), turns "Alive corners" on or off and picks how they
   move, saves it under a name, and applies it to all pages, this page, or
   the pages they tick. Every change shows at once in the preview, motion and
   photo included, with the readability meter beside it.

   NOTHING IS DECIDED HERE that the server does not check again: the theme is
   validated by lib/themes.js before it is stored, the photo is checked by its
   bytes, and the page list comes from the server, which reads it from the app
   map (lib/appMap.json), so a page added to the app appears in the checklist
   without a change here.

   The arithmetic (tokens, readability, the middle tone, the presets) is
   scripts/bf-theme.js's, loaded first on this page, so the preview and the
   meter use exactly what every page uses.

   THE PRESETS are BFTheme.PRESETS: Original and ten three-colour spectrums,
   each a whole palette. A card paints its own spectrum from its colours.

   THE MIDDLE TONE. With "Auto" ticked it is BFTheme.midTone of the two
   corners (the OKLCH midpoint, lib/themes.js's header gives the rule) and
   follows them; choosing a colour by hand unticks it. Its "Centre glow" is a
   soft glow of that tone in the middle of the page, 0% by default.

   THE PHOTO EDITOR. Fill, Fit whole or Custom; Zoom 50 … 300% (moving it
   makes the fit Custom); the focal point, dragged on the pad or moved with
   the arrow keys (Shift for bigger steps), + and - to zoom; Blur 0 … 20 px;
   Feathered edges 0 … 50%; Dim. All are numbers in the theme, turned into
   CSS by BFTheme.tokensFor, so the preview is the page.

   EVERY COLOUR (Block 4b, three colours each since 4d). Below the corners,
   six parts: "Buttons", "Termaximus mist", "Chat glow", "Guide text",
   "BizForceAI wordmark" and "Headings and accents". Each has eleven presets
   (Original, and each preset's own colours for that part), its own colours
   (a picker and a hex field each, a middle among them), "Match my theme"
   (that part from the member's own spectrum) and a reset ("Reset this
   element"; for the mist, "Reset mist to original"). "Match everything"
   derives every part from the spectrum at once (bf-theme.js matchAll, the
   same rule as lib/themes.js); while it is on, the parts follow the corners
   and their controls rest; turning it off keeps the derived colours to tune
   by hand. They are keys of the same saved theme, so every part goes where
   the theme goes: all pages, this page, or the pages ticked.

   "Reset everything to the original" puts every page back on the original
   look, and the editor back on DEFAULT_THEME: every field, the 4d ones
   included. */
(function () {
  "use strict";

  var T = window.BFTheme;
  var root = document.getElementById("panel-theme");
  if (!T || !root) return;

  var PRESETS = T.PRESETS;
  var GROUP_LABELS = {
    hq: "Dashboard & HQ",
    agents: "Agent pages",
    money: "Money (wallet, billing, marketplace)",
    content: "Content & tools",
    account: "Account"
  };
  /* The element parts: each colour key with the id of its picker and hex
     field (<id>Color, <id>Hex) in settings.html. */
  var PARTS = {
    buttons: [["btn_a", "tsBtnA"], ["btn_mid", "tsBtnMid"], ["btn_b", "tsBtnB"], ["btn_text", "tsBtnText"]],
    mist: [["mist_core", "tsMistCore"], ["mist_haze", "tsMistHaze"], ["mist_pulse", "tsMistPulse"], ["mist_spark", "tsMistSpark"],
      ["mist_star", "tsMistStar"], ["mist_dust", "tsMistDust"], ["mist_trail", "tsMistTrail"], ["mist_whisper", "tsMistWhisper"]],
    chat: [["chat_glow_a", "tsChatA"], ["chat_glow_mid", "tsChatMid"], ["chat_glow_b", "tsChatB"]],
    guide: [["guide_a", "tsGuideA"], ["guide_mid", "tsGuideMid"], ["guide_b", "tsGuideB"]],
    mark: [["mark_a", "tsMarkA"], ["mark_mid", "tsMarkMid"], ["mark_b", "tsMarkB"]],
    accent: [["accent_a", "tsAccentA"], ["accent_mid", "tsAccentMid"], ["accent_b", "tsAccentB"]]
  };
  var PART_NAMES = { buttons: "Buttons", mist: "Termaximus mist", chat: "Chat glow", guide: "Guide text", mark: "BizForceAI wordmark", accent: "Headings and accents" };
  var MOTION_NOTES = {
    breathe: "Breathe: a slow pulse, about once every half minute.",
    drift: "Drift: the glows travel a slow orbit around their corners.",
    aurora: "Aurora: soft ribbons of your three colours sway through the glows.",
    nebula: "Nebula: a swirl of your three colours turns slowly around the middle."
  };
  function presetById(id) { return PRESETS.filter(function (p) { return p.id === id; })[0] || null; }
  /* A part's preset: "original" is today's colours; any other is that
     preset's own colours for the part. */
  function partPreset(part, id) {
    var from = id === "original" ? T.DEFAULT_THEME : (presetById(id) || {}).theme;
    if (!from) return null;
    var out = {};
    PARTS[part].forEach(function (p) { out[p[0]] = from[p[0]]; });
    return out;
  }
  function partFromCorners(part) {
    var d = T.matchAll(editing.glow_a, editing.glow_b, editing.glow_mid), out = {};
    PARTS[part].forEach(function (p) { out[p[0]] = d[p[0]]; });
    return out;
  }
  var PHOTO_MAX = 5 * 1024 * 1024;
  var PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function $(id) { return document.getElementById(id); }
  /* Every request goes to the API's own origin: bf-theme.js's apiOrigin, the
     base every page uses (window.API_URL, else the Railway backend). Never a
     relative "/api/...": settings.html keeps its API_URL inside its own
     function, so window.API_URL is unset here, and a relative path goes to
     Netlify, which answers 404. */
  function api() { return T.apiOrigin(); }
  function authHeaders(json) {
    var h = { "Authorization": "Bearer " + (localStorage.getItem("bf_token") || "") };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }
  /* A failure names what failed and its status, so the next one explains
     itself: "Couldn't save (404). Try again." The server's own words are kept
     when it sent some. An answer that is not JSON is a failure too. */
  var DOING = { GET: "load your themes", POST: "save", PUT: "save", DELETE: "delete" };
  function send(what, path, opts) {
    var base = api();
    if (!base) return Promise.reject(new Error("Couldn't " + what + " (no API address). Try again."));
    return fetch(base + path, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (res.ok && data) return data;
        if (data && typeof data.error === "string" && data.error) throw new Error(data.error + " (" + res.status + ")");
        throw new Error("Couldn't " + what + " (" + res.status + (res.ok ? ", not JSON" : "") + "). Try again.");
      });
    }, function () { throw new Error("Couldn't " + what + " (no connection). Try again."); });
  }
  function call(method, path, body, what) {
    return send(what || DOING[method], path, { method: method, headers: authHeaders(body !== undefined), body: body !== undefined ? JSON.stringify(body) : undefined });
  }

  /* ── what the editor holds ──────────────────────────────────────────── */
  var state = null;            // the last answer from /api/themes
  var editing = clone(T.DEFAULT_THEME);
  var editingId = null;        // the saved theme being edited, if any
  var savedSnapshot = null;    // its theme as saved, to tell an unsaved change
  var photoUrl = null;         // the editing theme's photo, for the preview

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  /* A saved theme as the editor holds it: every key, read as the pages read
     it (a theme saved before Block 4d keeps its look). */
  function full(theme) { return Object.assign(clone(T.DEFAULT_THEME), T.normalTheme(theme), { photo: theme && theme.photo !== undefined ? theme.photo : null }); }
  function hexOk(v) { return /^#[0-9a-f]{6}$/.test(v); }
  function say(id, text, kind) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || "";
    el.className = "msg" + (kind ? " " + kind : "");
  }
  function pageName(key) {
    var list = (state && state.pages) || [];
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return list[i].name;
    return key.replace(/\.html$/, "");
  }
  function themeName(id) {
    var list = (state && state.themes) || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].name;
    return null;
  }

  /* "This page" is the page the member came from (?page=, or the page that
     linked here), else Settings itself. */
  function thisPageKey() {
    var keys = ((state && state.pages) || []).map(function (p) { return p.key; });
    var asked = null;
    try { asked = new URLSearchParams(window.location.search).get("page"); } catch (e) { asked = null; }
    if (asked && keys.indexOf(asked) !== -1) return asked;
    try {
      var ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin) {
        var file = ref.pathname.split("/").pop() || "index.html";
        if (!/\.html$/.test(file)) file += ".html";
        if (keys.indexOf(file) !== -1 && file !== "settings.html") return file;
      }
    } catch (e) { /* no referrer */ }
    return "settings.html";
  }

  /* A spectrum as a picture: its three colours as a band, over its corner
     glows on the black middle. */
  function spectrum(t) {
    var a = T.rgbOf(t.glow_a).join(", "), b = T.rgbOf(t.glow_b).join(", ");
    return "linear-gradient(90deg, " + t.glow_a + ", " + t.glow_mid + ", " + t.glow_b + ") center 78% / 100% 30% no-repeat, " +
      "radial-gradient(circle at 15% 10%, rgba(" + a + ", 0.6), transparent 60%), radial-gradient(circle at 85% 90%, rgba(" + b + ", 0.6), transparent 60%), #070b18";
  }

  /* ── preview and meter ──────────────────────────────────────────────── */
  /* What the meter says about each part. */
  function elementLines(r) {
    var e = r.elements, lines = [];
    var b = e.buttons;
    lines.push(b.original ? "Buttons: the original look."
      : "Button text " + b.ratio.toFixed(1) + ":1" + (b.fix === "text" ? ", set to " + (b.text === T.WHITE ? "white" : "near-black") + " so it stays clear."
        : b.fix === "shade" ? ", white on a gradient shaded a little so it stays clear." : "."));
    [["guide", "Guide text"], ["mark", "Wordmark"], ["accent", "Headings and accents"]].forEach(function (x) {
      var g = e[x[0]];
      lines.push(x[1] + " " + g.ratio.toFixed(1) + ":1" + (g.original ? " (the original)." : g.fix ? ", lightened so it stays clear." : "."));
    });
    return lines;
  }
  function pct(n) { return Math.round(n * 100) + "%"; }

  function render() {
    var preview = $("tsPreview");
    /* The preview starts from every token at the original, so it never shows
       the theme this page itself is wearing, and it moves only by its own
       Alive switch (the page's motion follows the page's theme). */
    var tokens = Object.assign(T.originalTokens(), T.tokensFor(editing, photoUrl, window));
    T.BACKDROP_4D_TOKENS.forEach(function (k) { if (tokens[k] === undefined) preview.style.removeProperty(k); });
    Object.keys(tokens).forEach(function (k) { preview.style.setProperty(k, tokens[k]); });
    preview.setAttribute("data-alive", tokens["--bf-alive"]);
    preview.setAttribute("data-motion", editing.motion);

    var r = T.readability(editing);
    var stateEl = $("tsMeterState");
    var guarded = r.protected || r.elementsFixed;
    stateEl.textContent = guarded ? "Auto-protected" : "Readable";
    $("tsMeter").setAttribute("data-state", guarded ? "protected" : "readable");
    $("tsMeterRatios").textContent =
      "Text " + r.ratios.text.toFixed(1) + ":1 · Muted text " + r.ratios.muted.toFixed(1) + ":1 · Accent " + r.ratios.accent.toFixed(1) + ":1";
    $("tsMeterNote").textContent = (r.protected
      ? "This backdrop is bright, so it is shaded just enough for text to stay clear (at least 7:1, and 4.5:1 for muted text). Your colours are kept."
      : "Text stays clear on this backdrop: at least 7:1, and 4.5:1 for muted text.") +
      (r.elementsFixed ? " Some parts were adjusted to stay readable (button text and guide text 4.5:1, the wordmark and accents 3:1); each is listed here." : "");
    var list = $("tsMeterElements");
    list.innerHTML = "";
    elementLines(r).forEach(function (line) { var li = document.createElement("li"); li.textContent = line; list.appendChild(li); });

    Object.keys(PARTS).forEach(function (part) {
      PARTS[part].forEach(function (p) {
        $(p[1] + "Color").value = editing[p[0]]; $(p[1] + "Hex").value = editing[p[0]];
        $(p[1] + "Color").disabled = editing.match_all === true; $(p[1] + "Hex").disabled = editing.match_all === true;
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll(".ts-el-preset"), function (btn) {
      var part = btn.getAttribute("data-el"), want = partPreset(part, btn.getAttribute("data-preset"));
      btn.setAttribute("aria-pressed", want && Object.keys(want).every(function (k) { return editing[k] === want[k]; }) ? "true" : "false");
      btn.disabled = editing.match_all === true;
    });
    $("tsMatchAll").checked = editing.match_all === true;

    $("tsGlowAColor").value = editing.glow_a; $("tsGlowAHex").value = editing.glow_a;
    $("tsGlowBColor").value = editing.glow_b; $("tsGlowBHex").value = editing.glow_b;
    $("tsGlowMidColor").value = editing.glow_mid; $("tsGlowMidHex").value = editing.glow_mid;
    $("tsMidAuto").checked = editing.mid_auto === true;
    $("tsBgColor").value = editing.bg; $("tsBgHex").value = editing.bg;
    [["tsGlowAAlpha", "glow_a_alpha"], ["tsGlowBAlpha", "glow_b_alpha"], ["tsGlowMidAlpha", "glow_mid_alpha"], ["tsDim", "dim"], ["tsMotionIntensity", "motion_intensity"]].forEach(function (x) {
      $(x[0]).value = Math.round(editing[x[1]] * 100); $(x[0] + "Out").textContent = pct(editing[x[1]]);
    });
    [["tsGlowASize", "glow_a_size", "%"], ["tsGlowBSize", "glow_b_size", "%"], ["tsGlowMidSize", "glow_mid_size", "%"], ["tsZoom", "photo_zoom", "%"],
     ["tsBlur", "photo_blur", " px"], ["tsFeather", "photo_feather", "%"]].forEach(function (x) {
      $(x[0]).value = editing[x[1]]; $(x[0] + "Out").textContent = editing[x[1]] + x[2];
    });
    $("tsMotionSpeed").value = Math.round(editing.motion_speed * 100); $("tsMotionSpeedOut").textContent = pct(editing.motion_speed);
    $("tsAlive").checked = editing.alive === true;
    $("tsAliveNote").textContent = T.reducedMotion()
      ? "Your device asks for reduced motion, so the corners stay still here and on every page."
      : "The corner glows move in the style you pick below.";
    $("tsMotionNote").textContent = MOTION_NOTES[editing.motion] || "";
    Array.prototype.forEach.call(root.querySelectorAll("input[name=tsMotion]"), function (r2) { r2.checked = r2.value === editing.motion; });
    Array.prototype.forEach.call(root.querySelectorAll("input[name=tsFit]"), function (r2) { r2.checked = r2.value === editing.photo_fit; });
    Array.prototype.forEach.call(root.querySelectorAll("input[name=tsMiddle]"), function (r2) { r2.checked = r2.value === editing.middle; });
    $("tsColourRow").hidden = editing.middle !== "colour";
    $("tsPhotoRow").hidden = editing.middle !== "photo";
    $("tsPhotoStatus").textContent = editing.photo ? "Your photo is set." : "No photo yet.";
    var dot = $("tsFocusDot");
    dot.style.left = editing.photo_x + "%"; dot.style.top = editing.photo_y + "%";
    $("tsFocus").style.setProperty("--ts-focus-image", tokens["--bf-bg-image"] || "none");
    $("tsFocusOut").textContent = "Focal point " + editing.photo_x + "% across, " + editing.photo_y + "% down.";
    Array.prototype.forEach.call(root.querySelectorAll(".ts-preset"), function (b) {
      var p = presetById(b.getAttribute("data-preset"));
      var same = p && T.PRESET_KEYS.every(function (k) { return editing[k] === p.theme[k]; });
      b.setAttribute("aria-pressed", same ? "true" : "false");
    });
    var dirty = editingId && JSON.stringify(editing) !== JSON.stringify(savedSnapshot);
    $("tsUpdate").hidden = !editingId;
    $("tsUpdate").disabled = !dirty;
    $("tsEditing").textContent = editingId
      ? "Editing \"" + (themeName(editingId) || "your theme") + "\"" + (dirty ? " (unsaved changes)" : "") + "."
      : "Not saved yet.";
  }

  /* The middle tone follows the corners while "Auto" is ticked, and with
     "Match everything" on, every part follows the spectrum. */
  function followCorners() {
    if (editing.mid_auto === true) editing.glow_mid = T.midTone(editing.glow_a, editing.glow_b);
    if (editing.match_all !== true) return;
    var d = T.matchAll(editing.glow_a, editing.glow_b, editing.glow_mid);
    Object.keys(d).forEach(function (k) { editing[k] = d[k]; });
  }
  function set(key, value) { editing[key] = value; followCorners(); render(); }
  function setPart(values) { Object.keys(values).forEach(function (k) { editing[k] = values[k]; }); render(); }
  function clampTo(key, n) { var r = T.RANGES[key]; return Math.min(r[1], Math.max(r[0], Math.round(n * 1000) / 1000)); }

  function wireColour(pickerId, hexId, key) {
    $(pickerId).addEventListener("input", function () { if (key === "glow_mid") editing.mid_auto = false; set(key, this.value.toLowerCase()); });
    $(hexId).addEventListener("change", function () {
      var v = this.value.trim().toLowerCase();
      if (v && v[0] !== "#") v = "#" + v;
      if (hexOk(v)) { if (key === "glow_mid") editing.mid_auto = false; set(key, v); say("tsMsg", ""); }
      else { this.value = editing[key]; say("tsMsg", "A colour is # and six hex digits, like #1a2b3c.", "err"); }
    });
  }
  /* A range input onto a theme number, divided by `scale` (100 for a percentage). */
  function wireRange(id, key, scale) {
    $(id).addEventListener("input", function () { set(key, clampTo(key, Number(this.value) / scale)); });
  }

  /* ── the photo: checked here, sampled for its brightest point, uploaded ─ */
  function sampleLuma(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var c = document.createElement("canvas");
          c.width = 32; c.height = 32;
          var ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, 32, 32);
          var d = ctx.getImageData(0, 0, 32, 32).data, max = 0;
          for (var i = 0; i < d.length; i += 4) max = Math.max(max, T.luminance([d[i], d[i + 1], d[i + 2]]));
          resolve(Math.round(max * 1000) / 1000);
        } catch (e) { resolve(1); }   // unreadable: assume the brightest, so protection is on
        URL.revokeObjectURL(url);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }
  function choosePhoto(file) {
    if (!file) return;
    if (PHOTO_TYPES.indexOf(file.type) === -1) return say("tsPhotoMsg", "A backdrop photo must be a JPEG, PNG or WebP.", "err");
    if (file.size > PHOTO_MAX) return say("tsPhotoMsg", "A backdrop photo is at most 5 MB.", "err");
    say("tsPhotoMsg", "Uploading…");
    sampleLuma(file).then(function (luma) {
      if (luma === null) throw new Error("That photo could not be opened.");
      var form = new FormData();
      form.append("photo", file);
      return send("upload the photo", "/api/themes/photo", { method: "POST", headers: authHeaders(false), body: form })
        .then(function (data) {
          editing.photo = data.path; editing.photo_luma = luma; editing.middle = "photo";
          photoUrl = data.url;
          say("tsPhotoMsg", "Photo ready. Save the theme to keep it.", "ok");
          render();
        });
    }).catch(function (err) { say("tsPhotoMsg", err.message, "err"); });
  }
  /* The focal point: where on the pad the pointer is, in whole percent. */
  function focusAt(e) {
    var box = $("tsFocus").getBoundingClientRect();
    if (!box.width || !box.height) return;
    editing.photo_x = clampTo("photo_x", Math.round((e.clientX - box.left) / box.width * 100));
    editing.photo_y = clampTo("photo_y", Math.round((e.clientY - box.top) / box.height * 100));
    render();
  }
  function zoomBy(step) {
    editing.photo_fit = "custom";
    editing.photo_zoom = clampTo("photo_zoom", editing.photo_zoom + step);
    render();
  }

  /* ── saved themes ───────────────────────────────────────────────────── */
  function loadTheme(row) {
    editing = full(row.theme);
    editingId = row.id;
    savedSnapshot = clone(editing);
    photoUrl = row.photo_url || null;
    $("tsName").value = row.name;
    render();
  }
  function took(next, message) {
    state = next;
    T.stateChanged(next);
    drawSaved(); drawPages(); drawAssignments();
    if (editingId) {
      var row = next.themes.filter(function (t) { return t.id === editingId; })[0];
      if (row) { savedSnapshot = full(row.theme); photoUrl = row.photo_url || photoUrl; }
      else { editingId = null; savedSnapshot = null; }
    }
    render();
    if (message) say("tsMsg", message, "ok");
  }
  function drawSaved() {
    var list = $("tsSavedList");
    list.innerHTML = "";
    var themes = state.themes || [];
    $("tsSavedEmpty").hidden = themes.length > 0;
    themes.forEach(function (row) {
      var li = document.createElement("li");
      li.className = "ts-saved";
      var name = document.createElement("span");
      name.className = "ts-saved-name";
      name.textContent = row.name + (state.default_theme_id === row.id ? " — main theme" : "");
      var swatch = document.createElement("span");
      swatch.className = "ts-swatch";
      swatch.setAttribute("aria-hidden", "true");
      var t = full(row.theme);
      swatch.style.background = "linear-gradient(135deg," + t.glow_a + "," + t.glow_mid + "," + t.glow_b + ")";
      var edit = button("Edit", "Edit " + row.name, function () { loadTheme(row); say("tsMsg", "Editing \"" + row.name + "\"."); $("tsGlowAColor").focus(); });
      var rename = button("Rename", "Rename " + row.name, function () { startRename(li, row); });
      var del = button("Delete", "Delete " + row.name, function () {
        if (del.getAttribute("data-confirm") !== "1") {
          del.setAttribute("data-confirm", "1"); del.textContent = "Confirm delete";
          del.setAttribute("aria-label", "Confirm deleting " + row.name);
          return;
        }
        call("DELETE", "/api/themes/" + encodeURIComponent(row.id)).then(function (next) { took(next, "\"" + row.name + "\" deleted. Pages that wore it went back to the main theme."); })
          .catch(function (err) { say("tsMsg", err.message, "err"); });
      });
      del.classList.add("btn-danger");
      li.appendChild(swatch); li.appendChild(name); li.appendChild(edit); li.appendChild(rename); li.appendChild(del);
      list.appendChild(li);
    });
  }
  function button(text, label, onClick) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "btn ts-small"; b.textContent = text;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", onClick);
    return b;
  }
  function startRename(li, row) {
    li.innerHTML = "";
    var input = document.createElement("input");
    input.type = "text"; input.maxLength = 60; input.value = row.name;
    input.setAttribute("aria-label", "New name for " + row.name);
    var save = button("Save name", "Save the new name", function () {
      call("PUT", "/api/themes/" + encodeURIComponent(row.id), { name: input.value }, "rename")
        .then(function (next) { took(next, "Renamed."); })
        .catch(function (err) { say("tsMsg", err.message, "err"); });
    });
    var cancel = button("Cancel", "Keep the name " + row.name, function () { drawSaved(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") save.click(); if (e.key === "Escape") cancel.click(); });
    li.appendChild(input); li.appendChild(save); li.appendChild(cancel);
    input.focus(); input.select();
  }

  /* ── which pages ────────────────────────────────────────────────────── */
  function drawPages() {
    var box = $("tsPageGroups");
    box.innerHTML = "";
    var pages = state.pages || [];
    Object.keys(GROUP_LABELS).forEach(function (g) {
      var inGroup = pages.filter(function (p) { return p.group === g; });
      if (!inGroup.length) return;
      var fs = document.createElement("fieldset");
      fs.className = "ts-group";
      var lg = document.createElement("legend");
      lg.textContent = GROUP_LABELS[g];
      fs.appendChild(lg);
      inGroup.forEach(function (p) {
        var label = document.createElement("label");
        label.className = "ts-check";
        var cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = p.key; cb.setAttribute("data-group", p.group);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(" " + p.name));
        fs.appendChild(label);
      });
      box.appendChild(fs);
    });
    $("tsThisPageName").textContent = pageName(thisPageKey());
  }
  function drawAssignments() {
    var list = $("tsAssignments");
    list.innerHTML = "";
    $("tsMainTheme").textContent = state.default_theme_id ? "Main theme: " + themeName(state.default_theme_id) + "." : "Main theme: the original look.";
    var keys = Object.keys(state.page_themes || {}).sort(function (a, b) { return pageName(a).localeCompare(pageName(b)); });
    $("tsAssignmentsEmpty").hidden = keys.length > 0;
    keys.forEach(function (k) {
      var li = document.createElement("li");
      li.className = "ts-assigned";
      var text = document.createElement("span");
      text.textContent = pageName(k) + " — " + (themeName(state.page_themes[k]) || "a theme");
      li.appendChild(text);
      li.appendChild(button("Reset this page to the main theme", "Reset " + pageName(k) + " to the main theme", function () {
        call("POST", "/api/themes/reset", { scope: "page", pages: [k] }, "reset")
          .then(function (next) { took(next, pageName(k) + " wears the main theme again."); })
          .catch(function (err) { say("tsMsg", err.message, "err"); });
      }));
      list.appendChild(li);
    });
  }
  function scope() {
    var picked = root.querySelector("input[name=tsScope]:checked");
    return picked ? picked.value : "all";
  }

  /* ── wiring ─────────────────────────────────────────────────────────── */
  PRESETS.forEach(function (p) {
    var b = document.querySelector(".ts-preset[data-preset=\"" + p.id + "\"]");
    if (!b) return;
    var sw = b.querySelector(".ts-preset-swatch");
    if (sw) sw.style.background = spectrum(p.theme);
    b.addEventListener("click", function () {
      T.PRESET_KEYS.forEach(function (k) { editing[k] = p.theme[k]; });
      if (!editingId) $("tsName").value = p.name;
      followCorners();
      render();
    });
  });
  wireColour("tsGlowAColor", "tsGlowAHex", "glow_a");
  wireColour("tsGlowBColor", "tsGlowBHex", "glow_b");
  wireColour("tsGlowMidColor", "tsGlowMidHex", "glow_mid");
  wireColour("tsBgColor", "tsBgHex", "bg");
  $("tsMidAuto").addEventListener("change", function () { set("mid_auto", this.checked); });

  /* ── every colour: the parts ────────────────────────────────────────── */
  Object.keys(PARTS).forEach(function (part) {
    PARTS[part].forEach(function (p) { wireColour(p[1] + "Color", p[1] + "Hex", p[0]); });
    /* Eleven presets: Original, then each preset's own colours for this part. */
    var box = root.querySelector("[data-el-presets=\"" + part + "\"]");
    if (!box) return;
    PRESETS.forEach(function (p) {
      var want = partPreset(part, p.id);
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "ts-el-preset";
      btn.setAttribute("data-el", part); btn.setAttribute("data-preset", p.id); btn.setAttribute("aria-pressed", "false");
      var sw = document.createElement("span");
      sw.className = "ts-el-swatch"; sw.setAttribute("aria-hidden", "true");
      var cols = Object.keys(want).filter(function (k) { return k !== "btn_text"; }).map(function (k) { return want[k]; }).slice(0, 3);
      sw.style.background = "linear-gradient(135deg," + cols.join(",") + ")";
      btn.appendChild(sw);
      btn.appendChild(document.createTextNode(p.name));
      btn.addEventListener("click", function () { setPart(want); });
      box.appendChild(btn);
    });
  });
  Array.prototype.forEach.call(root.querySelectorAll("[data-el-match]"), function (btn) {
    btn.addEventListener("click", function () {
      var part = btn.getAttribute("data-el-match");
      setPart(partFromCorners(part));
      say("tsMsg", "“" + PART_NAMES[part] + "” now matches your spectrum.", "ok");
    });
  });
  Array.prototype.forEach.call(root.querySelectorAll("[data-el-reset]"), function (btn) {
    btn.addEventListener("click", function () {
      var part = btn.getAttribute("data-el-reset");
      var wasMatching = editing.match_all === true;
      editing.match_all = false;   // or the corners would take the part straight back
      setPart(partPreset(part, "original"));
      say("tsMsg", (part === "mist" ? "The mist is back to its original colours." : "“" + PART_NAMES[part] + "” is back to the original.") +
        (wasMatching ? " \"Match everything\" is off, so it stays that way." : ""), "ok");
    });
  });
  $("tsMatchAll").addEventListener("change", function () {
    editing.match_all = this.checked;
    followCorners();
    render();
    say("tsMsg", this.checked ? "Every part now takes its colours from your spectrum." : "\"Match everything\" is off. The colours stay as they are, for you to fine-tune.", "ok");
  });
  wireRange("tsGlowAAlpha", "glow_a_alpha", 100);
  wireRange("tsGlowBAlpha", "glow_b_alpha", 100);
  wireRange("tsGlowMidAlpha", "glow_mid_alpha", 100);
  wireRange("tsGlowASize", "glow_a_size", 1);
  wireRange("tsGlowBSize", "glow_b_size", 1);
  wireRange("tsGlowMidSize", "glow_mid_size", 1);
  wireRange("tsDim", "dim", 100);
  wireRange("tsBlur", "photo_blur", 1);
  wireRange("tsFeather", "photo_feather", 1);
  wireRange("tsMotionSpeed", "motion_speed", 100);
  wireRange("tsMotionIntensity", "motion_intensity", 100);
  $("tsZoom").addEventListener("input", function () { editing.photo_fit = "custom"; set("photo_zoom", clampTo("photo_zoom", Number(this.value))); });
  Array.prototype.forEach.call(root.querySelectorAll("input[name=tsFit]"), function (r) {
    r.addEventListener("change", function () { set("photo_fit", this.value); });
  });
  Array.prototype.forEach.call(root.querySelectorAll("input[name=tsMotion]"), function (r) {
    r.addEventListener("change", function () { set("motion", this.value); });
  });
  var pad = $("tsFocus"), dragging = false;
  pad.addEventListener("pointerdown", function (e) { dragging = true; if (pad.setPointerCapture) pad.setPointerCapture(e.pointerId); focusAt(e); });
  pad.addEventListener("pointermove", function (e) { if (dragging) focusAt(e); });
  pad.addEventListener("pointerup", function () { dragging = false; });
  pad.addEventListener("pointercancel", function () { dragging = false; });
  pad.addEventListener("keydown", function (e) {
    var step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") editing.photo_x = clampTo("photo_x", editing.photo_x - step);
    else if (e.key === "ArrowRight") editing.photo_x = clampTo("photo_x", editing.photo_x + step);
    else if (e.key === "ArrowUp") editing.photo_y = clampTo("photo_y", editing.photo_y - step);
    else if (e.key === "ArrowDown") editing.photo_y = clampTo("photo_y", editing.photo_y + step);
    else if (e.key === "+" || e.key === "=") return (e.preventDefault(), zoomBy(10));
    else if (e.key === "-" || e.key === "_") return (e.preventDefault(), zoomBy(-10));
    else return;
    e.preventDefault();
    render();
  });
  $("tsAlive").addEventListener("change", function () { set("alive", this.checked); });
  Array.prototype.forEach.call(root.querySelectorAll("input[name=tsMiddle]"), function (r) {
    r.addEventListener("change", function () {
      if (this.value === "photo" && !editing.photo) { render(); $("tsPhotoRow").hidden = false; $("tsPhotoFile").focus(); return; }
      set("middle", this.value);
    });
  });
  $("tsPhotoFile").addEventListener("change", function () { choosePhoto(this.files && this.files[0]); this.value = ""; });
  Array.prototype.forEach.call(root.querySelectorAll("input[name=tsScope]"), function (r) {
    r.addEventListener("change", function () { $("tsPagePicker").hidden = scope() !== "pages"; });
  });
  $("tsSelectAgents").addEventListener("click", function () {
    Array.prototype.forEach.call(root.querySelectorAll("#tsPageGroups input[data-group=agents]"), function (cb) { cb.checked = true; });
  });

  $("tsSaveAs").addEventListener("click", function () {
    call("POST", "/api/themes", { name: $("tsName").value, theme: editing })
      .then(function (next) {
        editingId = next.created_id;
        took(next, "Saved as \"" + themeName(next.created_id) + "\". Choose where to apply it below.");
      })
      .catch(function (err) { say("tsMsg", err.message, "err"); });
  });
  $("tsUpdate").addEventListener("click", function () {
    if (!editingId) return;
    call("PUT", "/api/themes/" + encodeURIComponent(editingId), { theme: editing, name: $("tsName").value })
      .then(function (next) { took(next, "Changes saved. Every page wearing this theme shows them."); })
      .catch(function (err) { say("tsMsg", err.message, "err"); });
  });
  $("tsApply").addEventListener("click", function () {
    if (!editingId) return say("tsApplyMsg", "Save this theme first, then apply it.", "err");
    if (JSON.stringify(editing) !== JSON.stringify(savedSnapshot)) return say("tsApplyMsg", "Save your changes first, then apply.", "err");
    var s = scope(), body = { theme_id: editingId, scope: s };
    if (s === "page") body.pages = [thisPageKey()];
    if (s === "pages") {
      body.pages = Array.prototype.map.call(root.querySelectorAll("#tsPageGroups input:checked"), function (cb) { return cb.value; });
      if (!body.pages.length) return say("tsApplyMsg", "Tick at least one page.", "err");
    }
    call("PUT", "/api/themes/apply", body, "apply")
      .then(function (next) {
        took(next);
        say("tsApplyMsg", s === "all" ? "Applied to all pages. Pages with their own theme keep it."
          : s === "page" ? "Applied to " + pageName(thisPageKey()) + "."
          : "Applied to " + body.pages.length + " page" + (body.pages.length === 1 ? "" : "s") + ".", "ok");
      })
      .catch(function (err) { say("tsApplyMsg", err.message, "err"); });
  });
  $("tsResetAll").addEventListener("click", function () {
    var b = this;
    if (b.getAttribute("data-confirm") !== "1") {
      b.setAttribute("data-confirm", "1");
      b.textContent = "Confirm: every page back to the original";
      return;
    }
    b.removeAttribute("data-confirm");
    b.textContent = "Reset everything to the original";
    call("POST", "/api/themes/reset", { scope: "all" }, "reset")
      .then(function (next) {
        /* The editor goes back to the original too: every part, every colour,
           the middle tone, the photo editor and the motion. */
        editing = clone(T.DEFAULT_THEME); editingId = null; savedSnapshot = null; photoUrl = null;
        $("tsName").value = "";
        took(next, "Every page is back to the original look, every part included. Your saved themes are kept.");
      })
      .catch(function (err) { say("tsMsg", err.message, "err"); });
  });

  function start() {
    render();
    call("GET", "/api/themes").then(function (next) {
      state = next;
      drawSaved(); drawPages(); drawAssignments();
      var mine = next.default_theme_id && next.themes.filter(function (t) { return t.id === next.default_theme_id; })[0];
      if (mine) loadTheme(mine); else render();
    }).catch(function (err) { say("tsMsg", err.message, "err"); });
  }

  window.BFThemeStudio = { PRESETS: PRESETS, GROUP_LABELS: GROUP_LABELS, PARTS: PARTS, partPreset: partPreset, spectrum: spectrum, start: start, thisPageKey: thisPageKey };
  if (localStorage.getItem("bf_token")) start();
})();

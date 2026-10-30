/* scripts/bf-theme-studio.js — Settings → Theme.

   The member builds a look from three parts (the top-left glow, the
   bottom-right glow and the middle backdrop: black, a colour, or their own
   photo with a dim), turns "Alive corners" on or off, saves it under a name,
   and applies it to all pages, this page, or the pages they tick. Every
   change shows at once in the preview, with the readability meter beside it.

   NOTHING IS DECIDED HERE that the server does not check again: the theme is
   validated by lib/themes.js before it is stored, the photo is checked by its
   bytes, and the page list comes from the server, which reads it from the app
   map (lib/appMap.json), so a page added to the app appears in the checklist
   without a change here.

   The arithmetic (tokens, readability) is scripts/bf-theme.js's, loaded first
   on this page, so the preview and the meter use exactly what every page uses. */
(function () {
  "use strict";

  var T = window.BFTheme;
  var root = document.getElementById("panel-theme");
  if (!T || !root) return;

  var PRESETS = [
    { id: "default", name: "Default", theme: { glow_a: "#00e5ff", glow_a_alpha: 0.14, glow_b: "#a855f7", glow_b_alpha: 0.18, middle: "black", bg: "#070b18" } },
    { id: "ember", name: "Ember", theme: { glow_a: "#ff7a18", glow_a_alpha: 0.18, glow_b: "#ff2e63", glow_b_alpha: 0.16, middle: "black", bg: "#070b18" } },
    { id: "verdant", name: "Verdant", theme: { glow_a: "#34d399", glow_a_alpha: 0.16, glow_b: "#22c55e", glow_b_alpha: 0.14, middle: "colour", bg: "#05140e" } },
    { id: "royal", name: "Royal", theme: { glow_a: "#6366f1", glow_a_alpha: 0.2, glow_b: "#f5c542", glow_b_alpha: 0.12, middle: "colour", bg: "#0a0a24" } },
    { id: "rose", name: "Rosé", theme: { glow_a: "#fb7185", glow_a_alpha: 0.16, glow_b: "#f0abfc", glow_b_alpha: 0.14, middle: "colour", bg: "#160a14" } },
    { id: "mono", name: "Mono", theme: { glow_a: "#e5e7eb", glow_a_alpha: 0.08, glow_b: "#9ca3af", glow_b_alpha: 0.1, middle: "colour", bg: "#0b0b0d" } }
  ];
  var GROUP_LABELS = {
    hq: "Dashboard & HQ",
    agents: "Agent pages",
    money: "Money (wallet, billing, marketplace)",
    content: "Content & tools",
    account: "Account"
  };
  var PHOTO_MAX = 5 * 1024 * 1024;
  var PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

  function $(id) { return document.getElementById(id); }
  function api() { return (typeof window.API_URL === "string" && window.API_URL) || ""; }
  function authHeaders(json) {
    var h = { "Authorization": "Bearer " + (localStorage.getItem("bf_token") || "") };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }
  function call(method, path, body) {
    return fetch(api() + path, { method: method, headers: authHeaders(body !== undefined), body: body !== undefined ? JSON.stringify(body) : undefined })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || "That did not work. Try again.");
          return data;
        });
      });
  }

  /* ── what the editor holds ──────────────────────────────────────────── */
  var state = null;            // the last answer from /api/themes
  var editing = clone(T.DEFAULT_THEME);
  var editingId = null;        // the saved theme being edited, if any
  var savedSnapshot = null;    // its theme as saved, to tell an unsaved change
  var photoUrl = null;         // the editing theme's photo, for the preview

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
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

  /* ── preview and meter ──────────────────────────────────────────────── */
  function render() {
    var preview = $("tsPreview");
    var tokens = T.tokensFor(editing, photoUrl, window);
    Object.keys(tokens).forEach(function (k) { preview.style.setProperty(k, tokens[k]); });
    preview.setAttribute("data-alive", tokens["--bf-alive"]);

    var r = T.readability(editing);
    var stateEl = $("tsMeterState");
    stateEl.textContent = r.protected ? "Auto-protected" : "Readable";
    $("tsMeter").setAttribute("data-state", r.protected ? "protected" : "readable");
    $("tsMeterRatios").textContent =
      "Text " + r.ratios.text.toFixed(1) + ":1 · Muted text " + r.ratios.muted.toFixed(1) + ":1 · Accent " + r.ratios.accent.toFixed(1) + ":1";
    $("tsMeterNote").textContent = r.protected
      ? "This backdrop is bright, so it is shaded just enough for text to stay clear (at least 7:1, and 4.5:1 for muted text). Your colours are kept."
      : "Text stays clear on this backdrop: at least 7:1, and 4.5:1 for muted text.";

    $("tsGlowAColor").value = editing.glow_a; $("tsGlowAHex").value = editing.glow_a;
    $("tsGlowBColor").value = editing.glow_b; $("tsGlowBHex").value = editing.glow_b;
    $("tsBgColor").value = editing.bg; $("tsBgHex").value = editing.bg;
    $("tsGlowAAlpha").value = Math.round(editing.glow_a_alpha * 100);
    $("tsGlowBAlpha").value = Math.round(editing.glow_b_alpha * 100);
    $("tsGlowAAlphaOut").textContent = Math.round(editing.glow_a_alpha * 100) + "%";
    $("tsGlowBAlphaOut").textContent = Math.round(editing.glow_b_alpha * 100) + "%";
    $("tsDim").value = Math.round(editing.dim * 100);
    $("tsDimOut").textContent = Math.round(editing.dim * 100) + "%";
    $("tsAlive").checked = editing.alive === true;
    $("tsAliveNote").textContent = T.reducedMotion()
      ? "Your device asks for reduced motion, so the corners stay still here and on every page."
      : "The two corner glows drift and breathe slowly, about once every half minute.";
    Array.prototype.forEach.call(root.querySelectorAll("input[name=tsMiddle]"), function (r2) { r2.checked = r2.value === editing.middle; });
    $("tsColourRow").hidden = editing.middle !== "colour";
    $("tsPhotoRow").hidden = editing.middle !== "photo";
    $("tsPhotoStatus").textContent = editing.photo ? "Your photo is set." : "No photo yet.";
    Array.prototype.forEach.call(root.querySelectorAll(".ts-preset"), function (b) {
      var p = PRESETS.filter(function (x) { return x.id === b.getAttribute("data-preset"); })[0];
      var same = p && Object.keys(p.theme).every(function (k) { return editing[k] === p.theme[k]; }) && editing.middle !== "photo";
      b.setAttribute("aria-pressed", same ? "true" : "false");
    });
    var dirty = editingId && JSON.stringify(editing) !== JSON.stringify(savedSnapshot);
    $("tsUpdate").hidden = !editingId;
    $("tsUpdate").disabled = !dirty;
    $("tsEditing").textContent = editingId
      ? "Editing \"" + (themeName(editingId) || "your theme") + "\"" + (dirty ? " (unsaved changes)" : "") + "."
      : "Not saved yet.";
  }

  function set(key, value) { editing[key] = value; render(); }

  function wireColour(pickerId, hexId, key) {
    $(pickerId).addEventListener("input", function () { set(key, this.value.toLowerCase()); });
    $(hexId).addEventListener("change", function () {
      var v = this.value.trim().toLowerCase();
      if (v && v[0] !== "#") v = "#" + v;
      if (hexOk(v)) { set(key, v); say("tsMsg", ""); }
      else { this.value = editing[key]; say("tsMsg", "A colour is # and six hex digits, like #22d3ee.", "err"); }
    });
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
      return fetch(api() + "/api/themes/photo", { method: "POST", headers: authHeaders(false), body: form })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || "The photo could not be uploaded.");
          editing.photo = data.path; editing.photo_luma = luma; editing.middle = "photo";
          photoUrl = data.url;
          say("tsPhotoMsg", "Photo ready. Save the theme to keep it.", "ok");
          render();
        }); });
    }).catch(function (err) { say("tsPhotoMsg", err.message, "err"); });
  }

  /* ── saved themes ───────────────────────────────────────────────────── */
  function loadTheme(row) {
    editing = Object.assign(clone(T.DEFAULT_THEME), clone(row.theme));
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
      if (row) { savedSnapshot = clone(Object.assign(clone(T.DEFAULT_THEME), row.theme)); photoUrl = row.photo_url || photoUrl; }
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
      swatch.style.background = "linear-gradient(135deg," + row.theme.glow_a + "," + (row.theme.middle === "colour" ? row.theme.bg : "#070b18") + "," + row.theme.glow_b + ")";
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
      call("PUT", "/api/themes/" + encodeURIComponent(row.id), { name: input.value })
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
        call("POST", "/api/themes/reset", { scope: "page", pages: [k] })
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
    b.addEventListener("click", function () {
      Object.keys(p.theme).forEach(function (k) { editing[k] = p.theme[k]; });
      editing.photo = null; editing.photo_luma = 0; photoUrl = null;
      if (!editingId) $("tsName").value = p.name;
      render();
    });
  });
  wireColour("tsGlowAColor", "tsGlowAHex", "glow_a");
  wireColour("tsGlowBColor", "tsGlowBHex", "glow_b");
  wireColour("tsBgColor", "tsBgHex", "bg");
  $("tsGlowAAlpha").addEventListener("input", function () { set("glow_a_alpha", Number(this.value) / 100); });
  $("tsGlowBAlpha").addEventListener("input", function () { set("glow_b_alpha", Number(this.value) / 100); });
  $("tsDim").addEventListener("input", function () { set("dim", Number(this.value) / 100); });
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
    call("PUT", "/api/themes/apply", body)
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
    call("POST", "/api/themes/reset", { scope: "all" })
      .then(function (next) { took(next, "Every page is back to the original look. Your saved themes are kept."); })
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

  window.BFThemeStudio = { PRESETS: PRESETS, GROUP_LABELS: GROUP_LABELS, start: start, thisPageKey: thisPageKey };
  if (localStorage.getItem("bf_token")) start();
})();

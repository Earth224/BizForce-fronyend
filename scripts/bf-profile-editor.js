/* scripts/bf-profile-editor.js — "Customise profile", on the member's own
   profile page (profile.html), for the member only.

   A side panel with a LIVE PREVIEW of the public view: the member's profile
   as a visitor sees it (profile.html?id=<their id>&bf_preview=1, in a frame,
   with a Desktop / Phone toggle), redrawn at every change from the draft.
   Six sections:
     Theme           which look the public profile wears: the original, one of
                     the member's saved themes, or a preset; the full theme
                     studio (Settings, Theme) can apply any look to "My public
                     profile" too. Readability protection applies, and the
                     panel says when it has shaded the backdrop.
     Banner          its height (Small, Medium, Large, Full-bleed, Custom), the
                     image's focal point (the pad: drag it, or the arrow keys,
                     Shift for bigger steps, + and - to zoom) and zoom, the
                     overlay darkness and feathered edges
     Photo           its size, its shape and its ring (none, solid, the theme
                     gradient), the ring's width, glow and colour
     Layout          Standard, Classic centred, Split hero, Magazine, Minimal
     Sections        their order (drag, the Move up and Move down buttons, or
                     the arrow keys on a row's handle) and Show for each
     Grid & Videos   the grid's columns, style and gap, its order; the videos'
                     layout, the featured first video, and their order
   "Save" stores the draft (PUT /api/bfp/profile/design, where it is checked
   against the closed schema again), "Discard" goes back to what is saved,
   and "Reset profile design" (asked twice) puts the profile back on the
   default design.

   Everything the panel shows of a member's own things (their theme names,
   their item titles) is set as text, never as markup. The draft is only ever
   drawn by scripts/bf-profile-design.js, which maps its values to classes
   and tokens. */
(function () {
  "use strict";
  if (window.BFProfileEditor) return;

  var doc = document;
  var D = function () { return window.BFProfileDesign; };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var HEX = /^#[0-9a-f]{6}$/;
  var TABS = [
    { id: "theme", label: "Theme" }, { id: "banner", label: "Banner" }, { id: "photo", label: "Photo" },
    { id: "layout", label: "Layout" }, { id: "sections", label: "Sections" }, { id: "grid", label: "Grid & Videos" }
  ];
  var HEIGHT_NAMES = { s: "Small", m: "Medium", l: "Large", full: "Full-bleed", custom: "Custom" };
  var SIZE_NAMES = { s: "S", m: "M", l: "L", xl: "XL" };
  var RING_NAMES = { none: "None", solid: "Solid", gradient: "Theme gradient" };
  var STYLE_NAMES = { square: "Square", portrait: "Portrait", masonry: "Masonry" };
  var GAP_NAMES = { s: "Small", m: "Medium", l: "Large" };
  var VIDEO_NAMES = { carousel: "Row carousel", grid: "Grid" };
  var LAYOUT_NOTES = {
    standard: "Today's page: the photo beside your name, over the banner.",
    classic: "Everything centred under the banner.",
    split: "A split hero: your photo on the left, your name and details on the right.",
    magazine: "A big banner with your photo overlapping it, the name in large type.",
    minimal: "Text first: a slim accent line, your name large, the photo small."
  };
  var MSG = {
    unsaved: "Unsaved changes. Save to show them to visitors.",
    saved: "Saved. Visitors now see this design.",
    discarded: "Changes discarded.",
    reset: "Your profile is back to the default design.",
    confirmReset: "Confirm: back to the default design"
  };

  var ctx = null, draft = null, saved = null, photoUrl = null, panel = null, frame = null, themeRows = [], themeChoice = null, view = "desktop";

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function el(tag, attrs, text) {
    var e = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function q(sel) { return panel ? panel.querySelector(sel) : null; }
  function say(text, kind) { var s = q(".pde-status"); if (s) { s.textContent = text; s.setAttribute("data-kind", kind || "info"); } }

  /* ── the preview ──────────────────────────────────────────────────────── */
  function post() {
    if (!frame || !frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: "bf-profile-preview", design: draft, photo_url: draft.theme ? photoUrl : null, name: ctx.name || "" }, window.location.origin);
    } catch (e) { /* the frame is still loading: it is sent again when it has */ }
  }
  function changed() {
    say(MSG.unsaved, "info");
    var r = q(".pde-read");
    if (r) r.textContent = readabilityNote();
    post();
  }
  function readabilityNote() {
    if (!draft.theme) return "The original look is readable as it is.";
    var T = window.BFTheme;
    var r = T && T.readability ? T.readability(draft.theme) : null;
    if (!r) return "";
    return r.protected ? "Readability protection is on: the backdrop is shaded so text stays readable." : "Readable as it is.";
  }

  /* ── small controls ───────────────────────────────────────────────────── */
  function radios(name, legend, options, labels, get, set) {
    var fs = el("fieldset", { class: "pde-field" });
    fs.appendChild(el("legend", {}, legend));
    var row = el("div", { class: "pde-choices" });
    options.forEach(function (v) {
      var id = "pde-" + name + "-" + v;
      var lab = el("label", { for: id, class: "pde-choice" });
      var r = el("input", { type: "radio", name: "pde-" + name, id: id, value: String(v) });
      r.checked = get() === v;
      r.addEventListener("change", function () { if (r.checked) { set(v); changed(); } });
      lab.appendChild(r);
      lab.appendChild(doc.createTextNode(" " + labels[v]));
      row.appendChild(lab);
    });
    fs.appendChild(row);
    return fs;
  }
  function slider(name, label, min, max, step, get, set, unit) {
    var wrap = el("div", { class: "pde-field pde-range" });
    var id = "pde-" + name;
    var lab = el("label", { for: id }, label);
    var out = el("output", { for: id, class: "pde-out" });
    var r = el("input", { type: "range", id: id, min: String(min), max: String(max), step: String(step) });
    r.value = String(get());
    out.textContent = r.value + (unit || "");
    r.addEventListener("input", function () { set(Number(r.value)); out.textContent = r.value + (unit || ""); changed(); });
    wrap.appendChild(lab); wrap.appendChild(r); wrap.appendChild(out);
    return wrap;
  }
  function check(name, label, get, set) {
    var lab = el("label", { class: "pde-check", for: "pde-" + name });
    var c = el("input", { type: "checkbox", id: "pde-" + name });
    c.checked = !!get();
    c.addEventListener("change", function () { set(c.checked); changed(); });
    lab.appendChild(c);
    lab.appendChild(doc.createTextNode(" " + label));
    return lab;
  }

  /* A list to reorder: drag a row, press Move up or Move down, or use the
     up and down arrow keys on its handle. items: [{ id, label }]; done(ids). */
  function orderList(name, items, done, extra) {
    var ol = el("ol", { class: "pde-order", "data-part": name, "aria-label": name === "sections" ? "Section order" : name === "grid" ? "Grid order" : "Video order" });
    var dragFrom = null;
    function ids() { return Array.prototype.map.call(ol.children, function (li) { return li.getAttribute("data-id"); }); }
    function move(li, by) {
      var list = Array.prototype.slice.call(ol.children), i = list.indexOf(li), j = i + by;
      if (i === -1 || j < 0 || j >= list.length) return false;
      if (by < 0) ol.insertBefore(li, list[j]); else ol.insertBefore(li, list[j].nextSibling);
      done(ids());
      changed();
      return true;
    }
    items.forEach(function (it) {
      var li = el("li", { class: "pde-row", draggable: "true", "data-id": it.id });
      var handle = el("button", { type: "button", class: "pde-handle", "aria-label": "Move " + it.label + ". Use the up and down arrow keys." }, "Drag");
      handle.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        if (move(li, e.key === "ArrowUp" ? -1 : 1)) handle.focus();
      });
      li.appendChild(handle);
      li.appendChild(el("span", { class: "pde-row-name" }, it.label));
      if (extra) extra(li, it);
      var up = el("button", { type: "button", class: "pde-move", "data-move": "up", "aria-label": "Move " + it.label + " up" }, "Move up");
      var dn = el("button", { type: "button", class: "pde-move", "data-move": "down", "aria-label": "Move " + it.label + " down" }, "Move down");
      up.addEventListener("click", function () { move(li, -1); up.focus(); });
      dn.addEventListener("click", function () { move(li, 1); dn.focus(); });
      li.appendChild(up); li.appendChild(dn);
      li.addEventListener("dragstart", function (e) { dragFrom = li; if (e.dataTransfer) { try { e.dataTransfer.setData("text/plain", it.id); e.dataTransfer.effectAllowed = "move"; } catch (err) { /* older browsers */ } } });
      li.addEventListener("dragover", function (e) { if (dragFrom) e.preventDefault(); });
      li.addEventListener("drop", function (e) {
        e.preventDefault();
        if (!dragFrom || dragFrom === li) return;
        var list = Array.prototype.slice.call(ol.children);
        if (list.indexOf(dragFrom) < list.indexOf(li)) ol.insertBefore(dragFrom, li.nextSibling); else ol.insertBefore(dragFrom, li);
        dragFrom = null;
        done(ids());
        changed();
      });
      li.addEventListener("dragend", function () { dragFrom = null; });
      ol.appendChild(li);
    });
    if (!items.length) ol.appendChild(el("li", { class: "pde-empty" }, "Nothing here yet."));
    return ol;
  }

  /* ── the six sections ─────────────────────────────────────────────────── */
  function themeTab(box) {
    box.appendChild(el("p", { class: "pde-note" }, "The look your public profile wears. Visitors see this, never their own theme."));
    var fs = el("fieldset", { class: "pde-field" });
    fs.appendChild(el("legend", {}, "Wear on my public profile"));
    var list = el("div", { class: "pde-themes" });
    themeRows.forEach(function (row) {
      var id = "pde-theme-" + row.key.replace(/[^a-z0-9-]/gi, "-");
      var lab = el("label", { for: id, class: "pde-choice" });
      var r = el("input", { type: "radio", name: "pde-theme", id: id, value: row.key });
      r.checked = themeChoice === row.key;
      r.addEventListener("change", function () {
        if (!r.checked) return;
        themeChoice = row.key;
        draft.theme = row.theme ? clone(row.theme) : null;
        photoUrl = row.photo_url || null;
        changed();
      });
      lab.appendChild(r);
      lab.appendChild(doc.createTextNode(" " + row.name));
      list.appendChild(lab);
    });
    fs.appendChild(list);
    box.appendChild(fs);
    box.appendChild(el("p", { class: "pde-read", role: "status" }, readabilityNote()));
    var p = el("p", { class: "pde-note" }, "For every control, the corners, the middle tone, opacity, size, the photo backdrop, motion and every element colour, design a look in the theme studio and apply it to \"My public profile\". ");
    p.appendChild(el("a", { href: "/settings.html", class: "pde-link" }, "Open the theme studio"));
    box.appendChild(p);
  }
  function bannerTab(box) {
    var b = draft.banner;
    box.appendChild(radios("height", "Banner height", D().BANNER_HEIGHTS, HEIGHT_NAMES, function () { return b.height; }, function (v) { b.height = v; }));
    box.appendChild(slider("custom", "Custom height", 120, 640, 10, function () { return b.custom_px; }, function (v) { b.custom_px = v; b.height = "custom"; var c = q("#pde-height-custom"); if (c) c.checked = true; }, " px"));
    /* The focal point pad, as in the theme studio's photo editor. */
    var padWrap = el("div", { class: "pde-field" });
    padWrap.appendChild(el("span", { class: "pde-label", id: "pdePadLabel" }, "Focal point"));
    var pad = el("div", { class: "pde-pad", tabindex: "0", role: "group", "aria-labelledby": "pdePadLabel",
      "aria-description": "Drag, or use the arrow keys (Shift for bigger steps); + and - zoom." });
    var dot = el("span", { class: "pde-pad-dot" });
    pad.appendChild(dot);
    function placeDot() { dot.style.left = b.focus_x + "%"; dot.style.top = b.focus_y + "%"; pad.setAttribute("aria-valuetext", Math.round(b.focus_x) + "% across, " + Math.round(b.focus_y) + "% down"); }
    function setFocus(x, y) { b.focus_x = Math.round(Math.min(100, Math.max(0, x))); b.focus_y = Math.round(Math.min(100, Math.max(0, y))); placeDot(); syncRange("pde-zoom", b.zoom); changed(); }
    var dragging = false;
    function fromPointer(e) { var r = pad.getBoundingClientRect(); if (!r.width || !r.height) return; setFocus((e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100); }
    pad.addEventListener("pointerdown", function (e) { dragging = true; fromPointer(e); });
    pad.addEventListener("pointermove", function (e) { if (dragging) fromPointer(e); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { pad.addEventListener(n, function () { dragging = false; }); });
    pad.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 10 : 1;
      var dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0, dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (dx || dy) { e.preventDefault(); setFocus(b.focus_x + dx, b.focus_y + dy); return; }
      if (e.key === "+" || e.key === "=" || e.key === "-") {
        e.preventDefault();
        b.zoom = Math.min(300, Math.max(100, b.zoom + (e.key === "-" ? -10 : 10)));
        syncRange("pde-zoom", b.zoom);
        changed();
      }
    });
    placeDot();
    padWrap.appendChild(pad);
    box.appendChild(padWrap);
    box.appendChild(slider("zoom", "Zoom", 100, 300, 5, function () { return b.zoom; }, function (v) { b.zoom = v; }, "%"));
    box.appendChild(slider("overlay", "Overlay darkness", 0, 85, 1, function () { return Math.round(b.overlay * 100); }, function (v) { b.overlay = v / 100; }, "%"));
    box.appendChild(slider("feather", "Feathered edges", 0, 50, 1, function () { return b.feather; }, function (v) { b.feather = v; }, "%"));
  }
  function syncRange(id, v) { var r = q("#" + id); if (r) { r.value = String(v); var o = r.parentNode.querySelector("output"); if (o) o.textContent = String(v) + (id === "pde-zoom" ? "%" : ""); } }
  function photoTab(box) {
    var p = draft.photo;
    box.appendChild(radios("size", "Photo size", D().PHOTO_SIZES, SIZE_NAMES, function () { return p.size; }, function (v) { p.size = v; }));
    var fs = el("fieldset", { class: "pde-field" });
    fs.appendChild(el("legend", {}, "Shape"));
    var row = el("div", { class: "pde-shapes" });
    D().SHAPES.forEach(function (s) {
      var bt = el("button", { type: "button", class: "pde-shape", "data-shape": s, "aria-pressed": p.shape === s ? "true" : "false" });
      var sample = el("span", { class: "pde-shape-sample", "aria-hidden": "true" });
      sample.style.clipPath = D().CLIP[s];   // the shape's own constant
      bt.appendChild(sample);
      bt.appendChild(el("span", {}, D().SHAPE_NAMES[s]));
      bt.addEventListener("click", function () {
        p.shape = s;
        Array.prototype.forEach.call(row.children, function (x) { x.setAttribute("aria-pressed", x === bt ? "true" : "false"); });
        changed();
      });
      row.appendChild(bt);
    });
    fs.appendChild(row);
    box.appendChild(fs);
    box.appendChild(radios("ring", "Ring", D().RINGS, RING_NAMES, function () { return p.ring; }, function (v) { p.ring = v; }));
    box.appendChild(slider("ringw", "Ring width", 0, 12, 1, function () { return p.ring_width; }, function (v) { p.ring_width = v; }, " px"));
    box.appendChild(slider("glow", "Glow", 0, 100, 1, function () { return Math.round(p.ring_glow * 100); }, function (v) { p.ring_glow = v / 100; }, "%"));
    var cw = el("div", { class: "pde-field" });
    cw.appendChild(el("label", { for: "pde-ringc" }, "Ring colour"));
    var c = el("input", { type: "color", id: "pde-ringc" });
    c.value = p.ring_color;
    c.addEventListener("input", function () { var v = String(c.value).toLowerCase(); if (HEX.test(v)) { p.ring_color = v; changed(); } });
    cw.appendChild(c);
    box.appendChild(cw);
  }
  function layoutTab(box) {
    var fs = el("fieldset", { class: "pde-field" });
    fs.appendChild(el("legend", {}, "Layout"));
    D().LAYOUTS.forEach(function (l) {
      var id = "pde-layout-" + l;
      var lab = el("label", { for: id, class: "pde-layout" });
      var r = el("input", { type: "radio", name: "pde-layout", id: id, value: l });
      r.checked = draft.layout === l;
      r.addEventListener("change", function () { if (r.checked) { draft.layout = l; changed(); } });
      lab.appendChild(r);
      lab.appendChild(el("strong", {}, " " + D().LAYOUT_NAMES[l]));
      lab.appendChild(el("span", { class: "pde-note" }, LAYOUT_NOTES[l]));
      fs.appendChild(lab);
    });
    box.appendChild(fs);
  }
  function sectionsTab(box) {
    box.appendChild(el("p", { class: "pde-note" }, "Drag a section, or use Move up and Move down, or the arrow keys on its handle. Untick Show to hide it."));
    var items = draft.sections.map(function (s) { return { id: s.key, label: D().SECTION_NAMES[s.key] }; });
    box.appendChild(orderList("sections", items, function (keys) {
      var show = {};
      draft.sections.forEach(function (s) { show[s.key] = s.show; });
      draft.sections = keys.map(function (k) { return { key: k, show: show[k] !== false }; });
    }, function (li, it) {
      var c = el("input", { type: "checkbox", class: "pde-show", "aria-label": "Show " + it.label });
      c.checked = draft.sections.filter(function (s) { return s.key === it.id; })[0].show !== false;
      c.addEventListener("change", function () {
        draft.sections.forEach(function (s) { if (s.key === it.id) s.show = c.checked; });
        changed();
      });
      var lab = el("label", { class: "pde-check" });
      lab.appendChild(c);
      lab.appendChild(doc.createTextNode(" Show"));
      li.appendChild(lab);
    }));
  }
  function itemsOf(list, part) {
    return D().ordered(list || [], part, draft).filter(function (it) { return it && typeof it.id === "string" && UUID.test(it.id); })
      .map(function (it) { return { id: it.id, label: String(it.title || "Untitled") }; });
  }
  function gridTab(box) {
    var g = draft.grid, v = draft.videos;
    box.appendChild(el("h3", { class: "pde-h" }, "Grid"));
    box.appendChild(radios("cols", "Columns", D().GRID_COLUMNS, { 2: "2", 3: "3", 4: "4" }, function () { return g.columns; }, function (x) { g.columns = x; }));
    box.appendChild(radios("gstyle", "Grid style", D().GRID_STYLES, STYLE_NAMES, function () { return g.style; }, function (x) { g.style = x; }));
    box.appendChild(radios("gap", "Gap", D().GAPS, GAP_NAMES, function () { return g.gap; }, function (x) { g.gap = x; }));
    box.appendChild(el("span", { class: "pde-label" }, "Grid order"));
    box.appendChild(orderList("grid", itemsOf(ctx.grid, "grid"), function (ids) { g.order = ids; }));
    box.appendChild(el("h3", { class: "pde-h" }, "Videos"));
    box.appendChild(radios("vlayout", "Video layout", D().VIDEO_LAYOUTS, VIDEO_NAMES, function () { return v.layout; }, function (x) { v.layout = x; }));
    box.appendChild(check("featured", "Feature the first video large", function () { return v.featured; }, function (x) { v.featured = x; }));
    box.appendChild(el("span", { class: "pde-label" }, "Video order"));
    box.appendChild(orderList("videos", itemsOf(ctx.videos, "videos"), function (ids) { v.order = ids; }));
  }
  var BUILD = { theme: themeTab, banner: bannerTab, photo: photoTab, layout: layoutTab, sections: sectionsTab, grid: gridTab };

  /* ── the panel ────────────────────────────────────────────────────────── */
  var CSS = [
    ".pde{position:fixed;top:0;right:0;bottom:0;z-index:2147483100;width:min(620px,100vw);display:flex;flex-direction:column;background:rgba(8,11,28,.98);color:#e8e8ff;border-left:1px solid rgba(var(--bf-accent-a-rgb, 34, 211, 238),.25);box-shadow:-12px 0 40px rgba(0,0,0,.55);font:14px/1.45 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".pde[hidden]{display:none}",
    ".pde-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08)}",
    ".pde-head h2{margin:0;font-size:1.05rem}",
    ".pde button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#e8e8ff;padding:6px 10px}",
    ".pde button[aria-pressed=true],.pde button[aria-selected=true]{border-color:var(--bf-accent-a, #22d3ee);color:var(--bf-accent-a, #22d3ee)}",
    ".pde button:focus-visible,.pde input:focus-visible,.pde a:focus-visible,.pde-pad:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}",
    ".pde-views{display:flex;gap:6px;padding:8px 16px 0}",
    ".pde-stage{padding:8px 16px;display:flex;justify-content:center;background:rgba(0,0,0,.25)}",
    ".pde-preview{width:100%;height:300px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#070b18}",
    ".pde[data-view=phone] .pde-preview{width:390px;max-width:100%}",
    ".pde-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.08)}",
    ".pde-body{flex:1;overflow:auto;padding:12px 16px}",
    ".pde-field{border:0;margin:0 0 14px;padding:0}",
    ".pde-field legend,.pde-label{display:block;font-weight:700;margin-bottom:6px;color:#c9cff0}",
    ".pde-choices,.pde-shapes,.pde-themes{display:flex;flex-wrap:wrap;gap:8px}",
    ".pde-themes{flex-direction:column;gap:4px}",
    ".pde-choice,.pde-check{display:inline-flex;align-items:center;gap:4px}",
    ".pde-range{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center}",
    ".pde-range label{grid-column:1/-1;font-weight:700;color:#c9cff0}",
    ".pde-out{font-variant-numeric:tabular-nums;color:#8892b8;min-width:52px;text-align:right}",
    ".pde-pad{position:relative;width:220px;height:110px;border-radius:8px;background:linear-gradient(135deg,#1a2350,#0c1030);border:1px solid rgba(255,255,255,.15);touch-action:none;cursor:crosshair}",
    ".pde-pad-dot{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--bf-accent-a, #22d3ee);box-shadow:0 0 0 2px #050814}",
    ".pde-shape{display:inline-flex;flex-direction:column;align-items:center;gap:4px;width:84px}",
    ".pde-shape-sample{display:block;width:34px;height:34px;background:linear-gradient(135deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #a855f7))}",
    ".pde-layout{display:grid;grid-template-columns:auto 1fr;gap:2px 8px;margin-bottom:8px}",
    ".pde-layout .pde-note{grid-column:2}",
    ".pde-note{color:#8892b8;font-size:.86rem;margin:0 0 10px}",
    ".pde-read{color:#c9cff0;font-size:.86rem}",
    ".pde-link{color:var(--bf-accent-a, #22d3ee)}",
    ".pde-h{font-size:.95rem;margin:6px 0 10px}",
    ".pde-order{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:6px}",
    ".pde-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}",
    ".pde-row-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".pde-handle{cursor:grab}",
    ".pde-empty{color:#8892b8}",
    ".pde-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,.08)}",
    ".pde-status{flex:1 1 100%;margin:0;min-height:1.3em;color:#c9cff0}",
    ".pde-status[data-kind=err]{color:#fca5a5}",
    ".pde-save{background:linear-gradient(90deg,var(--bf-btn-a, #06b6d4)var(--bf-btn-mid, ),var(--bf-btn-b, #8b5cf6))!important;color:var(--bf-btn-text, #fff)!important;border:0!important}",
    "@media (max-width:700px){.pde{width:100vw}.pde-preview{height:240px}}"
  ].join("\n");
  function injectStyle() {
    if (doc.getElementById("bf-profile-editor-style")) return;
    var st = el("style", { id: "bf-profile-editor-style" });
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  function showTab(id) {
    var body = q(".pde-body");
    body.innerHTML = "";
    var box = el("div", { role: "tabpanel", id: "pde-panel-" + id, "aria-labelledby": "pde-tab-" + id, class: "pde-tabpanel" });
    BUILD[id](box);
    body.appendChild(box);
    Array.prototype.forEach.call(panel.querySelectorAll(".pde-tab"), function (t) {
      var on = t.getAttribute("data-tab") === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.setAttribute("tabindex", on ? "0" : "-1");
    });
    panel.setAttribute("data-tab", id);
  }
  function build() {
    injectStyle();
    panel = el("aside", { class: "pde", id: "pdEditor", role: "dialog", "aria-modal": "false", "aria-labelledby": "pdeTitle", "data-view": view });
    panel.hidden = true;
    var head = el("div", { class: "pde-head" });
    head.appendChild(el("h2", { id: "pdeTitle" }, "Customise profile"));
    var close = el("button", { type: "button", class: "pde-close", "data-act": "close" }, "Close");
    head.appendChild(close);
    panel.appendChild(head);
    var views = el("div", { class: "pde-views", role: "group", "aria-label": "Preview size" });
    ["desktop", "phone"].forEach(function (v) {
      var b = el("button", { type: "button", "data-view": v, "aria-pressed": v === view ? "true" : "false" }, v === "desktop" ? "Desktop" : "Phone");
      b.addEventListener("click", function () { setView(v); });
      views.appendChild(b);
    });
    panel.appendChild(views);
    var stage = el("div", { class: "pde-stage" });
    frame = el("iframe", { class: "pde-preview", title: "Live preview of your public profile, as visitors see it" });
    frame.addEventListener("load", post);
    stage.appendChild(frame);
    panel.appendChild(stage);
    var tabs = el("div", { class: "pde-tabs", role: "tablist", "aria-label": "Customise" });
    TABS.forEach(function (t) {
      var b = el("button", { type: "button", role: "tab", class: "pde-tab", id: "pde-tab-" + t.id, "data-tab": t.id, "aria-controls": "pde-panel-" + t.id }, t.label);
      b.addEventListener("click", function () { showTab(t.id); });
      b.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        var i = TABS.map(function (x) { return x.id; }).indexOf(t.id), j = (i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length;
        showTab(TABS[j].id);
        panel.querySelector("#pde-tab-" + TABS[j].id).focus();
      });
      tabs.appendChild(b);
    });
    panel.appendChild(tabs);
    panel.appendChild(el("div", { class: "pde-body" }));
    var foot = el("div", { class: "pde-foot" });
    foot.appendChild(el("p", { class: "pde-status", role: "status", "aria-live": "polite" }));
    var save = el("button", { type: "button", class: "pde-save", "data-act": "save" }, "Save");
    var discard = el("button", { type: "button", "data-act": "discard" }, "Discard");
    var reset = el("button", { type: "button", "data-act": "reset" }, "Reset profile design");
    save.addEventListener("click", doSave);
    discard.addEventListener("click", doDiscard);
    reset.addEventListener("click", doReset);
    foot.appendChild(save); foot.appendChild(discard); foot.appendChild(reset);
    panel.appendChild(foot);
    close.addEventListener("click", function () { closePanel(); });
    panel.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closePanel(); } });
    doc.body.appendChild(panel);
  }
  function setView(v) {
    view = v === "phone" ? "phone" : "desktop";
    panel.setAttribute("data-view", view);
    Array.prototype.forEach.call(panel.querySelectorAll(".pde-views button"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-view") === view ? "true" : "false"); });
  }

  /* ── saving ───────────────────────────────────────────────────────────── */
  /* A request to the API's one base (BFTheme.apiOrigin, the Railway
     backend), signed in as the member: a Promise of { ok, status, body }. */
  function send(path, method, body) {
    var token = null;
    try { token = window.localStorage.getItem("bf_token"); } catch (e) { token = null; }
    var opts = { method: method, headers: { "Authorization": "Bearer " + token } };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    if (!window.BFTheme || !window.BFTheme.apiOrigin()) return Promise.reject(new Error("no API address"));
    return window.fetch(window.BFTheme.apiOrigin() + path, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (b) { return { ok: res.ok, status: res.status, body: b }; });
    });
  }
  function startFrom(design) {
    saved = design ? clone(design) : null;
    draft = D().normalise(saved) || clone(D().DEFAULT);
    themeChoice = draft.theme ? "saved" : "original";
  }
  function doSave() {
    say("Saving...", "info");
    return send("/api/bfp/profile/design", "PUT", { design: draft }).then(function (r) {
      if (!r.ok) { say("Not saved: " + ((r.body && r.body.error) || "the server refused it") + ".", "err"); return false; }
      photoUrl = r.body.design_photo_url || null;
      startFrom(r.body.profile_design);
      themeRows = themeRowsFrom(lastThemes);
      showTab(panel.getAttribute("data-tab") || "theme");
      if (ctx.onSaved) ctx.onSaved(saved, photoUrl);
      say(MSG.saved, "ok");
      post();
      return true;
    }, function () { say("Not saved: the server could not be reached.", "err"); return false; });
  }
  function doDiscard() {
    startFrom(saved);
    photoUrl = ctx.savedPhotoUrl || photoUrl;
    themeRows = themeRowsFrom(lastThemes);
    showTab(panel.getAttribute("data-tab") || "theme");
    say(MSG.discarded, "info");
    post();
  }
  function doReset(e) {
    var b = e && e.currentTarget ? e.currentTarget : q("[data-act=reset]");
    if (b.getAttribute("data-confirm") !== "1") { b.setAttribute("data-confirm", "1"); b.textContent = MSG.confirmReset; return Promise.resolve(false); }
    b.removeAttribute("data-confirm");
    b.textContent = "Reset profile design";
    return send("/api/bfp/profile/design", "DELETE").then(function (r) {
      if (!r.ok) { say("Not reset: " + ((r.body && r.body.error) || "the server refused it") + ".", "err"); return false; }
      photoUrl = null;
      startFrom(null);
      themeRows = themeRowsFrom(lastThemes);
      showTab(panel.getAttribute("data-tab") || "theme");
      if (ctx.onSaved) ctx.onSaved(null, null);
      say(MSG.reset, "ok");
      post();
      return true;
    }, function () { say("Not reset: the server could not be reached.", "err"); return false; });
  }

  /* The looks to choose from: the original, the saved profile theme, the
     member's own saved themes, and the presets. */
  var lastThemes = [];
  function themeRowsFrom(themes) {
    var rows = [{ key: "original", name: "The original look", theme: null }];
    if (saved && saved.theme) rows.push({ key: "saved", name: "My saved profile theme", theme: saved.theme, photo_url: ctx.savedPhotoUrl || null });
    (themes || []).forEach(function (t) {
      if (t && typeof t.id === "string" && t.theme) rows.push({ key: "mine-" + t.id, name: String(t.name || "Untitled"), theme: t.theme, photo_url: t.photo_url || null });
    });
    var T = window.BFTheme;
    ((T && T.PRESETS) || []).forEach(function (p) { if (p.id !== "original") rows.push({ key: "preset-" + p.id, name: p.name + " (preset)", theme: p.theme }); });
    return rows;
  }

  function openPanel() {
    if (!ctx) return;
    if (!panel) build();
    startFrom(saved);
    photoUrl = ctx.savedPhotoUrl || null;
    themeRows = themeRowsFrom(lastThemes);
    var uid = String(ctx.userId || "");
    if (UUID.test(uid) && !frame.getAttribute("src")) frame.setAttribute("src", "/profile.html?id=" + encodeURIComponent(uid) + "&bf_preview=1");
    panel.hidden = false;
    showTab("theme");
    say("Changes show in the preview. Save to show them to visitors.", "info");
    var t = panel.querySelector("#pde-tab-theme");
    if (t) t.focus();
    post();
    send("/api/themes", "GET").then(function (r) {
      if (!r.ok || !r.body || !Array.isArray(r.body.themes)) return;
      lastThemes = r.body.themes;
      themeRows = themeRowsFrom(lastThemes);
      if (panel.getAttribute("data-tab") === "theme") showTab("theme");
    }, function () { /* the saved looks stay out; the presets are there */ });
  }
  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    var opener = doc.getElementById("customiseBtn");
    if (opener) opener.focus();
  }

  /* mount({ userId, name, saved, savedPhotoUrl, grid: [{ id, title }], videos: [{ id, title }], onSaved(design, photoUrl) }) */
  function mount(opts) {
    if (!window.BFProfileDesign) return false;
    ctx = opts || {};
    saved = ctx.saved ? clone(ctx.saved) : null;
    var b = doc.getElementById("customiseBtn");
    if (b) { b.hidden = false; b.onclick = openPanel; }
    return true;
  }

  window.BFProfileEditor = {
    mount: mount, open: openPanel, close: closePanel, TABS: TABS, MSG: MSG,
    draft: function () { return draft ? clone(draft) : null; },
    saved: function () { return saved ? clone(saved) : null; },
    save: doSave, discard: doDiscard, reset: doReset, setView: setView, showTab: function (id) { showTab(id); }
  };
})();

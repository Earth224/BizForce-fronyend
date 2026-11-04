/* scripts/media-library.js — media.html, the member's Media Library.
   The usage line, Upload (POST /api/media, which checks each file by its
   bytes and removes location and camera details from photos), and one card
   per file: its label and alt text with Save, Copy link, Where used and
   Delete. A file in use is not deleted: the server answers 409 with where it
   is used, and the card says so. Every word from the server is set with
   textContent, never innerHTML. */
(function () {
  "use strict";
  var API = "https://dynamic-prosperity-production-5382.up.railway.app";
  var MAX_BYTES = 10 * 1024 * 1024;
  var TOO_BIG = "A file is at most 10 MB.";
  var MB = 1024 * 1024;
  var nextBefore = null;

  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function headers(json) {
    var h = { "Authorization": "Bearer " + token() };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function call(method, path, body) {
    var init = { method: method, headers: headers(body !== undefined) };
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetch(API + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, body: b || {} }; });
    });
  }
  function say(text, isError) {
    var s = $("mlStatus");
    s.textContent = text || "";
    s.className = "ml-status" + (isError ? " err" : "");
  }
  function mbText(bytes) {
    var n = bytes / MB;
    return (n >= 10 || n === 0 ? Math.round(n) : Math.round(n * 10) / 10) + " MB";
  }

  function loadUsage() {
    return call("GET", "/api/media/usage").then(function (r) {
      if (!r.ok) { $("mlUsage").textContent = r.body.error || "Your storage could not be read."; return; }
      $("mlUsage").textContent = mbText(r.body.used_bytes || 0) + " of " + Math.round((r.body.cap_bytes || 0) / MB) + " MB used";
    }).catch(function () { $("mlUsage").textContent = "Your storage could not be read."; });
  }

  function card(item) {
    var c = el("article", { "class": "ml-card", "data-media-id": item.id });
    var view;
    if (item.kind === "video") {
      view = el("video", { controls: "", preload: "metadata" });
      view.muted = true;
    } else {
      view = el("img", { alt: item.alt_text || "", loading: "lazy" });
    }
    view.src = item.url;
    c.appendChild(view);
    c.appendChild(el("p", { "class": "ml-meta" }, (item.kind === "video" ? "Video" : "Image") + ", " + mbText(item.bytes || 0) +
      (item.metadata_stripped ? ", location and camera details removed" : "")));

    var labelWrap = el("label", { "class": "ml-field" }, "Label");
    var label = el("input", { type: "text", maxlength: "120" });
    label.value = item.label || "";
    labelWrap.appendChild(label);
    c.appendChild(labelWrap);
    var altWrap = el("label", { "class": "ml-field" }, "Alt text");
    var alt = el("textarea", { maxlength: "1000" });
    alt.value = item.alt_text || "";
    altWrap.appendChild(alt);
    c.appendChild(altWrap);

    var msg = el("p", { "class": "ml-msg", role: "status" });
    function note(text, isError) { msg.textContent = text || ""; msg.className = "ml-msg" + (isError ? " err" : ""); }

    var actions = el("div", { "class": "ml-actions" });
    var save = el("button", { type: "button", "class": "ml-btn" }, "Save");
    var copy = el("button", { type: "button", "class": "ml-btn" }, "Copy link");
    var where = el("button", { type: "button", "class": "ml-btn" }, "Where used");
    var del = el("button", { type: "button", "class": "ml-btn danger" }, "Delete");
    [save, copy, where, del].forEach(function (b) { actions.appendChild(b); });
    c.appendChild(actions);
    c.appendChild(msg);

    save.addEventListener("click", function () {
      call("PATCH", "/api/media/" + encodeURIComponent(item.id), { label: label.value, alt_text: alt.value }).then(function (r) {
        if (!r.ok) { note(r.body.error || "That did not save. Try again.", true); return; }
        item = r.body.item || item;
        if (view.tagName === "IMG") view.setAttribute("alt", item.alt_text || "");
        note("Saved");
      }).catch(function () { note("That did not save. Try again.", true); });
    });
    copy.addEventListener("click", function () {
      var done = function () { note("Link copied"); };
      try {
        navigator.clipboard.writeText(item.url).then(done, function () { note("Copy this link: " + item.url); });
      } catch (e) { note("Copy this link: " + item.url); }
    });
    where.addEventListener("click", function () {
      call("GET", "/api/media/" + encodeURIComponent(item.id) + "/uses").then(function (r) {
        if (!r.ok) { note(r.body.error || "Where it is used could not be checked.", true); return; }
        var uses = r.body.uses || [];
        note(uses.length ? "This file is used in: " + uses.map(function (u) { return u.title ? u.place + " (" + u.title + ")" : u.place; }).join(", ") + "." : "This file isn't used anywhere yet.");
      }).catch(function () { note("Where it is used could not be checked.", true); });
    });
    del.addEventListener("click", function () {
      if (!window.confirm("Delete this file from your library? Its link will stop working.")) return;
      call("DELETE", "/api/media/" + encodeURIComponent(item.id)).then(function (r) {
        if (r.status === 409) { note(r.body.error || "This file is in use, so it wasn't deleted.", true); return; }
        if (!r.ok) { note(r.body.error || "That did not delete. Try again.", true); return; }
        if (c.parentNode) c.parentNode.removeChild(c);
        if (!$("mlGrid").firstChild) showEmpty();
        loadUsage();
      }).catch(function () { note("That did not delete. Try again.", true); });
    });
    return c;
  }

  function showEmpty() {
    var grid = $("mlGrid");
    while (grid.firstChild) grid.removeChild(grid.firstChild);
    grid.appendChild(el("p", { "class": "ml-empty" }, "Your library is empty. Upload a photo or a short video to start."));
  }

  function loadItems(more) {
    var q = more && nextBefore ? "?before=" + encodeURIComponent(nextBefore) : "";
    return call("GET", "/api/media" + q).then(function (r) {
      var grid = $("mlGrid");
      if (!r.ok) { say(r.body.error || "Your library could not be loaded.", true); return; }
      if (!more) while (grid.firstChild) grid.removeChild(grid.firstChild);
      var items = r.body.items || [];
      if (!more && !items.length) showEmpty();
      items.forEach(function (it) { grid.appendChild(card(it)); });
      nextBefore = r.body.next_before || null;
      $("mlMore").hidden = !nextBefore;
    }).catch(function () { say("Your library could not be loaded.", true); });
  }

  function upload(file) {
    if (!file) return;
    if (file.size > MAX_BYTES) { say(TOO_BIG, true); return; }
    var form = new FormData();
    form.append("file", file);
    var btn = $("mlUploadBtn");
    btn.disabled = true;
    say("Uploading…");
    fetch(API + "/api/media", { method: "POST", headers: headers(false), body: form })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, status: r.status, body: b || {} }; }); })
      .then(function (r) {
        btn.disabled = false;
        if (!r.ok) { say(r.body.error || "The upload did not work. Try again.", true); return; }
        say(r.body.duplicate ? "That file is already in your library." : "Added to your library.");
        loadItems(false);
        loadUsage();
      })
      .catch(function () { btn.disabled = false; say("The upload did not work. Try again.", true); });
  }

  $("mlUploadBtn").addEventListener("click", function () { $("mlFile").click(); });
  $("mlFile").addEventListener("change", function () {
    var file = this.files && this.files[0];
    this.value = "";
    upload(file);
  });
  $("mlMore").addEventListener("click", function () { loadItems(true); });
  loadUsage();
  loadItems(false);
})();

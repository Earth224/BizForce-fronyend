/* scripts/media-picker.js — "Choose from my library": a modal any page opens
   to pick a file from the member's Media Library (media.html), or to upload a
   new one into it, and get back the same shape the pages already store:
   { url, type, name }, type "image" or "video", name from the item's label.

     BFMediaPicker.open({ kind: "image" | "video" | null }) -> Promise of
     { url, type, name }, or null when the member closes it.

   Every word from the server is set with textContent, never innerHTML. The
   upload goes through POST /api/media, which checks the file by its bytes and
   removes location and camera details from photos before saving it. */
(function (root) {
  "use strict";
  var API = "https://dynamic-prosperity-production-5382.up.railway.app";
  var MAX_BYTES = 10 * 1024 * 1024;
  var TOO_BIG = "A file is at most 10 MB.";
  var ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm";
  var STYLE_ID = "bfMediaPickerStyle";
  var CSS =
    ".bf-mp-back{position:fixed;inset:0;z-index:2000;background:rgba(3,6,16,.78);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".bf-mp{background:rgba(10,15,35,.98);border:1px solid rgba(var(--bf-accent-b-rgb, 168,85,247),.3);border-radius:18px;padding:22px;width:100%;max-width:720px;max-height:88vh;overflow-y:auto;color:#e8e8ff;font-family:inherit}" +
    ".bf-mp-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}" +
    ".bf-mp-title{margin:0;font-size:1.05rem;font-weight:800}" +
    ".bf-mp-btn{padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#e8e8ff;font:inherit;font-size:.85rem;cursor:pointer}" +
    ".bf-mp-btn:hover{border-color:rgba(var(--bf-accent-b-rgb, 168,85,247),.55)}" +
    ".bf-mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-top:12px}" +
    ".bf-mp-item{display:flex;flex-direction:column;gap:6px;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:#e8e8ff;font:inherit;font-size:.75rem;cursor:pointer;text-align:left}" +
    ".bf-mp-item:hover,.bf-mp-item:focus{border-color:rgba(var(--bf-accent-a3-rgb, 0,229,255),.6);outline:none}" +
    ".bf-mp-item img,.bf-mp-item video{width:100%;height:96px;object-fit:cover;border-radius:8px;background:#000}" +
    ".bf-mp-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".bf-mp-status{margin:10px 0 0;font-size:.85rem;color:#8892b8;min-height:1.2em}";

  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = el("style", { id: STYLE_ID });
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  /* The shape the pages store: the same as an upload's { url, type, name }. */
  function shapeOf(item) {
    return { url: item.url, type: item.kind === "video" ? "video" : "image", name: item.label || (item.kind === "video" ? "Video" : "Image") };
  }
  function thumb(item) {
    if (item.kind === "video") {
      var v = el("video", { preload: "metadata" });
      v.muted = true;
      v.src = item.url;
      return v;
    }
    var i = el("img", { alt: item.alt_text || "", loading: "lazy" });
    i.src = item.url;
    return i;
  }

  function open(opts) {
    opts = opts || {};
    var kind = opts.kind === "image" || opts.kind === "video" ? opts.kind : null;
    addStyle();
    return new Promise(function (resolve) {
      var done = false;
      var back = el("div", { "class": "bf-mp-back", id: "bfMediaPicker" });
      var box = el("div", { "class": "bf-mp", role: "dialog", "aria-modal": "true", "aria-labelledby": "bfMpTitle" });
      var head = el("div", { "class": "bf-mp-head" });
      head.appendChild(el("h2", { "class": "bf-mp-title", id: "bfMpTitle" }, "Choose from my library"));
      var closeBtn = el("button", { type: "button", "class": "bf-mp-btn", id: "bfMpClose" }, "Close");
      head.appendChild(closeBtn);
      box.appendChild(head);
      var input = el("input", { type: "file", accept: kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : kind === "video" ? "video/mp4,video/webm" : ACCEPT, id: "bfMpFile" });
      input.style.display = "none";
      var uploadBtn = el("button", { type: "button", "class": "bf-mp-btn", id: "bfMpUpload" }, "Upload new");
      box.appendChild(input);
      box.appendChild(uploadBtn);
      var status = el("p", { "class": "bf-mp-status", id: "bfMpStatus", role: "status" });
      box.appendChild(status);
      var grid = el("div", { "class": "bf-mp-grid", id: "bfMpGrid" });
      box.appendChild(grid);
      back.appendChild(box);
      document.body.appendChild(back);

      function finish(value) {
        if (done) return;
        done = true;
        document.removeEventListener("keydown", onKey);
        if (back.parentNode) back.parentNode.removeChild(back);
        resolve(value);
      }
      function onKey(e) { if (e.key === "Escape") finish(null); }
      document.addEventListener("keydown", onKey);
      closeBtn.addEventListener("click", function () { finish(null); });
      back.addEventListener("click", function (e) { if (e.target === back) finish(null); });

      function draw(items) {
        while (grid.firstChild) grid.removeChild(grid.firstChild);
        if (!items.length) { status.textContent = "Your library is empty. Upload a file to add it."; return; }
        status.textContent = "";
        items.forEach(function (item) {
          var b = el("button", { type: "button", "class": "bf-mp-item", "data-media-id": item.id });
          b.appendChild(thumb(item));
          b.appendChild(el("span", { "class": "bf-mp-label" }, item.label || (item.kind === "video" ? "Video" : "Image")));
          b.addEventListener("click", function () { finish(shapeOf(item)); });
          grid.appendChild(b);
        });
      }

      status.textContent = "Loading your library…";
      fetch(API + "/api/media" + (kind ? "?kind=" + kind : ""), { headers: { "Authorization": "Bearer " + token() } })
        .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
        .then(function (r) {
          if (!r.ok) { status.textContent = (r.body && r.body.error) || "Your library could not be loaded."; return; }
          draw((r.body && r.body.items) || []);
        })
        .catch(function () { status.textContent = "Your library could not be loaded."; });

      uploadBtn.addEventListener("click", function () { input.click(); });
      input.addEventListener("change", function () {
        var file = input.files && input.files[0];
        input.value = "";
        if (!file) return;
        if (file.size > MAX_BYTES) { status.textContent = TOO_BIG; return; }
        var form = new FormData();
        form.append("file", file);
        status.textContent = "Uploading…";
        uploadBtn.disabled = true;
        fetch(API + "/api/media", { method: "POST", headers: { "Authorization": "Bearer " + token() }, body: form })
          .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
          .then(function (r) {
            uploadBtn.disabled = false;
            if (!r.ok || !r.body || !r.body.item) { status.textContent = (r.body && r.body.error) || "The upload did not work. Try again."; return; }
            if (kind && r.body.item.kind !== kind) { status.textContent = "Saved to your library, but it isn't " + (kind === "image" ? "an image" : "a video") + "."; return; }
            finish(shapeOf(r.body.item));
          })
          .catch(function () { uploadBtn.disabled = false; status.textContent = "The upload did not work. Try again."; });
      });
      closeBtn.focus();
    });
  }

  root.BFMediaPicker = { open: open, shapeOf: shapeOf, MAX_BYTES: MAX_BYTES };
})(window);

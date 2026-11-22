/* ══════════════════════════════════════════════════════════════════════════
   bf-composer.js — making a post (P2-3, Nov 20 2026; the backend's
   lib/posts.js and lib/postMedia.js).

   BFComposer.mount(el, opts) puts the composer in el (compose.html, the
   full-screen page a phone opens from the Create sheet). BFComposer.openModal()
   shows it in a modal over the page (a desktop's Create sheet). It has:
     the text        up to 2200 characters, with a live count
     photos          up to 4, each previewed with Remove. Before upload each is
                     made smaller here, with a canvas only: the long edge at most
                     1080 px, WebP at quality 0.8 (JPEG at 0.82 where the browser
                     cannot make WebP), and a 360 px thumbnail. Both go to
                     POST /api/posts/photos (the Media Library's rules, at most
                     600 KB each; a photo already in the library is reused).
     who sees it     Public or Followers
     Post            POST /api/posts; the content screen's refusal is shown
                     under the box, in its own words
   Video is not here: video posts are coming (P2-8).
   NAMED (Nov 21 2026, P3-1B, the owner's rules):
     what it is      Share (the default) or Need (asking for help); offer posts come with selling (members)
     a free account  a share post needs at least one photo: the note under the photos says so, and Post
                     says why instead of sending (the server refuses it too); a Need may be text
     a member        Show in Google (on by default) with an optional search title (70 characters) and
                     description (160), filled from the post's first words until edited; sent as
                     search_visible, seo_title and seo_description (public posts only)
   After posting, opts.onDone(post) runs; by default the page goes to Home.
   Nothing is kept on the device.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined" || window.BFComposer) return;

  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var BODY_MAX = 2200, PHOTOS_MAX = 4, LONG_EDGE = 1080, THUMB_EDGE = 360, WEBP_Q = 0.8, JPEG_Q = 0.82, PHOTO_MAX_BYTES = 600 * 1024;
  var BREAKPOINT = "(max-width: 760px)";
  // NAMED (Nov 21 2026, P3-1B)
  var SEO_TITLE_MAX = 70, SEO_DESCRIPTION_MAX = 160;
  var FREE_PHOTO_NOTE = "A free account's share post needs at least one photo. Text-only posts are for members; a Need can be text.";
  function firstWords(t, n) { var a = Array.from(String(t || "").replace(/\s+/g, " ").trim()); return a.length > n ? a.slice(0, n - 3).join("").trim() + "..." : a.join(""); }

  function api() { return (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK; }
  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function chars(s) { return Array.from(String(s)).length; }
  function whenAccess(cb) {   // NAMED (Nov 21 2026, P3-1B): scripts/bf-access.js ready, now or once it loads
    if (window.bfAccess && window.bfAccess.ready) { window.bfAccess.ready.then(cb); return; }
    document.addEventListener("bf-access", function (e) { cb(e.detail); }, { once: true });
  }

  var CSS = [
    ".bfc-form{display:flex;flex-direction:column;gap:12px;color:#e8e8ff;font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".bfc-text{box-sizing:border-box;width:100%;min-height:150px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:#070b18;color:#e8e8ff;",
    "font:16px/1.5 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;resize:vertical}",
    ".bfc-text:focus{outline:2px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.6);outline-offset:1px}",
    ".bfc-line{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    ".bfc-count{margin-left:auto;font-size:.8rem;color:#8e98c2}",
    ".bfc-count.is-over{color:#fca5a5;font-weight:700}",
    ".bfc-photos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}",
    ".bfc-photos:empty{display:none}",
    ".bfc-ph{position:relative;aspect-ratio:1/1;border-radius:12px;overflow:hidden;background:#0b1230}",
    ".bfc-ph img{display:block;width:100%;height:100%;object-fit:cover}",
    ".bfc-rm{position:absolute;top:4px;right:4px;min-width:44px;min-height:32px;padding:0 8px;border-radius:16px;border:0;background:rgba(0,0,0,.7);color:#fff;font:700 .75rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".bfc-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(18,26,54,.9);color:#e8e8ff;",
    "font:700 .9rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".bfc-btn[aria-disabled=true]{opacity:.5;cursor:default}",
    ".bfc-soon{font-size:.8rem;color:#a9b3cc}",
    ".bfc-aud{display:flex;gap:8px;border:0;margin:0;padding:0;flex-wrap:wrap}",
    ".bfc-aud legend{font-size:.85rem;font-weight:700;color:#c4cbe0;margin-bottom:6px;padding:0}",
    ".bfc-aud label{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(18,26,54,.7);cursor:pointer}",
    ".bfc-aud input{width:18px;height:18px;accent-color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-err{margin:0;padding:10px 12px;border-radius:12px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.35);color:#fca5a5;font-size:.9rem;line-height:1.45}",
    ".bfc-err:empty{display:none}",
    ".bfc-status{margin:0;font-size:.88rem;color:#a9b3cc}",
    ".bfc-status:empty{display:none}",
    ".bfc-post{min-height:48px;padding:0 26px;border-radius:14px;border:0;background:linear-gradient(90deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6));color:#070b18;",
    "font:800 1rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer;align-self:flex-end}",
    ".bfc-post[disabled]{opacity:.55;cursor:default}",
    "#bfc-modal-backdrop{position:fixed;inset:0;z-index:2147483100;background:rgba(2,4,12,.65)}",
    "#bfc-modal{position:fixed;z-index:2147483101;left:50%;top:50%;transform:translate(-50%,-50%);width:min(600px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow-y:auto;",
    "box-sizing:border-box;padding:20px;border-radius:20px;background:#0b1022;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);box-shadow:0 24px 60px rgba(0,0,0,.55)}",
    "#bfc-modal[hidden],#bfc-modal-backdrop[hidden]{display:none}",
    ".bfc-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}",
    ".bfc-head h2{flex:1;margin:0;font-size:1.2rem;font-weight:800;color:#f4f7ff}",
    /* NAMED (Nov 21 2026, P3-1B): the intent choice, the free photo note and the member's Show in Google box */
    ".bfc-note{margin:0;padding:10px 12px;border-radius:12px;background:rgba(var(--bf-accent-a-rgb, 34,211,238),.08);border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.3);color:#c4cbe0;font-size:.88rem;line-height:1.45}",
    ".bfc-note[hidden],.bfc-seo[hidden]{display:none}",
    ".bfc-seo{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(18,26,54,.5)}",
    ".bfc-seo .bfc-check{display:inline-flex;align-items:center;gap:10px;min-height:44px;font-weight:700;cursor:pointer}",
    ".bfc-seo .bfc-check input{width:20px;height:20px;accent-color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-seo label.bfc-fl{font-size:.82rem;font-weight:700;color:#c4cbe0}",
    ".bfc-seo input[type=text],.bfc-seo textarea{box-sizing:border-box;width:100%;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#070b18;color:#e8e8ff;font:15px/1.4 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".bfc-seo textarea{min-height:72px;resize:vertical}",
    ".bfc-seo .bfc-sub{font-size:.78rem;color:#8e98c2}",
    ".bfc-x{width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#e8e8ff;cursor:pointer;display:flex;align-items:center;justify-content:center}"
  ].join("");
  function addStyle() {
    if (document.getElementById("bf-composer-style")) return;
    var st = document.createElement("style");
    st.id = "bf-composer-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── the canvas resize ── */
  var webpOk = null;
  function canWebp() {
    if (webpOk === null) { try { var c = document.createElement("canvas"); c.width = c.height = 1; webpOk = c.toDataURL("image/webp").indexOf("data:image/webp") === 0; } catch (e) { webpOk = false; } }
    return webpOk;
  }
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That file isn't a picture this browser can open.")); };
      img.src = url;
    });
  }
  function drawTo(img, edge, type, quality) {
    var w = img.naturalWidth, h = img.naturalHeight;
    var scale = Math.min(1, edge / Math.max(w, h));
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    var g = c.getContext("2d");
    g.drawImage(img, 0, 0, c.width, c.height);
    return new Promise(function (resolve, reject) {
      c.toBlob(function (b) { if (b) resolve(b); else reject(new Error("The photo couldn't be prepared.")); }, type, quality);
    });
  }
  function prepare(file) {
    var type = canWebp() ? "image/webp" : "image/jpeg", q = type === "image/webp" ? WEBP_Q : JPEG_Q;
    return loadImage(file).then(function (x) {
      return Promise.all([drawTo(x.img, LONG_EDGE, type, q), drawTo(x.img, THUMB_EDGE, type, q)]).then(function (b) {
        return { full: b[0], thumb: b[1], preview: x.url, type: type };
      });
    });
  }
  function upload(blob, type) {
    var fd = new FormData();
    fd.append("file", blob, "photo." + (type === "image/webp" ? "webp" : "jpg"));
    return window.fetch(api() + "/api/posts/photos", { method: "POST", headers: { "Authorization": "Bearer " + token() }, body: fd })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || !d.item) throw new Error(d.error || "A photo couldn't be uploaded. Try again.");
        return d.item.id;
      }); });
  }

  /* ── the form ── */
  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    addStyle();
    var photos = [];   // { file, prepared?, preview }
    el.innerHTML = '<form class="bfc-form" novalidate>' +
      '<label for="bfcText" class="bfc-soon">What do you want to say?</label>' +
      '<textarea id="bfcText" class="bfc-text" maxlength="' + (BODY_MAX + 200) + '" placeholder="Write a post"></textarea>' +
      '<div class="bfc-line"><span class="bfc-count" id="bfcCount" aria-live="polite">0 / ' + BODY_MAX + '</span></div>' +
      '<ul class="bfc-photos" id="bfcPhotos" aria-label="Photos"></ul>' +
      '<div class="bfc-line"><label class="bfc-btn" id="bfcAddLabel" for="bfcFile">Add photos</label>' +
      '<input type="file" id="bfcFile" accept="image/jpeg,image/png,image/webp" multiple hidden>' +
      '<span class="bfc-btn" aria-disabled="true" title="Video posts are coming">Video</span><span class="bfc-soon">Video: Coming soon</span></div>' +
      // NAMED (Nov 21 2026, P3-1B): what it is (Share or Need), the free photo note, the member's Show in Google box
      '<fieldset class="bfc-aud" id="bfcIntent"><legend>What is it</legend>' +
      '<label><input type="radio" name="bfcIntent" value="share" checked> Share</label>' +
      '<label><input type="radio" name="bfcIntent" value="need"> Need (ask for help)</label></fieldset>' +
      '<p class="bfc-note" id="bfcFreeNote" hidden>' + esc(FREE_PHOTO_NOTE) + '</p>' +
      '<fieldset class="bfc-aud"><legend>Who sees it</legend>' +
      '<label><input type="radio" name="bfcAud" value="public" checked> Public</label>' +
      '<label><input type="radio" name="bfcAud" value="followers"> Followers</label></fieldset>' +
      '<div class="bfc-seo" id="bfcSeo" hidden>' +
      '<label class="bfc-check"><input type="checkbox" id="bfcSearch" checked> Show in Google</label>' +
      '<span class="bfc-sub">Members only. Search engines may list this public post with the title and description below.</span>' +
      '<label class="bfc-fl" for="bfcSeoTitle">Search title (optional, ' + SEO_TITLE_MAX + ' characters)</label>' +
      '<input type="text" id="bfcSeoTitle" maxlength="' + SEO_TITLE_MAX + '">' +
      '<label class="bfc-fl" for="bfcSeoDesc">Search description (optional, ' + SEO_DESCRIPTION_MAX + ' characters)</label>' +
      '<textarea id="bfcSeoDesc" maxlength="' + SEO_DESCRIPTION_MAX + '"></textarea></div>' +
      '<p class="bfc-err" id="bfcErr" role="alert"></p>' +
      '<p class="bfc-status" id="bfcStatus" role="status"></p>' +
      '<button type="submit" class="bfc-post" id="bfcPost">Post</button>' +
      '</form>';
    var form = el.querySelector("form"), text = el.querySelector("#bfcText"), count = el.querySelector("#bfcCount");
    var list = el.querySelector("#bfcPhotos"), file = el.querySelector("#bfcFile"), err = el.querySelector("#bfcErr"), status = el.querySelector("#bfcStatus");
    var post = el.querySelector("#bfcPost"), addLabel = el.querySelector("#bfcAddLabel");
    // NAMED (Nov 21 2026, P3-1B): the tier (scripts/bf-access.js; unknown reads as neither, and the server decides)
    var tier = null, seoBox = el.querySelector("#bfcSeo"), freeNote = el.querySelector("#bfcFreeNote");
    var seoTitle = el.querySelector("#bfcSeoTitle"), seoDesc = el.querySelector("#bfcSeoDesc"), searchOn = el.querySelector("#bfcSearch");
    var seoEdited = { t: false, d: false };
    seoTitle.addEventListener("input", function () { seoEdited.t = true; });
    seoDesc.addEventListener("input", function () { seoEdited.d = true; });
    function intent() { return (el.querySelector('input[name="bfcIntent"]:checked') || {}).value || "share"; }
    function audienceNow() { return (el.querySelector('input[name="bfcAud"]:checked') || {}).value || "public"; }
    function rules() {
      freeNote.hidden = !(tier === "free" && intent() === "share" && !photos.length);
      seoBox.hidden = !(tier === "member" && audienceNow() === "public");
      if (!seoEdited.t) seoTitle.value = firstWords(text.value, SEO_TITLE_MAX);
      if (!seoEdited.d) seoDesc.value = firstWords(text.value, SEO_DESCRIPTION_MAX);
    }
    el.addEventListener("change", function (e) { if (e.target && /^bfc(Intent|Aud)$/.test(e.target.name || "")) rules(); });
    whenAccess(function (a) { tier = a && a.tier; rules(); });
    function upd() {
      var k = chars(text.value);
      count.textContent = k + " / " + BODY_MAX;
      count.classList.toggle("is-over", k > BODY_MAX);
      addLabel.setAttribute("aria-disabled", String(photos.length >= PHOTOS_MAX));
      rules();   // NAMED (Nov 21 2026, P3-1B)
    }
    function draw() {
      list.innerHTML = photos.map(function (p, i) {
        return '<li class="bfc-ph"><img src="' + esc(p.preview) + '" alt="Photo ' + (i + 1) + '"><button type="button" class="bfc-rm" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">Remove</button></li>';
      }).join("");
      upd();
    }
    text.addEventListener("input", function () { err.textContent = ""; upd(); });
    addLabel.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
    addLabel.setAttribute("tabindex", "0");
    addLabel.setAttribute("role", "button");
    file.addEventListener("change", function () {
      var picked = Array.prototype.slice.call(file.files || []);
      file.value = "";
      err.textContent = "";
      if (photos.length + picked.length > PHOTOS_MAX) err.textContent = "A post has at most " + PHOTOS_MAX + " photos. The first ones were added.";
      picked.slice(0, PHOTOS_MAX - photos.length).forEach(function (f) {
        var entry = { file: f, preview: "" };
        photos.push(entry);
        entry.ready = prepare(f).then(function (x) { entry.prepared = x; entry.preview = x.preview; draw(); return x; })
          .catch(function (e) { photos.splice(photos.indexOf(entry), 1); err.textContent = e.message; draw(); return null; });
      });
      draw();
    });
    list.addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]");
      if (!b) return;
      var gone = photos.splice(Number(b.getAttribute("data-rm")), 1)[0];
      if (gone && gone.preview) { try { URL.revokeObjectURL(gone.preview); } catch (x) { /* fine */ } }
      draw();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.textContent = "";
      var body = text.value.trim();
      if (!body && !photos.length) { err.textContent = "Write something or add a photo to post."; return; }
      if (chars(body) > BODY_MAX) { err.textContent = "A post is at most " + BODY_MAX + " characters."; return; }
      var audience = (el.querySelector('input[name="bfcAud"]:checked') || {}).value || "public";
      // NAMED (Nov 21 2026, P3-1B): a free account's share post without a photo is not sent; the note says why
      if (tier === "free" && intent() === "share" && !photos.length) { err.textContent = FREE_PHOTO_NOTE; freeNote.hidden = false; return; }
      var extra = { intent: intent() };
      if (tier === "member" && audience === "public") { extra.search_visible = !!searchOn.checked; extra.seo_title = seoTitle.value.trim() || null; extra.seo_description = seoDesc.value.trim() || null; }
      post.disabled = true;
      var media = [];
      var chain = Promise.all(photos.map(function (p) { return p.ready; })).then(function (ready) {
        if (ready.some(function (x) { return !x; })) throw new Error("A photo couldn't be prepared. Remove it and try again.");
        var big = ready.filter(function (x) { return x.full.size > PHOTO_MAX_BYTES; });
        if (big.length) throw new Error("A photo is still over 600 KB after making it smaller. Try another photo.");
        var i = 0;
        var next = function () {
          if (i >= ready.length) return Promise.resolve();
          status.textContent = "Uploading photo " + (i + 1) + " of " + ready.length + "...";
          var x = ready[i++];
          return upload(x.full, x.type).then(function (fullId) {
            return upload(x.thumb, x.type).then(function (thumbId) { media.push({ media_id: fullId, thumb_media_id: thumbId }); return next(); });
          });
        };
        return next();
      }).then(function () {
        status.textContent = "Posting...";
        return window.fetch(api() + "/api/posts", { method: "POST", headers: { "Authorization": "Bearer " + token(), "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({ kind: media.length ? "photo" : "text", body: body, audience: audience, media: media }, extra)) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "Your post wasn't saved. Try again."); return d; }); });
      });
      chain.then(function (d) {
        status.textContent = d.message || "Your post is up.";
        if (typeof opts.onDone === "function") opts.onDone(d.post, d);
        else window.location.href = "/home.html";
      }).catch(function (e2) {
        post.disabled = false;
        status.textContent = "";
        err.textContent = e2.message || "Your post wasn't saved. Try again.";
      });
    });
    upd();
    setTimeout(function () { try { text.focus(); } catch (e) { /* fine */ } }, 0);
    return { form: form };
  }

  /* ── the desktop modal ── */
  var modal = null, back = null, from = null;
  function closeModal() {
    if (!modal || modal.hidden) return;
    modal.hidden = true; back.hidden = true;
    if (from && from.focus) { try { from.focus(); } catch (e) { /* gone */ } }
  }
  function openModal(opts) {
    if (window.matchMedia && window.matchMedia(BREAKPOINT).matches) { window.location.href = "/compose.html"; return; }
    addStyle();
    from = document.activeElement;
    if (!modal) {
      back = document.createElement("div"); back.id = "bfc-modal-backdrop";
      modal = document.createElement("div"); modal.id = "bfc-modal";
      modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true"); modal.setAttribute("aria-labelledby", "bfc-modal-title");
      modal.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeModal(); } });
      document.body.appendChild(back); document.body.appendChild(modal);
    }
    modal.innerHTML = '<div class="bfc-head"><h2 id="bfc-modal-title">New post</h2><button type="button" class="bfc-x" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div id="bfcModalBody"></div>';
    modal.querySelector(".bfc-x").addEventListener("click", closeModal);
    back.onclick = closeModal;
    mount(modal.querySelector("#bfcModalBody"), { onDone: function (post, d) {
      closeModal();
      if (opts && typeof opts.onDone === "function") { opts.onDone(post, d); return; }
      if (window.BFHome && typeof window.BFHome.added === "function") window.BFHome.added(post, d);
      else window.location.href = "/home.html";
    } });
    back.hidden = false; modal.hidden = false;
  }

  window.BFComposer = { mount: mount, openModal: openModal, closeModal: closeModal, BODY_MAX: BODY_MAX, PHOTOS_MAX: PHOTOS_MAX, LONG_EDGE: LONG_EDGE,
    THUMB_EDGE: THUMB_EDGE, WEBP_QUALITY: WEBP_Q, JPEG_QUALITY: JPEG_Q, PHOTO_MAX_BYTES: PHOTO_MAX_BYTES,
    SEO_TITLE_MAX: SEO_TITLE_MAX, SEO_DESCRIPTION_MAX: SEO_DESCRIPTION_MAX, FREE_PHOTO_NOTE: FREE_PHOTO_NOTE, firstWords: firstWords };   // NAMED (Nov 21 2026, P3-1B)
})();

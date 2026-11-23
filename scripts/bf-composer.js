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
   NAMED (Nov 23 2026, P3-3, the owner's board "New post: Share, Offer or Need"):
     what it is      three tiles: Share, Offer (members; a free account's tile opens the members panel) and Need
     the category    required, from the one list (GET /api/categories); a Need adds Where and When; an Offer names
                     one of the member's own active listings or services; Post moves to the header
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

  /* NAMED (Nov 23 2026, P3-3): the owner's board "New post: Share, Offer or Need", figure for figure (backend
     scripts/designSpec.js COMPOSER; checkDesignFidelity holds these rules to it). Every tap target is 44 px or more: the
     board's 40 px chips and Post pill and 38 px segment pills are drawn inside 44 px labels and buttons. */
  var CSS = [
    ".bfc-form{display:flex;flex-direction:column;gap:16px;color:#e6eaf5;font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".bfc-form [hidden]{display:none!important}",
    ".bfc-sec{display:flex;flex-direction:column;gap:8px;min-width:0}",
    ".bfc-lab{display:block;margin:0;font-size:13px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#a9b3cc}",
    ".bfc-sr{position:absolute;left:0;top:0;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}",
    /* the three tiles */
    ".bfc-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 2px}",
    ".bfc-tile{position:relative;display:block;min-width:0;cursor:pointer}",
    ".bfc-tile .bfc-face{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;height:64px;box-sizing:border-box;padding:0 4px;border-radius:10px;",
    "border:1.5px solid #2b3a6b;background:#0e1428;text-align:center}",
    ".bfc-tile b{font-size:16px;line-height:20px;font-weight:800;color:#c9d1e6}",
    ".bfc-tile small{font-size:13px;line-height:16px;color:#a9b3cc}",
    ".bfc-tile input:checked+.bfc-face{background:#0f2a3a;border-color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-tile input:checked+.bfc-face b{color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-tile input:checked+.bfc-face small{color:#9ee6f2}",
    ".bfc-sr:focus-visible+.bfc-face{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}",
    ".bfc-mtag{position:absolute;top:-8px;right:8px;padding:1px 6px;border-radius:999px;background:#070b18;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.4);",
    "color:var(--bf-accent-a, #22d3ee);font-size:10px;line-height:14px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}",
    /* the box */
    ".bfc-text{display:block;box-sizing:border-box;width:100%;height:108px;min-height:108px;padding:12px 13px;border-radius:12px;border:1px solid #2b3a6b;background:#0b1022;color:#e6eaf5;",
    "font:16px/20px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;resize:vertical}",
    ".bfc-text::placeholder,.bfc-in::placeholder{color:#757575}",
    ".bfc-text:focus,.bfc-in:focus{outline:2px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.6);outline-offset:1px}",
    ".bfc-count{align-self:flex-end;font-size:13px;line-height:16px;color:#a9b3cc}",
    ".bfc-count.is-over{color:#fca5a5;font-weight:700}",
    ".bfc-offer{display:flex;flex-direction:column;gap:8px}",
    ".bfc-in{display:block;box-sizing:border-box;width:100%;height:44px;padding:0 13px;border-radius:12px;border:1px solid #2b3a6b;background:#0b1022;color:#e6eaf5;",
    "font:16px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    /* the category chips: one row that swipes */
    ".bfc-chips{display:flex;gap:8px;margin-top:-3px;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}",
    ".bfc-chip{position:relative;flex:none;display:flex;align-items:center;height:44px;cursor:pointer}",
    ".bfc-chip .bfc-face{display:flex;align-items:center;height:40px;box-sizing:border-box;padding:0 15px;border-radius:20px;border:1px solid #2b3a6b;background:#0e1428;",
    "color:#c9d1e6;font-size:14px;white-space:nowrap}",
    ".bfc-chip input:checked+.bfc-face{background:#0f2a3a;border-color:var(--bf-accent-a, #22d3ee);color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-sub{margin:0;font-size:13px;line-height:16px;color:#a9b3cc}",
    ".bfc-sub a{color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-again{min-height:44px;padding:0 14px;margin-left:4px;border-radius:12px;border:1px solid #2b3a6b;background:#0e1428;color:#e6eaf5;font:700 14px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    /* Where and When (a Need) */
    ".bfc-need{flex-direction:row;align-items:flex-start;gap:11px}",
    ".bfc-where{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}",
    ".bfc-when{flex:none;display:flex;flex-direction:column;gap:8px}",
    /* the segments (When; Public or Followers): 44 px labels, the board's 38 px pills inside */
    ".bfc-seg{display:flex;box-sizing:border-box;height:44px;padding:0 3px;border-radius:12px;background:#0e1428;box-shadow:inset 0 0 0 1px #1e2848}",
    ".bfc-opt{position:relative;display:flex;align-items:stretch;min-width:44px;padding:3px 0;box-sizing:border-box;cursor:pointer}",
    ".bfc-opt .bfc-face{display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;padding:0 8px;border-radius:9px;color:#a9b3cc;font-size:15px;white-space:nowrap}",
    ".bfc-when .bfc-opt input:checked+.bfc-face{background:var(--bf-accent-a, #22d3ee);color:#070b18;font-weight:700}",
    ".bfc-aud .bfc-opt{flex:1}",
    ".bfc-aud .bfc-opt .bfc-face{font-size:16px}",
    ".bfc-aud .bfc-opt input:checked+.bfc-face{background:#1a2244;color:#e6eaf5;font-weight:800}",
    /* the photos: four slots, the next free one adds */
    ".bfc-photos{display:grid;grid-template-columns:repeat(4,minmax(0,78px));gap:8px;margin:0;padding:0;list-style:none}",
    ".bfc-slot,.bfc-ph{position:relative;aspect-ratio:1/1;box-sizing:border-box;border-radius:10px;overflow:hidden}",
    ".bfc-slot{border:1.5px dashed #2b3a6b;background:#0b1022}",
    ".bfc-ph{background:#0b1022}",
    ".bfc-ph img{display:block;width:100%;height:100%;object-fit:cover}",
    ".bfc-add{display:flex;width:100%;height:100%;align-items:center;justify-content:center;color:#a9b3cc;cursor:pointer}",
    ".bfc-add:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:-3px}",
    ".bfc-rm{position:absolute;top:4px;right:4px;min-width:44px;min-height:32px;padding:0 8px;border-radius:16px;border:0;background:rgba(0,0,0,.7);color:#fff;font:700 .75rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    /* the Need box */
    ".bfc-info{display:flex;align-items:center;gap:14px;box-sizing:border-box;min-height:62px;margin:0;padding:12px 16px 12px 15px;border-radius:14px;border:1px solid #1e2848;background:#0e1428;",
    "color:#c9d1e6;font-size:15px;line-height:18.5px}",
    ".bfc-info-i{flex:none;display:flex;color:var(--bf-accent-a, #22d3ee)}",
    ".bfc-err{margin:0;padding:10px 12px;border-radius:12px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.35);color:#fca5a5;font-size:.9rem;line-height:1.45}",
    ".bfc-err:empty{display:none}",
    ".bfc-status{margin:0;font-size:.88rem;color:#a9b3cc}",
    ".bfc-status:empty{display:none}",
    /* Post: 44 px to tap, the board's 40 px pill */
    ".bfc-post{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:0;border:0;background:none;cursor:pointer}",
    ".bfc-form>.bfc-post{align-self:flex-end}",
    ".bfc-pill{display:inline-flex;align-items:center;height:40px;padding:0 18px;border-radius:20px;background:linear-gradient(90deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6));",
    "color:#070b18;font:800 16px/1 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".bfc-post[disabled]{cursor:default}",
    ".bfc-post[disabled] .bfc-pill{opacity:.55}",
    ".bfc-post:focus-visible{outline:none}",
    ".bfc-post:focus-visible .bfc-pill{outline:2px solid #fff;outline-offset:2px}",
    "#bfc-modal-backdrop{position:fixed;inset:0;z-index:2147483100;background:rgba(2,4,12,.65)}",
    "#bfc-modal{position:fixed;z-index:2147483101;left:50%;top:50%;transform:translate(-50%,-50%);width:min(600px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow-y:auto;",
    "box-sizing:border-box;padding:20px;border-radius:20px;background:#0b1022;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);box-shadow:0 24px 60px rgba(0,0,0,.55)}",
    "#bfc-modal[hidden],#bfc-modal-backdrop[hidden]{display:none}",
    ".bfc-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}",
    ".bfc-head h2{flex:1;margin:0;font-size:1.2rem;font-weight:800;color:#f4f7ff}",
    /* NAMED (Nov 21 2026, P3-1B): the free photo note and the member's Show in Google box */
    ".bfc-note{margin:0;padding:10px 12px;border-radius:12px;background:rgba(var(--bf-accent-a-rgb, 34,211,238),.08);border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.3);color:#c4cbe0;font-size:.88rem;line-height:1.45}",
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
  /* NAMED (Nov 23 2026, P3-3, the owner's board "New post: Share, Offer or Need"): BEFORE the box, Add photos and Video, then
     "What is it" (Share or Need) and Who sees it, with Post at the foot. AFTER, top to bottom, as the board draws it:
       WHAT IS THIS POST?   three tiles, Share "Show your work", Offer "Sell or book", Need "Ask for help"; the chosen one cyan.
                            A free account's Offer tile carries the Members tag and opens the members panel (bf-access.js
                            MEMBER_ACTIONS [data-members-only]); offers are members only.
       the box's label      follows the intent: Share keeps "What do you want to say?", Need "What do you need?" with the
                            board's example, Offer "What are you offering?" with a required picker of the member's own active
                            listings and services (GET /api/posts/composer). 2200 characters, the count under it.
       CATEGORY             the one list (GET /api/categories, the categories table), chips in a row that swipes sideways;
                            required. An Offer takes its listing's category until another chip is chosen.
       WHERE and WHEN       a Need only: the place (prefilled from the profile's place, 80 characters) and Today, Week or Any.
       PHOTOS (UP TO 4)     four slots, the next free one adds; the same canvas rules as before. Video is not offered (P2-8).
       the Need box         a public Need only: "Members who offer this nearby will be told about your post." (true:
                            lib/needAlerts.js tells them in the app; a followers-only Need tells no one, so it is not shown).
       Public / Followers   then a member's Show in Google box, as before.
     Post sits in the header (opts.postSlot: compose.html's header, the modal's head), 44 px to tap with the board's 40 px pill. */
  var NEED_PLACE_MAX = 80;
  var INTENTS = [["share", "Share", "Show your work"], ["offer", "Offer", "Sell or book"], ["need", "Need", "Ask for help"]];
  var TEXT_LABEL = { share: "What do you want to say?", offer: "What are you offering?", need: "What do you need?" };
  var TEXT_HINT = { share: "Write a post", offer: "Say what it is, the price and how to book.", need: "Example: Looking for a tattoo artist for a forearm piece, black and grey, this month." };
  var WHENS = [["today", "Today"], ["week", "Week"], ["any", "Any"]];
  var CAT_NOTE = "The same list as the Market. Swipe for more.";
  var NEED_BOX = "Members who offer this nearby will be told about your post.";
  var MSG = {
    category: "Choose a category.",
    categoriesDown: "The categories couldn't load. Check your connection and try again.",
    listing: "Choose the listing or service this post offers.",
    noListings: "You have no active listings or services yet. Add one in the Market, then offer it here.",
    place: "Where is at most " + NEED_PLACE_MAX + " characters."
  };
  var TARGET_SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>';
  var forms = 0;
  function getJson(path) {
    return window.fetch(api() + path, { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || "error"); return d; }); });
  }
  function radios(name, items, cls, checked) {
    return items.map(function (it) {
      return '<label class="' + cls + '" data-v="' + esc(it[0]) + '"><input type="radio" class="bfc-sr" name="' + name + '" value="' + esc(it[0]) + '"' + (it[0] === checked ? " checked" : "") + '>' +
        '<span class="bfc-face">' + (it[2] !== undefined ? '<b>' + esc(it[1]) + '</b><small>' + esc(it[2]) + '</small>' : esc(it[1])) + '</span></label>';
    }).join("");
  }

  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    addStyle();
    var photos = [];   // { file, prepared?, preview }
    var formId = "bfcForm" + (forms++ ? forms : "");
    el.innerHTML = '<form class="bfc-form" id="' + formId + '" novalidate>' +
      '<div class="bfc-sec"><span class="bfc-lab" id="bfcIntentL">What is this post?</span>' +
      '<div class="bfc-tiles" id="bfcIntent" role="radiogroup" aria-labelledby="bfcIntentL">' + radios("bfcIntent", INTENTS, "bfc-tile", "share") + '</div></div>' +
      '<div class="bfc-sec"><label class="bfc-lab" for="bfcText" id="bfcTextL">' + esc(TEXT_LABEL.share) + '</label>' +
      '<div class="bfc-offer" id="bfcOffer" hidden><select id="bfcListing" class="bfc-in" aria-label="The listing or service this post offers"><option value="">Choose a listing or service</option></select>' +
      '<p class="bfc-sub" id="bfcOfferNone" hidden>' + esc(MSG.noListings) + ' <a href="/marketplace.html">Go to the Market</a></p></div>' +
      '<textarea id="bfcText" class="bfc-text" maxlength="' + (BODY_MAX + 200) + '" placeholder="' + esc(TEXT_HINT.share) + '"></textarea>' +
      '<span class="bfc-count" id="bfcCount" aria-live="polite">0 / ' + BODY_MAX + '</span></div>' +
      '<div class="bfc-sec"><span class="bfc-lab" id="bfcCatL">Category</span>' +
      '<div class="bfc-chips" id="bfcCats" role="radiogroup" aria-labelledby="bfcCatL" aria-required="true"></div>' +
      '<p class="bfc-sub" id="bfcCatNote">' + esc(CAT_NOTE) + '</p></div>' +
      '<div class="bfc-sec bfc-need" id="bfcNeed" hidden><div class="bfc-where"><label class="bfc-lab" for="bfcPlace">Where</label>' +
      '<input type="text" id="bfcPlace" class="bfc-in" maxlength="' + NEED_PLACE_MAX + '" autocomplete="address-level2" placeholder="Your city"></div>' +
      '<div class="bfc-when"><span class="bfc-lab" id="bfcWhenL">When</span><div class="bfc-seg" id="bfcWhen" role="radiogroup" aria-labelledby="bfcWhenL">' + radios("bfcWhen", WHENS, "bfc-opt", "any") + '</div></div></div>' +
      '<div class="bfc-sec"><span class="bfc-lab" id="bfcPhotosL">Photos (up to ' + PHOTOS_MAX + ')</span>' +
      '<ul class="bfc-photos" id="bfcPhotos" aria-labelledby="bfcPhotosL"></ul>' +
      '<input type="file" id="bfcFile" accept="image/jpeg,image/png,image/webp" multiple hidden>' +
      '<p class="bfc-note" id="bfcFreeNote" hidden>' + esc(FREE_PHOTO_NOTE) + '</p></div>' +
      '<p class="bfc-info" id="bfcNeedBox" hidden><span class="bfc-info-i">' + TARGET_SVG + '</span><span>' + esc(NEED_BOX) + '</span></p>' +
      '<div class="bfc-aud bfc-seg" id="bfcAudience" role="radiogroup" aria-label="Who sees it">' + radios("bfcAud", [["public", "Public"], ["followers", "Followers"]], "bfc-opt", "public") + '</div>' +
      '<div class="bfc-seo" id="bfcSeo" hidden>' +
      '<label class="bfc-check"><input type="checkbox" id="bfcSearch" checked> Show in Google</label>' +
      '<span class="bfc-sub">Members only. Search engines may list this public post with the title and description below.</span>' +
      '<label class="bfc-fl" for="bfcSeoTitle">Search title (optional, ' + SEO_TITLE_MAX + ' characters)</label>' +
      '<input type="text" id="bfcSeoTitle" maxlength="' + SEO_TITLE_MAX + '">' +
      '<label class="bfc-fl" for="bfcSeoDesc">Search description (optional, ' + SEO_DESCRIPTION_MAX + ' characters)</label>' +
      '<textarea id="bfcSeoDesc" maxlength="' + SEO_DESCRIPTION_MAX + '"></textarea></div>' +
      '<p class="bfc-err" id="bfcErr" role="alert"></p>' +
      '<p class="bfc-status" id="bfcStatus" role="status"></p>' +
      '</form>';
    var form = el.querySelector("form"), text = el.querySelector("#bfcText"), count = el.querySelector("#bfcCount");
    var list = el.querySelector("#bfcPhotos"), file = el.querySelector("#bfcFile"), err = el.querySelector("#bfcErr"), status = el.querySelector("#bfcStatus");
    // Post: in the header slot when there is one (the board), else at the form's foot
    var post = document.createElement("button");
    post.type = "submit"; post.className = "bfc-post"; post.id = "bfcPost"; post.setAttribute("form", formId);
    post.innerHTML = '<span class="bfc-pill">Post</span>';
    if (opts.postSlot && opts.postSlot.appendChild) { var old = opts.postSlot.querySelector(".bfc-post"); if (old) old.parentNode.removeChild(old); opts.postSlot.appendChild(post); }
    else form.appendChild(post);
    var tier = null, seoBox = el.querySelector("#bfcSeo"), freeNote = el.querySelector("#bfcFreeNote");
    var seoTitle = el.querySelector("#bfcSeoTitle"), seoDesc = el.querySelector("#bfcSeoDesc"), searchOn = el.querySelector("#bfcSearch");
    var textL = el.querySelector("#bfcTextL"), offerBox = el.querySelector("#bfcOffer"), listing = el.querySelector("#bfcListing"), offerNone = el.querySelector("#bfcOfferNone");
    var cats = el.querySelector("#bfcCats"), catNote = el.querySelector("#bfcCatNote"), needSec = el.querySelector("#bfcNeed"), place = el.querySelector("#bfcPlace"), needBox = el.querySelector("#bfcNeedBox");
    var seoEdited = { t: false, d: false }, placeEdited = false, catChosen = false, info = null, lastIntent = "share";
    seoTitle.addEventListener("input", function () { seoEdited.t = true; });
    seoDesc.addEventListener("input", function () { seoEdited.d = true; });
    place.addEventListener("input", function () { placeEdited = true; err.textContent = ""; });
    function val(name, dflt) { return (el.querySelector('input[name="' + name + '"]:checked') || {}).value || dflt; }
    function intent() { return val("bfcIntent", "share"); }
    function audienceNow() { return val("bfcAud", "public"); }
    function category() { return val("bfcCat", ""); }
    function pick(name, v) { var r = el.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; return !!r; }
    function rules() {
      var it = intent();
      textL.textContent = TEXT_LABEL[it];
      text.placeholder = TEXT_HINT[it];
      offerBox.hidden = it !== "offer";
      needSec.hidden = it !== "need";
      needBox.hidden = !(it === "need" && audienceNow() === "public");
      freeNote.hidden = !(tier === "free" && it === "share" && !photos.length);
      seoBox.hidden = !(tier === "member" && audienceNow() === "public");
      if (!seoEdited.t) seoTitle.value = firstWords(text.value, SEO_TITLE_MAX);
      if (!seoEdited.d) seoDesc.value = firstWords(text.value, SEO_DESCRIPTION_MAX);
    }
    // a free account's Offer: the members panel (bf-access.js stops the tap first); a key that reaches it anyway goes back
    function membersOffer() {
      if (tier !== "free" || intent() !== "offer") return false;
      pick("bfcIntent", lastIntent === "offer" ? "share" : lastIntent);
      if (window.bfAccess && window.bfAccess.showPanel) window.bfAccess.showPanel();
      return true;
    }
    function showChosen() {
      var r = el.querySelector('input[name="bfcCat"]:checked');
      var lab = r && r.closest("label");
      if (lab) cats.scrollLeft = Math.max(0, lab.offsetLeft - cats.offsetLeft - 16);
    }
    function linkedCategory() {
      var o = info && info.offers ? info.offers.filter(function (x) { return x.id === listing.value; })[0] : null;
      if (o && o.category && !catChosen && pick("bfcCat", o.category)) showChosen();
    }
    el.addEventListener("change", function (e) {
      var n = e.target && e.target.name;
      if (n === "bfcIntent") { if (membersOffer()) { rules(); return; } lastIntent = intent(); if (intent() === "offer") linkedCategory(); err.textContent = ""; }
      if (n === "bfcCat") { catChosen = true; err.textContent = ""; }
      if (n === "bfcIntent" || n === "bfcAud" || n === "bfcCat" || n === "bfcWhen") rules();
    });
    listing.addEventListener("change", function () { err.textContent = ""; linkedCategory(); });
    whenAccess(function (a) {
      tier = a && a.tier;
      if (tier === "free") {
        var t = el.querySelector('.bfc-tile[data-v="offer"]');
        if (t && !t.hasAttribute("data-members-only")) {
          t.setAttribute("data-members-only", "");
          var tag = document.createElement("span"); tag.className = "bfc-mtag"; tag.textContent = "Members"; t.appendChild(tag);
          t.querySelector("input").setAttribute("aria-label", "Offer, sell or book, for members");
        }
        membersOffer();
      }
      rules();
    });
    // the one category list
    function loadCats() {
      cats.innerHTML = "";
      catNote.textContent = CAT_NOTE;
      getJson("/api/categories").then(function (d) {
        var rows = Array.isArray(d.categories) ? d.categories : [];
        if (!rows.length) throw new Error("empty");
        cats.innerHTML = radios("bfcCat", rows.map(function (c) { return [c.slug, c.name]; }), "bfc-chip", null);
        if (intent() === "offer") linkedCategory();
      }).catch(function () {
        catNote.textContent = MSG.categoriesDown + " ";
        var again = document.createElement("button"); again.type = "button"; again.className = "bfc-again"; again.textContent = "Try again";
        again.addEventListener("click", loadCats); catNote.appendChild(again);
      });
    }
    loadCats();
    // the member's place (a Need's Where) and their active listings and services (an Offer's picker)
    getJson("/api/posts/composer").then(function (d) {
      info = d || {};
      if (info.place && !placeEdited && !place.value) place.value = String(info.place).slice(0, NEED_PLACE_MAX);
      var offers = Array.isArray(info.offers) ? info.offers : [];
      offers.forEach(function (o) { var op = document.createElement("option"); op.value = o.id; op.textContent = (o.kind === "service" ? "Service: " : "") + o.title; listing.appendChild(op); });
      offerNone.hidden = offers.length > 0;
      if (intent() === "offer") linkedCategory();
    }).catch(function () { info = { offers: [] }; offerNone.hidden = false; });
    function upd() {
      var k = chars(text.value);
      count.textContent = k + " / " + BODY_MAX;
      count.classList.toggle("is-over", k > BODY_MAX);
      rules();
    }
    function draw() {
      var html = photos.map(function (p, i) {
        return '<li class="bfc-ph"><img src="' + esc(p.preview) + '" alt="Photo ' + (i + 1) + '"><button type="button" class="bfc-rm" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">Remove</button></li>';
      });
      for (var j = photos.length; j < PHOTOS_MAX; j++) {
        html.push(j === photos.length ? '<li class="bfc-slot"><label class="bfc-add" id="bfcAddLabel" for="bfcFile" role="button" tabindex="0" aria-label="Add photos">' +
          '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M3 12h18"/></svg></label></li>' : '<li class="bfc-slot" aria-hidden="true"></li>');
      }
      list.innerHTML = html.join("");
      var add = list.querySelector("#bfcAddLabel");
      if (add) add.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } });
      upd();
    }
    text.addEventListener("input", function () { err.textContent = ""; upd(); });
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
    function stop(msg, focusEl) { err.textContent = msg; if (focusEl && focusEl.focus) { try { focusEl.focus(); } catch (x) { /* fine */ } } }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.textContent = "";
      var body = text.value.trim(), it = intent();
      if (!body && !photos.length) { stop("Write something or add a photo to post.", text); return; }
      if (chars(body) > BODY_MAX) { stop("A post is at most " + BODY_MAX + " characters.", text); return; }
      var audience = audienceNow();
      // NAMED (Nov 21 2026, P3-1B): a free account's share post without a photo is not sent; the note says why
      if (tier === "free" && intent() === "share" && !photos.length) { err.textContent = FREE_PHOTO_NOTE; freeNote.hidden = false; return; }
      if (membersOffer()) { rules(); return; }
      // NAMED (Nov 23 2026, P3-3): an Offer names its listing; every post names a category; a Need's Where and When
      if (it === "offer" && !listing.value) { stop(MSG.listing, listing); return; }
      if (!category()) { stop(MSG.category, cats.querySelector("input")); return; }
      var extra = { intent: it, category: category() };
      if (it === "offer") extra.listing_id = listing.value;
      if (it === "need") {
        var where = place.value.replace(/\s+/g, " ").trim();
        if (chars(where) > NEED_PLACE_MAX) { stop(MSG.place, place); return; }
        extra.need_place = where || null;
        extra.need_when = val("bfcWhen", "any");
      }
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
    draw();
    setTimeout(function () { try { text.focus({ preventScroll: true }); } catch (e) { /* fine */ } }, 0);
    return { form: form, post: post };
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
    // NAMED (Nov 23 2026, P3-3): Post sits in the head, beside Close, as on the board's header
    modal.innerHTML = '<div class="bfc-head"><h2 id="bfc-modal-title">New post</h2><span class="bfc-head-post" id="bfcModalPost"></span><button type="button" class="bfc-x" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div id="bfcModalBody"></div>';
    modal.querySelector(".bfc-x").addEventListener("click", closeModal);
    back.onclick = closeModal;
    mount(modal.querySelector("#bfcModalBody"), { postSlot: modal.querySelector("#bfcModalPost"), onDone: function (post, d) {
      closeModal();
      if (opts && typeof opts.onDone === "function") { opts.onDone(post, d); return; }
      if (window.BFHome && typeof window.BFHome.added === "function") window.BFHome.added(post, d);
      else window.location.href = "/home.html";
    } });
    back.hidden = false; modal.hidden = false;
  }

  window.BFComposer = { mount: mount, openModal: openModal, closeModal: closeModal, BODY_MAX: BODY_MAX, PHOTOS_MAX: PHOTOS_MAX, LONG_EDGE: LONG_EDGE,
    THUMB_EDGE: THUMB_EDGE, WEBP_QUALITY: WEBP_Q, JPEG_QUALITY: JPEG_Q, PHOTO_MAX_BYTES: PHOTO_MAX_BYTES,
    SEO_TITLE_MAX: SEO_TITLE_MAX, SEO_DESCRIPTION_MAX: SEO_DESCRIPTION_MAX, FREE_PHOTO_NOTE: FREE_PHOTO_NOTE, firstWords: firstWords,   // NAMED (Nov 21 2026, P3-1B)
    NEED_PLACE_MAX: NEED_PLACE_MAX, INTENTS: INTENTS, TEXT_LABEL: TEXT_LABEL, TEXT_HINT: TEXT_HINT, WHENS: WHENS, CAT_NOTE: CAT_NOTE, NEED_BOX: NEED_BOX, MSG: MSG };   // NAMED (Nov 23 2026, P3-3)
})();

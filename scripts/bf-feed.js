/* ══════════════════════════════════════════════════════════════════════════
   bf-feed.js — posts on the page (P2-3, Nov 20 2026; the backend's lib/posts.js,
   migrations 193 and 194). home.html and profile.html load it.

   BFFeed.mount(el, opts) fills el with posts from GET /api/feed/following,
   FEED_PAGE at a time, the next page when the end
   comes into view (next_cursor). opts.onFirst(body) gets the first answer
   (following_count, suggestions, any_posts). On a phone (max-width 760px) and
   with opts.full, each post fills the screen above the bottom bar and the
   feed snaps from one to the next; on a desktop each post is a card in the
   600 px column.

   A POST shows its photos (thumbnails, swiped between; a tap opens the full
   photo, the only time it is loaded) or, for a text post, the text card; the
   author's name and handle (opening their profile, with Follow beside them
   when the viewer does not follow them); the text; and the actions:
     Like    POST or DELETE /api/posts/:id/like, with the count
     Talk    the comment sheet (a bottom sheet on a phone, a side panel on a
             desktop), with the count
     Save    POST or DELETE /api/posts/:id/save (Saved, on the profile, is private)
     Share   the device's share sheet with bizforceai.net/p/<id>, else the link
             is copied; POST /api/posts/:id/share counts one a day per member
     ...     scripts/bf-safety.js: Report, Block, Mute; for the author, Edit
             and Delete
   Tip BFC is not here: it arrives in P2-5.

   TALK lists comments oldest first, one level of replies, each with Reply,
   and a menu: Delete (the commenter's own, leaving "[deleted]" so the replies
   stay), Hide (the post's author, on their own post) and Report. Up to 1000
   characters; the content screen's refusal is shown under the box.

   Nothing new is kept on the device.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined" || window.BFFeed) return;

  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var ORIGIN = "https://bizforceai.net";
  var BREAKPOINT = "(max-width: 760px)";
  var COMMENT_MAX = 1000;
  var BODY_MAX = 2200;

  function api() { return (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK; }
  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function myId() { try { var t = token(); return t ? JSON.parse(atob(t.split(".")[1])).id || null : null; } catch (e) { return null; } }
  function phone() { return !!(window.matchMedia && window.matchMedia(BREAKPOINT).matches); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function safeUrl(u) { return typeof u === "string" && /^(https:\/\/|\/)/.test(u) && !/^\/\//.test(u) ? u : ""; }
  function n(v) { return (Number(v) || 0).toLocaleString("en-US"); }
  function svg(paths, size, fill) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' + (fill ? "currentColor" : "none") + '" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }
  function call(method, path, body) {
    var headers = { "Authorization": "Bearer " + token() };
    if (body) headers["Content-Type"] = "application/json";
    return window.fetch(api() + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, body: d || {} }; }); });
  }
  function ago(iso) {
    var t = Date.parse(iso);
    if (!t) return "";
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    if (s < 604800) return Math.floor(s / 86400) + "d";
    return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  var ICON = {
    like: '<path d="M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.3 1.1 5.6 3.4C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z"/>',
    talk: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'
  };

  var CSS = [
    /* the feed, as cards (desktop, and a phone when not full) */
    ".bfp-feed{display:flex;flex-direction:column;gap:18px;min-width:0}",
    ".bfp-post{position:relative;display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:18px;background:rgba(10,15,35,.82);border:1px solid rgba(255,255,255,.08);color:#e8e8ff;min-width:0}",
    ".bfp-meta{display:contents}",
    ".bfp-head{order:-1;display:flex;align-items:center;gap:10px;min-width:0}",
    ".bfp-av{width:40px;height:40px;flex:none;border-radius:20px;object-fit:cover;background:#1b2447;display:flex;align-items:center;justify-content:center;font-weight:800;color:#c9d1e6;text-decoration:none}",
    ".bfp-who{flex:1;min-width:0;display:flex;flex-direction:column;text-decoration:none;color:inherit}",
    ".bfp-name{font-weight:800;font-size:.95rem;color:#f4f7ff;overflow-wrap:anywhere}",
    ".bfp-handle{font-size:.8rem;color:#8892b8;overflow-wrap:anywhere}",
    ".bfp-follow{flex:none;min-height:36px;padding:0 14px;border-radius:18px;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.5);background:transparent;color:var(--bf-accent-a, #22d3ee);font:700 .82rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".bfp-follow.is-on{border-color:rgba(255,255,255,.2);color:#a9b3cc}",
    ".bfp-menu{flex:none}",
    ".bfp-photos{position:relative;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:0;border-radius:14px;background:#0b1230}",
    ".bfp-photo{flex:0 0 100%;scroll-snap-align:center;border:0;padding:0;margin:0;background:transparent;cursor:zoom-in;display:block}",
    ".bfp-photo img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover}",
    ".bfp-dots{display:flex;justify-content:center;gap:6px;margin-top:-2px}",
    ".bfp-dot{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.25)}",
    ".bfp-dot.is-on{background:#fff}",
    ".bfp-text{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.95rem;line-height:1.5;color:#e8e8ff}",
    ".bfp-textcard{display:flex;align-items:center;justify-content:center;min-height:220px;padding:28px 22px;border-radius:14px;background:linear-gradient(135deg,#12204a,#2a1650);",
    "font-size:1.2rem;font-weight:700;line-height:1.45;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;color:#f4f7ff}",
    ".bfp-status{margin:0;font-size:.8rem;color:#fbbf24}",
    ".bfp-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap}",
    ".bfp-act{display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:0 10px;border:0;border-radius:12px;background:transparent;color:#c9d1e6;",
    "font:700 .85rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".bfp-act:hover,.bfp-act:focus-visible{background:rgba(255,255,255,.06);outline:none}",
    ".bfp-act[aria-pressed=true][data-act=like]{color:#fb7185}",
    ".bfp-act[aria-pressed=true][data-act=like] svg{fill:currentColor}",
    ".bfp-act[aria-pressed=true][data-act=save]{color:#f5c46b}",
    ".bfp-act[aria-pressed=true][data-act=save] svg{fill:currentColor}",
    ".bfp-time{margin-left:auto;font-size:.78rem;color:#8892b8}",
    ".bfp-note{margin:0;min-height:0;font-size:.82rem;color:#6ee7b7}",
    ".bfp-note:empty{display:none}",
    ".bfp-end,.bfp-loading,.bfp-error{margin:0;padding:12px 0;text-align:center;color:#8892b8;font-size:.88rem}",
    ".bfp-error{color:#fca5a5}",
    /* the full-screen phone feed */
    "@media " + BREAKPOINT + "{",
    ".bfp-feed.is-full{position:fixed;left:0;right:0;top:0;bottom:calc(56px + env(safe-area-inset-bottom, 0px));z-index:40;gap:0;overflow-y:auto;scroll-snap-type:y mandatory;background:#03050c;overscroll-behavior:contain}",
    ".bfp-feed.is-full>.bfp-post,.bfp-feed.is-full>.bfp-slide{flex:0 0 100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;border-radius:0;border:0;padding:0;background:#03050c;overflow:hidden}",
    ".bfp-feed.is-full .bfp-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}",
    ".bfp-feed.is-full .bfp-photos{width:100%;height:100%;border-radius:0}",
    ".bfp-feed.is-full .bfp-photo img{height:100%;aspect-ratio:auto;object-fit:contain}",
    ".bfp-feed.is-full .bfp-textcard{width:100%;height:100%;border-radius:0;padding:80px 84px 140px 22px;font-size:1.35rem}",
    ".bfp-feed.is-full .bfp-dots{position:absolute;left:0;right:0;top:64px;margin:0}",
    ".bfp-feed.is-full .bfp-meta{position:absolute;left:14px;right:84px;bottom:16px;z-index:2;display:flex;flex-direction:column;gap:8px;text-shadow:0 1px 3px rgba(0,0,0,.85)}",
    ".bfp-feed.is-full .bfp-info{display:flex;flex-direction:column;gap:6px}",
    ".bfp-feed.is-full .bfp-name{color:#fff}",
    ".bfp-feed.is-full .bfp-handle{color:#dfe5f5}",
    ".bfp-feed.is-full .bfp-note{position:absolute;left:14px;right:84px;top:70px;z-index:3;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.6)}",
    ".bfp-feed.is-full .bfp-info .bfp-text{max-height:5.6em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical}",
    ".bfp-feed.is-full .bfp-actions{position:absolute;right:8px;bottom:18px;z-index:2;flex-direction:column;flex-wrap:nowrap;gap:6px}",
    ".bfp-feed.is-full .bfp-act{flex-direction:column;gap:2px;min-width:56px;padding:6px 4px;color:#fff;font-size:.75rem;text-shadow:0 1px 3px rgba(0,0,0,.85)}",
    ".bfp-feed.is-full .bfp-act svg{width:30px;height:30px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}",
    ".bfp-feed.is-full .bfp-time{margin:0;color:#c9d1e6}",
    ".bfp-feed.is-full .bfp-menu .bf-safety-dots{background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.25)}",
    ".bfp-feed.is-full .bfp-shade{position:absolute;left:0;right:0;bottom:0;height:55%;background:linear-gradient(transparent,rgba(0,0,0,.72));pointer-events:none;z-index:1}",
    ".bfp-feed.is-full>.bfp-slide{display:flex;flex-direction:column;justify-content:center;padding:72px 16px 16px;overflow-y:auto}",
    ".bfp-feed.is-full>.bfp-end{flex:0 0 auto;padding:18px 0}",
    "}",
    /* Talk */
    "#bfp-talk-backdrop{position:fixed;inset:0;z-index:2147483200;background:rgba(2,4,12,.55)}",
    "#bfp-talk{position:fixed;z-index:2147483201;top:0;right:0;bottom:0;width:min(420px,100vw);box-sizing:border-box;display:flex;flex-direction:column;background:#0b1022;",
    "border-left:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);color:#e8e8ff;font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;box-shadow:-18px 0 48px rgba(0,0,0,.5)}",
    "#bfp-talk[hidden],#bfp-talk-backdrop[hidden],#bfp-dialog[hidden],#bfp-viewer[hidden]{display:none}",
    "#bfp-talk .bfp-talk-grip{display:none}",
    "#bfp-talk .bfp-talk-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.08)}",
    "#bfp-talk h2{flex:1;margin:0;font-size:1.1rem;font-weight:800;color:#f4f7ff}",
    ".bfp-x{width:44px;height:44px;min-width:44px;border-radius:22px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#e8e8ff;display:flex;align-items:center;justify-content:center;cursor:pointer}",
    "#bfp-talk .bfp-talk-list{flex:1;overflow-y:auto;margin:0;padding:12px 16px;list-style:none;display:flex;flex-direction:column;gap:12px}",
    ".bfp-c{display:flex;flex-direction:column;gap:4px}",
    ".bfp-c.is-reply{margin-left:28px}",
    ".bfp-c-top{display:flex;align-items:center;gap:8px}",
    ".bfp-c-name{display:inline-flex;align-items:center;min-height:44px;min-width:44px;font-weight:800;font-size:.85rem;color:#f4f7ff;text-decoration:none}",
    ".bfp-c-time{font-size:.75rem;color:#8892b8}",
    ".bfp-c-body{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.92rem;line-height:1.45;color:#dfe5f5}",
    ".bfp-c.is-deleted .bfp-c-body{color:#8892b8;font-style:italic}",
    ".bfp-c-acts{display:flex;gap:4px}",
    ".bfp-c-act{min-height:44px;min-width:44px;padding:0 10px;border:0;border-radius:10px;background:transparent;color:#a9b3cc;font:700 .78rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".bfp-c-act:hover,.bfp-c-act:focus-visible{background:rgba(255,255,255,.06);outline:none}",
    "#bfp-talk .bfp-talk-form{display:flex;flex-direction:column;gap:6px;padding:12px 16px calc(12px + env(safe-area-inset-bottom, 0px));border-top:1px solid rgba(255,255,255,.08)}",
    ".bfp-replying{display:flex;align-items:center;gap:8px;font-size:.8rem;color:#a9b3cc}",
    ".bfp-replying[hidden]{display:none}",
    ".bfp-row{display:flex;gap:8px;align-items:flex-end}",
    ".bfp-input{flex:1;box-sizing:border-box;min-height:44px;max-height:140px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:#070b18;color:#e8e8ff;",
    "font:15px/1.4 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;resize:none}",
    ".bfp-send{min-height:44px;padding:0 16px;border-radius:12px;border:0;background:var(--bf-accent-a, #22d3ee);color:#04121a;font:800 .9rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".bfp-send[disabled]{opacity:.55;cursor:default}",
    ".bfp-count{font-size:.75rem;color:#8e98c2;align-self:flex-end}",
    ".bfp-err{margin:0;font-size:.85rem;color:#fca5a5}",
    ".bfp-err:empty{display:none}",
    ".bfp-empty{margin:0;color:#8892b8;font-size:.9rem;text-align:center;padding:20px 0}",
    "@media " + BREAKPOINT + "{",
    "#bfp-talk{top:auto;left:0;right:0;width:auto;height:72dvh;border-left:0;border-top:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);border-radius:22px 22px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.55)}",
    "#bfp-talk .bfp-talk-grip{display:block;align-self:center;width:40px;height:5px;margin-top:8px;border-radius:3px;background:rgba(255,255,255,.18)}",
    "}",
    /* a small dialog (edit, delete) and the photo viewer */
    "#bfp-dialog-backdrop{position:fixed;inset:0;z-index:2147483250;background:rgba(2,4,12,.6)}",
    "#bfp-dialog-backdrop[hidden]{display:none}",
    "#bfp-dialog{position:fixed;z-index:2147483251;left:50%;top:50%;transform:translate(-50%,-50%);width:min(480px,calc(100vw - 32px));box-sizing:border-box;display:flex;flex-direction:column;gap:12px;",
    "padding:20px;border-radius:20px;background:#0b1022;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);color:#e8e8ff;font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    "#bfp-dialog h2{margin:0;font-size:1.15rem;font-weight:800;color:#f4f7ff}",
    "#bfp-dialog p{margin:0;font-size:.92rem;line-height:1.5;color:#c4cbe0}",
    "#bfp-dialog textarea{min-height:140px;resize:vertical}",
    ".bfp-dlg-acts{display:flex;gap:10px;flex-wrap:wrap}",
    ".bfp-quiet{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#e8e8ff;font:700 .9rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".bfp-danger{background:#f87171;color:#1a0505}",
    "#bfp-viewer{position:fixed;inset:0;z-index:2147483260;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center}",
    "#bfp-viewer img{max-width:100vw;max-height:100dvh;object-fit:contain}",
    "#bfp-viewer .bfp-x{position:absolute;top:calc(12px + env(safe-area-inset-top, 0px));right:12px;background:rgba(0,0,0,.5);color:#fff}"
  ].join("");

  function addStyle() {
    if (document.getElementById("bf-feed-style")) return;
    var st = document.createElement("style");
    st.id = "bf-feed-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── one post ── */
  var posts = {};   // id -> the post as last answered
  function avatarHtml(a, cls) {
    var initial = esc(String((a && a.name) || "?").replace(/^@/, "").charAt(0).toUpperCase());
    return safeUrl(a && a.avatar_url) ? '<img class="' + cls + '" src="' + esc(a.avatar_url) + '" alt="">' : '<span class="' + cls + '" aria-hidden="true">' + initial + '</span>';
  }
  function actionsHtml(p) {
    return '<div class="bfp-actions">' +
      '<button type="button" class="bfp-act" data-act="like" aria-pressed="' + !!p.liked + '" aria-label="Like, ' + n(p.like_count) + '">' + svg(ICON.like, 22) + '<span data-count="like">' + n(p.like_count) + '</span></button>' +
      '<button type="button" class="bfp-act" data-act="talk" aria-label="Talk, ' + n(p.comment_count) + ' comments">' + svg(ICON.talk, 22) + '<span data-count="talk">' + n(p.comment_count) + '</span></button>' +
      '<button type="button" class="bfp-act" data-act="save" aria-pressed="' + !!p.saved + '" aria-label="Save">' + svg(ICON.save, 22) + '<span>' + (p.saved ? "Saved" : "Save") + '</span></button>' +
      '<button type="button" class="bfp-act" data-act="share" aria-label="Share, ' + n(p.share_count) + '">' + svg(ICON.share, 22) + '<span data-count="share">' + n(p.share_count) + '</span></button>' +
      '<span class="bfp-time">' + esc(ago(p.published_at || p.created_at)) + '</span>' +
      '</div>';
  }
  function photosHtml(p) {
    var list = p.photos || [];
    if (!list.length) return "";
    return '<div class="bfp-photos" aria-label="Photos, ' + list.length + '">' + list.map(function (ph, i) {
      return '<button type="button" class="bfp-photo" data-full="' + esc(safeUrl(ph.url)) + '" aria-label="Open photo ' + (i + 1) + ' of ' + list.length + '">' +
        '<img src="' + esc(safeUrl(ph.thumb_url) || safeUrl(ph.url)) + '" alt="' + esc(ph.alt || "") + '" loading="' + (i ? "lazy" : "eager") + '"></button>';
    }).join("") + '</div>' + (list.length > 1 ? '<div class="bfp-dots" aria-hidden="true">' + list.map(function (_, i) { return '<span class="bfp-dot' + (i ? "" : " is-on") + '"></span>'; }).join("") + '</div>' : "");
  }
  function postEl(p) {
    posts[p.id] = p;
    var a = p.author || {};
    var me = myId();
    var showFollow = !!me && !p.mine && !p.following && a.id !== me;
    var el = document.createElement("article");
    el.className = "bfp-post";
    el.setAttribute("data-post", p.id);
    el.setAttribute("data-kind", p.kind);
    var textPost = !(p.photos || []).length;
    var head = '<div class="bfp-head">' +
      '<a class="bfp-av-link" href="' + esc(safeUrl(a.link) || "#") + '">' + avatarHtml(a, "bfp-av") + '</a>' +
      '<a class="bfp-who" href="' + esc(safeUrl(a.link) || "#") + '"><span class="bfp-name">' + esc(a.name || "A member") + '</span>' +
      (a.username ? '<span class="bfp-handle">@' + esc(a.username) + '</span>' : "") + '</a>' +
      (showFollow ? '<button type="button" class="bfp-follow" data-follow="' + esc(a.id) + '" aria-label="Follow ' + esc(a.name || "this member") + '">Follow</button>' : "") +
      '<span class="bfp-menu"></span></div>';
    var stage = textPost ? '<div class="bfp-stage"><div class="bfp-textcard">' + esc(p.body) + '</div></div>' : '<div class="bfp-stage">' + photosHtml(p) + '</div>';
    var status = p.status === "pending" ? '<p class="bfp-status">Waiting for review. Only you can see it.</p>'
      : p.status === "hidden" ? '<p class="bfp-status">Hidden by review. Only you can see it.</p>' : "";
    el.innerHTML = stage + '<span class="bfp-shade" aria-hidden="true"></span><div class="bfp-meta">' + head +
      '<div class="bfp-info">' + (textPost ? "" : (p.body ? '<p class="bfp-text">' + esc(p.body) + '</p>' : "")) + status + '</div></div>' +
      actionsHtml(p) + '<p class="bfp-note" role="status"></p>';
    mountMenu(el, p);
    var strip = el.querySelector(".bfp-photos");
    if (strip && (p.photos || []).length > 1) {
      strip.addEventListener("scroll", function () {
        var i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
        Array.prototype.forEach.call(el.querySelectorAll(".bfp-dot"), function (d, k) { d.classList.toggle("is-on", k === i); });
      }, { passive: true });
    }
    return el;
  }
  function note(el, text) {
    var x = el && el.querySelector(".bfp-note");
    if (!x) return;
    x.textContent = text;
    clearTimeout(x._t);
    x._t = setTimeout(function () { x.textContent = ""; }, 4000);
  }
  function mountMenu(el, p) {
    var slot = el.querySelector(".bfp-menu");
    if (!slot || !window.BFSafety) return;
    var a = p.author || {};
    var extra = p.mine ? [
      { label: "Edit", run: function () { editPost(el, p); } },
      { label: "Delete", danger: true, run: function () { deletePost(el, p); } }
    ] : [];
    window.BFSafety.mount(slot, { type: "post", id: p.id, userId: a.id, name: a.name, where: ORIGIN + "/p/" + p.id, extra: extra,
      onChange: function () { el.parentNode && el.parentNode.removeChild(el); } });
  }

  /* ── the actions ── */
  function needSignIn(el) {
    if (token()) return false;
    try { localStorage.setItem("bf_return_to", window.location.href); } catch (e) { /* back to the dashboard */ }
    window.location.href = "/app.html";
    return true;
  }
  function refreshCounts(el, b) {
    var p = posts[el.getAttribute("data-post")] || {};
    ["like_count", "comment_count", "save_count", "share_count"].forEach(function (k) { if (typeof b[k] === "number") p[k] = b[k]; });
    var put = function (sel, v) { var x = el.querySelector(sel); if (x) x.textContent = n(v); };
    put('[data-count="like"]', p.like_count); put('[data-count="talk"]', p.comment_count); put('[data-count="share"]', p.share_count);
  }
  function toggle(el, kind, btn) {
    if (needSignIn(el)) return;
    var id = el.getAttribute("data-post"), on = btn.getAttribute("aria-pressed") !== "true";
    btn.disabled = true;
    call(on ? "POST" : "DELETE", "/api/posts/" + encodeURIComponent(id) + "/" + kind).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { note(el, r.body.error || "That did not work. Try again."); return; }
      btn.setAttribute("aria-pressed", String(on));
      if (kind === "save") { btn.querySelector("span").textContent = on ? "Saved" : "Save"; posts[id].saved = on; }
      else posts[id].liked = on;
      refreshCounts(el, r.body);
    }).catch(function () { btn.disabled = false; note(el, "That did not work. Check your connection."); });
  }
  function share(el) {
    var id = el.getAttribute("data-post"), p = posts[id] || {};
    var url = ORIGIN + "/p/" + id;
    var count = function () {
      if (!token()) return;
      call("POST", "/api/posts/" + encodeURIComponent(id) + "/share").then(function (r) { if (r.ok) refreshCounts(el, r.body); }).catch(function () { /* not counted */ });
    };
    var title = ((p.author && p.author.name) || "A member") + " on BizForce";
    if (navigator.share) { navigator.share({ title: title, url: url }).then(count, function () { /* closed */ }); return; }
    var copied = function () { note(el, "Link copied: " + url); count(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(copied, function () { note(el, url); });
    else note(el, url);
  }
  function follow(btn) {
    if (needSignIn(btn)) return;
    var uid = btn.getAttribute("data-follow"), on = !btn.classList.contains("is-on");
    btn.disabled = true;
    (on ? call("POST", "/api/follows", { user_id: uid }) : call("DELETE", "/api/follows/" + encodeURIComponent(uid))).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { btn.textContent = "Try again"; return; }
      btn.classList.toggle("is-on", on);
      btn.textContent = on ? "Following" : "Follow";
      btn.setAttribute("aria-pressed", String(on));
      Object.keys(posts).forEach(function (k) { if (posts[k].author && posts[k].author.id === uid) posts[k].following = on; });
    }).catch(function () { btn.disabled = false; });
  }

  /* ── the small dialog ── */
  var dlg = null, dlgBack = null, dlgFocus = null;
  function dialog(title, html, focusSel) {
    addStyle();
    if (!dlg) {
      dlgBack = document.createElement("div"); dlgBack.id = "bfp-dialog-backdrop"; dlgBack.hidden = true;
      dlgBack.addEventListener("click", closeDialog);
      dlg = document.createElement("div"); dlg.id = "bfp-dialog"; dlg.hidden = true;
      dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", "bfp-dialog-title");
      dlg.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeDialog(); } });
      document.body.appendChild(dlgBack); document.body.appendChild(dlg);
    }
    dlgFocus = document.activeElement;
    dlg.innerHTML = '<h2 id="bfp-dialog-title">' + esc(title) + '</h2>' + html;
    dlgBack.hidden = false; dlg.hidden = false;
    var f = dlg.querySelector(focusSel || "button");
    if (f) f.focus();
    return dlg;
  }
  function closeDialog() {
    if (!dlg || dlg.hidden) return;
    dlg.hidden = true; dlgBack.hidden = true;
    if (dlgFocus && dlgFocus.focus) { try { dlgFocus.focus(); } catch (e) { /* gone */ } }
  }
  function editPost(el, p) {
    var d = dialog("Edit post",
      '<textarea class="bfp-input" id="bfpEditBody" maxlength="' + BODY_MAX + '">' + esc(p.body) + '</textarea>' +
      '<span class="bfp-count" id="bfpEditCount"></span><p class="bfp-err" id="bfpEditErr" role="alert"></p>' +
      '<div class="bfp-dlg-acts"><button type="button" class="bfp-send" id="bfpEditSave">Save</button><button type="button" class="bfp-quiet" id="bfpEditCancel">Cancel</button></div>', "#bfpEditBody");
    var box = d.querySelector("#bfpEditBody"), count = d.querySelector("#bfpEditCount");
    var upd = function () { count.textContent = Array.from(box.value).length + " / " + BODY_MAX; };
    upd(); box.addEventListener("input", upd);
    d.querySelector("#bfpEditCancel").addEventListener("click", closeDialog);
    d.querySelector("#bfpEditSave").addEventListener("click", function () {
      var btn = this;
      btn.disabled = true;
      call("PATCH", "/api/posts/" + encodeURIComponent(p.id), { body: box.value }).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { d.querySelector("#bfpEditErr").textContent = r.body.error || "That did not save. Try again."; return; }
        closeDialog();
        var fresh = postEl(r.body.post);
        el.parentNode.replaceChild(fresh, el);
        if (r.body.message) note(fresh, r.body.message);
      }).catch(function () { btn.disabled = false; d.querySelector("#bfpEditErr").textContent = "That did not save. Check your connection."; });
    });
  }
  function deletePost(el, p) {
    var d = dialog("Delete this post?", "<p>It is taken down for everyone now. Its photos stay in your Media Library.</p>" +
      '<p class="bfp-err" id="bfpDelErr" role="alert"></p>' +
      '<div class="bfp-dlg-acts"><button type="button" class="bfp-send bfp-danger" id="bfpDelYes">Delete</button><button type="button" class="bfp-quiet" id="bfpDelNo">Cancel</button></div>', "#bfpDelNo");
    d.querySelector("#bfpDelNo").addEventListener("click", closeDialog);
    d.querySelector("#bfpDelYes").addEventListener("click", function () {
      call("DELETE", "/api/posts/" + encodeURIComponent(p.id)).then(function (r) {
        if (!r.ok) { d.querySelector("#bfpDelErr").textContent = r.body.error || "That did not work. Try again."; return; }
        closeDialog();
        if (el.parentNode) el.parentNode.removeChild(el);
      }).catch(function () { d.querySelector("#bfpDelErr").textContent = "That did not work. Check your connection."; });
    });
  }

  /* ── the photo viewer: the full photo loads only here ── */
  var viewer = null;
  function openPhoto(url) {
    if (!safeUrl(url)) return;
    addStyle();
    if (!viewer) {
      viewer = document.createElement("div"); viewer.id = "bfp-viewer"; viewer.hidden = true;
      viewer.setAttribute("role", "dialog"); viewer.setAttribute("aria-modal", "true"); viewer.setAttribute("aria-label", "Photo");
      viewer.innerHTML = '<img alt=""><button type="button" class="bfp-x" aria-label="Close">' + svg(ICON.close, 18) + '</button>';
      viewer.addEventListener("click", function (e) { if (e.target === viewer || e.target.closest(".bfp-x")) closePhoto(); });
      viewer.addEventListener("keydown", function (e) { if (e.key === "Escape") closePhoto(); });
      document.body.appendChild(viewer);
    }
    viewer._from = document.activeElement;
    viewer.querySelector("img").src = url;
    viewer.hidden = false;
    viewer.querySelector(".bfp-x").focus();
  }
  function closePhoto() { if (viewer) { viewer.hidden = true; viewer.querySelector("img").removeAttribute("src"); if (viewer._from && viewer._from.focus) viewer._from.focus(); } }

  /* ── Talk ── */
  var talk = null, talkBack = null, talkState = null;
  function ensureTalk() {
    addStyle();
    if (talk) return;
    talkBack = document.createElement("div"); talkBack.id = "bfp-talk-backdrop"; talkBack.hidden = true;
    talkBack.addEventListener("click", closeTalk);
    talk = document.createElement("section"); talk.id = "bfp-talk"; talk.hidden = true;
    talk.setAttribute("role", "dialog"); talk.setAttribute("aria-modal", "true"); talk.setAttribute("aria-labelledby", "bfp-talk-title");
    talk.innerHTML = '<span class="bfp-talk-grip" aria-hidden="true"></span>' +
      '<div class="bfp-talk-head"><h2 id="bfp-talk-title">Talk</h2><button type="button" class="bfp-x" id="bfpTalkClose" aria-label="Close">' + svg(ICON.close, 18) + '</button></div>' +
      '<ul class="bfp-talk-list" id="bfpTalkList" aria-live="polite"></ul>' +
      '<form class="bfp-talk-form" id="bfpTalkForm">' +
        '<div class="bfp-replying" id="bfpReplying" hidden><span id="bfpReplyingTo"></span><button type="button" class="bfp-c-act" id="bfpReplyCancel">Cancel</button></div>' +
        '<label class="bfp-count" for="bfpTalkInput" style="align-self:flex-start">Add a comment</label>' +
        '<div class="bfp-row"><textarea class="bfp-input" id="bfpTalkInput" rows="1" maxlength="' + COMMENT_MAX + '"></textarea>' +
        '<button type="submit" class="bfp-send" id="bfpTalkSend">Send</button></div>' +
        '<span class="bfp-count" id="bfpTalkCount">0 / ' + COMMENT_MAX + '</span>' +
        '<p class="bfp-err" id="bfpTalkErr" role="alert"></p>' +
      '</form>';
    document.body.appendChild(talkBack); document.body.appendChild(talk);
    talk.querySelector("#bfpTalkClose").addEventListener("click", closeTalk);
    talk.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); closeTalk(); } });
    var input = talk.querySelector("#bfpTalkInput");
    input.addEventListener("input", function () { talk.querySelector("#bfpTalkCount").textContent = Array.from(input.value).length + " / " + COMMENT_MAX; });
    talk.querySelector("#bfpReplyCancel").addEventListener("click", function () { setReply(null); });
    talk.querySelector("#bfpTalkForm").addEventListener("submit", function (e) { e.preventDefault(); sendComment(); });
    talk.querySelector("#bfpTalkList").addEventListener("click", onCommentClick);
  }
  function setReply(c) {
    talkState.replyTo = c;
    var box = talk.querySelector("#bfpReplying");
    box.hidden = !c;
    if (c) { talk.querySelector("#bfpReplyingTo").textContent = "Replying to " + ((c.author && c.author.name) || "a member"); talk.querySelector("#bfpTalkInput").focus(); }
  }
  function commentHtml(c, reply) {
    var a = c.author || {};
    var acts = c.deleted ? "" : '<div class="bfp-c-acts">' +
      (reply ? "" : '<button type="button" class="bfp-c-act" data-c-act="reply" data-c="' + esc(c.id) + '">Reply</button>') +
      (c.mine ? '<button type="button" class="bfp-c-act" data-c-act="delete" data-c="' + esc(c.id) + '">Delete</button>' : "") +
      (c.can_hide ? '<button type="button" class="bfp-c-act" data-c-act="hide" data-c="' + esc(c.id) + '">Hide</button>' : "") +
      (!c.mine ? '<button type="button" class="bfp-c-act" data-c-act="report" data-c="' + esc(c.id) + '">Report</button>' : "") + '</div>';
    return '<li class="bfp-c' + (reply ? " is-reply" : "") + (c.deleted ? " is-deleted" : "") + '" data-comment="' + esc(c.id) + '">' +
      '<div class="bfp-c-top">' + (c.deleted ? '<span class="bfp-c-name">[deleted]</span>' : '<a class="bfp-c-name" href="' + esc(safeUrl(a.link) || "#") + '">' + esc(a.name || "A member") + '</a>') +
      '<span class="bfp-c-time">' + esc(ago(c.created_at)) + '</span></div>' +
      '<p class="bfp-c-body">' + esc(c.body) + '</p>' + acts + '</li>';
  }
  function renderComments() {
    var list = talk.querySelector("#bfpTalkList");
    var all = talkState.comments;
    if (!all.length) { list.innerHTML = '<li class="bfp-empty">No comments yet. Start the talk.</li>'; return; }
    var tops = all.filter(function (c) { return !c.parent_id; });
    var html = tops.map(function (t) {
      return commentHtml(t, false) + all.filter(function (c) { return c.parent_id === t.id; }).map(function (r) { return commentHtml(r, true); }).join("");
    }).join("");
    // a reply whose top comment is not in the page is shown on its own
    html += all.filter(function (c) { return c.parent_id && !tops.some(function (t) { return t.id === c.parent_id; }); }).map(function (r) { return commentHtml(r, true); }).join("");
    list.innerHTML = html;
  }
  function openTalk(postId, from) {
    if (!token()) { needSignIn(); return; }
    ensureTalk();
    talkState = { postId: postId, comments: [], replyTo: null, from: from || document.activeElement };
    setReply(null);
    talk.querySelector("#bfpTalkErr").textContent = "";
    talk.querySelector("#bfpTalkList").innerHTML = '<li class="bfp-empty">Loading...</li>';
    talkBack.hidden = false; talk.hidden = false;
    talk.querySelector("#bfpTalkInput").focus();
    call("GET", "/api/posts/" + encodeURIComponent(postId) + "/comments").then(function (r) {
      if (!talkState || talkState.postId !== postId) return;
      if (!r.ok) { talk.querySelector("#bfpTalkList").innerHTML = '<li class="bfp-empty">' + esc(r.body.error || "The comments could not be loaded.") + '</li>'; return; }
      talkState.comments = r.body.comments || [];
      renderComments();
    }).catch(function () { talk.querySelector("#bfpTalkList").innerHTML = '<li class="bfp-empty">The comments could not be loaded. Check your connection.</li>'; });
  }
  function closeTalk() {
    if (!talk || talk.hidden) return;
    talk.hidden = true; talkBack.hidden = true;
    var from = talkState && talkState.from;
    if (from && from.focus) { try { from.focus(); } catch (e) { /* gone */ } }
  }
  function bumpTalk(postId, by) {
    var p = posts[postId];
    if (!p) return;
    p.comment_count = Math.max(0, (Number(p.comment_count) || 0) + by);
    Array.prototype.forEach.call(document.querySelectorAll('[data-post="' + postId + '"] [data-count="talk"]'), function (x) { x.textContent = n(p.comment_count); });
  }
  function sendComment() {
    var input = talk.querySelector("#bfpTalkInput"), btn = talk.querySelector("#bfpTalkSend"), err = talk.querySelector("#bfpTalkErr");
    var text = input.value.trim();
    if (!text) { err.textContent = "Write something to send."; return; }
    btn.disabled = true; err.textContent = "";
    var body = { body: text };
    if (talkState.replyTo) body.parent_id = talkState.replyTo.id;
    var postId = talkState.postId;
    call("POST", "/api/posts/" + encodeURIComponent(postId) + "/comments", body).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { err.textContent = r.body.error || "That did not send. Try again."; return; }
      talkState.comments.push(r.body.comment);
      input.value = ""; talk.querySelector("#bfpTalkCount").textContent = "0 / " + COMMENT_MAX;
      setReply(null);
      renderComments();
      bumpTalk(postId, 1);
      var list = talk.querySelector("#bfpTalkList");
      list.scrollTop = list.scrollHeight;
    }).catch(function () { btn.disabled = false; err.textContent = "That did not send. Check your connection."; });
  }
  function onCommentClick(e) {
    var b = e.target.closest("[data-c-act]");
    if (!b) return;
    var id = b.getAttribute("data-c"), act = b.getAttribute("data-c-act");
    var c = talkState.comments.filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    if (act === "reply") { setReply(c); return; }
    if (act === "report") { if (window.BFSafety) window.BFSafety.openReport({ type: "comment", id: id, name: c.author && c.author.name }); return; }
    b.disabled = true;
    (act === "delete" ? call("DELETE", "/api/comments/" + encodeURIComponent(id)) : call("POST", "/api/comments/" + encodeURIComponent(id) + "/hide")).then(function (r) {
      if (!r.ok) { b.disabled = false; talk.querySelector("#bfpTalkErr").textContent = r.body.error || "That did not work. Try again."; return; }
      if (act === "delete") { c.deleted = true; c.body = "[deleted]"; c.mine = false; c.author = null; }
      else talkState.comments = talkState.comments.filter(function (x) { return x.id !== id; });
      renderComments();
    }).catch(function () { b.disabled = false; });
  }

  /* ── clicks on posts, for every feed on the page ── */
  document.addEventListener("click", function (e) {
    var post = e.target.closest && e.target.closest(".bfp-post");
    var f = e.target.closest && e.target.closest("[data-follow]");
    if (f && !f.closest(".bfp-menu")) { e.preventDefault(); follow(f); return; }
    if (!post) return;
    var photo = e.target.closest(".bfp-photo");
    if (photo) { openPhoto(photo.getAttribute("data-full")); return; }
    var act = e.target.closest(".bfp-act");
    if (!act) return;
    var kind = act.getAttribute("data-act");
    if (kind === "like" || kind === "save") toggle(post, kind, act);
    else if (kind === "talk") openTalk(post.getAttribute("data-post"), act);
    else if (kind === "share") share(post);
  });

  /* ── a feed ── */
  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    addStyle();
    var state = { cursor: null, loading: false, done: false, first: true, count: 0 };
    var sentinel = document.createElement("p");
    sentinel.className = "bfp-loading";
    sentinel.textContent = "Loading posts...";
    el.classList.add("bfp-feed");
    el.innerHTML = "";
    el.appendChild(sentinel);
    function more() {
      if (state.loading || state.done) return;
      state.loading = true;
      call("GET", "/api/feed/following" + (state.cursor ? "?cursor=" + encodeURIComponent(state.cursor) : "")).then(function (r) {
        state.loading = false;
        if (!r.ok) throw new Error(r.body.error || "HTTP " + r.status);
        var list = r.body.posts || [];
        list.forEach(function (p) {
          if (el.querySelector('[data-post="' + p.id + '"]')) return;
          el.insertBefore(postEl(p), sentinel);
          state.count++;
        });
        state.cursor = r.body.next_cursor || null;
        state.done = !state.cursor;
        if (state.first) {
          state.first = false;
          if (opts.full && state.count) el.classList.add("is-full");
          if (typeof opts.onFirst === "function") opts.onFirst(r.body, el);
        }
        if (state.done) {
          sentinel.className = "bfp-end";
          sentinel.textContent = state.count ? (opts.endText || "You are all caught up.") : "";
          if (!state.count) sentinel.hidden = true;
        } else if (!window.IntersectionObserver) more();
      }).catch(function () {
        state.loading = false;
        sentinel.className = "bfp-error";
        sentinel.textContent = "Posts could not be loaded just now. This is not a statement that there are none.";
        if (state.first && typeof opts.onFirst === "function") { state.first = false; opts.onFirst(null, el); }
      });
    }
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) { if (entries.some(function (x) { return x.isIntersecting; })) more(); }, { root: null, rootMargin: "600px 0px" });
      io.observe(sentinel);
    }
    more();
    return {
      el: el,
      prepend: function (p) {
        var old = el.querySelector('[data-post="' + p.id + '"]');
        if (old) old.parentNode.removeChild(old);
        var x = postEl(p);
        el.insertBefore(x, el.firstChild);
        state.count++;
        sentinel.hidden = false;
        if (state.done) { sentinel.className = "bfp-end"; sentinel.textContent = opts.endText || "You are all caught up."; }
        if (opts.full) el.classList.add("is-full");
        return x;
      },
      append: function (node) { el.insertBefore(node, sentinel); }
    };
  }

  window.BFFeed = { mount: mount, postEl: postEl, openTalk: openTalk, closeTalk: closeTalk, openPhoto: openPhoto, share: share, call: call,
    addStyle: addStyle, follow: follow, ICON: ICON, svg: svg, esc: esc, safeUrl: safeUrl, COMMENT_MAX: COMMENT_MAX, BODY_MAX: BODY_MAX };
})();

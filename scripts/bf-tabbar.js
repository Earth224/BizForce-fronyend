/* ══════════════════════════════════════════════════════════════════════════
   bf-tabbar.js — the phone app's bottom bar and the Create sheet (P2-1,
   Nov 19 2026).

   scripts/bf-session.js loads this on every signed-in page, the way it loads
   the music player, so no page carries its own copy. Five items, each at
   least 44 px: Home (home.html), HQ (dashboard.html), + (the Create sheet,
   over the page the member is on), Inbox (inbox.html, with a badge: unread
   notices plus unread messages, GET /api/inbox/counts) and Profile
   (profile.html).

   PHONE ONLY. Every rule that shows the bar is inside
   @media (max-width: 760px), the PH1 breakpoint; a desktop window never draws
   it, and on a desktop nothing is asked of the server for its badge. The
   Create sheet opens at any width: a bottom sheet on a phone, a centred
   dialog on a desktop (home.html's "Make your first post" opens it there).

   NOT SHOWN on the sign-in and account pages, the legal pages, the music
   pop-out, the public pages (a card, a blog, a listing, a storefront, the
   server's /campaign, /c, /card, /support and /blog pages), every Oracle page
   (oracle, mychart, calendar, synastry, the-third: held as they are), any
   page that sets data-bf-tabbar="off" on <html>, and to anyone signed out.
   HIDDEN_PAGES and HIDDEN_PREFIXES below are the whole list.

   THE ACTIVE ITEM. Home on home.html; Inbox on inbox.html, messages.html and
   proposals.html; Profile on profile.html and settings.html; HQ on the
   dashboard and every other page (the tools).

   THE PAGE AROUND IT. The bar is 56 px plus the bottom safe area, above the
   page (z-index 90) and below every dialog, the music player's full-screen
   sheet and the Guide's panel. While it shows, the Guide button sits 56 px
   higher (bottom: 56 + 16 px + the safe area) and its spacer, the page's last
   element, grows from 80 to 136 px, so the page's end (the legal footer
   included) is never under the bar or the button. A page with no Guide ends
   with this script's own 56 px spacer instead.

   THE CREATE SHEET. Post and Video say "Coming soon" and do nothing (posts
   arrive in P2-3, video posts in P2-8). Every other item opens the real
   creator that exists today: a product or a service listing
   (marketplace.html?create=product|service), a campaign
   (campaigns.html?create=campaign), a garage sale item
   (garage-sale.html?create=item), a business card (digital-cards.html), and
   Ask an agent (run.html, where an agent's work is drafted for approval).
   Nothing here creates a record.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined" || window.BFTabbar) return;

  var BREAKPOINT = "(max-width: 760px)";
  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var HIDDEN_PAGES = [
    "app.html", "reset-password.html", "verify-email.html",
    "terms.html", "privacy.html", "refund.html", "contact.html",
    "music-popout.html", "card-view.html", "blogpost.html", "blogindex.html",
    "oracle.html", "mychart.html", "calendar.html", "synastry.html", "the-third.html"
  ];
  var SIGNED_OUT_HIDDEN = ["listing.html", "seller.html"];
  var HIDDEN_PREFIXES = ["/campaign/", "/c/", "/card/", "/support/", "/blog/", "/listing/"];
  var TABS = [
    { key: "home", label: "Home", href: "/home.html" },
    { key: "hq", label: "HQ", href: "/dashboard.html" },
    { key: "create", label: "Create" },
    { key: "inbox", label: "Inbox", href: "/inbox.html" },
    { key: "profile", label: "Profile", href: "/profile.html" }
  ];
  var ACTIVE = {
    "home.html": "home",
    "inbox.html": "inbox", "messages.html": "inbox", "proposals.html": "inbox",
    "profile.html": "profile", "settings.html": "profile"
  };
  var CREATE = [
    { key: "post", title: "Post", sub: "Photo or text to your followers", soon: true, color: "var(--bf-accent-a, #22d3ee)",
      icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>' },
    { key: "video", title: "Video", sub: "Short videos for your followers", soon: true, color: "#f472b6",
      icon: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>' },
    { key: "product", title: "Product listing", sub: "Sell for BizCash", href: "/marketplace.html?create=product", color: "#b79cfa",
      icon: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>' },
    { key: "service", title: "Service", sub: "Offer your skills to members", href: "/marketplace.html?create=service", color: "#6ee7b7",
      icon: '<path d="M4 7h16v12H4zM9 7V4h6v3"/>' },
    { key: "agent", title: "Ask an agent", sub: "An agent drafts it; you approve it", href: "/run.html", color: "var(--bf-accent-a, #22d3ee)", featured: true,
      icon: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/>' },
    { key: "campaign", title: "Campaign", sub: "Raise BizCash from members", href: "/campaigns.html?create=campaign", color: "#f5c46b",
      icon: '<path d="M4 20V10l8-6 8 6v10M9 20v-5h6v5"/>' },
    { key: "garage", title: "Garage sale item", sub: "Sell something you own", href: "/garage-sale.html?create=item", color: "#5fa6f0",
      icon: '<path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4"/>' },
    { key: "card", title: "Business card", sub: "Make or share your digital card", href: "/digital-cards.html", color: "#a9b3cc",
      icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h4"/>' }
  ];
  var ICONS = {
    home: '<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>',
    hq: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>',
    create: '<path d="M12 5v14M5 12h14"/>',
    inbox: '<path d="M4 5h16v11H9l-5 4z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'
  };

  function token() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function pageName() {
    var p = String(window.location.pathname || "/").replace(/^\/+/, "");
    if (!p) return "index.html";
    if (!/\.[a-z0-9]+$/i.test(p) && p.indexOf("/") === -1) p += ".html";
    return p;
  }
  function svg(paths, size, stroke) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="' + (stroke || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }

  /* Whether this page shows the bar: signed in, not on the list, not switched off by the page. */
  function wanted() {
    var path = String(window.location.pathname || "/");
    var page = pageName();
    if (!token()) return false;
    if (HIDDEN_PAGES.indexOf(page) !== -1) return false;
    if (SIGNED_OUT_HIDDEN.indexOf(page) !== -1 && !token()) return false;
    for (var i = 0; i < HIDDEN_PREFIXES.length; i++) if (path.indexOf(HIDDEN_PREFIXES[i]) === 0) return false;
    if (document.documentElement.getAttribute("data-bf-tabbar") === "off") return false;
    return true;
  }
  function activeKey() { return ACTIVE[pageName()] || "hq"; }

  var CSS = [
    "#bf-tabbar,#bf-tabbar-spacer{display:none}",
    "@media " + BREAKPOINT + "{",
    "html.bf-tabbar-on #bf-tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:90;box-sizing:border-box;",
    "height:calc(56px + env(safe-area-inset-bottom, 0px));padding:0 calc(4px + env(safe-area-inset-right, 0px)) env(safe-area-inset-bottom, 0px) calc(4px + env(safe-area-inset-left, 0px));",
    "align-items:stretch;background:rgba(7,11,24,.97);border-top:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.16);",
    "font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}",
    "#bf-tabbar .bf-tab{flex:1 1 0;min-width:44px;min-height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;",
    "padding:0;margin:0;border:0;background:transparent;color:#a9b3cc;font:600 11px/1 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;",
    "text-decoration:none;cursor:pointer;position:relative;-webkit-tap-highlight-color:transparent}",
    "#bf-tabbar .bf-tab[aria-current=page]{color:var(--bf-accent-a, #22d3ee)}",
    "#bf-tabbar .bf-tab:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:-4px;border-radius:10px}",
    "#bf-tabbar .bf-tab-plus{display:flex;align-items:center;justify-content:center;width:52px;height:34px;border-radius:11px;color:#070b18;",
    "background:linear-gradient(90deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6))}",
    "#bf-tabbar .bf-tab-badge{position:absolute;top:4px;left:50%;margin-left:5px;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;",
    "border-radius:9px;background:var(--bf-accent-b, #8b5cf6);color:#fff;font:700 11px/18px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;text-align:center}",
    "#bf-tabbar .bf-tab-badge[hidden]{display:none}",
    "html.bf-tabbar-on #bf-tabbar-spacer{display:block;height:calc(56px + env(safe-area-inset-bottom, 0px))}",
    "html.bf-tabbar-on body:has(#tmx-guide-fab-spacer) #bf-tabbar-spacer{display:none}",
    "html.bf-tabbar-on #tmx-guide-fab{bottom:calc(56px + 16px + env(safe-area-inset-bottom, 0px))}",
    "html.bf-tabbar-on #tmx-guide-fab-spacer{display:block!important;height:calc(136px + env(safe-area-inset-bottom, 0px))!important}",
    "}",
    /* the Create sheet: a dialog at any width */
    "#bf-create-backdrop{position:fixed;inset:0;z-index:2147483300;background:rgba(2,4,12,.6)}",
    "#bf-create{position:fixed;z-index:2147483301;box-sizing:border-box;color:#e8e8ff;background:#0b1022;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);",
    "font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;display:flex;flex-direction:column;gap:14px;overflow-y:auto;",
    "left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 48px);padding:20px;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.55)}",
    "#bf-create[hidden],#bf-create-backdrop[hidden]{display:none}",
    "#bf-create .bf-create-head{display:flex;align-items:center;gap:12px}",
    "#bf-create h2{flex:1;margin:0;font-size:1.3rem;font-weight:800;letter-spacing:-.01em;color:#f4f7ff}",
    "#bf-create .bf-create-close{width:44px;height:44px;min-width:44px;border-radius:22px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#e8e8ff;",
    "display:flex;align-items:center;justify-content:center;cursor:pointer}",
    "#bf-create .bf-create-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}",
    "#bf-create .bf-create-opt{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;text-align:left;gap:6px;box-sizing:border-box;min-height:104px;height:100%;padding:14px;border-radius:16px;",
    "background:rgba(18,26,54,.9);border:1px solid rgba(255,255,255,.1);color:#e8e8ff;text-decoration:none}",
    "#bf-create a.bf-create-opt:hover,#bf-create a.bf-create-opt:focus-visible{border-color:rgba(var(--bf-accent-a-rgb, 34,211,238),.55);outline:none}",
    "#bf-create .bf-create-opt.is-featured{border-color:rgba(var(--bf-accent-a-rgb, 34,211,238),.4);background:rgba(16,32,63,.95)}",
    "#bf-create .bf-create-opt.is-soon{opacity:.72}",
    "#bf-create .bf-create-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(11,18,48,.9)}",
    "#bf-create .bf-create-t{font-size:.95rem;font-weight:800;color:#f4f7ff}",
    "#bf-create .bf-create-s{font-size:.8rem;line-height:1.35;color:#a9b3cc}",
    "#bf-create .bf-create-soon{align-self:flex-start;font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fbbf24;",
    "padding:3px 8px;border-radius:999px;border:1px solid rgba(251,191,36,.35)}",
    "@media " + BREAKPOINT + "{",
    "#bf-create{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-height:calc(100dvh - 40px);border-radius:24px 24px 0 0;",
    "padding:10px 16px calc(20px + env(safe-area-inset-bottom, 0px));box-shadow:0 -12px 40px rgba(0,0,0,.55)}",
    "#bf-create .bf-create-grip{display:block;align-self:center;width:40px;height:5px;border-radius:3px;background:rgba(255,255,255,.18)}",
    "}",
    "#bf-create .bf-create-grip{display:none}",
    "@media " + BREAKPOINT + "{#bf-create .bf-create-grip{display:block}}"
  ].join("");

  var bar = null, badge = null, sheet = null, backdrop = null, lastFocus = null;

  function addStyle() {
    if (document.getElementById("bf-tabbar-style")) return;
    var st = document.createElement("style");
    st.id = "bf-tabbar-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function buildBar() {
    var active = activeKey();
    bar = document.createElement("nav");
    bar.id = "bf-tabbar";
    bar.setAttribute("aria-label", "Main");
    TABS.forEach(function (t) {
      var n;
      if (t.key === "create") {
        n = document.createElement("button");
        n.type = "button";
        n.setAttribute("aria-label", "Create");
        n.setAttribute("aria-haspopup", "dialog");
        n.innerHTML = '<span class="bf-tab-plus">' + svg(ICONS.create, 22, 3) + '</span>';
        n.addEventListener("click", function () { openCreate(n); });
      } else {
        n = document.createElement("a");
        n.href = t.href;
        n.innerHTML = svg(ICONS[t.key], 24) + '<span class="bf-tab-label">' + t.label + '</span>';
        if (t.key === active) n.setAttribute("aria-current", "page");
        if (t.key === "inbox") {
          badge = document.createElement("span");
          badge.className = "bf-tab-badge";
          badge.hidden = true;
          n.appendChild(badge);
        }
      }
      n.className = "bf-tab";
      n.setAttribute("data-tab", t.key);
      bar.appendChild(n);
    });
    var spacer = document.createElement("div");
    spacer.id = "bf-tabbar-spacer";
    spacer.setAttribute("aria-hidden", "true");
    document.body.appendChild(spacer);
    document.body.appendChild(bar);
    document.documentElement.classList.add("bf-tabbar-on");
  }

  function phone() { return !!(window.matchMedia && window.matchMedia(BREAKPOINT).matches); }

  /* The Inbox badge: unread notices plus unread messages. Asked only on a phone, where the bar shows. */
  function refreshBadge() {
    if (!badge || !phone() || typeof window.fetch !== "function") return;
    var api = (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK;
    window.fetch(api + "/api/inbox/counts", { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { setBadge(d && typeof d.badge === "number" ? d.badge : 0); })
      .catch(function () { /* no badge: the Inbox itself still opens */ });
  }
  function setBadge(n) {
    if (!badge) return;
    var count = Math.max(0, Math.floor(Number(n) || 0));
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    var link = badge.parentNode;
    if (link && link.setAttribute) link.setAttribute("aria-label", "Inbox" + (count ? ", " + count + " unread" : ""));
  }

  function buildSheet() {
    backdrop = document.createElement("div");
    backdrop.id = "bf-create-backdrop";
    backdrop.hidden = true;
    backdrop.addEventListener("click", closeCreate);
    sheet = document.createElement("div");
    sheet.id = "bf-create";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "bf-create-title");
    var items = CREATE.map(function (c) {
      var inner = '<span class="bf-create-ic" style="color:' + c.color + '">' + svg(c.icon, 20) + '</span>' +
        '<span class="bf-create-t">' + c.title + '</span><span class="bf-create-s">' + c.sub + '</span>';
      if (c.soon) {
        return '<li><div class="bf-create-opt is-soon" data-create="' + c.key + '" aria-disabled="true">' + inner +
          '<span class="bf-create-soon">Coming soon</span></div></li>';
      }
      return '<li><a class="bf-create-opt' + (c.featured ? " is-featured" : "") + '" data-create="' + c.key + '" href="' + c.href + '">' + inner + '</a></li>';
    }).join("");
    sheet.innerHTML = '<span class="bf-create-grip" aria-hidden="true"></span>' +
      '<div class="bf-create-head"><h2 id="bf-create-title">Create</h2>' +
      '<button type="button" class="bf-create-close" aria-label="Close">' + svg('<path d="M6 6l12 12M18 6L6 18"/>', 18, 2.4) + '</button></div>' +
      '<ul class="bf-create-grid">' + items + '</ul>';
    sheet.querySelector(".bf-create-close").addEventListener("click", closeCreate);
    sheet.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); closeCreate(); return; }
      if (e.key !== "Tab") return;
      var f = sheet.querySelectorAll("a[href],button");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }

  function openCreate(from) {
    if (!document.body) return;
    addStyle();
    if (!sheet) buildSheet();
    lastFocus = from || document.activeElement;
    backdrop.hidden = false;
    sheet.hidden = false;
    var first = sheet.querySelector("a.bf-create-opt");
    if (first && first.focus) first.focus();
  }
  function closeCreate() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* gone */ } }
  }

  window.BFTabbar = {
    openCreate: openCreate,
    closeCreate: closeCreate,
    refreshBadge: refreshBadge,
    setBadge: setBadge,
    wanted: wanted,
    HIDDEN_PAGES: HIDDEN_PAGES.slice(),
    HIDDEN_PREFIXES: HIDDEN_PREFIXES.slice(),
    CREATE: CREATE.map(function (c) { return { key: c.key, title: c.title, href: c.href || null, soon: !!c.soon }; })
  };

  function start() {
    if (!wanted()) return;   // a page the bar is not on is left exactly as it was: no style, no element
    addStyle();
    buildBar();
    refreshBadge();
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") refreshBadge(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

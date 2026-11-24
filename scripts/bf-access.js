/* ══════════════════════════════════════════════════════════════════════════
   BF ACCESS — free accounts and the one membership (P3-1, Nov 20 2026).

   scripts/bf-session.js loads this on every signed-in page it protects. It
   asks GET /api/auth/me once and reads access:
     tier            "member" or "free" (the server decides; this file never
                     guesses: an unknown answer shows nothing and blocks nothing)
     email_verified  false shows the banner with "Resend email"
     members_panel   what membership adds and its price, from the server's code
                     (PLAN_CONFIG), never typed here

   WHAT IT DOES
     - THE MEMBERS PANEL ("Members get this"): on a member-only page
       (MEMBER_PAGES) a free account sees the panel over the page: what
       membership adds, the price, Join (billing.html) and Go to Home. The
       server refuses every member-only route anyway (402); the panel says so
       before anything is tried.
     - THE BOTTOM BAR'S HQ TAB (scripts/bf-tabbar.js) opens the same panel for
       a free account instead of opening the dashboard.
     - NAMED (Nov 21 2026, P3-1B, the owner's final rules): for a free account, every selling entry point and every
       BizCash or members-only action (MEMBER_ACTIONS: a create button, the Create sheet's member entries, Message on a
       profile or a listing) opens the members panel instead; Buy (BUY_ACTIONS) opens the card-checkout-coming sheet;
       a ?create= link on the Market or the garage sale opens the panel. The server refuses each of them anyway.
     - THE VERIFICATION BANNER: an unconfirmed email is told what it is needed
       for (posting publicly, listing in the Market, messaging someone who does
       not follow you, receiving BizCash) and gets "Resend email" (POST
       /api/auth/resend-verification).
   Everything from the server is written with textContent. Nothing is stored.

   USE (other scripts)
     window.bfAccess.ready.then(function (a) { a.tier; a.emailVerified; });
     window.bfAccess.showPanel();
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.bfAccess) return;

  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  /* The member-only pages: the agents and every agent page, HQ, the Oracle, social publishing, store connections and
     analytics, and the business tools (lib/membership.js MEMBER_ADDS; lib/routeAccess.js M). */
  var MEMBER_PAGES = [
    "dashboard.html", "agents-hub.html", "ai-agents.html", "run.html", "proposals.html", "routines.html", "self-reviews.html",
    "saved-prompts.html", "business-chat.html", "ads-agent.html", "broker-agent.html", "community-agent.html", "email-agent.html",
    "etsy-agent.html", "executive-agent.html", "influencer-agent.html", "operations-agent.html", "publicist-agent.html",
    "rd-agent.html", "reputation-agent.html", "store-agent.html", "vertical-marketing-agent.html",
    "agents/analytics.html", "agents/content.html", "agents/sales.html", "agents/seo.html", "agents/social.html",
    "analytics-dashboard.html", "integrations.html", "mailbox.html", "crm.html", "prospecting.html", "inventory.html",
    "calendar.html", "bizdoc.html", "certifications.html", "digital-cards.html",
    "oracle.html", "mychart.html", "synastry.html", "the-third.html",
    // NAMED (Nov 21 2026, P3-2, the owner's decision): the media library and the business ID; their write routes are members only
    "media.html", "business-id.html",
    // NAMED (Nov 21 2026, P3-1B): the wallet and receipts (BizCash in every form) and campaigns. support.html is the public
    // "Support a member" page and stays open; sending support is members only on the server.
    "wallet.html", "receipts.html", "campaigns.html",
    // NAMED (Nov 23 2026, LR-2): Lead Radar is for every member now; its routes are members only (lib/routeAccess.js M)
    "agents/lead-radar.html"
  ];
  /* NAMED (Nov 21 2026, P3-1B): a free account's taps on these open the members panel (selling, starting a conversation),
     and on these the card-checkout-coming sheet (Buy). */
  // Nov 23 2026, LR-1: "#sfMessage" removed (no such element; the storefront Message button comes in LR-3).
  var MEMBER_ACTIONS = [".create-btn", "a.bf-create-opt.is-members", "#pfsMessage", ".btn-message", "[data-members-only]"];
  var BUY_ACTIONS = [".btn-buy", "a.buy-btn", "button.sf-buy-btn", "[data-bf-buy]"];
  var CREATE_PAGES = ["marketplace.html", "garage-sale.html"];
  var BUY_TEXT = ["Card checkout is coming", "Buying by card arrives soon. A free account never pays in BizCash; when card checkout opens, you can buy this here."];
  // NAMED (Nov 21 2026, P3-1B): BEFORE "Confirm your email to post publicly, list in the Market, message people who do not follow you,
  // and receive BizCash. ..." (selling and BizCash are members only now)
  var BANNER_TEXT = "Confirm your email to post publicly and to message people who do not follow you. We sent you a link when you signed up.";

  function api() { return (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK; }
  function token() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function pageName() {
    var p = String(window.location.pathname || "/").replace(/^\/+/, "");
    if (!p) return "index.html";
    return /\.html$/.test(p) ? p : p + ".html";
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var CSS =
    ".bfa-banner{position:relative;z-index:60;margin:0;padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;" +
    "background:linear-gradient(rgba(251,191,36,.12),rgba(251,191,36,.12)),var(--bf-bg,#070b18);border-bottom:1px solid rgba(251,191,36,.35);color:var(--bf-text,#e8ecff);font:14px/1.4 system-ui,sans-serif}" +
    /* Home's full-screen feed (body.feed-full) keeps its top row fixed at the top: there the banner is fixed above it and
       the row, and the feed's notice, move down by the banner's height (--bfa-h, measured). */
    "body.feed-full .bfa-banner{position:fixed;top:0;left:0;right:0;z-index:45;padding-top:calc(10px + env(safe-area-inset-top, 0px))}" +
    "body.bfa-on.feed-full .feed-top{top:var(--bfa-h,0px)}body.bfa-on.feed-full .feed-say{top:calc(60px + var(--bfa-h,0px))}" +
    ".bfa-banner p{margin:0;flex:1 1 220px}" +
    ".bfa-banner button{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid var(--bf-warning,#fbbf24);background:transparent;color:var(--bf-warning,#fbbf24);font:600 14px system-ui,sans-serif;cursor:pointer}" +
    ".bfa-banner .bfa-status{flex-basis:100%;margin:0;font-size:13px;color:var(--bf-text-muted,#8892b8)}" +
    ".bfa-veil{position:fixed;inset:0;z-index:1000;background:rgba(3,5,12,.82);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".bfa-panel{width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;box-sizing:border-box;padding:24px 20px;border-radius:18px;" +
    "background:var(--bf-bg,#070b18);border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.35);color:var(--bf-text,#e8ecff);font:15px/1.5 system-ui,sans-serif}" +
    ".bfa-panel h2{margin:0 0 4px;font-size:22px}" +
    ".bfa-price{margin:0 0 14px;color:var(--bf-accent-a,#22d3ee);font-weight:700}" +
    ".bfa-panel ul{margin:0 0 18px;padding-left:20px}.bfa-panel li{margin:4px 0}" +
    ".bfa-actions{display:flex;gap:10px;flex-wrap:wrap}" +
    ".bfa-actions a{flex:1 1 140px;display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:12px;text-decoration:none;font-weight:700}" +
    ".bfa-join{background:var(--bf-accent-a,#22d3ee);color:#04111a}" +
    ".bfa-home{border:1px solid rgba(232,236,255,.25);color:var(--bf-text,#e8ecff)}" +
    ".bfa-note{margin:14px 0 0;font-size:13px;color:var(--bf-text-muted,#8892b8)}";

  function addStyle() {
    if (document.getElementById("bf-access-style")) return;
    var st = el("style"); st.id = "bf-access-style"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var state = { tier: null, emailVerified: null, panel: null };
  var resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });
  /* NAMED (Nov 21 2026, P3-1B): bf-session.js loads this file late, so a script that ran first waits for the "bf-access"
     event on document (detail: what ready resolves to) when window.bfAccess is not there yet. */
  ready.then(function (a) { try { document.dispatchEvent(new CustomEvent("bf-access", { detail: a })); } catch (e) { /* old browser */ } });

  function buildPanel(onPage) {
    var p = state.panel;
    if (!p || !p.adds) return null;
    var veil = el("div", "bfa-veil"); veil.id = "bf-members-panel";
    var box = el("section", "bfa-panel");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "bfa-title");
    var h = el("h2", null, p.title || "Members get this"); h.id = "bfa-title";
    box.appendChild(h);
    box.appendChild(el("p", "bfa-price", p.price_text || ""));
    var ul = el("ul");
    p.adds.forEach(function (line) { ul.appendChild(el("li", null, line)); });
    box.appendChild(ul);
    var actions = el("div", "bfa-actions");
    var join = el("a", "bfa-join", p.join_label || "Join");
    join.href = (typeof p.join_url === "string" && /^\/(?!\/)[A-Za-z0-9\/._?=&#-]*$/.test(p.join_url)) ? p.join_url : "/billing.html";
    var home = el("a", "bfa-home", onPage ? "Go to Home" : "Not now");
    home.href = "/home.html";
    if (!onPage) home.addEventListener("click", function (e) { e.preventDefault(); close(); });
    actions.appendChild(join); actions.appendChild(home);
    box.appendChild(actions);
    // NAMED (Nov 21 2026, P3-1B): BEFORE "Your free account keeps your profile, posts, Market listings, messages and BizCash you receive. ..."
    box.appendChild(el("p", "bfa-note", "Your free account keeps your profile, photo posts, Needs, follows, replies and the Inbox. Membership is paid by card; BizCash never pays for it."));
    veil.appendChild(box);
    return veil;
  }
  function close() { var v = document.getElementById("bf-members-panel"); if (v) v.parentNode.removeChild(v); }
  function showPanel(onPage) {
    if (document.getElementById("bf-members-panel")) return true;
    addStyle();
    var v = buildPanel(!!onPage);
    if (!v) return false;
    document.body.appendChild(v);
    var join = v.querySelector(".bfa-join"); if (join && join.focus) join.focus();
    return true;
  }

  function showBanner() {
    if (document.getElementById("bf-verify-banner")) return;
    addStyle();
    var b = el("div", "bfa-banner"); b.id = "bf-verify-banner"; b.setAttribute("role", "status");
    b.appendChild(el("p", null, BANNER_TEXT));
    var btn = el("button", null, "Resend email"); btn.type = "button";
    var status = el("p", "bfa-status"); status.hidden = true;
    btn.addEventListener("click", function () {
      btn.disabled = true; status.hidden = false; status.textContent = "Sending...";
      window.fetch(api() + "/api/auth/resend-verification", { method: "POST", headers: { "Authorization": "Bearer " + token(), "Content-Type": "application/json" }, body: "{}" })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (x) {
          status.textContent = x.ok ? (x.d.message || "We sent a new link. Check your inbox.") : (x.d.error || "The email could not be sent just now. Try again in a minute.");
          btn.disabled = !x.ok ? false : true;
        })
        .catch(function () { status.textContent = "The email could not be sent just now. Check your connection and try again."; btn.disabled = false; });
    });
    b.appendChild(btn); b.appendChild(status);
    document.body.insertBefore(b, document.body.firstChild);
    document.body.classList.add("bfa-on");
    function measure() { document.body.style.setProperty("--bfa-h", Math.ceil(b.getBoundingClientRect().height) + "px"); }
    measure();
    if (typeof window.ResizeObserver === "function") new window.ResizeObserver(measure).observe(b);
    else window.addEventListener("resize", measure);
  }

  /* NAMED (Nov 21 2026, P3-1B): Buy for a free account: a small sheet (card checkout arrives later), Close focused, Escape closes. */
  function showBuySheet() {
    if (document.getElementById("bf-buy-sheet")) return true;
    addStyle();
    var veil = el("div", "bfa-veil"); veil.id = "bf-buy-sheet";
    var box = el("section", "bfa-panel");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "bfa-buy-title");
    var h = el("h2", null, BUY_TEXT[0]); h.id = "bfa-buy-title";
    box.appendChild(h); box.appendChild(el("p", null, BUY_TEXT[1]));
    var actions = el("div", "bfa-actions");
    var shut = el("a", "bfa-join", "Close"); shut.href = "#"; shut.setAttribute("role", "button");
    function closeSheet(e) { if (e) e.preventDefault(); if (veil.parentNode) veil.parentNode.removeChild(veil); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") closeSheet(e); }
    shut.addEventListener("click", closeSheet);
    document.addEventListener("keydown", onKey);
    actions.appendChild(shut); box.appendChild(actions); veil.appendChild(box);
    document.body.appendChild(veil);
    if (shut.focus) shut.focus();
    return true;
  }
  document.addEventListener("click", function (e) {
    if (state.tier !== "free" || !e.target || !e.target.closest) return;
    if (e.target.closest(BUY_ACTIONS.join(","))) { e.preventDefault(); e.stopPropagation(); showBuySheet(); return; }
    if (e.target.closest(MEMBER_ACTIONS.join(","))) { if (showPanel(false)) { e.preventDefault(); e.stopPropagation(); } }
  }, true);

  /* The bottom bar's HQ tab: a free account gets the panel, not the dashboard. */
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest('#bf-tabbar a[data-tab="hq"]') : null;
    if (!a || state.tier !== "free") return;
    if (showPanel(false)) e.preventDefault();
  }, true);

  // the page tidies ?create= out of the address at once, keeping the kind on <html data-bf-create> for this check
  function createKept() {
    var h = document.documentElement;
    return !!(h && typeof h.hasAttribute === "function" && h.hasAttribute("data-bf-create"));
  }

  function apply(access) {
    state.tier = access && (access.tier === "member" || access.tier === "free") ? access.tier : null;
    state.emailVerified = access && typeof access.email_verified === "boolean" ? access.email_verified : null;
    state.panel = access && access.members_panel && typeof access.members_panel === "object" ? access.members_panel : null;
    if (state.emailVerified === false) showBanner();
    if (state.tier === "free" && MEMBER_PAGES.indexOf(pageName()) !== -1) showPanel(true);
    // NAMED (Nov 21 2026, P3-1B): a ?create= link (the Create sheet's selling entries) on the Market or the garage sale
    else if (state.tier === "free" && CREATE_PAGES.indexOf(pageName()) !== -1 && (/[?&]create=/.test(window.location.search || "") || createKept())) showPanel(false);
    resolveReady({ tier: state.tier, emailVerified: state.emailVerified, panel: state.panel });
  }

  function start() {
    if (!token() || typeof window.fetch !== "function") { resolveReady({ tier: null, emailVerified: null, panel: null }); return; }
    window.fetch(api() + "/api/auth/me", { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { apply(d && d.access ? d.access : null); })
      .catch(function () { apply(null); });
  }

  window.bfAccess = { ready: ready, showPanel: function () { return showPanel(false); }, MEMBER_PAGES: MEMBER_PAGES.slice(),
    showBuySheet: showBuySheet, MEMBER_ACTIONS: MEMBER_ACTIONS.slice(), BUY_ACTIONS: BUY_ACTIONS.slice(), BUY_TEXT: BUY_TEXT.slice(),   // NAMED (Nov 21 2026, P3-1B)
    tier: function () { return state.tier; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

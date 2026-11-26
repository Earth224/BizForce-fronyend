/* ══════════════════════════════════════════════════════════════════════════
   bf-home-tabs.js — Home's tabs and Search (H1, Nov 25 2026; the owner's
   canvas row 7: FeedLocal, FeedFollowing, FeedMarket, FeedSearch; the
   backend's lib/homeTabs.js, lib/search.js and lib/geo.js). home.html loads
   it after bf-feed.js.

   THE TABS. Local, Following and Market (For You still opens its Coming soon
   sheet). The active tab is underlined as drawn; the last one is kept on this
   device (localStorage bf_home_tab). Swiping sideways does not change tabs:
   a vertical swipe stays the feed. The Market dot shows only when a member
   listed something since the viewer last opened Market (GET /api/home/tabs).

   LOCAL. GET /api/feed/local through bf-feed.js (BFFeed.mount, path option):
   public posts and open Needs near the member, newest first, each with its
   "Category · Area · Distance" line and the For You rail. The chip row: the
   member's city, the reach (My city, Within 25 mi, Anywhere) and Change.
   Change opens a sheet: the three reaches and "Use a different city" (a typed
   city, looked up by the server; never the device's location). Kept per
   member, on the server (PUT /api/home/prefs). No city: "Add your city".

   FOLLOWING. bf-feed.js's Following feed, as before. When the viewer follows
   nobody: the empty board, "Follow people to fill this tab", with up to 8
   suggestions (GET /api/home/suggestions) and Follow on each row.

   MARKET. GET /api/home/market: full-screen listing cards on a phone (a card
   column on a desktop): the category chips, the photo, category and place,
   title, seller and description, the price in BizCash, Buy; the rail: the
   seller's picture with follow, Like, Ask, Save, Share. Buy and Ask are for
   members: a free account's tap opens bf-access.js's "Card checkout is
   coming" sheet (Buy, data-bf-buy) or the members panel (Ask,
   data-members-only). A member's Buy confirms in a sheet and uses the
   Market's own route (POST /api/marketplace/listings/:id/buy); Ask writes to
   the seller (POST /api/messages) and opens the conversation. No Tip here.

   SEARCH. The magnifier on every tab opens it; the back arrow returns to the
   tab the viewer came from. GET /api/search: All (People, Listings, Posts,
   Needs, each with See all) or one of them, a page at a time. The field is
   16 px so a phone does not zoom. Recent searches stay on this device only
   (localStorage bf_recent_searches, up to 8), with Clear.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFHomeTabs) return;
  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var ORIGIN = "https://bizforceai.net";
  var BREAKPOINT = "(max-width: 760px)";
  var TAB_KEY = "bf_home_tab";
  var RECENT_KEY = "bf_recent_searches";
  var RECENT_MAX = 8;
  var TABS = ["local", "following", "market"];
  var REACH_WORDS = { city: "My city", "25": "Within 25 mi", anywhere: "Anywhere" };
  var SCOPES = [["all", "All"], ["people", "People"], ["listings", "Listings"], ["posts", "Posts"], ["needs", "Needs"]];
  var GROUPS = [["people", "PEOPLE"], ["listings", "LISTINGS"], ["posts", "POSTS"], ["needs", "NEEDS"]];
  var TEXT = {
    addCityTitle: "Add your city to see Local",
    addCity: "Local shows posts and Needs from members near you. Add your city in Settings; it is never your device's location.",
    addCityGo: "Add your city",
    localEmpty: "Nothing near you yet",
    localEmptySub: "No public posts or open Needs within your reach. Change widens it.",
    followTitle: "Follow people to fill this tab",
    followSub: "Posts from people you follow show here, newest first. Here are a few near you and in what you do.",
    suggested: "SUGGESTED FOR YOU",
    noSuggest: "No one to suggest just now.",
    marketEmpty: "No listings here yet",
    marketEmptySub: "Members' active listings show here, nearest and newest first.",
    loadErr: "This could not be loaded just now. It is not a statement that there is nothing here.",
    sheetTitle: "Show posts from",
    otherCity: "Use a different city",
    otherCityHint: "Type a city. It is looked up once; your device's location is never used.",
    find: "Use this city",
    recent: "RECENT SEARCHES",
    clear: "Clear",
    none: "Nothing found.",
    searchHint: "Search people, listings, posts and Needs.",
    seeAll: "See all",
    more: "More results"
  };

  function api() { return (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK; }
  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function myId() { try { var t = token(); return t ? JSON.parse(atob(t.split(".")[1])).id || null : null; } catch (e) { return null; } }
  function phone() { return !!(window.matchMedia && window.matchMedia(BREAKPOINT).matches); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function safeUrl(u) { return typeof u === "string" && /^(https:\/\/|\/)/.test(u) && !/^\/\//.test(u) ? u : ""; }
  function n(v) { return (Number(v) || 0).toLocaleString("en-US"); }
  function call(method, path, body) {
    var opts = { method: method, headers: { "Authorization": "Bearer " + token() } };
    if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
    return fetch(api() + path, opts)
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, body: d || {} }; }); });
  }
  // this device's two keys, each read and written inside try/catch (private mode: not kept)
  function keepTab(name) { try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* not kept */ } }
  function keptTab() { try { return localStorage.getItem(TAB_KEY); } catch (e) { return null; } }
  function keepRecent(list) { try { if (list === null) localStorage.removeItem(RECENT_KEY); else localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (e) { /* not kept */ } }
  function keptRecent() { try { return localStorage.getItem(RECENT_KEY); } catch (e) { return null; } }
  function svg(paths, size, fill) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' + (fill ? "currentColor" : "none") + '" stroke="' + (fill ? "none" : "currentColor") +
      '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var ICON = {
    pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    like: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>',
    ask: '<path d="M4 5h16v11H9l-5 4z"/>',
    save: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    share: '<path d="M14 4l8 8-8 8v-5c-6 0-9 2-11 5 1-6 4-10 11-11z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    people: '<circle cx="9" cy="8" r="4"/><path d="M2 21c1-4 3.5-6 7-6s6 2 7 6M19 8v6M16 11h6"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
    check: '<path d="M5 12l5 5 9-10"/>'
  };
  function initials(name) {
    var w = String(name || "?").replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w.length > 1 ? w[1].charAt(0) : "")).toUpperCase();
  }
  function avatar(p, cls) {
    return safeUrl(p && p.avatar_url) ? '<img class="' + cls + '" src="' + esc(p.avatar_url) + '" alt="">' : '<span class="' + cls + '" aria-hidden="true">' + esc(initials(p && p.name)) + '</span>';
  }
  function vb(reason) { return window.bfVerified ? window.bfVerified.html(reason) : ""; }
  function line(parts) { return parts.filter(function (x) { return typeof x === "string" && x; }).join(" · "); }
  // the tier, from bf-access.js when it is known (it may load after this file): "free" gets the members panel or the card sheet,
  // anything else goes on to the server, which decides (only members buy in BizCash and message first)
  function whenTier(fn) {
    var a = window.bfAccess;
    if (a && a.ready && typeof a.ready.then === "function") a.ready.then(function (x) { fn(x && x.tier); }, function () { fn(null); });
    else fn(null);
  }

  /* ── the style: the boards' figures (backend scripts/designSpec.js HOME), the site's own fonts ── */
  function addStyle() {
    if (document.getElementById("bfh-style")) return;
    var F = 'system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    var css = [
      "body[data-home-tab=local] #feed,body[data-home-tab=market] #feed,body[data-home-tab=local] .feed-empty,body[data-home-tab=market] .feed-empty,",
      "body[data-home-tab=local] .find-people,body[data-home-tab=market] .find-people,body[data-home-tab=local] .first-post,body[data-home-tab=market] .first-post,",
      "body.bfh-follow-empty #feed,body.bfh-follow-empty .feed-empty,body.bfh-follow-empty .find-people{display:none !important}",
      ".bfh-panel[hidden],.bfh-follow[hidden],.bfh-search[hidden],.bfh-sheet[hidden],.bfh-back[hidden]{display:none !important}",
      /* a chip is a 44 px target (the site's phone rule) holding the board's 34 px face, as LR-4's .lr-btnf */
      ".bfh-chips{display:flex;gap:8px;overflow-x:auto;padding:0 0 6px}",
      ".bfh-chip{flex:none;display:inline-flex;align-items:center;height:44px;padding:0;border:0;background:none;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".bfh-chipf{display:inline-flex;align-items:center;gap:6px;height:34px;box-sizing:border-box;padding:0 12px;border-radius:17px;border:1px solid #2b3a6b;background:rgba(14,20,40,.8);color:#c9d1e6;font:500 12.5px/1 " + F + ";white-space:nowrap}",
      ".bfh-chip.is-on .bfh-chipf,.bfh-chip[aria-pressed=true] .bfh-chipf{border-color:var(--bf-accent-a, #22d3ee);background:#0f2a3a;color:var(--bf-accent-a, #22d3ee)}",
      ".bfh-chipf svg{flex:none}",
      ".bfh-card{background:rgba(10,15,35,.82);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:10px}",
      ".bfh-card h2{margin:0;font:800 1.05rem/1.3 " + F + ";color:#f4f7ff}",
      ".bfh-card p{margin:0;color:#a9b3cc;font-size:.9rem;line-height:1.5}",
      ".bfh-go{align-self:flex-start;display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:12px;border:0;background:var(--bf-accent-a, #22d3ee);color:#070b18;font:700 .9rem " + F + ";text-decoration:none;cursor:pointer}",
      ".bfh-fbtn{flex:none;display:inline-flex;align-items:center;justify-content:center;height:44px;min-width:44px;padding:0;border:0;background:none;cursor:pointer}",
      ".bfh-fbtnf{display:inline-flex;align-items:center;height:34px;box-sizing:border-box;padding:0 14px;border-radius:17px;border:0;background:var(--bf-accent-a, #22d3ee);color:#070b18;font:700 13px/1 " + F + "}",
      ".bfh-fbtn.is-on .bfh-fbtnf{background:transparent;border:1px solid #2b3a6b;color:#a9b3cc}",
      ".bfh-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #141b33}",
      ".bfh-av{flex:none;width:48px;height:48px;border-radius:24px;object-fit:cover;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6));color:#070b18;font:700 15px/1 " + F + "}",
      ".bfh-who{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none}",
      ".bfh-name{font:600 14.5px/1.3 " + F + ";color:#e6eaf5;overflow-wrap:anywhere}",
      ".bfh-sub{font:400 12.5px/1.35 " + F + ";color:#a9b3cc;overflow-wrap:anywhere}",
      ".bfh-lbl{font:600 11px/1.2 " + F + ";letter-spacing:1.6px;color:#8e9bbf}",
      ".bfh-note{margin:0;color:#a9b3cc;font-size:.85rem}",
      "#homeLocalFeed .bfp-kind.is-local .bfp-kmeta{font-size:13px;color:#c9d1e6}",
      ".bfh-note:empty{display:none}",
      /* Following, nobody followed (FeedFollowing) */
      ".bfh-follow{display:flex;flex-direction:column;gap:14px}",
      ".bfh-follow-top{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 10px 8px;text-align:center}",
      ".bfh-follow-ic{width:64px;height:64px;border-radius:32px;background:#0f2a3a;color:var(--bf-accent-a, #22d3ee);display:flex;align-items:center;justify-content:center}",
      ".bfh-follow-t{margin:0;font:700 18px/1.3 " + F + ";color:#e6eaf5}",
      ".bfh-follow-s{margin:0;font:400 13.5px/1.45 " + F + ";color:#a9b3cc}",
      /* Market (FeedMarket) */
      ".bfm-list{display:flex;flex-direction:column;gap:18px}",
      ".bfm-card{position:relative;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:rgba(10,15,35,.82);border:1px solid rgba(255,255,255,.08)}",
      ".bfm-stage{position:relative;aspect-ratio:4/3;background:radial-gradient(120% 70% at 60% 35%,#14404e 0%,#0b1230 50%,#05070f 100%);display:flex;align-items:center;justify-content:center;color:#6b7899}",
      ".bfm-stage img{width:100%;height:100%;object-fit:cover;display:block}",
      ".bfm-shade{display:none}",
      ".bfm-meta{display:flex;flex-direction:column;gap:8px;padding:14px 16px 4px}",
      ".bfm-line{font:400 13px/1.3 " + F + ";color:#c9d1e6}",
      ".bfm-title{margin:0;font:700 21px/1.2 " + F + ";color:#e6eaf5;overflow-wrap:anywhere}",
      ".bfm-title a{color:inherit;text-decoration:none;display:inline-block;padding:8px 0;margin:-8px 0}",
      ".bfm-sub{margin:0;font:400 14px/1.4 " + F + ";color:#c9d1e6;max-height:4.2em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow-wrap:anywhere}",
      ".bfm-buyrow{display:flex;align-items:center;gap:10px;margin-top:4px}",
      ".bfm-price{font:700 22px/1.2 " + F + ";color:#f5c46b}",
      ".bfm-gap{flex:1}",
      ".bfm-buy{height:44px;padding:0 26px;border-radius:22px;border:0;background:var(--bf-accent-a, #22d3ee);color:#070b18;font:700 15px/1 " + F + ";cursor:pointer}",
      ".bfm-rail{display:flex;align-items:center;gap:4px;padding:6px 10px 12px}",
      ".bfm-av{display:none}",
      ".bfm-act{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 10px;border:0;border-radius:12px;background:transparent;color:#c9d1e6;font:600 13px/1 " + F + ";cursor:pointer}",
      ".bfm-act[aria-pressed=true]{color:var(--bf-accent-a, #22d3ee)}",
      ".bfm-act svg{width:22px;height:22px}",
      ".bfm-note{margin:0 16px 12px;color:#a9b3cc;font-size:.85rem}",
      ".bfm-note:empty{display:none}",
      ".bfm-end{margin:0;padding:12px;color:#a9b3cc;font-size:.88rem;text-align:center}",
      /* the sheets (Change, Buy, Ask) */
      ".bfh-back{position:fixed;inset:0;z-index:60;background:rgba(3,5,12,.6)}",
      ".bfh-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%);z-index:61;width:min(480px,100%);max-height:85vh;overflow:auto;box-sizing:border-box;padding:18px 16px calc(18px + env(safe-area-inset-bottom, 0px));border-radius:18px 18px 0 0;background:#0b1022;border:1px solid #2b3a6b;border-bottom:0;color:#e6eaf5;display:flex;flex-direction:column;gap:12px}",
      ".bfh-sheet h2{margin:0;font:800 1.05rem/1.3 " + F + "}",
      ".bfh-sheet p{margin:0;color:#a9b3cc;font-size:.88rem;line-height:1.5}",
      ".bfh-opt{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:0 14px;border-radius:12px;border:1px solid #2b3a6b;background:rgba(14,20,40,.8);color:#e6eaf5;font:600 15px/1 " + F + ";cursor:pointer;text-align:left}",
      ".bfh-opt[aria-pressed=true]{border-color:var(--bf-accent-a, #22d3ee);color:var(--bf-accent-a, #22d3ee)}",
      ".bfh-field{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid #2b3a6b;background:#070b18;color:#e6eaf5;font:400 16px/1.3 " + F + "}",
      ".bfh-sheet textarea.bfh-field{min-height:96px;resize:vertical}",
      ".bfh-btns{display:flex;gap:10px;flex-wrap:wrap}",
      ".bfh-quiet{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid #2b3a6b;background:transparent;color:#c9d1e6;font:600 .9rem " + F + ";cursor:pointer}",
      ".bfh-osm{font-size:.78rem !important;color:#8e9bbf !important}",
      ".bfh-err{color:#fca5a5 !important}",
      /* Search (FeedSearch) */
      ".bfh-search{position:fixed;inset:0;z-index:45;background:#070b18;color:#e6eaf5;overflow-y:auto;overscroll-behavior:contain}",
      ".bfh-s-in{max-width:640px;margin:0 auto;padding-bottom:24px}",
      ".bfh-s-top{display:flex;align-items:center;gap:8px;padding:calc(12px + env(safe-area-inset-top, 0px)) 12px 8px}",
      ".bfh-s-back{flex:none;width:44px;height:44px;border:0;background:transparent;color:#e6eaf5;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}",
      ".bfh-s-box{flex:1;min-width:0;height:44px;box-sizing:border-box;border-radius:22px;border:1px solid var(--bf-accent-a, #22d3ee);background:#0b1022;display:flex;align-items:center;gap:8px;padding:0 6px 0 14px;color:#a9b3cc}",
      ".bfh-s-input{flex:1;min-width:0;height:42px;border:0;background:transparent;color:#e6eaf5;font:400 16px/1 " + F + ";outline:none;padding:0}",
      ".bfh-s-input::-webkit-search-cancel-button{display:none}",
      ".bfh-s-x{flex:none;width:32px;height:32px;border:0;border-radius:16px;background:transparent;color:#a9b3cc;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}",
      ".bfh-s-x[hidden]{display:none}",
      ".bfh-s-chips{padding:0 12px 10px}",
      ".bfh-s-body{padding:0 16px;display:flex;flex-direction:column;gap:6px}",
      ".bfh-s-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:28px}",
      ".bfh-s-head+.bfh-s-head,.bfh-s-group+.bfh-s-group{margin-top:8px}",
      ".bfh-s-all{color:var(--bf-accent-a, #22d3ee);font:400 13px/1 " + F + ";text-decoration:none;background:none;border:0;cursor:pointer;min-height:44px;padding:0 0 0 12px}",
      ".bfh-s-group{display:flex;flex-direction:column;gap:6px}",
      ".bfh-l{display:flex;align-items:center;gap:10px;padding:8px 0}",
      ".bfh-l-tile{flex:none;width:56px;height:56px;border-radius:12px;object-fit:cover;background:linear-gradient(160deg,#2a1b5c,#0b1230)}",
      ".bfh-l-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;color:inherit;text-decoration:none}",
      ".bfh-l-t{font:600 14px/1.3 " + F + ";color:#e6eaf5;overflow-wrap:anywhere}",
      ".bfh-l-p{flex:none;font:700 14px/1 " + F + ";color:#f5c46b}",
      ".bfh-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}",
      ".bfh-tile{position:relative;display:block;aspect-ratio:3/4;border-radius:8px;overflow:hidden;background:linear-gradient(160deg,#1b2a5c,#0b1230);color:#e6eaf5;text-decoration:none}",
      ".bfh-tile img{width:100%;height:100%;object-fit:cover;display:block}",
      ".bfh-tile span{position:absolute;left:6px;right:6px;bottom:6px;font:600 11px/1.3 " + F + ";max-height:4em;overflow:hidden;text-shadow:0 1px 3px rgba(0,0,0,.9)}",
      ".bfh-need{display:flex;flex-direction:column;gap:3px;padding:10px 0;border-bottom:1px solid #141b33;color:inherit;text-decoration:none}",
      ".bfh-need-tag{align-self:flex-start;padding:2px 8px;border-radius:6px;background:var(--bf-accent-a, #22d3ee);color:#070b18;font:800 10.5px/1.4 " + F + ";letter-spacing:.08em}",
      ".bfh-recent{display:flex;align-items:center;gap:10px;min-height:44px;padding:0;border:0;border-bottom:1px solid #141b33;background:transparent;color:#c9d1e6;font:400 15px/1 " + F + ";text-align:left;cursor:pointer;width:100%}",
      ".bfh-more{min-height:44px;margin:8px 0;border-radius:12px;border:1px solid #2b3a6b;background:transparent;color:var(--bf-accent-a, #22d3ee);font:700 .9rem " + F + ";cursor:pointer}",
      "@media (min-width: 761px){.bfh-chips{padding-top:4px}}",
      "@media " + BREAKPOINT + "{",
      /* a tab drawn as a board but not full screen (an empty Local or Market, Following with nobody followed): the tab row at the
         top as on the boards, the page's header and the starter sections out of the way */
      "body.bfh-board .top-nav,body.bfh-board .home-main>header,body.bfh-board .first-post,body.bfh-board .starter{display:none}",
      "body[data-home-tab=local] .starter,body[data-home-tab=market] .starter{display:none}",
      "body.bfh-board .feed-top{position:fixed;top:0;left:0;right:0;z-index:41;padding:calc(12px + env(safe-area-inset-top, 0px)) 2px 0 9px;background:#070b18}",
      "body.bfh-board .page{padding-top:calc(68px + env(safe-area-inset-top, 0px))}",
      /* a full-screen tab: the chips under the tab row (12 px from the left, 64 px down, as drawn) */
      "body.feed-full .bfh-chips.is-over{position:fixed;left:12px;right:0;top:calc(59px + env(safe-area-inset-top, 0px));z-index:42;padding:0}",
      ".bfh-follow{padding:0}",
      "body.bfh-follow-empty .bfh-follow{min-height:calc(100vh - 68px - 56px - env(safe-area-inset-bottom, 0px));margin:0 -16px;padding:16px 16px 0;background:#070b18}",
      ".bfm-list.is-full{position:fixed;left:0;right:0;top:0;bottom:calc(56px + env(safe-area-inset-bottom, 0px));z-index:40;gap:0;overflow-y:auto;scroll-snap-type:y mandatory;background:#05070f;overscroll-behavior:contain}",
      ".bfm-list.is-full>.bfm-card{flex:0 0 100%;height:100%;scroll-snap-align:start;scroll-snap-stop:always;border-radius:0;border:0;background:#05070f}",
      ".bfm-list.is-full>.bfm-end{flex:0 0 auto;scroll-snap-align:end}",
      ".bfm-list.is-full .bfm-stage{position:absolute;inset:0;aspect-ratio:auto}",
      ".bfm-list.is-full .bfm-shade{display:block;position:absolute;left:0;right:0;bottom:0;height:60%;background:linear-gradient(180deg,rgba(5,7,15,0) 0%,rgba(5,7,15,.75) 100%);pointer-events:none}",
      ".bfm-list.is-full .bfm-meta{position:absolute;left:14px;right:80px;bottom:16px;z-index:2;padding:0;text-shadow:0 1px 3px rgba(0,0,0,.85)}",
      ".bfm-list.is-full .bfm-buy{text-shadow:none}",
      ".bfm-list.is-full .bfm-rail{position:absolute;right:10px;bottom:16px;z-index:2;width:60px;flex-direction:column;align-items:center;gap:18px;padding:0}",
      ".bfm-list.is-full .bfm-av{display:block;position:relative;width:52px;height:52px;flex:none}",
      ".bfm-list.is-full .bfm-pic{display:flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#f5c46b,#e06a00);color:#070b18;font:700 16px/1 " + F + ";text-decoration:none}",
      ".bfm-list.is-full .bfm-pic img{width:100%;height:100%;object-fit:cover}",
      ".bfm-list.is-full .bfm-badge{position:absolute;left:4px;top:22px;width:44px;height:44px;padding:0;margin:0;border:0;background:transparent;cursor:pointer}",
      ".bfm-list.is-full .bfm-badge span{position:absolute;left:11px;top:19px;width:22px;height:22px;border-radius:50%;background:var(--bf-accent-a, #22d3ee);color:#070b18;display:flex;align-items:center;justify-content:center}",
      ".bfm-list.is-full .bfm-badge[hidden]{display:none}",
      ".bfm-list.is-full .bfm-act{flex-direction:column;justify-content:flex-start;gap:4px;width:60px;min-width:60px;min-height:50px;height:50px;padding:0;border-radius:0;color:#fff;font:600 12px/16px " + F + ";text-shadow:0 1px 3px rgba(0,0,0,.85)}",
      ".bfm-list.is-full .bfm-act svg{width:30px;height:30px;fill:currentColor;stroke:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.7))}",
      ".bfm-list.is-full .bfm-act[data-mact=save] svg,.bfm-list.is-full .bfm-act[data-mact=share] svg{width:28px;height:28px}",
      ".bfm-list.is-full .bfm-act[aria-pressed=true]{color:var(--bf-accent-a, #22d3ee)}",
      ".bfm-list.is-full .bfm-note{position:absolute;left:14px;right:80px;top:110px;z-index:3;margin:0;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.6);color:#fff}",
      ".bfh-s-in{max-width:none}",
      "body.bfh-searching #bf-tabbar{z-index:46}",
      ".bfh-search{bottom:calc(56px + env(safe-area-inset-bottom, 0px))}",
      /* a sheet (Change, Buy, Ask) ends above the bottom bar, so its last button and the OpenStreetMap credit are never under it */
      ".bfh-sheet{bottom:calc(56px + env(safe-area-inset-bottom, 0px));max-height:calc(85vh - 56px - env(safe-area-inset-bottom, 0px));padding-bottom:18px}",
      "}"
    ].join("\n");
    var s = document.createElement("style");
    s.id = "bfh-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── state ── */
  var S = { tab: "following", from: "following", state: null, local: null, localBody: null, followEmpty: false,
    market: { cat: null, cursor: null, loading: false, done: false, started: false, cats: null, io: null, list: {} },
    search: { q: "", scope: "all", cursor: null, seq: 0 } };
  var $ = function (id) { return document.getElementById(id); };

  /* ── the tabs ── */
  function tabBtn(name) { return $(name === "local" ? "tabLocal" : name === "market" ? "tabMarket" : "tabFollowing"); }
  function setTab(name, quiet) {
    if (TABS.indexOf(name) === -1) name = "following";
    S.tab = name;
    document.body.setAttribute("data-home-tab", name);
    TABS.forEach(function (t) {
      var b = tabBtn(t);
      if (b) { b.setAttribute("aria-selected", String(t === name)); b.tabIndex = t === name ? 0 : -1; }
    });
    var feed = $("feed");
    if (feed) feed.hidden = name !== "following";
    $("homeLocal").hidden = name !== "local";
    $("homeMarket").hidden = name !== "market";
    $("homeFollowEmpty").hidden = !(name === "following" && S.followEmpty);
    document.body.classList.toggle("bfh-follow-empty", name === "following" && S.followEmpty);
    keepTab(name);
    if (name === "local") startLocal();
    if (name === "market") startMarket();
    syncFull();
    if (!quiet && window.scrollTo) window.scrollTo(0, 0);
  }
  function isFull() {
    if (!phone()) return false;
    if (S.tab === "local") return !!(S.local && S.local.el && S.local.el.classList.contains("is-full"));
    if (S.tab === "market") return $("homeMarketList").classList.contains("is-full");
    return !S.followEmpty && !!$("feed") && $("feed").classList.contains("is-full");
  }
  function syncFull() {
    var full = isFull();
    document.body.classList.toggle("feed-full", full);
    document.body.classList.toggle("bfh-board", phone() && !full && (S.tab !== "following" || S.followEmpty));
    Array.prototype.forEach.call(document.querySelectorAll(".bfh-chips[data-over]"), function (c) { c.classList.toggle("is-over", full); });
    if (typeof window.__bfhMarkFull === "function") window.__bfhMarkFull();
  }

  /* ── the tab row's state: the place chip and the Market dot ── */
  function loadState() {
    return call("GET", "/api/home/tabs").then(function (r) {
      if (!r.ok) return;
      S.state = r.body;
      var m = $("tabMarket");
      if (m) m.classList.toggle("has-dot", r.body.market_new === true && S.tab !== "market");
      renderLocalChips();
    }).catch(function () { /* the dot and chip wait for the next load */ });
  }

  /* ── Local ── */
  function reachOf() { return (S.localBody && S.localBody.reach) || (S.state && S.state.reach) || "25"; }
  function placeOf() { var b = S.localBody && S.localBody.place !== undefined ? S.localBody : S.state; return b ? b.place : null; }
  function renderLocalChips() {
    var box = $("homeLocalChips");
    if (!box) return;
    var place = placeOf();
    if (!place) { box.innerHTML = ""; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<button type="button" class="bfh-chip is-on" data-bfh="change" aria-label="Your place: ' + esc(place.label) + '. Change"><span class="bfh-chipf">' + svg(ICON.pin, 14) + '<span>' + esc(place.label) + '</span></span></button>' +
      '<button type="button" class="bfh-chip" data-bfh="change" aria-label="Reach: ' + esc(REACH_WORDS[reachOf()]) + '. Change"><span class="bfh-chipf">' + esc(REACH_WORDS[reachOf()]) + '</span></button>' +
      '<button type="button" class="bfh-chip" data-bfh="change" id="homeLocalChange"><span class="bfh-chipf">Change</span></button>';
  }
  function startLocal() {
    if (S.local) return;
    var host = $("homeLocalFeed");
    S.local = window.BFFeed.mount(host, { full: true, local: true, endText: "That is everything near you.", onFirst: function (body) {
      S.localBody = body;
      renderLocalChips();
      var st = $("homeLocalState");
      if (!body) { st.innerHTML = '<div class="bfh-card"><p>' + esc(TEXT.loadErr) + '</p></div>'; st.hidden = false; syncFull(); return; }
      if (!body.place) {
        st.innerHTML = '<div class="bfh-card"><h2>' + esc(TEXT.addCityTitle) + '</h2><p>' + esc(TEXT.addCity) + '</p><a class="bfh-go" href="settings.html#local">' + esc(TEXT.addCityGo) + '</a></div>';
        st.hidden = false;
      } else if (!(body.posts || []).length) {
        st.innerHTML = '<div class="bfh-card"><h2>' + esc(TEXT.localEmpty) + '</h2><p>' + esc(TEXT.localEmptySub) + '</p></div>';
        st.hidden = false;
      } else st.hidden = true;
      syncFull();
    } });
  }
  function restartLocal() {
    S.local = null; S.localBody = null;
    $("homeLocalState").hidden = true;
    var host = $("homeLocalFeed");
    host.className = ""; host.innerHTML = "";
    if (S.tab === "local") startLocal();
  }

  /* ── Change (Local's sheet) ── */
  var sheetFrom = null;
  function openSheet(html, from, label) {
    var back = $("homeSheetBack"), sh = $("homeSheet");
    sheetFrom = from || document.activeElement;
    sh.setAttribute("aria-label", label || "");
    sh.innerHTML = html;
    back.hidden = false; sh.hidden = false;
    var f = sh.querySelector("[data-focus]") || sh.querySelector("button,input,textarea");
    if (f) f.focus();
    return sh;
  }
  function closeSheet() {
    var sh = $("homeSheet");
    if (sh.hidden) return;
    sh.hidden = true; $("homeSheetBack").hidden = true; sh.innerHTML = "";
    if (sheetFrom && sheetFrom.focus) { try { sheetFrom.focus(); } catch (e) { /* gone */ } }
  }
  function openChange(from) {
    var r = reachOf(), place = placeOf();
    var opt = function (v) {
      return '<button type="button" class="bfh-opt" data-reach="' + v + '" aria-pressed="' + (r === v && !(v === "city" && place && place.chosen)) + '">' + esc(REACH_WORDS[v]) +
        (r === v ? svg(ICON.check, 18) : "") + '</button>';
    };
    var sh = openSheet('<h2 id="homeSheetTitle">' + esc(TEXT.sheetTitle) + '</h2>' +
      (place ? '<p>' + esc(place.chosen ? "Showing " + place.label + ", the city you chose." : "Your city: " + place.label + ".") + '</p>' : "") +
      opt("city") + opt("25") + opt("anywhere") +
      '<label class="bfh-lbl" for="homeCityInput">' + esc(TEXT.otherCity.toUpperCase()) + '</label>' +
      '<input class="bfh-field" id="homeCityInput" type="text" maxlength="80" autocomplete="address-level2" placeholder="City, for example Austin, TX" value="' + esc(place && place.chosen ? place.label : "") + '">' +
      '<p>' + esc(TEXT.otherCityHint) + '</p>' +
      '<div class="bfh-btns"><button type="button" class="bfh-go" id="homeCityGo">' + esc(TEXT.find) + '</button><button type="button" class="bfh-quiet" id="homeSheetClose">Close</button></div>' +
      '<p class="bfh-note" id="homeSheetNote" role="status"></p>' +
      '<p class="bfh-osm">' + esc((S.state && S.state.attribution) || "Data from OpenStreetMap contributors") + '</p>', from, TEXT.sheetTitle);
    sh.setAttribute("aria-labelledby", "homeSheetTitle");
    Array.prototype.forEach.call(sh.querySelectorAll("[data-reach]"), function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-reach");
        savePrefs(v === "city" ? { reach: "city", place: null } : { reach: v });
      });
    });
    sh.querySelector("#homeCityGo").addEventListener("click", function () {
      var t = sh.querySelector("#homeCityInput").value.trim();
      if (t.length < 2) { note(sh, "Type a city, at least 2 letters.", true); return; }
      savePrefs({ place: t });
    });
    sh.querySelector("#homeCityInput").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); sh.querySelector("#homeCityGo").click(); } });
    sh.querySelector("#homeSheetClose").addEventListener("click", closeSheet);
  }
  function note(sh, text, bad) { var x = sh.querySelector("#homeSheetNote"); if (x) { x.textContent = text; x.classList.toggle("bfh-err", !!bad); } }
  function savePrefs(body) {
    var sh = $("homeSheet");
    note(sh, "Saving...");
    call("PUT", "/api/home/prefs", body).then(function (r) {
      if (!r.ok) { note(sh, r.body.error || "That did not save. Try again.", true); return; }
      S.state = Object.assign({}, S.state || {}, { reach: r.body.reach, place: r.body.place });
      closeSheet();
      restartLocal();
      renderLocalChips();
      if (S.market.started) startMarket(true);
    }).catch(function () { note(sh, "That did not save. Check your connection.", true); });
  }

  /* ── Following, nobody followed ── */
  function followingFirst(body) {
    // a link to one post (home.html?post=<id>) shows that post on Following, never the empty board
    var empty = !!body && body.following_count === 0 && !/[?&]post=/.test(window.location.search);
    S.followEmpty = empty;
    if (empty) loadSuggestions();
    setTab(S.tab, true);
    return empty;
  }
  function personRow(p, sub) {
    var me = myId();
    var canFollow = !!me && p.user_id !== me && !p.mine && !p.following;
    return '<div class="bfh-row">' + avatar(p, "bfh-av") +
      '<a class="bfh-who" href="' + esc(safeUrl(p.link) || "#") + '"><span class="bfh-name">' + esc(p.name) + vb(p.verified) + '</span><span class="bfh-sub">' + esc(sub) + '</span></a>' +
      (canFollow ? '<button type="button" class="bfh-fbtn" data-hfollow="' + esc(p.user_id) + '" aria-label="Follow ' + esc(p.name) + '"><span class="bfh-fbtnf">Follow</span></button>'
        : p.following ? '<button type="button" class="bfh-fbtn is-on" disabled><span class="bfh-fbtnf">Following</span></button>' : "") + '</div>';
  }
  function loadSuggestions() {
    var box = $("homeFollowEmpty");
    box.innerHTML = '<div class="bfh-follow-top"><span class="bfh-follow-ic">' + svg(ICON.people, 30) + '</span><h2 class="bfh-follow-t">' + esc(TEXT.followTitle) + '</h2>' +
      '<p class="bfh-follow-s">' + esc(TEXT.followSub) + '</p></div><div class="bfh-lbl">' + esc(TEXT.suggested) + '</div><div id="homeSuggest"><p class="bfh-note">Loading...</p></div>';
    call("GET", "/api/home/suggestions").then(function (r) {
      var list = r.ok ? r.body.people || [] : null;
      var el = $("homeSuggest");
      if (!list) { el.innerHTML = '<p class="bfh-note">' + esc(TEXT.loadErr) + '</p>'; return; }
      el.innerHTML = list.length ? list.map(function (p) { return personRow(p, line([p.category, p.area])); }).join("") : '<p class="bfh-note">' + esc(TEXT.noSuggest) + '</p>';
    }).catch(function () { $("homeSuggest").innerHTML = '<p class="bfh-note">' + esc(TEXT.loadErr) + '</p>'; });
  }
  function followBtn(b) {
    var uid = b.getAttribute("data-hfollow");
    b.disabled = true;
    call("POST", "/api/follows", { user_id: uid }).then(function (r) {
      if (!r.ok) { b.disabled = false; b.title = r.body.error || "That did not work."; return; }
      Array.prototype.forEach.call(document.querySelectorAll('[data-hfollow="' + uid + '"]'), function (x) {
        if (x.classList.contains("bfm-badge")) { x.hidden = true; return; }
        var f = x.querySelector(".bfh-fbtnf"); if (f) f.textContent = "Following"; else x.textContent = "Following";
        x.classList.add("is-on"); x.disabled = true; x.removeAttribute("data-hfollow"); x.removeAttribute("aria-label");
      });
    }).catch(function () { b.disabled = false; });
  }

  /* ── Market ── */
  function startMarket(again) {
    var M = S.market;
    if (M.started && !again) { seenMarket(); return; }
    M.started = true;
    if (!M.cats) loadCats();
    M.cursor = null; M.done = false; M.loading = false; M.list = {};
    var list = $("homeMarketList");
    list.className = "bfm-list"; list.innerHTML = '<p class="bfm-end" id="homeMarketEnd">Loading the Market...</p>';
    moreMarket();
    seenMarket();
  }
  function seenMarket() {
    var m = $("tabMarket");
    if (m) m.classList.remove("has-dot");
    call("POST", "/api/home/market/seen", {}).catch(function () { /* the dot comes back next time */ });
  }
  function loadCats() {
    fetch(api() + "/api/categories").then(function (r) { return r.ok ? r.json() : { categories: [] }; }).then(function (d) {
      S.market.cats = (d && d.categories) || [];
      renderCats();
    }).catch(function () { S.market.cats = []; renderCats(); });
  }
  function renderCats() {
    var box = $("homeMarketChips"), cur = S.market.cat;
    box.innerHTML = '<button type="button" class="bfh-chip' + (cur ? "" : " is-on") + '" data-cat="" aria-pressed="' + !cur + '"><span class="bfh-chipf">All</span></button>' +
      (S.market.cats || []).map(function (c) {
        return '<button type="button" class="bfh-chip' + (cur === c.slug ? " is-on" : "") + '" data-cat="' + esc(c.slug) + '" aria-pressed="' + (cur === c.slug) + '"><span class="bfh-chipf">' + esc(c.name) + '</span></button>';
      }).join("");
  }
  function moreMarket() {
    var M = S.market;
    if (M.loading || M.done) return;
    M.loading = true;
    var q = [];
    if (M.cat) q.push("category=" + encodeURIComponent(M.cat));
    if (M.cursor) q.push("cursor=" + encodeURIComponent(M.cursor));
    var seq = (M.seq = (M.seq || 0) + 1);
    call("GET", "/api/home/market" + (q.length ? "?" + q.join("&") : "")).then(function (r) {
      if (seq !== M.seq) return;
      M.loading = false;
      var list = $("homeMarketList"), end = $("homeMarketEnd");
      if (!r.ok) throw new Error(r.body.error || "HTTP " + r.status);
      var cards = r.body.listings || [];
      cards.forEach(function (l) { if (!M.list[l.id]) { M.list[l.id] = l; list.insertBefore(cardEl(l), end); } });
      M.cursor = r.body.next_cursor || null;
      M.done = !M.cursor;
      var count = Object.keys(M.list).length;
      if (count && phone()) list.classList.add("is-full");
      if (M.done) end.textContent = count ? "That is every listing here." : "";
      if (!count) {
        end.textContent = "";
        $("homeMarketState").innerHTML = '<div class="bfh-card"><h2>' + esc(TEXT.marketEmpty) + '</h2><p>' + esc(TEXT.marketEmptySub) + '</p></div>';
        $("homeMarketState").hidden = false;
      } else $("homeMarketState").hidden = true;
      syncFull();
      if (!M.done) watchEnd();
    }).catch(function () {
      M.loading = false;
      var end = $("homeMarketEnd");
      if (end) end.textContent = TEXT.loadErr;
      syncFull();
    });
  }
  function watchEnd() {
    var end = $("homeMarketEnd");
    if (!end) return;
    if (!window.IntersectionObserver) { moreMarket(); return; }
    if (!S.market.io) S.market.io = new IntersectionObserver(function (es) { if (es.some(function (x) { return x.isIntersecting; })) moreMarket(); }, { rootMargin: "600px 0px" });
    S.market.io.disconnect();
    S.market.io.observe(end);
  }
  function cardEl(l) {
    var s = l.seller || {}, me = myId();
    var canFollow = !!me && s.id !== me && !l.following;
    var el = document.createElement("article");
    el.className = "bfm-card";
    el.setAttribute("data-listing", l.id);
    var href = safeUrl(l.link) || "/listing/" + encodeURIComponent(l.id);
    var pic = safeUrl(s.avatar_url) ? '<img src="' + esc(s.avatar_url) + '" alt="">' : '<span aria-hidden="true">' + esc(initials(s.name)) + '</span>';
    el.innerHTML = '<div class="bfm-stage">' + (safeUrl(l.photo) ? '<img src="' + esc(l.photo) + '" alt="' + esc(l.title) + '" loading="lazy">' : svg(ICON.photo, 44)) + '</div>' +
      '<span class="bfm-shade" aria-hidden="true"></span>' +
      '<div class="bfm-meta"><div class="bfm-line">' + esc(line([l.category && l.category.name, l.place, l.distance_label])) + '</div>' +
      '<h2 class="bfm-title"><a href="' + esc(href) + '">' + esc(l.title) + '</a></h2>' +
      '<p class="bfm-sub">' + esc(line([s.name, l.description])) + '</p>' +
      '<div class="bfm-buyrow"><span class="bfm-price">' + n(l.price_bfc) + ' BFC</span><span class="bfm-gap"></span>' +
      (s.id === me ? "" : '<button type="button" class="bfm-buy" data-bf-buy data-mact="buy" aria-label="Buy ' + esc(l.title) + ', ' + n(l.price_bfc) + ' BFC">Buy</button>') + '</div></div>' +
      '<div class="bfm-rail"><span class="bfm-av"><a class="bfm-pic" href="' + esc(safeUrl(s.link) || "#") + '" aria-label="' + esc(s.name || "The seller") + '\'s profile">' + pic + '</a>' +
      (canFollow ? '<button type="button" class="bfm-badge" data-hfollow="' + esc(s.id) + '" aria-label="Follow ' + esc(s.name || "the seller") + '"><span>' + svg(ICON.plus, 14) + '</span></button>' : "") + '</span>' +
      '<button type="button" class="bfm-act" data-mact="like" aria-pressed="' + !!l.liked + '" aria-label="Like">' + svg(ICON.like, 22, true) + '<span>Like</span></button>' +
      '<button type="button" class="bfm-act" data-mact="ask" data-members-only aria-label="Ask the seller">' + svg(ICON.ask, 22, true) + '<span>Ask</span></button>' +
      '<button type="button" class="bfm-act" data-mact="save" aria-pressed="' + !!l.saved + '" aria-label="Save">' + svg(ICON.save, 22, true) + '<span>' + (l.saved ? "Saved" : "Save") + '</span></button>' +
      '<button type="button" class="bfm-act" data-mact="share" aria-label="Share">' + svg(ICON.share, 22, true) + '<span>Share</span></button></div>' +
      '<p class="bfm-note" role="status"></p>';
    return el;
  }
  function cardNote(card, text) {
    var x = card.querySelector(".bfm-note");
    x.textContent = text;
    clearTimeout(x._t);
    x._t = setTimeout(function () { x.textContent = ""; }, 4000);
  }
  function react(card, l, kind, btn) {
    var on = btn.getAttribute("aria-pressed") !== "true";
    btn.disabled = true;
    call(on ? "POST" : "DELETE", "/api/listings/" + encodeURIComponent(l.id) + "/" + kind).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { cardNote(card, r.body.error || "That did not work. Try again."); return; }
      btn.setAttribute("aria-pressed", String(on));
      if (kind === "save") btn.querySelector("span").textContent = on ? "Saved" : "Save";
      l[kind === "like" ? "liked" : "saved"] = on;
    }).catch(function () { btn.disabled = false; cardNote(card, "That did not work. Check your connection."); });
  }
  function shareListing(card, l) {
    var url = ORIGIN + (safeUrl(l.link) || "/listing/" + l.id);
    if (navigator.share) { navigator.share({ title: l.title, url: url }).catch(function () { /* closed */ }); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { cardNote(card, "Link copied: " + url); }, function () { cardNote(card, url); });
    else cardNote(card, url);
  }
  function buyListing(card, l, from) {
    whenTier(function (t) {
      if (t === "free") { if (window.bfAccess && window.bfAccess.showBuySheet) window.bfAccess.showBuySheet(); return; }
      buySheet(card, l, from);
    });
  }
  function buySheet(card, l, from) {
    var sh = openSheet('<h2>Buy ' + esc(l.title) + '?</h2><p>' + n(l.price_bfc) + ' BFC from your BizCash, to ' + esc((l.seller && l.seller.name) || "the seller") + '.</p>' +
      '<div class="bfh-btns"><button type="button" class="bfh-go" id="homeBuyYes" data-focus>Buy for ' + n(l.price_bfc) + ' BFC</button><button type="button" class="bfh-quiet" id="homeSheetClose">Cancel</button></div>' +
      '<p class="bfh-note" id="homeSheetNote" role="status"></p>', from, "Buy");
    sh.querySelector("#homeSheetClose").addEventListener("click", closeSheet);
    sh.querySelector("#homeBuyYes").addEventListener("click", function () {
      var b = this;
      b.disabled = true;
      note(sh, "Buying...");
      call("POST", "/api/marketplace/listings/" + encodeURIComponent(l.id) + "/buy").then(function (r) {
        if (r.ok && r.body.balance !== undefined) { note(sh, "Purchase complete. New balance: " + n(r.body.balance) + " BFC"); b.hidden = true; sh.querySelector("#homeSheetClose").textContent = "Done"; return; }
        b.disabled = false;
        note(sh, r.body.error || "That did not go through. Nothing was taken.", true);
      }).catch(function () { b.disabled = false; note(sh, "That did not go through. Check your connection.", true); });
    });
  }
  function askSeller(card, l, from) {
    whenTier(function (t) {
      if (t === "free") { if (window.bfAccess && window.bfAccess.showPanel) window.bfAccess.showPanel(); return; }
      askSheet(card, l, from);
    });
  }
  function askSheet(card, l, from) {
    var s = l.seller || {};
    var sh = openSheet('<h2>Ask ' + esc(s.name || "the seller") + '</h2><p>About ' + esc(l.title) + '. Your message starts a conversation in your Inbox.</p>' +
      '<label class="bfh-lbl" for="homeAskText">YOUR QUESTION</label><textarea class="bfh-field" id="homeAskText" maxlength="1000" data-focus>Hi, a question about ' + esc(l.title) + ': </textarea>' +
      '<div class="bfh-btns"><button type="button" class="bfh-go" id="homeAskSend">Send</button><button type="button" class="bfh-quiet" id="homeSheetClose">Cancel</button></div>' +
      '<p class="bfh-note" id="homeSheetNote" role="status"></p>', from, "Ask the seller");
    sh.querySelector("#homeSheetClose").addEventListener("click", closeSheet);
    sh.querySelector("#homeAskSend").addEventListener("click", function () {
      var b = this, text = sh.querySelector("#homeAskText").value.trim();
      if (!text) { note(sh, "Write your question to send.", true); return; }
      b.disabled = true;
      call("POST", "/api/messages", { receiver_id: s.id, content: text + "\n\n" + ORIGIN + (safeUrl(l.link) || "/listing/" + l.id) }).then(function (r) {
        if (!r.ok) { b.disabled = false; note(sh, r.body.error || "Your message wasn't sent. Try again.", true); return; }
        window.location.href = "inbox.html?with=" + encodeURIComponent(s.id);
      }).catch(function () { b.disabled = false; note(sh, "Your message wasn't sent. Check your connection.", true); });
    });
  }

  /* ── Search ── */
  function recent() { try { var a = JSON.parse(keptRecent() || "[]"); return Array.isArray(a) ? a.filter(function (x) { return typeof x === "string" && x; }).slice(0, RECENT_MAX) : []; } catch (e) { return []; } }
  function addRecent(q) {
    var a = recent().filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
    a.unshift(q);
    keepRecent(a.slice(0, RECENT_MAX));
  }
  function buildSearch() {
    var box = $("homeSearch");
    if (box.getAttribute("data-built")) return box;
    box.setAttribute("data-built", "1");
    box.innerHTML = '<div class="bfh-s-in"><div class="bfh-s-top"><button type="button" class="bfh-s-back" id="homeSearchBack" aria-label="Back">' + svg(ICON.back, 22) + '</button>' +
      '<div class="bfh-s-box">' + svg(ICON.search, 18) + '<input class="bfh-s-input" id="homeSearchInput" type="search" enterkeyhint="search" autocomplete="off" maxlength="80" aria-label="Search" placeholder="Search">' +
      '<button type="button" class="bfh-s-x" id="homeSearchClear" aria-label="Clear the search" hidden>' + svg(ICON.x, 16) + '</button></div></div>' +
      '<div class="bfh-chips bfh-s-chips" role="group" aria-label="Search in">' + SCOPES.map(function (s) {
        return '<button type="button" class="bfh-chip" data-scope="' + s[0] + '" aria-pressed="false"><span class="bfh-chipf">' + esc(s[1]) + '</span></button>';
      }).join("") + '</div><div class="bfh-s-body" id="homeSearchBody" aria-live="polite"></div></div>';
    var input = box.querySelector("#homeSearchInput");
    var timer = null;
    input.addEventListener("input", function () {
      box.querySelector("#homeSearchClear").hidden = !input.value;
      clearTimeout(timer);
      timer = setTimeout(function () { runSearch(input.value, S.search.scope); }, 300);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); runSearch(input.value, S.search.scope, true); }
      if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
    });
    box.querySelector("#homeSearchClear").addEventListener("click", function () { input.value = ""; this.hidden = true; runSearch("", S.search.scope); input.focus(); });
    box.querySelector("#homeSearchBack").addEventListener("click", closeSearch);
    box.addEventListener("keydown", function (e) { if (e.key === "Escape" && e.target !== input) { e.preventDefault(); closeSearch(); } });
    return box;
  }
  function openSearch() {
    S.from = S.tab;
    var box = buildSearch();
    box.hidden = false;
    document.body.classList.add("bfh-searching");
    setScope(S.search.scope);
    runSearch(box.querySelector("#homeSearchInput").value, S.search.scope);
    box.querySelector("#homeSearchInput").focus();
  }
  function closeSearch() {
    var box = $("homeSearch");
    if (box.hidden) return;
    box.hidden = true;
    document.body.classList.remove("bfh-searching");
    setTab(S.from, true);
    var back = $("feedSearch");
    if (back && back.focus) back.focus();
  }
  function setScope(scope) {
    S.search.scope = scope;
    Array.prototype.forEach.call(document.querySelectorAll("#homeSearch [data-scope]"), function (c) {
      var on = c.getAttribute("data-scope") === scope;
      c.classList.toggle("is-on", on); c.setAttribute("aria-pressed", String(on));
    });
  }
  function showRecent() {
    var body = $("homeSearchBody"), list = recent();
    if (!list.length) { body.innerHTML = '<p class="bfh-note">' + esc(TEXT.searchHint) + '</p>'; return; }
    body.innerHTML = '<div class="bfh-s-head"><span class="bfh-lbl">' + esc(TEXT.recent) + '</span><button type="button" class="bfh-s-all" id="homeRecentClear">' + esc(TEXT.clear) + '</button></div>' +
      list.map(function (q) { return '<button type="button" class="bfh-recent" data-recent="' + esc(q) + '">' + svg(ICON.search, 16) + '<span>' + esc(q) + '</span></button>'; }).join("");
  }
  function runSearch(q, scope, keepIt, cursor) {
    q = String(q || "").trim();
    var body = $("homeSearchBody");
    var seq = ++S.search.seq;
    S.search.q = q;
    if (Array.from(q.replace(/^@+/, "")).length < 2) { showRecent(); return; }
    if (!cursor) body.innerHTML = '<p class="bfh-note">Searching...</p>';
    var path = "/api/search?q=" + encodeURIComponent(q) + "&scope=" + encodeURIComponent(scope) + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "");
    call("GET", path).then(function (r) {
      if (seq !== S.search.seq) return;
      if (!r.ok) { body.innerHTML = '<p class="bfh-note bfh-err">' + esc(r.body.error || TEXT.loadErr) + '</p>'; return; }
      if (keepIt) addRecent(q);
      if (scope === "all") renderGroups(r.body.groups || {});
      else renderScoped(scope, r.body, !!cursor);
    }).catch(function () { if (seq === S.search.seq) body.innerHTML = '<p class="bfh-note bfh-err">' + esc(TEXT.loadErr) + '</p>'; });
  }
  function itemsHtml(kind, items) {
    if (kind === "people") return items.map(function (p) { return personRow(p, line(["@" + p.username, p.category, p.area])); }).join("");
    if (kind === "listings") return items.map(function (l) {
      var href = safeUrl(l.link) || "/listing/" + encodeURIComponent(l.id);
      return '<div class="bfh-l">' + (safeUrl(l.photo) ? '<img class="bfh-l-tile" src="' + esc(l.photo) + '" alt="" loading="lazy">' : '<span class="bfh-l-tile" aria-hidden="true"></span>') +
        '<a class="bfh-l-txt" href="' + esc(href) + '"><span class="bfh-l-t">' + esc(l.title) + '</span><span class="bfh-sub">' + esc(line([l.seller && l.seller.name, l.place || (l.category && l.category.name)])) + '</span></a>' +
        '<span class="bfh-l-p">' + n(l.price_bfc) + ' BFC</span></div>';
    }).join("");
    if (kind === "posts") return '<div class="bfh-grid">' + items.map(function (p) {
      var ph = (p.photos || [])[0];
      return '<a class="bfh-tile" href="home.html?post=' + encodeURIComponent(p.id) + '" aria-label="' + esc(((p.author && p.author.name) || "A member") + ": " + String(p.body || "").slice(0, 80)) + '">' +
        (ph && safeUrl(ph.thumb_url || ph.url) ? '<img src="' + esc(ph.thumb_url || ph.url) + '" alt="" loading="lazy">' : '<span>' + esc(String(p.body || "").slice(0, 90)) + '</span>') + '</a>';
    }).join("") + '</div>';
    return items.map(function (p) {
      var N = p.need || {};
      return '<a class="bfh-need" href="home.html?post=' + encodeURIComponent(p.id) + '"><span class="bfh-need-tag">NEED</span>' +
        '<span class="bfh-l-t">' + esc(String(p.body || "").slice(0, 140)) + '</span><span class="bfh-sub">' + esc(line([p.category && p.category.name, N.city, p.author && p.author.name])) + '</span></a>';
    }).join("");
  }
  function renderGroups(groups) {
    var body = $("homeSearchBody");
    var html = GROUPS.map(function (g) {
      var G = groups[g[0]];
      if (!G || !(G.items || []).length) return "";
      return '<div class="bfh-s-group"><div class="bfh-s-head"><span class="bfh-lbl">' + g[1] + '</span>' +
        (G.more ? '<button type="button" class="bfh-s-all" data-seeall="' + g[0] + '">' + esc(TEXT.seeAll) + '</button>' : "") + '</div>' + itemsHtml(g[0], G.items) + '</div>';
    }).join("");
    body.innerHTML = html || '<p class="bfh-note">' + esc(TEXT.none) + '</p>';
  }
  function renderScoped(scope, b, append) {
    var body = $("homeSearchBody");
    var label = GROUPS.filter(function (g) { return g[0] === scope; })[0][1];
    var items = b.items || [];
    var old = body.querySelector("#homeSearchMore");
    if (old) old.parentNode.removeChild(old);
    if (!append) body.innerHTML = '<div class="bfh-s-group" id="homeScoped"><div class="bfh-s-head"><span class="bfh-lbl">' + label + '</span></div></div>';
    var grp = body.querySelector("#homeScoped");
    if (!append && !items.length) { body.innerHTML = '<p class="bfh-note">' + esc(TEXT.none) + '</p>'; return; }
    var wrap = document.createElement("div");
    wrap.innerHTML = itemsHtml(scope, items);
    while (wrap.firstChild) grp.appendChild(wrap.firstChild);
    if (b.next_cursor) body.insertAdjacentHTML("beforeend", '<button type="button" class="bfh-more" id="homeSearchMore" data-cursor="' + esc(b.next_cursor) + '">' + esc(TEXT.more) + '</button>');
  }

  /* ── one listener for everything Home's tabs draw ── */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var tab = t.closest(".feed-tab:not([data-soon])");
    if (tab && tab.closest(".feed-tabs")) { var name = tab.id === "tabLocal" ? "local" : tab.id === "tabMarket" ? "market" : "following"; if (name !== S.tab) setTab(name); return; }
    if (t.closest("#feedSearch")) { e.preventDefault(); e.stopImmediatePropagation(); openSearch(); return; }
    if (t.closest("[data-bfh=change]")) { openChange(t.closest("[data-bfh=change]")); return; }
    if (t.closest("#homeSheetBack")) { closeSheet(); return; }
    var hf = t.closest("[data-hfollow]");
    if (hf) { e.preventDefault(); followBtn(hf); return; }
    var cat = t.closest("#homeMarketChips [data-cat]");
    if (cat) { S.market.cat = cat.getAttribute("data-cat") || null; renderCats(); startMarket(true); return; }
    var card = t.closest(".bfm-card");
    var mact = t.closest("[data-mact]");
    if (card && mact) {
      var l = S.market.list[card.getAttribute("data-listing")];
      if (!l) return;
      var k = mact.getAttribute("data-mact");
      if (k === "like" || k === "save") react(card, l, k, mact);
      else if (k === "share") shareListing(card, l);
      else if (k === "buy") buyListing(card, l, mact);
      else if (k === "ask") askSeller(card, l, mact);
      return;
    }
    var sc = t.closest("#homeSearch [data-scope]");
    if (sc) { setScope(sc.getAttribute("data-scope")); runSearch($("homeSearchInput").value, S.search.scope); return; }
    var sa = t.closest("[data-seeall]");
    if (sa) { setScope(sa.getAttribute("data-seeall")); runSearch($("homeSearchInput").value, S.search.scope); return; }
    var more = t.closest("#homeSearchMore");
    if (more) { more.disabled = true; runSearch(S.search.q, S.search.scope, false, more.getAttribute("data-cursor")); return; }
    var rc = t.closest("[data-recent]");
    if (rc) { var input = $("homeSearchInput"); input.value = rc.getAttribute("data-recent"); $("homeSearchClear").hidden = false; runSearch(input.value, S.search.scope, true); return; }
    if (t.closest("#homeRecentClear")) { keepRecent(null); showRecent(); return; }
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !$("homeSheet").hidden) { e.preventDefault(); closeSheet(); }
  });
  window.addEventListener("resize", function () {
    var list = $("homeMarketList");
    if (list && Object.keys(S.market.list).length) list.classList.toggle("is-full", phone());
    syncFull();
  });

  function init() {
    addStyle();
    var start = /[?&]post=/.test(window.location.search) ? "following" : keptTab();
    S.tab = TABS.indexOf(start) !== -1 ? start : "following";
    setTab(S.tab, true);
    loadState();
  }
  window.BFHomeTabs = { TABS: TABS, TAB_KEY: TAB_KEY, RECENT_KEY: RECENT_KEY, RECENT_MAX: RECENT_MAX, REACH_WORDS: REACH_WORDS, TEXT: TEXT,
    setTab: setTab, active: function () { return S.tab; }, isFull: isFull, syncFull: syncFull, followingFirst: followingFirst,
    openSearch: openSearch, closeSearch: closeSearch, openChange: openChange, closeSheet: closeSheet, recent: recent };
  init();
})();

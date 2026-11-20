/* ══════════════════════════════════════════════════════════════════════════
   bf-profile-shell.js — the profile page's app header (P2-1, Nov 19 2026).

   profile.html loads this; it fills #pfShell, under the page's own header.
   From records that exist today, never placeholders:

     @handle          bf_profiles.username (the /@handle address)
     Sales            the member's completed marketplace sales
                      (GET /api/bfp/profile/me/stats, or /:id/stats for a
                      visitor while the page is public)
     BizCash          the member's own balance: ONLY on the owner's own view
     Edit profile     the owner's: the page's own edit mode (toggleEditMode)
     Share profile    the device's share sheet with bizforceai.net/@handle,
                      else the link is copied
     Wallet           the owner's: wallet.html
     bio, storefront  the bio, and a link to the storefront (/@handle)
     Posts            an empty state: posts arrive in P2-3
     Shop, Services   the member's active listings by listing_kind, three to a
                      row, each opening its listing page

   Following, Followers and Reviews are NOT shown: they do not exist yet
   (P2-3, P2-7), and a zero would claim they do. On a desktop the block sits
   between the page's header and its sections and the bio line is left to
   the About section; on a phone (max-width 760px) it is the page's header.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var host = document.getElementById("pfShell");
  if (!host || window.BFProfileShell) return;
  var API = (typeof window.API_URL === "string" && window.API_URL) || "https://dynamic-prosperity-production-5382.up.railway.app";
  var ORIGIN = "https://bizforceai.net";
  var token = null;
  try { token = localStorage.getItem("bf_token"); } catch (e) { token = null; }
  var params = new URLSearchParams(window.location.search);
  var me = null;
  try { me = token ? JSON.parse(atob(token.split(".")[1])).id : null; } catch (e) { me = null; }
  var viewId = params.get("id") || me;
  var owner = !!me && viewId === me && params.get("bf_preview") !== "1";
  var state = { profile: null, stats: null, shop: [], services: [], tab: "posts", listingsLoaded: false, listingsFailed: false };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function safeUrl(u) { return typeof u === "string" && /^(https:\/\/|\/)/.test(u) && !/^\/\//.test(u) ? u : ""; }
  function get(path, auth) {
    var h = {};
    if (auth && token) h.Authorization = "Bearer " + token;
    return fetch(API + path, { headers: h }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function svg(paths, size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }

  var CSS = [
    "#pfShell{position:relative;z-index:1;max-width:1100px;margin:0 auto 8px;padding:0 24px}",
    "#pfShell:empty{display:none}",
    ".pfs{display:flex;flex-direction:column;gap:14px;padding:18px 20px;border-radius:18px;background:rgba(10,15,35,.82);border:1px solid rgba(255,255,255,.08)}",
    ".pfs-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap}",
    ".pfs-handle{margin:0;font-size:.95rem;color:#a9b3cc;overflow-wrap:anywhere}",
    ".pfs-stats{display:flex;gap:24px;margin:0;padding:0;list-style:none}",
    ".pfs-stat{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:56px}",
    ".pfs-num{font-size:1.15rem;font-weight:800;color:#f4f7ff}",
    ".pfs-num.is-bfc{color:#f5c46b}",
    ".pfs-lab{font-size:.75rem;color:#a9b3cc}",
    ".pfs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}",
    ".pfs-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;min-width:44px;padding:0 16px;border-radius:12px;border:0;",
    "background:rgba(26,34,68,.95);color:#e8e8ff;font:600 .88rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;text-decoration:none;cursor:pointer}",
    ".pfs-btn.is-wallet{background:rgba(42,36,16,.95);color:#f5c46b;padding:0 12px}",
    ".pfs-note{margin:0;font-size:.82rem;color:#6ee7b7}",
    ".pfs-bio{display:none;margin:0;font-size:.9rem;line-height:1.45;color:#c9d1e6;text-align:center}",
    ".pfs-store{display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--bf-accent-a, #22d3ee);font-size:.88rem;font-weight:700;text-decoration:none}",
    ".pfs-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.1)}",
    ".pfs-tab{flex:1 1 0;min-height:44px;border:0;border-bottom:2px solid transparent;background:transparent;color:#a9b3cc;font:600 .9rem system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer}",
    ".pfs-tab[aria-selected=true]{color:#fff;border-bottom-color:var(--bf-accent-a, #22d3ee)}",
    ".pfs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0;padding:0;list-style:none}",
    ".pfs-cell{position:relative;display:block;aspect-ratio:3/4;border-radius:8px;overflow:hidden;background:#121a36;color:#e8e8ff;text-decoration:none}",
    ".pfs-cell img{display:block;width:100%;height:100%;object-fit:cover}",
    ".pfs-cell-cap{position:absolute;left:0;right:0;bottom:0;padding:6px 8px;background:linear-gradient(transparent,rgba(5,7,15,.92));font-size:.75rem;line-height:1.3}",
    ".pfs-cell-name{display:block;font-weight:700;overflow-wrap:anywhere}",
    ".pfs-cell-price{display:block;color:#34d399;font-weight:800}",
    ".pfs-empty{margin:0;padding:22px 8px;text-align:center;color:#8892b8;font-size:.88rem;line-height:1.55}",
    "@media (max-width: 760px){",
    "#pfShell{padding:0 16px;margin-top:8px}",
    ".pfs{padding:14px;align-items:stretch}",
    ".pfs-top{flex-direction:column;align-items:center;gap:10px}",
    ".pfs-handle{text-align:center}",
    ".pfs-stats{width:100%;justify-content:space-around;gap:8px}",
    ".pfs-actions{width:100%;margin-left:0;flex-wrap:nowrap}",
    ".pfs-actions .pfs-btn{flex:1 1 0;padding:0 8px}",
    ".pfs-actions .pfs-btn.is-wallet{flex:0 0 44px}",
    ".pfs-bio{display:block}",
    ".pfs-store{align-self:center}",
    "}"
  ].join("");

  function counts() {
    var s = state.stats || {};
    var out = [];
    if (typeof s.sales === "number") out.push('<li class="pfs-stat"><span class="pfs-num">' + s.sales.toLocaleString("en-US") + '</span><span class="pfs-lab">Sales</span></li>');
    if (owner && typeof s.bizcash === "number") out.push('<li class="pfs-stat"><span class="pfs-num is-bfc">' + s.bizcash.toLocaleString("en-US") + '</span><span class="pfs-lab">BizCash</span></li>');
    return out.length ? '<ul class="pfs-stats" aria-label="Counts">' + out.join("") + '</ul>' : "";
  }

  function tiles(list, empty) {
    if (state.listingsFailed) return '<p class="pfs-empty">These could not be loaded just now. This is not a statement that there are none.</p>';
    if (!state.listingsLoaded) return '<p class="pfs-empty">Loading...</p>';
    if (!list.length) return '<p class="pfs-empty">' + empty + '</p>';
    return '<ul class="pfs-grid">' + list.map(function (l) {
      var img = safeUrl(l.image_url) ? '<img src="' + esc(l.image_url) + '" alt="" loading="lazy">' : "";
      return '<li><a class="pfs-cell" href="/listing/' + encodeURIComponent(l.slug || l.id) + '">' + img +
        '<span class="pfs-cell-cap"><span class="pfs-cell-name">' + esc(l.name) + '</span>' +
        (l.price ? '<span class="pfs-cell-price">' + Number(l.price).toLocaleString("en-US") + ' BFC</span>' : "") + '</span></a></li>';
    }).join("") + '</ul>';
  }

  function panel() {
    if (state.tab === "shop") return tiles(state.shop, owner ? "You have no products listed. Use Create to list one." : "No products listed.");
    if (state.tab === "services") return tiles(state.services, owner ? "You have no services listed. Use Create to offer one." : "No services listed.");
    return '<p class="pfs-empty">' + (owner ? "Your posts will show here. Posts are coming soon." : "Posts are coming soon.") + '</p>';
  }

  function render() {
    var p = state.profile || {};
    var handle = p.username || "";
    var bio = String(p.bio || "").trim();
    var tabs = [["posts", "Posts"], ["shop", "Shop"], ["services", "Services"]];
    host.innerHTML = '<section class="pfs" aria-label="Profile">' +
      '<div class="pfs-top">' +
        '<p class="pfs-handle">' + (handle ? "@" + esc(handle) + " &middot; BizForce member" : (owner ? "No handle yet. Choose one in Edit profile." : "BizForce member")) + '</p>' +
        counts() +
        '<div class="pfs-actions">' +
          (owner ? '<button type="button" class="pfs-btn" id="pfsEdit">Edit profile</button>' : "") +
          (handle ? '<button type="button" class="pfs-btn" id="pfsShare">Share profile</button>' : "") +
          (owner ? '<a class="pfs-btn is-wallet" href="wallet.html" aria-label="Wallet">' + svg('<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4M12 7.5v9"/>', 20) + '</a>' : "") +
        '</div>' +
      '</div>' +
      '<p class="pfs-note" id="pfsNote" role="status" hidden></p>' +
      (bio ? '<p class="pfs-bio">' + esc(bio.length > 220 ? bio.slice(0, 217) + "..." : bio) + '</p>' : "") +
      (handle ? '<a class="pfs-store" href="/@' + encodeURIComponent(handle) + '">' + svg('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', 16) + (owner ? "Visit my storefront" : "Visit storefront") + '</a>' : "") +
      '<div class="pfs-tabs" role="tablist" aria-label="Profile content">' + tabs.map(function (t) {
        return '<button type="button" class="pfs-tab" role="tab" id="pfs-tab-' + t[0] + '" data-pfs-tab="' + t[0] + '" aria-controls="pfsPanel" aria-selected="' + (state.tab === t[0]) + '" tabindex="' + (state.tab === t[0] ? 0 : -1) + '">' + t[1] + '</button>';
      }).join("") + '</div>' +
      '<div id="pfsPanel" role="tabpanel" aria-labelledby="pfs-tab-' + state.tab + '">' + panel() + '</div>' +
    '</section>';
    var edit = document.getElementById("pfsEdit");
    if (edit) edit.addEventListener("click", function () {
      if (typeof window.toggleEditMode === "function") window.toggleEditMode();
      var top = document.querySelector(".pf-header-wrap");
      if (top && top.scrollIntoView) top.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    var share = document.getElementById("pfsShare");
    if (share) share.addEventListener("click", function () { shareProfile(handle, p.display_name); });
  }

  function note(text) {
    var n = document.getElementById("pfsNote");
    if (!n) return;
    n.textContent = text;
    n.hidden = false;
    setTimeout(function () { n.hidden = true; }, 4000);
  }
  function shareProfile(handle, name) {
    var url = ORIGIN + "/@" + handle;
    if (navigator.share) {
      navigator.share({ title: (name || "@" + handle) + " on BizForce", url: url }).catch(function () { /* closed */ });
      return;
    }
    var done = function () { note("Link copied: " + url); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { note(url); });
    else note(url);
  }

  host.addEventListener("click", function (e) {
    var t = e.target.closest("[data-pfs-tab]");
    if (!t) return;
    state.tab = t.getAttribute("data-pfs-tab");
    render();
    var again = document.getElementById("pfs-tab-" + state.tab);
    if (again) again.focus();
  });
  host.addEventListener("keydown", function (e) {
    if ((e.key !== "ArrowRight" && e.key !== "ArrowLeft") || !e.target.closest("[data-pfs-tab]")) return;
    var order = ["posts", "shop", "services"];
    var i = order.indexOf(state.tab) + (e.key === "ArrowRight" ? 1 : -1);
    state.tab = order[(i + order.length) % order.length];
    render();
    document.getElementById("pfs-tab-" + state.tab).focus();
  });

  function mine(rows) {
    var active = (rows || []).filter(function (l) { return l.status === "active"; });
    var map = function (l) {
      var media = Array.isArray(l.media) ? l.media : [];
      return { id: l.id, slug: l.slug || null, name: l.title, image_url: media[0] && media[0].url ? media[0].url : null, price: Number(l.price_bfc) > 0 ? Number(l.price_bfc) : null };
    };
    state.shop = active.filter(function (l) { return l.listing_kind !== "service"; }).map(map);
    state.services = active.filter(function (l) { return l.listing_kind === "service"; }).map(map);
  }

  function start() {
    var st = document.createElement("style");
    st.id = "bf-profile-shell-style";
    st.textContent = CSS;
    document.head.appendChild(st);
    if (!viewId) return;
    render();
    var profileReq = owner ? get("/api/bfp/profile/me", true) : get("/api/bfp/profile/" + encodeURIComponent(viewId), false);
    var statsReq = owner ? get("/api/bfp/profile/me/stats", true).then(function (d) { return d; })
      : get("/api/bfp/profile/" + encodeURIComponent(viewId) + "/stats", false).then(function (d) { return d.stats || null; });
    profileReq.then(function (d) { state.profile = d.profile || null; render(); return state.profile; })
      .then(function (p) {
        if (owner) return get("/api/marketplace/my-listings", true).then(function (d) { mine(d.listings); });
        if (p && p.username) return get("/api/bfp/seller/" + encodeURIComponent(p.username), false).then(function (d) { state.shop = d.products || []; state.services = d.services || []; });
        return null;
      })
      .then(function () { state.listingsLoaded = true; render(); })
      .catch(function () { state.listingsLoaded = true; state.listingsFailed = true; render(); });
    statsReq.then(function (s) { state.stats = s; render(); }).catch(function () { /* no counts: nothing is claimed */ });
  }

  window.BFProfileShell = { render: render, state: state, owner: owner };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

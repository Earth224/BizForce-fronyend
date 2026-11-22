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
     Posts            NAMED (Nov 20 2026, P2-3): the member's posts, three to a
                      row (GET /api/posts/by/:id): each photo post's first
                      thumbnail, a text post as a text tile; each opens the
                      post (home.html?post=<id>, or /p/<id> signed out)
     Saved            NAMED (Nov 20 2026, P2-3): the owner's only, private
                      (GET /api/posts/saved)
     Followers,       NAMED (Nov 20 2026, P2-3): the counts
     Following        (GET /api/follows/:id/counts); each opens its list
                      (GET /api/follows/:id/followers|following, blocks
                      respected; signed out, sign in first)
     Follow           NAMED (Nov 20 2026, P2-3): a signed-in visitor's Follow
                      or Following (POST /api/follows, DELETE /api/follows/:id)
     Shop, Services   the member's active listings by listing_kind, three to a
                      row, each opening its listing page

   Reviews are NOT shown: they do not exist yet (P2-7), and a zero would
   claim they do. BEFORE (P2-1) Following and Followers were not shown either. On a desktop the block sits
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
  var state = { profile: null, stats: null, shop: [], services: [], tab: "posts", listingsLoaded: false, listingsFailed: false,
    // NAMED (Nov 20 2026, P2-3)
    posts: null, postsFailed: false, saved: null, savedFailed: false, follows: null,
    // NAMED (Nov 20 2026, FX1): whether the owner is a paid member (GET /api/auth/me access.active); null until known
    member: null };

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  /* NAMED (Nov 21 2026, P3-2): the Verified badge (scripts/bf-verified.js), inside a name after its text; "" for null */
  function vb(reason) { return window.bfVerified ? window.bfVerified.html(reason) : ""; }
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
    /* NAMED (Nov 20 2026, P2-3): post tiles, the follow counts and their lists, the Follow button */
    ".pfs-cell.is-text{display:flex;align-items:center;justify-content:center;padding:10px;background:linear-gradient(135deg,#12204a,#2a1650);font-size:.78rem;font-weight:700;line-height:1.35;text-align:center;overflow:hidden}",
    ".pfs-cell.is-text span{display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}",
    ".pfs-cell-badge{position:absolute;top:6px;right:6px;padding:2px 6px;border-radius:8px;background:rgba(0,0,0,.6);font-size:.68rem;font-weight:800;color:#fff}",
    ".pfs-stat.is-link{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;min-height:44px;padding:0;border-radius:10px}",
    ".pfs-stat.is-link:hover .pfs-lab,.pfs-stat.is-link:focus-visible .pfs-lab{color:#fff;text-decoration:underline}",
    ".pfs-btn.is-follow{background:linear-gradient(90deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6));color:#070b18;font-weight:800}",
    ".pfs-btn.is-follow.is-on{background:rgba(26,34,68,.95);color:#e8e8ff}",
    "#pfs-people-back{position:fixed;inset:0;z-index:2147483150;background:rgba(2,4,12,.6)}",
    "#pfs-people{position:fixed;z-index:2147483151;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow-y:auto;box-sizing:border-box;",
    "padding:18px;border-radius:20px;background:#0b1022;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);color:#e8e8ff;display:flex;flex-direction:column;gap:12px}",
    "#pfs-people[hidden],#pfs-people-back[hidden]{display:none}",
    "#pfs-people h2{flex:1;margin:0;font-size:1.1rem;font-weight:800;color:#f4f7ff}",
    ".pfs-ph{display:flex;align-items:center;gap:10px}",
    ".pfs-x{width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#e8e8ff;cursor:pointer}",
    ".pfs-people{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}",
    ".pfs-person{display:flex;align-items:center;gap:10px;min-height:52px;color:#e8e8ff;text-decoration:none}",
    ".pfs-person img,.pfs-person .av{width:40px;height:40px;border-radius:20px;object-fit:cover;background:#1b2447;display:flex;align-items:center;justify-content:center;font-weight:800;flex:none}",
    ".pfs-person span{display:flex;flex-direction:column;min-width:0;overflow-wrap:anywhere}",
    ".pfs-person small{color:#8892b8}",
    /* NAMED (Nov 20 2026, FX1): the phone header's own parts; a desktop shows none of them, as before */
    ".pfs-bar,.pfs-pic,.pfs-msg,.pfs-tab.is-reviews,.pfs-cell-label,.pfs-saved-head{display:none}",
    /* NAMED (Nov 21 2026, FX2): the phone header's optional banner and its edit row; a desktop shows neither (its page has its own banner) */
    ".pfs-banner,.pfs-banner-edit{display:none}",
    "#pfs-menu-back{position:fixed;inset:0;z-index:2147483150;background:rgba(2,4,12,.6)}",
    "#pfs-menu{position:fixed;z-index:2147483151;left:0;right:0;bottom:0;box-sizing:border-box;padding:16px 16px calc(16px + env(safe-area-inset-bottom, 0px));border-radius:22px 22px 0 0;",
    "background:#0b1022;border-top:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);color:#e8e8ff;display:flex;flex-direction:column;gap:8px;font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    "#pfs-menu[hidden],#pfs-menu-back[hidden]{display:none}",
    "#pfs-menu h2{flex:1;margin:0;font-size:1.1rem;font-weight:800;color:#f4f7ff}",
    ".pfs-menu-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column}",
    ".pfs-menu-item{display:flex;align-items:center;width:100%;min-height:48px;padding:0 4px;border:0;border-bottom:1px solid rgba(255,255,255,.06);background:transparent;color:#e6eaf5;",
    "font:600 15px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;text-align:left;text-decoration:none;cursor:pointer}",
    /* NAMED (Nov 20 2026, FX1): a phone's header is the approved design (backend scripts/designSpec.js PROFILE): the top row 12 px
       down (44 px icons, the name centred, 17 px bold); the 92 px picture with a 3 px cyan-to-violet ring, 10 px below; the
       handle (15 px, muted); the four counts evenly spread (18 px bold over 12 px); Edit profile and Share profile (44 px,
       radius 12, #1a2244, 14 px semibold) and the 44 px gold wallet; the bio (14 px, centred); Visit my storefront; the four
       tabs across the whole width (44 px, a 2 px cyan underline, a 1 px divider); the grid, 3 across, 2 px apart, 3:4 tiles.
       The page's own header (its nav buttons, banner, picture and name) is hidden there while not editing; the menu holds
       its links. The Guide's button is not on this screen (the design has none). */
    "@media (max-width: 760px){",
    "#pfShell{padding:0;margin:0;max-width:none}",
    "body:not(.edit-mode) .pf-nav,body:not(.edit-mode) .pf-banner,body:not(.edit-mode) .pf-header-wrap{display:none}",
    "#tmx-guide-fab{display:none}",
    ".pfs{gap:0;padding:0;border:0;border-radius:0;background:transparent;align-items:stretch}",
    /* NAMED (Nov 21 2026, FX2): BEFORE margin-top:calc(12px + env(safe-area-inset-top, 0px)). css/bf-phone.css already pads the page
       (html) by the safe area on a page with no top bar, as this one, so on a phone with a notch the row sat a second safe area
       low (the owner's screenshot: about 47 pt). AFTER 12 px below the safe area, as in the pictures. */
    ".pfs-bar{display:flex;align-items:center;height:44px;margin-top:12px;padding:0 12px}",
    ".pfs-icon{flex:none;width:44px;height:44px;padding:0;border:0;border-radius:22px;background:transparent;color:#e6eaf5;display:flex;align-items:center;justify-content:center;cursor:pointer}",
    ".pfs-title{flex:1;min-width:0;margin:0;text-align:center;font:800 17px/1.25 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;color:#e6eaf5;overflow-wrap:anywhere}",
    ".pfs-pic{display:flex;justify-content:center;margin-top:10px}",
    /* NAMED (Nov 21 2026, FX2): BEFORE linear-gradient(180deg, ...); AFTER 135deg: teal at the top left to purple at the bottom right */
    ".pfs-av{display:block;width:92px;height:92px;box-sizing:border-box;padding:3px;border-radius:50%;background:linear-gradient(135deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6))}",
    ".pfs-av-in{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;overflow:hidden;background:#121a36;color:#e6eaf5;font:800 28px/1 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".pfs-av-in img{width:100%;height:100%;object-fit:cover}",
    ".pfs-top{flex-direction:column;align-items:stretch;gap:0;padding:0 16px}",
    ".pfs-handle{margin:8px 0 0;font-size:15px;line-height:20px;color:#a9b3cc;text-align:center}",
    ".pfs-handle:empty{display:none}",
    ".pfs-stats{display:flex;width:100%;gap:0;margin:13px 0 0}",
    ".pfs-stats>li{flex:1 1 0;min-width:0;display:flex;justify-content:center}",
    ".pfs-k-following{order:1}.pfs-k-followers{order:2}.pfs-k-sales{order:3}.pfs-k-bizcash{order:4}",
    ".pfs-stat{gap:0;min-width:0}",
    ".pfs-stat.is-link{min-height:44px;margin:-3px 0;justify-content:center}",
    ".pfs-num{font-size:18px;line-height:22px;font-weight:800;color:#e6eaf5}",
    ".pfs-num.is-bfc{color:#f5c46b}",
    ".pfs-lab{font-size:12px;line-height:16px;color:#a9b3cc}",
    ".pfs-actions{width:100%;margin:16px 0 0;flex-wrap:nowrap;gap:8px}",
    ".pfs-actions .pfs-btn{flex:1 1 0;height:44px;padding:0 8px;border-radius:12px;background:#1a2244;color:#e6eaf5;font:600 14px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".pfs-actions .pfs-btn.is-follow{background:linear-gradient(90deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #8b5cf6));color:#070b18}",
    ".pfs-actions .pfs-btn.is-follow.is-on{background:#1a2244;color:#e6eaf5}",
    ".pfs-actions .pfs-btn.is-wallet{flex:0 0 44px;width:44px;padding:0;background:#2a2410;color:#f5c46b}",
    ".pfs-msg{display:inline-flex}",
    ".pfs-share-v{display:none}",
    ".pfs-note{margin:8px 16px 0}",
    ".pfs-bio{display:block;margin:9px 0 0;padding:0 16px;font-size:14px;line-height:20px;color:#c9d1e6}",
    ".pfs-store{align-self:center;min-height:44px;margin-top:3px;font-size:14px;font-weight:600}",
    ".pfs-tabs{margin:0;border-bottom:1px solid #1e2848}",
    ".pfs-tab{height:44px;border-bottom-width:2px;color:#a9b3cc;font:600 15px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    ".pfs-tab[aria-selected=true]{color:#fff;font-weight:700}",
    ".pfs-tab.is-saved{display:none}",
    ".pfs-tab.is-reviews{display:block}",
    "#pfsPanel{padding:2px 2px 0}",
    ".pfs-grid{gap:2px}",
    ".pfs-cell{border-radius:4px;background:#131e45}",
    ".pfs-cell .pfs-cell-label,.pfs-cell.is-text .pfs-cell-label{display:block;position:absolute;left:6px;bottom:6px;right:6px;padding:0;-webkit-line-clamp:none;font:600 11px/1.3 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;color:#c9d1e6;text-align:left;text-shadow:0 1px 2px rgba(0,0,0,.8);white-space:nowrap}",
    ".pfs-saved-head{display:block;margin:0;padding:10px 14px;font-size:13px;color:#a9b3cc}",
    ".pfs-empty{padding:22px 16px}",
    /* NAMED (Nov 21 2026, FX2): THE OPTIONAL BANNER (profile-banner.png; none is profile.png). The member's photo fills behind the
       top, from the screen's top (the safe area too) down to the picture's bottom edge (12 + 44 + 10 + 92 = 158 px below the
       safe area, just above the @handle line), cover-cropped; it fades into the page's own background over its lower part.
       A light shade at the top keeps the top row readable over any photo. Hidden while editing (the page's banner shows). */
    ".pfs{position:relative}",
    ".pfs-banner{display:block;position:absolute;left:0;right:0;top:calc(-1 * env(safe-area-inset-top, 0px));height:calc(158px + env(safe-area-inset-top, 0px));z-index:0;overflow:hidden;pointer-events:none;",
    "-webkit-mask-image:linear-gradient(#000 0,#000 50%,rgba(0,0,0,.55) 75%,transparent 100%);mask-image:linear-gradient(#000 0,#000 50%,rgba(0,0,0,.55) 75%,transparent 100%)}",
    ".pfs-banner img{display:block;width:100%;height:100%;object-fit:cover}",
    ".pfs-banner::after{content:\"\";position:absolute;left:0;right:0;top:0;height:calc(72px + env(safe-area-inset-top, 0px));background:linear-gradient(rgba(5,7,15,.5),rgba(5,7,15,0))}",
    ".pfs.has-banner>:not(.pfs-banner){position:relative;z-index:1}",
    ".pfs.has-banner .pfs-title{text-shadow:0 1px 3px rgba(0,0,0,.85)}",
    ".pfs.has-banner .pfs-icon svg{filter:drop-shadow(0 1px 2px rgba(0,0,0,.8))}",
    "body.edit-mode .pfs-banner{display:none}",
    "body.edit-mode .pfs-banner-edit{display:flex;gap:8px;margin:10px 16px 0}",
    ".pfs-banner-edit .pfs-btn{flex:1 1 0;height:44px;padding:0 8px;border-radius:12px;background:#1a2244;color:#e6eaf5;font:600 14px system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif}",
    "}"
  ].join("");

  /* NAMED (Nov 20 2026, FX1): each count's item carries its name (pfs-k-<name>), so a phone puts them in the approved design's
     order (Following, Followers, Sales, BizCash) while a desktop keeps this one. BizCash is the owner's own, and only a paid
     member's (the owner's decision: sending BizCash is for paid members); BEFORE it showed to every owner. */
  function counts() {
    var s = state.stats || {};
    var out = [];
    if (typeof s.sales === "number") out.push('<li class="pfs-stat pfs-k-sales"><span class="pfs-num">' + s.sales.toLocaleString("en-US") + '</span><span class="pfs-lab">Sales</span></li>');
    if (owner && state.member === true && typeof s.bizcash === "number") out.push('<li class="pfs-stat pfs-k-bizcash"><span class="pfs-num is-bfc">' + s.bizcash.toLocaleString("en-US") + '</span><span class="pfs-lab">BizCash</span></li>');
    // NAMED (Nov 20 2026, P2-3): Followers and Following, each opening its list
    var f = state.follows;
    if (f && typeof f.followers === "number") {
      out.push('<li class="pfs-k-followers"><button type="button" class="pfs-stat is-link" data-pfs-people="followers"><span class="pfs-num">' + f.followers.toLocaleString("en-US") + '</span><span class="pfs-lab">Followers</span></button></li>');
      out.push('<li class="pfs-k-following"><button type="button" class="pfs-stat is-link" data-pfs-people="following"><span class="pfs-num">' + f.following.toLocaleString("en-US") + '</span><span class="pfs-lab">Following</span></button></li>');
    }
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

  /* NAMED (Nov 20 2026, P2-3): post tiles. A photo post shows its first thumbnail; a text post its first words. */
  function postTiles(list, failed, empty) {
    if (failed) return '<p class="pfs-empty">These could not be loaded just now. This is not a statement that there are none.</p>';
    if (!list) return '<p class="pfs-empty">Loading...</p>';
    if (!list.length) return '<p class="pfs-empty">' + empty + '</p>';
    return '<ul class="pfs-grid">' + list.map(function (p) {
      var href = token ? "/home.html?post=" + encodeURIComponent(p.id) : "/p/" + encodeURIComponent(p.id);
      var ph = (p.photos || [])[0];
      var badge = p.status === "pending" ? '<span class="pfs-cell-badge">In review</span>' : (p.photos || []).length > 1 ? '<span class="pfs-cell-badge">' + p.photos.length + '</span>' : "";
      // NAMED (Nov 20 2026, FX1): the approved design's small label at a tile's bottom left (a phone only): what the post is
      if (ph && safeUrl(ph.thumb_url)) return '<li><a class="pfs-cell" data-post-tile="' + esc(p.id) + '" href="' + href + '"><img src="' + esc(ph.thumb_url) + '" alt="' + esc(ph.alt || "") + '" loading="lazy">' + badge + '<span class="pfs-cell-label" aria-hidden="true">Photo</span></a></li>';
      return '<li><a class="pfs-cell is-text" data-post-tile="' + esc(p.id) + '" href="' + href + '"><span>' + esc(String(p.body || "").slice(0, 160)) + '</span>' + badge + '<span class="pfs-cell-label" aria-hidden="true">Post</span></a></li>';
    }).join("") + '</ul>';
  }

  function panel() {
    if (state.tab === "shop") return tiles(state.shop, owner ? "You have no products listed. Use Create to list one." : "No products listed.");
    if (state.tab === "services") return tiles(state.services, owner ? "You have no services listed. Use Create to offer one." : "No services listed.");
    if (state.tab === "saved") return '<p class="pfs-saved-head">Saved posts. Only you can see them.</p>' + postTiles(state.saved, state.savedFailed, "Posts you save show here. Only you can see them.");
    return postTiles(state.posts, state.postsFailed, owner ? "Your posts show here. Use Create, then Post." : "No posts yet.");
  }

  function render() {
    var p = state.profile || {};
    var handle = p.username || "";
    var bio = String(p.bio || "").trim();
    var tabs = [["posts", "Posts"], ["shop", "Shop"], ["services", "Services"]];
    if (owner) tabs.push(["saved", "Saved"]);   // NAMED (Nov 20 2026, P2-3): private
    tabs.push(["reviews", "Reviews"]);   // NAMED (Nov 20 2026, FX1): a phone's fourth tab; reviews arrive in P2-7 (Coming soon)
    var f = state.follows;
    var followBtn = !owner && me && f && !f.self ? '<button type="button" class="pfs-btn is-follow' + (f.i_follow ? " is-on" : "") + '" id="pfsFollow" aria-pressed="' + !!f.i_follow + '">' + (f.i_follow ? "Following" : "Follow") + '</button>' : "";
    /* NAMED (Nov 20 2026, FX1): the approved design's phone header (backend scripts/designSpec.js PROFILE): the top row (add
       friends, the name, the menu) and the 92 px picture are a phone's only; "BizForce member" and the gold wallet only for a
       paid member (the owner: GET /api/auth/me; a visitor: the profile's own member flag, and while there is none, every
       public profile is a paid member's, as ownerPagePublic serves only theirs); a visitor's Message beside Follow. */
    // NAMED (Nov 20 2026, P3-1): BEFORE a visitor read p.member !== false (every public page was a paid member's). AFTER free
    // accounts have public pages too: the profile answer's own member flag (ownerIsMember), shown only when true.
    var paid = owner ? state.member === true : state.visitorMember === true;
    var name = String(p.display_name || (handle ? "@" + handle : "")).trim();
    var pic = safeUrl(p.avatar_url) ? '<img src="' + esc(p.avatar_url) + '" alt="">' : '<span aria-hidden="true">' + esc(initialsOf(name || handle)) + '</span>';
    var msgBtn = !owner && me && viewId && viewId !== me ? '<a class="pfs-btn pfs-msg" id="pfsMessage" href="/inbox.html?with=' + encodeURIComponent(viewId) + '">Message</a>' : "";
    /* NAMED (Nov 21 2026, FX2): the optional banner (bf_profiles.banner_url), and on a phone in Edit profile the owner's banner row:
       Add banner (or Change banner) opens the page's own banner upload (#fi-banner: storage per account counts it), and
       Remove banner clears it (PUT /api/bfp/profile/me banner_url null). */
    var banner = safeUrl(p.banner_url);
    var bannerEdit = owner && document.getElementById("fi-banner") ? '<div class="pfs-banner-edit">' +
      '<button type="button" class="pfs-btn" id="pfsBannerPick">' + (banner ? "Change banner" : "Add banner") + '</button>' +
      (banner ? '<button type="button" class="pfs-btn" id="pfsBannerRemove">Remove banner</button>' : "") + '</div>' : "";
    host.innerHTML = '<section class="pfs' + (banner ? " has-banner" : "") + '" aria-label="Profile">' +
      (banner ? '<div class="pfs-banner" aria-hidden="true"><img src="' + esc(banner) + '" alt=""></div>' : "") +
      '<div class="pfs-bar">' +
        '<button type="button" class="pfs-icon" id="pfsInvite" aria-label="' + (owner ? "Invite friends" : "Share this profile with friends") + '">' +
          svg('<circle cx="9" cy="8" r="4"/><path d="M2 21c.8-4 3.6-6 7-6s6.2 2 7 6M19 8v6M16 11h6"/>', 24) + '</button>' +
        '<h2 class="pfs-title">' + esc(name) + vb(state.verified) + '</h2>' +
        '<button type="button" class="pfs-icon" id="pfsMenu" aria-label="Menu" aria-haspopup="dialog">' + svg('<path d="M4 7h16M4 12h16M4 17h16"/>', 24) + '</button>' +
      '</div>' +
      '<div class="pfs-pic"><span class="pfs-av"><span class="pfs-av-in">' + pic + '</span></span></div>' +
      '<div class="pfs-top">' +
        '<p class="pfs-handle">' + (handle ? "@" + esc(handle) + (paid ? " &middot; BizForce member" : "") : (owner ? "No handle yet. Choose one in Edit profile." : (paid ? "BizForce member" : ""))) + '</p>' +
        counts() +
        '<div class="pfs-actions">' + followBtn + msgBtn +
          (owner ? '<button type="button" class="pfs-btn" id="pfsEdit">Edit profile</button>' : "") +
          (handle ? '<button type="button" class="pfs-btn' + (owner ? "" : " pfs-share-v") + '" id="pfsShare">Share profile</button>' : "") +
          (owner && paid ? '<a class="pfs-btn is-wallet" href="wallet.html" aria-label="Wallet">' + svg('<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4M12 7.5v9"/>', 20) + '</a>' : "") +
        '</div>' +
      '</div>' +
      bannerEdit +
      '<p class="pfs-note" id="pfsNote" role="status" hidden></p>' +
      (bio ? '<p class="pfs-bio">' + esc(bio.length > 220 ? bio.slice(0, 217) + "..." : bio) + '</p>' : "") +
      (handle ? '<a class="pfs-store" href="/@' + encodeURIComponent(handle) + '">' + svg('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>', 16) + (owner ? "Visit my storefront" : "Visit storefront") + '</a>' : "") +
      '<div class="pfs-tabs" role="tablist" aria-label="Profile content">' + tabs.map(function (t) {
        return '<button type="button" class="pfs-tab is-' + t[0] + '" role="tab" id="pfs-tab-' + t[0] + '" data-pfs-tab="' + t[0] + '" aria-controls="pfsPanel" aria-selected="' + (state.tab === t[0]) + '" tabindex="' + (state.tab === t[0] ? 0 : -1) + '">' + t[1] + '</button>';
      }).join("") + '</div>' +
      '<div id="pfsPanel" role="tabpanel" aria-labelledby="pfs-tab-' + state.tab + '">' + panel() + '</div>' +
    '</section>';
    var edit = document.getElementById("pfsEdit");
    if (edit) edit.addEventListener("click", function () {
      if (typeof window.toggleEditMode === "function") window.toggleEditMode();
      var top = document.querySelector(".pf-header-wrap");
      if (top && top.scrollIntoView) top.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    var fb = document.getElementById("pfsFollow");
    if (fb) fb.addEventListener("click", toggleFollow);
    var share = document.getElementById("pfsShare");
    if (share) share.addEventListener("click", function () { shareProfile(handle, p.display_name); });
    // NAMED (Nov 20 2026, FX1): the phone header's two icons
    var invite = document.getElementById("pfsInvite");
    if (invite) invite.addEventListener("click", function () { if (handle) shareProfile(handle, p.display_name); else note("Choose a handle in Edit profile first, then share it."); });
    var menu = document.getElementById("pfsMenu");
    if (menu) menu.addEventListener("click", function () { openMenu(menu, p); });
    // NAMED (Nov 21 2026, FX2): the banner row
    var pick = document.getElementById("pfsBannerPick");
    if (pick) pick.addEventListener("click", function () { var fi = document.getElementById("fi-banner"); if (fi) fi.click(); });
    var drop = document.getElementById("pfsBannerRemove");
    if (drop) drop.addEventListener("click", removeBanner);
  }
  /* NAMED (Nov 21 2026, FX2): the banner's two changes. setBanner is called by profile.html once an upload is saved. */
  function setBanner(url) {
    if (!state.profile) state.profile = {};
    state.profile.banner_url = safeUrl(url) ? url : null;
    render();
  }
  function removeBanner() {
    var btn = document.getElementById("pfsBannerRemove");
    if (btn) btn.disabled = true;
    fetch(API + "/api/bfp/profile/me", { method: "PUT", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ banner_url: null }) })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        var img = document.getElementById("bannerImg");
        if (img) { img.style.display = "none"; img.removeAttribute("src"); }
        setBanner(null);
        note("Banner removed.");
      })
      .catch(function () { if (btn) btn.disabled = false; note("The banner could not be removed just now. Try again."); });
  }

  /* NAMED (Nov 20 2026, FX1): the phone header's menu. The owner's: Saved posts (private; BEFORE a fifth tab, still a tab on a
     desktop), Your data, Customise profile (when the page offers it), Settings and Executive HQ, the links the old header's
     buttons held. A visitor's: Report, Block and Mute (scripts/bf-safety.js), as the page's three dots offer on a desktop. */
  function initialsOf(name) {
    var w = String(name || "?").replace(/^@/, "").trim().split(/\s+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w.length > 1 ? w[1].charAt(0) : "")).toUpperCase();
  }
  var menuEl = null, menuBack = null, menuFrom = null;
  function closeMenu() { if (menuEl && !menuEl.hidden) { menuEl.hidden = true; menuBack.hidden = true; if (menuFrom && menuFrom.focus) menuFrom.focus(); } }
  function openMenu(from, p) {
    if (!owner) {
      if (window.BFSafety && window.BFSafety.openMenu) window.BFSafety.openMenu({ type: "profile", id: viewId, userId: viewId, name: p.display_name || (p.username ? "@" + p.username : "") }, from);
      return;
    }
    menuFrom = from;
    if (!menuEl) {
      menuBack = document.createElement("div"); menuBack.id = "pfs-menu-back"; menuBack.addEventListener("click", closeMenu);
      menuEl = document.createElement("div"); menuEl.id = "pfs-menu"; menuEl.setAttribute("role", "dialog"); menuEl.setAttribute("aria-modal", "true"); menuEl.setAttribute("aria-labelledby", "pfs-menu-title");
      menuEl.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
      document.body.appendChild(menuBack); document.body.appendChild(menuEl);
    }
    var cust = document.getElementById("customiseBtn");
    menuEl.innerHTML = '<div class="pfs-ph"><h2 id="pfs-menu-title">Menu</h2><button type="button" class="pfs-x" id="pfsMenuClose" aria-label="Close">' + svg('<path d="M6 6l12 12M18 6L6 18"/>', 18) + '</button></div>' +
      '<ul class="pfs-menu-list">' +
        '<li><button type="button" class="pfs-menu-item" data-pfs-go="saved">Saved posts</button></li>' +
        (cust && !cust.hidden ? '<li><button type="button" class="pfs-menu-item" data-pfs-go="customise">Customise profile</button></li>' : "") +
        '<li><a class="pfs-menu-item" href="your-data.html">Your data</a></li>' +
        '<li><a class="pfs-menu-item" href="settings.html">Settings</a></li>' +
        '<li><a class="pfs-menu-item" href="dashboard.html">Executive HQ</a></li>' +
      '</ul>';
    menuEl.querySelector("#pfsMenuClose").addEventListener("click", closeMenu);
    Array.prototype.forEach.call(menuEl.querySelectorAll("[data-pfs-go]"), function (b) {
      b.addEventListener("click", function () {
        var go = b.getAttribute("data-pfs-go");
        closeMenu();
        if (go === "customise") { var c = document.getElementById("customiseBtn"); if (c) c.click(); return; }
        state.tab = "saved";
        render();
        var panelEl = document.getElementById("pfsPanel");
        if (panelEl && panelEl.scrollIntoView) panelEl.scrollIntoView({ block: "start" });
      });
    });
    menuBack.hidden = false; menuEl.hidden = false;
    menuEl.querySelector("#pfsMenuClose").focus();
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

  /* ── NAMED (Nov 20 2026, P2-3): follows ── */
  function send(method, path, body) {
    var h = { Authorization: "Bearer " + token };
    if (body) h["Content-Type"] = "application/json";
    return fetch(API + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, body: d }; }); });
  }
  function toggleFollow() {
    var f = state.follows;
    if (!f || !token) return;
    var on = !f.i_follow;
    (on ? send("POST", "/api/follows", { user_id: viewId }) : send("DELETE", "/api/follows/" + encodeURIComponent(viewId))).then(function (r) {
      if (!r.ok) { note(r.body.error || "That did not work. Try again."); return; }
      f.i_follow = on;
      f.followers = Math.max(0, f.followers + (on ? 1 : -1));
      render();
      var again = document.getElementById("pfsFollow");
      if (again) again.focus();
    }).catch(function () { note("That did not work. Check your connection."); });
  }
  var sheet = null, back = null, sheetFrom = null;
  function closePeople() { if (sheet && !sheet.hidden) { sheet.hidden = true; back.hidden = true; if (sheetFrom && sheetFrom.focus) sheetFrom.focus(); } }
  function openPeople(which, from) {
    if (!token) { try { localStorage.setItem("bf_return_to", window.location.pathname + window.location.search); } catch (e) { /* fine */ } window.location.href = "/app.html"; return; }
    sheetFrom = from;
    if (!sheet) {
      back = document.createElement("div"); back.id = "pfs-people-back"; back.addEventListener("click", closePeople);
      sheet = document.createElement("div"); sheet.id = "pfs-people"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "pfs-people-title");
      sheet.addEventListener("keydown", function (e) { if (e.key === "Escape") closePeople(); });
      document.body.appendChild(back); document.body.appendChild(sheet);
    }
    sheet.innerHTML = '<div class="pfs-ph"><h2 id="pfs-people-title">' + (which === "followers" ? "Followers" : "Following") + '</h2><button type="button" class="pfs-x" aria-label="Close">' + svg('<path d="M6 6l12 12M18 6L6 18"/>', 18) + '</button></div><ul class="pfs-people"><li class="pfs-empty">Loading...</li></ul>';
    sheet.querySelector(".pfs-x").addEventListener("click", closePeople);
    back.hidden = false; sheet.hidden = false;
    sheet.querySelector(".pfs-x").focus();
    get("/api/follows/" + encodeURIComponent(viewId) + "/" + which, true).then(function (d) {
      var list = d.people || [];
      sheet.querySelector(".pfs-people").innerHTML = list.length ? list.map(function (p) {
        var pic = safeUrl(p.avatar_url) ? '<img src="' + esc(p.avatar_url) + '" alt="">' : '<span class="av" aria-hidden="true">' + esc(String(p.name || "?").replace(/^@/, "").charAt(0).toUpperCase()) + '</span>';
        return '<li><a class="pfs-person" href="' + esc(safeUrl(p.link) || "#") + '">' + pic + '<span><strong>' + esc(p.name || "A member") + vb(p.verified) + '</strong>' + (p.username ? '<small>@' + esc(p.username) + '</small>' : "") + '</span></a></li>';
      }).join("") : '<li class="pfs-empty">No one yet.</li>';
    }).catch(function () { sheet.querySelector(".pfs-people").innerHTML = '<li class="pfs-empty">This list could not be loaded just now.</li>'; });
  }

  host.addEventListener("click", function (e) {
    var pp = e.target.closest("[data-pfs-people]");
    if (pp) { openPeople(pp.getAttribute("data-pfs-people"), pp); return; }
    var t = e.target.closest("[data-pfs-tab]");
    if (!t) return;
    if (t.getAttribute("data-pfs-tab") === "reviews") { if (window.BFFeed && window.BFFeed.soon) window.BFFeed.soon("reviews", t); return; }   // NAMED (Nov 20 2026, FX1)
    state.tab = t.getAttribute("data-pfs-tab");
    render();
    var again = document.getElementById("pfs-tab-" + state.tab);
    if (again) again.focus();
  });
  host.addEventListener("keydown", function (e) {
    if ((e.key !== "ArrowRight" && e.key !== "ArrowLeft") || !e.target.closest("[data-pfs-tab]")) return;
    var order = owner ? ["posts", "shop", "services", "saved"] : ["posts", "shop", "services"];
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
    // NAMED (Nov 21 2026, P3-2): verified, the Verified badge's kind (or null), from both profile routes
    profileReq.then(function (d) { state.profile = d.profile || null; state.visitorMember = d.member === true; state.verified = typeof d.verified === "string" ? d.verified : null; render(); return state.profile; })
      .then(function (p) {
        if (owner) return get("/api/marketplace/my-listings", true).then(function (d) { mine(d.listings); });
        if (p && p.username) return get("/api/bfp/seller/" + encodeURIComponent(p.username), false).then(function (d) { state.shop = d.products || []; state.services = d.services || []; });
        return null;
      })
      .then(function () { state.listingsLoaded = true; render(); })
      .catch(function () { state.listingsLoaded = true; state.listingsFailed = true; render(); });
    statsReq.then(function (s) { state.stats = s; render(); }).catch(function () { /* no counts: nothing is claimed */ });
    // NAMED (Nov 20 2026, P2-3): the posts, the follow counts, and the owner's private Saved
    get("/api/posts/by/" + encodeURIComponent(viewId), true).then(function (d) { state.posts = d.posts || []; render(); })
      .catch(function () { state.postsFailed = true; render(); });
    get("/api/follows/" + encodeURIComponent(viewId) + "/counts", true).then(function (d) { state.follows = d; render(); }).catch(function () { /* no counts: nothing is claimed */ });
    if (owner) get("/api/posts/saved", true).then(function (d) { state.saved = d.posts || []; render(); }).catch(function () { state.savedFailed = true; render(); });
    // NAMED (Nov 20 2026, FX1): whether the owner is a paid member (BizCash, the wallet, "BizForce member"); unknown claims nothing
    if (owner) get("/api/auth/me", true).then(function (d) { state.member = !!(d && d.access && d.access.tier === "member"); render(); }).catch(function () { /* unknown: not shown */ });
  }

  window.BFProfileShell = { render: render, state: state, owner: owner, setBanner: setBanner };   // NAMED (Nov 21 2026, FX2): + setBanner
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

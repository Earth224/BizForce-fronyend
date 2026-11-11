/* ══════════════════════════════════════════════════════════════════════════
   bf-orbit.js — the dashboard's top half (Nov 10 2026, orbit top half).

   Five portals on an elliptical orbit around a core: Grow, Sell, Connect,
   Agents and Oracle. Two swappable main boxes (Analytics and Store by
   default), the open portal's boxes as a living grid, an All tools view, and a
   "/" quick search. It replaces the 29-tile feature grid and the AI Agent
   Directory card; every one of those boxes is kept, byte for byte, in
   dashboard.html's <template id="orbitTools">, and is cloned from there.

   ONE READ. Every figure comes from one GET /api/dashboard/top, on load and on
   Refresh. A figure the route did not give is not shown: the box keeps its
   description alone. Nothing here invents a number, and the mailbox is shown
   as connected or not, never with an unread count (none can be known without
   reading the mailbox).

   THE LOOK (Nov 10 2026, visual match) is the approved mockup's, drawn in a
   680 x 330 viewBox and scaled to the panel: a starfield panel, an outer ring
   rx 275 / ry 110, an inner dashed ring rx 150 / ry 60, a core r 34 with a
   decorative halo and three-quarter arc (never a percentage), and portals of
   r 27 ON the ring with their labels 42 units under each circle. At rest
   Oracle is at the top centre, Agents upper right, Connect lower right, Sell
   lower left and Grow upper left (REST_BASE). The open portal grows to r 30
   with a halo and reads "<Name> (open)"; the others keep full opacity.

   MOTION, transform and opacity only. The portals drift along the ring (one
   turn in DRIFT_MS), paused on hover and focus, while a portal is open, and
   while the tab is hidden. Opening a portal turns the orbit so that portal
   comes forward to the lower-left slot (FRONT_DEG; TURN_MS, ease-out), so the
   ring settles in the approved arrangement. Under prefers-reduced-motion there
   is no drift, the turn snaps, and the beam's dot is still.

   THE MOON. The Oracle portal draws tonight's moon on this device from the
   date alone: the age is the time since a known new moon (2000-01-06 18:14
   UTC) modulo the mean synodic month (29.530588853 days), the lit fraction is
   (1 - cos(2 pi age / month)) / 2, and the phase is named in eighths. No
   network.

   STORAGE. localStorage bf_main_boxes (the two main boxes; cleared at sign-out
   by scripts/bf-session.js) and sessionStorage bf_orbit_portal (the open
   portal in this tab; a display choice, left on purpose). Every access is in
   try/catch.

   Every server string is set with textContent. No innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var DRIFT_MS = 120000;
  var TURN_MS = 600;
  var STEP_DEG = 72;
  var VIEW = { w: 680, h: 330, cx: 340, cy: 160, rx: 275, ry: 110, innerRx: 150, innerRy: 60, portalR: 27, labelDy: 42, coreR: 34, coreHaloR: 44 };
  // A portal at angle a sits at (cx + rx sin a, cy + ry cos a): 0 is the bottom centre, 180 the top centre.
  var FRONT_DEG = -36;    // the lower-left slot, where an opened portal comes to rest
  var REST_BASE = -108;   // Grow -108 (upper left), Sell -36, Connect 36, Agents 108, Oracle 180 (top centre)
  /* THE STARS (Nov 11 2026, still stars). The Oracle's abyss stars, kept STILL. oracle.html draws them on a canvas
     (makeStar and drawStarAt), inline in each Oracle page and inside its drift and twinkle loop, so they cannot be shared
     without changing those four pages: this is a faithful static copy in SVG, with drawStarAt's constants (ORACLE_STAR),
     makeStar's tints, sizes and alphas (STAR_LAYERS, from a seeded generator, not a random one each load). Each star: a
     soft radial halo, thin cross rays on the bright large ones, and a sharp core, whitened on the brightest. NAMED (Nov 11
     2026, one living sky): no POSITION animation; they now twinkle in place (ONE LIVING SKY below).
     THE SKY (Nov 11 2026, more and even stars). How many follows the panel's area (STAR_SKY: 40 on the 1152 x 565 panel
     of a 1440 px screen, the same density elsewhere, never under 18 or over 48), in the Oracle's own mix (its layers'
     counts, 240 : 120 : 50, small : medium : large bright). They are spread by a grid over the WHOLE panel, one star to a
     cell at a seeded jittered spot, so the sky is even without looking like a lattice. */
  var STAR_SEED = 36, STAR_LAYOUT_SEED = 1111;
  var ORACLE_STAR = { haloR: 2.2, haloAlpha: 0.5, spikeLen: 6, spikeAlpha: 0.5, spikeWidth: 0.8, coreR: 0.7, coreEdgeAlpha: 0.15, brightAbove: 0.7, brightMix: 0.6 };
  var STAR_TINTS = [{ r: 34, g: 211, b: 238 }, { r: 139, g: 92, b: 246 }, { r: 251, g: 191, b: 36 }];
  var STAR_LAYERS = [{ count: 240, minR: 0.4, maxR: 0.9 }, { count: 120, minR: 0.8, maxR: 1.6 }, { count: 50, minR: 1.4, maxR: 2.6 }];
  var STAR_SIZES = ["small", "medium", "large"];
  // count = clamp(round(refCount x panel area / (refW x refH)), min, max); cells = 1.5 x count, cols and rows even; the first
  // spot within jitter x the cell of its centre, then up to 12 more seeded spots over the cell; no two stars closer than
  // spacing x the cell's smaller side.
  var STAR_SKY = { refW: 1152, refH: 565, refCount: 40, min: 18, max: 48, spare: 1.5, jitter: 0.35, retries: 12, spacing: 0.6 };
  /* ONE LIVING SKY (Nov 11 2026, one living sky). ONE fixed set: the seeds above are constants, the layout keeps clear of
     everywhere anything can ever be (every place on the ring a portal at its open size and its halo can reach, every place
     a label with " (open)" can reach, the core, the search, and the reserved row above the search where the preview and
     status lines appear), and it is laid out again ONLY when the panel's width changes; hovering, opening, turning,
     drifting, previews, Refresh and new figures leave every star where it is.
     ALIVE IN PLACE: each star twinkles (its halo and core between 55% and 100% opacity) over a seeded 2.5 to 6 s with a
     seeded start, so no two pulse together, as the Oracle's stars do (each its own speed and phase); the rays of the
     spiked ones flare with it (opacity and a scale of 0.8 to 1.15 about the star's centre); the large ones glint now and
     then (a seeded 6 to 14 s). CSS keyframes on opacity and scale only: nothing moves. Paused while the tab is hidden or
     the panel is off the screen; none under reduced motion, where each star shines steadily at full.
     THE ORACLE'S COLOURS: its pickTint gives one star in six a tint, one of three, so the sky is 5/6 white and 1/18 each
     cyan, violet and gold; here those shares are dealt out exactly (largest remainder, at least one of each tint, each
     tint on at least one star bigger than the smallest), and a tinted star carries its tint clearly: a stronger halo and
     rays, and a core lightened toward white rather than white. */
  var STAR_TINT_NAMES = ["white", "cyan", "violet", "gold"];
  var STAR_WHITE = { r: 255, g: 255, b: 255 };
  var STAR_SHARES = [5 / 6, 1 / 18, 1 / 18, 1 / 18];
  var STAR_TINT_SEED = 1777;
  // A tinted star: its halo (as wide as the Oracle draws it) at 0.8 x alpha, its rays at 0.8 x alpha, its core's centre the tint 35% toward white,
  // its core's edge at 0.6 x alpha, and never fainter than alpha 0.5.
  var STAR_TINT_LOOK = { haloAlpha: 0.8, rayAlpha: 0.8, coreMix: 0.35, coreEdgeAlpha: 0.6, minAlpha: 0.5 };
  var STAR_TWINKLE = { seed: 4242, minDur: 2.5, maxDur: 6, low: 0.55, flareMin: 0.8, flareMax: 1.15, glintMin: 6, glintMax: 14, glintR: 2.6, glintLen: 4.8 };
  var SYNODIC_DAYS = 29.530588853;
  var KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
  var DAY_MS = 86400000;
  var DEFAULT_MAIN = ["analytics", "store"];
  var SEARCH_MAX = 8;

  var PORTALS = [
    { key: "grow", title: "Grow", tools: ["analytics", "self-reviews", "certifications", "lead-radar", "prospecting", "sms-drip"] },
    { key: "sell", title: "Sell", tools: ["store", "inventory", "marketplace", "services", "crm", "bfc-wallet", "receipts", "crowdfunding", "my-purchases", "garage-sale"] },
    { key: "connect", title: "Connect", tools: ["mailbox", "messages", "business-chat", "digital-cards", "business-identity", "profile-page", "artists"] },
    { key: "agents", title: "Agents", tools: ["agent-directory", "agent-proposals", "integrations", "routines", "saved-prompts"] },
    { key: "oracle", title: "Oracle", tools: ["oracle", "mychart", "synastry", "the-third"] }
  ];
  var UTILITIES = { key: "utilities", title: "Utilities", tools: ["billing", "media-library", "bizdoc", "calendar", "settings", "your-data"] };
  var GROUPS = PORTALS.concat([UTILITIES]);

  /* ── storage, never trusted to work ── */
  function readLocal() { try { return window.localStorage.getItem("bf_main_boxes"); } catch (e) { return null; } }
  function writeLocal(value) { try { window.localStorage.setItem("bf_main_boxes", value); return true; } catch (e) { return false; } }
  function readSession() { try { return window.sessionStorage.getItem("bf_orbit_portal"); } catch (e) { return null; } }
  function writeSession(value) {
    try {
      if (value) window.sessionStorage.setItem("bf_orbit_portal", value);
      else window.sessionStorage.removeItem("bf_orbit_portal");
    } catch (e) { /* storage unavailable: the choice lasts this page only */ }
  }

  /* ── the moon, from the date alone ── */
  function moonPhase(when) {
    var ms = typeof when === "number" ? when : (when instanceof Date ? when.getTime() : Date.now());
    var age = ((ms - KNOWN_NEW_MOON_MS) / DAY_MS) % SYNODIC_DAYS;
    if (age < 0) age += SYNODIC_DAYS;
    var fraction = age / SYNODIC_DAYS;
    var illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
    var NAMES = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
    var name = NAMES[Math.floor(fraction * 8 + 0.5) % 8];
    return { age: age, fraction: fraction, illumination: illumination, name: name, waxing: fraction < 0.5 };
  }
  /* The lit part of a disc of radius r at (cx, cy): the lit half's outer edge,
     then the terminator, an ellipse of x-radius r*|cos(2 pi f)|, back to the top.
     Waxing is lit on the right, waning on the left (as seen from the north). */
  function moonPath(fraction, cx, cy, r) {
    var f = ((fraction % 1) + 1) % 1;
    var rx = Math.abs(Math.cos(2 * Math.PI * f)) * r;
    var top = cx + " " + (cy - r), bottom = cx + " " + (cy + r);
    var outerSweep = f < 0.5 ? 1 : 0;
    var innerSweep = (f % 0.5) < 0.25 ? 0 : 1;
    return "M " + top + " A " + r + " " + r + " 0 0 " + outerSweep + " " + bottom +
      " A " + rx.toFixed(3) + " " + r + " 0 0 " + innerSweep + " " + top + " Z";
  }

  /* ── the figures: only what the route gave ── */
  function n(x) { return typeof x === "number" && isFinite(x) ? x : null; }
  function plural(k, one, many) { return k + " " + (k === 1 ? one : many); }
  function bytes(b) {
    if (b >= 1073741824) return (b / 1073741824).toFixed(1) + " GB";
    if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
    if (b >= 1024) return Math.round(b / 1024) + " KB";
    return b + " B";
  }
  function shortDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    var M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return M[d.getUTCMonth()] + " " + d.getUTCDate();
  }
  /* { text, value } for a box, or null when the route gave nothing for it.
     value orders the grid (busiest first); level figures (a balance, storage)
     are shown but are not activity, so their value is 0. */
  function figureFor(slug, top) {
    if (!top) return null;
    var c = top.counts || {};
    var count = function (k, one, many) { var v = n(c[k]); return v === null ? null : { text: plural(v, one, many), value: v }; };
    switch (slug) {
      case "analytics": {
        var v = top.visits;
        if (!v || n(v.this_week) === null) return null;
        if (v.tracked === false) return { text: "No tracked visits yet", value: 0 };
        return { text: plural(v.this_week, "tracked visit", "tracked visits") + " this week", value: v.this_week };
      }
      case "self-reviews": {
        var sr = top.self_reviews;
        if (!sr || !sr.latest_at) return null;
        var when = shortDate(sr.latest_at);
        if (!when) return null;
        var recent = Date.parse(top.generated_at || "") - Date.parse(sr.latest_at) < 7 * DAY_MS;
        return { text: "Latest review " + when, value: recent ? 1 : 0 };
      }
      case "certifications": {
        var ce = top.certifications;
        if (!ce || n(ce.earned) === null || n(ce.total) === null) return null;
        return { text: ce.earned + " of " + ce.total + " earned", value: ce.earned };
      }
      case "lead-radar": return count("leads", "scored lead", "scored leads");
      case "prospecting": return count("prospects", "prospect", "prospects");
      case "sms-drip": return count("sms_subscribers", "subscriber", "subscribers");
      case "store": {
        var st = top.store;
        if (!st) return null;
        if (st.connected === false) return { text: "Connect a store to see orders", value: 0 };
        if (st.connected !== true || n(st.orders_this_week) === null) return null;
        return { text: plural(st.orders_this_week, "order", "orders") + " this week", value: st.orders_this_week };
      }
      case "inventory": {
        var low = top.store && top.store.low_stock;
        if (!low || n(low.count) === null) return null;
        if (low.count === 0) return { text: "Nothing at or below its reorder point", value: 0 };
        return { text: low.count + " at or below reorder point", value: low.count };
      }
      case "marketplace": {
        var mk = top.marketplace;
        if (!mk || n(mk.orders_this_week) === null) return null;
        return { text: plural(mk.orders_this_week, "order", "orders") + " this week", value: mk.orders_this_week };
      }
      case "crm": return count("crm_customers", "customer", "customers");
      case "bfc-wallet": {
        var w = top.wallet;
        if (!w || n(w.balance) === null) return null;
        return { text: "Balance " + w.balance + " BFC", value: 0, level: true };
      }
      case "crowdfunding": return count("campaigns", "campaign", "campaigns");
      case "my-purchases": return count("purchases", "purchase", "purchases");
      case "mailbox": {
        var mb = top.mailbox;
        if (!mb || typeof mb.connected !== "boolean") return null;
        return { text: mb.connected ? "Connected" : "Not connected", value: 0 };
      }
      case "digital-cards": {
        var cd = top.cards;
        if (!cd || n(cd.count) === null || n(cd.views_today) === null) return null;
        if (cd.count === 0) return { text: "No cards yet", value: 0 };
        return { text: plural(cd.views_today, "visit", "visits") + " today", value: cd.views_today };
      }
      case "agent-directory": {
        var ag = top.agents;
        if (!ag || !Array.isArray(ag.running_now) || !ag.running_now.length) return null;
        return { text: plural(ag.running_now.length, "agent", "agents") + " running now", value: ag.running_now.length };
      }
      case "agent-proposals": {
        var p = n(top.proposals_pending);
        if (p === null) return null;
        if (p === 0) return { text: "Nothing waiting for you", value: 0 };
        return { text: p + " waiting for your approval", value: p };
      }
      case "routines": return count("routines", "routine", "routines");
      case "saved-prompts": return count("saved_prompts", "saved prompt", "saved prompts");
      case "media-library": {
        var md = top.media;
        if (!md || n(md.used_bytes) === null || n(md.cap_bytes) === null) return null;
        return { text: bytes(md.used_bytes) + " of " + bytes(md.cap_bytes) + " used", value: 0, level: true };
      }
      case "bizdoc": return count("bizdoc_documents", "document", "documents");
      default: return null;
    }
  }
  /* Busiest first: boxes with a non-zero figure (or a level figure), by value;
     then the rest in the portal's fixed order. */
  function orderTools(slugs, top) {
    var rows = slugs.map(function (slug, i) { return { slug: slug, i: i, fig: figureFor(slug, top) }; });
    var busy = rows.filter(function (r) { return r.fig && (r.fig.value > 0 || r.fig.level); });
    var rest = rows.filter(function (r) { return busy.indexOf(r) === -1; });
    busy.sort(function (a, b) { return (b.fig.value - a.fig.value) || (a.i - b.i); });
    return busy.concat(rest);
  }
  // What needs the member, per portal: Agents the proposals waiting, Sell the low stock. No badge at 0.
  function attention(top) {
    var out = {};
    var p = top ? n(top.proposals_pending) : null;
    if (p !== null && p > 0) out.agents = p;
    var low = top && top.store && top.store.low_stock ? n(top.store.low_stock.count) : null;
    if (low !== null && low > 0) out.sell = low;
    return out;
  }
  function firstPortal(top) {
    var a = attention(top), best = null;
    PORTALS.forEach(function (p) { if (a[p.key] && (best === null || a[p.key] > a[best])) best = p.key; });
    return best || "sell";
  }

  /* ── the page ── */
  var root = document.getElementById("orbitTop");
  if (!root) return;
  var stage = document.getElementById("orbitStage");
  var svg = document.getElementById("orbitSvg");
  var panel = document.getElementById("orbitPanel");
  var starsSvg = document.getElementById("orbitStars");
  var grid = document.getElementById("orbitGrid");
  var mainWrap = document.getElementById("orbitMain");
  var allTools = document.getElementById("orbitAllTools");
  var preview = document.getElementById("orbitPreview");
  var search = document.getElementById("orbitSearch");
  var results = document.getElementById("orbitResults");
  var refresh = document.getElementById("orbitRefresh");
  var status = document.getElementById("orbitStatus");
  var say = document.getElementById("orbitSay");
  var template = document.getElementById("orbitTools");

  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined && text !== null) x.textContent = String(text); return x; }
  function sv(tag, attrs) { var x = document.createElementNS(SVG_NS, tag); Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); }); return x; }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  // Each tool's box, title and link, from the template: the boxes as the old grid had them.
  var TOOL = {};
  (function readTools() {
    var frag = template && template.content ? template.content : null;
    if (!frag) return;
    Array.prototype.forEach.call(frag.children, function (node) {
      var slug = node.getAttribute("data-card") || (node.id === "agentDirectoryLanding" ? "agent-directory" : null);
      if (!slug) return;
      var h = node.querySelector("h3");
      var a = node.querySelector("a.bf-btn");
      var href = a ? a.getAttribute("href") : (slug === "agent-directory" ? "agents-hub.html" : null);
      TOOL[slug] = { slug: slug, node: node, title: h ? String(h.textContent).trim() : slug, href: href };
    });
  }());
  function groupOf(slug) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].tools.indexOf(slug) !== -1) return GROUPS[i];
    return null;
  }
  function everyTool() { return GROUPS.reduce(function (all, g) { return all.concat(g.tools); }, []).filter(function (s) { return !!TOOL[s]; }); }

  var state = {
    top: null, open: null, mains: readMains(), base: 0, turn: null, hover: false, focus: false, last: 0, frame: 0,
    allOpen: false, active: -1, matches: []
  };
  function readMains() {
    var raw = readLocal(), list = null;
    try { list = raw ? JSON.parse(raw) : null; } catch (e) { list = null; }
    if (!Array.isArray(list) || list.length !== 2 || list[0] === list[1] || !groupOf(list[0]) || !groupOf(list[1])) return DEFAULT_MAIN.slice();
    return list.slice();
  }
  function reduced() { try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function narrow() { try { return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches); } catch (e) { return false; } }

  /* ── the orbit ── */
  var portalBtn = {}, beam = {}, badge = {}, portalName = {};
  var core, links;
  function emblem(key) {
    var g = sv("svg", { viewBox: "0 0 40 40", "class": "orbit-emblem", "aria-hidden": "true", focusable: "false" });
    if (key === "grow") g.appendChild(sv("polygon", { points: "20,6 34,32 6,32" }));
    else if (key === "sell") { g.appendChild(sv("polygon", { points: "20,5 33,12.5 33,27.5 20,35 7,27.5 7,12.5" })); g.appendChild(sv("circle", { cx: "20", cy: "20", r: "4" })); }
    else if (key === "connect") { g.appendChild(sv("circle", { cx: "15", cy: "20", r: "9" })); g.appendChild(sv("circle", { cx: "25", cy: "20", r: "9" })); }
    else if (key === "agents") {
      g.appendChild(sv("circle", { cx: "20", cy: "20", r: "3", "class": "orbit-emblem-fill" }));
      [0, 60, 120].forEach(function (deg) { g.appendChild(sv("ellipse", { cx: "20", cy: "20", rx: "15", ry: "6", transform: "rotate(" + deg + " 20 20)" })); });
    } else if (key === "oracle") {
      var m = moonPhase(Date.now());
      g.setAttribute("class", "orbit-emblem orbit-moon");
      g.setAttribute("data-moon", m.name);
      var title = sv("title", {}); title.textContent = m.name; g.appendChild(title);
      g.appendChild(sv("circle", { cx: "20", cy: "20", r: "14", "class": "orbit-moon-dark" }));
      g.appendChild(sv("path", { d: moonPath(m.fraction, 20, 20, 14), "class": "orbit-moon-lit" }));
    }
    return g;
  }
  // A point on the ring's circle frame (radius rx, before the squash) at angle a, for a turned-with-the-ring drawing.
  function framePoint(a, r) { var rad = a * Math.PI / 180; return (r * Math.sin(rad)).toFixed(1) + " " + (r * Math.cos(rad)).toFixed(1); }
  /* ── the still stars ── */
  // A small seeded generator (mulberry32): the same stars, in the same places, on every load of the same panel size.
  function seeded(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // How many stars a panel of w x h holds: the 1440 px panel's density, never under min or over max.
  function starCount(w, h) {
    return Math.max(STAR_SKY.min, Math.min(STAR_SKY.max, Math.round(STAR_SKY.refCount * (w * h) / (STAR_SKY.refW * STAR_SKY.refH))));
  }
  // The Oracle's mix for n stars: its layers' counts as shares (small, medium, large bright), at least one large.
  function starMix(n) {
    var total = STAR_LAYERS[0].count + STAR_LAYERS[1].count + STAR_LAYERS[2].count;
    var large = Math.max(1, Math.round(n * STAR_LAYERS[2].count / total)), small = Math.round(n * STAR_LAYERS[0].count / total);
    return [small, n - small - large, large];
  }
  // makeStar's look: radius in the layer's range, alpha .12 + u^2 * .8, one star in six tinted, rays when large and bright.
  // want: "spiked" (the large bright ones: makeStar drawn again until it gives rays), "plain" (drawn again until it gives none), or any.
  function oracleStar(rnd, L, want) {
    var star = null;
    for (var n = 0; n < 400 && !star; n++) {
      var r = L.minR + rnd() * (L.maxR - L.minR);
      var alpha = 0.12 + Math.pow(rnd(), 2) * 0.8;
      var tint = rnd() < 1 / 6 ? STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)] : { r: 255, g: 255, b: 255 };
      var s = { r: r, alpha: alpha, tint: tint, spiked: r > L.minR + (L.maxR - L.minR) * 0.6 && alpha > 0.6 };
      if (!want || (want === "spiked") === s.spiked) star = s;
    }
    return star || { r: L.maxR, alpha: want === "spiked" ? 0.92 : 0.5, tint: { r: 255, g: 255, b: 255 }, spiked: want === "spiked" };
  }
  // n looks in the Oracle's mix, in a seeded order, so the sizes are spread over the sky.
  function starLooks(n) {
    var rnd = seeded(STAR_SEED), out = [], mix = starMix(n === undefined ? STAR_SKY.refCount : n);
    STAR_LAYERS.forEach(function (L, k) {
      for (var i = 0; i < mix[k]; i++) { var s = oracleStar(rnd, L, k === 2 ? "spiked" : null); s.size = STAR_SIZES[k]; out.push(s); }
    });
    for (var j = out.length - 1; j > 0; j--) { var m = Math.floor(rnd() * (j + 1)), t = out[j]; out[j] = out[m]; out[m] = t; }
    starDeal(out);
    return out;
  }
  // The Oracle's colours dealt over these stars (again over the ones placed, once the layout is done, so the shares hold
  // for the sky as drawn). Each tint shows on at least one star bigger than the smallest: a small one of that tint trades
  // with a white medium or large one.
  function starDeal(looks) {
    var tints = starTints(looks.length);
    for (var k = 1; k < STAR_TINT_NAMES.length; k++) {
      var mine = [], white = [];
      looks.forEach(function (s, i) { if (tints[i] === k) mine.push(i); else if (tints[i] === 0 && s.size !== "small") white.push(i); });
      if (mine.length && white.length && mine.every(function (i) { return looks[i].size === "small"; })) { tints[white[0]] = k; tints[mine[0]] = 0; }
    }
    looks.forEach(function (s, i) { s.tint = tints[i] ? STAR_TINTS[tints[i] - 1] : STAR_WHITE; s.tintName = STAR_TINT_NAMES[tints[i]]; });
  }
  // The Oracle's shares dealt to n stars (0 white, 1 cyan, 2 violet, 3 gold): largest remainder, at least one of each tint,
  // in a seeded order.
  function starTints(n) {
    var raw = STAR_SHARES.map(function (s) { return s * n; }), counts = raw.map(Math.floor), left = n - counts.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (v, k) { return { k: k, f: v - Math.floor(v) }; }).sort(function (a, b) { return b.f - a.f || a.k - b.k; }).slice(0, left).forEach(function (o) { counts[o.k]++; });
    for (var k = 1; k < counts.length; k++) if (counts[k] < 1 && counts[0] > 1) { counts[k]++; counts[0]--; }
    var list = [];
    counts.forEach(function (c, k) { for (var i = 0; i < c; i++) list.push(k); });
    var rnd = seeded(STAR_TINT_SEED);
    for (var j = list.length - 1; j > 0; j--) { var m = Math.floor(rnd() * (j + 1)), t = list[j]; list[j] = list[m]; list[m] = t; }
    return list;
  }
  function starTinted(look) { return !!look.tint && !(look.tint.r === 255 && look.tint.g === 255 && look.tint.b === 255); }
  // How far a star's light reaches: its rays at their longest flare when it has them, else its halo.
  function starReach(look) {
    return look.r * (look.spiked ? ORACLE_STAR.spikeLen * STAR_TWINKLE.flareMax : ORACLE_STAR.haloR);
  }
  // A star's own twinkle, from its place in the sky: a duration of 2.5 to 6 s, a start somewhere in it, and for the large
  // ones a glint every 6 to 14 s, with its own start.
  function starTwinkle(i) {
    var rnd = seeded(STAR_TWINKLE.seed + 7919 * i), T = STAR_TWINKLE;
    var dur = T.minDur + rnd() * (T.maxDur - T.minDur), delay = -rnd() * dur, gl = T.glintMin + rnd() * (T.glintMax - T.glintMin), glDelay = -rnd() * gl;
    return { dur: +dur.toFixed(2), delay: +delay.toFixed(2), glint: +gl.toFixed(2), glintDelay: +glDelay.toFixed(2) };
  }
  // Where a star may not sit, in the panel's pixels: g = { w, h, gap, edge, circles: [{x, y, r}], boxes: [{x, y, w, h}] }.
  function starClear(x, y, reach, g) {
    var k, c, b, dx, dy, room = g.edge + reach - g.gap;
    if (x < room || y < room || x > g.w - room || y > g.h - room) return false;
    for (k = 0; k < g.circles.length; k++) { c = g.circles[k]; if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < (c.r + reach) * (c.r + reach)) return false; }
    for (k = 0; k < g.boxes.length; k++) {
      b = g.boxes[k]; dx = Math.max(b.x - x, 0, x - (b.x + b.w)); dy = Math.max(b.y - y, 0, y - (b.y + b.h));
      if (dx * dx + dy * dy < reach * reach) return false;
    }
    return true;
  }
  // The grid: about spare x n cells shaped like the panel, an even number of columns and of rows, so each quadrant is whole cells.
  function starGrid(g, n) {
    var want = Math.ceil(n * STAR_SKY.spare);
    var cols = Math.max(2, 2 * Math.round(Math.sqrt(want * g.w / g.h) / 2)), rows = Math.max(2, 2 * Math.ceil(want / cols / 2));
    return { cols: cols, rows: rows, cw: g.w / cols, ch: g.h / rows };
  }
  /* The seeded layout. Each quadrant takes a quarter of the stars (the odd ones to seeded quadrants), in its cells with room,
     in a seeded order. A star sits at its cell's jittered spot, else the first clear of 12 more seeded spots in the cell (one
     in each twelfth of it, nearest first). A cell with no clear spot is skipped, and its star goes to the most open free
     cell, in its own quadrant first; never a second star in a cell. No two stars closer than spacing x the cell's smaller
     side, no two large ones in neighbouring cells. A large star whose rays fit in no free cell (the phone row has no 16 px
     of clear sky) is drawn as a plain medium one; a small or medium bright one, at alpha .6, which by Oracle's rule has no
     rays. The result's .report says how many cells were skipped and reused, and how many stars were changed. */
  function starLayout(g) {
    var n = starCount(g.w, g.h), grid = starGrid(g, n), looks = starLooks(n), placed = [], used = {};
    var report = { count: n, cols: grid.cols, rows: grid.rows, skipped: 0, rehomed: 0, asMedium: 0, dimmed: 0, unplaced: 0 };
    var minGap = STAR_SKY.spacing * Math.min(grid.cw, grid.ch), cells = [], row, col;
    for (row = 0; row < grid.rows; row++) for (col = 0; col < grid.cols; col++) {
      var rnd = seeded(STAR_LAYOUT_SEED + 7919 * (row * grid.cols + col)), x0 = col * grid.cw, y0 = row * grid.ch;
      var first = { x: x0 + grid.cw * (0.5 + STAR_SKY.jitter * (2 * rnd() - 1)), y: y0 + grid.ch * (0.5 + STAR_SKY.jitter * (2 * rnd() - 1)) }, more = [];
      // NAMED (Nov 11 2026, one living sky): the phone row's sky is small pockets between the discs' halos, so its cells
      // look at 96 spots (a 12 x 8 grid of them) instead of 12 (4 x 3); the rules a star must meet are the same.
      var sc = g.narrow ? 12 : 4, sr = g.narrow ? 8 : 3;
      for (var s = 0; s < sc * sr; s++) more.push({ x: x0 + grid.cw * (s % sc + rnd()) / sc, y: y0 + grid.ch * (Math.floor(s / sc) + rnd()) / sr });
      more.sort(function (a, b) { return Math.hypot(a.x - first.x, a.y - first.y) - Math.hypot(b.x - first.x, b.y - first.y); });
      cells.push({ row: row, col: col, spots: [first].concat(more), q: (row < grid.rows / 2 ? 0 : 2) + (col < grid.cols / 2 ? 0 : 1) });
    }
    var nearLarge = function (cell) { return placed.some(function (p) { return p.look.size === "large" && Math.abs(p.row - cell.row) <= 1 && Math.abs(p.col - cell.col) <= 1; }); };
    var fits = function (pt, reach) {
      return starClear(pt.x, pt.y, reach + g.gap, g) && placed.every(function (p) { var d = Math.hypot(p.x - pt.x, p.y - pt.y); return d >= minGap && d >= p.reach + reach + g.gap; });
    };
    var put = function (cell, look) {
      var reach = starReach(look);
      for (var i = 0; i < cell.spots.length; i++) {
        if (fits(cell.spots[i], reach)) { placed.push({ i: placed.length, x: cell.spots[i].x, y: cell.spots[i].y, reach: reach, look: look, row: cell.row, col: cell.col }); used[cell.row + "," + cell.col] = 1; return true; }
      }
      return false;
    };
    var pick = seeded(STAR_LAYOUT_SEED), quota = [0, 0, 0, 0].map(function () { return Math.floor(n / 4); });
    [0, 1, 2, 3].map(function (q) { return { q: q, k: pick() }; }).sort(function (a, b) { return a.k - b.k; }).slice(0, n % 4).forEach(function (o) { quota[o.q]++; });
    var keyed = cells.map(function (c) { return { c: c, k: pick(), open: c.spots.some(function (pt) { return starClear(pt.x, pt.y, 3 + g.gap, g); }) }; }), chosen = [];
    [0, 1, 2, 3].forEach(function (q) {
      chosen = chosen.concat(keyed.filter(function (o) { return o.c.q === q; }).sort(function (a, b) { return (b.open ? 1 : 0) - (a.open ? 1 : 0) || a.k - b.k; })
        .slice(0, quota[q]).map(function (o) { return o.c; }));
    });
    chosen.sort(function (a, b) { return a.row - b.row || a.col - b.col; });
    var waiting = [], li = 0;
    chosen.forEach(function (cell) {
      var look = looks[li++];
      if (look.size === "large" && nearLarge(cell)) {
        for (var j = li; j < looks.length; j++) if (looks[j].size !== "large") { looks[li - 1] = looks[j]; looks[j] = look; look = looks[li - 1]; break; }
      }
      if (!put(cell, look)) { report.skipped++; waiting.push({ look: look, q: cell.q }); }
    });
    var rehome = function (wt) {
      var reach = starReach(wt.look);
      var free = cells.filter(function (c) { return !used[c.row + "," + c.col] && !(wt.look.size === "large" && nearLarge(c)); })
        .map(function (c) { return { c: c, open: c.spots.filter(function (pt) { return fits(pt, reach); }).length }; }).filter(function (o) { return o.open > 0; })
        .sort(function (a, b) { return (a.c.q === wt.q ? 0 : 1) - (b.c.q === wt.q ? 0 : 1) || b.open - a.open || a.c.row - b.c.row || a.c.col - b.c.col; });
      return free.length > 0 && put(free[0].c, wt.look);
    };
    var plain = seeded(STAR_SEED + 1);
    waiting.forEach(function (wt) {
      if (rehome(wt)) { report.rehomed++; return; }
      if (wt.look.size === "large") {
        var was = wt.look;
        wt.look = oracleStar(plain, STAR_LAYERS[1], "plain"); wt.look.size = "medium"; wt.look.tint = was.tint; wt.look.tintName = was.tintName; report.asMedium++;
        if (rehome(wt)) { report.rehomed++; return; }
      } else if (wt.look.spiked) {
        wt.look = { r: wt.look.r, alpha: 0.6, tint: wt.look.tint, tintName: wt.look.tintName, size: wt.look.size, spiked: false }; report.dimmed++;
        if (rehome(wt)) { report.rehomed++; return; }
      }
      report.unplaced++;
    });
    starDeal(placed.map(function (p) { return p.look; }));
    placed.report = report; placed.grid = grid; placed.minGap = minGap;
    return placed;
  }
  // The widest a portal's label can be, " (open)" and all, from its letters (not measured, so a font arriving late changes
  // nothing): 9 px a title letter (10.5 px bold capitals spaced .08em), 7 px a letter of " (open)", and 12 px either side.
  var STAR_KEEP = { titleCh: 9, openCh: 7, labelPad: 12, labelH: 18, haloR: 43 };
  function starLabelHalf() {
    var most = 0;
    PORTALS.forEach(function (p) { most = Math.max(most, String(p.title || p.key).length); });
    return (most * STAR_KEEP.titleCh + " (open)".length * STAR_KEEP.openCh) / 2 + STAR_KEEP.labelPad;
  }
  // Where the stars may not be: the union of everywhere anything in the panel can EVER be, whatever is open, hovered,
  // turning or shown. Wide: at every degree of the ring a portal can drift to, its open halo (r 43) and its disc at the
  // open size, and its widest label; the core. Phone row: each disc and its open halo, each label's whole cell, the core.
  // Both: the search and the reserved row above it where the preview and status lines appear. The sky's height is the
  // panel's without the results list (which opens below the search, over the sky, and does not move a star).
  function starGeometry() {
    var pr = panel.getBoundingClientRect();
    var box = function (node, grow) { var r = node.getBoundingClientRect(); return { x: r.left - pr.left - grow, y: r.top - pr.top - grow, w: r.width + 2 * grow, h: r.height + 2 * grow }; };
    var listH = 0;
    if (results && !results.hidden) { var lr = results.getBoundingClientRect(); listH = lr.height ? lr.height + 6 : 0; }
    // The phone row has little room: stars sit closer to it and to the edge there.
    var g = { w: pr.width, h: pr.height - listH, gap: narrow() ? 1 : 4, edge: narrow() ? 3 : 6, narrow: narrow(), circles: [], boxes: [] };
    var sr = stage.getBoundingClientRect();
    if (!narrow()) {
      var scale = stage.clientWidth ? stage.clientWidth / VIEW.w : 1, ox = sr.left - pr.left, oy = sr.top - pr.top, half = starLabelHalf();
      for (var a = 0; a < 360; a += 1) {
        var rad = a * Math.PI / 180, x = ox + (VIEW.cx + VIEW.rx * Math.sin(rad)) * scale, y = oy + (VIEW.cy + VIEW.ry * Math.cos(rad)) * scale;
        // the open halo (r 43) and the disc's box at its open size (r 30), wherever a portal drifts on the ring
        g.circles.push({ x: x, y: y, r: STAR_KEEP.haloR * scale });
        g.boxes.push({ x: x - (VIEW.portalR + 3) * scale, y: y - (VIEW.portalR + 3) * scale, w: 2 * (VIEW.portalR + 3) * scale, h: 2 * (VIEW.portalR + 3) * scale });
        g.boxes.push({ x: x - half, y: y + VIEW.labelDy * scale - STAR_KEEP.labelH / 2, w: 2 * half, h: STAR_KEEP.labelH });
      }
      g.circles.push({ x: ox + VIEW.cx * scale, y: oy + VIEW.cy * scale, r: (VIEW.coreHaloR + 4) * scale });
    } else {
      var os = 46 / 54;
      // A label may grow to its whole cell ("Sell (open)"), so the cell's width is kept clear under it; each disc's open
      // halo (r 43 x the row's scale) is kept clear around it.
      PORTALS.forEach(function (p) {
        var cell = box(portalBtn[p.key], 0), name = box(portalName[p.key], 3), disc = box(portalBtn[p.key].querySelector(".orbit-disc"), 3), hr = STAR_KEEP.haloR * os + 2;
        g.boxes.push(disc);
        g.circles.push({ x: disc.x + disc.w / 2, y: disc.y + disc.h / 2, r: hr });
        g.boxes.push({ x: cell.x, y: name.y, w: cell.w, h: name.h });
      });
      g.boxes.push(box(core, 3));
    }
    if (say) g.boxes.push(box(say, 4));
    var bar = panel.querySelector(".orbit-search");
    if (bar) g.boxes.push(box(bar, 6));
    return g;
  }
  function starGradient(defs, kind, id, attrs, stops) {
    var gr = sv(kind, attrs); gr.setAttribute("id", id);
    stops.forEach(function (s) { gr.appendChild(sv("stop", { offset: String(s[0]), "stop-color": "rgb(" + s[1].r + "," + s[1].g + "," + s[1].b + ")", "stop-opacity": String(+s[2].toFixed(4)) })); });
    defs.appendChild(gr);
  }
  var mixWhite = function (t, f) { return { r: Math.round(t.r + (255 - t.r) * f), g: Math.round(t.g + (255 - t.g) * f), b: Math.round(t.b + (255 - t.b) * f) }; };
  // drawStarAt, alive in place: (a) the halo, then the rays (bright large stars only, under the core), then (b) the core;
  // on the large ones a glint over all. A white star is drawn as the Oracle draws it; a tinted one with STAR_TINT_LOOK.
  // Positions are written once, as numbers, and never animated: the halo and core twinkle by opacity, the rays and the
  // glint by opacity and a scale about the star's own centre (transform-box: fill-box, transform-origin: center).
  function starNode(st, defs) {
    var L = st.look, t = L.tint, O = ORACLE_STAR, T = STAR_TINT_LOOK, tinted = starTinted(L), id = "orbitStar" + st.i, x = st.x.toFixed(1), y = st.y.toFixed(1);
    var a = tinted ? Math.max(L.alpha, T.minAlpha) : L.alpha, tw = starTwinkle(st.i), glint = L.size === "large";
    var g = sv("g", { "class": "orbit-star", "data-star": String(st.i), "data-r": L.r.toFixed(3), "data-alpha": a.toFixed(3), "data-spiked": L.spiked ? "1" : "0",
      "data-size": L.size, "data-cell": st.row + "," + st.col, "data-tint": L.tintName || "white", "data-tw-dur": String(tw.dur), "data-tw-delay": String(tw.delay) });
    if (glint) g.setAttribute("data-gl-dur", String(tw.glint));
    g.setAttribute("style", "--tw-dur:" + tw.dur + "s;--tw-delay:" + tw.delay + "s" + (glint ? ";--gl-dur:" + tw.glint + "s;--gl-delay:" + tw.glintDelay + "s" : ""));
    starGradient(defs, "radialGradient", id + "h", {}, [[0, t, a * (tinted ? T.haloAlpha : O.haloAlpha)], [1, t, 0]]);
    g.appendChild(sv("circle", { cx: x, cy: y, r: (L.r * O.haloR).toFixed(3), fill: "url(#" + id + "h)", "class": "orbit-star-halo" }));
    if (L.spiked) {
      var len = L.r * O.spikeLen, w = O.spikeWidth, ray = [[0, t, 0], [0.5, t, a * (tinted ? T.rayAlpha : O.spikeAlpha)], [1, t, 0]];
      starGradient(defs, "linearGradient", id + "v", { x1: "0", y1: "0", x2: "0", y2: "1" }, ray);
      starGradient(defs, "linearGradient", id + "x", { x1: "0", y1: "0", x2: "1", y2: "0" }, ray);
      var rays = sv("g", { "class": "orbit-star-rays" });
      rays.appendChild(sv("rect", { x: (st.x - w / 2).toFixed(2), y: (st.y - len).toFixed(2), width: String(w), height: (2 * len).toFixed(2), fill: "url(#" + id + "v)", "class": "orbit-star-ray" }));
      rays.appendChild(sv("rect", { x: (st.x - len).toFixed(2), y: (st.y - w / 2).toFixed(2), width: (2 * len).toFixed(2), height: String(w), fill: "url(#" + id + "x)", "class": "orbit-star-ray" }));
      g.appendChild(rays);
    }
    var c = tinted ? mixWhite(t, T.coreMix) : (a > O.brightAbove ? mixWhite(t, O.brightMix) : t);
    starGradient(defs, "radialGradient", id + "c", {}, [[0, c, a], [1, t, a * (tinted ? T.coreEdgeAlpha : O.coreEdgeAlpha)]]);
    g.appendChild(sv("circle", { cx: x, cy: y, r: (L.r * O.coreR).toFixed(3), fill: "url(#" + id + "c)", "class": "orbit-star-core" }));
    if (glint) {
      // A brighter flash now and then: a light-tinted glow and a short cross, hidden between glints.
      var gl = sv("g", { "class": "orbit-star-glint" }), gr = L.r * STAR_TWINKLE.glintR, gLen = L.r * STAR_TWINKLE.glintLen, light = mixWhite(t, tinted ? T.coreMix : 1);
      starGradient(defs, "radialGradient", id + "g", {}, [[0, light, 1], [0.35, t, 0.55], [1, t, 0]]);
      gl.appendChild(sv("circle", { cx: x, cy: y, r: gr.toFixed(3), fill: "url(#" + id + "g)" }));
      gl.appendChild(sv("rect", { x: (st.x - 0.6).toFixed(2), y: (st.y - gLen).toFixed(2), width: "1.2", height: (2 * gLen).toFixed(2), fill: "url(#" + id + "v)" }));
      gl.appendChild(sv("rect", { x: (st.x - gLen).toFixed(2), y: (st.y - 0.6).toFixed(2), width: (2 * gLen).toFixed(2), height: "1.2", fill: "url(#" + id + "x)" }));
      g.appendChild(gl);
    }
    return g;
  }
  // ONE fixed set: laid out once, and again ONLY when the panel's width changes (a height change, a hover, an open portal,
  // a preview, Refresh or new figures never lays them out again).
  var starsDrawn = "";
  function starsWidth() { return String(Math.round(panel.getBoundingClientRect().width)); }
  function drawStars() {
    if (!starsSvg || !panel || !panel.getBoundingClientRect) return;
    var key = starsWidth();
    if (key === starsDrawn) return;
    starsDrawn = key;
    var g = starGeometry();
    while (starsSvg.firstChild) starsSvg.removeChild(starsSvg.firstChild);
    var defs = sv("defs", {});
    starsSvg.appendChild(defs);
    var sky = starLayout(g);
    sky.forEach(function (st) { starsSvg.appendChild(starNode(st, defs)); });
    // The grid it was laid out on, for the checks: columns, rows, and the cells skipped and reused.
    var r = sky.report;
    starsSvg.setAttribute("data-sky", [r.count, r.cols, r.rows, r.skipped, r.rehomed, r.asMedium, r.dimmed, r.unplaced].join(","));
  }
  function buildOrbit() {
    svg.appendChild(sv("ellipse", { cx: VIEW.cx, cy: VIEW.cy, rx: VIEW.rx, ry: VIEW.ry, "class": "orbit-ring" }));
    svg.appendChild(sv("ellipse", { cx: VIEW.cx, cy: VIEW.cy, rx: VIEW.innerRx, ry: VIEW.innerRy, "class": "orbit-ring-inner" }));
    // The links and beams live in the ring's frame: a circle of radius rx squashed to the ellipse, so turning one is a rotation.
    var frame = sv("g", { "class": "orbit-beams", transform: "translate(" + VIEW.cx + " " + VIEW.cy + ") scale(1 " + (VIEW.ry / VIEW.rx) + ")" });
    // The faint dotted links: Grow to Sell, and Sell to a point under the core to Connect (drawn at base 0, turned with the ring).
    links = sv("g", { "class": "orbit-links" });
    links.appendChild(sv("path", { d: "M " + framePoint(0, VIEW.rx) + " L " + framePoint(72, VIEW.rx), "class": "orbit-link", "vector-effect": "non-scaling-stroke" }));
    links.appendChild(sv("path", { d: "M " + framePoint(72, VIEW.rx) + " L " + framePoint(108, 175) + " L " + framePoint(144, VIEW.rx), "class": "orbit-link", "vector-effect": "non-scaling-stroke" }));
    frame.appendChild(links);
    PORTALS.forEach(function (p) {
      var g = sv("g", { "class": "orbit-beam", "data-portal": p.key });
      var d = "M 0 " + VIEW.rx + " Q 22 " + (VIEW.rx / 2) + " 0 0";
      g.appendChild(sv("path", { d: d, "class": "orbit-beam-glow", "vector-effect": "non-scaling-stroke" }));
      g.appendChild(sv("path", { d: d, "class": "orbit-beam-line", "vector-effect": "non-scaling-stroke" }));
      g.appendChild(sv("circle", { r: "3.5", "class": "orbit-beam-dot" }));
      g.setAttribute("hidden", "");
      g.style.display = "none";
      frame.appendChild(g);
      beam[p.key] = g;
    });
    svg.appendChild(frame);
    // The core's decorative halo and its fixed three-quarter arc (no goal yet, so never a percentage).
    svg.appendChild(sv("circle", { cx: VIEW.cx, cy: VIEW.cy, r: VIEW.coreHaloR, "class": "orbit-core-halo" }));
    svg.appendChild(sv("path", { d: "M " + VIEW.cx + " " + (VIEW.cy - VIEW.coreHaloR) + " A " + VIEW.coreHaloR + " " + VIEW.coreHaloR + " 0 1 1 " + (VIEW.cx - VIEW.coreHaloR) + " " + VIEW.cy, "class": "orbit-core-arc" }));

    core = el("button", "orbit-core");
    core.type = "button";
    core.id = "orbitCore";
    core.setAttribute("aria-expanded", "false");
    core.setAttribute("aria-controls", "orbitAllTools");
    core.appendChild(el("span", "orbit-core-label", "This week"));
    core.appendChild(el("strong", "orbit-core-figure", ""));
    core.appendChild(el("span", "orbit-core-unit", "Loading..."));
    core.appendChild(el("span", "orbit-core-all", "All tools"));
    core.addEventListener("click", function () { setAllTools(!state.allOpen); });
    stage.appendChild(core);

    PORTALS.forEach(function (p) {
      var b = el("button", "orbit-portal");
      b.type = "button";
      b.setAttribute("data-portal", p.key);
      b.setAttribute("aria-label", p.title + ", " + p.tools.length + " tools");
      b.setAttribute("aria-pressed", "false");
      b.setAttribute("aria-controls", "orbitGrid");
      var disc = el("span", "orbit-disc");
      disc.appendChild(el("span", "orbit-halo"));
      disc.appendChild(emblem(p.key));
      var bd = el("span", "orbit-badge");
      bd.id = "orbitBadge-" + p.key;
      bd.hidden = true;
      disc.appendChild(bd);
      b.appendChild(disc);
      var name = el("span", "orbit-portal-name");
      name.appendChild(el("span", "orbit-portal-title", p.title));
      name.appendChild(document.createTextNode(""));
      b.appendChild(name);
      portalName[p.key] = name;
      badge[p.key] = bd;
      b.addEventListener("click", function () { toggle(p.key); });
      b.addEventListener("mouseenter", function () { showPreview(p.key); });
      b.addEventListener("mouseleave", hidePreview);
      b.addEventListener("focus", function () { showPreview(p.key); });
      b.addEventListener("blur", hidePreview);
      stage.appendChild(b);
      portalBtn[p.key] = b;
    });
    stage.addEventListener("mouseenter", function () { state.hover = true; });
    stage.addEventListener("mouseleave", function () { state.hover = false; kick(); });
    stage.addEventListener("focusin", function () { state.focus = true; });
    stage.addEventListener("focusout", function () { state.focus = false; kick(); });
  }
  function indexOfPortal(key) { for (var i = 0; i < PORTALS.length; i++) if (PORTALS[i].key === key) return i; return -1; }
  function frontBase(key) { return FRONT_DEG - indexOfPortal(key) * STEP_DEG; }
  // The panel's scale (its width / 680), as --os: every circle is sized from it. On a phone the row uses a fixed 46 px disc.
  function size() {
    var s = narrow() ? 46 / 54 : (stage.clientWidth ? stage.clientWidth / VIEW.w : 1);
    stage.style.setProperty("--os", s.toFixed(4));
  }
  // Each frame: transforms only. Every portal is the same size (r 27); none is scaled for depth.
  function place() {
    var scale = stage.clientWidth ? stage.clientWidth / VIEW.w : 1;
    PORTALS.forEach(function (p, i) {
      var deg = state.base + i * STEP_DEG, rad = deg * Math.PI / 180;
      var x = VIEW.cx + VIEW.rx * Math.sin(rad), y = VIEW.cy + VIEW.ry * Math.cos(rad);
      portalBtn[p.key].style.transform = "translate(" + (x * scale).toFixed(1) + "px, " + (y * scale).toFixed(1) + "px) translate(-50%, -50%)";
      beam[p.key].setAttribute("transform", "rotate(" + (-deg).toFixed(2) + ")");
    });
    links.setAttribute("transform", "rotate(" + (-state.base).toFixed(2) + ")");
    core.style.transform = "translate(" + (VIEW.cx * scale).toFixed(1) + "px, " + (VIEW.cy * scale).toFixed(1) + "px) translate(-50%, -50%)";
  }
  function drifting() { return !state.open && !state.hover && !state.focus && !reduced() && !document.hidden && !narrow(); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function tick(ts) {
    state.frame = 0;
    var dt = state.last ? Math.min(ts - state.last, 100) : 0;
    state.last = ts;
    if (state.turn) {
      if (!state.turn.start) state.turn.start = ts;
      var t = Math.min(1, (ts - state.turn.start) / TURN_MS);
      state.base = state.turn.from + (state.turn.to - state.turn.from) * easeOut(t);
      if (t >= 1) state.turn = null;
    } else if (drifting()) {
      state.base += dt * 360 / DRIFT_MS;
    }
    place();
    if (state.turn || drifting()) kick();
  }
  function kick() {
    if (state.frame || document.hidden || typeof window.requestAnimationFrame !== "function") return;
    if (!state.turn && !drifting()) { state.last = 0; return; }
    state.frame = window.requestAnimationFrame(tick);
  }
  function turnTo(key) {
    var target = frontBase(key);
    var delta = ((target - state.base) % 360 + 540) % 360 - 180;   // the short way round
    if (reduced() || narrow()) { state.turn = null; state.base += delta; place(); return; }
    state.turn = { from: state.base, to: state.base + delta, start: 0 };
    kick();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (state.frame && window.cancelAnimationFrame) window.cancelAnimationFrame(state.frame); state.frame = 0; state.last = 0; }
    else kick();
  });

  /* ── opening a portal ── */
  function toggle(key) { if (state.open === key) fold(); else openPortal(key, true); }
  function openPortal(key, turn) {
    state.open = key;
    writeSession(key);
    // The open portal is set apart by its halo and "(open)" alone: the others keep full opacity.
    PORTALS.forEach(function (p) {
      var on = p.key === key;
      portalBtn[p.key].setAttribute("aria-pressed", on ? "true" : "false");
      portalBtn[p.key].classList.toggle("is-open", on);
      portalName[p.key].lastChild.nodeValue = on ? " (open)" : "";
    });
    if (turn) turnTo(key); else { state.base = frontBase(key); place(); }
    drawGrid();
  }
  function fold() {
    state.open = null;
    writeSession(null);
    PORTALS.forEach(function (p) {
      portalBtn[p.key].setAttribute("aria-pressed", "false");
      portalBtn[p.key].classList.remove("is-open");
      portalName[p.key].lastChild.nodeValue = "";
    });
    drawGrid();
    kick();
  }
  function liveLine(slug) {
    var fig = figureFor(slug, state.top);
    return fig ? el("p", "orbit-live", fig.text) : null;
  }
  function boxFor(slug) {
    var t = TOOL[slug];
    if (!t) return null;
    var box = t.node.cloneNode(true);
    box.classList.add("orbit-box");
    var line = liveLine(slug);
    if (line) {
      var btn = box.querySelector("a.bf-btn, button.bf-btn");
      var p = box.querySelector("p");
      if (p && p.parentNode) p.parentNode.insertBefore(line, p.nextSibling);
      else if (btn && btn.parentNode) btn.parentNode.insertBefore(line, btn);
      else box.appendChild(line);
    }
    return box;
  }
  function drawGrid() {
    clear(grid);
    var portal = null;
    PORTALS.forEach(function (p) { if (p.key === state.open) portal = p; });
    if (!portal) { grid.hidden = true; grid.removeAttribute("data-portal"); return; }
    grid.hidden = false;
    grid.setAttribute("data-portal", portal.key);
    grid.setAttribute("aria-label", portal.title + " tools");
    var slugs = portal.tools.filter(function (s) { return state.mains.indexOf(s) === -1 && TOOL[s]; });
    var ordered = orderTools(slugs, state.top);
    ordered.forEach(function (r, i) {
      var box = boxFor(r.slug);
      if (!box) return;
      if (i === 0 && r.fig && r.fig.value > 0) box.classList.add("orbit-box-wide");
      grid.appendChild(box);
    });
  }

  /* ── the main boxes ── */
  function spark(series, label) {
    var w = 168, h = 40, max = Math.max.apply(null, series.concat([1]));
    var s = sv("svg", { viewBox: "0 0 " + w + " " + h, "class": "orbit-spark", role: "img", "aria-label": label });
    var pts = series.map(function (v, i) { return (i * (w - 4) / (series.length - 1) + 2).toFixed(1) + "," + (h - 3 - (v / max) * (h - 8)).toFixed(1); });
    // A 1.8 px line over a 5 px glow at 15% (the stylesheet's widths, kept by non-scaling-stroke).
    s.appendChild(sv("polyline", { points: pts.join(" "), "class": "orbit-spark-glow", "vector-effect": "non-scaling-stroke" }));
    s.appendChild(sv("polyline", { points: pts.join(" "), "class": "orbit-spark-line", "vector-effect": "non-scaling-stroke" }));
    var lastPt = pts[pts.length - 1].split(",");
    s.appendChild(sv("circle", { cx: lastPt[0], cy: lastPt[1], r: "2.5", "class": "orbit-spark-dot" }));
    return s;
  }
  /* A main box: one big number and its label, one green line, the 14-day line. No description. */
  function bigNumber(value, label) {
    var big = el("p", "orbit-big");
    big.appendChild(el("strong", null, value));
    big.appendChild(el("span", null, label));
    return big;
  }
  function smallLink(text, href) { var a = el("a", "orbit-connect", text); a.setAttribute("href", href); return a; }
  function trendLine(v) {
    if (v.last_week > 0) { var pct = Math.round((v.this_week - v.last_week) / v.last_week * 100); return (pct >= 0 ? "+" : "") + pct + "% on last week"; }
    return v.this_week > 0 ? "Up from 0 last week" : "Same as last week";
  }
  function analyticsFigures(box) {
    var v = state.top && state.top.visits;
    var wrap = el("div", "orbit-figures");
    if (!state.top) return wrap;
    if (!v || n(v.this_week) === null) { wrap.appendChild(el("p", "orbit-live", "Visits could not be read just now")); return wrap; }
    if (v.tracked === false) {
      wrap.appendChild(bigNumber(0, "tracked visits"));
      wrap.appendChild(smallLink("Add tracked links to see visits", (TOOL.analytics && TOOL.analytics.href) || "/analytics-dashboard.html"));
      return wrap;
    }
    wrap.appendChild(bigNumber(v.this_week, v.this_week === 1 ? "tracked visit" : "tracked visits"));
    if (n(v.last_week) !== null) wrap.appendChild(el("p", "orbit-second", trendLine(v)));
    if (Array.isArray(v.per_day) && v.per_day.length > 1) wrap.appendChild(spark(v.per_day, "Tracked visits, last 14 days"));
    return wrap;
  }
  function storeFigures(box) {
    var st = state.top && state.top.store;
    var wrap = el("div", "orbit-figures");
    if (!state.top) return wrap;
    if (!st) { wrap.appendChild(el("p", "orbit-live", "Your store could not be read just now")); return wrap; }
    if (st.low_stock && n(st.low_stock.count) !== null) wrap.appendChild(bigNumber(st.low_stock.count, st.low_stock.count === 1 ? "item low on stock" : "items low on stock"));
    else wrap.appendChild(el("p", "orbit-live", "Stock could not be read just now"));
    if (st.connected === false) { wrap.appendChild(smallLink("Connect a store to see orders", "store-agent.html")); return wrap; }
    if (n(st.orders_this_week) !== null) wrap.appendChild(el("p", "orbit-second", plural(st.orders_this_week, "order", "orders") + " this week"));
    if (Array.isArray(st.orders_per_day) && st.orders_per_day.length > 1) wrap.appendChild(spark(st.orders_per_day, "Orders, last 14 days"));
    return wrap;
  }
  // Any other tool chosen with Swap: its figure as the big number when it starts with one ("18 customers"), else one line.
  function otherFigures(slug) {
    var fig = figureFor(slug, state.top);
    var wrap = el("div", "orbit-figures");
    if (!fig) return wrap;
    var m = /^(\d[\d.,]*) (.+)$/.exec(fig.text);
    wrap.appendChild(m ? bigNumber(m[1], m[2]) : el("p", "orbit-second", fig.text));
    return wrap;
  }
  function drawMains() {
    clear(mainWrap);
    state.mains.forEach(function (slug, i) {
      var t = TOOL[slug];
      if (!t) return;
      var box = t.node.cloneNode(true);
      box.classList.add("orbit-main-box");
      box.setAttribute("data-main", String(i));
      if (!box.getAttribute("data-card")) box.setAttribute("data-card", slug);
      // No long description in a main box: the descriptions stay on the grid boxes.
      Array.prototype.slice.call(box.querySelectorAll("p")).forEach(function (p) { p.parentNode.removeChild(p); });
      // The header row: the icon and title on the left, Swap on the right.
      var head = el("div", "orbit-main-head");
      var icon = box.querySelector(".bf-neon-icon"), title = box.querySelector("h3");
      if (icon) head.appendChild(icon);
      if (title) head.appendChild(title);
      box.insertBefore(head, box.firstChild);
      var stale = box.querySelector(".orbit-dir-head");
      if (stale && !stale.firstChild) stale.parentNode.removeChild(stale);
      var figs = slug === "analytics" ? analyticsFigures(box) : slug === "store" ? storeFigures(box) : otherFigures(slug);
      var open = box.querySelector("a.bf-btn") || box.querySelector(".orbit-dir-actions");
      if (open && open.parentNode) open.parentNode.insertBefore(figs, open);
      else box.appendChild(figs);
      var swap = el("button", "orbit-swap", "Swap");
      swap.type = "button";
      swap.setAttribute("aria-expanded", "false");
      swap.addEventListener("click", function (e) {
        e.stopPropagation();
        var list = box.querySelector(".orbit-swap-list");
        if (list) { list.parentNode.removeChild(list); swap.setAttribute("aria-expanded", "false"); return; }
        box.appendChild(swapList(i));
        swap.setAttribute("aria-expanded", "true");
      });
      head.appendChild(swap);
      mainWrap.appendChild(box);
    });
  }
  function swapList(i) {
    var ul = el("ul", "orbit-swap-list");
    ul.setAttribute("aria-label", "Choose the tool for this box");
    ul.addEventListener("click", function (e) { e.stopPropagation(); });
    everyTool().forEach(function (slug) {
      if (slug === state.mains[i]) return;
      var li = el("li");
      var b = el("button", null, TOOL[slug].title);
      b.type = "button";
      b.setAttribute("data-tool", slug);
      b.addEventListener("click", function (e) { e.stopPropagation(); chooseMain(i, slug); });
      li.appendChild(b);
      ul.appendChild(li);
    });
    return ul;
  }
  function chooseMain(i, slug) {
    var other = state.mains[1 - i];
    if (slug === other) state.mains[1 - i] = state.mains[i];   // choosing the other box's tool swaps the two
    state.mains[i] = slug;
    writeLocal(JSON.stringify(state.mains));
    drawMains();
    drawGrid();
  }

  /* ── All tools ── */
  function setAllTools(on) {
    state.allOpen = on;
    core.setAttribute("aria-expanded", on ? "true" : "false");
    allTools.hidden = !on;
    if (!on) return;
    clear(allTools);
    GROUPS.forEach(function (g) {
      var sec = el("div", "orbit-group");
      sec.setAttribute("data-group", g.key);
      sec.appendChild(el("h3", null, g.title));
      var ul = el("ul");
      g.tools.forEach(function (slug) {
        var t = TOOL[slug];
        if (!t || !t.href) return;
        var li = el("li");
        var a = el("a", null, t.title);
        a.setAttribute("href", t.href);
        li.appendChild(a);
        ul.appendChild(li);
      });
      sec.appendChild(ul);
      allTools.appendChild(sec);
    });
  }

  /* ── the preview ── */
  function previewText(key) {
    var p = PORTALS[indexOfPortal(key)];
    var figs = orderTools(p.tools, state.top).filter(function (r) { return r.fig; }).slice(0, 2).map(function (r) { return r.fig.text; });
    return p.title + ": " + (figs.length ? figs.join(" · ") : p.tools.length + " tools");
  }
  function showPreview(key) { preview.textContent = previewText(key); preview.hidden = false; }
  function hidePreview() { preview.hidden = true; }

  /* ── the figures on the orbit: core, badges, beams ── */
  function drawOrbitFigures() {
    var top = state.top;
    // The core: THIS WEEK, the tracked visits large, "tracked visits", All tools. A count, never a percentage.
    var fig = core.querySelector(".orbit-core-figure"), unit = core.querySelector(".orbit-core-unit");
    var v = top && top.visits;
    var figure = "", words;
    if (!top) words = "Loading...";
    else if (!v || n(v.this_week) === null) words = "Visits unavailable";
    else if (v.tracked === false) words = "No tracked visits yet";
    else { figure = String(v.this_week); words = v.this_week === 1 ? "tracked visit" : "tracked visits"; }
    fig.textContent = figure;
    fig.hidden = !figure;
    unit.textContent = words;
    var a = attention(top);
    PORTALS.forEach(function (p) {
      var k = a[p.key] || 0;
      badge[p.key].hidden = !(k > 0);
      badge[p.key].textContent = k > 0 ? String(k) : "";
      if (k > 0) portalBtn[p.key].setAttribute("aria-describedby", badge[p.key].id);
      else portalBtn[p.key].removeAttribute("aria-describedby");
      var on = k > 0;
      if (on) { beam[p.key].removeAttribute("hidden"); beam[p.key].style.display = ""; }
      else { beam[p.key].setAttribute("hidden", ""); beam[p.key].style.display = "none"; }
      beam[p.key].classList.toggle("is-still", reduced());
    });
  }

  /* ── the quick search ── */
  function editable(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName.toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || t.isContentEditable === true ||
      (t.getAttribute && t.getAttribute("contenteditable") !== null && t.getAttribute("contenteditable") !== "false");
  }
  function slashKey(e) {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return false;
    if (editable(e.target) || editable(document.activeElement)) return false;
    return true;
  }
  document.addEventListener("keydown", function (e) {
    if (!slashKey(e)) return;
    e.preventDefault();
    search.focus();
  });
  function matchTools(q) {
    q = String(q || "").trim().toLowerCase();
    if (!q) return [];
    return everyTool().filter(function (slug) {
      var g = groupOf(slug);
      return TOOL[slug].title.toLowerCase().indexOf(q) !== -1 || (g && g.title.toLowerCase().indexOf(q) !== -1);
    }).slice(0, SEARCH_MAX);
  }
  function drawResults() {
    clear(results);
    state.matches = matchTools(search.value);
    if (state.active >= state.matches.length) state.active = state.matches.length - 1;
    if (!state.matches.length) {
      results.hidden = true;
      search.setAttribute("aria-expanded", "false");
      search.removeAttribute("aria-activedescendant");
      return;
    }
    state.matches.forEach(function (slug, i) {
      var li = el("li");
      li.id = "orbitResult-" + i;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === state.active ? "true" : "false");
      var a = el("a", null, TOOL[slug].title);
      a.setAttribute("href", TOOL[slug].href);
      a.setAttribute("tabindex", "-1");
      li.appendChild(a);
      li.appendChild(el("span", "orbit-result-group", groupOf(slug).title));
      results.appendChild(li);
    });
    results.hidden = false;
    search.setAttribute("aria-expanded", "true");
    if (state.active >= 0) search.setAttribute("aria-activedescendant", "orbitResult-" + state.active);
    else search.removeAttribute("aria-activedescendant");
  }
  function closeSearch() {
    state.active = -1;
    search.value = "";
    drawResults();
  }
  search.addEventListener("input", function () { state.active = 0; drawResults(); });
  search.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!state.matches.length) return;
      e.preventDefault();
      var k = state.matches.length;
      state.active = e.key === "ArrowDown" ? (state.active + 1) % k : (state.active - 1 + k) % k;
      drawResults();
    } else if (e.key === "Enter") {
      if (state.active < 0 || !state.matches[state.active]) return;
      e.preventDefault();
      api.go(TOOL[state.matches[state.active]].href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeSearch();
      search.blur();
    }
  });
  // Escape inside the orbit folds the open portal. Scoped to this section, so the guide's own Escape is untouched.
  root.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || e.defaultPrevented || e.target === search) return;
    if (state.allOpen) { setAllTools(false); core.focus(); return; }
    if (state.open) { var was = state.open; fold(); portalBtn[was].focus(); }
  });

  /* ── the one read ── */
  function load() {
    var base = (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK;
    var token = null;
    try { token = window.localStorage.getItem("bf_token"); } catch (e) { token = null; }
    if (status) status.textContent = "Reading your figures...";
    return fetch(base + "/api/dashboard/top", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok || !res.body || typeof res.body !== "object") throw new Error("not read");
        state.top = res.body;
        if (status) status.textContent = "";
      })
      .catch(function () {
        state.top = null;
        if (status) status.textContent = "Your figures could not be read just now. The tools all work; press Refresh to try again.";
      })
      .then(function () {
        drawOrbitFigures();
        drawMains();
        if (!state.open && !readSession() && !state.chosen) { state.chosen = true; openPortal(firstPortal(state.top), false); }
        else drawGrid();
      });
  }
  refresh.addEventListener("click", function () { load(); });

  var api = {
    PORTALS: PORTALS, UTILITIES: UTILITIES, DRIFT_MS: DRIFT_MS, TURN_MS: TURN_MS, SYNODIC_DAYS: SYNODIC_DAYS,
    VIEW: VIEW, FRONT_DEG: FRONT_DEG, REST_BASE: REST_BASE, frontBase: frontBase,
    ORACLE_STAR: ORACLE_STAR, STAR_TINTS: STAR_TINTS, STAR_LAYERS: STAR_LAYERS, starLooks: starLooks, starReach: starReach, starLayout: starLayout, starGeometry: starGeometry, drawStars: drawStars,
    STAR_SKY: STAR_SKY, starCount: starCount, starMix: starMix, starGrid: starGrid,
    STAR_SHARES: STAR_SHARES, STAR_TINT_NAMES: STAR_TINT_NAMES, STAR_TINT_LOOK: STAR_TINT_LOOK, STAR_TWINKLE: STAR_TWINKLE, STAR_KEEP: STAR_KEEP,
    starTints: starTints, starTwinkle: starTwinkle, starLabelHalf: starLabelHalf,
    moonPhase: moonPhase, moonPath: moonPath, figureFor: figureFor, orderTools: orderTools, attention: attention, firstPortal: firstPortal,
    slashKey: slashKey, state: state, load: load, open: function (k) { openPortal(k, true); }, fold: fold, tools: function () { return TOOL; },
    go: function (url) { window.location.assign(url); }
  };
  window.BFOrbit = api;

  buildOrbit();
  size();
  var remembered = readSession();
  if (remembered && indexOfPortal(remembered) !== -1) { state.chosen = true; openPortal(remembered, false); }
  else { state.base = REST_BASE; place(); }
  drawOrbitFigures();
  drawMains();
  kick();
  window.addEventListener("resize", function () { size(); place(); });
  drawStars();
  window.addEventListener("resize", drawStars);
  window.addEventListener("load", drawStars);
  // NAMED (Nov 11 2026, one living sky): the panel's own resize lays the stars out again only when its WIDTH changed; a
  // height-only change (a preview, the status line, the results list) is ignored.
  if (typeof ResizeObserver === "function" && panel) {
    try { new ResizeObserver(function () { if (starsWidth() !== starsDrawn) drawStars(); }).observe(panel); } catch (e) { /* the resize and load calls stand */ }
  }
  // The twinkle rests while the tab is hidden or the panel is off the screen.
  var starsOff = false;
  function starsPause() { if (starsSvg) starsSvg.classList.toggle("is-paused", !!document.hidden || starsOff); }
  document.addEventListener("visibilitychange", starsPause);
  if (typeof IntersectionObserver === "function" && panel) {
    try { new IntersectionObserver(function (es) { starsOff = !es[es.length - 1].isIntersecting; starsPause(); }).observe(panel); } catch (e) { /* the hidden-tab pause stands */ }
  }
  starsPause();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
}());

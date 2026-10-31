/* scripts/bf-profile-design.js — a member's profile design, drawn.

   A member designs their public profile in "Customise profile" (scripts/
   bf-profile-editor.js) and the server stores it in bf_profiles.profile_design
   after checking it against a CLOSED schema (backend lib/profileDesign.js).
   This file draws a design on the three pages a visitor sees it on: the
   public profile (profile.html), the support page (/support/<username>) and
   the storefront (seller.html).

   HOW IT DRAWS, AND WHY IT IS SAFE. A design holds enums, numbers, lowercase
   hex colours, item ids and a theme; there is no CSS, HTML or URL in it. Even
   so, nothing a design holds is ever written into style or markup as it
   came: normalise() checks every value again (an unknown or out-of-range
   value becomes the default), each enum becomes a data-pd-* attribute on
   <html> that this file's own stylesheet maps to fixed CSS, each number
   becomes a token (--pd-*) that this file formats itself, a colour is used
   only after it matches /^#[0-9a-f]{6}$/, and ids only ever choose an order.
   The shapes' clip-paths are constants here. The theme goes through
   BFTheme.wear (scripts/bf-theme.js), the same tokensFor every page uses,
   with its readability protection; the theme's photo is the server's own
   https storage URL, checked again by bf-theme.js. The visitor's own theme
   is never applied: the page wears the OWNER's.

   WHAT IT DRAWS.
     the theme       the member's profile theme (or the original look)
     the banner      its height (Small, Medium, Large, Full-bleed or a custom
                     height), the image's focal point and zoom, an overlay
                     darkness and feathered edges
     the photo       its size (S, M, L, XL), its shape (circle, rounded
                     square, square, hexagon, octagon, shield, diamond, soft
                     blob; by clip-path), and a ring (none, solid or the theme
                     gradient) with its width and glow; the photo keeps its
                     alt text, given one when it had none
     the layout      Standard (today's), Classic centred, Split hero (the
                     photo on the left), Magazine (a big banner with the photo
                     overlapping it) or Minimal (text first); each responsive
     the sections    their order and which are shown (profile.html)
     the grid        2, 3 or 4 columns; square, portrait or masonry; a gap;
                     and its saved order
     the videos      a row carousel or a grid, the first video featured
                     large, and the lineup's saved order

   The support page carries the design as JSON data in
   <script type="application/json" id="bfProfileDesign"> and this file draws
   it on load; profile.html and seller.html call apply() once their data is
   in. On profile.html?bf_preview=1 (the editor's live preview, in an iframe
   on the member's own page) it also takes drafts from its parent window,
   from the same origin only. */
(function () {
  "use strict";
  if (window.BFProfileDesign) return;

  var HEX = /^#[0-9a-f]{6}$/;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  var LAYOUTS = ["standard", "classic", "split", "magazine", "minimal"];
  var BANNER_HEIGHTS = ["s", "m", "l", "full", "custom"];
  var PHOTO_SIZES = ["s", "m", "l", "xl"];
  var SHAPES = ["circle", "rounded", "square", "hexagon", "octagon", "shield", "diamond", "blob"];
  var RINGS = ["none", "solid", "gradient"];
  var SECTIONS = ["links", "about", "support", "listings", "grid", "videos", "music"];
  var GRID_COLUMNS = [2, 3, 4];
  var GRID_STYLES = ["square", "portrait", "masonry"];
  var GAPS = ["s", "m", "l"];
  var VIDEO_LAYOUTS = ["carousel", "grid"];
  var DEFAULT = {
    v: 1,
    theme: null,
    layout: "standard",
    banner: { height: "m", custom_px: 300, focus_x: 50, focus_y: 50, zoom: 100, overlay: 0.35, feather: 0 },
    photo: { size: "m", shape: "circle", ring: "solid", ring_width: 3, ring_glow: 0.5, ring_color: "#22d3ee" },
    sections: SECTIONS.map(function (k) { return { key: k, show: true }; }),
    grid: { columns: 3, style: "square", gap: "m", order: [] },
    videos: { layout: "grid", featured: false, order: [] }
  };
  var RANGES = {
    banner: { custom_px: [120, 640], focus_x: [0, 100], focus_y: [0, 100], zoom: [100, 300], overlay: [0, 0.85], feather: [0, 50] },
    photo: { ring_width: [0, 12], ring_glow: [0, 1] }
  };
  var ENUMS = {
    banner: { height: BANNER_HEIGHTS },
    photo: { size: PHOTO_SIZES, shape: SHAPES, ring: RINGS },
    grid: { columns: GRID_COLUMNS, style: GRID_STYLES, gap: GAPS },
    videos: { layout: VIDEO_LAYOUTS }
  };
  /* Each banner height and photo size, in px; Full-bleed is the window's height. */
  var BANNER_PX = { s: 180, m: 300, l: 420 };
  var PHOTO_PX = { s: 96, m: 140, l: 176, xl: 220 };
  var GAP_PX = { s: 8, m: 16, l: 24 };
  /* A soft blob: 24 points around the centre, the radius a gentle sum of waves. */
  function blob() {
    var pts = [];
    for (var i = 0; i < 24; i++) {
      var a = i / 24 * Math.PI * 2, r = 44 + 4 * Math.sin(3 * a) + 2 * Math.cos(2 * a + 1);
      pts.push((50 + r * Math.cos(a)).toFixed(1) + "% " + (50 + r * Math.sin(a)).toFixed(1) + "%");
    }
    return "polygon(" + pts.join(", ") + ")";
  }
  /* The eight shapes. Constants: nothing from a design is ever placed in them. */
  var CLIP = {
    circle: "circle(50% at 50% 50%)",
    rounded: "inset(0 round 18%)",
    square: "inset(0)",
    hexagon: "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)",
    octagon: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
    shield: "polygon(50% 0%, 100% 12%, 100% 55%, 50% 100%, 0% 55%, 0% 12%)",
    diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
    blob: blob()
  };
  var SHAPE_NAMES = { circle: "Circle", rounded: "Rounded square", square: "Square", hexagon: "Hexagon", octagon: "Octagon",
    shield: "Shield", diamond: "Diamond", blob: "Soft blob" };
  var LAYOUT_NAMES = { standard: "Standard", classic: "Classic centred", split: "Split hero", magazine: "Magazine", minimal: "Minimal" };
  var SECTION_NAMES = { links: "Links", about: "About", support: "Support", listings: "Listings", grid: "Portfolio grid", videos: "Videos", music: "Music" };
  /* Where each section is on profile.html. */
  var SECTION_IDS = { links: "sec-links", about: "sec-about", support: "sec-support", listings: "sec-products", grid: "sec-portfolio", videos: "sec-videos", music: "sec-music" };
  var ATTRS = ["data-pd", "data-pd-layout", "data-pd-banner", "data-pd-feather", "data-pd-photo-size", "data-pd-shape", "data-pd-ring",
    "data-pd-grid-cols", "data-pd-grid-style", "data-pd-grid-gap", "data-pd-video-layout", "data-pd-featured", "data-pd-page"];
  var TOKENS = ["--pd-banner-h", "--pd-focus", "--pd-zoom", "--pd-overlay", "--pd-feather", "--pd-photo", "--pd-ring-w", "--pd-ring-glow",
    "--pd-ring-color", "--pd-glow-color", "--pd-cols", "--pd-gap"];

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function isObject(x) { return !!x && typeof x === "object" && !Array.isArray(x); }
  function num(n) { return String(Math.round(n * 1000) / 1000); }
  function clamp(value, range, fallback) {
    if (typeof value !== "number" || !isFinite(value)) return fallback;
    return Math.min(range[1], Math.max(range[0], value));
  }

  /* A design as this page will draw it: every value checked again, anything
     unknown or out of range at its default. null stays null (the default look). */
  function normalise(input) {
    if (!isObject(input)) return null;
    var d = clone(DEFAULT);
    d.theme = isObject(input.theme) ? input.theme : null;
    if (LAYOUTS.indexOf(input.layout) !== -1) d.layout = input.layout;
    ["banner", "photo", "grid", "videos"].forEach(function (part) {
      var src = isObject(input[part]) ? input[part] : {};
      var en = ENUMS[part] || {}, rg = RANGES[part] || {};
      Object.keys(en).forEach(function (k) { if (en[k].indexOf(src[k]) !== -1) d[part][k] = src[k]; });
      Object.keys(rg).forEach(function (k) { d[part][k] = clamp(src[k], rg[k], d[part][k]); });
      if (part === "photo" && typeof src.ring_color === "string" && HEX.test(src.ring_color)) d.photo.ring_color = src.ring_color;
      if (part === "videos" && typeof src.featured === "boolean") d.videos.featured = src.featured;
      if ((part === "grid" || part === "videos") && Array.isArray(src.order)) {
        d[part].order = src.order.filter(function (id, i, all) { return typeof id === "string" && UUID.test(id) && all.indexOf(id) === i; }).slice(0, part === "grid" ? 200 : 100);
      }
    });
    if (Array.isArray(input.sections)) {
      var seen = [], out = [];
      input.sections.forEach(function (s) {
        if (isObject(s) && SECTIONS.indexOf(s.key) !== -1 && seen.indexOf(s.key) === -1) {
          seen.push(s.key);
          out.push({ key: s.key, show: s.show !== false });
        }
      });
      SECTIONS.forEach(function (k) { if (seen.indexOf(k) === -1) out.push({ key: k, show: true }); });
      d.sections = out;
    }
    return d;
  }

  /* Items in the design's saved order: the ids it names first, in that order,
     then every other item as it came. */
  function ordered(items, part, design) {
    var list = Array.isArray(items) ? items.slice() : [];
    var d = normalise(design);
    var order = d && d[part] && Array.isArray(d[part].order) ? d[part].order : [];
    if (!order.length) return list;
    return list.map(function (it, i) { return { it: it, i: i, at: it && order.indexOf(it.id) }; })
      .sort(function (a, b) {
        var x = a.at === -1 ? Infinity : a.at, y = b.at === -1 ? Infinity : b.at;
        return x - y || a.i - b.i;
      }).map(function (x) { return x.it; });
  }

  /* ── the stylesheet: every look is here, keyed by data-pd-* on <html> ── */
  function clipRules() {
    return SHAPES.map(function (s) { return "html[data-pd-shape=" + s + "] .pd-clip{clip-path:" + CLIP[s] + "}"; });
  }
  var CSS = [
    /* the banner */
    "html[data-pd=on] .pf-banner,html[data-pd=on] #sfBanner{height:var(--pd-banner-h)}",
    "html[data-pd=on] .pf-banner-img{object-position:var(--pd-focus);transform:scale(var(--pd-zoom));transform-origin:var(--pd-focus);transition:none}",
    "html[data-pd=on] .pf-banner:hover .pf-banner-img{transform:scale(var(--pd-zoom))}",
    "html[data-pd=on] .pf-banner-overlay{background:linear-gradient(rgba(5,8,18,var(--pd-overlay)),rgba(5,8,18,var(--pd-overlay)))}",
    "html[data-pd=on] #sfBanner{position:relative;overflow:hidden;background-size:0 0}",
    "html[data-pd=on] #sfBanner::before{content:\"\";position:absolute;inset:0;background-image:inherit;background-repeat:no-repeat;background-size:cover;background-position:var(--pd-focus);transform:scale(var(--pd-zoom));transform-origin:var(--pd-focus)}",
    "html[data-pd=on] #sfBanner.no-image{background-size:auto}",
    "html[data-pd=on] #sfBanner::after{content:\"\";position:absolute;inset:0;background:rgba(5,8,18,var(--pd-overlay))}",
    "html[data-pd-feather=on] .pf-banner,html[data-pd-feather=on] #sfBanner{-webkit-mask-image:linear-gradient(to right,transparent 0,#000 var(--pd-feather),#000 calc(100% - var(--pd-feather)),transparent 100%),linear-gradient(to bottom,#000 calc(100% - var(--pd-feather)),transparent 100%);-webkit-mask-composite:source-in;mask-image:linear-gradient(to right,transparent 0,#000 var(--pd-feather),#000 calc(100% - var(--pd-feather)),transparent 100%),linear-gradient(to bottom,#000 calc(100% - var(--pd-feather)),transparent 100%);mask-composite:intersect}",
    /* the photo: size, ring, glow; the shape is clip-path (clipRules) */
    "html[data-pd=on] .pd-ring{box-sizing:border-box;width:var(--pd-photo);height:var(--pd-photo);padding:var(--pd-ring-w);border:0;border-radius:0;box-shadow:none;animation:none;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;flex-shrink:0}",
    "html[data-pd-ring=solid] .pd-ring{background:var(--pd-ring-color)}",
    "html[data-pd-ring=gradient] .pd-ring{background:linear-gradient(135deg,var(--bf-accent-a, #22d3ee)var(--bf-accent-mid, ),var(--bf-accent-b, #a855f7))}",
    "html[data-pd-ring=none] .pd-ring{padding:0}",
    "html[data-pd=on] .pd-ring>img{width:100%;height:100%;object-fit:cover;display:block;border:0;border-radius:0;box-shadow:none}",
    /* the initials: shown as a flex box; an inline display:none (a photo is set) still wins */
    "html[data-pd=on] .pd-ring>.pd-inner{width:100%;height:100%;border:0;border-radius:0;box-shadow:none;background:rgba(12,16,40,.95);display:flex;align-items:center;justify-content:center}",
    "html[data-pd=on] .pf-avatar-edit{border-radius:0}",
    "html[data-pd=on] .pd-glow{filter:drop-shadow(0 0 calc(var(--pd-ring-glow) * 22px) var(--pd-glow-color))}",
    "html[data-pd-ring=none] .pd-glow{filter:none}",
    "@media (max-width:680px){html[data-pd=on] .pd-ring{width:calc(var(--pd-photo) * .75);height:calc(var(--pd-photo) * .75)}html[data-pd=on] .pf-banner,html[data-pd=on] #sfBanner{height:calc(var(--pd-banner-h) * .66)}}",
    /* the layouts (profile.html) */
    "html[data-pd-layout=classic] .pf-header{flex-direction:column;align-items:center;text-align:center}",
    "html[data-pd-layout=classic] .pf-name-block{min-width:0;width:100%}",
    "html[data-pd-layout=classic] .pf-name-row,html[data-pd-layout=classic] .pf-meta-row,html[data-pd-layout=classic] .pf-social-row{justify-content:center}",
    "html[data-pd-layout=split] .pf-banner{height:calc(var(--pd-banner-h) * .6)}",
    "html[data-pd-layout=split] .pf-header{margin-top:28px;align-items:center;gap:32px;flex-wrap:nowrap}",
    "html[data-pd-layout=split] .pf-name-block{padding:22px 24px;border-radius:18px;background:rgba(12,16,38,.72);border:1px solid rgba(255,255,255,.07)}",
    "html[data-pd-layout=split] .pf-display-name{font-size:clamp(1.8rem,4.6vw,2.6rem)}",
    "html[data-pd-layout=magazine] .pf-banner{height:max(var(--pd-banner-h),420px)}",
    "html[data-pd-layout=magazine] .pf-header{margin-top:-130px;align-items:flex-end}",
    "html[data-pd-layout=magazine] .pf-display-name{font-size:clamp(2rem,6vw,3.4rem);text-shadow:0 2px 18px rgba(0,0,0,.65)}",
    "html[data-pd-layout=magazine] .pf-tagline{text-shadow:0 1px 10px rgba(0,0,0,.6)}",
    "html[data-pd-layout=minimal] .pf-banner{height:6px;background:linear-gradient(90deg,var(--bf-accent-a, #22d3ee),var(--bf-accent-b, #a855f7))}",
    "html[data-pd-layout=minimal] .pf-banner>*{display:none}",
    "html[data-pd-layout=minimal] .pf-header{margin-top:40px;flex-direction:row-reverse;justify-content:space-between;align-items:center}",
    "html[data-pd-layout=minimal] .pf-display-name{font-size:clamp(2rem,6vw,3.2rem)}",
    "html[data-pd-layout=minimal] .pd-ring{width:min(var(--pd-photo),96px);height:min(var(--pd-photo),96px)}",
    "@media (max-width:760px){html[data-pd-layout=split] .pf-header,html[data-pd-layout=minimal] .pf-header{flex-direction:column;align-items:center;text-align:center;flex-wrap:wrap;gap:16px}" +
      "html[data-pd-layout=split] .pf-name-row,html[data-pd-layout=minimal] .pf-name-row,html[data-pd-layout=split] .pf-meta-row,html[data-pd-layout=minimal] .pf-meta-row{justify-content:center}" +
      "html[data-pd-layout=magazine] .pf-banner{height:max(calc(var(--pd-banner-h) * .66),300px)}html[data-pd-layout=magazine] .pf-header{margin-top:-80px}}",
    /* the sections */
    "html[data-pd=on] [data-pd-hidden=true]{display:none!important}",
    "html[data-pd=on] #sec-links .pf-social-row{margin-bottom:0}",
    /* the grid */
    "html[data-pd=on] #portfolioGrid{display:grid;grid-template-columns:repeat(var(--pd-cols),minmax(0,1fr));gap:var(--pd-gap)}",
    "html[data-pd-grid-style=square] .pf-portfolio-photo,html[data-pd-grid-style=square] #portfolioGrid .sf-card-img-wrap{height:auto;aspect-ratio:1/1}",
    "html[data-pd-grid-style=portrait] .pf-portfolio-photo,html[data-pd-grid-style=portrait] #portfolioGrid .sf-card-img-wrap{height:auto;aspect-ratio:3/4}",
    "html[data-pd-grid-style=masonry] #portfolioGrid{display:block;column-count:var(--pd-cols);column-gap:var(--pd-gap)}",
    "html[data-pd-grid-style=masonry] #portfolioGrid>*{break-inside:avoid;margin-bottom:var(--pd-gap);display:block}",
    "html[data-pd-grid-style=masonry] .pf-portfolio-photo,html[data-pd-grid-style=masonry] #portfolioGrid .sf-card-img-wrap{height:auto;aspect-ratio:auto}",
    "html[data-pd-grid-style=masonry] #portfolioGrid img{height:auto}",
    "@media (max-width:680px){html[data-pd-grid-cols=\"3\"] #portfolioGrid,html[data-pd-grid-cols=\"4\"] #portfolioGrid{grid-template-columns:repeat(2,minmax(0,1fr))}html[data-pd-grid-cols=\"3\"][data-pd-grid-style=masonry] #portfolioGrid,html[data-pd-grid-cols=\"4\"][data-pd-grid-style=masonry] #portfolioGrid{column-count:2}}",
    /* the videos */
    "html[data-pd-video-layout=carousel] #videosGrid{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:16px;padding-bottom:8px}",
    "html[data-pd-video-layout=carousel] #videosGrid>*{flex:0 0 min(320px,80%);scroll-snap-align:start}",
    "html[data-pd-video-layout=carousel][data-pd-featured=on] #videosGrid>:first-child{flex-basis:min(560px,92%)}",
    "html[data-pd-video-layout=grid][data-pd-featured=on] #videosGrid>:first-child{grid-column:1/-1}",
    /* the theme on the public pages that have their own backdrop: the theme's layers under the content */
    "html.pd-themed body{background:transparent}"
  ].concat(clipRules());

  function injectStyle(doc) {
    if (doc.getElementById("bf-profile-design-style")) return;
    var st = doc.createElement("style");
    st.id = "bf-profile-design-style";
    st.textContent = CSS.join("\n");
    (doc.head || doc.documentElement).appendChild(st);
  }

  /* ── the photo's parts: a glow around a ring around the clipped picture ── */
  function wrap(doc, el, cls) {
    if (el.parentNode && el.parentNode.classList && el.parentNode.classList.contains(cls)) return el.parentNode;
    var w = doc.createElement(el.tagName === "IMG" ? "span" : "div");
    w.className = cls;
    el.parentNode.insertBefore(w, el);
    w.appendChild(el);
    return w;
  }
  function photoParts(doc, page) {
    if (page === "profile") {
      var ring = doc.getElementById("avatarEl");
      if (!ring) return null;
      return { glow: ring.parentNode, ring: ring, img: doc.getElementById("avatarImg"),
        inner: [doc.getElementById("avatarInitials")], extra: Array.prototype.slice.call(doc.querySelectorAll(".pf-avatar-edit")) };
    }
    if (page === "seller") {
      var img = doc.getElementById("sfAvatarImg"), ini = doc.getElementById("sfAvatarInitials");
      var holder = img && img.parentNode;
      if (!holder) return null;
      return { glow: wrap(doc, holder, "pd-glow-host"), ring: holder, img: img, inner: ini ? [ini] : [], extra: [] };
    }
    if (page === "support") {
      var ph = doc.querySelector(".sup-photo");
      if (!ph) return null;
      var r = wrap(doc, ph, "pd-ring-host");
      return { glow: wrap(doc, r, "pd-glow-host"), ring: r, img: ph.tagName === "IMG" ? ph : null, inner: ph.tagName === "IMG" ? [] : [ph], extra: [] };
    }
    return null;
  }
  function markPhoto(doc, page, on, name) {
    var p = photoParts(doc, page);
    if (!p) return;
    function cls(el, c) { if (el && el.classList) el.classList[on ? "add" : "remove"](c); }
    cls(p.glow, "pd-glow"); cls(p.ring, "pd-ring"); cls(p.ring, "pd-clip");
    if (p.img) cls(p.img, "pd-clip");
    p.inner.forEach(function (el) { cls(el, "pd-clip"); cls(el, "pd-inner"); });
    p.extra.forEach(function (el) { cls(el, "pd-clip"); });
    /* The picture keeps its alt text; one with none is given its owner's. */
    if (on && p.img && !p.img.getAttribute("alt")) p.img.setAttribute("alt", name ? name + "'s profile photo" : "Profile photo");
  }

  /* ── the sections (profile.html) ──────────────────────────────────────── */
  function arrangeSections(doc, d) {
    var host = doc.querySelector(".pf-sections");
    if (!host) return;
    var card = doc.getElementById("sec-card");
    var list = d ? d.sections : DEFAULT.sections;
    list.forEach(function (s) {
      var el = doc.getElementById(SECTION_IDS[s.key]);
      if (!el || el.parentNode !== host) return;
      host.insertBefore(el, card && card.parentNode === host ? card : null);
      if (d && s.show === false) el.setAttribute("data-pd-hidden", "true");
      else el.removeAttribute("data-pd-hidden");
    });
  }

  /* ── the theme ────────────────────────────────────────────────────────── */
  var themeQueued = null;
  function withTheme(doc, then) {
    if (window.BFTheme) return then();
    themeQueued = then;
    if (doc.getElementById("bf-profile-design-theme")) return;
    var s = doc.createElement("script");
    s.id = "bf-profile-design-theme";
    s.src = "/scripts/bf-theme.js";
    s.addEventListener("load", function () { if (window.BFTheme && themeQueued) { var f = themeQueued; themeQueued = null; f(); } });
    (doc.head || doc.documentElement).appendChild(s);
  }
  /* The base body::before of bf-theme's rule, made to win over a public
     page's own (seller.html draws its own backdrop there). Our constant, not
     a design's. */
  function themedOverride(doc) {
    if (doc.getElementById("bf-profile-design-themed")) return;
    var m = /(?:^|\n)body::before \{\n([\s\S]*?)\n\}/.exec((window.BFTheme && window.BFTheme.RULE) || "");
    if (!m) return;
    var st = doc.createElement("style");
    st.id = "bf-profile-design-themed";
    st.textContent = "html.pd-themed body::before {\n" + m[1] + "\n}";
    (doc.head || doc.documentElement).appendChild(st);
  }
  function applyTheme(doc, page, d, photoUrl) {
    var theme = d && d.theme;
    var root = doc.documentElement;
    /* The owner's own profile, with a design, shows exactly what visitors see:
       the profile's theme, or the original look. */
    var wanted = theme || (d && page === "profile" && window.BFTheme ? window.BFTheme.DEFAULT_THEME : null);
    if (!wanted) {
      root.classList.remove("pd-themed");
      root.style.removeProperty("--bf-backdrop-z");
      if (window.BFTheme && window.BFTheme.wear) window.BFTheme.wear(null);
      return;
    }
    withTheme(doc, function () {
      if (!window.BFTheme || !window.BFTheme.wear) return;
      window.BFTheme.wear(wanted, typeof photoUrl === "string" ? photoUrl : null);
      if (page !== "profile") {
        themedOverride(doc);
        root.classList.add("pd-themed");
        root.style.setProperty("--bf-backdrop-z", "-1");
      }
    });
  }

  /* ── drawing a design ─────────────────────────────────────────────────── */
  var current = null;
  /* apply(design, { page: "profile" | "seller" | "support", photoUrl, name, doc }) */
  function apply(design, opts) {
    opts = opts || {};
    var doc = opts.doc || document;
    var page = opts.page || "profile";
    var root = doc.documentElement;
    var d = normalise(design);
    current = d;
    injectStyle(doc);
    ATTRS.forEach(function (a) { root.removeAttribute(a); });
    TOKENS.forEach(function (t) { root.style.removeProperty(t); });
    markPhoto(doc, page, !!d, opts.name);
    if (page === "profile") arrangeSections(doc, d);
    applyTheme(doc, page, d, opts.photoUrl);
    if (!d) return null;
    var b = d.banner, p = d.photo;
    root.setAttribute("data-pd", "on");
    root.setAttribute("data-pd-page", page);
    root.setAttribute("data-pd-layout", page === "profile" ? d.layout : "standard");
    root.setAttribute("data-pd-banner", b.height);
    root.setAttribute("data-pd-feather", b.feather > 0 ? "on" : "off");
    root.setAttribute("data-pd-photo-size", p.size);
    root.setAttribute("data-pd-shape", p.shape);
    root.setAttribute("data-pd-ring", p.ring);
    root.setAttribute("data-pd-grid-cols", String(d.grid.columns));
    root.setAttribute("data-pd-grid-style", d.grid.style);
    root.setAttribute("data-pd-grid-gap", d.grid.gap);
    root.setAttribute("data-pd-video-layout", d.videos.layout);
    root.setAttribute("data-pd-featured", d.videos.featured ? "on" : "off");
    var tok = {
      "--pd-banner-h": b.height === "full" ? "100vh" : num(b.height === "custom" ? b.custom_px : BANNER_PX[b.height]) + "px",
      "--pd-focus": num(b.focus_x) + "% " + num(b.focus_y) + "%",
      "--pd-zoom": num(b.zoom / 100),
      "--pd-overlay": num(b.overlay),
      "--pd-feather": num(b.feather) + "%",
      "--pd-photo": num(PHOTO_PX[p.size]) + "px",
      "--pd-ring-w": num(p.ring === "none" ? 0 : p.ring_width) + "px",
      "--pd-ring-glow": num(p.ring_glow),
      "--pd-ring-color": HEX.test(p.ring_color) ? p.ring_color : DEFAULT.photo.ring_color,
      "--pd-glow-color": p.ring === "solid" && HEX.test(p.ring_color) ? p.ring_color : "var(--bf-accent-a, #22d3ee)",
      "--pd-cols": num(d.grid.columns),
      "--pd-gap": num(GAP_PX[d.grid.gap]) + "px"
    };
    Object.keys(tok).forEach(function (k) { root.style.setProperty(k, tok[k]); });
    return d;
  }

  /* The editor's live preview: a draft from the parent window (same origin). */
  function previewing() {
    try { return new URLSearchParams(window.location.search).get("bf_preview") === "1"; } catch (e) { return false; }
  }
  if (previewing()) {
    window.addEventListener("message", function (e) {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      var m = e.data;
      if (!m || m.type !== "bf-profile-preview") return;
      apply(m.design, { page: "profile", photoUrl: m.photo_url, name: m.name });
      if (typeof window.bfProfileDesignChanged === "function") window.bfProfileDesignChanged(current);
    });
    /* The mist and the boombox stay out of the preview. */
    var hide = document.createElement("style");
    hide.textContent = "#tmx-presence-root,#tmx-chat,.bfm-float{display:none!important}";
    (document.head || document.documentElement).appendChild(hide);
  }

  /* The support page carries its design as JSON data. */
  function fromData() {
    var el = document.getElementById("bfProfileDesign");
    if (!el) return;
    var data = null;
    try { data = JSON.parse(el.textContent || "null"); } catch (e) { data = null; }
    if (!data || !isObject(data.design)) return;
    var nameEl = document.getElementById("supName");
    apply(data.design, { page: "support", photoUrl: data.photo_url, name: nameEl ? nameEl.textContent : "" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fromData);
  else fromData();

  window.BFProfileDesign = {
    DEFAULT: DEFAULT, LAYOUTS: LAYOUTS, BANNER_HEIGHTS: BANNER_HEIGHTS, PHOTO_SIZES: PHOTO_SIZES, SHAPES: SHAPES, RINGS: RINGS,
    SECTIONS: SECTIONS, GRID_COLUMNS: GRID_COLUMNS, GRID_STYLES: GRID_STYLES, GAPS: GAPS, VIDEO_LAYOUTS: VIDEO_LAYOUTS,
    CLIP: CLIP, SHAPE_NAMES: SHAPE_NAMES, LAYOUT_NAMES: LAYOUT_NAMES, SECTION_NAMES: SECTION_NAMES, SECTION_IDS: SECTION_IDS,
    BANNER_PX: BANNER_PX, PHOTO_PX: PHOTO_PX, GAP_PX: GAP_PX, RANGES: RANGES, CSS: CSS,
    normalise: normalise, ordered: ordered, apply: apply,
    current: function () { return current ? clone(current) : null; },
    previewing: previewing
  };
})();

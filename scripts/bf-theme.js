/* scripts/bf-theme.js — the member's look, on every page that wears one.

   LOADED FIRST IN <head>, as a plain blocking script, on the 57 pages with the
   app's backdrop. It runs before anything is painted, so a saved look is on
   screen from the first frame and nothing flashes:
     1. it writes THE BACKDROP RULE below into a <style> at the top of <head>;
     2. it reads bf_theme, this device's cache of the member's themes, picks
        the one this page wears (its own, else the main one, else none) and
        sets that theme's tokens on <html>;
     3. once the page has loaded, it asks GET /api/themes (at most once a
        minute) and sets the tokens again only if they came back different.
   With no theme saved, it sets nothing, and each page looks exactly as it
   always has.

   THE BACKDROP RULE replaces the body::before every page used to carry in its
   own <style>. Two layers, both fixed and under everything:
     html::before   the middle: --bf-bg, the member's photo if any (cover,
                    centred), and a black shade of --bf-bg-dim over it;
     body::before   the glows: top-left --bf-glow-a, bottom-right --bf-glow-b,
                    an optional third (--bf-glow-c, only profile.html uses it),
                    and over them the readability scrim --bf-scrim.
   They are two layers so "Alive corners" can move the glows, by transform
   and opacity on body::before alone, while the middle stays still. A page
   keeps its own look by setting the GEOMETRY tokens (where each glow sits,
   its shape, how far it reaches, its z-index) in its own :root; the defaults
   are the look 48 pages already shared. The defaults are declared at
   :where(:root), which has no specificity, so a page's :root always wins, and
   a member's theme (set on <html>'s style) wins over both.

   PUBLIC PAGES never load this file: seller, support, card-view, the blog, a
   listing and the legal pages keep their OWNER's look, never the visitor's.
   UNTHEMED below repeats that list in case one ever does, and profile.html
   wears no theme while it shows somebody else's profile.

   READABILITY. Any colour may be chosen; none is refused. The text colours
   are measured against the brightest point of the backdrop (each glow at its
   centre over the middle, and the middle itself; a photo counts as the
   brightest luminance read from it when it was saved). If body text #e8e8ff
   falls under 7:1 or muted text #8892b8 under 4.5:1, the shade is raised:
   first --bf-bg-dim over the middle, until the middle alone passes, then
   --bf-scrim over the glows, until the brightest point passes. Both are
   raised in steps of 0.01, the least that passes. readability() says which
   happened, for the meter in Settings → Theme.

   bf_theme IS A DEVICE DISPLAY CACHE, left at sign-out like the other
   display choices (scripts/bf-session.js says why). It is applied only when
   it belongs to the member signed in, or when nobody is.

   NOTHING ELSE IS STORED, and no network is used before the page has loaded. */
(function () {
  "use strict";

  var CACHE_KEY = "bf_theme";
  var CACHE_VERSION = 1;
  var FETCH_EVERY_MS = 60 * 1000;
  var API_ORIGIN_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var STYLE_ID = "bf-theme-rule";

  var TEXT = "#e8e8ff";
  var MUTED = "#8892b8";
  var ACCENT = "#22d3ee";
  var TEXT_MIN = 7;
  var MUTED_MIN = 4.5;
  var SHADE_MAX = 0.95;
  var BLACK = "#070b18";

  /* Today's look, the same values as lib/themes.js DEFAULT_THEME. */
  var DEFAULT_THEME = {
    v: 1,
    glow_a: "#00e5ff",
    glow_a_alpha: 0.14,
    glow_b: "#a855f7",
    glow_b_alpha: 0.18,
    middle: "black",
    bg: "#070b18",
    photo: null,
    dim: 0.55,
    photo_luma: 0,
    alive: false
  };

  /* The same list as lib/themes.js UNTHEMED. */
  var UNTHEMED = [
    "seller.html", "support.html", "card-view.html", "blogindex.html", "blogpost.html", "listing.html",
    "suppressed.html", "vitality.html", "terms.html", "privacy.html", "refund.html", "contact.html",
    "reset-password.html", "verify-email.html", "your-data.html", "xxl-xtreme.html"
  ];

  /* The tokens a theme sets. Everything else in the rule is a page's own. */
  var THEME_TOKENS = [
    "--bf-bg", "--bf-bg-image", "--bf-bg-dim",
    "--bf-glow-a", "--bf-glow-a-rgb", "--bf-glow-a-alpha",
    "--bf-glow-b", "--bf-glow-b-rgb", "--bf-glow-b-alpha",
    "--bf-alive", "--bf-scrim"
  ];

  var RULE =
    ":where(:root) {\n" +
    "  --bf-bg: #070b18;\n" +
    "  --bf-bg-image: none;\n" +
    "  --bf-bg-dim: 0;\n" +
    "  --bf-glow-a: #00e5ff;\n" +
    "  --bf-glow-a-rgb: 0, 229, 255;\n" +
    "  --bf-glow-a-alpha: 0.14;\n" +
    "  --bf-glow-b: #a855f7;\n" +
    "  --bf-glow-b-rgb: 168, 85, 247;\n" +
    "  --bf-glow-b-alpha: 0.18;\n" +
    "  --bf-alive: 0;\n" +
    "  --bf-scrim: 0;\n" +
    "  --bf-glow-a-shape: circle;\n" +
    "  --bf-glow-a-at: 15% 10%;\n" +
    "  --bf-glow-a-reach: 38%;\n" +
    "  --bf-glow-b-shape: circle;\n" +
    "  --bf-glow-b-at: 85% 90%;\n" +
    "  --bf-glow-b-reach: 40%;\n" +
    "  --bf-glow-c: transparent;\n" +
    "  --bf-glow-c-shape: circle;\n" +
    "  --bf-glow-c-at: 50% 50%;\n" +
    "  --bf-backdrop-z: 0;\n" +
    "}\n" +
    "html::before {\n" +
    "  content: \"\"; position: fixed; inset: 0; z-index: var(--bf-backdrop-z); pointer-events: none;\n" +
    "  background:\n" +
    "    linear-gradient(rgba(0, 0, 0, var(--bf-bg-dim)), rgba(0, 0, 0, var(--bf-bg-dim))),\n" +
    "    var(--bf-bg-image) center / cover no-repeat,\n" +
    "    var(--bf-bg);\n" +
    "}\n" +
    "body::before {\n" +
    "  content: \"\"; position: fixed; inset: 0; z-index: var(--bf-backdrop-z); pointer-events: none;\n" +
    "  background:\n" +
    "    linear-gradient(rgba(0, 0, 0, var(--bf-scrim)), rgba(0, 0, 0, var(--bf-scrim))),\n" +
    "    radial-gradient(var(--bf-glow-a-shape) at var(--bf-glow-a-at), rgba(var(--bf-glow-a-rgb), var(--bf-glow-a-alpha)), transparent var(--bf-glow-a-reach)),\n" +
    "    radial-gradient(var(--bf-glow-b-shape) at var(--bf-glow-b-at), rgba(var(--bf-glow-b-rgb), var(--bf-glow-b-alpha)), transparent var(--bf-glow-b-reach)),\n" +
    "    radial-gradient(var(--bf-glow-c-shape) at var(--bf-glow-c-at), var(--bf-glow-c), transparent);\n" +
    "}\n" +
    "@keyframes bf-glow-drift {\n" +
    "  0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }\n" +
    "  35%  { transform: translate3d(-2.5%, 2%, 0) scale(1.06); opacity: 0.82; }\n" +
    "  70%  { transform: translate3d(2%, -1.5%, 0) scale(1.03); opacity: 0.94; }\n" +
    "  100% { transform: translate3d(1%, 2.5%, 0) scale(1.05); opacity: 0.86; }\n" +
    "}\n" +
    ":root[data-bf-alive=\"1\"] body::before {\n" +
    "  inset: -8%; animation: bf-glow-drift 32s ease-in-out infinite alternate; will-change: transform, opacity;\n" +
    "}\n" +
    "@media (prefers-reduced-motion: reduce) {\n" +
    "  :root[data-bf-alive=\"1\"] body::before { inset: 0; animation: none; will-change: auto; }\n" +
    "}\n";

  /* ── colour arithmetic (WCAG 2 relative luminance) ──────────────────── */
  function rgbOf(hex) {
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ""));
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function linear(c) { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function luminance(rgb) { return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]); }
  function contrast(a, b) {
    var la = luminance(a), lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /* `top` at `alpha` over `under`, composited as the browser does. */
  function over(top, alpha, under) {
    return [0, 1, 2].map(function (i) { return under[i] + alpha * (top[i] - under[i]); });
  }
  function shade(rgb, amount) { return over([0, 0, 0], amount, rgb); }
  /* A grey with relative luminance `y` (a photo is known by its luminance). */
  function greyOf(y) {
    y = Math.min(1, Math.max(0, Number(y) || 0));
    var s = y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
    return [s * 255, s * 255, s * 255];
  }
  function brightest(points) {
    return points.reduce(function (best, p) { return luminance(p) > luminance(best) ? p : best; });
  }
  function ratiosAt(point) {
    return {
      text: contrast(rgbOf(TEXT), point),
      muted: contrast(rgbOf(MUTED), point),
      accent: contrast(rgbOf(ACCENT), point)
    };
  }
  function passes(point) {
    var r = ratiosAt(point);
    return r.text >= TEXT_MIN && r.muted >= MUTED_MIN;
  }

  function normalTheme(theme) {
    var out = {};
    Object.keys(DEFAULT_THEME).forEach(function (k) {
      out[k] = theme && theme[k] !== undefined ? theme[k] : DEFAULT_THEME[k];
    });
    return out;
  }

  /* How readable a theme is, and the least shade that makes it so. */
  function readability(theme) {
    var t = normalTheme(theme);
    var middle = t.middle === "colour" ? rgbOf(t.bg) : t.middle === "photo" ? greyOf(t.photo_luma) : rgbOf(BLACK);
    var a = rgbOf(t.glow_a) || rgbOf(DEFAULT_THEME.glow_a), b = rgbOf(t.glow_b) || rgbOf(DEFAULT_THEME.glow_b);
    var userDim = t.middle === "photo" ? Number(t.dim) || 0 : 0;
    function peak(dim, scrim) {
      var m = shade(middle || rgbOf(BLACK), dim);
      return shade(brightest([m, over(a, t.glow_a_alpha, m), over(b, t.glow_b_alpha, m)]), scrim);
    }
    var before = ratiosAt(peak(userDim, 0));
    var dimSteps = Math.round(userDim * 100), scrimSteps = 0;
    while (!passes(shade(middle || rgbOf(BLACK), dimSteps / 100)) && dimSteps < SHADE_MAX * 100) dimSteps++;
    while (!passes(peak(dimSteps / 100, scrimSteps / 100)) && scrimSteps < SHADE_MAX * 100) scrimSteps++;
    var dim = dimSteps / 100, scrim = scrimSteps / 100;
    return {
      readable: before.text >= TEXT_MIN && before.muted >= MUTED_MIN,
      protected: dim > userDim || scrim > 0,
      dim: dim,
      scrim: scrim,
      before: before,
      ratios: ratiosAt(peak(dim, scrim))
    };
  }

  function reducedMotion(win) {
    try { return !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  /* A photo URL is only ever the server's own https storage URL, and never
     anything that could close the url( ). */
  function safePhotoUrl(url) {
    return typeof url === "string" && /^https:\/\/[^\s"'()\\<>]+$/.test(url) ? url : null;
  }

  /* The tokens one theme sets: { "--bf-...": value }, and whether it moves. */
  function tokensFor(theme, photoUrl, win) {
    var t = normalTheme(theme);
    var r = readability(t);
    var a = rgbOf(t.glow_a) || rgbOf(DEFAULT_THEME.glow_a), b = rgbOf(t.glow_b) || rgbOf(DEFAULT_THEME.glow_b);
    var url = t.middle === "photo" ? safePhotoUrl(photoUrl) : null;
    var alive = t.alive === true && !reducedMotion(win || window);
    return {
      "--bf-bg": t.middle === "colour" ? t.bg : BLACK,
      "--bf-bg-image": url ? "url(\"" + url + "\")" : "none",
      "--bf-bg-dim": String(r.dim),
      "--bf-glow-a": t.glow_a,
      "--bf-glow-a-rgb": a.join(", "),
      "--bf-glow-a-alpha": String(t.glow_a_alpha),
      "--bf-glow-b": t.glow_b,
      "--bf-glow-b-rgb": b.join(", "),
      "--bf-glow-b-alpha": String(t.glow_b_alpha),
      "--bf-alive": alive ? "1" : "0",
      "--bf-scrim": String(r.scrim)
    };
  }

  /* ── which page, which member, which theme ─────────────────────────── */
  function pageKey(doc, loc) {
    var named = doc.documentElement.getAttribute("data-bf-page");
    if (named) return named.toLowerCase();
    var file = String((loc && loc.pathname) || "").split("/").pop();
    if (!file) file = "index.html";
    if (!/\.html$/i.test(file)) file += ".html";
    return file.toLowerCase();
  }
  function signedInId(win) {
    var token = null;
    try { token = win.localStorage.getItem("bf_token"); } catch (e) { token = null; }
    if (!token) return null;
    try { return JSON.parse(win.atob(token.split(".")[1])).id || null; } catch (e) { return null; }
  }
  /* A page that shows somebody else's things wears no visitor's theme. */
  function publicView(key, win) {
    if (UNTHEMED.indexOf(key) !== -1) return true;
    if (key === "profile.html") {
      var id = null;
      try { id = new URLSearchParams(win.location.search).get("id"); } catch (e) { id = null; }
      return !!id && id !== signedInId(win);
    }
    return false;
  }
  /* The theme a page wears in a state from GET /api/themes, or null. */
  function resolve(state, key) {
    if (!state || !Array.isArray(state.themes)) return null;
    var id = (state.page_themes && state.page_themes[key]) || state.default_theme_id || null;
    if (!id) return null;
    for (var i = 0; i < state.themes.length; i++) if (state.themes[i] && state.themes[i].id === id) return state.themes[i];
    return null;
  }

  function readCache(win) {
    try {
      var c = JSON.parse(win.localStorage.getItem(CACHE_KEY) || "null");
      return c && c.v === CACHE_VERSION && c.state ? c : null;
    } catch (e) { return null; }
  }
  function writeCache(win, uid, state, fetchedAt) {
    try {
      win.localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, uid: uid, fetched_at: fetchedAt, state: state }));
    } catch (e) { /* storage unavailable: the page still shows the theme it fetched */ }
  }

  /* ── putting it on the page ─────────────────────────────────────────── */
  function injectRule(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = RULE;
    var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;
    head.insertBefore(style, head.firstChild);
  }
  var applied = null;
  function setTokens(doc, tokens) {
    var root = doc.documentElement;
    THEME_TOKENS.forEach(function (name) {
      if (tokens && tokens[name] !== undefined) root.style.setProperty(name, tokens[name]);
      else root.style.removeProperty(name);
    });
    if (tokens && tokens["--bf-alive"] === "1") root.setAttribute("data-bf-alive", "1");
    else root.removeAttribute("data-bf-alive");
    applied = tokens ? JSON.stringify(tokens) : null;
  }
  function tokensForPage(state, key, win) {
    var row = resolve(state, key);
    return row ? tokensFor(row.theme, row.photo_url, win) : null;
  }
  /* Sets this page's tokens from a state, only when they differ. */
  function applyState(state, win, doc) {
    win = win || window; doc = doc || document;
    var key = pageKey(doc, win.location);
    var tokens = publicView(key, win) ? null : tokensForPage(state, key, win);
    if ((tokens ? JSON.stringify(tokens) : null) === applied) return false;
    setTokens(doc, tokens);
    return true;
  }

  function apiOrigin(win) {
    var configured = (typeof win.API_URL === "string" && win.API_URL) || API_ORIGIN_FALLBACK;
    try { return new URL(configured, win.location.href).origin; } catch (e) { return null; }
  }

  /* After the page has loaded: the member's themes, fresh. */
  function refresh(win, doc, force) {
    win = win || window; doc = doc || document;
    var uid = signedInId(win);
    var key = pageKey(doc, win.location);
    if (!uid || publicView(key, win) || typeof win.fetch !== "function") return Promise.resolve(false);
    var cache = readCache(win);
    var now = Date.now();
    if (!force && cache && cache.uid === uid && now - (cache.fetched_at || 0) < FETCH_EVERY_MS) return Promise.resolve(false);
    var origin = apiOrigin(win);
    if (!origin) return Promise.resolve(false);
    var token = null;
    try { token = win.localStorage.getItem("bf_token"); } catch (e) { token = null; }
    return win.fetch(origin + "/api/themes", { headers: { "Authorization": "Bearer " + token } })
      .then(function (res) { return res && res.ok ? res.json() : null; })
      .then(function (state) {
        if (!state || !Array.isArray(state.themes)) return false;
        writeCache(win, uid, state, now);
        return applyState(state, win, doc);
      })
      .catch(function () { return false; });
  }

  /* The studio saves through the API and hands the new state here. */
  function stateChanged(state, win, doc) {
    win = win || window; doc = doc || document;
    writeCache(win, signedInId(win), state, Date.now());
    return applyState(state, win, doc);
  }

  /* ── before first paint ─────────────────────────────────────────────── */
  function boot(win, doc) {
    injectRule(doc);
    var cache = readCache(win);
    var uid = signedInId(win);
    if (cache && (!uid || cache.uid === uid)) applyState(cache.state, win, doc);
    var later = function () { refresh(win, doc, false); };
    if (doc.readyState === "loading" && doc.addEventListener) doc.addEventListener("DOMContentLoaded", later);
    else later();
  }

  window.BFTheme = {
    DEFAULT_THEME: DEFAULT_THEME,
    UNTHEMED: UNTHEMED,
    THEME_TOKENS: THEME_TOKENS,
    RULE: RULE,
    TEXT: TEXT, MUTED: MUTED, ACCENT: ACCENT, TEXT_MIN: TEXT_MIN, MUTED_MIN: MUTED_MIN,
    rgbOf: rgbOf,
    luminance: luminance,
    contrast: contrast,
    readability: readability,
    tokensFor: tokensFor,
    pageKey: function () { return pageKey(document, window.location); },
    publicView: function (key) { return publicView(key, window); },
    resolve: resolve,
    readCache: function () { return readCache(window); },
    applyState: function (state) { return applyState(state, window, document); },
    stateChanged: function (state) { return stateChanged(state, window, document); },
    refresh: function (force) { return refresh(window, document, force); },
    reducedMotion: function () { return reducedMotion(window); }
  };

  boot(window, document);
})();

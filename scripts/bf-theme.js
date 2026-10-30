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

   THE ELEMENT PALETTES (Block 4b) colour the rest of the look: the buttons
   (--bf-btn-a, --bf-btn-b, --bf-btn-text), the wordmark (--bf-mark-a,
   --bf-mark-b), the guide's lettering (--bf-guide-a, --bf-guide-b), the
   glow behind Termaximus's chat box (--tmx-chat-glow-a, -b, -c) and every
   colour of the mist (--tmx-core-1 … and the rest of MIST below). Every place
   that draws one reads it as var(--token, its own colour), so with the token
   unset each place is exactly what it was, and these tokens have NO default
   in the rule. A theme sets an element's tokens only when that element is not
   at its original (the mist colour by colour), and then every place follows.
   Its readability is kept too, and nothing is refused:
     the button lettering is at least 4.5:1 on both ends of its gradient: if
       not, it is set to white or near-black, whichever reads better, and if
       neither reaches 4.5:1 it is white and the gradient is shaded, 0.01 at
       a time, until it does;
     the guide's lettering is at least 4.5:1 on its panel, and the wordmark
       at least 3:1 (it is large text) on the header; each end too dark for
       that is lightened toward white, 0.01 at a time. Both stand on the
       backdrop's brightest point, already protected above, so lightening
       always reaches the mark.
   readability().elements says what was done, for the meter.

   bf_theme IS THE MEMBER'S, cleared at sign-out with their other things
   (scripts/bf-session.js PER_USER_LOCAL), so the sign-in page shows the
   original look. It is applied only when it belongs to the member signed in.

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
  var WHITE = "#ffffff";
  var NEAR_BLACK = "#050c1a";
  var BTN_MIN = 4.5;
  var GUIDE_MIN = 4.5;
  var MARK_MIN = 3;
  var GUIDE_PANEL = [12, 18, 38], GUIDE_PANEL_ALPHA = 0.9;   // termaximus-guide.js #tmx-guide-panel
  var HEADER = [8, 8, 18], HEADER_ALPHA = 0.88;              // css/bizforce-ui.css .topbar

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
    alive: false,
    btn_a: "#06b6d4",
    btn_b: "#8b5cf6",
    btn_text: "#ffffff",
    mist_core: "#3c78ff",
    mist_haze: "#300c96",
    mist_pulse: "#500f6e",
    mist_spark: "#ffe896",
    mist_star: "#ffffff",
    mist_dust: "#f0c850",
    mist_trail: "#cddaff",
    mist_whisper: "#d7cdf5",
    chat_glow_a: "#00e5ff",
    chat_glow_b: "#7b2ff7",
    guide_a: "#22d3ee",
    guide_b: "#a855f7",
    mark_a: "#22d3ee",
    mark_b: "#a855f7",
    match_all: false
  };

  /* The same sections as lib/themes.js ELEMENTS. */
  var ELEMENTS = {
    buttons: ["btn_a", "btn_b", "btn_text"],
    mist: ["mist_core", "mist_haze", "mist_pulse", "mist_spark", "mist_star", "mist_dust", "mist_trail", "mist_whisper"],
    chat: ["chat_glow_a", "chat_glow_b"],
    guide: ["guide_a", "guide_b"],
    mark: ["mark_a", "mark_b"]
  };

  /* Every colour the mist draws (scripts/termaximus-presence.js), as today's
     channels, stop by stop. Stop n of a part is the token --tmx-<part>-<n>;
     the part's own colour (mist_<part>) is one of its stops. A part at its
     original sets nothing; any other colour C gives each stop C moved toward
     white or black by the lightness that stop has above or below the part's
     own colour today (stopsFor, below), so each keeps its place in the shape. */
  var MIST = {
    core: ["255, 255, 255", "200, 230, 255", "100, 180, 255", "60, 120, 255", "180, 100, 255", "140, 180, 255", "100, 120, 255"],
    haze: ["48, 12, 150", "16, 4, 68", "4, 0, 24", "88, 8, 95", "45, 4, 60", "16, 1, 28", "12, 6, 100", "6, 2, 55", "2, 0, 22"],
    pulse: ["80, 15, 110", "90, 6, 22", "12, 6, 85", "0, 32, 48", "70, 16, 4"],
    spark: ["255, 232, 150", "255, 220, 100"],
    star: ["255, 255, 255", "200, 220, 255"],
    dust: ["220, 168, 60", "200, 140, 40", "240, 200, 80", "220, 170, 50", "255, 210, 90", "220, 165, 45", "235, 195, 75", "210, 160, 40"],
    trail: ["190, 210, 255", "205, 218, 255", "210, 220, 255"],
    whisper: ["215, 205, 245"]
  };
  /* The chat glow's third, outermost stop follows its outer colour. */
  var CHAT_GLOW_C = "168, 85, 247";

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
  /* The element tokens. None has a default in the rule: each place keeps its
     own colour as the var() fallback. */
  var ELEMENT_TOKENS = ["--bf-btn-a", "--bf-btn-b", "--bf-btn-text", "--bf-mark-a", "--bf-mark-b", "--bf-guide-a", "--bf-guide-b",
    "--tmx-chat-glow-a", "--tmx-chat-glow-b", "--tmx-chat-glow-c"];
  Object.keys(MIST).forEach(function (part) {
    MIST[part].forEach(function (stop, i) { ELEMENT_TOKENS.push("--tmx-" + part + "-" + (i + 1)); });
  });
  var ALL_TOKENS = THEME_TOKENS.concat(ELEMENT_TOKENS);

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
  function hexOf(rgb) {
    return "#" + rgb.map(function (c) { var v = Math.max(0, Math.min(255, Math.round(c))); return (v < 16 ? "0" : "") + v.toString(16); }).join("");
  }
  function channels(rgb) { return rgb.map(function (c) { return Math.round(c); }).join(", "); }
  /* mix(x, y, w): x moved a share w of the way to y, per channel, rounded
     (the same as lib/themes.js mixHex). */
  function mixHex(x, y, w) {
    var a = [1, 3, 5].map(function (i) { return parseInt(x.slice(i, i + 2), 16); });
    var b = [1, 3, 5].map(function (i) { return parseInt(y.slice(i, i + 2), 16); });
    return "#" + a.map(function (c, i) {
      var v = Math.round(c + w * (b[i] - c));
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }
  /* "Match everything": the same rule as lib/themes.js matchAll. */
  function matchAll(a, b) {
    var W = WHITE;
    return {
      btn_a: a, btn_b: b, btn_text: W,
      mark_a: a, mark_b: b,
      guide_a: mixHex(a, W, 0.35), guide_b: mixHex(b, W, 0.35),
      chat_glow_a: a, chat_glow_b: b,
      mist_core: a, mist_haze: b,
      mist_pulse: mixHex(mixHex(a, b, 0.5), W, 0.3),
      mist_spark: mixHex(a, W, 0.6),
      mist_star: mixHex(b, W, 0.85),
      mist_dust: mixHex(b, W, 0.5),
      mist_trail: mixHex(a, W, 0.7),
      mist_whisper: mixHex(b, W, 0.75)
    };
  }
  /* HSL lightness, 0 … 1. */
  function lightness(rgb) { return (Math.max(rgb[0], rgb[1], rgb[2]) + Math.min(rgb[0], rgb[1], rgb[2])) / 2 / 255; }
  function chOf(text) { return text.split(",").map(function (x) { return Number(x); }); }
  /* One mist part's stops for colour `hex`, or null at its original. */
  function stopsFor(part, hex) {
    var key = DEFAULT_THEME["mist_" + part];
    var c = rgbOf(hex);
    if (!c || hex === key) return null;
    var lk = lightness(rgbOf(key));
    return MIST[part].map(function (stop) {
      var t = lightness(chOf(stop)) - lk;
      if (t > 0) return channels(over([255, 255, 255], t / (1 - lk), c));
      if (t < 0) return channels(over([0, 0, 0], -t / lk, c));
      return channels(c);
    });
  }
  function atOriginal(t, section) {
    return ELEMENTS[section].every(function (k) { return t[k] === DEFAULT_THEME[k]; });
  }

  function normalTheme(theme) {
    var out = {};
    Object.keys(DEFAULT_THEME).forEach(function (k) {
      var v = theme && theme[k] !== undefined ? theme[k] : DEFAULT_THEME[k];
      if (k !== "v" && k !== "photo" && typeof DEFAULT_THEME[k] === "string" && /^#/.test(DEFAULT_THEME[k]) && !rgbOf(v)) v = DEFAULT_THEME[k];
      out[k] = v;
    });
    if (out.match_all === true) {
      var derived = matchAll(out.glow_a, out.glow_b);
      Object.keys(derived).forEach(function (k) { out[k] = derived[k]; });
    }
    return out;
  }

  /* `hex` lightened toward white, 0.01 at a time, until it is `min`:1 on
     `point`. */
  function lift(hex, point, min) {
    var c = rgbOf(hex), w = 0;
    while (contrast(over([255, 255, 255], w / 100, c), point) < min && w < 100) w++;
    return { hex: w ? hexOf(over([255, 255, 255], w / 100, c)) : hex, ratio: contrast(over([255, 255, 255], w / 100, c), point), lifted: w > 0 };
  }
  function worst(text, ends) { return Math.min.apply(null, ends.map(function (e) { return contrast(text, e); })); }

  /* How readable the buttons, the guide's lettering and the wordmark are on
     the backdrop's brightest point `peakPoint` (already protected), and what
     is changed to keep them so. */
  function elementReadability(t, peakPoint) {
    var out = {};
    var a = rgbOf(t.btn_a), b = rgbOf(t.btn_b), text = rgbOf(t.btn_text);
    var btn = { original: atOriginal(t, "buttons"), before: worst(text, [a, b]), a: t.btn_a, b: t.btn_b, text: t.btn_text, fix: null };
    if (!btn.original && btn.before < BTN_MIN) {
      var white = worst(rgbOf(WHITE), [a, b]), dark = worst(rgbOf(NEAR_BLACK), [a, b]);
      if (Math.max(white, dark) >= BTN_MIN) { btn.text = white >= dark ? WHITE : NEAR_BLACK; btn.fix = "text"; }
      else {
        var s = 0;
        while (worst(rgbOf(WHITE), [shade(a, s / 100), shade(b, s / 100)]) < BTN_MIN && s < 100) s++;
        btn.text = WHITE; btn.a = hexOf(shade(a, s / 100)); btn.b = hexOf(shade(b, s / 100)); btn.fix = "shade"; btn.shade = s / 100;
      }
    }
    btn.ratio = worst(rgbOf(btn.text), [rgbOf(btn.a), rgbOf(btn.b)]);
    out.buttons = btn;
    [["guide", over(GUIDE_PANEL, GUIDE_PANEL_ALPHA, peakPoint), GUIDE_MIN],
     ["mark", brightest([over(HEADER, HEADER_ALPHA, peakPoint), peakPoint]), MARK_MIN]].forEach(function (e) {
      var keys = ELEMENTS[e[0]], point = e[1], min = e[2];
      var r = { original: atOriginal(t, e[0]), before: Math.min(contrast(rgbOf(t[keys[0]]), point), contrast(rgbOf(t[keys[1]]), point)), fix: null };
      var la = r.original ? { hex: t[keys[0]], lifted: false } : lift(t[keys[0]], point, min);
      var lb = r.original ? { hex: t[keys[1]], lifted: false } : lift(t[keys[1]], point, min);
      r.a = la.hex; r.b = lb.hex;
      if (la.lifted || lb.lifted) r.fix = "lighten";
      r.ratio = Math.min(contrast(rgbOf(r.a), point), contrast(rgbOf(r.b), point));
      out[e[0]] = r;
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
    var elements = elementReadability(t, peak(dim, scrim));
    return {
      readable: before.text >= TEXT_MIN && before.muted >= MUTED_MIN,
      protected: dim > userDim || scrim > 0,
      dim: dim,
      scrim: scrim,
      before: before,
      ratios: ratiosAt(peak(dim, scrim)),
      elements: elements,
      elementsFixed: ["buttons", "guide", "mark"].some(function (k) { return !!elements[k].fix; })
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
    return Object.assign({
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
    }, elementTokens(t, r.elements));
  }

  /* The element tokens one theme sets: only for the sections (and mist
     parts) not at their original, with readability's corrections applied. */
  function elementTokens(t, fixed) {
    var out = {};
    if (!atOriginal(t, "buttons")) {
      out["--bf-btn-a"] = fixed.buttons.a; out["--bf-btn-b"] = fixed.buttons.b; out["--bf-btn-text"] = fixed.buttons.text;
    }
    if (!atOriginal(t, "mark")) { out["--bf-mark-a"] = fixed.mark.a; out["--bf-mark-b"] = fixed.mark.b; }
    if (!atOriginal(t, "guide")) { out["--bf-guide-a"] = fixed.guide.a; out["--bf-guide-b"] = fixed.guide.b; }
    if (!atOriginal(t, "chat")) {
      out["--tmx-chat-glow-a"] = channels(rgbOf(t.chat_glow_a));
      out["--tmx-chat-glow-b"] = channels(rgbOf(t.chat_glow_b));
      out["--tmx-chat-glow-c"] = t.chat_glow_b === DEFAULT_THEME.chat_glow_b ? CHAT_GLOW_C : channels(over([255, 255, 255], 0.25, rgbOf(t.chat_glow_b)));
    }
    Object.keys(MIST).forEach(function (part) {
      var stops = stopsFor(part, t["mist_" + part]);
      if (stops) stops.forEach(function (v, i) { out["--tmx-" + part + "-" + (i + 1)] = v; });
    });
    return out;
  }

  /* Every element token at the original, for a preview that must not inherit
     the page's own theme (the buttons at their most common original). */
  function originalTokens() {
    var t = DEFAULT_THEME, out = {
      "--bf-btn-a": t.btn_a, "--bf-btn-b": t.btn_b, "--bf-btn-text": t.btn_text,
      "--bf-mark-a": t.mark_a, "--bf-mark-b": t.mark_b, "--bf-guide-a": t.guide_a, "--bf-guide-b": t.guide_b,
      "--tmx-chat-glow-a": channels(rgbOf(t.chat_glow_a)), "--tmx-chat-glow-b": channels(rgbOf(t.chat_glow_b)), "--tmx-chat-glow-c": CHAT_GLOW_C
    };
    Object.keys(MIST).forEach(function (part) { MIST[part].forEach(function (v, i) { out["--tmx-" + part + "-" + (i + 1)] = v; }); });
    return out;
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
    ALL_TOKENS.forEach(function (name) {
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
    if (cache && uid && cache.uid === uid) applyState(cache.state, win, doc);
    var later = function () { refresh(win, doc, false); };
    if (doc.readyState === "loading" && doc.addEventListener) doc.addEventListener("DOMContentLoaded", later);
    else later();
  }

  window.BFTheme = {
    DEFAULT_THEME: DEFAULT_THEME,
    UNTHEMED: UNTHEMED,
    THEME_TOKENS: ALL_TOKENS,
    BACKDROP_TOKENS: THEME_TOKENS,
    ELEMENT_TOKENS: ELEMENT_TOKENS,
    ELEMENTS: ELEMENTS,
    MIST: MIST,
    RULE: RULE,
    TEXT: TEXT, MUTED: MUTED, ACCENT: ACCENT, TEXT_MIN: TEXT_MIN, MUTED_MIN: MUTED_MIN,
    BTN_MIN: BTN_MIN, GUIDE_MIN: GUIDE_MIN, MARK_MIN: MARK_MIN, WHITE: WHITE, NEAR_BLACK: NEAR_BLACK,
    rgbOf: rgbOf,
    mixHex: mixHex,
    matchAll: matchAll,
    stopsFor: stopsFor,
    atOriginal: atOriginal,
    normalTheme: normalTheme,
    originalTokens: originalTokens,
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
    reducedMotion: function () { return reducedMotion(window); },
    /* The API's origin, for the studio: the one base every request uses. */
    apiOrigin: function () { return apiOrigin(window); }
  };

  boot(window, document);
})();

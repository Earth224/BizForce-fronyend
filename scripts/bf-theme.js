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
     html::before   the middle: --bf-bg, the member's photo if any, and a
                    black shade of --bf-bg-dim over it. The photo (Block 4d) is
                    placed by --bf-bg-pos (its focal point, "x% y%"), sized by
                    --bf-bg-size (cover for Fill, contain for Fit whole,
                    "<zoom>% auto" for Custom), softened by --bf-bg-blur
                    (filter: blur(), with the layer grown by --bf-bg-inset so
                    the blurred edge stays off screen) and given feathered
                    edges by --bf-bg-feather: four gradients from the backdrop
                    colour to transparent, one per side, laid over the photo.
                    That is an overlay into the backdrop's own colour, not a
                    mask: a mask would show whatever the page paints behind.
                    Every one of these is unset by default, and each var()
                    falls back to exactly what the layer drew before;
     body::before   the glows: top-left --bf-glow-a, bottom-right --bf-glow-b,
                    a soft centre glow in the middle tone (--bf-glow-m-*,
                    alpha 0 unless a theme turns it up), an optional fourth
                    (--bf-glow-c, only profile.html uses it), and over them
                    the readability scrim --bf-scrim.
   They are two layers so "Alive corners" can move the glows, by transform
   and opacity on body::before alone, while the middle stays still. A page
   keeps its own look by setting the GEOMETRY tokens (where each glow sits,
   its shape, how far it reaches, its z-index) in its own :root; the defaults
   are the look 48 pages already shared. The defaults are declared at
   :where(:root), which has no specificity, so a page's :root always wins, and
   a member's theme (set on <html>'s style) wins over both.

   ALIVE CORNERS (Block 4d) move in one of four styles, all on body::before
   and all by transform and opacity only (nothing that lays the page out):
     breathe   today's slow pulse (bf-glow-drift), the default;
     drift     the glows travel a slow orbit (bf-glow-orbit, eight points of a
               circle, linear, never reversing);
     aurora    soft ribbons in the corner colours and the middle tone, laid
               diagonally through the glows, sway and stretch (bf-glow-aurora);
     nebula    a conic swirl of the three colours turns the whole glow field
               a few degrees each way around the centre (bf-glow-nebula).
   Speed divides each style's own cycle (--bf-motion-speed, 0.25 … 3) and
   Intensity scales every amplitude: --bf-motion-k is intensity / 0.6, so the
   default 0.6 is exactly today's breathe. setLiveEnergy(0 … 1) adds to it
   (--bf-live-energy, k × (1 + energy)); the music player feeds it (MOVE WITH
   THE MUSIC, below). Motion pauses while the tab is hidden
   (data-bf-motion-paused) and is off entirely under prefers-reduced-motion,
   in this script and in the rule's own media query.

   MOVE WITH THE MUSIC. A theme's "Move with the music" (music_move, with
   music_intensity) lets BizForce's own player (scripts/bf-music.js) drive
   the live energy: the player posts its energy on the BroadcastChannel
   "bf-music" about 30 times a second while it plays, from this page,
   another BizForce page or its pop-out window, and this script alone hands
   it to setLiveEnergy, times the intensity, when the theme this page wears
   has it on and its corners alive, and never under reduced motion. When the
   player stops it eases the energy to 0 over about a second; if it goes
   quiet instead (a closed pop-out), this script eases it the same way.

   PUBLIC PAGES never load this file: seller, support, card-view, the blog, a
   listing and the legal pages keep their OWNER's look, never the visitor's.
   UNTHEMED below repeats that list in case one ever does, and profile.html
   wears no theme while it shows somebody else's profile.

   READABILITY. Any colour may be chosen; none is refused. The text colours
   are measured against the brightest point of the backdrop (each glow at its
   centre over the middle, and the middle itself; a photo counts as the
   brightest luminance read from it when it was saved, and blur and feather
   only average it with itself and the darker backdrop colour, so it never
   gets brighter than that; the dim is counted). With the centre glow on, a
   corner grown past today's size, or the aurora and nebula layers moving,
   every glow is taken as stacked at full strength on one point, the most it
   could ever be. If body text #e8e8ff falls under 7:1 or muted text #8892b8
   under 4.5:1, the shade is raised: first --bf-bg-dim over the middle, until
   the middle alone passes, then --bf-scrim over the glows, until the
   brightest point passes. Both are raised in steps of 0.01, the least that
   passes. readability() says which happened, for the meter in Settings →
   Theme.

   THE ELEMENT PALETTES (Block 4b, three colours since 4d) colour the rest of
   the look: the buttons (--bf-btn-a, --bf-btn-mid, --bf-btn-b, --bf-btn-text),
   the wordmark (--bf-mark-*), the guide's lettering (--bf-guide-*), the glow
   behind Termaximus's chat box (--tmx-chat-glow-a, -mid, -b, -c), the
   headings and accents (--bf-accent-*, below) and every colour of the mist
   (--tmx-core-1 … and the rest of MIST below). Every place that draws one
   reads it as var(--token, its own colour), so with the token unset each
   place is exactly what it was, and these tokens have NO default in the
   rule. A middle stop is written into each gradient as var(--x-mid, ) right
   after the first stop: unset, it adds nothing; set, it is ", #rrggbb", a
   third stop. A theme sets an element's tokens only when that element is not
   at its original (the mist colour by colour), and a middle only when it is
   off the line between its ends (lib/themes.js onTheLine). Readability is
   kept too, and nothing is refused:
     the button lettering is at least 4.5:1 on every stop of its gradient: if
       not, it is set to white or near-black, whichever reads better, and if
       neither reaches 4.5:1 it is white and the gradient is shaded, 0.01 at
       a time, until it does;
     the guide's lettering is at least 4.5:1 on its panel, and the wordmark
       (on the header) and the headings and accents (on the backdrop) at
       least 3:1, the bar for large text and for the borders, rings and
       icons most accents are (today's violet is 3.8:1); each stop too dark for that is lightened
       toward white, 0.01 at a time. All stand on the backdrop's brightest
       point, already protected above, so lightening always reaches the mark.
   readability().elements says what was done, for the meter.

   HEADINGS AND ACCENTS. Every other place that drew the original cyan and
   violet (titles, icon rings, badges, chips, borders, glows, focus rings,
   links, toggles, progress bars, tab underlines, HQ and the live panel) now
   reads a token named for the colour it drew, with that colour as its
   fallback and its rgba() forms reading the -rgb channels:
     #22d3ee --bf-accent-a    #06b6d4 --bf-accent-a2   #00e5ff --bf-accent-a3
     #a855f7 --bf-accent-b    #8b5cf6 --bf-accent-b2   #7b2ff7 --bf-accent-b3
   A theme's accent A sets the first family and accent B the second, each
   variant keeping the lightness, chroma and hue it had beside its family's
   colour today (variantOf). A chart or canvas reads them when it draws, by
   BFTheme.color(token, its own colour).

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
  var ACCENT_MIN = 3;
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
    match_all: false,
    glow_mid: "#6eabff",
    mid_auto: true,
    glow_mid_alpha: 0,
    glow_a_size: 38,
    glow_b_size: 40,
    glow_mid_size: 45,
    btn_mid: "#4989e5",
    mark_mid: "#6594f3",
    guide_mid: "#6594f3",
    chat_glow_mid: "#3e8afb",
    accent_a: "#22d3ee",
    accent_mid: "#6594f3",
    accent_b: "#a855f7",
    photo_fit: "fill",
    photo_zoom: 100,
    photo_x: 50,
    photo_y: 50,
    photo_blur: 0,
    photo_feather: 0,
    motion: "breathe",
    motion_speed: 1,
    motion_intensity: 0.6,
    music_move: false,
    music_intensity: 0.6
  };
  var KEYS = Object.keys(DEFAULT_THEME);

  /* The same sections as lib/themes.js ELEMENTS, MIDS and RANGES. */
  var ELEMENTS = {
    buttons: ["btn_a", "btn_mid", "btn_b", "btn_text"],
    mist: ["mist_core", "mist_haze", "mist_pulse", "mist_spark", "mist_star", "mist_dust", "mist_trail", "mist_whisper"],
    chat: ["chat_glow_a", "chat_glow_mid", "chat_glow_b"],
    guide: ["guide_a", "guide_mid", "guide_b"],
    mark: ["mark_a", "mark_mid", "mark_b"],
    accent: ["accent_a", "accent_mid", "accent_b"]
  };
  var MIDS = { btn_mid: ["btn_a", "btn_b"], mark_mid: ["mark_a", "mark_b"], guide_mid: ["guide_a", "guide_b"],
    chat_glow_mid: ["chat_glow_a", "chat_glow_b"], accent_mid: ["accent_a", "accent_b"] };
  var ACCENT_KEYS = ["accent_a", "accent_mid", "accent_b"];
  var FITS = ["fill", "fit", "custom"];
  var MOTIONS = ["breathe", "drift", "aurora", "nebula"];
  var RANGES = { glow_a_alpha: [0, 1], glow_b_alpha: [0, 1], dim: [0, 0.85], photo_luma: [0, 1],
    glow_mid_alpha: [0, 1], glow_a_size: [10, 100], glow_b_size: [10, 100], glow_mid_size: [10, 100],
    photo_zoom: [50, 300], photo_x: [0, 100], photo_y: [0, 100], photo_blur: [0, 20], photo_feather: [0, 50],
    motion_speed: [0.25, 3], motion_intensity: [0, 1], music_intensity: [0, 1] };

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

  /* The original palette, each colour and the accent family it belongs to.
     A family's first colour is the one accent_a or accent_b sets; the others
     are its variants. */
  var ACCENT_FAMILY = {
    "--bf-accent-a": ["accent_a", "#22d3ee"], "--bf-accent-a2": ["accent_a", "#06b6d4"], "--bf-accent-a3": ["accent_a", "#00e5ff"],
    "--bf-accent-b": ["accent_b", "#a855f7"], "--bf-accent-b2": ["accent_b", "#8b5cf6"], "--bf-accent-b3": ["accent_b", "#7b2ff7"]
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
  /* Block 4d's backdrop tokens. None has a value in a theme at its default,
     so a theme saved before them sets exactly the tokens it always set. */
  var BACKDROP_4D_TOKENS = [
    "--bf-bg-pos", "--bf-bg-size", "--bf-bg-blur", "--bf-bg-inset", "--bf-bg-feather",
    "--bf-glow-m-rgb", "--bf-glow-m-alpha", "--bf-glow-a-reach", "--bf-glow-b-reach", "--bf-glow-m-reach",
    "--bf-motion", "--bf-motion-speed", "--bf-motion-k"
  ];
  /* The element tokens. None has a default in the rule: each place keeps its
     own colour as the var() fallback. */
  var ELEMENT_TOKENS = ["--bf-btn-a", "--bf-btn-b", "--bf-btn-text", "--bf-mark-a", "--bf-mark-b", "--bf-guide-a", "--bf-guide-b",
    "--tmx-chat-glow-a", "--tmx-chat-glow-b", "--tmx-chat-glow-c",
    "--bf-btn-mid", "--bf-mark-mid", "--bf-guide-mid", "--tmx-chat-glow-mid", "--bf-accent-mid"];
  Object.keys(ACCENT_FAMILY).forEach(function (name) { ELEMENT_TOKENS.push(name, name + "-rgb"); });
  Object.keys(MIST).forEach(function (part) {
    MIST[part].forEach(function (stop, i) { ELEMENT_TOKENS.push("--tmx-" + part + "-" + (i + 1)); });
  });
  var ALL_TOKENS = THEME_TOKENS.concat(BACKDROP_4D_TOKENS, ELEMENT_TOKENS);

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
    "  --bf-glow-m-rgb: 110, 171, 255;\n" +
    "  --bf-glow-m-alpha: 0;\n" +
    "  --bf-glow-m-at: 50% 50%;\n" +
    "  --bf-glow-m-reach: 45%;\n" +
    "  --bf-glow-c: transparent;\n" +
    "  --bf-glow-c-shape: circle;\n" +
    "  --bf-glow-c-at: 50% 50%;\n" +
    "  --bf-backdrop-z: 0;\n" +
    "}\n" +
    "html::before {\n" +
    "  content: \"\"; position: fixed; inset: var(--bf-bg-inset, 0); z-index: var(--bf-backdrop-z); pointer-events: none;\n" +
    "  background:\n" +
    "    linear-gradient(rgba(0, 0, 0, var(--bf-bg-dim)), rgba(0, 0, 0, var(--bf-bg-dim))),\n" +
    "    var(--bf-bg-feather, linear-gradient(transparent, transparent)),\n" +
    "    var(--bf-bg-image) var(--bf-bg-pos, center) / var(--bf-bg-size, cover) no-repeat,\n" +
    "    var(--bf-bg);\n" +
    "  filter: var(--bf-bg-blur, none);\n" +
    "}\n" +
    "body::before {\n" +
    "  content: \"\"; position: fixed; inset: 0; z-index: var(--bf-backdrop-z); pointer-events: none;\n" +
    "  background:\n" +
    "    linear-gradient(rgba(0, 0, 0, var(--bf-scrim)), rgba(0, 0, 0, var(--bf-scrim))),\n" +
    "    radial-gradient(var(--bf-glow-a-shape) at var(--bf-glow-a-at), rgba(var(--bf-glow-a-rgb), var(--bf-glow-a-alpha)), transparent var(--bf-glow-a-reach)),\n" +
    "    radial-gradient(var(--bf-glow-b-shape) at var(--bf-glow-b-at), rgba(var(--bf-glow-b-rgb), var(--bf-glow-b-alpha)), transparent var(--bf-glow-b-reach)),\n" +
    "    radial-gradient(circle at var(--bf-glow-m-at), rgba(var(--bf-glow-m-rgb), var(--bf-glow-m-alpha)), transparent var(--bf-glow-m-reach)),\n" +
    "    radial-gradient(var(--bf-glow-c-shape) at var(--bf-glow-c-at), var(--bf-glow-c), transparent);\n" +
    "}\n" +
    "@keyframes bf-glow-drift {\n" +
    "  0%   { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }\n" +
    "  35%  { transform: translate3d(calc(-2.5% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(2% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.06 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.18 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  70%  { transform: translate3d(calc(2% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(-1.5% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.03 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.06 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  100% { transform: translate3d(calc(1% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(2.5% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.14 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "}\n" +
    "@keyframes bf-glow-orbit {\n" +
    "  0%    { transform: translate3d(calc(4% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0, 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: 1; }\n" +
    "  12.5% { transform: translate3d(calc(2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.06 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  25%   { transform: translate3d(0, calc(4% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.12 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  37.5% { transform: translate3d(calc(-2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.06 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  50%   { transform: translate3d(calc(-4% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0, 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: 1; }\n" +
    "  62.5% { transform: translate3d(calc(-2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(-2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.06 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  75%   { transform: translate3d(0, calc(-4% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.12 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  87.5% { transform: translate3d(calc(2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(-2.83% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.06 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  100%  { transform: translate3d(calc(4% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0, 0) scale(calc(1 + 0.05 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: 1; }\n" +
    "}\n" +
    "@keyframes bf-glow-aurora {\n" +
    "  0%   { transform: translate3d(calc(-3% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0, 0) skewX(calc(-2.5deg * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))) scale(calc(1 + 0.04 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 1); opacity: 1; }\n" +
    "  50%  { transform: translate3d(calc(1% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(-1.5% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) skewX(calc(1deg * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))) scale(calc(1 + 0.04 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(1 + 0.08 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.22 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  100% { transform: translate3d(calc(3% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(1% * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), 0) skewX(calc(2.5deg * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))) scale(calc(1 + 0.04 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))), calc(1 + 0.04 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.08 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "}\n" +
    "@keyframes bf-glow-nebula {\n" +
    "  0%   { transform: rotate(calc(-5deg * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))) scale(calc(1 + 0.08 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: 1; }\n" +
    "  50%  { transform: rotate(0deg) scale(calc(1 + 0.12 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: calc(1 - 0.16 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0))); }\n" +
    "  100% { transform: rotate(calc(5deg * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))) scale(calc(1 + 0.08 * var(--bf-motion-k, 1) * (1 + var(--bf-live-energy, 0)))); opacity: 1; }\n" +
    "}\n" +
    ":root[data-bf-alive=\"1\"] body::before {\n" +
    "  inset: -8%; animation: bf-glow-drift 32s ease-in-out infinite alternate; animation-duration: calc(32s / var(--bf-motion-speed, 1)); will-change: transform, opacity;\n" +
    "}\n" +
    ":root[data-bf-alive=\"1\"][data-bf-motion=\"drift\"] body::before {\n" +
    "  animation: bf-glow-orbit 24s linear infinite; animation-duration: calc(24s / var(--bf-motion-speed, 1));\n" +
    "}\n" +
    ":root[data-bf-alive=\"1\"][data-bf-motion=\"aurora\"] body::before {\n" +
    "  inset: -12%; animation: bf-glow-aurora 18s ease-in-out infinite alternate; animation-duration: calc(18s / var(--bf-motion-speed, 1));\n" +
    "  background:\n" +
    "    linear-gradient(rgba(0, 0, 0, var(--bf-scrim)), rgba(0, 0, 0, var(--bf-scrim))),\n" +
    "    linear-gradient(115deg, transparent 6%, rgba(var(--bf-glow-a-rgb), calc(var(--bf-glow-a-alpha) * 0.55)) 17%, transparent 29%),\n" +
    "    linear-gradient(115deg, transparent 38%, rgba(var(--bf-glow-m-rgb), calc((var(--bf-glow-a-alpha) + var(--bf-glow-b-alpha)) * 0.3)) 50%, transparent 62%),\n" +
    "    linear-gradient(115deg, transparent 71%, rgba(var(--bf-glow-b-rgb), calc(var(--bf-glow-b-alpha) * 0.55)) 83%, transparent 95%),\n" +
    "    radial-gradient(var(--bf-glow-a-shape) at var(--bf-glow-a-at), rgba(var(--bf-glow-a-rgb), var(--bf-glow-a-alpha)), transparent var(--bf-glow-a-reach)),\n" +
    "    radial-gradient(var(--bf-glow-b-shape) at var(--bf-glow-b-at), rgba(var(--bf-glow-b-rgb), var(--bf-glow-b-alpha)), transparent var(--bf-glow-b-reach)),\n" +
    "    radial-gradient(circle at var(--bf-glow-m-at), rgba(var(--bf-glow-m-rgb), var(--bf-glow-m-alpha)), transparent var(--bf-glow-m-reach)),\n" +
    "    radial-gradient(var(--bf-glow-c-shape) at var(--bf-glow-c-at), var(--bf-glow-c), transparent);\n" +
    "}\n" +
    ":root[data-bf-alive=\"1\"][data-bf-motion=\"nebula\"] body::before {\n" +
    "  inset: -12%; animation: bf-glow-nebula 40s ease-in-out infinite alternate; animation-duration: calc(40s / var(--bf-motion-speed, 1));\n" +
    "  background:\n" +
    "    linear-gradient(rgba(0, 0, 0, var(--bf-scrim)), rgba(0, 0, 0, var(--bf-scrim))),\n" +
    "    conic-gradient(from 20deg at 50% 50%, rgba(var(--bf-glow-a-rgb), calc(var(--bf-glow-a-alpha) * 0.5)), rgba(var(--bf-glow-m-rgb), calc((var(--bf-glow-a-alpha) + var(--bf-glow-b-alpha)) * 0.25)), rgba(var(--bf-glow-b-rgb), calc(var(--bf-glow-b-alpha) * 0.5)), rgba(var(--bf-glow-m-rgb), calc((var(--bf-glow-a-alpha) + var(--bf-glow-b-alpha)) * 0.25)), rgba(var(--bf-glow-a-rgb), calc(var(--bf-glow-a-alpha) * 0.5))),\n" +
    "    radial-gradient(var(--bf-glow-a-shape) at var(--bf-glow-a-at), rgba(var(--bf-glow-a-rgb), var(--bf-glow-a-alpha)), transparent var(--bf-glow-a-reach)),\n" +
    "    radial-gradient(var(--bf-glow-b-shape) at var(--bf-glow-b-at), rgba(var(--bf-glow-b-rgb), var(--bf-glow-b-alpha)), transparent var(--bf-glow-b-reach)),\n" +
    "    radial-gradient(circle at var(--bf-glow-m-at), rgba(var(--bf-glow-m-rgb), var(--bf-glow-m-alpha)), transparent var(--bf-glow-m-reach)),\n" +
    "    radial-gradient(var(--bf-glow-c-shape) at var(--bf-glow-c-at), var(--bf-glow-c), transparent);\n" +
    "}\n" +
    ":root[data-bf-alive=\"1\"][data-bf-motion][data-bf-motion-paused=\"1\"] body::before {\n" +
    "  animation-play-state: paused;\n" +
    "}\n" +
    "@media (prefers-reduced-motion: reduce) {\n" +
    "  :root[data-bf-alive=\"1\"] body::before { inset: 0; animation: none; will-change: auto; }\n" +
    "  :root[data-bf-alive=\"1\"][data-bf-motion] body::before { inset: 0; animation: none; will-change: auto; }\n" +
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

  /* ── OKLCH, the same functions as lib/themes.js ─────────────────────── */
  function toGamma(x) { return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; }
  function oklabOf(hex) {
    var r = linear(parseInt(hex.slice(1, 3), 16)), g = linear(parseInt(hex.slice(3, 5), 16)), b = linear(parseInt(hex.slice(5, 7), 16));
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklchOf(hex) {
    var p = oklabOf(hex), h = Math.atan2(p[2], p[1]) * 180 / Math.PI;
    return [p[0], Math.sqrt(p[1] * p[1] + p[2] * p[2]), h < 0 ? h + 360 : h];
  }
  function linearOfOklch(L, C, h) {
    var A = C * Math.cos(h * Math.PI / 180), B = C * Math.sin(h * Math.PI / 180);
    var l = L + 0.3963377774 * A + 0.2158037573 * B, m = L - 0.1055613458 * A - 0.0638541728 * B, s = L - 0.0894841775 * A - 1.2914855480 * B;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function hexOfOklch(L, C, h) {
    var lin = linearOfOklch(L, C, h);
    while (C > 0 && lin.some(function (v) { return v < -0.0005 || v > 1.0005; })) { C = Math.max(0, C - 0.002); lin = linearOfOklch(L, C, h); }
    return "#" + lin.map(function (v) {
      var c = Math.round(Math.min(1, Math.max(0, toGamma(Math.min(1, Math.max(0, v))))) * 255);
      return (c < 16 ? "0" : "") + c.toString(16);
    }).join("");
  }
  /* The middle tone of A and B (the rule is in lib/themes.js's header). */
  function midTone(a, b) {
    var p = oklchOf(a), q = oklchOf(b);
    var L = (p[0] + q[0]) / 2, C = (p[1] + q[1]) / 2, h;
    if (p[1] < 0.02 && q[1] < 0.02) h = p[2];
    else {
      C = C * 1.15;
      if (p[1] < 0.02) h = q[2];
      else if (q[1] < 0.02) h = p[2];
      else { var d = ((q[2] - p[2] + 540) % 360) - 180; h = (p[2] + d / 2 + 360) % 360; }
    }
    return hexOfOklch(L, C, h);
  }
  function oklabDistance(x, y) {
    var p = oklabOf(x), q = oklabOf(y);
    return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2));
  }
  /* Is `mid` the plain midpoint of `a` and `b` (within 2 in each channel)? */
  function onTheLine(a, mid, b) {
    var line = mixHex(a, b, 0.5);
    return [1, 3, 5].every(function (i) { return Math.abs(parseInt(line.slice(i, i + 2), 16) - parseInt(mid.slice(i, i + 2), 16)) <= 2; });
  }
  /* A variant of a family's colour: `colour` given the lightness, chroma and
     hue that `variant` has beside `base` today. */
  function variantOf(colour, base, variant) {
    if (colour === base) return variant;
    var c = oklchOf(colour), b = oklchOf(base), v = oklchOf(variant);
    var dh = ((v[2] - b[2] + 540) % 360) - 180;
    return hexOfOklch(Math.min(1, Math.max(0, c[0] + v[0] - b[0])), c[1] * (b[1] > 0 ? v[1] / b[1] : 1), (c[2] + dh + 360) % 360);
  }

  /* "Match everything": the same rule as lib/themes.js matchAll. */
  function matchAll(a, b, mid) {
    var W = WHITE;
    var m = mid || mixHex(a, b, 0.5);
    return {
      btn_a: a, btn_mid: m, btn_b: b, btn_text: W,
      mark_a: a, mark_mid: m, mark_b: b,
      guide_a: mixHex(a, W, 0.35), guide_mid: mixHex(m, W, 0.35), guide_b: mixHex(b, W, 0.35),
      chat_glow_a: a, chat_glow_mid: m, chat_glow_b: b,
      accent_a: a, accent_mid: m, accent_b: b,
      mist_core: a, mist_haze: b,
      mist_pulse: mixHex(m, W, 0.3),
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
  /* A middle that draws a third stop: one off the line between its ends. */
  function midOn(t, k) { return !onTheLine(t[MIDS[k][0]], t[k], t[MIDS[k][1]]); }

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined; }
  /* A theme as lib/themes.js validateTheme leaves it, read leniently (a value
     the server would refuse falls back to its default here). A theme with no
     glow_mid was saved before Block 4d: its middles are its ends' midpoints,
     its middle tone too (kept), and its accents stay at the original. */
  function normalTheme(theme) {
    var src = theme && typeof theme === "object" ? theme : {}, out = {};
    var legacy = !has(src, "glow_mid");
    KEYS.forEach(function (k) {
      var d = DEFAULT_THEME[k], v = has(src, k) ? src[k] : d;
      if (k === "v" || k === "photo") { out[k] = v; return; }
      if (typeof d === "string" && /^#/.test(d)) { if (!rgbOf(v)) v = d; }
      else if (RANGES[k]) { v = typeof v === "number" && isFinite(v) ? Math.min(RANGES[k][1], Math.max(RANGES[k][0], v)) : d; }
      else if (typeof d === "boolean") { if (typeof v !== "boolean") v = d; }
      else if (k === "photo_fit") { if (FITS.indexOf(v) === -1) v = d; }
      else if (k === "motion") { if (MOTIONS.indexOf(v) === -1) v = d; }
      out[k] = v;
    });
    if (legacy && !has(src, "mid_auto")) out.mid_auto = false;
    Object.keys(MIDS).forEach(function (k) { if (!has(src, k) || !rgbOf(src[k])) out[k] = mixHex(out[MIDS[k][0]], out[MIDS[k][1]], 0.5); });
    if (legacy) out.glow_mid = mixHex(out.glow_a, out.glow_b, 0.5);
    if (out.mid_auto) out.glow_mid = midTone(out.glow_a, out.glow_b);
    if (out.match_all === true) {
      var derived = matchAll(out.glow_a, out.glow_b, out.glow_mid);
      Object.keys(derived).forEach(function (k) { if (!(legacy && ACCENT_KEYS.indexOf(k) !== -1)) out[k] = derived[k]; });
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

  /* How readable the buttons, the guide's lettering, the wordmark and the
     accents are on the backdrop's brightest point `peakPoint` (already
     protected), and what is changed to keep them so. A middle is measured
     only when it draws (off the line). */
  function elementReadability(t, peakPoint) {
    var out = {};
    var a = rgbOf(t.btn_a), b = rgbOf(t.btn_b), text = rgbOf(t.btn_text);
    var btnMid = midOn(t, "btn_mid"), mid = rgbOf(t.btn_mid);
    var stops = btnMid ? [a, mid, b] : [a, b];
    var btn = { original: atOriginal(t, "buttons"), before: worst(text, stops), a: t.btn_a, mid: t.btn_mid, b: t.btn_b, text: t.btn_text, fix: null };
    if (!btn.original && btn.before < BTN_MIN) {
      var white = worst(rgbOf(WHITE), stops), dark = worst(rgbOf(NEAR_BLACK), stops);
      if (Math.max(white, dark) >= BTN_MIN) { btn.text = white >= dark ? WHITE : NEAR_BLACK; btn.fix = "text"; }
      else {
        var s = 0;
        while (worst(rgbOf(WHITE), stops.map(function (x) { return shade(x, s / 100); })) < BTN_MIN && s < 100) s++;
        btn.text = WHITE; btn.a = hexOf(shade(a, s / 100)); btn.mid = hexOf(shade(mid, s / 100)); btn.b = hexOf(shade(b, s / 100)); btn.fix = "shade"; btn.shade = s / 100;
      }
    }
    btn.ratio = worst(rgbOf(btn.text), (btnMid ? [btn.a, btn.mid, btn.b] : [btn.a, btn.b]).map(rgbOf));
    out.buttons = btn;
    [["guide", over(GUIDE_PANEL, GUIDE_PANEL_ALPHA, peakPoint), GUIDE_MIN],
     ["mark", brightest([over(HEADER, HEADER_ALPHA, peakPoint), peakPoint]), MARK_MIN],
     ["accent", peakPoint, ACCENT_MIN]].forEach(function (e) {
      var keys = ELEMENTS[e[0]], point = e[1], min = e[2];
      var drawn = midOn(t, keys[1]) ? keys : [keys[0], keys[2]];
      var r = { original: atOriginal(t, e[0]), before: Math.min.apply(null, drawn.map(function (k) { return contrast(rgbOf(t[k]), point); })), fix: null };
      var lifted = keys.map(function (k) { return r.original || drawn.indexOf(k) === -1 ? { hex: t[k], lifted: false } : lift(t[k], point, min); });
      r.a = lifted[0].hex; r.mid = lifted[1].hex; r.b = lifted[2].hex;
      if (lifted.some(function (l) { return l.lifted; })) r.fix = "lighten";
      r.ratio = Math.min.apply(null, drawn.map(function (k, i) { return contrast(rgbOf(lifted[keys.indexOf(k)].hex), point); }));
      out[e[0]] = r;
    });
    return out;
  }

  /* The extra layers a moving style draws, as [colour, alpha] at their
     strongest, for the brightest-point reckoning. */
  function extraLayers(t, alive) {
    if (!alive || (t.motion !== "aurora" && t.motion !== "nebula")) return [];
    var a = rgbOf(t.glow_a), b = rgbOf(t.glow_b), m = rgbOf(t.glow_mid);
    return [[a, t.glow_a_alpha * 0.55], [m, (t.glow_a_alpha + t.glow_b_alpha) * 0.3], [b, t.glow_b_alpha * 0.55]];
  }

  /* How readable a theme is, and the least shade that makes it so. */
  function readability(theme, win) {
    var t = normalTheme(theme);
    var middle = t.middle === "colour" ? rgbOf(t.bg) : t.middle === "photo" ? greyOf(t.photo_luma) : rgbOf(BLACK);
    var a = rgbOf(t.glow_a) || rgbOf(DEFAULT_THEME.glow_a), b = rgbOf(t.glow_b) || rgbOf(DEFAULT_THEME.glow_b), gm = rgbOf(t.glow_mid);
    var userDim = t.middle === "photo" ? Number(t.dim) || 0 : 0;
    var alive = t.alive === true && !reducedMotion(win || (typeof window !== "undefined" ? window : null));
    var extra = extraLayers(t, alive);
    var stacked = t.glow_mid_alpha > 0 || t.glow_a_size > DEFAULT_THEME.glow_a_size || t.glow_b_size > DEFAULT_THEME.glow_b_size || extra.length > 0;
    function peak(dim, scrim) {
      var m = shade(middle || rgbOf(BLACK), dim);
      var points;
      if (!stacked) points = [m, over(a, t.glow_a_alpha, m), over(b, t.glow_b_alpha, m)];
      else {
        /* Every glow stacked on one point, as the browser would draw them. */
        var all = over(gm, t.glow_mid_alpha, m);
        all = over(b, t.glow_b_alpha, all);
        all = over(a, t.glow_a_alpha, all);
        extra.forEach(function (x) { all = over(x[0], Math.min(1, x[1]), all); });
        points = [m, all];
      }
      return shade(brightest(points), scrim);
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
      elementsFixed: ["buttons", "guide", "mark", "accent"].some(function (k) { return !!elements[k].fix; })
    };
  }

  function reducedMotion(win) {
    try { return !!(win && win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  /* A photo URL is only ever the server's own https storage URL, and never
     anything that could close the url( ). */
  function safePhotoUrl(url) {
    return typeof url === "string" && /^https:\/\/[^\s"'()\\<>]+$/.test(url) ? url : null;
  }
  function num(n) { return String(Math.round(n * 1000) / 1000); }

  /* The photo editor's tokens: only what differs from a plain centred cover. */
  function photoTokens(t) {
    var out = {};
    if (t.photo_fit === "fit") out["--bf-bg-size"] = "contain";
    else if (t.photo_fit === "custom") out["--bf-bg-size"] = num(t.photo_zoom) + "% auto";
    if (t.photo_x !== 50 || t.photo_y !== 50) out["--bf-bg-pos"] = num(t.photo_x) + "% " + num(t.photo_y) + "%";
    if (t.photo_blur > 0) { out["--bf-bg-blur"] = "blur(" + num(t.photo_blur) + "px)"; out["--bf-bg-inset"] = "-" + num(t.photo_blur * 2) + "px"; }
    if (t.photo_feather > 0) {
      var w = num(t.photo_feather) + "%";
      out["--bf-bg-feather"] = ["to right", "to left", "to bottom", "to top"].map(function (dir) {
        return "linear-gradient(" + dir + ", var(--bf-bg) 0%, transparent " + w + ")";
      }).join(", ");
    }
    return out;
  }

  /* The tokens one theme sets: { "--bf-...": value }, and whether it moves. */
  function tokensFor(theme, photoUrl, win) {
    var t = normalTheme(theme);
    win = win || window;
    var r = readability(t, win);
    var a = rgbOf(t.glow_a) || rgbOf(DEFAULT_THEME.glow_a), b = rgbOf(t.glow_b) || rgbOf(DEFAULT_THEME.glow_b);
    var url = t.middle === "photo" ? safePhotoUrl(photoUrl) : null;
    var alive = t.alive === true && !reducedMotion(win);
    var out = Object.assign({
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
    }, url ? photoTokens(t) : {});
    if (t.glow_a_size !== DEFAULT_THEME.glow_a_size) out["--bf-glow-a-reach"] = num(t.glow_a_size) + "%";
    if (t.glow_b_size !== DEFAULT_THEME.glow_b_size) out["--bf-glow-b-reach"] = num(t.glow_b_size) + "%";
    if (t.glow_mid_alpha > 0 || extraLayers(t, alive).length) {
      out["--bf-glow-m-rgb"] = rgbOf(t.glow_mid).join(", ");
      if (t.glow_mid_alpha > 0) out["--bf-glow-m-alpha"] = String(t.glow_mid_alpha);
      if (t.glow_mid_size !== DEFAULT_THEME.glow_mid_size) out["--bf-glow-m-reach"] = num(t.glow_mid_size) + "%";
    }
    if (alive) {
      if (t.motion !== "breathe") out["--bf-motion"] = t.motion;
      if (t.motion_speed !== 1) out["--bf-motion-speed"] = num(t.motion_speed);
      if (t.motion_intensity !== DEFAULT_THEME.motion_intensity) out["--bf-motion-k"] = num(t.motion_intensity / DEFAULT_THEME.motion_intensity);
    }
    return Object.assign(out, elementTokens(t, r.elements));
  }

  /* The element tokens one theme sets: only for the sections (and mist
     parts) not at their original, with readability's corrections applied,
     and each middle only when it is off the line. */
  function elementTokens(t, fixed) {
    var out = {};
    if (!atOriginal(t, "buttons")) {
      out["--bf-btn-a"] = fixed.buttons.a; out["--bf-btn-b"] = fixed.buttons.b; out["--bf-btn-text"] = fixed.buttons.text;
      if (midOn(t, "btn_mid")) out["--bf-btn-mid"] = ", " + fixed.buttons.mid;
    }
    if (!atOriginal(t, "mark")) {
      out["--bf-mark-a"] = fixed.mark.a; out["--bf-mark-b"] = fixed.mark.b;
      if (midOn(t, "mark_mid")) out["--bf-mark-mid"] = ", " + fixed.mark.mid;
    }
    if (!atOriginal(t, "guide")) {
      out["--bf-guide-a"] = fixed.guide.a; out["--bf-guide-b"] = fixed.guide.b;
      if (midOn(t, "guide_mid")) out["--bf-guide-mid"] = ", " + fixed.guide.mid;
    }
    if (!atOriginal(t, "chat")) {
      out["--tmx-chat-glow-a"] = channels(rgbOf(t.chat_glow_a));
      out["--tmx-chat-glow-b"] = channels(rgbOf(t.chat_glow_b));
      out["--tmx-chat-glow-c"] = t.chat_glow_b === DEFAULT_THEME.chat_glow_b ? CHAT_GLOW_C : channels(over([255, 255, 255], 0.25, rgbOf(t.chat_glow_b)));
      if (midOn(t, "chat_glow_mid")) out["--tmx-chat-glow-mid"] = ", rgba(" + channels(rgbOf(t.chat_glow_mid)) + ",0.64) 22%";
    }
    if (!atOriginal(t, "accent")) {
      var ends = { accent_a: fixed.accent.a, accent_b: fixed.accent.b };
      Object.keys(ACCENT_FAMILY).forEach(function (name) {
        var fam = ACCENT_FAMILY[name], base = DEFAULT_THEME[fam[0]];
        var hex = variantOf(ends[fam[0]], base, fam[1]);
        out[name] = hex; out[name + "-rgb"] = channels(rgbOf(hex));
      });
      if (midOn(t, "accent_mid")) out["--bf-accent-mid"] = ", " + fixed.accent.mid;
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
      "--tmx-chat-glow-a": channels(rgbOf(t.chat_glow_a)), "--tmx-chat-glow-b": channels(rgbOf(t.chat_glow_b)), "--tmx-chat-glow-c": CHAT_GLOW_C,
      /* Each middle at its ends' midpoint: a third stop on the line, so the
         gradient draws as it always has, whatever the page's own theme. */
      "--bf-btn-mid": ", " + t.btn_mid, "--bf-mark-mid": ", " + t.mark_mid, "--bf-guide-mid": ", " + t.guide_mid,
      "--tmx-chat-glow-mid": ", rgba(" + channels(rgbOf(t.chat_glow_mid)) + ",0.64) 22%", "--bf-accent-mid": ", " + t.accent_mid
    };
    Object.keys(ACCENT_FAMILY).forEach(function (name) { out[name] = ACCENT_FAMILY[name][1]; out[name + "-rgb"] = channels(rgbOf(ACCENT_FAMILY[name][1])); });
    Object.keys(MIST).forEach(function (part) { MIST[part].forEach(function (v, i) { out["--tmx-" + part + "-" + (i + 1)] = v; }); });
    return out;
  }

  /* A colour token's value now, for a canvas or chart that cannot read
     var(): the token's colour if the theme set it, else `fallback`
     unchanged. An rgba() fallback keeps its own alpha. */
  function color(name, fallback, doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    var v = "";
    try { v = String(doc.documentElement.style.getPropertyValue(name) || "").trim(); } catch (e) { v = ""; }
    if (!v || !rgbOf(v)) return fallback;
    var m = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*([0-9.]+%?)\s*)?\)$/i.exec(String(fallback));
    if (!m) return v;
    return m[1] !== undefined ? "rgba(" + channels(rgbOf(v)) + ", " + m[1] + ")" : "rgb(" + channels(rgbOf(v)) + ")";
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
    if (tokens && tokens["--bf-alive"] === "1") {
      root.setAttribute("data-bf-alive", "1");
      root.setAttribute("data-bf-motion", tokens["--bf-motion"] || "breathe");
    } else {
      root.removeAttribute("data-bf-alive");
      root.removeAttribute("data-bf-motion");
    }
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
    var worn = publicView(key, win) ? null : resolve(state, key);
    wornTheme = worn ? normalTheme(worn.theme) : null;
    var tokens = publicView(key, win) ? null : tokensForPage(state, key, win);
    if ((tokens ? JSON.stringify(tokens) : null) === applied) return false;
    setTokens(doc, tokens);
    return true;
  }

  /* The live energy, 0 … 1: it strengthens whichever motion is running.
     Clamped; anything that is not a number is 0. The music player feeds it,
     through musicEnergy below and nothing else. */
  var liveEnergy = 0;
  function setLiveEnergy(value, doc) {
    doc = doc || document;
    var n = typeof value === "number" && isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    liveEnergy = Math.round(n * 1000) / 1000;
    if (liveEnergy > 0) doc.documentElement.style.setProperty("--bf-live-energy", String(liveEnergy));
    else doc.documentElement.style.removeProperty("--bf-live-energy");
    return liveEnergy;
  }

  /* MOVE WITH THE MUSIC (above). The theme this page wears, as normalTheme
     leaves it, is kept by applyState. */
  var MUSIC_CHANNEL = "bf-music";
  var MUSIC_STALE_MS = 250, MUSIC_EASE_MS = 33, MUSIC_EASE_STEP = MUSIC_EASE_MS / 1000;
  var wornTheme = null, musicHeard = 0, musicTimer = null;
  /* How much of the player's energy this page passes on: 0 unless its theme
     has "Move with the music" on and its corners alive, and never under
     reduced motion. */
  function musicScale(win) {
    var t = wornTheme;
    if (!t || t.alive !== true || t.music_move !== true || reducedMotion(win)) return 0;
    return t.music_intensity;
  }
  function musicEnergy(value, win, doc) {
    var n = typeof value === "number" && isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
    musicHeard = Date.now();
    setLiveEnergy(n * musicScale(win), doc);
    if (liveEnergy > 0 && !musicTimer && win.setInterval) musicTimer = win.setInterval(function () { musicQuiet(win, doc); }, MUSIC_EASE_MS);
    return liveEnergy;
  }
  /* The player went quiet without easing out: ease to 0 here, over a second. */
  function musicQuiet(win, doc) {
    if (Date.now() - musicHeard < MUSIC_STALE_MS && liveEnergy > 0) return;
    setLiveEnergy(Math.max(0, liveEnergy - MUSIC_EASE_STEP), doc);
    if (liveEnergy <= 0 && musicTimer) { win.clearInterval(musicTimer); musicTimer = null; }
  }
  function listenForMusic(win, doc) {
    if (typeof win.BroadcastChannel !== "function") return null;
    try {
      var channel = new win.BroadcastChannel(MUSIC_CHANNEL);
      channel.onmessage = function (e) { var m = e && e.data; if (m && m.type === "energy") musicEnergy(m.value, win, doc); };
      return channel;
    } catch (e) { return null; }
  }
  /* Whether any of the member's themes moves with the music, so the player
     measures energy only when something will use it. */
  function musicWanted(win) {
    if (reducedMotion(win)) return false;
    var c = readCache(win), uid = signedInId(win);
    if (!c || !uid || c.uid !== uid || !c.state || !Array.isArray(c.state.themes)) return false;
    return c.state.themes.some(function (row) { var t = row && normalTheme(row.theme); return !!t && t.alive === true && t.music_move === true; });
  }

  /* Motion rests while the tab is out of sight. */
  function syncPaused(doc) {
    if (doc.hidden) doc.documentElement.setAttribute("data-bf-motion-paused", "1");
    else doc.documentElement.removeAttribute("data-bf-motion-paused");
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
    syncPaused(doc);
    if (doc.addEventListener) doc.addEventListener("visibilitychange", function () { syncPaused(doc); });
    listenForMusic(win, doc);
    /* Reduced motion switched on while the page is open stops the motion. */
    try {
      var mq = win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)");
      var again = function () { var c = readCache(win); applied = undefined; if (c && signedInId(win) === c.uid) applyState(c.state, win, doc); };
      if (mq && mq.addEventListener) mq.addEventListener("change", again);
      else if (mq && mq.addListener) mq.addListener(again);
    } catch (e) { /* no media queries: nothing to follow */ }
    var later = function () { refresh(win, doc, false); };
    if (doc.readyState === "loading" && doc.addEventListener) doc.addEventListener("DOMContentLoaded", later);
    else later();
  }

  /* PRESETS: Original and ten three-colour spectrums, each a whole palette
     (corners, middle tone, buttons, wordmark, guide text, headings, chat glow
     and mist). Designed in OKLCH: each middle sits between its corners, and
     every one is readable on the black middle as it is, with nothing raised. */
  var PRESET_KEYS = ["glow_a", "glow_a_alpha", "glow_mid", "glow_b", "glow_b_alpha", "glow_mid_alpha", "mid_auto", "match_all",
    "btn_a", "btn_mid", "btn_b", "btn_text", "mark_a", "mark_mid", "mark_b", "guide_a", "guide_mid", "guide_b",
    "accent_a", "accent_mid", "accent_b", "chat_glow_a", "chat_glow_mid", "chat_glow_b",
    "mist_core", "mist_haze", "mist_pulse", "mist_spark", "mist_star", "mist_dust", "mist_trail", "mist_whisper"];
  var PRESETS = [
    { id: "original", name: "Original", theme: {glow_a: "#00e5ff", glow_a_alpha: 0.14, glow_mid: "#6eabff", glow_b: "#a855f7", glow_b_alpha: 0.18, glow_mid_alpha: 0, mid_auto: true, match_all: false, btn_a: "#06b6d4", btn_mid: "#4989e5", btn_b: "#8b5cf6", btn_text: "#ffffff", mark_a: "#22d3ee", mark_mid: "#6594f3", mark_b: "#a855f7", guide_a: "#22d3ee", guide_mid: "#6594f3", guide_b: "#a855f7", accent_a: "#22d3ee", accent_mid: "#6594f3", accent_b: "#a855f7", chat_glow_a: "#00e5ff", chat_glow_mid: "#3e8afb", chat_glow_b: "#7b2ff7", mist_core: "#3c78ff", mist_haze: "#300c96", mist_pulse: "#500f6e", mist_spark: "#ffe896", mist_star: "#ffffff", mist_dust: "#f0c850", mist_trail: "#cddaff", mist_whisper: "#d7cdf5"} },
    { id: "solar-flare", name: "Solar Flare", theme: {glow_a: "#ffb000", glow_a_alpha: 0.13, glow_mid: "#e0103a", glow_b: "#6b1f73", glow_b_alpha: 0.21, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#986805", btn_mid: "#e0103a", btn_b: "#6b1f73", btn_text: "#ffffff", mark_a: "#ffb000", mark_mid: "#f8364d", mark_b: "#b668be", guide_a: "#ffcc59", guide_mid: "#eb647f", guide_b: "#a774ac", accent_a: "#ffb000", accent_mid: "#f8364d", accent_b: "#b668be", chat_glow_a: "#ffb000", chat_glow_mid: "#e0103a", chat_glow_b: "#6b1f73", mist_core: "#ffb000", mist_haze: "#6b1f73", mist_pulse: "#e95875", mist_spark: "#ffdf99", mist_star: "#e9ddea", mist_dust: "#b58fb9", mist_trail: "#ffe7b3", mist_whisper: "#dac7dc"} },
    { id: "deep-reef", name: "Deep Reef", theme: {glow_a: "#3ff5e0", glow_a_alpha: 0.07, glow_mid: "#0f8f8a", glow_b: "#7a5a12", glow_b_alpha: 0.21, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#008073", btn_mid: "#007f7a", btn_b: "#7a5a12", btn_text: "#ffffff", mark_a: "#3ff5e0", mark_mid: "#30a29c", mark_b: "#ae8c4b", guide_a: "#82f9eb", guide_mid: "#63b6b3", guide_b: "#a99465", accent_a: "#3ff5e0", accent_mid: "#30a29c", accent_b: "#ae8c4b", chat_glow_a: "#3ff5e0", chat_glow_mid: "#0f8f8a", chat_glow_b: "#7a5a12", mist_core: "#3ff5e0", mist_haze: "#7a5a12", mist_pulse: "#57b1ad", mist_spark: "#b2fbf3", mist_star: "#ebe6db", mist_dust: "#bdad89", mist_trail: "#c5fcf6", mist_whisper: "#ded6c4"} },
    { id: "nebula", name: "Nebula", theme: {glow_a: "#ff3fd2", glow_a_alpha: 0.11, glow_mid: "#6d5cf0", glow_b: "#a9dcff", glow_b_alpha: 0.09, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#d202ab", btn_mid: "#6c5aee", btn_b: "#467696", btn_text: "#ffffff", mark_a: "#ff3fd2", mark_mid: "#837bff", mark_b: "#a9dcff", guide_a: "#ff82e2", guide_mid: "#a095f5", guide_b: "#c7e8ff", accent_a: "#ff3fd2", accent_mid: "#837bff", accent_b: "#a9dcff", chat_glow_a: "#ff3fd2", chat_glow_mid: "#6d5cf0", chat_glow_b: "#a9dcff", mist_core: "#ff3fd2", mist_haze: "#a9dcff", mist_pulse: "#998df5", mist_spark: "#ffb2ed", mist_star: "#f2faff", mist_dust: "#d4eeff", mist_trail: "#ffc5f2", mist_whisper: "#eaf6ff"} },
    { id: "emerald-throne", name: "Emerald Throne", theme: {glow_a: "#b6f23a", glow_a_alpha: 0.05, glow_mid: "#10b26b", glow_b: "#b8860b", glow_b_alpha: 0.13, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#5a7d00", btn_mid: "#01834d", btn_b: "#936a00", btn_text: "#ffffff", mark_a: "#b6f23a", mark_mid: "#10b26b", mark_b: "#bd8b16", guide_a: "#d0f77f", guide_mid: "#64cd9f", guide_b: "#d1b060", accent_a: "#b6f23a", accent_mid: "#10b26b", accent_b: "#bd8b16", chat_glow_a: "#b6f23a", chat_glow_mid: "#10b26b", chat_glow_b: "#b8860b", mist_core: "#b6f23a", mist_haze: "#b8860b", mist_pulse: "#58c997", mist_spark: "#e2fab0", mist_star: "#f4edda", mist_dust: "#dcc385", mist_trail: "#e9fbc4", mist_whisper: "#ede1c2"} },
    { id: "obsidian-rose", name: "Obsidian Rose", theme: {glow_a: "#ff6f9c", glow_a_alpha: 0.16, glow_mid: "#8c1c3f", glow_b: "#2e1a47", glow_b_alpha: 0.4, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#c83c6e", btn_mid: "#8c1c3f", btn_b: "#2e1a47", btn_text: "#ffffff", mark_a: "#ff6f9c", mark_mid: "#cb5872", mark_b: "#8974a9", guide_a: "#ffa1bf", guide_mid: "#b96f86", guide_b: "#8d809e", accent_a: "#ff6f9c", accent_mid: "#cb5872", accent_b: "#8974a9", chat_glow_a: "#ff6f9c", chat_glow_mid: "#8c1c3f", chat_glow_b: "#2e1a47", mist_core: "#ff6f9c", mist_haze: "#2e1a47", mist_pulse: "#af6079", mist_spark: "#ffc5d7", mist_star: "#e0dde3", mist_dust: "#978da3", mist_trail: "#ffd4e1", mist_whisper: "#cbc6d1"} },
    { id: "arctic", name: "Arctic", theme: {glow_a: "#e8f8ff", glow_a_alpha: 0.04, glow_mid: "#22d8f0", glow_b: "#3b6e9e", glow_b_alpha: 0.18, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#66747a", btn_mid: "#047e8d", btn_b: "#3b6e9e", btn_text: "#ffffff", mark_a: "#e8f8ff", mark_mid: "#22d8f0", mark_b: "#6195c8", guide_a: "#f0faff", guide_mid: "#6fe6f5", guide_b: "#80a1c0", accent_a: "#e8f8ff", accent_mid: "#22d8f0", accent_b: "#6195c8", chat_glow_a: "#e8f8ff", chat_glow_mid: "#22d8f0", chat_glow_b: "#3b6e9e", mist_core: "#e8f8ff", mist_haze: "#3b6e9e", mist_pulse: "#64e4f5", mist_spark: "#f6fcff", mist_star: "#e2e9f0", mist_dust: "#9db7cf", mist_trail: "#f8fdff", mist_whisper: "#cedbe7"} },
    { id: "phoenix", name: "Phoenix", theme: {glow_a: "#ffd23f", glow_a_alpha: 0.08, glow_mid: "#ff7a1a", glow_b: "#e01e1e", glow_b_alpha: 0.15, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#8b6f05", btn_mid: "#b95402", btn_b: "#e01e1e", btn_text: "#ffffff", mark_a: "#ffd23f", mark_mid: "#ff7a1a", mark_b: "#fe433a", guide_a: "#ffe282", guide_mid: "#ffa96a", guide_b: "#eb6d6d", accent_a: "#ffd23f", accent_mid: "#ff7a1a", accent_b: "#fe433a", chat_glow_a: "#ffd23f", chat_glow_mid: "#ff7a1a", chat_glow_b: "#e01e1e", mist_core: "#ffd23f", mist_haze: "#e01e1e", mist_pulse: "#ffa25f", mist_spark: "#ffedb2", mist_star: "#fadddd", mist_dust: "#f08f8f", mist_trail: "#fff2c5", mist_whisper: "#f7c7c7"} },
    { id: "amethyst", name: "Amethyst", theme: {glow_a: "#d6b4ff", glow_a_alpha: 0.09, glow_mid: "#8b3dff", glow_b: "#2347d6", glow_b_alpha: 0.2, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#8363a8", btn_mid: "#8b3dff", btn_b: "#2347d6", btn_text: "#ffffff", mark_a: "#d6b4ff", mark_mid: "#9a69ff", mark_b: "#5481fe", guide_a: "#e4ceff", guide_mid: "#b481ff", guide_b: "#7087e4", accent_a: "#d6b4ff", accent_mid: "#9a69ff", accent_b: "#5481fe", chat_glow_a: "#d6b4ff", chat_glow_mid: "#8b3dff", chat_glow_b: "#2347d6", mist_core: "#d6b4ff", mist_haze: "#2347d6", mist_pulse: "#ae77ff", mist_spark: "#efe1ff", mist_star: "#dee3f9", mist_dust: "#91a3eb", mist_trail: "#f3e9ff", mist_whisper: "#c8d1f5"} },
    { id: "black-sun", name: "Black Sun", theme: {glow_a: "#f2c14e", glow_a_alpha: 0.12, glow_mid: "#9a6230", glow_b: "#2c1842", glow_b_alpha: 0.42, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#906d02", btn_mid: "#9a6230", btn_b: "#2c1842", btn_text: "#ffffff", mark_a: "#f2c14e", mark_mid: "#b07745", mark_b: "#907bad", guide_a: "#f7d78c", guide_mid: "#bd9978", guide_b: "#8e809c", accent_a: "#f2c14e", accent_mid: "#b07745", accent_b: "#907bad", chat_glow_a: "#f2c14e", chat_glow_mid: "#9a6230", chat_glow_b: "#2c1842", mist_core: "#f2c14e", mist_haze: "#2c1842", mist_pulse: "#b8916e", mist_spark: "#fae6b8", mist_star: "#dfdce3", mist_dust: "#968ca1", mist_trail: "#fbecca", mist_whisper: "#cac5d0"} },
    { id: "mono-silver", name: "Mono Silver", theme: {glow_a: "#eef1f6", glow_a_alpha: 0.06, glow_mid: "#a3aab6", glow_b: "#4a505b", glow_b_alpha: 0.19, glow_mid_alpha: 0.05, mid_auto: false, match_all: false, btn_a: "#707277", btn_mid: "#6c727d", btn_b: "#4a505b", btn_text: "#ffffff", mark_a: "#eef1f6", mark_mid: "#a3aab6", mark_b: "#808692", guide_a: "#f4f6f9", guide_mid: "#c3c8d0", guide_b: "#898d94", accent_a: "#eef1f6", accent_mid: "#a3aab6", accent_b: "#808692", chat_glow_a: "#eef1f6", chat_glow_mid: "#a3aab6", chat_glow_b: "#4a505b", mist_core: "#eef1f6", mist_haze: "#4a505b", mist_pulse: "#bfc4cc", mist_spark: "#f8f9fb", mist_star: "#e4e5e6", mist_dust: "#a5a8ad", mist_trail: "#fafbfc", mist_whisper: "#d2d3d6"} }
  ];

  window.BFTheme = {
    DEFAULT_THEME: DEFAULT_THEME,
    UNTHEMED: UNTHEMED,
    THEME_TOKENS: ALL_TOKENS,
    BACKDROP_TOKENS: THEME_TOKENS,
    BACKDROP_4D_TOKENS: BACKDROP_4D_TOKENS,
    ELEMENT_TOKENS: ELEMENT_TOKENS,
    ELEMENTS: ELEMENTS,
    MIDS: MIDS,
    RANGES: RANGES,
    FITS: FITS,
    MOTIONS: MOTIONS,
    ACCENT_FAMILY: ACCENT_FAMILY,
    MIST: MIST,
    RULE: RULE,
    PRESETS: PRESETS,
    PRESET_KEYS: PRESET_KEYS,
    TEXT: TEXT, MUTED: MUTED, ACCENT: ACCENT, TEXT_MIN: TEXT_MIN, MUTED_MIN: MUTED_MIN,
    BTN_MIN: BTN_MIN, GUIDE_MIN: GUIDE_MIN, MARK_MIN: MARK_MIN, ACCENT_MIN: ACCENT_MIN, WHITE: WHITE, NEAR_BLACK: NEAR_BLACK,
    rgbOf: rgbOf,
    mixHex: mixHex,
    oklchOf: oklchOf,
    oklabDistance: oklabDistance,
    hexOfOklch: hexOfOklch,
    midTone: midTone,
    onTheLine: onTheLine,
    variantOf: variantOf,
    matchAll: matchAll,
    stopsFor: stopsFor,
    atOriginal: atOriginal,
    normalTheme: normalTheme,
    originalTokens: originalTokens,
    luminance: luminance,
    contrast: contrast,
    readability: function (theme) { return readability(theme, window); },
    tokensFor: tokensFor,
    photoTokens: function (theme) { return photoTokens(normalTheme(theme)); },
    color: function (name, fallback) { return color(name, fallback, document); },
    setLiveEnergy: function (value) { return setLiveEnergy(value, document); },
    liveEnergy: function () { return liveEnergy; },
    MUSIC_CHANNEL: MUSIC_CHANNEL,
    musicScale: function () { return musicScale(window); },
    musicWanted: function () { return musicWanted(window); },
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

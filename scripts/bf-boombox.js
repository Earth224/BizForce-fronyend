/* ══════════════════════════════════════════════════════════════════════════
   BF BOOMBOX — the BizForce music player's body: a hyper-real boombox-mixer,
   drawn in SVG and CSS (no raster image anywhere), in polished CHROME or
   glossy piano BLACK, themed by the tokens, with no emoji anywhere.
   scripts/bf-music.js mounts it and owns the sound; this file owns the look,
   the place on screen and the motion.

   THE FINISH (data-finish on the root, the member's choice; bf-music.js holds
   it): CHROME is multi-stop specular gradients over a brushed-metal grain (a
   fine repeating gradient), bevelled edges (a highlight above and to the
   left, a shadow below and to the right), inner shadows for depth, an
   ambient reflection across the top, and a silver rim whose shine wanders
   round the body (the Termaximus chat box's gold rim, the same masked ring,
   in silver), with a light sweep crossing the face now and then. BLACK is
   the same construction in glossy piano black with chrome accents (the rim,
   the handle, the speaker bezels, the screws) and a softer sheen. The bar
   (minimised) wears the same finish.

   THE PARTS.
     a chrome carry handle with its highlight; four screws; rubber feet;
     two pumping woofers in chrome bezels behind a perforated grille (a dot
       pattern), each a rubber surround, a cone and a dust cap, and a small
       tweeter above each;
     a glowing VFD display (the luminous look of a classic deck, in the
       theme's accent): "Title — Artist", the time, a live spectrum or
       waveform strip, and the seek bar;
     a dot-matrix LED ticker under the handle: "NN / TT · Title · Artist ·
       Playlist name";
     a cassette window with two reels;
     six piano keys: previous, play/pause, stop, next, shuffle, repeat;
     THE MIXER DECK, a recessed panel along the bottom, each part in its own
     lane so nothing overlaps at any position (EQ, Mix, meters, volume, keys):
       three EQ knobs, BASS, MID and TREBLE (-12 … +12 dB, a centre detent,
         double-click resets; bf-music.js feeds them to its filters);
       a horizontal CROSSFADER that sets the Mix (0 … 12 s), showing it;
       two LED level meters (left and right when the sound is stereo, else
         the level and its peak), centred in their own slot;
       a vertical VOLUME FADER in its own lane, its VOL label beneath, clear
         of the meters;
       five body keys, styled like the piano keys: Mute, Library (opens the
         slide-out library), Reset position, Minimise, Close to icon.
   Every knob and fader is a slider for the keyboard (the arrows, Page Up and
   Down, Home and End) with its label and value spoken.

   THE MOTION, from the analyser bf-music.js reads (bass, highs, level, and
   the two channels): the woofer cones and dust caps pulse outward with the
   bass (scale); the tweeters shimmer with the highs; the meters light with
   each channel; the reels turn at a steady speed while playing and slow to a
   stop over about a second on pause. Only transform and opacity ever change,
   so it stays on the GPU. Nothing moves while paused; the sheen, the rim's
   shine and the scrolling text pause while the tab is hidden; under
   prefers-reduced-motion everything is still: no sweep, a still meter.

   NOW PLAYING. While a track is loaded the VFD scrolls "Title — Artist" and
   the ticker scrolls its line (about five characters a second, each loop
   holding still at its start). When a new track starts, a neon "Now playing"
   banner sweeps once across the face (about 1.2 s). Screen readers hear "Now
   playing: <title> by <artist>" once per track. With nothing loaded the
   display says "No track loaded" and nothing scrolls.

   THREE STAGES: THE ICON -> THE BAR -> THE BOOMBOX.
     the ICON is the music button (40 x 40, round, the header's own control
       style, MUSIC_ICON: the golden note, in the theme's accent),
       shown ONLY on the dashboard (opts.home), INSIDE the top bar (a child of
       the bar's own element), level with the logo, halfway between the logo
       and the bar's centre (iconPlan, placeInBar); it is the
       dashboard's first-time stage, nothing else shows and no audio starts.
       While music plays its wave drifts. "Music player" opens the bar. On any other page
       it shows only while music is on, as a small floating icon, so a stop is
       always within reach;
     the BAR: a press on it, or "Open the boombox", opens the boombox;
     stepping back: Minimise, or Escape (one stage at a time: the library
       first, then the boombox to the bar, then the bar to the icon); "Close
       to icon" on the bar and on the boombox's body goes straight to the
       icon, and the music keeps playing; "Stop music" on both stops it;
     on every other signed-in page (the member's own profile among them)
       NOTHING shows unless music is on (playing, or paused mid-track in this
       session; bf-music.js says so, setLive): then the bar or the boombox
       follows at its last stage. "Close to icon" there leaves the floating
       icon (its wave drifting) where the player was, by the position rule:
       pressed, it opens the bar, which has Stop. Stopping the music takes the
       player off those pages (data-away);
     the stage is remembered on this device (bf_boombox) and on the account
       (bf-music.js sends onStage to PUT /api/music/player).
   POSITION, the member's setting (bf-music.js holds it): FOLLOW ME is fixed
     on screen and draggable; PINNED stays in its home spot (absolute, beside
     the logo, or the top-left corner without one) and scrolls with the page,
     no dragging, no Reset position. On the dashboard the icon is always in
     place (pinned); elsewhere the floating icon follows the setting too.

   WHERE IT SITS ("float", every signed-in page that loads the mist):
     fixed on screen (FOLLOW ME); it remembers the stage it was left in;
     by default the bar docks beside the BizForce AI logo in the page header
       ([data-bf-boombox-anchor] on the logo), vertically centred on the
       header: to the logo's right, or to its left where the logo sits at the
       header's right end and the bar would not fit; a page without that
       header puts it in the top-left corner, 16 px in;
     opening it expands the boombox in place, down and right from the bar,
       kept on screen; minimising returns the bar to the same spot;
     draggable by the mist's own rule (scripts/termaximus-presence.js): a 6 px
       threshold, clamped fully on screen, saved on release; the arrow keys
       nudge it 10 px (40 with Shift); Home or the Reset key returns it to the
       default spot beside the logo; a resize re-clamps it;
     its place and whether it is open are this device's (bf_boombox);
     it never covers the mist or the open chat box: when they meet it is
       nudged aside by the smallest move that keeps it on screen;
     THE LIBRARY is a panel that SLIDES OUT from behind the boombox: below it
       when there is room, else to its right or left, whichever fits; it
       slides back on Library, or Escape (a second Escape minimises);
     at 860 px and narrower (the mist's phone width) the bar docks to the
       bottom edge and opening it is a bottom sheet with the boombox scaled
       to fit.
   In the small window (music-popout.html, "popout", only when the member
   chooses "Keep playing between pages") it is that window's whole player:
   open, with the library beneath it, never minimised.

   Z-ORDER, low to high: the page; the boombox (2147483000); the chat box's
   glow (2147483646); the chat box and the mist (2147483647). The mist and the
   chat stay on top, and the nudge keeps the boombox out from under them. */
(function () {
  "use strict";
  if (window.BFBoombox) return;

  var doc = document;
  var STORE_KEY = "bf_boombox";
  var DRAG_THRESHOLD = 6;        // the mist's TMX_DRAG_THRESHOLD
  var NUDGE = 10;                // the mist's TMX_CHAT_NUDGE
  var PHONE_MAX = 860;           // the mist's TMX_CHAT_DRAG_MIN_W
  var GAP = 12;
  var EDGE = 16;                 // the top-left corner's margin where there is no header
  var Z = 2147483000;
  var BOX_W = 440, BOX_H = 250, BAR_W = 300, BAR_H = 40;
  var DRAWER_W = 360, DRAWER_MAX_H = 460, DRAWER_MIN_H = 220;
  var LEDS = 8;
  var WAVE_BARS = 5;
  var REEL_DEG_PER_S = 200;
  var CONE_PULSE = 0.09, CAP_PULSE = 0.14, TWEETER_PULSE = 0.06;
  var EQ_MAX = 12, EQ_DETENT = 0.75, MIX_MAX = 12;
  var EQ_BANDS = [["bass", "Bass", "BASS"], ["mid", "Mid", "MID"], ["treble", "Treble", "TREBLE"]];
  var FINISHES = ["chrome", "black"];
  var STAGES = ["icon", "tag", "box"];          // the icon, the bar, the boombox
  var POSITIONS = ["follow", "pinned"];
  /* NAMED BEFORE → AFTER (Nov 8 2026, the music button). BEFORE: a 40 x 36
     drawing of a small boombox. AFTER: a 40 x 40 round header button, the
     same size as the header's other round controls (.topbar-icon-btn). */
  var ICON_W = 40, ICON_H = 40;
  var ICON_MIN_GAP = 24;         // the least space between the logo and the music button
  /* NAMED (Nov 9 2026, button kept in the top bar): the last-resort size on a crowded bar, and the
     bars the button lives in (the dashboard's header.topbar, every other page's .top-nav). */
  var ICON_SMALL = 32;
  var BAR_SEL = "header, nav, .topbar, .top-nav";
  /* The deck's lanes (px inside its border): every part has its own slot, so
     nothing overlaps at any fader or crossfader position. */
  var XF_W = 88, XF_CAP = 14, XF_TRAVEL = XF_W - XF_CAP;
  var FADER_H = 30, FADER_CAP = 9, VOL_TRAVEL = FADER_H - FADER_CAP;
  var NO_TRACK = "No track loaded";
  var ALL_TRACKS = "All tracks";
  var SEP = " — ", DOT = " · ";
  var SWEEP_MS = 1200;           // the "Now playing" banner, once per new track
  var SCROLL_S_PER_CHAR = 0.2;   // about five characters a second
  var SCROLL_HOLD = 0.12;        // each loop holds still for its first 12%
  var TAG_FIT_CHARS = 26;        // what the bar holds when it cannot be measured
  var TAG_GAP = 28;              // the space between the marquee's two copies

  function clamp01(n) { return n > 0 ? (n < 1 ? n : 1) : 0; }
  function clampDb(v) { var n = Math.round(Number(v) * 2) / 2; if (!isFinite(n)) n = 0; return Math.max(-EQ_MAX, Math.min(EQ_MAX, n)); }
  function clampMix(v) { var n = Math.round(Number(v)); if (!isFinite(n)) n = 0; return Math.max(0, Math.min(MIX_MAX, n)); }
  function dbText(db) { return (db > 0 ? "+" : "") + db + " dB"; }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  function phone() { return window.innerWidth <= PHONE_MAX; }

  /* The mist's clamp (termaximus-presence.js _tmxClampPosition), the same rule. */
  function clampPosition(left, top, el) {
    var maxLeft = Math.max(window.innerWidth  - el.offsetWidth,  0);
    var maxTop  = Math.max(window.innerHeight - el.offsetHeight, 0);
    return {
      left: Math.min(Math.max(left, 0), maxLeft),
      top:  Math.min(Math.max(top,  0), maxTop)
    };
  }

  function loadPrefs() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { p = null; }
    return p && typeof p === "object" ? p : {};
  }
  function savePrefs(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) { /* storage unavailable */ } }

  var ICON = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    prev: '<path d="M6.5 5v14"/><path d="M19 5.5v13L9 12z" fill="currentColor"/>',
    next: '<path d="M17.5 5v14"/><path d="M5 5.5v13L15 12z" fill="currentColor"/>',
    shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1.1 1.6 2.3 2.6 4.3 2.6H21"/><path d="M3 17h3.5c1.5 0 2.5-.5 3.4-1.5"/><path d="M14.1 8.5c.9-1 1.9-1.5 3.4-1.5H21"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/>',
    repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/>',
    one: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/><path d="M11 10.5 12.5 9.5v5"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5"/><path d="m21 9.5-5 5"/>',
    expand: '<path d="M4 14v6h6"/><path d="M20 10V4h-6"/><path d="M4 20l7-7"/><path d="M20 4l-7 7"/>',
    minimise: '<path d="M5 12h14"/>',
    library: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><circle cx="18" cy="17" r="2.5"/><path d="M20.5 17V10"/>',
    reset: '<path d="M4 4v6h6"/><path d="M5.5 15a7 7 0 1 0 1.6-7.4L4 10"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none"/>',
    shrink: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>'
  };
  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 14) + '" height="' + (size || 14) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON[name] + "</svg>";
  }

  /* ── the drawing: 440 x 250, over the face and under the controls ─────── */
  function stop(o, v) { return '<stop offset="' + o + '" style="stop-color:var(' + v + ')"/>'; }
  function speaker(cx, cy, side) {
    return '<g class="bbx-speaker" data-side="' + side + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="58" fill="url(#bbxBezel)" stroke="rgba(0,0,0,.55)" stroke-width="1.2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="53" fill="#07080b"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="51" fill="url(#bbxSurround)"/>' +
      '<g class="bbx-cone"><circle cx="' + cx + '" cy="' + cy + '" r="41" fill="url(#bbxCone)"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="31" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="21" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="1"/></g>' +
      '<g class="bbx-cap"><circle cx="' + cx + '" cy="' + cy + '" r="13" fill="url(#bbxCap)"/>' +
        '<circle cx="' + (cx - 4) + '" cy="' + (cy - 4) + '" r="3.4" fill="rgba(255,255,255,.6)"/></g>' +
      '<circle class="bbx-grille" cx="' + cx + '" cy="' + cy + '" r="51" fill="url(#bbxGrille)"/>' +
      '<path d="M' + (cx - 44) + " " + (cy - 30) + " A54 54 0 0 1 " + (cx + 30) + " " + (cy - 46) + '" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.6" stroke-linecap="round"/>' +
      "</g>";
  }
  function tweeter(cx, cy) {
    return '<g class="bbx-tweeter"><circle cx="' + cx + '" cy="' + cy + '" r="10" fill="url(#bbxBezel)" stroke="rgba(0,0,0,.5)" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="url(#bbxSurround)"/>' +
      '<circle class="bbx-tweeter-dome" cx="' + cx + '" cy="' + cy + '" r="4.5" fill="url(#bbxCap)"/></g>';
  }
  function screw(cx, cy, deg) {
    return '<g class="bbx-screw"><circle cx="' + cx + '" cy="' + cy + '" r="4.2" fill="url(#bbxScrew)" stroke="rgba(0,0,0,.55)" stroke-width=".8"/>' +
      '<path d="M' + (cx - 2.6) + " " + cy + " H" + (cx + 2.6) + '" stroke="rgba(0,0,0,.65)" stroke-width="1.1" transform="rotate(' + deg + " " + cx + " " + cy + ')"/></g>';
  }
  function reel(cx, cy) {
    var spokes = "";
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, x = cx + Math.cos(a) * 7.5, y = cy + Math.sin(a) * 7.5;
      spokes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(2) + '" y2="' + y.toFixed(2) + '"/>';
    }
    return '<g class="bbx-reel"><circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#ece6d8" stroke="#6b6458" stroke-width="1"/>' +
      '<g stroke="#6b6458" stroke-width="1.6" stroke-linecap="round">' + spokes + "</g>" +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#2a2620"/></g>';
  }
  var DRAWING =
    '<svg class="bbx-art" viewBox="0 0 ' + BOX_W + " " + BOX_H + '" aria-hidden="true" focusable="false">' +
      "<defs>" +
        '<linearGradient id="bbxHandle" x1="0" y1="0" x2="0" y2="1">' + stop(0, "--bbx-h1") + stop(0.45, "--bbx-h2") + stop(1, "--bbx-h3") + "</linearGradient>" +
        '<radialGradient id="bbxBezel" cx=".38" cy=".3" r=".75">' + stop(0, "--bbx-h1") + stop(0.55, "--bbx-h3") + stop(0.85, "--bbx-h2") + stop(1, "--bbx-h1") + "</radialGradient>" +
        '<radialGradient id="bbxSurround" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#3a3f4c"/><stop offset=".85" stop-color="#14161c"/><stop offset="1" stop-color="#05060a"/></radialGradient>' +
        '<radialGradient id="bbxCone" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#4a5062"/><stop offset=".6" stop-color="#1d2029"/><stop offset="1" stop-color="#0b0c11"/></radialGradient>' +
        '<radialGradient id="bbxCap" cx=".38" cy=".34" r=".7">' + stop(0, "--bbx-h1") + stop(0.5, "--bbx-h3") + stop(1, "--bbx-h2") + "</radialGradient>" +
        '<radialGradient id="bbxScrew" cx=".35" cy=".3" r=".8">' + stop(0, "--bbx-h1") + stop(0.6, "--bbx-h3") + stop(1, "--bbx-h2") + "</radialGradient>" +
        '<linearGradient id="bbxWindow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f2a"/><stop offset="1" stop-color="#0a0c12"/></linearGradient>' +
        '<linearGradient id="bbxFoot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2f35"/><stop offset="1" stop-color="#050506"/></linearGradient>' +
        /* the perforated grille: a metal sheet's dots, over the cones (they move behind it) */
        '<pattern id="bbxGrille" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" style="fill:var(--bbx-grille)"/><circle cx="2.5" cy="2.5" r="1.45" fill="rgba(0,0,0,.6)"/></pattern>' +
      "</defs>" +
      '<rect x="40" y="232" width="66" height="15" rx="7" fill="url(#bbxFoot)"/><rect x="334" y="232" width="66" height="15" rx="7" fill="url(#bbxFoot)"/>' +
      '<path class="bbx-handle" d="M128 30 V16 Q128 3 142 3 H298 Q312 3 312 16 V30 H300 V18 Q300 14 296 14 H144 Q140 14 140 18 V30 Z" fill="url(#bbxHandle)" stroke="rgba(0,0,0,.45)" stroke-width="1"/>' +
      '<path d="M146 6.5 H294" stroke="rgba(255,255,255,.9)" stroke-width="1.4" stroke-linecap="round"/>' +
      speaker(78, 126, "left") + speaker(362, 126, "right") + tweeter(44, 46) + tweeter(396, 46) +
      screw(17, 44, 30) + screw(423, 44, -20) + screw(17, 214, 75) + screw(423, 214, 10) +
      '<rect x="170" y="103" width="100" height="28" rx="5" fill="url(#bbxWindow)" stroke="rgba(255,255,255,.4)" stroke-width="1"/>' +
      '<rect x="188" y="108" width="64" height="18" rx="3" fill="rgba(236,230,216,.12)"/>' +
      reel(198, 117) + reel(242, 117) +
      '<rect x="172" y="104" width="96" height="5" rx="2.5" fill="rgba(255,255,255,.14)"/>' +
    "</svg>";
  /* THE MUSIC BUTTON'S ICON, the one source every page uses (iconHtml below,
     and BFBoombox.MUSIC_ICON): "the golden note", a golden-ratio spiral
     (quarter arcs of radius 55, 34, 21, 13, 8) as the note's head, with a
     music stem and flag rising from it. The spiral is drawn twice: a wide,
     soft glow (.bfm-gn-glow) under the line itself (.bfm-gn-spiral). Every
     colour comes from the CSS below, all currentColor, so it wears the
     theme's accent in every theme. At rest the glow is off; on hover and
     focus it fades in; while music plays it pulses and the spiral lightens;
     under prefers-reduced-motion it holds a steady glow; while the tab is
     hidden the pulse is paused.
     NAMED BEFORE → AFTER (Nov 9 2026, golden note icon): BEFORE, an eighth
     note flowing into a drifting sine wave (bfm-note-head, bfm-note-stem,
     bfm-note-wave, clipPath bfmNoteWaveClip); AFTER, the golden note.
     (Nov 8 2026: before that, ICON_ART, a two-circle boombox.) */
  var MUSIC_ICON =
    '<svg class="bfm-icon-art" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<g class="bfm-gn-glow" transform="translate(3 13.3) scale(.16)" stroke-width="26"><path d="M0 55 A55 55 0 0 1 55 0 A34 34 0 0 1 89 34 A21 21 0 0 1 68 55 A13 13 0 0 1 55 42 A8 8 0 0 1 63 34"/></g>' +
      '<g class="bfm-gn-spiral" transform="translate(3 13.3) scale(.16)" stroke-width="10"><path d="M0 55 A55 55 0 0 1 55 0 A34 34 0 0 1 89 34 A21 21 0 0 1 68 55 A13 13 0 0 1 55 42 A8 8 0 0 1 63 34"/></g>' +
      '<path class="bfm-gn-stem" d="M17.24 18.74V2.6c1.6 1 3.9 1.9 3.9 4.8c0 1.3-.6 2.1-1.5 2.7" stroke-width="1.7"/>' +
    "</svg>";

  /* The finishes: one construction, two sets of tokens. */
  var CHROME = "--bbx-m1:#ffffff;--bbx-m2:#d3d8e1;--bbx-m3:#f7f9fc;--bbx-m4:#98a0b0;--bbx-m5:#e6e9ef;--bbx-m6:#767e90;" +
    "--bbx-brush:rgba(255,255,255,.22);--bbx-brush2:rgba(70,80,100,.06);--bbx-sheen:rgba(255,255,255,.7);--bbx-reflect:.6;" +
    "--bbx-h1:#ffffff;--bbx-h2:#858da0;--bbx-h3:#dfe3ea;--bbx-grille:rgba(214,219,228,.22);" +
    "--bbx-key-a:#ffffff;--bbx-key-b:#dde1e7;--bbx-key-c:#a7adb9;--bbx-key-edge:#6d7384;--bbx-key-ink:#1b2030;--bbx-ink:#1b2030";
  var BLACK = "--bbx-m1:#555963;--bbx-m2:#17181d;--bbx-m3:#2c2e35;--bbx-m4:#060709;--bbx-m5:#1e1f25;--bbx-m6:#000000;" +
    "--bbx-brush:rgba(255,255,255,.035);--bbx-brush2:rgba(0,0,0,.18);--bbx-sheen:rgba(255,255,255,.3);--bbx-reflect:.38;" +
    "--bbx-h1:#ffffff;--bbx-h2:#7d8598;--bbx-h3:#d6dbe3;--bbx-grille:rgba(120,126,138,.2);" +
    "--bbx-key-a:#4a4d56;--bbx-key-b:#1b1c21;--bbx-key-c:#060607;--bbx-key-edge:#000000;--bbx-key-ink:#eef1f7;--bbx-ink:#eef1f7";
  var KEY_FACE = "background:linear-gradient(180deg,var(--bbx-key-a),var(--bbx-key-b) 68%,var(--bbx-key-c));color:var(--bbx-key-ink);border:1px solid rgba(0,0,0,.5);" +
    "box-shadow:0 3px 0 var(--bbx-key-edge),0 4px 4px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.65)";
  var METAL = "linear-gradient(180deg,var(--bbx-m1) 0%,var(--bbx-m2) 18%,var(--bbx-m3) 42%,var(--bbx-m4) 60%,var(--bbx-m5) 82%,var(--bbx-m6) 100%)";
  var BRUSH = "repeating-linear-gradient(90deg,var(--bbx-brush) 0 1px,var(--bbx-brush2) 1px 2px,transparent 2px 4px)";

  var CSS = [
    ".bfm{" + CHROME + "}",
    ".bfm[data-finish=black]{" + BLACK + "}",
    ".bfm-float{position:fixed;z-index:" + Z + ";left:" + EDGE + "px;top:" + EDGE + "px;display:flex;flex-direction:column;align-items:flex-start;max-width:calc(100vw - 16px)}",
    /* away: a page other than the dashboard while no music is on */
    ".bfm-float[data-away=true]{display:none}",
    /* PINNED (and the icon, always in place): in its home spot, scrolling with the page */
    ".bfm-float[data-pinned=true]:not([data-dock=phone]){position:absolute}",
    /* IN THE TOP BAR (Nov 9 2026): a child of the bar itself, placed in the bar's own coordinates */
    ".bfm-float[data-inbar=true]{position:absolute!important;right:auto!important;bottom:auto!important;max-width:none}",
    "[data-bfm-bar=relative]{position:relative}",
    ".bfm-float[data-icon-size=small] .bfm-icon{width:" + ICON_SMALL + "px;height:" + ICON_SMALL + "px}",
    ".bfm-float[data-pinned=true] .bfm-tag,.bfm-float[data-pinned=true] .bbx-body-grip{cursor:default}",
    ".bfm-pop{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px}",
    /* the icon: the first stage, on the dashboard only */
    /* the music button: the header's round control (css/bizforce-ui.css .topbar-icon-btn: 40 px, round, a
       one-pixel accent border on the header's dark glass), in the theme's accent, a soft glow on hover and focus */
    ".bfm-icon{display:none;position:relative;box-sizing:border-box;width:" + ICON_W + "px;height:" + ICON_H + "px;padding:0;margin:0;border:1px solid rgba(var(--bf-accent-a3-rgb, 0, 229, 255),.32);border-radius:50%;background:rgba(8,12,28,.85);color:var(--bf-accent-a3, #00e5ff);cursor:pointer;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}",
    ".bfm-float[data-state=icon] .bfm-icon{display:block}",
    ".bfm-icon-art{display:block;margin:0 auto}",
    /* NAMED BEFORE → AFTER (Nov 9 2026, golden note icon). BEFORE: hover and focus switched the border colour and
       box-shadow at once. AFTER: two rings over the border, faded by opacity only (200 ms): ::before brightens on
       hover and focus (the accent at .6 with a soft glow), ::after shows the second accent at .55 while music
       plays.
       NAMED BEFORE → AFTER (Nov 9 2026, violet spiral per the approved design). BEFORE: the second accent was
       currentColor. AFTER: the theme violet, written as BizForce writes it everywhere, var(--bf-accent-b, #a855f7),
       for the spiral, its glow and the playing ring; the stem and the button stay the primary accent. */
    ".bfm-icon::before,.bfm-icon::after{content:\"\";position:absolute;inset:-1px;border-radius:50%;pointer-events:none;opacity:0;transition:opacity 200ms}",
    ".bfm-icon::before{border:1px solid rgba(var(--bf-accent-a3-rgb, 0, 229, 255),.6);box-shadow:0 0 16px rgba(var(--bf-accent-a3-rgb, 0, 229, 255),.25)}",
    ".bfm-icon:hover::before,.bfm-icon:focus-visible::before{opacity:1}",
    ".bfm-icon::after{border:1px solid var(--bf-accent-b, #a855f7)}",
    ".bfm-float[data-playing=true] .bfm-icon::after{opacity:.55}",
    ".bfm-icon:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}",
    /* the golden note: the stem currentColor (the primary accent), the spiral and its glow the theme violet; the glow
       off at rest, faded in on hover and focus, pulsing while music plays (the spiral lighter then), steady under
       reduced motion, paused while the tab is hidden */
    ".bfm-gn-stem{stroke:currentColor}",
    ".bfm-gn-spiral,.bfm-gn-glow{stroke:var(--bf-accent-b, #a855f7)}",
    ".bfm-gn-glow{opacity:0;transition:opacity 200ms}",
    ".bfm-icon:hover .bfm-gn-glow,.bfm-icon:focus-visible .bfm-gn-glow{opacity:.2}",
    ".bfm-float[data-playing=true] .bfm-gn-spiral{stroke:var(--bf-accent-b, #a855f7);stroke:color-mix(in srgb,var(--bf-accent-b, #a855f7) 70%,white)}",
    ".bfm-float[data-playing=true] .bfm-gn-glow{animation:bfm-gn-pulse 2.4s ease-in-out infinite}",
    "@keyframes bfm-gn-pulse{0%,100%{opacity:.22}50%{opacity:.45}}",
    ".bfm[data-hidden=true] .bfm-gn-glow{animation-play-state:paused}",
    "@media (prefers-reduced-motion: reduce){.bfm-gn-glow{animation:none!important}.bfm-float[data-playing=true] .bfm-gn-glow{opacity:.3}}",
    /* the bar: a bevelled pill in the finish, its own sheen crossing it */
    ".bfm-tag{display:none;position:relative;overflow:hidden;align-items:center;gap:6px;height:" + BAR_H + "px;width:min(" + BAR_W + "px,calc(100vw - 32px));padding:4px 6px 4px 12px;border-radius:999px;color:var(--bbx-ink);background:" + BRUSH + "," + METAL + ";border:1px solid rgba(0,0,0,.5);box-shadow:inset 0 1px 0 rgba(255,255,255,.85),inset 0 -2px 3px rgba(0,0,0,.35),0 6px 18px rgba(0,0,0,.45);cursor:grab;touch-action:none}",
    ".bfm-float[data-state=tag] .bfm-tag{display:flex}",
    ".bfm-tag > *{position:relative}",
    ".bfm-tag .bfm-tag-sheen{position:absolute;top:-8px;bottom:-8px;left:0;width:64px;pointer-events:none;background:linear-gradient(100deg,transparent,var(--bbx-sheen),transparent);transform:translateX(-90px) skewX(-14deg);animation:bbx-bar-sheen 6s ease-in-out infinite}",
    ".bfm-tag-wave{display:flex;align-items:flex-end;gap:2px;height:16px;width:18px;flex:none}",
    ".bfm-tag-wave span{display:block;width:2px;height:16px;border-radius:1px;background:var(--bf-accent-a, #22d3ee);transform-origin:bottom;transform:scaleY(.2)}",
    ".bfm-tag-clip{flex:1;min-width:0;font-size:.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 1px 0 rgba(255,255,255,.35)}",
    ".bfm[data-finish=black] .bfm-tag-clip{text-shadow:0 1px 0 rgba(0,0,0,.6)}",
    ".bfm-tag-scroll{display:inline}",
    ".bfm-tag-clip[data-overflow=true]{text-overflow:clip}",
    ".bfm-tag-clip[data-overflow=true] .bfm-tag-scroll{display:inline-block;animation:bbx-loop var(--bbx-scroll-s, 10s) linear infinite}",
    ".bfm-tag-clip[data-overflow=true] .bfm-tag-title,.bfm-tag-ghost{padding-right:" + TAG_GAP + "px}",
    ".bfm-tag button{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:999px;padding:0;cursor:pointer;flex:none;" + KEY_FACE + "}",
    ".bfm-tag[data-resume=true] .bfm-tag-title{color:var(--bf-accent-b, #a855f7)}",
    ".bfm-tag button:focus-visible,.bbx button:focus-visible,.bbx-knob:focus-visible,.bbx-xf:focus-visible,.bbx-fader:focus-visible,.bbx-display:focus-visible,.bbx-body-grip:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}",
    /* the boombox */
    ".bbx{position:relative;width:" + BOX_W + "px;height:" + BOX_H + "px;flex:none;display:none;color:var(--bbx-ink);filter:drop-shadow(0 14px 24px rgba(0,0,0,.55));touch-action:none}",
    ".bfm-float[data-state=box] .bbx,.bfm-pop .bbx{display:block}",
    ".bbx-face{position:absolute;left:4px;top:26px;width:432px;height:210px;border-radius:26px;overflow:hidden;background:" + BRUSH + "," + METAL + ";box-shadow:inset 0 2px 1px rgba(255,255,255,.85),inset 0 -4px 6px rgba(0,0,0,.42),inset 3px 0 4px rgba(255,255,255,.35),inset -3px 0 4px rgba(0,0,0,.28),inset 0 0 22px rgba(0,0,0,.22),0 2px 0 rgba(0,0,0,.4)}",
    /* the ambient reflection across the top of the body */
    ".bbx-face::before{content:\"\";position:absolute;left:7%;right:7%;top:3px;height:44%;border-radius:0 0 50% 50%;background:radial-gradient(120% 100% at 50% 0%,rgba(255,255,255,.6),rgba(255,255,255,0) 72%);opacity:var(--bbx-reflect);pointer-events:none}",
    /* the light sweep: a band of light crossing the face now and then */
    ".bbx-sheen{position:absolute;top:-40px;bottom:-40px;left:0;width:110px;pointer-events:none;background:linear-gradient(105deg,transparent 0%,var(--bbx-sheen) 50%,transparent 100%);transform:translateX(-170px) skewX(-14deg);animation:bbx-sheen 7s ease-in-out infinite}",
    /* the silver rim: the chat box's masked ring, its shine wandering (moved, never repainted) */
    ".bbx-rim{position:absolute;left:4px;top:26px;width:432px;height:210px;box-sizing:border-box;border-radius:26px;padding:3px;overflow:hidden;pointer-events:none;-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude}",
    ".bbx-rim-shine{position:absolute;left:-100%;top:-100%;width:300%;height:300%;background:linear-gradient(135deg,#5d6372 0%,#c9ced8 12%,#ffffff 22%,#a7aebb 32%,#eef1f6 44%,#6f7688 56%,#ffffff 68%,#b9bfca 80%,#5d6372 100%);animation:bbx-rim 9s ease-in-out infinite}",
    ".bbx-art{position:absolute;inset:0;width:100%;height:100%}",
    ".bbx-cone,.bbx-cap,.bbx-tweeter-dome,.bbx-reel{transform-box:fill-box;transform-origin:center;will-change:transform}",
    ".bbx-tweeter-dome{opacity:.55}",
    ".bbx-body-grip{position:absolute;left:128px;top:0;width:184px;height:28px;cursor:grab;border-radius:12px}",
    ".bbx-display{position:absolute;left:148px;top:46px;width:144px;height:52px;box-sizing:border-box;padding:4px 6px;border-radius:7px;background:radial-gradient(120% 140% at 50% 0%,rgba(var(--bf-accent-a-rgb, 34, 211, 238),.30),rgba(4,14,18,.96) 70%);border:1px solid rgba(0,0,0,.7);box-shadow:inset 0 0 10px rgba(var(--bf-accent-a-rgb, 34, 211, 238),.35),0 1px 0 rgba(255,255,255,.5);overflow:hidden;color:var(--bf-accent-a, #22d3ee);font-family:\"Courier New\",ui-monospace,monospace}",
    /* the VFD: phosphor glow in the accent, fine scan lines over it */
    ".bbx-marquee{position:relative;height:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:10px;line-height:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--bf-accent-a, #22d3ee);text-shadow:0 0 2px currentColor,0 0 6px rgba(var(--bf-accent-a-rgb, 34, 211, 238),.85)}",
    ".bbx-marquee::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(4,14,18,.38) 1px,transparent 1px);background-size:100% 2px}",
    ".bbx-scroll{display:inline}",
    ".bbx-marquee[data-scroll=true]{text-overflow:clip}",
    ".bbx-marquee[data-scroll=true] .bbx-scroll{display:inline-block;animation:bbx-loop var(--bbx-scroll-s, 10s) linear infinite}",
    ".bbx-marquee[data-scroll=true] .bbx-vfd-copy{padding-right:24px}",
    ".bbx-vfd-artist{opacity:.82}",
    /* the LED ticker: a dot-matrix strip under the handle */
    ".bbx-ticker{position:absolute;left:146px;top:32px;width:148px;height:10px;box-sizing:border-box;padding:0 3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-radius:2px;background:#04070b;border:1px solid rgba(0,0,0,.7);box-shadow:inset 0 0 4px rgba(var(--bf-accent-a-rgb, 34, 211, 238),.35);color:var(--bf-accent-a, #22d3ee);font:700 7px/9px \"Courier New\",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 0 3px currentColor}",
    ".bbx-ticker::after{content:\"\";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(90deg,rgba(4,7,11,.62) 1px,transparent 1px),linear-gradient(rgba(4,7,11,.62) 1px,transparent 1px);background-size:2px 2px}",
    ".bbx-ticker-track{display:inline}",
    ".bbx-ticker[data-scroll=true]{text-overflow:clip}",
    ".bbx-ticker[data-scroll=true] .bbx-ticker-track{display:inline-block;animation:bbx-loop var(--bbx-scroll-s, 14s) linear infinite}",
    ".bbx-ticker[data-scroll=true] .bbx-ticker-text{padding-right:40px}",
    /* the "Now playing" sweep, once per new track */
    ".bbx-sweep{position:absolute;left:100px;top:72px;width:240px;height:26px;display:grid;place-items:center;border-radius:13px;font:800 12px/1 system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#fff;background:rgba(6,10,24,.74);border:1px solid var(--bf-accent-b, #a855f7);box-shadow:0 0 12px var(--bf-accent-b, #a855f7),inset 0 0 10px rgba(var(--bf-accent-a-rgb, 34, 211, 238),.45);text-shadow:0 0 6px var(--bf-accent-a, #22d3ee),0 0 14px var(--bf-accent-b, #a855f7);opacity:0;pointer-events:none;transform:translateX(-150%)}",
    ".bbx[data-sweep=on] .bbx-sweep{animation:bbx-sweep " + (SWEEP_MS / 1000) + "s cubic-bezier(.3,.6,.4,1) 1 both}",
    ".bbx[data-sweep=on] .bbx-ticker{opacity:0}",
    ".bbx[data-sweep=done] .bbx-ticker{animation:bbx-settle .45s ease-out 1 both}",
    ".bfm[data-hidden=true] .bbx-scroll,.bfm[data-hidden=true] .bbx-ticker-track,.bfm[data-hidden=true] .bfm-tag-scroll,.bfm[data-hidden=true] .bbx-sweep,.bfm[data-hidden=true] .bbx-sheen,.bfm[data-hidden=true] .bbx-rim-shine,.bfm[data-hidden=true] .bfm-tag-sheen{animation-play-state:paused}",
    "@keyframes bbx-loop{0%," + (SCROLL_HOLD * 100) + "%{transform:translateX(0)}100%{transform:translateX(-50%)}}",
    "@keyframes bbx-sweep{0%{transform:translateX(-150%);opacity:0}18%{opacity:1}82%{opacity:1}100%{transform:translateX(150%);opacity:0}}",
    "@keyframes bbx-settle{from{opacity:0}to{opacity:1}}",
    "@keyframes bbx-sheen{0%,58%{transform:translateX(-170px) skewX(-14deg)}100%{transform:translateX(620px) skewX(-14deg)}}",
    "@keyframes bbx-rim{0%,100%{transform:translate(-8%,-6%)}25%{transform:translate(14%,4%)}50%{transform:translate(20%,18%)}75%{transform:translate(2%,12%)}}",
    "@keyframes bbx-bar-sheen{0%,62%{transform:translateX(-90px) skewX(-14deg)}100%{transform:translateX(360px) skewX(-14deg)}}",
    ".bbx-row{display:flex;justify-content:space-between;align-items:center;font-size:9px;line-height:11px;font-variant-numeric:tabular-nums}",
    ".bbx-display .bfm-viz{display:block;width:132px;height:11px;margin:1px 0}",
    ".bbx-display .bfm-seek{display:block;width:132px;height:6px;margin:0;accent-color:var(--bf-accent-a, #22d3ee)}",
    /* the piano keys */
    ".bbx-keys{position:absolute;left:150px;top:138px;width:140px;display:flex;gap:2px}",
    ".bbx-keys button,.bbx-fkeys button{flex:1;height:24px;padding:0;display:grid;place-items:center;border-radius:2px 2px 5px 5px;cursor:pointer;transition:transform .06s;" + KEY_FACE + "}",
    ".bbx-keys button[data-down=true],.bbx-keys button:active,.bbx-fkeys button[data-down=true],.bbx-fkeys button:active{transform:translateY(3px);box-shadow:0 0 0 var(--bbx-key-edge),0 1px 2px rgba(0,0,0,.3)}",
    ".bbx-keys button[aria-pressed=true],.bbx-fkeys button[aria-pressed=true]{color:var(--bf-accent-b, #a855f7)}",
    /* the mixer deck: recessed, dark in both finishes */
    ".bbx-deck{position:absolute;left:30px;top:184px;width:380px;height:46px;box-sizing:border-box;border-radius:10px;background:linear-gradient(180deg,#0b0d13,#1c2029);border:1px solid rgba(0,0,0,.75);box-shadow:inset 0 3px 8px rgba(0,0,0,.75),inset 0 -1px 0 rgba(255,255,255,.08),0 1px 0 rgba(255,255,255,.55);color:#cfd5e2;font:700 7px/1 system-ui,-apple-system,\"Segoe UI\",sans-serif;letter-spacing:.12em;text-transform:uppercase}",
    ".bbx-deck > *{position:absolute;top:4px}",
    ".bbx-lbl{display:block;margin-top:3px;text-align:center;color:#aeb6c6}",
    /* the lanes, left to right: EQ 6-112, Mix 118-210, meters 216-260, volume 268-298, keys 304-374 */
    ".bbx-eq{left:6px;display:flex;gap:8px}",
    ".bbx-eq-band{width:30px;display:flex;flex-direction:column;align-items:center}",
    ".bbx-knob{position:relative;width:26px;height:26px;border-radius:50%;cursor:ns-resize;touch-action:none;background:radial-gradient(circle at 35% 30%,#ffffff,#c6cbd5 42%,#666d7f 100%);border:1px solid rgba(0,0,0,.7);box-shadow:0 2px 3px rgba(0,0,0,.6),inset 0 -2px 3px rgba(0,0,0,.35)}",
    ".bbx-knob::before{content:\"\";position:absolute;left:50%;top:-4px;width:2px;height:3px;margin-left:-1px;border-radius:1px;background:#8e97a8}",
    ".bbx-knob-mark{position:absolute;left:50%;top:2px;width:2px;height:9px;margin-left:-1px;border-radius:1px;background:var(--bf-accent-a, #22d3ee);box-shadow:0 0 3px var(--bf-accent-a, #22d3ee);transform-origin:1px 11px}",
    ".bbx-xfade{left:118px;width:92px}",
    ".bbx-xf-head{display:flex;justify-content:space-between;color:#aeb6c6;margin-bottom:5px}",
    ".bbx-xf-out{color:var(--bf-accent-a, #22d3ee);font-variant-numeric:tabular-nums}",
    ".bbx-xf{position:relative;width:" + XF_W + "px;height:16px;cursor:ew-resize;touch-action:none}",
    ".bbx-xf::before{content:\"\";position:absolute;left:4px;right:4px;top:7px;height:3px;border-radius:2px;background:#000;box-shadow:inset 0 1px 1px rgba(255,255,255,.12),0 1px 0 rgba(255,255,255,.1)}",
    ".bbx-xf-cap{position:absolute;left:0;top:0;width:" + XF_CAP + "px;height:16px;border-radius:3px;background:linear-gradient(90deg,#8d95a6,#ffffff 45%,#c6cbd5 55%,#737a8c);border:1px solid rgba(0,0,0,.65);box-shadow:0 2px 3px rgba(0,0,0,.55)}",
    /* the meters: their own slot, the two columns centred in it */
    ".bbx-meters{left:216px;top:2px;width:44px;height:40px;display:flex;justify-content:center;gap:4px;align-items:flex-start}",
    ".bbx-meters > div{width:18px;display:flex;flex-direction:column;align-items:center}",
    ".bbx-leds{display:flex;flex-direction:column-reverse;gap:1px}",
    ".bbx-leds span{display:block;width:9px;height:3px;border-radius:1px;background:#3dff9a;opacity:.18}",
    ".bbx-leds span:nth-child(n+6){background:#ffcc33}.bbx-leds span:nth-child(8){background:#ff4d4d}",
    ".bbx-meter-lbl{display:block;margin-top:2px;width:18px;text-align:center;color:#aeb6c6}",
    /* the volume: its own lane, the fader in it and its VOL label beneath, clear of the meters */
    ".bbx-vol{left:268px;top:2px;width:30px;height:40px}",
    ".bbx-fader{position:absolute;left:7px;top:0;width:16px;height:" + FADER_H + "px;cursor:ns-resize;touch-action:none}",
    ".bbx-vol .bbx-lbl{position:absolute;left:0;top:" + (FADER_H + 3) + "px;width:30px;margin:0}",
    ".bbx-fader::before{content:\"\";position:absolute;left:6.5px;top:2px;bottom:2px;width:3px;border-radius:2px;background:#000;box-shadow:inset 0 1px 1px rgba(255,255,255,.12),1px 0 0 rgba(255,255,255,.1)}",
    ".bbx-fader-cap{position:absolute;left:-2px;top:0;width:20px;height:" + FADER_CAP + "px;border-radius:2px;background:linear-gradient(180deg,#ffffff,#c6cbd5 50%,#737a8c);border:1px solid rgba(0,0,0,.65);box-shadow:0 2px 3px rgba(0,0,0,.55)}",
    ".bbx-fader-cap::after{content:\"\";position:absolute;left:3px;right:3px;top:3.5px;height:1px;background:rgba(0,0,0,.55)}",
    ".bbx-vol-out{position:absolute;left:20px;top:2px;color:var(--bf-accent-a, #22d3ee);font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:0}",
    /* the body keys: two rows of three in their own slot */
    ".bbx-fkeys{left:304px;top:3px;width:70px;height:38px;display:grid;grid-template-columns:repeat(3,22px);grid-auto-rows:17px;gap:2px}",
    ".bbx-fkeys button{height:17px}",
    ".bbx-fkeys button[hidden]{display:none}",
    /* the slide-out library: from behind the boombox, below or beside it */
    ".bfm-drawer{position:absolute;left:0;top:100%;margin-top:8px;width:" + DRAWER_W + "px;max-width:calc(100vw - 16px);overflow:hidden;pointer-events:none}",
    ".bfm-drawer[data-side=right]{left:100%;top:0;margin:0 0 0 10px}",
    ".bfm-drawer[data-side=left]{left:auto;right:100%;top:0;margin:0 10px 0 0}",
    ".bfm-float[data-state=box][data-library=true] .bfm-drawer{pointer-events:auto}",
    ".bfm-float[data-state=tag] .bfm-drawer,.bfm-float[data-state=icon] .bfm-drawer{display:none}",
    ".bfm-panel{display:block;box-sizing:border-box;width:100%;max-height:var(--bfm-drawer-h, " + DRAWER_MAX_H + "px);overflow:auto;padding:12px 14px;border-radius:14px;color:#e8e8ff;background:linear-gradient(160deg,rgba(14,18,40,.97),rgba(8,10,24,.98));border:1px solid rgba(var(--bf-accent-a-rgb, 34, 211, 238),.25);box-shadow:0 12px 34px rgba(0,0,0,.5);transform:translateY(-104%);transition:transform .26s ease-out}",
    ".bfm-drawer[data-side=right] .bfm-panel{transform:translateX(-104%)}",
    ".bfm-drawer[data-side=left] .bfm-panel{transform:translateX(104%)}",
    ".bfm-float[data-state=box][data-library=true] .bfm-panel{transform:none}",
    ".bfm-pop .bfm-drawer{position:static;width:min(560px,100%);margin:0;pointer-events:auto;overflow:visible}",
    ".bfm-pop .bfm-panel{transform:none;max-height:none}",
    ".bfm-float[data-dock=phone]{left:0!important;right:0;top:auto!important;bottom:0!important;max-width:100vw;align-items:stretch;gap:0}",
    ".bfm-float[data-dock=phone] .bfm-tag{width:100%;border-radius:14px 14px 0 0;cursor:default}",
    ".bfm-float[data-dock=phone][data-state=box]{max-height:88vh;overflow:auto;padding:12px 8px 8px;border-radius:16px 16px 0 0;background:rgba(8,10,24,.97);box-shadow:0 -10px 30px rgba(0,0,0,.55);align-items:center}",
    ".bfm-float[data-dock=phone] .bbx{transform:scale(var(--bbx-fit, 1));transform-origin:top center;margin-bottom:calc((var(--bbx-fit, 1) - 1) * " + BOX_H + "px)}",
    ".bfm-float[data-dock=phone] .bfm-drawer{position:static;width:100%;margin-top:8px;display:none}",
    ".bfm-float[data-dock=phone][data-library=true] .bfm-drawer{display:block}",
    ".bfm-float[data-dock=phone] .bfm-panel{transform:none;max-height:none}",
    ".bfm-float[data-dock=phone] .bbx-body-grip{cursor:default}",
    "@media (prefers-reduced-motion: reduce){.bbx-scroll,.bbx-ticker-track,.bfm-tag-scroll,.bbx-sweep,.bbx-ticker,.bbx-sheen,.bbx-rim-shine,.bfm-tag-sheen{animation:none!important}.bbx-sweep,.bbx-sheen,.bfm-tag .bfm-tag-sheen{display:none}.bbx-keys button,.bbx-fkeys button,.bfm-panel{transition:none}.bbx-marquee,.bbx-ticker,.bfm-tag-clip{text-overflow:ellipsis}}"
  ].join("\n");
  function injectStyle() {
    if (doc.getElementById("bf-boombox-style")) return;
    var st = doc.createElement("style");
    st.id = "bf-boombox-style";
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  function boxHtml(opts) {
    var popout = opts.mode === "popout";
    var leds = "";
    for (var i = 0; i < LEDS; i++) leds += "<span></span>";
    var knobs = EQ_BANDS.map(function (b) {
      return '<div class="bbx-eq-band"><div class="bbx-knob" data-band="' + b[0] + '" tabindex="0" role="slider" aria-label="' + b[1] + '" aria-valuemin="-' + EQ_MAX + '" aria-valuemax="' + EQ_MAX +
        '" aria-valuenow="0" aria-valuetext="0 dB" title="' + b[1] + ': drag, scroll or use the arrow keys; double-click resets"><span class="bbx-knob-mark"></span></div><span class="bbx-lbl" aria-hidden="true">' + b[2] + "</span></div>";
    }).join("");
    var fkeys = '<button type="button" class="bfm-btn" data-act="mute" aria-pressed="false" aria-label="Mute" title="Mute">' + svg("volume", 12) + "</button>" +
      (popout ? "" :
        '<button type="button" data-act="bbx-library" aria-pressed="false" aria-expanded="false" aria-label="Library" title="Library">' + svg("library", 12) + "</button>" +
        '<button type="button" data-act="bbx-reset" aria-label="Reset position" title="Reset position">' + svg("reset", 12) + "</button>" +
        '<button type="button" data-act="bbx-minimise" aria-label="Minimise" title="Minimise">' + svg("minimise", 12) + "</button>" +
        '<button type="button" data-act="bbx-close" aria-label="Close to icon" title="Close to icon">' + svg("shrink", 12) + "</button>");
    return '<div class="bbx" role="group" aria-label="BizForce boombox" aria-roledescription="music player" data-sweep="off">' +
      '<div class="bbx-face" aria-hidden="true"><span class="bbx-sheen"></span></div>' + DRAWING +
      '<div class="bbx-rim" aria-hidden="true"><span class="bbx-rim-shine"></span></div>' +
      (popout ? "" : '<div class="bbx-body-grip" tabindex="0" role="button" aria-label="Move the boombox. Drag, or use the arrow keys; Home resets it."></div>') +
      '<div class="bbx-ticker" aria-hidden="true" data-scroll="false" title="' + NO_TRACK + '"><span class="bbx-ticker-track"><span class="bbx-ticker-text">' + NO_TRACK + "</span></span></div>" +
      '<div class="bbx-display" tabindex="0" role="group" aria-label="Display. Space plays or pauses; the left and right arrows seek.">' +
        '<div class="bbx-marquee" data-scroll="false" title="' + NO_TRACK + '"><span class="bbx-scroll"><span class="bbx-vfd-copy"><span class="bfm-np-title">' + NO_TRACK + '</span><span class="bbx-vfd-artist"></span></span></span></div>' +
        '<div class="bbx-row"><span class="bfm-np-artist"></span><span><span class="bfm-cur">0:00</span>/<span class="bfm-dur">0:00</span></span></div>' +
        '<canvas class="bfm-viz" width="264" height="32" role="img" aria-label="Live sound visualiser"></canvas>' +
        '<input class="bfm-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Seek" />' +
      "</div>" +
      '<div class="bbx-keys" role="group" aria-label="Playback">' +
        '<button type="button" data-act="prev" aria-label="Previous">' + svg("prev", 12) + "</button>" +
        '<button type="button" class="bfm-main" data-act="toggle" aria-label="Play">' + svg("play", 12) + "</button>" +
        '<button type="button" data-act="stop" aria-label="Stop music" title="Stop music">' + svg("stop", 12) + "</button>" +
        '<button type="button" data-act="next" aria-label="Next">' + svg("next", 12) + "</button>" +
        '<button type="button" data-act="shuffle" aria-pressed="false" aria-label="Shuffle">' + svg("shuffle", 12) + "</button>" +
        '<button type="button" data-act="repeat" aria-pressed="false" aria-label="Repeat: off">' + svg("repeat", 12) + "</button>" +
      "</div>" +
      '<div class="bbx-deck" role="group" aria-label="Mixer">' +
        '<div class="bbx-eq" role="group" aria-label="EQ">' + knobs + "</div>" +
        '<div class="bbx-xfade"><div class="bbx-xf-head" aria-hidden="true"><span>Mix</span><span class="bbx-xf-out">Off</span></div>' +
          '<div class="bbx-xf" tabindex="0" role="slider" aria-label="Mix (crossfade)" aria-valuemin="0" aria-valuemax="' + MIX_MAX + '" aria-valuenow="0" aria-valuetext="Off"><span class="bbx-xf-cap"></span></div></div>' +
        '<div class="bbx-meters" aria-hidden="true"><div><div class="bbx-leds" data-side="left">' + leds + '</div><span class="bbx-meter-lbl" data-side="left">L</span></div>' +
          '<div><div class="bbx-leds" data-side="right">' + leds + '</div><span class="bbx-meter-lbl" data-side="right">R</span></div></div>' +
        '<div class="bbx-vol"><div class="bbx-fader" tabindex="0" role="slider" aria-label="Volume" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80" aria-valuetext="80%"><span class="bbx-fader-cap"></span></div>' +
          '<span class="bbx-lbl" aria-hidden="true">Vol</span></div>' +
        '<div class="bbx-fkeys" role="group" aria-label="Boombox">' + fkeys + "</div>" +
      "</div>" +
      '<div class="bbx-sweep" aria-hidden="true"><span>Now playing</span></div>' +
    "</div>";
  }
  function tagHtml() {
    var bars = "";
    for (var i = 0; i < WAVE_BARS; i++) bars += "<span></span>";
    return '<div class="bfm-tag" role="group" aria-label="Now playing. Drag, or use the arrow keys, to move it; Home resets it." tabindex="0">' +
      '<span class="bfm-tag-sheen" aria-hidden="true"></span>' +
      '<span class="bfm-tag-wave" aria-hidden="true">' + bars + "</span>" +
      '<span class="bfm-tag-clip" title="' + NO_TRACK + '"><span class="bfm-tag-scroll"><span class="bfm-tag-title">' + NO_TRACK + "</span></span></span>" +
      '<button type="button" class="bfm-main" data-act="toggle" aria-label="Play">' + svg("play", 12) + "</button>" +
      '<button type="button" data-act="next" aria-label="Next">' + svg("next", 12) + "</button>" +
      '<button type="button" data-act="stop" aria-label="Stop music" title="Stop music">' + svg("stop", 12) + "</button>" +
      '<button type="button" data-act="bbx-expand" aria-label="Open the boombox" aria-expanded="false">' + svg("expand", 12) + "</button>" +
      '<button type="button" data-act="bbx-close" aria-label="Close to icon" title="Close to icon">' + svg("shrink", 12) + "</button>" +
    "</div>";
  }
  function iconHtml() {
    return '<button type="button" class="bfm-icon" data-act="bbx-open" aria-label="Music player" title="Music player">' + MUSIC_ICON +
    "</button>";
  }

  /* The stage a page opens in: what the member left it as, else the icon on
     the dashboard (home) and the bar elsewhere (shown there only while music is on). */
  function stageOf(s, home) { return STAGES.indexOf(s) !== -1 ? s : (home ? "icon" : "tag"); }

  /* THE MUSIC BUTTON'S PLAN (Nov 9 2026, button kept in the top bar). A pure function of boxes, in
     window coordinates: bar (the top bar's own box), logo (the logo block), items (the bar's other
     items), winW (the window's width, used only when the bar has no width).
       Vertically: its centre is the logo's centre.
       Horizontally: on the side of the logo that faces the bar's centre, its centre halfway between
       that edge of the logo and the bar's horizontal centre.
       Never closer than ICON_MIN_GAP (24 px) to the logo, and never over another item on the logo's
       row (it stops GAP short of the next one): where that is short, the gap shrinks toward 24 px,
       and as the last resort the button is ICON_SMALL (32 px).
     There is no other outcome: no spot below the bar, none outside it.
     NAMED BEFORE → AFTER (Nov 9 2026, button kept in the top bar). BEFORE: iconSpot, which with no
     room on the row put the button just below the header, under the logo. AFTER: this plan. */
  function iconPlan(bar, logo, items, winW) {
    var wide = !!bar && bar.right > bar.left;
    var bl = wide ? bar.left : 0, br = wide ? bar.right : winW;
    var centre = (bl + br) / 2;
    var cy = (logo.top + logo.bottom) / 2;
    var side = (logo.left + logo.right) / 2 <= centre ? "right" : "left";
    var edge = side === "right" ? logo.right : logo.left;
    var limit = side === "right" ? br : bl;
    (items || []).forEach(function (b) {
      if (!(b.top < cy + ICON_H / 2 && b.bottom > cy - ICON_H / 2)) return;
      if (side === "right" && b.left >= edge && b.left < limit) limit = b.left;
      if (side === "left" && b.right <= edge && b.right > limit) limit = b.right;
    });
    var room = (side === "right" ? limit - edge : edge - limit) - GAP;
    var want = (side === "right" ? centre - edge : edge - centre) / 2;
    var size = ICON_W, gap;
    if (room - ICON_W >= ICON_MIN_GAP) gap = Math.min(Math.max(want - ICON_W / 2, ICON_MIN_GAP), room - ICON_W);
    else { size = ICON_SMALL; gap = Math.max(ICON_MIN_GAP, Math.min(want - ICON_SMALL / 2, room - ICON_SMALL)); }
    var left = side === "right" ? edge + gap : edge - gap - size;
    return { side: side, size: size, gap: Math.round(gap), left: Math.round(left), top: Math.round(cy - size / 2) };
  }

  /* mount({ mode: "float" | "popout", host, anchor, home, finish, position, onVolume(v), onMix(s), onEq(band, db),
     onSeekBy(s), onToggle(), onStage(stage) }) */
  function mount(opts) {
    injectStyle();
    opts = opts || {};
    var popout = opts.mode === "popout";
    var home = !popout && opts.home === true;
    var root = doc.createElement("div");
    root.className = "bfm " + (popout ? "bfm-pop" : "bfm-float");
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "Music");
    root.setAttribute("data-finish", FINISHES.indexOf(opts.finish) !== -1 ? opts.finish : "chrome");
    root.setAttribute("data-home", home ? "true" : "false");
    root.innerHTML = (popout ? "" : iconHtml() + tagHtml()) + boxHtml(opts) +
      '<div class="bfm-drawer" data-side="below"><div class="bfm-panel" role="region" aria-label="Music library"></div></div>' +
      '<p class="bfm-sr bfm-live" aria-live="polite"></p>';
    (opts.host || doc.body || doc.documentElement).appendChild(root);
    var $ = function (sel) { return root.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
    var box = $(".bbx"), tag = $(".bfm-tag"), icon = $(".bfm-icon"), drawer = $(".bfm-drawer"), panel = $(".bfm-panel");
    var cones = $$(".bbx-cone"), caps = $$(".bbx-cap"), domes = $$(".bbx-tweeter-dome"), reels = $$(".bbx-reel");
    var ledsL = $$(".bbx-leds[data-side=left] span"), ledsR = $$(".bbx-leds[data-side=right] span"), wave = $$(".bfm-tag-wave span");
    var prefs = loadPrefs();
    /* THREE STAGES: the icon, the bar, the boombox. The FIRST time on the dashboard it is the
       icon; after that, what the member left it as (this device's bf_boombox, else their account's). */
    var remembered = STAGES.indexOf(prefs.state) !== -1;
    var state = popout ? "box" : stageOf(prefs.state, home);
    var library = popout ? true : prefs.library === true;
    var position = POSITIONS.indexOf(opts.position) !== -1 ? opts.position : "follow";
    var live = false;   // music playing, or paused mid-track this session (bf-music.js says)
    var M = { speed: 0, angle: 0, cone: 0, highs: 0, level: 0, left: 0, right: 0, t: 0 };

    function shutDrawer(shut) {
      if (popout) return;
      if (shut) { panel.setAttribute("inert", ""); panel.setAttribute("aria-hidden", "true"); }
      else { panel.removeAttribute("inert"); panel.removeAttribute("aria-hidden"); }
    }
    /* The dashboard's icon is always in place; elsewhere, and for the bar and the boombox, pinned when the member says so. */
    function pinned() { return !popout && ((state === "icon" && home) || position === "pinned"); }
    /* Shown on the dashboard always (its stage); elsewhere at any stage, the floating icon included, only while music is on. */
    function away() { return !popout && !home && !live; }
    function showWhere() {
      if (popout) return;
      root.setAttribute("data-away", away() ? "true" : "false");
      root.setAttribute("data-pinned", pinned() ? "true" : "false");
      root.setAttribute("data-position", position);
      var rs = $("[data-act=bbx-reset]");
      if (rs) rs.hidden = pinned();
    }
    /* s: "icon" | "tag" | "box"; focus: move the focus to the new stage's key;
       quiet: not the member's own step (nothing is told to bf-music.js). */
    function setState(s, focus, quiet) {
      if (popout) return;
      var was = state;
      state = STAGES.indexOf(s) !== -1 ? s : "tag";
      root.setAttribute("data-state", state);
      root.setAttribute("data-library", library ? "true" : "false");
      var lib = $("[data-act=bbx-library]");
      if (lib) { lib.setAttribute("aria-pressed", library ? "true" : "false"); lib.setAttribute("aria-expanded", library && state === "box" ? "true" : "false"); }
      var ex = $("[data-act=bbx-expand]"); if (ex) ex.setAttribute("aria-expanded", state === "box" ? "true" : "false");
      if (icon) icon.setAttribute("aria-expanded", state === "icon" ? "false" : "true");
      shutDrawer(!(state === "box" && library));
      if (!quiet) remembered = true;
      if (remembered) prefs.state = state;
      prefs.library = library; savePrefs(prefs);
      showWhere();
      place();
      if (state === "tag" && typeof fitTag === "function") fitTag();
      if (focus) {
        var to = state === "box" ? $(".bbx-keys .bfm-main") : state === "tag" ? $("[data-act=bbx-expand]") : icon;
        if (to && !away()) to.focus();
      }
      if (!quiet && was !== state && opts.onStage) opts.onStage(state);
    }
    /* Escape and Minimise step back one stage: the boombox to the bar, the bar to the icon. */
    function stepBack(focus) {
      if (popout) return;
      if (state === "box") setState("tag", focus);
      else if (state === "tag") setState("icon", focus);
    }
    function setLive(on) {
      if (popout || live === !!on) return;
      live = !!on;
      showWhere();
      if (!away()) place();
    }
    function setPosition(p) {
      if (popout || POSITIONS.indexOf(p) === -1) return;
      position = p;
      showWhere();
      place();
    }
    function setLibrary(on, focus) {
      if (popout) return;
      library = !!on;
      if (library) state = "box";
      setState(state);
      if (focus) { var lib = $("[data-act=bbx-library]"); if (lib) lib.focus(); }
    }

    /* ── the place on screen ─────────────────────────────────────────────── */
    function stored() { return typeof prefs.left === "number" && typeof prefs.top === "number" ? prefs : null; }
    function put(left, top) {
      var c = clampPosition(left, top, root);
      root.style.left = c.left + "px";
      root.style.top = c.top + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.setAttribute("data-placed", "true");
      return c;
    }
    /* Beside the logo, centred on the header's height: to its right, or to
       its left where the logo ends the header and the bar would not fit. With
       no logo header, the top-left corner. The boombox opens from the same
       spot, so it expands down and right from the bar. */
    function defaultSpot() {
      var a = opts.anchor;
      if (a && a.getBoundingClientRect) {
        var r = a.getBoundingClientRect();
        var head = a.closest ? a.closest(BAR_SEL) : null;
        var hr = head && head.getBoundingClientRect ? head.getBoundingClientRect() : null;
        var mid = hr && hr.height > 0 ? hr.top + hr.height / 2 : r.top + (r.height || 0) / 2;
        if (state === "icon") { var ip = iconPlan(head ? rectOf(head) : null, rectOf(a), headerItems(a, head), window.innerWidth); return { left: ip.left, top: ip.top }; }
        var right = Math.min(window.innerWidth, hr && hr.width > 0 ? hr.right : window.innerWidth) - EDGE;
        var w = BAR_W, h = BAR_H;
        var left = r.right + GAP;
        if (left + w > right && r.left - GAP - w >= EDGE) left = r.left - GAP - w;
        return { left: Math.round(left), top: Math.round(mid - h / 2) };
      }
      return { left: EDGE, top: EDGE };
    }
    /* The top bar's other items: its controls, and any plain block of its own (a badge) that holds none. */
    function headerItems(a, head) {
      if (!head || !head.querySelectorAll) return [];
      var mine = function (el) { return el === a || (a.contains && a.contains(el)) || (el.contains && el.contains(a)) || root.contains(el); };
      var els = Array.prototype.slice.call(head.querySelectorAll("a, button, label, input, select, [role=button], [tabindex], .topbar-user")).filter(function (el) { return !mine(el); });
      Array.prototype.forEach.call(head.children || [], function (el) {
        if (!mine(el) && !els.some(function (x) { return el.contains(x); })) els.push(el);
      });
      return els.map(rectOf).filter(function (b) { return b.right > b.left && b.bottom > b.top; });
    }
    /* IN THE TOP BAR (Nov 9 2026, button kept in the top bar). Wherever the music button is in place (the
       dashboard always; any other page when the member pins it) and the page has a top bar, the player's
       root is a CHILD OF THAT BAR, placed in the bar's own coordinates by iconPlan: it can never show
       outside the bar, and it moves with it. The logo block keeps room on the side facing the bar's centre
       (a margin of ICON_MIN_GAP + ICON_SMALL + GAP, less the bar's own gap), so the bar's items can never
       crowd the button past its last resort. Opened to the bar or the boombox, or unpinned, it goes back
       to the page as before. */
    function barOf() { var a = opts.anchor; return a && a.closest ? a.closest(BAR_SEL) : null; }
    var held = null;   // while in a bar: { bar, slot, prop, was, pos }
    function inBar() { return !popout && state === "icon" && pinned() && !away() && !!barOf(); }
    function leaveBar() {
      if (!held) return;
      if (held.prop) held.slot.style[held.prop] = held.was;
      if (held.pos) held.bar.removeAttribute("data-bfm-bar");
      held = null;
      root.removeAttribute("data-inbar");
      root.removeAttribute("data-icon-size");
      (opts.host || doc.body || doc.documentElement).appendChild(root);
    }
    function placeInBar() {
      var a = opts.anchor, bar = barOf(), slot = a;
      while (slot && slot.parentElement !== bar) slot = slot.parentElement;
      if (held && held.bar !== bar) leaveBar();
      if (!held) {
        held = { bar: bar, slot: slot, prop: "", was: "", pos: false };
        if (window.getComputedStyle && window.getComputedStyle(bar).position === "static") { bar.setAttribute("data-bfm-bar", "relative"); held.pos = true; }
      }
      if (root.parentNode !== bar) bar.appendChild(root);
      root.setAttribute("data-inbar", "true");
      var b0 = rectOf(bar), l0 = rectOf(a);
      var prop = iconPlan(b0, l0, [], window.innerWidth).side === "right" ? "marginRight" : "marginLeft";
      if (held.prop !== prop) { if (held.prop) slot.style[held.prop] = held.was; held.prop = prop; held.was = slot.style[prop]; }
      var cs = window.getComputedStyle ? window.getComputedStyle(bar) : null;
      var barGap = cs ? parseFloat(cs.columnGap || cs.gap) || 0 : 0;
      slot.style[prop] = Math.max(0, ICON_MIN_GAP + ICON_SMALL + GAP - barGap) + "px";
      var plan = iconPlan(rectOf(bar), rectOf(a), headerItems(a, bar), window.innerWidth);
      var br = rectOf(bar);
      root.setAttribute("data-icon-size", plan.size === ICON_SMALL ? "small" : "full");
      root.style.left = Math.round(plan.left - br.left - (bar.clientLeft || 0)) + "px";
      root.style.top = Math.round(plan.top - br.top - (bar.clientTop || 0)) + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.setAttribute("data-placed", "true");
    }
    /* Measured again whenever the bar can have changed after the first look: a resize (onResize), the
       fonts arriving, the page's load, and any change to the bar's items (a late badge, a count or a
       name filled in, a script's own addition), and the bar's own size where the browser reports it. */
    var soon = null;
    function later() { if (soon) return; soon = setTimeout(function () { soon = null; if (inBar()) place(); }, 0); }
    function watchBar() {
      var bar = barOf();
      if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === "function") doc.fonts.ready.then(later);
      window.addEventListener("load", later);
      if (!bar) return;
      if (typeof MutationObserver === "function") {
        new MutationObserver(function (list) {
          if (list.some(function (m) { return !root.contains(m.target); })) later();
        }).observe(bar, { childList: true, subtree: true, characterData: true });
      }
      if (typeof ResizeObserver === "function") new ResizeObserver(later).observe(bar);
    }
    /* PINNED: the home spot in the page's own coordinates (position: absolute), so it scrolls away with the page.
       NAMED BEFORE → AFTER (Nov 9 2026, button kept in the top bar). BEFORE: the top was clamped to the window
       before the scroll was added, so a page loaded part-way down put the home spot below the header.
       AFTER: clamped in the page's coordinates. */
    function pinTo() {
      var p = defaultSpot();
      var sx = window.scrollX || window.pageXOffset || 0, sy = window.scrollY || window.pageYOffset || 0;
      var w = root.offsetWidth || 0;
      root.style.left = Math.round(Math.min(Math.max(p.left, 0), Math.max(window.innerWidth - w, 0)) + sx) + "px";
      root.style.top = Math.round(Math.max(p.top + sy, 0)) + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";
      root.setAttribute("data-placed", "true");
    }
    function place() {
      if (popout) return;
      if (inBar()) { root.setAttribute("data-dock", "desktop"); placeInBar(); side(); return; }
      leaveBar();
      if (phone() && state !== "icon") {
        root.setAttribute("data-dock", "phone");
        root.removeAttribute("data-placed");
        root.style.left = ""; root.style.top = ""; root.style.right = ""; root.style.bottom = "";
        root.style.setProperty("--bbx-fit", String(Math.min(1, Math.round(((window.innerWidth - 16) / BOX_W) * 1000) / 1000)));
        return;
      }
      root.setAttribute("data-dock", "desktop");
      if (pinned()) { pinTo(); side(); return; }
      var p = stored() || defaultSpot();
      put(p.left, p.top);
      nudge();
      side();
    }
    /* The library slides out where it fits: below, else to the right, else to the left. */
    function side() {
      if (popout || phone() || !drawer) return;
      var r = rectOf(root);
      var below = window.innerHeight - r.bottom - 8, toRight = window.innerWidth - r.right - 10, toLeft = r.left - 10;
      var s = "below", room = below;
      if (below < DRAWER_MIN_H + 80) {
        if (toRight >= DRAWER_W) { s = "right"; room = window.innerHeight - r.top - 8; }
        else if (toLeft >= DRAWER_W) { s = "left"; room = window.innerHeight - r.top - 8; }
      }
      drawer.setAttribute("data-side", s);
      root.style.setProperty("--bfm-drawer-h", Math.max(DRAWER_MIN_H, Math.min(DRAWER_MAX_H, Math.floor(room))) + "px");
    }
    function rectOf(el) {
      var r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.left + (r.width || el.offsetWidth || 0), bottom: r.top + (r.height || el.offsetHeight || 0) };
    }
    function obstacles() {
      var out = [];
      var mist = doc.getElementById("tmx-presence-root");
      if (mist && (mist.offsetWidth || mist.getBoundingClientRect().width)) out.push(rectOf(mist));
      var chat = doc.getElementById("tmx-chat");
      if (chat && chat.style.pointerEvents === "auto") out.push(rectOf(chat));
      return out;
    }
    function hits(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }
    /* Off the mist and the open chat box by the smallest move that stays on screen. */
    function nudge() {
      if (popout || phone() || pinned()) return false;
      var moved = false;
      for (var round = 0; round < 3; round++) {
        var me = rectOf(root), w = me.right - me.left, h = me.bottom - me.top;
        var blocks = obstacles().filter(function (o) { return hits(me, o); });
        if (!blocks.length) return moved;
        var o = blocks[0];
        var tries = [
          { left: o.left - GAP - w, top: me.top }, { left: o.right + GAP, top: me.top },
          { left: me.left, top: o.top - GAP - h }, { left: me.left, top: o.bottom + GAP }
        ].map(function (p) {
          var c = clampPosition(p.left, p.top, root);
          var r = { left: c.left, top: c.top, right: c.left + w, bottom: c.top + h };
          return { c: c, d: Math.abs(c.left - me.left) + Math.abs(c.top - me.top), clear: !obstacles().some(function (x) { return hits(r, x); }) };
        }).sort(function (a, b) { return (b.clear - a.clear) || (a.d - b.d); });
        put(tries[0].c.left, tries[0].c.top);
        moved = true;
      }
      return moved;
    }
    function reset() {
      delete prefs.left; delete prefs.top;
      savePrefs(prefs);
      place();
    }
    function saveSpot() {
      var r = root.getBoundingClientRect();
      var c = clampPosition(r.left, r.top, root);
      prefs.left = c.left; prefs.top = c.top;
      savePrefs(prefs);
    }

    /* The mist's drag: press, a 6 px threshold, clamped, saved on release. */
    var drag = { on: false, moved: false, x: 0, y: 0, left: 0, top: 0 };
    function grabbable(t) {
      if (!t || !t.closest || popout || phone() || pinned()) return false;
      if (t.closest(".bbx-body-grip")) return true;
      if (t.closest("button, input, textarea, select, a, label, .bbx-knob, .bbx-xf, .bbx-fader, .bbx-display, .bfm-panel")) return false;
      return !!t.closest(".bfm-tag, .bbx");
    }
    root.addEventListener("pointerdown", function (e) {
      drag.moved = false;   // a drag that ended without a click must not eat the next one
      if (!grabbable(e.target)) return;
      drag.on = true; drag.moved = false; drag.x = e.clientX; drag.y = e.clientY;
      var r = root.getBoundingClientRect();
      drag.left = r.left; drag.top = r.top;
      if (e.target.setPointerCapture) { try { e.target.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
    });
    root.addEventListener("pointermove", function (e) {
      if (!drag.on) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      put(drag.left + dx, drag.top + dy);
    });
    function endDrag() {
      if (!drag.on) return;
      drag.on = false;
      if (drag.moved) { nudge(); saveSpot(); side(); }
    }
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    /* The bar's own body, or the grip on the handle: the arrows nudge it, Home resets it.
       Escape steps back ONE stage: it slides the library back first, then the
       boombox becomes the bar, then the bar the icon. Enter on the bar opens the boombox. */
    root.addEventListener("keydown", function (e) {
      var t = e.target;
      if (e.key === "Escape" && !popout && state !== "icon") {
        e.preventDefault();
        if (state === "box" && library) setLibrary(false, true); else stepBack(true);
        return;
      }
      if (e.key === "Enter" && t === tag && !popout) { e.preventDefault(); setState("box", true); return; }
      var movable = !popout && !phone() && !pinned() && (t === tag || (t && t.classList && t.classList.contains("bbx-body-grip")));
      if (movable) {
        if (e.key === "Home") { e.preventDefault(); reset(); return; }
        var step = e.shiftKey ? NUDGE * 4 : NUDGE;
        var dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        var dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        if (dx || dy) {
          e.preventDefault();
          var r = root.getBoundingClientRect();
          put(r.left + dx, r.top + dy);
          saveSpot();
          side();
          return;
        }
      }
      if (t && t.classList && t.classList.contains("bbx-display")) {
        if (e.key === " ") { e.preventDefault(); if (opts.onToggle) opts.onToggle(); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); if (opts.onSeekBy) opts.onSeekBy(e.key === "ArrowLeft" ? -5 : 5); }
      }
    });
    root.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest("[data-act]") : null;
      if (drag.moved) { drag.moved = false; if (!b || b.closest(".bfm-tag")) { e.stopPropagation(); return; } }
      /* a press on the bar itself (not one of its keys) opens the boombox */
      if (!b) { if (!popout && state === "tag" && e.target && e.target.closest && e.target.closest(".bfm-tag")) setState("box", true); return; }
      var act = b.getAttribute("data-act");
      if (act === "bbx-open") setState("tag", true);
      else if (act === "bbx-expand") setState("box", true);
      else if (act === "bbx-minimise") stepBack(true);
      else if (act === "bbx-close") setState("icon", true);
      else if (act === "bbx-library") setLibrary(!library);
      else if (act === "bbx-reset") { reset(); var g = $(".bbx-body-grip"); if (g) g.focus(); }
    });
    root.addEventListener("dblclick", function (e) { if (grabbable(e.target)) reset(); });
    /* the keys go down under the finger, and come back up */
    $$(".bbx-keys button, .bbx-fkeys button").forEach(function (k) {
      k.addEventListener("pointerdown", function () { k.setAttribute("data-down", "true"); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { k.addEventListener(n, function () { k.removeAttribute("data-down"); }); });
    });

    /* ── the mixer: sliders for the pointer, the wheel and the keyboard ─── */
    function sliderKey(e, cur, o) {
      var k = e.key, v = null;
      if (k === "ArrowUp" || k === "ArrowRight") v = cur + o.step;
      else if (k === "ArrowDown" || k === "ArrowLeft") v = cur - o.step;
      else if (k === "PageUp") v = cur + o.page;
      else if (k === "PageDown") v = cur - o.page;
      else if (k === "Home") v = o.min;
      else if (k === "End") v = o.max;
      if (v === null) return null;
      e.preventDefault();
      e.stopPropagation();
      return v;
    }
    /* el: the control; o: { get(), set(v, tell), step, page, min, max, axis "x"|"y", per (value per px), detent } */
    var holding = null;
    function wire(el, o) {
      el.addEventListener("keydown", function (e) { var v = sliderKey(e, o.get(), o); if (v !== null) o.set(v, true); });
      el.addEventListener("wheel", function (e) { e.preventDefault(); o.set(o.get() + (e.deltaY < 0 ? o.step : -o.step), true); }, { passive: false });
      el.addEventListener("pointerdown", function (e) {
        holding = { el: el, x: e.clientX, y: e.clientY, v: o.get() };
        if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
        e.stopPropagation();
      });
      el.addEventListener("pointermove", function (e) {
        if (!holding || holding.el !== el) return;
        var d = o.axis === "x" ? e.clientX - holding.x : holding.y - e.clientY;
        var v = holding.v + d * o.per;
        if (o.detent && Math.abs(v) < o.detent) v = 0;
        o.set(v, true);
      });
      ["pointerup", "pointercancel"].forEach(function (n) { el.addEventListener(n, function () { if (holding && holding.el === el) holding = null; }); });
    }
    function busy(el) { return doc.activeElement === el || (holding && holding.el === el); }

    var eq = { bass: 0, mid: 0, treble: 0 };
    function setEq(band, db, tell) {
      if (!(band in eq)) return;
      var v = clampDb(db);
      eq[band] = v;
      var k = $(".bbx-knob[data-band=" + band + "]");
      k.setAttribute("aria-valuenow", String(v));
      k.setAttribute("aria-valuetext", dbText(v));
      k.querySelector(".bbx-knob-mark").style.transform = "rotate(" + (-135 + 270 * (v + EQ_MAX) / (2 * EQ_MAX)).toFixed(1) + "deg)";
      if (tell && opts.onEq) opts.onEq(band, v);
    }
    EQ_BANDS.forEach(function (b) {
      var k = $(".bbx-knob[data-band=" + b[0] + "]");
      wire(k, { get: function () { return eq[b[0]]; }, set: function (v, tell) { setEq(b[0], v, tell); }, step: 1, page: 3, min: -EQ_MAX, max: EQ_MAX, axis: "y", per: 0.25, detent: EQ_DETENT });
      k.addEventListener("dblclick", function (e) { e.stopPropagation(); setEq(b[0], 0, true); });
    });

    var mix = 0, xf = $(".bbx-xf");
    function setMix(s, tell) {
      mix = clampMix(s);
      xf.setAttribute("aria-valuenow", String(mix));
      xf.setAttribute("aria-valuetext", mix ? mix + " seconds" : "Off");
      $(".bbx-xf-cap").style.transform = "translateX(" + (XF_TRAVEL * mix / MIX_MAX).toFixed(1) + "px)";
      $(".bbx-xf-out").textContent = mix ? mix + " s" : "Off";
      if (tell && opts.onMix) opts.onMix(mix);
    }
    wire(xf, { get: function () { return mix; }, set: setMix, step: 1, page: 3, min: 0, max: MIX_MAX, axis: "x", per: MIX_MAX / XF_TRAVEL });

    var volume = 0.8, fader = $(".bbx-fader");
    function setVol(v, tell) {
      volume = Math.round(clamp01(v) * 100) / 100;
      var pct = Math.round(volume * 100);
      fader.setAttribute("aria-valuenow", String(pct));
      fader.setAttribute("aria-valuetext", pct + "%");
      $(".bbx-fader-cap").style.transform = "translateY(" + (VOL_TRAVEL * (1 - volume)).toFixed(1) + "px)";
      if (tell && opts.onVolume) opts.onVolume(volume);
    }
    wire(fader, { get: function () { return volume; }, set: setVol, step: 0.05, page: 0.1, min: 0, max: 1, axis: "y", per: 1 / VOL_TRAVEL });

    function setFinish(f) { if (FINISHES.indexOf(f) !== -1) root.setAttribute("data-finish", f); }

    /* ── the motion ──────────────────────────────────────────────────────── */
    function rest() {
      M.speed = 0; M.cone = 0; M.highs = 0; M.level = 0; M.left = 0; M.right = 0;
      paint();
    }
    function lightLeds(list, v) {
      var lit = Math.round(v * LEDS);
      list.forEach(function (l, i) { l.style.opacity = i < lit ? "1" : "0.18"; });
    }
    function paint() {
      var cs = "scale(" + (1 + CONE_PULSE * M.cone).toFixed(4) + ")";
      var ks = "scale(" + (1 + CAP_PULSE * M.cone).toFixed(4) + ")";
      cones.forEach(function (c) { c.style.transform = cs; });
      caps.forEach(function (c) { c.style.transform = ks; });
      domes.forEach(function (d) { d.style.opacity = (0.55 + 0.45 * M.highs).toFixed(3); d.style.transform = "scale(" + (1 + TWEETER_PULSE * M.highs).toFixed(4) + ")"; });
      var rot = "rotate(" + (M.angle % 360).toFixed(2) + "deg)";
      reels.forEach(function (r) { r.style.transform = rot; });
      lightLeds(ledsL, M.left);
      lightLeds(ledsR, M.right);
      wave.forEach(function (b, i) {
        var s = 0.2 + 0.8 * clamp01(M.level * (0.55 + 0.45 * Math.sin(M.t * 9 + i * 1.7)));
        b.style.transform = "scaleY(" + s.toFixed(3) + ")";
      });
    }
    function ease(cur, to, up, down) { var n = cur + (to - cur) * (to > cur ? up : down); return n < 0.001 ? 0 : n; }
    /* One frame. lv: { bass, highs, level, left, right } (0 … 1); playing:
       whether it is heard; dt: seconds since the last frame. Nothing moves
       while paused: the speakers ease back to rest, the meters fall and the
       reels slow to a stop. */
    function animate(lv, playing, dt) {
      dt = Math.max(0, Math.min(0.1, Number(dt) || 0));
      M.t += dt;
      var bass = playing ? clamp01(lv && lv.bass) : 0;
      var highs = playing ? clamp01(lv && lv.highs) : 0;
      var level = playing ? clamp01(lv && lv.level) : 0;
      var left = playing ? clamp01(lv && (lv.left !== undefined ? lv.left : lv.level)) : 0;
      var right = playing ? clamp01(lv && (lv.right !== undefined ? lv.right : lv.level)) : 0;
      M.cone = ease(M.cone, bass, 0.6, 0.25);
      M.highs = ease(M.highs, highs, 0.4, 0.4);
      M.level = ease(M.level, level, 0.6, 0.2);
      M.left = ease(M.left, left, 0.6, 0.2);
      M.right = ease(M.right, right, 0.6, 0.2);
      M.speed += ((playing ? 1 : 0) - M.speed) * Math.min(1, dt * 3);
      if (!playing && M.speed < 0.01) M.speed = 0;
      M.angle += M.speed * REEL_DEG_PER_S * dt;
      paint();
      return M.speed > 0 || M.cone > 0 || M.highs > 0 || M.level > 0 || M.left > 0 || M.right > 0;
    }
    /* Under reduced motion: everything at rest; the display shows a still level. */
    function still() { rest(); root.setAttribute("data-still", "true"); }

    /* ── what it shows ───────────────────────────────────────────────────── */
    var lastKey = null, seenStarts, sweepTimer = null, sweepCount = 0;
    var vfdShown = null, tickerShown = null, tagText = NO_TRACK, tagShown = null;
    function two(n) { return (n < 10 ? "0" : "") + n; }
    /* A loop's length: the line at about five characters a second, plus the hold at its start. */
    function scrollSeconds(text) { return Math.max(6, Math.round(String(text).length * SCROLL_S_PER_CHAR / (1 - SCROLL_HOLD))); }
    function span(cls, text, ghost) {
      var s = doc.createElement("span");
      s.className = cls;
      s.textContent = text;
      if (ghost) s.setAttribute("aria-hidden", "true");
      return s;
    }
    /* One "Title — Artist" for the VFD; the second copy (the loop's seam) is hidden from screen readers. */
    function vfdCopy(title, artist, ghost) {
      var c = span("bbx-vfd-copy", "", ghost);
      c.appendChild(span(ghost ? "bbx-vfd-title" : "bfm-np-title", title, false));
      c.appendChild(span("bbx-vfd-artist", artist ? SEP + artist : "", false));
      return c;
    }
    /* Whether the bar's title is longer than the bar: measured where the bar
       is laid out, else counted in characters. */
    function tagOverflows() {
      var clip = $(".bfm-tag-clip"), tt = $(".bfm-tag-title");
      var room = clip ? clip.clientWidth : 0;
      if (room > 0) {
        var need = tt.getBoundingClientRect().width - (clip.getAttribute("data-overflow") === "true" ? TAG_GAP : 0);
        return need > room + 1;
      }
      return tagText.length > TAG_FIT_CHARS;
    }
    function fitTag() {
      var clip = $(".bfm-tag-clip"), sc = $(".bfm-tag-scroll");
      if (!clip || !sc) return;
      var over = !reducedMotion() && tagOverflows();
      var key = (over ? "1" : "0") + tagText;
      if (key === tagShown) return;
      tagShown = key;
      var ghost = $(".bfm-tag-ghost");
      if (ghost) ghost.parentNode.removeChild(ghost);
      if (over) { sc.appendChild(span("bfm-tag-ghost", tagText, true)); sc.style.setProperty("--bbx-scroll-s", scrollSeconds(tagText) + "s"); }
      clip.setAttribute("data-overflow", over ? "true" : "false");
    }
    /* The neon "Now playing" banner, once, then the ticker settles in. */
    function sweep() {
      if (reducedMotion() || !box) return;
      sweepCount++;
      if (sweepTimer) clearTimeout(sweepTimer);
      box.setAttribute("data-sweep", "off");
      void box.offsetWidth;   // so the banner starts again from the left
      box.setAttribute("data-sweep", "on");
      sweepTimer = setTimeout(function () { sweepTimer = null; box.setAttribute("data-sweep", "done"); }, SWEEP_MS);
    }
    /* v: { title, artist, track_id, playing, starts, index, total, playlist,
       tagText, resume, volume, muted, mix, eq, finish, stereo } from bf-music.js. */
    function render(v) {
      v = v || {};
      var loaded = !!v.title, still = reducedMotion();
      var title = v.title || NO_TRACK;
      var artist = loaded && v.artist ? v.artist : "";
      /* the bar */
      tagText = v.tagText || title;
      var tt = $(".bfm-tag-title");
      if (tt && tt.textContent !== tagText) tt.textContent = tagText;
      var clip = $(".bfm-tag-clip");
      if (clip) clip.setAttribute("title", tagText);
      if (tag) tag.setAttribute("data-resume", v.resume ? "true" : "false");
      fitTag();
      /* the VFD: "Title — Artist", scrolling while a track is loaded */
      var mq = $(".bbx-marquee");
      var line = loaded ? title + (artist ? SEP + artist : "") : NO_TRACK;
      var vfdKey = (loaded && !still ? "1" : "0") + title + "\n" + artist;
      if (mq && vfdKey !== vfdShown) {
        vfdShown = vfdKey;
        var sc = $(".bbx-scroll");
        sc.innerHTML = "";
        sc.appendChild(vfdCopy(title, artist, false));
        if (loaded && !still) sc.appendChild(vfdCopy(title, artist, true));
        mq.setAttribute("data-scroll", loaded && !still ? "true" : "false");
        mq.setAttribute("title", line);
        sc.style.setProperty("--bbx-scroll-s", scrollSeconds(line) + "s");
      }
      /* the LED ticker: "NN / TT · Title · Artist · Playlist name" */
      var tk = $(".bbx-ticker");
      var parts = [];
      if (loaded) {
        if (v.index && v.total) parts.push(two(v.index) + " / " + two(v.total));
        parts.push(title);
        if (artist) parts.push(artist);
        parts.push(v.playlist || ALL_TRACKS);
      }
      var text = loaded ? parts.join(DOT) : NO_TRACK;
      var tickKey = (loaded && !still ? "1" : "0") + text;
      if (tk && tickKey !== tickerShown) {
        tickerShown = tickKey;
        var tr = $(".bbx-ticker-track");
        tr.innerHTML = "";
        tr.appendChild(span("bbx-ticker-text", text, false));
        if (loaded && !still) tr.appendChild(span("bbx-ticker-text", text, true));
        tk.setAttribute("data-scroll", loaded && !still ? "true" : "false");
        tk.setAttribute("title", text);
        tr.style.setProperty("--bbx-scroll-s", scrollSeconds(text) + "s");
      }
      /* once per track: the announcement */
      var key = loaded ? (v.track_id || title + "\n" + artist) : null;
      if (key !== lastKey) {
        lastKey = key;
        var live = $(".bfm-live");
        if (live) live.textContent = loaded ? "Now playing: " + title + (artist ? " by " + artist : "") : "";
      }
      /* once per new track: the sweep (a pause and a resume start nothing new) */
      if (typeof v.starts === "number") {
        if (seenStarts !== undefined && v.starts !== seenStarts && loaded) sweep();
        seenStarts = v.starts;
      }
      /* the mixer shows the player's own values, except on a control in the member's hand */
      if (typeof v.volume === "number" && !busy(fader)) setVol(v.muted ? 0 : v.volume, false);
      if (typeof v.mix === "number" && !busy(xf)) setMix(v.mix, false);
      if (v.eq) EQ_BANDS.forEach(function (b) { var k = $(".bbx-knob[data-band=" + b[0] + "]"); if (typeof v.eq[b[0]] === "number" && !busy(k)) setEq(b[0], v.eq[b[0]], false); });
      if (v.finish) setFinish(v.finish);
      if (typeof v.stereo === "boolean") {
        var ll = $(".bbx-meter-lbl[data-side=left]"), rl = $(".bbx-meter-lbl[data-side=right]");
        if (ll) ll.textContent = v.stereo ? "L" : "Lvl";
        if (rl) rl.textContent = v.stereo ? "R" : "Pk";
      }
    }

    function onResize() { place(); fitTag(); }
    window.addEventListener("resize", onResize);
    if (!popout) watchBar();
    doc.addEventListener("visibilitychange", function () { root.setAttribute("data-hidden", doc.hidden ? "true" : "false"); });
    var nudger = popout ? null : setInterval(function () { if (state && !drag.on && !away()) nudge(); }, 1500);

    root.setAttribute("data-state", state);
    root.setAttribute("data-library", library ? "true" : "false");
    setState(state, false, true);
    setVol(0.8, false);
    setMix(0, false);
    rest();
    return {
      root: root, panel: panel, drawer: drawer, box: box, tag: tag,
      state: function () { return state; }, library: function () { return library; },
      remembered: function () { return remembered; }, home: home,
      position: function () { return position; }, setPosition: setPosition, pinned: pinned,
      live: function () { return live; }, setLive: setLive, away: away, stepBack: stepBack,
      setState: setState, setLibrary: setLibrary, place: place, nudge: nudge, reset: reset, defaultSpot: defaultSpot, inBar: inBar, bar: barOf,
      setEq: setEq, setMix: setMix, setVolume: setVol, setFinish: setFinish,
      eq: function () { return { bass: eq.bass, mid: eq.mid, treble: eq.treble }; },
      finish: function () { return root.getAttribute("data-finish"); },
      animate: animate, still: still, rest: rest, render: render,
      motion: function () { return { speed: M.speed, angle: M.angle, cone: M.cone, highs: M.highs, level: M.level, left: M.left, right: M.right }; },
      sweeps: function () { return sweepCount; },
      destroy: function () { if (nudger) clearInterval(nudger); window.removeEventListener("resize", onResize); }
    };
  }

  window.BFBoombox = {
    mount: mount, clampPosition: clampPosition, clampDb: clampDb, clampMix: clampMix,
    STORE_KEY: STORE_KEY, DRAG_THRESHOLD: DRAG_THRESHOLD, NUDGE: NUDGE, PHONE_MAX: PHONE_MAX, Z: Z, EDGE: EDGE, GAP: GAP,
    BOX_W: BOX_W, BOX_H: BOX_H, BAR_W: BAR_W, BAR_H: BAR_H, ICON_W: ICON_W, ICON_H: ICON_H, ICON_MIN_GAP: ICON_MIN_GAP, ICON_SMALL: ICON_SMALL, BAR_SEL: BAR_SEL, iconPlan: iconPlan, MUSIC_ICON: MUSIC_ICON, STAGES: STAGES, POSITIONS: POSITIONS,
    XF_TRAVEL: XF_TRAVEL, VOL_TRAVEL: VOL_TRAVEL, LEDS: LEDS, EQ_MAX: EQ_MAX, MIX_MAX: MIX_MAX, FINISHES: FINISHES,
    CONE_PULSE: CONE_PULSE, CAP_PULSE: CAP_PULSE,
    NO_TRACK: NO_TRACK, ALL_TRACKS: ALL_TRACKS, SWEEP_MS: SWEEP_MS, TAG_FIT_CHARS: TAG_FIT_CHARS
  };
})();

/* ══════════════════════════════════════════════════════════════════════════
   BF BOOMBOX — the BizForce music player's body: a compact chrome boombox,
   drawn in SVG and CSS, themed by the tokens, with no emoji anywhere.
   scripts/bf-music.js mounts it and owns the sound; this file owns the look,
   the place on screen and the motion.

   THE PARTS.
     a polished chrome body (layered metallic gradients and highlights, tinted
       a little by the theme's accent) and a carry handle across the top;
     two main speakers, each a rubber surround, a cone and a dust cap;
     two small tweeters above them;
     a backlit dot-matrix display: the track title (scrolling when it is long),
       the time, a live spectrum or waveform strip, and the seek bar;
     a cassette window with two reels;
     five piano keys: previous, play/pause, next, shuffle, repeat, which
       depress when pressed;
     a rotary volume dial (drag it, scroll it, or use the arrow keys; it shows
       the level), with a mute key;
     two small LED level meters.

   THE MOTION, from the analyser bf-music.js reads (bass, highs, level):
     the woofer cones and dust caps pulse outward with the bass (scale);
     the tweeters shimmer with the highs (opacity and a slight scale);
     the LEDs light with the level (opacity);
     the reels turn at a steady speed while playing, and slow to a stop over
       about a second on pause (rotate).
   Only transform and opacity ever change, so it stays on the GPU. Nothing
   moves while paused. bf-music.js runs it from its one requestAnimationFrame
   loop, which stops while the page is hidden and never starts under
   prefers-reduced-motion: then the speakers and reels hold still and the
   display shows a still level.

   WHERE IT SITS ("float", every app page that loads the mist):
     fixed on screen, so it stays put while the page scrolls;
     MINIMISED it is a slim "now playing" tag (the title, a tiny live wave,
       play/pause, next, expand); EXPANDED it is the boombox, with the library
       panel (bf-music.js fills it) sliding out beneath;
     draggable by the mist's own rule (scripts/termaximus-presence.js): a 6 px
       threshold before a press becomes a drag, clamped fully on screen
       (clampPosition is the mist's _tmxClampPosition), saved on release, the
       arrow keys nudge it 10 px (40 with Shift), Home or the reset key puts it
       back, and a resize re-clamps it;
     its place and whether it is minimised are this device's (bf_boombox, a
       display choice kept at sign-out like the mist's);
     by default the tag sits at the bottom left; on the dashboard the boombox
       sits beside the BizForce AI logo in the top bar ([data-bf-boombox-anchor]);
     it never covers the mist or the open chat box: when they meet it is
       nudged aside, by the smallest move that keeps it on screen;
     at 860 px and narrower (the mist's phone width) the tag docks to the
       bottom edge, with no dragging, and expanding opens a bottom sheet.
   In the pop-out (music-popout.html, "popout") it is the whole window's
   player: expanded, in the page, with the library open, and never minimised.

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
  var Z = 2147483000;
  var LEDS = 6;
  var WAVE_BARS = 5;
  var REEL_DEG_PER_S = 200;
  var CONE_PULSE = 0.09, CAP_PULSE = 0.14, TWEETER_PULSE = 0.06;

  function clamp01(n) { return n > 0 ? (n < 1 ? n : 1) : 0; }
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
    popout: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    expand: '<path d="M4 14v6h6"/><path d="M20 10V4h-6"/><path d="M4 20l7-7"/><path d="M20 4l-7 7"/>',
    minimise: '<path d="M5 12h14"/>',
    library: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h7"/><circle cx="18" cy="17" r="2.5"/><path d="M20.5 17V10"/>',
    reset: '<path d="M4 4v6h6"/><path d="M5.5 15a7 7 0 1 0 1.6-7.4L4 10"/>'
  };
  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 14) + '" height="' + (size || 14) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON[name] + "</svg>";
  }

  /* The body, the handle, the speakers, the tweeters and the cassette: one
     drawing, 320 x 176, behind the display, the keys and the dial. */
  function speaker(cx, side) {
    return '<g class="bbx-speaker" data-side="' + side + '">' +
      '<circle cx="' + cx + '" cy="112" r="44" fill="url(#bbxGrille)" stroke="rgba(0,0,0,.45)" stroke-width="1.2"/>' +
      '<circle cx="' + cx + '" cy="112" r="38" fill="url(#bbxSurround)"/>' +
      '<g class="bbx-cone"><circle cx="' + cx + '" cy="112" r="30" fill="url(#bbxCone)"/>' +
        '<circle cx="' + cx + '" cy="112" r="22" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1"/>' +
        '<circle cx="' + cx + '" cy="112" r="14" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="1"/></g>' +
      '<g class="bbx-cap"><circle cx="' + cx + '" cy="112" r="9" fill="url(#bbxCap)"/>' +
        '<circle cx="' + (cx - 3) + '" cy="109" r="2.6" fill="rgba(255,255,255,.55)"/></g>' +
      "</g>";
  }
  function tweeter(cx) {
    return '<g class="bbx-tweeter"><circle cx="' + cx + '" cy="48" r="9" fill="url(#bbxSurround)" stroke="rgba(0,0,0,.4)" stroke-width="1"/>' +
      '<circle class="bbx-tweeter-dome" cx="' + cx + '" cy="48" r="5" fill="url(#bbxCap)"/></g>';
  }
  function reel(cx) {
    var spokes = "";
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3, x = cx + Math.cos(a) * 7.5, y = 96 + Math.sin(a) * 7.5;
      spokes += '<line x1="' + cx + '" y1="96" x2="' + x.toFixed(2) + '" y2="' + y.toFixed(2) + '"/>';
    }
    return '<g class="bbx-reel"><circle cx="' + cx + '" cy="96" r="10" fill="#ece6d8" stroke="#6b6458" stroke-width="1"/>' +
      '<g stroke="#6b6458" stroke-width="1.6" stroke-linecap="round">' + spokes + "</g>" +
      '<circle cx="' + cx + '" cy="96" r="3" fill="#2a2620"/></g>';
  }
  var DRAWING =
    '<svg class="bbx-art" viewBox="0 0 320 176" aria-hidden="true" focusable="false">' +
      "<defs>" +
        '<linearGradient id="bbxChrome" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#fbfcff"/><stop offset=".18" stop-color="#c9ced9"/><stop offset=".42" stop-color="#eef1f7"/>' +
          '<stop offset=".58" stop-color="#9aa1b1"/><stop offset=".8" stop-color="#d9dde6"/><stop offset="1" stop-color="#7d8496"/></linearGradient>' +
        '<linearGradient id="bbxSheen" x1="0" y1="0" x2="1" y2="0">' +
          '<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#fff" stop-opacity=".55"/>' +
          '<stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<linearGradient id="bbxHandle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f8fc"/><stop offset=".5" stop-color="#8e95a6"/><stop offset="1" stop-color="#d4d8e2"/></linearGradient>' +
        '<radialGradient id="bbxGrille" cx=".5" cy=".5" r=".5"><stop offset=".8" stop-color="#2b2f3a"/><stop offset=".92" stop-color="#c9ced9"/><stop offset="1" stop-color="#6d7486"/></radialGradient>' +
        '<radialGradient id="bbxSurround" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#3a3f4c"/><stop offset=".85" stop-color="#14161c"/><stop offset="1" stop-color="#05060a"/></radialGradient>' +
        '<radialGradient id="bbxCone" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#4a5062"/><stop offset=".6" stop-color="#1d2029"/><stop offset="1" stop-color="#0b0c11"/></radialGradient>' +
        '<radialGradient id="bbxCap" cx=".38" cy=".34" r=".7"><stop offset="0" stop-color="#f4f6fb"/><stop offset=".5" stop-color="#a3aaba"/><stop offset="1" stop-color="#4b5161"/></radialGradient>' +
        '<linearGradient id="bbxWindow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f2a"/><stop offset="1" stop-color="#0a0c12"/></linearGradient>' +
      "</defs>" +
      '<path class="bbx-handle" d="M86 26 V14 Q86 4 98 4 H222 Q234 4 234 14 V26 H222 V16 Q222 13 219 13 H101 Q98 13 98 16 V26 Z" fill="url(#bbxHandle)" stroke="rgba(0,0,0,.35)" stroke-width="1"/>' +
      '<rect class="bbx-body" x="3" y="24" width="314" height="149" rx="18" fill="url(#bbxChrome)" stroke="rgba(0,0,0,.4)" stroke-width="1.2"/>' +
      '<rect class="bbx-tint" x="3" y="24" width="314" height="149" rx="18"/>' +
      '<rect x="9" y="28" width="302" height="10" rx="5" fill="url(#bbxSheen)" opacity=".8"/>' +
      '<rect x="9" y="160" width="302" height="6" rx="3" fill="rgba(0,0,0,.12)"/>' +
      speaker(56, "left") + speaker(264, "right") + tweeter(22) + tweeter(298) +
      '<rect x="112" y="84" width="96" height="24" rx="5" fill="url(#bbxWindow)" stroke="rgba(255,255,255,.35)" stroke-width="1"/>' +
      '<rect x="130" y="88" width="60" height="16" rx="3" fill="rgba(236,230,216,.12)"/>' +
      reel(140) + reel(180) +
      '<rect x="114" y="85" width="92" height="5" rx="2.5" fill="rgba(255,255,255,.12)"/>' +
    "</svg>";

  var CSS = [
    ".bfm-float{position:fixed;z-index:" + Z + ";left:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-start;gap:8px;max-width:calc(100vw - 16px)}",
    ".bfm-float[data-placed=true]{bottom:auto}",
    ".bfm-pop{position:relative;display:flex;flex-direction:column;align-items:center;gap:12px}",
    ".bfm-tag{display:none;align-items:center;gap:6px;height:40px;width:min(290px,calc(100vw - 32px));padding:4px 6px 4px 10px;border-radius:12px;color:#1c2030;background:linear-gradient(180deg,#f7f9fd,#c4c9d4 55%,#e6e9f0);border:1px solid rgba(0,0,0,.25);box-shadow:0 6px 22px rgba(0,0,0,.45),inset 0 1px 0 #fff;cursor:grab;touch-action:none}",
    ".bfm-float[data-state=tag] .bfm-tag{display:flex}",
    ".bfm-tag-wave{display:flex;align-items:flex-end;gap:2px;height:16px;width:18px;flex:none}",
    ".bfm-tag-wave span{display:block;width:2px;height:16px;border-radius:1px;background:var(--bf-accent-a, #22d3ee);transform-origin:bottom;transform:scaleY(.2)}",
    ".bfm-tag-title{flex:1;min-width:0;font-size:.78rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".bfm-tag button{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:8px;border:1px solid rgba(0,0,0,.2);background:linear-gradient(180deg,#fff,#cfd3dc);color:#1c2030;cursor:pointer;flex:none}",
    ".bfm-tag button:focus-visible,.bbx button:focus-visible,.bbx-dial:focus-visible,.bbx-display:focus-visible,.bbx-body-grip:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}",
    ".bfm-tag[data-resume=true] .bfm-tag-title{color:#7a3f00}",
    ".bbx{position:relative;width:320px;height:176px;flex:none;display:none;color:#1c2030;filter:drop-shadow(0 10px 22px rgba(0,0,0,.5));touch-action:none}",
    ".bfm-float[data-state=box] .bbx,.bfm-pop .bbx{display:block}",
    ".bbx-art{position:absolute;inset:0;width:100%;height:100%}",
    ".bbx-tint{fill:rgba(var(--bf-accent-a-rgb, 34, 211, 238),.08);mix-blend-mode:overlay}",
    ".bbx-cone,.bbx-cap,.bbx-tweeter-dome,.bbx-reel{transform-box:fill-box;transform-origin:center;will-change:transform}",
    ".bbx-tweeter-dome{opacity:.55}",
    ".bbx-body-grip{position:absolute;left:86px;top:0;width:148px;height:24px;cursor:grab;border-radius:10px}",
    ".bbx-top{position:absolute;top:4px;display:flex;gap:4px}",
    ".bbx-top-l{left:8px}.bbx-top-r{right:8px}",
    ".bbx-top button{display:inline-grid;place-items:center;width:22px;height:18px;border-radius:6px;border:1px solid rgba(0,0,0,.25);background:linear-gradient(180deg,#fff,#c8cdd7);color:#1c2030;cursor:pointer;padding:0}",
    ".bbx-top button[aria-pressed=true]{color:var(--bf-accent-b, #a855f7)}",
    ".bbx-display{position:absolute;left:108px;top:30px;width:104px;height:50px;padding:3px 5px;border-radius:6px;background:radial-gradient(120% 140% at 50% 0%,rgba(var(--bf-accent-a-rgb, 34, 211, 238),.30),rgba(4,14,18,.96) 70%);border:1px solid rgba(0,0,0,.6);box-shadow:inset 0 0 10px rgba(var(--bf-accent-a-rgb, 34, 211, 238),.35);overflow:hidden;color:var(--bf-accent-a, #22d3ee);font-family:\"Courier New\",ui-monospace,monospace}",
    ".bbx-marquee{height:12px;overflow:hidden;white-space:nowrap;font-size:10px;line-height:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-shadow:0 0 4px currentColor}",
    ".bbx-marquee span{display:inline-block;padding-right:24px}",
    ".bbx-marquee[data-long=true] .bbx-scroll{animation:bbx-marquee var(--bbx-scroll-s, 10s) linear infinite}",
    ".bfm[data-hidden=true] .bbx-marquee .bbx-scroll{animation-play-state:paused}",
    "@keyframes bbx-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
    ".bbx-row{display:flex;justify-content:space-between;align-items:center;font-size:9px;line-height:11px;font-variant-numeric:tabular-nums}",
    ".bbx-display .bfm-viz{display:block;width:94px;height:16px;margin:1px 0}",
    ".bbx-display .bfm-seek{display:block;width:94px;height:6px;margin:0;accent-color:var(--bf-accent-a, #22d3ee)}",
    ".bbx-keys{position:absolute;left:110px;top:112px;width:100px;display:flex;gap:2px}",
    ".bbx-keys button{flex:1;height:22px;padding:0;display:grid;place-items:center;border-radius:2px 2px 5px 5px;border:1px solid rgba(0,0,0,.45);background:linear-gradient(180deg,#fdfdfd,#d6d9e0 70%,#a6abb7);color:#1c2030;box-shadow:0 3px 0 #6d7384,0 4px 4px rgba(0,0,0,.25);cursor:pointer;transition:transform .06s}",
    ".bbx-keys button[data-down=true],.bbx-keys button:active{transform:translateY(3px);box-shadow:0 0 0 #6d7384,0 1px 2px rgba(0,0,0,.25)}",
    ".bbx-keys button[aria-pressed=true]{color:var(--bf-accent-b, #a855f7)}",
    ".bbx-keys .bfm-main{color:#0b1020}",
    ".bbx-low{position:absolute;left:108px;top:140px;width:104px;height:28px;display:flex;align-items:center;justify-content:space-between}",
    ".bbx-leds{display:flex;flex-direction:column-reverse;gap:1px}",
    ".bbx-leds span{display:block;width:12px;height:2.5px;border-radius:1px;background:#3dff9a;opacity:.18}",
    ".bbx-leds span:nth-child(n+5){background:#ffcc33}.bbx-leds span:nth-child(6){background:#ff4d4d}",
    ".bbx-dial{position:relative;width:26px;height:26px;border-radius:50%;cursor:ns-resize;background:radial-gradient(circle at 35% 30%,#fff,#b7bcc8 55%,#6f7687);border:1px solid rgba(0,0,0,.45);box-shadow:0 2px 4px rgba(0,0,0,.35)}",
    ".bbx-dial-mark{position:absolute;left:50%;top:2px;width:2px;height:8px;margin-left:-1px;border-radius:1px;background:#1c2030;transform-origin:1px 11px}",
    ".bbx-dial-out{font-size:9px;font-weight:700;min-width:26px;text-align:center;color:#1c2030}",
    ".bbx-low .bfm-btn{width:20px;height:20px;padding:0;display:grid;place-items:center;border-radius:5px;border:1px solid rgba(0,0,0,.3);background:linear-gradient(180deg,#fff,#c8cdd7);color:#1c2030;cursor:pointer}",
    ".bfm-panel{display:none;width:320px;max-width:calc(100vw - 16px);max-height:min(58vh,520px);overflow:auto;padding:12px 14px;border-radius:14px;color:#e8e8ff;background:linear-gradient(160deg,rgba(14,18,40,.96),rgba(8,10,24,.97));border:1px solid rgba(var(--bf-accent-a-rgb, 34, 211, 238),.22);box-shadow:0 12px 34px rgba(0,0,0,.5);transform-origin:top center;animation:bbx-slide .18s ease-out}",
    ".bfm-float[data-state=box][data-library=true] .bfm-panel,.bfm-pop .bfm-panel{display:block}",
    ".bfm-pop .bfm-panel{width:min(560px,100%);max-height:none}",
    "@keyframes bbx-slide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}",
    ".bfm-float[data-dock=phone]{left:0!important;right:0;top:auto!important;bottom:0!important;max-width:100vw;align-items:stretch;gap:0}",
    ".bfm-float[data-dock=phone] .bfm-tag{width:100%;border-radius:12px 12px 0 0;cursor:default}",
    ".bfm-float[data-dock=phone][data-state=box]{max-height:88vh;overflow:auto;padding:12px 8px 8px;border-radius:16px 16px 0 0;background:rgba(8,10,24,.97);box-shadow:0 -10px 30px rgba(0,0,0,.55);align-items:center}",
    ".bfm-float[data-dock=phone] .bfm-panel{width:100%;max-height:none;margin-top:8px}",
    ".bfm-float[data-dock=phone] .bbx-body-grip{cursor:default}",
    "@media (prefers-reduced-motion: reduce){.bbx-marquee .bbx-scroll{animation:none!important}.bbx-keys button{transition:none}.bfm-panel{animation:none}.bbx-marquee{text-overflow:ellipsis}}"
  ].join("\n");
  function injectStyle() {
    if (doc.getElementById("bf-boombox-style")) return;
    var st = doc.createElement("style");
    st.id = "bf-boombox-style";
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }

  function boxHtml(opts) {
    var leds = "";
    for (var i = 0; i < LEDS; i++) leds += "<span></span>";
    var top = opts.mode === "popout" ? "" :
      '<div class="bbx-top bbx-top-l"><button type="button" data-act="bbx-library" aria-pressed="false" aria-label="Library" title="Library">' + svg("library", 12) + "</button>" +
        '<button type="button" data-act="popout" aria-label="Pop out" title="Pop out">' + svg("popout", 12) + "</button></div>" +
      '<div class="bbx-top bbx-top-r"><button type="button" data-act="bbx-reset" aria-label="Reset the boombox position" title="Reset position">' + svg("reset", 12) + "</button>" +
        '<button type="button" data-act="bbx-minimise" aria-label="Minimise the boombox" title="Minimise">' + svg("minimise", 12) + "</button></div>";
    return '<div class="bbx" role="group" aria-label="BizForce boombox" aria-roledescription="music player">' + DRAWING +
      (opts.mode === "popout" ? "" : '<div class="bbx-body-grip" tabindex="0" role="button" aria-label="Move the boombox. Drag, or use the arrow keys; Home resets it."></div>') +
      top +
      '<div class="bbx-display" tabindex="0" role="group" aria-label="Display. Space plays or pauses; the left and right arrows seek.">' +
        '<div class="bbx-marquee"><span class="bbx-scroll"><span class="bfm-np-title">Nothing playing</span></span></div>' +
        '<div class="bbx-row"><span class="bfm-np-artist"></span><span><span class="bfm-cur">0:00</span>/<span class="bfm-dur">0:00</span></span></div>' +
        '<canvas class="bfm-viz" width="188" height="32" role="img" aria-label="Live sound visualiser"></canvas>' +
        '<input class="bfm-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Seek" />' +
      "</div>" +
      '<div class="bbx-keys" role="group" aria-label="Playback">' +
        '<button type="button" data-act="prev" aria-label="Previous">' + svg("prev", 12) + "</button>" +
        '<button type="button" class="bfm-main" data-act="toggle" aria-label="Play">' + svg("play", 12) + "</button>" +
        '<button type="button" data-act="next" aria-label="Next">' + svg("next", 12) + "</button>" +
        '<button type="button" data-act="shuffle" aria-pressed="false" aria-label="Shuffle">' + svg("shuffle", 12) + "</button>" +
        '<button type="button" data-act="repeat" aria-pressed="false" aria-label="Repeat: off">' + svg("repeat", 12) + "</button>" +
      "</div>" +
      '<div class="bbx-low"><div class="bbx-leds" data-side="left" aria-hidden="true">' + leds + "</div>" +
        '<button type="button" class="bfm-btn" data-act="mute" aria-pressed="false" aria-label="Mute">' + svg("volume", 12) + "</button>" +
        '<div class="bbx-dial" tabindex="0" role="slider" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="80" aria-valuetext="80%"><span class="bbx-dial-mark"></span></div>' +
        '<span class="bbx-dial-out">80%</span>' +
        '<div class="bbx-leds" data-side="right" aria-hidden="true">' + leds + "</div></div>" +
    "</div>";
  }
  function tagHtml() {
    var bars = "";
    for (var i = 0; i < WAVE_BARS; i++) bars += "<span></span>";
    return '<div class="bfm-tag" role="group" aria-label="Now playing. Drag, or use the arrow keys, to move it; Home resets it." tabindex="0">' +
      '<span class="bfm-tag-wave" aria-hidden="true">' + bars + "</span>" +
      '<span class="bfm-tag-title">Nothing playing</span>' +
      '<button type="button" class="bfm-main" data-act="toggle" aria-label="Play">' + svg("play", 12) + "</button>" +
      '<button type="button" data-act="next" aria-label="Next">' + svg("next", 12) + "</button>" +
      '<button type="button" data-act="bbx-expand" aria-label="Open the boombox" aria-expanded="false">' + svg("expand", 12) + "</button>" +
    "</div>";
  }

  /* mount({ mode: "float" | "popout", host, anchor, onVolume(v), onSeekBy(s), onToggle() }) */
  function mount(opts) {
    injectStyle();
    opts = opts || {};
    var popout = opts.mode === "popout";
    var root = doc.createElement("div");
    root.className = "bfm " + (popout ? "bfm-pop" : "bfm-float");
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", "Music");
    root.innerHTML = (popout ? "" : tagHtml()) + boxHtml(opts) + '<div class="bfm-panel" role="region" aria-label="Music library"></div>' +
      '<p class="bfm-sr bfm-live" aria-live="polite"></p>';
    (opts.host || doc.body || doc.documentElement).appendChild(root);
    var $ = function (sel) { return root.querySelector(sel); };
    var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
    var box = $(".bbx"), tag = $(".bfm-tag");
    var cones = $$(".bbx-cone"), caps = $$(".bbx-cap"), domes = $$(".bbx-tweeter-dome"), reels = $$(".bbx-reel");
    var leds = $$(".bbx-leds span"), wave = $$(".bfm-tag-wave span");
    var prefs = loadPrefs();
    var state = popout ? "box" : (prefs.state === "box" || prefs.state === "tag" ? prefs.state : (opts.anchor ? "box" : "tag"));
    var library = popout ? true : prefs.library === true;
    var M = { speed: 0, angle: 0, cone: 0, highs: 0, level: 0, t: 0 };

    function setState(s, focus) {
      if (popout) return;
      state = s === "box" ? "box" : "tag";
      if (state === "tag") library = false;
      root.setAttribute("data-state", state);
      root.setAttribute("data-library", library ? "true" : "false");
      var lib = $("[data-act=bbx-library]"); if (lib) lib.setAttribute("aria-pressed", library ? "true" : "false");
      var ex = $("[data-act=bbx-expand]"); if (ex) ex.setAttribute("aria-expanded", state === "box" ? "true" : "false");
      prefs.state = state; prefs.library = library; savePrefs(prefs);
      place();
      if (focus) {
        var to = state === "box" ? $(".bbx-keys .bfm-main") : $("[data-act=bbx-expand]");
        if (to) to.focus();
      }
    }
    function setLibrary(on) {
      if (popout) return;
      library = !!on;
      if (library) state = "box";
      setState(state);
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
    function defaultSpot() {
      if (opts.anchor && opts.anchor.getBoundingClientRect) {
        var r = opts.anchor.getBoundingClientRect();
        return { left: r.right + GAP, top: r.top };
      }
      return { left: 16, top: window.innerHeight - root.offsetHeight - 16 };
    }
    function place() {
      if (popout) return;
      if (phone()) {
        root.setAttribute("data-dock", "phone");
        root.removeAttribute("data-placed");
        root.style.left = ""; root.style.top = ""; root.style.right = ""; root.style.bottom = "";
        return;
      }
      root.setAttribute("data-dock", "desktop");
      var p = stored() || defaultSpot();
      put(p.left, p.top);
      nudge();
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
      if (popout || phone()) return false;
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
      if (!t || !t.closest || popout || phone()) return false;
      if (t.closest(".bbx-body-grip")) return true;
      if (t.closest("button, input, textarea, select, a, label, .bbx-dial, .bbx-display, .bfm-panel")) return false;
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
      if (drag.moved) { nudge(); saveSpot(); }
    }
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    /* The tag's own body, or the grip on the handle: the arrows nudge it, Home resets it. */
    root.addEventListener("keydown", function (e) {
      var t = e.target;
      if (e.key === "Escape" && state === "box" && !popout) { e.preventDefault(); setState("tag", true); return; }
      var movable = !popout && !phone() && (t === tag || (t && t.classList && t.classList.contains("bbx-body-grip")));
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
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "bbx-expand") { library = true; setState("box", true); }
      else if (act === "bbx-minimise") setState("tag", true);
      else if (act === "bbx-library") setLibrary(!library);
      else if (act === "bbx-reset") { reset(); var g = $(".bbx-body-grip"); if (g) g.focus(); }
    });
    root.addEventListener("dblclick", function (e) { if (grabbable(e.target)) reset(); });
    /* the keys go down under the finger, and come back up */
    $$(".bbx-keys button").forEach(function (k) {
      k.addEventListener("pointerdown", function () { k.setAttribute("data-down", "true"); });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (n) { k.addEventListener(n, function () { k.removeAttribute("data-down"); }); });
    });

    /* ── the dial ────────────────────────────────────────────────────────── */
    var dial = $(".bbx-dial"), volume = 0.8, dialDrag = null;
    function setDial(v, tell) {
      volume = clamp01(v);
      var pct = Math.round(volume * 100);
      dial.setAttribute("aria-valuenow", String(pct));
      dial.setAttribute("aria-valuetext", pct + "%");
      $(".bbx-dial-mark").style.transform = "rotate(" + (-135 + 270 * volume).toFixed(1) + "deg)";
      $(".bbx-dial-out").textContent = pct + "%";
      if (tell && opts.onVolume) opts.onVolume(volume);
    }
    dial.addEventListener("keydown", function (e) {
      var by = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05, PageUp: 0.1, PageDown: -0.1 }[e.key];
      if (e.key === "Home") { e.preventDefault(); setDial(0, true); return; }
      if (e.key === "End") { e.preventDefault(); setDial(1, true); return; }
      if (by === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      setDial(Math.round((volume + by) * 100) / 100, true);
    });
    dial.addEventListener("wheel", function (e) {
      e.preventDefault();
      setDial(Math.round((volume + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100, true);
    }, { passive: false });
    dial.addEventListener("pointerdown", function (e) {
      dialDrag = { y: e.clientY, x: e.clientX, v: volume };
      if (dial.setPointerCapture) { try { dial.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
      e.stopPropagation();
    });
    dial.addEventListener("pointermove", function (e) {
      if (!dialDrag) return;
      setDial(dialDrag.v + ((dialDrag.y - e.clientY) + (e.clientX - dialDrag.x)) / 100, true);
    });
    ["pointerup", "pointercancel"].forEach(function (n) { dial.addEventListener(n, function () { dialDrag = null; }); });

    /* ── the motion ──────────────────────────────────────────────────────── */
    function rest() {
      M.speed = 0; M.cone = 0; M.highs = 0; M.level = 0;
      paint();
    }
    function paint() {
      var cs = "scale(" + (1 + CONE_PULSE * M.cone).toFixed(4) + ")";
      var ks = "scale(" + (1 + CAP_PULSE * M.cone).toFixed(4) + ")";
      cones.forEach(function (c) { c.style.transform = cs; });
      caps.forEach(function (c) { c.style.transform = ks; });
      domes.forEach(function (d) { d.style.opacity = (0.55 + 0.45 * M.highs).toFixed(3); d.style.transform = "scale(" + (1 + TWEETER_PULSE * M.highs).toFixed(4) + ")"; });
      var rot = "rotate(" + (M.angle % 360).toFixed(2) + "deg)";
      reels.forEach(function (r) { r.style.transform = rot; });
      var lit = Math.round(M.level * LEDS);
      leds.forEach(function (l, i) { l.style.opacity = (i % LEDS) < lit ? "1" : "0.18"; });
      wave.forEach(function (b, i) {
        var s = 0.2 + 0.8 * clamp01(M.level * (0.55 + 0.45 * Math.sin(M.t * 9 + i * 1.7)));
        b.style.transform = "scaleY(" + s.toFixed(3) + ")";
      });
    }
    /* One frame. lv: { bass, highs, level } (0 … 1); playing: whether it is
       heard; dt: seconds since the last frame. Nothing moves while paused: the
       speakers ease back to rest and the reels slow to a stop. */
    function animate(lv, playing, dt) {
      dt = Math.max(0, Math.min(0.1, Number(dt) || 0));
      M.t += dt;
      var bass = playing ? clamp01(lv && lv.bass) : 0;
      var highs = playing ? clamp01(lv && lv.highs) : 0;
      var level = playing ? clamp01(lv && lv.level) : 0;
      M.cone += (bass - M.cone) * (bass > M.cone ? 0.6 : 0.25);
      M.highs += (highs - M.highs) * 0.4;
      M.level += (level - M.level) * (level > M.level ? 0.6 : 0.2);
      if (M.cone < 0.001) M.cone = 0;
      if (M.highs < 0.001) M.highs = 0;
      if (M.level < 0.001) M.level = 0;
      M.speed += ((playing ? 1 : 0) - M.speed) * Math.min(1, dt * 3);
      if (!playing && M.speed < 0.01) M.speed = 0;
      M.angle += M.speed * REEL_DEG_PER_S * dt;
      paint();
      return M.speed > 0 || M.cone > 0 || M.highs > 0 || M.level > 0;
    }
    /* Under reduced motion: everything at rest; the display shows a still level. */
    function still() { rest(); root.setAttribute("data-still", "true"); }

    /* ── what it shows ───────────────────────────────────────────────────── */
    var lastTitle = null;
    function render(v) {
      v = v || {};
      var title = v.title || "Nothing playing";
      var tt = $(".bfm-tag-title");
      if (tt) tt.textContent = v.tagText || title;
      if (tag) tag.setAttribute("data-resume", v.resume ? "true" : "false");
      var mq = $(".bbx-marquee");
      if (mq) {
        var long = title.length > 16 && !reducedMotion();
        var sc = $(".bbx-scroll");
        sc.innerHTML = "";
        var a = doc.createElement("span"); a.className = "bfm-np-title"; a.textContent = title; sc.appendChild(a);
        if (long) { var b2 = doc.createElement("span"); b2.setAttribute("aria-hidden", "true"); b2.textContent = title; sc.appendChild(b2); }
        mq.setAttribute("data-long", long ? "true" : "false");
        sc.style.setProperty("--bbx-scroll-s", Math.max(6, Math.round(title.length / 3)) + "s");
      }
      if (title !== lastTitle) { lastTitle = title; var live = $(".bfm-live"); if (live) live.textContent = v.title ? "Now playing: " + title + (v.artist ? " by " + v.artist : "") : ""; }
      if (typeof v.volume === "number" && doc.activeElement !== dial && !dialDrag) setDial(v.muted ? 0 : v.volume, false);
    }

    function onResize() { place(); }
    window.addEventListener("resize", onResize);
    doc.addEventListener("visibilitychange", function () { root.setAttribute("data-hidden", doc.hidden ? "true" : "false"); });
    var nudger = popout ? null : setInterval(function () { if (state && !drag.on) nudge(); }, 1500);

    root.setAttribute("data-state", state);
    root.setAttribute("data-library", library ? "true" : "false");
    setState(state);
    setDial(0.8, false);
    rest();
    return {
      root: root, panel: $(".bfm-panel"), box: box, tag: tag,
      state: function () { return state; }, library: function () { return library; },
      setState: setState, setLibrary: setLibrary, place: place, nudge: nudge, reset: reset,
      animate: animate, still: still, rest: rest, render: render,
      motion: function () { return { speed: M.speed, angle: M.angle, cone: M.cone, highs: M.highs, level: M.level }; },
      destroy: function () { if (nudger) clearInterval(nudger); window.removeEventListener("resize", onResize); }
    };
  }

  window.BFBoombox = {
    mount: mount, clampPosition: clampPosition,
    STORE_KEY: STORE_KEY, DRAG_THRESHOLD: DRAG_THRESHOLD, NUDGE: NUDGE, PHONE_MAX: PHONE_MAX, Z: Z,
    CONE_PULSE: CONE_PULSE, CAP_PULSE: CAP_PULSE
  };
})();

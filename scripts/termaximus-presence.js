(function () {
  "use strict";

  /* suppress entirely on the login page or when logged out */
  try {
    var _tmxPath  = (window.location.pathname || "").toLowerCase();
    var _tmxLogin = _tmxPath === "/" || _tmxPath === "" || /(^|\/)app\.html$/.test(_tmxPath);
    if (_tmxLogin || !localStorage.getItem("bf_token")) return;
  } catch (e) {}

  if (document.getElementById("tmx-presence-root")) return;

  /* controlled from elsewhere (e.g. a settings toggle); default to active/shown */
  try {
    if (localStorage.getItem("tmx_presence_active") === "0") return;
  } catch (e) {}

  /* default corner — controlled from Settings (Preferences > Mist Default
     Position); only used when no dragged position is stored, see
     _tmxRestorePosition() below. */
  var MIST_CORNERS = {
    "top-right":    { root: "top: 200px; right: 180px;",    chat: "top: 320px; right: 180px;" },
    "bottom-right": { root: "bottom: 120px; right: 180px;", chat: "bottom: 200px; right: 180px;" },
    "top-left":     { root: "top: 200px; left: 40px;",      chat: "top: 320px; left: 40px;" },
    "bottom-left":  { root: "bottom: 120px; left: 40px;",   chat: "bottom: 200px; left: 40px;" }
  };
  var _tmxCornerKey = "top-right";
  try {
    var _tmxStoredCorner = localStorage.getItem("tmx_mist_corner");
    if (_tmxStoredCorner && MIST_CORNERS[_tmxStoredCorner]) _tmxCornerKey = _tmxStoredCorner;
  } catch (e) {}
  var _tmxCorner = MIST_CORNERS[_tmxCornerKey];

  /* ── Styles ── */
  var style = document.createElement("style");
  style.textContent = [

    /* ── star-heart pulse ── */
    "@keyframes tmx-core-glow {",
    "  0%,100% { opacity: 0.72; transform: scale(1);    filter: blur(4px); }",
    "  50%      { opacity: 1.00; transform: scale(1.22); filter: blur(3px); }",
    "}",

    /* ── pulse: opacity + scale ── */
    "@keyframes tmx-pulse-a {",
    "  0%,100% { opacity: 0.55; transform: scale(1); }",
    "  50%      { opacity: 0.72; transform: scale(1.15); }",
    "}",
    "@keyframes tmx-pulse-b {",
    "  0%,100% { opacity: 0.48; transform: scale(1); }",
    "  50%      { opacity: 0.68; transform: scale(1.20); }",
    "}",
    "@keyframes tmx-pulse-c {",
    "  0%,100% { opacity: 0.50; transform: scale(1); }",
    "  50%      { opacity: 0.66; transform: scale(1.12); }",
    "}",

    /* ── drift: translate wander, each blob traces a different lazy path ── */
    "@keyframes tmx-drift-a {",
    "  0%   { translate: 0px   0px;  }",
    "  20%  { translate: -5px  3px;  }",
    "  40%  { translate: 4px   6px;  }",
    "  60%  { translate: 7px  -2px;  }",
    "  80%  { translate: -2px -6px;  }",
    "  100% { translate: 0px   0px;  }",
    "}",
    "@keyframes tmx-drift-b {",
    "  0%   { translate: 0px   0px;  }",
    "  25%  { translate: 6px  -5px;  }",
    "  50%  { translate: -4px -7px;  }",
    "  75%  { translate: -7px  4px;  }",
    "  100% { translate: 0px   0px;  }",
    "}",
    "@keyframes tmx-drift-c {",
    "  0%   { translate: 0px  0px;   }",
    "  15%  { translate: 5px  7px;   }",
    "  45%  { translate: -6px 4px;   }",
    "  70%  { translate: 3px -6px;   }",
    "  90%  { translate: -4px -3px;  }",
    "  100% { translate: 0px  0px;   }",
    "}",

    /* ── morph: border-radius shape-shifting ── */
    "@keyframes tmx-morph-a {",
    "  0%   { border-radius: 62% 38% 54% 46% / 44% 56% 44% 56%; }",
    "  25%  { border-radius: 38% 62% 42% 58% / 58% 42% 62% 38%; }",
    "  50%  { border-radius: 50% 50% 66% 34% / 36% 64% 48% 52%; }",
    "  75%  { border-radius: 44% 56% 36% 64% / 62% 38% 56% 44%; }",
    "  100% { border-radius: 62% 38% 54% 46% / 44% 56% 44% 56%; }",
    "}",
    "@keyframes tmx-morph-b {",
    "  0%   { border-radius: 46% 54% 68% 32% / 56% 44% 36% 64%; }",
    "  30%  { border-radius: 64% 36% 44% 56% / 40% 60% 58% 42%; }",
    "  60%  { border-radius: 34% 66% 52% 48% / 62% 38% 44% 56%; }",
    "  100% { border-radius: 46% 54% 68% 32% / 56% 44% 36% 64%; }",
    "}",
    "@keyframes tmx-morph-c {",
    "  0%   { border-radius: 56% 44% 38% 62% / 48% 52% 66% 34%; }",
    "  20%  { border-radius: 40% 60% 58% 42% / 64% 36% 42% 58%; }",
    "  55%  { border-radius: 66% 34% 48% 52% / 38% 62% 54% 46%; }",
    "  80%  { border-radius: 48% 52% 62% 38% / 56% 44% 36% 64%; }",
    "  100% { border-radius: 56% 44% 38% 62% / 48% 52% 66% 34%; }",
    "}",

    /* ── container ── */
    "#tmx-presence-root {",
    "  position: fixed;",
    "  " + _tmxCorner.root,
    "  z-index: 2147483647;",
    "  pointer-events: none;",
    "  width: 110px;",
    "  height: 110px;",
    "  overflow: visible;",
    "  transition: -webkit-mask-size 5s ease-in-out, mask-size 5s ease-in-out;",
    "}",

    /* star-heart: burning white-blue sun with gold outer bloom */
    "#tmx-core {",
    "  position: absolute;",
    "  width: 67px;",
    "  height: 67px;",
    "  top: 22px;",
    "  left: 22px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(255,255,255,0.98)  0%,",
    "    rgba(200,230,255,0.92)  6%,",
    "    rgba(100,180,255,0.80)  14%,",
    "    rgba(60,120,255,0.60)   24%,",
    "    rgba(180,100,255,0.38)  38%,",
    "    rgba(220,168,60,0.22)   54%,",
    "    rgba(200,140,40,0.08)   70%,",
    "    transparent             100%",
    "  );",
    "  filter: blur(4px);",
    "  animation: tmx-core-glow 5.5s ease-in-out infinite;",
    "}",

    /* outer bloom — second layer, larger and softer */
    "#tmx-core::after {",
    "  content: '';",
    "  position: absolute;",
    "  inset: -22px;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(140,180,255,0.28)  0%,",
    "    rgba(100,120,255,0.14)  40%,",
    "    rgba(220,168,60,0.08)   65%,",
    "    transparent             100%",
    "  );",
    "  filter: blur(14px);",
    "}",

    /* soul-color cycle: radial-gradient reaches transparent before element
       edges — corners are fully empty, blur has nothing to spread outward  */
    "@keyframes tmx-soul-cycle {",
    "  0%   { background: radial-gradient(circle at 50% 50%, rgba(80,15,110,0.62) 0%, rgba(80,15,110,0)  55%); }",
    "  20%  { background: radial-gradient(circle at 50% 50%, rgba(90,6,22,0.58)   0%, rgba(90,6,22,0)    55%); }",
    "  40%  { background: radial-gradient(circle at 50% 50%, rgba(12,6,85,0.65)   0%, rgba(12,6,85,0)    55%); }",
    "  60%  { background: radial-gradient(circle at 50% 50%, rgba(0,32,48,0.55)   0%, rgba(0,32,48,0)    55%); }",
    "  80%  { background: radial-gradient(circle at 50% 50%, rgba(70,16,4,0.60)   0%, rgba(70,16,4,0)    55%); }",
    "  100% { background: radial-gradient(circle at 50% 50%, rgba(80,15,110,0.62) 0%, rgba(80,15,110,0)  55%); }",
    "}",
    "#tmx-soul {",
    "  position: absolute;",
    "  width: 90px;",
    "  height: 90px;",
    "  top: 10px;",
    "  left: 10px;",
    "  pointer-events: none;",
    "  filter: blur(22px);",
    "  animation: tmx-soul-cycle 80s ease-in-out infinite;",
    "}",

    ".tmx-blob {",
    "  position: absolute;",
    "  pointer-events: auto;",
    "  cursor: pointer;",
    "}",

    /* blob A — near-black indigo / dark void */
    ".tmx-blob-a {",
    "  width: 86px;",
    "  height: 86px;",
    "  top: 12px;",
    "  left: 12px;",
    "  background: radial-gradient(ellipse at 42% 40%,",
    "    rgba(48,12,150,0.88)   0%,",
    "    rgba(16,4,68,0.74)     45%,",
    "    rgba(4,0,24,0)         100%",
    "  );",
    "  filter: blur(19px);",
    "  animation:",
    "    tmx-pulse-a  4.2s ease-in-out infinite,",
    "    tmx-drift-a  9s   ease-in-out infinite,",
    "    tmx-morph-a  8s   ease-in-out infinite;",
    "}",

    /* blob B — dark abyss violet / near-black magenta */
    ".tmx-blob-b {",
    "  width: 72px;",
    "  height: 72px;",
    "  top: 0px;",
    "  left: 31px;",
    "  background: radial-gradient(ellipse at 48% 44%,",
    "    rgba(88,8,95,0.84)     0%,",
    "    rgba(45,4,60,0.66)     48%,",
    "    rgba(16,1,28,0)        100%",
    "  );",
    "  filter: blur(24px);",
    "  animation:",
    "    tmx-pulse-b  5s    ease-in-out infinite 1.1s,",
    "    tmx-drift-b  11s   ease-in-out infinite 0.7s,",
    "    tmx-morph-b  10s   ease-in-out infinite 1.2s;",
    "}",

    /* blob C — deep space navy / dark blue-black */
    ".tmx-blob-c {",
    "  width: 77px;",
    "  height: 77px;",
    "  top: 31px;",
    "  left: 0px;",
    "  background: radial-gradient(ellipse at 44% 46%,",
    "    rgba(12,6,100,0.90)    0%,",
    "    rgba(6,2,55,0.70)      50%,",
    "    rgba(2,0,22,0)         100%",
    "  );",
    "  filter: blur(22px);",
    "  animation:",
    "    tmx-pulse-c  3.7s  ease-in-out infinite 2.2s,",
    "    tmx-drift-c  13s   ease-in-out infinite 1.8s,",
    "    tmx-morph-c  7s    ease-in-out infinite 2.5s;",
    "}",

    /* ── sparkle stars ── */
    "@keyframes tmx-spark {",
    "  0%,100% { opacity: var(--sp-lo, 0.15); }",
    "  50%      { opacity: var(--sp-hi, 1.00); }",
    "}",

    /* star drift — 6 path variants, 15-25s, subtle translate */
    "@keyframes tmx-sdrift-1 {",
    "  0%   { translate: 0px 0px;   }",
    "  25%  { translate: 3px -2px;  }",
    "  50%  { translate: 5px  2px;  }",
    "  75%  { translate: 2px  4px;  }",
    "  100% { translate: 0px  0px;  }",
    "}",
    "@keyframes tmx-sdrift-2 {",
    "  0%   { translate:  0px  0px; }",
    "  30%  { translate: -4px  3px; }",
    "  60%  { translate: -2px -3px; }",
    "  100% { translate:  0px  0px; }",
    "}",
    "@keyframes tmx-sdrift-3 {",
    "  0%   { translate: 0px  0px;  }",
    "  20%  { translate: 4px  3px;  }",
    "  55%  { translate: 2px -4px;  }",
    "  80%  { translate: -3px 2px;  }",
    "  100% { translate: 0px  0px;  }",
    "}",
    "@keyframes tmx-sdrift-4 {",
    "  0%   { translate:  0px 0px;  }",
    "  35%  { translate: -3px -4px; }",
    "  70%  { translate:  4px -2px; }",
    "  100% { translate:  0px  0px; }",
    "}",
    "@keyframes tmx-sdrift-5 {",
    "  0%   { translate: 0px  0px;  }",
    "  40%  { translate: -5px 2px;  }",
    "  65%  { translate: -2px -3px; }",
    "  100% { translate: 0px  0px;  }",
    "}",
    "@keyframes tmx-sdrift-6 {",
    "  0%   { translate: 0px 0px;   }",
    "  25%  { translate: 3px  4px;  }",
    "  50%  { translate: -3px 3px;  }",
    "  80%  { translate: 2px -4px;  }",
    "  100% { translate: 0px  0px;  }",
    "}",

    /* swirl — graceful arc sweeps, wider range than drift */
    "@keyframes tmx-sswirl-1 {",
    "  0%   { translate:  0px   0px; }",
    "  18%  { translate:  6px  -5px; }",
    "  40%  { translate:  9px   2px; }",
    "  62%  { translate:  4px   7px; }",
    "  82%  { translate: -3px   4px; }",
    "  100% { translate:  0px   0px; }",
    "}",
    "@keyframes tmx-sswirl-2 {",
    "  0%   { translate:  0px   0px; }",
    "  22%  { translate: -5px  -6px; }",
    "  45%  { translate: -8px   2px; }",
    "  68%  { translate: -2px   7px; }",
    "  85%  { translate:  4px   3px; }",
    "  100% { translate:  0px   0px; }",
    "}",

    /* orbit — four-waypoint circular path around base position */
    "@keyframes tmx-sorbit-1 {",
    "  0%   { translate:  0px   5px; }",
    "  25%  { translate:  5px   0px; }",
    "  50%  { translate:  0px  -5px; }",
    "  75%  { translate: -5px   0px; }",
    "  100% { translate:  0px   5px; }",
    "}",
    "@keyframes tmx-sorbit-2 {",
    "  0%   { translate:  0px   4px; }",
    "  25%  { translate: -5px   1px; }",
    "  50%  { translate: -1px  -4px; }",
    "  75%  { translate:  5px  -1px; }",
    "  100% { translate:  0px   4px; }",
    "}",

    /* still — blink only, no spatial motion */
    "@keyframes tmx-snone {",
    "  0%, 100% { translate: 0px 0px; }",
    "}",

    /* each star: bright radial core + cross rays via ::before / ::after */
    ".tmx-star {",
    "  position: absolute;",
    "  border-radius: 50%;",
    "  pointer-events: none;",
    "  overflow: visible;",
    "  transition: top 18s ease-in-out, left 18s ease-in-out;",
    "  animation:",
    "    tmx-spark var(--sp-dur,5s) ease-in-out infinite var(--sp-del,0s),",
    "    var(--sd-name,tmx-sdrift-1) var(--sd-dur,20s) ease-in-out infinite var(--sd-del,0s);",
    "}",
    ".tmx-star::before, .tmx-star::after {",
    "  content: '';",
    "  position: absolute;",
    "  top: 50%; left: 50%;",
    "  border-radius: 1px;",
    "  opacity: 0.55;",
    "}",
    /* horizontal ray */
    ".tmx-star::before {",
    "  width: 520%; height: 1px;",
    "  transform: translate(-50%,-50%);",
    "  background: linear-gradient(90deg,",
    "    transparent 0%, currentColor 50%, transparent 100%);",
    "}",
    /* vertical ray */
    ".tmx-star::after {",
    "  width: 1px; height: 520%;",
    "  transform: translate(-50%,-50%);",
    "  background: linear-gradient(180deg,",
    "    transparent 0%, currentColor 50%, transparent 100%);",
    "}",

    /* ── gold dust & streaks ── */
    "@keyframes tmx-gold-drift-a {",
    "  0%,100% { opacity: 0.22; transform: rotate(-32deg) translate(0,0); }",
    "  40%      { opacity: 0.34; transform: rotate(-28deg) translate(-4px,3px); }",
    "  70%      { opacity: 0.16; transform: rotate(-35deg) translate(3px,-2px); }",
    "}",
    "@keyframes tmx-gold-drift-b {",
    "  0%,100% { opacity: 0.18; transform: rotate(55deg) translate(0,0); }",
    "  35%      { opacity: 0.30; transform: rotate(58deg) translate(3px,4px); }",
    "  65%      { opacity: 0.10; transform: rotate(52deg) translate(-3px,2px); }",
    "}",
    "@keyframes tmx-gold-drift-c {",
    "  0%,100% { opacity: 0.26; transform: scale(1)    translate(0,0); }",
    "  50%      { opacity: 0.14; transform: scale(1.18) translate(2px,-3px); }",
    "}",

    /* streak A — thin diagonal slash, upper-left region */
    "#tmx-gold-a {",
    "  position: absolute;",
    "  width: 8px;",
    "  height: 53px;",
    "  top: 10px;",
    "  left: 22px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(240,200,80,0.55) 0%,",
    "    rgba(220,170,50,0.28) 40%,",
    "    transparent           100%",
    "  );",
    "  filter: blur(10px);",
    "  animation: tmx-gold-drift-a 11s ease-in-out infinite 0.6s;",
    "}",

    /* streak B — wider slash, lower-right region */
    "#tmx-gold-b {",
    "  position: absolute;",
    "  width: 10px;",
    "  height: 43px;",
    "  top: 53px;",
    "  left: 62px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(255,210,90,0.48) 0%,",
    "    rgba(220,165,45,0.22) 45%,",
    "    transparent           100%",
    "  );",
    "  filter: blur(12px);",
    "  animation: tmx-gold-drift-b 9s ease-in-out infinite 2.3s;",
    "}",

    /* dust C — soft shapeless gold bloom, center-left */
    "#tmx-gold-c {",
    "  position: absolute;",
    "  width: 41px;",
    "  height: 26px;",
    "  top: 41px;",
    "  left: 12px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(235,195,75,0.32) 0%,",
    "    rgba(210,160,40,0.12) 55%,",
    "    transparent           100%",
    "  );",
    "  filter: blur(16px);",
    "  animation: tmx-gold-drift-c 13s ease-in-out infinite 4.8s;",
    "}",

    /* ── shooting star ── */
    "@keyframes tmx-shoot-fly {",
    "  0%   { opacity: 0;    transform: translateX(0);                       }",
    "  8%   { opacity: 0.60;                                                 }",
    "  75%  { opacity: 0.50;                                                 }",
    "  100% { opacity: 0;    transform: translateX(var(--shoot-dist,168px)); }",
    "}",
    "#tmx-shoot {",
    "  position: absolute;",
    "  width: 36px;",
    "  height: 1px;",
    "  border-radius: 1px;",
    "  pointer-events: none;",
    "  opacity: 0;",
    "  transform-origin: right center;",
    "  background: linear-gradient(90deg,",
    "    transparent              0%,",
    "    rgba(190,210,255,0.08)   18%,",
    "    rgba(205,218,255,0.38)   52%,",
    "    rgba(210,220,255,0.14)   82%,",
    "    transparent             100%",
    "  );",
    "}",

    /* ghost whisper text */
    "#tmx-whisper {",
    "  position: absolute;",
    "  top: 50px;",
    "  left: 50%;",
    "  transform: translateX(-50%);",
    "  pointer-events: none;",
    "  white-space: nowrap;",
    "  font-size: 11px;",
    "  font-weight: 600;",
    "  font-family: Georgia, 'Palatino Linotype', serif;",
    "  letter-spacing: 0.18em;",
    "  text-transform: uppercase;",
    "  color: rgba(215,205,245,1);",
    "  opacity: 0;",
    "  transition: opacity 3s ease-in-out;",
    "  -webkit-user-select: none;",
    "  user-select: none;",
    "}",

    /* ── chat panel back-glow: compact brand-gradient aura + breathing pulse ── */
    "#tmx-chat-glow-wrap {",
    "  position: fixed;",
    "  " + _tmxCorner.chat,
    "  width: min(288px, calc(100vw - 16px));",
    "  height: 340px;",
    "  z-index: 2147483646;",
    "  pointer-events: none;",
    "  opacity: 0;",
    "  transition: opacity 1.3s ease;",
    "}",
    "#tmx-chat-glow-wrap.tmx-glow-active { opacity: 1; }",
    "#tmx-chat-glow {",
    "  position: absolute;",
    "  inset: -32px;",
    "  border-radius: 30px;",
    "  filter: blur(15px);",
    "  transform-origin: 50% 50%;",
    "  background: radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.80) 0%, rgba(123,47,247,0.48) 45%, rgba(168,85,247,0.24) 75%, transparent 100%);",
    "  box-shadow: 0 0 30px 7px rgba(0,229,255,0.45), 0 0 60px 13px rgba(123,47,247,0.32), 0 0 100px 18px rgba(168,85,247,0.18);",
    "  animation: tmx-chat-glow-breathe 5s ease-in-out infinite;",
    "}",
    "@keyframes tmx-chat-glow-breathe {",
    "  0%,100% { transform: scale(1);     opacity: 0.78; }",
    "  50%      { transform: scale(1.06); opacity: 0.96; }",
    "}",
    "@keyframes tmx-chat-void {",
    "  0%   { background-position: 15% 20%, 85% 80%, 50% 50%, 40% 60%; }",
    "  25%  { background-position: 75% 35%, 20% 65%, 65% 25%, 80% 20%; }",
    "  50%  { background-position: 85% 80%, 15% 20%, 35% 75%, 10% 85%; }",
    "  75%  { background-position: 30% 70%, 70% 30%, 55% 45%, 60% 40%; }",
    "  100% { background-position: 15% 20%, 85% 80%, 50% 50%, 40% 60%; }",
    "}",
    "#tmx-chat {",
    "  position: fixed;",
    "  " + _tmxCorner.chat,
    "  width: min(288px, calc(100vw - 16px));",
    "  height: 340px;",
    "  z-index: 2147483647;",
    "  display: flex;",
    "  flex-direction: column;",
    "  border-radius: 16px;",
    "  background:",
    "    radial-gradient(ellipse at 50% 50%, rgba(22,5,65,0.14)  0%, transparent 58%),",
    "    radial-gradient(ellipse at 50% 50%, rgba(35,3,40,0.10)  0%, transparent 54%),",
    "    radial-gradient(ellipse at 50% 50%, rgba(4,2,48,0.16)   0%, transparent 64%),",
    "    radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.30)    0%, transparent 70%),",
    "    rgba(2,1,10,0.98);",
    "  background-size: 200% 200%, 200% 200%, 200% 200%, 240% 240%;",
    "  border: none;",
    "  box-shadow: 0 8px 40px rgba(0,0,0,0.65);",
    "  animation: tmx-chat-void 22s ease-in-out infinite;",
    "  backdrop-filter: blur(24px);",
    "  -webkit-backdrop-filter: blur(24px);",
    "  overflow: hidden;",
    "  opacity: 0;",
    "  pointer-events: none;",
    "  transform-origin: bottom right;",
    "}",
    /* thick living gold rim — gradient ring masked to a frame, shimmer wanders slowly */
    "#tmx-chat::before {",
    "  content: '';",
    "  position: absolute;",
    "  inset: 0;",
    "  border-radius: 16px;",
    "  padding: 4px;",
    "  z-index: 2;",
    "  pointer-events: none;",
    "  background: linear-gradient(135deg,",
    "    #6b4e00 0%, #b8860b 14%, #fff6d5 24%, #d4af37 34%,",
    "    #f7dd8a 46%, #8b6508 58%, #fff3c4 70%, #b8860b 82%, #6b4e00 100%);",
    "  background-size: 260% 260%;",
    "  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);",
    "  -webkit-mask-composite: xor;",
    "  mask-composite: exclude;",
    "  animation: tmx-gold-shimmer 7s ease-in-out infinite;",
    "}",
    "@keyframes tmx-gold-shimmer {",
    "  0%,100% { background-position: 15% 20%; }",
    "  25%      { background-position: 70% 35%; }",
    "  50%      { background-position: 85% 75%; }",
    "  75%      { background-position: 30% 65%; }",
    "}",
    /* live canvas deep-space starfield — replaces the old tiled-gradient
       #tmx-chat::after background; see createTmxStarfield() below */
    "#tmx-chat-canvas {",
    "  position: absolute;",
    "  inset: 0;",
    "  width: 100%;",
    "  height: 100%;",
    "  z-index: 0;",
    "  pointer-events: none;",
    "  border-radius: 16px;",
    "  display: block;",
    "}",
    "#tmx-chat-header, #tmx-chat-msgs, #tmx-chat-foot { position: relative; z-index: 1; }",
    "#tmx-chat-header {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  padding: 12px 16px 10px;",
    "  border-bottom: 1px solid rgba(100,70,200,0.18);",
    "  flex-shrink: 0;",
    "}",
    "#tmx-chat-title {",
    "  font-family: Georgia, 'Palatino Linotype', serif;",
    "  font-size: 11px;",
    "  letter-spacing: 0.22em;",
    "  text-transform: uppercase;",
    "  color: rgba(200,185,255,0.82);",
    "}",
    "#tmx-chat-title-name {",
    "  transition: color 0.6s ease, text-shadow 0.6s ease;",
    "}",
    "@keyframes tmx-title-glow {",
    "  0%,100% { text-shadow: 0 0 6px rgba(180,130,255,0.75), 0 0 14px rgba(150,90,255,0.55), 0 0 24px rgba(130,70,255,0.35); }",
    "  50%      { text-shadow: 0 0 10px rgba(205,160,255,1), 0 0 22px rgba(175,115,255,0.85), 0 0 38px rgba(150,90,255,0.6); }",
    "}",
    "#tmx-chat-title-name.tmx-thinking {",
    "  color: rgba(228,210,255,0.98);",
    "  animation: tmx-title-glow 1.6s ease-in-out infinite;",
    "}",
    "#tmx-chat-close {",
    "  background: none;",
    "  border: none;",
    "  color: rgba(160,140,220,0.55);",
    "  font-size: 12px;",
    "  cursor: pointer;",
    "  padding: 2px 6px;",
    "  line-height: 1;",
    "  font-family: inherit;",
    "  transition: color 0.15s;",
    "}",
    "#tmx-chat-close:hover { color: rgba(200,180,255,0.9); }",
    "#tmx-chat-msgs {",
    "  flex: 1;",
    "  overflow-y: auto;",
    "  padding: 14px 14px 8px;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 10px;",
    "  scrollbar-width: thin;",
    "  scrollbar-color: rgba(100,70,200,0.3) transparent;",
    "}",
    "#tmx-chat-msgs::-webkit-scrollbar { width: 3px; }",
    "#tmx-chat-msgs::-webkit-scrollbar-thumb {",
    "  background: rgba(100,70,200,0.35);",
    "  border-radius: 2px;",
    "}",
    ".tmx-msg {",
    "  max-width: 88%;",
    "  font-family: Georgia, 'Palatino Linotype', serif;",
    "  font-size: 12px;",
    "  line-height: 1.6;",
    "  padding: 8px 12px;",
    "  border-radius: 10px;",
    "  word-break: break-word;",
    "}",
    ".tmx-msg-user {",
    "  align-self: flex-end;",
    "  background: rgba(80,40,180,0.38);",
    "  border: 1px solid rgba(120,80,220,0.3);",
    "  color: rgba(220,210,255,0.92);",
    "}",
    ".tmx-msg-oracle {",
    "  align-self: flex-start;",
    "  background: rgba(20,10,50,0.6);",
    "  border: 1px solid rgba(80,60,160,0.22);",
    "  color: rgba(190,175,240,0.82);",
    "  font-style: italic;",
    "}",
    "#tmx-chat-foot {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 8px;",
    "  padding: 10px 14px 12px;",
    "  border-top: 1px solid rgba(100,70,200,0.18);",
    "  flex-shrink: 0;",
    "}",
    "#tmx-chat-input {",
    "  flex: 1;",
    "  background: rgba(255,255,255,0.05);",
    "  border: 1px solid rgba(100,70,200,0.28);",
    "  border-radius: 8px;",
    "  padding: 7px 11px;",
    "  color: rgba(220,210,255,0.9);",
    "  font-family: Georgia, 'Palatino Linotype', serif;",
    "  font-size: 12px;",
    "  outline: none;",
    "  transition: border-color 0.2s;",
    "}",
    "#tmx-chat-input::placeholder { color: rgba(140,120,200,0.45); font-style: italic; }",
    "#tmx-chat-input:focus { border-color: rgba(140,100,240,0.55); }",
    "#tmx-chat-send {",
    "  width: 30px;",
    "  height: 30px;",
    "  border-radius: 8px;",
    "  border: 1px solid rgba(120,80,220,0.4);",
    "  background: rgba(80,40,180,0.32);",
    "  color: rgba(200,180,255,0.8);",
    "  font-size: 14px;",
    "  cursor: pointer;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  flex-shrink: 0;",
    "  transition: background 0.15s, border-color 0.15s;",
    "  font-family: inherit;",
    "  line-height: 1;",
    "}",
    "#tmx-chat-send:hover {",
    "  background: rgba(100,55,220,0.5);",
    "  border-color: rgba(150,110,255,0.55);",
    "}",
    "#tmx-chat-attach {",
    "  width: 30px;",
    "  height: 30px;",
    "  border-radius: 8px;",
    "  border: 1px solid rgba(120,80,220,0.4);",
    "  background: rgba(80,40,180,0.18);",
    "  color: rgba(200,180,255,0.8);",
    "  font-size: 13px;",
    "  cursor: pointer;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  flex-shrink: 0;",
    "  transition: background 0.15s, border-color 0.15s;",
    "  font-family: inherit;",
    "  line-height: 1;",
    "}",
    "#tmx-chat-attach:hover {",
    "  background: rgba(100,55,220,0.32);",
    "  border-color: rgba(150,110,255,0.55);",
    "}",
    "#tmx-chat-attach-info {",
    "  padding: 4px 14px 0;",
    "  font-size: 10px;",
    "  color: rgba(180,160,230,0.65);",
    "  font-style: italic;",
    "  display: none;",
    "}",
    "#tmx-chat-shoot {",
    "  position: absolute;",
    "  height: 1px;",
    "  border-radius: 1px;",
    "  pointer-events: none;",
    "  opacity: 0;",
    "  z-index: 0;",
    "  transform-origin: right center;",
    "  background: linear-gradient(90deg,",
    "    transparent              0%,",
    "    rgba(190,210,255,0.05)   18%,",
    "    rgba(205,218,255,0.22)   52%,",
    "    rgba(210,220,255,0.08)   82%,",
    "    transparent             100%",
    "  );",
    "}"

  ].join("\n");
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement("div");
  root.id = "tmx-presence-root";

  var core = document.createElement("div");
  core.id = "tmx-core";
  root.appendChild(core);

  var soul = document.createElement("div");
  soul.id = "tmx-soul";
  root.appendChild(soul);

  var starEls = [];

  var STARS = [
    /* top, left, sz, color,     glow,                       lo,   hi,   dur,    del,    motion,          mdur,   mdel   */
    /* ── swirl ── */
    [  7,   17,   4, "#ffffff", "rgba(200,220,255,0.70)",   0.12, 1.00, "6.0s", "0.0s", "tmx-sswirl-1", "28s",  "0.0s" ],
    [ 42,    6,   6, "#ffe896", "rgba(255,220,100,0.70)",   0.08, 0.92, "5.5s", "2.1s", "tmx-sswirl-2", "24s",  "1.3s" ],
    [ 76,   24,   5, "#ffffff", "rgba(200,220,255,0.68)",   0.10, 0.95, "4.2s", "1.8s", "tmx-sswirl-1", "26s",  "8.2s" ],
    [ 95,   82,   5, "#ffffff", "rgba(200,220,255,0.70)",   0.10, 0.96, "3.5s", "2.6s", "tmx-sswirl-2", "32s",  "7.1s" ],
    /* ── orbit ── */
    [  5,   65,   5, "#ffe896", "rgba(255,220,100,0.65)",   0.10, 0.95, "4.5s", "0.7s", "tmx-sorbit-1", "22s",  "2.1s" ],
    [ 30,   50,   7, "#ffffff", "rgba(200,220,255,0.80)",   0.10, 1.00, "3.8s", "0.4s", "tmx-sorbit-2", "30s",  "6.0s" ],
    [ 68,  102,   5, "#ffe896", "rgba(255,220,100,0.65)",   0.08, 0.88, "7.5s", "3.5s", "tmx-sorbit-1", "18s",  "0.8s" ],
    [100,   11,   6, "#ffe896", "rgba(255,220,100,0.72)",   0.08, 0.92, "8.0s", "4.2s", "tmx-sorbit-2", "25s",  "2.9s" ],
    /* ── blink only ── */
    [ 20,   96,   4, "#ffffff", "rgba(200,220,255,0.65)",   0.14, 1.00, "7.0s", "1.4s", "tmx-snone",    "60s",  "4.5s" ],
    [ 62,   89,   4, "#ffe896", "rgba(255,220,100,0.60)",   0.12, 0.90, "6.5s", "2.9s", "tmx-snone",    "60s",  "3.7s" ],
    [ 90,   55,   4, "#ffffff", "rgba(200,220,255,0.62)",   0.14, 1.00, "5.0s", "1.1s", "tmx-snone",    "60s",  "5.5s" ],
    [ 49,   38,   4, "#ffe896", "rgba(255,220,100,0.60)",   0.12, 0.90, "6.0s", "3.2s", "tmx-snone",    "60s",  "4.0s" ]
  ];

  STARS.forEach(function (s) {
    var el = document.createElement("div");
    el.className = "tmx-star";
    var sz = s[2];
    el.style.cssText = [
      "top:"    + s[0] + "px",
      "left:"   + s[1] + "px",
      "width:"  + sz   + "px",
      "height:" + sz   + "px",
      "color:"  + s[3],
      "background:radial-gradient(ellipse at 50% 50%," +
        s[3] + " 0%," + s[4] + " 45%,transparent 100%)",
      "box-shadow:0 0 " + (sz*1.2) + "px " + (sz*0.4) + "px " + s[4]
    ].join(";");
    el.style.setProperty("--sp-lo",   String(s[5]));
    el.style.setProperty("--sp-hi",   String(s[6]));
    el.style.setProperty("--sp-dur",  s[7]);
    el.style.setProperty("--sp-del",  s[8]);
    el.style.setProperty("--sd-name", s[9]);
    el.style.setProperty("--sd-dur",  s[10]);
    el.style.setProperty("--sd-del",  s[11]);
    root.appendChild(el);
    starEls.push(el);
  });

  ["a", "b", "c"].forEach(function (id) {
    var g = document.createElement("div");
    g.id = "tmx-gold-" + id;
    root.appendChild(g);
  });

  ["a", "b", "c"].forEach(function (id) {
    var blob = document.createElement("div");
    blob.className = "tmx-blob tmx-blob-" + id;
    root.appendChild(blob);
  });

  document.body.appendChild(root);
  _tmxRestorePosition();

  /* ── chat panel back-glow DOM ── */
  var chatGlowWrap = document.createElement("div");
  chatGlowWrap.id = "tmx-chat-glow-wrap";
  var chatGlow = document.createElement("div");
  chatGlow.id = "tmx-chat-glow";
  chatGlowWrap.appendChild(chatGlow);
  document.body.appendChild(chatGlowWrap);

  /* ── Chat-box starfield engine — mirrors oracle.html's #starCanvas engine
     (same makeStar/drawStarAt/drawStarWrapped, nebula, twinkle, and drift),
     adapted to the small fixed chat panel: sized to the canvas element's
     own box instead of the viewport, star counts scaled down for the
     panel's size, and all pointer/tilt parallax removed (stars still
     self-drift and twinkle, they just don't track input). Gated on the
     chat's own open/close state via start()/stop(), in addition to the
     document.hidden pause. ── */
  function createTmxStarfield(canvas) {
    if (!canvas) return { start: function () {}, stop: function () {} };
    var ctx = canvas.getContext("2d");
    if (!ctx) return { start: function () {}, stop: function () {} };

    var reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    var DPR_CAP = 2;
    var cssWidth  = canvas.clientWidth  || 288;
    var cssHeight = canvas.clientHeight || 340;

    var nebulaCanvas = document.createElement("canvas");
    var nebulaCtx     = null;

    function renderNebula() {
      nebulaCanvas.width  = canvas.width;
      nebulaCanvas.height = canvas.height;
      nebulaCtx = nebulaCanvas.getContext("2d");
      var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      nebulaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var span = Math.max(cssWidth, cssHeight);
      var clouds = [
        { x: cssWidth * 0.18, y: cssHeight * 0.22, r: span * 0.55, color: "168,85,247",  alpha: 0.06 }, /* violet */
        { x: cssWidth * 0.82, y: cssHeight * 0.68, r: span * 0.5,  color: "34,211,238",  alpha: 0.05 }, /* cyan */
        { x: cssWidth * 0.52, y: cssHeight * 0.85, r: span * 0.4,  color: "52,211,153",  alpha: 0.035 } /* emerald whisper */
      ];

      clouds.forEach(function (c) {
        var g = nebulaCtx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, "rgba(" + c.color + "," + c.alpha + ")");
        g.addColorStop(1, "rgba(" + c.color + ",0)");
        nebulaCtx.fillStyle = g;
        nebulaCtx.fillRect(0, 0, cssWidth, cssHeight);
      });
    }

    function resize() {
      cssWidth  = canvas.clientWidth  || cssWidth;
      cssHeight = canvas.clientHeight || cssHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width  = Math.round(cssWidth  * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderNebula();
    }
    resize();

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    // ── Star generation ──────────────────────────────────────────────────
    var TINTS = [
      { r: 34,  g: 211, b: 238 }, /* cyan */
      { r: 139, g: 92,  b: 246 }, /* violet-blue */
      { r: 251, g: 191, b: 36  }  /* warm gold */
    ];

    function pickTint() {
      if (Math.random() < 1 / 6) {
        return TINTS[Math.floor(Math.random() * TINTS.length)];
      }
      return { r: 255, g: 255, b: 255 };
    }

    function makeStar(minR, maxR) {
      var r = minR + Math.random() * (maxR - minR);
      var baseAlpha = 0.12 + Math.pow(Math.random(), 2) * 0.8;
      var scintillates = Math.random() < 0.25;
      return {
        x: Math.random() * cssWidth,
        y: Math.random() * cssHeight,
        r: r,
        baseAlpha: baseAlpha,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.6,
        tint: pickTint(),
        spiked: (r > (minR + (maxR - minR) * 0.6)) && (baseAlpha > 0.6),
        scintillates: scintillates,
        twinkleDepth: scintillates ? 0.6 : 0.12
      };
    }

    var LAYERS = [
      { count: 70, minR: 0.4, maxR: 0.9, parallax: 0.15, offsetX: 0, offsetY: 0, stars: [] }, /* far */
      { count: 35, minR: 0.8, maxR: 1.6, parallax: 0.4,  offsetX: 0, offsetY: 0, stars: [] }, /* mid */
      { count: 16, minR: 1.4, maxR: 2.6, parallax: 1.0,  offsetX: 0, offsetY: 0, stars: [] }  /* near */
    ];

    LAYERS.forEach(function (layer) {
      for (var i = 0; i < layer.count; i++) {
        layer.stars.push(makeStar(layer.minR, layer.maxR));
      }
    });

    var BASE_DRIFT_X = 8;    /* px/sec at parallax factor 1 */
    var BASE_DRIFT_Y = -4.5; /* px/sec at parallax factor 1 */

    // ── Rendering — identical to the Oracle engine (no parallax input) ────
    function drawStarAt(px, py, star, alpha) {
      var tint = star.tint;

      // (a) soft outer halo — the subtle bloom
      var haloR = star.r * 2.2;
      var halo = ctx.createRadialGradient(px, py, 0, px, py, haloR);
      halo.addColorStop(0, "rgba(" + tint.r + "," + tint.g + "," + tint.b + "," + (alpha * 0.5) + ")");
      halo.addColorStop(1, "rgba(" + tint.r + "," + tint.g + "," + tint.b + ",0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, haloR, 0, Math.PI * 2);
      ctx.fill();

      // diffraction spikes — bright stars only, drawn under the core
      if (star.spiked && alpha > 0.35) {
        var spikeLen   = star.r * 6;
        var spikeAlpha = alpha * 0.5;
        var spikeRgb   = tint.r + "," + tint.g + "," + tint.b;

        ctx.lineWidth = 0.8;

        var vSpike = ctx.createLinearGradient(px, py - spikeLen, px, py + spikeLen);
        vSpike.addColorStop(0,   "rgba(" + spikeRgb + ",0)");
        vSpike.addColorStop(0.5, "rgba(" + spikeRgb + "," + spikeAlpha + ")");
        vSpike.addColorStop(1,   "rgba(" + spikeRgb + ",0)");
        ctx.strokeStyle = vSpike;
        ctx.beginPath();
        ctx.moveTo(px, py - spikeLen);
        ctx.lineTo(px, py + spikeLen);
        ctx.stroke();

        var hSpike = ctx.createLinearGradient(px - spikeLen, py, px + spikeLen, py);
        hSpike.addColorStop(0,   "rgba(" + spikeRgb + ",0)");
        hSpike.addColorStop(0.5, "rgba(" + spikeRgb + "," + spikeAlpha + ")");
        hSpike.addColorStop(1,   "rgba(" + spikeRgb + ",0)");
        ctx.strokeStyle = hSpike;
        ctx.beginPath();
        ctx.moveTo(px - spikeLen, py);
        ctx.lineTo(px + spikeLen, py);
        ctx.stroke();
      }

      // (b) sharp core, on top — crisp bright point rather than a fuzzy ball
      var coreR = star.r * 0.7;
      var centerColor = tint;
      if (star.baseAlpha > 0.7) {
        centerColor = {
          r: Math.round(tint.r + (255 - tint.r) * 0.6),
          g: Math.round(tint.g + (255 - tint.g) * 0.6),
          b: Math.round(tint.b + (255 - tint.b) * 0.6)
        };
      }
      var core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
      core.addColorStop(0, "rgba(" + centerColor.r + "," + centerColor.g + "," + centerColor.b + "," + alpha + ")");
      core.addColorStop(1, "rgba(" + tint.r + "," + tint.g + "," + tint.b + "," + (alpha * 0.15) + ")");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(px, py, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawStarWrapped(star, px, py, alpha) {
      var glowR = star.r * 3.2;
      drawStarAt(px, py, star, alpha);
      if (px < glowR)                drawStarAt(px + cssWidth,  py, star, alpha);
      if (px > cssWidth - glowR)     drawStarAt(px - cssWidth,  py, star, alpha);
      if (py < glowR)                drawStarAt(px, py + cssHeight, star, alpha);
      if (py > cssHeight - glowR)    drawStarAt(px, py - cssHeight, star, alpha);
    }

    // ── Animation loop — no parallax; gated by chat open/close (desired)
    // AND document.hidden ─────────────────────────────────────────────────
    var desired  = false;
    var running  = false;
    var rafId    = null;
    var lastTime = null;
    var elapsed  = 0;

    function frame(now) {
      if (!running) return;
      if (lastTime == null) lastTime = now;
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      if (!reducedMotion) elapsed += dt;

      ctx.clearRect(0, 0, cssWidth, cssHeight);
      if (nebulaCtx) {
        ctx.drawImage(nebulaCanvas, 0, 0, canvas.width, canvas.height, 0, 0, cssWidth, cssHeight);
      }

      LAYERS.forEach(function (layer) {
        if (!reducedMotion) {
          layer.offsetX += BASE_DRIFT_X * layer.parallax * dt;
          layer.offsetY += BASE_DRIFT_Y * layer.parallax * dt;
        }

        layer.stars.forEach(function (star) {
          var px = ((star.x + layer.offsetX) % cssWidth  + cssWidth)  % cssWidth;
          var py = ((star.y + layer.offsetY) % cssHeight + cssHeight) % cssHeight;

          var alpha = star.baseAlpha;
          if (!reducedMotion) {
            var tw = Math.sin(elapsed * star.speed + star.phase);
            alpha = Math.max(0, Math.min(1, star.baseAlpha + tw * star.baseAlpha * star.twinkleDepth));
          }

          drawStarWrapped(star, px, py, alpha);
        });
      });

      rafId = requestAnimationFrame(frame);
    }

    function loopStart() {
      if (running) return;
      running = true;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    }

    function loopStop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { loopStop(); } else if (desired) { loopStart(); }
    });

    function start() {
      desired = true;
      if (!document.hidden) loopStart();
    }

    function stop() {
      desired = false;
      loopStop();
    }

    return { start: start, stop: stop, resize: resize };
  }

  /* ── chat panel DOM ── */
  var chat = document.createElement("div");
  chat.id = "tmx-chat";
  chat.innerHTML =
    '<div id="tmx-chat-header">' +
      '<span id="tmx-chat-title">Ask <span id="tmx-chat-title-name">Termaximus</span></span>' +
      '<button id="tmx-chat-close" aria-label="Close">&#x2715;</button>' +
    '</div>' +
    '<div id="tmx-chat-msgs"></div>' +
    '<div id="tmx-chat-attach-info"></div>' +
    '<div id="tmx-chat-foot">' +
      '<input id="tmx-chat-file" type="file" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,image/*" style="display:none;" />' +
      '<button id="tmx-chat-attach" type="button" aria-label="Attach files">&#x1F4CE;</button>' +
      '<input id="tmx-chat-input" type="text" placeholder="Ask the Oracle…" autocomplete="off" />' +
      '<button id="tmx-chat-send" aria-label="Send">&#x2191;</button>' +
    '</div>';
  document.body.appendChild(chat);

  var chatShoot = document.createElement("div");
  chatShoot.id = "tmx-chat-shoot";
  chat.insertBefore(chatShoot, chat.firstChild);

  var chatCanvasEl = document.createElement("canvas");
  chatCanvasEl.id = "tmx-chat-canvas";
  chat.insertBefore(chatCanvasEl, chat.firstChild);

  var tmxStarfield = createTmxStarfield(chatCanvasEl);

  var chatMsgs  = document.getElementById("tmx-chat-msgs");
  var chatInput = document.getElementById("tmx-chat-input");
  var chatSend  = document.getElementById("tmx-chat-send");
  var chatClose = document.getElementById("tmx-chat-close");
  var chatTitleName = document.getElementById("tmx-chat-title-name");
  var chatFile       = document.getElementById("tmx-chat-file");
  var chatAttach     = document.getElementById("tmx-chat-attach");
  var chatAttachInfo = document.getElementById("tmx-chat-attach-info");

  var _chatOpen      = false;
  var _firstOpen     = true;
  var _historyLoaded = false;
  var _sending       = false;
  var _currentStyle  = 0;
  var _closeToken    = 0;
  var _stagedFiles   = [];

  /* 10 open/close transition styles — one picked at random each open */
  var TMX_STYLES = [
    /* 0 — scale bloom */
    { os: { opacity:"0", transform:"scale(0.88) translateY(6px)" },
      oe: { opacity:"1", transform:"scale(1) translateY(0)" },
      ce: { opacity:"0", transform:"scale(0.92) translateY(8px)" },
      tr: "opacity 0.38s ease, transform 0.38s cubic-bezier(0.34,1.56,0.64,1)", dur: 420 },
    /* 1 — rise from below */
    { os: { opacity:"0", transform:"translateY(28px)" },
      oe: { opacity:"1", transform:"translateY(0)" },
      ce: { opacity:"0", transform:"translateY(24px)" },
      tr: "opacity 0.42s ease, transform 0.42s cubic-bezier(0.22,1.2,0.36,1)", dur: 460 },
    /* 2 — iris portal */
    { os: { clipPath:"circle(0% at 100% 100%)", opacity:"1" },
      oe: { clipPath:"circle(150% at 100% 100%)", opacity:"1" },
      ce: { clipPath:"circle(0% at 100% 100%)", opacity:"1" },
      tr: "clip-path 0.52s cubic-bezier(0.22,1,0.36,1)", dur: 560 },
    /* 3 — slide from right */
    { os: { opacity:"0", transform:"translateX(38px)" },
      oe: { opacity:"1", transform:"translateX(0)" },
      ce: { opacity:"0", transform:"translateX(30px)" },
      tr: "opacity 0.36s ease, transform 0.36s cubic-bezier(0.22,1,0.36,1)", dur: 400 },
    /* 4 — mist dissolve */
    { os: { opacity:"0", transform:"scale(1.05)", filter:"blur(14px)" },
      oe: { opacity:"1", transform:"scale(1)",    filter:"blur(0px)" },
      ce: { opacity:"0", transform:"scale(1.04)", filter:"blur(12px)" },
      tr: "opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease", dur: 540 },
    /* 5 — unfold from corner */
    { os: { opacity:"0", transform:"scale(0.04)" },
      oe: { opacity:"1", transform:"scale(1)" },
      ce: { opacity:"0", transform:"scale(0.05)" },
      tr: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.4,0.64,1)", dur: 440 },
    /* 6 — shimmer reveal */
    { os: { opacity:"0", transform:"scale(0.96)", filter:"brightness(4) saturate(0.2)" },
      oe: { opacity:"1", transform:"scale(1)",    filter:"brightness(1) saturate(1)" },
      ce: { opacity:"0", transform:"scale(1.04)", filter:"brightness(2.5)" },
      tr: "opacity 0.45s ease, transform 0.45s ease, filter 0.45s ease", dur: 480 },
    /* 7 — cosmic float down */
    { os: { opacity:"0", transform:"translateY(-24px) rotate(-1.5deg)" },
      oe: { opacity:"1", transform:"translateY(0) rotate(0deg)" },
      ce: { opacity:"0", transform:"translateY(-18px) rotate(1deg)" },
      tr: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)", dur: 440 },
    /* 8 — void collapse in */
    { os: { opacity:"0", transform:"scale(1.14)", filter:"blur(10px)" },
      oe: { opacity:"1", transform:"scale(1)",    filter:"blur(0px)" },
      ce: { opacity:"0", transform:"scale(1.12)", filter:"blur(8px)" },
      tr: "opacity 0.48s ease, transform 0.48s cubic-bezier(0.22,1,0.36,1), filter 0.48s ease", dur: 520 },
    /* 9 — glitch assemble (JS-driven, see _openGlitch/_closeGlitch) */
    { os:{}, oe:{}, ce:{}, tr:"", dur: 310 }
  ];

  function _applyS(obj) {
    /* apply clipPath/filter before opacity to prevent single-frame flash */
    if (obj.clipPath  !== undefined) chat.style.clipPath  = obj.clipPath;
    if (obj.filter    !== undefined) chat.style.filter    = obj.filter;
    if (obj.transform !== undefined) chat.style.transform = obj.transform;
    if (obj.opacity   !== undefined) chat.style.opacity   = obj.opacity;
  }

  function _clearFX() {
    chat.style.transition = "none";
    chat.style.opacity    = "0";
    chat.style.transform  = "";
    chat.style.clipPath   = "";
    chat.style.filter     = "";
  }

  function addMsg(role, text) {
    var div = document.createElement("div");
    div.className = "tmx-msg tmx-msg-" + role;
    div.textContent = text;
    chatMsgs.appendChild(div);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  function loadChatHistory() {
    var token = localStorage.getItem("bf_token") || "";
    if (!token) return;

    fetch("https://dynamic-prosperity-production-5382.up.railway.app/api/oracle", {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var list = Array.isArray(data) ? data : (Array.isArray(data.messages) ? data.messages : null);
        if (!list || !list.length) return;

        chatMsgs.textContent = "";
        list.forEach(function (m) {
          if (!m) return;
          var r = (m.role === "assistant" || m.role === "oracle") ? "oracle" : "user";
          addMsg(r, m.content || "");
        });
        chatMsgs.scrollTop = chatMsgs.scrollHeight;
      })
      .catch(function () {});
  }

  function openChat() {
    _chatOpen = true;
    tmxStarfield.resize();
    tmxStarfield.start();

    if (!_historyLoaded) {
      _historyLoaded = true;
      loadChatHistory();
    }

    _closeToken++;
    _currentStyle = Math.floor(Math.random() * 10);
    chat.style.pointerEvents = "auto";
    chatGlowWrap.classList.add("tmx-glow-active");

    if (_currentStyle === 9) { _openGlitch(); return; }

    var s = TMX_STYLES[_currentStyle];
    chat.style.transition = "none";
    _applyS(s.os);
    chat.offsetHeight;
    chat.style.transition = s.tr;
    _applyS(s.oe);

    if (_firstOpen) {
      _firstOpen = false;
      addMsg("oracle", "The Oracle stirs… speak your question into the void.");
    }
    setTimeout(function () { chatInput.focus(); }, Math.max(260, s.dur));
  }

  function closeChat() {
    _chatOpen = false;
    tmxStarfield.stop();
    chat.style.pointerEvents = "none";
    chatGlowWrap.classList.remove("tmx-glow-active");
    var token = ++_closeToken;

    if (_currentStyle === 9) { _closeGlitch(token); return; }

    var s = TMX_STYLES[_currentStyle];
    chat.style.transition = s.tr;
    _applyS(s.ce);

    setTimeout(function () {
      if (token !== _closeToken) return;
      _clearFX();
    }, s.dur + 60);
  }

  function _openGlitch() {
    var tok = _closeToken;
    chat.style.transition = "none";
    chat.style.opacity    = "0";
    chat.style.transform  = "translateX(-10px) skewX(6deg)";
    chat.style.filter     = "brightness(2.5)";
    chat.offsetHeight;
    setTimeout(function () {
      if (tok !== _closeToken) return;
      chat.style.opacity   = "0.65";
      chat.style.transform = "translateX(7px) skewX(-4deg)";
      chat.style.filter    = "brightness(1.8)";
      setTimeout(function () {
        if (tok !== _closeToken) return;
        chat.style.opacity   = "0.88";
        chat.style.transform = "translateX(-3px) skewX(2deg)";
        chat.style.filter    = "brightness(1.3)";
        setTimeout(function () {
          if (tok !== _closeToken) return;
          chat.style.transition = "opacity 0.12s ease, transform 0.12s ease, filter 0.12s ease";
          chat.style.opacity   = "1";
          chat.style.transform = "translateX(0) skewX(0)";
          chat.style.filter    = "brightness(1)";
          if (_firstOpen) {
            _firstOpen = false;
            addMsg("oracle", "The Oracle stirs… speak your question into the void.");
          }
          setTimeout(function () { chatInput.focus(); }, 160);
        }, 60);
      }, 70);
    }, 80);
  }

  function _closeGlitch(token) {
    chat.style.transition = "none";
    chat.style.transform  = "translateX(5px) skewX(-3deg)";
    chat.style.filter     = "brightness(1.8)";
    setTimeout(function () {
      if (token !== _closeToken) return;
      chat.style.opacity   = "0.55";
      chat.style.transform = "translateX(-8px) skewX(4deg)";
      chat.style.filter    = "brightness(2.2)";
      setTimeout(function () {
        if (token !== _closeToken) return;
        chat.style.opacity   = "0";
        chat.style.transform = "translateX(12px)";
        chat.style.filter    = "brightness(1)";
        setTimeout(function () {
          if (token !== _closeToken) return;
          _clearFX();
        }, 80);
      }, 80);
    }, 80);
  }

  chatClose.addEventListener("click", function (e) {
    e.stopPropagation();
    closeChat();
  });

  function _renderAttachInfo() {
    if (_stagedFiles.length) {
      chatAttachInfo.textContent = _stagedFiles.length + " file" + (_stagedFiles.length === 1 ? "" : "s") + " attached";
      chatAttachInfo.style.display = "block";
    } else {
      chatAttachInfo.textContent = "";
      chatAttachInfo.style.display = "none";
    }
  }

  chatAttach.addEventListener("click", function (e) {
    e.stopPropagation();
    chatFile.click();
  });

  chatFile.addEventListener("click", function (e) {
    e.stopPropagation();
  });

  chatFile.addEventListener("change", function () {
    _stagedFiles = Array.prototype.slice.call(chatFile.files || []);
    _renderAttachInfo();
  });

  var TMX_THINKING_PHRASES = [
    "Termaximus consults the deeper current…",
    "Tracing the pattern beneath the pattern…",
    "Descending into the well of knowing…",
    "Reading the threads of your question…",
    "The channel gathers its light…",
    "Weighing this in the alchemical fire…",
    "Peeping the angles on this one…",
    "Turning the matter over, facet by facet…",
    "Listening to what the silence says…",
    "Cross-referencing the hidden ledger…",
    "Letting the signal rise through the noise…",
    "Consulting the record etched in the deep…",
    "Running it through the crucible…",
    "Feeling out the shape of the truth here…",
    "The Oracle leans in…",
    "Drawing the map before I speak…"
  ];

  function sendMsg() {
    var txt = chatInput.value.trim();
    var filesForRequest = _stagedFiles.slice();
    if ((!txt && !filesForRequest.length) || _sending) return;
    _sending = true;

    addMsg("user", txt || ("[" + filesForRequest.length + " file" + (filesForRequest.length === 1 ? "" : "s") + " attached]"));
    chatInput.value        = "";
    chatInput.style.opacity = "0.5";
    chatSend.style.opacity  = "0.5";

    _stagedFiles   = [];
    chatFile.value = "";
    _renderAttachInfo();

    var thinking = document.createElement("div");
    thinking.className   = "tmx-msg tmx-msg-oracle";
    thinking.textContent = TMX_THINKING_PHRASES[Math.floor(Math.random() * TMX_THINKING_PHRASES.length)];
    chatMsgs.appendChild(thinking);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    chatTitleName.classList.add("tmx-thinking");

    var token = localStorage.getItem("bf_token") || "";

    var formData = new FormData();
    formData.append("message", txt);
    formData.append("agent_type", "oracle");
    filesForRequest.forEach(function (file) {
      formData.append("files", file);
    });

    fetch("https://dynamic-prosperity-production-5382.up.railway.app/api/oracle", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token
      },
      body: formData
    })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (data) {
      thinking.remove();
      addMsg("oracle", (data && data.reply) ? data.reply : "The channel fell silent… speak once more.");
    })
    .catch(function () {
      thinking.remove();
      addMsg("oracle", "The abyss does not answer in this moment… cast your question again.");
    })
    .then(function () {
      _sending = false;
      chatTitleName.classList.remove("tmx-thinking");
      chatInput.style.opacity = "";
      chatSend.style.opacity  = "";
      chatInput.focus();
    });
  }

  chatSend.addEventListener("click", function (e) {
    e.stopPropagation();
    sendMsg();
  });

  chatInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  });

  /* ── drag the whole presence anywhere on screen; a quick tap still opens the chat ── */
  var TMX_POS_KEY       = "tmx_presence_pos";
  var TMX_DRAG_THRESHOLD = 6;
  var _tmxPressX = 0, _tmxPressY = 0;
  var _tmxDragging   = false;
  var _tmxDragMoved  = false;
  var _tmxStartLeft  = 0;
  var _tmxStartTop   = 0;

  function _tmxClampPosition(left, top) {
    var maxLeft = Math.max(window.innerWidth  - root.offsetWidth,  0);
    var maxTop  = Math.max(window.innerHeight - root.offsetHeight, 0);
    return {
      left: Math.min(Math.max(left, 0), maxLeft),
      top:  Math.min(Math.max(top,  0), maxTop)
    };
  }

  function _tmxRestorePosition() {
    var raw;
    try { raw = localStorage.getItem(TMX_POS_KEY); } catch (e) { return; }
    if (!raw) return;
    var pos;
    try { pos = JSON.parse(raw); } catch (e) { return; }
    if (typeof pos.left !== "number" || typeof pos.top !== "number") return;
    var c = _tmxClampPosition(pos.left, pos.top);
    root.style.left   = c.left + "px";
    root.style.top    = c.top  + "px";
    root.style.right  = "auto";
    root.style.bottom = "auto";
  }

  root.addEventListener("pointerdown", function (e) {
    _tmxPressX    = e.clientX;
    _tmxPressY    = e.clientY;
    _tmxDragMoved = false;
    _tmxDragging  = true;
    var rect = root.getBoundingClientRect();
    _tmxStartLeft = rect.left;
    _tmxStartTop  = rect.top;
    if (e.target.setPointerCapture) {
      try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  root.addEventListener("pointermove", function (e) {
    if (!_tmxDragging) return;
    var dx = e.clientX - _tmxPressX;
    var dy = e.clientY - _tmxPressY;
    if (!_tmxDragMoved && Math.sqrt(dx * dx + dy * dy) < TMX_DRAG_THRESHOLD) return;
    _tmxDragMoved = true;
    var c = _tmxClampPosition(_tmxStartLeft + dx, _tmxStartTop + dy);
    root.style.left   = c.left + "px";
    root.style.top    = c.top  + "px";
    root.style.right  = "auto";
    root.style.bottom = "auto";
  });

  function _tmxEndDrag() {
    if (!_tmxDragging) return;
    _tmxDragging = false;
    if (_tmxDragMoved) {
      var rect = root.getBoundingClientRect();
      try {
        localStorage.setItem(TMX_POS_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (err) {}
    }
  }

  root.addEventListener("pointerup", _tmxEndDrag);
  root.addEventListener("pointercancel", _tmxEndDrag);

  root.addEventListener("click", function (e) {
    if (_tmxDragMoved) return;
    if (_chatOpen) { closeChat(); } else { openChat(); }
  });

  /* ── shooting star ── */
  var shoot = document.createElement("div");
  shoot.id = "tmx-shoot";
  root.appendChild(shoot);

  function fireShoot() {
    var W    = 110; /* container size px */
    var edge = Math.floor(Math.random() * 4);
    var top, left, angle;

    if (edge === 0) {        /* top edge — travel downward, 55-125° */
      top   = -4;
      left  = -10 + Math.random() * (W + 20);
      angle = 55 + Math.random() * 70;
    } else if (edge === 1) { /* right edge — travel leftward, 145-215° */
      top   = -10 + Math.random() * (W + 20);
      left  = W + 4;
      angle = 145 + Math.random() * 70;
    } else if (edge === 2) { /* bottom edge — travel upward, 235-305° */
      top   = W + 4;
      left  = -10 + Math.random() * (W + 20);
      angle = 235 + Math.random() * 70;
    } else {                 /* left edge — travel rightward, -35 to 35° */
      top   = -10 + Math.random() * (W + 20);
      left  = -4;
      angle = -35 + Math.random() * 70;
    }

    /* t=0 → fast+short, t=1 → slow+long */
    var t    = Math.random();
    var dur  = (0.6 + t * 0.8).toFixed(2);
    var len  = Math.round(22 + t * 32);
    var dist = Math.round(110 + t * 100);

    shoot.style.animation = "none";
    shoot.offsetHeight;   /* force reflow to restart */
    shoot.style.top    = top   + "px";
    shoot.style.left   = left  + "px";
    shoot.style.rotate = angle + "deg";
    shoot.style.width  = len   + "px";
    shoot.style.setProperty("--shoot-dist", dist + "px");
    shoot.style.animation = "tmx-shoot-fly " + dur + "s ease-out forwards";

    /* next shot: 8-14s from now */
    setTimeout(fireShoot, 8000 + Math.random() * 6000);
  }

  /* first shot after a short random delay */
  setTimeout(fireShoot, 2500 + Math.random() * 3500);

  /* ── chat shooting stars ── */
  function fireChatShoot() {
    if (!_chatOpen) {
      setTimeout(fireChatShoot, 6000 + Math.random() * 8000);
      return;
    }
    var CW = 288, CH = 340;
    var edge = Math.floor(Math.random() * 4);
    var top, left, angle;
    if (edge === 0) {
      top   = -2;
      left  = Math.random() * CW;
      angle = 55 + Math.random() * 70;
    } else if (edge === 1) {
      top   = Math.random() * CH;
      left  = CW + 2;
      angle = 145 + Math.random() * 70;
    } else if (edge === 2) {
      top   = CH + 2;
      left  = Math.random() * CW;
      angle = 235 + Math.random() * 70;
    } else {
      top   = Math.random() * CH;
      left  = -2;
      angle = -35 + Math.random() * 70;
    }
    var t    = Math.random();
    var dur  = (0.5 + t * 0.7).toFixed(2);
    var len  = Math.round(20 + t * 40);
    var dist = Math.round(100 + t * 160);
    chatShoot.style.animation = "none";
    chatShoot.offsetHeight;
    chatShoot.style.top    = top   + "px";
    chatShoot.style.left   = left  + "px";
    chatShoot.style.rotate = angle + "deg";
    chatShoot.style.width  = len   + "px";
    chatShoot.style.setProperty("--shoot-dist", dist + "px");
    chatShoot.style.animation = "tmx-shoot-fly " + dur + "s ease-out forwards";
    setTimeout(fireChatShoot, 7000 + Math.random() * 9000);
  }
  setTimeout(fireChatShoot, 5000 + Math.random() * 5000);

  /* ── starfield cluster cycling ── */
  /* 4 patterns — each entry maps to the same star index in STARS */
  var PATTERNS = [
    /* A — scattered wide (starting positions) */
    [[ 7,17],[42, 6],[76,24],[95,82],
     [ 5,65],[30,50],[68,102],[100,11],
     [20,96],[62,89],[90,55],[49,38]],
    /* B — loose ring around the center */
    [[ 8,50],[18,88],[42,108],[65,108],
     [88,96],[102,68],[105,42],[90,12],
     [68, 0],[40,  2],[ 18,18],[45,58]],
    /* C — dense core cluster */
    [[30,42],[25,60],[42,35],[48,72],
     [56,46],[60,62],[38,56],[66,40],
     [72,68],[38,72],[52,28],[68,52]],
    /* D — twin clusters: upper-left + lower-right */
    [[ 5, 8],[ 8,30],[20,10],[28,28],
     [15,42],[35, 5],[68,72],[78,96],
     [90,70],[98,88],[82,80],[102,75]]
  ];
  var patternIdx = 0;

  setInterval(function () {
    patternIdx = (patternIdx + 1) % PATTERNS.length;
    var pts = PATTERNS[patternIdx];
    starEls.forEach(function (el, i) {
      el.style.top  = pts[i][0] + "px";
      el.style.left = pts[i][1] + "px";
    });
  }, 35000);

  /* ── ghost whisper ── */
  var whisper = document.createElement("div");
  whisper.id = "tmx-whisper";
  whisper.textContent = "Ask Termaximus";
  root.appendChild(whisper);

  function surfaceWhisper() {
    /* drift slightly each time so it never feels like a fixed label */
    whisper.style.top = (44 + Math.round(Math.random() * 14)) + "px";
    whisper.style.opacity = "0.58";
    /* hold briefly then sink back */
    setTimeout(function () { whisper.style.opacity = "0"; }, 5000);
    /* next surfacing: 55-120s from now */
    setTimeout(surfaceWhisper, 55000 + Math.random() * 65000);
  }

  /* first whisper after 40-70s */
  setTimeout(surfaceWhisper, 40000 + Math.random() * 30000);

}());

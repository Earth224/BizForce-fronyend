(function () {
  "use strict";

  if (document.getElementById("tmx-presence-root")) return;

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
    "  bottom: 28px;",
    "  right: 28px;",
    "  z-index: 2147483647;",
    "  pointer-events: none;",
    "  width: 110px;",
    "  height: 110px;",
    "  overflow: visible;",
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

    ".tmx-blob {",
    "  position: absolute;",
    "  pointer-events: auto;",
    "  cursor: default;",
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
    "    rgba(4,0,24,0.16)      100%",
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
    "    rgba(16,1,28,0.12)     100%",
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
    "    rgba(2,0,22,0.14)      100%",
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
    "  0%   { opacity: 0;    transform: translateX(0);      }",
    "  8%   { opacity: 0.60;                                }",
    "  75%  { opacity: 0.50;                                }",
    "  100% { opacity: 0;    transform: translateX(168px);  }",
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
    "}"

  ].join("\n");
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement("div");
  root.id = "tmx-presence-root";

  var core = document.createElement("div");
  core.id = "tmx-core";
  root.appendChild(core);

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

  /* ── shooting star ── */
  var shoot = document.createElement("div");
  shoot.id = "tmx-shoot";
  root.appendChild(shoot);

  function fireShoot() {
    /* random angle 22-52 deg, start scattered across upper/left of container */
    var angle = 22 + Math.random() * 30;
    var top   = -12 + Math.random() * 72;
    var left  = -36 + Math.random() * 48;

    shoot.style.animation = "none";
    shoot.offsetHeight;   /* force reflow to restart */
    shoot.style.top    = top  + "px";
    shoot.style.left   = left + "px";
    shoot.style.rotate = angle + "deg";
    shoot.style.animation = "tmx-shoot-fly " + (0.9 + Math.random() * 0.4) + "s ease-out forwards";

    /* next shot: 8-14s from now */
    setTimeout(fireShoot, 8000 + Math.random() * 6000);
  }

  /* first shot after a short random delay */
  setTimeout(fireShoot, 2500 + Math.random() * 3500);
}());

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
    "  width: 92px;",
    "  height: 92px;",
    "  overflow: visible;",
    "}",

    /* star-heart: burning white-blue sun with gold outer bloom */
    "#tmx-core {",
    "  position: absolute;",
    "  width: 56px;",
    "  height: 56px;",
    "  top: 18px;",
    "  left: 18px;",
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
    "  inset: -18px;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(140,180,255,0.28)  0%,",
    "    rgba(100,120,255,0.14)  40%,",
    "    rgba(220,168,60,0.08)   65%,",
    "    transparent             100%",
    "  );",
    "  filter: blur(12px);",
    "}",

    ".tmx-blob {",
    "  position: absolute;",
    "  pointer-events: auto;",
    "  cursor: default;",
    "}",

    /* blob A — deep indigo / violet */
    ".tmx-blob-a {",
    "  width: 72px;",
    "  height: 72px;",
    "  top: 10px;",
    "  left: 10px;",
    "  background: radial-gradient(ellipse at 42% 40%,",
    "    rgba(130,60,255,0.68)  0%,",
    "    rgba(80,20,200,0.50)   45%,",
    "    rgba(40,8,120,0.10)    100%",
    "  );",
    "  filter: blur(16px);",
    "  animation:",
    "    tmx-pulse-a  4.2s ease-in-out infinite,",
    "    tmx-drift-a  9s   ease-in-out infinite,",
    "    tmx-morph-a  8s   ease-in-out infinite;",
    "}",

    /* blob B — magenta / hot pink */
    ".tmx-blob-b {",
    "  width: 60px;",
    "  height: 60px;",
    "  top: 0px;",
    "  left: 26px;",
    "  background: radial-gradient(ellipse at 48% 44%,",
    "    rgba(240,50,180,0.62)  0%,",
    "    rgba(180,20,130,0.42)  48%,",
    "    rgba(100,6,80,0.06)    100%",
    "  );",
    "  filter: blur(20px);",
    "  animation:",
    "    tmx-pulse-b  5s    ease-in-out infinite 1.1s,",
    "    tmx-drift-b  11s   ease-in-out infinite 0.7s,",
    "    tmx-morph-b  10s   ease-in-out infinite 1.2s;",
    "}",

    /* blob C — royal blue / deep violet */
    ".tmx-blob-c {",
    "  width: 64px;",
    "  height: 64px;",
    "  top: 26px;",
    "  left: 0px;",
    "  background: radial-gradient(ellipse at 44% 46%,",
    "    rgba(80,40,220,0.65)   0%,",
    "    rgba(50,10,180,0.44)   50%,",
    "    rgba(20,4,100,0.06)    100%",
    "  );",
    "  filter: blur(18px);",
    "  animation:",
    "    tmx-pulse-c  3.7s  ease-in-out infinite 2.2s,",
    "    tmx-drift-c  13s   ease-in-out infinite 1.8s,",
    "    tmx-morph-c  7s    ease-in-out infinite 2.5s;",
    "}",

    /* ── star field — 4 groups, staggered twinkle ── */
    "@keyframes tmx-twinkle-a {",
    "  0%,100% { opacity: 0.90; } 50% { opacity: 0.18; }",
    "}",
    "@keyframes tmx-twinkle-b {",
    "  0%,100% { opacity: 0.75; } 50% { opacity: 0.12; }",
    "}",
    "@keyframes tmx-twinkle-c {",
    "  0%,100% { opacity: 0.82; } 50% { opacity: 0.22; }",
    "}",
    "@keyframes tmx-twinkle-d {",
    "  0%,100% { opacity: 0.70; } 50% { opacity: 0.08; }",
    "}",

    ".tmx-sg {",
    "  position: absolute;",
    "  top: 0; left: 0;",
    "  width: 1px; height: 1px;",
    "  border-radius: 50%;",
    "  pointer-events: none;",
    "}",

    /* group A — 4 stars, white + gold */
    ".tmx-sg-a {",
    "  background: rgba(255,255,255,0.92);",
    "  box-shadow:",
    "    14px 11px 0 0.5px rgba(255,255,255,0.90),",
    "    54px  7px 0 1.0px rgba(255,235,160,0.82),",
    "    73px 34px 0 0.5px rgba(255,255,255,0.86),",
    "    27px 57px 0 1.0px rgba(255,255,255,0.78);",
    "  animation: tmx-twinkle-a 6s ease-in-out infinite 0s;",
    "}",

    /* group B — 4 stars */
    ".tmx-sg-b {",
    "  background: rgba(255,235,160,0.85);",
    "  box-shadow:",
    "     7px 39px 0 1.0px rgba(255,235,160,0.72),",
    "    43px 21px 0 0.5px rgba(255,255,255,0.88),",
    "    81px 17px 0 0.5px rgba(255,255,255,0.82),",
    "    61px 67px 0 1.0px rgba(255,235,160,0.76);",
    "  animation: tmx-twinkle-b 7s ease-in-out infinite 1.4s;",
    "}",

    /* group C — 5 stars */
    ".tmx-sg-c {",
    "  background: rgba(255,255,255,0.88);",
    "  box-shadow:",
    "    21px 79px 0 0.5px rgba(255,255,255,0.90),",
    "    69px 51px 0 1.0px rgba(255,255,255,0.74),",
    "    37px 41px 0 0.5px rgba(255,235,160,0.82),",
    "    86px 74px 0 0.5px rgba(255,255,255,0.80),",
    "    11px 24px 0 1.0px rgba(255,235,160,0.70);",
    "  animation: tmx-twinkle-c 5.5s ease-in-out infinite 2.8s;",
    "}",

    /* group D — 5 stars */
    ".tmx-sg-d {",
    "  background: rgba(255,255,255,0.80);",
    "  box-shadow:",
    "    49px 77px 0 1.0px rgba(255,255,255,0.84),",
    "    88px 44px 0 0.5px rgba(255,255,255,0.72),",
    "    31px 14px 0 0.5px rgba(255,235,160,0.80),",
    "    66px 87px 0 0.5px rgba(255,255,255,0.68),",
    "    78px 58px 0 1.0px rgba(255,235,160,0.76);",
    "  animation: tmx-twinkle-d 8s ease-in-out infinite 4.2s;",
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
    "  width: 7px;",
    "  height: 44px;",
    "  top: 8px;",
    "  left: 18px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(240,200,80,0.55) 0%,",
    "    rgba(220,170,50,0.28) 40%,",
    "    transparent           100%",
    "  );",
    "  filter: blur(8px);",
    "  animation: tmx-gold-drift-a 11s ease-in-out infinite 0.6s;",
    "}",

    /* streak B — wider slash, lower-right region */
    "#tmx-gold-b {",
    "  position: absolute;",
    "  width: 8px;",
    "  height: 36px;",
    "  top: 44px;",
    "  left: 52px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(255,210,90,0.48) 0%,",
    "    rgba(220,165,45,0.22) 45%,",
    "    transparent           100%",
    "  );",
    "  filter: blur(10px);",
    "  animation: tmx-gold-drift-b 9s ease-in-out infinite 2.3s;",
    "}",

    /* dust C — soft shapeless gold bloom, center-left */
    "#tmx-gold-c {",
    "  position: absolute;",
    "  width: 34px;",
    "  height: 22px;",
    "  top: 34px;",
    "  left: 10px;",
    "  pointer-events: none;",
    "  border-radius: 50%;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(235,195,75,0.32) 0%,",
    "    rgba(210,160,40,0.12) 55%,",
    "    transparent           100%",
    "  );",
    "  filter: blur(13px);",
    "  animation: tmx-gold-drift-c 13s ease-in-out infinite 4.8s;",
    "}"

  ].join("\n");
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement("div");
  root.id = "tmx-presence-root";

  var core = document.createElement("div");
  core.id = "tmx-core";
  root.appendChild(core);

  ["a", "b", "c", "d"].forEach(function (id) {
    var sg = document.createElement("div");
    sg.className = "tmx-sg tmx-sg-" + id;
    root.appendChild(sg);
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
}());

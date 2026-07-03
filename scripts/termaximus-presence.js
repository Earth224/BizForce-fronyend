(function () {
  "use strict";

  if (document.getElementById("tmx-presence-root")) return;

  /* ── Styles ── */
  var style = document.createElement("style");
  style.textContent = [

    /* ── gold core glow ── */
    "@keyframes tmx-core-glow {",
    "  0%,100% { opacity: 0.22; transform: scale(1); }",
    "  50%      { opacity: 0.42; transform: scale(1.28); }",
    "}",

    /* ── pulse: opacity + scale ── */
    "@keyframes tmx-pulse-a {",
    "  0%,100% { opacity: 0.36; transform: scale(1); }",
    "  50%      { opacity: 0.54; transform: scale(1.15); }",
    "}",
    "@keyframes tmx-pulse-b {",
    "  0%,100% { opacity: 0.28; transform: scale(1); }",
    "  50%      { opacity: 0.48; transform: scale(1.20); }",
    "}",
    "@keyframes tmx-pulse-c {",
    "  0%,100% { opacity: 0.24; transform: scale(1); }",
    "  50%      { opacity: 0.44; transform: scale(1.12); }",
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
    "  width: 56px;",
    "  height: 56px;",
    "  overflow: visible;",
    "}",

    /* gold inner light — rendered first so blobs layer over it */
    "#tmx-core {",
    "  position: absolute;",
    "  width: 28px;",
    "  height: 28px;",
    "  top: 14px;",
    "  left: 14px;",
    "  pointer-events: none;",
    "  background: radial-gradient(ellipse at 50% 50%,",
    "    rgba(240,200,90,0.38)  0%,",
    "    rgba(220,168,60,0.18)  35%,",
    "    rgba(200,140,40,0.06)  65%,",
    "    transparent            100%",
    "  );",
    "  filter: blur(7px);",
    "  border-radius: 50%;",
    "  animation: tmx-core-glow 5.5s ease-in-out infinite;",
    "}",

    ".tmx-blob {",
    "  position: absolute;",
    "  pointer-events: auto;",
    "  cursor: default;",
    "}",

    /* blob A — amethyst */
    ".tmx-blob-a {",
    "  width: 44px;",
    "  height: 44px;",
    "  top: 6px;",
    "  left: 6px;",
    "  background: radial-gradient(ellipse at 42% 40%,",
    "    rgba(200,120,255,0.50) 0%,",
    "    rgba(150,60,220,0.32)  50%,",
    "    rgba(90,20,160,0.06)   100%",
    "  );",
    "  filter: blur(10px);",
    "  animation:",
    "    tmx-pulse-a  4.2s ease-in-out infinite,",
    "    tmx-drift-a  9s   ease-in-out infinite,",
    "    tmx-morph-a  8s   ease-in-out infinite;",
    "}",

    /* blob B — magenta */
    ".tmx-blob-b {",
    "  width: 36px;",
    "  height: 36px;",
    "  top: 0px;",
    "  left: 16px;",
    "  background: radial-gradient(ellipse at 48% 44%,",
    "    rgba(255,80,200,0.45) 0%,",
    "    rgba(200,40,160,0.24) 50%,",
    "    rgba(120,10,100,0.04) 100%",
    "  );",
    "  filter: blur(13px);",
    "  animation:",
    "    tmx-pulse-b  5s    ease-in-out infinite 1.1s,",
    "    tmx-drift-b  11s   ease-in-out infinite 0.7s,",
    "    tmx-morph-b  10s   ease-in-out infinite 1.2s;",
    "}",

    /* blob C — violet */
    ".tmx-blob-c {",
    "  width: 38px;",
    "  height: 38px;",
    "  top: 16px;",
    "  left: 0px;",
    "  background: radial-gradient(ellipse at 44% 46%,",
    "    rgba(160,80,255,0.42) 0%,",
    "    rgba(100,40,200,0.22) 50%,",
    "    rgba(60,10,140,0.04)  100%",
    "  );",
    "  filter: blur(12px);",
    "  animation:",
    "    tmx-pulse-c  3.7s  ease-in-out infinite 2.2s,",
    "    tmx-drift-c  13s   ease-in-out infinite 1.8s,",
    "    tmx-morph-c  7s    ease-in-out infinite 2.5s;",
    "}"

  ].join("\n");
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement("div");
  root.id = "tmx-presence-root";

  var core = document.createElement("div");
  core.id = "tmx-core";
  root.appendChild(core);

  ["a", "b", "c"].forEach(function (id) {
    var blob = document.createElement("div");
    blob.className = "tmx-blob tmx-blob-" + id;
    root.appendChild(blob);
  });

  document.body.appendChild(root);
}());

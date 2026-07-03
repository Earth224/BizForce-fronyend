(function () {
  "use strict";

  if (document.getElementById("tmx-presence-root")) return;

  /* ── Styles ── */
  var style = document.createElement("style");
  style.textContent = [
    "@keyframes tmx-breathe {",
    "  0%,100% {",
    "    transform: scale(1);",
    "    box-shadow:",
    "      0 0 14px 4px  rgba(180,80,255,0.45),",
    "      0 0 32px 10px rgba(180,80,255,0.22),",
    "      0 0 56px 18px rgba(120,30,180,0.14);",
    "  }",
    "  50% {",
    "    transform: scale(1.10);",
    "    box-shadow:",
    "      0 0 22px 7px  rgba(220,100,255,0.60),",
    "      0 0 50px 18px rgba(180,60,220,0.32),",
    "      0 0 88px 30px rgba(120,30,180,0.20),",
    "      0 0 12px 3px  rgba(200,168,75,0.30);",
    "  }",
    "}",

    "#tmx-presence-root {",
    "  position: fixed;",
    "  bottom: 28px;",
    "  right: 28px;",
    "  z-index: 2147483647;",
    "  pointer-events: none;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  width: 56px;",
    "  height: 56px;",
    "}",

    "#tmx-orb {",
    "  pointer-events: auto;",
    "  width: 48px;",
    "  height: 48px;",
    "  border-radius: 50%;",
    "  background:",
    "    radial-gradient(circle at 38% 35%,",
    "      rgba(230,190,110,0.90)  0%,",
    "      rgba(200,168,75,0.60)   12%,",
    "      rgba(180,80,255,0.82)   28%,",
    "      rgba(130,30,200,0.90)   52%,",
    "      rgba(60,10,90,0.98)     78%,",
    "      rgba(20,4,36,1)         100%",
    "    );",
    "  box-shadow:",
    "    0 0 14px 4px  rgba(180,80,255,0.45),",
    "    0 0 32px 10px rgba(180,80,255,0.22),",
    "    0 0 56px 18px rgba(120,30,180,0.14);",
    "  animation: tmx-breathe 4s ease-in-out infinite;",
    "  cursor: default;",
    "}"
  ].join("\n");
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement("div");
  root.id = "tmx-presence-root";

  var orb = document.createElement("div");
  orb.id = "tmx-orb";

  root.appendChild(orb);
  document.body.appendChild(root);
}());

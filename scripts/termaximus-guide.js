(function () {
  "use strict";

  if (document.getElementById("tmx-guide-root")) return;

  /* per-page "Page Guidance" text, keyed by the page's filename */
  var PAGE_GUIDANCE = {
    "dashboard.html": "This is your Executive HQ — the control center for every agent, metric, and workflow across your business.",
    "agents-hub.html": "Browse and open any of your AI agents from this hub. Each card leads to that agent's dedicated workspace.",
    "ai-agents.html": "The full agent directory — explore capabilities and assign work across your entire AI team.",
    "analytics-dashboard.html": "Track the performance signals that matter most across your business in one place.",
    "billing.html": "Manage your plan, payment details, and subscription history here.",
    "profile.html": "Review and update your business profile and account details.",
    "integrations.html": "Connect BizForce AI to the other tools and platforms your business already runs on.",
    "marketplace.html": "Discover services, agents, and offers available to your business.",
    "wallet.html": "View balances, transactions, and payouts tied to your BizForce account.",
    "certifications.html": "Track credentials and certifications earned by your business and its agents.",
    "digital-cards.html": "Create and manage the digital business cards representing your brand.",
    "business-id.html": "Manage the verified identity record for your business.",
    "business-chat.html": "Message your team and agents directly from this workspace.",
    "card-view.html": "View and share your business card details.",
    "flyer-generator.html": "Generate marketing flyers for your business in a few clicks.",
    "app.html": "Sign in or create an account to enter BizForce AI."
  };

  var DEFAULT_GUIDANCE = "Explore this page — Termaximus will surface guidance here as it learns the terrain.";

  function currentPageKey() {
    var path = window.location.pathname || "";
    var file = path.split("/").pop();
    if (!file) file = "index.html";
    return file.toLowerCase();
  }

  /* ── styles ── */
  var style = document.createElement("style");
  style.textContent = [

    "#tmx-guide-root {",
    "  position: fixed;",
    "  top: 50%;",
    "  left: 0;",
    "  transform: translateY(-50%);",
    "  z-index: 999990;",
    "  display: flex;",
    "  align-items: stretch;",
    "  pointer-events: none;",
    "}",

    "#tmx-guide-tab {",
    "  position: relative;",
    "  width: 32px;",
    "  min-height: 170px;",
    "  border: 1px solid rgba(168, 85, 247, 0.28);",
    "  border-left: none;",
    "  border-radius: 0 14px 14px 0;",
    "  background: rgba(12, 18, 38, 0.78);",
    "  backdrop-filter: blur(14px);",
    "  -webkit-backdrop-filter: blur(14px);",
    "  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 20px rgba(0, 229, 255, 0.08);",
    "  cursor: pointer;",
    "  pointer-events: auto;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  padding: 14px 0;",
    "  transition: box-shadow 0.25s ease, border-color 0.25s ease;",
    "  font-family: system-ui, -apple-system, \"Segoe UI\", Arial, sans-serif;",
    "}",
    "#tmx-guide-tab:hover {",
    "  border-color: rgba(168, 85, 247, 0.55);",
    "  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 26px rgba(0, 229, 255, 0.16);",
    "}",
    "#tmx-guide-tab-text {",
    "  writing-mode: vertical-rl;",
    "  transform: rotate(180deg);",
    "  font-size: 0.72rem;",
    "  font-weight: 800;",
    "  letter-spacing: 0.16em;",
    "  text-transform: uppercase;",
    "  background: linear-gradient(180deg, #22d3ee, #a855f7);",
    "  -webkit-background-clip: text;",
    "  background-clip: text;",
    "  color: transparent;",
    "  white-space: nowrap;",
    "}",

    "#tmx-guide-panel {",
    "  width: 300px;",
    "  max-height: 70vh;",
    "  overflow-y: auto;",
    "  margin-left: -1px;",
    "  border-radius: 0 20px 20px 0;",
    "  background: rgba(12, 18, 38, 0.9);",
    "  border: 1px solid rgba(168, 85, 247, 0.28);",
    "  border-left: none;",
    "  backdrop-filter: blur(18px);",
    "  -webkit-backdrop-filter: blur(18px);",
    "  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 229, 255, 0.08);",
    "  opacity: 0;",
    "  transform: translateX(-16px);",
    "  pointer-events: none;",
    "  transition: opacity 0.3s ease, transform 0.3s ease;",
    "  font-family: system-ui, -apple-system, \"Segoe UI\", Arial, sans-serif;",
    "  color: #e8e8ff;",
    "}",
    "#tmx-guide-root.tmx-guide-open #tmx-guide-panel {",
    "  opacity: 1;",
    "  transform: translateX(0);",
    "  pointer-events: auto;",
    "}",

    "#tmx-guide-panel .tmx-guide-header {",
    "  padding: 18px 20px 16px;",
    "  text-align: center;",
    "  background: rgba(8, 12, 28, 0.6);",
    "  border-bottom: 1px solid rgba(255, 255, 255, 0.08);",
    "}",
    "#tmx-guide-panel .tmx-guide-header-text {",
    "  font-size: 0.82rem;",
    "  font-weight: 800;",
    "  letter-spacing: 0.16em;",
    "  text-transform: uppercase;",
    "  background: linear-gradient(90deg, #22d3ee, #a855f7);",
    "  -webkit-background-clip: text;",
    "  background-clip: text;",
    "  color: transparent;",
    "}",
    "#tmx-guide-panel .tmx-guide-section {",
    "  padding: 20px;",
    "}",
    "#tmx-guide-panel .tmx-guide-section + .tmx-guide-section {",
    "  border-top: 1px solid rgba(255, 255, 255, 0.08);",
    "}",
    "#tmx-guide-panel .tmx-guide-label {",
    "  margin: 0 0 10px;",
    "  font-size: 0.7rem;",
    "  font-weight: 700;",
    "  letter-spacing: 0.12em;",
    "  text-transform: uppercase;",
    "  color: #22d3ee;",
    "}",
    "#tmx-guide-panel .tmx-guide-section--insights .tmx-guide-label {",
    "  color: #c4b5fd;",
    "}",
    "#tmx-guide-panel .tmx-guide-placeholder {",
    "  margin: 0;",
    "  font-size: 0.85rem;",
    "  line-height: 1.6;",
    "  color: #8888aa;",
    "}",

    "@media (max-width: 860px) {",
    "  #tmx-guide-root { display: none; }",
    "}"

  ].join("\n");
  document.head.appendChild(style);

  /* ── DOM ── */
  var root = document.createElement("div");
  root.id = "tmx-guide-root";

  var tab = document.createElement("button");
  tab.type = "button";
  tab.id = "tmx-guide-tab";
  tab.setAttribute("aria-expanded", "false");
  tab.setAttribute("aria-controls", "tmx-guide-panel");
  tab.setAttribute("aria-label", "Open Termaximus Guide");
  tab.innerHTML = '<span id="tmx-guide-tab-text">Termaximus Guide</span>';

  var panel = document.createElement("aside");
  panel.id = "tmx-guide-panel";
  panel.setAttribute("aria-label", "Termaximus Guide");

  var guidanceText = PAGE_GUIDANCE[currentPageKey()] || DEFAULT_GUIDANCE;

  panel.innerHTML =
    '<div class="tmx-guide-header">' +
      '<span class="tmx-guide-header-text">Termaximus Guide</span>' +
    '</div>' +
    '<div class="tmx-guide-section">' +
      '<h3 class="tmx-guide-label">Page Guidance</h3>' +
      '<p class="tmx-guide-placeholder">' + guidanceText + '</p>' +
    '</div>' +
    '<div class="tmx-guide-section tmx-guide-section--insights">' +
      '<h3 class="tmx-guide-label">Termaximus Insights</h3>' +
      '<p class="tmx-guide-placeholder">Placeholder — Termaximus&rsquo;s insights will appear here.</p>' +
    '</div>';

  root.appendChild(tab);
  root.appendChild(panel);
  document.body.appendChild(root);

  var isOpen = false;

  function setOpen(next) {
    isOpen = next;
    root.classList.toggle("tmx-guide-open", isOpen);
    tab.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }

  tab.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(!isOpen);
  });

  document.addEventListener("click", function (e) {
    if (isOpen && !root.contains(e.target)) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (isOpen && e.key === "Escape") setOpen(false);
  });

}());

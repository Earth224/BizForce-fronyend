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
    "app.html": "Sign in or create an account to enter BizForce AI.",

    "seo.html": [
      "This agent turns your business profile and executive memory into concrete SEO deliverables — audits, keyword research, rankings, and forecasts.",
      "Feed it real data: set your Website and top Competitors in your Business Profile (edit it from the Content Agent) so audits and keyword research aren't guessing in the dark.",
      "Use the launcher's specific task types — SEO Audit, Keyword Research, Competitor Analysis, Local SEO Plan — rather than vague prompts; narrower asks produce sharper deliverables.",
      "Refresh Data after each run to pull the latest report into Website Audits, Keyword Research, and Opportunities.",
      "Treat Executive Reports and Recommendations as your standing SEO playbook, not one-off outputs."
    ],
    "sales.html": [
      "This agent builds pipeline and revenue intelligence — funnels, lead generation, outreach scripts, offers, and objection handling — from your business data.",
      "Keep your Business Profile current (Industry, Website, Competitors); it shapes leads and pipeline recommendations that actually fit your market.",
      "Run Lead Generation and Sales Funnel first to set a baseline, then use Objection Handling and Offer Builder to sharpen conversion.",
      "Watch the Pipeline and Opportunities panels — that's where I flag where deals are stalling.",
      "Re-run tasks as your offers evolve; stale pipeline data leads to stale advice."
    ],
    "content.html": [
      "The most feature-dense agent — it generates articles, social drafts, video scripts, SMS campaigns, and full content strategy, then lets you approve and schedule what it creates.",
      "Start here: this is the only agent page with a real Edit Profile form. Fill in Business Name, Industry, Brand Voice, Brand Values, Target Audience, Goals, Banned Topics, and Posting Frequency — every other agent reads what you set here.",
      "Use Generate SEO Article and Generate SMS Campaign for quick wins, then run Social Media Drafts and approve or reject each post in the Approval Queue before it goes live.",
      "Connect your social accounts (Instagram, Facebook, TikTok, YouTube, LinkedIn, X) directly on this page so approved content has somewhere to go.",
      "Keep the Content Library tidy — expand, copy, or delete drafts so your queue stays a working set, not a graveyard."
    ],
    "social.html": [
      "This agent is a strategic planning layer for your social presence — campaigns, content pillars, engagement strategy, platform playbooks, and audience growth plans.",
      "It reads the same Business Profile as everything else — set Brand Voice, Target Audience, and Business Goals via the Content Agent's Edit Profile so its playbooks actually sound like you.",
      "Use Content Calendar and Platform Playbook to plan, then hand execution — drafting and scheduling posts — to the Content Agent, where the Approval Queue and account connections live.",
      "Run Audience Growth Plan periodically; growth tactics that worked last quarter rarely hold up untouched."
    ],
    "analytics.html": [
      "This is your KPI and forecasting layer — insights, revenue forecasts, and Warnings that flag risk before it becomes a problem.",
      "Accuracy depends on your Business Profile staying current (Industry, Website, Competitors) — thin profile data means thin forecasts.",
      "Don't skip the Warnings panel — it's the one section unique to this agent, built to catch anomalies early, not just report what already happened.",
      "Run KPI Review and Revenue Forecast on a schedule, not just once, so trend lines actually mean something.",
      "Refresh Data before big decisions so the Executive Reports you're reading reflect current numbers."
    ],
    "email-agent.html": [
      "This agent builds campaigns, sequences, and win-back/nurture flows, with a specific eye on deliverability, not just copy.",
      "It draws on your shared Business Profile — Website and Brand Voice matter most here, since email tone should match how you actually talk to customers.",
      "Run Subject Line Testing before committing to a full campaign; deliverability lives and dies in the subject line.",
      "Pair Nurture Campaign with Winback Flow to cover new leads and lapsed customers, not just one end of the funnel.",
      "Check Sequences and Insights after each send to see what's actually landing."
    ],
    "store-agent.html": [
      "This agent manages multi-store commerce intelligence — inventory, product performance, and omnichannel strategy across every channel you sell on.",
      "Keep Competitors and Industry current in your Business Profile; Store Audit and Conversion Audit compare you against that context.",
      "Run Omnichannel Strategy if you sell on more than one channel — this agent's edge is coordinating across stores, not optimizing just one.",
      "Use Inventory Plan and Product Launch Plan together when introducing new SKUs so stocking and go-to-market line up.",
      "Revisit the Analytics report section regularly — it's where channel performance gaps show up first."
    ],
    "etsy-agent.html": [
      "This agent is an Etsy specialist — listing optimization, keyword research, pricing strategy, and competitor analysis built for the marketplace's own rules.",
      "Set your Shop Goals — the one field unique to this agent, and it shapes every recommendation it makes for your shop.",
      "Run Keyword Research and Listing Optimization together; Etsy ranks on both, and treating them separately leaves value on the table.",
      "Use Pricing Strategy alongside Competitor Analysis so your prices are set relative to who you're actually up against, not in a vacuum.",
      "Revisit Shop Audit periodically — Etsy's algorithm shifts, and last quarter's optimization can quietly go stale."
    ],
    "broker-agent.html": [
      "This agent manages deal flow and partnerships — pipeline tracking, negotiation prep, and the actual documents brokers need to close.",
      "Keep your Business Profile's Industry and Competitors accurate; Due Diligence Checklists and Term Sheet Drafts are only as sharp as the context behind them.",
      "Use Due Diligence Checklist and Term Sheet Draft when a deal is close to closing — this agent is built to produce real execution documents, not just strategy talk.",
      "Run Negotiation Brief before any high-stakes conversation; walk in with the leverage points already mapped.",
      "Track the Pipeline report section as your single source of truth for where every deal actually stands."
    ],
    "publicist-agent.html": [
      "This agent drafts the concrete artifacts a publicist needs — press releases, media pitches, and brand narrative — to earn coverage and visibility.",
      "Brand Voice and Business Goals from your Business Profile matter most here; your narrative should sound like you, not a generic press template.",
      "Start with Brand Narrative before writing a single Press Release — a clear narrative makes every pitch afterward land faster.",
      "Use Media Pitch for targeted outreach and Press Release for broader announcements; they're different tools for different moments.",
      "Track Coverage and Media Outreach reports to see which angles are actually earning attention."
    ],
    "reputation-agent.html": [
      "This agent watches reviews, sentiment, and mentions, and flags Risks early — built as much for recovery as for monitoring.",
      "Keep Competitors and Industry current; sentiment and risk context are read relative to where you sit in your market.",
      "Don't wait for a crisis to try Crisis Response — run it once proactively so you know what the plan looks like before you need it.",
      "Use Review Strategy and Brand Trust Plan together to turn monitoring into an actual action plan, not just a dashboard of scores.",
      "Check the Risks panel regularly; it's this agent's early-warning system, not an afterthought."
    ],
    "community-agent.html": [
      "This agent focuses on community health — engagement, growth, and the referral/retention systems that keep members coming back.",
      "Keep Business Goals and Target Audience current in your profile; they shape what \"healthy engagement\" even looks like for your specific community.",
      "Run Referral Loop and Retention System together — growth without retention just refills a leaky bucket.",
      "Use Moderation Plan proactively, before community size makes moderation reactive and painful.",
      "Watch the Engagement and Growth Plans sections to see which tactics are actually compounding."
    ],
    "influencer-agent.html": [
      "This agent manages creator partnerships end to end — outreach, campaign planning, and forecasting ROI before you commit budget.",
      "Set Target Audience and Business Goals in your profile before running Creator List; they guide which creators actually make sense.",
      "Run ROI Forecast before locking in a Partnership Offer — know the expected return before you negotiate terms.",
      "Check Trending Creators regularly; the influencer landscape shifts fast, and last month's list ages quickly.",
      "Use Influencer Outreach and Campaign Plan together so outreach messaging and campaign goals stay aligned."
    ],
    "operations-agent.html": [
      "This agent turns operations into concrete artifacts — SOP Documents, checklists, and automation plans, not just advice.",
      "Keep your Business Profile's Industry and Description accurate; SOPs and Efficiency Audits are shaped by the kind of business you actually run.",
      "Use Efficiency Audit first to find the bottleneck, then generate the specific SOP Document or Checklist Builder output to fix it.",
      "Sequence your requests — document a workflow before you automate it; Automation Plan works best once a process is already written down.",
      "Revisit SOPs periodically as your team grows; a process built for 3 people rarely survives at 10 unchanged."
    ],
    "rd-agent.html": [
      "This is the most analytical agent — market research, competitive intelligence, and innovation opportunities scored with real confidence and feasibility metrics.",
      "Set your Market Goals and Research Goals directly; I read them alongside your Business Profile to decide what's actually worth researching.",
      "Run Market Research and Competitive Intelligence together — differentiation scores mean more when you know both your market and your competitors.",
      "Use Innovation Brief to screen ideas by feasibility and impact before you invest real time in them.",
      "Build Executive Briefing last — it's designed to summarize everything else into something you can hand to a stakeholder."
    ]
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
    "#tmx-guide-panel .tmx-guide-list {",
    "  margin: 0;",
    "  padding-left: 18px;",
    "  font-size: 0.85rem;",
    "  line-height: 1.6;",
    "  color: #8888aa;",
    "}",
    "#tmx-guide-panel .tmx-guide-list li {",
    "  margin-bottom: 8px;",
    "}",
    "#tmx-guide-panel .tmx-guide-list li:last-child {",
    "  margin-bottom: 0;",
    "}",
    "#tmx-guide-panel .tmx-guide-list li::marker {",
    "  color: #22d3ee;",
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

  function renderGuidance(value) {
    if (Array.isArray(value)) {
      return '<ul class="tmx-guide-list">' +
        value.map(function (point) { return '<li>' + point + '</li>'; }).join('') +
        '</ul>';
    }
    return '<p class="tmx-guide-placeholder">' + value + '</p>';
  }

  var guidanceText = PAGE_GUIDANCE[currentPageKey()] || DEFAULT_GUIDANCE;

  panel.innerHTML =
    '<div class="tmx-guide-header">' +
      '<span class="tmx-guide-header-text">Termaximus Guide</span>' +
    '</div>' +
    '<div class="tmx-guide-section">' +
      '<h3 class="tmx-guide-label">Page Guidance</h3>' +
      renderGuidance(guidanceText) +
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

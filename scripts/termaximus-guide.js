(function () {
  "use strict";

  /* suppress entirely on the login page or when logged out */
  try {
    var _tmxPath  = (window.location.pathname || "").toLowerCase();
    var _tmxLogin = _tmxPath === "/" || _tmxPath === "" || /(^|\/)app\.html$/.test(_tmxPath);
    if (_tmxLogin || !localStorage.getItem("bf_token")) return;
  } catch (e) {}

  if (document.getElementById("tmx-guide-root")) return;

  /* per-page "Page Guidance" text, keyed by the page's filename */
  var PAGE_GUIDANCE = {
    "dashboard.html": [
      "This is your Executive HQ — the single hub linking every agent, tool, and workflow: Analytics, Integrations, Business Chat, Certifications, BFC Wallet, Marketplace, Business Identity, Digital Cards, Profile, and Lead Radar.",
      "Your business name, industry and goal shown here come from your Business Profile — edit it here under Expand Profile or on the Content Agent's Edit Profile, and keep it current so this hub reflects who you actually are.",
      "Use the Active Queue card and its View Queue button to see your active assignments before you dig into any single tool.",
      "Treat the AI Agent Directory preview as your starting point for delegating work — Agent Hub and Full Directory each list all 18 agents.",
      "Revisit this page often; it's built to surface what needs your attention, not just to look impressive."
    ],
    "agents-hub.html": [
      "Browse and launch any of your AI agents from one place — each card opens that agent's dedicated workspace.",
      "The agents themselves pull from your Business Profile (set via the Content Agent), so get that right before expecting sharp output from any card here.",
      "Don't run every agent at once — open the ones tied to your current priority and check back after each finishes a task.",
      "Use this as your map, not your workbench; the real work — task launching, reports, history — happens on each agent's own page."
    ],
    "ai-agents.html": [
      "The full directory of all 18 AI agents — each card shows the agent's name and an Open Agent button to its own page.",
      "No setup happens here — it's pure navigation; your Business Profile (set via the Content Agent) is what every agent behind these cards reads from.",
      "Use this page when you're not sure where an agent lives — find it by name and press Open Agent to see what it does on its own page.",
      "Bookmark the agents you use most; with 18 to choose from, a shortlist beats browsing the full list every time."
    ],
    "analytics-dashboard.html": [
      "Your business intelligence command center, read once when the page opens — Tasks Run, Tasks Completed, Content Items, SMS Subscribers, Opted-In, and SMS Campaigns, plus a Content Breakdown chart and a Tasks by Agent chart.",
      "Nothing to configure here — it's a read-only summary, read once when the page opens (reload for fresh numbers); the numbers only get interesting once you're actually running agents and generating content elsewhere.",
      "Check the Tasks by Agent chart to see which agents you're actually leaning on — it's a fast way to spot which parts of your AI team are underused.",
      "If a tile shows 0, there's nothing of that kind on your account yet — go run some agent tasks first, then come back. A \"—\" means the figure is still loading or could not be read; reload the page."
    ],
    "billing.html": [
      "Manage your subscription and payment details — there is one plan, All Access at $199/month, shown here with its current status, renewal date, and the full \"All Access Plan Includes\" feature list.",
      "Nothing to fill in directly here — subscribing or updating payment happens through Stripe's own checkout and billing portal, launched from this page's buttons.",
      "Watch for the cancellation warning banner — if it's showing, your access has an end date, and you'll want to resubscribe before it hits.",
      "Use \"Manage / Cancel Subscription\" to update your payment method or cancel; you don't need to contact anyone, and there are no tiers to move between."
    ],
    "profile.html": [
      "Your public business profile and portfolio — bio, skills, products, portfolio pieces, videos, music, and a shareable digital card, all in one branded page.",
      "Fill in About (bio, industry, skills) first, then add Products, Portfolio pieces, Videos, and Music through their own \"Add\" modals — each has its own required fields.",
      "Use the Customize panel to set your accent color, font, and which sections are visible — a focused profile beats a cluttered one.",
      "Once it's built, use Share or Copy Profile Link to actually put it in front of people; a great profile does nothing sitting unshared.",
      "Keep Products and Portfolio current — stale entries undercut the credibility this page is built to establish."
    ],
    "integrations.html": [
      "Thirteen services and what each one is to BizForce today: \"Unavailable\", \"Runs on BizForce\", or \"Not built\".",
      "\"Unavailable\" means connecting was built and is turned off for now — that is the six social platforms.",
      "\"Runs on BizForce\" means the app uses the service with its own account — Stripe, Twilio, Zernio and email — so there is nothing for you to connect.",
      "There is no setup to do on this page; nothing here takes an account of yours."
    ],
    "marketplace.html": [
      "A peer-to-peer service marketplace — browse other members' listings by category, or list your own services for BFC.",
      "To sell, use \"List a Service\" and fill in Title, Description, Category, Price in BFC, and optional Tags — a complete listing gets found faster than a bare one.",
      "Check \"My Listings\" regularly — each of your listings shows its status there, with Edit and Delete buttons; a listing left stale looks abandoned.",
      "Use the category tabs and search before creating a duplicate service someone else already offers well."
    ],
    "wallet.html": [
      "Your BFC Wallet — Available Balance, Total Earned, Total Spent, and Transaction History for your BizForce Credits. The history shows your latest 50 transactions, and Total Earned and Total Spent are added up from those 50.",
      "Nothing to configure — the one action here is Send BFC, which sends credits to another member by their user ID; using the platform earns nothing by itself.",
      "Check \"How to Earn BFC\" — your first pass of each certification pays 100 BFC while you're subscribed, and a one-time 1,000 BFC welcome bonus lands when your subscription goes active. Running agent tasks and posting listings pay nothing.",
      "Your BFC balance reflects certifications passed, the welcome bonus, and what you've sent, received and spent — not how much you use the platform."
    ],
    "certifications.html": [
      "Earn real, quiz-based platform badges across Sales, Marketing, Analytics, and Leadership — 12 certifications across 3 difficulty tiers, each with 10 questions and an 80% pass threshold.",
      "Nothing to configure — just pick a certification and start; there's no profile data required to take an assessment.",
      "Start with Beginner-tier certs in the category closest to your actual work before attempting Advanced ones — the questions get genuinely harder.",
      "Your first pass of each certification pays 100 BFC to your Wallet while you're subscribed, so treat certifications as a way to both sharpen skills and build balance, not just collect badges.",
      "If you don't pass the first time, press Try Again on the result screen, or Start Assessment on the card later — there's no penalty for trying again."
    ],
    "digital-cards.html": [
      "A full multimedia digital business card studio — video pitch, background audio, dozens of fonts/textures/borders, holographic effects, and free-position text, all shown in the card preview.",
      "Fill in Full Name, Job Title, Tagline, Company, Email, Phone, and Website first, then layer on media (background image, video pitch, audio track) and styling.",
      "Use Save Card and Share to generate a public link (viewable via the card viewer page) — the card only earns its keep once it's actually being shared.",
      "Don't over-stack effects; pick one Theme, one Border Style, and one Transition, or the card reads busy instead of premium.",
      "Export Print File with bleed guides if you're printing physical cards, not just Download PNG for digital use."
    ],
    "business-id.html": [
      "Builds your official Business ID Card — an identity card with your name, industry, bio, and contact details, redrawn each time you save, plus a \"BizForce AI Member\" badge.",
      "Fill in Business Name, Industry, Tagline/Bio, Website, Phone, Location, and Contact Email — every field maps directly onto the card preview above the form.",
      "Write the bio like a real pitch, not a placeholder — it's the one line that renders as an italicized quote on the card itself.",
      "Keep this current alongside your Content Agent business profile; the card is drawn only on this page, for you — nothing on the platform shows it to other members."
    ],
    "business-chat.html": [
      "A persistent, business-aware AI chat — ask it anything about your business; every message is saved in one continuous conversation, and each answer is written from the last 20 messages of it.",
      "Nothing to configure here directly, but the more complete your Business Profile is elsewhere, the more specific and useful its answers will be.",
      "Use it for quick strategic questions between agent tasks — it's built for conversation, not for generating deliverables the way the agents do.",
      "There is one thread, not a list of past threads; your whole history is saved and shown here, but answers draw only on the last 20 messages, so restate older context when it matters."
    ],
    "card-view.html": [
      "The public, read-only viewer for a shared digital business card — opened through its shared ?token= link, not something you edit here; the card's QR codes hold a vCard contact, not a link to this page.",
      "There's nothing to set up on this page; the card was designed elsewhere (Digital Cards) and this page just renders it for whoever receives the link.",
      "If you're viewing someone else's card, use Save Contact to pull it straight into your contacts as a vCard.",
      "If this page renders one of your own cards and it looks wrong, the fix happens back on Digital Cards, not here."
    ],

    "seo.html": [
      "This agent turns your business profile into concrete SEO deliverables — keyword research, content plans, local SEO plans, and page audits.",
      "Feed it real data: set your Website and top Competitors in your Business Profile (edit it from the Content Agent) so audits and keyword research aren't guessing in the dark.",
      "Use the launcher's specific task types — Keyword Research, Competitor Comparison, Local SEO Plan — and the Page Audit tool rather than vague prompts; narrower asks produce sharper deliverables.",
      "Each run is saved — open your latest from the Last run link on this page; Refresh Data updates that link and your Business Profile after a new run.",
      "Treat your saved runs as your standing SEO playbook, not one-off outputs."
    ],
    "sales.html": [
      "This agent writes sales material — funnels, lead generation, outreach scripts, offers, and objection handling — from your Business Profile and what you tell it; its tasks read none of the leads or pipeline on this page.",
      "Keep your Business Profile current (Industry, Website, Competitors); it shapes what Lead Generation and the other sales tasks write for your market. The leads and pipeline on this page come from Lead Radar, which does not read your profile.",
      "Run Lead Generation and Sales Funnel first to set a baseline, then use Objection Handling and Offer Builder to sharpen conversion.",
      "Use the Sales Pipeline panel to see each lead's stage — New, Drafted, Contacted, Replied, Converted — and move it along; nothing here judges which deals are stalling, so check the older ones yourself.",
      "Re-run tasks as your offers evolve; a task's prompt carries no pipeline data, so say in your request what has changed in your deals."
    ],
    "content.html": [
      "The most feature-dense agent — it generates articles, social drafts, video scripts, SMS campaigns, and full content strategy, then lets you approve or reject the social drafts it creates; approved drafts are saved, not published or scheduled.",
      "Start here: this is the only agent page with a real Edit Profile form. Fill in Business Name, Industry, Brand Voice, Brand Values, Target Audience, Goals, Banned Topics, and Posting Frequency — every other agent reads what you set here.",
      "Use Generate SEO Article and Generate SMS Campaign for quick wins, then run Social Media Drafts and approve or reject each post; with publishing to social accounts turned off, approving saves it to the Approval Queue as an unpublished draft.",
      "Social accounts (Instagram, Facebook, TikTok, YouTube, LinkedIn, X) cannot be connected on this platform at present, so approved drafts stay saved here for you to post yourself.",
      "Keep the Content Library tidy — expand, copy, or delete its saved articles and SMS campaigns so it stays a working set, not a graveyard; social drafts are not in the library."
    ],
    "social.html": [
      "This agent is a strategic planning layer for your social presence — campaigns, content calendars, engagement strategy, platform playbooks, and audience growth plans.",
      "It reads the same Business Profile as everything else — set Brand Voice, Target Audience, and Business Goals via the Content Agent's Edit Profile so its playbooks actually sound like you.",
      "Use Content Calendar and Platform Playbook to plan, then hand drafting to the Content Agent, where Social Media Drafts and the Approval Queue are; posts cannot be scheduled and social accounts cannot be connected at present.",
      "Run Audience Growth Plan periodically; growth tactics that worked last quarter rarely hold up untouched."
    ],
    "analytics.html": [
      "This is your KPI and forecasting layer — KPI Review and Funnel Analysis measure the figures you enter, and Revenue Forecast builds a forecasting method for you to fill in; it reads no revenue data of its own.",
      "Your Business Profile (Industry, Website, Competitors) is the context every analytics task is written from, so keep it current; the figures in KPI Review and Funnel Analysis come only from what you enter.",
      "Arrivals Ledger counts, in code with no model call, the arrivals through your own tracked links: a published post whose money link carries its ref, and a Lead Radar reply you sent. It shows each post's arrivals all-time and by week; an arrival is one landing-page request, not a person, so it cannot be told apart from your own test click, and it does not measure Bluesky reach, article views or sales.",
      "Each run is saved — open your latest from the Last run link on this page; nothing here checks your figures for anomalies, so compare each run with the last yourself.",
      "Run the KPI Review tool each period, not just once — enter each metric's Now and Before figures and it works out the change; nothing here keeps a trend line across runs, so compare saved runs yourself.",
      "Enter current figures in KPI Review and Funnel Analysis before big decisions; they measure only the numbers you enter."
    ],
    "lead-radar.html": [
      "This is a Bluesky lead-capture radar — it collects buying-intent posts every 5 minutes; when intent scoring is switched on, it scores them and separates real buyers from competitors by suggested product and score. The list loads when you open the page and when you press Refresh.",
      "It searches a fixed set of buyer-intent phrases on Bluesky, set in the radar's own code; Mastodon and YouTube searches run only when switched on, and YouTube finds are not shown here. It does not read your Business Profile, so editing your profile does not change what it finds.",
      "The list puts the highest scores at the top, so act on High-Intent leads (60+) first — use Draft Engagement to generate a ready-to-send reply, then Copy it to your clipboard and post it on Bluesky yourself.",
      "Check the Product Breakdown chart to see how many leads were tagged with each product, and Score Distribution to see how their scores spread — Product Breakdown counts leads, it does not measure intent.",
      "Refresh regularly and use Show Noise sparingly — sub-15 scores are hidden by default for good reason; only surface them once your high-intent queue runs dry."
    ],
    "email-agent.html": [
      "This agent builds campaigns, sequences, win-back/nurture flows, and subject line variations — it writes the copy and reads no delivery data.",
      "It draws on your shared Business Profile — Website and Brand Voice matter most here, since email tone should match how you actually talk to customers.",
      "Run Subject Line Testing before committing to a full campaign; it writes subject line variations and notes which to A/B test first, and the test itself runs in your own email platform.",
      "Pair Nurture Campaign with Winback Flow to cover new leads and lapsed customers, not just one end of the funnel.",
      "Each run is saved — open your latest from the Last run link on this page; nothing here measures opens, clicks or delivery, so judge what lands from your email platform's own reports."
    ],
    "store-agent.html": [
      "This agent writes commerce plans — store audits, inventory plans, omnichannel strategy, conversion audits, and product launch plans — from your Business Profile and what you tell it; it connects to no store or channel.",
      "Keep Competitors and Industry current in your Business Profile; Store Audit and Conversion Audit are written from that context, not from your store's own data.",
      "Run Omnichannel Strategy if you sell on more than one channel — it plans your channel mix, inventory sync approach, and a consistent customer experience; it does not connect to or run any store.",
      "Use Inventory Plan and Product Launch Plan together when introducing new SKUs so stocking and go-to-market line up.",
      "Stock & Margin counts what you entered on your inventory page, in code, with no model call: stock value at cost and at price, unit margins, items at or below their reorder point, and days of cover once an item has 3 'out' movements in the window. A cost, price or reorder point you never entered is left out and counted, not taken as 0.",
      "Each run is saved — open your latest from the Last run link on this page; this agent reads no sales, traffic or channel data, so find performance gaps in your own store's reports."
    ],
    "etsy-agent.html": [
      "This agent writes listing copy and keyword candidates for your online store or marketplace, and does pricing arithmetic on figures you type in. It reads no store, marketplace or search data.",
      "Keyword Research: enter your platform's tags per listing and characters per tag to have each candidate measured against them. Leave them blank and nothing is measured against a limit.",
      "Pricing Strategy works out the range, median and your margin from the comparable listings you type in, then writes a rationale. Nothing is fetched or checked.",
      "Listing Optimization gives you copy to adapt, and Shop Audit Checklist gives you a list to work through on your own shop; neither looks at the shop itself.",
      "Competitor Comparison works from the competitors in your Business Profile, so keep that list current, and treat any figure it gives as unverified."
    ],
    "broker-agent.html": [
      "This agent helps with deal flow and partnerships — Deal Pipeline analysis, negotiation prep, and the actual documents brokers need to close.",
      "Keep your Business Profile's Industry and Competitors accurate; Due Diligence Checklists and Term Sheet Drafts are only as sharp as the context behind them.",
      "Use Due Diligence Checklist and Term Sheet Draft when a deal is close to closing — they give you a checklist and a framework to take to a lawyer, not execution documents; the Term Sheet Framework tool says so itself.",
      "Run Negotiation Brief before any high-stakes conversation; walk in with the leverage points already mapped.",
      "Each run is saved — open your latest from the Last run link on this page; the agent keeps no record of where your deals stand, so keep that yourself."
    ],
    "publicist-agent.html": [
      "This agent drafts the concrete artifacts a publicist needs — press releases, media pitches, and brand narrative — to earn coverage and visibility.",
      "Brand Voice and Business Goals from your Business Profile matter most here; your narrative should sound like you, not a generic press template.",
      "Start with Brand Narrative before writing a single Press Release — a clear narrative makes every pitch afterward land faster.",
      "Use Media Pitch for targeted outreach and Press Release for broader announcements; they're different tools for different moments.",
      "Each run is saved — open your latest from the Last run link on this page; nothing here measures coverage, so note for yourself which angles earn attention."
    ],
    "reputation-agent.html": [
      "This agent does not watch or monitor mentions, reviews or sentiment anywhere. It works only from what you paste in or type, and from your Business Profile.",
      "Review Response drafts a reply to a review you paste in, and flags any phrasing that argues with or blames the reviewer before you post it.",
      "Review Request builds a request sequence for a moment you choose, and flags incentive wording that breaks review-platform rules.",
      "Reputation Audit and Sentiment Report give you the checklist and the scoring framework to fill in yourself; they read no review site and give no measured score.",
      "Review Strategy, Brand Trust Plan and Crisis Response write plans from your request and Business Profile. Run Crisis Response once before you need it, so the plan is ready."
    ],
    "community-agent.html": [
      "This agent focuses on community health — engagement, growth, and the referral/retention systems that keep members coming back.",
      "Keep Business Goals and Target Audience current in your profile; they shape what \"healthy engagement\" even looks like for your specific community.",
      "Run Referral Loop and Retention System together — growth without retention just refills a leaky bucket.",
      "Use Moderation Plan proactively, before community size makes moderation reactive and painful.",
      "Audience Ledger counts your own sign-up records for each brand, in code, with no model call: contacts, captures with email and SMS consent, new captures by month, SMS subscribers by consent status and email sequence enrollments. It shows counts only, never a person, and a table it could not read is shown as not measured, never as 0.",
      "Each run is saved — open your latest from the Last run link on this page; nothing here measures engagement, and Audience Ledger counts sign-ups rather than activity, so judge which tactics compound from your own community's numbers."
    ],
    "influencer-agent.html": [
      "This agent drafts the work of creator partnerships — outreach, campaign plans, partnership offers, and an ROI model to fill in before you commit budget.",
      "Set Target Audience and Business Goals in your profile before running Creator List; they guide which creators actually make sense.",
      "Run ROI Forecast before locking in a Partnership Offer — it builds the return model and break-even from figures you supply, so you negotiate with your own numbers worked out.",
      "Re-run Creator List when your audience or goals change; it describes the kinds of creators to look for and how to score their fit, and it looks up no named or trending creators.",
      "Use Influencer Outreach and Campaign Plan together so outreach messaging and campaign goals stay aligned."
    ],
    "operations-agent.html": [
      "This agent turns operations into concrete artifacts — SOP Documents, checklists, and automation plans, not just advice.",
      "Keep your Business Profile's Industry and Description accurate; SOP Documents and Efficiency Audits are shaped by the kind of business you actually run.",
      "Use Efficiency Audit first to find the bottleneck, then generate the specific SOP Document or Checklist Builder output to fix it.",
      "Sequence your requests — document a workflow before you automate it; Automation Plan works best once a process is already written down.",
      "Revisit your SOP Documents periodically as your team grows; a process built for 3 people rarely survives at 10 unchanged."
    ],
    "rd-agent.html": [
      "This is the most analytical agent — market research, competitive intelligence, and innovation briefs with a written feasibility assessment; nothing here computes a score or metric.",
      "Keep your Business Profile's Industry, Description, Target Audience, Business Goals and Competitors current (edit it from the Content Agent); I read them to decide what's actually worth researching.",
      "Run Market Research and Competitive Intelligence together — your differentiation is clearer when you know both your market and your competitors.",
      "Use Innovation Brief to screen ideas by feasibility before you invest real time in them.",
      "Build Executive Briefing last — the only earlier runs it sees are excerpts of your last 5 R&D runs, so paste in anything else you want summarized into something you can hand to a stakeholder."
    ],
    "ads-agent.html": [
      "This agent writes ad campaigns and ad copy from your Business Profile and what you tell it; it connects to no ad account and reads no ad results, so nothing here buys, runs or measures an ad.",
      "Ad Copy writes for a Google Responsive Search Ad or a Meta feed ad and measures every asset against that platform's limits — Google's 30-character headlines and 90-character descriptions are hard limits, rejected at upload if longer; Meta's are the points where the feed cuts text short.",
      "Ad Copy also runs what it writes through the policy scan, so wording that gets ads rejected is flagged in the same result.",
      "Policy Check scans copy you paste for wording that gets ads rejected — cure claims, before-and-after results, guaranteed results, addressing a personal attribute — and for FDA disease claims; a clean scan is not approval, and with Suggest rewrites unchecked it makes no model call at all.",
      "Use Ad Campaign for a whole plan — audience, offer, hooks, creative angles, copy, budget guidance, and a testing plan — then write each ad's assets in Ad Copy."
    ],
    "executive-agent.html": [
      "This agent turns a goal into a plan of assignments for the other agents; it runs none of them itself — a runnable assignment waits for you to press its Run this assignment button.",
      "In the Executive Plan tool, give it the goal, and if you like a horizon and constraints. Each assignment names the tool to run and is checked against the tools that really exist; one that names a missing tool or lacks its inputs is marked Not runnable instead of passed along.",
      "Begin with the Start here list — the assignments that wait on nothing — then work down the Order; assignments that wait on each other in a circle cannot start until you change the plan.",
      "Assignments marked your own work are yours to do; no agent or tool can run them.",
      "The launcher's Executive Command Plan, Agent Coordination, Executive Briefing and KPI Review tasks write their answer as text; only the Executive Plan tool's assignments can be run."
    ],
    "vertical-marketing-agent.html": [
      "This agent writes marketing for one industry at a time — positioning, the trade's own language, its channels and its objections — from the model's own knowledge; nothing about the industry is researched.",
      "Vertical Positioning takes the industry, and optionally what you sell and who in that industry buys it, and returns positioning, trade language, channels, what not to say, and a confidence level.",
      "Objection Handling takes the industry and the offer and returns the objections that trade raises, what is behind each, how to answer it and the proof that helps, with a confidence level.",
      "Read the confidence level as the model's own estimate of how well it knows the trade, not a measurement, and have someone who works in that industry read the result before it goes out.",
      "The launcher's tasks reuse instructions written for other agents — Vertical Campaign Plan, for one, runs the creator-partnership campaign instruction — so name the industry and what you want in your request.",
      "Claims Scan runs the supplement claim rules and the ad-policy rules over copy you paste, and over everything you have stored here if you tick the box, with no model call: each match shows its exact text and where it is, and copy without the required disclaimer is listed. No match is not approval from anybody, so a person still reads it."
    ],
    "sms.html": [
      "This page is not an agent — it manages SMS subscribers and drip campaigns: add or import subscribers, create a campaign, add its messages in order, and enroll subscribers in it.",
      "Each message's Delay (hours) counts from when the message before it goes out; the first message's delay is not used — an enrolled subscriber is due for it at the next engine run.",
      "The drip engine is fixed in dry-run mode: Run Drip Engine (Dry Run) records what would go out in the Send Log as dry_run and sends no text; its \"Sent\" count is what would have been sent.",
      "A dry run moves no enrollment forward, so every run repeats each subscriber's first message; later messages and their delays are not reached while the engine stays in dry-run mode.",
      "Only subscribers marked opted in are included, and direct SMS sending is shut on this platform — nothing on this page puts a message on a phone."
    ],
    "oracle.html": [
      "This is the Oracle — a synchronized channel where you consult Termaximus directly, his counsel drawn from your true numerology and the shape of your birth chart, not generic advice.",
      "Sync your Book of You through the corner star's profile — birth name, date, time, place, current location, your path, and the fuller story of who you are; the more it holds, the deeper and more exact the Oracle's sight becomes.",
      "Ask anything through the channel — strategy, esoteric questions, personal matters, business decisions — it draws no line between them; every answer comes filtered through your own numbers and path, never as generic advice.",
      "Bring him documents through the paperclip beside the input — PDFs, Word files (.docx only), plain text, contracts, or images. Termaximus combs through each with a fine-tooth comb: contracts read clause by clause for loopholes, buried terms, micro-infractions, and risk; any file drawn into rigorous, unflinching critique when you ask it of him; images seen and weighed against your question.",
      "Keep the channel current. Your Life Path, Expression, Soul Urge, and Birthday numbers are fixed by your birth name and date and do not change with time; your current location, your path and your story can, and the Oracle reads them with every question."
    ]
  };

  var DEFAULT_GUIDANCE = "Explore this page — Termaximus will surface guidance here as it learns the terrain.";

  /* per-page fallback for the "Termaximus Insights" section — used as
     the initial text and whenever the live /api/insights/page call is
     empty or fails, so a page can show a real, finished thought instead
     of the generic placeholder below. Pages without an entry here keep
     the original generic behavior exactly as before. */
  var PAGE_INSIGHT = {
    "oracle.html":
      "The Oracle is more than a novelty — it's a genuine strategic differentiator: a numerology-grounded advisory layer. For businesses built on vitality and personal transformation, or on publishing and the written word, that kind of individually-calibrated counsel is exactly the edge that turns a routine question into guidance shaped around one person's actual path. It now also reads what you hand it — contracts, PDFs, Word (.docx) files, images — scrutinizing the fine print with the same rigor it brings to a birth chart, turning the Oracle into a working document reviewer as much as an advisor. Every synced detail in the Book of You deepens that precision, making the Oracle both a retention hook and a positioning asset at once."
  };

  function resolveInsight(key, fallback) {
    if (PAGE_INSIGHT[key]) return PAGE_INSIGHT[key];
    if (key.indexOf(".html") === -1) {
      var withExtension = key + ".html";
      if (PAGE_INSIGHT[withExtension]) return PAGE_INSIGHT[withExtension];
    }
    return fallback;
  }

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
    "  scrollbar-width: thin;",
    "  scrollbar-color: rgba(110, 150, 220, 0.55) rgba(8, 12, 24, 0.4);",
    "}",
    "#tmx-guide-panel::-webkit-scrollbar {",
    "  width: 6px;",
    "}",
    "#tmx-guide-panel::-webkit-scrollbar-track {",
    "  background: rgba(8, 12, 24, 0.4);",
    "  border-radius: 8px;",
    "  margin: 12px 0;",
    "}",
    "#tmx-guide-panel::-webkit-scrollbar-thumb {",
    "  background: linear-gradient(180deg, rgba(34, 211, 238, 0.5), rgba(168, 85, 247, 0.5));",
    "  border-radius: 8px;",
    "}",
    "#tmx-guide-panel::-webkit-scrollbar-thumb:hover {",
    "  background: linear-gradient(180deg, rgba(34, 211, 238, 0.7), rgba(168, 85, 247, 0.7));",
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

  function resolveGuidance(key) {
    if (PAGE_GUIDANCE[key]) return PAGE_GUIDANCE[key];
    if (key.indexOf(".html") === -1) {
      var withExtension = key + ".html";
      if (PAGE_GUIDANCE[withExtension]) return PAGE_GUIDANCE[withExtension];
    }
    return DEFAULT_GUIDANCE;
  }

  var guidanceText = resolveGuidance(currentPageKey());
  var initialInsightText = resolveInsight(currentPageKey(), "Placeholder — Termaximus’s insights will appear here.");

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
      '<p class="tmx-guide-placeholder" id="tmx-guide-insight-text">' + initialInsightText + '</p>' +
    '</div>';

  root.appendChild(tab);
  root.appendChild(panel);
  document.body.appendChild(root);

  /* ── the insight, fetched on demand and cached for the sitting ──────────────

     This used to run on every authenticated page load, across the 44 pages that
     load this script, to fill a drawer that starts CLOSED. Nothing cached it, so
     a reload billed again; nothing stored the result, so it was discarded on
     navigation; and the static PAGE_INSIGHT fallback above already renders a
     finished sentence both before a call returns and if one never does. It was
     paying for text nobody had asked to see, which replaced copy that was
     already acceptable.

     THREE STATES, NOT TWO, and the distinction is what stops the retry loop
     below: no record at all (never attempted for this page), a record saying the
     attempt failed, and a record carrying an insight. Collapsing "failed" into
     "never attempted" is exactly how a broken drawer becomes a model call per
     click — the spend this change exists to remove, arriving by another door.

     sessionStorage, not localStorage, because the insight is about THIS page in
     THIS sitting. One from last week is worse than none: it would describe a
     page as it was, with confidence, and nothing would reveal it as stale. */
  var INSIGHT_CACHE_PREFIX = "bf_tmx_insight:";

  /* Mirrors whatever was last written, so the dedupe still holds when
     sessionStorage is unavailable — a private window, blocked site data, a
     browser where the accessor itself throws. Storage failing must not turn
     "one call per page per session" back into one call per open. Its reach is
     this page load rather than the whole session, which is the most that can be
     promised with nowhere to persist to. */
  var insightMemoryRecord = null;

  /* In-flight guard. Without it, open/close/open while the first request is
     still outstanding starts a second one, because nothing has been written to
     the cache yet — the three-clicks-one-call case, failing on timing alone. */
  var insightPending = false;

  function insightCacheKey() {
    return INSIGHT_CACHE_PREFIX + currentPageKey();
  }

  function readInsightRecord() {
    if (insightMemoryRecord) return insightMemoryRecord;

    var raw;
    try {
      raw = sessionStorage.getItem(insightCacheKey());
    } catch (e) {
      /* Unreadable storage is not the same as an absent entry, but there is
         nothing else to go on, so this page load may make one call. Bounded by
         insightMemoryRecord from the second open onward. */
      return null;
    }

    if (raw === null || raw === undefined) return null;

    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }

    if (!parsed || typeof parsed !== "object") {
      /* Present but unusable. Read as an attempt that failed rather than as no
         attempt, because a value that keeps arriving corrupt would otherwise
         bill on every single open forever. */
      return { ok: false };
    }

    if (parsed.ok === true && typeof parsed.insight === "string" && parsed.insight) {
      return { ok: true, insight: parsed.insight };
    }

    return { ok: false };
  }

  function writeInsightRecord(record) {
    insightMemoryRecord = record;
    try {
      sessionStorage.setItem(insightCacheKey(), JSON.stringify(record));
    } catch (e) {
      /* Swallowed deliberately. The in-memory mirror above is already set, so
         the guarantee that matters — no second call for this page — holds for
         this page load whether or not this write landed. */
    }
  }

  function ensureInsight() {
    var insightEl = document.getElementById("tmx-guide-insight-text");
    if (!insightEl) return;

    if (insightPending) return;

    var cached = readInsightRecord();
    if (cached) {
      if (cached.ok) insightEl.textContent = cached.insight;
      /* A RECORDED FAILURE RETURNS HERE AND DOES NOT RETRY. The fallback
         sentence is already in the element, put there when the panel was built,
         so leaving it alone is the correct rendering rather than a gap. */
      return;
    }

    insightPending = true;
    var token = localStorage.getItem("bf_token") || "";

    fetch("https://dynamic-prosperity-production-5382.up.railway.app/api/insights/page", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ page: currentPageKey() })
    })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (data) {
        if (data && data.insight) {
          writeInsightRecord({ ok: true, insight: data.insight });
          insightEl.textContent = data.insight;
        } else {
          /* A 200 carrying no insight is a completed, BILLED call that produced
             nothing. Recorded as a failure for that reason: asking again would
             pay a second time for the same nothing. */
          writeInsightRecord({ ok: false });
          insightEl.textContent = resolveInsight(currentPageKey(), "Termaximus is gathering his thoughts — try again in a moment.");
        }
      })
      .catch(function () {
        writeInsightRecord({ ok: false });
        insightEl.textContent = resolveInsight(currentPageKey(), "Termaximus is gathering his thoughts — try again in a moment.");
      })
      .then(function () {
        /* A trailing then rather than finally, matching the ES5 idiom this file
           is written in. It runs after the catch above resolves, so it clears on
           both paths. */
        insightPending = false;
      });
  }

  /* An insight cached on an earlier visit to this page in this sitting, applied
     at once so a second visit opens on the real sentence rather than the
     placeholder — and costs nothing.

     SET WITH textContent, NOT FOLDED INTO THE innerHTML ABOVE. That string is
     model output arriving over the network, and the panel is assembled with
     innerHTML; interpolating it there would let a page key that shaped the
     prompt turn returned text into live markup. The original code set model
     output with textContent for the same reason, and this keeps it. */
  (function applyCachedInsight() {
    var cached = readInsightRecord();
    if (!cached || !cached.ok) return;

    var el = document.getElementById("tmx-guide-insight-text");
    if (el) el.textContent = cached.insight;
  }());

  var isOpen = false;

  function setOpen(next) {
    isOpen = next;
    root.classList.toggle("tmx-guide-open", isOpen);
    tab.setAttribute("aria-expanded", isOpen ? "true" : "false");

    /* THE FETCH HANGS OFF setOpen, NOT OFF THE TAB'S CLICK HANDLER, so every way
       the drawer can open is covered by construction rather than by enumeration.
       Today that is two paths through one listener — the tab is a <button>, so
       Enter and Space raise the same click as a pointer does — and anything added
       later that opens the drawer has to come through here to do it, because the
       open class and the aria state are both set nowhere else.

       Gated on opening, so closing costs nothing. */
    if (isOpen) ensureInsight();
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

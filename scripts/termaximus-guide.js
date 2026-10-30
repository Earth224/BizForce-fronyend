(function () {
  "use strict";

  /* suppress entirely on the login page or when logged out */
  try {
    var _tmxPath  = (window.location.pathname || "").toLowerCase();
    var _tmxLogin = _tmxPath === "/" || _tmxPath === "" || /(^|\/)app\.html$/.test(_tmxPath);
    if (_tmxLogin || !localStorage.getItem("bf_token")) return;
  } catch (e) {}

  if (document.getElementById("tmx-guide-root")) return;

  /* per-page "Page Guidance" text, keyed by the page's filename.

     ONE STANDARD FOR EVERY ENTRY (scripts/checkGuideStandard.js holds it):
     four tips, five at most, each at most 160 characters, in this order —
       Do        the page's main action, naming its button as rendered;
       Then      what happens next, and where the result appears;
       Know      the one most important truth or limit;
       If stuck  the most common failure and its fix, or the next page;
       (optional) one advanced tip.
     A quoted label must exist on the page or in a script it loads; no tip
     restates the page's heading; no sentence appears twice in the guide. What
     every agent page shares is said once, in GUIDE_COMMON below. A page that
     loads this script and has no entry here shows no guide at all. */
  var PAGE_GUIDANCE = {
    "dashboard.html": [
      "Start in \"Command Center\": \"Needs you\" lists the proposals waiting for your approval and the runs that failed.",
      "Under \"Executive plans\", press \"Dispatch\" to run an assignment; that run then joins the count in \"Agent activity\".",
      "\"Agent activity\" counts the runs your agents actually made in the last 30 days, by agent; nothing in it is estimated.",
      "Name or industry wrong? Press \"Expand Profile\" and edit it; every agent reads this profile.",
      "To delegate new work, open \"Agent Hub\" or \"Full Directory\"; each lists all 18 agents."
    ],
    "agents-hub.html": [
      "Press an agent's card, such as \"Content Agent\", to open its own page; that is where its tasks are written and run.",
      "Begin with \"Content Agent\": its page holds the Business Profile form, and every other agent reads what you save there.",
      "This page runs nothing itself; an agent works only when you launch a task on its page, or on a schedule you set there.",
      "Can't place an agent? The dashboard's Full Directory lists the same agents by name, each with an Open Agent link."
    ],
    "ai-agents.html": [
      "Find an agent by name and press \"Open Agent\" to go to its own page.",
      "That page is where you describe a job and launch it; each card shows the agent's name and one line on what it does.",
      "The list is read from the server each time you open it, so it holds the 18 agents registered, no more and no fewer.",
      "List did not load? Reload the page, or open Agent Hub from the dashboard, which shows the same agents as cards."
    ],
    "analytics-dashboard.html": [
      "Read the six tiles, from \"Tasks Run\" to \"SMS Campaigns\", then \"Tasks by Agent\" to see which agents you lean on.",
      "Figures are fetched once, as the page loads; reload it after running agents to see the new counts.",
      "A 0 means there is nothing of that kind on your account yet; a \"—\" means the figure is still loading or could not be read.",
      "Seeing \"Could not load analytics data.\"? The read failed, not your data; reload the page."
    ],
    "billing.html": [
      "Tick the automatic-renewal box beside the price, then press \"Subscribe — $199/month\"; checkout will not start until it is ticked.",
      "Payment happens on Stripe's own checkout page; afterwards this page shows your \"Status\" and \"Current Period End\".",
      "\"Manage / Cancel Subscription\" opens Stripe's billing portal to change your card or cancel; there is one plan, All Access.",
      "Watch for the cancellation warning banner — if it's showing, your access has an end date, and you'll want to resubscribe before it hits."
    ],
    "profile.html": [
      "Press \"Edit Profile\", fill in your bio and press \"Save About\"; then add work with \"Add Product\", \"Add Work\", \"Add Video\" or \"Upload Track\".",
      "Each item shows on this page once saved; press \"Copy Profile Link\" or \"Share\" to send the page to people.",
      "Others see this page only while your subscription is active; it returns when you resubscribe, and nothing is deleted.",
      "A section you hide in the customize panel is only hidden; its items are kept, and showing it again brings them back.",
      "Under \"Support links\" add up to five payment pages and press \"Save support links\"; visitors also get \"Support with BizCash\"."
    ],
    "integrations.html": [
      "Read each service's status: \"Runs on BizForce\", \"Removed\" or \"Not built\"; there is nothing here to connect or press.",
      "\"Removed\" means BizForce had it and took it out: Zernio and the six social platforms it posted to.",
      "\"Runs on BizForce\" means the app uses the service with its own account, as with Stripe, Twilio and email.",
      "Hoping to post to your social accounts? Bluesky connects on the Social Agent page; the other platforms are not built."
    ],
    "marketplace.html": [
      "Find a service by category or search, press \"Buy\" on its card and confirm; the price is paid from your BizCash balance.",
      "A digital listing's file then waits on \"My Purchases\" with a Download button; for a service, press \"Message\" to arrange it.",
      "Prices are BizCash only, entered in \"Price (BFC) *\"; no member pays another in dollars here.",
      "\"Not for sale until the seller sets a BizCash price\" means no Buy button yet; press \"Message\" to ask the seller.",
      "To sell, press \"List a Service\"; your own listings, with \"Edit\" and \"Delete\", are under \"My Listings\"."
    ],
    "wallet.html": [
      "Press \"Send BFC\", enter the member's username and the amount, check the name it finds, then press \"Confirm\".",
      "The transfer joins your history, which lists your latest 50 transactions; \"Show Trades\" lists your trades with other members.",
      "Your first pass of each certification pays 100 BFC while you're subscribed, and a one-time 1,000 BFC welcome bonus is paid once your subscription is active.",
      "Send refused? One transfer, a day's total and a new account each have a limit; the message says which one you reached.",
      "\"Download CSV\" and \"Yearly Statement\" export your trades, support included; \"Your support link\" has Copy and Share."
    ],
    "certifications.html": [
      "Pick a certification, press \"Start Assessment\" and then \"Begin Assessment\"; the pass score is shown before you begin.",
      "Your answers are graded on the server, and your score appears on the result screen as soon as you finish.",
      "Your first pass of each certification pays 100 BFC to your Wallet while you're subscribed; passing it again pays nothing more.",
      "Didn't pass? Press \"Try Again\" on the result screen, or \"Start Assessment\" on the card later; there is no penalty for trying again."
    ],
    "digital-cards.html": [
      "Fill in \"Full Name\", \"Job Title\" and your contact fields, style the card while the preview updates as you type, then press \"Save Card\".",
      "Press \"Share\" for the card's public link, where people save your contact; \"Your support link\" below has its own Copy and Share.",
      "\"Copy vCard\" copies the contact file itself; \"Download PNG\" is for screens and \"Export Print File\" for printing.",
      "Shared card not showing your change? Press \"Save Card\" again; the public page shows only what was last saved.",
      "Card looks busy? Pick one theme, one border and one transition; stacked effects read cluttered, not premium."
    ],
    "business-id.html": [
      "Fill in \"Business Name\", \"Industry\", \"Tagline / Bio\" and your contact fields, then press \"Save Profile\".",
      "The card above the form is redrawn from what you saved, with a \"BizForce AI Member\" badge.",
      "The card is drawn only on this page, for you; nothing on the platform shows it to other members.",
      "No \"Saved successfully!\" after saving? The save did not land; check your connection and press \"Save Profile\" again."
    ],
    "business-chat.html": [
      "Type a question about your business and press \"Send\"; the answer is written with your saved Business Profile in view.",
      "Every message is kept in one thread, not a list of past threads, and shown here whenever you return.",
      "Each answer is written from the last 20 messages only, so restate older context when it matters.",
      "Need a finished deliverable, such as a plan or a draft? Launch a task on the matching agent's page instead."
    ],
    "card-view.html": [
      "Press \"Save Contact\" to add this card's details to your phone's contacts.",
      "The card's short link and its QR codes open this same page, so anyone you share it with sees what you see.",
      "Nothing here can be edited; the card's owner changes it on the Digital Cards page and saves it there.",
      "Card not showing? The link may be mistyped or the card removed; ask its owner to send the link again.",
      "\"Support\" lists the owner's payment links; each opens the provider in a new tab, and BizForce never handles that money."
    ],
    "seo.html": [
      "Pick \"Keyword Research\" or \"Local SEO Plan\", describe your market, and press \"Launch Task\".",
      "To check one page, enter its address under \"Optimize My Website\" and press \"Optimize\"; the report reads that page as served now.",
      "Keyword research here knows no search volume, competition or ranking; treat its keywords as candidates to test.",
      "Results too generic? Set Website and Competitors in your Business Profile, press \"Refresh Data\", and run again.",
      "\"Social Search\" measures a YouTube, TikTok or Instagram draft against your phrase in code; it searches no platform."
    ],
    "sales.html": [
      "Pick \"Sales Funnel\" or \"Outreach Script\", describe your offer and your buyer, and press \"Launch Task\".",
      "In \"Sales Pipeline\", move each lead through New, Drafted, Contacted, Replied, Converted; nothing here judges which deals are stalling.",
      "The tasks read none of the leads or pipeline on this page, so say in your request what has changed in your deals.",
      "No leads listed? They come from Lead Radar, which works only for the account that owns its keyword set; press \"Refresh\" to reload.",
      "On that account, \"Lead Radar finds\" under the page header counts each source apart; YouTube finds are kept 30 days and never added to the total."
    ],
    "content.html": [
      "Start with \"Edit Profile\" and press \"Save Profile\"; every agent reads it, and \"Business Profile\" under the page header ticks each field set.",
      "Pick \"Social Media Drafts\" and press \"Launch Task\"; each draft waits in \"Approval Queue\" for you to approve or reject.",
      "Approved drafts are saved, not published or scheduled; to post on Bluesky from your own account, use the Social Agent page.",
      "Looking for an article you made? \"Content Library\" keeps saved articles and SMS campaigns; social drafts are not in it.",
      "\"Generate SEO Article\" and \"Generate SMS Campaign\" each write one piece from a single form, with no task to set up."
    ],
    "social.html": [
      "Pick \"Content Calendar\" or \"Platform Playbook\", name your platforms and goals, and press \"Launch Task\".",
      "For one post, open \"Platform Post\" and press \"Write the post\"; for a schedule, \"Posting Calendar\" and \"Build the plan\".",
      "Under \"Connect Bluesky\", make an app password in Bluesky, enter it with your handle and press \"Connect\"; never your main password.",
      "Turn on \"Post approved drafts automatically\" and a filed post goes out at once; every screen still runs, and profile edits always wait.",
      "Only Bluesky connects so far, and posts cannot be scheduled; plans for the other platforms are yours to carry out."
    ],
    "analytics.html": [
      "Open \"KPI Review\", enter each metric's Now and Before figures, and press \"Review the metrics\"; it works out each change.",
      "For a funnel, enter each stage's count in \"Funnel Analysis\" and press \"Compute the funnel\" to see where people drop off.",
      "\"Revenue Forecast\" builds a forecasting method for you to fill in; this agent reads no revenue data of its own.",
      "Results feel thin? These tools measure only the figures you enter, and nothing keeps a trend across runs, so compare runs yourself.",
      "\"Arrivals Ledger\" counts landings through your own tracked links, in code; an arrival is one page request, not a person or a sale."
    ],
    "lead-radar.html": [
      "Press \"Draft Engagement\" on a \"High-Intent\" lead (60+) for a reply, then \"Copy\" it to your clipboard and post it on Bluesky yourself.",
      "New Bluesky finds arrive every 5 minutes; Mastodon, YouTube and scoring each wait on their own switch. Press \"Refresh\" to load.",
      "It searches a fixed set of buyer-intent phrases on Bluesky, set in the radar's own code, and does not read your Business Profile.",
      "\"Not enabled on this account\" means just that: leads appear solely on the account that owns the keyword set and its credentials.",
      "Sub-15 scores are hidden as noise; press \"Show Noise\" once the high-intent leads run dry."
    ],
    "email-agent.html": [
      "Open \"Email Sequence\", set its goal, audience and \"Number of steps\", and press \"Build the sequence\".",
      "Each step's copy appears under the tool, ready to paste into your own email platform.",
      "It writes the copy and reads no delivery data; nothing here measures opens, clicks or delivery.",
      "Unsure which subject wins? \"Subject Lines\" with \"Write variants\" notes which to A/B test first; run the test in your own email platform.",
      "Under the page header, \"Sender\" reads \"Blocked\" with each reason when sequence mail cannot go out, from the server's own settings."
    ],
    "store-agent.html": [
      "Pick \"Store Audit\" or \"Product Launch Plan\", describe the store and the product, and press \"Launch Task\".",
      "\"Stock & Margin\" with \"Measure my stock\" counts what you entered on your inventory page, in code, with no model call.",
      "It connects to no store or channel; audits are written from your Business Profile and what you tell it, not your store's own data.",
      "A cost, price or reorder point you never entered is left out and counted, not taken as 0; fill it in on the inventory page.",
      "Under the page header, \"Low stock\" names items at or below your own reorder point; with no items yet, \"Add inventory\" opens that page."
    ],
    "etsy-agent.html": [
      "Open \"Keyword Research\", enter a seed term and your tag limits, and press \"Find keywords\"; each candidate is measured against them.",
      "\"Pricing Strategy\" works out the range, median and your margin from comparable listings you type in, then writes a rationale.",
      "It reads no store, marketplace or search data; \"Listing Optimization\" and \"Shop Audit Checklist\" give you copy and a list to work through.",
      "Competitor Comparison works from the competitors in your Business Profile; keep that list current and treat any figure as unverified."
    ],
    "broker-agent.html": [
      "Open \"Term Sheet Framework\", describe the deal and the parties, and press \"Draft the framework\".",
      "Take that framework and the \"Due Diligence Checklist\" to a lawyer; they are not execution documents, and each says so.",
      "The agent keeps no record of where your deals stand; \"Deal Pipeline\" analyses only the deals you describe in your request.",
      "High-stakes call coming? Run \"Negotiation Brief\" first, so you walk in with the leverage points mapped."
    ],
    "publicist-agent.html": [
      "Open \"Press Release\", enter the news, the company and the dateline, and press \"Write the release\".",
      "For one outlet or journalist, open \"Media Pitch\" and press \"Write the pitch\"; send both from your own email.",
      "Nothing here sends a pitch, and nothing here measures coverage; note for yourself which angles earn attention.",
      "Pitches sound generic? Run \"Brand Narrative\" first; a clear story sharpens every release and pitch after it."
    ],
    "reputation-agent.html": [
      "Paste a review into \"Review Response\", add the star rating and what actually happened, and press \"Draft the reply\".",
      "The reply comes back with any phrasing flagged that argues with or blames the reviewer; \"Review Request\" flags incentive wording.",
      "This agent does not watch or monitor mentions, reviews or sentiment anywhere; it works only from what you paste in or type.",
      "\"Reputation Audit\" and \"Sentiment Report\" read no review site and give no measured score; each is a framework you fill in.",
      "Run \"Crisis Response\" once before you need it, so the plan is ready."
    ],
    "community-agent.html": [
      "Open \"Member Onboarding\", set the community type, platform and goal, and press \"Build the sequence\".",
      "\"Audience Ledger\" with \"Count my audience\" counts your own sign-up records in code, with no model call, as counts only.",
      "Nothing here measures engagement, and Audience Ledger counts sign-ups rather than activity; judge tactics by your own numbers.",
      "A table the ledger could not read is shown as not measured, never as 0; run it again later.",
      "Pair \"Referral Loop\" with \"Retention System\": growth without retention just refills a leaky bucket."
    ],
    "influencer-agent.html": [
      "Open \"Creator Outreach\", name the creator, the campaign and the channel, and press \"Write the first message\".",
      "When a creator replies, open \"Partnership Offer\" and press \"Draft the offer\" to put budget and territory in writing.",
      "\"Creator List\" describes the kinds of creators to look for and how to score their fit; it looks up no named or trending creators.",
      "Unsure a deal pays? Run \"ROI Forecast\" first; it builds the return model and break-even from figures you supply."
    ],
    "operations-agent.html": [
      "Open \"Standard Operating Procedure\", describe the process and who owns it, and press \"Write the SOP\".",
      "For a recurring job, open \"Checklist\" and press \"Build the checklist\" to turn it into steps to tick off.",
      "Document a workflow before you automate it; \"Automation Plan\" works best on a process already written down.",
      "Not sure what to fix first? Run \"Efficiency Audit\" to find the bottleneck, then write that process down.",
      "Under the page header, \"Routines\" lists your own with how often each has run; with none yet, it links to the Routines page."
    ],
    "rd-agent.html": [
      "Pick \"Market Research\" or \"Competitive Intelligence\", say what you need to decide, and press \"Launch Task\".",
      "\"Innovation Brief\" screens an idea with a written feasibility assessment; nothing here computes a score or metric.",
      "\"Executive Briefing\" sees excerpts of your last 5 runs on this page and no others; paste in anything else to be summarized.",
      "Research off target? Keep Industry, Target Audience and Competitors current in your Business Profile; I read them first.",
      "Under the page header, \"Demand signals\" and \"Competitor scans\" count those runs over 30 days, each linked; no lead text is shown there."
    ],
    "ads-agent.html": [
      "Open \"Ad Copy\", enter the product, angle, platform and audience, and press \"Write the copy\".",
      "Each asset comes back measured against that platform's limits and run through the policy scan, so rejected wording is flagged.",
      "It connects to no ad account and reads no ad results, so nothing here buys, runs or measures an ad.",
      "Ad refused elsewhere? Paste it into \"Policy Check\"; a clean scan is not approval, and with \"Suggest rewrites\" unticked it makes no model call.",
      "Use \"Ad Campaign\" for a whole plan — audience, offer, hooks, budget guidance and a testing plan — then write each ad in \"Ad Copy\"."
    ],
    "executive-agent.html": [
      "In \"Command\", pick an agent or \"Let the Executive decide\", type the task or goal, and press \"Send\"; nothing goes before you press it.",
      "A goal becomes a plan in \"Plan runner\"; press \"Run next\" for one assignment at a time, and each next one waits for another press.",
      "A tool that acts, such as publishing or a proposal set, never runs from here; it opens its own page and goes through approval there.",
      "\"Run next\" greyed out? Running plans is switched off on the server; any refusal is named where you pressed, with where to go.",
      "On a tile, \"Pause schedule\" or \"Resume schedule\" changes only that agent's schedule; \"Approval queue\" still holds what needs you."
    ],
    "vertical-marketing-agent.html": [
      "Open \"Vertical Positioning\", enter the industry and what you sell, and press \"Write the positioning\".",
      "\"Objection Handling\" with \"Work the objections\" lists what that trade raises, what is behind each and how to answer it.",
      "Nothing about the industry is researched; its confidence level is the model's own estimate, not a measurement.",
      "Before copy goes out, paste it into \"Claims Scan\" and press \"Scan for claims\"; no match is not approval, so a person still reads it.",
      "Launcher tasks reuse other agents' instructions — \"Vertical Campaign Plan\" runs the creator campaign one — so name the industry."
    ],
    "sms.html": [
      "Add people with \"Add\" or \"Import\", press \"Create\" for a campaign, add its messages with \"Add Message\", then \"Enroll All Subscribers\".",
      "\"Run Drip Engine (Dry Run)\" records in \"Send Log\" what would go out, marked dry_run; its count is what would have been sent.",
      "A dry run moves no enrollment forward, so each run repeats every subscriber's first message and later ones are never reached.",
      "Someone left out? Only subscribers marked opted in are included, and direct SMS sending is shut on this platform.",
      "Each message's \"Delay (hours)\" counts from the message before it; the first message's delay is not used."
    ],
    "oracle.html": [
      "Give your \"Birth Name\" and \"Birth Date\", press \"SYNCHRONIZE\", then put your question to the channel.",
      "Each answer draws on your numbers and birth chart, and on your Business Profile and recent agent runs as well.",
      "Your Life Path, Expression, Soul Urge and Birthday numbers are fixed by birth name and date; place, path and story can change.",
      "File refused? The paperclip takes PDFs, Word files (.docx only), plain text, CSV, Markdown and four image types.",
      "\"The Book of You\" holds the fuller story of who you are; the more it holds, the closer the counsel fits."
    ],
    "artists.html": [
      "Press a member's card to open their seller page.",
      "On that page you can buy their listings with BizCash from your balance.",
      "Cards come from the portfolio work members add on their profiles; only members with an active subscription are shown.",
      "A card that opens nothing belongs to a member with no username yet, so there is no seller page to go to."
    ],
    "bizdoc.html": [
      "Pick a template such as \"NDA\" or \"Invoice\", or \"Blank Document\", fill it in and press \"Save\".",
      "Your saved documents are listed under \"Documents\"; open one to sign it by typing your full legal name.",
      "These templates are starting points, not legal advice; have a lawyer read anything that binds you.",
      "Making a book instead? Open \"Biz-EBook\", choose a manuscript (.docx or .txt) and press \"Generate Book\".",
      "\"Cover\" designs a front, spine and back wrap; \"Download Print PDF\" exports it for the printer."
    ],
    "campaigns.html": [
      "Press \"Donate BFC\" on a campaign and enter an amount; it moves from your balance to the campaign's owner.",
      "Each donation counts toward the campaign's goal and is listed on your Receipts page.",
      "Donations have limits: a cap per donation, a daily total, a wait for new accounts, and none to your own campaign.",
      "To raise funds, press \"Start a Campaign\" and set \"Goal (BFC) *\"; members give in BizCash, never in dollars."
    ],
    "garage-sale.html": [
      "Press \"Buy\" on an item and confirm; its price comes out of your BizCash balance.",
      "Press \"Message\" to agree pickup or shipping with the seller; the conversation opens on your Messages page.",
      "BizForce moves only the BizCash; handing over the item is between you and the seller.",
      "Selling? Press \"Post an Item\", add a title, price and photos, then \"Post Item\"; change or remove it later from its card."
    ],
    "receipts.html": [
      "Press \"View Receipt\" on any purchase, sale, transfer or donation to open its full record.",
      "Press \"Print / Save as PDF\" to print it or keep a PDF copy.",
      "Entries come from your marketplace orders, wallet history and donations; nothing here is typed in by hand.",
      "A part that failed to load says so, with \"Try again\"; press it rather than reloading the whole page."
    ],
    "routines.html": [
      "Press \"+ New routine\", give it a \"Name\", pick an agent and a tool for each step with \"Add step\", then press \"Save routine\".",
      "Press \"Run\" on a routine, then \"Run now\"; the run window shows each step's result.",
      "The builder shows how many steps the server allows; at that limit, no more can be added.",
      "\"Stopped at step\" means that step failed and the ones after it never ran; fix its inputs with \"Edit\" and run it again."
    ],
    "saved-prompts.html": [
      "Press \"+ New prompt\", pick the \"Agent\", write the \"Prompt\" using {{customer}}-style blanks, and press \"Save prompt\".",
      "Press \"Run\", fill in each blank, and the agent's answer appears in the run window.",
      "Two prompts cannot share a name that differs only by capitals or spaces.",
      "\"This is not a usable blank\" means the braces hold something else; a blank takes letters, digits and underscores only."
    ],
    "seller.html": [
      "Press \"Buy with BizCash\" on an item and confirm; the price is taken from your balance.",
      "A digital item's file then waits for you on your My Purchases page.",
      "Everything here is priced in BizCash; BizForce takes no dollar payments between members.",
      "Page empty? The username in the link may be wrong, or this member has nothing listed yet.",
      "\"Support with BizCash\" sends this member BFC with an optional note that only the two of you see."
    ],
    "support.html": [
      "Enter an amount and an optional note, press \"Support with BizCash\", check the name shown, then press \"Send\".",
      "The note is kept for you and this member alone; the BFC arrives in their wallet at once, within the usual BizCash limits.",
      "A provider button pays the member on that provider's own site; BizForce never sees, holds or refunds that payment.",
      "Press \"Share\" or \"Copy link\" to pass this page on; the QR code opens this same address.",
      "Signed out? Press \"Sign in to support with BizCash\"; after signing in you come back to this page."
    ],
    "services.html": [
      "Press \"View / Buy\" on a card to open that member's own buy link in a new tab.",
      "Payment happens on the member's own site; BizForce takes no part in that sale.",
      "Cards are the services members add on their profiles; only members with an active subscription are listed.",
      "Rather pay in BizCash? The marketplace sells services that are bought from your balance."
    ],
    "index.html": [
      "Signed in, this page sends you straight on to your dashboard; if it has not moved, reload it.",
      "On the dashboard, the Command Center holds the proposals and failed runs waiting for you.",
      "As a member you never need this public introduction, and nothing on it changes your account.",
      "Stuck here after your session ended? Press \"Sign In\" again."
    ],
    "settings.html": [
      "Pick a panel — \"Profile\", \"API Key\", \"Billing\", \"Preferences\" or \"Account\" — change what you need, and press its save button.",
      "Under \"Preferences\", \"Mist Default Position\" sets where Termaximus' mist first appears; drag the mist and this device remembers where.",
      "Turn on \"Keep a copy on this device for offline use\" under \"Account\" to open recent tasks, profile and wallet with no connection.",
      "Offline, a page shows when its copy was saved, and nothing can be sent or changed until you're back online.",
      "\"Add a Passkey\" lets this device sign you in without typing your password."
    ],
    "crm.html": [
      "Press \"+ Add Customer\", fill in \"Name\" and what you know, and press \"Save\".",
      "Press \"Activity\" on a record to see its history, and \"Log Activity\" there to note a call or a meeting.",
      "A converted prospect arrives here as a new record, made by the Convert button on the Prospects page.",
      "List not loaded? Press \"Try again\" before entering anything a second time."
    ],
    "inventory.html": [
      "Press \"+ Add Item\", fill in \"Name\", \"Unit Cost\", \"Unit Price\" and \"Reorder Point\", then press \"Save\".",
      "Press \"Movements\" on an item for its history, and \"Record Movement\" there to log stock coming in or going out.",
      "The Store Agent's Stock & Margin tool counts what you enter here, so a blank cost or price is left out, never taken as 0.",
      "Can't delete an item with movements? Press \"Archive it instead\"; its history is kept."
    ],
    "proposals.html": [
      "Read each pending proposal's reasoning, then press \"Approve\" or \"Reject\".",
      "An approved proposal moves to \"Executing\", then \"Executed\" or \"Failed\"; the filters above find it.",
      "Calendar events sent with Propose for Approval wait here too, and are not saved until you approve them.",
      "Under \"Failed\"? It did not run; its card says why, so fix the cause before proposing it again.",
      "A Bluesky card says which account it posts as; approving it posts exactly that text from that account."
    ],
    "prospecting.html": [
      "Press \"+ Add Prospect\", fill in \"Name\" and contact details, and choose an \"ICP Profile\" to judge them by.",
      "Under \"ICP Profiles\", press \"+ Add ICP Profile\" to set the criteria and the \"Pass Threshold\" a prospect must reach.",
      "\"Convert\" turns a prospect into a CRM customer and marks it converted; it cannot be undone from here.",
      "\"Fit Score\" is yours to enter; leave it blank until you have scored the prospect."
    ],
    "calendar.html": [
      "Pick a day, give the event a \"Title\" and \"Type\", set \"Remind me\" if you want one, and press \"Save Event\".",
      "\"Propose for Approval\" sends the event to Agent Proposals instead, to approve before it is saved.",
      "Tick \"Recurring annually\" for a birthday or an anniversary, and it repeats every year from one save.",
      "Lost in another month? Press \"Today\" to come back.",
      "Press \"Agent runs\" to see when your agent schedules come due; it only reads, and a paused or switched-off schedule shows nothing, with why."
    ],
    "messages.html": [
      "Pick a conversation, type in the box and press \"Send\", or press Enter.",
      "An open conversation refreshes every 8 seconds, so replies appear without reloading.",
      "A new conversation starts from the Message button on a marketplace or garage-sale listing; there is no new-message button here.",
      "\"No conversations yet.\" means none has started; open a listing and press its Message button."
    ],
    "mychart.html": [
      "Tap any part of the triangle to open its reading in the side panel.",
      "Press \"Ask Termaximus about\" in that panel to send the question to the same thread as the Oracle page.",
      "The triangle is built from the birth name and date you synchronized on the Oracle page; it does not shift with time.",
      "Chart empty? Synchronize your birth name and date on the Oracle page first, then reload this one."
    ],
    "self-reviews.html": [
      "Press \"Run Weekly\" or \"Run Monthly\" to review your last closed week or month.",
      "The review shows the activity counted for that period, with a written narrative beneath it.",
      "The counts are measured from your saved records; only the narrative is written by the model.",
      "A review with no narrative still shows its counts; the writing failed, not the measurement, so run it again."
    ],
    "synastry.html": [
      "Enter a \"Label\", \"Birth name\", \"Birth date\" and \"Birth place\", then press \"Save Record\".",
      "Press \"Compare\" on a saved record to read that person against your own chart.",
      "Each person is read against the birth details you synchronized on the Oracle page, so synchronize there first.",
      "No \"Compare\" on a record? Its place could not be resolved, so no chart can be computed; delete it and save it again."
    ],
    "your-data.html": [
      "Press \"Download my data\" for a copy of everything BizForce stores about you.",
      "\"On this device\" lists what this browser keeps for offline use, and where to turn it off.",
      "\"Delete my account\" asks for \"Your username\" and \"Your password\" before anything is removed.",
      "Offline, both buttons are disabled; they work again once you are back online."
    ]
  };

  /* What every agent page shares, said once and shown under that page's tips:
     the pages that carry the "Last run" line (#lastRunText, filled by
     agent-profile.js). The Content Agent page has no Last run line, so it is
     not shown there; its own tips say where the Business Profile is set. */
  var GUIDE_COMMON = "Each run is saved; \"Last run\" opens the newest. Rate runs 👍 or 👎 to tune the agent. Every agent reads the Business Profile you set on the Content Agent page.";

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
    // A page served at another address (the support page, /support/<username>) names its entry itself.
    var named = document.documentElement.getAttribute("data-bf-page");
    if (named) return named.toLowerCase();
    var path = window.location.pathname || "";
    var file = path.split("/").pop();
    if (!file) file = "index.html";
    return file.toLowerCase();
  }

  /* NO ENTRY, NO GUIDE. There is no generic fallback text any more: a page
     that loads this script without an entry above shows nothing, rather than
     a sentence that says nothing. checkGuideStandard fails on such a page. */
  var guidanceText = resolveGuidance(currentPageKey());
  if (!guidanceText) return;

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
    "#tmx-guide-panel .tmx-guide-common, #tmx-guide-sheet .tmx-guide-common {",
    "  margin: 14px 0 0;",
    "  padding-top: 12px;",
    "  border-top: 1px dashed rgba(255, 255, 255, 0.1);",
    "  font-size: 0.8rem;",
    "  line-height: 1.55;",
    "  color: #7d84a8;",
    "}",

    /* ── phones: a "Guide" button and a bottom sheet ──
       The panel above stays hidden at 860px and below; this button opens the
       same tips there. BOTTOM-LEFT, 16px in: the mist's four default corners
       (termaximus-presence.js MIST_CORNERS) all sit 120px or more above the
       bottom edge, or 180px in from the right, so this 44px button clears
       every one of them; a mist dragged onto it moves the button to the
       bottom-right instead (placeFab, below). Z-INDEX 40: below every modal
       overlay (50 and up), the profile's customize panel (50) and the terms
       notice (9000), so it never sits over a page's own controls. */
    "#tmx-guide-fab {",
    "  display: none;",
    "  position: fixed;",
    "  left: 16px;",
    "  bottom: calc(16px + env(safe-area-inset-bottom, 0px));",
    "  width: 88px;",
    "  height: 44px;",
    "  z-index: 40;",
    "  align-items: center;",
    "  justify-content: center;",
    "  gap: 6px;",
    "  border: 1px solid rgba(168, 85, 247, 0.45);",
    "  border-radius: 22px;",
    "  background: rgba(12, 18, 38, 0.92);",
    "  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.4), 0 0 16px rgba(0, 229, 255, 0.12);",
    "  color: #e8e8ff;",
    "  font: 700 0.82rem system-ui, -apple-system, \"Segoe UI\", Arial, sans-serif;",
    "  letter-spacing: 0.06em;",
    "  cursor: pointer;",
    "}",
    "#tmx-guide-fab.tmx-guide-fab--right {",
    "  left: auto;",
    "  right: 16px;",
    "}",
    "#tmx-guide-fab:focus-visible, #tmx-guide-sheet-close:focus-visible {",
    "  outline: 2px solid #22d3ee;",
    "  outline-offset: 2px;",
    "}",
    "#tmx-guide-sheet-backdrop {",
    "  position: fixed;",
    "  inset: 0;",
    "  z-index: 2147483600;",
    "  background: rgba(2, 4, 12, 0.55);",
    "}",
    "#tmx-guide-sheet {",
    "  position: fixed;",
    "  left: 0;",
    "  right: 0;",
    "  bottom: 0;",
    "  z-index: 2147483601;",
    "  max-height: 75vh;",
    "  overflow-y: auto;",
    "  padding: 0 20px calc(20px + env(safe-area-inset-bottom, 0px));",
    "  border-radius: 20px 20px 0 0;",
    "  border-top: 1px solid rgba(168, 85, 247, 0.35);",
    "  background: rgba(12, 18, 38, 0.98);",
    "  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.5);",
    "  color: #e8e8ff;",
    "  font-family: system-ui, -apple-system, \"Segoe UI\", Arial, sans-serif;",
    "  transition: transform 0.2s ease;",
    "}",
    "#tmx-guide-sheet-backdrop[hidden], #tmx-guide-sheet[hidden] {",
    "  display: none;",
    "}",
    "#tmx-guide-sheet .tmx-guide-sheet-head {",
    "  position: sticky;",
    "  top: 0;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  padding: 18px 0 12px;",
    "  background: rgba(12, 18, 38, 0.98);",
    "  touch-action: none;",
    "}",
    "#tmx-guide-sheet .tmx-guide-sheet-grip {",
    "  position: absolute;",
    "  top: 7px;",
    "  left: 50%;",
    "  width: 40px;",
    "  height: 4px;",
    "  margin-left: -20px;",
    "  border-radius: 2px;",
    "  background: rgba(255, 255, 255, 0.25);",
    "}",
    "#tmx-guide-sheet-title {",
    "  margin: 0;",
    "  font-size: 0.78rem;",
    "  font-weight: 800;",
    "  letter-spacing: 0.14em;",
    "  text-transform: uppercase;",
    "  color: #22d3ee;",
    "}",
    "#tmx-guide-sheet-close {",
    "  min-width: 44px;",
    "  height: 36px;",
    "  border: 1px solid rgba(255, 255, 255, 0.18);",
    "  border-radius: 18px;",
    "  background: transparent;",
    "  color: #e8e8ff;",
    "  font: 600 0.8rem system-ui, -apple-system, \"Segoe UI\", Arial, sans-serif;",
    "  cursor: pointer;",
    "}",
    "#tmx-guide-sheet .tmx-guide-list {",
    "  margin: 0;",
    "  padding-left: 18px;",
    "  font-size: 0.9rem;",
    "  line-height: 1.6;",
    "  color: #a8acc8;",
    "}",
    "#tmx-guide-sheet .tmx-guide-list li {",
    "  margin-bottom: 10px;",
    "}",
    "#tmx-guide-sheet .tmx-guide-list li::marker {",
    "  color: #22d3ee;",
    "}",
    /* While the sheet is open the mist would float over it (its z-index is
       the highest there is), so it is hidden until the sheet closes. */
    "html.tmx-guide-sheet-open #tmx-presence-root, html.tmx-guide-sheet-open #tmx-chat, html.tmx-guide-sheet-open #tmx-chat-glow-wrap {",
    "  visibility: hidden !important;",
    "}",

    "@media (max-width: 860px) {",
    "  #tmx-guide-root { display: none; }",
    "  #tmx-guide-fab { display: inline-flex; }",
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

  /* The tips, then the COMMON line on an agent page: one that carries the
     "Last run" line agent-profile.js fills. Used by the panel and the sheet. */
  function renderGuidance(tips) {
    return '<ul class="tmx-guide-list">' +
      tips.map(function (point) { return '<li>' + point + '</li>'; }).join('') +
      '</ul>' +
      (document.getElementById("lastRunText") ? '<p class="tmx-guide-common" data-tmx-guide-common>' + GUIDE_COMMON + '</p>' : '');
  }

  function resolveGuidance(key) {
    if (PAGE_GUIDANCE[key]) return PAGE_GUIDANCE[key];
    if (key.indexOf(".html") === -1) {
      var withExtension = key + ".html";
      if (PAGE_GUIDANCE[withExtension]) return PAGE_GUIDANCE[withExtension];
    }
    return null;
  }

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

  /* ── phones: the "Guide" button and its bottom sheet ────────────────────────
     The same tips as the panel, in a sheet that rises from the bottom edge.
     It closes on the Close button, a tap on the dimmed page behind it, a
     downward swipe on its header, or Escape. Opening moves focus into the
     sheet (its Close button) and keeps Tab there; closing hands focus back to
     the button that opened it. The Insights section stays on the desktop
     panel: the sheet makes no request at all. */
  var fab = document.createElement("button");
  fab.type = "button";
  fab.id = "tmx-guide-fab";
  fab.setAttribute("aria-label", "Open the Termaximus Guide for this page");
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-controls", "tmx-guide-sheet");
  fab.textContent = "Guide";

  var sheetBackdrop = document.createElement("div");
  sheetBackdrop.id = "tmx-guide-sheet-backdrop";
  sheetBackdrop.hidden = true;

  var sheet = document.createElement("div");
  sheet.id = "tmx-guide-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "tmx-guide-sheet-title");
  sheet.setAttribute("tabindex", "-1");
  sheet.innerHTML =
    '<div class="tmx-guide-sheet-head">' +
      '<span class="tmx-guide-sheet-grip" aria-hidden="true"></span>' +
      '<h2 id="tmx-guide-sheet-title">Termaximus Guide</h2>' +
      '<button type="button" id="tmx-guide-sheet-close" aria-label="Close the Termaximus Guide">Close</button>' +
    '</div>' +
    renderGuidance(guidanceText);

  document.body.appendChild(fab);
  document.body.appendChild(sheetBackdrop);
  document.body.appendChild(sheet);

  var sheetClose = document.getElementById("tmx-guide-sheet-close");
  var sheetOpen = false;

  function setSheet(next) {
    sheetOpen = next;
    sheet.hidden = !next;
    sheetBackdrop.hidden = !next;
    sheet.style.transform = "";
    fab.setAttribute("aria-expanded", next ? "true" : "false");
    document.documentElement.classList.toggle("tmx-guide-sheet-open", next);
    if (next) sheetClose.focus();
    else fab.focus();
  }

  fab.addEventListener("click", function (e) {
    e.stopPropagation();
    setSheet(!sheetOpen);
  });
  sheetClose.addEventListener("click", function () { setSheet(false); });
  sheetBackdrop.addEventListener("click", function () { setSheet(false); });
  sheet.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { e.preventDefault(); setSheet(false); }
    /* One control in the sheet, so Tab stays on it rather than leaving the
       dialog for the page behind. */
    else if (e.key === "Tab") { e.preventDefault(); sheetClose.focus(); }
  });

  /* A downward swipe of 60px or more on the header closes the sheet; a shorter
     one springs back. */
  var swipeHead = sheet.querySelector(".tmx-guide-sheet-head");
  var swipeStartY = null;
  swipeHead.addEventListener("touchstart", function (e) {
    swipeStartY = e.touches && e.touches[0] ? e.touches[0].clientY : null;
  }, { passive: true });
  swipeHead.addEventListener("touchmove", function (e) {
    if (swipeStartY === null || !e.touches || !e.touches[0]) return;
    var dy = e.touches[0].clientY - swipeStartY;
    sheet.style.transform = dy > 0 ? "translateY(" + dy + "px)" : "";
  }, { passive: true });
  swipeHead.addEventListener("touchend", function (e) {
    if (swipeStartY === null) return;
    var t = e.changedTouches && e.changedTouches[0];
    var dy = t ? t.clientY - swipeStartY : 0;
    swipeStartY = null;
    if (dy >= 60) setSheet(false);
    else sheet.style.transform = "";
  });

  /* A mist dragged down onto the bottom-left corner would sit on the button,
     so the button moves to the bottom-right while the two would touch. */
  function placeFab() {
    var mist = document.getElementById("tmx-presence-root");
    fab.classList.remove("tmx-guide-fab--right");
    if (!mist || !fab.getBoundingClientRect) return;
    var a = fab.getBoundingClientRect(), b = mist.getBoundingClientRect();
    if (!a.width || !b.width) return;
    var touching = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    if (touching) fab.classList.add("tmx-guide-fab--right");
  }
  placeFab();
  window.addEventListener("resize", placeFab);
  document.addEventListener("pointerup", function () { setTimeout(placeFab, 0); });

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

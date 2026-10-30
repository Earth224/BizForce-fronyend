/* ══════════════════════════════════════════════════════════════════════════
   scripts/bf-hq.js — Executive Headquarters on executive-agent.html.

   Read side only, from the member's own rows:
     the agent grid   GET /api/agents/live (all 18), polled the way the agent
                      panel polls its own /live (scripts/agent-profile.js):
                      60 s idle, 15 s while any agent is running, stopped while
                      the tab is hidden or the browser is offline, 2× backoff on
                      429 and 5xx up to 5 minutes;
     the alerts       that answer, plus the Command Center's spend (the
                      "bf:command-center" event from scripts/bf-command-center.js,
                      so the page reads /api/command-center once). The platform
                      ceiling appears only when the server sent the admin-only
                      platform section;
     the queue        GET /api/proposals?status=pending. Approve and Reject
                      post to the existing routes, once per click, and only on
                      a click: nothing here approves on its own, and the
                      executors re-check everything on the server.

   Act side, every request on a click and one request per click:
     the command box  ONE box on the deck's Command tab. "Do a task": an agent
                      (and, for the Executive, a kind of task) and a typed
                      task: POST /api/ai/tasks, then the run on its tile and in
                      run.html. A tool: opens it on the
                      agent's own page (#tool=<id>, read once on arrival, runs
                      nothing). A tool that ACTS (the server's
                      CHAIN_NON_DISPATCHABLE_TOOLS) never runs from here; it
                      goes through approval on its own page. "Make a plan"
                      (the same as "Executive decides"): POST
                      /api/agents/executive/plan, with Horizon and Constraints
                      shown only in that mode;
     the plan board   on the Plans tab, one plan at a time (a picker when there
                      are several), each from the Command Center, one assignment per
                      "Run next" (POST /api/assignments/dispatch; the server
                      mints the chain and applies every guard). The next one
                      always needs another click. A Done card's "View result"
                      opens the deck's result drawer (scripts/bf-exec-deck.js);
     the controls     "Automatic" (PUT /api/agent-autonomy) and Pause / Resume
                      (the schedule routes), beside each tile, never opening it;
     voice            the browser's own SpeechRecognition fills the box and
                      nothing else. Hidden where the browser has none.
   Refusals are shown by name: a 402, the platform's daily AI limit, the
   250-a-day cap, the per-minute limit, not entitled, chaining off.

   textContent only. Motion: a pulse on a running agent and on a real alert,
   the console's caret, and a send pulse on a success, nothing else, and none
   under prefers-reduced-motion.
   ══════════════════════════════════════════════════════════════════════════ */
(function headquarters() {
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var root = document.getElementById("hq");
  if (!root) return;

  var HQ_IDLE_MS = 60000;
  var HQ_BUSY_MS = 15000;
  var HQ_MAX_BACKOFF_MS = 300000;

  // Each agent's page and accent, as the page's own AGENT_PROFILE_CONFIG has it,
  // and its canonical name (lib/agentLive.js AGENT_NAMES).
  var AGENTS = {
    ads:                { page: "/ads-agent.html",                accent: "#818cf8", name: "Ads Agent" },
    analytics:          { page: "/agents/analytics.html",         accent: "#60a5fa", name: "Analytics Agent" },
    broker:             { page: "/broker-agent.html",             accent: "#c084fc", name: "Broker Agent" },
    community:          { page: "/community-agent.html",          accent: "#4ade80", name: "Community Agent" },
    content:            { page: "/agents/content.html",           accent: "#34d399", name: "Content Agent" },
    email:              { page: "/email-agent.html",              accent: "#fbbf24", name: "Email Agent" },
    etsy:               { page: "/etsy-agent.html",               accent: "#fb923c", name: "Storefront Agent" },
    executive:          { page: "/executive-agent.html",          accent: "#e2e8f0", name: "Executive Agent" },
    influencer:         { page: "/influencer-agent.html",         accent: "#e879f9", name: "Influencer Agent" },
    operations:         { page: "/operations-agent.html",         accent: "#94a3b8", name: "Operations Agent" },
    publicist:          { page: "/publicist-agent.html",          accent: "#fcd34d", name: "Publicist Agent" },
    rd:                 { page: "/rd-agent.html",                 accent: "#22d3ee", name: "R&D Agent" },
    reputation:         { page: "/reputation-agent.html",         accent: "#f87171", name: "Reputation Agent" },
    sales:              { page: "/agents/sales.html",             accent: "#a855f7", name: "Sales Agent" },
    seo:                { page: "/agents/seo.html",               accent: "#22d3ee", name: "SEO Agent" },
    social:             { page: "/agents/social.html",            accent: "#f472b6", name: "Social Agent" },
    store:              { page: "/store-agent.html",              accent: "#38bdf8", name: "Store Agent" },
    vertical_marketing: { page: "/vertical-marketing-agent.html", accent: "#a3e635", name: "Vertical Marketing Agent" }
  };
  // Each agent page's tools, as the app map lists them ([data-tool-run] on that page).
  var TOOLS = {
    ads: [["copy", "Ad Copy"], ["policy-check", "Policy Check"]],
    analytics: [["funnel", "Funnel Analysis"], ["kpi-review", "KPI Review"], ["arrivals", "Arrivals Ledger"]],
    broker: [["term-sheet", "Term Sheet Framework"], ["due-diligence", "Due Diligence Checklist"]],
    community: [["onboarding", "Member Onboarding"], ["engagement-calendar", "Engagement Calendar"], ["audience", "Audience Ledger"]],
    content: [["outline", "Article Outline"], ["audit", "Article Audit"]],
    email: [["sequence", "Email Sequence"], ["subject-lines", "Subject Lines"]],
    etsy: [["keyword-research", "Keyword Research"], ["pricing-strategy", "Pricing Strategy"]],
    influencer: [["outreach", "Creator Outreach"], ["partnership-offer", "Partnership Offer"]],
    operations: [["sop", "Standard Operating Procedure"], ["checklist", "Checklist"]],
    publicist: [["press-release", "Press Release"], ["pitch", "Media Pitch"]],
    rd: [["brief", "Executive Briefing"], ["competitor-scan", "Competitor Scan"]],
    reputation: [["review-response", "Review Response"], ["review-request", "Review Request"]],
    seo: [["audit", "Page Audit"], ["social-search", "Social Search"]],
    social: [["post", "Platform Post"], ["calendar", "Posting Calendar"]],
    store: [["stock-margin", "Stock & Margin"]],
    vertical_marketing: [["positioning", "Vertical Positioning"], ["objections", "Objection Handling"], ["claims-scan", "Claims Scan"]]
  };
  // The tools that ACT (server.js CHAIN_NON_DISPATCHABLE_TOOLS), each with the page whose approval flow runs it.
  var ACTING = {
    "store/generate-proposals": { label: "Store proposals", page: "/proposals.html" },
    "seo/generate-post": { label: "Blog post", page: "/proposals.html" },
    "seo/optimize": { label: "Optimize", page: "/agents/seo.html" },
    "sales/convert": { label: "Public replies to high-intent leads", page: "/agents/sales.html" },
    "sales/lead-status": { label: "Lead status", page: "/agents/sales.html" },
    "email/propose-sequence": { label: "Send a sequence", page: "/email-agent.html" },
    "social/propose-post": { label: "Publish a post", page: "/agents/social.html" }
  };
  var DECIDE = "decide";
  var AUTO_TEXT = "Lets background passes act for this agent (schedules, store proposals, self-review)";
  // The dispatcher's refusal names (dispatchToolCall, POST /api/assignments/dispatch), in plain words.
  var REASON_WORDS = {
    chaining_disabled: "running plans is switched off on the server",
    chain_total_calls_reached: "this chain has made all the calls it may (CHAIN_MAX_CALLS)",
    chain_depth_reached: "the chain is as deep as it may go (CHAIN_MAX_DEPTH)",
    chain_fanout_reached: "one step has dispatched all it may (CHAIN_MAX_FANOUT)",
    dispatch_rate_reached: "too many dispatches in a short time; wait a minute",
    tool_takes_external_action: "this tool acts, so it goes through approval on its own page",
    tool_not_in_router: "the plan names a tool that does not exist",
    tool_has_no_spec: "the tool's inputs cannot be checked",
    body_missing_required_fields: "the plan left a required input empty",
    entitlement_unknown: "your subscription could not be checked",
    not_entitled: "this account is not entitled to run it",
    plan_not_found: "no such plan belongs to this account",
    not_an_executive_plan: "that task is not a plan",
    plan_has_no_output: "the plan has nothing stored to run",
    assignment_not_in_plan: "the plan has no such assignment",
    assignment_not_dispatchable: "the plan marked it not dispatchable",
    handler_error: "the tool failed while running"
  };
  var NEXT_WORDS = {
    no_schedule: "No schedule", disabled: "Schedule off", paused: "Paused", scheduler_off: "Scheduler off",
    autonomy_off: "Autonomy off", subscription_inactive: "Subscription inactive", subscription_unknown: "Subscription unknown",
    no_slot_in_32_days: "None in 32 days"
  };
  var STATUS_WORDS = { completed: "Completed", failed: "Failed", processing: "In progress", requires_approval: "Awaiting approval" };
  var NOW_WORDS = { running: "Running", stalled: "Stalled", idle: "Idle" };
  var FILTERS = {
    all: function () { return true; },
    running: function (a) { return a.now && a.now.state === "running"; },
    approval: function (a) { return a.proposals && a.proposals.pending > 0; },
    failed: function (a) { return a.runs && a.runs.failed_7d > 0; },
    scheduled: function (a) { return !!(a.next && a.next.at); }
  };
  var FILTER_LABELS = { all: "All", running: "Running", approval: "Needs approval", failed: "Failed in 7 days", scheduled: "Scheduled" };

  var poll = { timer: null, base: HQ_IDLE_MS, failures: 0, stopped: null, note: "", at: 0 };
  var view = { filter: "all", sort: "attention", data: null, cc: null, queue: null, queueError: "", decided: {}, planPick: null };
  // In-flight guards (one request per click) and what each answer said.
  var act = { sending: false, dispatching: {}, controls: {}, said: {}, lastPlan: null, recognition: null, listening: false, lastAgent: null };

  // The one place Headquarters navigates.
  function go(url) { window.location.assign(url); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function tok() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function unread(v) { return !!v && typeof v === "object" && v.unavailable !== undefined; }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function age(iso) {
    var mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (isNaN(mins)) return "";
    if (mins < 60) return mins + " min ago";
    if (mins < 2880) return Math.round(mins / 60) + " h ago";
    return Math.round(mins / 1440) + " d ago";
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function money(n) { return "$" + Number(n).toFixed(2); }
  function still() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }

  /* ── the tile's words, exactly as /live says them ── */
  function nowText(a) { return unread(a.now) ? "Could not be read" : (NOW_WORDS[a.now && a.now.state] || "Idle"); }
  function lastText(a) {
    if (unread(a.runs)) return "Could not be read";
    var l = a.runs && a.runs.last;
    if (!l) return "No runs yet";
    return (STATUS_WORDS[l.status] || l.status) + " · " + when(l.finished_at || l.started_at);
  }
  function nextText(a) {
    if (unread(a.next)) return "Could not be read";
    if (a.next && a.next.at) return when(a.next.at);
    return NEXT_WORDS[a.next_reason] || "Not scheduled";
  }
  function approvalsText(a) {
    if (unread(a.proposals)) return "Could not be read";
    var n = a.proposals ? a.proposals.pending : 0;
    return n ? n + " waiting" : "None waiting";
  }
  function scoreText(a) {
    if (unread(a.score)) return "Could not be read";
    var s = a.score || {};
    return s.up || s.down ? s.up + " helpful · " + s.down + " not helpful" : "No ratings yet";
  }

  // Lower is more urgent: stalled or failed, then waiting on you, then running.
  function rank(a) {
    if ((a.now && a.now.state === "stalled") || (a.runs && a.runs.failed_7d > 0)) return 0;
    if (a.proposals && a.proposals.pending > 0) return 1;
    if (a.now && a.now.state === "running") return 2;
    return 3;
  }
  function ordered(list) {
    return list.slice().sort(function (x, y) {
      if (view.sort === "attention") { var d = rank(x) - rank(y); if (d) return d; }
      return String(x.name).localeCompare(String(y.name));
    });
  }

  function renderGrid() {
    var grid = document.getElementById("hqGrid");
    var empty = document.getElementById("hqGridEmpty");
    if (!grid || !view.data) return;
    var agents = view.data.agents || {};
    var list = Object.keys(agents).map(function (k) { return agents[k]; }).filter(FILTERS[view.filter]);
    grid.textContent = "";
    ordered(list).forEach(function (a) {
      var meta = AGENTS[a.type] || { page: "#", accent: "#e2e8f0" };
      var b = el("button", "hq-tile");
      b.type = "button";
      b.setAttribute("data-hq-agent", a.type);
      b.style.setProperty("--hq-accent", meta.accent);
      var state = unread(a.now) ? "unread" : (a.now && a.now.state) || "idle";
      b.classList.add("is-" + state);
      if (rank(a) === 0) b.classList.add("is-attention");
      b.appendChild(el("span", "hq-ring")).setAttribute("aria-hidden", "true");
      b.appendChild(el("span", "hq-name", a.name));
      b.appendChild(el("span", "hq-now", nowText(a)));
      [["Last", lastText(a)], ["Next", nextText(a)], ["Approvals", approvalsText(a)], ["Score", scoreText(a)]].forEach(function (row) {
        var r = el("span", "hq-row");
        r.appendChild(el("span", "hq-k", row[0]));
        r.appendChild(el("span", "hq-v", row[1]));
        b.appendChild(r);
      });
      b.setAttribute("aria-label", a.name + ": " + nowText(a) + ". Last: " + lastText(a) + ". Next: " + nextText(a) + ". Approvals: " +
        approvalsText(a) + ". Score: " + scoreText(a) + ". Opens the " + a.name + " page.");
      b.addEventListener("click", function () { go(meta.page); });
      // The controls sit beside the tile, never inside it: a button cannot hold buttons, and a control must not open the page.
      var card = el("div", "hq-card");
      card.setAttribute("data-hq-card", a.type);
      card.style.setProperty("--hq-accent", meta.accent);
      card.appendChild(b);
      card.appendChild(controlsFor(a));
      grid.appendChild(card);
    });
    if (empty) {
      empty.hidden = list.length !== 0;
      empty.textContent = list.length ? "" : "No agent matches “" + FILTER_LABELS[view.filter] + "” right now.";
    }
  }

  /* ── alerts: each from a real field, each linked to where it is fixed ── */
  function alertsOf() {
    var out = [];
    var d = view.data;
    if (d && d.agents) {
      var agents = Object.keys(d.agents).map(function (k) { return d.agents[k]; });
      var failed = 0, waiting = 0, unreadRuns = false;
      agents.forEach(function (a) {
        if (unread(a.runs)) unreadRuns = true; else failed += a.runs.failed_7d || 0;
        if (!unread(a.proposals)) waiting += a.proposals.pending || 0;
      });
      // Each lands on the deck's tab that holds it: failed runs and approvals are on Approvals.
      if (unreadRuns) out.push({ alert: true, text: "Runs could not be read, so failures are not known", href: "#approvals" });
      else if (failed) out.push({ alert: true, text: plural(failed, "failed run", "failed runs") + " in 7 days", href: "#approvals" });
      if (waiting) out.push({ alert: true, text: plural(waiting, "approval", "approvals") + " waiting", href: "#approvals" });
      agents.forEach(function (a) {
        var s = a.schedule;
        if (s && !unread(s) && s.paused && s.consecutive_failures > 0) {
          out.push({ alert: true, text: a.name + " schedule paused after " + plural(s.consecutive_failures, "failed run", "failed runs"), href: (AGENTS[a.type] || {}).page });
        }
        if (a.now && a.now.state === "stalled") {
          out.push({ alert: true, text: a.name + ": a run has been in progress over " + d.stall_after_min + " minutes", href: "/run.html?id=" + encodeURIComponent(a.now.task_id) });
        }
      });
      var calls = d.daily_calls;
      if (unread(calls) || !calls) out.push({ alert: true, text: "Model calls today could not be counted", href: null });
      else out.push({ alert: calls.used >= calls.limit, text: "Model calls today: " + calls.used + " of " + calls.limit +
        (calls.used >= calls.limit ? " — the daily limit is reached; it resets at midnight UTC" : ""), href: null });
      if (d.subscription_active === true) out.push({ alert: false, text: "Subscription active", href: "/billing.html" });
      else if (d.subscription_active === false) out.push({ alert: true, text: "Subscription not active — scheduled runs wait until it is", href: "/billing.html" });
      else out.push({ alert: true, text: "Subscription could not be checked", href: "/billing.html" });
    }
    var cc = view.cc;
    if (cc && cc.spend) {
      var sp = cc.spend.ok === true ? cc.spend.data : null;
      if (!sp || typeof sp.usd !== "number") out.push({ alert: true, text: "This month's spend could not be read", href: "#history" });
      else if (typeof sp.monthly_cap_usd !== "number") out.push({ alert: true, text: "Spend this month: " + money(sp.usd) + " — the monthly cap is not a usable number, so model calls are refused", href: "#history" });
      else out.push({ alert: sp.usd >= sp.monthly_cap_usd, text: "Spend this month: " + money(sp.usd) + " of " + money(sp.monthly_cap_usd) +
        (sp.usd >= sp.monthly_cap_usd ? " — the cap is reached; calls on your own key are not counted" : ""), href: sp.usd >= sp.monthly_cap_usd ? "/settings.html" : "#history" });
    }
    // The platform section exists only in an admin's answer; its ceiling only there.
    if (cc && cc.platform && cc.platform.ok === true && cc.platform.data && cc.platform.data.ceiling) {
      var c = cc.platform.data.ceiling;
      if (unread(c)) out.push({ alert: true, text: "Platform ceiling could not be read: " + c.unavailable, href: "#history" });
      else out.push({ alert: c.spent_usd >= c.cap_usd * 0.8, text: "Platform ceiling today: " + money(c.spent_usd) + " of " + money(c.cap_usd), href: "#history" });
    }
    return out;
  }
  function renderAlerts() {
    var box = document.getElementById("hqAlerts");
    if (!box) return;
    box.textContent = "";
    var list = alertsOf();
    var live = list.filter(function (x) { return x.alert; }).length;
    box.appendChild(el("div", "hq-alerts-head", live ? plural(live, "alert", "alerts") : "No alerts — nothing failed, stalled or waiting"));
    var row = el("div", "hq-alerts-list");
    list.forEach(function (x) {
      var n = el(x.href ? "a" : "span", "hq-alert" + (x.alert ? " is-alert" : ""), x.text);
      if (x.href) n.setAttribute("href", x.href);
      row.appendChild(n);
    });
    box.appendChild(row);
  }

  /* ── the approval queue ── */
  function renderQueue() {
    var box = document.getElementById("hqQueue");
    if (!box) return;
    box.textContent = "";
    // The Approvals tab's count: what is waiting now, or null while unknown.
    if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("bf:hq-queue", { detail: { count: view.queueError || !view.queue ? null : view.queue.length } }));
    if (view.queueError) { box.appendChild(el("p", "hq-error", "The approval queue could not be read: " + view.queueError)); return; }
    if (!view.queue) { box.appendChild(el("p", "hq-muted", "Loading…")); return; }
    if (!view.queue.length) { box.appendChild(el("p", "hq-muted", "Nothing is waiting for your approval.")); return; }
    var ul = el("ul", "hq-queue");
    view.queue.forEach(function (p) {
      var li = el("li", "hq-proposal");
      li.setAttribute("data-proposal", p.id);
      var head = el("div", "hq-proposal-head");
      var agent = view.data && view.data.agents && view.data.agents[p.agent_type];
      head.appendChild(el("span", "hq-proposal-agent", agent ? agent.name : (p.agent_type || "An agent")));
      head.appendChild(el("span", "hq-proposal-age", age(p.created_at)));
      li.appendChild(head);
      li.appendChild(el("div", "hq-proposal-title", p.title || "Untitled proposal"));
      var actions = el("div", "hq-proposal-actions");
      var approve = el("button", "hq-btn hq-btn-go", "Approve");
      approve.type = "button";
      approve.setAttribute("data-hq-decide", "approve");
      var reject = el("button", "hq-btn", "Reject");
      reject.type = "button";
      reject.setAttribute("data-hq-decide", "reject");
      var full = el("a", "hq-link", "Full view");
      full.setAttribute("href", "/proposals.html");
      actions.appendChild(approve); actions.appendChild(reject); actions.appendChild(full);
      li.appendChild(actions);
      var said = view.decided[p.id];
      var msg = el("div", "hq-proposal-msg", typeof said === "string" ? said : "");
      msg.setAttribute("role", "status");
      // A 402 keeps the proposal pending; the notice carries its Billing link (scripts/bf-paywall.js).
      if (said && typeof said === "object" && window.bfPaywall) window.bfPaywall.render(msg, said);
      li.appendChild(msg);
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  function loadQueue() {
    var token = tok();
    if (!token) { view.queueError = "you are not signed in"; renderQueue(); return Promise.resolve(); }
    return fetch(API_URL + "/api/proposals?status=pending", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (body) {
        if (!body || !Array.isArray(body.proposals)) throw new Error("the answer had no list");
        view.queueError = "";
        view.queue = body.proposals.filter(function (p) { return p && p.status === "pending"; });
        renderQueue();
      })
      .catch(function (e) { view.queueError = (e && e.message) || "the request failed"; renderQueue(); });
  }
  // A human click, and only that: one request per click, both buttons held while it is out.
  function decide(button) {
    var li = button.closest ? button.closest("[data-proposal]") : null;
    if (!li || button.disabled) return;
    var id = li.getAttribute("data-proposal");
    var action = button.getAttribute("data-hq-decide");
    if (action !== "approve" && action !== "reject") return;
    Array.prototype.forEach.call(li.querySelectorAll("button"), function (b) { b.disabled = true; });
    button.textContent = action === "approve" ? "Approving…" : "Rejecting…";
    return fetch(API_URL + "/api/proposals/" + encodeURIComponent(id) + "/" + action, {
      method: "POST",
      headers: { "Authorization": "Bearer " + (tok() || "") }
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (r.status === 409) view.decided[id] = "This proposal is no longer pending.";
          else if (!r.ok) {
            var paywall = window.bfPaywall && window.bfPaywall.from(r.status, body);
            view.decided[id] = paywall || (body.error || "Could not " + action + " this proposal");
          } else view.decided[id] = "";
        });
      })
      .catch(function (e) { view.decided[id] = (e && e.message) || "Could not " + action + " this proposal"; })
      .then(function () {
        if (window.BFCommandCenter && typeof window.BFCommandCenter.load === "function") window.BFCommandCenter.load();
        return loadQueue();
      });
  }

  /* ── the act side: requests, and what a refusal is called ── */
  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + (tok() || "") } };
    if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    return fetch(API_URL + path, init).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (e) { parsed = t; }
        return { status: r.status, ok: r.ok, body: parsed };
      });
    });
  }
  function name(type) { return (AGENTS[type] && AGENTS[type].name) || type || "An agent"; }
  function reasonWords(reason) { return REASON_WORDS[reason] || String(reason || "no reason given").replace(/_/g, " "); }
  // Every refusal by name, in plain words, with where to go when there is somewhere.
  function refusalOf(status, body) {
    var b = body && typeof body === "object" ? body : {};
    var msg = typeof body === "string" ? body : typeof b.error === "string" ? b.error : typeof b.detail === "string" ? b.detail : "";
    if (status === 402) {
      return { kind: "refusal", name: "Subscription required", text: b.message || msg || "This needs an active subscription.", href: b.billing_url || "/billing.html", go: "Open Billing" };
    }
    if (status === 429) {
      if (/^BizForce has reached today's AI usage limit/.test(msg)) return { kind: "refusal", name: "The platform's daily AI limit is reached", text: msg };
      if (/^Daily model-call limit reached/.test(msg)) return { kind: "refusal", name: "Your daily model-call cap is reached", text: msg, href: "#command", go: "See today's count" };
      return { kind: "refusal", name: "Too many requests", text: "More than 20 AI requests in a minute. Wait a minute, then press it again." };
    }
    if (b.refused_reason === "not_entitled" || b.refused_reason === "entitlement_unknown") {
      return { kind: "refusal", name: "Not entitled", text: "The server says " + reasonWords(b.refused_reason) + ".", href: "/billing.html", go: "Open Billing" };
    }
    if (b.refused_reason === "chaining_disabled") return { kind: "refusal", name: "Running plans is switched off on the server", text: "ENABLE_AGENT_CHAINING is not on, so nothing was dispatched." };
    if (b.refused_reason) return { kind: "refusal", name: "Refused: " + reasonWords(b.refused_reason), text: b.detail || "" };
    if (status === 401) return { kind: "refusal", name: "Signed out", text: "Sign in again, then press it again.", href: "/app.html", go: "Sign in" };
    return { kind: "refusal", name: "Not done (" + status + ")", text: msg || "The server gave no reason." };
  }
  function failureOf(e) { return { kind: "refusal", name: "The request did not complete", text: (e && e.message) || "Check the connection and press it again." }; }
  function renderSaid(box, said) {
    box.textContent = "";
    box.className = box.className.replace(/\s*is-(ok|refusal|info)\b/g, "");
    if (!said) return;
    box.classList.add("is-" + said.kind);
    if (said.name) box.appendChild(el("strong", "hq-said-name", said.name + (said.text ? ". " : "")));
    if (said.text) box.appendChild(document.createTextNode(said.text));
    if (said.href) {
      box.appendChild(document.createTextNode(" "));
      var a = el("a", "hq-link", said.go || "Open");
      a.setAttribute("href", said.href);
      box.appendChild(a);
    }
    if (said.open) {
      box.appendChild(document.createTextNode(" "));
      var b = el("button", "hq-btn", said.open.label);
      b.type = "button";
      b.setAttribute("data-hq-open", said.open.page);
      box.appendChild(b);
    }
  }
  function refreshNow() {
    if (poll.timer) clearTimeout(poll.timer);
    poll.timer = null;
    fetchLive();
  }
  function reloadCenter() {
    if (window.BFCommandCenter && typeof window.BFCommandCenter.load === "function") window.BFCommandCenter.load();
  }

  /* ── the controls beside each tile ── */
  function controlsFor(a) {
    var row = el("div", "hq-controls");
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", a.name + " controls");
    var busy = !!act.controls[a.type];
    if (typeof a.autonomy === "boolean") {
      var auto = el("button", "hq-ctl" + (a.autonomy ? " is-on" : ""), "Automatic: " + (a.autonomy ? "On" : "Off"));
      auto.type = "button";
      auto.setAttribute("data-hq-ctl", "autonomy");
      auto.setAttribute("data-hq-for", a.type);
      auto.setAttribute("aria-pressed", a.autonomy ? "true" : "false");
      auto.setAttribute("aria-describedby", "hqAutoNote");
      auto.setAttribute("title", AUTO_TEXT);
      auto.disabled = busy;
      row.appendChild(auto);
    }
    if (a.schedule && !unread(a.schedule)) {
      var paused = a.schedule.paused === true;
      var sched = el("button", "hq-ctl", paused ? "Resume schedule" : "Pause schedule");
      sched.type = "button";
      sched.setAttribute("data-hq-ctl", paused ? "resume" : "pause");
      sched.setAttribute("data-hq-for", a.type);
      sched.setAttribute("aria-label", (paused ? "Resume " : "Pause ") + a.name + "'s schedule");
      sched.disabled = busy;
      row.appendChild(sched);
    }
    var msg = el("div", "hq-ctl-msg");
    msg.setAttribute("role", "status");
    renderSaid(msg, act.said["ctl:" + a.type]);
    row.appendChild(msg);
    return row;
  }
  function control(button) {
    var type = button.getAttribute("data-hq-for"), what = button.getAttribute("data-hq-ctl");
    if (button.disabled || act.controls[type] || !AGENTS[type]) return;
    var turnOn = button.getAttribute("aria-pressed") !== "true";
    act.controls[type] = true;
    button.disabled = true;
    var req = what === "autonomy"
      ? api("PUT", "/api/agent-autonomy", { agent_type: type, enabled: turnOn })
      : (what === "pause" || what === "resume") ? api("PUT", "/api/agent-schedules/" + encodeURIComponent(type) + "/" + what) : null;
    if (!req) { act.controls[type] = false; button.disabled = false; return; }
    return req.then(function (res) {
      act.said["ctl:" + type] = res.ok
        ? { kind: "ok", text: what === "autonomy" ? "Automatic is now " + (turnOn ? "on" : "off") + "." : what === "pause" ? "Schedule paused." : "Schedule resumed." }
        : refusalOf(res.status, res.body);
    }, function (e) { act.said["ctl:" + type] = failureOf(e); })
      .then(function () { act.controls[type] = false; renderGrid(); refreshNow(); });
  }

  /* ── the command box ── */
  function $(id) { return document.getElementById(id); }
  function buildConsole() {
    var pick = $("hqAgent"), chips = $("hqChips");
    if (!pick) return;
    var keys = Object.keys(AGENTS).sort(function (x, y) { return AGENTS[x].name.localeCompare(AGENTS[y].name); });
    pick.textContent = "";
    var first = el("option", null, "Let the Executive decide");
    first.value = DECIDE;
    pick.appendChild(first);
    keys.forEach(function (k) { var o = el("option", null, AGENTS[k].name); o.value = k; pick.appendChild(o); });
    if (chips) {
      chips.textContent = "";
      [DECIDE].concat(keys).forEach(function (k) {
        var c = el("button", "hq-chip", k === DECIDE ? "Executive decides" : AGENTS[k].name);
        c.type = "button";
        c.setAttribute("data-hq-chip", k);
        c.setAttribute("aria-pressed", k === pick.value ? "true" : "false");
        if (k !== DECIDE) c.style.setProperty("--hq-accent", AGENTS[k].accent);
        chips.appendChild(c);
      });
    }
    syncTools();
  }
  function choose(value) {
    var pick = $("hqAgent");
    if (!pick || (value !== DECIDE && !AGENTS[value])) return;
    if (value !== DECIDE) act.lastAgent = value;
    pick.value = value;
    syncTools();
  }
  /* The mode switch: "Make a plan" is "Executive decides"; "Do a task" goes back
     to the last agent picked, or the Executive itself. */
  function mode(which) {
    if (which === "plan") choose(DECIDE);
    else if (which === "task") choose(act.lastAgent || "executive");
  }
  // The Executive's own kinds of task, as its page declares them (window.AGENT_PROFILE_CONFIG.taskTypes).
  function taskKinds() {
    var cfg = window.AGENT_PROFILE_CONFIG;
    return cfg && cfg.agentType === "executive" && Array.isArray(cfg.taskTypes) ? cfg.taskTypes : [];
  }
  function syncTools() {
    var pick = $("hqAgent"), tool = $("hqTool"), wrap = $("hqToolWrap"), extras = $("hqPlanExtras"), label = $("hqCommandLabel");
    if (!pick || !tool) return;
    var agent = pick.value;
    Array.prototype.forEach.call(document.querySelectorAll("[data-hq-chip]"), function (c) {
      var on = c.getAttribute("data-hq-chip") === agent;
      c.classList.toggle("is-on", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
    tool.textContent = "";
    var words = el("option", null, "A task, in words");
    words.value = "";
    tool.appendChild(words);
    (TOOLS[agent] || []).forEach(function (t) { var o = el("option", null, t[1]); o.value = t[0]; tool.appendChild(o); });
    Object.keys(ACTING).filter(function (k) { return k.split("/")[0] === agent; }).forEach(function (k) {
      var o = el("option", null, ACTING[k].label + " — goes through approval");
      o.value = k.split("/")[1];
      tool.appendChild(o);
    });
    if (wrap) wrap.hidden = agent === DECIDE;
    if (extras) extras.hidden = agent !== DECIDE;
    if (label) label.textContent = agent === DECIDE ? "The goal" : "What should it do?";
    Array.prototype.forEach.call(document.querySelectorAll("[data-hq-mode]"), function (b) {
      var on = b.getAttribute("data-hq-mode") === (agent === DECIDE ? "plan" : "task");
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    syncKind();
  }
  // "Kind of task" shows for the Executive and a task in words only.
  function syncKind() {
    var pick = $("hqAgent"), tool = $("hqTool"), kind = $("hqTaskType"), wrap = $("hqTaskTypeWrap");
    if (!kind) return;
    var kinds = taskKinds();
    if (!kind.options.length && kinds.length) kinds.forEach(function (k) { var o = el("option", null, k.label); o.value = k.value; kind.appendChild(o); });
    var on = !!pick && pick.value === "executive" && !(tool && tool.value) && kinds.length > 0;
    if (wrap) wrap.hidden = !on;
    kind.disabled = !on;
  }
  function say(said) { var box = $("hqCommandMsg"); if (box) renderSaid(box, said); }
  function sent(ok) {
    var b = $("hqSend");
    if (!b) return;
    b.classList.remove("is-sent");
    // A success only; restarting the pulse needs a reflow between the two class changes.
    if (ok) { void b.offsetWidth; b.classList.add("is-sent"); }
  }
  function send() {
    var pick = $("hqAgent"), tool = $("hqTool"), box = $("hqCommand"), btn = $("hqSend");
    if (!pick || !box || !btn || act.sending) return;
    var agent = pick.value, toolId = tool && agent !== DECIDE ? tool.value : "", text = box.value.trim();
    sent(false);
    if (agent !== DECIDE && toolId) {
      var acting = ACTING[agent + "/" + toolId];
      if (acting) {
        // Never from here: the page's own approval flow runs it.
        say({ kind: "info", name: "This one goes through approval on its own page.", text: "", open: { label: "Open " + acting.label + " on its page", page: acting.page } });
        return;
      }
      say({ kind: "info", text: "Opening it on the " + name(agent) + " page. Nothing runs until you press its own button there." });
      go(AGENTS[agent].page + "#tool=" + encodeURIComponent(toolId) + (text ? "&prefill=" + encodeURIComponent(text.slice(0, 2000)) : ""));
      return;
    }
    if (!text) { say({ kind: "info", text: agent === DECIDE ? "Write the goal first." : "Write the task first." }); box.focus(); return; }
    act.sending = true;
    btn.disabled = true;
    btn.textContent = agent === DECIDE ? "Planning…" : "Sending…";
    var req;
    if (agent === DECIDE) {
      var body = { goal: text };
      var horizon = $("hqHorizon"), constraints = $("hqConstraints");
      if (horizon && horizon.value.trim()) body.horizon = horizon.value.trim();
      if (constraints && constraints.value.trim()) body.constraints = constraints.value.trim();
      req = api("POST", "/api/agents/executive/plan", body).then(function (res) {
        if (!res.ok || !res.body || !Array.isArray(res.body.assignments)) { say(res.ok ? refusalOf(500, { error: "The plan came back without assignments." }) : refusalOf(res.status, res.body)); return; }
        var list = res.body.assignments;
        var ready = list.filter(function (x) { return x && x.is_dispatchable === true; }).length;
        act.lastPlan = { id: res.body.task_id, goal: text, assignments: list.map(function (x) {
          return { id: x.id, agent: x.agent || null, tool: x.tool || null, task: x.task || null, is_dispatchable: x.is_dispatchable === true, latest_dispatch: "not dispatched" };
        }) };
        view.planPick = res.body.task_id || view.planPick;
        say({ kind: "ok", name: "Plan ready", text: plural(list.length, "assignment", "assignments") + ", " + ready + " of them can run from here, one at a time, on the Plans tab.", href: "#plans", go: "See the plan" });
        box.value = "";
        sent(true);
        renderBoard();
        reloadCenter();
      });
    } else {
      var task = { agent_type: agent, prompt: text };
      var kind = $("hqTaskType");
      if (kind && !kind.disabled && kind.value) task.task_type = kind.value;
      req = api("POST", "/api/ai/tasks", task).then(function (res) {
        if (res.status !== 202 || !res.body || !res.body.task) { say(refusalOf(res.status, res.body)); return; }
        say({ kind: "ok", name: "Queued (202)", text: name(agent) + " has the task; it shows on the agent's tile while it runs.", href: "/run.html?id=" + encodeURIComponent(res.body.task.id), go: "Follow the run" });
        box.value = "";
        sent(true);
        refreshNow();
      });
    }
    return req.catch(function (e) { say(failureOf(e)); }).then(function () {
      act.sending = false;
      btn.disabled = false;
      btn.textContent = "Send";
    });
  }

  /* ── the plan runner: one assignment per click ── */
  function stepOf(a) {
    if (a.is_dispatchable !== true) return { col: "ready", key: "blocked", text: "Not dispatchable" };
    var d = a.latest_dispatch;
    if (!d || typeof d !== "object") return { col: "ready", key: "ready", text: "Ready" };
    if (d.outcome === "refused") return { col: "ready", key: "refused", text: "Refused: " + reasonWords(d.refused_reason) };
    if (d.outcome === "failed") return { col: "done", key: "failed", text: "Failed" };
    // ran: the dispatched run's own ai_tasks status.
    if (d.tool_task_status === "completed") return { col: "done", key: "completed", text: "Completed" };
    if (d.tool_task_status === "failed") return { col: "done", key: "failed", text: "Failed" };
    if (d.tool_task_status === null || d.tool_task_status === undefined) return { col: "done", key: "gone", text: "Ran — the run can no longer be read" };
    return { col: "running", key: "running", text: "Running" };
  }
  function nextOf(plan) {
    return (plan.assignments || []).filter(function (a) { var k = stepOf(a).key; return k === "ready" || k === "refused"; })[0] || null;
  }
  function progressOf(plan) {
    var n = { done: 0, failed: 0, running: 0, waiting: 0 };
    (plan.assignments || []).forEach(function (a) {
      var k = stepOf(a).key;
      if (k === "completed" || k === "gone") n.done += 1;
      else if (k === "failed") n.failed += 1;
      else if (k === "running") n.running += 1;
      else n.waiting += 1;
    });
    var total = (plan.assignments || []).length;
    return n.done + " of " + total + " done · " + n.failed + " failed · " + (n.running ? n.running + " running · " : "") + n.waiting + " waiting";
  }
  function plansNow() {
    var cc = view.cc;
    var list = cc && cc.plans && cc.plans.ok === true && Array.isArray(cc.plans.data) ? cc.plans.data.slice() : null;
    if (act.lastPlan && act.lastPlan.id && (!list || !list.some(function (p) { return p.id === act.lastPlan.id; }))) (list = list || []).unshift(act.lastPlan);
    return list;
  }
  function renderBoard() {
    var box = $("hqPlans");
    if (!box) return;
    box.textContent = "";
    var cc = view.cc;
    var plans = plansNow();
    if (!plans) {
      if (cc && cc.plans && cc.plans.ok === false) box.appendChild(el("p", "hq-error", "Plans could not be read: " + (cc.plans.error || "the server gave no reason")));
      else box.appendChild(el("p", "hq-muted", "Loading…"));
      return;
    }
    if (!plans.length) { syncPicker([]); box.appendChild(el("p", "hq-muted", "No plans yet. On the Command tab choose “Make a plan”, write a goal and press Send.")); return; }
    var off = cc && cc.chaining_on === false;
    if (!plans.some(function (p) { return p.id === view.planPick; })) view.planPick = plans[0].id;
    syncPicker(plans);
    plans.forEach(function (plan) {
      var card = el("article", "hq-plan");
      card.setAttribute("data-hq-plan", plan.id);
      // Every plan is drawn once; only the picked one shows.
      card.hidden = plan.id !== view.planPick;
      var head = el("div", "hq-plan-head");
      head.appendChild(el("h4", "hq-plan-goal", plan.goal || "A plan with no goal written"));
      head.appendChild(el("p", "hq-progress", progressOf(plan)));
      card.appendChild(head);
      var next = nextOf(plan);
      var bar = el("div", "hq-plan-bar");
      var run = el("button", "hq-btn hq-btn-go", act.dispatching[plan.id] ? "Running…" : "Run next");
      run.type = "button";
      run.setAttribute("data-hq-run-next", plan.id);
      run.disabled = off || !next || !!act.dispatching[plan.id];
      run.setAttribute("aria-label", next ? "Run next: assignment " + next.id + ", " + name(next.agent) + " · " + next.tool : "Run next: nothing is ready to run");
      bar.appendChild(run);
      if (off) bar.appendChild(el("span", "hq-muted", "Running plans is switched off on the server"));
      else if (!next) bar.appendChild(el("span", "hq-muted", "Nothing is ready to run"));
      else bar.appendChild(el("span", "hq-muted", "Next: " + name(next.agent) + " · " + next.tool));
      card.appendChild(bar);
      var msg = el("div", "hq-plan-msg");
      msg.setAttribute("role", "status");
      renderSaid(msg, act.said["plan:" + plan.id]);
      card.appendChild(msg);
      var cols = el("div", "hq-cols");
      [["ready", "Ready"], ["running", "Running"], ["done", "Done"]].forEach(function (c) {
        var col = el("div", "hq-col");
        col.setAttribute("data-col", c[0]);
        col.appendChild(el("h5", "hq-col-h", c[1]));
        var ul = el("ul", "hq-acards");
        ul.setAttribute("aria-label", c[1]);
        (plan.assignments || []).forEach(function (a) {
          var st = stepOf(a);
          if (st.col !== c[0]) return;
          var li = el("li", "hq-acard is-" + st.key);
          li.setAttribute("data-assignment", a.id);
          if (a.agent && AGENTS[a.agent]) li.style.setProperty("--hq-accent", AGENTS[a.agent].accent);
          li.appendChild(el("div", "hq-acard-who", "#" + a.id + " · " + name(a.agent) + (a.tool ? " · " + a.tool : "")));
          if (a.task) li.appendChild(el("div", "hq-acard-task", String(a.task).slice(0, 160)));
          li.appendChild(el("div", "hq-astatus", st.text));
          var d = a.latest_dispatch;
          if (d && typeof d === "object" && d.tool_task_id && st.col === "done") {
            // Done: the result opens in the drawer, beside the board, with "Open full run" inside it.
            var vr = el("button", "hq-btn", "View result");
            vr.type = "button";
            vr.setAttribute("data-hq-view", d.tool_task_id);
            vr.setAttribute("aria-label", "View result: assignment " + a.id + ", " + name(a.agent));
            li.appendChild(vr);
          } else if (d && typeof d === "object" && d.tool_task_id) {
            var r = el("a", "hq-link", "Open the run");
            r.setAttribute("href", "/run.html?id=" + encodeURIComponent(d.tool_task_id));
            li.appendChild(r);
          }
          if (st.key === "blocked" && a.agent && AGENTS[a.agent]) {
            var p = el("a", "hq-link", "Open the " + name(a.agent) + " page");
            p.setAttribute("href", AGENTS[a.agent].page + (a.tool && (TOOLS[a.agent] || []).some(function (t) { return t[0] === a.tool; }) ? "#tool=" + encodeURIComponent(a.tool) : ""));
            li.appendChild(p);
          }
          ul.appendChild(li);
        });
        col.appendChild(ul);
        cols.appendChild(col);
      });
      card.appendChild(cols);
      box.appendChild(card);
    });
  }
  // The picker: shown only when there is more than one plan; each option a plan's goal and day.
  function syncPicker(plans) {
    var pick = $("hqPlanPick"), wrap = $("hqPlanPickWrap");
    if (!pick) return;
    if (wrap) wrap.hidden = plans.length < 2;
    pick.textContent = "";
    plans.forEach(function (p) {
      var o = el("option", null, (p.goal || "A plan with no goal written").slice(0, 80) + (p.created_at ? " · " + when(p.created_at) : ""));
      o.value = p.id;
      pick.appendChild(o);
    });
    pick.value = view.planPick || "";
  }
  // "View result": the deck's drawer where there is one, else the run's own page.
  function viewResult(id) {
    if (window.BFExecDeck && typeof window.BFExecDeck.openRun === "function") window.BFExecDeck.openRun(id);
    else go("/run.html?id=" + encodeURIComponent(id));
  }
  // One click, one dispatch: the server mints a new chain at depth 0 and applies every guard.
  function runNext(button) {
    var planId = button.getAttribute("data-hq-run-next");
    if (button.disabled || act.dispatching[planId]) return;
    var plan = (plansNow() || []).filter(function (p) { return p.id === planId; })[0];
    var next = plan && nextOf(plan);
    if (!next) return;
    act.dispatching[planId] = true;
    button.disabled = true;
    button.textContent = "Running…";
    return api("POST", "/api/assignments/dispatch", { executive_task_id: planId, assignment_id: Number(next.id) })
      .then(function (res) {
        var b = res.body && typeof res.body === "object" ? res.body : {};
        if (res.ok && b.ok === true) {
          var taskId = b.result && b.result.task_id;
          act.said["plan:" + planId] = { kind: "ok", name: "Started", text: name(next.agent) + " · " + next.tool + " (assignment " + next.id + ").", href: taskId ? "/run.html?id=" + encodeURIComponent(taskId) : null, go: "Follow the run" };
          sent(false);
        } else if (res.ok && !b.refused_reason && typeof b.status === "number") {
          // The tool was reached and answered with an error: named by its own status and words.
          act.said["plan:" + planId] = refusalOf(b.status, { error: b.detail || (b.result && b.result.error) || "" });
        } else act.said["plan:" + planId] = refusalOf(res.ok ? 200 : res.status, b && Object.keys(b).length ? b : res.body);
      }, function (e) { act.said["plan:" + planId] = failureOf(e); })
      .then(function () { act.dispatching[planId] = false; renderBoard(); reloadCenter(); refreshNow(); });
  }

  /* ── voice: the browser's own speech service fills the box, and nothing else ── */
  function voice() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var mic = $("hqMic"), note = $("hqMicNote");
    if (!SR || !mic) return;
    mic.hidden = false;
    if (note) note.hidden = false;
    mic.addEventListener("click", function () {
      if (act.listening && act.recognition) { act.recognition.stop(); return; }
      var r;
      try { r = new SR(); } catch (e) { return; }
      r.lang = document.documentElement.lang || "en-US";
      r.interimResults = false;
      r.continuous = false;
      r.maxAlternatives = 1;
      r.onresult = function (e) {
        var words = "";
        for (var i = e.resultIndex || 0; i < e.results.length; i++) words += e.results[i][0].transcript;
        words = words.trim();
        var box = $("hqCommand");
        if (!words || !box) return;
        box.value = box.value.trim() ? box.value.replace(/\s*$/, " ") + words : words;
        box.focus();
      };
      r.onerror = function (e) { say({ kind: "info", text: "Voice stopped" + (e && e.error ? " (" + e.error + ")" : "") + "; the box keeps what it heard." }); };
      r.onend = function () {
        act.listening = false;
        mic.setAttribute("aria-pressed", "false");
        mic.textContent = "Speak";
      };
      act.recognition = r;
      act.listening = true;
      mic.setAttribute("aria-pressed", "true");
      mic.textContent = "Listening… press to stop";
      try { r.start(); } catch (e2) { r.onend(); }
    });
  }

  /* ── the status line and polling, as the agent panel does it ── */
  function status() {
    var s = document.getElementById("hqStatus");
    if (!s) return;
    var text;
    if (poll.stopped === "hidden") text = "Paused while this tab is hidden";
    else if (poll.stopped === "offline") text = "Offline — Headquarters paused";
    else if (poll.stopped === "signed-out") text = "Sign in to see your agents";
    else if (poll.note) text = poll.note;
    else if (poll.at) text = "Updated " + new Date(poll.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " · every " + Math.round(poll.base / 1000) + " s";
    else text = "Loading…";
    s.textContent = text;
  }
  function offline() {
    if (window.BFOffline && typeof window.BFOffline.isOffline === "function" && window.BFOffline.isOffline()) return true;
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }
  function schedule(ms) {
    if (poll.timer) clearTimeout(poll.timer);
    poll.timer = setTimeout(fetchLive, ms);
  }
  function stop(reason) {
    if (poll.timer) clearTimeout(poll.timer);
    poll.timer = null;
    poll.stopped = reason;
    status();
  }
  function backoff(code) {
    poll.failures += 1;
    var wait = Math.min(HQ_MAX_BACKOFF_MS, poll.base * Math.pow(2, poll.failures));
    poll.note = "Retrying in " + Math.round(wait / 1000) + "s — " + (code ? "the server answered " + code : "the request did not complete");
    status();
    schedule(wait);
  }
  function fetchLive() {
    poll.timer = null;
    if (document.hidden) { stop("hidden"); return; }
    if (offline()) { stop("offline"); return; }
    var token = tok();
    if (!token) { stop("signed-out"); return; }
    poll.stopped = null;
    fetch(API_URL + "/api/agents/live", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) {
        if (r.status === 429 || r.status >= 500) { backoff(r.status); return null; }
        if (!r.ok) { poll.note = "Headquarters could not be read (" + r.status + ")"; status(); schedule(poll.base); return null; }
        return r.json();
      })
      .then(function (data) {
        if (!data) return;
        if (!data.agents) throw new Error("the answer had no agents");
        var before = view.data ? totalWaiting(view.data) : null;
        poll.failures = 0;
        poll.note = "";
        poll.at = Date.now();
        view.data = data;
        var running = Object.keys(data.agents).some(function (k) { var a = data.agents[k]; return a.now && a.now.state === "running"; });
        poll.base = running ? HQ_BUSY_MS : HQ_IDLE_MS;
        renderGrid();
        renderAlerts();
        if (before !== null && before !== totalWaiting(data)) loadQueue(); else renderQueue();
        status();
        schedule(poll.base);
      })
      .catch(function () {
        if (offline()) { stop("offline"); return; }
        backoff(0);
      });
  }
  function totalWaiting(d) {
    return Object.keys(d.agents || {}).reduce(function (n, k) { var p = d.agents[k].proposals; return n + (p && !unread(p) ? p.pending : 0); }, 0);
  }

  /* ── controls ── */
  function setFilter(name) {
    if (!FILTERS[name]) return;
    view.filter = name;
    Array.prototype.forEach.call(root.querySelectorAll("[data-hq-filter]"), function (b) {
      var on = b.getAttribute("data-hq-filter") === name;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderGrid();
  }
  function toggleSort() {
    view.sort = view.sort === "attention" ? "az" : "attention";
    var b = document.getElementById("hqSort");
    if (b) {
      b.textContent = view.sort === "attention" ? "Sort: attention" : "Sort: A–Z";
      b.setAttribute("aria-label", view.sort === "attention" ? "Sorted by attention; press to sort A to Z" : "Sorted A to Z; press to sort by attention");
    }
    renderGrid();
  }
  root.addEventListener("click", function (e) {
    var t = e.target;
    var f = t && t.closest ? t.closest("[data-hq-filter]") : null;
    if (f) { setFilter(f.getAttribute("data-hq-filter")); return; }
    if (t && t.closest && t.closest("#hqSort")) { toggleSort(); return; }
    var c = t && t.closest ? t.closest("[data-hq-ctl]") : null;
    if (c) { control(c); return; }
    var chip = t && t.closest ? t.closest("[data-hq-chip]") : null;
    if (chip) { choose(chip.getAttribute("data-hq-chip")); return; }
    var md = t && t.closest ? t.closest("[data-hq-mode]") : null;
    if (md) { mode(md.getAttribute("data-hq-mode")); return; }
    var vw = t && t.closest ? t.closest("[data-hq-view]") : null;
    if (vw) { viewResult(vw.getAttribute("data-hq-view")); return; }
    if (t && t.closest && t.closest("#hqSend")) { send(); return; }
    var open = t && t.closest ? t.closest("[data-hq-open]") : null;
    if (open) { go(open.getAttribute("data-hq-open")); return; }
    var n = t && t.closest ? t.closest("[data-hq-run-next]") : null;
    if (n) { runNext(n); return; }
    var d = t && t.closest ? t.closest("[data-hq-decide]") : null;
    if (d) decide(d);
  });
  root.addEventListener("change", function (e) {
    if (e.target && e.target.id === "hqAgent") { if (e.target.value !== DECIDE) act.lastAgent = e.target.value; syncTools(); }
    else if (e.target && e.target.id === "hqTool") syncKind();
    else if (e.target && e.target.id === "hqPlanPick") { view.planPick = e.target.value; renderBoard(); }
  });
  // Arrow keys move between tiles; Home and End jump to the first and last.
  root.addEventListener("keydown", function (e) {
    var tile = e.target && e.target.closest ? e.target.closest(".hq-tile") : null;
    if (!tile) return;
    var tiles = Array.prototype.slice.call(root.querySelectorAll(".hq-tile"));
    var i = tiles.indexOf(tile), to = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = Math.min(tiles.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = Math.max(0, i - 1);
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = tiles.length - 1;
    if (to < 0) return;
    e.preventDefault();
    tiles[to].focus();
  });
  document.addEventListener("bf:command-center", function (e) {
    view.cc = e && e.detail && !e.detail.error ? e.detail : null;
    renderAlerts();
    renderBoard();
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop("hidden");
    else fetchLive();
  });
  window.addEventListener("offline", function () { stop("offline"); });
  window.addEventListener("online", function () { fetchLive(); });

  if (still()) root.classList.add("hq--still");
  window.BFHeadquarters = { poll: poll, view: view, act: act, refresh: fetchLive, progressOf: progressOf, stepOf: stepOf, queueCount: function () { return view.queue ? view.queue.length : null; } };
  buildConsole();
  voice();
  renderBoard();
  renderQueue();
  loadQueue();
  fetchLive();
})();

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

   textContent only. Motion: a pulse on a running agent and on a real alert,
   nothing else, and none under prefers-reduced-motion.
   ══════════════════════════════════════════════════════════════════════════ */
(function headquarters() {
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var root = document.getElementById("hq");
  if (!root) return;

  var HQ_IDLE_MS = 60000;
  var HQ_BUSY_MS = 15000;
  var HQ_MAX_BACKOFF_MS = 300000;

  // Each agent's page and accent, as the page's own AGENT_PROFILE_CONFIG has it.
  var AGENTS = {
    ads:                { page: "/ads-agent.html",                accent: "#818cf8" },
    analytics:          { page: "/agents/analytics.html",         accent: "#60a5fa" },
    broker:             { page: "/broker-agent.html",             accent: "#c084fc" },
    community:          { page: "/community-agent.html",          accent: "#4ade80" },
    content:            { page: "/agents/content.html",           accent: "#34d399" },
    email:              { page: "/email-agent.html",              accent: "#fbbf24" },
    etsy:               { page: "/etsy-agent.html",               accent: "#fb923c" },
    executive:          { page: "/executive-agent.html",          accent: "#e2e8f0" },
    influencer:         { page: "/influencer-agent.html",         accent: "#e879f9" },
    operations:         { page: "/operations-agent.html",         accent: "#94a3b8" },
    publicist:          { page: "/publicist-agent.html",          accent: "#fcd34d" },
    rd:                 { page: "/rd-agent.html",                 accent: "#22d3ee" },
    reputation:         { page: "/reputation-agent.html",         accent: "#f87171" },
    sales:              { page: "/agents/sales.html",             accent: "#a855f7" },
    seo:                { page: "/agents/seo.html",               accent: "#22d3ee" },
    social:             { page: "/agents/social.html",            accent: "#f472b6" },
    store:              { page: "/store-agent.html",              accent: "#38bdf8" },
    vertical_marketing: { page: "/vertical-marketing-agent.html", accent: "#a3e635" }
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
  var view = { filter: "all", sort: "attention", data: null, cc: null, queue: null, queueError: "", decided: {} };

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
    return s.up || s.down ? s.up + " up · " + s.down + " down" : "No ratings yet";
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
      b.addEventListener("click", function () { window.location.assign(meta.page); });
      grid.appendChild(b);
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
      if (unreadRuns) out.push({ alert: true, text: "Runs could not be read, so failures are not known", href: "#commandCenterSection" });
      else if (failed) out.push({ alert: true, text: plural(failed, "failed run", "failed runs") + " in 7 days", href: "#commandCenterSection" });
      if (waiting) out.push({ alert: true, text: plural(waiting, "approval", "approvals") + " waiting", href: "#hqQueue" });
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
      if (!sp || typeof sp.usd !== "number") out.push({ alert: true, text: "This month's spend could not be read", href: "#ccSpend" });
      else if (typeof sp.monthly_cap_usd !== "number") out.push({ alert: true, text: "Spend this month: " + money(sp.usd) + " — the monthly cap is not a usable number, so model calls are refused", href: "#ccSpend" });
      else out.push({ alert: sp.usd >= sp.monthly_cap_usd, text: "Spend this month: " + money(sp.usd) + " of " + money(sp.monthly_cap_usd) +
        (sp.usd >= sp.monthly_cap_usd ? " — the cap is reached; calls on your own key are not counted" : ""), href: sp.usd >= sp.monthly_cap_usd ? "/settings.html" : "#ccSpend" });
    }
    // The platform section exists only in an admin's answer; its ceiling only there.
    if (cc && cc.platform && cc.platform.ok === true && cc.platform.data && cc.platform.data.ceiling) {
      var c = cc.platform.data.ceiling;
      if (unread(c)) out.push({ alert: true, text: "Platform ceiling could not be read: " + c.unavailable, href: "#ccPlatformPanel" });
      else out.push({ alert: c.spent_usd >= c.cap_usd * 0.8, text: "Platform ceiling today: " + money(c.spent_usd) + " of " + money(c.cap_usd), href: "#ccPlatformPanel" });
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
    var d = t && t.closest ? t.closest("[data-hq-decide]") : null;
    if (d) decide(d);
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
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop("hidden");
    else fetchLive();
  });
  window.addEventListener("offline", function () { stop("offline"); });
  window.addEventListener("online", function () { fetchLive(); });

  if (still()) root.classList.add("hq--still");
  window.BFHeadquarters = { poll: poll, view: view, refresh: fetchLive };
  renderQueue();
  loadQueue();
  fetchLive();
})();

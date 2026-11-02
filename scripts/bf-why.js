/* ═══════════════════════════════════════════════════════════════════════════
   scripts/bf-why.js — "Why did this run, or not run?" (intelligence layer B2)

   THREE THINGS, all read from the server's records and nothing else:

   1. THE WHY PANEL. A "Why?" link next to a run, a proposal or a refused
      action (BFWhy.link / linkEl, or any element with data-bf-why="<kind>:<id>")
      opens a panel listing the decisions recorded for it
      (GET /api/gate-decisions/for). Each decision shows every gate in the
      order it ran, with pass, fail, bypass or not reached, and the
      plain-language reason the server's lib/gates.js REASONS holds for the
      stored code; and, when one stopped it, the member's own gate by its name.
      The panel writes only what the decision says: no reason is made up here,
      and a decision that was not recorded is said to be missing.

   2. THE DECISIONS LIST (#deckDecisions, HQ's Approvals tab). Newest first, 20
      a page, filtered by agent and outcome (GET /api/gate-decisions).

   3. THE RULE BUILDER (#deckMemberGates, HQ's Settings tab). A member makes a
      gate from dropdowns, field then comparator then value, groups them with
      AND / OR and NOT, and reads a live plain-English summary as they go.
      "Test against my last 30 days" asks the server how many recorded
      decisions the rule would have stopped (POST /api/member-gates/preview,
      which reads only). Saving goes through POST /api/member-gates, which
      validates the rule again; nothing typed here is ever evaluated.

   The summary is built from the same fixed words as lib/gateRules.js
   summarize() (checkGates proves the two agree on random rules).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFWhy) return;
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  function tok() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + (tok() || "") } };
    if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, ok: r.ok, body: b || {} }; });
    });
  }

  var RESULT_WORDS = { pass: "Pass", fail: "Fail", bypass: "Bypass", not_reached: "Not reached" };
  var OUTCOME_WORDS = { ran: "Ran", blocked: "Blocked", held_for_approval: "Held for approval" };
  var ACTION_WORDS = {
    model_call: "Model call", proposal_approve: "Approval", proposal_auto_execute: "Automatic run", dispatch: "Chained tool",
    schedule_run: "Scheduled run", marketing_email: "Marketing email", outreach_send: "Outreach", bfc_transfer: "BizCash transfer",
    social_post: "Bluesky post", trigger_fire: "Trigger", task_run: "Agent run", route_access: "Request"
  };
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var CSS =
    ".bf-why-link{font:inherit;font-size:.78rem;padding:2px 8px;border-radius:999px;border:1px solid var(--bf-line, rgba(148,163,184,.4));background:transparent;color:var(--bf-accent-a, #22d3ee);cursor:pointer}" +
    ".bf-why-link:focus-visible{outline:2px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}" +
    ".bf-why-panel{position:fixed;z-index:1200;right:16px;top:72px;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 96px);overflow:auto;padding:14px 16px;border-radius:14px;background:var(--bf-panel, #0b1024);color:var(--bf-ink, #e2e8f0);border:1px solid var(--bf-line, rgba(148,163,184,.35));box-shadow:0 18px 40px rgba(0,0,0,.5)}" +
    ".bf-why-panel[hidden]{display:none}" +
    ".bf-why-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}" +
    ".bf-why-panel-head h3{margin:0;font-size:1rem}" +
    ".bf-why-decision{border-top:1px solid var(--bf-line, rgba(148,163,184,.25));padding:8px 0}" +
    ".bf-why-head{margin:0 0 6px;font-size:.85rem}" +
    ".bf-why-gates{margin:0;padding-left:18px;font-size:.82rem}" +
    ".bf-why-gate{margin:3px 0}" +
    ".bf-why-result{display:inline-block;min-width:84px;font-weight:600}" +
    ".bf-why-gate[data-result=fail] .bf-why-result,.bf-why-member{color:var(--bf-bad, #f87171)}" +
    ".bf-why-gate[data-result=pass] .bf-why-result{color:var(--bf-good, #4ade80)}" +
    ".bf-why-gate[data-result=bypass] .bf-why-result{color:var(--bf-accent-a, #22d3ee)}" +
    ".bf-why-gate[data-result=not_reached] .bf-why-result{color:var(--bf-muted, #94a3b8)}" +
    ".bf-why-reason{display:block;color:var(--bf-muted, #94a3b8)}" +
    ".bf-why-filters,.bf-why-pager,.bf-gate-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}" +
    ".bf-why-list{list-style:none;margin:0;padding:0}" +
    ".bf-why-item{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bf-line, rgba(148,163,184,.2));font-size:.85rem}" +
    ".bf-gate-group{border-left:2px solid var(--bf-line, rgba(148,163,184,.35));padding-left:10px;margin:6px 0}" +
    ".bf-gate-summary{font-weight:600;margin:8px 0}" +
    ".bf-gate-saved{list-style:none;margin:0 0 10px;padding:0}" +
    ".bf-gate-saved li{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:4px 0}";
  function ensureStyle() {
    if (document.getElementById("bf-why-style") || !document.body) return;
    var st = document.createElement("style");
    st.id = "bf-why-style";
    st.textContent = CSS;
    document.body.appendChild(st);
  }

  /* ── one decision, exactly as recorded ──────────────────────────────────── */
  function decisionHtml(d) {
    var gates = Array.isArray(d.gates) ? d.gates : [];
    return '<div class="bf-why-decision" data-decision="' + esc(d.id || "") + '" data-outcome="' + esc(d.outcome || "") + '">' +
      '<p class="bf-why-head"><strong class="bf-why-outcome">' + esc(OUTCOME_WORDS[d.outcome] || d.outcome || "") + '</strong> · ' +
        '<span class="bf-why-action">' + esc(ACTION_WORDS[d.action] || d.action || "") + '</span>' +
        (d.agent ? ' · <span class="bf-why-agent">' + esc(d.agent.replace(/_/g, " ")) + '</span>' : "") +
        ' · <time class="bf-why-time" datetime="' + esc(d.created_at || "") + '">' + esc(when(d.created_at)) + '</time></p>' +
      '<ol class="bf-why-gates">' + gates.map(function (g) {
        return '<li class="bf-why-gate" data-gate="' + esc(g.gate || "") + '" data-result="' + esc(g.result) + '">' +
          '<span class="bf-why-gate-name">' + esc(g.name || g.gate || "") + '</span> ' +
          '<span class="bf-why-result">' + esc(RESULT_WORDS[g.result] || g.result) + '</span>' +
          '<span class="bf-why-reason">' + esc(g.reason) + '</span></li>';
      }).join("") + '</ol>' +
      (d.member ? '<p class="bf-why-member" data-result="fail">Stopped by your gate <strong class="bf-why-member-name">' + esc(d.member.name) +
        '</strong>: <span class="bf-why-reason">' + esc(d.member.reason) + '</span></p>' : "") +
      askHtml(d) +
      '</div>';
  }
  /* "Ask Termaximus" (B10): the same record, read back by Termaximus in the
     Guide tab. Shown only where Termaximus is on the page. */
  function askHtml(d) {
    if (!d.id || !window.TermaximusRecords) return "";
    return '<p><button type="button" class="bf-why-link" data-bf-why-ask="' + esc(d.id) + '" data-bf-why-intent="' + (d.outcome === "ran" ? "why_ran" : "why_not") +
      '" aria-label="Ask Termaximus about this decision">Ask Termaximus</button></p>';
  }

  /* ── the panel ──────────────────────────────────────────────────────────── */
  var panel = null, lastFocus = null;
  function panelEl() {
    if (panel) return panel;
    ensureStyle();
    panel = document.createElement("aside");
    panel.className = "bf-why-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "bfWhyTitle");
    panel.hidden = true;
    panel.innerHTML = '<div class="bf-why-panel-head"><h3 id="bfWhyTitle">Why did this run, or not run?</h3>' +
      '<button type="button" class="bf-why-link" data-bf-why-close>Close</button></div><div class="bf-why-body" aria-live="polite"></div>';
    document.body.appendChild(panel);
    return panel;
  }
  function show(html) {
    var p = panelEl();
    p.querySelector(".bf-why-body").innerHTML = html;
    p.hidden = false;
    var c = p.querySelector("[data-bf-why-close]");
    if (c) c.focus();
  }
  function close() {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function decisionsHtml(list) {
    if (!list.length) return '<p class="bf-why-none">No decision was recorded for this. Decisions are kept for 90 days.</p>';
    return list.map(decisionHtml).join("");
  }
  /* The decisions recorded for "<kind>:<id>", newest first. */
  function open(target) {
    lastFocus = document.activeElement;
    show('<p class="bf-why-none">Loading...</p>');
    return api("GET", "/api/gate-decisions/for?target=" + encodeURIComponent(target)).then(function (r) {
      if (!r.ok) { show('<p class="bf-why-none">The decisions could not be read: ' + esc(r.body.error || ("HTTP " + r.status)) + '</p>'); return; }
      show(decisionsHtml(Array.isArray(r.body.decisions) ? r.body.decisions : []));
    }, function () { show('<p class="bf-why-none">The decisions could not be read. Check the connection and try again.</p>'); });
  }
  function openDecision(d) { lastFocus = document.activeElement; show(decisionsHtml(d ? [d] : [])); }
  /* One decision by its id (a trigger firing carries the id of the decision
     that let it through): GET /api/gate-decisions/:id. */
  function openById(id) {
    lastFocus = document.activeElement;
    show('<p class="bf-why-none">Loading...</p>');
    return api("GET", "/api/gate-decisions/" + encodeURIComponent(id)).then(function (r) {
      if (r.status === 404) { show(decisionsHtml([])); return; }
      if (!r.ok) { show('<p class="bf-why-none">The decisions could not be read: ' + esc(r.body.error || ("HTTP " + r.status)) + '</p>'); return; }
      show(decisionsHtml(r.body.decision ? [r.body.decision] : []));
    }, function () { show('<p class="bf-why-none">The decisions could not be read. Check the connection and try again.</p>'); });
  }

  function link(target) {
    return '<button type="button" class="bf-why-link" data-bf-why="' + esc(target) + '" aria-label="Why did this run, or not run?">Why?</button>';
  }
  function linkEl(target) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bf-why-link";
    b.setAttribute("data-bf-why", target);
    b.setAttribute("aria-label", "Why did this run, or not run?");
    b.textContent = "Why?";
    return b;
  }

  /* ── the Decisions list ─────────────────────────────────────────────────── */
  var listView = { page: 1, pages: 1, agent: "", outcome: "", rows: {} };
  function mountDecisions(box) {
    ensureStyle();
    box.innerHTML = '<h3 class="hq-h" id="bfWhyDecisionsTitle">Decisions</h3>' +
      '<p class="hq-muted">Every action your agents tried, newest first: what ran, what was stopped and which check decided. Kept for 90 days.</p>' +
      '<div class="bf-why-filters">' +
        '<label for="bfWhyAgent">Agent</label><select id="bfWhyAgent"><option value="">All agents</option></select>' +
        '<label for="bfWhyOutcome">Outcome</label><select id="bfWhyOutcome"><option value="">All outcomes</option>' +
          '<option value="ran">Ran</option><option value="blocked">Blocked</option><option value="held_for_approval">Held for approval</option></select>' +
      '</div>' +
      '<ul class="bf-why-list" id="bfWhyList" aria-labelledby="bfWhyDecisionsTitle"></ul>' +
      '<p class="hq-muted" id="bfWhyListNote" role="status"></p>' +
      '<div class="bf-why-pager"><button type="button" class="hq-btn" id="bfWhyPrev">Prev</button>' +
        '<span id="bfWhyAt"></span><button type="button" class="hq-btn" id="bfWhyNext">Next</button></div>';
    language().then(function (lang) {
      var sel = document.getElementById("bfWhyAgent");
      if (!lang || !sel) return;
      lang.fields.agent.values.forEach(function (a) {
        var o = document.createElement("option"); o.value = a; o.textContent = a.replace(/_/g, " "); sel.appendChild(o);
      });
    });
    document.getElementById("bfWhyAgent").addEventListener("change", function (e) { listView.agent = e.target.value; listView.page = 1; loadDecisions(); });
    document.getElementById("bfWhyOutcome").addEventListener("change", function (e) { listView.outcome = e.target.value; listView.page = 1; loadDecisions(); });
    document.getElementById("bfWhyPrev").addEventListener("click", function () { if (listView.page > 1) { listView.page--; loadDecisions(); } });
    document.getElementById("bfWhyNext").addEventListener("click", function () { if (listView.page < listView.pages) { listView.page++; loadDecisions(); } });
    return loadDecisions();
  }
  function loadDecisions() {
    var q = "?page=" + listView.page + (listView.agent ? "&agent=" + encodeURIComponent(listView.agent) : "") +
      (listView.outcome ? "&outcome=" + encodeURIComponent(listView.outcome) : "");
    var note = document.getElementById("bfWhyListNote");
    if (note) note.textContent = "Loading...";
    return api("GET", "/api/gate-decisions" + q).then(function (r) {
      var ul = document.getElementById("bfWhyList");
      if (!ul) return;
      if (!r.ok) { ul.innerHTML = ""; note.textContent = "Your decisions could not be read: " + (r.body.error || ("HTTP " + r.status)); return; }
      var rows = Array.isArray(r.body.decisions) ? r.body.decisions : [];
      listView.pages = r.body.pages || 1;
      listView.rows = {};
      ul.innerHTML = rows.map(function (d) {
        listView.rows[d.id] = d;
        return '<li class="bf-why-item" data-outcome="' + esc(d.outcome) + '">' +
          '<strong>' + esc(OUTCOME_WORDS[d.outcome] || d.outcome) + '</strong>' +
          '<span>' + esc(ACTION_WORDS[d.action] || d.action) + '</span>' +
          (d.agent ? '<span>' + esc(d.agent.replace(/_/g, " ")) + '</span>' : "") +
          '<time datetime="' + esc(d.created_at) + '">' + esc(when(d.created_at)) + '</time>' +
          '<button type="button" class="bf-why-link" data-bf-why-decision="' + esc(d.id) + '" aria-label="Why did this run, or not run?">Why?</button></li>';
      }).join("");
      note.textContent = rows.length ? "" : "No decisions match.";
      var at = document.getElementById("bfWhyAt");
      if (at) at.textContent = "Page " + listView.page + " of " + listView.pages;
      document.getElementById("bfWhyPrev").disabled = listView.page <= 1;
      document.getElementById("bfWhyNext").disabled = listView.page >= listView.pages;
    }, function () { if (note) note.textContent = "Your decisions could not be read. Check the connection and try again."; });
  }

  /* ── the closed language, once ──────────────────────────────────────────── */
  var langPromise = null;
  function language() {
    if (!langPromise) {
      /* A language without its fields, scopes, comparators and limits is treated as none, so a malformed answer never throws. */
      langPromise = api("GET", "/api/member-gates/language").then(function (r) {
        var b = r.ok ? r.body : null;
        var whole = b && b.fields && b.fields.agent && Array.isArray(b.fields.agent.values) && b.scopes && b.scopes.any && b.comparators && b.limits;
        return whole ? b : null;
      }, function () { return null; });
    }
    return langPromise;
  }

  /* ── the summary: the same fixed words as lib/gateRules.js summarize() ──── */
  var WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  var WEEKDAY_NAMES = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function hh(h) { return (h < 10 ? "0" : "") + h + ":00"; }
  function words(list, join) { return list.length === 1 ? list[0] : list.slice(0, -1).join(", ") + " " + join + " " + list[list.length - 1]; }
  function valueWords(field, v) {
    if (field === "weekday") return WEEKDAY_NAMES[v] || String(v);
    if (field === "hour") return hh(v);
    if (field === "channel" && v === "bluesky") return "Bluesky";
    return String(v).replace(/_/g, " ");
  }
  function leafWords(node, lang) {
    var f = node.field, op = node.op, v = node.value;
    if (f === "approved") return v === true ? "approved" : "not approved";
    if (f === "weekday" && (op === "in" || op === "not_in")) {
      var sorted = WEEKDAYS.filter(function (d) { return v.indexOf(d) !== -1; });
      var phrase = sorted.join() === "mon,tue,wed,thu,fri" ? "on a weekday" : sorted.join() === "sat,sun" ? "at the weekend"
        : "on " + words(sorted.map(function (d) { return WEEKDAY_NAMES[d]; }), "or");
      return op === "in" ? phrase : "NOT " + phrase;
    }
    if (f === "weekday") return (op === "neq" ? "NOT " : "") + "on " + WEEKDAY_NAMES[v];
    if (f === "hour") {
      if (op === "lt") return "before " + hh(v);
      if (op === "lte") return "before " + (v + 1 > 23 ? "midnight" : hh(v + 1));
      if (op === "gt") return "after " + (v + 1 > 23 ? "23:59" : hh(v + 1));
      if (op === "gte") return "after " + hh(v);
      if (op === "between") return "between " + hh(v[0]) + " and " + (v[1] + 1 > 23 ? "midnight" : hh(v[1] + 1));
      if (op === "eq") return "in the " + hh(v) + " hour";
      if (op === "neq") return "NOT in the " + hh(v) + " hour";
      var hours = v.map(hh);
      return (op === "not_in" ? "NOT " : "") + "in the " + words(hours, "or") + " hour";
    }
    var label = lang.fields[f].label;
    if (op === "in" || op === "not_in") return label + " " + lang.comparators[op] + " " + words(v.map(function (x) { return valueWords(f, x); }), "or");
    if (op === "between") return label + " is between " + v[0] + " and " + v[1];
    return label + " " + lang.comparators[op] + " " + valueWords(f, v);
  }
  function nodeWords(node, top, lang) {
    if (own(node, "all") || own(node, "any")) {
      var list = own(node, "all") ? node.all : node.any;
      var joined = list.map(function (c) { return nodeWords(c, false, lang); }).join(own(node, "all") ? " AND " : " OR ");
      return top || list.length === 1 ? joined : "(" + joined + ")";
    }
    if (own(node, "not")) return "NOT " + nodeWords(node.not, false, lang);
    return leafWords(node, lang);
  }
  function summarize(rule, scope, lang) {
    var label = (lang.scopes[scope] || lang.scopes.any).label;
    return label + " only if " + nodeWords(rule, true, lang);
  }

  /* ── the rule builder ───────────────────────────────────────────────────── */
  var B = { lang: null, root: null, scope: "any", editing: null };
  function newLeaf(scope) {
    var field = B.lang.scopes[scope].fields[0];
    var spec = B.lang.fields[field];
    return { kind: "leaf", not: false, field: field, op: spec.comparators[0], value: defaultValue(spec, spec.comparators[0]) };
  }
  function defaultValue(spec, op) {
    var one = spec.type === "enum" ? spec.values[0] : spec.type === "bool" ? true : spec.min;
    if (op === "in" || op === "not_in") return [one];
    if (op === "between") return [spec.min, spec.max];
    return one;
  }
  function newGroup(scope) { return { kind: "group", not: false, mode: "all", parts: [newLeaf(scope)] }; }
  function depthOf(n) { return n.kind === "group" ? 1 + Math.max.apply(null, n.parts.map(depthOf).concat([0])) + (n.not ? 1 : 0) : 1 + (n.not ? 1 : 0); }
  function leavesOf(n) { return n.kind === "group" ? n.parts.reduce(function (a, p) { return a + leavesOf(p); }, 0) : 1; }
  /* The builder's tree as the server's rule. */
  function toRule(n) {
    var core = n.kind === "group" ? (function () { var g = {}; g[n.mode] = n.parts.map(toRule); return g; })()
      : { field: n.field, op: n.op, value: n.value };
    return n.not ? { not: core } : core;
  }
  function optionHtml(value, text, chosen) { return '<option value="' + esc(value) + '"' + (chosen ? " selected" : "") + ">" + esc(text) + "</option>"; }
  function valueControl(n, path) {
    var spec = B.lang.fields[n.field];
    if (n.op === "between") {
      return '<input type="number" data-gate-path="' + path + '" data-gate-part="low" min="' + spec.min + '" max="' + spec.max + '" value="' + esc(n.value[0]) + '" aria-label="Low">' +
        '<input type="number" data-gate-path="' + path + '" data-gate-part="high" min="' + spec.min + '" max="' + spec.max + '" value="' + esc(n.value[1]) + '" aria-label="High">';
    }
    if (spec.type === "bool") {
      return '<select data-gate-path="' + path + '" data-gate-part="value" aria-label="Value">' + optionHtml("true", "yes", n.value === true) + optionHtml("false", "no", n.value === false) + "</select>";
    }
    if (spec.type === "enum") {
      var many = n.op === "in" || n.op === "not_in";
      return '<select data-gate-path="' + path + '" data-gate-part="value" aria-label="Value"' + (many ? " multiple" : "") + ">" +
        spec.values.map(function (v) { return optionHtml(v, valueWords(n.field, v), many ? n.value.indexOf(v) !== -1 : n.value === v); }).join("") + "</select>";
    }
    if (n.op === "in" || n.op === "not_in") {
      var nums = []; for (var i = spec.min; i <= spec.max; i++) nums.push(i);
      return '<select data-gate-path="' + path + '" data-gate-part="value" aria-label="Value" multiple>' +
        nums.map(function (v) { return optionHtml(String(v), valueWords(n.field, v), n.value.indexOf(v) !== -1); }).join("") + "</select>";
    }
    return '<input type="number" data-gate-path="' + path + '" data-gate-part="value" min="' + spec.min + '" max="' + spec.max + '" value="' + esc(n.value) + '" aria-label="Value">';
  }
  function nodeHtml(n, path, depth) {
    var notBox = '<label><input type="checkbox" data-gate-path="' + path + '" data-gate-part="not"' + (n.not ? " checked" : "") + "> NOT</label>";
    var remove = path === "r" ? "" : '<button type="button" class="hq-btn" data-gate-act="remove" data-gate-path="' + path + '">Remove</button>';
    if (n.kind === "group") {
      var room = depth < B.lang.limits.MAX_DEPTH;
      return '<div class="bf-gate-group" data-gate-node="' + path + '"><div class="bf-gate-row">' + notBox +
        '<select data-gate-path="' + path + '" data-gate-part="mode" aria-label="Combine with">' +
          optionHtml("all", "All of these (AND)", n.mode === "all") + optionHtml("any", "Any of these (OR)", n.mode === "any") + "</select>" + remove + "</div>" +
        n.parts.map(function (p, i) { return nodeHtml(p, path + "." + i, depth + 1); }).join("") +
        '<div class="bf-gate-row"><button type="button" class="hq-btn" data-gate-act="add-leaf" data-gate-path="' + path + '">Add condition</button>' +
        (room ? '<button type="button" class="hq-btn" data-gate-act="add-group" data-gate-path="' + path + '">Add group</button>' : "") + "</div></div>";
    }
    var fields = B.lang.scopes[B.scope].fields;
    var spec = B.lang.fields[n.field];
    return '<div class="bf-gate-row" data-gate-node="' + path + '">' + notBox +
      '<select data-gate-path="' + path + '" data-gate-part="field" aria-label="Field">' +
        fields.map(function (f) { return optionHtml(f, B.lang.fields[f].label, f === n.field); }).join("") + "</select>" +
      '<select data-gate-path="' + path + '" data-gate-part="op" aria-label="Comparator">' +
        spec.comparators.map(function (c) { return optionHtml(c, B.lang.comparators[c], c === n.op); }).join("") + "</select>" +
      valueControl(n, path) + remove + "</div>";
  }
  function nodeAt(path) {
    var parts = path.split(".").slice(1), n = B.root, parent = null, idx = -1;
    parts.forEach(function (p) { parent = n; idx = Number(p); n = n.parts[idx]; });
    return { node: n, parent: parent, index: idx };
  }
  function drawTree() {
    var t = document.getElementById("bfGateTree");
    if (t) t.innerHTML = nodeHtml(B.root, "r", 1);
    drawSummary();
  }
  function drawSummary() {
    var out = document.getElementById("bfGateSummary");
    if (out) out.textContent = summarize(toRule(B.root), B.scope, B.lang);
  }
  function onTreeInput(e) {
    var el = e.target, path = el.getAttribute("data-gate-path"), part = el.getAttribute("data-gate-part");
    if (!path || !part) return;
    var n = nodeAt(path).node;
    if (part === "not") n.not = el.checked;
    else if (part === "mode") n.mode = el.value === "any" ? "any" : "all";
    else if (part === "field") {
      n.field = el.value;
      var spec = B.lang.fields[n.field];
      n.op = spec.comparators[0];
      n.value = defaultValue(spec, n.op);
      drawTree(); return;
    } else if (part === "op") {
      n.op = el.value;
      n.value = defaultValue(B.lang.fields[n.field], n.op);
      drawTree(); return;
    } else if (part === "value") {
      var specV = B.lang.fields[n.field];
      var read = function (x) { return specV.type === "bool" ? x === "true" : specV.type === "enum" ? x : Number(x); };
      n.value = el.multiple ? Array.prototype.filter.call(el.options, function (o) { return o.selected; }).map(function (o) { return read(o.value); }) : read(el.value);
    } else if (part === "low") n.value = [Number(el.value), n.value[1]];
    else if (part === "high") n.value = [n.value[0], Number(el.value)];
    drawSummary();
  }
  function onTreeClick(e) {
    var b = e.target.closest ? e.target.closest("[data-gate-act]") : null;
    if (!b) return;
    var act = b.getAttribute("data-gate-act"), at = nodeAt(b.getAttribute("data-gate-path"));
    var note = document.getElementById("bfGateNote");
    if ((act === "add-leaf" || act === "add-group") && leavesOf(B.root) >= B.lang.limits.MAX_LEAVES) {
      if (note) note.textContent = "A gate holds at most " + B.lang.limits.MAX_LEAVES + " conditions.";
      return;
    }
    if (act === "add-leaf") at.node.parts.push(newLeaf(B.scope));
    else if (act === "add-group") at.node.parts.push(newGroup(B.scope));
    else if (act === "remove" && at.parent) {
      at.parent.parts.splice(at.index, 1);
      if (!at.parent.parts.length) at.parent.parts.push(newLeaf(B.scope));
    }
    drawTree();
  }
  function savedHtml(gates) {
    if (!gates.length) return '<li class="hq-muted">No gates yet.</li>';
    return gates.map(function (g) {
      return '<li data-gate-id="' + esc(g.id) + '"><strong>' + esc(g.name) + '</strong><span>' + esc(g.summary) + '</span>' +
        '<span class="hq-muted">' + (g.enabled ? "On" : "Off") + " · " + esc(g.time_zone) + '</span>' +
        '<button type="button" class="hq-btn" data-gate-saved="toggle">' + (g.enabled ? "Turn off" : "Turn on") + '</button>' +
        '<button type="button" class="hq-btn" data-gate-saved="delete">Delete</button></li>';
    }).join("");
  }
  var savedGates = [];
  function loadSaved() {
    return api("GET", "/api/member-gates").then(function (r) {
      var ul = document.getElementById("bfGateSaved");
      if (!ul) return;
      if (!r.ok) { ul.innerHTML = '<li class="hq-muted">Your gates could not be read: ' + esc(r.body.error || ("HTTP " + r.status)) + "</li>"; return; }
      savedGates = Array.isArray(r.body.gates) ? r.body.gates : [];
      ul.innerHTML = savedHtml(savedGates);
    });
  }
  function zoneGuess() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
  }
  function mountBuilder(box) {
    ensureStyle();
    box.innerHTML = '<h3 class="hq-h" id="bfGateTitle">Your gates</h3>' +
      '<p class="hq-muted">A gate you set can only stop an action the platform\'s own checks let through. It never lets through anything they refused.</p>' +
      '<ul class="bf-gate-saved" id="bfGateSaved" aria-labelledby="bfGateTitle"><li class="hq-muted">Loading...</li></ul>' +
      '<form id="bfGateForm" novalidate>' +
        '<div class="bf-gate-row"><label for="bfGateName">Name</label><input id="bfGateName" maxlength="60" autocomplete="off">' +
          '<label for="bfGateScope">Applies to</label><select id="bfGateScope"></select>' +
          '<label for="bfGateZone">Time zone</label><input id="bfGateZone" maxlength="64" autocomplete="off"></div>' +
        '<div id="bfGateTree"></div>' +
        '<p class="bf-gate-summary" id="bfGateSummary" aria-live="polite"></p>' +
        '<div class="bf-gate-row"><button type="button" class="hq-btn" id="bfGateTest">Test against my last 30 days</button>' +
          '<button type="submit" class="hq-btn hq-btn-go" id="bfGateSave">Save gate</button></div>' +
        '<p class="hq-muted" id="bfGateTestOut" role="status"></p>' +
        '<p class="hq-muted" id="bfGateNote" role="status"></p>' +
      '</form>';
    return language().then(function (lang) {
      if (!lang) { document.getElementById("bfGateNote").textContent = "The gate builder could not load. Reload the page to try again."; return; }
      B.lang = lang;
      var scopeSel = document.getElementById("bfGateScope");
      scopeSel.innerHTML = Object.keys(lang.scopes).map(function (s) { return optionHtml(s, lang.scopes[s].label, s === B.scope); }).join("");
      document.getElementById("bfGateZone").value = zoneGuess();
      B.root = newGroup(B.scope);
      drawTree();
      scopeSel.addEventListener("change", function () { B.scope = scopeSel.value; B.root = newGroup(B.scope); drawTree(); });
      var tree = document.getElementById("bfGateTree");
      tree.addEventListener("change", onTreeInput);
      tree.addEventListener("input", onTreeInput);
      tree.addEventListener("click", onTreeClick);
      document.getElementById("bfGateTest").addEventListener("click", testRule);
      document.getElementById("bfGateForm").addEventListener("submit", function (e) { e.preventDefault(); saveRule(); });
      document.getElementById("bfGateSaved").addEventListener("click", onSavedClick);
      return loadSaved();
    });
  }
  function testRule() {
    var out = document.getElementById("bfGateTestOut");
    out.textContent = "Counting...";
    return api("POST", "/api/member-gates/preview", { scope: B.scope, rule: toRule(B.root), time_zone: document.getElementById("bfGateZone").value.trim() || "UTC" })
      .then(function (r) {
        if (!r.ok) { out.textContent = "Not counted: " + (r.body.error || ("HTTP " + r.status)); return; }
        var b = r.body;
        out.textContent = "In your last " + b.window_days + " days this would have stopped " + b.would_block + " of " + b.considered +
          " recorded decisions that ran" + (b.could_not_judge ? "; " + b.could_not_judge + " could not be judged from the record" : "") +
          (b.already_stopped ? "; " + b.already_stopped + " were already stopped" : "") + ". Nothing was changed.";
      }, function () { out.textContent = "Not counted. Check the connection and try again."; });
  }
  function saveRule() {
    var note = document.getElementById("bfGateNote");
    note.textContent = "Saving...";
    return api("POST", "/api/member-gates", { name: document.getElementById("bfGateName").value, scope: B.scope, rule: toRule(B.root),
      time_zone: document.getElementById("bfGateZone").value.trim() || "UTC" }).then(function (r) {
      if (!r.ok) { note.textContent = r.body.error || ("Not saved (HTTP " + r.status + ")."); return; }
      note.textContent = "Saved: " + r.body.gate.summary + ".";
      return loadSaved();
    }, function () { note.textContent = "Not saved. Check the connection and try again."; });
  }
  function onSavedClick(e) {
    var b = e.target.closest ? e.target.closest("[data-gate-saved]") : null;
    var li = b && b.closest("[data-gate-id]");
    if (!li) return;
    var id = li.getAttribute("data-gate-id");
    var g = savedGates.filter(function (x) { return x.id === id; })[0];
    var call = b.getAttribute("data-gate-saved") === "delete" ? api("DELETE", "/api/member-gates/" + encodeURIComponent(id))
      : api("PUT", "/api/member-gates/" + encodeURIComponent(id), { enabled: !(g && g.enabled) });
    b.disabled = true;
    return call.then(function (r) {
      if (!r.ok) document.getElementById("bfGateNote").textContent = r.body.error || ("Not changed (HTTP " + r.status + ").");
      return loadSaved();
    });
  }

  /* ── wiring ─────────────────────────────────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var w = t.closest("[data-bf-why]");
    if (w) { e.preventDefault(); open(w.getAttribute("data-bf-why")); return; }
    var d = t.closest("[data-bf-why-decision]");
    if (d) { e.preventDefault(); openDecision(listView.rows[d.getAttribute("data-bf-why-decision")] || null); return; }
    var byId = t.closest("[data-bf-why-id]");
    if (byId) { e.preventDefault(); openById(byId.getAttribute("data-bf-why-id")); return; }
    var ask = t.closest("[data-bf-why-ask]");
    if (ask && window.TermaximusRecords) { e.preventDefault(); window.TermaximusRecords.ask(ask.getAttribute("data-bf-why-intent"), "decision:" + ask.getAttribute("data-bf-why-ask")); return; }
    if (t.closest("[data-bf-why-close]")) close();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && panel && !panel.hidden) close(); });
  function boot() {
    var dl = document.getElementById("deckDecisions");
    if (dl && !dl.getAttribute("data-mounted")) { dl.setAttribute("data-mounted", "true"); mountDecisions(dl); }
    var gb = document.getElementById("deckMemberGates");
    if (gb && !gb.getAttribute("data-mounted")) { gb.setAttribute("data-mounted", "true"); mountBuilder(gb); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.BFWhy = {
    open: open, openDecision: openDecision, openById: openById, close: close, link: link, linkEl: linkEl, decisionHtml: decisionHtml,
    mountDecisions: mountDecisions, mountBuilder: mountBuilder, summarize: summarize, toRule: toRule,
    _builder: function () { return B; }, _list: function () { return listView; }
  };
})();

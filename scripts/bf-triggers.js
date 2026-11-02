/* ═══════════════════════════════════════════════════════════════════════════
   scripts/bf-triggers.js — Triggers in HQ (intelligence layer B5)

   Mounts on #deckTriggers, HQ's Settings tab. Everything it shows is read
   from the server:
     - the closed language and the six ready-made templates
       (GET /api/triggers/language, lib/triggers.js on the server);
     - the member's triggers, each with its on/off switch, its last value and
       when it last fired (GET /api/triggers);
     - the firings, newest first, each with "Why?" to the decision that let it
       through or stopped it (GET /api/triggers/firings; bf-why.js opens it).
   A template is one press to create, then editable in the builder. The
   builder is dropdowns only (metric, comparator, threshold, window, cooldown,
   action), with a live plain-English summary built from the same words as
   lib/triggers.js summarize() (checkTriggers proves the two agree). "Preview
   last 30 days" asks POST /api/triggers/preview, which reads only.

   A trigger never publishes or sends. A drafted task is a saved prompt; "Run
   the draft" runs it through the normal task route, where anything that would
   publish or send waits for approval.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFTriggers) return;
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
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  var EMPTY_COPY = "A trigger watches one number from your own account, such as stock at its reorder point or agent runs that failed. " +
    "When the number crosses the line you set, it raises an alert, has an agent draft a task for you, or pauses an agent's schedules. " +
    "A trigger never publishes or sends anything: whatever a drafted task would publish or send still waits for your approval.";
  var OUTCOME_WORDS = {
    fired: "Fired",
    action_failed: "Fired, but its action could not be written",
    skipped_daily_cap: "Skipped: the daily limit of firings was reached",
    blocked_by_gate: "Stopped by a check"
  };

  /* ── the summary: the same fixed words as lib/triggers.js summarize() ──── */
  function agentName(L, a) { return own(L.agents, a) ? L.agents[a] : String(a); }
  function fill(L, s, t) { return s.replace("{w}", own(L.windows, t.window) ? L.windows[t.window] : t.window).replace("{a}", agentName(L, t.metric_agent)); }
  function amount(kind, n) {
    if (kind === "percent") return n + "%";
    if (kind === "bfc") return n + " BFC";
    return String(n);
  }
  function condition(L, t) {
    var m = L.metrics[t.metric];
    if (t.metric === "stock_at_reorder" && ((t.comparator === "gt" && t.threshold === 0) || (t.comparator === "gte" && t.threshold === 1))) {
      return "stock of any item drops to its reorder point";
    }
    var subject = fill(L, t.metric === "proposals_pending" && t.window !== "now" ? m.subject_aged : m.subject, t);
    if (t.comparator === "drop_pct") {
      return subject + " drops by " + t.threshold + "% or more against the " + L.windows[t.window] + " before (with at least " + L.limits.DROP_MIN_PREVIOUS + " before)";
    }
    var n = amount(m.kind, t.threshold);
    var words = { lt: "is below " + n, lte: "is at most " + n, gt: "is above " + n, gte: "is at least " + n };
    return subject + " " + words[t.comparator];
  }
  function consequence(L, t) {
    var a = t.action || {};
    if (a.kind === "draft_task") return "the " + agentName(L, a.agent) + " agent drafts " + L.metrics[t.metric].draft;
    if (a.kind === "pause_schedule") return "the " + agentName(L, a.agent) + " agent's schedules are paused and you get an alert";
    return "you get an alert";
  }
  function cooldownWords(h) {
    if (h === 24) return "At most once a day.";
    if (h === 168) return "At most once a week.";
    if (h % 24 === 0) return "At most once every " + (h / 24) + " days.";
    return "At most once every " + h + " hours.";
  }
  function summarize(L, t) {
    if (!L || !t || !own(L.metrics, t.metric)) return "";
    return "When " + condition(L, t) + ", " + consequence(L, t) + ". " + cooldownWords(t.cooldown_hours);
  }

  var CSS =
    ".bf-trg-templates{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:8px 0 16px;padding:0;list-style:none}" +
    ".bf-trg-template{border:1px solid var(--bf-line, rgba(148,163,184,.3));border-radius:10px;padding:10px 12px}" +
    ".bf-trg-template p{margin:4px 0 8px;font-size:.82rem}" +
    ".bf-trg-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}" +
    ".bf-trg-row label{font-size:.78rem}" +
    ".bf-trg-row select,.bf-trg-row input{font:inherit;font-size:.85rem;max-width:100%}" +
    ".bf-trg-summary{font-weight:600;margin:8px 0}" +
    ".bf-trg-list,.bf-trg-firings{list-style:none;padding:0;margin:8px 0}" +
    ".bf-trg-item,.bf-trg-firing{border-top:1px solid var(--bf-line, rgba(148,163,184,.25));padding:8px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}" +
    ".bf-trg-item p{margin:2px 0;flex-basis:100%;font-size:.82rem}" +
    ".bf-trg-firing span{font-size:.82rem}";
  function ensureStyle() {
    if (document.getElementById("bfTriggersCss")) return;
    var st = document.createElement("style");
    st.id = "bfTriggersCss";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var S = { box: null, L: null, triggers: [], editing: null, firingsPage: 1, firingsPages: 1 };

  function optionHtml(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (selected ? " selected" : "") + ">" + esc(label) + "</option>";
  }
  function valueWords(kind, v) {
    if (v === null || v === undefined) return "not judged";
    return amount(kind, v);
  }

  function mount(box) {
    ensureStyle();
    S.box = box;
    box.innerHTML = '<h3 class="hq-h" id="bfTrgTitle">Triggers</h3>' +
      '<p class="hq-muted" id="bfTrgEmpty">' + esc(EMPTY_COPY) + '</p>' +
      '<p class="hq-muted" id="bfTrgServer" role="status"></p>' +
      '<h4 class="hq-h" id="bfTrgTemplatesTitle">Ready-made triggers</h4>' +
      '<ul class="bf-trg-templates" id="bfTrgTemplates" aria-labelledby="bfTrgTemplatesTitle"><li class="hq-muted">Loading...</li></ul>' +
      '<h4 class="hq-h" id="bfTrgListTitle">Your triggers</h4>' +
      '<ul class="bf-trg-list" id="bfTrgList" aria-labelledby="bfTrgListTitle"><li class="hq-muted">Loading...</li></ul>' +
      '<h4 class="hq-h" id="bfTrgBuilderTitle">Make or edit a trigger</h4>' +
      '<form id="bfTrgForm" novalidate aria-labelledby="bfTrgBuilderTitle">' +
        '<div class="bf-trg-row"><label for="bfTrgName">Name</label><input id="bfTrgName" maxlength="60" autocomplete="off"></div>' +
        '<div class="bf-trg-row"><label for="bfTrgMetric">When</label><select id="bfTrgMetric"></select>' +
          '<label for="bfTrgMetricAgent" id="bfTrgMetricAgentLabel">for the agent</label><select id="bfTrgMetricAgent"></select></div>' +
        '<div class="bf-trg-row"><label for="bfTrgComparator">Comparator</label><select id="bfTrgComparator"></select>' +
          '<label for="bfTrgThreshold">Threshold</label><input id="bfTrgThreshold" type="number" min="0" step="1" value="0">' +
          '<label for="bfTrgWindow">Window</label><select id="bfTrgWindow"></select></div>' +
        '<div class="bf-trg-row"><label for="bfTrgCooldown">At most once every</label><select id="bfTrgCooldown"></select></div>' +
        '<div class="bf-trg-row"><label for="bfTrgAction">Then</label><select id="bfTrgAction"></select>' +
          '<label for="bfTrgActionAgent" id="bfTrgActionAgentLabel">agent</label><select id="bfTrgActionAgent"></select></div>' +
        '<p class="bf-trg-summary" id="bfTrgSummary" aria-live="polite"></p>' +
        '<div class="bf-trg-row"><button type="button" class="hq-btn" id="bfTrgPreview">Preview last 30 days</button>' +
          '<button type="submit" class="hq-btn hq-btn-go" id="bfTrgSave">Save trigger</button>' +
          '<button type="button" class="hq-btn" id="bfTrgNew">Start a new one</button></div>' +
        '<p class="hq-muted" id="bfTrgPreviewOut" role="status"></p>' +
        '<p class="hq-muted" id="bfTrgNote" role="status"></p>' +
      '</form>' +
      '<h4 class="hq-h" id="bfTrgFiringsTitle">Firings</h4>' +
      '<ul class="bf-trg-firings" id="bfTrgFirings" aria-labelledby="bfTrgFiringsTitle"><li class="hq-muted">Loading...</li></ul>' +
      '<div class="bf-trg-row"><button type="button" class="hq-btn" id="bfTrgPrev">Prev</button><span id="bfTrgAt"></span>' +
        '<button type="button" class="hq-btn" id="bfTrgNext">Next</button></div>';
    return api("GET", "/api/triggers/language").then(function (r) {
      var L = r.ok ? r.body : null;
      var whole = L && L.metrics && L.comparators && L.windows && L.actions && L.agents && L.limits && Array.isArray(L.templates) && Array.isArray(L.cooldowns);
      if (!whole) {
        document.getElementById("bfTrgNote").textContent = "Triggers could not load. Reload the page to try again.";
        document.getElementById("bfTrgTemplates").innerHTML = "";
        document.getElementById("bfTrgList").innerHTML = "";
        document.getElementById("bfTrgFirings").innerHTML = "";
        return;
      }
      S.L = L;
      drawTemplates();
      setupBuilder();
      wire();
      return Promise.all([loadTriggers(), loadFirings()]);
    }, function () {
      document.getElementById("bfTrgNote").textContent = "Triggers could not load. Check the connection and try again.";
    });
  }

  /* ── templates ────────────────────────────────────────────────────────── */
  function drawTemplates() {
    var ul = document.getElementById("bfTrgTemplates");
    ul.innerHTML = S.L.templates.map(function (tp) {
      return '<li class="bf-trg-template"><strong>' + esc(tp.title) + '</strong><p>' + esc(tp.summary) + '</p>' +
        '<button type="button" class="hq-btn" data-trg-template="' + esc(tp.key) + '">Use this template</button></li>';
    }).join("");
  }
  function useTemplate(key) {
    var tp = null;
    S.L.templates.forEach(function (x) { if (x.key === key) tp = x; });
    if (!tp) return Promise.resolve();
    var note = document.getElementById("bfTrgNote");
    note.textContent = "Saving...";
    return api("POST", "/api/triggers", tp.body).then(function (r) {
      if (!r.ok) { note.textContent = r.body.error || ("Not saved (HTTP " + r.status + ")."); return; }
      note.textContent = "Saved: " + r.body.trigger.summary + " You can change it below.";
      loadIntoBuilder(r.body.trigger);
      return loadTriggers();
    }, function () { note.textContent = "Not saved. Check the connection and try again."; });
  }

  /* ── the builder ──────────────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }
  function setupBuilder() {
    var L = S.L;
    el("bfTrgMetric").innerHTML = Object.keys(L.metrics).map(function (k) { return optionHtml(k, L.metrics[k].label, false); }).join("");
    var agents = Object.keys(L.agents).map(function (a) { return optionHtml(a, L.agents[a], false); }).join("");
    el("bfTrgMetricAgent").innerHTML = agents;
    el("bfTrgActionAgent").innerHTML = agents;
    el("bfTrgAction").innerHTML = Object.keys(L.actions).map(function (k) { return optionHtml(k, L.actions[k].label, false); }).join("");
    el("bfTrgCooldown").innerHTML = L.cooldowns.map(function (h) { return optionHtml(String(h), h + " hours", h === 24); }).join("");
    newTrigger();
  }
  function fitToMetric() {
    var L = S.L;
    var m = L.metrics[el("bfTrgMetric").value];
    if (!m) return;
    var cmp = el("bfTrgComparator");
    var keepCmp = cmp.value;
    cmp.innerHTML = Object.keys(L.comparators).filter(function (k) { return k !== "drop_pct" || m.drop; })
      .map(function (k) { return optionHtml(k, L.comparators[k], k === keepCmp); }).join("");
    var win = el("bfTrgWindow");
    var keepWin = win.value;
    win.innerHTML = m.windows.filter(function (w) { return cmp.value !== "drop_pct" || w !== "now"; })
      .map(function (w) { return optionHtml(w, L.windows[w], w === keepWin); }).join("");
    var needs = !!m.needs_agent;
    el("bfTrgMetricAgent").hidden = !needs;
    el("bfTrgMetricAgentLabel").hidden = !needs;
    var th = el("bfTrgThreshold");
    th.max = cmp.value === "drop_pct" ? "100" : String(m.max);
    th.step = m.kind === "bfc" && cmp.value !== "drop_pct" ? "any" : "1";
    var actNeeds = !!(L.actions[el("bfTrgAction").value] || {}).needs_agent;
    el("bfTrgActionAgent").hidden = !actNeeds;
    el("bfTrgActionAgentLabel").hidden = !actNeeds;
  }
  function readForm() {
    var L = S.L;
    var metric = el("bfTrgMetric").value;
    var m = L.metrics[metric] || {};
    var kind = el("bfTrgAction").value;
    var action = { kind: kind };
    if ((L.actions[kind] || {}).needs_agent) action.agent = el("bfTrgActionAgent").value;
    var body = {
      name: el("bfTrgName").value.trim(),
      metric: metric,
      comparator: el("bfTrgComparator").value,
      threshold: Number(el("bfTrgThreshold").value),
      window: el("bfTrgWindow").value,
      cooldown_hours: Number(el("bfTrgCooldown").value),
      action: action
    };
    if (m.needs_agent) body.metric_agent = el("bfTrgMetricAgent").value;
    return body;
  }
  function drawSummary() {
    fitToMetric();
    el("bfTrgSummary").textContent = summarize(S.L, readForm());
  }
  function newTrigger() {
    S.editing = null;
    el("bfTrgName").value = "";
    el("bfTrgMetric").selectedIndex = 0;
    el("bfTrgThreshold").value = "1";
    el("bfTrgAction").selectedIndex = 0;
    el("bfTrgSave").textContent = "Save trigger";
    el("bfTrgPreviewOut").textContent = "";
    drawSummary();
  }
  function loadIntoBuilder(t) {
    S.editing = t.id;
    el("bfTrgName").value = t.name;
    el("bfTrgMetric").value = t.metric;
    fitToMetric();
    el("bfTrgComparator").value = t.comparator;
    fitToMetric();
    el("bfTrgWindow").value = t.window;
    el("bfTrgThreshold").value = String(t.threshold);
    el("bfTrgCooldown").value = String(t.cooldown_hours);
    if (t.metric_agent) el("bfTrgMetricAgent").value = t.metric_agent;
    el("bfTrgAction").value = t.action.kind;
    if (t.action.agent) el("bfTrgActionAgent").value = t.action.agent;
    el("bfTrgSave").textContent = "Save changes";
    el("bfTrgPreviewOut").textContent = "";
    drawSummary();
  }
  function previewNow() {
    var out = el("bfTrgPreviewOut");
    var body = readForm();
    if (!body.name) delete body.name;
    out.textContent = "Counting...";
    return api("POST", "/api/triggers/preview", body).then(function (r) {
      if (!r.ok) { out.textContent = "Not counted: " + (r.body.error || ("HTTP " + r.status)); return; }
      var b = r.body;
      var m = S.L.metrics[body.metric] || {};
      var parts = ["Now: " + valueWords(m.kind, b.value_now) + ". " + (b.would_fire_now ? "It would fire now." : "It would not fire now.")];
      if (b.replay) {
        parts.push("In the last " + b.days + " days it would have fired " + b.count + (b.count === 1 ? " time" : " times") +
          (b.count ? ": " + b.fired_at.map(when).join(", ") : "") + ".");
        if (b.capped) parts.push("Only the first rows were read, so this may be fewer than the truth.");
      }
      if (b.note) parts.push(b.note);
      parts.push("Nothing was changed.");
      out.textContent = parts.join(" ");
    }, function () { out.textContent = "Not counted. Check the connection and try again."; });
  }
  function save(e) {
    if (e) e.preventDefault();
    var note = el("bfTrgNote");
    var body = readForm();
    note.textContent = "Saving...";
    var call = S.editing ? api("PUT", "/api/triggers/" + encodeURIComponent(S.editing), body) : api("POST", "/api/triggers", body);
    return call.then(function (r) {
      if (!r.ok) { note.textContent = r.body.error || ("Not saved (HTTP " + r.status + ")."); return; }
      note.textContent = "Saved: " + r.body.trigger.summary;
      S.editing = r.body.trigger.id;
      el("bfTrgSave").textContent = "Save changes";
      return loadTriggers();
    }, function () { note.textContent = "Not saved. Check the connection and try again."; });
  }

  /* ── the list ─────────────────────────────────────────────────────────── */
  function loadTriggers() {
    return api("GET", "/api/triggers").then(function (r) {
      var ul = el("bfTrgList");
      if (!ul) return;
      if (!r.ok) { ul.innerHTML = '<li class="hq-muted">Your triggers could not be read: ' + esc(r.body.error || ("HTTP " + r.status)) + '</li>'; return; }
      S.triggers = Array.isArray(r.body.triggers) ? r.body.triggers : [];
      el("bfTrgServer").textContent = r.body.enabled_on_server === false
        ? "Triggers are switched off on the server right now, so none will fire until they are switched on. You can still make and preview them." : "";
      el("bfTrgEmpty").hidden = false;
      if (!S.triggers.length) { ul.innerHTML = '<li class="hq-muted">No triggers yet. Use a ready-made one above or make your own below.</li>'; return; }
      ul.innerHTML = S.triggers.map(function (t) {
        var m = S.L.metrics[t.metric] || { kind: "count" };
        return '<li class="bf-trg-item" data-trg-id="' + esc(t.id) + '">' +
          '<label><input type="checkbox" role="switch" data-trg-switch="' + esc(t.id) + '"' + (t.enabled ? " checked" : "") +
            ' aria-label="On: ' + esc(t.name) + '"> On</label>' +
          '<strong>' + esc(t.name) + '</strong>' +
          '<button type="button" class="hq-btn" data-trg-edit="' + esc(t.id) + '">Edit</button>' +
          '<button type="button" class="hq-btn" data-trg-delete="' + esc(t.id) + '">Delete</button>' +
          (window.TermaximusRecords ? '<button type="button" class="hq-btn" data-trg-ask="' + esc(t.id) + '" aria-label="Ask Termaximus when ' + esc(t.name) + ' fires next">Ask Termaximus</button>' : "") +
          '<p>' + esc(t.summary) + '</p>' +
          '<p>' + (t.last_checked_at ? "Last value: " + esc(valueWords(m.kind, t.last_value)) + ", read " + esc(when(t.last_checked_at)) + "." : "Not read yet.") +
            " " + (t.last_fired_at ? "Last fired: " + esc(when(t.last_fired_at)) + "." : "Never fired.") + '</p></li>';
      }).join("");
    }, function () { el("bfTrgList").innerHTML = '<li class="hq-muted">Your triggers could not be read. Check the connection and try again.</li>'; });
  }
  function byId(id) {
    var found = null;
    S.triggers.forEach(function (t) { if (t.id === id) found = t; });
    return found;
  }
  function toggle(id, on) {
    var note = el("bfTrgNote");
    return api("PUT", "/api/triggers/" + encodeURIComponent(id), { enabled: on }).then(function (r) {
      note.textContent = r.ok ? (on ? "Switched on." : "Switched off.") : (r.body.error || ("Not changed (HTTP " + r.status + ")."));
      return loadTriggers();
    });
  }
  function remove(id) {
    var note = el("bfTrgNote");
    return api("DELETE", "/api/triggers/" + encodeURIComponent(id)).then(function (r) {
      note.textContent = r.ok ? "Deleted." : (r.body.error || ("Not deleted (HTTP " + r.status + ")."));
      if (r.ok && S.editing === id) newTrigger();
      return Promise.all([loadTriggers(), loadFirings()]);
    });
  }

  /* ── the firings ──────────────────────────────────────────────────────── */
  function draftId(ref) {
    var m = /^saved_prompt:([0-9a-f-]{36})$/i.exec(String(ref || ""));
    return m ? m[1] : null;
  }
  function loadFirings() {
    return api("GET", "/api/triggers/firings?page=" + S.firingsPage).then(function (r) {
      var ul = el("bfTrgFirings");
      if (!ul) return;
      if (!r.ok) { ul.innerHTML = '<li class="hq-muted">Your firings could not be read: ' + esc(r.body.error || ("HTTP " + r.status)) + '</li>'; return; }
      var rows = Array.isArray(r.body.firings) ? r.body.firings : [];
      S.firingsPages = r.body.pages || 1;
      el("bfTrgAt").textContent = "Page " + S.firingsPage + " of " + S.firingsPages;
      el("bfTrgPrev").disabled = S.firingsPage <= 1;
      el("bfTrgNext").disabled = S.firingsPage >= S.firingsPages;
      if (!rows.length) { ul.innerHTML = '<li class="hq-muted">No firings yet.</li>'; return; }
      ul.innerHTML = rows.map(function (f) {
        var draft = f.outcome === "fired" ? draftId(f.action_ref) : null;
        return '<li class="bf-trg-firing" data-outcome="' + esc(f.outcome) + '">' +
          '<time datetime="' + esc(f.fired_at) + '">' + esc(when(f.fired_at)) + '</time>' +
          '<strong>' + esc(f.trigger_name || "A deleted trigger") + '</strong>' +
          '<span>' + esc(OUTCOME_WORDS[f.outcome] || f.outcome) + '</span>' +
          '<span>Value: ' + esc(f.metric_value === null ? "not judged" : String(f.metric_value)) + '</span>' +
          (draft ? '<button type="button" class="hq-btn" data-trg-run="' + esc(draft) + '">Run the draft</button>' : "") +
          (f.gate_decision_id
            ? '<button type="button" class="bf-why-link" data-bf-why-id="' + esc(f.gate_decision_id) + '" aria-label="Why did this run, or not run?">Why?</button>'
            : '<span>No check was asked: the daily limit stopped it first.</span>') +
          '</li>';
      }).join("");
    }, function () { el("bfTrgFirings").innerHTML = '<li class="hq-muted">Your firings could not be read. Check the connection and try again.</li>'; });
  }
  function runDraft(id) {
    var note = el("bfTrgNote");
    note.textContent = "Starting...";
    return api("POST", "/api/saved-prompts/" + encodeURIComponent(id) + "/run", { values: {} }).then(function (r) {
      note.textContent = r.ok
        ? "Started. Anything it would publish or send waits for your approval in Approvals."
        : (r.body.error || ("Not started (HTTP " + r.status + ")."));
    }, function () { note.textContent = "Not started. Check the connection and try again."; });
  }

  /* ── wiring ───────────────────────────────────────────────────────────── */
  function wire() {
    var box = S.box;
    ["bfTrgMetric", "bfTrgComparator", "bfTrgWindow", "bfTrgCooldown", "bfTrgAction", "bfTrgActionAgent", "bfTrgMetricAgent"].forEach(function (id) {
      el(id).addEventListener("change", drawSummary);
    });
    el("bfTrgThreshold").addEventListener("input", drawSummary);
    el("bfTrgName").addEventListener("input", drawSummary);
    el("bfTrgPreview").addEventListener("click", previewNow);
    el("bfTrgNew").addEventListener("click", newTrigger);
    el("bfTrgForm").addEventListener("submit", save);
    el("bfTrgPrev").addEventListener("click", function () { if (S.firingsPage > 1) { S.firingsPage--; loadFirings(); } });
    el("bfTrgNext").addEventListener("click", function () { if (S.firingsPage < S.firingsPages) { S.firingsPage++; loadFirings(); } });
    box.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var tp = t.closest("[data-trg-template]");
      if (tp) { useTemplate(tp.getAttribute("data-trg-template")); return; }
      var ed = t.closest("[data-trg-edit]");
      if (ed) { var found = byId(ed.getAttribute("data-trg-edit")); if (found) loadIntoBuilder(found); return; }
      var del = t.closest("[data-trg-delete]");
      if (del) { remove(del.getAttribute("data-trg-delete")); return; }
      var run = t.closest("[data-trg-run]");
      if (run) { runDraft(run.getAttribute("data-trg-run")); return; }
      var ask = t.closest("[data-trg-ask]");
      if (ask && window.TermaximusRecords) { window.TermaximusRecords.ask("next_fire", "trigger:" + ask.getAttribute("data-trg-ask")); return; }
    });
    box.addEventListener("change", function (e) {
      var sw = e.target && e.target.getAttribute && e.target.getAttribute("data-trg-switch");
      if (sw) toggle(sw, e.target.checked === true);
    });
  }

  function boot() {
    var box = document.getElementById("deckTriggers");
    if (box && !box.getAttribute("data-mounted")) { box.setAttribute("data-mounted", "true"); mount(box); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.BFTriggers = { mount: mount, summarize: summarize, _state: function () { return S; }, EMPTY_COPY: EMPTY_COPY };
})();

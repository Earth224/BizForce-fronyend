/* ═══════════════════════════════════════════════════════════════════════════
   scripts/bf-cycles.js — learning cycles on HQ's Plans tab (intelligence
   layer B8 and B9)

   Mounts on #deckCycles, under the plan board. For the plan picked on the
   board (window.BFHeadquarters, scripts/bf-hq.js):
     "Review this plan"   once nothing in it is running or ready to run:
         POST /api/executive/cycles (opens the plan's cycle), then
         POST /api/executive/cycles/:id/review: the server measures what the
         plan recorded, asks the model once, keeps only the sentences whose
         numbers all appear in the measured results, and stores a draft.
     The draft, editable:  "Approve and start" (POST .../approve, then the
         normal plan route, POST /api/agents/executive/plan with the cycle's
         id, which refuses any cycle that is not approved), "Edit" (PUT
         .../:id) and "Discard" (POST .../discard). "Set aside" closes a cycle.
   And "Cycles": every cycle, its measured results against the cycle before
   (up, down or level arrows; none where either side is unknown), the review
   and the plan that was approved.

   Every cycle view carries the same fixed line, CYCLE_COPY: each cycle builds
   on recorded results, and the AI model itself does not change. Nothing here
   runs a plan by itself, and there is no timer.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFCycles) return;
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var CYCLE_COPY = "Each cycle builds on recorded results. The AI model itself does not change.";
  var STATUS_WORDS = { open: "Open", review_drafted: "Review drafted", approved: "Approved", superseded: "Set aside" };

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
  function why(res, fallback) {
    return (res && res.body && typeof res.body.error === "string" && res.body.error) || fallback || ("HTTP " + (res ? res.status : "error"));
  }

  var CSS =
    ".bfc-wrap{margin:18px 0 0}" +
    ".bfc-wrap h3{margin:0 0 6px;font-size:.9rem;letter-spacing:.06em;text-transform:uppercase}" +
    ".bfc-copy{font-size:.82rem;opacity:.85;margin:0 0 10px}" +
    ".bfc-box{margin:10px 0;padding:10px 12px;border:1px solid var(--bf-line, rgba(148,163,184,.3));border-radius:10px}" +
    ".bfc-box h4{margin:0 0 6px;font-size:.9rem}" +
    ".bfc-btn{font:inherit;font-size:.8rem;padding:4px 10px;border-radius:8px;border:1px solid var(--bf-line, rgba(148,163,184,.35));background:transparent;color:inherit;cursor:pointer;margin:4px 6px 0 0}" +
    ".bfc-btn[disabled]{opacity:.5;cursor:default}" +
    ".bfc-field{display:block;margin:8px 0}" +
    ".bfc-field span{display:block;font-size:.8rem;opacity:.85;margin-bottom:4px}" +
    ".bfc-field textarea{width:100%;box-sizing:border-box;min-height:84px;font:inherit;font-size:.86rem;padding:8px;border-radius:8px;border:1px solid var(--bf-line, rgba(148,163,184,.35));background:transparent;color:inherit}" +
    ".bfc-note{font-size:.8rem;opacity:.8;margin:6px 0}" +
    ".bfc-msg{font-size:.84rem;margin:6px 0}" +
    ".bfc-list{list-style:none;padding:0;margin:8px 0}" +
    ".bfc-list>li{border-top:1px solid var(--bf-line, rgba(148,163,184,.25));padding:8px 0}" +
    ".bfc-results{list-style:none;padding:0;margin:6px 0;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:.82rem}" +
    ".bfc-text{white-space:pre-wrap;font-size:.86rem;margin:6px 0}";
  function ensureStyle() {
    if (document.getElementById("bfCyclesCss")) return;
    var st = document.createElement("style");
    st.id = "bfCyclesCss";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var S = { box: null, cycles: null, error: null, busy: false, editing: false, msg: "", verifier: null, loading: false };

  /* ── the picked plan, read from the board ── */
  function hq() { return window.BFHeadquarters || null; }
  function pickedPlan() {
    var h = hq();
    if (!h || !h.view) return null;
    var cc = h.view.cc;
    var list = cc && cc.plans && cc.plans.ok === true && Array.isArray(cc.plans.data) ? cc.plans.data : [];
    var id = h.view.planPick;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null;
  }
  // Finished: something in it, and nothing running or still waiting for its first run.
  function finished(plan) {
    var h = hq();
    var as = plan && Array.isArray(plan.assignments) ? plan.assignments : [];
    if (!h || typeof h.stepOf !== "function" || !as.length) return false;
    return as.every(function (a) { var k = h.stepOf(a).key; return k !== "running" && k !== "ready"; });
  }
  function cycleFor(planId) {
    if (!S.cycles) return null;
    for (var i = 0; i < S.cycles.length; i++) if (S.cycles[i].plan_task_id === planId) return S.cycles[i];
    return null;
  }

  /* ── the words for one cycle's results ── */
  function resultsHtml(c) {
    var rows = c.against_previous;
    var totals = c.measured && c.measured.totals ? c.measured.totals : null;
    if (!totals) return '<p class="bfc-note">Not measured yet.</p>';
    if (!rows) {
      rows = Object.keys(LABELS).map(function (k) { return { key: k, label: LABELS[k], now: typeof totals[k] === "number" ? totals[k] : null, before: null, arrow: null }; });
    }
    var items = rows.map(function (r) {
      var now = r.now === null ? "could not be read" : String(r.now);
      var vs = r.arrow ? " " + r.arrow + " (was " + r.before + ")" : "";
      return '<li data-bfc-key="' + esc(r.key) + '"><span>' + esc(r.label) + ':</span> ' + esc(now + vs) + '</li>';
    }).join("");
    var gaps = (c.measured.unreadable || []).map(function (u) { return esc(u.field) + ": " + esc(u.reason); }).join("; ");
    return '<ul class="bfc-results" aria-label="Measured results">' + items + '</ul>' +
      (gaps ? '<p class="bfc-note">Could not be read, and not counted as zero: ' + gaps + '.</p>' : "") +
      (c.previous_cycle_id ? "" : '<p class="bfc-note">The first cycle: there is no earlier cycle to compare with.</p>');
  }
  var LABELS = {
    dispatches_ran: "Assignments run", dispatches_refused: "Assignments refused", dispatches_failed: "Assignments failed",
    tool_tasks_completed: "Runs completed", tool_tasks_failed: "Runs failed",
    proposals_approved: "Proposals approved", proposals_rejected: "Proposals rejected", published: "Published",
    arrivals: "Arrivals on your tracked links"
  };

  /* ── the panel for the picked plan ── */
  function planHtml(plan) {
    if (!plan) return '<p class="bfc-note">Make a plan on the Command tab; once it has run, you can review it here.</p>';
    var c = cycleFor(plan.id);
    var out = '<div class="bfc-box" data-bfc-plan="' + esc(plan.id) + '"><h4>This plan</h4><p class="bfc-copy">' + esc(CYCLE_COPY) + '</p>';
    if (!c || c.status === "open") {
      var done = finished(plan);
      out += '<button type="button" class="bfc-btn" data-bfc-review="' + esc(plan.id) + '"' + (done && !S.busy ? "" : " disabled") + '>' +
        (S.busy ? "Reviewing…" : "Review this plan") + '</button>';
      if (!done) out += '<p class="bfc-note">"Review this plan" is offered once nothing in the plan is running or waiting for its first run.</p>';
      else out += '<p class="bfc-note">The review measures what this plan recorded, then the model writes a review and a next plan. Any sentence with a number that is not in the measured results is left out. One review per plan per day.</p>';
      if (c) out += '<button type="button" class="bfc-btn" data-bfc-aside="' + esc(c.id) + '">Set aside</button>';
    } else if (c.status === "review_drafted") {
      var ro = S.editing ? "" : " readonly";
      out += resultsHtml(c) +
        '<label class="bfc-field"><span>Review</span><textarea id="bfcReview" maxlength="4000"' + ro + '>' + esc(c.review_text || "") + '</textarea></label>' +
        '<label class="bfc-field"><span>Next plan</span><textarea id="bfcNext" maxlength="2000"' + ro + '>' + esc(c.next_plan_draft || "") + '</textarea></label>' +
        (S.verifier && S.verifier.dropped ? '<p class="bfc-note">' + esc(S.verifier.dropped) + ' sentence' + (S.verifier.dropped === 1 ? " was" : "s were") +
          ' left out because a number in ' + (S.verifier.dropped === 1 ? "it is" : "them is") + ' not in the measured results.</p>' : "") +
        '<button type="button" class="bfc-btn" data-bfc-approve="' + esc(c.id) + '"' + (S.busy ? " disabled" : "") + '>Approve and start</button>' +
        '<button type="button" class="bfc-btn" data-bfc-edit="' + esc(c.id) + '"' + (S.busy ? " disabled" : "") + '>' + (S.editing ? "Save edits" : "Edit") + '</button>' +
        '<button type="button" class="bfc-btn" data-bfc-discard="' + esc(c.id) + '"' + (S.busy ? " disabled" : "") + '>Discard</button>' +
        '<button type="button" class="bfc-btn" data-bfc-aside="' + esc(c.id) + '"' + (S.busy ? " disabled" : "") + '>Set aside</button>' +
        '<p class="bfc-note">Nothing runs until you approve. "Approve and start" runs the next plan through the usual plan route.</p>';
    } else if (c.status === "approved") {
      out += resultsHtml(c) + (c.review_text ? '<p class="bfc-text">' + esc(c.review_text) + '</p>' : "") +
        '<p class="bfc-note">Approved ' + esc(when(c.approved_at)) + '. Next plan: ' + esc(c.next_plan_draft || "") + '</p>';
      if (!c.next_plan_task_id) {
        out += '<button type="button" class="bfc-btn" data-bfc-start="' + esc(c.id) + '"' + (S.busy ? " disabled" : "") + '>Start the approved plan</button>';
      } else {
        out += '<p class="bfc-note">The next plan has started; pick it on the board above.</p>';
      }
    } else {
      out += resultsHtml(c) + '<p class="bfc-note">Set aside. Nothing more happens to this cycle.</p>';
    }
    return out + (S.msg ? '<p class="bfc-msg" role="status">' + esc(S.msg) + '</p>' : '<p class="bfc-msg" role="status"></p>') + '</div>';
  }

  function historyHtml() {
    if (S.error) return '<p class="bfc-note">' + esc(S.error) + '</p>';
    if (!S.cycles) return '<p class="bfc-note">Loading…</p>';
    if (!S.cycles.length) return '<p class="bfc-note">No cycles yet. Review a finished plan to start one.</p>';
    return '<ul class="bfc-list">' + S.cycles.map(function (c) {
      return '<li data-bfc-cycle="' + esc(c.id) + '"><strong>' + esc(STATUS_WORDS[c.status] || c.status) + '</strong> · ' + esc(when(c.created_at)) +
        '<p class="bfc-copy">' + esc(c.copy || CYCLE_COPY) + '</p>' +
        resultsHtml(c) +
        (c.review_text ? '<p class="bfc-text"><span>Review: </span>' + esc(c.review_text) + '</p>' : "") +
        (c.status === "approved" && c.next_plan_draft ? '<p class="bfc-text"><span>Approved plan: </span>' + esc(c.next_plan_draft) + '</p>' : "") +
        '</li>';
    }).join("") + '</ul>';
  }

  function render() {
    if (!S.box) return;
    // An edit in progress is kept across a redraw.
    var review = document.getElementById("bfcReview"), next = document.getElementById("bfcNext");
    var keep = S.editing && review && next ? { review: review.value, next: next.value } : null;
    S.box.innerHTML = '<div class="bfc-wrap">' + planHtml(pickedPlan()) +
      '<h3 id="bfcHistoryTitle">Cycles</h3><p class="bfc-copy">' + esc(CYCLE_COPY) + '</p>' +
      '<div role="region" aria-labelledby="bfcHistoryTitle">' + historyHtml() + '</div></div>';
    if (keep) {
      var r2 = document.getElementById("bfcReview"), n2 = document.getElementById("bfcNext");
      if (r2) r2.value = keep.review;
      if (n2) n2.value = keep.next;
    }
  }

  function load() {
    if (S.loading) return Promise.resolve();
    S.loading = true;
    return api("GET", "/api/executive/cycles").then(function (res) {
      if (!res.ok || !Array.isArray(res.body.cycles)) { S.error = "Your cycles could not be read: " + why(res); }
      else { S.error = null; S.cycles = res.body.cycles; }
    }).catch(function (e) { S.error = "Your cycles could not be read: " + (e && e.message); })
      .then(function () { S.loading = false; render(); });
  }

  function put(cycle) {
    if (!S.cycles) S.cycles = [];
    var at = -1;
    S.cycles.forEach(function (c, i) { if (c.id === cycle.id) at = i; });
    if (at === -1) S.cycles.unshift(cycle); else S.cycles[at] = cycle;
  }
  function edits() {
    var r = document.getElementById("bfcReview"), n = document.getElementById("bfcNext");
    var out = {};
    if (r) out.review_text = r.value;
    if (n) out.next_plan_draft = n.value;
    return out;
  }
  function busy(on, msg) { S.busy = on; if (msg !== undefined) S.msg = msg; render(); }

  function review(planId) {
    busy(true, "Measuring this plan and writing the review…");
    S.verifier = null;
    return api("POST", "/api/executive/cycles", { plan_task_id: planId }).then(function (res) {
      if (!res.ok || !res.body.cycle) throw new Error(why(res, "The cycle could not be opened."));
      put(res.body.cycle);
      return api("POST", "/api/executive/cycles/" + encodeURIComponent(res.body.cycle.id) + "/review");
    }).then(function (res) {
      if (!res.ok || !res.body.cycle) throw new Error(why(res, "The review could not be written."));
      put(res.body.cycle);
      S.verifier = res.body.verifier || null;
      S.editing = false;
      busy(false, "Review drafted. Read it, edit it if you like, then approve it or discard it.");
    }).catch(function (e) { busy(false, e.message); });
  }
  function start(cycle) {
    return api("POST", "/api/agents/executive/plan", { goal: cycle.next_plan_draft || "", cycle_id: cycle.id }).then(function (res) {
      if (!res.ok) throw new Error("Approved. The next plan did not start: " + why(res));
      var h = hq();
      if (h && h.view && res.body.task_id) h.view.planPick = res.body.task_id;
      if (h && typeof h.refresh === "function") h.refresh();
      busy(false, "The next plan has started. It is on the board above.");
      return load();
    });
  }
  function approve(id) {
    busy(true, "Approving…");
    return api("POST", "/api/executive/cycles/" + encodeURIComponent(id) + "/approve", edits()).then(function (res) {
      if (!res.ok || !res.body.cycle) throw new Error(why(res, "The review could not be approved."));
      put(res.body.cycle);
      S.editing = false;
      busy(true, "Approved. Starting the next plan…");
      return start(res.body.cycle);
    }).catch(function (e) { busy(false, e.message); });
  }
  function change(id, verb, body, said) {
    busy(true);
    return api(verb === "edit" ? "PUT" : "POST", "/api/executive/cycles/" + encodeURIComponent(id) + (verb === "edit" ? "" : "/" + verb), body).then(function (res) {
      if (!res.ok || !res.body.cycle) throw new Error(why(res));
      put(res.body.cycle);
      S.editing = false;
      if (verb !== "edit") S.verifier = null;
      busy(false, said);
    }).catch(function (e) { busy(false, e.message); });
  }

  function onClick(e) {
    var t = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!t || !S.box || !S.box.contains(t) || t.disabled) return;
    var id;
    if ((id = t.getAttribute("data-bfc-review"))) review(id);
    else if ((id = t.getAttribute("data-bfc-approve"))) approve(id);
    else if ((id = t.getAttribute("data-bfc-edit"))) {
      if (!S.editing) { S.editing = true; S.msg = "Editing. Press Save edits when you are done."; render(); }
      else change(id, "edit", edits(), "Edits saved.");
    }
    else if ((id = t.getAttribute("data-bfc-discard"))) change(id, "discard", undefined, "Draft discarded. The plan can be reviewed again tomorrow.");
    else if ((id = t.getAttribute("data-bfc-aside"))) change(id, "supersede", undefined, "Set aside.");
    else if ((id = t.getAttribute("data-bfc-start"))) {
      var c = (S.cycles || []).filter(function (x) { return x.id === id; })[0];
      if (c) { busy(true, "Starting the next plan…"); start(c).catch(function (err) { busy(false, err.message); }); }
    }
  }

  function mount() {
    var box = document.getElementById("deckCycles");
    if (!box || S.box) return;
    ensureStyle();
    S.box = box;
    box.addEventListener("click", onClick);
    // The board redraws when the plans change or another plan is picked; this follows it.
    var board = document.getElementById("hqPlans");
    if (board && window.MutationObserver) new MutationObserver(function () { if (!S.editing) render(); }).observe(board, { childList: true });
    render();
    load();
  }

  window.BFCycles = { state: S, load: load, render: render, mount: mount, finished: finished, CYCLE_COPY: CYCLE_COPY };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

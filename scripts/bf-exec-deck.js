/* ══════════════════════════════════════════════════════════════════════════
   scripts/bf-exec-deck.js — the Executive command deck's six tabs, its History
   list and its result drawer, on executive-agent.html only.

   The tabs   Command, Plans, Agents, Approvals, History, Settings: one
              tablist (role="tablist", each tab role="tab" with aria-selected
              and aria-controls, each panel role="tabpanel"), Left / Right /
              Home / End move between them. Each tab is a hash route (#command,
              #plans, #agents, #approvals, #history, #settings), so a link, the
              back button and a reload all land on the right one. With no tab in
              the address the last tab used on this device opens: localStorage
              bf_exec_tab, a display choice that sign-out leaves on purpose
              (scripts/bf-session.js). Any other in-page link (#hqQueue,
              #commandCenterSection, #ccSpend…) opens the tab that holds it.
              #tool=plan (the old "Executive Plan" link) opens Command in
              "Make a plan", with &prefill= as the goal; nothing is sent.
   History    GET /api/ai/tasks?agent_type=executive&limit=100, dry runs left
              out (the /live rule), 10 a page with Prev / Next. Each row is a
              title on one line, a date and a status pill, and opens the drawer.
   The drawer GET /api/ai/tasks/:id, drawn by agent-profile.js's own
              renderers (bfRenderStoredToolRun, else bfRunSummary over the full
              text), its rating bar (bfRatingBarHtml / bfAttachRatingBars), and
              "Open full run" (run.html). The Plans tab's "View result" opens it
              too (window.BFExecDeck.openRun).

   textContent for everything the server sent, except the renderers' own
   escaped HTML. Reads only; nothing here writes.
   ══════════════════════════════════════════════════════════════════════════ */
(function execDeck() {
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var deck = document.getElementById("execDeck");
  if (!deck) return;

  var TABS = ["command", "plans", "agents", "approvals", "history", "settings"];
  var TAB_KEY = "bf_exec_tab";
  var PAGE_SIZE = 10;
  var STATUS_WORDS = { completed: "Completed", failed: "Failed", processing: "Running", pending: "Queued", queued: "Queued", cancelled: "Cancelled" };

  var runs = { rows: null, error: null, page: 0, loading: false };

  function $(id) { return document.getElementById(id); }
  function tok() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function remembered() { try { return localStorage.getItem(TAB_KEY); } catch (e) { return null; } }
  function remember(name) { try { localStorage.setItem(TAB_KEY, name); } catch (e) { /* a private window keeps no tab */ } }
  function tabOf(name) { return $("deckTab-" + name); }
  function panelOf(name) { return $("deckPanel-" + name); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  /* ── the tabs ── */
  var current = null;
  function select(name, opts) {
    opts = opts || {};
    if (TABS.indexOf(name) === -1) name = "command";
    current = name;
    TABS.forEach(function (t) {
      var tab = tabOf(t), panel = panelOf(t), on = t === name;
      if (tab) {
        tab.setAttribute("aria-selected", on ? "true" : "false");
        tab.setAttribute("tabindex", on ? "0" : "-1");
        tab.classList.toggle("is-on", on);
      }
      if (panel) panel.hidden = !on;
    });
    remember(name);
    if (opts.hash !== false && window.location.hash !== "#" + name) {
      try { setHash("#" + name, opts.push === true); } catch (e) { /* file:// and old browsers keep the old hash */ }
    }
    if (opts.focus) { var t = tabOf(name); if (t && t.focus) t.focus(); }
    if (name === "history") loadHistory();
  }
  // A tab pressed is a step the back button can undo; a tab the address already chose is not.
  function setHash(hash, push) {
    var h = window.history;
    if (h && push && typeof h.pushState === "function") h.pushState(null, "", hash);
    else if (h && typeof h.replaceState === "function") h.replaceState(null, "", hash);
    else window.location.hash = hash;
  }

  // The tab panel that holds an element, for an in-page link.
  function tabHolding(node) {
    while (node && node !== document) {
      if (node.getAttribute && node.getAttribute("role") === "tabpanel" && node.id.indexOf("deckPanel-") === 0) return node.id.slice("deckPanel-".length);
      node = node.parentNode;
    }
    return null;
  }

  // What the address asks for: a tab, the old #tool=plan link, or an element inside a tab.
  function route() {
    var h = String(window.location.hash || "").replace(/^#/, "");
    if (!h) { select(TABS.indexOf(remembered()) !== -1 ? remembered() : "command", { hash: false }); return; }
    if (TABS.indexOf(h) !== -1) { select(h, { hash: false }); return; }
    if (/^tool=plan(&|$)/.test(h)) {
      var prefill = "";
      var m = /(?:^|&)prefill=([^&]*)/.exec(h);
      if (m) { try { prefill = decodeURIComponent(m[1]); } catch (e) { prefill = ""; } }
      select("command");
      var plan = document.querySelector('[data-hq-mode="plan"]');
      if (plan) plan.click();
      var box = $("hqCommand");
      if (box && prefill) box.value = prefill.slice(0, 2000);
      return;
    }
    var target = null;
    try { target = document.getElementById(decodeURIComponent(h)); } catch (e) { target = null; }
    var holder = target ? tabHolding(target) : null;
    if (holder) {
      select(holder, { hash: false });
      if (target.scrollIntoView) target.scrollIntoView({ block: "start" });
      return;
    }
    select(TABS.indexOf(remembered()) !== -1 ? remembered() : "command", { hash: false });
  }

  deck.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-deck-tab]") : null;
    if (t) { e.preventDefault(); select(t.getAttribute("data-deck-tab"), { push: true }); }
  });
  deck.addEventListener("keydown", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-deck-tab]") : null;
    if (!t) return;
    var i = TABS.indexOf(t.getAttribute("data-deck-tab")), next = null;
    if (e.key === "ArrowRight") next = TABS[(i + 1) % TABS.length];
    else if (e.key === "ArrowLeft") next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === "Home") next = TABS[0];
    else if (e.key === "End") next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    select(next, { focus: true, push: true });
  });
  window.addEventListener("hashchange", route);

  /* ── the Approvals badge, from bf-hq.js's queue ── */
  function badge(count) {
    var b = $("deckApprovalsCount");
    if (!b) return;
    b.hidden = !(typeof count === "number" && count > 0);
    b.textContent = typeof count === "number" ? String(count) : "";
    var tab = tabOf("approvals");
    if (tab) tab.setAttribute("aria-label", typeof count === "number" && count > 0 ? "Approvals, " + count + " waiting" : "Approvals");
  }
  document.addEventListener("bf:hq-queue", function (e) { badge(e && e.detail ? e.detail.count : null); });

  /* ── History: 10 a page, each row opens the drawer ── */
  function titleOf(task) {
    var first = String(task.prompt || "").replace(/\r\n/g, "\n").split("\n").map(function (l) { return l.trim(); }).filter(Boolean)[0] || "";
    first = first.replace(/^#{1,6}\s+/, "").replace(/[*_`]/g, "");
    return first || String(task.task_type || "Task").replace(/[_/]/g, " ");
  }
  function statusOf(task) { return STATUS_WORDS[task.status] || String(task.status || "Unknown"); }

  function loadHistory(force) {
    if (runs.loading || (runs.rows && !force)) { renderHistory(); return; }
    var token = tok();
    if (!token) { runs.error = "Sign in to see this agent's runs."; renderHistory(); return; }
    runs.loading = true;
    runs.error = null;
    renderHistory();
    fetch(API_URL + "/api/ai/tasks?agent_type=executive&limit=100", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (body) {
        if (!body || !Array.isArray(body.tasks)) throw new Error("the answer carried no runs");
        runs.rows = body.tasks.filter(function (t) { return t && t.status !== "dry_run"; });
        runs.page = 0;
      })
      .catch(function (e) { runs.error = "The runs could not be read: " + ((e && e.message) || "the request failed") + "."; })
      .then(function () { runs.loading = false; renderHistory(); });
  }

  function renderHistory() {
    var list = $("deckHistoryList"), pager = $("deckHistoryPager"), note = $("deckHistoryNote");
    if (!list) return;
    list.textContent = "";
    if (note) { note.textContent = ""; note.className = "deck-note"; }
    if (pager) pager.hidden = true;
    if (runs.loading) { if (note) note.textContent = "Loading…"; return; }
    if (runs.error) { if (note) { note.textContent = runs.error; note.className = "deck-note is-err"; } return; }
    var rows = runs.rows || [];
    if (!rows.length) { if (note) note.textContent = "No runs yet. Send a task from the Command tab and it shows here."; return; }
    var pages = Math.ceil(rows.length / PAGE_SIZE);
    if (runs.page > pages - 1) runs.page = pages - 1;
    rows.slice(runs.page * PAGE_SIZE, runs.page * PAGE_SIZE + PAGE_SIZE).forEach(function (task) {
      var li = el("li", "deck-run");
      var b = el("button", "deck-run-btn");
      b.type = "button";
      b.setAttribute("data-deck-run", task.id);
      b.setAttribute("aria-haspopup", "dialog");
      b.appendChild(el("span", "deck-run-title", titleOf(task)));
      b.appendChild(el("span", "deck-run-date", when(task.created_at)));
      b.appendChild(el("span", "deck-pill is-" + String(task.status || "unknown").replace(/[^a-z_]/g, ""), statusOf(task)));
      li.appendChild(b);
      list.appendChild(li);
    });
    if (pager) {
      pager.hidden = pages < 2;
      var prev = $("deckHistoryPrev"), next = $("deckHistoryNext"), at = $("deckHistoryAt");
      if (prev) prev.disabled = runs.page === 0;
      if (next) next.disabled = runs.page >= pages - 1;
      if (at) at.textContent = "Page " + (runs.page + 1) + " of " + pages + " · " + rows.length + " runs";
    }
  }

  var histPanel = panelOf("history");
  if (histPanel) {
    histPanel.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!t) return;
      if (t.id === "deckHistoryPrev" && runs.page > 0) { runs.page -= 1; renderHistory(); return; }
      if (t.id === "deckHistoryNext") { runs.page += 1; renderHistory(); return; }
      if (t.id === "deckHistoryReload") { loadHistory(true); return; }
      if (t.hasAttribute("data-deck-run")) openRun(t.getAttribute("data-deck-run"), t);
    });
  }

  /* ── the result drawer ── */
  var opener = null;
  function closeDrawer() {
    var d = $("deckDrawer");
    if (!d || d.hidden) return;
    d.hidden = true;
    if (opener && opener.focus) opener.focus();
    opener = null;
  }
  function drawerBody(task) {
    var html = null;
    if (task.output && typeof window.bfRenderStoredToolRun === "function") html = window.bfRenderStoredToolRun(task);
    if (!html) {
      var text = task.status === "failed" && task.error ? "Task failed: " + task.error : (task.result || "");
      if (!text) return task.status === "processing" ? '<p class="deck-note">No result yet: the run is still processing.</p>' : '<p class="deck-note">This run recorded no result.</p>';
      var pre = document.createElement("pre");
      pre.className = "deck-pre";
      pre.textContent = text;
      html = (task.status !== "failed" && typeof window.bfRunSummary === "function" ? window.bfRunSummary(task.result) : "") + pre.outerHTML;
    }
    return html;
  }
  function openRun(id, from) {
    var d = $("deckDrawer"), body = $("deckDrawerBody"), title = $("deckDrawerTitle"), full = $("deckDrawerFull");
    if (!d || !body || !id) return;
    opener = from || document.activeElement;
    d.hidden = false;
    if (title) title.textContent = "Result";
    if (full) full.setAttribute("href", "/run.html?id=" + encodeURIComponent(id));
    body.textContent = "";
    body.appendChild(el("p", "deck-note", "Loading…"));
    var close = $("deckDrawerClose");
    if (close && close.focus) close.focus();
    var token = tok();
    if (!token) { body.textContent = ""; body.appendChild(el("p", "deck-note", "Sign in to see this run.")); return; }
    fetch(API_URL + "/api/ai/tasks/" + encodeURIComponent(id), { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        body.textContent = "";
        if (data === null) { body.appendChild(el("p", "deck-note", "No run with that id was found.")); return; }
        if (!data || !data.task || typeof data.task !== "object") throw new Error("the answer carried no run");
        var task = data.task;
        if (title) title.textContent = titleOf(task);
        var meta = el("p", "deck-drawer-meta", when(task.created_at) + " · " + statusOf(task));
        body.appendChild(meta);
        var holder = el("div", "deck-drawer-result");
        holder.innerHTML = drawerBody(task);
        body.appendChild(holder);
        if (task.status !== "processing" && typeof window.bfRatingBarHtml === "function") {
          var rate = el("div", "deck-drawer-rate");
          rate.innerHTML = window.bfRatingBarHtml(task.id);
          body.appendChild(rate);
          if (typeof window.bfAttachRatingBars === "function") window.bfAttachRatingBars(rate);
        }
      })
      .catch(function (e) {
        body.textContent = "";
        body.appendChild(el("p", "deck-note is-err", "The run could not be read: " + ((e && e.message) || "the request failed") + "."));
      });
  }
  var drawer = $("deckDrawer");
  if (drawer) {
    drawer.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest("#deckDrawerClose")) closeDrawer();
    });
    drawer.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
  }

  // "Next" on the shared live panel points at a card; open the tab that holds it.
  function reveal(node) {
    var holder = node ? tabHolding(node) : null;
    if (holder) select(holder);
    if (node && node.scrollIntoView) node.scrollIntoView({ block: "start" });
  }

  window.BFExecDeck = { select: select, reveal: reveal, openRun: openRun, closeDrawer: closeDrawer, history: runs, current: function () { return current; } };
  route();
})();

/* BizForce AI — Agent Profile Core
 * Reads window.AGENT_PROFILE_CONFIG and injects live task sections into any agent page.
 * Config shape: { agentType, agentLabel, accentColor, taskTypes: [{value,label}] }
 */
(function () {
  var cfg = window.AGENT_PROFILE_CONFIG || {};
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var AGENT_TYPE  = String(cfg.agentType  || "general").toLowerCase();
  var AGENT_LABEL = String(cfg.agentLabel || "Agent");
  var ACCENT      = String(cfg.accentColor || "#22d3ee");
  var TASK_TYPES  = Array.isArray(cfg.taskTypes) ? cfg.taskTypes : [{ value: "general", label: "General Task" }];

  var pollTimer    = null;
  var activeTaskId = null;

  /* ── helpers ── */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmt(v) {
    if (!v) return "—";
    try { return new Date(v).toLocaleString(); } catch (e) { return String(v); }
  }
  function tok() { return localStorage.getItem("bf_token") || ""; }

  /* ── inject CSS ── */
  var css = [
    ".ap-section{margin-top:32px}",
    ".ap-card{padding:24px;border-radius:20px;background:rgba(12,18,38,.72);border:1px solid rgba(255,255,255,.08);",
      "backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 16px 48px rgba(0,0,0,.35);",
      "transition:border-color .3s,box-shadow .3s}",
    ".ap-card:hover{border-color:rgba(0,229,255,.25);box-shadow:0 16px 48px rgba(0,0,0,.35),0 0 30px rgba(0,229,255,.08)}",
    ".ap-section-label{margin:0 0 16px;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#22d3ee}",
    ".ap-row{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center}",
    ".ap-select{flex:1;min-width:160px;padding:11px 14px;border-radius:12px;",
      "border:1px solid rgba(0,229,255,.2);background:rgba(8,12,28,.9);",
      "color:#e8e8ff;font-size:.875rem;outline:none;font-family:inherit;cursor:pointer}",
    ".ap-select:focus{border-color:rgba(0,229,255,.55)}",
    ".ap-textarea{width:100%;min-height:108px;padding:14px;border-radius:14px;",
      "border:1px solid rgba(0,229,255,.2);background:rgba(8,12,28,.9);",
      "color:#e8e8ff;font-size:.9rem;line-height:1.6;resize:vertical;outline:none;",
      "font-family:inherit;margin-bottom:14px;box-sizing:border-box}",
    ".ap-textarea:focus{border-color:rgba(0,229,255,.55)}",
    ".ap-textarea::placeholder{color:#555c78}",
    ".ap-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 24px;border:none;border-radius:14px;",
      "font-size:.82rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;",
      "background:linear-gradient(135deg,#06b6d4,#8b5cf6);cursor:pointer;",
      "transition:all .25s;box-shadow:0 4px 20px rgba(0,198,255,.25);font-family:inherit}",
    ".ap-btn:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,198,255,.35),0 0 20px rgba(168,85,247,.25)}",
    ".ap-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}",
    ".ap-msg{margin-top:12px;font-size:.85rem;min-height:20px;color:#8892b8}",
    ".ap-msg.ok{color:#4ade80}.ap-msg.err{color:#f87171}",
    /* live status */
    ".ap-live-row{display:flex;align-items:center;gap:12px;margin-bottom:8px;flex-wrap:wrap}",
    ".ap-dot{width:10px;height:10px;border-radius:50%;background:#666;flex-shrink:0}",
    ".ap-dot.idle{background:#555c78}",
    ".ap-dot.running{background:#22d3ee;box-shadow:0 0 8px rgba(34,211,238,.65);animation:ap-pulse 1.2s infinite}",
    ".ap-dot.ok{background:#4ade80}",
    ".ap-dot.err{background:#f87171}",
    "@keyframes ap-pulse{0%,100%{opacity:1}50%{opacity:.35}}",
    ".ap-live-label{font-size:.9rem;font-weight:700;color:#e8e8ff}",
    ".ap-live-meta{font-size:.78rem;color:#8888aa}",
    /* stats */
    ".ap-stats-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-bottom:16px}",
    ".ap-stat{padding:14px 16px;border-radius:14px;background:rgba(8,12,28,.65);border:1px solid rgba(255,255,255,.06)}",
    ".ap-stat-label{font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8888aa;margin-bottom:5px}",
    ".ap-stat-val{font-size:1.35rem;font-weight:800}",
    /* bar chart */
    ".ap-chart{display:flex;align-items:flex-end;gap:5px;height:52px;margin-bottom:8px}",
    ".ap-bar{flex:1;border-radius:4px 4px 0 0;min-height:4px;",
      "transition:height .5s ease;cursor:default}",
    ".ap-chart-labels{display:flex;gap:5px;margin-bottom:4px}",
    ".ap-chart-day{flex:1;text-align:center;font-size:.6rem;color:#555c78}",
    /* history */
    ".ap-history{display:flex;flex-direction:column;gap:12px}",
    ".ap-hist-item{padding:16px 18px;border-radius:14px;background:rgba(8,12,28,.65);",
      "border:1px solid rgba(255,255,255,.06);transition:border-color .25s,transform .25s}",
    ".ap-hist-item:hover{border-color:rgba(0,229,255,.28);transform:translateY(-2px)}",
    ".ap-hist-title{font-size:.875rem;font-weight:700;color:#e8e8ff;margin-bottom:4px;line-height:1.4}",
    ".ap-hist-meta{font-size:.73rem;color:#8888aa;margin-bottom:6px}",
    ".ap-hist-preview{font-size:.8rem;color:#8892b8;line-height:1.55;",
      "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
    ".ap-hist-tag{display:inline-block;margin-top:8px;padding:3px 9px;border-radius:999px;",
      "font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;",
      "background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.22);color:#22d3ee}",
    ".ap-hist-tag.completed{background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.3);color:#4ade80}",
    ".ap-hist-tag.failed{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3);color:#f87171}",
    ".ap-hist-tag.processing{background:rgba(34,211,238,.1);border-color:rgba(34,211,238,.3);color:#22d3ee}",
    ".ap-empty-state{padding:22px;text-align:center;font-size:.875rem;color:#8888aa;",
      "border:1px dashed rgba(168,85,247,.3);border-radius:14px;background:rgba(168,85,247,.05)}"
  ].join("");

  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── build day labels for chart ── */
  function dayLabels() {
    var days = ["Su","Mo","Tu","We","Th","Fr","Sa"], out = [];
    var now = new Date();
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push(days[d.getDay()]);
    }
    return out;
  }

  /* ── task type options ── */
  function taskTypeOptions() {
    return TASK_TYPES.map(function (t) {
      return '<option value="' + esc(t.value) + '">' + esc(t.label) + '</option>';
    }).join("");
  }

  /* ── inject all new sections ── */
  function inject() {
    var page = document.querySelector(".page");
    if (!page) return;

    var accentRgb = ACCENT; // used as inline color for stat values

    var html = [
      /* ── 1. Task launcher ── */
      '<div class="ap-section">',
        '<div class="ap-card">',
          '<h2 class="ap-section-label">Run ' + esc(AGENT_LABEL) + ' Task</h2>',
          '<div class="ap-row">',
            '<select class="ap-select" id="apTaskType">' + taskTypeOptions() + '</select>',
          '</div>',
          '<textarea class="ap-textarea" id="apTaskPrompt"',
            ' placeholder="Describe what you want the ' + esc(AGENT_LABEL) + ' to do..."></textarea>',
          '<button type="button" class="ap-btn" id="apLaunchBtn">Launch Task</button>',
          '<div class="ap-msg" id="apMsg"></div>',
        '</div>',
      '</div>',

      /* ── 2. Live status ── */
      '<div class="ap-section">',
        '<div class="ap-card">',
          '<h2 class="ap-section-label">Live Status</h2>',
          '<div class="ap-live-row">',
            '<div class="ap-dot idle" id="apDot"></div>',
            '<span class="ap-live-label" id="apLiveLabel">Idle</span>',
          '</div>',
          '<div class="ap-live-meta" id="apLiveMeta">No active task</div>',
        '</div>',
      '</div>',

      /* ── 3. Stats + sparkline ── */
      '<div class="ap-section">',
        '<div class="ap-card">',
          '<h2 class="ap-section-label">Agent Stats</h2>',
          '<div class="ap-stats-row">',
            '<div class="ap-stat">',
              '<div class="ap-stat-label">Tasks Run</div>',
              '<div class="ap-stat-val" id="apStatTotal" style="color:' + esc(accentRgb) + '">—</div>',
            '</div>',
            '<div class="ap-stat">',
              '<div class="ap-stat-label">Completed</div>',
              '<div class="ap-stat-val" id="apStatDone" style="color:#4ade80">—</div>',
            '</div>',
            '<div class="ap-stat">',
              '<div class="ap-stat-label">In Progress</div>',
              '<div class="ap-stat-val" id="apStatActive" style="color:#22d3ee">—</div>',
            '</div>',
            '<div class="ap-stat">',
              '<div class="ap-stat-label">Last Active</div>',
              '<div class="ap-stat-val" id="apStatLast" style="font-size:.78rem;color:#c4b5fd">—</div>',
            '</div>',
          '</div>',
          '<div class="ap-chart" id="apChart"></div>',
          '<div class="ap-chart-labels" id="apChartDays"></div>',
        '</div>',
      '</div>',

      /* ── 4. Task history ── */
      '<div class="ap-section">',
        '<div class="ap-card">',
          '<h2 class="ap-section-label">Task History</h2>',
          '<div id="apHistory"><div class="ap-empty-state">Loading history…</div></div>',
        '</div>',
      '</div>'
    ].join("");

    var reportsGrid = document.getElementById("reportsGrid");
    if (reportsGrid) {
      reportsGrid.insertAdjacentHTML("beforebegin", html);
    } else {
      page.insertAdjacentHTML("beforeend", html);
    }

    document.getElementById("apLaunchBtn").addEventListener("click", launchTask);
    loadHistory();
  }

  /* ── status helpers ── */
  function setMsg(text, cls) {
    var el = document.getElementById("apMsg");
    if (!el) return;
    el.textContent = text;
    el.className = "ap-msg" + (cls ? " " + cls : "");
  }

  function setLive(dotCls, label, meta) {
    var dot  = document.getElementById("apDot");
    var lbl  = document.getElementById("apLiveLabel");
    var meta2 = document.getElementById("apLiveMeta");
    if (dot)  dot.className  = "ap-dot " + (dotCls || "idle");
    if (lbl)  lbl.textContent = label || "Idle";
    if (meta2) meta2.textContent = meta || "";
  }

  /* ── task submission ── */
  function launchTask() {
    var btn      = document.getElementById("apLaunchBtn");
    var promptEl = document.getElementById("apTaskPrompt");
    var typeEl   = document.getElementById("apTaskType");
    var token    = tok();

    if (!token)       { setMsg("Not signed in.", "err"); return; }
    var prompt = promptEl ? promptEl.value.trim() : "";
    if (!prompt)      { setMsg("Enter a task prompt first.", "err"); return; }

    var taskType = typeEl ? typeEl.value : "general";

    btn.disabled = true;
    setMsg("Launching task…");
    setLive("running", "Launching…", "Sending to " + AGENT_LABEL);

    fetch(API_URL + "/api/ai/tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        agent_type: AGENT_TYPE,
        task_type:  taskType,
        prompt:     prompt
      })
    })
    .then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    })
    .then(function (res) {
      btn.disabled = false;
      if (!res.ok) throw new Error(res.data.error || ("Server error " + res.status));
      var taskId = res.data.task && res.data.task.id;
      if (taskId) {
        activeTaskId = taskId;
        setMsg("Task queued — polling for result…", "ok");
        setLive("running", "Running", "Task ID: " + taskId);
        startPoll(taskId);
      } else {
        setMsg("Task accepted.", "ok");
        setLive("ok", "Accepted", "");
      }
      if (promptEl) promptEl.value = "";
    })
    .catch(function (e) {
      btn.disabled = false;
      setMsg(e.message || "Task failed.", "err");
      setLive("err", "Error", e.message || "");
    });
  }

  /* ── task polling ── */
  function startPoll(taskId) {
    if (pollTimer) clearInterval(pollTimer);
    var ticks = 0;
    pollTimer = setInterval(function () {
      ticks++;
      if (ticks > 72) { /* 6 min timeout */
        clearInterval(pollTimer);
        setLive("idle", "Idle", "Polling timed out — check mailbox for results");
        return;
      }
      var token = tok();
      if (!token) { clearInterval(pollTimer); return; }

      fetch(API_URL + "/api/ai/tasks/" + taskId, {
        headers: { "Authorization": "Bearer " + token }
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.task) return;
        var t = data.task;
        if (t.status === "completed") {
          clearInterval(pollTimer);
          setMsg("Task completed!", "ok");
          setLive("ok", "Completed", "Finished: " + fmt(t.updated_at || t.created_at));
          loadHistory();
        } else if (t.status === "failed") {
          clearInterval(pollTimer);
          setMsg("Task failed: " + (t.error || "Unknown error"), "err");
          setLive("err", "Failed", t.error || "");
        } else {
          setLive("running", "Running", "Status: " + (t.status || "processing") + " · " + fmt(t.created_at));
        }
      })
      .catch(function () {});
    }, 5000);
  }

  /* ── load history from API ── */
  function loadHistory() {
    var token = tok();
    if (!token) return;

    fetch(API_URL + "/api/ai/tasks?agent_type=" + encodeURIComponent(AGENT_TYPE) + "&limit=50", {
      headers: { "Authorization": "Bearer " + token }
    })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      var tasks = (data && Array.isArray(data.tasks)) ? data.tasks : [];
      renderStats(tasks);
      renderHistory(tasks);
    })
    .catch(function () {
      var el = document.getElementById("apHistory");
      if (el) el.innerHTML = '<div class="ap-empty-state">Could not load history.</div>';
    });
  }

  /* ── stats + bar chart ── */
  function renderStats(tasks) {
    var total    = tasks.length;
    var done     = tasks.filter(function (t) { return t.status === "completed"; }).length;
    var active   = tasks.filter(function (t) { return t.status === "processing"; }).length;
    var lastTask = tasks[0];
    var lastDate = lastTask ? (lastTask.updated_at || lastTask.created_at) : null;

    var setVal = function (id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };
    setVal("apStatTotal",  total);
    setVal("apStatDone",   done);
    setVal("apStatActive", active);
    setVal("apStatLast",   lastDate ? fmt(lastDate) : "Never");

    /* 7-day sparkline */
    var chartEl    = document.getElementById("apChart");
    var daysLblEl  = document.getElementById("apChartDays");
    if (!chartEl) return;

    var buckets = [0,0,0,0,0,0,0];
    var now = Date.now();
    tasks.forEach(function (t) {
      var d = new Date(t.created_at || t.updated_at);
      if (isNaN(d.getTime())) return;
      var diff = Math.floor((now - d.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) buckets[6 - diff]++;
    });
    var peak = Math.max.apply(null, buckets) || 1;
    var labels = dayLabels();
    var accentSafe = esc(ACCENT);

    chartEl.innerHTML = buckets.map(function (v, i) {
      var pct   = v / peak;
      var h     = Math.max(4, Math.round(pct * 48));
      var alpha = (0.22 + pct * 0.6).toFixed(2);
      return '<div class="ap-bar" style="height:' + h + 'px;background:' + accentSafe +
        ';opacity:' + alpha + '" title="' + v + ' task' + (v === 1 ? '' : 's') +
        ' · ' + esc(labels[i]) + '"></div>';
    }).join("");

    if (daysLblEl) {
      daysLblEl.innerHTML = labels.map(function (l) {
        return '<div class="ap-chart-day">' + esc(l) + '</div>';
      }).join("");
    }
  }

  /* ── history list ── */
  function renderHistory(tasks) {
    var el = document.getElementById("apHistory");
    if (!el) return;

    if (!tasks.length) {
      el.innerHTML = '<div class="ap-empty-state">No tasks run yet for ' + esc(AGENT_LABEL) +
        '. Use the launcher above to run your first task.</div>';
      return;
    }

    var html = '<div class="ap-history">';
    tasks.slice(0, 15).forEach(function (t) {
      var promptText = t.prompt || t.task_type || "Task";
      var title = promptText.length > 90 ? promptText.slice(0, 90) + "…" : promptText;
      var preview = t.result
        ? (t.result.length > 200 ? t.result.slice(0, 200) + "…" : t.result)
        : "Processing…";
      var statusCls = (t.status === "completed") ? "completed"
        : (t.status === "failed") ? "failed"
        : "processing";

      html += '<div class="ap-hist-item">' +
        '<div class="ap-hist-title">' + esc(title) + '</div>' +
        '<div class="ap-hist-meta">' + esc(fmt(t.created_at)) + ' · ' + esc(t.task_type || "general") + '</div>' +
        '<div class="ap-hist-preview">' + esc(preview) + '</div>' +
        '<span class="ap-hist-tag ' + statusCls + '">' + esc(t.status || "unknown") + '</span>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ── boot ── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();

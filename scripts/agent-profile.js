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

  var pollTimer     = null;
  var activeTaskId  = null;
  var pendingPrompt = "";

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
    ".ap-btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important}",
    ".ap-msg{margin-top:12px;font-size:.85rem;min-height:20px;color:#8892b8}",
    ".ap-msg.ok{color:#4ade80}.ap-msg.err{color:#f87171}",
    /* spinner */
    "@keyframes ap-spin{to{transform:rotate(360deg)}}",
    ".ap-spinner{width:14px;height:14px;border-radius:50%;",
      "border:2px solid rgba(255,255,255,.3);border-top-color:#fff;",
      "animation:ap-spin .7s linear infinite;display:inline-block;flex-shrink:0}",
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
    ".ap-bar{flex:1;border-radius:4px 4px 0 0;min-height:4px;transition:height .5s ease;cursor:default}",
    ".ap-chart-labels{display:flex;gap:5px;margin-bottom:4px}",
    ".ap-chart-day{flex:1;text-align:center;font-size:.6rem;color:#555c78}",
    /* result card (fresh task output) */
    "@keyframes ap-fadein{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}",
    ".ap-result-card{padding:20px 22px;border-radius:16px;background:rgba(8,12,28,.88);",
      "border:1px solid rgba(0,229,255,.4);",
      "box-shadow:0 0 28px rgba(0,229,255,.13),0 8px 32px rgba(0,0,0,.45);",
      "animation:ap-fadein .4s ease}",
    ".ap-result-sublabel{font-size:.63rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;",
      "color:#22d3ee;margin-bottom:6px}",
    ".ap-result-input{font-size:.82rem;color:#c4b5fd;line-height:1.55;padding:10px 14px;border-radius:10px;",
      "background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.22);",
      "margin-bottom:14px;word-break:break-word}",
    ".ap-result-body{font-size:.875rem;color:#e8e8ff;line-height:1.7;white-space:pre-wrap;word-break:break-word;",
      "max-height:420px;overflow-y:auto;padding:12px 14px;border-radius:10px;",
      "background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.1)}",
    /* history list */
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
    /* expand/collapse button */
    ".ap-hist-expand{display:inline-block;margin-top:10px;padding:4px 10px;",
      "border:1px solid rgba(0,229,255,.25);border-radius:8px;background:none;",
      "color:#22d3ee;font-size:.68rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;",
      "cursor:pointer;font-family:inherit;transition:border-color .2s}",
    ".ap-hist-expand:hover{border-color:rgba(0,229,255,.55)}",
    /* full response in history item */
    ".ap-hist-full{display:none;margin-top:10px;font-size:.82rem;color:#e8e8ff;line-height:1.65;",
      "white-space:pre-wrap;word-break:break-word;max-height:320px;overflow-y:auto;",
      "padding:10px 12px;border-radius:10px;",
      "background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.1)}",
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

    var accentRgb = ACCENT;

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

    /* expand/collapse delegation on history container */
    var histEl = document.getElementById("apHistory");
    if (histEl) {
      histEl.addEventListener("click", function (e) {
        var target = e.target;
        while (target && target !== histEl) {
          if (target.className && target.className.indexOf("ap-hist-expand") !== -1) {
            var item = target.parentNode;
            var fullEl = item.querySelector ? item.querySelector(".ap-hist-full") : null;
            if (fullEl) {
              var isHidden = fullEl.style.display !== "block";
              fullEl.style.display = isHidden ? "block" : "none";
              target.textContent = isHidden ? "Hide response ▴" : "Show full response ▾";
            }
            return;
          }
          target = target.parentNode;
        }
      });
    }

    document.getElementById("apLaunchBtn").addEventListener("click", launchTask);
    loadHistory();
  }

  /* ── button loading state ── */
  function setBtnLoading(loading) {
    var btn = document.getElementById("apLaunchBtn");
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<span class="ap-spinner"></span>Running…';
    } else {
      btn.disabled = false;
      btn.textContent = "Launch Task";
    }
  }

  /* ── status helpers ── */
  function setMsg(text, cls) {
    var el = document.getElementById("apMsg");
    if (!el) return;
    el.textContent = text;
    el.className = "ap-msg" + (cls ? " " + cls : "");
  }

  function setLive(dotCls, label, meta) {
    var dot   = document.getElementById("apDot");
    var lbl   = document.getElementById("apLiveLabel");
    var meta2 = document.getElementById("apLiveMeta");
    if (dot)   dot.className   = "ap-dot " + (dotCls || "idle");
    if (lbl)   lbl.textContent = label || "Idle";
    if (meta2) meta2.textContent = meta || "";
  }

  /* ── prepend fresh result card into Task History ── */
  function prependResultCard(task) {
    var histEl = document.getElementById("apHistory");
    if (!histEl) return;

    var emptyEl = histEl.querySelector(".ap-empty-state");
    if (emptyEl) emptyEl.parentNode.removeChild(emptyEl);

    var wrapper = histEl.querySelector(".ap-history");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "ap-history";
      histEl.insertBefore(wrapper, histEl.firstChild);
    }

    var prompt    = task.prompt || pendingPrompt || "Task";
    var result    = task.result || "";
    var timestamp = fmt(task.updated_at || task.created_at || new Date().toISOString());
    var taskType  = task.task_type || "general";

    var card = document.createElement("div");
    card.className = "ap-result-card";
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
        '<div style="font-size:.9rem;font-weight:800;color:#4ade80">✓ Task Completed</div>' +
        '<div style="font-size:.72rem;color:#8888aa">' + esc(timestamp) + ' · ' + esc(taskType) + '</div>' +
      '</div>' +
      '<div class="ap-result-sublabel" style="color:#c4b5fd">Your Request</div>' +
      '<div class="ap-result-input">' + esc(prompt) + '</div>' +
      '<div class="ap-result-sublabel">AI Response</div>' +
      '<div class="ap-result-body">' + esc(result || "No result returned.") + '</div>';

    wrapper.insertBefore(card, wrapper.firstChild);
  }

  /* ── task submission ── */
  function launchTask() {
    var promptEl = document.getElementById("apTaskPrompt");
    var typeEl   = document.getElementById("apTaskType");
    var token    = tok();

    if (!token)  { setMsg("Not signed in.", "err"); return; }
    var userPrompt = promptEl ? promptEl.value.trim() : "";
    if (!userPrompt) { setMsg("Enter a task prompt first.", "err"); return; }

    var taskType  = typeEl ? typeEl.value : "general";
    pendingPrompt = userPrompt;

    if (taskType === "social_media_drafts") {
      setBtnLoading(true);
      setMsg("Loading business profile…");
      setLive("running", "Preparing…", "Fetching business context");

      fetch(API_URL + "/api/business-profile", {
        headers: { "Authorization": "Bearer " + token }
      })
      .then(function (r) {
        if (!r.ok) throw new Error("Could not load business profile (HTTP " + r.status + ")");
        return r.json();
      })
      .then(function (d) {
        var finalPrompt = buildSocialPrompt(d.profile, userPrompt);
        setMsg("Launching task…");
        setLive("running", "Launching…", "Sending to " + AGENT_LABEL);
        doSubmit(finalPrompt, taskType, userPrompt, promptEl);
      })
      .catch(function (e) {
        setBtnLoading(false);
        setMsg(e.message || "Could not load profile.", "err");
        setLive("err", "Error", e.message || "");
      });
    } else {
      setBtnLoading(true);
      setMsg("Launching task…");
      setLive("running", "Launching…", "Sending to " + AGENT_LABEL);
      doSubmit(userPrompt, taskType, userPrompt, promptEl);
    }
  }

  /* builds enriched prompt from business profile + user request */
  function buildSocialPrompt(profile, userPrompt) {
    var p = profile || {};
    var lines = [
      "You are a social media content strategist. Use the business context below to write on-brand content.",
      "",
      "BUSINESS CONTEXT:"
    ];
    if (p.business_name)     lines.push("Business Name: "       + p.business_name);
    if (p.industry)          lines.push("Industry: "            + p.industry);
    if (p.brand_voice)       lines.push("Brand Voice: "         + p.brand_voice);
    if (p.brand_values)      lines.push("Brand Values: "        + p.brand_values);
    if (p.target_audience)   lines.push("Target Audience: "     + p.target_audience);
    if (p.business_goals)    lines.push("Business Goals: "      + p.business_goals);
    if (p.products_services) lines.push("Products & Services: " + p.products_services);
    if (p.description)       lines.push("About the Business: "  + p.description);
    if (p.banned_topics)     lines.push("Topics to Avoid: "     + p.banned_topics);
    lines.push("", "USER REQUEST:", userPrompt);
    return lines.join("\n");
  }

  /* sends prompt to /api/agents/run-task; displayPrompt is shown in the result card */
  function doSubmit(finalPrompt, taskType, displayPrompt, promptEl) {
    var token = tok();
    fetch(API_URL + "/api/agents/run-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        agent_type: AGENT_TYPE,
        task_type:  taskType,
        prompt:     finalPrompt
      })
    })
    .then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    })
    .then(function (res) {
      if (!res.ok) throw new Error(res.data.error || ("Server error " + res.status));

      var taskId       = res.data.task && res.data.task.id;
      var directResult = res.data.result || (res.data.task && res.data.task.result);

      if (promptEl) promptEl.value = "";

      if (directResult) {
        setBtnLoading(false);
        setMsg("Task completed!", "ok");
        setLive("ok", "Completed", fmt(new Date().toISOString()));
        prependResultCard({
          prompt: displayPrompt, result: directResult,
          task_type: taskType, created_at: new Date().toISOString(), status: "completed"
        });
        loadHistory();
      } else if (taskId) {
        activeTaskId = taskId;
        setMsg("Task running — waiting for result…", "ok");
        setLive("running", "Running", "Task ID: " + taskId);
        startPoll(taskId, displayPrompt);
      } else {
        setBtnLoading(false);
        setMsg("Task accepted.", "ok");
        setLive("ok", "Accepted", "");
      }
    })
    .catch(function (e) {
      setBtnLoading(false);
      setMsg(e.message || "Task failed.", "err");
      setLive("err", "Error", e.message || "");
    });
  }

  /* ── task polling ── */
  function startPoll(taskId, promptText) {
    if (pollTimer) clearInterval(pollTimer);
    var ticks = 0;
    pollTimer = setInterval(function () {
      ticks++;
      if (ticks > 72) {
        clearInterval(pollTimer);
        setBtnLoading(false);
        setLive("idle", "Idle", "Polling timed out — check mailbox for results");
        return;
      }
      var token = tok();
      if (!token) { clearInterval(pollTimer); setBtnLoading(false); return; }

      fetch(API_URL + "/api/ai/tasks/" + taskId, {
        headers: { "Authorization": "Bearer " + token }
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.task) return;
        var t = data.task;
        if (t.status === "completed") {
          clearInterval(pollTimer);
          setBtnLoading(false);
          setMsg("Task completed!", "ok");
          setLive("ok", "Completed", "Finished: " + fmt(t.updated_at || t.created_at));
          if (!t.prompt) t.prompt = promptText;
          prependResultCard(t);
          loadHistory();
        } else if (t.status === "failed") {
          clearInterval(pollTimer);
          setBtnLoading(false);
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

    var chartEl   = document.getElementById("apChart");
    var daysLblEl = document.getElementById("apChartDays");
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
      var title      = promptText.length > 90 ? promptText.slice(0, 90) + "…" : promptText;
      var hasResult  = !!(t.result);
      var preview    = hasResult
        ? (t.result.length > 180 ? t.result.slice(0, 180) + "…" : t.result)
        : "Processing…";
      var statusCls  = (t.status === "completed") ? "completed"
        : (t.status === "failed") ? "failed"
        : "processing";

      html +=
        '<div class="ap-hist-item">' +
          '<div class="ap-hist-title">' + esc(title) + '</div>' +
          '<div class="ap-hist-meta">' + esc(fmt(t.created_at)) + ' · ' + esc(t.task_type || "general") + '</div>' +
          '<div class="ap-hist-preview">' + esc(preview) + '</div>' +
          (hasResult ? '<div class="ap-hist-full">' + esc(t.result) + '</div>' : '') +
          '<span class="ap-hist-tag ' + statusCls + '">' + esc(t.status || "unknown") + '</span>' +
          (hasResult ? '<button class="ap-hist-expand" type="button">Show full response ▾</button>' : '') +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ── boot ── */
  document.addEventListener("DOMContentLoaded", inject);
})();

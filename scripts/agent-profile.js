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
  /* This agent's own tools, the same idea as taskTypes: declared per page, so one
     mechanism serves eighteen pages without any of them being special-cased here.
     An agent with none configured gets NO tools section at all — see inject(). */
  var TOOLS       = Array.isArray(cfg.tools) ? cfg.tools : [];
  var HAS_SOCIAL_DRAFTS = TASK_TYPES.some(function(t) { return t.value === "social_media_drafts"; });

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
    /* autonomy toggle — lives inside the Run Task card, below the divider */
    ".ap-auto{margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08)}",
    ".ap-auto-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}",
    ".ap-auto-copy{flex:1;min-width:200px}",
    ".ap-auto-title{font-size:.9rem;font-weight:700;color:#e8e8ff;margin-bottom:4px}",
    ".ap-auto-desc{font-size:.78rem;color:#8892b8;line-height:1.55}",
    ".ap-auto-switch{position:relative;display:inline-block;width:46px;height:26px;flex-shrink:0}",
    ".ap-auto-switch input{position:absolute;opacity:0;width:0;height:0}",
    ".ap-auto-slider{position:absolute;inset:0;border-radius:999px;cursor:pointer;",
      "background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.16);",
      "transition:background .25s,border-color .25s}",
    ".ap-auto-slider::before{content:\"\";position:absolute;top:3px;left:3px;width:18px;height:18px;",
      "border-radius:50%;background:#cfd3ea;transition:transform .25s,background .25s}",
    ".ap-auto-switch input:checked + .ap-auto-slider{background:linear-gradient(90deg,#06b6d4,#8b5cf6);",
      "border-color:rgba(139,92,246,.55)}",
    ".ap-auto-switch input:checked + .ap-auto-slider::before{transform:translateX(20px);background:#fff}",
    ".ap-auto-switch input:disabled + .ap-auto-slider{cursor:not-allowed;opacity:.5}",
    /* UNKNOWN is a THIRD look, not a dimmed "off". A failed read must not be
       able to pass for a switch that is merely disabled in the off position:
       the knob sits mid-track and the fill is hatched, so it reads as "no
       answer" rather than as "not enabled". */
    ".ap-auto-switch.unknown .ap-auto-slider{opacity:1;",
      "background:repeating-linear-gradient(45deg,rgba(248,113,113,.18) 0 4px,rgba(255,255,255,.05) 4px 8px);",
      "border-color:rgba(248,113,113,.4)}",
    ".ap-auto-switch.unknown .ap-auto-slider::before{transform:translateX(10px);background:#f87171}",
    ".ap-auto-msg{margin-top:10px;font-size:.78rem;min-height:18px;color:#8892b8}",
    ".ap-auto-msg.ok{color:#4ade80}.ap-auto-msg.err{color:#f87171}",
    /* scheduler — same card, below the autonomy toggle */
    ".ap-sched{margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08)}",
    ".ap-sched-title{font-size:.9rem;font-weight:700;color:#e8e8ff;margin-bottom:4px}",
    ".ap-sched-desc{font-size:.78rem;color:#8892b8;line-height:1.55;margin-bottom:14px}",
    /* SET. What the agent is actually going to do, in words. */
    ".ap-sched-summary{padding:14px 16px;border-radius:14px;",
      "background:rgba(6,182,212,.07);border:1px solid rgba(6,182,212,.28)}",
    ".ap-sched-when{font-size:.85rem;font-weight:700;color:#e8e8ff;line-height:1.5}",
    ".ap-sched-instr{margin-top:8px;font-size:.8rem;color:#c3c9e6;line-height:1.55;",
      "white-space:pre-wrap;word-break:break-word}",
    ".ap-sched-instr-label{display:block;font-size:.7rem;letter-spacing:.08em;",
      "text-transform:uppercase;color:#8892b8;margin-bottom:3px}",
    ".ap-sched-last{margin-top:8px;font-size:.75rem;color:#8892b8}",
    /* NONE. A real answer, and it says what the absence means. */
    ".ap-sched-empty{padding:12px 14px;border-radius:12px;font-size:.8rem;color:#8892b8;",
      "background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.14);line-height:1.55}",
    /* UNKNOWN is a THIRD look, and deliberately not a dimmed version of either
       of the other two. A failed read must not be able to pass for "no schedule
       set": the hatching and the warning border say "no answer", where the
       dashed empty state says "answered, and the answer is none". */
    ".ap-sched-unknown{padding:12px 14px;border-radius:12px;font-size:.8rem;color:#f5b5b5;",
      "line-height:1.55;border:1px solid rgba(248,113,113,.4);",
      "background:repeating-linear-gradient(45deg,rgba(248,113,113,.14) 0 5px,rgba(255,255,255,.03) 5px 10px)}",
    ".ap-sched-form{margin-top:14px}",
    ".ap-sched-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}",
    ".ap-sched-field{display:flex;flex-direction:column;gap:5px}",
    ".ap-sched-label{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#8892b8}",
    ".ap-sched-hint{font-size:.72rem;color:#7b83a6;margin-top:5px;line-height:1.5}",
    ".ap-sched-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}",
    ".ap-sched-btn{padding:9px 16px;border-radius:10px;border:none;cursor:pointer;",
      "font-size:.8rem;font-weight:700;color:#05070f;",
      "background:linear-gradient(90deg,#06b6d4,#8b5cf6)}",
    ".ap-sched-btn:disabled{opacity:.5;cursor:not-allowed}",
    ".ap-sched-btn.ghost{background:transparent;color:#c3c9e6;",
      "border:1px solid rgba(255,255,255,.18)}",
    ".ap-sched-btn.danger{background:transparent;color:#f87171;",
      "border:1px solid rgba(248,113,113,.45)}",
    /* The delete confirmation. Inline rather than a window.confirm: a native
       dialog cannot carry the sentence about the instruction not being kept, and
       that sentence is the reason this step exists at all. */
    ".ap-sched-confirm{margin-top:12px;padding:12px 14px;border-radius:12px;",
      "border:1px solid rgba(248,113,113,.45);background:rgba(248,113,113,.08);",
      "font-size:.8rem;color:#f5d0d0;line-height:1.6}",
    ".ap-sched-msg{margin-top:10px;font-size:.78rem;min-height:18px;color:#8892b8}",
    ".ap-sched-msg.ok{color:#4ade80}.ap-sched-msg.err{color:#f87171}",
    /* agent tools — same card, below the scheduler */
    ".ap-tools{margin-top:20px;padding-top:18px;border-top:1px solid rgba(255,255,255,.08)}",
    ".ap-tools-title{font-size:.9rem;font-weight:700;color:#e8e8ff;margin-bottom:4px}",
    ".ap-tools-desc{font-size:.78rem;color:#8892b8;line-height:1.55;margin-bottom:14px}",
    ".ap-tool{margin-top:12px;border-radius:14px;border:1px solid rgba(255,255,255,.1);",
      "background:rgba(255,255,255,.02);overflow:hidden}",
    ".ap-tool-head{width:100%;text-align:left;padding:12px 14px;background:transparent;border:none;",
      "cursor:pointer;display:flex;align-items:center;gap:10px;color:#e8e8ff;font-size:.85rem;font-weight:700}",
    ".ap-tool-caret{margin-left:auto;color:#8892b8;font-size:.75rem;flex-shrink:0}",
    ".ap-tool-sub{display:block;font-size:.75rem;font-weight:400;color:#8892b8;margin-top:3px;line-height:1.5}",
    ".ap-tool-body{padding:0 14px 14px}",
    ".ap-tool-field{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}",
    ".ap-tool-label{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:#8892b8}",
    ".ap-tool-req{color:#f472b6;margin-left:4px}",
    ".ap-tool-hint{font-size:.72rem;color:#7b83a6;line-height:1.5}",
    ".ap-tool-checks{display:flex;flex-wrap:wrap;gap:10px}",
    ".ap-tool-check{display:flex;align-items:center;gap:6px;font-size:.8rem;color:#c3c9e6}",
    ".ap-tool-rows{display:flex;flex-direction:column;gap:8px}",
    ".ap-tool-row{display:grid;gap:8px}",
    ".ap-tool-addrow{align-self:flex-start;padding:6px 12px;border-radius:9px;font-size:.75rem;",
      "background:transparent;color:#c3c9e6;border:1px solid rgba(255,255,255,.18);cursor:pointer}",
    ".ap-tool-run{padding:9px 16px;border-radius:10px;border:none;cursor:pointer;font-size:.8rem;",
      "font-weight:700;color:#05070f;background:linear-gradient(90deg,#06b6d4,#8b5cf6)}",
    ".ap-tool-run:disabled{opacity:.5;cursor:not-allowed}",
    ".ap-tool-msg{margin-top:10px;font-size:.78rem;min-height:18px;color:#8892b8}",
    ".ap-tool-msg.err{color:#f87171}",
    ".ap-tool-result{margin-top:14px;display:flex;flex-direction:column;gap:14px}",

    /* THE GATE. ready_to_post / ready_to_send false means the draft would breach a
       platform's terms or start a public argument. It is the loudest thing in the
       result and it sits above the draft, because someone who copies the text out
       without seeing this is the exact harm the backend check exists to prevent. */
    ".ap-gate{padding:14px 16px;border-radius:12px;border:2px solid #f87171;",
      "background:rgba(248,113,113,.14);color:#ffd7d7;font-size:.82rem;line-height:1.6}",
    ".ap-gate-title{display:flex;align-items:center;gap:8px;font-weight:800;color:#fca5a5;",
      "text-transform:uppercase;letter-spacing:.06em;font-size:.75rem;margin-bottom:6px}",
    ".ap-gate ul{margin:8px 0 0;padding-left:18px}",
    ".ap-gate li{margin-bottom:4px}",

    /* THREE VOICES, DELIBERATELY DIFFERENT.

       Generated text is the model writing: normal prose, on the card ground.
       Measured is arithmetic the server did: monospace figures on a cyan-edged
       panel, because a character count is a fact of a different kind.
       Provenance is the page speaking about the other two: muted, bordered,
       explicitly split into what was counted and what was inferred.

       A page that renders all three in one voice invites the model's claims to be
       read with the authority of the counts, which is the thing the backend
       returning them separately exists to prevent. */
    ".ap-zone-label{font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;",
      "color:#8892b8;margin-bottom:6px;display:flex;align-items:center;gap:7px}",
    ".ap-zone-label::after{content:\"\";flex:1;height:1px;background:rgba(255,255,255,.08)}",

    ".ap-generated{padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.03);",
      "border:1px solid rgba(255,255,255,.09);font-size:.84rem;color:#e2e6f5;line-height:1.65}",
    ".ap-generated pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}",
    ".ap-gen-item{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}",
    ".ap-gen-item:last-child{border-bottom:none}",
    ".ap-gen-key{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#8892b8;margin-bottom:3px}",

    ".ap-measured{padding:14px 16px;border-radius:12px;background:rgba(6,182,212,.07);",
      "border:1px solid rgba(6,182,212,.3)}",
    ".ap-measured .ap-zone-label{color:#67e8f9}",
    ".ap-measured .ap-zone-label::after{background:rgba(6,182,212,.25)}",
    ".ap-m-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}",
    ".ap-m-cell{background:rgba(6,182,212,.06);border-radius:9px;padding:8px 10px}",
    ".ap-m-key{font-size:.68rem;color:#8892b8;text-transform:uppercase;letter-spacing:.05em}",
    ".ap-m-val{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;",
      "font-size:.9rem;font-weight:700;color:#a5f3fc;margin-top:2px;word-break:break-word}",
    ".ap-m-val.bad{color:#fca5a5}.ap-m-val.good{color:#86efac}",
    ".ap-m-note{margin-top:10px;font-size:.78rem;color:#cffafe;line-height:1.6}",
    ".ap-m-list{margin:6px 0 0;padding-left:16px;font-size:.76rem;color:#cffafe;line-height:1.6}",

    ".ap-prov{padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.02);",
      "border:1px dashed rgba(255,255,255,.18)}",
    ".ap-prov-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}",
    ".ap-prov-col h5{margin:0 0 5px;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em}",
    ".ap-prov-col.counted h5{color:#67e8f9}",
    ".ap-prov-col.inferred h5{color:#c4b5fd}",
    ".ap-prov-col ul{margin:0;padding-left:16px;font-size:.76rem;line-height:1.6;color:#a9b0cc}",
    ".ap-prov-caveat{margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08);",
      "font-size:.76rem;color:#8892b8;line-height:1.6}",
    ".ap-prov-flags{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}",
    ".ap-prov-flag{font-size:.68rem;padding:3px 8px;border-radius:99px;",
      "background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.28);color:#fca5a5}",

    ".ap-ref{padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.02);",
      "border:1px solid rgba(255,255,255,.07);font-size:.76rem;color:#8892b8;line-height:1.6}",

    /* A 502 is a PARSE FAILURE, not an empty result, and the raw text is shown so
       the failure is diagnosable rather than merely reported. */
    ".ap-parsefail{padding:14px 16px;border-radius:12px;border:1px solid rgba(251,191,36,.45);",
      "background:rgba(251,191,36,.08);color:#fde68a;font-size:.82rem;line-height:1.6}",
    ".ap-parsefail pre{margin:10px 0 0;padding:10px;border-radius:8px;background:rgba(0,0,0,.35);",
      "color:#e2e6f5;font-size:.74rem;max-height:260px;overflow:auto;white-space:pre-wrap;word-break:break-word}",
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
    ".ap-result-body{font-size:.875rem;color:#e8e8ff;line-height:1.7;word-break:break-word;",
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
      "word-break:break-word;max-height:320px;overflow-y:auto;",
      "padding:10px 12px;border-radius:10px;",
      "background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.1)}",
    ".ap-empty-state{padding:22px;text-align:center;font-size:.875rem;color:#8888aa;",
      "border:1px dashed rgba(168,85,247,.3);border-radius:14px;background:rgba(168,85,247,.05)}",
    /* markdown rendered output */
    ".ap-md-h1,.ap-md-h2{font-size:1rem;font-weight:800;color:#e8e8ff;margin:12px 0 5px}",
    ".ap-md-h3,.ap-md-h4{font-size:.9rem;font-weight:700;color:#22d3ee;margin:10px 0 4px}",
    ".ap-md-h5,.ap-md-h6{font-size:.82rem;font-weight:700;color:#c4b5fd;margin:8px 0 3px}",
    ".ap-md-p{margin:0 0 5px;line-height:1.65}",
    ".ap-md-gap{height:5px}",
    ".ap-md-ul,.ap-md-ol{margin:3px 0 8px;padding-left:18px}",
    ".ap-md-ul li,.ap-md-ol li{margin-bottom:3px;line-height:1.6}",
    ".ap-md-hr{border:none;border-top:1px solid rgba(0,229,255,.18);margin:10px 0}",
    ".ap-md-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:.8rem}",
    ".ap-md-table th,.ap-md-table td{padding:6px 10px;border:1px solid rgba(255,255,255,.1);text-align:left;line-height:1.45}",
    ".ap-md-table th{background:rgba(0,229,255,.08);color:#22d3ee;font-weight:700;font-size:.72rem;letter-spacing:.04em}",
    ".ap-md-table tr:nth-child(even) td{background:rgba(255,255,255,.03)}",
    ".ap-md-pre{background:rgba(8,12,28,.9);border:1px solid rgba(0,229,255,.15);border-radius:8px;padding:10px 12px;margin:8px 0;overflow-x:auto}",
    ".ap-md-pre code{font-family:monospace;font-size:.78rem;color:#a5f3fc;line-height:1.55}",
    ".ap-md-code{font-family:monospace;font-size:.82em;background:rgba(0,229,255,.08);border:1px solid rgba(0,229,255,.2);border-radius:4px;padding:1px 5px;color:#a5f3fc}",
    /* approve / reject on result card */
    ".ap-approve-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border:none;border-radius:10px;",
      "font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;",
      "background:linear-gradient(135deg,#059669,#10b981);cursor:pointer;transition:all .2s;",
      "box-shadow:0 2px 12px rgba(16,185,129,.3);font-family:inherit}",
    ".ap-approve-btn:hover{transform:translateY(-1px);box-shadow:0 4px 18px rgba(16,185,129,.45)}",
    ".ap-approve-btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important}",
    ".ap-reject-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;",
      "border:1px solid rgba(248,113,113,.35);border-radius:10px;",
      "font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;",
      "color:#f87171;background:rgba(248,113,113,.06);cursor:pointer;transition:all .2s;font-family:inherit}",
    ".ap-reject-btn:hover{border-color:rgba(248,113,113,.65);background:rgba(248,113,113,.12)}",
    ".ap-reject-btn:disabled{opacity:.45;cursor:not-allowed}",
    /* approval queue */
    ".ap-queue-empty{padding:18px;text-align:center;font-size:.85rem;color:#8888aa;",
      "border:1px dashed rgba(74,222,128,.25);border-radius:12px;background:rgba(74,222,128,.04)}",
    ".ap-queue-list{display:flex;flex-direction:column;gap:10px}",
    ".ap-queue-item{padding:14px 16px;border-radius:12px;background:rgba(8,12,28,.65);",
      "border:1px solid rgba(74,222,128,.18);transition:border-color .2s,transform .2s}",
    ".ap-queue-item:hover{border-color:rgba(74,222,128,.4);transform:translateY(-1px)}",
    ".ap-queue-item-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}",
    ".ap-queue-platform{padding:3px 9px;border-radius:999px;font-size:.65rem;font-weight:700;letter-spacing:.08em;",
      "text-transform:uppercase;background:rgba(0,229,255,.1);border:1px solid rgba(0,229,255,.25);color:#22d3ee}",
    ".ap-queue-status{padding:3px 9px;border-radius:999px;font-size:.65rem;font-weight:700;letter-spacing:.08em;",
      "text-transform:uppercase;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);color:#4ade80}",
    ".ap-queue-time{font-size:.68rem;color:#8888aa;margin-left:auto}",
    ".ap-queue-preview{font-size:.82rem;color:#8892b8;line-height:1.55;",
      "display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}",
    /* individual post cards inside a social drafts result */
    ".ap-social-post{padding:14px 16px;border-radius:12px;background:rgba(0,229,255,.03);",
      "border:1px solid rgba(0,229,255,.1);margin-bottom:10px}",
    ".ap-social-post:last-child{margin-bottom:0}",
    ".ap-social-post-num{font-size:.63rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;",
      "color:#22d3ee;margin-bottom:8px}"
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

  /* ── schedule option lists and wording ── */

  // 0 = Sunday through 6 = Saturday, which is the encoding agent_schedules
  // .day_of_week uses. Stated here because the other obvious convention starts
  // the week on Monday and the two are off by one all the way along.
  var SCHED_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  var SCHED_MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  function dayOfWeekOptions() {
    return SCHED_DAY_NAMES.map(function (name, i) {
      return '<option value="' + i + '">' + esc(name) + '</option>';
    }).join("");
  }

  function ordinal(n) {
    var rem100 = n % 100;
    if (rem100 >= 11 && rem100 <= 13) return n + "th";
    if (n % 10 === 1) return n + "st";
    if (n % 10 === 2) return n + "nd";
    if (n % 10 === 3) return n + "rd";
    return n + "th";
  }

  function dayOfMonthOptions() {
    var out = "", d;
    for (d = 1; d <= 31; d++) {
      /* 29, 30 and 31 are labelled with what actually happens in a short month,
         because the alternative is someone picking the 31st and quietly getting
         eight runs a year. The runner clamps to the month's last day — migration
         102's header is explicit about it — so the label states the clamp rather
         than leaving the picker to imply a month that does not exist. */
      var suffix = d >= 29 ? " (or the last day, in shorter months)" : "";
      out += '<option value="' + d + '">' + ordinal(d) + suffix + '</option>';
    }
    return out;
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function hourOptions() {
    var out = "", h;
    for (h = 0; h <= 23; h++) {
      out += '<option value="' + h + '">' + pad2(h) + ':00 UTC</option>';
    }
    return out;
  }

  /* A date-only column formatted from its own parts, NOT through `new Date`.
     last_run_on is a DATE ("2026-09-09") and new Date() reads a bare date string
     as UTC midnight, so toLocaleDateString renders it as the previous day for
     every viewer west of Greenwich. That is the timezone trap this project has
     already been bitten by, and it is worth avoiding in the one place whose
     whole job is to report which day something happened. */
  function fmtDateOnly(value) {
    var parts = String(value || "").split("-");
    if (parts.length !== 3) return String(value || "");
    var y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2]);
    if (!y || !m || !d || m < 1 || m > 12) return String(value);
    return ordinal(d) + " " + SCHED_MONTH_NAMES[m - 1] + " " + y;
  }

  /* The label this page gives a task value, falling back to the raw value.
     The fallback is reachable: the stored schedule is whatever the server holds,
     and this page's taskTypes can change underneath it, so a schedule may name a
     task this list no longer offers. Showing the raw value is honest; showing
     nothing would make the summary read as though no task were set. */
  function taskLabel(value) {
    var i;
    for (i = 0; i < TASK_TYPES.length; i++) {
      if (TASK_TYPES[i].value === value) return TASK_TYPES[i].label;
    }
    return String(value || "—");
  }

  /* What the schedule says, as a sentence. The point of this control is that
     someone coming back to the page can read what their agent is set to do
     without reading it off a row of dropdowns. */
  function scheduleSentence(row) {
    var when;
    if (row.cadence === "weekly") {
      when = "every " + (SCHED_DAY_NAMES[row.day_of_week] || "week");
    } else if (row.cadence === "monthly") {
      when = "on the " + ordinal(row.day_of_month) + " of each month";
      if (row.day_of_month >= 29) when += " (or its last day, in shorter months)";
    } else {
      when = "every day";
    }
    return "Runs the " + taskLabel(row.task_type) + " task " + when +
      " at " + pad2(Number(row.hour_utc)) + ":00 UTC.";
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

          /* IN THIS CARD, NOT A PANEL OF ITS OWN. Running the agent by hand
             and letting it run by itself are the two ways this agent does
             work, and the agent model requires them in one surface. Split
             across two cards, someone can read the manual controls, decide the
             agent is idle unless they press the button, and never scroll to the
             switch that says otherwise. */
          '<div class="ap-auto">',
            '<div class="ap-auto-head">',
              '<div class="ap-auto-copy">',
                '<div class="ap-auto-title">Autonomous mode</div>',
                '<div class="ap-auto-desc">',
                  'Lets the ' + esc(AGENT_LABEL) + ' start its own tasks in the background ',
                  'without you launching them, and act on what it finds. Off means it ',
                  'only ever runs when you press Launch Task above.',
                '</div>',
              '</div>',
              /* Starts DISABLED and marked unknown. It is enabled only by a
                 GET that succeeded, so at no point before an answer arrives
                 does it show a position it cannot back up. */
              '<label class="ap-auto-switch unknown" id="apAutoSwitch">',
                '<input type="checkbox" id="apAutoToggle" disabled>',
                '<span class="ap-auto-slider"></span>',
              '</label>',
            '</div>',
            '<div class="ap-auto-msg" id="apAutoMsg">Checking…</div>',
          '</div>',

          /* STILL THE SAME CARD. Launch is "run it now", the toggle is "it may
             run itself", and this is "and here is when" — three parts of one
             decision about how this agent does work, so they share one surface.
             A schedule in a panel of its own could be read while the toggle
             above it said something that contradicted it. */
          '<div class="ap-sched">',
            '<div class="ap-sched-title">Scheduled runs</div>',
            '<div class="ap-sched-desc">',
              'A standing instruction the ' + esc(AGENT_LABEL) + ' carries out on a repeating ',
              'schedule. It runs only while Autonomous mode above is on — the schedule is when, ',
              'the switch is whether.',
            '</div>',

            /* Ships in the UNKNOWN state, like the toggle does, so nothing is
               claimed about whether a schedule exists before the server has
               answered. The loader replaces this with the summary or the empty
               state; a failed read leaves it showing. */
            '<div class="ap-sched-unknown" id="apSchedUnknown">Checking for a schedule…</div>',

            '<div class="ap-sched-summary" id="apSchedSummary" hidden>',
              '<div class="ap-sched-when" id="apSchedWhen"></div>',
              '<div class="ap-sched-instr">',
                '<span class="ap-sched-instr-label">Standing instruction</span>',
                '<span id="apSchedInstr"></span>',
              '</div>',
              '<div class="ap-sched-last" id="apSchedLast" hidden></div>',
            '</div>',

            '<div class="ap-sched-empty" id="apSchedEmpty" hidden>',
              'No schedule set. This ' + esc(AGENT_LABEL) + ' runs only when you launch it above.',
            '</div>',

            '<div class="ap-sched-actions" id="apSchedViewActions" hidden>',
              '<button type="button" class="ap-sched-btn ghost" id="apSchedEditBtn">Edit schedule</button>',
              '<button type="button" class="ap-sched-btn danger" id="apSchedDeleteBtn">Remove</button>',
            '</div>',

            /* The confirmation says what removal costs BEFORE it happens. There
               is no route to pause a schedule, so the only way to stop one is to
               delete it, and deleting it takes the instruction with it. Someone
               should not find that out by losing a prompt they wrote. */
            '<div class="ap-sched-confirm" id="apSchedConfirm" hidden>',
              'Remove this schedule? The standing instruction is not kept. There is no way to ',
              'pause a schedule, so removing it is the only way to stop it — and the text above ',
              'is deleted with it, so you would have to write it again.',
              '<div class="ap-sched-actions">',
                '<button type="button" class="ap-sched-btn danger" id="apSchedConfirmBtn">Remove schedule and instruction</button>',
                '<button type="button" class="ap-sched-btn ghost" id="apSchedCancelDeleteBtn">Keep it</button>',
              '</div>',
            '</div>',

            '<div class="ap-sched-form" id="apSchedForm" hidden>',
              '<div class="ap-sched-grid">',
                '<div class="ap-sched-field">',
                  '<label class="ap-sched-label" for="apSchedTask">Task to run</label>',
                  /* This page's own task list, from AGENT_PROFILE_CONFIG. It is
                     what makes a Sales schedule different from an SEO one
                     without this control being written eighteen times. */
                  '<select class="ap-select" id="apSchedTask">' + taskTypeOptions() + '</select>',
                '</div>',
                '<div class="ap-sched-field">',
                  '<label class="ap-sched-label" for="apSchedCadence">How often</label>',
                  '<select class="ap-select" id="apSchedCadence">',
                    '<option value="daily">Every day</option>',
                    '<option value="weekly">Every week</option>',
                    '<option value="monthly">Every month</option>',
                  '</select>',
                '</div>',
                '<div class="ap-sched-field" id="apSchedDowField" hidden>',
                  '<label class="ap-sched-label" for="apSchedDow">Day of week</label>',
                  '<select class="ap-select" id="apSchedDow">' + dayOfWeekOptions() + '</select>',
                '</div>',
                '<div class="ap-sched-field" id="apSchedDomField" hidden>',
                  '<label class="ap-sched-label" for="apSchedDom">Day of month</label>',
                  '<select class="ap-select" id="apSchedDom">' + dayOfMonthOptions() + '</select>',
                '</div>',
                '<div class="ap-sched-field">',
                  /* UTC IS SAID ON THE CONTROL, not left to be assumed. The
                     column is hour_utc and the server does no conversion, so a
                     label reading only "Hour" would be read as local time by
                     everyone not in UTC and the run would land hours off. */
                  '<label class="ap-sched-label" for="apSchedHour">Hour (UTC)</label>',
                  '<select class="ap-select" id="apSchedHour">' + hourOptions() + '</select>',
                '</div>',
              '</div>',
              '<div class="ap-sched-field" style="margin-top:10px">',
                '<label class="ap-sched-label" for="apSchedPrompt">Standing instruction</label>',
                '<textarea class="ap-textarea" id="apSchedPrompt"',
                  ' placeholder="What should the ' + esc(AGENT_LABEL) + ' do each time this runs?"></textarea>',
                '<div class="ap-sched-hint">',
                  'Required. This exact text is what the ' + esc(AGENT_LABEL) + ' is asked to do on ',
                  'every run, so write it as a standing instruction rather than a one-off note.',
                '</div>',
              '</div>',
              '<div class="ap-sched-actions">',
                '<button type="button" class="ap-sched-btn" id="apSchedSaveBtn">Save schedule</button>',
                '<button type="button" class="ap-sched-btn ghost" id="apSchedCancelBtn" hidden>Cancel</button>',
              '</div>',
            '</div>',

            '<div class="ap-sched-msg" id="apSchedMsg"></div>',
          '</div>',

          /* STILL THE SAME CARD, and NOTHING AT ALL when this agent has no tools.
             Twelve of the eighteen agents have none, and a "coming soon" panel on
             twelve pages is worse than an absence: it takes up the same room as a
             working control, invites a click that does nothing, and has to be
             maintained. An agent with no tools configured renders no markup here,
             no heading, and no divider. */
          TOOLS.length ? toolsMarkup() : "",
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
      '</div>',

      /* ── 5. Approval queue (social drafts only) ── */
      HAS_SOCIAL_DRAFTS ? (
        '<div class="ap-section">' +
          '<div class="ap-card">' +
            '<h2 class="ap-section-label">Approval Queue</h2>' +
            '<div id="apApprovalQueue"><div class="ap-queue-empty">No drafts in queue yet. Approve a Social Media Drafts result to add one.</div></div>' +
          '</div>' +
        '</div>'
      ) : ""
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

    var autoToggle = document.getElementById("apAutoToggle");
    if (autoToggle) {
      autoToggle.addEventListener("change", function () {
        saveAutonomy(autoToggle.checked === true);
      });
    }

    bindSchedule();
    bindTools();

    renderAutonomy();
    loadAutonomy();
    renderSchedule();
    loadSchedule();
    loadHistory();
    if (HAS_SOCIAL_DRAFTS) loadApprovalQueue();
    loadBusinessContext();
  }

  /* ══ AUTONOMY ═══════════════════════════════════════════════════════════
     GET and PUT /api/agent-autonomy, scoped to this page's AGENT_TYPE.

     THREE STATES, AND THE THIRD IS THE POINT. autonomyState is true, false, or
     null — and null is not a synonym for false. This switch decides whether an
     agent goes and does things on its own, so a read that failed must not be
     rendered as "off": that is a confident claim about whether something is
     running unattended, made from no information. The control stays disabled
     and visibly unknown until the server has actually answered. */
  var autonomyState  = null;
  var autonomySaving = false;

  /* Keeps the HTTP status AND whether the body actually parsed. Both matter, and
     a `.catch` that collapses a parse failure into `{}` loses both: the status
     is then missing from the failure message, and — far worse — an unparseable
     body becomes indistinguishable from a successful read that returned nothing.
     See the `parsed` checks in loadAutonomy and loadSchedule for why that
     distinction is the whole point on both of these controls.

     Shared by both rather than copied into each: they make the same request
     shape for the same reason, and a second copy is a second place for the
     parse-failure handling to drift. */
  function readJsonResult(r) {
    return r.json().then(
      function (d) { return { ok: r.ok, status: r.status, data: d,  parsed: true  }; },
      function ()  { return { ok: r.ok, status: r.status, data: {}, parsed: false }; }
    );
  }

  /* ALWAYS says what could not be loaded, with the server's reason added rather
     than substituted. The reason on its own ("unauthorized", "boom", a bare
     status) does not tell anyone WHICH thing failed, or that the control beside
     it is therefore not reporting anything — and on controls that say whether an
     agent acts unattended, "unauthorized" next to a switch is not an adequate
     account of why the switch cannot be trusted.

     `claim` is the sentence that names what is NOT being asserted, which differs
     per control: the toggle is not showing whether it is on, the schedule is not
     showing whether one exists. */
  function loadFailMsg(subject, claim, detail) {
    var base = subject + " could not be loaded — " + claim + ". Reload to try again.";
    return detail ? base + " (" + detail + ")" : base;
  }

  /* Flagged rather than recognised by its text downstream: the catches below have
     to tell an already-framed failure from a raw transport rejection, and doing
     that by matching on the message would break the moment the wording changed. */
  function loadFail(subject, claim, detail) {
    var e = new Error(loadFailMsg(subject, claim, detail));
    e.framed = true;
    return e;
  }

  var AUTO_SUBJECT = "Autonomous mode";
  var AUTO_CLAIM   = "this switch is not showing whether it is on";

  function setAutoMsg(text, cls) {
    var el = document.getElementById("apAutoMsg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ap-auto-msg" + (cls ? " " + cls : "");
  }

  function renderAutonomy() {
    var input = document.getElementById("apAutoToggle");
    var wrap  = document.getElementById("apAutoSwitch");
    if (!input || !wrap) return;

    if (autonomyState === null) {
      // Unknown. Never checked, never merely "off" — see the .unknown style.
      input.checked  = false;
      input.disabled = true;
      wrap.className = "ap-auto-switch unknown";
      return;
    }

    input.checked  = autonomyState === true;
    input.disabled = autonomySaving;
    wrap.className = "ap-auto-switch";
  }

  function loadAutonomy() {
    var token = tok();

    if (!token) {
      autonomyState = null;
      renderAutonomy();
      setAutoMsg("Sign in to change this setting.", "");
      return;
    }

    setAutoMsg("Checking…", "");

    fetch(API_URL + "/api/agent-autonomy", {
      headers: { "Authorization": "Bearer " + token }
    })
      .then(readJsonResult)
      .then(function (res) {
        if (!res.ok) {
          throw loadFail(AUTO_SUBJECT, AUTO_CLAIM, (res.data && res.data.error) || ("HTTP " + res.status));
        }

        /* AN UNREADABLE BODY IS NOT AN EMPTY LIST. This used to fall back to
           `[]` whenever the payload was missing or unparseable, which then took
           the no-row branch below and rendered a confident, interactive "Off" —
           the one thing this control must never do on a read that did not
           actually succeed. A 200 can carry something that is not the expected
           JSON (a proxy or gateway interstitial, a truncated body), and "I could
           not read the answer" is not the same statement as "the server says
           there is no row".

           The distinction is exactly `autonomy` being a real array: `[]` IS an
           answer and means off (see below), whereas an absent or non-array
           `autonomy`, or a body that never parsed, is no answer at all and has
           to stay unknown. */
        if (!res.parsed || !res.data || !Array.isArray(res.data.autonomy)) {
          throw loadFail(AUTO_SUBJECT, AUTO_CLAIM, "unexpected response");
        }

        var rows = res.data.autonomy;
        var row = null;

        for (var i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].agent_type === AGENT_TYPE) { row = rows[i]; break; }
        }

        /* NO ROW IS A REAL ANSWER, and the only place null is not. Migration
           064 is explicit that the absence of a row means disabled and that no
           job may default a missing row to enabled, so "not found" here is the
           server telling us it is off — unlike a failed request, which tells
           us nothing. */
        autonomyState = row ? row.enabled === true : false;
        renderAutonomy();
        setAutoMsg(autonomyState ? "On — this agent can start its own tasks." : "Off — this agent only runs when you launch it.", "");
      })
      .catch(function (error) {
        /* LEFT DISABLED AND UNKNOWN. Not defaulted to off, not left looking
           switchable. Someone who reads a greyed-out switch in the off
           position concludes the agent is idle; if the read failed because the
           network blinked and the agent is in fact enabled, that conclusion is
           wrong in the direction that matters. */
        autonomyState = null;
        renderAutonomy();
        /* The thrown messages above are already framed by loadFailMsg; a
           transport rejection (no response at all) arrives here unframed, so it
           gets the same framing rather than surfacing a bare "Failed to fetch". */
        setAutoMsg(
          error && error.framed
            ? error.message
            : loadFailMsg(AUTO_SUBJECT, AUTO_CLAIM, error && error.message),
          "err"
        );
      });
  }

  function saveAutonomy(next) {
    var token = tok();
    if (!token) return;

    var previous = autonomyState;

    autonomySaving = true;
    autonomyState  = next;
    renderAutonomy();
    setAutoMsg("Saving…", "");

    fetch(API_URL + "/api/agent-autonomy", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      // A real boolean, never a string. The backend rejects "true" with a 400
      // precisely because a string would be truthy, and it is right to.
      body: JSON.stringify({ agent_type: AGENT_TYPE, enabled: next === true })
    })
      .then(readJsonResult)
      .then(function (res) {
        if (!res.ok) {
          /* res.status is real here because readJsonResult carries it through. It
             did not when this object was built inline as { ok, data }, so an
             error body without an `error` field produced the message "could not
             be saved (HTTP undefined)". */
          throw new Error((res.data && res.data.error) || ("The setting could not be saved (HTTP " + res.status + ")."));
        }

        autonomySaving = false;
        renderAutonomy();
        setAutoMsg(next ? "On — this agent can start its own tasks." : "Off — this agent only runs when you launch it.", "ok");
      })
      .catch(function (error) {
        /* PUT BACK WHERE IT WAS. A switch that moves on screen and does not
           persist is worse than one that refuses to move: the next person to
           look at it reads the wrong answer off the control itself, and there
           is nothing on the page to contradict it. Reverting to `previous`
           rather than to !next keeps the unknown state unknown if that is
           where it started. */
        autonomySaving = false;
        autonomyState  = previous;
        renderAutonomy();
        setAutoMsg((error && error.message) || "That change could not be saved.", "err");
      });
  }

  /* ══ SCHEDULE ═══════════════════════════════════════════════════════════
     GET, PUT and DELETE /api/agent-schedules, scoped to this page's AGENT_TYPE.

     THE SAME THREE STATES AS THE TOGGLE, for the same reason. scheduleState is
     null, SCHED_NONE, or a row object:

       null        the read failed. NOT a synonym for "no schedule".
       SCHED_NONE  the read succeeded and this agent has no schedule.
       object      the read succeeded and this is the schedule.

     Collapsing the first two is the failure that matters here, and it is worse
     than it looks: someone with a schedule who is told they have none will write
     another, the PUT upserts on (user_id, agent_type), and the row they could not
     read is overwritten by the one they just created. What they believe and what
     exists diverge with no error anywhere — and the instruction they had written
     is gone. So a failed read leaves the controls disabled and visibly unknown,
     and says so. */
  var SCHED_NONE = "none";

  var SCHED_SUBJECT = "The schedule";
  var SCHED_CLAIM   = "this is not showing whether one exists";

  var scheduleState    = null;
  var scheduleEditing  = false;
  var scheduleSaving   = false;
  var scheduleDeleting = false;
  var scheduleConfirmingDelete = false;

  function setSchedMsg(text, cls) {
    var el = document.getElementById("apSchedMsg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ap-sched-msg" + (cls ? " " + cls : "");
  }

  function schedEl(id) { return document.getElementById(id); }

  function show(el, visible) { if (el) el.hidden = !visible; }

  /* Only the cadence's own day field is shown. Both are in the markup so the
     values survive a cadence change while the form is open, but only one is ever
     visible and — see scheduleFormPayload — only one is ever sent. */
  function syncSchedDayFields() {
    var cadenceEl = schedEl("apSchedCadence");
    var cadence = cadenceEl ? cadenceEl.value : "daily";
    show(schedEl("apSchedDowField"), cadence === "weekly");
    show(schedEl("apSchedDomField"), cadence === "monthly");
  }

  function setSchedFormDisabled(disabled) {
    ["apSchedTask", "apSchedCadence", "apSchedDow", "apSchedDom", "apSchedHour",
     "apSchedPrompt", "apSchedSaveBtn"].forEach(function (id) {
      var el = schedEl(id);
      if (el) el.disabled = disabled;
    });
  }

  /* Writes the form from a row, or from defaults when there is no row. Called
     only when the form is OPENED — never from renderSchedule — so that a failed
     save cannot wipe what the person had just typed while telling them it did
     not save. */
  function fillScheduleForm(row) {
    var taskEl    = schedEl("apSchedTask");
    var cadenceEl = schedEl("apSchedCadence");
    var dowEl     = schedEl("apSchedDow");
    var domEl     = schedEl("apSchedDom");
    var hourEl    = schedEl("apSchedHour");
    var promptEl  = schedEl("apSchedPrompt");
    if (!taskEl || !cadenceEl || !hourEl || !promptEl) return;

    if (row) {
      /* A stored task this page no longer offers would otherwise leave the
         select on its first option — showing a different task from the one that
         is actually scheduled. Added as an option so the form states the truth. */
      if (row.task_type && !Array.prototype.some.call(taskEl.options, function (o) {
        return o.value === row.task_type;
      })) {
        var opt = document.createElement("option");
        opt.value = row.task_type;
        opt.textContent = row.task_type + " (not offered on this page)";
        taskEl.appendChild(opt);
      }
      taskEl.value    = row.task_type || (TASK_TYPES[0] && TASK_TYPES[0].value) || "general";
      cadenceEl.value = row.cadence || "daily";
      hourEl.value    = String(row.hour_utc == null ? 7 : row.hour_utc);
      promptEl.value  = row.prompt || "";
      if (dowEl) dowEl.value = String(row.day_of_week == null ? 1 : row.day_of_week);
      if (domEl) domEl.value = String(row.day_of_month == null ? 1 : row.day_of_month);
    } else {
      taskEl.value    = (TASK_TYPES[0] && TASK_TYPES[0].value) || "general";
      cadenceEl.value = "daily";
      /* 7 matches the column default, so the form agrees with what the server
         would have chosen rather than quietly proposing a different hour. */
      hourEl.value    = "7";
      promptEl.value  = "";
      if (dowEl) dowEl.value = "1";
      if (domEl) domEl.value = "1";
    }
    syncSchedDayFields();
  }

  function renderSchedule() {
    var unknownEl = schedEl("apSchedUnknown");
    var summaryEl = schedEl("apSchedSummary");
    var emptyEl   = schedEl("apSchedEmpty");
    var formEl    = schedEl("apSchedForm");
    var viewEl    = schedEl("apSchedViewActions");
    var confirmEl = schedEl("apSchedConfirm");
    var cancelEl  = schedEl("apSchedCancelBtn");
    if (!unknownEl || !summaryEl || !emptyEl || !formEl) return;

    /* UNKNOWN. Nothing is asserted and nothing is editable: a disabled form
       beside a blank summary would read as "no schedule yet", which is exactly
       the claim a failed read cannot make. */
    if (scheduleState === null) {
      show(unknownEl, true);
      show(summaryEl, false);
      show(emptyEl, false);
      show(formEl, false);
      show(viewEl, false);
      show(confirmEl, false);
      setSchedFormDisabled(true);
      return;
    }

    show(unknownEl, false);
    setSchedFormDisabled(scheduleSaving || scheduleDeleting);

    var hasSchedule = scheduleState !== SCHED_NONE;

    if (hasSchedule) {
      schedEl("apSchedWhen").textContent  = scheduleSentence(scheduleState);
      schedEl("apSchedInstr").textContent = scheduleState.prompt || "";
      var lastEl = schedEl("apSchedLast");
      if (lastEl) {
        if (scheduleState.last_run_on) {
          /* A fact about what happened, not a status. "Last ran on 9th September
             2026" is a record; "Active" or "Healthy" would be a claim about the
             present that this row cannot support. */
          lastEl.textContent = "Last ran on " + fmtDateOnly(scheduleState.last_run_on) + ".";
          show(lastEl, true);
        } else {
          lastEl.textContent = "";
          show(lastEl, false);
        }
      }
    }

    show(summaryEl, hasSchedule && !scheduleEditing);
    /* Shown whenever there is no schedule, INCLUDING while the create form is
       open — the form is open in that state by default, and gating this line on
       the form being closed hid the only thing distinguishing "none" from
       "unknown". A create form on its own does not say whether a schedule
       already exists; this line does. */
    show(emptyEl,   !hasSchedule);
    show(viewEl,    hasSchedule && !scheduleEditing && !scheduleConfirmingDelete);
    show(confirmEl, hasSchedule && scheduleConfirmingDelete && !scheduleEditing);
    show(formEl,    scheduleEditing);
    // Cancel only means something when there is a saved schedule to go back to.
    show(cancelEl,  scheduleEditing && hasSchedule);

    var confirmBtn = schedEl("apSchedConfirmBtn");
    if (confirmBtn) confirmBtn.disabled = scheduleDeleting;
  }

  function loadSchedule() {
    var token = tok();

    if (!token) {
      scheduleState = null;
      renderSchedule();
      setSchedMsg("Sign in to set a schedule.", "");
      return;
    }

    setSchedMsg("Checking…", "");

    fetch(API_URL + "/api/agent-schedules", {
      headers: { "Authorization": "Bearer " + token }
    })
      .then(readJsonResult)
      .then(function (res) {
        if (!res.ok) {
          throw loadFail(SCHED_SUBJECT, SCHED_CLAIM,
            (res.data && res.data.error) || ("HTTP " + res.status));
        }

        /* An unreadable body is not an empty list, exactly as on the autonomy
           read. `schedules` being a real array is the test: [] is the server
           saying this account has none, while a missing or non-array `schedules`,
           or a body that never parsed, is no answer at all and stays unknown. */
        if (!res.parsed || !res.data || !Array.isArray(res.data.schedules)) {
          throw loadFail(SCHED_SUBJECT, SCHED_CLAIM, "unexpected response");
        }

        var rows = res.data.schedules;
        var row = null;
        var i;
        for (i = 0; i < rows.length; i++) {
          if (rows[i] && rows[i].agent_type === AGENT_TYPE) { row = rows[i]; break; }
        }

        scheduleState   = row || SCHED_NONE;
        scheduleEditing = !row;   // nothing saved yet: the form IS the view
        scheduleConfirmingDelete = false;
        fillScheduleForm(row);
        renderSchedule();
        setSchedMsg(row ? "" : "", "");
      })
      .catch(function (error) {
        /* LEFT UNKNOWN AND DISABLED. Never "no schedule set": that sentence,
           shown to someone who has one, is what causes them to write a second
           instruction over the first. */
        scheduleState   = null;
        scheduleEditing = false;
        scheduleConfirmingDelete = false;
        renderSchedule();
        setSchedMsg(
          error && error.framed
            ? error.message
            : loadFailMsg(SCHED_SUBJECT, SCHED_CLAIM, error && error.message),
          "err"
        );
      });
  }

  /* The body of a PUT. Two things about it are load bearing.

     hour_utc IS ALWAYS PRESENT. The API replaces a schedule rather than patching
     one, so an absent hour_utc is not "leave the hour alone" — it is the column
     default, 07:00 UTC. A payload that omitted it would silently move somebody's
     03:00 run to the morning, and the control would then display the hour it had
     moved them to as though they had chosen it.

     ONLY THE CADENCE'S OWN DAY IS SENT. The other is left out entirely rather
     than sent as null: the server writes null into the unused column itself, and
     sending a day the cadence does not use would be stating a fact about a
     schedule that has no such day. */
  function scheduleFormPayload() {
    var cadence = schedEl("apSchedCadence").value;
    var payload = {
      agent_type: AGENT_TYPE,
      task_type:  schedEl("apSchedTask").value,
      prompt:     String(schedEl("apSchedPrompt").value || "").trim(),
      cadence:    cadence,
      hour_utc:   parseInt(schedEl("apSchedHour").value, 10)
    };
    if (cadence === "weekly")  payload.day_of_week  = parseInt(schedEl("apSchedDow").value, 10);
    if (cadence === "monthly") payload.day_of_month = parseInt(schedEl("apSchedDom").value, 10);
    return payload;
  }

  function saveSchedule() {
    var token = tok();
    if (!token) return;
    // Unknown means we do not know what we would be overwriting. Not editable.
    if (scheduleState === null) return;

    var payload = scheduleFormPayload();

    /* Checked here as well as on the server, because the server's 400 is correct
       but arrives after a round trip and reads as a failure; this reads as the
       field being required, which is what it is. */
    if (!payload.prompt) {
      setSchedMsg("Write the standing instruction first — it is what the agent will be asked to do on every run.", "err");
      return;
    }
    if (!(payload.hour_utc >= 0 && payload.hour_utc <= 23)) {
      setSchedMsg("Pick the hour this should run.", "err");
      return;
    }

    var previousState   = scheduleState;
    var previousEditing = scheduleEditing;

    scheduleSaving = true;
    renderSchedule();
    setSchedMsg("Saving…", "");

    fetch(API_URL + "/api/agent-schedules", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(readJsonResult)
      .then(function (res) {
        if (!res.ok) {
          throw new Error((res.data && res.data.error) ||
            ("The schedule could not be saved (HTTP " + res.status + ")."));
        }

        scheduleSaving = false;
        /* The server's row, not the payload, so what is displayed is what was
           stored — including the columns this form never sends. Falling back to
           the payload only if the response carried no row. */
        scheduleState   = (res.data && res.data.schedule) ? res.data.schedule : payload;
        scheduleEditing = false;
        scheduleConfirmingDelete = false;
        renderSchedule();
        setSchedMsg("Schedule saved.", "ok");
      })
      .catch(function (error) {
        /* THE PREVIOUS STATE STANDS. What is on screen must keep describing what
           the server actually holds, so a failed save leaves the old schedule —
           or the old absence of one — in place rather than adopting the edit.

           The form stays open with the typed values untouched, which is why
           fillScheduleForm is not called from here or from renderSchedule: the
           work is not lost, it is simply not claimed to have been saved. */
        scheduleSaving  = false;
        scheduleState   = previousState;
        scheduleEditing = previousEditing;
        renderSchedule();
        setSchedMsg((error && error.message) || "The schedule could not be saved.", "err");
      });
  }

  function deleteSchedule() {
    var token = tok();
    if (!token) return;
    if (scheduleState === null || scheduleState === SCHED_NONE) return;

    var previousState = scheduleState;

    scheduleDeleting = true;
    renderSchedule();
    setSchedMsg("Removing…", "");

    fetch(API_URL + "/api/agent-schedules/" + encodeURIComponent(AGENT_TYPE), {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + token }
    })
      .then(readJsonResult)
      .then(function (res) {
        if (!res.ok) {
          throw new Error((res.data && res.data.error) ||
            ("The schedule could not be removed (HTTP " + res.status + ")."));
        }

        scheduleDeleting = false;
        scheduleConfirmingDelete = false;
        scheduleState   = SCHED_NONE;
        scheduleEditing = true;       // back to the blank form, which is the view
        fillScheduleForm(null);
        renderSchedule();
        setSchedMsg("Schedule removed. The instruction was deleted with it.", "ok");
      })
      .catch(function (error) {
        /* The schedule is still there. Reverting rather than showing it gone
           matters more on a delete than anywhere else: a control that claims a
           removal that did not happen leaves an agent running on a schedule its
           owner believes they have cancelled. */
        scheduleDeleting = false;
        scheduleState    = previousState;
        scheduleConfirmingDelete = false;
        renderSchedule();
        setSchedMsg((error && error.message) || "The schedule could not be removed.", "err");
      });
  }

  function bindSchedule() {
    var cadenceEl = schedEl("apSchedCadence");
    if (cadenceEl) cadenceEl.addEventListener("change", syncSchedDayFields);

    var saveBtn = schedEl("apSchedSaveBtn");
    if (saveBtn) saveBtn.addEventListener("click", saveSchedule);

    var editBtn = schedEl("apSchedEditBtn");
    if (editBtn) editBtn.addEventListener("click", function () {
      if (scheduleState === null || scheduleState === SCHED_NONE) return;
      scheduleEditing = true;
      scheduleConfirmingDelete = false;
      fillScheduleForm(scheduleState);
      renderSchedule();
      setSchedMsg("", "");
    });

    var cancelBtn = schedEl("apSchedCancelBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", function () {
      if (scheduleState === null || scheduleState === SCHED_NONE) return;
      scheduleEditing = false;
      fillScheduleForm(scheduleState);   // discard the edit, show what is stored
      renderSchedule();
      setSchedMsg("", "");
    });

    /* Asks first, and the asking is where the cost is stated. */
    var deleteBtn = schedEl("apSchedDeleteBtn");
    if (deleteBtn) deleteBtn.addEventListener("click", function () {
      if (scheduleState === null || scheduleState === SCHED_NONE) return;
      scheduleConfirmingDelete = true;
      renderSchedule();
      setSchedMsg("", "");
    });

    var confirmBtn = schedEl("apSchedConfirmBtn");
    if (confirmBtn) confirmBtn.addEventListener("click", deleteSchedule);

    var keepBtn = schedEl("apSchedCancelDeleteBtn");
    if (keepBtn) keepBtn.addEventListener("click", function () {
      scheduleConfirmingDelete = false;
      renderSchedule();
      setSchedMsg("", "");
    });
  }

  /* ══ AGENT TOOLS ════════════════════════════════════════════════════════
     The agent's own tools — POST /api/agents/<agentType>/<tool id> — rendered
     from the `tools` array in AGENT_PROFILE_CONFIG.

     ONE MECHANISM, NOT FOURTEEN. Each tool declares its fields and this builds
     the form, sends the body and renders the response. Nothing here knows what
     an Etsy tag limit is or what a press release contains; that lives in the
     config and in the server's answer. A tool added to the backend needs a
     config entry on one page, not a change in this file.

     THE RESULT IS THE POINT. Every one of these routes returns three kinds of
     statement and they are rendered in three visibly different voices:

       generated   what the model wrote — a draft, in prose
       measured    arithmetic the server did — counts, fits, overruns
       provenance  the split between the two, and what was never read

     A character count and a claim about what buyers want are not the same kind
     of thing, and a page that renders them identically lends the count's
     authority to the claim. That is the entire reason the backend returns them
     as separate objects, and it would be undone here by a single results box. */

  // Keys handled by their own renderer rather than as generated content.
  var TOOL_GATE_KEYS = ["ready_to_post", "ready_to_send"];
  var TOOL_SKIP_KEYS = ["success"];
  /* Reference material: platform limits, policy rules, standing statements. Real
     and worth showing, but it is neither the draft nor a measurement of it, so it
     gets its own quiet zone instead of competing with either. */
  var TOOL_REF_KEYS = ["constraints", "limits", "thresholds", "guides", "platform_limits",
    "platform_terms", "limitations", "rules", "statement", "clean_scan_is_not_approval",
    "suggested_tag_set_note", "rules_checked"];

  function toolDomId(toolId, suffix) {
    return "apTool_" + String(toolId).replace(/[^A-Za-z0-9]/g, "_") + (suffix ? "_" + suffix : "");
  }

  // snake_case / kebab-case to a readable label.
  function humanise(key) {
    return String(key || "")
      .replace(/[_-]+/g, " ")
      .replace(/^\s*\w/, function (c) { return c.toUpperCase(); });
  }

  function toolFieldMarkup(toolId, field) {
    var id = toolDomId(toolId, "f_" + field.name);
    /* A multiselect and a rows group have no single control to point at, so they
       get a plain label rather than one whose `for` names an element that does not
       exist — which renders as a label that does nothing when clicked. */
    var isGroup = field.type === "multiselect" || field.type === "rows";
    var label = '<label class="ap-tool-label"' + (isGroup ? "" : ' for="' + id + '"') + '>' +
      esc(field.label || humanise(field.name)) +
      (field.required ? '<span class="ap-tool-req">*</span>' : "") + '</label>';
    var hint = field.hint ? '<div class="ap-tool-hint">' + esc(field.hint) + '</div>' : "";
    var control;

    if (field.type === "textarea") {
      control = '<textarea class="ap-textarea" id="' + id + '"' +
        (field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : "") + '></textarea>';
    } else if (field.type === "select") {
      control = '<select class="ap-select" id="' + id + '">' +
        (field.required ? "" : '<option value="">(not set)</option>') +
        (field.options || []).map(function (o) {
          return '<option value="' + esc(o.value) + '">' + esc(o.label || o.value) + '</option>';
        }).join("") + '</select>';
    } else if (field.type === "multiselect") {
      // The wrapper carries the field id so the group is addressable as one thing;
      // each box carries id_<n>, which is what toolPayload reads back.
      control = '<div class="ap-tool-checks" id="' + id + '">' + (field.options || []).map(function (o, i) {
        var oid = id + "_" + i;
        return '<label class="ap-tool-check"><input type="checkbox" id="' + oid + '" value="' +
          esc(o.value) + '"> ' + esc(o.label || o.value) + '</label>';
      }).join("") + '</div>';
    } else if (field.type === "checkbox") {
      control = '<label class="ap-tool-check"><input type="checkbox" id="' + id + '"' +
        (field.checkedByDefault ? " checked" : "") + '> ' + esc(field.checkboxLabel || "Yes") + '</label>';
    } else if (field.type === "number") {
      control = '<input class="ap-select" type="number" id="' + id + '"' +
        (field.min !== undefined ? ' min="' + field.min + '"' : "") +
        (field.max !== undefined ? ' max="' + field.max + '"' : "") +
        (field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : "") + '>';
    } else if (field.type === "rows") {
      /* A repeatable group — the comparables list on the Etsy pricing tool is the
         only one so far. Rendered as three blank rows with an add button; empty
         rows are dropped when the body is built, so an unused row costs nothing. */
      var cols = field.columns || [];
      var template = function (rowIndex) {
        return '<div class="ap-tool-row" style="grid-template-columns:repeat(' + cols.length +
          ',minmax(0,1fr))">' + cols.map(function (c) {
            return '<input class="ap-select" data-col="' + esc(c.name) + '"' +
              (c.type === "number" ? ' type="number" step="any"' : ' type="text"') +
              ' placeholder="' + esc(c.label || c.name) + '">';
          }).join("") + '</div>';
      };
      control = '<div class="ap-tool-rows" id="' + id + '">' +
        template(0) + template(1) + template(2) + '</div>' +
        '<button type="button" class="ap-tool-addrow" data-addrow="' + id + '">+ Add row</button>';
    } else {
      control = '<input class="ap-select" type="text" id="' + id + '"' +
        (field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : "") + '>';
    }

    return '<div class="ap-tool-field">' + label + control + hint + '</div>';
  }

  function toolsMarkup() {
    return [
      '<div class="ap-tools">',
        '<div class="ap-tools-title">' + esc(AGENT_LABEL) + ' tools</div>',
        '<div class="ap-tools-desc">',
          'The things only this agent does. Each one returns a draft plus the counts the server ',
          'measured against the real limits, kept separate so you can see which is which.',
        '</div>',
        TOOLS.map(function (tool) {
          return [
            '<div class="ap-tool">',
              '<button type="button" class="ap-tool-head" data-tool-toggle="' + esc(tool.id) + '">',
                '<span>', esc(tool.label || tool.id),
                  tool.description ? '<span class="ap-tool-sub">' + esc(tool.description) + '</span>' : "",
                '</span>',
                '<span class="ap-tool-caret" id="' + toolDomId(tool.id, "caret") + '">Show</span>',
              '</button>',
              '<div class="ap-tool-body" id="' + toolDomId(tool.id, "body") + '" hidden>',
                (tool.fields || []).map(function (f) { return toolFieldMarkup(tool.id, f); }).join(""),
                '<button type="button" class="ap-tool-run" data-tool-run="' + esc(tool.id) + '">',
                  esc(tool.runLabel || "Run"),
                '</button>',
                '<div class="ap-tool-msg" id="' + toolDomId(tool.id, "msg") + '"></div>',
                '<div class="ap-tool-result" id="' + toolDomId(tool.id, "result") + '"></div>',
              '</div>',
            '</div>'
          ].join("");
        }).join(""),
      '</div>'
    ].join("");
  }

  /* Builds the request body from a tool's declared fields. Empty optional fields
     are OMITTED rather than sent blank: the routes treat an absent field as "not
     supplied" and several of them have defaults that a blank string would not
     trigger. */
  function toolPayload(tool) {
    var body = {};
    var missing = [];

    (tool.fields || []).forEach(function (field) {
      var id = toolDomId(tool.id, "f_" + field.name);
      var el = document.getElementById(id);

      if (field.type === "multiselect") {
        var picked = (field.options || []).map(function (o, i) {
          return document.getElementById(id + "_" + i);
        }).filter(function (box) { return box && box.checked; })
          .map(function (box) { return box.value; });
        if (picked.length) body[field.name] = picked;
        else if (field.required) missing.push(field.label || field.name);
        return;
      }

      if (field.type === "rows") {
        var wrap = document.getElementById(id);
        var rows = [];
        if (wrap) {
          Array.prototype.forEach.call(wrap.querySelectorAll(".ap-tool-row"), function (rowEl) {
            var row = {};
            var any = false;
            Array.prototype.forEach.call(rowEl.querySelectorAll("[data-col]"), function (input) {
              var raw = String(input.value || "").trim();
              if (raw === "") return;
              any = true;
              var col = (field.columns || []).filter(function (c) {
                return c.name === input.getAttribute("data-col");
              })[0];
              row[input.getAttribute("data-col")] = (col && col.type === "number") ? Number(raw) : raw;
            });
            if (any) rows.push(row);
          });
        }
        if (rows.length) body[field.name] = rows;
        else if (field.required) missing.push(field.label || field.name);
        return;
      }

      if (!el) return;

      if (field.type === "checkbox") {
        // Always sent: these map to booleans the server reads explicitly, and an
        // absent one would take the server default rather than the user's choice.
        body[field.name] = el.checked === true;
        return;
      }

      var value = String(el.value || "").trim();
      if (value === "") {
        if (field.required) missing.push(field.label || field.name);
        return;
      }

      if (field.type === "number") {
        var n = Number(value);
        if (!isFinite(n)) { missing.push(field.label || field.name); return; }
        body[field.name] = n;
        return;
      }

      body[field.name] = value;
    });

    return { body: body, missing: missing };
  }

  /* ── result rendering ── */

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  // A compact, depth-limited rendering of whatever a value happens to be.
  function renderScalarish(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
      if (!value.length) return "None";
      if (value.every(function (v) { return !isPlainObject(v) && !Array.isArray(v); })) {
        return esc(value.join(", "));
      }
      return '<ul class="ap-m-list">' + value.map(function (v) {
        return "<li>" + (isPlainObject(v) ? renderObjectInline(v) : esc(String(v))) + "</li>";
      }).join("") + "</ul>";
    }
    if (isPlainObject(value)) return renderObjectInline(value);
    return esc(String(value));
  }

  function renderObjectInline(obj) {
    return Object.keys(obj).map(function (k) {
      var v = obj[k];
      if (isPlainObject(v) || Array.isArray(v)) {
        return "<strong>" + esc(humanise(k)) + ":</strong> " + renderScalarish(v);
      }
      return "<strong>" + esc(humanise(k)) + ":</strong> " + esc(String(v === "" ? "—" : v));
    }).join(" &middot; ");
  }

  /* MEASURED. Figures, in a monospace face on their own panel. Booleans that
     report a limit being broken are coloured, because "within limit: No" is the
     line someone needs to catch and it should not read like every other cell. */
  function renderMeasured(measured) {
    if (!isPlainObject(measured)) return "";

    var note = measured.note;
    var cells = [];

    Object.keys(measured).forEach(function (key) {
      if (key === "note") return;
      var value = measured[key];

      if (isPlainObject(value) || (Array.isArray(value) && value.length &&
          value.some(function (v) { return isPlainObject(v); }))) {
        cells.push('<div class="ap-m-cell" style="grid-column:1/-1">' +
          '<div class="ap-m-key">' + esc(humanise(key)) + '</div>' +
          '<div class="ap-m-note">' + renderScalarish(value) + '</div></div>');
        return;
      }

      /* A false on a key that asks "does this fit / is it within / is it ready"
         is a problem; a false on "disputes the reviewer" or "over limit" is the
         good outcome. Read from the key's own wording rather than from a list of
         special cases, so a new measured field is coloured sensibly without this
         function being edited. */
      var cls = "";
      if (typeof value === "boolean") {
        var positiveWhenTrue = /^(within|fits|is_complete|ready|matched_nothing|headline_within)/.test(key);
        var negativeWhenTrue = /^(disputes|offers|over|exceeds)/.test(key);
        if (positiveWhenTrue) cls = value ? " good" : " bad";
        else if (negativeWhenTrue) cls = value ? " bad" : " good";
      } else if (typeof value === "number" && /(_over|over_|missing|failed|unreadable|triggered)/.test(key)) {
        cls = value > 0 ? " bad" : "";
      }

      cells.push('<div class="ap-m-cell">' +
        '<div class="ap-m-key">' + esc(humanise(key)) + '</div>' +
        '<div class="ap-m-val' + cls + '">' + renderScalarish(value) + '</div></div>');
    });

    return '<div class="ap-measured">' +
      '<div class="ap-zone-label">Measured by the server</div>' +
      '<div class="ap-m-grid">' + cells.join("") + '</div>' +
      (note ? '<div class="ap-m-note">' + esc(String(note)) + '</div>' : "") +
      '</div>';
  }

  /* PROVENANCE. The two columns are the whole point: what was counted on the
     left, what the model supplied on the right, so the difference is visible at a
     glance rather than asserted in a sentence. */
  function renderProvenance(prov) {
    if (!isPlainObject(prov)) return "";

    var counted = Array.isArray(prov.measured_from) ? prov.measured_from : [];
    var inferred = Array.isArray(prov.inferred_by_model) ? prov.inferred_by_model : [];

    // The false flags are the "nothing was read" assertions — shown as chips so
    // the absences are countable rather than buried in the caveat sentence.
    var flags = Object.keys(prov).filter(function (k) {
      return typeof prov[k] === "boolean" && prov[k] === false;
    });

    return '<div class="ap-prov">' +
      '<div class="ap-zone-label">Where this came from</div>' +
      '<div class="ap-prov-split">' +
        '<div class="ap-prov-col counted"><h5>Counted by the server</h5>' +
          (counted.length
            ? '<ul>' + counted.map(function (x) { return "<li>" + esc(String(x)) + "</li>"; }).join("") + '</ul>'
            : '<ul><li>Nothing</li></ul>') +
        '</div>' +
        '<div class="ap-prov-col inferred"><h5>Written by the model</h5>' +
          (inferred.length
            ? '<ul>' + inferred.map(function (x) { return "<li>" + esc(String(x)) + "</li>"; }).join("") + '</ul>'
            : '<ul><li>Nothing</li></ul>') +
        '</div>' +
      '</div>' +
      (flags.length
        ? '<div class="ap-prov-flags">' + flags.map(function (f) {
            return '<span class="ap-prov-flag">' + esc(humanise(f).replace(/^./, function (c) {
              return c.toUpperCase();
            })) + ': no</span>';
          }).join("") + '</div>'
        : "") +
      (prov.caveat ? '<div class="ap-prov-caveat">' + esc(String(prov.caveat)) + '</div>' : "") +
      '</div>';
  }

  /* THE GATE. Rendered first and loudest when the server says this draft is not
     ready. The reason is spelled out from the measured block's own findings
     rather than left as a bare flag, because "not ready" without the phrases is
     not actionable. */
  function renderGate(data) {
    var blocked = null;
    if (data.ready_to_post === false) blocked = "post";
    else if (data.ready_to_send === false) blocked = "send";
    if (!blocked) return "";

    var measured = isPlainObject(data.measured) ? data.measured : {};
    var reasons = [];

    (measured.disputing_phrases_found || []).forEach(function (p) {
      reasons.push('"' + p.matched_text + '" — ' + p.problem);
    });
    (data.messages || []).forEach(function (m) {
      (m.incentive_phrases_found || []).forEach(function (p) {
        reasons.push('"' + p.matched_text + '" — ' + p.problem);
      });
    });
    if (measured.words_over_limit > 0) {
      reasons.push(measured.words_over_limit + " words over the " + measured.word_limit + "-word limit");
    }

    return '<div class="ap-gate">' +
      '<div class="ap-gate-title">⚠ Do not ' + blocked + ' this as written</div>' +
      esc(String(measured.note || "The server marked this draft not ready.")) +
      (reasons.length
        ? '<ul>' + reasons.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + '</ul>'
        : "") +
      '</div>';
  }

  // GENERATED. Everything the model wrote, in ordinary prose on the card ground.
  function renderGenerated(data) {
    var parts = [];

    Object.keys(data).forEach(function (key) {
      if (TOOL_SKIP_KEYS.indexOf(key) !== -1) return;
      if (TOOL_GATE_KEYS.indexOf(key) !== -1) return;
      if (TOOL_REF_KEYS.indexOf(key) !== -1) return;
      if (key === "measured" || key === "provenance") return;

      var value = data[key];
      if (value === null || value === undefined || value === "") return;

      parts.push('<div class="ap-gen-item">' +
        '<div class="ap-gen-key">' + esc(humanise(key)) + '</div>' +
        (typeof value === "string"
          ? "<pre>" + esc(value) + "</pre>"
          : renderScalarish(value)) +
        '</div>');
    });

    if (!parts.length) return "";
    return '<div class="ap-generated">' +
      '<div class="ap-zone-label">Written by the model</div>' + parts.join("") + '</div>';
  }

  function renderReference(data) {
    var parts = [];
    TOOL_REF_KEYS.forEach(function (key) {
      if (!(key in data)) return;
      var value = data[key];
      if (value === null || value === undefined || value === "") return;
      parts.push("<div><strong>" + esc(humanise(key)) + ":</strong> " +
        (typeof value === "string" ? esc(value) : renderScalarish(value)) + "</div>");
    });
    if (!parts.length) return "";
    return '<div class="ap-ref">' +
      '<div class="ap-zone-label">Limits, rules and standing statements</div>' + parts.join("") + '</div>';
  }

  function renderToolResult(tool, data) {
    return [
      renderGate(data),
      renderGenerated(data),
      renderMeasured(data.measured),
      renderProvenance(data.provenance),
      renderReference(data)
    ].filter(Boolean).join("");
  }

  /* A 502 FROM THESE ROUTES IS A PARSE FAILURE, and it carries raw_output. Shown
     as exactly that, with the raw text, rather than as an empty result — "no
     keywords found" would be a claim about the request when what failed was the
     model's formatting, and the raw text is the only thing that makes the failure
     diagnosable. */
  function renderParseFailure(data) {
    return '<div class="ap-parsefail">' +
      '<div class="ap-zone-label" style="color:#fbbf24">Could not read the model\'s answer</div>' +
      esc(String((data && data.error) || "The model's output could not be parsed.")) +
      (data && data.raw_output
        ? "<pre>" + esc(String(data.raw_output)) + "</pre>"
        : "") +
      '</div>';
  }

  function setToolMsg(toolId, text, cls) {
    var el = document.getElementById(toolDomId(toolId, "msg"));
    if (!el) return;
    el.textContent = text || "";
    el.className = "ap-tool-msg" + (cls ? " " + cls : "");
  }

  function runTool(tool) {
    var token = tok();
    var resultEl = document.getElementById(toolDomId(tool.id, "result"));
    var runBtn = document.querySelector('[data-tool-run="' + tool.id + '"]');

    if (!token) {
      setToolMsg(tool.id, "Sign in to run this.", "err");
      return;
    }

    var built = toolPayload(tool);
    if (built.missing.length) {
      setToolMsg(tool.id, "Fill in: " + built.missing.join(", "), "err");
      return;
    }

    if (runBtn) runBtn.disabled = true;
    if (resultEl) resultEl.innerHTML = "";
    setToolMsg(tool.id, "Running…", "");

    fetch(API_URL + "/api/agents/" + AGENT_TYPE + "/" + tool.id, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(built.body)
    })
      .then(readJsonResult)
      .then(function (res) {
        if (runBtn) runBtn.disabled = false;

        if (res.status === 502) {
          // Not an error message and not an empty result — the parse failure and
          // its raw text, which is what a 502 from these routes actually means.
          if (resultEl) resultEl.innerHTML = renderParseFailure(res.data);
          setToolMsg(tool.id, "The model's answer could not be read. Nothing is being reported as a result.", "err");
          return;
        }

        if (!res.ok) {
          var detail = (res.data && res.data.error) || ("HTTP " + res.status);
          if (res.data && Array.isArray(res.data.valid_platforms)) {
            detail += " (accepted: " + res.data.valid_platforms.join(", ") + ")";
          }
          setToolMsg(tool.id, detail, "err");
          return;
        }

        if (!res.parsed || !isPlainObject(res.data)) {
          setToolMsg(tool.id, "The response could not be read. Nothing is being reported.", "err");
          return;
        }

        if (resultEl) resultEl.innerHTML = renderToolResult(tool, res.data);
        setToolMsg(tool.id, "", "");
      })
      .catch(function (error) {
        if (runBtn) runBtn.disabled = false;
        setToolMsg(tool.id, (error && error.message) || "That could not be run.", "err");
      });
  }

  function bindTools() {
    if (!TOOLS.length) return;

    TOOLS.forEach(function (tool) {
      var head = document.querySelector('[data-tool-toggle="' + tool.id + '"]');
      if (head) {
        head.addEventListener("click", function () {
          var body = document.getElementById(toolDomId(tool.id, "body"));
          var caret = document.getElementById(toolDomId(tool.id, "caret"));
          if (!body) return;
          body.hidden = !body.hidden;
          if (caret) caret.textContent = body.hidden ? "Show" : "Hide";
        });
      }

      var runBtn = document.querySelector('[data-tool-run="' + tool.id + '"]');
      if (runBtn) runBtn.addEventListener("click", function () { runTool(tool); });

      (tool.fields || []).forEach(function (field) {
        if (field.type !== "rows") return;
        var id = toolDomId(tool.id, "f_" + field.name);
        var addBtn = document.querySelector('[data-addrow="' + id + '"]');
        var wrap = document.getElementById(id);
        if (!addBtn || !wrap) return;
        addBtn.addEventListener("click", function () {
          var first = wrap.querySelector(".ap-tool-row");
          if (!first) return;
          var clone = first.cloneNode(true);
          Array.prototype.forEach.call(clone.querySelectorAll("input"), function (i) { i.value = ""; });
          wrap.appendChild(clone);
        });
      });
    });
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

  /* ── lightweight markdown → HTML renderer ── */
  function renderMarkdown(raw) {
    if (!raw) return "";
    function escH(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }
    function inline(s) {
      return s
        .replace(/`([^`\n]+)`/g, '<code class="ap-md-code">$1</code>')
        .replace(/\*\*\*([^*\n]+)\*\*\*/g, "<strong><em>$1</em></strong>")
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
        .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
        .replace(/_([^_\n]+)_/g, "<em>$1</em>");
    }
    var lines = raw.split("\n");
    var out = [], inUl = false, inOl = false, inTable = false, tableHeadDone = false, inCode = false, codeBuf = [];
    function closeLists() {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
    }
    function closeTable() {
      if (!inTable) return;
      out.push(tableHeadDone ? "</tbody></table>" : "</thead></table>");
      inTable = false; tableHeadDone = false;
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^[ \t]*```/.test(line)) {
        if (!inCode) { closeLists(); closeTable(); inCode = true; codeBuf = []; }
        else { inCode = false; out.push('<pre class="ap-md-pre"><code>' + escH(codeBuf.join("\n")) + "</code></pre>"); }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }
      if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line.trim())) {
        closeLists(); closeTable();
        out.push('<hr class="ap-md-hr">'); continue;
      }
      if (/^\|/.test(line)) {
        closeLists();
        if (/^\|[\s:|-]+\|$/.test(line)) {
          if (inTable && !tableHeadDone) { out.push("</thead><tbody>"); tableHeadDone = true; }
          continue;
        }
        var cells = line.replace(/^\||\|$/g, "").split("|");
        if (!inTable) { inTable = true; tableHeadDone = false; out.push('<table class="ap-md-table"><thead>'); }
        var tag = tableHeadDone ? "td" : "th";
        out.push("<tr>" + cells.map(function(c){ return "<" + tag + ">" + inline(escH(c.trim())) + "</" + tag + ">"; }).join("") + "</tr>");
        continue;
      }
      if (inTable) closeTable();
      var hm = line.match(/^(#{1,6})\s+(.*)/);
      if (hm) {
        closeLists();
        out.push('<div class="ap-md-h' + hm[1].length + '">' + inline(escH(hm[2])) + '</div>'); continue;
      }
      if (/^[-*+] /.test(line)) {
        if (inOl) { out.push("</ol>"); inOl = false; }
        if (!inUl) { out.push('<ul class="ap-md-ul">'); inUl = true; }
        out.push("<li>" + inline(escH(line.slice(2))) + "</li>"); continue;
      }
      if (/^\d+\. /.test(line)) {
        if (inUl) { out.push("</ul>"); inUl = false; }
        if (!inOl) { out.push('<ol class="ap-md-ol">'); inOl = true; }
        out.push("<li>" + inline(escH(line.replace(/^\d+\. /,""))) + "</li>"); continue;
      }
      if (/^\s*$/.test(line)) {
        closeLists(); closeTable();
        out.push('<div class="ap-md-gap"></div>'); continue;
      }
      closeLists(); closeTable();
      out.push('<p class="ap-md-p">' + inline(escH(line)) + '</p>');
    }
    closeLists(); closeTable();
    if (inCode) out.push('<pre class="ap-md-pre"><code>' + escH(codeBuf.join("\n")) + "</code></pre>");
    return out.join("");
  }

  /* strips markdown symbols for plain-text preview snippets */
  function stripMarkdown(raw) {
    if (!raw) return "";
    return raw
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/^[-*+] /gm, "")
      .replace(/^\d+\. /gm, "")
      .replace(/^\|.+\|$/gm, "")
      .replace(/^[\s\-:|]+$/gm, "")
      .replace(/^\s*[-*_]{3,}\s*$/gm, "")
      .replace(/\n+/g, " ")
      .trim();
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
    var isSocial  = (taskType === "social_media_drafts");

    var card = document.createElement("div");
    card.className = "ap-result-card";

    /* common header — same for all task types */
    card.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
        '<div class="ap-result-status" style="font-size:.9rem;font-weight:800;color:' + (isSocial ? "#22d3ee" : "#4ade80") + '">' +
          (isSocial ? "✦ Drafts Ready — Review Below" : "✓ Task Completed") +
        '</div>' +
        '<div style="font-size:.72rem;color:#8888aa">' + esc(timestamp) + ' · ' + esc(taskType) + '</div>' +
      '</div>' +
      '<div class="ap-result-sublabel" style="color:#c4b5fd">Your Request</div>' +
      '<div class="ap-result-input">' + esc(prompt) + '</div>';

    if (isSocial) {
      /* split on the machine-parseable delimiter the prompt builder uses */
      var posts = result.split(/\n?---POST---\n?/).map(function(s) { return s.trim(); }).filter(Boolean);
      if (!posts.length) posts = result ? [result] : ["No result returned."];

      var draftsLabel = document.createElement("div");
      draftsLabel.className = "ap-result-sublabel";
      draftsLabel.textContent = posts.length + (posts.length === 1 ? " Draft" : " Drafts") + " — Approve individually";
      card.appendChild(draftsLabel);

      posts.forEach(function(postContent, idx) {
        var postCard = document.createElement("div");
        postCard.className = "ap-social-post";

        var postNum = document.createElement("div");
        postNum.className = "ap-social-post-num";
        postNum.textContent = "Post " + (idx + 1) + " of " + posts.length;
        postCard.appendChild(postNum);

        var contentEl = document.createElement("div");
        contentEl.className = "ap-result-body";
        contentEl.innerHTML = renderMarkdown(postContent);
        postCard.appendChild(contentEl);

        var actions = document.createElement("div");
        actions.style.cssText = "display:flex;gap:10px;margin-top:10px;flex-wrap:wrap";
        var approveBtn = document.createElement("button");
        approveBtn.type = "button";
        approveBtn.className = "ap-approve-btn";
        approveBtn.innerHTML = "✓ Approve &amp; Schedule";
        var rejectBtn = document.createElement("button");
        rejectBtn.type = "button";
        rejectBtn.className = "ap-reject-btn";
        rejectBtn.textContent = "✕ Reject";
        var msgEl = document.createElement("div");
        msgEl.className = "ap-approve-msg";
        msgEl.style.cssText = "margin-top:6px;font-size:.78rem;min-height:14px;color:#8892b8";

        approveBtn.addEventListener("click", function() { approveDraft(postContent, postCard); });
        rejectBtn.addEventListener("click",  function() { rejectDraft(postCard); });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);
        postCard.appendChild(actions);
        postCard.appendChild(msgEl);
        card.appendChild(postCard);
      });
    } else {
      /* non-social: render full result as one block */
      var respLabel = document.createElement("div");
      respLabel.className = "ap-result-sublabel";
      respLabel.textContent = "AI Response";
      var respBody = document.createElement("div");
      respBody.className = "ap-result-body";
      respBody.innerHTML = renderMarkdown(result || "No result returned.");
      card.appendChild(respLabel);
      card.appendChild(respBody);
    }

    wrapper.insertBefore(card, wrapper.firstChild);
    try { saveToLibrary(task); } catch(e) {}
  }

  /* ── approve draft → POST /api/social-drafts ── */
  function approveDraft(result, card) {
    var approveBtn = card.querySelector(".ap-approve-btn");
    var rejectBtn  = card.querySelector(".ap-reject-btn");
    var msgEl      = card.querySelector(".ap-approve-msg");
    var token = tok();
    if (!token) {
      if (msgEl) { msgEl.textContent = "Not signed in."; msgEl.style.color = "#f87171"; }
      return;
    }
    if (approveBtn) { approveBtn.disabled = true; approveBtn.innerHTML = '<span class="ap-spinner"></span>Saving…'; }
    if (rejectBtn)  rejectBtn.disabled = true;

    fetch(API_URL + "/api/social-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ platform: "instagram", content: result, status: "pending" })
    })
    .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
    .then(function(res) {
      if (!res.ok) throw new Error(res.data.error || "Save failed");
      var actionRow = card.querySelector(".ap-approve-btn") && card.querySelector(".ap-approve-btn").parentNode;
      if (actionRow) actionRow.style.display = "none";
      var statusEl = card.querySelector(".ap-result-status");
      if (statusEl) { statusEl.textContent = "✓ Approved"; statusEl.style.color = "#4ade80"; }
      if (msgEl) { msgEl.textContent = "Added to Approval Queue."; msgEl.style.color = "#4ade80"; }
      loadApprovalQueue();
    })
    .catch(function(e) {
      if (approveBtn) { approveBtn.disabled = false; approveBtn.innerHTML = "✓ Approve &amp; Schedule"; }
      if (rejectBtn)  rejectBtn.disabled = false;
      if (msgEl) { msgEl.textContent = e.message || "Save failed."; msgEl.style.color = "#f87171"; }
    });
  }

  /* ── reject draft → fade-remove card ── */
  function rejectDraft(card) {
    card.style.transition = "opacity .3s ease, transform .3s ease";
    card.style.opacity = "0";
    card.style.transform = "translateY(-6px)";
    setTimeout(function() { if (card.parentNode) card.parentNode.removeChild(card); }, 320);
  }

  /* ── load & render approval queue ── */
  function loadApprovalQueue() {
    var el = document.getElementById("apApprovalQueue");
    if (!el) return;
    var token = tok();
    if (!token) return;
    fetch(API_URL + "/api/social-drafts", {
      headers: { "Authorization": "Bearer " + token }
    })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      var drafts = (data && Array.isArray(data.drafts)) ? data.drafts : [];
      renderApprovalQueue(drafts);
    })
    .catch(function() {});
  }

  function renderApprovalQueue(drafts) {
    var el = document.getElementById("apApprovalQueue");
    if (!el) return;
    if (!drafts.length) {
      el.innerHTML = '<div class="ap-queue-empty">No drafts in queue yet. Approve a Social Media Drafts result to add one.</div>';
      return;
    }
    var html = '<div class="ap-queue-list">';
    drafts.slice(0, 20).forEach(function(d) {
      var preview  = d.content ? (d.content.length > 220 ? d.content.slice(0, 220) + "…" : d.content) : "—";
      var platform = d.platform || "general";
      var status   = d.status   || "pending";
      html +=
        '<div class="ap-queue-item">' +
          '<div class="ap-queue-item-head">' +
            '<span class="ap-queue-platform">' + esc(platform) + '</span>' +
            '<span class="ap-queue-status">'   + esc(status)   + '</span>' +
            '<span class="ap-queue-time">'     + esc(fmt(d.created_at)) + '</span>' +
          '</div>' +
          '<div class="ap-queue-preview">' + esc(preview) + '</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
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

      console.log("[Content Agent] Fetching business profile:", API_URL + "/api/business-profile", "| Auth: Bearer " + token.slice(0, 12) + "…");
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

  /* builds enriched prompt that produces exactly 5 discrete posts separated by ---POST--- */
  function buildSocialPrompt(profile, userPrompt) {
    var p = profile || {};
    var lines = [
      "You are a social media copywriter. Produce exactly 5 ready-to-post social media posts.",
      "",
      "STRICT RULES:",
      "- Each post must be self-contained: full caption and relevant hashtags only.",
      "- Do NOT write a strategy, content calendar, plan, section headers, commentary, or any intro/outro text.",
      "- Separate every post with this exact delimiter on its own line: ---POST---",
      "- No text before the first post. No text after the last post. Only the 5 posts and the 4 delimiters between them.",
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
    lines.push(
      "",
      "USER REQUEST:", userPrompt,
      "",
      "OUTPUT — exactly 5 posts, each separated by ---POST--- (the delimiter must appear on its own line):"
    );
    return lines.join("\n");
  }

  /* sends prompt to /api/ai/tasks; displayPrompt is shown in the result card */
  function doSubmit(finalPrompt, taskType, displayPrompt, promptEl) {
    var token = tok();
    fetch(API_URL + "/api/ai/tasks", {
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
        } else if (t.status === "requires_approval") {
          /* Terminal, not in-progress. The agent finished and filed a proposal;
             nothing further will arrive on this task. Without this branch it fell
             to the else below, kept polling, and reported a six-minute timeout for
             work that had already succeeded. */
          clearInterval(pollTimer);
          setBtnLoading(false);
          setMsg("Task complete — proposal awaiting your approval.", "ok");
          setLive("ok", "Awaiting approval", "Finished: " + fmt(t.updated_at || t.created_at));
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
      var plainPreview = hasResult ? stripMarkdown(t.result) : "Processing…";
      var preview = plainPreview.length > 180 ? plainPreview.slice(0, 180) + "…" : plainPreview;
      var statusCls  = (t.status === "completed") ? "completed"
        : (t.status === "failed") ? "failed"
        : "processing";

      html +=
        '<div class="ap-hist-item">' +
          '<div class="ap-hist-title">' + esc(title) + '</div>' +
          '<div class="ap-hist-meta">' + esc(fmt(t.created_at)) + ' · ' + esc(t.task_type || "general") + '</div>' +
          '<div class="ap-hist-preview">' + esc(preview) + '</div>' +
          (hasResult ? '<div class="ap-hist-full">' + renderMarkdown(t.result) + '</div>' : '') +
          '<span class="ap-hist-tag ' + statusCls + '">' + esc(t.status || "unknown") + '</span>' +
          (hasResult ? '<button class="ap-hist-expand" type="button">Show full response ▾</button>' : '') +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  /* ── save completed task result to Content Library ── */
  function saveToLibrary(task) {
    if (!task || !task.result) return;
    try {
      fetch("https://dynamic-prosperity-production-5382.up.railway.app/api/content-library", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + (localStorage.getItem("bf_token") || ""),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type:       "blog",
          title:      AGENT_TYPE + " task",
          keyword:    task.task_type || "",
          source_url: "",
          body:       task.result || ""
        })
      }).catch(function () {});
    } catch (e) {}
  }

  /* ── populate business context grid from live API ── */
  function loadBusinessContext() {
    var grid = document.getElementById("businessContextGrid");
    if (!grid) return;
    var token = tok();
    if (!token) return;
    try {
      fetch(API_URL + "/api/business-profile", {
        headers: { "Authorization": "Bearer " + token }
      })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(d) {
        if (!d || !d.profile) return;
        var store = {};
        try {
          if (typeof window.loadExecutiveMemory === "function" &&
              typeof window.getAgentStore === "function") {
            store = window.getAgentStore(window.loadExecutiveMemory());
          }
        } catch (e) {}
        if (typeof window.buildBusinessContext === "function" &&
            typeof window.renderBusinessContext === "function") {
          var context = window.buildBusinessContext(d.profile, store);
          window.renderBusinessContext(context);
          /* TWO INDEPENDENT SURFACES THAT LOOK ALIKE ON THE SAME PAGE.

             This call renders the agent_memory STORE — bf_executive_memory
             keyed by the page's AGENT_KEY — into #reportsGrid, through each
             page's own REPORT_SECTIONS.

             A COMPLETED ai_task NEVER WRITES INTO THAT STORE. This file has no
             saveExecutiveMemory call and no localStorage write; task results
             arrive from POST /api/ai/tasks, are polled back, and are rendered
             straight into #apHistory by prependResultCard. The store is read
             here and written by nothing in this file.

             So the two are unrelated content in adjacent boxes: the task panel
             is injected beforebegin of #reportsGrid a few lines above, which
             puts real model output directly on top of stored sample output
             with the same card styling. Anyone adding a marker must scope it to
             one or the other, never to the pair.

             WHO WRITES THE STORE: only dashboard.html, from hash-seeded
             generators. Eighteen pages load this script; sixteen read a slot a
             dashboard generator writes. Of those sixteen, ONLY SEO's generators
             are reachable from a button — the other fifteen are callable from
             the console alone, so their sections are empty for every real user
             and show an empty state telling them to "Run the agent from the
             dashboard", where no such control exists. rd-agent.html declares no
             AGENT_KEY at all and vertical-marketing-agent.html uses a key
             nothing writes.

             THIS IS THE MAP FOR THE PERSISTENCE PATH. Whoever wires a real task
             result into the store closes that gap — and the moment they do, the
             store stops being uniformly fabricated and the "absent provenance
             means simulated" assumption behind the current labelling stops
             holding. Mark the real records at that point, not after. */
          if (typeof window.renderReports === "function") {
            try { window.renderReports(store, AGENT_LABEL); } catch (e) {}
          }
        } else {
          var p = d.profile;
          var fields = [
            { label: "Business",    value: p.business_name   || "—" },
            { label: "Industry",    value: p.industry        || "—" },
            { label: "Website",     value: p.website         || "—" },
            { label: "Location",    value: p.location        || "—" },
            { label: "Competitors", value: p.top_competitors || "—" }
          ];
          var html = "";
          for (var i = 0; i < fields.length; i++) {
            html += '<div class="context-item"><label>' + esc(fields[i].label) + '</label><span>' + esc(String(fields[i].value)) + '</span></div>';
          }
          grid.innerHTML = html;
        }
      })
      .catch(function() {});
    } catch (e) {}
  }

  /* ── boot ── */
  document.addEventListener("DOMContentLoaded", inject);
})();

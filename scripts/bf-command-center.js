/* ══════════════════════════════════════════════════════════════════════════
   scripts/bf-command-center.js — the Command Center, one renderer for two pages:
   dashboard.html and executive-agent.html (Headquarters). Each page carries the
   same <section id="commandCenterSection"> markup and loads this right after it.
   It reads GET /api/command-center on load and on Refresh; nothing polls.
   Dispatch posts to /api/assignments/dispatch and reads the plans again.
   ══════════════════════════════════════════════════════════════════════════ */
(function commandCenterStyle() {
    if (document.getElementById("bfCommandCenterStyle")) { return; }
    var style = document.createElement("style");
    style.id = "bfCommandCenterStyle";
    style.textContent = ".cc-grid{display:flex;flex-direction:column;gap:14px}\n.cc-panel h3{font-size:.78rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9fb3ff;margin-bottom:10px}\n.cc-panel ul{list-style:none;display:flex;flex-direction:column;gap:6px}\n.cc-panel li{font-size:.86rem;color:#dfe6ff;line-height:1.5}\n.cc-panel a{color:#67e8f9}\n.cc-muted{color:#8892b8;font-size:.8rem}\n.cc-sub{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8892b8;margin:10px 0 6px}\n.cc-error{padding:10px 12px;border-radius:10px;border:1px solid rgba(248,113,113,.4);background:rgba(248,113,113,.08);color:#fca5a5;font-size:.84rem;line-height:1.5}\n.cc-clear{color:#6ee7b7;font-weight:700}\n.cc-plan{padding:12px;border-radius:12px;border:1px solid rgba(var(--bf-accent-a3-rgb, 0,229,255),.16);background:rgba(8,8,18,.6);margin-bottom:10px}\n.cc-plan-head{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin-bottom:8px}\n.cc-assignment{padding:8px 0;border-top:1px solid rgba(var(--bf-accent-a3-rgb, 0,229,255),.1)}\n.cc-state{font-size:.8rem;color:#c9d4ff;margin-top:4px}\n.cc-answer{margin-top:6px;padding:8px 10px;border-radius:8px;background:#05070f;border:1px solid rgba(var(--bf-accent-b-rgb, 168,85,247),.3);color:#e9d5ff;font-size:.76rem;white-space:pre-wrap;overflow-wrap:anywhere}\n";
    // Just before the section, where the dashboard once had it inline, so the cascade is unchanged.
    var section = document.getElementById("commandCenterSection");
    if (section && section.parentNode) { section.parentNode.insertBefore(style, section); }
    else { (document.head || document.documentElement).appendChild(style); }
})();
(function commandCenter() {
    var CC_API = "https://dynamic-prosperity-production-5382.up.railway.app";
    var PANELS = { needs_you: "ccNeedsYou", plans: "ccPlans", activity: "ccActivity", autopilot: "ccAutopilot", outbound: "ccOutbound", spend: "ccSpend" };

    /* Every run opens on run.html, which reads it by id from GET /api/ai/tasks/:id. */
    function runLink(runId, text) {
        return '<a href="run.html?id=' + encodeURIComponent(runId) + '">' + text + '</a>';
    }

    var SENDER_REASONS = {
        enabled: "Email sequences are switched off on the server (ENABLE_EMAIL_SEQUENCES), so no sequence email is sent.",
        postal_address_set: "No postal address is set (lib/legal.js POSTAL_ADDRESS on the server), and marketing email cannot go out without one.",
        webhook_secret_set: "The Resend webhook secret is not set (RESEND_WEBHOOK_SECRET), so bounces and complaints could not be heard; sending is held.",
        daily_cap: "The daily sending cap is not a usable number (EMAIL_MARKETING_DAILY_CAP), so sending is held."
    };

    var REFUSALS = {
        chaining_disabled: "agent chaining is switched off on the server (ENABLE_AGENT_CHAINING), so no tool may be dispatched",
        assignment_not_dispatchable: "the plan marks this assignment as not runnable",
        assignment_not_in_plan: "the plan has no assignment with that number",
        plan_not_found: "no such plan belongs to this account",
        not_an_executive_plan: "that task is not an executive plan",
        plan_has_no_output: "the plan has no stored output to dispatch from",
        handler_error: "the tool failed while running",
        chain_depth_reached: "the chain is already as deep as it may go",
        chain_total_calls_reached: "the chain has made as many calls as it may",
        chain_fanout_reached: "the chain has fanned out as far as it may",
        dispatch_rate_reached: "too many dispatches in a short time; try again later",
        not_entitled: "this account's plan does not include that tool",
        entitlement_unknown: "the account's plan could not be checked",
        tool_takes_external_action: "the tool acts outside BizForce, so it is never dispatched automatically",
        tool_not_in_router: "the tool is not one the dispatcher can run",
        tool_has_no_spec: "the tool has no input specification",
        body_missing_required_fields: "the stored inputs are missing required fields",
        handler_not_found: "the tool's handler was not found",
        user_missing: "no account was named",
        chain_id_missing: "the chain had no id",
        chain_depth_invalid: "the chain depth was invalid",
        chain_calls_invalid: "the chain call count was invalid"
    };

    var dispatchAnswers = {};

    function esc(value) {
        return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function when(value) {
        if (!value) { return "—"; }
        var d = new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
    }
    function errorBox(message) {
        return '<div class="cc-error">Could not read this section: ' + esc(message) + '</div>';
    }
    function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
    function counts(obj) {
        return Object.keys(obj || {}).sort().map(function(k) { return esc(k) + " " + esc(obj[k]); }).join(" · ");
    }
    function refusalWords(reason) {
        if (!reason) { return "no reason was recorded"; }
        return REFUSALS[reason] ? REFUSALS[reason] + " (" + reason + ")" : reason;
    }
    function setPanel(id, html) {
        var el = document.getElementById(id);
        if (el) { el.innerHTML = html; }
    }

    function renderNeedsYou(d) {
        var p = d && d.pending_proposals, f = d && d.failed_runs_7d, s = d && d.email_sender;
        if (!p || typeof p.count !== "number" || !Array.isArray(p.rows) ||
            !f || typeof f.count !== "number" || !Array.isArray(f.rows) ||
            !s || !Array.isArray(s.blocked_by)) {
            return errorBox("the answer did not carry proposals, failed runs and the email sender");
        }
        if (p.count === 0 && f.count === 0 && s.blocked_by.length === 0) {
            return '<p class="cc-clear">Nothing needs you.</p>';
        }
        var html = '<div class="cc-sub">Proposals waiting for you</div>';
        /* The Executive deck's Approvals tab draws these in its own approval
           queue, beside this panel; there the panel points at it instead of
           listing them a second time (data-cc-queue="elsewhere"). */
        var box = document.getElementById("ccNeedsYou");
        if (box && box.dataset && box.dataset.ccQueue === "elsewhere") {
            html += '<p class="cc-muted">' + (p.count === 0 ? 'No pending proposals.' : p.count + (p.count === 1 ? ' proposal waits' : ' proposals wait') + ' in the approval queue above.') + '</p>';
        } else if (p.count === 0) {
            html += '<p class="cc-muted">No pending proposals.</p>';
        } else {
            html += '<ul>' + p.rows.map(function(r) {
                return '<li><a href="proposals.html">' + esc(r.title || "Untitled proposal") + '</a> <span class="cc-muted">' + esc(r.agent_type || "") + ' · ' + esc(when(r.created_at)) + '</span></li>';
            }).join("") + '</ul>';
            if (p.count > p.rows.length) {
                html += '<p class="cc-muted">and ' + (p.count - p.rows.length) + ' more on <a href="proposals.html">Proposals</a>.</p>';
            }
        }
        html += '<div class="cc-sub">Runs that failed in the last 7 days</div>';
        if (f.count === 0) {
            html += '<p class="cc-muted">No failed runs.</p>';
        } else {
            html += '<ul>' + f.rows.map(function(r) {
                return '<li>' + runLink(r.id, esc(r.agent_type) + ' · ' + esc(r.task_type)) + ' <span class="cc-muted">' + esc(when(r.created_at)) + '</span></li>';
            }).join("") + '</ul>';
            if (f.count > f.rows.length) {
                html += '<p class="cc-muted">and ' + (f.count - f.rows.length) + ' more.</p>';
            }
        }
        html += '<div class="cc-sub">Email sender</div>';
        if (!s.blocked_by.length) {
            html += '<p class="cc-muted">Nothing holds sequence mail.</p>';
        } else {
            html += '<ul>' + s.blocked_by.map(function(reason) {
                return '<li>' + esc(SENDER_REASONS[reason] || reason) + '</li>';
            }).join("") + '</ul>';
        }
        return html;
    }

    function assignmentState(a) {
        var ld = a.latest_dispatch;
        if (ld === "not dispatched") { return "Not dispatched"; }
        if (!ld || typeof ld !== "object") { return "State unknown: " + esc(JSON.stringify(ld)); }
        var at = ' <span class="cc-muted">' + esc(when(ld.created_at)) + '</span>';
        if (ld.outcome === "ran") {
            var text = "Ran — the run is " + esc(ld.tool_task_status || "no longer found");
            if (ld.tool_task_id) {
                text += ' · ' + runLink(ld.tool_task_id, "open the run");
            }
            return text + at;
        }
        if (ld.outcome === "refused") { return "Refused — " + esc(refusalWords(ld.refused_reason)) + at; }
        if (ld.outcome === "failed") { return "Failed" + (ld.refused_reason ? " — " + esc(refusalWords(ld.refused_reason)) : "") + at; }
        return "State unknown: " + esc(ld.outcome) + at;
    }

    function dispatchAnswerHtml(answer) {
        if (!answer) { return ""; }
        if (answer.pending) { return '<div class="cc-answer">Dispatching…</div>'; }
        if (answer.error) { return '<div class="cc-answer">The request failed: ' + esc(answer.error) + '</div>'; }
        var body = null;
        try { body = JSON.parse(answer.text); } catch (e) { body = null; }
        var summary;
        if (answer.status !== 200 || !body) {
            summary = "HTTP " + answer.status;
        } else if (body.ok === true) {
            summary = "Ran.";
        } else {
            summary = "Refused — " + refusalWords(body.refused_reason);
        }
        return '<div class="cc-answer">' + esc(summary) + '<br>' + esc(answer.text) + '</div>';
    }

    function renderPlans(plans) {
        if (!Array.isArray(plans)) { return errorBox("the answer did not carry a list of plans"); }
        if (!plans.length) {
            return '<p class="cc-muted">No executive plans yet. Build one on the <a href="executive-agent.html">Executive agent</a> page.</p>';
        }
        return plans.map(function(plan) {
            var list = Array.isArray(plan.assignments) ? plan.assignments : [];
            var html = '<div class="cc-plan"><div class="cc-plan-head"><strong>' + esc(plan.goal || "No goal recorded") + '</strong>' +
                '<span class="cc-muted">' + esc(when(plan.created_at)) + ' · ' + esc(plan.status) + '</span></div>';
            if (!list.length) {
                return html + '<p class="cc-muted">This plan has no assignments.</p></div>';
            }
            list.forEach(function(a) {
                var ran = a.latest_dispatch && typeof a.latest_dispatch === "object" && a.latest_dispatch.outcome === "ran";
                html += '<div class="cc-assignment"><div>#' + esc(a.id) + ' <strong>' + esc(a.agent || "no agent") + '</strong> · ' +
                    esc(a.tool || "no tool") + ' · ' + esc(a.priority || "no priority") + '</div>' +
                    '<div>' + esc(a.task || "") + '</div>' +
                    '<div class="cc-state">' + assignmentState(a) + '</div>';
                if (a.is_dispatchable !== true) {
                    html += '<div class="cc-muted">Not runnable' + (a.problems && a.problems.length ? ": " + esc(a.problems.join("; ")) : "") + '</div>';
                }
                if (a.is_dispatchable === true && !ran) {
                    html += '<button type="button" class="bf-btn" data-cc-dispatch="1" data-plan="' + esc(plan.id) + '" data-assignment="' + esc(a.id) + '">Dispatch</button>';
                }
                html += dispatchAnswerHtml(dispatchAnswers[plan.id + "#" + a.id]) + '</div>';
            });
            return html + '</div>';
        }).join("");
    }

    function renderActivity(d) {
        if (!d || typeof d.total !== "number" || !d.by_agent_type || typeof d.sales_dry_runs !== "number" || !Array.isArray(d.newest_runs)) {
            return errorBox("the answer did not carry the activity counts");
        }
        var html = '<p>' + plural(d.total, "run", "runs") + ' since ' + esc(when(d.since)) + '.</p>';
        var agents = Object.keys(d.by_agent_type).sort();
        if (agents.length) {
            html += '<ul>' + agents.map(function(agent) {
                return '<li><strong>' + esc(agent) + '</strong> <span class="cc-muted">' + counts(d.by_agent_type[agent]) + '</span></li>';
            }).join("") + '</ul>';
        }
        html += '<p class="cc-muted">Sales dry runs, counted apart: ' + d.sales_dry_runs + ' — drafts that were never sent.</p>';
        html += '<div class="cc-sub">Newest runs</div>';
        if (!d.newest_runs.length) {
            html += '<p class="cc-muted">No runs yet.</p>';
        } else {
            html += '<ul>' + d.newest_runs.map(function(r) {
                return '<li>' + runLink(r.id, esc(r.agent_type) + ' · ' + esc(r.task_type) + ' · ' + esc(r.status)) + ' <span class="cc-muted">' + esc(when(r.created_at)) + '</span></li>';
            }).join("") + '</ul>';
        }
        return html;
    }

    function renderAutopilot(d) {
        if (!d || !Array.isArray(d.autonomy) || !Array.isArray(d.schedules)) {
            return errorBox("the answer did not carry autonomy and schedules");
        }
        var html = '<div class="cc-sub">Autonomy</div>';
        html += !d.autonomy.length ? '<p class="cc-muted">No autonomy settings saved.</p>' : '<ul>' + d.autonomy.map(function(r) {
            return '<li><strong>' + esc(r.agent_type) + '</strong> ' + (r.enabled === true ? "on" : "off") + ' <span class="cc-muted">since ' + esc(when(r.updated_at)) + '</span></li>';
        }).join("") + '</ul>';
        html += '<div class="cc-sub">Schedules</div>';
        html += !d.schedules.length ? '<p class="cc-muted">No schedules</p>' : '<ul>' + d.schedules.map(function(r) {
            return '<li><strong>' + esc(r.agent_type) + '</strong> · ' + esc(r.task_type) + ' · ' + esc(r.cadence) + ' at ' + esc(r.hour_utc) + ':00 UTC · ' +
                (r.enabled === true ? "enabled" : "paused") + ' <span class="cc-muted">last ran ' + esc(r.last_run_on || "never") + '</span></li>';
        }).join("") + '</ul>';
        return html;
    }

    function renderOutbound(d) {
        if (!d || !Array.isArray(d.email_sequences) || !d.social_drafts_by_status || !d.content_published_30d || typeof d.content_published_30d.count !== "number") {
            return errorBox("the answer did not carry sequences, drafts and published articles");
        }
        var html = '<div class="cc-sub">Email sequences</div>';
        html += !d.email_sequences.length ? '<p class="cc-muted">No email sequences.</p>' : '<ul>' + d.email_sequences.map(function(seq) {
            var enrolled = counts(seq.enrollments);
            return '<li><strong>' + esc(seq.name) + '</strong> · ' + esc(seq.status) + ' <span class="cc-muted">' + (enrolled || "no enrollments") + '</span></li>';
        }).join("") + '</ul>';
        html += '<div class="cc-sub">Social drafts</div>';
        var drafts = counts(d.social_drafts_by_status);
        html += '<p' + (drafts ? '>' + drafts : ' class="cc-muted">No social drafts.') + '</p>';
        html += '<div class="cc-sub">Articles</div>';
        html += '<p>' + plural(d.content_published_30d.count, "article", "articles") + ' published in the last 30 days.</p>';
        return html;
    }

    function renderSpend(d) {
        if (!d || typeof d.usd !== "number") { return errorBox("the answer did not carry this month's spend"); }
        var html = '<p><strong>$' + d.usd.toFixed(2) + '</strong>';
        html += typeof d.monthly_cap_usd === "number"
            ? ' of <strong>$' + d.monthly_cap_usd.toFixed(2) + '</strong> this month.</p>'
            : ' this month. The monthly cap is not a usable number, so model calls are refused.</p>';
        if (Array.isArray(d.unpriced_models) && d.unpriced_models.length) {
            html += '<p class="cc-muted">No price is known for: ' + esc(d.unpriced_models.join(", ")) + '.</p>';
        }
        html += '<p class="cc-muted">' + esc(d.note) + '</p>';
        html += '<p class="cc-muted">Resets ' + esc(when(d.resets_at)) + '.</p>';
        return html;
    }

    function renderPlatform(d) {
        if (!d || !Array.isArray(d.job_runs) || !Array.isArray(d.radar_status)) {
            return errorBox("the answer did not carry the jobs and the radar");
        }
        var html = '<div class="cc-sub">Background jobs</div>';
        html += !d.job_runs.length ? '<p class="cc-muted">No job has recorded a run.</p>' : '<ul>' + d.job_runs.map(function(j) {
            return '<li><strong>' + esc(j.job_name) + '</strong> last ran ' + esc(j.last_run_on || "never") + ' <span class="cc-muted">finished ' + esc(when(j.finished_at)) + '</span>' +
                (j.last_error ? '<div class="cc-error">' + esc(j.last_error) + '</div>' : '') + '</li>';
        }).join("") + '</ul>';
        html += '<div class="cc-sub">Radar heartbeat</div>';
        html += !d.radar_status.length ? '<p class="cc-muted">The radar has not recorded a tick.</p>' : '<ul>' + d.radar_status.map(function(r) {
            return '<li><strong>' + esc(r.source) + '</strong> last tick ' + esc(when(r.last_tick_finished_at)) + ' · ' + esc(r.last_outcome || "no outcome") +
                (r.last_error ? '<div class="cc-error">' + esc(r.last_error) + '</div>' : '') + '</li>';
        }).join("") + '</ul>';
        return html;
    }

    /* Offered to the page after each full read: { error } when it failed. Headquarters
       (scripts/bf-hq.js) reads the spend and needs-you sections from it, so the page
       asks the server once. */
    function announce(detail) {
        if (typeof CustomEvent !== "function" || !document.dispatchEvent) { return; }
        document.dispatchEvent(new CustomEvent("bf:command-center", { detail: detail }));
    }

    /* ══ CC-TABS: THE DASHBOARD'S TABBED MODE (Nov 10 2026, dashboard tabs; Nov 10 2026, real-browser fix and essentials) ══
       dashboard.html's <section id="commandCenterSection" data-cc-mode="tabs"> holds one scripts/bf-tabs.js
       panel: Command, Plans, Activity, Autopilot, Outbound, System, Memory (#cc-command …, sessionStorage
       bf_cc_tab, Command by default). Every tab draws from the ONE GET /api/command-center read, the first
       time it is opened (Command at once); Refresh reads it again and redraws the open tab. Everything here
       builds DOM with textContent; the step detail is the shared renderPlans's own escaped HTML, set by
       setPanel. The Executive page has no data-cc-mode and renders exactly as before.
       Hidden means hidden: dashboard.html's #ccDeck [hidden] rule (and bf-tabs.js's .deck-panel[hidden]) carry
       display:none !important, because .bf-panel and .cc-panel ul set display and beat the attribute in a
       real browser. Every fold below starts hidden, with aria-expanded="false".
       Only the essentials (no data is deleted; the caps only limit what is shown):
         Command    the chips (model calls today, subscription, spend this month, the platform ceiling for an
                    admin); "Proposals waiting (N)" and "Failed in the last 7 days (N)", each with its 3
                    newest and only when N > 0; with both 0, "Nothing needs you right now."
         Plans      active plans (at most 10), steps behind "Show steps"; "Past plans (N)" folded, the 5 newest
                    and the Executive page's Plans tab; with none, "No executive plans yet." and "Make a plan".
         Activity   "Last 7 days: agent N, …" (or "No runs in the last 7 days."), the 5 newest runs, "Show
                    more" folded up to 20, "Full history".
         Autopilot  one line per agent on Automatic, one per schedule of those agents, "N agents manual".
         Outbound   one line per type with something in it; the 3 latest of each behind one "Show latest".
         System     "Spend: $X of $Y this month (resets <date>)", the pricing note as its tooltip; for an admin,
                    one jobs health line, the jobs that need attention, one "X of 24 on time" line per hourly
                    family, the radar line, "Email sending: held (<reason>)" only while held, "Show all jobs (N)".
         Memory     the Agent Memory section, moved here unchanged. */
    var ccSection = document.getElementById("commandCenterSection");
    var TABBED = !!(ccSection && typeof ccSection.getAttribute === "function" && ccSection.getAttribute("data-cc-mode") === "tabs");
    var CC_TABS = ["command", "plans", "activity", "autopilot", "outbound", "system", "memory"];
    var CC_SHOW = { proposals: 3, failed: 3, activePlans: 10, pastPlans: 5, runs: 5, runsMore: 20, outbound: 3, hours: 24 };
    var FAMILY_NAMES = { hourly_agent_schedules: "Hourly agent schedules", hourly_triggers: "Hourly triggers", hourly_email_sequences: "Hourly email sequences" };
    var SENDER_SHORT = { enabled: "switched off on the server", postal_address_set: "no postal address is set", webhook_secret_set: "no Resend webhook secret is set",
        daily_cap: "the daily cap is not a usable number" };
    var tabbed = !TABBED ? null : (function ccTabs() {
        var body = null, failure = null, drawn = {}, openSteps = {}, ctl = null;
        function $(id) { return document.getElementById(id); }
        function el(tag, cls, text) {
            var n = document.createElement(tag);
            if (cls) { n.className = cls; }
            if (text !== undefined && text !== null) { n.textContent = text; }
            return n;
        }
        function link(href, text) { var n = el("a", null, text); n.setAttribute("href", href); return n; }
        function words(node, text) { node.appendChild(document.createTextNode(text)); return node; }
        function clear(node) { while (node && node.firstChild) { node.removeChild(node.firstChild); } }
        function failBox(message) { return el("div", "cc-error", "Could not read this section: " + message); }
        function money(n) { return "$" + Number(n).toFixed(2); }
        function day(value) { var d = new Date(value); return value && !isNaN(d.getTime()) ? d.toLocaleDateString() : "—"; }
        function list(items, make) { var ul = el("ul"); items.forEach(function (x) { ul.appendChild(make(x)); }); return ul; }
        function line(text, cls) { return el("p", cls || null, text); }
        // A fold: its button says aria-expanded="false" and the target starts hidden.
        function toggle(label, target, after) {
            var b = el("button", "bf-btn bf-btn-ghost cc-toggle", label);
            b.type = "button";
            b.setAttribute("aria-expanded", "false");
            b.setAttribute("aria-controls", target.id);
            target.hidden = true;
            b.addEventListener("click", function () {
                var open = b.getAttribute("aria-expanded") !== "true";
                b.setAttribute("aria-expanded", open ? "true" : "false");
                target.hidden = !open;
                if (after) { after(open, b); }
            });
            return b;
        }
        // { data } for a section that answered, { error } otherwise; a failure is never data.
        function section(name) {
            if (failure !== null) { return { error: failure }; }
            var s = body && body[name];
            if (!s || typeof s !== "object") { return { error: "the answer did not include this section" }; }
            if (s.ok !== true) { return { error: s.error || "the server gave no reason" }; }
            return { data: s.data };
        }
        function isAdmin() { return !!body && Object.prototype.hasOwnProperty.call(body, "platform"); }

        function drawChips(chips) {
            var out = [];
            var u = section("usage"), ud = u.data || {};
            if (u.error || typeof ud.model_calls_today !== "number" || typeof ud.model_calls_daily_cap !== "number") {
                out.push([true, "Model calls today could not be counted"]);
            } else {
                out.push([ud.model_calls_today >= ud.model_calls_daily_cap, "Model calls today: " + ud.model_calls_today + " of " + ud.model_calls_daily_cap]);
            }
            if (!u.error && ud.subscription_active === true) { out.push([false, "Subscription active"]); }
            else if (!u.error && ud.subscription_active === false) { out.push([true, "Subscription not active"]); }
            else { out.push([true, "Subscription could not be checked"]); }
            var sp = section("spend"), sd = sp.data;
            if (sp.error || !sd || typeof sd.usd !== "number") { out.push([true, "This month's spend could not be read"]); }
            else if (typeof sd.monthly_cap_usd !== "number") { out.push([true, "Spend this month: " + money(sd.usd) + " (no usable cap)"]); }
            else { out.push([sd.usd >= sd.monthly_cap_usd, "Spend this month: " + money(sd.usd) + " of " + money(sd.monthly_cap_usd)]); }
            // The platform section is in an admin's answer only; its ceiling only there.
            if (isAdmin()) {
                var pf = section("platform"), c = pf.data && pf.data.ceiling;
                if (pf.error || !c || c.unavailable) { out.push([true, "Platform ceiling could not be read"]); }
                else { out.push([c.spent_usd >= c.cap_usd * 0.8, "Platform ceiling today: " + money(c.spent_usd) + " of " + money(c.cap_usd)]); }
            }
            out.forEach(function (x) { chips.appendChild(el("span", "cc-chip" + (x[0] ? " is-alert" : ""), x[1])); });
        }

        function drawCommand() {
            var out = $("ccCommand"), chips = $("ccChips");
            clear(out); clear(chips);
            if (chips) { drawChips(chips); }
            var s = section("needs_you");
            if (s.error) { out.appendChild(failBox(s.error)); return; }
            var d = s.data, p = d && d.pending_proposals, f = d && d.failed_runs_7d;
            if (!p || typeof p.count !== "number" || !Array.isArray(p.rows) || !f || typeof f.count !== "number" || !Array.isArray(f.rows)) {
                out.appendChild(failBox("the answer did not carry proposals and failed runs"));
                return;
            }
            if (p.count === 0 && f.count === 0) {
                out.appendChild(line("Nothing needs you right now.", "cc-clear"));
                return;
            }
            if (p.count > 0) {
                out.appendChild(el("div", "cc-sub", "Proposals waiting (" + p.count + ")"));
                out.appendChild(list(p.rows.slice(0, CC_SHOW.proposals), function (r) {
                    var li = el("li");
                    li.appendChild(link("proposals.html", r.title || "Untitled proposal"));
                    words(li, " ");
                    li.appendChild(el("span", "cc-muted", (r.agent_type || "") + " · " + day(r.created_at)));
                    return li;
                }));
            }
            if (f.count > 0) {
                out.appendChild(el("div", "cc-sub", "Failed in the last 7 days (" + f.count + ")"));
                out.appendChild(list(f.rows.slice(0, CC_SHOW.failed), function (r) {
                    var li = el("li");
                    li.appendChild(link("run.html?id=" + encodeURIComponent(r.id), (r.agent_type || "") + " · " + (r.task_type || "")));
                    words(li, " ");
                    li.appendChild(el("span", "cc-muted", day(r.created_at)));
                    return li;
                }));
            }
        }

        function planWithSteps(plan) {
            var card = el("div", "cc-plan");
            var head = el("div", "cc-plan-head");
            head.appendChild(el("strong", null, plan.goal || "No goal recorded"));
            head.appendChild(el("span", "cc-muted", day(plan.created_at) + " · " + (plan.status || "")));
            card.appendChild(head);
            var steps = el("div", "cc-steps");
            steps.id = "ccSteps-" + plan.id;
            var fill = function (open, b) {
                if (open) { openSteps[plan.id] = true; setPanel(steps.id, renderPlans([plan])); b.textContent = "Hide steps"; }
                else { delete openSteps[plan.id]; b.textContent = "Show steps"; }
            };
            var b = toggle("Show steps", steps, fill);
            card.appendChild(b);
            card.appendChild(steps);
            if (openSteps[plan.id]) { b.setAttribute("aria-expanded", "true"); steps.hidden = false; fill(true, b); }
            return card;
        }
        function drawPlans() {
            var out = $("ccPlansTab");
            clear(out);
            var s = section("plan_lists"), d = s.data;
            if (s.error) { out.appendChild(failBox(s.error)); return; }
            if (!d || !Array.isArray(d.active) || typeof d.past_count !== "number" || !Array.isArray(d.past_latest)) {
                out.appendChild(failBox("the answer did not carry the active and past plans"));
                return;
            }
            var active = d.active.slice(0, CC_SHOW.activePlans);
            if (!active.length && d.past_count === 0) {
                var none = line("No executive plans yet. ");
                none.appendChild(link("executive-agent.html#tool=plan", "Make a plan"));
                out.appendChild(none);
                return;
            }
            if (active.length) {
                out.appendChild(el("div", "cc-sub", "Active plans (" + active.length + ")"));
                active.forEach(function (p) { out.appendChild(planWithSteps(p)); });
            }
            if (d.past_count > 0) {
                var past = el("div", "cc-fold");
                past.id = "ccPastPlans";
                past.appendChild(list(d.past_latest.slice(0, CC_SHOW.pastPlans), function (p) {
                    var li = el("li");
                    li.appendChild(el("strong", null, p.goal || "No goal recorded"));
                    words(li, " ");
                    li.appendChild(el("span", "cc-muted", "finished " + day(p.finished_at) + " · " + (p.status || "")));
                    return li;
                }));
                var all = el("p");
                all.appendChild(link("executive-agent.html#plans", "All plans"));
                past.appendChild(all);
                out.appendChild(toggle("Past plans (" + d.past_count + ")", past));
                out.appendChild(past);
            }
        }

        function drawActivity() {
            var out = $("ccActivityTab");
            clear(out);
            var s = section("activity"), d = s.data;
            if (s.error) { out.appendChild(failBox(s.error)); return; }
            if (!d || !d.counts_7d || typeof d.counts_7d !== "object" || !Array.isArray(d.newest_runs_20)) {
                out.appendChild(failBox("the answer did not carry the 7-day counts and the newest runs"));
                return;
            }
            var counts = Object.keys(d.counts_7d).sort().map(function (a) {
                var total = 0;
                Object.keys(d.counts_7d[a] || {}).forEach(function (st) { total += d.counts_7d[a][st]; });
                return [a, total];
            }).filter(function (x) { return x[1] > 0; });
            out.appendChild(line(counts.length ? "Last 7 days: " + counts.map(function (x) { return x[0] + " " + x[1]; }).join(", ") : "No runs in the last 7 days."));
            var runs = d.newest_runs_20.slice(0, CC_SHOW.runsMore);
            var row = function (r) {
                var li = el("li");
                li.appendChild(link("run.html?id=" + encodeURIComponent(r.id), (r.agent_type || "") + " · " + (r.task_type || "") + " · " + (r.status || "")));
                words(li, " ");
                li.appendChild(el("span", "cc-muted", when(r.created_at)));
                return li;
            };
            if (runs.length) { out.appendChild(list(runs.slice(0, CC_SHOW.runs), row)); }
            if (runs.length > CC_SHOW.runs) {
                var rest = list(runs.slice(CC_SHOW.runs), row);
                rest.id = "ccMoreRuns";
                out.appendChild(toggle("Show more", rest, function (open, b) { b.textContent = open ? "Show fewer" : "Show more"; }));
                out.appendChild(rest);
            }
            var full = el("p");
            full.appendChild(link("executive-agent.html#history", "Full history"));
            out.appendChild(full);
        }

        function drawAutopilot() {
            var out = $("ccAutopilotTab");
            clear(out);
            var s = section("autopilot"), d = s.data;
            if (s.error) { out.appendChild(failBox(s.error)); return; }
            if (!d || !Array.isArray(d.autonomy) || !Array.isArray(d.schedules)) { out.appendChild(failBox("the answer did not carry autonomy and schedules")); return; }
            var on = d.autonomy.filter(function (r) { return r.enabled === true; });
            var manual = d.autonomy.length - on.length;
            if (!on.length) { out.appendChild(line("No agents run automatically.")); }
            else {
                var onTypes = on.map(function (r) { return r.agent_type; });
                var mine = d.schedules.filter(function (r) { return onTypes.indexOf(r.agent_type) !== -1; });
                out.appendChild(list(on, function (r) { return el("li", null, r.agent_type + ": Automatic on since " + day(r.updated_at)); }));
                if (mine.length) {
                    out.appendChild(list(mine, function (r) {
                        return el("li", null, r.agent_type + " · " + r.task_type + " · " + r.cadence + " at " + r.hour_utc + ":00 UTC · " + (r.enabled === true ? "enabled" : "paused") +
                            " · last ran " + (r.last_run_on || "never"));
                    }));
                }
            }
            if (manual > 0) { out.appendChild(line(plural(manual, "agent manual", "agents manual"), "cc-muted")); }
        }

        function drawOutbound() {
            var out = $("ccOutboundTab");
            clear(out);
            var s = section("outbound"), d = s.data;
            if (s.error) { out.appendChild(failBox(s.error)); return; }
            if (!d || !Array.isArray(d.email_sequences) || !d.social_drafts_by_status || !d.content_published_30d || typeof d.content_published_30d.count !== "number" ||
                !Array.isArray(d.social_latest) || !Array.isArray(d.articles_latest)) {
                out.appendChild(failBox("the answer did not carry sequences, drafts and articles"));
                return;
            }
            var lines = [], latest = el("div", "cc-fold");
            latest.id = "ccOutboundLatest";
            var socialTotal = 0;
            Object.keys(d.social_drafts_by_status).forEach(function (k) { socialTotal += d.social_drafts_by_status[k]; });
            if (socialTotal > 0) {
                lines.push("Social posts: " + Object.keys(d.social_drafts_by_status).sort().filter(function (k) { return d.social_drafts_by_status[k] > 0; })
                    .map(function (k) { return d.social_drafts_by_status[k] + " " + k; }).join(", "));
                if (d.social_latest.length) {
                    latest.appendChild(el("div", "cc-sub", "Social posts"));
                    latest.appendChild(list(d.social_latest.slice(0, CC_SHOW.outbound), function (x) {
                        return el("li", null, (x.platform || "no platform") + " · " + x.status + " · " + (x.preview || ""));
                    }));
                }
            }
            if (d.email_sequences.length) {
                lines.push("Email sequences: " + d.email_sequences.length);
                latest.appendChild(el("div", "cc-sub", "Email sequences"));
                latest.appendChild(list(d.email_sequences.slice(0, CC_SHOW.outbound), function (q) { return el("li", null, q.name + " · " + q.status); }));
            }
            if (d.content_published_30d.count > 0 || d.articles_latest.length) {
                var newest = d.articles_latest[0];
                lines.push("Articles: " + (d.content_published_30d.count > 0 ? d.content_published_30d.count + " in the last 30 days" : "") +
                    (d.content_published_30d.count > 0 && newest ? ", " : "") + (newest ? "latest " + day(newest.published_at || newest.created_at) : ""));
                if (d.articles_latest.length) {
                    latest.appendChild(el("div", "cc-sub", "Articles"));
                    latest.appendChild(list(d.articles_latest.slice(0, CC_SHOW.outbound), function (x) {
                        return el("li", null, (x.title || "Untitled article") + " · " + day(x.published_at || x.created_at));
                    }));
                }
            }
            if (!lines.length) { out.appendChild(line("Nothing has gone out yet.")); return; }
            lines.forEach(function (t) { out.appendChild(line(t)); });
            if (latest.firstChild) {
                out.appendChild(toggle("Show latest", latest));
                out.appendChild(latest);
            }
        }

        /* The jobs as units: each hourly family (name_h00 … name_h23) is one unit, on time only with all 24
           hours on time; every other row is its own unit. */
        function jobUnits(verdicts) {
            var families = {}, units = [];
            verdicts.forEach(function (v) {
                var m = /^(hourly_[a-z_]+)_h(\d\d)$/.exec(v.job_name || "");
                if (m && v.cadence === "hourly") {
                    if (!families[m[1]]) { families[m[1]] = []; units.push({ family: m[1], rows: families[m[1]] }); }
                    families[m[1]].push(v);
                } else { units.push({ row: v }); }
            });
            units.forEach(function (u) {
                if (u.family) {
                    u.onTime = u.rows.filter(function (v) { return v.on_time === true; }).length;
                    u.ok = u.onTime === CC_SHOW.hours;
                    u.text = (FAMILY_NAMES[u.family] || u.family) + ": " + u.onTime + " of " + CC_SHOW.hours + " on time";
                } else {
                    u.ok = u.row.on_time === true;
                    u.text = u.row.job_name + ": " + (u.row.on_time === true ? "on time" : (u.row.reason || "needs attention"));
                }
            });
            return units;
        }
        function drawSystem() {
            var out = $("ccSystemTab");
            clear(out);
            var sp = section("spend"), sd = sp.data;
            if (sp.error) { out.appendChild(failBox(sp.error)); }
            else if (!sd || typeof sd.usd !== "number") { out.appendChild(failBox("the answer did not carry this month's spend")); }
            else {
                var spend = line("Spend: " + money(sd.usd) + (typeof sd.monthly_cap_usd === "number" ? " of " + money(sd.monthly_cap_usd) : " (no usable cap)") +
                    " this month (resets " + day(sd.resets_at) + ")");
                spend.id = "ccSystemSpend";
                var note = [sd.note || ""];
                if (Array.isArray(sd.unpriced_models) && sd.unpriced_models.length) { note.push("No price is known for: " + sd.unpriced_models.join(", ") + "."); }
                spend.title = note.filter(Boolean).join(" ");
                out.appendChild(spend);
            }
            if (!isAdmin()) { return; }
            var pf = section("platform"), d = pf.data;
            if (pf.error) { out.appendChild(failBox(pf.error)); return; }
            if (!d || !Array.isArray(d.job_runs) || !Array.isArray(d.radar_status) || !Array.isArray(d.jobs_on_time)) {
                out.appendChild(failBox("the answer did not carry the jobs, their schedules and the radar"));
                return;
            }
            var units = jobUnits(d.jobs_on_time);
            var bad = units.filter(function (u) { return !u.ok; });
            if (!units.length) { out.appendChild(line("No background job has recorded a run.")); }
            else if (!bad.length) { out.appendChild(line("All " + units.length + " background jobs ran on time", "cc-clear")); }
            else {
                out.appendChild(line(bad.length + " of " + units.length + " background jobs need attention", "cc-health"));
                var listed = bad.filter(function (u) { return !u.family; });
                if (listed.length) { out.appendChild(list(listed, function (u) { return el("li", null, u.text); })); }
            }
            var familyOrder = Object.keys(FAMILY_NAMES);
            units.filter(function (u) { return u.family; }).sort(function (a, b) {
                var x = familyOrder.indexOf(a.family), y = familyOrder.indexOf(b.family);
                return (x === -1 ? 99 : x) - (y === -1 ? 99 : y);
            }).forEach(function (u) { out.appendChild(line(u.text, u.ok ? null : "cc-attn")); });
            out.appendChild(line("Radar heartbeat: " + (d.radar_status.length ? d.radar_status.map(function (r) {
                return r.source + " last tick " + when(r.last_tick_finished_at) + " · " + (r.last_outcome || "no outcome") + (r.last_error ? " (error: " + r.last_error + ")" : "");
            }).join("; ") : "the radar has not recorded a tick")));
            var ny = section("needs_you"), held = ny.data && ny.data.email_sender && Array.isArray(ny.data.email_sender.blocked_by) ? ny.data.email_sender.blocked_by : [];
            if (held.length) {
                out.appendChild(line("Email sending: held (" + held.map(function (r) { return SENDER_SHORT[r] || r; }).join("; ") + ")", "cc-attn"));
            }
            var verdictOf = {};
            d.jobs_on_time.forEach(function (v) { verdictOf[v.job_name] = v; });
            var all = list(d.job_runs, function (j) {
                var v = verdictOf[j.job_name] || {};
                var li = el("li");
                li.appendChild(el("strong", null, j.job_name));
                words(li, " " + (v.cadence || "no schedule") + " · " + (v.on_time === true ? "on time" : "needs attention" + (v.reason ? ": " + v.reason : "")) +
                    " · last ran " + (j.last_run_on || "never") + (j.last_error ? " · " + j.last_error : ""));
                return li;
            });
            all.id = "ccAllJobs";
            out.appendChild(toggle("Show all jobs (" + d.job_runs.length + ")", all));
            out.appendChild(all);
        }

        var DRAW = { command: drawCommand, plans: drawPlans, activity: drawActivity, autopilot: drawAutopilot, outbound: drawOutbound, system: drawSystem };
        function draw(name) {
            if (drawn[name] || !DRAW[name]) { return; }
            if (body === null && failure === null) { return; }
            drawn[name] = true;
            DRAW[name]();
        }
        var deck = $("ccDeck");
        if (deck && window.BFTabs) {
            ctl = window.BFTabs.create({
                root: deck,
                tabs: CC_TABS,
                attr: "data-cc-tab",
                tabId: function (n) { return "ccTab-" + n; },
                panelId: function (n) { return "ccPanel-" + n; },
                hash: function (n) { return "#cc-" + n; },
                nameOf: function (h) { var m = /^cc-([a-z]+)$/.exec(h); return m ? m[1] : null; },
                storage: { kind: "session", key: "bf_cc_tab" },
                fallback: "command",
                onSelect: draw,
                // An in-page link to an element inside a tab opens that tab.
                extraRoute: function (h, api) {
                    var target = null;
                    try { target = document.getElementById(decodeURIComponent(h)); } catch (e) { target = null; }
                    var holder = target ? api.tabHolding(target) : null;
                    if (!holder) { return false; }
                    api.select(holder, { hash: false });
                    if (target.scrollIntoView) { target.scrollIntoView({ block: "start" }); }
                    return true;
                }
            });
            ctl.route();
        }
        function redraw() { drawn = {}; if (ctl && ctl.current()) { draw(ctl.current()); } }
        return {
            got: function (b) { body = b; failure = null; redraw(); },
            failed: function (message) { body = null; failure = message; redraw(); },
            tabs: function () { return ctl; }
        };
    })();
    /* ══ end CC-TABS ══ */

    var RENDER = { needs_you: renderNeedsYou, plans: renderPlans, activity: renderActivity, autopilot: renderAutopilot, outbound: renderOutbound, spend: renderSpend };

    function renderSection(name, section) {
        if (!section || typeof section !== "object") {
            setPanel(PANELS[name], errorBox("the answer did not include this section"));
        } else if (section.ok !== true) {
            setPanel(PANELS[name], errorBox(section.error || "the server gave no reason"));
        } else {
            setPanel(PANELS[name], RENDER[name](section.data));
        }
    }

    function renderAll(body, only) {
        // The dashboard's tabs (CC-TABS above) draw from the whole answer, whatever was asked for.
        if (tabbed) {
            tabbed.got(body);
            var stamp = document.getElementById("ccStatus");
            if (stamp) { stamp.textContent = "Read " + when(body.generated_at); }
            announce(body);
            return;
        }
        Object.keys(PANELS).forEach(function(name) {
            if (!only || only === name) { renderSection(name, body[name]); }
        });
        if (only) { return; }
        var platformPanel = document.getElementById("ccPlatformPanel");
        if (Object.prototype.hasOwnProperty.call(body, "platform")) {
            var p = body.platform;
            setPanel("ccPlatform", !p || p.ok !== true ? errorBox((p && p.error) || "the server gave no reason") : renderPlatform(p.data));
            if (platformPanel) { platformPanel.style.display = ""; }
        } else if (platformPanel) {
            platformPanel.style.display = "none";
        }
        var status = document.getElementById("ccStatus");
        if (status) { status.textContent = "Read " + when(body.generated_at); }
        announce(body);
    }

    function failAll(message, only) {
        if (tabbed) {
            tabbed.failed(message);
            var stamp = document.getElementById("ccStatus");
            if (stamp) { stamp.textContent = "Not loaded"; }
            announce({ error: message });
            return;
        }
        Object.keys(PANELS).forEach(function(name) {
            if (!only || only === name) { setPanel(PANELS[name], errorBox(message)); }
        });
        if (only) { return; }
        var platformPanel = document.getElementById("ccPlatformPanel");
        if (platformPanel) { platformPanel.style.display = "none"; }
        var status = document.getElementById("ccStatus");
        if (status) { status.textContent = "Not loaded"; }
        announce({ error: message });
    }

    function load(only) {
        var token = localStorage.getItem("bf_token");
        if (!token) {
            failAll("you are not signed in", only);
            return Promise.resolve();
        }
        var status = document.getElementById("ccStatus");
        if (status && !only) { status.textContent = "Loading…"; }
        return fetch(CC_API + "/api/command-center", { headers: { "Authorization": "Bearer " + token } })
            .then(function(r) {
                return r.text().then(function(text) {
                    var body = null;
                    try { body = JSON.parse(text); } catch (e) { body = null; }
                    if (!r.ok || !body || typeof body !== "object") {
                        throw new Error((body && body.error) || ("HTTP " + r.status));
                    }
                    return body;
                });
            })
            .then(function(body) { renderAll(body, only); })
            .catch(function(err) { failAll((err && err.message) || "the request failed", only); });
    }

    function dispatch(planId, assignmentId, button) {
        var key = planId + "#" + assignmentId;
        var token = localStorage.getItem("bf_token");
        button.disabled = true;
        button.textContent = "Dispatching…";
        dispatchAnswers[key] = { pending: true };
        return fetch(CC_API + "/api/assignments/dispatch", {
            method: "POST",
            headers: { "Authorization": "Bearer " + (token || ""), "Content-Type": "application/json" },
            body: JSON.stringify({ executive_task_id: planId, assignment_id: assignmentId })
        })
            .then(function(r) {
                return r.text().then(function(text) { dispatchAnswers[key] = { status: r.status, text: text }; });
            })
            .catch(function(err) { dispatchAnswers[key] = { error: (err && err.message) || "the request failed" }; })
            .then(function() { return load("plans"); });
    }

    var section = document.getElementById("commandCenterSection");
    if (section) {
        section.addEventListener("click", function(event) {
            var button = event.target && event.target.closest ? event.target.closest("[data-cc-dispatch]") : null;
            if (!button || button.disabled) { return; }
            dispatch(button.getAttribute("data-plan"), Number(button.getAttribute("data-assignment")), button);
        });
    }
    var refresh = document.getElementById("ccRefresh");
    if (refresh) { refresh.addEventListener("click", function() { load(); }); }
    window.BFCommandCenter = { load: load };
    load();
})();

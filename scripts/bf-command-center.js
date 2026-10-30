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
    style.textContent = ".cc-grid{display:flex;flex-direction:column;gap:14px}\n.cc-panel h3{font-size:.78rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9fb3ff;margin-bottom:10px}\n.cc-panel ul{list-style:none;display:flex;flex-direction:column;gap:6px}\n.cc-panel li{font-size:.86rem;color:#dfe6ff;line-height:1.5}\n.cc-panel a{color:#67e8f9}\n.cc-muted{color:#8892b8;font-size:.8rem}\n.cc-sub{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8892b8;margin:10px 0 6px}\n.cc-error{padding:10px 12px;border-radius:10px;border:1px solid rgba(248,113,113,.4);background:rgba(248,113,113,.08);color:#fca5a5;font-size:.84rem;line-height:1.5}\n.cc-clear{color:#6ee7b7;font-weight:700}\n.cc-plan{padding:12px;border-radius:12px;border:1px solid rgba(0,229,255,.16);background:rgba(8,8,18,.6);margin-bottom:10px}\n.cc-plan-head{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin-bottom:8px}\n.cc-assignment{padding:8px 0;border-top:1px solid rgba(0,229,255,.1)}\n.cc-state{font-size:.8rem;color:#c9d4ff;margin-top:4px}\n.cc-answer{margin-top:6px;padding:8px 10px;border-radius:8px;background:#05070f;border:1px solid rgba(168,85,247,.3);color:#e9d5ff;font-size:.76rem;white-space:pre-wrap;overflow-wrap:anywhere}\n";
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

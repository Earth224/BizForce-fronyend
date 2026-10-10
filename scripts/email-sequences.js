/* ══════════════════════════════════════════════════════════════════════════
   Email sequences on the email agent's page.

   Two things, both against the backend's own routes and nothing else:

   FILING. Under a completed email/sequence result, a form that files it for
   approval: POST /api/agents/email/propose-sequence with the result's task_id,
   a name (1-100) and an optional brand. The steps are never sent from here —
   the server reads them from the stored run. Only the owner (admin) account
   may file, so the form is drawn only when /api/auth/me says role "admin";
   anyone else gets one quiet line. agent-profile.js hands each tool result to
   window.bfAfterToolResult, which is how the form lands under it.

   THE PANEL. GET /api/email/sequences: the sender's state first, then each
   sequence. Tapping one loads GET /api/email/sequences/:id. Pause, Resume and
   Cancel post to /api/email/sequences/:id/status and appear only where the
   server allows the move; Cancel asks first, inline.

   THE FAILURES MUST NOT LOOK LIKE ANSWERS. "No sequences yet" is printed only
   for a sequences array that is really empty. A failed or unreadable load is an
   error panel saying nothing could be loaded. A sender flag that is not
   exactly true is reported as not set — never assumed on. Every server message
   is shown as the server wrote it, escaped.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";

  function tok() { return localStorage.getItem("bf_token") || ""; }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isPlainObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  // { ok, status, data, parsed }. A network failure rejects.
  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + tok() } };
    if (body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().then(
        function (d) { return { ok: r.ok, status: r.status, data: d, parsed: true }; },
        function () { return { ok: r.ok, status: r.status, data: {}, parsed: false }; }
      );
    });
  }

  // The server's own message, unchanged; a bare status only when it sent none.
  function serverMessage(res) {
    return (res && res.data && typeof res.data.error === "string" && res.data.error) || ("HTTP " + (res && res.status));
  }

  // The viewer's local time. A value that is not a date is shown as written.
  function fmtLocal(iso) {
    if (iso == null || iso === "") return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return esc(iso);
    return esc(d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
  }

  function fmtLocalDate(iso) {
    if (iso == null || iso === "") return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return esc(iso);
    return esc(d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
  }

  /* ── who may file ──────────────────────────────────────────────────────── */
  // true, false, or a rejection when /api/auth/me could not be read: an
  // unknown is never shown as "not the owner".
  var mePromise = null;
  function isAdmin() {
    if (!mePromise) {
      mePromise = api("GET", "/api/auth/me").then(function (res) {
        if (!res.ok || !res.parsed || !isPlainObject(res.data) || !isPlainObject(res.data.user)) {
          throw new Error(serverMessage(res));
        }
        return res.data.user.role === "admin";
      });
      mePromise.catch(function () { mePromise = null; });
    }
    return mePromise;
  }

  /* ── filing ────────────────────────────────────────────────────────────── */
  var NOT_OWNER_LINE = "Sequences can be filed by the owner account until subscribers can verify their own sending domain.";

  function filingFormMarkup(taskId) {
    return '<div class="es-file" data-es-task="' + esc(taskId) + '">' +
        '<div class="es-label">File this sequence for approval</div>' +
        '<p class="es-quiet">Nothing is sent by filing. Approving it on the proposals page enrolls your confirmed contacts.</p>' +
        '<input type="text" class="ap-select es-name" maxlength="100" placeholder="Sequence name (required, up to 100 characters)">' +
        '<input type="text" class="ap-select es-brand" maxlength="100" placeholder="Brand (optional — only contacts of this brand)">' +
        '<button type="button" class="ap-btn" data-es-file>File for approval</button>' +
        '<div class="ap-msg es-file-msg"></div>' +
      '</div>';
  }

  function notOwnerMarkup() {
    return '<div class="es-file"><p class="es-quiet">' + esc(NOT_OWNER_LINE) + '</p></div>';
  }

  function filedMarkup(data) {
    var a = isPlainObject(data && data.audience_now) ? data.audience_now : {};
    var count = typeof a.confirmed_contacts === "number" ? String(a.confirmed_contacts) : "not reported";
    return '<div class="es-filed">' +
        '<div class="es-label">Filed for approval</div>' +
        '<div>Confirmed contacts right now: <strong>' + esc(count) + '</strong></div>' +
        (typeof a.note === "string" ? '<p class="es-quiet">' + esc(a.note) + '</p>' : '') +
        '<a href="/proposals.html" class="es-link">Review it on the proposals page</a>' +
      '</div>';
  }

  // Draws, under a completed sequence result, the form or the line that
  // replaces it. `slot` is the element it is drawn into.
  function drawFiling(slot, data) {
    if (!slot) return Promise.resolve();
    if (!data || typeof data.task_id !== "string" || !data.task_id) {
      slot.innerHTML = '<div class="es-file"><p class="es-quiet">This run carried no task id, so it cannot be filed.</p></div>';
      return Promise.resolve();
    }
    if (data.persisted === false) {
      slot.innerHTML = '<div class="es-file"><p class="es-quiet">This run was not saved to Task History, so it cannot be filed. Run it again to file it.</p></div>';
      return Promise.resolve();
    }
    slot.innerHTML = '<div class="es-file"><p class="es-quiet">Checking whether this account can file sequences…</p></div>';
    return isAdmin().then(function (admin) {
      slot.innerHTML = admin ? filingFormMarkup(data.task_id) : notOwnerMarkup();
    }, function (err) {
      slot.innerHTML = '<div class="es-file"><div class="ap-msg err">Whether this account can file sequences could not be checked — reload to try again. (' +
        esc((err && err.message) || "unknown error") + ')</div></div>';
    });
  }

  // Files it. Resolves with the markup drawn into msgEl's place.
  function fileSequence(taskId, name, brand, msgEl, formEl) {
    var trimmed = String(name == null ? "" : name).trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      msgEl.textContent = "Give the sequence a name, 1 to 100 characters.";
      msgEl.className = "ap-msg es-file-msg err";
      return Promise.resolve(false);
    }
    var body = { task_id: taskId, name: trimmed };
    var b = String(brand == null ? "" : brand).trim();
    if (b) body.brand = b;
    msgEl.textContent = "Filing…";
    msgEl.className = "ap-msg es-file-msg";
    return api("POST", "/api/agents/email/propose-sequence", body).then(function (res) {
      if (!res.ok) {
        msgEl.textContent = serverMessage(res);
        msgEl.className = "ap-msg es-file-msg err";
        return false;
      }
      if (!res.parsed || !isPlainObject(res.data)) {
        msgEl.textContent = "The answer could not be read, so whether it was filed is unknown. Check the proposals page before filing again.";
        msgEl.className = "ap-msg es-file-msg err";
        return false;
      }
      if (formEl) formEl.innerHTML = filedMarkup(res.data);
      return true;
    }, function (err) {
      msgEl.textContent = (err && err.message) || "That could not be filed.";
      msgEl.className = "ap-msg es-file-msg err";
      return false;
    });
  }

  window.bfAfterToolResult = function (agentType, toolId, data, resultEl) {
    if (agentType !== "email" || toolId !== "sequence" || !resultEl || !data || data.success !== true) return;
    var slot = document.createElement("div");
    slot.className = "es-file-slot";
    resultEl.appendChild(slot);
    drawFiling(slot, data);
  };

  /* ── the sender ────────────────────────────────────────────────────────── */
  // Booleans and the cap only; the server sends no value and none is shown.
  // A flag that is not exactly true is reported as not set.
  function senderMarkup(sender) {
    if (!isPlainObject(sender)) {
      return '<div class="es-sender"><div class="ap-msg err">The sender\'s state was not reported, so whether anything is being sent is unknown.</div></div>';
    }
    var capOk = typeof sender.daily_cap === "number" && sender.daily_cap > 0 && Math.floor(sender.daily_cap) === sender.daily_cap;
    var blockers = [];
    if (sender.enabled !== true) blockers.push("The sender is switched off on the server.");
    if (sender.postal_address_set !== true) blockers.push("No postal address is set, and marketing email must carry one.");
    if (!capOk) blockers.push("The daily cap could not be read, so nothing is sent rather than guessing a limit.");
    var lines = [];
    if (blockers.length) {
      lines.push('<div class="es-sender-head es-off">Nothing is being sent:</div>');
      blockers.forEach(function (t) { lines.push('<div class="es-reason" data-es-reason>' + esc(t) + '</div>'); });
    } else {
      lines.push('<div class="es-sender-head es-on">Sending is on. Daily cap: ' + esc(String(sender.daily_cap)) + ' marketing emails per 24 hours.</div>');
    }
    if (sender.webhook_secret_set !== true) {
      lines.push('<div class="es-reason" data-es-reason>The webhook secret is not set, so bounces and complaints are not being recorded and cannot stop later sends.</div>');
    }
    return '<div class="es-sender">' + lines.join("") + '</div>';
  }

  /* ── the list ──────────────────────────────────────────────────────────── */
  var STATUS_MOVES = { active: ["paused", "cancelled"], paused: ["active", "cancelled"] };
  var MOVE_LABELS = { paused: "Pause", active: "Resume", cancelled: "Cancel" };
  var STOP_LABELS = {
    suppressed: "bounced or complained",
    no_consent: "no consent",
    not_confirmed: "consent not confirmed",
    cancelled_by_owner: "cancelled by you",
    unknown: "reason not recorded"
  };

  function stopLabel(reason) {
    return Object.prototype.hasOwnProperty.call(STOP_LABELS, reason) ? STOP_LABELS[reason] : String(reason);
  }

  function countsLine(counts) {
    if (!isPlainObject(counts)) return "not reported";
    var keys = Object.keys(counts);
    if (!keys.length) return "none";
    return keys.map(function (k) { return esc(k) + " " + esc(String(counts[k])); }).join(" · ");
  }

  function stoppedLine(byReason) {
    if (!isPlainObject(byReason)) return "";
    var keys = Object.keys(byReason);
    if (!keys.length) return "";
    return '<div class="es-row-line">Stopped: ' +
      keys.map(function (k) { return esc(stopLabel(k)) + " " + esc(String(byReason[k])); }).join(" · ") + '</div>';
  }

  function actionsMarkup(seq) {
    var moves = Object.prototype.hasOwnProperty.call(STATUS_MOVES, seq.status) ? STATUS_MOVES[seq.status] : [];
    if (!moves.length) return "";
    return '<div class="es-actions" data-es-actions="' + esc(seq.id) + '">' +
      moves.map(function (to) {
        return '<button type="button" class="es-btn' + (to === "cancelled" ? " es-btn-danger" : "") + '" data-es-move="' + esc(to) + '" data-es-id="' + esc(seq.id) + '">' +
          esc(MOVE_LABELS[to]) + '</button>';
      }).join("") +
      '<div class="ap-msg es-action-msg"></div>' +
    '</div>';
  }

  function cancelConfirmMarkup(id) {
    return '<div class="es-confirm">' +
        '<div>Cancelling stops every remaining send in this sequence and cannot be undone.</div>' +
        '<button type="button" class="es-btn es-btn-danger" data-es-confirm-cancel data-es-id="' + esc(id) + '">Yes, cancel it</button>' +
        '<button type="button" class="es-btn" data-es-keep data-es-id="' + esc(id) + '">Keep it</button>' +
      '</div>' +
      '<div class="ap-msg es-action-msg"></div>';
  }

  function sequenceRowMarkup(seq) {
    return '<div class="es-row" data-es-row="' + esc(seq.id) + '">' +
        '<button type="button" class="es-open" data-es-open="' + esc(seq.id) + '">' +
          '<span class="es-name">' + esc(seq.name) + '</span>' +
          '<span class="es-status es-status-' + esc(seq.status) + '">' + esc(seq.status) + '</span>' +
        '</button>' +
        '<div class="es-row-line">Brand: ' + esc(seq.brand == null || seq.brand === "" ? "all brands" : seq.brand) +
          ' · Steps: ' + esc(String(seq.step_count)) + ' · Approved: ' + fmtLocalDate(seq.approved_at) + '</div>' +
        '<div class="es-row-line">Contacts: ' + countsLine(seq.enrollments) + '</div>' +
        '<div class="es-row-line">Next send: ' + (seq.next_send_at ? fmtLocal(seq.next_send_at) : "none scheduled") + '</div>' +
        stoppedLine(seq.stopped_by_reason) +
        actionsMarkup(seq) +
      '</div>';
  }

  function listMarkup(sequences) {
    if (sequences.length === 0) return '<p class="es-quiet es-empty">No sequences yet.</p>';
    return sequences.map(sequenceRowMarkup).join("");
  }

  function loadFailMarkup(what, detail) {
    return '<div class="ap-load-fail es-load-fail"><div class="ap-msg err">' + esc(what) +
      ' could not be loaded — nothing here is a claim about what exists. Reload to try again.' +
      (detail ? ' (' + esc(detail) + ')' : '') + '</div>' +
      '<button type="button" class="ap-btn" data-es-retry>Try again</button></div>';
  }

  /* ── the detail ────────────────────────────────────────────────────────── */
  function positionText(row, stepCount) {
    var n = typeof row.next_step === "number" ? row.next_step : null;
    if (n === null) return "position not reported";
    if (row.status === "completed" || n >= stepCount) return "all " + stepCount + " sent";
    return "next: step " + (n + 1) + " of " + stepCount;
  }

  function detailMarkup(seq) {
    var steps = Array.isArray(seq.steps) ? seq.steps : [];
    var rows = Array.isArray(seq.enrollments) ? seq.enrollments : null;
    var stepsHtml = steps.length
      ? '<ol class="es-steps">' + steps.map(function (s) {
          return '<li><span class="es-day">' + esc(s.delay_days == null ? "?" : String(s.delay_days)) + ' day(s) after the previous</span> ' +
            '<span class="es-subject">' + esc(s.subject) + '</span>' +
            (s.purpose ? ' <span class="es-quiet">— ' + esc(s.purpose) + '</span>' : '') + '</li>';
        }).join("") + '</ol>'
      : '<p class="es-quiet">No steps were reported.</p>';
    var contactsHtml = rows === null
      ? '<div class="ap-msg err">The contacts in this sequence were not reported.</div>'
      : rows.length === 0
        ? '<p class="es-quiet">No contacts are enrolled.</p>'
        : '<table class="es-table"><thead><tr><th>Contact</th><th>Position</th><th>Status</th><th>Reason</th><th>Next send</th><th>Last sent</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td>' + esc(r.contact_name || "") + (r.contact_email ? ' <span class="es-quiet">' + esc(r.contact_email) + '</span>' : '') + '</td>' +
              '<td>' + esc(positionText(r, steps.length)) + '</td>' +
              '<td>' + esc(r.status) + '</td>' +
              '<td>' + (r.stop_reason ? esc(stopLabel(r.stop_reason)) : "—") + '</td>' +
              '<td>' + fmtLocal(r.next_send_at) + '</td>' +
              '<td>' + fmtLocal(r.last_sent_at) + '</td></tr>';
          }).join("") + '</tbody></table>';
    return '<div class="es-detail-card">' +
        '<div class="es-label">' + esc(seq.name) + ' <span class="es-status es-status-' + esc(seq.status) + '">' + esc(seq.status) + '</span></div>' +
        '<div class="es-label-sm">Steps</div>' + stepsHtml +
        '<div class="es-label-sm">Contacts</div>' + contactsHtml +
      '</div>';
  }

  /* ── loading and the moves ─────────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  var openId = null;

  function loadSequences() {
    var sender = el("esSender"), list = el("esList");
    if (!list) return Promise.resolve();
    if (!tok()) {
      if (sender) sender.innerHTML = "";
      list.innerHTML = '<p class="es-quiet">Sign in to see your sequences.</p>';
      return Promise.resolve();
    }
    list.innerHTML = '<p class="es-quiet">Loading sequences…</p>';
    return api("GET", "/api/email/sequences").then(function (res) {
      if (!res.ok || !res.parsed || !isPlainObject(res.data) || !Array.isArray(res.data.sequences)) {
        if (sender) sender.innerHTML = "";
        list.innerHTML = loadFailMarkup("Your sequences", res.ok ? "the answer could not be read" : serverMessage(res));
        return;
      }
      if (sender) sender.innerHTML = senderMarkup(res.data.sender);
      list.innerHTML = listMarkup(res.data.sequences);
    }, function (err) {
      if (sender) sender.innerHTML = "";
      list.innerHTML = loadFailMarkup("Your sequences", (err && err.message) || "network error");
    });
  }

  function loadDetail(id) {
    var detail = el("esDetail");
    if (!detail) return Promise.resolve();
    openId = id;
    detail.innerHTML = '<p class="es-quiet">Loading the sequence…</p>';
    return api("GET", "/api/email/sequences/" + encodeURIComponent(id)).then(function (res) {
      if (openId !== id) return;
      if (!res.ok || !res.parsed || !isPlainObject(res.data) || !isPlainObject(res.data.sequence)) {
        detail.innerHTML = loadFailMarkup("This sequence", res.ok ? "the answer could not be read" : serverMessage(res));
        return;
      }
      detail.innerHTML = detailMarkup(res.data.sequence);
    }, function (err) {
      if (openId !== id) return;
      detail.innerHTML = loadFailMarkup("This sequence", (err && err.message) || "network error");
    });
  }

  function setStatus(id, status, msgEl) {
    if (msgEl) { msgEl.textContent = "Saving…"; msgEl.className = "ap-msg es-action-msg"; }
    return api("POST", "/api/email/sequences/" + encodeURIComponent(id) + "/status", { status: status }).then(function (res) {
      if (!res.ok) {
        if (msgEl) { msgEl.textContent = serverMessage(res); msgEl.className = "ap-msg es-action-msg err"; }
        return false;
      }
      var reloads = [loadSequences()];
      if (openId === id) reloads.push(loadDetail(id));
      return Promise.all(reloads).then(function () { return true; });
    }, function (err) {
      if (msgEl) { msgEl.textContent = (err && err.message) || "That could not be saved."; msgEl.className = "ap-msg es-action-msg err"; }
      return false;
    });
  }

  // Cancel never posts on the first tap: it swaps in the confirmation.
  function askCancel(actionsEl, id) {
    if (actionsEl) actionsEl.innerHTML = cancelConfirmMarkup(id);
  }

  function onClick(e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var b;
    if ((b = t.closest("[data-es-file]"))) {
      var form = b.closest(".es-file");
      if (!form) return;
      fileSequence(form.getAttribute("data-es-task"), form.querySelector(".es-name").value,
        form.querySelector(".es-brand").value, form.querySelector(".es-file-msg"), form);
      return;
    }
    if ((b = t.closest("[data-es-move]"))) {
      var to = b.getAttribute("data-es-move"), id = b.getAttribute("data-es-id");
      var actions = b.closest(".es-actions");
      if (to === "cancelled") { askCancel(actions, id); return; }
      setStatus(id, to, actions && actions.querySelector(".es-action-msg"));
      return;
    }
    if ((b = t.closest("[data-es-confirm-cancel]"))) {
      var box = b.closest(".es-actions");
      setStatus(b.getAttribute("data-es-id"), "cancelled", box && box.querySelector(".es-action-msg"));
      return;
    }
    if ((b = t.closest("[data-es-keep]"))) {
      loadSequences();
      return;
    }
    if ((b = t.closest("[data-es-open]"))) {
      loadDetail(b.getAttribute("data-es-open"));
      return;
    }
    if ((b = t.closest("[data-es-retry]"))) {
      b.disabled = true;
      if (b.closest("#esDetail") && openId) loadDetail(openId); else loadSequences();
    }
  }

  var STYLE = [
    ".es-file{margin-top:14px;padding:14px;border:1px solid rgba(251,191,36,.25);border-radius:12px;background:rgba(251,191,36,.04)}",
    ".es-file .ap-select{display:block;width:100%;margin:6px 0;box-sizing:border-box}",
    ".es-label{font-weight:700;color:#e6edf3;margin-bottom:6px}",
    ".es-label-sm{font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:#8892b8;margin:12px 0 6px}",
    ".es-quiet{color:#8892b8;font-size:.82rem;margin:4px 0}",
    ".es-filed{display:grid;gap:6px}",
    ".es-link{color:#22d3ee}",
    ".es-sender{margin-bottom:14px}",
    ".es-sender-head{font-weight:700;margin-bottom:4px}",
    ".es-on{color:#34d399}.es-off{color:#fbbf24}",
    ".es-reason{color:#fbbf24;font-size:.84rem;margin:2px 0}",
    ".es-row{padding:12px 0;border-top:1px solid rgba(255,255,255,.08)}",
    ".es-open{display:flex;gap:10px;align-items:center;background:none;border:none;color:#e6edf3;font:inherit;font-weight:700;cursor:pointer;padding:0}",
    ".es-status{font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.2);color:#8892b8}",
    ".es-status-active{color:#34d399;border-color:rgba(52,211,153,.4)}.es-status-paused{color:#fbbf24;border-color:rgba(251,191,36,.4)}",
    ".es-row-line{font-size:.82rem;color:#8892b8;margin-top:3px}",
    ".es-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}",
    ".es-btn{padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#e6edf3;cursor:pointer;font:inherit;font-size:.8rem}",
    ".es-btn-danger{border-color:rgba(248,113,113,.5);color:#f87171}",
    ".es-confirm{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#f87171;font-size:.84rem}",
    ".es-steps{margin:0;padding-left:20px;font-size:.84rem;color:#e6edf3}",
    ".es-day{color:#8892b8}",
    ".es-table{width:100%;border-collapse:collapse;font-size:.8rem}",
    ".es-table th,.es-table td{text-align:left;padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top}",
    ".es-detail-card{margin-top:14px;padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:12px}"
  ].join("\n");

  function mountPanel() {
    var page = document.querySelector(".page");
    if (!page) return;
    var style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    var section = document.createElement("div");
    section.className = "ap-section";
    section.id = "esPanel";
    section.innerHTML =
      '<div class="ap-card">' +
        '<h2 class="ap-section-label">Email sequences</h2>' +
        '<div id="esSender"></div>' +
        '<div id="esList"></div>' +
        '<div id="esDetail"></div>' +
      '</div>';
    page.appendChild(section);
    document.addEventListener("click", onClick);
    loadSequences();
  }

  // For scripts/checkEmailSequencesPage.js in the backend repo, which runs this
  // file in a stubbed page. Nothing on the page reads it.
  window.bfEmailSequences = {
    senderMarkup: senderMarkup, listMarkup: listMarkup, detailMarkup: detailMarkup,
    filingFormMarkup: filingFormMarkup, drawFiling: drawFiling, fileSequence: fileSequence,
    loadSequences: loadSequences, loadDetail: loadDetail, setStatus: setStatus, onClick: onClick,
    NOT_OWNER_LINE: NOT_OWNER_LINE
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountPanel);
  else mountPanel();
})();

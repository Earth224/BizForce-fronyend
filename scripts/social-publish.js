/* ══════════════════════════════════════════════════════════════════════════
   Filing a Bluesky post for approval, on the social agent's page.

   Under a completed Bluesky social/post result, one button that files it:
   POST /api/agents/social/propose-post with the result's task_id and nothing
   else — the text is never sent from here; the server reads it from the
   stored run. Approving the proposal on the proposals page publishes it from
   the platform's own Bluesky account, so only the owner (admin) may file: the
   button is drawn only when /api/auth/me says role "admin", and anyone else
   gets one quiet line. A /api/auth/me that cannot be read is an error — never
   the button, never the line.

   agent-profile.js hands each tool result to window.bfAfterToolResult, the
   hook email-sequences.js uses too. This wraps whatever hook is already there
   rather than replacing it. Every server message is shown as the server wrote
   it, escaped.
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
  var NOT_OWNER_LINE = "Posts go out from the platform's own Bluesky account, so only the owner can file them.";

  function filingFormMarkup(taskId) {
    return '<div class="sp-file" data-sp-task="' + esc(taskId) + '">' +
        '<div class="sp-label">File this post for approval</div>' +
        '<p class="sp-quiet">Nothing is posted by filing. Approving it on the proposals page posts exactly this text to Bluesky.</p>' +
        '<button type="button" class="ap-btn" data-sp-file>File for approval</button>' +
        '<div class="ap-msg sp-file-msg"></div>' +
      '</div>';
  }

  function notOwnerMarkup() {
    return '<div class="sp-file"><p class="sp-quiet">' + esc(NOT_OWNER_LINE) + '</p></div>';
  }

  function filedMarkup(data) {
    return '<div class="sp-filed">' +
        '<div class="sp-label">Filed for approval</div>' +
        (typeof data.note === "string" ? '<p class="sp-quiet sp-note">' + esc(data.note) + '</p>' : '') +
        '<a href="/proposals.html" class="sp-link">Review it on the proposals page</a>' +
      '</div>';
  }

  // Draws, under a completed Bluesky post result, the button or the line that
  // replaces it. `slot` is the element it is drawn into.
  function drawFiling(slot, data) {
    if (!slot) return Promise.resolve();
    if (!data || typeof data.task_id !== "string" || !data.task_id) {
      slot.innerHTML = '<div class="sp-file"><p class="sp-quiet">This run carried no task id, so it cannot be filed.</p></div>';
      return Promise.resolve();
    }
    if (data.persisted === false) {
      slot.innerHTML = '<div class="sp-file"><p class="sp-quiet">This run was not saved to Task History, so it cannot be filed. Run it again to file it.</p></div>';
      return Promise.resolve();
    }
    slot.innerHTML = '<div class="sp-file"><p class="sp-quiet">Checking whether this account can file posts…</p></div>';
    return isAdmin().then(function (admin) {
      slot.innerHTML = admin ? filingFormMarkup(data.task_id) : notOwnerMarkup();
    }, function (err) {
      slot.innerHTML = '<div class="sp-file"><div class="ap-msg err">Whether this account can file posts could not be checked — reload to try again. (' +
        esc((err && err.message) || "unknown error") + ')</div></div>';
    });
  }

  // Files it. Only the task_id is sent.
  function filePost(taskId, msgEl, formEl, button) {
    if (button) button.disabled = true;
    msgEl.textContent = "Filing…";
    msgEl.className = "ap-msg sp-file-msg";
    return api("POST", "/api/agents/social/propose-post", { task_id: taskId }).then(function (res) {
      if (!res.ok) {
        msgEl.textContent = serverMessage(res);
        msgEl.className = "ap-msg sp-file-msg err";
        if (button) button.disabled = false;
        return false;
      }
      if (!res.parsed || !isPlainObject(res.data)) {
        msgEl.textContent = "The answer could not be read, so whether it was filed is unknown. Check the proposals page before filing again.";
        msgEl.className = "ap-msg sp-file-msg err";
        return false;
      }
      if (formEl) formEl.innerHTML = filedMarkup(res.data);
      return true;
    }, function (err) {
      msgEl.textContent = (err && err.message) || "That could not be filed.";
      msgEl.className = "ap-msg sp-file-msg err";
      if (button) button.disabled = false;
      return false;
    });
  }

  var priorHook = window.bfAfterToolResult;
  window.bfAfterToolResult = function (agentType, toolId, data, resultEl) {
    if (typeof priorHook === "function") priorHook.apply(this, arguments);
    if (agentType !== "social" || toolId !== "post" || !resultEl || !data || data.success !== true || data.platform !== "bluesky") return;
    var slot = document.createElement("div");
    slot.className = "sp-file-slot";
    resultEl.appendChild(slot);
    drawFiling(slot, data);
  };

  function onClick(e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var b = t.closest("[data-sp-file]");
    if (!b) return;
    var form = b.closest(".sp-file");
    if (!form) return;
    filePost(form.getAttribute("data-sp-task"), form.querySelector(".sp-file-msg"), form, b);
  }

  var STYLE = [
    ".sp-file,.sp-filed{margin-top:14px;padding:14px;border:1px solid rgba(244,114,182,.25);border-radius:12px;background:rgba(244,114,182,.04)}",
    ".sp-filed{display:grid;gap:6px}",
    ".sp-label{font-weight:700;color:#e6edf3;margin-bottom:6px}",
    ".sp-quiet{color:#8892b8;font-size:.82rem;margin:4px 0}",
    ".sp-link{color:#22d3ee}"
  ].join("\n");

  function mount() {
    var style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    document.addEventListener("click", onClick);
  }

  // For scripts/checkSocialPublishPage.js in the backend repo, which runs this
  // file in a stubbed page. Nothing on the page reads it.
  window.bfSocialPublish = {
    drawFiling: drawFiling, filePost: filePost, filingFormMarkup: filingFormMarkup, onClick: onClick,
    NOT_OWNER_LINE: NOT_OWNER_LINE
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

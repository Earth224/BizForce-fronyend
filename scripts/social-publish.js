/* ══════════════════════════════════════════════════════════════════════════
   Filing a Bluesky post for approval, on the social agent's page.

   Under a completed Bluesky social/post result, one button that files it:
   POST /api/agents/social/propose-post with the result's task_id and nothing
   else — the text is never sent from here; the server reads it from the
   stored run.

   WHOSE ACCOUNT. A member who connected Bluesky above (scripts/bluesky-connect.js)
   files posts that go out from their own account, and the button says "Posts
   as @handle". Without a connection only the owner (admin) may file, and the
   owner's post goes out from the platform's own account; anyone else gets one
   quiet line. A connection that needs reconnecting gets a line saying so.
   GET /api/social/bluesky/status (then /api/auth/me when not connected) is
   the source; one that cannot be read is an error — never the button, never
   the line.

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

  /* ── whose account a filed post goes out from ───────────────────────────── */
  // { kind: "member", handle, automatic } | { kind: "needs_reconnect", handle } |
  // { kind: "platform" } | { kind: "none" }, or a rejection when it could not be read.
  var accountPromise = null;
  function postingAccount() {
    if (!accountPromise) {
      accountPromise = api("GET", "/api/social/bluesky/status").then(function (res) {
        if (!res.ok || !res.parsed || !isPlainObject(res.data)) throw new Error(serverMessage(res));
        var st = res.data;
        if (st.connected === true && st.status === "connected") {
          return api("GET", "/api/social/bluesky/automation").then(function (a) {
            if (!a.ok || !a.parsed || !isPlainObject(a.data)) throw new Error(serverMessage(a));
            return { kind: "member", handle: String(st.handle || ""), automatic: a.data.auto_post === true };
          });
        }
        if (st.status === "needs_reconnect") return { kind: "needs_reconnect", handle: String(st.handle || "") };
        return isAdmin().then(function (admin) { return { kind: admin ? "platform" : "none" }; });
      });
      accountPromise.catch(function () { accountPromise = null; });
    }
    return accountPromise;
  }
  // The connect card calls this after connecting, disconnecting or a setting change.
  function forgetAccount() { accountPromise = null; }

  /* ── filing ────────────────────────────────────────────────────────────── */
  var NOT_OWNER_LINE = "Connect your Bluesky account above to file posts from it. Without a connection, only the owner can file, from the platform's own account.";
  var RECONNECT_LINE = "Your Bluesky connection needs reconnecting before posts can be filed: connect again above.";

  function postsAsLine(acct) {
    return acct && acct.kind === "member" ? "Posts as " + acct.handle : "Posts as the platform's Bluesky account";
  }

  function filingFormMarkup(taskId, acct) {
    var automatic = !!(acct && acct.kind === "member" && acct.automatic === true);
    return '<div class="sp-file" data-sp-task="' + esc(taskId) + '">' +
        '<div class="sp-label">' + (automatic ? "Post this now" : "File this post for approval") + '</div>' +
        '<p class="sp-quiet sp-posts-as">' + esc(postsAsLine(acct)) + '</p>' +
        (automatic
          ? '<p class="sp-quiet">"Post approved drafts automatically" is on: filing posts exactly this text at once, after the grapheme limit and the claims screen.</p>'
          : '<p class="sp-quiet">Nothing is posted by filing. Approving it on the proposals page posts exactly this text to Bluesky.</p>') +
        '<button type="button" class="ap-btn" data-sp-file>File for approval</button>' +
        '<div class="ap-msg sp-file-msg"></div>' +
      '</div>';
  }

  function notOwnerMarkup(acct) {
    return '<div class="sp-file"><p class="sp-quiet">' + esc(acct && acct.kind === "needs_reconnect" ? RECONNECT_LINE : NOT_OWNER_LINE) + '</p></div>';
  }

  function filedMarkup(data) {
    var label = data.automatic === true ? (data.posted === true ? "Posted" : "Not posted") : "Filed for approval";
    return '<div class="sp-filed">' +
        '<div class="sp-label">' + esc(label) + '</div>' +
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
    return postingAccount().then(function (acct) {
      slot.innerHTML = acct.kind === "member" || acct.kind === "platform" ? filingFormMarkup(data.task_id, acct) : notOwnerMarkup(acct);
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
    ".sp-link{color:var(--bf-accent-a, #22d3ee)}"
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
    drawFiling: drawFiling, filePost: filePost, filingFormMarkup: filingFormMarkup, onClick: onClick, forgetAccount: forgetAccount,
    NOT_OWNER_LINE: NOT_OWNER_LINE, RECONNECT_LINE: RECONNECT_LINE
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

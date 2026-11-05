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

   A Mastodon result gets the same kind of button, from the member's own
   Mastodon connection only (the MASTODON block below).

   IMAGES. Both filing boxes offer "Add images (up to 4)", which opens the
   Media Library picker (scripts/media-picker.js) for images. Each picked
   image shows as a thumbnail with its alt text, or "No alt text yet", and a
   Remove button, all set with textContent. Filing sends media_ids only when
   images are attached; the server checks each one and its refusal is shown
   as it comes. A post with images always waits for approval.
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

  /* ── images from the Media Library ─────────────────────────────────────── */
  var IMAGES_MAX = 4;
  var IMAGES_WAIT_LINE = "Images always wait for your approval.";
  var BLUESKY_SIZE_LINE = "Bluesky accepts images up to 2 MB.";
  var NO_ALT_LINE = "No alt text yet";
  var NO_PICKER_LINE = "The Media Library picker could not be loaded. Reload the page to try again.";
  // The images picked for each filing box, in order: [{ id, url, alt_text }].
  var picked = typeof WeakMap === "function" ? new WeakMap() : null;

  function imagesMarkup(service) {
    return '<div class="sp-images">' +
        '<button type="button" class="ap-btn sp-add-images" data-sp-add-images>Add images (up to 4)</button>' +
        '<p class="sp-quiet sp-images-wait">' + esc(IMAGES_WAIT_LINE) + '</p>' +
        (service === "bluesky" ? '<p class="sp-quiet sp-images-size">' + esc(BLUESKY_SIZE_LINE) + '</p>' : '') +
        '<div class="ap-msg sp-images-msg"></div>' +
        '<div class="sp-image-list"></div>' +
      '</div>';
  }

  function attachedImages(box) {
    return (picked && box && picked.get(box)) || [];
  }

  // { task_id } with no images, exactly as before; { task_id, media_ids } with them.
  function filingBody(taskId, box) {
    var ids = attachedImages(box).map(function (m) { return m.id; });
    return ids.length ? { task_id: taskId, media_ids: ids } : { task_id: taskId };
  }

  function safeImageUrl(u) {
    return typeof u === "string" && /^https:\/\//.test(u) ? u : "";
  }

  function drawImages(box) {
    var list = box.querySelector(".sp-image-list");
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var items = attachedImages(box);
    items.forEach(function (m) {
      var row = document.createElement("div");
      row.className = "sp-image";
      row.setAttribute("data-sp-image-id", m.id);
      var img = document.createElement("img");
      img.setAttribute("alt", m.alt_text || "");
      var src = safeImageUrl(m.url);
      if (src) img.setAttribute("src", src);
      row.appendChild(img);
      var alt = document.createElement("span");
      alt.className = m.alt_text ? "sp-image-alt" : "sp-image-alt sp-warn";
      alt.textContent = m.alt_text || NO_ALT_LINE;
      row.appendChild(alt);
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ap-btn sp-image-remove";
      remove.setAttribute("data-sp-remove-image", m.id);
      remove.textContent = "Remove";
      row.appendChild(remove);
      list.appendChild(row);
    });
    var add = box.querySelector("[data-sp-add-images]");
    if (add) add.disabled = items.length >= IMAGES_MAX;
  }

  function addImages(box, msg) {
    if (!picked) return Promise.resolve(false);
    if (!window.BFMediaPicker || typeof window.BFMediaPicker.open !== "function") {
      if (msg) { msg.textContent = NO_PICKER_LINE; msg.className = "ap-msg sp-images-msg err"; }
      return Promise.resolve(false);
    }
    if (attachedImages(box).length >= IMAGES_MAX) return Promise.resolve(false);
    if (msg) { msg.textContent = ""; msg.className = "ap-msg sp-images-msg"; }
    return window.BFMediaPicker.open({ kind: "image", withItem: true }).then(function (choice) {
      var item = choice && choice.item;
      if (!item || typeof item.id !== "string" || item.kind !== "image") return false;
      var now = attachedImages(box).slice();
      if (now.length >= IMAGES_MAX || now.some(function (m) { return m.id === item.id; })) return false;
      now.push({ id: item.id, url: item.url, alt_text: typeof item.alt_text === "string" ? item.alt_text.trim() : "" });
      picked.set(box, now);
      drawImages(box);
      return true;
    });
  }

  function removeImage(box, id) {
    if (!picked) return;
    picked.set(box, attachedImages(box).filter(function (m) { return m.id !== id; }));
    drawImages(box);
  }

  function onImagesClick(e) {
    var t = e.target;
    if (!t || typeof t.closest !== "function") return;
    var add = t.closest("[data-sp-add-images]");
    var rm = add ? null : t.closest("[data-sp-remove-image]");
    if (!add && !rm) return;
    var box = (add || rm).closest(".sp-file");
    if (!box) return;
    if (add) addImages(box, box.querySelector(".sp-images-msg"));
    else removeImage(box, rm.getAttribute("data-sp-remove-image"));
  }

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
        imagesMarkup("bluesky") +
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

  // Files it: the task_id, plus media_ids only when images are attached.
  function filePost(taskId, msgEl, formEl, button) {
    if (button) button.disabled = true;
    msgEl.textContent = "Filing…";
    msgEl.className = "ap-msg sp-file-msg";
    return api("POST", "/api/agents/social/propose-post", filingBody(taskId, formEl)).then(function (res) {
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

  /* ── MASTODON (scripts/mastodon-connect.js) ────────────────────────────────
     Under a completed Mastodon social/post result, the same kind of button,
     filing to POST /api/social/mastodon/propose-post with the task_id only.
     A post goes out only from the member's own connected account: there is no
     platform account for Mastodon, so anyone without a connection, the owner
     included, gets one quiet line. GET /api/social/mastodon/status (then its
     automation) is the source; one that cannot be read is an error. */
  var MASTO_CONNECT_LINE = "Connect your Mastodon account above to file posts from it. Mastodon posts go out only from your own connected account.";
  var MASTO_RECONNECT_LINE = "Your Mastodon connection needs reconnecting before posts can be filed: connect again above.";

  // { kind: "member", account, automatic, max } | { kind: "needs_reconnect", account } | { kind: "none" }, or a rejection.
  var mastoAccountPromise = null;
  function mastodonAccount() {
    if (!mastoAccountPromise) {
      mastoAccountPromise = api("GET", "/api/social/mastodon/status").then(function (res) {
        if (!res.ok || !res.parsed || !isPlainObject(res.data)) throw new Error(serverMessage(res));
        var ms = res.data;
        if (ms.connected === true && ms.status === "connected") {
          return api("GET", "/api/social/mastodon/automation").then(function (auto) {
            if (!auto.ok || !auto.parsed || !isPlainObject(auto.data)) throw new Error(serverMessage(auto));
            return { kind: "member", account: String(ms.account || ""), automatic: auto.data.auto_post === true, max: ms.max_characters };
          });
        }
        if (ms.status === "needs_reconnect") return { kind: "needs_reconnect", account: String(ms.account || "") };
        return { kind: "none" };
      });
      mastoAccountPromise.catch(function () { mastoAccountPromise = null; });
    }
    return mastoAccountPromise;
  }
  // The Mastodon card calls this after connecting, disconnecting or a setting change.
  function forgetMastodonAccount() { mastoAccountPromise = null; }

  function mastodonFormMarkup(taskId, macct) {
    var auto = macct.automatic === true;
    return '<div class="sp-file sp-masto" data-sp-masto-task="' + esc(taskId) + '">' +
        '<div class="sp-label">' + (auto ? "Post this to Mastodon now" : "File this Mastodon post for approval") + '</div>' +
        '<p class="sp-quiet sp-posts-as">' + esc("Posts as " + macct.account) + '</p>' +
        (auto
          ? '<p class="sp-quiet">"Post approved drafts automatically" is on for Mastodon: filing posts exactly this text at once, after your server\'s length limit and the claims screen.</p>'
          : '<p class="sp-quiet">Nothing is posted by filing. Approving it on the proposals page posts exactly this text to Mastodon, publicly.</p>') +
        imagesMarkup("mastodon") +
        '<button type="button" class="ap-btn" data-sp-masto-file>File for approval</button>' +
        '<div class="ap-msg sp-masto-msg"></div>' +
      '</div>';
  }

  function drawMastodonFiling(slot, data) {
    if (!slot) return Promise.resolve();
    if (!data || typeof data.task_id !== "string" || !data.task_id || data.persisted === false) {
      slot.innerHTML = '<div class="sp-file"><p class="sp-quiet">This run was not saved with a task id, so it cannot be filed. Run it again to file it.</p></div>';
      return Promise.resolve();
    }
    slot.innerHTML = '<div class="sp-file"><p class="sp-quiet">Checking your Mastodon connection…</p></div>';
    return mastodonAccount().then(function (macct) {
      slot.innerHTML = macct.kind === "member"
        ? mastodonFormMarkup(data.task_id, macct)
        : '<div class="sp-file"><p class="sp-quiet">' + esc(macct.kind === "needs_reconnect" ? MASTO_RECONNECT_LINE : MASTO_CONNECT_LINE) + '</p></div>';
    }, function (err) {
      slot.innerHTML = '<div class="sp-file"><div class="ap-msg err">Your Mastodon connection could not be checked, so this cannot be filed yet. Reload to try again. (' +
        esc((err && err.message) || "unknown error") + ')</div></div>';
    });
  }

  // Files it: the task_id, plus media_ids only when images are attached.
  function fileMastodonPost(taskId, note, box, btn) {
    if (btn) btn.disabled = true;
    note.textContent = "Filing…";
    note.className = "ap-msg sp-masto-msg";
    return api("POST", "/api/social/mastodon/propose-post", filingBody(taskId, box)).then(function (answer) {
      if (!answer.ok) {
        note.textContent = serverMessage(answer);
        note.className = "ap-msg sp-masto-msg err";
        if (btn) btn.disabled = false;
        return false;
      }
      if (!answer.parsed || !isPlainObject(answer.data)) {
        note.textContent = "The answer could not be read, so whether it was filed is unknown. Check the proposals page before filing again.";
        note.className = "ap-msg sp-masto-msg err";
        return false;
      }
      if (box) box.innerHTML = filedMarkup(answer.data);
      return true;
    }, function (err) {
      note.textContent = (err && err.message) || "That could not be filed.";
      note.className = "ap-msg sp-masto-msg err";
      if (btn) btn.disabled = false;
      return false;
    });
  }

  var hookBeforeMastodon = window.bfAfterToolResult;
  window.bfAfterToolResult = function (agentType, toolId, data, resultEl) {
    if (typeof hookBeforeMastodon === "function") hookBeforeMastodon.apply(this, arguments);
    if (agentType !== "social" || toolId !== "post" || !resultEl || !data || data.success !== true || data.platform !== "mastodon") return;
    var mslot = document.createElement("div");
    mslot.className = "sp-masto-slot";
    resultEl.appendChild(mslot);
    drawMastodonFiling(mslot, data);
  };

  function onMastodonClick(e) {
    var target = e.target;
    if (!target || typeof target.closest !== "function") return;
    var mb = target.closest("[data-sp-masto-file]");
    if (!mb) return;
    var box = mb.closest(".sp-masto");
    if (!box) return;
    fileMastodonPost(box.getAttribute("data-sp-masto-task"), box.querySelector(".sp-masto-msg"), box, mb);
  }

  var STYLE = [
    ".sp-file,.sp-filed{margin-top:14px;padding:14px;border:1px solid rgba(244,114,182,.25);border-radius:12px;background:rgba(244,114,182,.04)}",
    ".sp-filed{display:grid;gap:6px}",
    ".sp-label{font-weight:700;color:#e6edf3;margin-bottom:6px}",
    ".sp-quiet{color:#8892b8;font-size:.82rem;margin:4px 0}",
    ".sp-link{color:var(--bf-accent-a, #22d3ee)}",
    ".sp-images{margin:8px 0 10px}",
    ".sp-image-list{display:grid;gap:8px;margin-top:8px}",
    ".sp-image{display:flex;align-items:center;gap:10px}",
    ".sp-image img{width:64px;height:64px;object-fit:cover;border-radius:8px;background:#000}",
    ".sp-image-alt{flex:1;font-size:.8rem;color:#c8cff0;overflow-wrap:anywhere}",
    ".sp-image-alt.sp-warn{color:#fbbf24}"
  ].join("\n");

  function mount() {
    var style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    document.addEventListener("click", onClick);
    document.addEventListener("click", onMastodonClick);
    document.addEventListener("click", onImagesClick);
  }

  // For scripts/checkSocialPublishPage.js in the backend repo, which runs this
  // file in a stubbed page. Nothing on the page reads it.
  window.bfSocialPublish = {
    drawFiling: drawFiling, filePost: filePost, filingFormMarkup: filingFormMarkup, onClick: onClick, forgetAccount: forgetAccount,
    NOT_OWNER_LINE: NOT_OWNER_LINE, RECONNECT_LINE: RECONNECT_LINE,
    drawMastodonFiling: drawMastodonFiling, fileMastodonPost: fileMastodonPost, forgetMastodonAccount: forgetMastodonAccount,
    MASTO_CONNECT_LINE: MASTO_CONNECT_LINE, MASTO_RECONNECT_LINE: MASTO_RECONNECT_LINE,
    imagesMarkup: imagesMarkup, filingBody: filingBody, attachedImages: attachedImages, onImagesClick: onImagesClick,
    IMAGES_WAIT_LINE: IMAGES_WAIT_LINE, BLUESKY_SIZE_LINE: BLUESKY_SIZE_LINE, IMAGES_MAX: IMAGES_MAX
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();

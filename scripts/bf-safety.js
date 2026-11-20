/* ══════════════════════════════════════════════════════════════════════════
   bf-safety.js — Report, Block and Mute (P2-2, Nov 20 2026; the backend's
   lib/safety.js and migration 191).

   THE MENU. A page calls BFSafety.mount(container, item) to put a three-dot
   button (44 px) in its header; item is { type: "profile" | "listing" |
   "campaign" | "message", id, userId or handle, name }. The button opens a
   sheet (a bottom sheet on a phone, a centred dialog on a desktop) with:
     Report             the report sheet: 13 reasons, up to 1000 characters
                        of detail, POST /api/reports. Signed out: "Sign in to
                        report", to the sign-in page and back (bf_return_to).
     Block / Unblock    POST /api/blocks, DELETE /api/blocks/:id, after a
                        confirm that says what a block does. Never told to them.
     Mute / Unmute      POST /api/mutes, DELETE /api/mutes/:id.
     Copyright notice   copyright.html, with where the item is filled in.
   Block and Mute are asked about with GET /api/me/relation when the menu opens
   (by the member's id or handle, or by the item, whose owner the server finds)
   (the member's OWN choices; whether they were blocked is never asked), and are
   left out for the member's own items and when signed out.

   SETTINGS. BFSafety.renderSettings(el) lists the member's blocks and mutes
   (GET /api/me/safety), each with Unblock or Unmute.

   THE OWNER. BFSafety.ownerCount(el) shows "N waiting for review" with a link
   to moderation.html when GET /api/inbox/counts answers moderation above 0,
   which the server answers only to the owner. Otherwise the element stays empty
   and hidden, so no one else's page changes.

   Nothing new is kept on the device; Sign in to report sets the existing
   bf_return_to, as the storefront's own sign-in link does.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (typeof window === "undefined" || typeof document === "undefined" || window.BFSafety) return;

  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var BREAKPOINT = "(max-width: 760px)";
  var DETAIL_MAX = 1000;
  var REASONS = [
    ["spam", "Spam", "Junk, repeated or misleading"],
    ["harassment", "Harassment or bullying", "Targets or insults someone"],
    ["hate", "Hate", "Attacks people for who they are"],
    ["sexual", "Sexual content", "Nudity or sexual services"],
    ["minor_safety", "A child's safety", "Puts someone under 18 at risk"],
    ["violence", "Violence or threats", "Threatens or praises harm"],
    ["health_claim", "Health claim", "Says a product treats or cures a condition"],
    ["prohibited_item", "Prohibited item", "Weapons, drugs, counterfeits or another item the Terms list"],
    ["scam", "Scam or fraud", "Tries to take money or details dishonestly"],
    ["copyright", "Copyright", "Uses someone's work without permission"],
    ["impersonation", "Pretending to be someone", "Poses as another person or business"],
    ["privacy", "Private information", "Shares someone's contact details or personal data"],
    ["other", "Something else", "Tell us in the detail"]
  ];
  var NOUN = { profile: "profile", listing: "listing", campaign: "campaign", message: "message" };
  var ICON_DOTS = '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>';
  var ICON_CLOSE = '<path d="M6 6l12 12M18 6L6 18"/>';

  function api() { return (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK; }
  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function svg(paths, size, fill) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="' + (fill ? "currentColor" : "none") + '" stroke="' + (fill ? "none" : "currentColor") +
      '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + '</svg>';
  }
  function call(method, path, body) {
    var headers = { "Authorization": "Bearer " + token() };
    if (body) headers["Content-Type"] = "application/json";
    return window.fetch(api() + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, body: d || {} }; }); });
  }

  var CSS = [
    ".bf-safety-dots{width:44px;height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;padding:0;margin:0;",
    "border-radius:22px;border:1px solid rgba(255,255,255,.16);background:rgba(11,16,34,.6);color:#e8e8ff;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".bf-safety-dots:hover,.bf-safety-dots:focus-visible{border-color:rgba(var(--bf-accent-a-rgb, 34,211,238),.55);outline:none}",
    "#bf-safety-backdrop{position:fixed;inset:0;z-index:2147483300;background:rgba(2,4,12,.6)}",
    "#bf-safety{position:fixed;z-index:2147483301;box-sizing:border-box;color:#e8e8ff;background:#0b1022;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.22);",
    "font-family:system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;display:flex;flex-direction:column;gap:12px;overflow-y:auto;",
    "left:50%;top:50%;transform:translate(-50%,-50%);width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 48px);padding:20px;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.55)}",
    "#bf-safety[hidden],#bf-safety-backdrop[hidden]{display:none}",
    "#bf-safety .bf-safety-grip{display:none}",
    "#bf-safety .bf-safety-head{display:flex;align-items:center;gap:12px}",
    "#bf-safety h2{flex:1;margin:0;font-size:1.2rem;font-weight:800;color:#f4f7ff;overflow-wrap:anywhere}",
    "#bf-safety .bf-safety-close{width:44px;height:44px;min-width:44px;border-radius:22px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#e8e8ff;",
    "display:flex;align-items:center;justify-content:center;cursor:pointer}",
    "#bf-safety p{margin:0;font-size:.92rem;line-height:1.5;color:#c4cbe0}",
    "#bf-safety .bf-safety-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}",
    "#bf-safety .bf-safety-item{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:48px;padding:10px 14px;border-radius:14px;",
    "border:1px solid rgba(255,255,255,.1);background:rgba(18,26,54,.9);color:#e8e8ff;font:600 .95rem/1.3 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;",
    "text-align:left;text-decoration:none;cursor:pointer}",
    "#bf-safety .bf-safety-item:hover,#bf-safety .bf-safety-item:focus-visible{border-color:rgba(var(--bf-accent-a-rgb, 34,211,238),.55);outline:none}",
    "#bf-safety .bf-safety-item.is-danger{color:#fca5a5}",
    "#bf-safety .bf-safety-reason{display:flex;align-items:flex-start;gap:12px;min-height:48px;box-sizing:border-box;padding:10px 12px;border-radius:12px;",
    "border:1px solid rgba(255,255,255,.1);background:rgba(18,26,54,.9);cursor:pointer}",
    "#bf-safety .bf-safety-reason input{width:20px;height:20px;margin:2px 0 0;flex:0 0 auto;accent-color:var(--bf-accent-a, #22d3ee)}",
    "#bf-safety .bf-safety-reason span{display:flex;flex-direction:column;gap:2px;min-width:0}",
    "#bf-safety .bf-safety-reason strong{font-size:.95rem;color:#f4f7ff}",
    "#bf-safety .bf-safety-reason small{font-size:.8rem;line-height:1.35;color:#a9b3cc}",
    "#bf-safety label.bf-safety-label{font-size:.85rem;font-weight:700;color:#c4cbe0}",
    "#bf-safety textarea{box-sizing:border-box;width:100%;min-height:96px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.16);",
    "background:#070b18;color:#e8e8ff;font:15px/1.45 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;resize:vertical}",
    "#bf-safety .bf-safety-count{align-self:flex-end;font-size:.78rem;color:#8e98c2}",
    "#bf-safety .bf-safety-actions{display:flex;flex-wrap:wrap;gap:10px}",
    "#bf-safety .bf-safety-btn{min-height:44px;padding:0 18px;border-radius:12px;border:0;font:800 .95rem/1 system-ui,-apple-system,\"Segoe UI\",Arial,sans-serif;cursor:pointer;",
    "background:var(--bf-accent-a, #22d3ee);color:#04121a}",
    "#bf-safety .bf-safety-btn.is-quiet{background:transparent;color:#e8e8ff;border:1px solid rgba(255,255,255,.2)}",
    "#bf-safety .bf-safety-btn.is-danger{background:#f87171;color:#1a0505}",
    "#bf-safety .bf-safety-btn[disabled]{opacity:.55;cursor:default}",
    "#bf-safety .bf-safety-msg{font-size:.9rem;line-height:1.45}",
    "#bf-safety .bf-safety-msg.is-error{color:#fca5a5}",
    "#bf-safety .bf-safety-msg.is-ok{color:#6ee7b7}",
    "#bf-safety a{color:var(--bf-accent-a, #22d3ee)}",
    "@media " + BREAKPOINT + "{",
    "#bf-safety{left:0;right:0;top:auto;bottom:0;transform:none;width:auto;max-height:calc(100dvh - 40px);border-radius:24px 24px 0 0;",
    "padding:10px 16px calc(20px + env(safe-area-inset-bottom, 0px));box-shadow:0 -12px 40px rgba(0,0,0,.55)}",
    "#bf-safety .bf-safety-grip{display:block;align-self:center;width:40px;height:5px;border-radius:3px;background:rgba(255,255,255,.18)}",
    "}",
    ".bf-safety-settings{display:flex;flex-direction:column;gap:18px}",
    ".bf-safety-settings h3{margin:0 0 8px;font-size:1rem;font-weight:800;color:#f4f7ff}",
    ".bf-safety-settings ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}",
    ".bf-safety-settings li{display:flex;align-items:center;gap:12px;min-height:52px;padding:6px 10px;box-sizing:border-box;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(18,26,54,.6)}",
    ".bf-safety-settings .who{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;overflow-wrap:anywhere}",
    ".bf-safety-settings .who strong{color:#f4f7ff;font-size:.95rem}",
    ".bf-safety-settings .who small{color:#a9b3cc;font-size:.8rem}",
    ".bf-safety-settings img,.bf-safety-settings .av{width:36px;height:36px;border-radius:18px;flex:0 0 auto;object-fit:cover;background:#1b2447;display:flex;align-items:center;justify-content:center;color:#c4cbe0;font-weight:800}",
    ".bf-safety-settings button{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#e8e8ff;font-weight:700;cursor:pointer;flex:0 0 auto}",
    ".bf-safety-settings .empty{margin:0;color:#a9b3cc;font-size:.9rem}",
    ".bf-safety-owner{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:12px;box-sizing:border-box;",
    "border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);color:#fbbf24;font-weight:800;text-decoration:none}",
    ".bf-safety-owner[hidden]{display:none}"
  ].join("");

  function addStyle() {
    if (document.getElementById("bf-safety-style")) return;
    var st = document.createElement("style");
    st.id = "bf-safety-style";
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ── the sheet ── */
  var sheet = null, backdrop = null, lastFocus = null;
  function ensureSheet() {
    addStyle();
    if (sheet) return;
    backdrop = document.createElement("div");
    backdrop.id = "bf-safety-backdrop";
    backdrop.hidden = true;
    backdrop.addEventListener("click", close);
    sheet = document.createElement("div");
    sheet.id = "bf-safety";
    sheet.hidden = true;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "bf-safety-title");
    sheet.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = sheet.querySelectorAll("a[href],button:not([disabled]),input,textarea");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
  }
  function show(title, bodyHtml, focusSel) {
    ensureSheet();
    sheet.innerHTML = '<span class="bf-safety-grip" aria-hidden="true"></span>' +
      '<div class="bf-safety-head"><h2 id="bf-safety-title">' + esc(title) + '</h2>' +
      '<button type="button" class="bf-safety-close" aria-label="Close">' + svg(ICON_CLOSE, 18) + '</button></div>' + bodyHtml;
    sheet.querySelector(".bf-safety-close").addEventListener("click", close);
    backdrop.hidden = false;
    sheet.hidden = false;
    var f = sheet.querySelector(focusSel || ".bf-safety-item,.bf-safety-btn,.bf-safety-close");
    if (f && f.focus) f.focus();
    return sheet;
  }
  function close() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    backdrop.hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* gone */ } }
  }
  function message(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = "bf-safety-msg" + (kind ? " is-" + kind : "");
  }

  function nameOf(item) { return item.name || (item.handle ? "@" + String(item.handle).replace(/^@/, "") : "this member"); }
  function whereOf(item) {
    if (item.where) return item.where;
    try { return window.location.origin + window.location.pathname + window.location.search; } catch (e) { return ""; }
  }

  /* ── the menu ── */
  function openMenu(item, from) {
    lastFocus = from || document.activeElement;
    var noun = NOUN[item.type] || "item";
    var copyrightHref = "/copyright.html?where=" + encodeURIComponent(whereOf(item));
    var signedIn = !!token();
    var reportRow = signedIn
      ? '<li><button type="button" class="bf-safety-item" data-act="report">Report this ' + noun + '</button></li>'
      : '<li><a class="bf-safety-item" data-act="signin" href="/app.html">Sign in to report</a></li>';
    var s = show("Options", '<ul class="bf-safety-list" id="bf-safety-menu">' + reportRow +
      '<li data-slot="relation"></li>' +
      '<li><a class="bf-safety-item" data-act="copyright" href="' + esc(copyrightHref) + '">Send a copyright notice</a></li></ul>' +
      '<p class="bf-safety-msg" id="bf-safety-menu-msg" role="status"></p>');
    // signing in comes back here (app.html signInReturnTo accepts the storefront, profile and campaign pages)
    var si = s.querySelector('[data-act="signin"]');
    if (si) si.addEventListener("click", function () { try { localStorage.setItem("bf_return_to", window.location.href); } catch (e) { /* signs in to the dashboard */ } });
    var rb = s.querySelector('[data-act="report"]');
    if (rb) rb.addEventListener("click", function () { openReport(item); });
    if (!signedIn) return;
    // whose item it is: the member, by id or handle, or else the item itself (the server finds its owner)
    var q = item.userId ? "user_id=" + encodeURIComponent(item.userId)
      : item.handle ? "handle=" + encodeURIComponent(String(item.handle).replace(/^@/, ""))
      : "object_type=" + encodeURIComponent(item.type) + "&object_id=" + encodeURIComponent(item.id);
    call("GET", "/api/me/relation?" + q).then(function (r) {
      if (sheet.hidden || !document.getElementById("bf-safety-menu")) return;
      var slot = sheet.querySelector('[data-slot="relation"]');
      if (!slot) return;
      if (!r.ok || r.body.self) {
        if (r.body.self && rb) { rb.parentNode.parentNode.removeChild(rb.parentNode); }
        slot.parentNode.removeChild(slot);
        return;
      }
      var who = r.body.user_id;
      slot.outerHTML = '<li><button type="button" class="bf-safety-item' + (r.body.blocked ? "" : " is-danger") + '" data-act="block">' +
        (r.body.blocked ? "Unblock " : "Block ") + esc(nameOf(item)) + '</button></li>' +
        '<li><button type="button" class="bf-safety-item" data-act="mute">' + (r.body.muted ? "Unmute " : "Mute ") + esc(nameOf(item)) + '</button></li>';
      sheet.querySelector('[data-act="block"]').addEventListener("click", function () {
        if (r.body.blocked) setBlock(item, who, false); else confirmBlock(item, who);
      });
      sheet.querySelector('[data-act="mute"]').addEventListener("click", function () { setMute(item, who, !r.body.muted); });
    }).catch(function () { /* the menu still reports and links */ });
  }

  /* ── report ── */
  function openReport(item) {
    var noun = NOUN[item.type] || "item";
    var reasons = REASONS.map(function (r) {
      return '<label class="bf-safety-reason"><input type="radio" name="bf-safety-reason" value="' + r[0] + '">' +
        '<span><strong>' + esc(r[1]) + '</strong><small>' + esc(r[2]) + '</small></span></label>';
    }).join("");
    var s = show("Report this " + noun,
      '<p>Choose the reason. The person you report is never told who sent it.</p>' +
      '<div class="bf-safety-list" role="radiogroup" aria-label="Reason">' + reasons + '</div>' +
      '<label class="bf-safety-label" for="bf-safety-detail">Anything else we should know (optional)</label>' +
      '<textarea id="bf-safety-detail" maxlength="' + DETAIL_MAX + '"></textarea>' +
      '<span class="bf-safety-count" id="bf-safety-count">0 / ' + DETAIL_MAX + '</span>' +
      '<p>If you own the rights to something used here, you can also <a href="/copyright.html?where=' + esc(encodeURIComponent(whereOf(item))) + '">send a copyright notice</a>.</p>' +
      '<p class="bf-safety-msg" id="bf-safety-report-msg" role="status"></p>' +
      '<div class="bf-safety-actions"><button type="button" class="bf-safety-btn" id="bf-safety-send">Send report</button>' +
      '<button type="button" class="bf-safety-btn is-quiet" id="bf-safety-cancel">Cancel</button></div>',
      'input[name="bf-safety-reason"]');
    var detail = s.querySelector("#bf-safety-detail"), count = s.querySelector("#bf-safety-count");
    detail.addEventListener("input", function () { count.textContent = detail.value.length + " / " + DETAIL_MAX; });
    s.querySelector("#bf-safety-cancel").addEventListener("click", close);
    var send = s.querySelector("#bf-safety-send"), msg = s.querySelector("#bf-safety-report-msg");
    send.addEventListener("click", function () {
      var picked = s.querySelector('input[name="bf-safety-reason"]:checked');
      if (!picked) { message(msg, "Choose a reason first.", "error"); return; }
      send.disabled = true;
      message(msg, "Sending...");
      call("POST", "/api/reports", { object_type: item.type, object_id: item.id, reason: picked.value, detail: detail.value })
        .then(function (r) {
          if (r.ok) {
            message(msg, r.body.message || "Thanks. Your report was sent.", "ok");
            send.hidden = true;
            s.querySelector("#bf-safety-cancel").textContent = "Done";
          } else {
            send.disabled = false;
            message(msg, r.body.error || "That did not send. Try again.", "error");
          }
        })
        .catch(function () { send.disabled = false; message(msg, "That did not send. Check your connection and try again.", "error"); });
    });
  }

  /* ── block and mute ── */
  function confirmBlock(item, who) {
    var name = nameOf(item);
    var s = show("Block " + name + "?",
      "<p>Neither of you will see the other's profile or storefront, and neither can message the other, send BizCash or support, buy from the other or donate to the other's campaigns. " +
      esc(name) + " is not told. You can unblock them in Settings, Blocked and muted.</p>" +
      '<p class="bf-safety-msg" id="bf-safety-block-msg" role="status"></p>' +
      '<div class="bf-safety-actions"><button type="button" class="bf-safety-btn is-danger" id="bf-safety-block-yes">Block</button>' +
      '<button type="button" class="bf-safety-btn is-quiet" id="bf-safety-block-no">Cancel</button></div>', "#bf-safety-block-no");
    s.querySelector("#bf-safety-block-no").addEventListener("click", close);
    s.querySelector("#bf-safety-block-yes").addEventListener("click", function () { setBlock(item, who, true); });
  }
  function done(item, title, text) {
    var s = show(title, "<p>" + esc(text) + '</p><div class="bf-safety-actions"><button type="button" class="bf-safety-btn" id="bf-safety-ok">OK</button></div>', "#bf-safety-ok");
    s.querySelector("#bf-safety-ok").addEventListener("click", function () { close(); if (typeof item.onChange === "function") item.onChange(); });
  }
  function failed(text) {
    var m = sheet && (sheet.querySelector("#bf-safety-block-msg") || sheet.querySelector("#bf-safety-menu-msg"));
    if (m) message(m, text, "error");
  }
  function setBlock(item, who, on) {
    var p = on ? call("POST", "/api/blocks", { user_id: who }) : call("DELETE", "/api/blocks/" + encodeURIComponent(who));
    p.then(function (r) {
      if (!r.ok) { failed(r.body.error || "That did not work. Try again."); return; }
      done(item, on ? "Blocked" : "Unblocked", on ? nameOf(item) + " is blocked. They are not told." : nameOf(item) + " is unblocked.");
    }).catch(function () { failed("That did not work. Check your connection and try again."); });
  }
  function setMute(item, who, on) {
    var p = on ? call("POST", "/api/mutes", { user_id: who }) : call("DELETE", "/api/mutes/" + encodeURIComponent(who));
    p.then(function (r) {
      if (!r.ok) { failed(r.body.error || "That did not work. Try again."); return; }
      done(item, on ? "Muted" : "Unmuted", on ? nameOf(item) + " will no longer appear in your lists. They are not told." : nameOf(item) + " will appear in your lists again.");
    }).catch(function () { failed("That did not work. Check your connection and try again."); });
  }

  /* ── the button ── */
  function mount(container, item) {
    if (!container || !item || !item.type) return null;
    addStyle();
    var old = container.querySelector(":scope > .bf-safety-dots");
    if (old) old.parentNode.removeChild(old);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bf-safety-dots";
    b.setAttribute("aria-label", "More options for this " + (NOUN[item.type] || "item"));
    b.setAttribute("aria-haspopup", "dialog");
    b.setAttribute("data-safety-type", item.type);
    b.innerHTML = svg(ICON_DOTS, 20, true);
    b.addEventListener("click", function () { openMenu(item, b); });
    container.appendChild(b);
    return b;
  }

  /* ── Settings: Blocked and muted ── */
  function personRow(p, kind) {
    var handle = p.username || null;   // GET /api/me/safety: lib/inbox.js personFrom (username, name, avatar_url)
    var name = p.name || (handle ? "@" + handle : "A member");
    var pic = p.avatar_url ? '<img src="' + esc(p.avatar_url) + '" alt="">' : '<span class="av" aria-hidden="true">' + esc(String(name).replace(/^@/, "").charAt(0).toUpperCase() || "?") + '</span>';
    return '<li>' + pic + '<span class="who"><strong>' + esc(name) + '</strong>' + (handle ? '<small>@' + esc(handle) + '</small>' : "") + '</span>' +
      '<button type="button" data-undo="' + kind + '" data-user="' + esc(p.user_id) + '">' + (kind === "blocks" ? "Unblock" : "Unmute") + '</button></li>';
  }
  function renderSettings(el) {
    if (!el) return;
    addStyle();
    el.classList.add("bf-safety-settings");
    el.innerHTML = '<p class="empty">Loading...</p>';
    call("GET", "/api/me/safety").then(function (r) {
      if (!r.ok) { el.innerHTML = '<p class="empty">Your blocked and muted members could not be loaded. Try again in a minute.</p>'; return; }
      var b = r.body.blocks || [], m = r.body.mutes || [];
      el.innerHTML =
        '<section aria-labelledby="bf-safety-blocked-h"><h3 id="bf-safety-blocked-h">Blocked</h3>' +
        (b.length ? "<ul>" + b.map(function (p) { return personRow(p, "blocks"); }).join("") + "</ul>" : '<p class="empty">You have not blocked anyone.</p>') + "</section>" +
        '<section aria-labelledby="bf-safety-muted-h"><h3 id="bf-safety-muted-h">Muted</h3>' +
        (m.length ? "<ul>" + m.map(function (p) { return personRow(p, "mutes"); }).join("") + "</ul>" : '<p class="empty">You have not muted anyone.</p>') + "</section>" +
        '<p class="empty" role="status" data-safety-msg></p>';
      Array.prototype.forEach.call(el.querySelectorAll("button[data-undo]"), function (btn) {
        btn.addEventListener("click", function () {
          btn.disabled = true;
          call("DELETE", "/api/" + btn.getAttribute("data-undo") + "/" + encodeURIComponent(btn.getAttribute("data-user"))).then(function (x) {
            if (x.ok) renderSettings(el);
            else { btn.disabled = false; el.querySelector("[data-safety-msg]").textContent = x.body.error || "That did not work. Try again."; }
          }).catch(function () { btn.disabled = false; });
        });
      });
    }).catch(function () { el.innerHTML = '<p class="empty">Your blocked and muted members could not be loaded. Check your connection.</p>'; });
  }

  /* ── the owner's waiting count ── */
  function ownerCount(el) {
    if (!el || !token()) return;
    el.hidden = true;
    call("GET", "/api/inbox/counts").then(function (r) {
      var n = r.ok && typeof r.body.moderation === "number" ? r.body.moderation : 0;
      if (n > 0) {
        addStyle();
        el.innerHTML = '<a class="bf-safety-owner" href="/moderation.html">' + n + (n === 1 ? " item" : " items") + " waiting for review</a>";
        el.hidden = false;
      }
    }).catch(function () { /* nothing shown */ });
  }

  window.BFSafety = { mount: mount, openMenu: openMenu, openReport: openReport, renderSettings: renderSettings, ownerCount: ownerCount, close: close,
    REASONS: REASONS.map(function (r) { return r[0]; }), DETAIL_MAX: DETAIL_MAX };
})();

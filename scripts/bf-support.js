/* ══════════════════════════════════════════════════════════════════════════
   BF SUPPORT — members supporting each other.

   On the support page (bizforceai.net/support/<username>, served with the
   member already filled in by the backend's lib/supportPage.js), and as a
   block on the public profile, the storefront and the card:
     - the member's support links, each a button that opens the provider in a
       new tab (rel="noopener noreferrer") under the provider's disclaimer.
       The URLs arrive rebuilt by the server from provider and handle; one
       that is not https is not drawn;
     - "Support with BizCash" for a signed-in member who is not the page's
       owner: an amount and an optional note (140 characters, seen only by
       the two members), a confirm step, then POST /api/wallet/support. A
       signed-out visitor gets "Sign in to support with BizCash", which comes
       back to this page after sign-in (bf_return_to, as the storefront does);
     - on the support page: Share (the device's share sheet, or the link
       copied: "Link copied") and a QR code of the page's own URL, drawn with
       the card's QR library.
   For the member themself: "Your support link" with Copy and Share, and the
   support settings (links, headline, the page switch, discovery).

   Everything a member typed is drawn with textContent, never as HTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var API = (typeof root.API_URL === "string" && root.API_URL) || "https://dynamic-prosperity-production-5382.up.railway.app";
  var SITE = "https://bizforceai.net";
  var USERNAME = /^[a-z0-9_-]{1,40}$/i;

  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }
  /* The blocks' look where they sit inside another page (the support page
     carries its own stylesheet). Scoped to the .sup-* classes. */
  function injectCss() {
    if (document.getElementById("bfSupportCss") || document.getElementById("supportPage")) return;
    var st = document.createElement("style");
    st.id = "bfSupportCss";
    st.textContent =
      ".sup-title{font-size:1.05rem;margin:0 0 10px}" +
      ".sup-links{list-style:none;padding:0;margin:0 0 12px;display:grid;gap:10px}" +
      ".sup-link{display:inline-block;padding:9px 14px;border-radius:10px;background:#2b3a8f;color:#fff;font-weight:600;text-decoration:none}" +
      ".sup-disclaimer{display:block;font-size:.8rem;opacity:.75;margin-top:4px}" +
      ".sup-box{border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:14px;margin-top:10px}" +
      ".sup-box input,.sup-box textarea,.sup-link-row input,.sup-link-row select{width:100%;box-sizing:border-box;padding:9px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.25);color:inherit;font:inherit;margin-top:6px}" +
      ".sup-btn{margin-top:10px;padding:9px 14px;border-radius:10px;border:1px solid #4a5ab8;background:#2b3a8f;color:#fff;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}" +
      ".sup-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}" +
      ".sup-status{min-height:1.3em;margin:6px 0 0;font-size:.88rem}" +
      ".sup-own-url{word-break:break-all}" +
      ".sup-toggle{display:flex;gap:8px;align-items:center;margin-top:10px}" +
      ".sup-link:focus-visible,.sup-btn:focus-visible{outline:2px solid #f7dd8a;outline-offset:2px}";
    document.head.appendChild(st);
  }
  injectCss();
  function supportUrl(username) { return SITE + "/support/" + encodeURIComponent(String(username).toLowerCase()); }

  /* The link copied to the clipboard, or by a hidden textarea where the
     Clipboard API is missing (the card editor's fallback). */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error("copy refused"));
    });
  }
  /* The device's share sheet when it has one; otherwise the link is copied. */
  function share(url, title, status) {
    if (navigator.share) {
      return navigator.share({ title: title, url: url }).then(function () { status.textContent = ""; }, function (e) {
        if (e && e.name === "AbortError") return;
        return copyText(url).then(function () { status.textContent = "Link copied"; }, function () { status.textContent = "Copy this link: " + url; });
      });
    }
    return copyText(url).then(function () { status.textContent = "Link copied"; }, function () { status.textContent = "Copy this link: " + url; });
  }

  /* ── the links ─────────────────────────────────────────────────────────── */
  function linkList(links) {
    var ul = el("ul", { "class": "sup-links" });
    (links || []).forEach(function (l) {
      if (!l || typeof l.url !== "string" || l.url.indexOf("https://") !== 0) return;
      var li = el("li");
      var a = el("a", { "class": "sup-link", href: l.url, target: "_blank", rel: "noopener noreferrer" }, "Support on " + l.label);
      li.appendChild(a);
      li.appendChild(el("span", { "class": "sup-disclaimer" }, l.disclaimer));
      ul.appendChild(li);
    });
    return ul;
  }

  /* ── BizCash support ───────────────────────────────────────────────────── */
  /* parts: { form, amount, note, confirm, confirmText, confirmBtn, cancelBtn, status, signIn } */
  function wireBizCash(parts, member) {
    var pending = null;
    if (!token()) {
      parts.form.hidden = true;
      parts.signIn.hidden = false;
      parts.signIn.addEventListener("click", function () { try { localStorage.setItem("bf_return_to", window.location.href); } catch (e) {} });
      return;
    }
    parts.signIn.hidden = true;
    parts.form.hidden = false;
    parts.form.addEventListener("submit", function (e) {
      e.preventDefault();
      var amount = Number(parts.amount.value);
      if (!Number.isInteger(amount) || amount < 1) { parts.status.textContent = "Enter a whole number of BFC, 1 or more."; return; }
      pending = { amount: amount, note: parts.note.value };
      parts.confirmText.textContent = "Send " + amount.toLocaleString("en-US") + " BFC to " + member.displayName + " (@" + member.username + ") as support?";
      parts.form.hidden = true;
      parts.confirm.hidden = false;
      parts.status.textContent = "";
      parts.confirmBtn.focus();
    });
    parts.cancelBtn.addEventListener("click", function () {
      pending = null;
      parts.confirm.hidden = true;
      parts.form.hidden = false;
      parts.amount.focus();
    });
    parts.confirmBtn.addEventListener("click", function () {
      if (!pending) return;
      var send = pending;
      pending = null;
      parts.confirmBtn.disabled = true;
      parts.status.textContent = "Sending…";
      fetch(API + "/api/wallet/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token() },
        body: JSON.stringify({ username: member.username, amount: send.amount, note: send.note })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
      }).then(function (res) {
        if (!res.ok) {
          parts.status.textContent = (res.d && res.d.error) || ("Support could not be sent (error " + res.status + "). Nothing was sent.");
          return;
        }
        parts.status.textContent = "Sent " + send.amount.toLocaleString("en-US") + " BFC to @" + member.username + " as support. Thank you.";
        parts.amount.value = ""; parts.note.value = "";
      }, function () {
        parts.status.textContent = "BizForce could not be reached just now. Nothing was sent.";
      }).then(function () {
        parts.confirmBtn.disabled = false;
        parts.confirm.hidden = true;
        parts.form.hidden = false;
      });
    });
  }

  /* Is the signed-in visitor this member? Asked of the server, so no id is
     ever compared in the page. Resolves false when signed out. */
  function isOwn(username) {
    if (!token()) return Promise.resolve(false);
    return fetch(API + "/api/support/me", { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return !!(d && d.support_url && d.support_url === supportUrl(username)); }, function () { return false; });
  }

  /* ── the support page ──────────────────────────────────────────────────── */
  function supportPage(main) {
    if (main.getAttribute("data-state") === "shell") {
      var u = new URLSearchParams(window.location.search).get("u");
      if (u && USERNAME.test(u)) window.location.replace("/support/" + encodeURIComponent(u.toLowerCase()));
      return;
    }
    if (main.getAttribute("data-state") !== "on") return;
    var member = { username: main.getAttribute("data-username"), displayName: main.getAttribute("data-display-name") };
    var url = main.getAttribute("data-support-url");
    var shareStatus = document.getElementById("supShareStatus");
    document.getElementById("supShareBtn").addEventListener("click", function () { share(url, "Support " + member.displayName + " on BizForce", shareStatus); });
    document.getElementById("supCopyBtn").addEventListener("click", function () {
      copyText(url).then(function () { shareStatus.textContent = "Link copied"; }, function () { shareStatus.textContent = "Copy this link: " + url; });
    });
    var canvas = document.getElementById("supQr");
    if (root.QRCode && canvas) root.QRCode.toCanvas(canvas, url, { width: 148, margin: 1 }, function () {});
    var parts = {
      form: document.getElementById("supBfcForm"), amount: document.getElementById("supAmount"), note: document.getElementById("supNote"),
      confirm: document.getElementById("supConfirm"), confirmText: document.getElementById("supConfirmText"),
      confirmBtn: document.getElementById("supConfirmBtn"), cancelBtn: document.getElementById("supCancelBtn"),
      status: document.getElementById("supBfcStatus"), signIn: document.getElementById("supSignIn")
    };
    isOwn(member.username).then(function (own) {
      if (own) {
        parts.form.hidden = true; parts.signIn.hidden = true;
        parts.status.textContent = "This is your support page. Share it with the buttons below.";
        return;
      }
      wireBizCash(parts, member);
    });
  }

  /* ── the block on the profile, storefront and card ─────────────────────────
     opts: { username, displayName, links, bizcash: true|false }. Draws nothing
     when there are no links and no BizCash to offer. */
  function mountPublic(container, opts) {
    if (!container) return;
    container.textContent = "";
    var links = (opts.links || []).filter(function (l) { return l && typeof l.url === "string" && l.url.indexOf("https://") === 0; });
    var canBizCash = opts.bizcash === true && opts.username && USERNAME.test(opts.username);
    if (!links.length && !canBizCash) { container.hidden = true; return; }
    container.hidden = false;
    container.appendChild(el("h2", { "class": "sup-title" }, "Support " + (opts.displayName || "this member")));
    if (links.length) container.appendChild(linkList(links));
    if (!canBizCash) return;
    isOwn(opts.username).then(function (own) {
      if (own) return;
      var box = el("div", { "class": "sup-box" });
      var signIn = el("a", { "class": "sup-btn", href: "/app.html" }, "Sign in to support with BizCash");
      var form = el("form"); form.hidden = true;
      var id = "sup" + Math.random().toString(36).slice(2, 8);
      form.appendChild(el("label", { "for": id + "A" }, "Amount (BFC)"));
      var amount = el("input", { id: id + "A", type: "number", min: "1", step: "1", inputmode: "numeric", required: "" });
      form.appendChild(amount);
      form.appendChild(el("label", { "for": id + "N" }, "Note (optional, 140 characters, only you and this member see it)"));
      var note = el("input", { id: id + "N", type: "text", maxlength: "140", autocomplete: "off" });
      form.appendChild(note);
      form.appendChild(el("button", { type: "submit", "class": "sup-btn" }, "Support with BizCash"));
      var confirm = el("div"); confirm.hidden = true;
      var confirmText = el("p");
      var row = el("div", { "class": "sup-row" });
      var confirmBtn = el("button", { type: "button", "class": "sup-btn" }, "Send");
      var cancelBtn = el("button", { type: "button", "class": "sup-btn" }, "Cancel");
      row.appendChild(confirmBtn); row.appendChild(cancelBtn);
      confirm.appendChild(confirmText); confirm.appendChild(row);
      var status = el("p", { "class": "sup-status", role: "status", "aria-live": "polite" });
      [signIn, form, confirm, status].forEach(function (n) { box.appendChild(n); });
      box.appendChild(el("a", { href: supportUrl(opts.username) }, "Open @" + opts.username + "'s support page"));
      container.appendChild(box);
      wireBizCash({ form: form, amount: amount, note: note, confirm: confirm, confirmText: confirmText, confirmBtn: confirmBtn,
        cancelBtn: cancelBtn, status: status, signIn: signIn }, { username: opts.username, displayName: opts.displayName || opts.username });
    });
  }

  /* ── "Your support link", on the member's own profile, card and wallet ──── */
  function mountOwnLink(container) {
    if (!container || !token()) return;
    fetch(API + "/api/support/me", { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        container.textContent = "";
        if (!d || !d.support_url) { container.hidden = true; return; }
        container.hidden = false;
        container.appendChild(el("h3", { "class": "sup-title" }, "Your support link"));
        var a = el("a", { href: d.support_url, "class": "sup-own-url" }, d.support_url);
        container.appendChild(a);
        if (!d.page_live) container.appendChild(el("p", { "class": "sup-disclaimer" }, "Your support page is off. Add a support link or turn it on in your profile's Support links."));
        var row = el("div", { "class": "sup-row" });
        var copy = el("button", { type: "button", "class": "sup-btn" }, "Copy");
        var shareBtn = el("button", { type: "button", "class": "sup-btn" }, "Share");
        var status = el("p", { "class": "sup-status", role: "status", "aria-live": "polite" });
        copy.addEventListener("click", function () { copyText(d.support_url).then(function () { status.textContent = "Link copied"; }, function () { status.textContent = "Copy this link: " + d.support_url; }); });
        shareBtn.addEventListener("click", function () { share(d.support_url, "Support me on BizForce", status); });
        row.appendChild(copy); row.appendChild(shareBtn);
        container.appendChild(row);
        container.appendChild(status);
      }, function () { container.hidden = true; });
  }

  /* ── the settings, on the member's own profile ─────────────────────────── */
  function mountSettings(container) {
    if (!container || !token()) return;
    var status = el("p", { "class": "sup-status", role: "status", "aria-live": "polite" });
    function draw(d) {
      container.textContent = "";
      container.appendChild(el("h3", { "class": "sup-title" }, "Support links"));
      container.appendChild(el("p", { "class": "sup-disclaimer" }, "Up to " + d.max_links + " links to your own payment pages. Payments go directly to you through the provider; BizForce does not handle, hold or refund them."));
      var rows = el("div");
      function addRow(link) {
        var r = el("div", { "class": "sup-row sup-link-row" });
        var sel = el("select", { "aria-label": "Provider" });
        d.providers.forEach(function (p) {
          var o = el("option", { value: p.provider }, p.label);
          if (link && link.provider === p.provider) o.selected = true;
          sel.appendChild(o);
        });
        var input = el("input", { type: "text", "aria-label": "Link or name", autocomplete: "off", maxlength: "200" });
        input.value = link ? link.url : "";
        function hint() { var p = d.providers.filter(function (x) { return x.provider === sel.value; })[0]; input.placeholder = p ? p.example : ""; }
        sel.addEventListener("change", hint); hint();
        var remove = el("button", { type: "button", "class": "sup-btn" }, "Remove");
        remove.addEventListener("click", function () { rows.removeChild(r); });
        r.appendChild(sel); r.appendChild(input); r.appendChild(remove);
        rows.appendChild(r);
      }
      (d.links || []).forEach(addRow);
      container.appendChild(rows);
      var add = el("button", { type: "button", "class": "sup-btn", id: "supAddLinkBtn" }, "Add a support link");
      add.addEventListener("click", function () {
        if (rows.children.length >= d.max_links) { status.textContent = "At most " + d.max_links + " support links."; return; }
        addRow(null);
      });
      container.appendChild(add);
      container.appendChild(el("label", { "for": "supHeadline" }, "Headline on your support page (optional, 120 characters)"));
      var headline = el("input", { id: "supHeadline", type: "text", maxlength: "120", autocomplete: "off" });
      headline.value = d.headline || "";
      container.appendChild(headline);
      function toggle(id, text, on) {
        var lab = el("label", { "class": "sup-toggle" });
        var box = el("input", { type: "checkbox", id: id });
        box.checked = !!on;
        lab.appendChild(box); lab.appendChild(document.createTextNode(" " + text));
        container.appendChild(lab);
        return box;
      }
      var pageOn = toggle("supPageOn", "My support page is on", d.page_live);
      var discover = toggle("supDiscover", "List my support page in search engines", d.discoverable);
      var save = el("button", { type: "button", "class": "sup-btn", id: "supSaveBtn" }, "Save support links");
      save.addEventListener("click", function () {
        var links = Array.prototype.map.call(rows.children, function (r) {
          return { provider: r.querySelector("select").value, value: r.querySelector("input").value };
        }).filter(function (l) { return l.value.trim(); });
        status.textContent = "Saving…";
        fetch(API + "/api/support/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token() },
          body: JSON.stringify({ links: links, headline: headline.value, page_on: pageOn.checked, discoverable: discover.checked })
        }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; }); })
          .then(function (res) {
            if (!res.ok) {
              var which = /^links\[(\d+)\]$/.exec(res.b.field || "");
              status.textContent = (which ? "Link " + (Number(which[1]) + 1) + ": " : "") + (res.b.error || "Your support links could not be saved.");
              return;
            }
            draw(res.b);
            status.textContent = "Saved.";
          }, function () { status.textContent = "BizForce could not be reached just now. Nothing was saved."; });
      });
      container.appendChild(save);
      container.appendChild(status);
    }
    fetch(API + "/api/support/me", { headers: { "Authorization": "Bearer " + token() } })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; }); })
      .then(function (res) {
        if (!res.ok) { container.textContent = ""; container.appendChild(el("p", { "class": "sup-status" }, res.b.error || "Support links could not be loaded.")); return; }
        draw(res.b);
      }, function () { container.textContent = "Support links could not be loaded."; });
  }

  root.BFSupport = { mountPublic: mountPublic, mountOwnLink: mountOwnLink, mountSettings: mountSettings, supportUrl: supportUrl, copyText: copyText, share: share };

  var main = document.getElementById("supportPage");
  if (main) supportPage(main);
})(window);

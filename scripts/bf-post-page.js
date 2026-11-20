/* ══════════════════════════════════════════════════════════════════════════
   bf-post-page.js — the buttons of a post's public page, bizforceai.net/p/<id>
   (P2-3, Nov 20 2026). The backend serves the page (lib/postPage.js) with the
   post filled in; this script only wires its buttons.

   Signed out: Like, Talk, Save and Follow keep this page in bf_return_to and go
   to sign-in (app.html), which comes back here. Signed in: they open the post
   in the app (home.html?post=<id>, Talk with &talk=1; Follow, the author's
   storefront). Share uses the device's share sheet, else copies the link. The
   three-dot menu (scripts/bf-safety.js) offers Report and the copyright notice.
   Nothing new is kept on the device.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var page = document.getElementById("postPage");
  if (!page || page.getAttribute("data-state") !== "on") return;
  var id = page.getAttribute("data-post-id"), url = page.getAttribute("data-post-url"), handle = page.getAttribute("data-handle");
  var token = null;
  try { token = localStorage.getItem("bf_token"); } catch (e) { token = null; }
  var status = document.getElementById("ppStatus");
  var hint = document.getElementById("ppSignedOut");
  if (token && hint) hint.hidden = true;

  Array.prototype.forEach.call(page.querySelectorAll("[data-pp-act]"), function (a) {
    var act = a.getAttribute("data-pp-act");
    if (token) {
      a.href = act === "follow" && handle ? "/@" + encodeURIComponent(handle) : "/home.html?post=" + encodeURIComponent(id) + (act === "talk" ? "&talk=1" : "");
      return;
    }
    a.addEventListener("click", function () {
      try { localStorage.setItem("bf_return_to", window.location.pathname); } catch (e) { /* signs in to the dashboard */ }
    });
  });

  var share = document.getElementById("ppShare");
  if (share) share.addEventListener("click", function () {
    var title = document.title;
    if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () { /* closed */ }); return; }
    var said = function (t) { if (status) status.textContent = t; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { said("Link copied: " + url); }, function () { said(url); });
    else said(url);
  });

  var menu = document.getElementById("ppMenu");
  if (menu && window.BFSafety) window.BFSafety.mount(menu, { type: "post", id: id, handle: handle || null, where: url });
})();

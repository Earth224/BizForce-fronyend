/* ══════════════════════════════════════════════════════════════════════════
   BF CAMPAIGN — a crowdfunding campaign's public page.

   On bizforceai.net/campaign/<share_id>, served with the campaign already
   filled in by the backend's lib/campaignShare.js. This script only wires
   what the server drew:
     - Share (the device's share sheet, or the link copied: "Link copied"),
       Copy link and a QR code of the page's own URL, the support page's way
       (scripts/bf-support.js copyText and share, the card's QR library);
     - for an active campaign, "Donate BizCash" for a signed-in visitor, which
       opens the donate flow on campaigns.html. A signed-out visitor gets
       "Sign in to donate", which comes back to that donate flow after
       sign-in (bf_return_to, as the support page does).
   It draws no text a member typed: the server already escaped every value.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var SHARE_ID = /^[a-z2-7]{16}$/;
  var main = document.getElementById("campaignPage");
  if (!main) return;
  var state = main.getAttribute("data-state");
  if (state !== "on" && state !== "ended") return;
  var shareId = main.getAttribute("data-share-id") || "";
  var url = main.getAttribute("data-share-url") || "";
  var title = main.getAttribute("data-title") || "A campaign on BizForce";
  if (!SHARE_ID.test(shareId)) return;

  function token() { try { return localStorage.getItem("bf_token") || ""; } catch (e) { return ""; } }

  var S = root.BFSupport;
  var shareStatus = document.getElementById("cmpShareStatus");
  var shareBtn = document.getElementById("cmpShareBtn");
  var copyBtn = document.getElementById("cmpCopyBtn");
  if (S && shareBtn) shareBtn.addEventListener("click", function () { S.share(url, title, shareStatus); });
  if (S && copyBtn) copyBtn.addEventListener("click", function () {
    S.copyText(url).then(function () { shareStatus.textContent = "Link copied"; }, function () { shareStatus.textContent = "Copy this link: " + url; });
  });
  var canvas = document.getElementById("cmpQr");
  if (root.QRCode && canvas) root.QRCode.toCanvas(canvas, url, { width: 148, margin: 1 }, function () {});

  if (state !== "on") return;
  var signIn = document.getElementById("cmpSignIn");
  var donate = document.getElementById("cmpDonate");
  if (!signIn || !donate) return;
  if (token()) {
    signIn.hidden = true;
    donate.hidden = false;
    return;
  }
  signIn.hidden = false;
  donate.hidden = true;
  signIn.addEventListener("click", function () {
    try { localStorage.setItem("bf_return_to", window.location.origin + "/campaigns.html?campaign=" + shareId); } catch (e) {}
  });
})(window);

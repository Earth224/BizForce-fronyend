/* ══════════════════════════════════════════════════════════════════════════
   BF CANONICAL — the canonical URL of a public page that shows one member's
   thing: a profile (?id=), a storefront (?u=), a marketplace listing
   (/listing/<id>). The page's head carries a static canonical; this script,
   loaded right after it and run before anything renders, rewrites it (and
   og:url) to bizforceai.net + this path + only the query parameters named in
   data-keep, so tracking parameters and the visitor's own spelling of the URL
   never become a second copy of the page.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var me = document.currentScript;
  var keep = String((me && me.getAttribute("data-keep")) || "").split(",").map(function (k) { return k.trim(); }).filter(Boolean);
  var from = new URLSearchParams(window.location.search), out = [];
  keep.forEach(function (k) {
    var v = from.get(k);
    if (v) out.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
  });
  var url = "https://bizforceai.net" + window.location.pathname + (out.length ? "?" + out.join("&") : "");
  var link = document.querySelector('link[rel="canonical"]');
  if (link) link.setAttribute("href", url);
  var og = document.querySelector('meta[property="og:url"]');
  if (og) og.setAttribute("content", url);
})();

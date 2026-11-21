/* BizForce service worker — the app shell, and push notifications.

   WHAT IT KEEPS. The app's own static files: the app pages in OFFLINE_PAGES
   and the stylesheet, scripts, icons and manifest in STATIC_FILES. Both are
   explicit lists; nothing else is ever put in the cache. That is what lets a
   page open with no connection. The member's data is not here: it is the
   opt-in saved copy in IndexedDB, kept by scripts/bf-offline.js.

   WHAT IT NEVER KEEPS. Anything under /api, any other origin (the API itself
   is on Railway), any request that is not a GET, and the sign-in and billing
   pages (NEVER_PAGES). Those are not handled at all: the browser fetches
   them exactly as it would with no worker. app.html is the login page and
   the page every ended session lands on, so it is never claimed.

   NETWORK FIRST, WITH A FALLBACK THAT ALWAYS ANSWERS. Online, every page
   and file comes from the network and the cached copy is refreshed. Only
   when the network fails is the cache read. A request this worker takes on
   always gets a Response: the cached file, or for a page, a short page
   saying it needs a connection. (The worker this replaces once claimed
   requests with a bare fetch and no fallback, and a failed navigation
   became an uncaught error; a claimed request here cannot end that way.)

   VERSIONED BY COMMIT. BUILD is replaced with the commit being deployed by
   the build command in netlify.toml, so each deploy is a new worker with a
   new cache, and activating it deletes every older bf-shell cache.

   NOTHING IS QUEUED. There is no sync or background-fetch handler: the
   worker never stores a request to send later. */

var BUILD = "__BF_BUILD__";
/* NAMED (Nov 19 2026, PH1): the shell's own version, bumped when the phone layout changed (css/bf-phone.css on every
   page, the orbit, the top bar). BEFORE the cache was "bf-shell-" + BUILD alone; AFTER it also carries SHELL_REV, so
   even a build whose commit placeholder is left as "local" starts a new cache, and activate deletes the older one. */
/* NAMED (Nov 19 2026, HQ1): BEFORE "ph1"; AFTER "hq1" (the phone card views, the orbit toggle, the Oracle set, the boombox autoplay fix). */
/* NAMED (Nov 19 2026, P2-1): BEFORE "hq1"; AFTER "p21" (the bottom bar, Home, the Inbox). */
/* NAMED (Nov 20 2026, P2-2): BEFORE "p21"; AFTER "p22" (the report, block and mute menu, Moderation, Copyright notices). */
/* NAMED (Nov 20 2026, P2-3): BEFORE "p22"; AFTER "p23" (posts, the Following feed, Talk, follows, the composer). */
/* NAMED (Nov 20 2026, FX1): BEFORE "p23"; AFTER "fx1" (Home's feed and the Profile as the approved design pictures). */
/* NAMED (Nov 20 2026, P3-1): BEFORE "fx1"; AFTER "p31" (free accounts: the members panel, the verification banner, landing by tier). */
/* NAMED (Nov 21 2026, P3-2): BEFORE "p31". AFTER "p32": the Verified badge (bf-verified.js), and the members panel on media and business ID. */
var SHELL_REV = "p32";
var CACHE = "bf-shell-" + BUILD + "-" + SHELL_REV;

var OFFLINE_PAGES = [
  "dashboard.html", "wallet.html", "your-data.html", "settings.html", "run.html", "agents-hub.html", "ai-agents.html",
  "ads-agent.html", "broker-agent.html", "community-agent.html", "email-agent.html", "etsy-agent.html", "executive-agent.html",
  "influencer-agent.html", "operations-agent.html", "publicist-agent.html", "rd-agent.html", "reputation-agent.html",
  "store-agent.html", "vertical-marketing-agent.html",
  "agents/analytics.html", "agents/content.html", "agents/sales.html", "agents/seo.html", "agents/social.html",
  "home.html", "inbox.html",   // NAMED (Nov 19 2026, P2-1): the phone app shell's Home and Inbox
  "moderation.html", "copyright.html",   // NAMED (Nov 20 2026, P2-2): the owner's Moderation and the copyright notice form
  "compose.html"   // NAMED (Nov 20 2026, P2-3): the composer, full screen on a phone
];
var STATIC_FILES = [
  "/css/bizforce-ui.css",
  "/css/bf-phone.css",   // NAMED (Nov 19 2026, PH1): the phone layout, linked by every page
  "/scripts/bf-session.js", "/scripts/bf-offline.js", "/scripts/bf-paywall.js", "/scripts/bf-bfc-notice.js",
  "/scripts/bf-identity.js", "/scripts/bf-agent-order.js", "/scripts/bf-orbit.js", "/scripts/agent-profile.js",
  "/scripts/bf-oracle-moon.js", "/scripts/bf-hq-views.js",   // NAMED (Nov 19 2026, HQ1): the dashboard loads both
  "/scripts/termaximus-guide.js", "/scripts/termaximus-presence.js", "/scripts/email-sequences.js", "/scripts/social-publish.js",
  /* NAMED (Nov 11 2026, polish): every same-origin script an offline page loads. Before, 26 of them were missing (the tab
     folders' bf-tabs.js among them), so a page opened offline had no tabs, no theme and no footer script. The cache's
     version needs no hand bump: BUILD below is the deploying commit (netlify.toml), so this deploy is a new cache. */
  "/scripts/agent-descriptions.js", "/scripts/bf-boombox.js", "/scripts/bf-command-center.js", "/scripts/bf-cycles.js",
  "/scripts/bf-exec-deck.js", "/scripts/bf-hq.js", "/scripts/bf-legal-footer.js", "/scripts/bf-music.js", "/scripts/bf-network.js",
  "/scripts/bf-support.js", "/scripts/bf-tabs.js", "/scripts/bf-theme-studio.js", "/scripts/bf-theme.js", "/scripts/bf-triggers.js",
  "/scripts/bf-why.js", "/scripts/bluesky-connect.js", "/scripts/bluesky-mentions.js", "/scripts/facebook.js", "/scripts/instagram.js",
  "/scripts/mastodon-connect.js", "/scripts/media-picker.js", "/scripts/oauth-return.js", "/scripts/store-changes.js",
  "/scripts/store-connect.js", "/scripts/tiktok.js", "/scripts/youtube.js",
  // NAMED (Nov 18 2026, LOGO1): the brand marks. NAMED (Nov 19 2026, LOGO2): now only the Layered Stack, loaded by
  // dashboard.html for its top bar.
  "/scripts/bf-marks.js",
  // NAMED (Nov 19 2026, P2-1): the bottom bar (bf-session.js loads it), the profile header and Settings, Local.
  "/scripts/bf-tabbar.js", "/scripts/bf-profile-shell.js", "/scripts/bf-local-settings.js",
  "/scripts/bf-safety.js",   // NAMED (Nov 20 2026, P2-2): the report, block and mute menu (the Inbox, Settings and Executive HQ load it)
  "/scripts/bf-feed.js", "/scripts/bf-composer.js",   // NAMED (Nov 20 2026, P2-3): posts on Home and the profile, and the composer
  "/scripts/bf-access.js",   // NAMED (Nov 20 2026, P3-1): the members panel and the verification banner (bf-session.js loads it)
  "/scripts/bf-verified.js",   // NAMED (Nov 21 2026, P3-2): the Verified badge (Home, the profile and the storefront load it)
  "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-192.png", "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png", "/icons/favicon-32.png", "/icons/icon.svg"
];
var NEVER_PAGES = ["app.html", "billing.html", "reset-password.html", "verify-email.html"];

var NEEDS_CONNECTION = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\">" +
  "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>Offline — BizForce AI</title></head>" +
  "<body style=\"margin:0;background:#070b18;color:#e8e8ff;font:16px/1.6 system-ui,-apple-system,'Segoe UI',Arial,sans-serif\">" +
  "<main style=\"max-width:560px;margin:0 auto;padding:48px 20px\"><h1 style=\"font-size:1.5rem\">You're offline</h1>" +
  "<p>This page needs a connection: there is no copy of it on this device. Nothing has been sent or changed.</p>" +
  "<p>Reconnect, then reload. This page reloads by itself when the connection comes back.</p></main>" +
  "<script>window.addEventListener(\"online\", function () { location.reload(); });</script></body></html>";

// "/dashboard" and "/dashboard.html" are one page (Netlify serves both).
function pageName(pathname) {
  var p = pathname.replace(/^\/+/, "");
  if (p && !/\.[a-z0-9]+$/i.test(p)) p += ".html";
  return p;
}

/* "pass": not handled; the browser fetches it untouched.
   "page": an app page, network first, cached copy if offline.
   "static": an app file, the same.
   "online-page": any other page of this site, network only, with the
   needs-a-connection page if offline. Never cached. */
function classify(request) {
  if (request.method !== "GET") return "pass";
  var url;
  try { url = new URL(request.url); } catch (e) { return "pass"; }
  if (url.origin !== self.location.origin) return "pass";
  if (url.pathname === "/api" || url.pathname.indexOf("/api/") === 0) return "pass";
  var name = pageName(url.pathname);
  if (NEVER_PAGES.indexOf(name) !== -1) return "pass";
  if (request.mode === "navigate") return OFFLINE_PAGES.indexOf(name) !== -1 ? "page" : "online-page";
  if (STATIC_FILES.indexOf(url.pathname) !== -1) return "static";
  return "pass";
}

function keyFor(request, kind) {
  var url = new URL(request.url);
  return kind === "page" ? "/" + pageName(url.pathname) : url.pathname;
}

function needsConnection() {
  return new Response(NEEDS_CONNECTION, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

function keep(cache, key, response) {
  if (!response || !response.ok || response.redirected || response.type !== "basic") return null;
  return cache.put(key, response);
}

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(function (cache) {
    var all = OFFLINE_PAGES.map(function (p) { return "/" + p; }).concat(STATIC_FILES);
    /* A file that fails is skipped rather than failing the install: a worker
       that installs with most of the shell is better than none. */
    return Promise.all(all.map(function (key) {
      return fetch(key, { cache: "no-cache" }).then(function (r) { return keep(cache, key, r); }, function () { return null; });
    }));
  }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (names) {
    return Promise.all(names.filter(function (n) { return n.indexOf("bf-shell-") === 0 && n !== CACHE; })
      .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var kind = classify(event.request);
  if (kind === "pass") return;
  if (kind === "online-page") {
    event.respondWith(fetch(event.request).catch(function () { return needsConnection(); }));
    return;
  }
  var key = keyFor(event.request, kind);
  event.respondWith(fetch(event.request).then(function (response) {
    var copy = response && response.ok ? response.clone() : null;
    if (copy) caches.open(CACHE).then(function (cache) { return keep(cache, key, copy); }).catch(function () {});
    return response;
  }, function () {
    return caches.open(CACHE).then(function (cache) { return cache.match(key); }).then(function (hit) {
      if (hit) return hit;
      return kind === "page" ? needsConnection() : Response.error();
    }, function () {
      return kind === "page" ? needsConnection() : Response.error();
    });
  }));
});

self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }

  var title = data.title || "BizForce";
  var body = data.body || "";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      /* These pointed at /favicon.ico, which has never existed in this
         repo — push notifications have been rendering with no icon.
         Repointed at the app icons added alongside the manifest. */
      icon: "/icons/icon-192.png",
      badge: "/icons/favicon-32.png"
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ("focus" in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    })
  );
});

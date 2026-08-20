/* BizForce service worker — push notifications, plus the fetch handler
   Chrome requires before it will offer "Add to home screen".

   The original version of this file said "no caching, no fetch handler;
   this repo already has a service worker caching problem and this file
   must not add to it." The fetch handler below is added under that
   constraint, not in spite of it: there is no caches.open, no
   caches.match, and no caches.put anywhere in this file. Every request it
   touches goes to the network, every time. The handler exists because
   Chrome's install criteria require one to be registered — not because
   anything here should be stored.

   The install prompt is the only thing gained. Nothing is served offline,
   and that is deliberate. */

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

/* The API this app talks to. Named explicitly rather than relying on the
   cross-origin check below, so that if the backend is ever moved behind a
   same-origin proxy path the exclusion does not silently stop applying. */
var API_ORIGIN = "https://dynamic-prosperity-production-5382.up.railway.app";

self.addEventListener("fetch", function (event) {
  var request = event.request;

  /* Returning without calling respondWith leaves the request entirely
     alone — the browser handles it exactly as it would with no service
     worker installed. That is the correct outcome for everything this
     worker has no business touching. */

  if (request.method !== "GET") {
    return;
  }

  var url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return;
  }

  /* The backend is never intercepted. A lead score, a subscription status
     or an agent's task list read back one version late is worse than any
     benefit this worker could offer, and the surest way to guarantee that
     never happens is to not handle these requests at all. */
  if (url.origin === API_ORIGIN || url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.indexOf("/api/") === 0) {
    return;
  }

  /* Range requests are how the browser seeks audio and video. Wrapping
     them in a plain fetch() breaks scrubbing on the pages that carry
     media, so they are left alone too. */
  if (request.headers.has("range")) {
    return;
  }

  event.respondWith(fetch(request));
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

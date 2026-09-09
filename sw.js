/* BizForce service worker — push notifications. It handles no requests.

   There is no caches.open, no caches.match and no caches.put anywhere in
   this file, and there never has been. Nothing is stored, so there is
   nothing this worker can serve that the network would not serve better. */

self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

/* REGISTERED, AND DELIBERATELY DOES NOTHING.

   This handler existed for one reason: Chrome's install criteria wanted a
   fetch handler present before it would offer "Add to home screen". That
   criterion is about a handler being REGISTERED, not about it answering
   anything — so the listener stays, and every request returns early.

   What it used to do was `event.respondWith(fetch(request))` for every
   same-origin GET. That is a bare passthrough, and since this worker
   caches nothing it bought exactly nothing: the same network request the
   browser would have made anyway, routed through an extra hop.

   What it cost was a failure mode. Calling respondWith means claiming the
   request — the browser hands over responsibility and waits for a
   Response. But a worker with no cache has nothing to build a Response
   from when that fetch rejects, and there was no fallback, so the
   rejection propagated: the FetchEvent resolved to a synthesized network
   error and the same rejection surfaced again as an uncaught TypeError.

   THAT WAS LANDING ON app.html — the login page, and the page every
   expired session is redirected to. So the one line took the worst moment
   in the app, when a session had just ended and the user was being sent
   somewhere to recover, and turned any failed or cancelled navigation
   there into an uncaught error instead of a page.

   A .catch would not fix this. It keeps the worker owning the request and
   forces it to invent a response out of nothing. Returning early hands the
   request back to the browser untouched — its own error page, its own
   retry, its own bfcache — all of which are strictly better than a
   passthrough with no fallback. Not handling a request is a real answer
   here, and it is the whole answer. */
self.addEventListener("fetch", function (event) {
  return;
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

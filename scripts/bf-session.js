/* ══════════════════════════════════════════════════════════════════════════
   BF SESSION GUARD — what it fixes.

   Every protected page carried this inline, in the head:

     <script>(function(){var t=localStorage.getItem("bf_token");
       if(!t)window.location.replace("/app.html");})();</script>

   That tests whether a token STRING EXISTS. It never tests whether the token
   is still valid, and nothing anywhere in the frontend handled a 401 — a
   search of the repo for "401" or "Unauthorized" found no handling at all.

   The access token is a JWT signed with expiresIn "7d", so on day eight the
   string was still sitting in localStorage and the guard was still satisfied
   by it. The page rendered, the shell drew, and then every API call came back
   401 into per-call error handling that says things like "something went
   wrong". The user was shown a broken product instead of a login screen.

   This file replaces that snippet with the same presence check plus the two
   things it could never do: renew the session when the server says the token
   has expired, and — when renewal is not possible — redirect to the login
   page carrying the reason.

   RENEWAL IS THE POINT NOW. The backend issues a refresh token at login and
   register and rotates it on every use (POST /api/auth/refresh). A 401 is no
   longer the end of a session; it is the moment to exchange the refresh token
   for a new access token and carry on. The redirect is the fallback, not the
   first move.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var TOKEN_KEY   = "bf_token";
  var REFRESH_KEY = "bf_refresh";
  var USER_KEY    = "bf_user";
  var LOGIN_PAGE  = "/app.html";

  /* Last-resort default only. The live value is read from window.API_URL at
     call time instead, because this script runs in <head> and every page
     declares `var API_URL = "..."` in a later script — so the constant does not
     exist yet at load, but always does by the time a fetch happens. */
  var API_ORIGIN_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";

  /* Routes that ISSUE credentials. A 401 from one of these means "those
     credentials were wrong", not "your session ended", and acting on it would
     be a loop.

     /api/auth/refresh IS ON THIS LIST AND MUST STAY ON IT. A 401 from the
     refresh route means the refresh token is dead — it is the one answer that
     definitively ends the session — and treating it as "try refreshing" would
     recurse forever, each failure triggering another attempt. The refresh call
     below also goes out through nativeFetch rather than the wrapper, so the
     loop is closed twice over: even if this list were edited, the refresh
     request would never reach the interceptor. */
  var EXEMPT_PATHS = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/auth/password-reset",
    "/api/auth/verify-email"
  ];

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
  }

  /* ── 1. The presence guard, unchanged in behaviour ──────────────────────
     Same test and same effect as the snippet this replaces. It stays a
     presence test on purpose: decoding the JWT here to check `exp` would move
     an authority decision into the client, and the client's clock is not
     evidence. The server answers; this listens. */
  if (!read(TOKEN_KEY)) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  var nativeFetch = window.fetch;
  if (typeof nativeFetch !== "function") return;

  var redirecting = false;

  function apiOrigin() {
    var configured = (typeof window.API_URL === "string" && window.API_URL) || API_ORIGIN_FALLBACK;
    try { return new URL(configured, window.location.href).origin; } catch (e) { return null; }
  }

  /* fetch accepts a string, a URL, or a Request. All three are resolved against
     the current document so a relative path is comparable to an absolute one,
     and anything unparseable yields null — which the checks below read as "not
     the API", the safe direction: an unrecognised call can never sign anyone
     out. */
  function urlOf(input) {
    try {
      if (typeof input === "string") return new URL(input, window.location.href);
      if (input instanceof URL) return input;
      if (input && typeof input.url === "string") return new URL(input.url, window.location.href);
    } catch (e) { /* fall through */ }
    return null;
  }

  function isApiCall(u) {
    var origin = apiOrigin();
    return !!u && !!origin && u.origin === origin;
  }

  function isExempt(u) {
    if (!u) return true;
    for (var i = 0; i < EXEMPT_PATHS.length; i++) {
      if (u.pathname.indexOf(EXEMPT_PATHS[i]) === 0) return true;
    }
    return false;
  }

  function endSession() {
    if (redirecting) return;
    redirecting = true;

    try {
      localStorage.removeItem(TOKEN_KEY);
      /* The refresh token goes too. It is a live credential — it can mint
         access tokens without a password — so leaving it behind after the
         session has ended would be leaving the front door key under the mat. */
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) { /* storage unavailable; the redirect still matters */ }

    /* THE REASON TRAVELS IN THE URL, and app.html reads it. A redirect that
       drops the reason lands the user on a login form having been thrown out
       of a page they were using, which reads as the app logging them out at
       random. In the query string rather than sessionStorage so it survives
       regardless of storage being writable — the same condition that may have
       made the session unreadable in the first place. */
    window.location.replace(LOGIN_PAGE + "?session=expired");
  }

  /* ── 2. Renewal ─────────────────────────────────────────────────────────

     ONE ATTEMPT AT A TIME, SHARED BY EVERY CALLER. A page that fires five
     requests on load will get five 401s within milliseconds of each other. If
     each started its own refresh, the first would rotate the token and the
     other four would present a refresh token that had just been revoked —
     which the backend reads as REUSE, not as a race, and answers by revoking
     every session the user has. Five parallel refreshes would not merely be
     wasteful; they would log the user out of everything and look exactly like
     a stolen credential in the server logs.

     So the in-flight promise is held here and every caller awaits the same
     one. It is cleared when it settles, so a later 401 can start a fresh
     attempt — the sharing window is precisely the time one is running. */
  var refreshInFlight = null;

  function performRefresh() {
    var refreshToken = read(REFRESH_KEY);
    if (!refreshToken) return Promise.resolve(false);

    var origin = apiOrigin();
    if (!origin) return Promise.resolve(false);

    /* nativeFetch, not window.fetch: this request must never pass through the
       interceptor below. See the note on EXEMPT_PATHS. */
    return nativeFetch(origin + "/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken })
    }).then(function (response) {
      if (!response || !response.ok) return false;

      return response.json().then(function (data) {
        if (!data || !data.token || !data.refresh_token) return false;

        /* BOTH are replaced. The backend rotates on every use, so the refresh
           token just spent is already revoked server-side — keeping it would
           guarantee that the next renewal is read as reuse. */
        write(TOKEN_KEY, data.token);
        write(REFRESH_KEY, data.refresh_token);
        if (data.profile) write(USER_KEY, JSON.stringify(data.profile));
        return true;
      }, function () { return false; });
    }, function () { return false; });
  }

  function refreshSession() {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = performRefresh().then(function (ok) {
      refreshInFlight = null;
      return ok;
    }, function () {
      refreshInFlight = null;
      return false;
    });

    return refreshInFlight;
  }

  /* The retry has to carry the NEW access token. The caller built its headers
     before the refresh happened, so replaying the request untouched would send
     the same expired token straight back and earn the same 401 — the renewal
     would work and the retry would still fail. Only an existing Authorization
     header is rewritten; a request that was not authenticated by header is
     left exactly as it was. */
  function retryArgs(input, init) {
    var token = read(TOKEN_KEY);
    if (!token) return [input, init];

    var headers = (init && init.headers) || null;

    if (headers && typeof headers.get === "function" && typeof headers.set === "function") {
      var cloned = new Headers(headers);
      if (cloned.has("Authorization")) cloned.set("Authorization", "Bearer " + token);
      return [input, Object.assign({}, init, { headers: cloned })];
    }

    if (headers && typeof headers === "object") {
      var rebuilt = {};
      for (var name in headers) {
        if (!Object.prototype.hasOwnProperty.call(headers, name)) continue;
        rebuilt[name] = (name.toLowerCase() === "authorization")
          ? ("Bearer " + token)
          : headers[name];
      }
      return [input, Object.assign({}, init, { headers: rebuilt })];
    }

    /* A Request object carries its own headers and its own body. Rebuilding it
       is only safe while the body has not been read; every call in this app
       passes a URL string plus an init object, so this branch exists for
       completeness rather than for a caller that exists today. */
    if (input && typeof input.url === "string" && typeof Request === "function") {
      try {
        var reqHeaders = new Headers(input.headers);
        if (reqHeaders.has("Authorization")) {
          reqHeaders.set("Authorization", "Bearer " + token);
          return [new Request(input, { headers: reqHeaders }), init];
        }
      } catch (e) { /* fall through and replay as-is */ }
    }

    return [input, init];
  }

  /* ── 3. The interceptor ────────────────────────────────────────────────── */
  window.fetch = function (input, init) {
    var target = urlOf(input);
    var self = this;

    if (!isApiCall(target) || isExempt(target)) {
      return nativeFetch.apply(self, arguments);
    }

    /* Captured before the request goes out so a 401 can tell the difference
       between "my token expired" and "my token was already replaced while I
       was in flight" — see below. */
    var tokenAtSend = read(TOKEN_KEY);

    return nativeFetch.apply(self, arguments).then(function (response) {
      if (!response || response.status !== 401) return response;

      /* NO REFRESH TOKEN, NO ATTEMPT. This is the state of everyone who signed
         in before refresh tokens existed: they hold a bf_token and nothing
         else. There is nothing to exchange, so they go straight to the login
         page with the reason, which is exactly what this file did before
         renewal was possible. */
      if (!read(REFRESH_KEY)) {
        endSession();
        return response;
      }

      /* If the stored token changed while this request was in flight, another
         caller already renewed. Retry on the new token rather than spending a
         second rotation to reach the same place. */
      var renewal = (read(TOKEN_KEY) !== tokenAtSend)
        ? Promise.resolve(true)
        : refreshSession();

      return renewal.then(function (renewed) {
        if (!renewed) {
          endSession();
          return response;
        }

        /* REPLAYING THE REQUEST WORKS BECAUSE THE BODIES HERE ARE STRINGS —
           JSON.stringify output, or FormData, both of which can be sent twice.
           A streamed body could not: a ReadableStream is consumed by the first
           send and the second would fail or silently transmit nothing. If a
           streaming upload is ever introduced, THIS is the line that breaks,
           and it will break as a request that succeeds with an empty body
           rather than as an error. */
        var args = retryArgs(input, init);

        return nativeFetch.apply(self, args).then(function (retried) {
          /* ONCE, NEVER TWICE. A 401 on the retry means the brand-new access
             token was rejected too, so the problem is not staleness and
             another refresh would not fix it — it would just spend rotations
             against a server that has already said no. */
          if (retried && retried.status === 401) {
            endSession();
          }
          return retried;
        });
      });
    });
  };
})();

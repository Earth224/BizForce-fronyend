/* ══════════════════════════════════════════════════════════════════════════
   BF SESSION GUARD — what it fixes.

   Every protected page carried this inline, in the head:

     <script>(function(){var t=localStorage.getItem("bf_token");
       if(!t)window.location.replace("/app.html");})();</script>

   That tests whether a token STRING EXISTS. It never tests whether the token
   is still valid, and nothing anywhere in the frontend handled a 401 — a
   search of the repo for "401" or "Unauthorized" found no handling at all.

   The token is a JWT with expiresIn "7d" and there is no refresh route, so on
   day eight the string is still sitting in localStorage and the guard is still
   satisfied by it. The page rendered, the shell drew, and then every single API
   call came back 401 into per-call error handling that says things like
   "something went wrong". The user was shown a broken product instead of a
   login screen, with no indication that signing in again was the fix.

   This file replaces that snippet with the same presence check plus the missing
   half: a fetch wrapper that notices a 401 from the API and turns it into the
   redirect the presence check could never perform, carrying a reason with it.

   IT DOES NOT EXTEND OR REFRESH ANYTHING. The token's lifetime, a refresh
   route, and any server-side session record are a separate decision. This only
   makes an expired session fail honestly.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var TOKEN_KEY  = "bf_token";
  var USER_KEY   = "bf_user";
  var LOGIN_PAGE = "/app.html";

  /* Absolute, not relative. The inline guard existed in two variants — 25 pages
     redirected to "app.html" and 23 to "/app.html" — which happened to agree
     only because every relative one sat at the document root. A page added
     under agents/ with the relative form would have bounced to
     /agents/app.html, which does not exist. One absolute form removes that. */

  /* Last-resort default only. The live value is read from window.API_URL at
     call time instead, because this script runs in <head> and every page
     declares `var API_URL = "..."` in a later script — so the constant does not
     exist yet at load, but always does by the time a fetch happens. Reading it
     late means this file cannot drift from the value the pages actually use. */
  var API_ORIGIN_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";

  /* The routes that ISSUE a token. A 401 from one of these means "those
     credentials were wrong", not "your session ended" — and acting on it would
     be a redirect loop: a failed sign-in would clear storage and bounce back to
     the sign-in page, which is where the user already was. Prefix-matched so
     the confirm/callback variants are covered with their parents. */
  var EXEMPT_PATHS = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/password-reset",
    "/api/auth/verify-email"
  ];

  function readToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  /* ── 1. The presence guard, unchanged in behaviour ──────────────────────
     Same test and same effect as the snippet this replaces, kept so this file
     can take that snippet's place rather than sit beside it. It stays a
     presence test on purpose: decoding the JWT here to check `exp` would move
     an authority decision into the client, and the client's clock is not
     evidence. The wrapper below lets the server answer instead. */
  if (!readToken()) {
    window.location.replace(LOGIN_PAGE);
    return;
  }

  /* ── 2. The 401 wrapper ─────────────────────────────────────────────── */
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
      localStorage.removeItem(USER_KEY);
    } catch (e) { /* storage unavailable; the redirect still matters */ }

    /* THE REASON TRAVELS IN THE URL, and app.html reads it. A redirect that
       drops the reason lands the user on a login form with no explanation of
       why they were thrown out of a page they were using, which reads as the
       app having logged them out at random. In the query string rather than
       sessionStorage so it survives regardless of storage being writable —
       which is the same condition that may have made the session unreadable in
       the first place. app.html strips it from the URL after showing it. */
    window.location.replace(LOGIN_PAGE + "?session=expired");
  }

  window.fetch = function (input, init) {
    var target = urlOf(input);

    return nativeFetch.apply(this, arguments).then(function (response) {
      /* Only the status is read. The body is left untouched and unconsumed, so
         the caller still gets a readable response and existing error handling
         behaves exactly as before — this observes, it does not intercept. */
      if (response && response.status === 401 && isApiCall(target) && !isExempt(target)) {
        endSession();
      }
      return response;
    });
  };
})();

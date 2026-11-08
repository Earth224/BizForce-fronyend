/* ══════════════════════════════════════════════════════════════════════════
   The sign-in return, shared, on the Social agent's page (agents/social.html).
   Loaded BEFORE scripts/youtube.js, scripts/tiktok.js and
   scripts/instagram.js.

   Google, TikTok and Instagram all send the browser back to this same page
   with ?code and ?state (or ?error). Before leaving, the platform's script
   calls BFOAuthReturn.mark(name), which sets sessionStorage
   "bf_oauth_return" to "youtube", "tiktok" or "instagram". This file reads
   the query ONCE, as the page loads:
     - no code, state or error: nothing happens;
     - the marker names one of the three: the marker is cleared, and the
       answer is handed to the ONE script that registered under that name
       (BFOAuthReturn.register), which finishes the sign-in and strips the
       query with history.replaceState whatever the answer;
     - no marker, or an unknown one: the query is stripped at once, and
       BFOAuthReturn.orphaned() is true, so scripts/youtube.js says
       "Start the connection again.".
   No platform script reads ?code or ?state itself. Nothing here shows,
   stores or sends the code; nothing here uses innerHTML.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var RETURN_KEY = "bf_oauth_return";
  var PAGE_PATH = "/agents/social.html";
  var NAMES = ["youtube", "tiktok", "instagram"];
  var pending = null;
  var orphaned = false;

  function readMarker() { try { return sessionStorage.getItem(RETURN_KEY); } catch (e) { return null; } }
  function clearMarker() { try { sessionStorage.removeItem(RETURN_KEY); } catch (e) { /* nothing stored */ } }
  function strip() { try { window.history.replaceState(null, "", PAGE_PATH); } catch (e) { /* nothing to strip */ } }

  (function parse() {
    var q;
    try { q = new URLSearchParams(window.location.search || ""); } catch (e) { return; }
    var code = q.get("code"), state = q.get("state"), error = q.get("error");
    if (!code && !state && !error) return;
    var which = readMarker();
    if (NAMES.indexOf(which) === -1) {
      strip();
      orphaned = true;
      return;
    }
    clearMarker();
    pending = { name: which, code: code, state: state, error: error };
  })();

  /* The handler gets { code, state, error } when this page came back from
     its platform. True when it did (the script then waits for its handler). */
  function register(name, handler) {
    if (NAMES.indexOf(name) === -1 || typeof handler !== "function") return false;
    if (!pending || pending.name !== name) return false;
    var answer = { code: pending.code, state: pending.state, error: pending.error };
    pending = null;
    handler(answer);
    return true;
  }

  /* Set right before the browser leaves for the platform's sign-in page. */
  function mark(name) {
    if (NAMES.indexOf(name) === -1) return;
    try { sessionStorage.setItem(RETURN_KEY, name); } catch (e) { /* the return then asks to start again */ }
  }

  window.BFOAuthReturn = {
    register: register,
    mark: mark,
    strip: strip,
    orphaned: function () { return orphaned; }
  };
})();

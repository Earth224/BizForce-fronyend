/* Shared identity resolution for anything that reads localStorage bf_user.
   ─────────────────────────────────────────────────────────────────────────
   bf_user holds a `profiles` row, not a user row — app.html stores
   `data.profile` on both login and registration. That row carries several
   names and any of them can be null, so a page that reads only one field
   shows a placeholder to people it could have identified.

   dashboard.html and settings.html both need this and had drifted apart:
   the dashboard resolved business_name → full_name → username → email
   local part, while settings resolved business_name → name → full_name,
   where `name` is a column on neither the profile nor the user object and
   could never match anything. Rather than fix the chain twice and let it
   drift again, both pages now call these.

   Loaded as a classic script, so it executes in document order and is
   available to any inline block placed after its tag. A page whose inline
   caller sits inside a try/catch degrades to its own placeholder if this
   file fails to load, which is the same thing it shows for a user with no
   profile — no worse than the state it is already designed to handle. */
(function (global) {
  "use strict";

  /* The display name, or "" when the row carries nothing usable.
     Order matters: business_name is what this platform is about, full_name
     and username identify the person when the business is unnamed, and the
     email local part is the last resort before giving up — it is always
     something, but it is a login, not a name, which is why callers that
     show an email separately need to know it was used. */
  function bfDisplayName(u) {
    if (!u || typeof u !== "object") { return ""; }
    var emailLocal = typeof u.email === "string" ? u.email.split("@")[0] : "";
    return String(u.business_name || u.full_name || u.username || emailLocal || "").trim();
  }

  /* True when bfDisplayName had to fall back to the email local part, i.e.
     the row carried no actual name. A caller that renders "name — email"
     uses this to avoid "owner — owner@example.com". */
  function bfNameIsEmailFallback(u) {
    if (!u || typeof u !== "object") { return false; }
    if (u.business_name || u.full_name || u.username) { return false; }
    return typeof u.email === "string" && u.email.indexOf("@") !== -1;
  }

  /* Up to two initials, uppercased. "BF" rather than a person's initials
     when there is no name — this used to default to the owner's own "ER",
     which every account without a stored profile was shown. */
  function bfUserInitials(name) {
    if (!name) { return "BF"; }
    return name.split(/\s+/).filter(Boolean).map(function (w) {
      return w[0];
    }).join("").slice(0, 2).toUpperCase();
  }

  global.bfDisplayName = bfDisplayName;
  global.bfNameIsEmailFallback = bfNameIsEmailFallback;
  global.bfUserInitials = bfUserInitials;
})(window);

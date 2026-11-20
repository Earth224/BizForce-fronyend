/* ══════════════════════════════════════════════════════════════════════════
   bf-local-settings.js — Settings, Local (P2-1, Nov 19 2026).

   The member's place for the Local feed: a city and a region they type, a
   country chosen from the list the server gives (ISO 3166-1 codes, named
   here in the member's language by Intl.DisplayNames), and "Show my posts in
   Local" (off until turned on). GET /api/me/place reads it and PUT saves it
   (lib/places.js holds the rules). NOTHING HERE ASKS FOR THE DEVICE'S
   LOCATION: no geolocation, no lookup.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var panel = document.getElementById("panel-local");
  var token = null;
  try { token = localStorage.getItem("bf_token"); } catch (e) { token = null; }
  if (!panel || !token || window.BFLocalSettings) return;
  var API = (typeof window.API_URL === "string" && window.API_URL) || "https://dynamic-prosperity-production-5382.up.railway.app";
  var city = document.getElementById("placeCity");
  var region = document.getElementById("placeRegion");
  var country = document.getElementById("placeCountry");
  var optIn = document.getElementById("localOptIn");
  var save = document.getElementById("placeSaveBtn");
  var msg = document.getElementById("placeMsg");

  function say(text, kind) { msg.textContent = text; msg.className = "msg" + (kind ? " " + kind : ""); }
  function countryName(code) {
    try { if (window.Intl && Intl.DisplayNames) return new Intl.DisplayNames([navigator.language || "en"], { type: "region" }).of(code) || code; } catch (e) { /* older browser */ }
    return code;
  }
  function fillCountries(codes) {
    var opts = codes.map(function (c) { return { code: c, name: countryName(c) }; })
      .sort(function (a, b) { return a.name.localeCompare(b.name); });
    country.innerHTML = '<option value="">Not set</option>' + opts.map(function (o) {
      return '<option value="' + o.code + '">' + String(o.name).replace(/&/g, "&amp;").replace(/</g, "&lt;") + '</option>';
    }).join("");
  }
  function show(place) {
    city.value = place.place_city || "";
    region.value = place.place_region || "";
    country.value = place.place_country || "";
    optIn.checked = place.local_opt_in === true;
  }

  function load() {
    save.disabled = true;
    return fetch(API + "/api/me/place", { headers: { "Authorization": "Bearer " + token } })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) { fillCountries(d.countries || []); show(d.place || {}); save.disabled = false; say("", ""); })
      .catch(function () { say("Your place could not be loaded, so saving is off until it loads. Reload to try again.", "err"); });
  }

  save.addEventListener("click", function () {
    save.disabled = true;
    say("Saving...", "");
    fetch(API + "/api/me/place", {
      method: "PUT",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ place_city: city.value, place_region: region.value, place_country: country.value || null, local_opt_in: optIn.checked })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || "Your place could not be saved.");
        show(res.d.place || {});
        say("Saved.", "ok");
      })
      .catch(function (e) { say(e.message || "Your place could not be saved.", "err"); })
      .then(function () { save.disabled = false; });
  });

  // settings.html#local opens this section.
  if (window.location.hash === "#local") {
    var nav = document.querySelector('.sidebar-item[data-target="local"]');
    if (nav) nav.click();
  }
  window.BFLocalSettings = { load: load };
  load();
})();

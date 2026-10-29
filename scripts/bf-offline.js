/* ══════════════════════════════════════════════════════════════════════════
   BF OFFLINE — the saved copy, and what a page does with no connection.

   OPT-IN, OFF BY DEFAULT. Nothing is kept on the device unless the member
   turns on "Keep a copy on this device for offline use" (Settings, Account;
   and Your data). The setting is one localStorage key, bf_offline_copy.

   WHAT IS SAVED. When the setting is on, each successful GET of one of the
   SAVED_READS below is saved to this browser's IndexedDB (database
   "bf-offline"), with the time, after keys that could hold a credential or a
   payment detail are dropped. Nothing else is saved: not a write, not the
   data export, not a billing route, not a page the list does not name. At
   most 1 MB per response and about 5 MB in all; the oldest goes first.
   lib/yourData.js in the backend describes the same list on the Your data
   page, and the backend's scripts/checkOfflineMode.js holds the two equal.

   WHEN IT IS DELETED. Turning the setting off deletes the database at once.
   Every sign-out path deletes it and the setting too: dashboard.html and
   settings.html's Sign Out, bf-session.js's end of an expired session, the
   account delete on your-data.html, and app.html whenever it opens with no
   session. Those paths clear it inline, so they work on a page that does not
   load this file.

   OFFLINE. A GET to the API that fails for a network reason (the fetch
   rejects) is answered from the saved copy when there is one, and the page
   says so in a banner with the time the copy was saved. A 401 or a 402 is the
   server answering, not a network failure, and is passed through untouched.
   While offline every button on the page is disabled, except navigation and
   Sign Out, and a form cannot submit; a write that is attempted anyway is
   refused here and never sent. NOTHING IS QUEUED: no request is stored to be
   sent later, so nothing can fire unexpectedly when the connection returns.
   Back online, the page reloads and the banner goes with it.

   Load it after bf-session.js, so its fetch wrapper sits outside that one's:
   a 401 still reaches the session renewal first.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFOffline) return;

  var SETTING_KEY = "bf_offline_copy";
  var DB_NAME = "bf-offline";
  var STORE = "copies";
  var MAX_ENTRY_CHARS = 1024 * 1024;
  var MAX_TOTAL_CHARS = 5 * 1024 * 1024;
  var API_ORIGIN_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";

  var SETTING_LABEL = "Keep a copy on this device for offline use";

  /* The reads that are saved, and what each is called on the page. Each
     description here is word for word in lib/yourData.js's DEVICE_COPY. */
  var SAVED_READS = [
    { path: /^\/api\/ai\/tasks$/, what: "your recent tasks and their results" },
    { path: /^\/api\/ai\/tasks\/[A-Za-z0-9-]+$/, what: "your recent tasks and their results" },
    { path: /^\/api\/business-profile$/, what: "your business profile" },
    { path: /^\/api\/agents$/, what: "your agents and their last runs" },
    // not /api/agents/live: live activity is never answered from an old copy
    { path: /^\/api\/agents\/(?!live$)[a-z_]+$/, what: "your agents and their last runs" },
    { path: /^\/api\/wallet$/, what: "your wallet balance and history" },
    { path: /^\/api\/auth\/me$/, what: "your account details (email address, profile, and whether your plan is active)", drop: ["subscription"] },
    { path: /^\/api\/your-data$/, what: "the description on the Your data page" }
  ];
  var NEVER_STORED = [
    "your sign-in tokens",
    "payment details",
    "the download of your data",
    "other members' private data"
  ];
  /* Dropped from every saved response, at any depth. The subscription row of
     /api/auth/me carries Stripe ids, so that read drops it whole as well. */
  var SECRET_KEY = /token|secret|password|refresh|stripe|card|payment|billing|iban|api_?key/i;

  var SAVED_PREFIX = "Offline — showing your saved copy from ";
  var SAVED_SUFFIX = ". Nothing can be sent or changed until you're back online.";
  var NEEDS_TEXT = "Offline — this page needs a connection: there is no saved copy of it on this device. Nothing can be sent or changed until you're back online.";
  var LOCK_REASON = "Offline: nothing can be sent or changed until you're back online.";
  var WRITE_CONTROLS = "button, input[type=submit], input[type=button], input[type=image], input[type=reset]";

  function enabled() {
    try { return localStorage.getItem(SETTING_KEY) === "on"; } catch (e) { return false; }
  }

  function savedList() {
    var out = [];
    SAVED_READS.forEach(function (r) { if (out.indexOf(r.what) === -1) out.push(r.what); });
    return out;
  }

  function apiOrigin() {
    var configured = (typeof window.API_URL === "string" && window.API_URL) || API_ORIGIN_FALLBACK;
    try { return new URL(configured, window.location.href).origin; } catch (e) { return null; }
  }

  function urlOf(input) {
    try {
      if (typeof input === "string") return new URL(input, window.location.href);
      if (input instanceof URL) return input;
      if (input && typeof input.url === "string") return new URL(input.url, window.location.href);
    } catch (e) { /* not a URL */ }
    return null;
  }

  function ruleFor(u) {
    for (var i = 0; i < SAVED_READS.length; i++) if (SAVED_READS[i].path.test(u.pathname)) return SAVED_READS[i];
    return null;
  }

  function clean(value, drop) {
    if (Array.isArray(value)) return value.map(function (v) { return clean(v, null); });
    if (!value || typeof value !== "object") return value;
    var out = {};
    Object.keys(value).forEach(function (k) {
      if (SECRET_KEY.test(k)) return;
      if (drop && drop.indexOf(k) !== -1) return;
      out[k] = clean(value[k], null);
    });
    return out;
  }

  /* ── IndexedDB ───────────────────────────────────────────────────────── */
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB is not available")); return; }
      var req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE, { keyPath: "key" }); };
      req.onsuccess = function () {
        var db = req.result;
        /* A delete from another tab (or the setting turned off here) waits on
           open connections; closing on request lets it go through at once. */
        db.onversionchange = function () { db.close(); };
        resolve(db);
      };
      req.onerror = function () { reject(req.error || new Error("IndexedDB open failed")); };
    });
  }

  function run(db, mode, work) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, mode);
      var result;
      work(tx.objectStore(STORE), function (v) { result = v; });
      tx.oncomplete = function () { resolve(result); };
      tx.onerror = tx.onabort = function () { reject(tx.error || new Error("IndexedDB transaction failed")); };
    });
  }

  function deleteCopy() {
    try { if (window.indexedDB) window.indexedDB.deleteDatabase(DB_NAME); } catch (e) { /* nothing to delete */ }
  }

  function saveCopy(key, rule, response) {
    return response.json().then(function (data) {
      var body = JSON.stringify(clean(data, rule.drop || null));
      if (body.length > MAX_ENTRY_CHARS) return;
      return openDb().then(function (db) {
        /* Turned off while the response was on its way: save nothing, and
           make sure no database is left behind by this open. */
        if (!enabled()) { db.close(); deleteCopy(); return; }
        return run(db, "readwrite", function (store) {
          store.put({ key: key, savedAt: Date.now(), body: body });
        }).then(function () {
          return run(db, "readonly", function (store, set) {
            var all = store.getAll();
            all.onsuccess = function () { set(all.result || []); };
          });
        }).then(function (rows) {
          var total = 0;
          rows.forEach(function (r) { total += r.body.length; });
          rows.sort(function (a, b) { return a.savedAt - b.savedAt; });
          var drop = [];
          while (total > MAX_TOTAL_CHARS && rows.length) { var r = rows.shift(); total -= r.body.length; drop.push(r.key); }
          if (!drop.length) return;
          return run(db, "readwrite", function (store) { drop.forEach(function (k) { store.delete(k); }); });
        }).then(function () { db.close(); }, function () { db.close(); });
      });
    }).catch(function () { /* a copy that could not be saved is simply not there */ });
  }

  function readCopy(key) {
    return openDb().then(function (db) {
      return run(db, "readonly", function (store, set) {
        var req = store.get(key);
        req.onsuccess = function () { set(req.result || null); };
      }).then(function (rec) { db.close(); return rec; }, function (e) { db.close(); throw e; });
    });
  }

  /* ── The banner and the locked controls ──────────────────────────────── */
  var state = { offline: false, savedAt: null };

  function when(ms) {
    var d = new Date(ms);
    try { return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }); }
    catch (e) { return d.toString(); }
  }

  function banner() {
    var b = document.getElementById("bf-offline-banner");
    if (b) return b;
    b = document.createElement("div");
    b.id = "bf-offline-banner";
    b.setAttribute("role", "status");
    b.setAttribute("data-offline-ok", "");
    b.style.cssText = "position:sticky;top:0;z-index:10000;padding:10px 16px;background:#3b2f07;color:#fde68a;border-bottom:1px solid #a16207;font:600 14px/1.45 system-ui,-apple-system,'Segoe UI',Arial,sans-serif;";
    var text = document.createElement("span");
    text.id = "bf-offline-text";
    b.appendChild(text);
    var again = document.createElement("button");
    again.type = "button";
    again.textContent = "Reload";
    again.style.cssText = "margin-left:12px;padding:3px 10px;border-radius:6px;border:1px solid #a16207;background:transparent;color:#fde68a;cursor:pointer;font:inherit;";
    again.addEventListener("click", function () { window.location.reload(); });
    b.appendChild(again);
    document.body.insertBefore(b, document.body.firstChild);
    return b;
  }

  function lockable(el) {
    if (el.hasAttribute("data-offline-ok")) return false;
    if (el.closest && (el.closest("nav") || el.closest("[data-offline-ok]"))) return false;
    return true;
  }

  function lockWrites() {
    if (!state.offline || !document.querySelectorAll) return;
    var list = document.querySelectorAll(WRITE_CONTROLS);
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (!lockable(el) || el.disabled) continue;
      el.disabled = true;
      el.setAttribute("data-bf-offline-locked", "");
      el.title = LOCK_REASON;
    }
  }

  var observer = null;
  function goOffline() {
    if (state.offline) return;
    state.offline = true;
    lockWrites();
    /* Pages draw buttons as their data arrives, and some re-enable a button
       when a request fails; both are locked again as they happen. */
    if (typeof MutationObserver === "function" && !observer) {
      observer = new MutationObserver(lockWrites);
      observer.observe(document.documentElement || document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    }
  }

  function paint() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", paint); return; }
    banner();
    document.getElementById("bf-offline-text").textContent = state.savedAt !== null
      ? SAVED_PREFIX + when(state.savedAt) + SAVED_SUFFIX
      : NEEDS_TEXT;
    lockWrites();
  }

  /* The oldest copy on the page is the time shown, so the banner never
     claims the page is fresher than its stalest part. */
  function showSavedCopy(savedAt) {
    state.savedAt = state.savedAt === null ? savedAt : Math.min(state.savedAt, savedAt);
    goOffline();
    paint();
  }

  function showNeedsConnection() {
    goOffline();
    paint();
  }

  document.addEventListener("submit", function (e) {
    if (!state.offline) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener("online", function () {
    if (state.offline) window.location.reload();
  });

  /* ── The fetch wrapper ───────────────────────────────────────────────── */
  var nativeFetch = window.fetch;
  if (typeof nativeFetch === "function") {
    window.fetch = function (input, init) {
      var u = urlOf(input);
      if (!u || u.origin !== apiOrigin()) return nativeFetch.apply(this, arguments);
      var method = String((init && init.method) || (input && typeof input === "object" && input.method) || "GET").toUpperCase();
      if (method !== "GET") {
        /* Refused, not queued: nothing is kept to send later. */
        if (state.offline) return Promise.reject(new TypeError(LOCK_REASON));
        return nativeFetch.apply(this, arguments);
      }
      var rule = ruleFor(u);
      var key = u.pathname + u.search;
      return nativeFetch.apply(this, arguments).then(function (response) {
        if (!response) return response;
        /* A 401 or a 402 is the server answering, not the network failing:
           it goes to the page (and bf-session.js) exactly as it came. */
        if (!response.ok) return response;
        if (rule && enabled()) saveCopy(key, rule, response.clone());
        return response;
      }, function (err) {
        if (err && err.name === "AbortError") throw err;
        if (!rule || !enabled()) { showNeedsConnection(); throw err; }
        return readCopy(key).then(function (rec) {
          if (!rec) { showNeedsConnection(); throw err; }
          showSavedCopy(rec.savedAt);
          return new Response(rec.body, { status: 200, headers: { "Content-Type": "application/json", "X-BF-Saved-Copy": String(rec.savedAt) } });
        }, function () { showNeedsConnection(); throw err; });
      });
    };
  }

  /* ── The setting ─────────────────────────────────────────────────────── */
  function setEnabled(on) {
    if (on) {
      try { localStorage.setItem(SETTING_KEY, "on"); } catch (e) { return false; }
      return true;
    }
    try { localStorage.removeItem(SETTING_KEY); } catch (e) { /* storage unavailable */ }
    deleteCopy();
    return true;
  }

  function explanation() {
    return "Off unless you turn it on. When it is on, this browser keeps a copy of what you last loaded of " +
      savedList().join("; ") + ", each with the time it was saved. The copy is kept in this browser's own storage (IndexedDB) on this " +
      "device, up to about 5 MB, and is not sent anywhere. It never holds " + NEVER_STORED.join(", ").replace(/, ([^,]*)$/, ", or $1") +
      ". Turning this off deletes the copy at once, and signing out deletes it and turns this off. Anyone who can open this browser " +
      "on this device can read the copy, so leave it off on a shared device.";
  }

  function mountSetting(container) {
    if (!container) return;
    var label = document.createElement("label");
    label.style.cssText = "display:flex;gap:10px;align-items:center;font-weight:600;cursor:pointer;";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = "bfOfflineToggle";
    box.checked = enabled();
    box.style.cssText = "width:auto;margin:0;";
    label.appendChild(box);
    label.appendChild(document.createTextNode(SETTING_LABEL));
    container.appendChild(label);
    var why = document.createElement("p");
    why.className = "bf-offline-explain";
    why.style.cssText = "margin:8px 0 0;font-size:.9rem;line-height:1.55;opacity:.85;";
    why.textContent = explanation();
    container.appendChild(why);
    var said = document.createElement("p");
    said.className = "bf-offline-status";
    said.style.cssText = "margin:6px 0 0;font-size:.9rem;min-height:1.2em;";
    container.appendChild(said);
    box.addEventListener("change", function () {
      if (box.checked) {
        said.textContent = setEnabled(true)
          ? "On. Pages you open from now on are saved on this device."
          : "This browser would not store the setting, so nothing is saved.";
        if (!enabled()) box.checked = false;
      } else {
        setEnabled(false);
        said.textContent = "Off. The copy on this device is deleted.";
      }
    });
  }

  window.BFOffline = {
    enabled: enabled,
    setEnabled: setEnabled,
    mountSetting: mountSetting,
    savedList: savedList,
    neverStored: function () { return NEVER_STORED.slice(); },
    settingLabel: SETTING_LABEL,
    isOffline: function () { return state.offline; }
  };

  /* The app shell: sw.js keeps the app's own static files so these pages
     open with no connection. Registered from app pages only. */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();

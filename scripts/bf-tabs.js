/* ══════════════════════════════════════════════════════════════════════════
   scripts/bf-tabs.js — ONE TAB COMPONENT (Nov 10 2026, dashboard tabs), taken
   out of the Executive command deck (scripts/bf-exec-deck.js) unchanged and
   made configurable. Used by executive-agent.html's deck (six tabs, plain
   hashes, localStorage bf_exec_tab) and dashboard.html's Command Center
   (seven tabs, #cc-* hashes, sessionStorage bf_cc_tab).

   window.BFTabs.create(opts) → { select, route, current, tabHolding }
     root        the element holding the tablist (clicks and keys are heard here)
     tabs        the tab names, in order
     attr        the tab buttons' name attribute (data-deck-tab)
     tabId(n)    a tab's button id;  panelId(n)  its panel's id
     hash(n)     the address of a tab ("#" + n, "#cc-" + n)
     nameOf(h)   the tab a hash (without "#") names, or null
     storage     { kind: "local" | "session", key }: the last tab, try/catch
     fallback    the tab with nothing else to go on
     extraRoute(h, api)  a page's own hash rules, tried after the tab names;
                 true when it handled the hash
     onSelect(n) after a tab is shown
   The tablist is role="tablist", each tab role="tab" with aria-selected and
   aria-controls, each panel role="tabpanel"; Left / Right wrap round, Home and
   End go to the ends; a tab pressed is a history step (pushState), a tab the
   address chose is not; hashchange routes again.

   The look: the deck's own .deck-tabs / .deck-tab rules, injected once at the
   head's start so a page's own CSS still wins. .deck-tabs-scroll keeps the
   row on one line and scrolls it sideways (the dashboard, narrow screens).
   ══════════════════════════════════════════════════════════════════════════ */
(function bfTabs() {
  if (window.BFTabs) return;

  (function style() {
    if (document.getElementById("bfTabsStyle")) return;
    var css = document.createElement("style");
    css.id = "bfTabsStyle";
    css.textContent =
      ".deck-tabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(var(--bf-accent-a3-rgb, 0, 229, 255), 0.16); }\n" +
      ".deck-tab { font: inherit; font-size: .82rem; font-weight: 800; letter-spacing: .06em; padding: 8px 14px; border-radius: 10px; cursor: pointer;\n" +
      "  color: #b6c2ee; background: rgba(12, 16, 36, 0.9); border: 1px solid rgba(148, 163, 255, 0.22); display: inline-flex; align-items: center; gap: 6px; }\n" +
      ".deck-tab.is-on { color: var(--bf-btn-text, #041018); background: linear-gradient(135deg, var(--bf-btn-a, #00e5ff)var(--bf-btn-mid, ), var(--bf-btn-b, #7b2ff7)); border-color: transparent; }\n" +
      ".deck-tab:focus-visible { outline: 2px solid #67e8f9; outline-offset: 2px; }\n" +
      ".deck-panel:focus-visible { outline: none; }\n" +
      ".deck-tabs.deck-tabs-scroll { flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }\n" +
      ".deck-tabs.deck-tabs-scroll .deck-tab { flex: 0 0 auto; white-space: nowrap; }\n";
    var head = document.head || document.documentElement;
    head.insertBefore(css, head.firstChild);
  })();

  function create(o) {
    var TABS = o.tabs.slice();
    var ATTR = o.attr || "data-deck-tab";
    var fallback = o.fallback || TABS[0];
    function $(id) { return document.getElementById(id); }
    function tabOf(name) { return $(o.tabId(name)); }
    function panelOf(name) { return $(o.panelId(name)); }
    function store() { return o.storage.kind === "session" ? window.sessionStorage : window.localStorage; }
    function remembered() { try { return store().getItem(o.storage.key); } catch (e) { return null; } }
    function remember(name) { try { store().setItem(o.storage.key, name); } catch (e) { /* a private window keeps no tab */ } }

    var current = null;
    function select(name, opts) {
      opts = opts || {};
      if (TABS.indexOf(name) === -1) name = fallback;
      current = name;
      TABS.forEach(function (t) {
        var tab = tabOf(t), panel = panelOf(t), on = t === name;
        if (tab) {
          tab.setAttribute("aria-selected", on ? "true" : "false");
          tab.setAttribute("tabindex", on ? "0" : "-1");
          tab.classList.toggle("is-on", on);
        }
        if (panel) panel.hidden = !on;
      });
      remember(name);
      var hash = o.hash(name);
      if (opts.hash !== false && window.location.hash !== hash) {
        try { setHash(hash, opts.push === true); } catch (e) { /* file:// and old browsers keep the old hash */ }
      }
      if (opts.focus) { var t = tabOf(name); if (t && t.focus) t.focus(); }
      if (o.onSelect) o.onSelect(name);
    }
    // A tab pressed is a step the back button can undo; a tab the address already chose is not.
    function setHash(hash, push) {
      var h = window.history;
      if (h && push && typeof h.pushState === "function") h.pushState(null, "", hash);
      else if (h && typeof h.replaceState === "function") h.replaceState(null, "", hash);
      else window.location.hash = hash;
    }

    // The tab panel that holds an element, for an in-page link.
    function tabHolding(node) {
      while (node && node !== document) {
        if (node.getAttribute && node.getAttribute("role") === "tabpanel") {
          for (var i = 0; i < TABS.length; i++) if (node.id === o.panelId(TABS[i])) return TABS[i];
        }
        node = node.parentNode;
      }
      return null;
    }
    function rememberedOrFallback() { var r = remembered(); return TABS.indexOf(r) !== -1 ? r : fallback; }

    // What the address asks for: a tab, a page's own rule, or nothing (the remembered tab).
    function route() {
      var h = String(window.location.hash || "").replace(/^#/, "");
      if (!h) { select(rememberedOrFallback(), { hash: false }); return; }
      var named = o.nameOf(h);
      if (named && TABS.indexOf(named) !== -1) { select(named, { hash: false }); return; }
      if (o.extraRoute && o.extraRoute(h, api) === true) return;
      select(rememberedOrFallback(), { hash: false });
    }

    var root = o.root;
    root.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[" + ATTR + "]") : null;
      if (t) { e.preventDefault(); select(t.getAttribute(ATTR), { push: true }); }
    });
    root.addEventListener("keydown", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[" + ATTR + "]") : null;
      if (!t) return;
      var i = TABS.indexOf(t.getAttribute(ATTR)), next = null;
      if (e.key === "ArrowRight") next = TABS[(i + 1) % TABS.length];
      else if (e.key === "ArrowLeft") next = TABS[(i - 1 + TABS.length) % TABS.length];
      else if (e.key === "Home") next = TABS[0];
      else if (e.key === "End") next = TABS[TABS.length - 1];
      if (!next) return;
      e.preventDefault();
      select(next, { focus: true, push: true });
    });
    window.addEventListener("hashchange", route);

    var api = { select: select, route: route, tabHolding: tabHolding, rememberedOrFallback: rememberedOrFallback, current: function () { return current; } };
    return api;
  }

  window.BFTabs = { create: create };
})();

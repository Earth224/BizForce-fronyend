/* BizForce AI — agent card ordering
 *
 * One place for the orderings, because two pages draw agent cards by two
 * different mechanisms: agents-hub.html has eighteen cards in markup, and
 * ai-agents.html builds them from the GET /api/agents response. A setting that
 * reordered one and not the other would be incoherent, and an importance list
 * copied into both would drift — this codebase has already been bitten by a
 * second copy of the agent roster going stale.
 */
(function (global) {
  "use strict";

  /* ── THE IMPORTANCE ORDER, AND WHY IT IS THIS ────────────────────────────────
     Not alphabetical and not the order the agents were built in. Ranked by what
     moves a small business forward — which is a judgement, so here is the
     reasoning rather than a list that looks arbitrary:

       SALES and SEO come first because they are the only two that bring a
       stranger to the business. Everything else works on people who have already
       arrived.

       CONTENT and EMAIL come next because they keep them. A visitor who is not
       given a reason to return does not return.

       ADS sits below the free channels deliberately. It works, and it costs money
       every day it runs, so a business should exhaust what is free before it
       starts paying for attention.

       SOCIAL, STORE and ANALYTICS follow: real work, but none of them reaches
       anyone new on their own.

       EXECUTIVE sits mid-list because it COORDINATES rather than produces. A plan
       is worth nothing until the agents under it have done something, so it is
       more useful once the ones above it are running.

       REPUTATION, ETSY, OPERATIONS, COMMUNITY, INFLUENCER and PUBLICIST are all
       genuine work that matters later — after there is something to have a
       reputation about, a shop to audit, a process to document, or an audience to
       build.

       BROKER and VERTICAL MARKETING are last, and not because they are weak.
       They matter enormously to the few businesses that need them and not at all
       to the rest, so averaged across everyone they belong at the bottom — which
       is exactly the kind of thing a per-user ordering should let someone
       override.

     The type strings are the registered agent types, so this list is matched
     against agent_type rather than against a label. */
  var IMPORTANCE = [
    "sales", "seo", "content", "email", "ads", "social", "store", "analytics",
    "executive", "reputation", "etsy", "operations", "community",
    "influencer", "publicist", "rd", "broker", "vertical_marketing"
  ];

  var ORDERINGS = ["importance", "alphabetical", "random"];
  var DEFAULT_ORDERING = "importance";
  var STORAGE_KEY = "bf_agent_order";

  // Rank lookup built once. An agent type not on the list sorts after every
  // listed one rather than to the front, so a newly registered agent appears at
  // the end instead of silently displacing sales.
  var RANK = {};
  IMPORTANCE.forEach(function (type, i) { RANK[type] = i; });

  function rankOf(type) {
    var key = String(type || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(RANK, key) ? RANK[key] : IMPORTANCE.length;
  }

  /* FISHER-YATES, not array.sort(() => Math.random() - 0.5).
     A random comparator is not a shuffle. sort() assumes a consistent comparator
     and a random one breaks that assumption, so the result is neither uniform nor
     even well defined — in V8 it biases heavily toward the original order, which
     on a dashboard means the same few cards keep landing on top and the feature
     reads as broken rather than as random. Fisher-Yates visits each position once
     and swaps with a uniformly chosen earlier-or-equal index, which is uniform by
     construction. */
  function shuffle(list) {
    var out = list.slice();
    var i, j, tmp;
    for (i = out.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  /* Reads the saved ordering. A value that is not one of the three is treated as
     absent, so a stale or hand-edited key falls back rather than producing an
     order nobody chose.

     THE READ CAN FAIL. localStorage throws in a private window, with site data
     blocked, or inside some embedded views — and a failed read must not silently
     become a different order. It returns the default AND says the read failed, so
     a caller can tell "they chose importance" from "we could not find out". */
  function readPreference() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
      if (raw === null || raw === undefined) {
        return { ordering: DEFAULT_ORDERING, saved: false, read_failed: false };
      }
      if (ORDERINGS.indexOf(raw) === -1) {
        return { ordering: DEFAULT_ORDERING, saved: false, read_failed: false, invalid: String(raw) };
      }
      return { ordering: raw, saved: true, read_failed: false };
    } catch (e) {
      return { ordering: DEFAULT_ORDERING, saved: false, read_failed: true };
    }
  }

  function writePreference(ordering) {
    if (ORDERINGS.indexOf(ordering) === -1) return false;
    try {
      global.localStorage.setItem(STORAGE_KEY, ordering);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Orders a list of {type, label} descriptors. The caller maps its own shape onto
     that and maps back, so this function is the same for a markup grid and for an
     API response.

     ALPHABETICAL SORTS BY LABEL, not by type, because the label is what the user
     reads — "Vertical Marketing" belongs under V, and sorting by the type string
     would file it under the same letter while looking like a bug. localeCompare
     so accented and non-ASCII labels sort where a reader expects rather than by
     code point. */
  function orderDescriptors(items, ordering) {
    var list = Array.isArray(items) ? items.slice() : [];

    if (ordering === "random") return shuffle(list);

    if (ordering === "alphabetical") {
      return list.sort(function (a, b) {
        return String(a.label || "").localeCompare(String(b.label || ""), undefined,
          { sensitivity: "base" });
      });
    }

    // importance, and the default for anything unrecognised
    return list.sort(function (a, b) {
      var byRank = rankOf(a.type) - rankOf(b.type);
      // Ties only happen among unlisted types; label keeps the result stable
      // rather than leaving it to sort implementation order.
      return byRank !== 0 ? byRank : String(a.label || "").localeCompare(String(b.label || ""));
    });
  }

  global.BFAgentOrder = {
    IMPORTANCE: IMPORTANCE,
    ORDERINGS: ORDERINGS,
    DEFAULT_ORDERING: DEFAULT_ORDERING,
    STORAGE_KEY: STORAGE_KEY,
    rankOf: rankOf,
    shuffle: shuffle,
    readPreference: readPreference,
    writePreference: writePreference,
    orderDescriptors: orderDescriptors,

    /* Reorders DOM children in place — what agents-hub.html needs, since its
       eighteen cards are markup rather than data. The type is read from the
       card's own agent-card--TYPE class so the markup stays the single source of
       what is on the page, and the label from its heading so alphabetical uses
       the same text the reader sees. */
    applyToContainer: function (container, cardSelector, ordering) {
      if (!container) return null;

      var cards = Array.prototype.slice.call(container.querySelectorAll(cardSelector));
      if (!cards.length) return null;

      var items = cards.map(function (el) {
        var match = String(el.className || "").match(/agent-card--([a-z0-9_]+)/);
        var heading = el.querySelector(".agent-name, h2, h3");
        return {
          type: match ? match[1] : "",
          label: heading ? heading.textContent.trim() : "",
          el: el
        };
      });

      orderDescriptors(items, ordering).forEach(function (item) {
        // appendChild on an existing child MOVES it, so this reorders without
        // re-creating anything — event handlers and focus survive.
        container.appendChild(item.el);
      });

      return items.length;
    }
  };
})(typeof window !== "undefined" ? window : this);

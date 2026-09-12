/* BizForce AI — dashboard feature card ordering
 *
 * A SIBLING OF scripts/bf-agent-order.js, NOT A REUSE OF IT, and deliberately so.
 * That module identifies a card by an agent type read out of an `agent-card--TYPE`
 * class, which a dashboard card does not have and should not be given; it would
 * also mean the two grids shared one stored value, so choosing an order for the
 * agent hub would silently rearrange the dashboard. Same shape, separate keys,
 * separate list of orderings.
 */
(function (global) {
  "use strict";

  var ORDERINGS = ["default", "custom", "alphabetical", "importance"];
  var DEFAULT_ORDERING = "default";

  /* Two keys, because they answer two different questions: which ordering is in
     force, and what the user's arrangement is. Keeping the arrangement while
     they look at alphabetical — and giving it back untouched when they switch
     to custom again — is the whole reason it is not folded into one. */
  var STORAGE_KEY = "bf_dashboard_order";
  var CUSTOM_KEY = "bf_dashboard_custom";

  /* ── THE IMPORTANCE ORDER, AND WHAT IT IS NOT ────────────────────────────────
     An editorial judgement, and only that: ten cards somebody decided most
     businesses reach for first. It is not measured, it is not personalised, and
     it is not a claim that this is the right order for anyone in particular.

     CUSTOM EXISTS PRECISELY SO NOBODY HAS TO AGREE WITH THIS LIST. A user who
     works differently drags the cards into their own order and this ranking
     stops applying to them entirely. That is the intended escape hatch, not a
     workaround.

     Money and pipeline first — billing, then the two that bring work in, then
     the tools for working it. Everything not named here keeps its page order
     behind them rather than being ranked by omission.

     A SLUG LISTED HERE THAT THE PAGE DOES NOT RENDER IS SIMPLY SKIPPED. The list
     is matched against the cards that exist; a card removed from dashboard.html
     leaves a name here that never matches, which costs nothing and is not an
     error. The reverse — a card the page renders and this list does not name —
     is the normal case and lands in the page-order remainder. */
  var IMPORTANCE = [
    "billing",
    "lead-radar",
    "crm",
    "prospecting",
    "business-chat",
    "agent-proposals",
    "active-queue",
    "analytics",
    "self-reviews",
    "marketplace"
  ];

  var RANK = {};
  IMPORTANCE.forEach(function (slug, i) { RANK[slug] = i; });

  function importanceRank(slug) {
    var key = String(slug || "");
    return Object.prototype.hasOwnProperty.call(RANK, key) ? RANK[key] : IMPORTANCE.length;
  }

  function readKey(key) {
    return global.localStorage ? global.localStorage.getItem(key) : null;
  }

  /* Reads the chosen ordering as a three-state answer, the same shape
     bf-agent-order returns and for the same reason:

       { ordering, saved: true }                    they chose this
       { ordering: DEFAULT, saved: false }          nothing stored
       { ordering: DEFAULT, saved: false, invalid } something unusable was stored
       { ordering: DEFAULT, saved: false, read_failed: true }   we could not look

     THE LAST TWO ARE NOT THE SAME AS THE FIRST AND MUST NOT LOOK LIKE IT.
     localStorage throws in a private window, with site data blocked, and inside
     some embedded views. A caller that cannot tell "they chose default" from "we
     could not find out" ends up showing a fallback as though it were a decision
     the user made. */
  function readPreference() {
    try {
      var raw = readKey(STORAGE_KEY);

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

  /* The arrangement, in the same three-state shape. A stored value that is not
     JSON, or is JSON but not an array of strings, is reported as invalid rather
     than half-honoured: applying the readable half of a corrupted arrangement
     would put the cards in an order the user never chose and never asked to
     undo. */
  function readCustom() {
    try {
      var raw = readKey(CUSTOM_KEY);

      if (raw === null || raw === undefined) {
        return { slugs: null, saved: false, read_failed: false };
      }

      var parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return { slugs: null, saved: false, read_failed: false, invalid: String(raw) };
      }

      if (!Array.isArray(parsed)) {
        return { slugs: null, saved: false, read_failed: false, invalid: String(raw) };
      }

      for (var i = 0; i < parsed.length; i++) {
        if (typeof parsed[i] !== "string") {
          return { slugs: null, saved: false, read_failed: false, invalid: String(raw) };
        }
      }

      return { slugs: parsed, saved: true, read_failed: false };
    } catch (e) {
      return { slugs: null, saved: false, read_failed: true };
    }
  }

  function writeCustom(slugs) {
    if (!Array.isArray(slugs)) return false;
    for (var i = 0; i < slugs.length; i++) {
      if (typeof slugs[i] !== "string") return false;
    }
    try {
      global.localStorage.setItem(CUSTOM_KEY, JSON.stringify(slugs));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* Orders descriptors of { slug, label }. THE CALLER'S ARRAY ORDER IS THE PAGE
     ORDER, and every comparator below falls back to it, which is what makes
     "default" expressible at all and what keeps the other three stable.

     Each ordering is a rank plus that fallback:

       default       page order, untouched
       alphabetical  by the label the reader sees; ties keep page order
       importance    the ten named first, in list order; everything else after
                     them in page order
       custom        the arrangement first, in ITS order; everything else after
                     it in page order

     THE REMAINDER RULE IS WHAT MAKES THE ARRANGEMENT SURVIVE THE PAGE CHANGING.
     A card added to dashboard.html after somebody arranged their dashboard is
     not in their array; it appends in page order instead of vanishing. A slug in
     their array whose card is gone matches nothing and is skipped. Neither case
     is an error and neither costs them the rest of their arrangement. */
  function orderDescriptors(items, ordering, custom) {
    var list = Array.isArray(items) ? items.slice() : [];

    /* THE PAGE ORDER IS CAPTURED HERE, BEFORE ANY COMPARISON, as an index
       alongside each descriptor. It is taken from the caller's array order,
       which applyToContainer guarantees is document order. Nothing below reads
       the DOM, so no amount of sorting can lose it. */
    var indexed = list.map(function (item, i) { return { item: item, page: i }; });

    var byPage = function (a, b) { return a.page - b.page; };

    var sorted;

    if (ordering === "alphabetical") {
      sorted = indexed.sort(function (a, b) {
        var byLabel = String(a.item.label || "").localeCompare(String(b.item.label || ""), undefined,
          { sensitivity: "base" });
        return byLabel !== 0 ? byLabel : byPage(a, b);
      });
    } else if (ordering === "importance") {
      sorted = indexed.sort(function (a, b) {
        var byRank = importanceRank(a.item.slug) - importanceRank(b.item.slug);
        return byRank !== 0 ? byRank : byPage(a, b);
      });
    } else if (ordering === "custom") {
      /* An arrangement that is missing, empty, or names nothing the page renders
         leaves every card in the remainder — which is page order, the same thing
         "default" shows. That is the honest result: an arrangement of nothing
         cannot arrange anything, and inventing an order here would be worse. */
      var arrangement = Array.isArray(custom) ? custom : [];
      var customRank = {};
      arrangement.forEach(function (slug, i) {
        if (typeof slug !== "string") return;
        // First mention wins, so a duplicated slug cannot displace its own card.
        if (!Object.prototype.hasOwnProperty.call(customRank, slug)) customRank[slug] = i;
      });

      var rankOfSlug = function (slug) {
        var key = String(slug || "");
        return Object.prototype.hasOwnProperty.call(customRank, key)
          ? customRank[key]
          : arrangement.length;
      };

      sorted = indexed.sort(function (a, b) {
        var byRank = rankOfSlug(a.item.slug) - rankOfSlug(b.item.slug);
        return byRank !== 0 ? byRank : byPage(a, b);
      });
    } else {
      // default, and the fallback for anything unrecognised
      sorted = indexed.sort(byPage);
    }

    return sorted.map(function (entry) { return entry.item; });
  }

  global.BFDashboardOrder = {
    ORDERINGS: ORDERINGS,
    DEFAULT_ORDERING: DEFAULT_ORDERING,
    STORAGE_KEY: STORAGE_KEY,
    CUSTOM_KEY: CUSTOM_KEY,
    IMPORTANCE: IMPORTANCE,
    importanceRank: importanceRank,
    readPreference: readPreference,
    writePreference: writePreference,
    readCustom: readCustom,
    writeCustom: writeCustom,
    orderDescriptors: orderDescriptors,

    /* Reorders the container's children in place. The cards are static markup in
       dashboard.html, so they are MOVED rather than re-created: appendChild on a
       node that is already a child moves it, which keeps every listener, every
       inline onclick and any focus exactly where it was.

       THE PAGE ORDER IS CAPTURED ON THE FIRST CALL AND REMEMBERED, because after
       one call the DOM no longer holds it. querySelectorAll returns nodes in
       document order, so the first call's sequence IS the order the cards are
       written in — it is stored on the container as __bfDashboardPageOrder (an
       array of the elements) and reused by every later call. Without that,
       applying "alphabetical" and then "default" would return the alphabetical
       order, since by then that is what the document says.

       A CARD WITH NO data-card IS KEPT, NEVER DROPPED. Its slug reads as "",
       which matches nothing in the importance list and nothing in an
       arrangement, so it sorts into the page-order remainder behind the named
       cards; alphabetical still sorts it by its heading like any other. The one
       thing that never happens is it disappearing, because every element that
       came out of querySelectorAll goes back in. */
    applyToContainer: function (container, cardSelector, ordering, custom) {
      if (!container) return null;

      var live = Array.prototype.slice.call(container.querySelectorAll(cardSelector));
      if (!live.length) return null;

      var remembered = container.__bfDashboardPageOrder;
      var cards;

      if (remembered && remembered.length) {
        // Page order from the first call, minus anything since removed, plus
        // anything since added (which can only be appended — it was not there
        // when the page order was captured).
        cards = [];
        remembered.forEach(function (el) {
          if (live.indexOf(el) !== -1) cards.push(el);
        });
        live.forEach(function (el) {
          if (cards.indexOf(el) === -1) cards.push(el);
        });
      } else {
        cards = live;
        container.__bfDashboardPageOrder = live.slice();
      }

      var items = cards.map(function (el) {
        var heading = el.querySelector("h3, h2, .bf-card-title");
        return {
          slug: el.getAttribute ? (el.getAttribute("data-card") || "") : "",
          label: heading ? String(heading.textContent || "").trim() : "",
          el: el
        };
      });

      orderDescriptors(items, ordering, custom).forEach(function (item) {
        container.appendChild(item.el);
      });

      return items.length;
    }
  };
})(typeof window !== "undefined" ? window : this);

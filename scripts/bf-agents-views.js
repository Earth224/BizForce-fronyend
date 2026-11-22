/* ══════════════════════════════════════════════════════════════════════════
   bf-agents-views.js — the Agent Directory's three views on a phone (FX2,
   Nov 21 2026), on ai-agents.html. PHONE ONLY: what it adds is hidden above
   760 px by its own style (every rule that shows it is inside
   @media (max-width: 760px)), and it asks the server nothing there, so the
   desktop page is unchanged.

   THE VIEW ROW, above the agents: Large, Compact and Grid, each a 44 px button
   with an aria-label and aria-pressed (HQ1's row on the dashboard, the same
   glyphs and the same look).

   THE THREE VIEWS show the same agents, in the same order, as the page's own
   cards (renderLiveAgents in ai-agents.html draws them; this file reads them
   back, so the list and the cards cannot disagree). Large is those cards as
   they are. Compact is one 60 px row per agent: its icon tile, its name, one
   line, and a chevron. Grid is two columns of tiles: the icon tile, the name
   and the same line. Each row or tile is one link, to the card's own Open
   Agent page. The one line is the agent's role as the Agents hub
   (agents-hub.html) names it ("Search & Rankings", "Deal Flow"), so it always
   fits on one line; the full description stays on the Large cards.

   SAVED per member: user_preferences.agents_card_view (GET and PUT
   /api/user/preferences, migration 200e; the server keeps "large", "compact",
   "grid" or null and answers 400 to anything else), and a device copy in
   localStorage (bf_agents_view; cleared at sign-out by scripts/bf-session.js)
   so a choice applies before the server answers. A choice the server holds
   wins once it arrives; one it does not hold yet (null) is sent to it from
   here. Default: Compact.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var PHONE_QUERY = "(max-width: 760px)";
  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var VIEWS = ["large", "compact", "grid"], DEFAULT_VIEW = "compact";
  var VIEW_KEY = "bf_agents_view";
  var VIEW_LABELS = { large: "Large cards", compact: "Compact list", grid: "Grid of tiles" };
  // The Agents hub's own role line for each agent (agents-hub.html, .agent-role)
  var ROLES = {
    seo: "Search & Rankings", sales: "Revenue & Leads", content: "Content Strategy", analytics: "Business Intelligence",
    social: "Brand Growth", email: "Email Marketing", ads: "Paid Traffic", reputation: "Trust & Reviews",
    community: "Community Growth", influencer: "Creator Outreach", operations: "Workflows & SOPs", etsy: "Storefront Growth",
    store: "Commerce Strategy", broker: "Deal Flow", publicist: "PR & Media", rd: "Research & Intel",
    executive: "Cross-Agent Oversight", vertical_marketing: "One Industry, Not All"
  };

  var grid = document.querySelector(".agents-grid");
  if (!grid || !grid.parentNode) return;
  var page = grid.parentNode;

  /* ── storage, never trusted to work ── */
  function readView() { try { return window.localStorage.getItem(VIEW_KEY); } catch (e) { return null; } }
  function writeView(v) { try { window.localStorage.setItem(VIEW_KEY, v); return true; } catch (e) { return false; } }
  function valid(v) { return VIEWS.indexOf(v) !== -1 ? v : null; }
  function phone() { try { return !!(window.matchMedia && window.matchMedia(PHONE_QUERY).matches); } catch (e) { return false; } }

  var state = { view: valid(readView()) || DEFAULT_VIEW, server: false, count: 0 };

  /* ── the look (phone only) ── */
  var css = document.createElement("style");
  css.id = "agViewsPhone";
  css.textContent = [
    ".ag-view-row,.ag-list{display:none}",
    "@media (max-width: 760px){",
    ".ag-view-row{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin:0 0 12px}",
    ".ag-view-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;min-height:44px;padding:0;border-radius:12px;" +
      "border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.25);background:rgba(10,17,40,.75);color:#8fa3d6;cursor:pointer;box-sizing:border-box}",
    ".ag-view-btn[aria-pressed=\"true\"]{border:1.8px solid var(--bf-accent-a, #22d3ee);color:var(--bf-accent-a, #22d3ee);box-shadow:0 0 0 3px rgba(var(--bf-accent-a-rgb, 34,211,238),.12)}",
    ".ag-view-btn:focus-visible,.ag-link:focus-visible{outline:3px solid var(--bf-accent-a, #22d3ee);outline-offset:2px}",
    ".ag-glyph{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
    // Compact and Grid replace the cards with the list (only once there are agents: a message in the grid stays shown)
    ".page[data-ag-view=\"compact\"] .agents-grid,.page[data-ag-view=\"grid\"] .agents-grid{display:none !important}",
    ".page[data-ag-view=\"compact\"] .ag-list{display:flex;flex-direction:column;gap:8px}",
    ".page[data-ag-view=\"grid\"] .ag-list{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}",
    // a row is 60 px: the 58 px link and the 1 px border above and below
    ".ag-item{border-radius:16px;border:1px solid rgba(var(--bf-accent-a-rgb, 34,211,238),.25);background:rgba(10,17,40,.75)}",
    ".ag-link{display:flex;align-items:center;gap:12px;min-height:58px;padding:0 12px;box-sizing:border-box;color:inherit;text-decoration:none}",
    ".ag-icon{flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;" +
      "background:linear-gradient(135deg, rgba(var(--bf-accent-a3-rgb, 0, 229, 255), 0.15), rgba(var(--bf-accent-b-rgb, 168, 85, 247), 0.2));border:1.5px solid rgba(var(--bf-accent-a3-rgb, 0, 229, 255), 0.3)}",
    ".ag-icon svg{width:20px;height:20px;opacity:.8}",
    ".ag-text{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}",
    // the name in the cards' own title style, the line in their description's colour
    // a name the member made longer than the line wraps (the row grows) rather than being cut off
    ".ag-name{font-size:.8rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#fff;line-height:1.25;overflow-wrap:anywhere}",
    ".ag-sub{color:#8892b8;font-size:.8rem;line-height:1.35;white-space:nowrap}",
    ".ag-chev{flex:0 0 20px;color:#8fa3d6}",
    ".page[data-ag-view=\"grid\"] .ag-link{flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:8px;height:auto;min-height:112px;padding:12px}",
    ".page[data-ag-view=\"grid\"] .ag-text{width:100%}",
    ".page[data-ag-view=\"grid\"] .ag-sub{white-space:normal;overflow-wrap:anywhere}",
    ".page[data-ag-view=\"grid\"] .ag-chev{display:none}",
    "}"
  ].join("\n");
  (document.head || document.documentElement).appendChild(css);

  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined && text !== null) x.textContent = String(text); return x; }
  function sv(tag, attrs) { var x = document.createElementNS(SVG_NS, tag); Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); }); return x; }
  function icon(kind) {
    var g = sv("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", "class": "ag-glyph" });
    if (kind === "large") { g.appendChild(sv("rect", { x: "3", y: "4", width: "18", height: "7", rx: "2" })); g.appendChild(sv("rect", { x: "3", y: "13", width: "18", height: "7", rx: "2" })); }
    else if (kind === "compact") { [6, 12, 18].forEach(function (y) { g.appendChild(sv("line", { x1: "4", y1: String(y), x2: "20", y2: String(y) })); }); }
    else if (kind === "grid") { [[3, 3], [13, 3], [3, 13], [13, 13]].forEach(function (p) { g.appendChild(sv("rect", { x: String(p[0]), y: String(p[1]), width: "8", height: "8", rx: "1.5" })); }); }
    else if (kind === "chevron") { g.appendChild(sv("polyline", { points: "9 5 16 12 9 19" })); }
    return g;
  }

  /* ── the view row and the list ── */
  var row = el("div", "ag-view-row");
  row.id = "agViewRow";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Agent view");
  var viewBtn = {};
  VIEWS.forEach(function (v) {
    var b = el("button", "ag-view-btn");
    b.type = "button";
    b.setAttribute("data-view", v);
    b.setAttribute("aria-label", VIEW_LABELS[v]);
    b.setAttribute("aria-pressed", "false");
    b.appendChild(icon(v));
    b.addEventListener("click", function () { choose(v); });
    viewBtn[v] = b;
    row.appendChild(b);
  });
  var list = el("div", "ag-list");
  list.id = "agList";
  list.setAttribute("aria-label", "AI Agent Directory");
  page.insertBefore(row, grid);
  page.insertBefore(list, grid.nextSibling);

  // The list, read from the page's own cards
  function draw() {
    var cards = [].slice.call(grid.querySelectorAll("article.agent-card"));
    list.textContent = "";
    cards.forEach(function (card) {
      var m = /(?:^|\s)agent-card--([a-z_]+)/.exec(card.className), type = m ? m[1] : "";
      var nameEl = card.querySelector(".agent-name"), linkEl = card.querySelector("a.open-agent-btn"), avatar = card.querySelector(".agent-avatar");
      var item = el("div", "ag-item");
      item.setAttribute("data-agent", type);
      var a = el("a", "ag-link");
      a.href = linkEl ? linkEl.getAttribute("href") : "agents-hub.html";
      var tile = el("span", "ag-icon");
      tile.setAttribute("aria-hidden", "true");
      // NAMED (Nov 22 2026, FX3): BEFORE the card's svg only, on the tile's shared cyan. AFTER the agent's own colour
      // and icon (scripts/bf-agent-marks.js, the map the dashboard reads); an unknown type keeps the card's own svg.
      var marks = window.BFAgentMarks;
      if (marks && marks.has(type)) { tile.innerHTML = marks.svg(type); marks.paint(tile, type); }
      else { var svg = avatar ? avatar.querySelector("svg") : null; if (svg) tile.appendChild(svg.cloneNode(true)); }
      var text = el("span", "ag-text");
      text.appendChild(el("span", "ag-name", nameEl ? nameEl.textContent : ""));
      if (Object.prototype.hasOwnProperty.call(ROLES, type)) text.appendChild(el("span", "ag-sub", ROLES[type]));
      var chev = icon("chevron");
      chev.setAttribute("class", "ag-glyph ag-chev");
      a.appendChild(tile);
      a.appendChild(text);
      a.appendChild(chev);
      item.appendChild(a);
      list.appendChild(item);
    });
    state.count = cards.length;
    apply();
  }
  function apply() {
    // Large, or no agents yet (the grid's own message shows): the cards
    page.setAttribute("data-ag-view", state.count ? state.view : "large");
    VIEWS.forEach(function (v) { viewBtn[v].setAttribute("aria-pressed", state.view === v ? "true" : "false"); });
  }

  /* ── the member's choice ── */
  function apiBase() { return (typeof window.API_URL === "string" && window.API_URL) || API_FALLBACK; }
  function headers(json) {
    var token = null;
    try { token = window.localStorage.getItem("bf_token"); } catch (e) { token = null; }
    var h = { "Authorization": "Bearer " + token };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }
  function save(body) {
    if (typeof fetch !== "function") return Promise.resolve(false);
    return fetch(apiBase() + "/api/user/preferences", { method: "PUT", headers: headers(true), body: JSON.stringify(body) })
      .then(function (r) { return r.ok; }, function () { return false; });
  }
  function choose(value) {
    if (!valid(value) || state.view === value) return Promise.resolve(false);
    state.view = value; writeView(value); apply();
    return save({ agents_card_view: value });
  }
  // The server's choice, on the phone only: a stored one wins; one it does not hold yet is sent from this device's copy.
  function pull() {
    if (!phone() || state.server || typeof fetch !== "function") return Promise.resolve(false);
    state.server = true;
    return fetch(apiBase() + "/api/user/preferences", { headers: headers(false) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || typeof b !== "object") return false;
        var v = valid(b.agents_card_view);
        if (v) { state.view = v; writeView(v); apply(); }
        else if (b.agents_card_view === null && valid(readView())) save({ agents_card_view: state.view });
        return true;
      })
      .catch(function () { return false; });
  }

  // renderLiveAgents fills the grid after its fetch: draw the list each time it changes
  if (window.MutationObserver) new MutationObserver(draw).observe(grid, { childList: true });
  draw();
  pull();
  var mq = null;
  try { mq = window.matchMedia ? window.matchMedia(PHONE_QUERY) : null; } catch (e) { mq = null; }
  if (mq) { var onChange = function () { pull(); }; if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange); }

  window.BFAgentsViews = {
    VIEWS: VIEWS, DEFAULT_VIEW: DEFAULT_VIEW, VIEW_KEY: VIEW_KEY, ROLES: ROLES,
    state: function () { return { view: state.view, count: state.count }; }, choose: choose, pull: pull, draw: draw
  };
})();

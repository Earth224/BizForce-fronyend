/* ═══════════════════════════════════════════════════════════════════════════
   scripts/bf-network.js — the agent network in HQ (intelligence layer B6, B7)

   Mounts on #deckNetwork, under the agent grid on HQ's Agents tab. Everything
   it shows is read from the server, from the member's own rows:
     GET /api/agents/network?window=1h|24h|7d   the 18 agents, the declared
         links between them (lib/agentNetwork.js on the server: Executive plan
         dispatches, the Executive-to-Sales handoff, SEO posts into the content
         library, Lead Radar posts read by R&D), and each link's count of runs
         that flowed in the window;
     GET /api/agents/network/edge               one link's runs, 20 a page,
         each with "Open run" (run.html) and "Why?" (bf-why.js);
     PUT /api/agents/network/links              switch a declared link off or
         on again, after a confirm. Nothing here can add a link.

   THE MAP. An SVG: the Executive in the middle, the other 17 on a ring, each in
   its own accent, each link a line. A link LIGHTS (a flowing pulse, thicker the
   more runs) only when its count for the window is above 0. A link with 0 runs,
   or a count that could not be read, is drawn dim and never animated. A link
   the member switched off is dashed. Under prefers-reduced-motion nothing
   moves: each link shows its count instead.

   Click or press Enter on a link to see its runs; on an agent to open its
   page. The list under the map says the same as the map, link by link, for
   anyone who does not use the picture.

   Refreshed every 60 s ONLY while the page is visible and the Agents tab is
   open; stopped while the page is hidden.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.BFNetwork) return;
  var API_URL = "https://dynamic-prosperity-production-5382.up.railway.app";
  var REFRESH_MS = 60000;
  var WINDOWS = [["1h", "1 hour"], ["24h", "24 hours"], ["7d", "7 days"]];
  var SIZE = 640, MID = 320, RING = 250, NODE_R = 24;

  // Each agent's page and accent, as scripts/bf-hq.js has them.
  var AGENTS = {
    ads:                { page: "/ads-agent.html",                accent: "#818cf8" },
    analytics:          { page: "/agents/analytics.html",         accent: "#60a5fa" },
    broker:             { page: "/broker-agent.html",             accent: "#c084fc" },
    community:          { page: "/community-agent.html",          accent: "#4ade80" },
    content:            { page: "/agents/content.html",           accent: "#34d399" },
    email:              { page: "/email-agent.html",              accent: "#fbbf24" },
    etsy:               { page: "/etsy-agent.html",               accent: "#fb923c" },
    executive:          { page: "/executive-agent.html",          accent: "#e2e8f0" },
    influencer:         { page: "/influencer-agent.html",         accent: "#e879f9" },
    operations:         { page: "/operations-agent.html",         accent: "#94a3b8" },
    publicist:          { page: "/publicist-agent.html",          accent: "#fcd34d" },
    rd:                 { page: "/rd-agent.html",                 accent: (typeof BFTheme !== "undefined" ? BFTheme.color("--bf-accent-a", "#22d3ee") : "#22d3ee") },
    reputation:         { page: "/reputation-agent.html",         accent: "#f87171" },
    sales:              { page: "/agents/sales.html",             accent: (typeof BFTheme !== "undefined" ? BFTheme.color("--bf-accent-b", "#a855f7") : "#a855f7") },
    seo:                { page: "/agents/seo.html",               accent: (typeof BFTheme !== "undefined" ? BFTheme.color("--bf-accent-a", "#22d3ee") : "#22d3ee") },
    social:             { page: "/agents/social.html",            accent: "#f472b6" },
    store:              { page: "/store-agent.html",              accent: "#38bdf8" },
    vertical_marketing: { page: "/vertical-marketing-agent.html", accent: "#a3e635" }
  };

  function tok() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function api(method, path, body) {
    var init = { method: method, headers: { "Authorization": "Bearer " + (tok() || "") } };
    if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
    return fetch(API_URL + path, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, ok: r.ok, body: b || {} }; });
    });
  }
  function still() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var CSS =
    ".bfn-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:18px 0 8px}" +
    ".bfn-head h3{margin:0;font-size:.9rem;letter-spacing:.06em;text-transform:uppercase}" +
    ".bfn-windows{display:flex;gap:6px}" +
    ".bfn-windows button,.bfn-btn{font:inherit;font-size:.8rem;padding:4px 10px;border-radius:8px;border:1px solid var(--bf-line, rgba(148,163,184,.35));background:transparent;color:inherit;cursor:pointer}" +
    ".bfn-windows button[aria-pressed=true]{border-color:rgba(var(--bf-accent-a3-rgb, 0,229,255),.7);font-weight:700}" +
    ".bfn-svg{width:100%;max-width:640px;height:auto;display:block;margin:0 auto}" +
    ".bfn-line{stroke:rgba(148,163,184,.55)}" +
    ".bfn-dim .bfn-line{stroke:rgba(148,163,184,.18)}" +
    ".bfn-off .bfn-line{stroke-dasharray:6 6}" +
    ".bfn-hit{stroke:transparent;stroke-width:16;cursor:pointer}" +
    ".bfn-pulse{stroke-dasharray:6 18;animation:bfnFlow 1.2s linear infinite;pointer-events:none}" +
    "@keyframes bfnFlow{to{stroke-dashoffset:-24}}" +
    "@media (prefers-reduced-motion: reduce){.bfn-pulse{animation:none}}" +
    ".bfn-edge:focus,.bfn-node:focus{outline:none}" +
    ".bfn-edge:focus .bfn-line,.bfn-edge.is-on .bfn-line{stroke:#ffffff}" +
    ".bfn-node{cursor:pointer}" +
    ".bfn-node:focus circle{stroke:#ffffff;stroke-width:3}" +
    ".bfn-node text,.bfn-count{fill:currentColor;font-size:13px;text-anchor:middle}" +
    ".bfn-count{font-size:12px;font-weight:700}" +
    ".bfn-note{font-size:.8rem;opacity:.8;margin:6px 0}" +
    ".bfn-list,.bfn-runs{list-style:none;padding:0;margin:8px 0}" +
    ".bfn-list li,.bfn-runs li{border-top:1px solid var(--bf-line, rgba(148,163,184,.25));padding:6px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:.84rem}" +
    ".bfn-detail{margin:10px 0;padding:10px 12px;border:1px solid var(--bf-line, rgba(148,163,184,.3));border-radius:10px}" +
    ".bfn-detail h4{margin:0 0 6px;font-size:.9rem}";
  function ensureStyle() {
    if (document.getElementById("bfNetworkCss")) return;
    var st = document.createElement("style");
    st.id = "bfNetworkCss";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  var S = { box: null, window: "24h", data: null, error: null, selected: null, runs: null, runsPage: 1, confirming: null, note: "", timer: null, loading: false };

  /* ── the fixed layout: the Executive in the middle, the rest on a ring ──── */
  function positions(nodes, centre) {
    var ring = nodes.filter(function (n) { return n.key !== centre; });
    var out = {};
    out[centre] = { x: MID, y: MID };
    ring.forEach(function (n, i) {
      var a = -Math.PI / 2 + (2 * Math.PI * i) / ring.length;
      out[n.key] = { x: Math.round((MID + RING * Math.cos(a)) * 10) / 10, y: Math.round((MID + RING * Math.sin(a)) * 10) / 10 };
    });
    return out;
  }
  function nameOf(key) {
    var d = S.data, n = d && d.nodes ? d.nodes.filter(function (x) { return x.key === key; })[0] : null;
    return n ? n.name : key;
  }
  function shortName(name) { return String(name).replace(/ Agent$/, ""); }
  function lit(e) { return typeof e.count === "number" && e.count > 0; }
  function width(e) { return lit(e) ? Math.round((2 + Math.min(6, Math.log(e.count + 1) / Math.LN2 * 1.5)) * 10) / 10 : 1.5; }
  function windowWords() { var w = WINDOWS.filter(function (x) { return x[0] === S.window; })[0]; return w ? w[1] : S.window; }
  function countWords(e) {
    if (typeof e.count !== "number") return "runs could not be read";
    return e.count + (e.count === 1 ? " run" : " runs") + " in the last " + windowWords();
  }
  function edgeWords(e) {
    return nameOf(e.from) + " to " + nameOf(e.to) + ": " + countWords(e) + (e.enabled ? "" : ", switched off by you");
  }

  /* The map. A pulse only on a lit link, and none when motion is reduced. */
  function svgHtml() {
    var d = S.data, pos = positions(d.nodes, d.centre), calm = still();
    var edges = d.edges.map(function (e) {
      var a = pos[e.from], b = pos[e.to];
      if (!a || !b) return "";
      var cls = "bfn-edge" + (lit(e) ? " bfn-lit" : " bfn-dim") + (e.enabled ? "" : " bfn-off") + (S.selected === e.id ? " is-on" : "");
      var line = 'x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"';
      var colour = AGENTS[e.to] ? AGENTS[e.to].accent : "#94a3b8";
      var pulse = lit(e) && !calm ? '<line class="bfn-pulse" ' + line + ' stroke="' + esc(colour) + '" stroke-width="' + width(e) + '"/>' : "";
      var count = calm ? '<text class="bfn-count" x="' + Math.round((a.x + b.x) / 2) + '" y="' + Math.round((a.y + b.y) / 2 - 4) + '">' + esc(typeof e.count === "number" ? e.count : "?") + "</text>" : "";
      return '<g class="' + cls + '" data-bfn-edge="' + esc(e.id) + '" tabindex="0" role="button" aria-label="' + esc(edgeWords(e) + ". Press to see its runs.") + '">' +
        '<line class="bfn-hit" ' + line + "/>" +
        '<line class="bfn-line" ' + line + ' stroke-width="' + width(e) + '"/>' + pulse + count + "</g>";
    }).join("");
    var nodes = d.nodes.map(function (n) {
      var p = pos[n.key], a = AGENTS[n.key] || { accent: "#94a3b8" };
      return '<g class="bfn-node" data-bfn-node="' + esc(n.key) + '" tabindex="0" role="link" aria-label="' + esc(n.name + ". Open its page.") + '">' +
        '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + (n.key === d.centre ? NODE_R + 8 : NODE_R) + '" fill="' + esc(a.accent) + '" fill-opacity="0.85"/>' +
        '<text x="' + p.x + '" y="' + (p.y + (n.key === d.centre ? NODE_R + 26 : NODE_R + 16)) + '">' + esc(shortName(n.name)) + "</text></g>";
    }).join("");
    return '<svg class="bfn-svg" viewBox="0 0 ' + SIZE + " " + SIZE + '" role="group" aria-label="The agent network: the links between the 18 agents, lit where runs flowed in the last ' + esc(windowWords()) + '">' +
      edges + nodes + "</svg>";
  }

  function toggleHtml(e) {
    if (S.confirming === e.id) {
      return '<span class="bfn-confirm" role="group" aria-label="Confirm">' +
        (e.enabled ? "Switch off this link? Work stops passing along it until you switch it on." : "Switch this link on again?") +
        ' <button type="button" class="bfn-btn" data-bfn-confirm="' + esc(e.id) + '">' + (e.enabled ? "Yes, switch it off" : "Yes, switch it on") + "</button>" +
        ' <button type="button" class="bfn-btn" data-bfn-cancel="' + esc(e.id) + '">Cancel</button></span>';
    }
    return '<button type="button" class="bfn-btn" data-bfn-toggle="' + esc(e.id) + '">' + (e.enabled ? "Switch off" : "Switch on") + "</button>";
  }

  /* The text alternative: one line per link, the same links and counts as the map. */
  function listHtml() {
    return '<ul class="bfn-list" aria-label="Links between agents">' + S.data.edges.map(function (e) {
      return '<li data-bfn-item="' + esc(e.id) + '"><span>' + esc(edgeWords(e)) + "</span>" +
        ' <button type="button" class="bfn-btn" data-bfn-edge="' + esc(e.id) + '">Runs</button> ' + toggleHtml(e) + "</li>";
    }).join("") + "</ul>";
  }

  function detailHtml() {
    var e = edgeById(S.selected);
    if (!e) return "";
    var body;
    if (!S.runs) body = '<p class="bfn-note">Loading...</p>';
    else if (S.runs.error) body = '<p class="bfn-note">' + esc(S.runs.error) + "</p>";
    else if (!S.runs.runs.length) body = '<p class="bfn-note">No runs flowed along this link in the last ' + esc(windowWords()) + ".</p>";
    else {
      body = '<ul class="bfn-runs">' + S.runs.runs.map(function (r) {
        return "<li><span>" + esc(when(r.at)) + "</span><span>" + esc(r.tool || "handoff") + "</span>" +
          (r.href ? '<a href="' + esc(r.href) + '">Open run</a>' : "") +
          (r.why ? ' <button type="button" class="bf-why-link" data-bf-why="' + esc(r.why) + '" aria-label="Why did this run, or not run?">Why?</button>' : "") + "</li>";
      }).join("") + "</ul>" +
        (S.runs.page < S.runs.pages ? '<button type="button" class="bfn-btn" data-bfn-more="' + esc(e.id) + '">More</button>' : "");
    }
    return '<div class="bfn-detail" role="region" aria-live="polite" aria-label="' + esc(nameOf(e.from) + " to " + nameOf(e.to)) + '">' +
      "<h4>" + esc(nameOf(e.from) + " to " + nameOf(e.to)) + "</h4>" +
      '<p class="bfn-note">' + esc((e.labels || []).join(". ")) + ". " + esc(countWords(e)) + "." + (e.enabled ? "" : " You switched it off.") + "</p>" +
      toggleHtml(e) + body + "</div>";
  }

  function edgeById(id) { return S.data ? S.data.edges.filter(function (e) { return e.id === id; })[0] || null : null; }

  function render() {
    var box = S.box;
    if (!box) return;
    var head = '<div class="bfn-head"><h3 id="bfnTitle">Network</h3><div class="bfn-windows" role="group" aria-label="Runs in the last">' +
      WINDOWS.map(function (w) { return '<button type="button" data-bfn-window="' + w[0] + '" aria-pressed="' + (S.window === w[0] ? "true" : "false") + '">' + w[0] + "</button>"; }).join("") +
      "</div></div>" +
      '<p class="bfn-note">A link lights only when runs really flowed along it in that time, from your own records. Press a link for its runs, or an agent to open it.</p>';
    if (S.error) { box.innerHTML = head + '<p class="bfn-note" role="status">' + esc(S.error) + "</p>"; return; }
    if (!S.data) { box.innerHTML = head + '<p class="bfn-note" role="status">Loading...</p>'; return; }
    box.innerHTML = head + svgHtml() + (S.note ? '<p class="bfn-note" role="status">' + esc(S.note) + "</p>" : "") + detailHtml() + listHtml();
  }

  /* ── reads ─────────────────────────────────────────────────────────────── */
  function load() {
    if (S.loading) return Promise.resolve();
    S.loading = true;
    return api("GET", "/api/agents/network?window=" + encodeURIComponent(S.window)).then(function (r) {
      S.loading = false;
      if (!r.ok || !r.body || !Array.isArray(r.body.edges) || !Array.isArray(r.body.nodes)) {
        S.error = "The network could not be read: " + ((r.body && r.body.error) || ("HTTP " + r.status)) + ".";
      } else { S.error = null; S.data = r.body; }
      render();
    }, function () { S.loading = false; S.error = "The network could not be read. Check the connection."; render(); });
  }
  function loadRuns(id, page) {
    var e = edgeById(id);
    if (!e) return Promise.resolve();
    if (page === 1) S.runs = null;
    render();
    return api("GET", "/api/agents/network/edge?from=" + encodeURIComponent(e.from) + "&to=" + encodeURIComponent(e.to) +
      "&window=" + encodeURIComponent(S.window) + "&page=" + page).then(function (r) {
      if (S.selected !== id) return;
      if (!r.ok) { S.runs = { error: "Its runs could not be read: " + (r.body.error || ("HTTP " + r.status)) + "." }; }
      else {
        var before = page > 1 && S.runs && S.runs.runs ? S.runs.runs : [];
        S.runs = { runs: before.concat(r.body.runs || []), page: r.body.page, pages: r.body.pages };
      }
      render();
    }, function () { S.runs = { error: "Its runs could not be read. Check the connection." }; render(); });
  }
  function select(id) { S.selected = id; S.runsPage = 1; return loadRuns(id, 1); }
  function setSwitch(id) {
    var e = edgeById(id);
    if (!e) return Promise.resolve();
    S.confirming = null;
    return api("PUT", "/api/agents/network/links", { from: e.from, to: e.to, enabled: !e.enabled }).then(function (r) {
      S.note = r.ok ? (nameOf(e.from) + " to " + nameOf(e.to) + " is " + (r.body.link && r.body.link.enabled ? "on" : "switched off") + ".")
        : (r.body.error || ("Not changed (HTTP " + r.status + ")."));
      return load();
    });
  }

  /* ── refresh only while it can be seen ──────────────────────────────────── */
  function shown() { return !!S.box && !document.hidden && !(S.box.closest && S.box.closest("[hidden]")); }
  function stop() { if (S.timer) { clearTimeout(S.timer); S.timer = null; } }
  function tick() {
    stop();
    if (document.hidden) return;
    S.timer = setTimeout(tick, REFRESH_MS);
    if (shown()) load();
  }

  function onActivate(t, e) {
    var w = t.closest("[data-bfn-window]");
    if (w) { S.window = w.getAttribute("data-bfn-window"); S.runs = null; load().then(function () { if (S.selected) loadRuns(S.selected, 1); }); return true; }
    var tg = t.closest("[data-bfn-toggle]");
    if (tg) { S.confirming = tg.getAttribute("data-bfn-toggle"); render(); return true; }
    var cf = t.closest("[data-bfn-confirm]");
    if (cf) { setSwitch(cf.getAttribute("data-bfn-confirm")); return true; }
    var cn = t.closest("[data-bfn-cancel]");
    if (cn) { S.confirming = null; render(); return true; }
    var mo = t.closest("[data-bfn-more]");
    if (mo) { S.runsPage += 1; loadRuns(mo.getAttribute("data-bfn-more"), S.runsPage); return true; }
    var ed = t.closest("[data-bfn-edge]");
    if (ed) { select(ed.getAttribute("data-bfn-edge")); return true; }
    var nd = t.closest("[data-bfn-node]");
    if (nd) { var a = AGENTS[nd.getAttribute("data-bfn-node")]; if (a) window.BFNetwork.go(a.page); return true; }
    return false;
  }

  function mount(box) {
    S.box = box;
    ensureStyle();
    box.addEventListener("click", function (e) { var t = e.target; if (t && t.closest) onActivate(t, e); });
    box.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var t = e.target;
      if (!t || !t.closest || !(t.closest("[data-bfn-edge]") || t.closest("[data-bfn-node]"))) return;
      if (t.tagName === "BUTTON") return;
      e.preventDefault();
      onActivate(t, e);
    });
    render();
    tick();
  }

  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else tick(); });
  window.addEventListener("hashchange", function () { if (shown()) tick(); });
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-deck-tab]") : null;
    if (t && t.getAttribute("data-deck-tab") === "agents") setTimeout(function () { if (shown()) tick(); }, 0);
  });

  function boot() {
    var box = document.getElementById("deckNetwork");
    if (box && !box.getAttribute("data-mounted")) { box.setAttribute("data-mounted", "true"); mount(box); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.BFNetwork = {
    state: S, load: load, render: render, tick: tick, stop: stop, select: select, setSwitch: setSwitch,
    positions: positions, timerActive: function () { return !!S.timer; }, edgeWords: edgeWords,
    // Opening an agent's page, in one place.
    go: function (href) { window.location.assign(href); }
  };
})();

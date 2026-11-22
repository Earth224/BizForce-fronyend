/* ══════════════════════════════════════════════════════════════════════════
   bf-agent-marks.js — each agent's own colour and icon, from ONE place (FX3,
   Nov 22 2026).

   Read by the dashboard (the AI Agent Directory box in the orbit's Agents
   set, dashboard.html <template id="orbitTools">) and by the Agent Directory
   (ai-agents.html: its Large cards, and scripts/bf-agents-views.js's Compact
   rows and Grid tiles), so an agent looks the same on both pages.

   NAMED BEFORE -> AFTER (FX3): BEFORE the dashboard drew its five agents'
   icons inline and coloured them through css/bizforce-ui.css's
   .bf-hq-icon.seo / .sales / .content / .analytics-agent / .social rules, and
   the Directory drew one generic ring for every agent. AFTER both read this
   map: the dashboard's five keep exactly the colour, ring, glow and drawing
   they had (the same values, now set from here), and every Directory card
   carries its agent's own.

   An agent's look, as the dashboard draws it:
     the icon's stroke   its colour (a theme token where the dashboard uses one)
     the ring            border-color: rgba(<colour>, 0.45)
     the glow            box-shadow: 0 0 24px rgba(<colour>, 0.18)
     the drawing         a 24 x 24 stroked icon, stroke 1.5, round caps and joins

     BFAgentMarks.AGENTS             { type: { colour, icon } }
     BFAgentMarks.has(type)          true for a known agent type
     BFAgentMarks.svg(type)          the icon as an SVG string (stroke currentColor)
     BFAgentMarks.colour(type)       the stroke colour as CSS
     BFAgentMarks.paint(el, type)    sets el's colour, ring and glow (inline)
     BFAgentMarks.fill(root)         fills every [data-bf-agent-mark] under root
   <span data-bf-agent-mark="seo"></span> is filled when this file loads (and
   inside every <template>, so copies made from one carry it).

   Decoration beside a name that already says the same: aria-hidden, no focus.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  // colour: #rrggbb, or the theme accent it follows as var(--bf-accent-a|b, its fallback).
  var AGENTS = {
    seo:                { colour: "var(--bf-accent-a, #22d3ee)", icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
    sales:              { colour: "var(--bf-accent-b, #a855f7)", icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    content:            { colour: "#34d399", icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    analytics:          { colour: "#60a5fa", icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    social:             { colour: "#f472b6", icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    email:              { colour: "#fbbf24", icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/>' },
    ads:                { colour: "#818cf8", icon: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>' },
    reputation:         { colour: "#f87171", icon: '<polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/>' },
    community:          { colour: "#4ade80", icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
    influencer:         { colour: "#e879f9", icon: '<polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/>' },
    operations:         { colour: "#94a3b8", icon: '<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/>' },
    etsy:               { colour: "#fb923c", icon: '<path d="M3 9h18v12H3z"/><path d="M7 9V5h10v4"/>' },
    store:              { colour: "#38bdf8", icon: '<path d="M3 9l2-4h14l2 4"/><path d="M5 9v11h14V9"/><path d="M9 22V12h6v10"/>' },
    broker:             { colour: "#c084fc", icon: '<path d="M12 2v20"/><path d="M17 5H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6"/>' },
    publicist:          { colour: "#fcd34d", icon: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>' },
    rd:                 { colour: "var(--bf-accent-a, #22d3ee)", icon: '<path d="M9 3h6"/><path d="M10 3v7.76a2 2 0 0 1-.55 1.38L6.8 15.5"/><path d="M14 3v7.76a2 2 0 0 0 .55 1.38L17.2 15.5"/><path d="M6.8 15.5A1.5 1.5 0 0 0 5.66 18H18.34A1.5 1.5 0 0 0 17.2 15.5"/><path d="M6 21h12"/>' },
    executive:          { colour: "#e2e8f0", icon: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' },
    vertical_marketing: { colour: "#a3e635", icon: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' }
  };
  function key(type) {
    var t = String(type || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(AGENTS, t) ? t : null;
  }
  function has(type) { return key(type) !== null; }
  function channels(hex) {
    var h = String(hex).replace(/^#/, "");
    return parseInt(h.slice(0, 2), 16) + ", " + parseInt(h.slice(2, 4), 16) + ", " + parseInt(h.slice(4, 6), 16);
  }
  function colour(type) {
    var k = key(type);
    return k ? AGENTS[k].colour : null;
  }
  // The ring's and glow's channels: a token colour's own -rgb token (its fallback the same colour), else the colour's.
  function rgba(type, alpha) {
    var c = colour(type); if (!c) return null;
    var t = /^var\((--[a-z0-9-]+), (#[0-9a-f]{6})\)$/.exec(c);
    var ch = t ? "var(" + t[1] + "-rgb, " + channels(t[2]) + ")" : channels(c);
    return "rgba(" + ch + ", " + alpha + ")";
  }
  function svg(type) {
    var k = key(type); if (!k) return "";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + AGENTS[k].icon + "</svg>";
  }
  function paint(el, type) {
    if (!el || !el.style || !has(type)) return false;
    var c = colour(type);
    el.style.setProperty("--bf-icon-stroke", c);
    el.style.setProperty("color", c);
    el.style.setProperty("border-color", rgba(type, "0.45"));
    el.style.setProperty("box-shadow", "0 0 24px " + rgba(type, "0.18"));
    el.setAttribute("data-agent-mark", key(type));
    return true;
  }
  function fillOne(el) {
    var type = el.getAttribute("data-bf-agent-mark");
    if (!has(type) || el.getAttribute("data-agent-mark")) return;
    el.innerHTML = svg(type);
    el.setAttribute("aria-hidden", "true");
    paint(el, type);
  }
  function fill(scope) {
    var r = scope || (typeof document !== "undefined" ? document : null);
    if (!r || !r.querySelectorAll) return 0;
    var n = 0;
    Array.prototype.forEach.call(r.querySelectorAll("[data-bf-agent-mark]"), function (el) { fillOne(el); n++; });
    Array.prototype.forEach.call(r.querySelectorAll("template"), function (t) { if (t.content) n += fill(t.content); });
    return n;
  }

  var api = { AGENTS: AGENTS, has: has, colour: colour, rgba: rgba, svg: svg, paint: paint, fill: fill };
  root.BFAgentMarks = api;
  if (typeof document !== "undefined") fill(document);
})(typeof window !== "undefined" ? window : this);

/* ══════════════════════════════════════════════════════════════════════════
   bf-hq-views.js — the phone dashboard's card views and orbit toggle (HQ1,
   Nov 19 2026). PHONE ONLY: everything it adds is hidden above 760 px by
   dashboard.html's <style id="hq1Phone">, and it asks the server nothing there.

   THE VIEW ROW, under the orbit (or the chip row): the open portal's set
   title ("SELL TOOLS", ..., "THE ORACLE"), then Large, Compact and Grid, then
   the orbit button. Each is a 44 px button with an aria-label and
   aria-pressed.

   THE THREE VIEWS show the SAME boxes the orbit draws (scripts/bf-orbit.js):
   the two main boxes first, then the open portal's grid (which leaves out any
   tool already in a main box), in that order. Large is the PH1 cards as they
   are. Compact is one row per box and Grid one tile per box, read from the
   boxes themselves: the box's icon (its own colour), its title, its
   description (the sub-line), its figure, and the link of its main button.
   The two main-box rows and tiles carry Swap as a 44 px overflow button,
   which opens the orbit's own Swap list (BFOrbit.swapList).

   THE ORBIT is shown by default. The orbit button hides it and shows a row of
   five 44 px chips instead (the portals in the orbit's order, the open one
   highlighted as the orbit highlights it); a chip opens its portal. The open
   portal is the orbit's (sessionStorage bf_orbit_portal), so switching keeps it.

   THE ORACLE SET: the moon (scripts/bf-oracle-moon.js) on the ORACLE node, the
   ORACLE chip and the orbit's centre when ORACLE is open; the Termaximus chat
   box's gold on the rings, the "(open)" label, the set title and the Oracle
   tools' icons (each icon's own drawing used as a mask over the gold).

   SAVED per member: user_preferences.hq_card_view and hq_orbit (GET and PUT
   /api/user/preferences, migration 188), and a device copy in localStorage
   (bf_hq_view, bf_hq_orbit; cleared at sign-out by scripts/bf-session.js) so a
   choice applies before the server answers. A choice the server holds wins
   once it arrives; one it does not hold yet (null) is sent to it from here.
   Defaults: Compact, the orbit shown.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  var PHONE_QUERY = "(max-width: 760px)";
  var API_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var VIEWS = ["large", "compact", "grid"], DEFAULT_VIEW = "compact";
  var ORBITS = ["shown", "hidden"], DEFAULT_ORBIT = "shown";
  var VIEW_KEY = "bf_hq_view", ORBIT_KEY = "bf_hq_orbit";
  var TITLES = { grow: "GROW TOOLS", sell: "SELL TOOLS", connect: "CONNECT TOOLS", agents: "AGENT TOOLS", oracle: "THE ORACLE" };
  var VIEW_LABELS = { large: "Large cards", compact: "Compact list", grid: "Grid of tiles" };

  var root = document.getElementById("orbitTop");
  var O = window.BFOrbit;
  if (!root || !O) return;
  var panel = document.getElementById("orbitPanel"), stage = document.getElementById("orbitStage");
  var mainWrap = document.getElementById("orbitMain"), grid = document.getElementById("orbitGrid");

  /* ── storage, never trusted to work ── */
  function readLocal(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function writeLocal(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function valid(list, v) { return list.indexOf(v) !== -1 ? v : null; }
  function phone() { try { return !!(window.matchMedia && window.matchMedia(PHONE_QUERY).matches); } catch (e) { return false; } }

  var state = { view: valid(VIEWS, readLocal(VIEW_KEY)) || DEFAULT_VIEW, orbit: valid(ORBITS, readLocal(ORBIT_KEY)) || DEFAULT_ORBIT, swapping: -1, server: false };

  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text !== undefined && text !== null) x.textContent = String(text); return x; }
  function sv(tag, attrs) { var x = document.createElementNS(SVG_NS, tag); Object.keys(attrs || {}).forEach(function (k) { x.setAttribute(k, attrs[k]); }); return x; }
  function icon(kind) {
    var g = sv("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false", "class": "hq-glyph" });
    if (kind === "large") { g.appendChild(sv("rect", { x: "3", y: "4", width: "18", height: "7", rx: "2" })); g.appendChild(sv("rect", { x: "3", y: "13", width: "18", height: "7", rx: "2" })); }
    else if (kind === "compact") { [6, 12, 18].forEach(function (y) { g.appendChild(sv("line", { x1: "4", y1: String(y), x2: "20", y2: String(y) })); }); }
    else if (kind === "grid") { [[3, 3], [13, 3], [3, 13], [13, 13]].forEach(function (p) { g.appendChild(sv("rect", { x: String(p[0]), y: String(p[1]), width: "8", height: "8", rx: "1.5" })); }); }
    else if (kind === "orbit") { g.appendChild(sv("ellipse", { cx: "12", cy: "12", rx: "10", ry: "4.5" })); g.appendChild(sv("circle", { cx: "12", cy: "12", r: "2.5", "class": "hq-glyph-fill" })); g.appendChild(sv("circle", { cx: "20.6", cy: "10", r: "1.6", "class": "hq-glyph-fill" })); }
    else if (kind === "chevron") { g.appendChild(sv("polyline", { points: "9 5 16 12 9 19" })); }
    else if (kind === "more") { [6, 12, 18].forEach(function (x) { g.appendChild(sv("circle", { cx: String(x), cy: "12", r: "1.8", "class": "hq-glyph-fill" })); }); }
    return g;
  }
  function gold(node) { node.classList.add("hq-gold"); return node; }

  /* ── the chip row (in the panel, where the orbit's stage is) ── */
  var chips = el("div", "hq-chips");
  chips.id = "hqChips";
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Portals");
  var chipBtn = {};
  O.PORTALS.forEach(function (p) {
    var b = el("button", "hq-chip");
    b.type = "button";
    b.setAttribute("data-portal", p.key);
    b.setAttribute("aria-label", p.title + ", " + p.tools.length + " tools");
    b.setAttribute("aria-pressed", "false");
    var disc = el("span", "hq-chip-disc");
    var em = stage.querySelector('.orbit-portal[data-portal="' + p.key + '"] .orbit-emblem');
    if (em) disc.appendChild(em.cloneNode(true));
    if (p.key === "oracle") { var m = el("span", "hq-moon"); m.setAttribute("data-hq-moon", "chip"); disc.appendChild(m); disc.appendChild(el("span", "hq-gold-ring")); }
    b.appendChild(disc);
    b.appendChild(el("span", "hq-chip-name", p.title));
    b.addEventListener("click", function () { if (O.state.open !== p.key) O.open(p.key); });
    chipBtn[p.key] = b;
    chips.appendChild(b);
  });
  panel.insertBefore(chips, stage);

  /* The moon on the ORACLE node and in the orbit's centre, and the gold rings (shown on the phone by CSS). */
  (function oracleMarks() {
    var disc = stage.querySelector('.orbit-portal[data-portal="oracle"] .orbit-disc');
    if (disc) { var m = el("span", "hq-moon"); m.setAttribute("data-hq-moon", "node"); disc.appendChild(m); disc.appendChild(el("span", "hq-gold-ring")); }
    var core = document.getElementById("orbitCore");
    if (core) { var c = el("span", "hq-core-moon"); c.setAttribute("data-hq-moon", "core"); core.insertBefore(c, core.firstChild); core.appendChild(el("span", "hq-gold-ring")); }
  }());

  /* ── the view row ── */
  var row = el("div", "hq-view-row");
  row.id = "hqViewRow";
  var title = el("h2", "hq-set-title", "");
  title.id = "hqSetTitle";
  row.appendChild(title);
  var btns = el("div", "hq-view-btns");
  btns.setAttribute("role", "group");
  btns.setAttribute("aria-label", "Card view");
  var viewBtn = {};
  VIEWS.forEach(function (v) {
    var b = el("button", "hq-view-btn");
    b.type = "button";
    b.setAttribute("data-view", v);
    b.setAttribute("aria-label", VIEW_LABELS[v]);
    b.setAttribute("aria-pressed", "false");
    b.appendChild(icon(v));
    b.addEventListener("click", function () { choose("view", v); });
    viewBtn[v] = b;
    btns.appendChild(b);
  });
  var orbitBtn = el("button", "hq-view-btn hq-orbit-btn");
  orbitBtn.type = "button";
  orbitBtn.id = "hqOrbitBtn";
  orbitBtn.setAttribute("aria-label", "Show the orbit");
  orbitBtn.setAttribute("aria-pressed", "true");
  orbitBtn.setAttribute("aria-controls", "orbitStage hqChips");
  orbitBtn.appendChild(icon("orbit"));
  orbitBtn.addEventListener("click", function () { choose("orbit", state.orbit === "shown" ? "hidden" : "shown"); });
  btns.appendChild(orbitBtn);
  row.appendChild(btns);
  var list = el("div", "hq-list");
  list.id = "hqList";
  list.setAttribute("role", "region");
  panel.parentNode.insertBefore(row, panel.nextSibling);
  panel.parentNode.insertBefore(list, row.nextSibling);

  /* ── the figures: the box's own, never a new one ── */
  function shortUnit(u) { return String(u || "").replace(/\s+(this week|today|now)$/, ""); }
  function parseFigure(text) {
    var t = String(text || "").trim(), m = /^(\d[\d.,]*)\s+(.+)$/.exec(t);
    if (m) return { num: m[1], unit: shortUnit(m[2]) };
    m = /^Balance (\d[\d.,]*) (\S+)$/.exec(t);
    if (m) return { num: m[1], unit: m[2] };
    return null;
  }
  function figureOf(card) {
    var big = card.querySelector(".orbit-big");
    if (big && big.querySelector("strong")) return { num: big.querySelector("strong").textContent.trim(), unit: shortUnit(big.querySelector("span") ? big.querySelector("span").textContent : "") };
    var live = card.querySelector(".orbit-live, .orbit-second");
    return live ? parseFigure(live.textContent) : null;
  }
  function slugOf(card) { return card.getAttribute("data-card") || (card.id === "agentDirectoryLanding" || card.classList.contains("orbit-dir") ? "agent-directory" : ""); }
  function linkOf(card, tool) { var a = card.querySelector("a.bf-btn"); return a ? a.getAttribute("href") : (tool && tool.href) || null; }
  function subOf(tool) { var p = tool && tool.node ? tool.node.querySelector("p") : null; return p ? p.textContent.replace(/\s+/g, " ").trim() : ""; }
  function oracleTool(slug) { for (var i = 0; i < O.PORTALS.length; i++) if (O.PORTALS[i].key === "oracle") return O.PORTALS[i].tools.indexOf(slug) !== -1; return false; }

  /* An Oracle tool's icon drawn in the chat box's gold: its own SVG as the mask over the gold. */
  function goldGlyph(svgNode) {
    var c = svgNode.cloneNode(true);
    c.setAttribute("xmlns", SVG_NS);
    c.setAttribute("stroke", "#fff");
    var url = "url(\"data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(c)) + "\")";
    var g = el("span", "hq-gold-glyph hq-gold");
    g.setAttribute("aria-hidden", "true");
    g.style.setProperty("-webkit-mask-image", url);
    g.style.setProperty("mask-image", url);
    return g;
  }

  /* ── one row or tile per box the orbit drew ── */
  function cards() {
    var mains = Array.prototype.slice.call(mainWrap.querySelectorAll(":scope > .orbit-main-box"));
    var boxes = grid.hidden ? [] : Array.prototype.slice.call(grid.querySelectorAll(":scope > .orbit-box"));
    return mains.concat(boxes);
  }
  function item(card) {
    var tools = O.tools(), slug = slugOf(card), tool = tools[slug];
    var main = card.getAttribute("data-main");
    var it = el("div", "hq-item");
    it.setAttribute("data-card", slug);
    if (main !== null) it.setAttribute("data-main", main);
    var a = el("a", "hq-link");
    var href = linkOf(card, tool);
    if (href) a.setAttribute("href", href);
    var tile = el("span", "hq-icon");
    var ic = card.querySelector(".bf-neon-icon");
    if (ic) {
      var copy = ic.cloneNode(true);
      copy.removeAttribute("id");
      if (oracleTool(slug)) { var s = copy.querySelector("svg"); if (s) { copy.replaceChild(goldGlyph(s), s); it.setAttribute("data-gold", "true"); } }
      tile.appendChild(copy);
    }
    a.appendChild(tile);
    var text = el("span", "hq-text");
    var h = card.querySelector("h3");
    text.appendChild(el("span", "hq-name", h ? h.textContent.trim() : (tool ? tool.title : slug)));
    var sub = subOf(tool);
    if (sub) text.appendChild(el("span", "hq-sub", sub));
    a.appendChild(text);
    var fig = figureOf(card);
    var f = el("span", "hq-fig");
    if (fig) {
      it.setAttribute("data-fig", "true");
      f.appendChild(el("strong", "hq-num", fig.num));
      if (fig.unit) f.appendChild(el("span", "hq-unit", fig.unit));
    } else f.appendChild(icon("chevron"));
    a.appendChild(f);
    it.appendChild(a);
    if (main !== null) {
      var i = Number(main);
      var more = el("button", "hq-more");
      more.type = "button";
      more.setAttribute("aria-label", "Swap " + (h ? h.textContent.trim() : slug) + " for another tool");
      more.setAttribute("aria-expanded", state.swapping === i ? "true" : "false");
      more.appendChild(icon("more"));
      more.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        state.swapping = state.swapping === i ? -1 : i;
        draw();
      });
      it.appendChild(more);
      if (state.swapping === i) { it.classList.add("is-swapping"); it.appendChild(O.swapList(i)); }
    }
    return it;
  }
  function draw() {
    while (list.firstChild) list.removeChild(list.firstChild);
    var open = O.state.open;
    title.textContent = TITLES[open] || "";
    title.classList.toggle("hq-gold", open === "oracle");
    list.setAttribute("aria-label", (TITLES[open] || "Your tools").toLowerCase().replace(/^\w/, function (c) { return c.toUpperCase(); }));
    if (state.view !== "large") cards().forEach(function (c) { list.appendChild(item(c)); });
    O.PORTALS.forEach(function (p) {
      var on = p.key === open;
      chipBtn[p.key].setAttribute("aria-pressed", on ? "true" : "false");
      chipBtn[p.key].classList.toggle("is-open", on);
    });
    var name = chipBtn.oracle && chipBtn.oracle.querySelector(".hq-chip-name");
    if (name) name.classList.toggle("hq-gold", open === "oracle");
    var oname = stage.querySelector('.orbit-portal[data-portal="oracle"] .orbit-portal-name');
    // The orbit's own label is on the desktop too: gold there only on the phone.
    if (oname) oname.classList.toggle("hq-gold", open === "oracle" && phone());
    root.setAttribute("data-hq-open", open || "");
  }
  function apply() {
    var was = root.getAttribute("data-hq-orbit");
    root.setAttribute("data-hq-view", state.view);
    root.setAttribute("data-hq-orbit", state.orbit);
    VIEWS.forEach(function (v) { viewBtn[v].setAttribute("aria-pressed", state.view === v ? "true" : "false"); });
    orbitBtn.setAttribute("aria-pressed", state.orbit === "shown" ? "true" : "false");
    orbitBtn.setAttribute("aria-label", state.orbit === "shown" ? "Hide the orbit" : "Show the orbit");
    draw();
    // The orbit lays itself out from its stage's width: back on the screen, it measures again.
    if (was === "hidden" && state.orbit === "shown") { try { window.dispatchEvent(new Event("resize")); } catch (e) { /* the next resize */ } }
    if (window.BFOracleMoon && phone()) window.BFOracleMoon.paint();
  }

  /* ── saving ── */
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
  function choose(kind, value) {
    if (kind === "view") { if (state.view === value) return; state.view = value; state.swapping = -1; writeLocal(VIEW_KEY, value); apply(); return save({ hq_card_view: value }); }
    if (state.orbit === value) return;
    state.orbit = value; writeLocal(ORBIT_KEY, value); apply(); return save({ hq_orbit: value });
  }
  // The server's choices, on the phone only: a stored one wins; one it does not hold yet is sent from this device's copy.
  function pull() {
    if (!phone() || state.server || typeof fetch !== "function") return Promise.resolve(false);
    state.server = true;
    return fetch(apiBase() + "/api/user/preferences", { headers: headers(false) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || typeof b !== "object") return false;
        var send = {};
        var v = valid(VIEWS, b.hq_card_view), o = valid(ORBITS, b.hq_orbit);
        if (v) { state.view = v; writeLocal(VIEW_KEY, v); } else if (b.hq_card_view === null && valid(VIEWS, readLocal(VIEW_KEY))) send.hq_card_view = state.view;
        if (o) { state.orbit = o; writeLocal(ORBIT_KEY, o); } else if (b.hq_orbit === null && valid(ORBITS, readLocal(ORBIT_KEY))) send.hq_orbit = state.orbit;
        apply();
        if (Object.keys(send).length) save(send);
        return true;
      })
      .catch(function () { return false; });
  }

  root.addEventListener("bf-orbit-drawn", function () { state.swapping = -1; draw(); if (window.BFOracleMoon && phone()) window.BFOracleMoon.paint(); });
  var mq = null;
  try { mq = window.matchMedia ? window.matchMedia(PHONE_QUERY) : null; } catch (e) { mq = null; }
  if (mq) { var onChange = function () { pull(); apply(); }; if (mq.addEventListener) mq.addEventListener("change", onChange); else if (mq.addListener) mq.addListener(onChange); }

  window.BFHqViews = {
    VIEWS: VIEWS, ORBITS: ORBITS, DEFAULT_VIEW: DEFAULT_VIEW, DEFAULT_ORBIT: DEFAULT_ORBIT, VIEW_KEY: VIEW_KEY, ORBIT_KEY: ORBIT_KEY, TITLES: TITLES,
    state: function () { return { view: state.view, orbit: state.orbit }; }, choose: choose, pull: pull, draw: draw, parseFigure: parseFigure
  };
  apply();
  pull();
}());

/* ══════════════════════════════════════════════════════════════════════════
   BF MUSIC — the BizForce music player: a member's own music, in a studio
   console on the dashboard, a mini-bar on every other signed-in page, and a
   pop-out window that keeps playing while they move around the app.

   WHERE IT RUNS. scripts/bf-session.js loads this file on every page it
   guards. It becomes:
     panel   on the dashboard (#bfMusicPanel): the whole console;
     popout  in music-popout.html (#bfMusicPopout): the console, alone;
     mini    on any other page that wears the member's theme: a small bar,
             shown once the member has played something.
   A public page (scripts/bf-theme.js publicView) never gets the player.

   THE LIBRARY is the server's (lib/music.js, GET /api/music): the member's
   own uploads, private to them, played through signed URLs that expire. A
   URL is asked for when a track starts, again whenever the one held is within
   a minute of expiring, and again if playback fails (an expired link): the
   track picks up where it was.

   THE SOUND. Two <audio> decks, each through its own Web Audio gain node, into
   one master gain (the volume), one AnalyserNode, and the speakers. The MIX
   (crossfade, 0 … 12 s) starts the next track on the other deck that many
   seconds before the current one ends and blends them with equal-power
   curves over exactly that time:
       outgoing gain  cos(t / d × π/2)      incoming gain  sin(t / d × π/2)
   for t from 0 to d (so the two always add to the same loudness). At t = d
   the outgoing deck is paused and its gain set to 0: nothing overlaps after
   the mix. Mix off (0) is a clean cut.

   THE VISUALISER draws the analyser on a canvas: a studio spectrum (48 bars,
   log-spaced from 30 Hz to 16 kHz, smoothed, with peak caps that fall back
   slowly) or a waveform line, switchable, in the theme's accent colours
   (BFTheme.color). It runs on requestAnimationFrame (60 fps) only while the
   page is visible; a hidden page draws nothing. Under prefers-reduced-motion
   it is a still meter and no frame is ever requested.

   "PLAY WHEN I OPEN BIZFORCE". Browsers refuse sound until the person has
   interacted with the page, so with the setting on the player ARMS when a
   page opens and starts on the member's first click, tap or key press
   anywhere on it; nothing is played before that (play() itself refuses).
   The setting says so: AUTOPLAY_NOTE.

   ONE SOURCE AT A TIME. Every instance (each tab, the pop-out) talks on the
   BroadcastChannel "bf-music". An instance about to play posts "claim"; any
   other that is playing pauses at once and answers "released". If another
   was heard playing in the last 1.5 s, the claimer starts at gain 0 and
   rises only after "released" (or 0.5 s), so two are never heard together.
   THE POP-OUT: "Pop out" opens music-popout.html; when it says "popout-hello"
   the page pauses FIRST and then hands it the track, position, queue and
   settings ("handoff"); the pop-out starts from there. While the pop-out is
   open (its "status" heard in the last 2 s) a page plays nothing itself: its
   controls are relayed to the pop-out ("cmd") and it shows REMOTE_PLAYING.
   Closing the pop-out pauses it and posts "popout-closed": the music stops.

   MOVE WITH THE MUSIC. While it plays, and only when one of the member's
   themes has "Move with the music" on (BFTheme.musicWanted), the source
   computes a live energy 0 … 1 about 30 times a second and posts it
   ("energy"); scripts/bf-theme.js on every BizForce page hands it to
   BFTheme.setLiveEnergy. From the analyser's spectrum (bytes 0 … 255):
       bass    mean of 20–150 Hz / 255          (size)
       highs   mean of 4–12 kHz / 255           (shimmer)
       avg     avg + 0.05 × (bass − avg)        (a slow average of the bass)
       onset   max(0, 4 × (bass − avg))         (a beat: bass above its average)
       raw     0.6 × bass + 0.3 × onset + 0.1 × highs     (0 … 1.9: a beat overshoots)
       energy  clamp(energy + (raw − energy) × (0.5 rising, 0.12 falling)) to 0 … 1
   When the music stops, the energy falls by 1/30 a step, to 0 within 1 s.
   Off under prefers-reduced-motion: nothing is measured or posted.

   MEMORY. bf_music in localStorage holds the track, the position, the
   volume, the queue and the player's settings, for the member signed in
   only; scripts/bf-session.js clears it at sign-out. The library itself is
   the server's.

   No emoji anywhere: every icon is drawn SVG. */
(function () {
  "use strict";
  if (window.BFMusic) return;

  var doc = document;
  var STORE_KEY = "bf_music";
  var CHANNEL_NAME = "bf-music";
  var API_ORIGIN_FALLBACK = "https://dynamic-prosperity-production-5382.up.railway.app";
  var CROSSFADE_MAX = 12;
  var ENERGY_HZ = 30;
  var EASE_OUT_S = 1;
  var TICK_MS = 250;
  var SAVE_EVERY_MS = 1000;
  var POPOUT_GONE_MS = 2000;
  var OTHER_PLAYING_MS = 1500;
  var RELEASE_WAIT_MS = 500;
  var RAMP_S = 0.15;
  var URL_MARGIN_MS = 60 * 1000;
  var BARS = 48;
  var AUTOPLAY_LABEL = "Play when I open BizForce";
  var AUTOPLAY_NOTE = "Starts on your first click — browsers don't allow sound before that.";
  var REMOTE_PLAYING = "Playing in the pop-out player";
  var REMOTE_OPEN = "The pop-out player is open";
  var POPUP_BLOCKED = "Your browser blocked the pop-out window. Allow pop-ups for BizForce, then press Pop out again.";
  var PRESS_PLAY = "Press play to start the music here.";
  var YIELDED = "Paused: music started elsewhere in BizForce.";
  var REPEATS = ["off", "all", "one"];
  var VIEWS = ["spectrum", "wave"];
  var ACCEPT = "audio/*,.mp3,.m4a,.aac,.ogg,.opus,.flac,.wav";
  var DEFAULTS = { v: 1, uid: null, track_id: null, position: 0, volume: 0.8, muted: false, queue: [], shuffle: false,
    repeat: "off", crossfade: 0, autoplay: false, view: "spectrum", playlist_id: "" };

  var ID = "m" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function themeEngine() { return typeof window.BFTheme !== "undefined" ? window.BFTheme : null; }
  function modeOf() {
    if (doc.getElementById("bfMusicPopout")) return "popout";
    if (doc.getElementById("bfMusicPanel")) return "panel";
    var T = themeEngine();
    if (!T || T.publicView(T.pageKey())) return null;
    return "mini";
  }
  var MODE = modeOf();

  /* ── pure parts: the mix, the energy, the clock ────────────────────────── */
  function clamp01(n) { return n > 0 ? (n < 1 ? n : 1) : 0; }
  /* The two gains of a mix of length d, t seconds in. */
  function fadeGains(t, d) {
    if (!(d > 0) || t >= d) return { out: 0, in: 1 };
    var x = clamp01(t / d) * Math.PI / 2;
    return { out: Math.cos(x), in: Math.sin(x) };
  }
  function fadeCurve(kind, steps) {
    var a = new Float32Array(steps);
    for (var i = 0; i < steps; i++) { var g = fadeGains(i / (steps - 1), 1); a[i] = kind === "in" ? g.in : g.out; }
    a[steps - 1] = kind === "in" ? 1 : 0;
    return a;
  }
  function bandMean(bins, sampleRate, fftSize, lo, hi) {
    var w = sampleRate / fftSize;
    var a = Math.max(1, Math.floor(lo / w)), b = Math.min(bins.length - 1, Math.ceil(hi / w));
    var sum = 0, n = 0;
    for (var i = a; i <= b; i++) { sum += bins[i]; n++; }
    return n ? sum / n / 255 : 0;
  }
  /* One step of the live energy (the formula above). */
  function energyStep(prev, bins, sampleRate, fftSize) {
    var e0 = clamp01(prev && prev.e), avg0 = clamp01(prev && prev.avg);
    var bass = clamp01(bandMean(bins, sampleRate, fftSize, 20, 150));
    var highs = clamp01(bandMean(bins, sampleRate, fftSize, 4000, 12000));
    var onset = Math.max(0, 4 * (bass - avg0));
    var raw = 0.6 * bass + 0.3 * onset + 0.1 * highs;
    var e = e0 + (raw - e0) * (raw > e0 ? 0.5 : 0.12);
    return { e: clamp01(e), avg: avg0 + 0.05 * (bass - avg0), bass: bass, onset: onset, highs: highs };
  }
  /* The energy one step after the music stopped: to 0 within EASE_OUT_S. */
  function easeOut(e) { var n = clamp01(e) - 1 / (ENERGY_HZ * EASE_OUT_S); return n > 1e-6 ? n : 0; }
  function clock(s) {
    if (!(s >= 0) || !isFinite(s)) return "0:00";
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (x < 10 ? "0" : "") + x;
  }
  function mbText(bytes) { return (Math.round((Number(bytes) || 0) / 104857.6) / 10) + " MB"; }

  if (!MODE) {
    window.BFMusic = { mode: null, fadeGains: fadeGains, energyStep: energyStep, easeOut: easeOut };
    return;
  }

  /* ── who, where, and memory ─────────────────────────────────────────────── */
  function signedInId() {
    var t = null;
    try { t = localStorage.getItem("bf_token"); } catch (e) { t = null; }
    if (!t) return null;
    try { return JSON.parse(window.atob(t.split(".")[1])).id || null; } catch (e) { return null; }
  }
  function token() { try { return localStorage.getItem("bf_token"); } catch (e) { return null; } }
  function apiOrigin() { return (typeof window.API_URL === "string" && window.API_URL) || API_ORIGIN_FALLBACK; }
  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }
  var UID = signedInId();
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { s = null; }
    var out = Object.assign({}, DEFAULTS);
    if (s && typeof s === "object" && s.uid && s.uid === UID) {
      Object.keys(DEFAULTS).forEach(function (k) { if (s[k] !== undefined) out[k] = s[k]; });
    }
    out.uid = UID;
    out.volume = clamp01(Number(out.volume));
    out.crossfade = Math.min(CROSSFADE_MAX, Math.max(0, Math.round(Number(out.crossfade) || 0)));
    if (REPEATS.indexOf(out.repeat) === -1) out.repeat = "off";
    if (VIEWS.indexOf(out.view) === -1) out.view = "spectrum";
    if (!Array.isArray(out.queue)) out.queue = [];
    out.position = Math.max(0, Number(out.position) || 0);
    return out;
  }
  var S = load();
  function save() {
    if (!UID) return;
    S.uid = UID;
    S.position = currentPosition();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: the player still plays */ }
  }

  /* ── the library (the server's) ─────────────────────────────────────────── */
  var LIB = { tracks: [], playlists: [], used_bytes: 0, cap_bytes: 0, file_max_bytes: 0, loaded: false };
  var urls = {};
  function api(path, opts) {
    opts = opts || {};
    var headers = { "Authorization": "Bearer " + token() };
    if (opts.json !== undefined) headers["Content-Type"] = "application/json";
    return fetch(apiOrigin() + path, { method: opts.method || "GET", headers: headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined })
      .then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b || {} }; }, function () { return { ok: r.ok, status: r.status, body: {} }; });
      }, function () { return { ok: false, status: 0, body: { error: "BizForce could not be reached. Check your connection." } }; });
  }
  function takeLibrary(body) {
    if (!body || !Array.isArray(body.tracks)) return;
    LIB.tracks = body.tracks;
    LIB.playlists = Array.isArray(body.playlists) ? body.playlists : [];
    LIB.used_bytes = Number(body.used_bytes) || 0;
    LIB.cap_bytes = Number(body.cap_bytes) || LIB.cap_bytes;
    LIB.file_max_bytes = Number(body.file_max_bytes) || LIB.file_max_bytes;
    LIB.loaded = true;
    if (S.playlist_id && !playlistById(S.playlist_id)) S.playlist_id = "";
    var have = LIB.tracks.map(function (t) { return t.id; });
    S.queue = S.queue.filter(function (id) { return have.indexOf(id) !== -1; });
    if (!S.queue.length) S.queue = baseOrder();
    else baseOrder().forEach(function (id) { if (S.queue.indexOf(id) === -1) S.queue.push(id); });
    if (S.track_id && have.indexOf(S.track_id) === -1) { S.track_id = null; S.position = 0; }
  }
  var libraryLoad = null;
  function loadLibrary(force) {
    if (libraryLoad && !force) return libraryLoad;
    libraryLoad = api("/api/music").then(function (r) {
      if (r.ok) takeLibrary(r.body);
      else say(r.body.error || "Your music could not be loaded. Reload the page to try again.", "error");
      render();
      return LIB;
    });
    return libraryLoad;
  }
  function trackById(id) { for (var i = 0; i < LIB.tracks.length; i++) if (LIB.tracks[i].id === id) return LIB.tracks[i]; return null; }
  function playlistById(id) { for (var i = 0; i < LIB.playlists.length; i++) if (LIB.playlists[i].id === id) return LIB.playlists[i]; return null; }
  function baseOrder() {
    var p = S.playlist_id && playlistById(S.playlist_id);
    var have = LIB.tracks.map(function (t) { return t.id; });
    return p ? (p.track_ids || []).filter(function (id) { return have.indexOf(id) !== -1; }) : have;
  }
  /* A signed URL for a track: the one held while it has a minute left, else a new one. */
  function urlFor(id, fresh) {
    var held = urls[id];
    if (!fresh && held && held.expires - Date.now() > URL_MARGIN_MS) return Promise.resolve(held.url);
    return api("/api/music/tracks/" + encodeURIComponent(id) + "/url").then(function (r) {
      if (!r.ok || !r.body.url) throw new Error(r.body.error || "The track could not be opened just now.");
      urls[id] = { url: r.body.url, expires: Date.parse(r.body.expires_at) || 0 };
      return r.body.url;
    });
  }

  /* ── the sound ──────────────────────────────────────────────────────────── */
  var ctx = null, master = null, analyser = null, decks = [], active = 0;
  var R = { playing: false, activated: MODE === "popout", armed: false, blocked: false, fade: null, awaitRelease: null,
    popoutAt: 0, remote: null, handing: false, msg: "", msgKind: "", history: [], bag: null, lastSave: 0, yielded: false };
  function makeDeck(i) {
    var el = new window.Audio();
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    var deck = { el: el, gain: null, source: null, track: null, i: i };
    el.addEventListener("ended", function () { if (decks[active] === deck && !R.fade) trackEnded(); });
    el.addEventListener("error", function () { if (deck.track && decks[active] === deck && R.playing) recover(deck); });
    return deck;
  }
  function graph() {
    if (decks.length) return;
    decks = [makeDeck(0), makeDeck(1)];
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      decks.forEach(function (d) {
        d.source = ctx.createMediaElementSource(d.el);
        d.gain = ctx.createGain();
        d.gain.gain.value = 0;
        d.source.connect(d.gain);
        d.gain.connect(master);
      });
      master.connect(analyser);
      analyser.connect(ctx.destination);
      applyVolume();
    } catch (e) { ctx = null; master = null; analyser = null; }
  }
  function now() { return ctx ? ctx.currentTime : Date.now() / 1000; }
  function applyVolume() {
    var v = S.muted ? 0 : S.volume;
    if (master) { master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(v, now()); }
    else decks.forEach(function (d) { d.el.volume = v * (d.level === undefined ? 1 : d.level); });
  }
  function setDeckGain(deck, v) {
    deck.level = v;
    if (deck.gain) { deck.gain.gain.cancelScheduledValues(now()); deck.gain.gain.setValueAtTime(v, now()); }
    else deck.el.volume = v * (S.muted ? 0 : S.volume);
  }
  function rampUp(deck) {
    R.awaitRelease = null;
    if (!R.playing) return;
    deck.level = 1;
    if (deck.gain) { var t = now(); deck.gain.gain.cancelScheduledValues(t); deck.gain.gain.setValueAtTime(0, t); deck.gain.gain.linearRampToValueAtTime(1, t + RAMP_S); }
    else deck.el.volume = S.muted ? 0 : S.volume;
  }
  function stopDeck(deck) {
    if (!deck) return;
    try { deck.el.pause(); } catch (e) { /* not started */ }
    setDeckGain(deck, 0);
  }
  function currentPosition() {
    var d = decks[active];
    return d && d.track ? (Number(d.el.currentTime) || 0) : (Number(S.position) || 0);
  }
  function currentDuration() {
    var d = decks[active], t = trackById(S.track_id);
    var n = d && d.track ? Number(d.el.duration) : NaN;
    return isFinite(n) && n > 0 ? n : (t && t.duration_secs) || 0;
  }
  /* Whether this instance can be heard right now. */
  function audible() {
    if (!decks.length || (master && !(master.gain.value > 0))) return false;
    return decks.some(function (d) {
      var g = d.gain ? d.gain.gain.value : d.level;
      return !d.el.paused && g > 0;
    });
  }

  function cancelFade() {
    if (!R.fade) return;
    var f = R.fade;
    R.fade = null;
    stopDeck(f.from);
    f.from.track = null;
    if (f.to.gain) { f.to.gain.gain.cancelScheduledValues(now()); f.to.gain.gain.setValueAtTime(1, now()); }
    f.to.level = 1;
  }

  /* Plays `id` from `position` on the active deck. */
  function startTrack(id, position) {
    if (!id) return Promise.resolve(false);
    graph();
    cancelFade();
    var deck = decks[active];
    stopDeck(decks[1 - active]);
    decks[1 - active].track = null;
    if (S.track_id && S.track_id !== id) { R.history.push(S.track_id); if (R.history.length > 200) R.history.shift(); }
    S.track_id = id;
    S.position = position || 0;
    if (R.bag) R.bag = R.bag.filter(function (x) { return x !== id; });
    render();
    return urlFor(id).then(function (url) {
      if (S.track_id !== id) return false;
      if (deck.track !== id || deck.url !== url) { deck.el.src = url; deck.url = url; deck.track = id; }
      try { deck.el.currentTime = position || 0; } catch (e) { /* set once it loads */ }
      return go(deck);
    }, function (err) { say(err.message, "error"); R.playing = false; render(); return false; });
  }
  function otherPlaying() {
    var t = Date.now();
    return Object.keys(R.others || {}).some(function (k) { var o = R.others[k]; return o.playing && t - o.at < OTHER_PLAYING_MS; });
  }
  function go(deck) {
    var wait = otherPlaying();
    post({ type: "claim", from: ID });
    R.playing = true;
    R.blocked = false;
    R.yielded = false;
    setDeckGain(deck, wait ? 0 : 1);
    if (wait) R.awaitRelease = setTimeout(function () { rampUp(deck); }, RELEASE_WAIT_MS);
    if (ctx && ctx.state === "suspended" && ctx.resume) { try { ctx.resume(); } catch (e) { /* resumes on the next gesture */ } }
    var p;
    try { p = deck.el.play(); } catch (e) { p = Promise.reject(e); }
    return Promise.resolve(p).then(function () {
      startLoops();
      render();
      return true;
    }, function () {
      R.playing = false;
      R.blocked = true;
      setDeckGain(deck, 0);
      say(PRESS_PLAY, "info");
      render();
      return false;
    });
  }
  /* A failed load, most often an expired link: a fresh one, from the same place. */
  function recover(deck) {
    var at = Number(deck.el.currentTime) || S.position || 0, id = deck.track;
    urlFor(id, true).then(function (url) {
      if (deck.track !== id) return;
      deck.el.src = url; deck.url = url;
      try { deck.el.currentTime = at; } catch (e) { /* set once it loads */ }
      if (R.playing) { var p; try { p = deck.el.play(); } catch (e) { p = null; } if (p && p.catch) p.catch(function () {}); }
    }, function (err) { say(err.message, "error"); pauseLocal(); });
  }

  /* ── the controls ───────────────────────────────────────────────────────── */
  function popoutAlive() { return MODE !== "popout" && Date.now() - R.popoutAt < POPOUT_GONE_MS; }
  function relay(cmd, arg) { post({ type: "cmd", from: ID, cmd: cmd, arg: arg }); }

  /* The one door to sound. Before the member has interacted with this page,
     it only arms the player for their first click, tap or key press. */
  function play(opts) {
    if (popoutAlive()) { relay("play"); return Promise.resolve(false); }
    if (!R.activated) { arm(); return Promise.resolve(false); }
    if (R.starting) return R.starting;
    R.starting = (LIB.loaded ? Promise.resolve(LIB) : loadLibrary()).then(function () {
      var id = S.track_id && trackById(S.track_id) ? S.track_id : S.queue[0];
      if (!id) { say("Upload a track to start the music.", "info"); return false; }
      var d = decks[active];
      if (d && d.track === id && !(opts && opts.restart)) {
        graph();
        if (d.el.currentTime === 0 && S.position) { try { d.el.currentTime = S.position; } catch (e) { /* later */ } }
        return go(d);
      }
      return startTrack(id, id === S.track_id ? S.position : 0);
    }).then(function (ok) { R.starting = null; return ok; }, function () { R.starting = null; return false; });
    return R.starting;
  }
  function pauseLocal() {
    cancelFade();
    if (R.awaitRelease) { clearTimeout(R.awaitRelease); R.awaitRelease = null; }
    S.position = currentPosition();
    R.playing = false;
    decks.forEach(stopDeck);
    save();
    render();
  }
  function pause() { if (popoutAlive()) return relay("pause"); pauseLocal(); }
  function toggle() { if (popoutAlive()) return relay("toggle"); if (R.starting) return R.starting; return R.playing ? pause() : play(); }
  function order() { return S.queue.length ? S.queue : baseOrder(); }
  /* The track after this one, by shuffle and repeat; `manual` is the Next button. */
  function upcoming(manual) {
    var q = order();
    if (!q.length) return null;
    if (S.repeat === "one" && !manual) return S.track_id;
    if (S.shuffle) {
      if (!R.bag || !R.bag.length) R.bag = q.filter(function (x) { return x !== S.track_id; });
      var pick = R.bag.filter(function (x) { return x !== S.track_id && q.indexOf(x) !== -1; });
      if (!pick.length) {
        if (S.repeat === "off" && !manual) return null;
        pick = q.filter(function (x) { return x !== S.track_id; });
        R.bag = pick.slice();
        if (!pick.length) return S.repeat === "off" && !manual ? null : S.track_id;
      }
      return pick[Math.floor(Math.random() * pick.length)];
    }
    var i = q.indexOf(S.track_id);
    if (i + 1 < q.length) return q[i + 1];
    return S.repeat === "off" ? null : q[0];
  }
  function next() {
    if (popoutAlive()) return relay("next");
    var id = upcoming(true);
    if (!id) { stopAtEnd(); return; }
    if (!R.playing) { S.track_id = id; S.position = 0; save(); render(); return; }
    startTrack(id, 0);
  }
  function prev() {
    if (popoutAlive()) return relay("prev");
    if (currentPosition() > 3) return seek(0);
    var q = order(), id = null;
    if (S.shuffle && R.history.length) id = R.history.pop();
    else {
      var i = q.indexOf(S.track_id);
      id = i > 0 ? q[i - 1] : (S.repeat === "all" ? q[q.length - 1] : q[0]);
    }
    if (!id) return;
    if (!R.playing) { S.track_id = id; S.position = 0; save(); render(); return; }
    startTrack(id, 0);
  }
  function stopAtEnd() {
    pauseLocal();
    S.position = 0;
    var d = decks[active];
    if (d && d.track) { try { d.el.currentTime = 0; } catch (e) { /* not loaded */ } }
    save();
    render();
  }
  function trackEnded() {
    var id = upcoming(false);
    if (!id) { stopAtEnd(); return; }
    if (id === S.track_id) { var d = decks[active]; try { d.el.currentTime = 0; } catch (e) { /* reloads */ } go(d); return; }
    startTrack(id, 0);
  }
  function seek(sec) {
    if (popoutAlive()) return relay("seek", sec);
    var dur = currentDuration();
    var t = Math.max(0, Math.min(dur || Number(sec) || 0, Number(sec) || 0));
    S.position = t;
    var d = decks[active];
    if (d && d.track === S.track_id) { try { d.el.currentTime = t; } catch (e) { /* set once it loads */ } }
    save();
    render();
  }
  function setVolume(v) {
    if (popoutAlive()) relay("volume", v);
    S.volume = clamp01(Number(v));
    if (S.volume > 0) S.muted = false;
    applyVolume(); save(); render();
  }
  function toggleMute() {
    if (popoutAlive()) relay("mute");
    S.muted = !S.muted;
    applyVolume(); save(); render();
  }
  function setShuffle(on) {
    if (popoutAlive()) relay("shuffle", on);
    S.shuffle = on === undefined ? !S.shuffle : !!on;
    R.bag = null;
    save(); render();
  }
  function cycleRepeat() {
    if (popoutAlive()) relay("repeat");
    S.repeat = REPEATS[(REPEATS.indexOf(S.repeat) + 1) % REPEATS.length];
    save(); render();
  }
  function setRepeat(mode) {
    if (REPEATS.indexOf(mode) === -1) return;
    if (popoutAlive()) relay("repeat-set", mode);
    S.repeat = mode; save(); render();
  }
  function setCrossfade(s) {
    if (popoutAlive()) relay("crossfade", s);
    S.crossfade = Math.min(CROSSFADE_MAX, Math.max(0, Math.round(Number(s) || 0)));
    save(); render();
  }
  function setView(v) { if (VIEWS.indexOf(v) === -1) return; S.view = v; save(); render(); startViz(); }
  function setAutoplay(on) { S.autoplay = !!on; save(); render(); }
  function playTrack(id) {
    if (popoutAlive()) return relay("track", id);
    if (!trackById(id)) return;
    if (!R.activated) { S.track_id = id; S.position = 0; save(); render(); return; }
    startTrack(id, 0);
  }

  /* The mix: the next track starts on the other deck S.crossfade seconds
     before this one ends; the equal-power curves run over exactly that time. */
  function beginFade(nextId, d) {
    var from = decks[active], to = decks[1 - active];
    R.fade = { from: from, to: to, id: nextId, start: 0, end: Infinity, d: d, pending: true };
    urlFor(nextId).then(function (url) {
      var f = R.fade;
      if (!f || f.to !== to || !R.playing) return;
      to.el.src = url; to.url = url; to.track = nextId;
      try { to.el.currentTime = 0; } catch (e) { /* from the start */ }
      var t = now();
      f.start = t; f.end = t + d; f.pending = false;
      to.level = 1; from.level = 0;
      to.gain.gain.cancelScheduledValues(t);
      to.gain.gain.setValueCurveAtTime(fadeCurve("in", 64), t, d);
      from.gain.gain.cancelScheduledValues(t);
      from.gain.gain.setValueCurveAtTime(fadeCurve("out", 64), t, d);
      var p; try { p = to.el.play(); } catch (e) { p = null; }
      if (p && p.catch) p.catch(function () {});
      if (S.track_id) { R.history.push(S.track_id); if (R.history.length > 200) R.history.shift(); }
      S.track_id = nextId;
      if (R.bag) R.bag = R.bag.filter(function (x) { return x !== nextId; });
      active = to.i;
      render();
    }, function () { R.fade = null; });
  }
  function finishFade() {
    var f = R.fade;
    R.fade = null;
    try { f.from.el.pause(); } catch (e) { /* stopped */ }
    f.from.gain.gain.cancelScheduledValues(now());
    f.from.gain.gain.setValueAtTime(0, now());
    f.from.level = 0;
    f.from.track = null;
    f.to.gain.gain.cancelScheduledValues(now());
    f.to.gain.gain.setValueAtTime(1, now());
  }
  function mixWatch() {
    if (R.fade) { if (!R.fade.pending && now() >= R.fade.end) finishFade(); return; }
    if (!R.playing || !ctx || S.crossfade <= 0) return;
    var el = decks[active].el, dur = Number(el.duration), left = dur - Number(el.currentTime);
    if (!isFinite(dur) || dur <= S.crossfade * 2 || !(left <= S.crossfade)) return;
    var id = upcoming(false);
    if (!id || id === S.track_id) return;
    beginFade(id, Math.max(0.05, Math.min(S.crossfade, left)));
  }

  /* ── first interaction ──────────────────────────────────────────────────── */
  var GESTURES = ["pointerdown", "keydown", "touchstart"];
  function firstInteraction() {
    GESTURES.forEach(function (g) { doc.removeEventListener(g, firstInteraction, true); });
    R.activated = true;
    graph();
    if (R.armed) { R.armed = false; play(); }
    render();
  }
  function arm() {
    if (R.armed || popoutAlive()) return;
    R.armed = true;
    render();
  }
  if (!R.activated) GESTURES.forEach(function (g) { doc.addEventListener(g, firstInteraction, true); });

  /* ── the channel ────────────────────────────────────────────────────────── */
  var channel = null;
  try { if (typeof window.BroadcastChannel === "function") channel = new window.BroadcastChannel(CHANNEL_NAME); } catch (e) { channel = null; }
  function post(m) { if (channel) { try { channel.postMessage(m); } catch (e) { /* closed */ } } }
  R.others = {};
  function snapshot() {
    return { track_id: S.track_id, position: currentPosition(), volume: S.volume, muted: S.muted, queue: S.queue.slice(), shuffle: S.shuffle,
      repeat: S.repeat, crossfade: S.crossfade, view: S.view, playlist_id: S.playlist_id };
  }
  function onMessage(m) {
    if (!m || typeof m !== "object" || m.from === ID) return;
    if (m.type === "claim") {
      if (R.playing || R.awaitRelease) { pauseLocal(); R.yielded = true; say(YIELDED, "info"); post({ type: "released", from: ID, to: m.from }); }
      return;
    }
    if (m.type === "released" && m.to === ID) {
      if (R.awaitRelease) { clearTimeout(R.awaitRelease); rampUp(decks[active]); }
      return;
    }
    if (m.type === "status") {
      R.others[m.from] = { at: Date.now(), playing: !!m.playing, role: m.role };
      if (m.role === "popout" && MODE !== "popout") { R.popoutAt = Date.now(); R.remote = m; R.armed = false; render(); }
      return;
    }
    if (MODE !== "popout") {
      if (m.type === "popout-hello") {
        R.popoutAt = Date.now();
        var wasPlaying = R.playing || R.handing;
        var state = snapshot();
        pauseLocal();                       // this page is silent BEFORE the pop-out starts
        R.handing = false;
        R.armed = false;
        post({ type: "handoff", from: ID, to: m.from, state: state, playing: wasPlaying });
        render();
      } else if (m.type === "popout-closed") {
        R.popoutAt = 0; R.remote = null; render();
      }
      return;
    }
    /* the pop-out */
    if (m.type === "handoff" && m.to === ID) {
      /* Every open page answers; the one that was playing wins, and a quiet
         page's answer counts only while none has been taken. */
      if (R.took === "playing" || (R.took && !m.playing)) return;
      R.took = m.playing ? "playing" : "quiet";
      var st = m.state || {};
      ["volume", "muted", "shuffle", "repeat", "crossfade", "view", "playlist_id"].forEach(function (k) { if (st[k] !== undefined) S[k] = st[k]; });
      if (Array.isArray(st.queue)) S.queue = st.queue.slice();
      if (st.track_id) { S.track_id = st.track_id; S.position = Number(st.position) || 0; }
      applyVolume(); save();
      loadLibrary().then(function () { if (m.playing && S.track_id) startTrack(S.track_id, S.position); else render(); });
    } else if (m.type === "cmd") {
      var a = m.arg;
      if (m.cmd === "play") play(); else if (m.cmd === "pause") pause(); else if (m.cmd === "toggle") toggle();
      else if (m.cmd === "next") next(); else if (m.cmd === "prev") prev(); else if (m.cmd === "seek") seek(a);
      else if (m.cmd === "volume") setVolume(a); else if (m.cmd === "mute") toggleMute(); else if (m.cmd === "shuffle") setShuffle(a);
      else if (m.cmd === "repeat") cycleRepeat(); else if (m.cmd === "repeat-set") setRepeat(a); else if (m.cmd === "crossfade") setCrossfade(a);
      else if (m.cmd === "track") playTrack(a);
    }
  }
  if (channel) channel.onmessage = function (e) { onMessage(e && e.data); };

  function popOut() {
    if (MODE === "popout") return;
    save();
    var w = null;
    try { w = window.open("/music-popout.html", "bf-music-popout", "popup,width=440,height=680"); } catch (e) { w = null; }
    if (!w) { say(POPUP_BLOCKED, "error"); return; }
    R.handing = R.playing;
    say("", "");
  }

  /* ── the loops: the clock, the energy, the visualiser ───────────────────── */
  var ticker = null;
  function tick() {
    mixWatch();
    if (R.playing && Date.now() - R.lastSave >= SAVE_EVERY_MS) { R.lastSave = Date.now(); save(); }
    if (R.playing || MODE === "popout") {
      var t = trackById(S.track_id);
      post({ type: "status", from: ID, role: MODE, playing: R.playing, track_id: S.track_id, title: t ? t.title : "", artist: t ? t.artist : "",
        position: currentPosition(), duration: currentDuration(), shuffle: S.shuffle, repeat: S.repeat, volume: S.volume, muted: S.muted });
    }
    if (R.playing && !energyTimer) startEnergy();
    renderClock();
  }
  function startLoops() {
    if (!ticker) ticker = setInterval(tick, TICK_MS);
    startEnergy();
    startViz();
  }

  var E = { e: 0, avg: 0 }, energyTimer = null, freq = null;
  function energyWanted() {
    if (reducedMotion()) return false;
    var T = themeEngine();
    return !!(T && T.musicWanted && T.musicWanted());
  }
  function startEnergy() {
    if (energyTimer || !energyWanted()) return;
    energyTimer = setInterval(energyTick, Math.round(1000 / ENERGY_HZ));
  }
  function stopEnergy() { if (energyTimer) { clearInterval(energyTimer); energyTimer = null; } }
  function energyTick() {
    if (reducedMotion()) { E = { e: 0, avg: 0 }; stopEnergy(); return; }
    if (R.playing && analyser) {
      if (!freq) freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      E = energyStep(E, freq, ctx.sampleRate, analyser.fftSize);
    } else {
      E = { e: easeOut(E.e), avg: E.avg };
    }
    post({ type: "energy", from: ID, value: Math.round(E.e * 1000) / 1000 });
    if (!R.playing && E.e <= 0) stopEnergy();
  }

  var vizRaf = 0, bars = [], peaks = [], wave = null;
  function vizCanvas() { return root ? root.querySelector(".bfm-viz") : null; }
  function startViz() {
    var c = vizCanvas();
    if (!c) return;
    if (reducedMotion()) { c.setAttribute("data-viz", "static"); drawStatic(c); return; }
    c.setAttribute("data-viz", S.view);
    if (vizRaf || !window.requestAnimationFrame) return;
    vizRaf = window.requestAnimationFrame(frame);
  }
  function frame() {
    vizRaf = 0;
    if (doc.hidden || reducedMotion()) return;
    var c = vizCanvas();
    if (!c) return;
    draw(c);
    if (R.playing || bars.some(function (b) { return b > 0.01; })) vizRaf = window.requestAnimationFrame(frame);
  }
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden) startViz(); });
  function tone(which) {
    if (which === "a") return typeof BFTheme !== "undefined" ? BFTheme.color("--bf-accent-a", "#22d3ee") : "#22d3ee";
    return typeof BFTheme !== "undefined" ? BFTheme.color("--bf-accent-b", "#a855f7") : "#a855f7";
  }
  function paint(g, w) {
    var a = tone("a"), b = tone("b"), grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, a);
    var T = themeEngine(), hex = /^#[0-9a-f]{6}$/i;
    if (T && T.midTone && hex.test(a) && hex.test(b)) grad.addColorStop(0.5, T.midTone(a.toLowerCase(), b.toLowerCase()));
    grad.addColorStop(1, b);
    return grad;
  }
  function draw(c) {
    var g = c.getContext ? c.getContext("2d") : null;
    var w = c.width, h = c.height;
    var data = null;
    if (analyser) {
      if (S.view === "wave") { if (!wave) wave = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(wave); }
      else { if (!freq) freq = new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(freq); data = freq; }
    }
    if (!g) return;
    g.clearRect(0, 0, w, h);
    if (S.view === "wave") {
      g.lineWidth = 2; g.strokeStyle = paint(g, w); g.beginPath();
      var n = wave ? wave.length : 0;
      for (var i = 0; i < n; i += 4) { var x = (i / (n - 1)) * w, y = (wave[i] / 255) * h; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      if (!n) { g.moveTo(0, h / 2); g.lineTo(w, h / 2); }
      g.stroke();
      return;
    }
    var gap = 2, bw = (w - gap * (BARS - 1)) / BARS, sr = ctx ? ctx.sampleRate : 48000, fft = analyser ? analyser.fftSize : 2048;
    g.fillStyle = paint(g, w);
    for (var k = 0; k < BARS; k++) {
      var lo = 30 * Math.pow(16000 / 30, k / BARS), hi = 30 * Math.pow(16000 / 30, (k + 1) / BARS);
      var v = data && R.playing ? bandMean(data, sr, fft, lo, hi) : 0;
      bars[k] = Math.max(v, (bars[k] || 0) * 0.86);
      peaks[k] = Math.max(bars[k], (peaks[k] || 0) - 0.012);
      var bh = Math.max(2, bars[k] * (h - 6)), x0 = k * (bw + gap);
      g.globalAlpha = 0.9; g.fillRect(x0, h - bh, bw, bh);
      g.globalAlpha = 1; g.fillRect(x0, h - Math.max(3, peaks[k] * (h - 6)) - 3, bw, 2);
    }
  }
  function drawStatic(c) {
    var g = c.getContext ? c.getContext("2d") : null;
    if (!g) return;
    var w = c.width, h = c.height, gap = 2, bw = (w - gap * (BARS - 1)) / BARS;
    g.clearRect(0, 0, w, h);
    g.fillStyle = paint(g, w);
    g.globalAlpha = 0.45;
    for (var k = 0; k < BARS; k++) { var bh = (0.18 + 0.12 * Math.sin(k / 3)) * h; g.fillRect(k * (bw + gap), h - bh, bw, bh); }
    g.globalAlpha = 1;
  }

  /* ── the console ────────────────────────────────────────────────────────── */
  var ICON = {
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    prev: '<path d="M6.5 5v14"/><path d="M19 5.5v13L9 12z" fill="currentColor"/>',
    next: '<path d="M17.5 5v14"/><path d="M5 5.5v13L15 12z" fill="currentColor"/>',
    shuffle: '<path d="M3 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1.1 1.6 2.3 2.6 4.3 2.6H21"/><path d="M3 17h3.5c1.5 0 2.5-.5 3.4-1.5"/><path d="M14.1 8.5c.9-1 1.9-1.5 3.4-1.5H21"/><path d="m18 4 3 3-3 3"/><path d="m18 14 3 3-3 3"/>',
    repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/>',
    one: '<path d="M4 11V9a3 3 0 0 1 3-3h12"/><path d="m16 3 3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H5"/><path d="m8 21-3-3 3-3"/><path d="M11 10.5 12.5 9.5v5"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5"/><path d="m21 9.5-5 5"/>',
    popout: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    grip: '<circle cx="9" cy="6.5" r="1.2" fill="currentColor"/><circle cx="15" cy="6.5" r="1.2" fill="currentColor"/><circle cx="9" cy="12" r="1.2" fill="currentColor"/><circle cx="15" cy="12" r="1.2" fill="currentColor"/><circle cx="9" cy="17.5" r="1.2" fill="currentColor"/><circle cx="15" cy="17.5" r="1.2" fill="currentColor"/>'
  };
  function svg(name, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON[name] + "</svg>";
  }
  var CSS = [
    ".bfm{--bfm-a:var(--bf-accent-a, #22d3ee);--bfm-b:var(--bf-accent-b, #a855f7);color:#e8e8ff;font-family:inherit}",
    ".bfm *{box-sizing:border-box}",
    ".bfm-console{border-radius:18px;padding:18px;background:linear-gradient(160deg,rgba(14,18,40,.92),rgba(8,10,24,.95));border:1px solid rgba(var(--bf-accent-a-rgb, 34, 211, 238),.18);box-shadow:0 12px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.04)}",
    ".bfm-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}",
    ".bfm-badge{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;color:var(--bfm-a);border:1px solid rgba(var(--bf-accent-a-rgb, 34, 211, 238),.35);background:rgba(var(--bf-accent-a-rgb, 34, 211, 238),.08)}",
    ".bfm-title{margin:0;font-size:1.15rem;font-weight:800;letter-spacing:.02em}",
    ".bfm-sub{margin:2px 0 0;font-size:.82rem;color:#8892b8}",
    ".bfm-head .bfm-pop{margin-left:auto}",
    ".bfm-now{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:4px 0 10px;min-height:2.4em}",
    ".bfm-np-title{font-weight:700;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".bfm-np-artist{font-size:.82rem;color:#8892b8}",
    ".bfm-time{font-variant-numeric:tabular-nums;font-size:.82rem;color:#8892b8;white-space:nowrap}",
    ".bfm-viz{display:block;width:100%;height:120px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.06)}",
    ".bfm-vizbar{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0 2px}",
    ".bfm-seg{display:inline-flex;border:1px solid rgba(255,255,255,.12);border-radius:999px;overflow:hidden}",
    ".bfm-seg button{background:transparent;border:0;color:#8892b8;padding:5px 12px;font:inherit;font-size:.78rem;cursor:pointer}",
    ".bfm-seg button[aria-pressed=true]{color:#fff;background:linear-gradient(90deg,var(--bf-btn-a, #06b6d4)var(--bf-btn-mid, ),var(--bf-btn-b, #8b5cf6))}",
    ".bfm-note{font-size:.78rem;color:#8892b8;margin:4px 0}",
    ".bfm-seek{width:100%;margin:10px 0 4px;accent-color:var(--bfm-a)}",
    ".bfm-transport{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0 12px}",
    ".bfm-btn{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#e8e8ff;cursor:pointer}",
    ".bfm-btn:hover,.bfm-btn:focus-visible{border-color:var(--bfm-a);outline:none;box-shadow:0 0 0 2px rgba(var(--bf-accent-a-rgb, 34, 211, 238),.25)}",
    ".bfm-btn[aria-pressed=true]{color:var(--bfm-a);border-color:var(--bfm-a)}",
    ".bfm-btn.bfm-main{width:54px;height:54px;color:var(--bf-btn-text, #ffffff);border:0;background:linear-gradient(135deg,var(--bf-btn-a, #06b6d4)var(--bf-btn-mid, ),var(--bf-btn-b, #8b5cf6));box-shadow:0 6px 22px rgba(var(--bf-accent-b-rgb, 168, 85, 247),.35)}",
    ".bfm-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:8px 0}",
    ".bfm-row label{font-size:.82rem;color:#c8cce8}",
    ".bfm-row input[type=range]{accent-color:var(--bfm-a);width:130px}",
    ".bfm-out{font-variant-numeric:tabular-nums;font-size:.8rem;color:#8892b8;min-width:2.6em}",
    ".bfm-select,.bfm-text{background:rgba(8,12,28,.85);color:#f4f7ff;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:6px 10px;font:inherit;font-size:.85rem}",
    ".bfm-chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#e8e8ff;border-radius:999px;padding:5px 12px;font:inherit;font-size:.8rem;cursor:pointer}",
    ".bfm-chip:hover,.bfm-chip:focus-visible{border-color:var(--bfm-a);outline:none}",
    ".bfm-chip[data-danger]{border-color:rgba(255,120,120,.35);color:#ffb4b4}",
    ".bfm-queue{list-style:none;margin:8px 0;padding:0;max-height:300px;overflow:auto;border-top:1px solid rgba(255,255,255,.06)}",
    ".bfm-item{display:flex;align-items:center;gap:8px;padding:7px 6px;border-bottom:1px solid rgba(255,255,255,.06);border-radius:8px}",
    ".bfm-item:focus-visible{outline:2px solid var(--bfm-a);outline-offset:-2px}",
    ".bfm-item[aria-current=true]{background:rgba(var(--bf-accent-a-rgb, 34, 211, 238),.08)}",
    ".bfm-item[data-drop=true]{box-shadow:inset 0 2px 0 var(--bfm-a)}",
    ".bfm-grip{color:#5d668f;cursor:grab;display:grid;place-items:center}",
    ".bfm-item-main{flex:1;min-width:0;cursor:pointer;background:none;border:0;color:inherit;text-align:left;font:inherit;padding:0}",
    ".bfm-item-title{display:block;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".bfm-item-meta{display:block;font-size:.74rem;color:#8892b8}",
    ".bfm-mini-btn{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:8px;border:1px solid transparent;background:transparent;color:#8892b8;cursor:pointer}",
    ".bfm-mini-btn:hover,.bfm-mini-btn:focus-visible{color:#e8e8ff;border-color:rgba(255,255,255,.18);outline:none}",
    ".bfm-drop{margin-top:12px;border:1.5px dashed rgba(var(--bf-accent-a-rgb, 34, 211, 238),.35);border-radius:14px;padding:14px;text-align:center;color:#c8cce8}",
    ".bfm-drop[data-over=true]{border-color:var(--bfm-a);background:rgba(var(--bf-accent-a-rgb, 34, 211, 238),.06)}",
    ".bfm-drop p{margin:4px 0;font-size:.82rem}",
    ".bfm-uploads{list-style:none;margin:8px 0 0;padding:0;text-align:left}",
    ".bfm-uploads li{font-size:.8rem;margin:4px 0}",
    ".bfm-uploads progress{width:100%;height:6px;accent-color:var(--bfm-a)}",
    ".bfm-msg{font-size:.82rem;margin:6px 0;min-height:1.2em}",
    ".bfm-msg[data-kind=error]{color:#ffb4b4}",
    ".bfm-msg[data-kind=ok]{color:#9ff0c8}",
    ".bfm-armed{display:none;font-size:.8rem;color:var(--bfm-a);margin:4px 0}",
    ".bfm[data-armed=true] .bfm-armed{display:block}",
    ".bfm-remote{display:none;font-size:.85rem;font-weight:600;color:var(--bfm-a);margin:4px 0}",
    ".bfm[data-remote=true] .bfm-remote{display:block}",
    ".bfm-toggle{display:flex;align-items:flex-start;gap:10px;margin-top:10px}",
    ".bfm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    ".bfm-minibar{position:fixed;left:16px;bottom:16px;z-index:9000;display:flex;align-items:center;gap:6px;max-width:min(380px,calc(100vw - 32px));padding:6px 8px 6px 10px;border-radius:14px;background:rgba(10,12,28,.94);border:1px solid rgba(var(--bf-accent-a-rgb, 34, 211, 238),.22);box-shadow:0 8px 28px rgba(0,0,0,.5)}",
    ".bfm-minibar[hidden]{display:none}",
    ".bfm-minibar .bfm-btn{width:32px;height:32px}",
    ".bfm-minibar .bfm-mini-title{flex:1;min-width:0;font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".bfm-minibar a{color:var(--bfm-a);font-size:.76rem;text-decoration:none;white-space:nowrap}",
    "@media (prefers-reduced-motion: reduce){.bfm *{transition:none!important;animation:none!important}}"
  ].join("\n");

  var root = null;
  function q(sel) { return root ? root.querySelector(sel) : null; }
  function injectStyle() {
    if (doc.getElementById("bf-music-style")) return;
    var st = doc.createElement("style");
    st.id = "bf-music-style";
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  function transportHtml(big) {
    return '<div class="bfm-transport" role="group" aria-label="Playback">' +
      (big ? '<button type="button" class="bfm-btn" data-act="shuffle" aria-pressed="false" aria-label="Shuffle">' + svg("shuffle") + "</button>" : "") +
      '<button type="button" class="bfm-btn" data-act="prev" aria-label="Previous">' + svg("prev") + "</button>" +
      '<button type="button" class="bfm-btn bfm-main" data-act="toggle" aria-label="Play">' + svg("play", big ? 24 : 18) + "</button>" +
      '<button type="button" class="bfm-btn" data-act="next" aria-label="Next">' + svg("next") + "</button>" +
      (big ? '<button type="button" class="bfm-btn" data-act="repeat" aria-pressed="false" aria-label="Repeat: off">' + svg("repeat") + "</button>" : "") +
      "</div>";
  }
  function buildConsole(host) {
    host.innerHTML =
      '<div class="bfm bfm-console" data-mode="' + MODE + '">' +
        '<div class="bfm-head"><div class="bfm-badge">' + svg("music", 22) + '</div><div><h2 class="bfm-title" id="bfmTitle">Music</h2>' +
          '<p class="bfm-sub">Your own music, private to you. Set the mood and get in the zone.</p></div>' +
          (MODE === "popout" ? "" : '<button type="button" class="bfm-chip bfm-pop" data-act="popout" aria-label="Pop out">' + svg("popout", 14) + " Pop out</button>") + "</div>" +
        '<p class="bfm-remote" role="status"></p>' +
        '<p class="bfm-armed" role="status">' + AUTOPLAY_NOTE + "</p>" +
        '<div class="bfm-now"><div style="min-width:0"><div class="bfm-np-title">Nothing playing</div><div class="bfm-np-artist"></div></div>' +
          '<div class="bfm-time" aria-live="off"><span class="bfm-cur">0:00</span> / <span class="bfm-dur">0:00</span></div></div>' +
        '<canvas class="bfm-viz" width="640" height="120" role="img" aria-label="Live sound visualiser"></canvas>' +
        '<div class="bfm-vizbar"><div class="bfm-seg" role="group" aria-label="Visualiser">' +
          '<button type="button" data-view="spectrum" aria-pressed="true">Spectrum</button><button type="button" data-view="wave" aria-pressed="false">Waveform</button></div>' +
          '<span class="bfm-note bfm-viz-note"></span></div>' +
        '<input class="bfm-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Seek" />' +
        transportHtml(true) +
        '<div class="bfm-row">' +
          '<button type="button" class="bfm-btn" data-act="mute" aria-pressed="false" aria-label="Mute">' + svg("volume") + "</button>" +
          '<label for="bfmVolume" class="bfm-sr">Volume</label><input id="bfmVolume" class="bfm-volume" type="range" min="0" max="100" step="1" value="80" aria-label="Volume" />' +
          '<span class="bfm-out bfm-vol-out">80%</span>' +
          '<label for="bfmMix">Mix</label><input id="bfmMix" class="bfm-mix" type="range" min="0" max="' + CROSSFADE_MAX + '" step="1" value="0" aria-describedby="bfmMixNote" />' +
          '<span class="bfm-out bfm-mix-out">Off</span>' +
        "</div>" +
        '<p class="bfm-note" id="bfmMixNote">Mix blends the end of each track into the next, like a DJ, over the seconds you set (up to ' + CROSSFADE_MAX + ").</p>" +
        '<div class="bfm-row"><label for="bfmPlaylist">Playlist</label><select id="bfmPlaylist" class="bfm-select bfm-playlist"></select>' +
          '<button type="button" class="bfm-chip" data-act="pl-new">New playlist</button>' +
          '<button type="button" class="bfm-chip" data-act="pl-rename">Rename</button>' +
          '<button type="button" class="bfm-chip" data-act="pl-delete" data-danger="1">Delete playlist</button></div>' +
        '<div class="bfm-row bfm-plname" hidden><label for="bfmPlName" class="bfm-plname-label">Playlist name</label><input id="bfmPlName" class="bfm-text" maxlength="80" />' +
          '<button type="button" class="bfm-chip" data-act="pl-save">Save</button><button type="button" class="bfm-chip" data-act="pl-cancel">Cancel</button></div>' +
        '<p class="bfm-note">Queue: drag a track, or focus it and press Alt with the up or down arrow, to change the order.</p>' +
        '<ul class="bfm-queue" aria-label="Queue"></ul>' +
        '<p class="bfm-sr" aria-live="polite" id="bfmAnnounce"></p>' +
        '<div class="bfm-msg" role="status" aria-live="polite"></div>' +
        '<div class="bfm-drop" data-over="false">' + svg("upload", 22) +
          '<p><strong>Drop music here</strong>, or <button type="button" class="bfm-chip" data-act="choose">Choose files</button></p>' +
          '<p class="bfm-limits">MP3, M4A, AAC, Ogg, Opus, FLAC or WAV.</p>' +
          '<p>Upload only music you have the right to use. See the <a href="/terms#music">Terms</a>.</p>' +
          '<input type="file" class="bfm-file" accept="' + ACCEPT + '" multiple hidden />' +
          '<ul class="bfm-uploads"></ul></div>' +
        '<div class="bfm-toggle"><input type="checkbox" id="bfmAutoplay" class="bfm-autoplay" aria-describedby="bfmAutoplayNote" />' +
          '<div><label for="bfmAutoplay">' + AUTOPLAY_LABEL + '</label><p class="bfm-note" id="bfmAutoplayNote">' + AUTOPLAY_NOTE + "</p></div></div>" +
      "</div>";
    root = host.firstChild;
    wireConsole();
  }
  function buildMini() {
    var bar = doc.createElement("div");
    bar.className = "bfm bfm-minibar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Music");
    bar.hidden = true;
    bar.innerHTML = '<span class="bfm-badge" style="width:28px;height:28px;border-radius:8px">' + svg("music", 16) + "</span>" +
      '<span class="bfm-mini-title">Nothing playing</span>' + transportHtml(false) +
      '<button type="button" class="bfm-mini-btn" data-act="popout" aria-label="Pop out">' + svg("popout", 15) + "</button>" +
      '<a href="/dashboard.html#musicSection">Open player</a>' +
      '<p class="bfm-armed bfm-sr" role="status">' + AUTOPLAY_NOTE + "</p><p class=\"bfm-remote bfm-sr\" role=\"status\"></p><div class=\"bfm-msg bfm-sr\" role=\"status\"></div>";
    (doc.body || doc.documentElement).appendChild(bar);
    root = bar;
    root.addEventListener("click", onClick);
  }

  function onClick(e) {
    var b = e.target && e.target.closest ? e.target.closest("[data-act],[data-view]") : null;
    if (!b || !root.contains(b)) return;
    var act = b.getAttribute("data-act"), view = b.getAttribute("data-view");
    if (view) return setView(view);
    if (act === "toggle") toggle();
    else if (act === "prev") prev();
    else if (act === "next") next();
    else if (act === "shuffle") setShuffle();
    else if (act === "repeat") cycleRepeat();
    else if (act === "mute") toggleMute();
    else if (act === "popout") popOut();
    else if (act === "choose") { var f = q(".bfm-file"); if (f) f.click(); }
    else if (act === "pl-new") askName("new");
    else if (act === "pl-rename") { if (S.playlist_id) askName("rename"); else say("Pick a playlist to rename.", "info"); }
    else if (act === "pl-save") saveName();
    else if (act === "pl-cancel") askName(null);
    else if (act === "pl-delete") deletePlaylist(b);
    else if (act === "play-track") playTrack(b.getAttribute("data-id"));
    else if (act === "move-up") moveTrack(b.getAttribute("data-id"), -1);
    else if (act === "move-down") moveTrack(b.getAttribute("data-id"), 1);
    else if (act === "rename-track") renameTrack(b.getAttribute("data-id"));
    else if (act === "remove-track") removeFromPlaylist(b.getAttribute("data-id"));
    else if (act === "delete-track") deleteTrack(b);
  }
  function wireConsole() {
    root.addEventListener("click", onClick);
    q(".bfm-seek").addEventListener("input", function () { seek(Number(this.value)); });
    q(".bfm-volume").addEventListener("input", function () { setVolume(Number(this.value) / 100); });
    q(".bfm-mix").addEventListener("input", function () { setCrossfade(Number(this.value)); });
    q(".bfm-autoplay").addEventListener("change", function () { setAutoplay(this.checked); });
    q(".bfm-playlist").addEventListener("change", function () { choosePlaylist(this.value); });
    q(".bfm-file").addEventListener("change", function () { uploadFiles(this.files); this.value = ""; });
    var drop = q(".bfm-drop");
    drop.addEventListener("dragover", function (e) { if (isFileDrag(e)) { e.preventDefault(); drop.setAttribute("data-over", "true"); } });
    drop.addEventListener("dragleave", function () { drop.setAttribute("data-over", "false"); });
    drop.addEventListener("drop", function (e) {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      drop.setAttribute("data-over", "false");
      uploadFiles(e.dataTransfer.files);
    });
    var list = q(".bfm-queue");
    list.addEventListener("keydown", function (e) {
      var li = e.target && e.target.closest ? e.target.closest(".bfm-item") : null;
      if (!li || e.target !== li) return;
      var id = li.getAttribute("data-id");
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); moveTrack(id, e.key === "ArrowUp" ? -1 : 1, true); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); playTrack(id); }
      else if (e.key === "ArrowUp" && li.previousElementSibling) { e.preventDefault(); li.previousElementSibling.focus(); }
      else if (e.key === "ArrowDown" && li.nextElementSibling) { e.preventDefault(); li.nextElementSibling.focus(); }
    });
    var dragId = null;
    list.addEventListener("dragstart", function (e) {
      var li = e.target && e.target.closest ? e.target.closest(".bfm-item") : null;
      if (!li) return;
      dragId = li.getAttribute("data-id");
      try { e.dataTransfer.setData("text/plain", dragId); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* no transfer */ }
    });
    list.addEventListener("dragover", function (e) {
      if (!dragId) return;
      e.preventDefault();
      var li = e.target && e.target.closest ? e.target.closest(".bfm-item") : null;
      Array.prototype.forEach.call(list.children, function (c) { c.removeAttribute("data-drop"); });
      if (li) li.setAttribute("data-drop", "true");
    });
    list.addEventListener("drop", function (e) {
      if (!dragId) return;
      e.preventDefault();
      var li = e.target && e.target.closest ? e.target.closest(".bfm-item") : null;
      Array.prototype.forEach.call(list.children, function (c) { c.removeAttribute("data-drop"); });
      if (li) placeTrack(dragId, li.getAttribute("data-id"));
      dragId = null;
    });
    list.addEventListener("dragend", function () { dragId = null; });
  }
  function isFileDrag(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    return !!t && Array.prototype.indexOf.call(t, "Files") !== -1;
  }

  /* ── the queue and playlists ────────────────────────────────────────────── */
  function announce(text) { var a = doc.getElementById("bfmAnnounce"); if (a) a.textContent = text; }
  function choosePlaylist(id) {
    S.playlist_id = id && playlistById(id) ? id : "";
    S.queue = baseOrder();
    R.bag = null;
    save(); render();
  }
  function saveOrder() {
    save();
    var p = S.playlist_id && playlistById(S.playlist_id);
    if (!p) return Promise.resolve(true);
    p.track_ids = S.queue.slice();
    return api("/api/music/playlists/" + encodeURIComponent(p.id), { method: "PUT", json: { track_ids: S.queue.slice() } }).then(function (r) {
      if (r.ok) { takeLibrary(r.body); render(); return true; }
      say(r.body.error || "The new order could not be saved.", "error");
      return false;
    });
  }
  function moveTrack(id, by, keepFocus) {
    var i = S.queue.indexOf(id), j = i + by;
    if (i === -1 || j < 0 || j >= S.queue.length) return;
    S.queue.splice(i, 1);
    S.queue.splice(j, 0, id);
    var t = trackById(id);
    announce((t ? t.title : "Track") + " moved to position " + (j + 1) + " of " + S.queue.length + ".");
    render();
    if (keepFocus) { var li = q('.bfm-item[data-id="' + id + '"]'); if (li) li.focus(); }
    saveOrder();
  }
  function placeTrack(id, beforeId) {
    if (id === beforeId) return;
    var i = S.queue.indexOf(id);
    if (i === -1) return;
    S.queue.splice(i, 1);
    var j = S.queue.indexOf(beforeId);
    S.queue.splice(j === -1 ? S.queue.length : j, 0, id);
    var t = trackById(id);
    announce((t ? t.title : "Track") + " moved to position " + (S.queue.indexOf(id) + 1) + " of " + S.queue.length + ".");
    render();
    saveOrder();
  }
  var naming = null;
  function askName(kind) {
    naming = kind;
    var row = q(".bfm-plname"), input = doc.getElementById("bfmPlName");
    if (!row) return;
    row.hidden = !kind;
    if (kind) {
      var p = kind === "rename" ? playlistById(S.playlist_id) : null;
      input.value = p ? p.name : "";
      q(".bfm-plname-label").textContent = kind === "rename" ? "New name" : "Playlist name";
      input.focus();
    }
  }
  function saveName() {
    var name = (doc.getElementById("bfmPlName").value || "").trim();
    if (!name) { say("A playlist needs a name.", "error"); return Promise.resolve(false); }
    var call = naming === "rename"
      ? api("/api/music/playlists/" + encodeURIComponent(S.playlist_id), { method: "PUT", json: { name: name } })
      : api("/api/music/playlists", { method: "POST", json: { name: name, track_ids: S.queue.slice() } });
    var kind = naming;
    return call.then(function (r) {
      if (!r.ok) { say(r.body.error || "The playlist could not be saved.", "error"); return false; }
      takeLibrary(r.body);
      if (kind === "new" && r.body.created_id) { S.playlist_id = r.body.created_id; S.queue = baseOrder(); }
      askName(null);
      say(kind === "new" ? "Playlist “" + name + "” saved with the tracks in your queue." : "Playlist renamed to “" + name + "”.", "ok");
      save(); render();
      return true;
    });
  }
  function confirmTwice(btn, label) {
    if (btn.getAttribute("data-confirm") === "1") return true;
    var was = btn.textContent;
    btn.setAttribute("data-confirm", "1");
    btn.textContent = label;
    setTimeout(function () { btn.removeAttribute("data-confirm"); btn.textContent = was; }, 4000);
    return false;
  }
  function deletePlaylist(btn) {
    var p = playlistById(S.playlist_id);
    if (!p) { say("Pick a playlist to delete. “All tracks” is your whole library.", "info"); return; }
    if (!confirmTwice(btn, "Press again to delete")) return;
    api("/api/music/playlists/" + encodeURIComponent(p.id), { method: "DELETE" }).then(function (r) {
      if (!r.ok) return say(r.body.error || "The playlist could not be deleted.", "error");
      takeLibrary(r.body);
      S.playlist_id = ""; S.queue = baseOrder();
      say("Playlist “" + p.name + "” deleted. Its tracks are still in your library.", "ok");
      save(); render();
    });
  }
  function removeFromPlaylist(id) {
    if (!S.playlist_id) return;
    S.queue = S.queue.filter(function (x) { return x !== id; });
    render();
    saveOrder();
  }
  function addToPlaylist(trackId, playlistId) {
    var p = playlistById(playlistId);
    if (!p) return;
    var ids = (p.track_ids || []).filter(function (x) { return x !== trackId; }).concat([trackId]);
    api("/api/music/playlists/" + encodeURIComponent(p.id), { method: "PUT", json: { track_ids: ids } }).then(function (r) {
      if (!r.ok) return say(r.body.error || "The track could not be added.", "error");
      takeLibrary(r.body);
      var t = trackById(trackId);
      say((t ? "“" + t.title + "”" : "The track") + " added to “" + p.name + "”.", "ok");
      render();
    });
  }
  function renameTrack(id) {
    var li = q('.bfm-item[data-id="' + id + '"]'), t = trackById(id);
    if (!li || !t) return;
    var main = li.querySelector(".bfm-item-main");
    var input = doc.createElement("input");
    input.className = "bfm-text";
    input.value = t.title;
    input.maxLength = 200;
    input.setAttribute("aria-label", "New title for " + t.title);
    main.replaceWith(input);
    input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); render(); }
      if (e.key !== "Enter") return;
      e.preventDefault();
      api("/api/music/tracks/" + encodeURIComponent(id), { method: "PUT", json: { title: input.value } }).then(function (r) {
        if (!r.ok) return say(r.body.error || "The title could not be saved.", "error");
        LIB.tracks = LIB.tracks.map(function (x) { return x.id === id ? r.body.track : x; });
        say("Renamed to “" + r.body.track.title + "”.", "ok");
        render();
      });
    });
    input.addEventListener("blur", function () { setTimeout(render, 150); });
  }
  function deleteTrack(btn) {
    var id = btn.getAttribute("data-id"), t = trackById(id);
    if (!t || !confirmTwice(btn, "Press again")) return;
    if (S.track_id === id) { pauseLocal(); decks.forEach(function (d) { if (d.track === id) { d.track = null; d.el.removeAttribute("src"); } }); }
    api("/api/music/tracks/" + encodeURIComponent(id), { method: "DELETE" }).then(function (r) {
      if (!r.ok) return say(r.body.error || "The track could not be deleted.", "error");
      takeLibrary(r.body);
      delete urls[id];
      say("“" + t.title + "” deleted, file and all.", "ok");
      save(); render();
    });
  }

  /* ── uploads, with progress ─────────────────────────────────────────────── */
  function measure(file) {
    return new Promise(function (resolve) {
      var done = false, a, url = null;
      function finish(v) { if (done) return; done = true; if (url && window.URL && URL.revokeObjectURL) URL.revokeObjectURL(url); resolve(v); }
      try {
        url = URL.createObjectURL(file);
        a = new window.Audio();
        a.preload = "metadata";
        a.addEventListener("loadedmetadata", function () { finish(isFinite(a.duration) && a.duration > 0 ? a.duration : null); });
        a.addEventListener("error", function () { finish(null); });
        a.src = url;
      } catch (e) { finish(null); }
      setTimeout(function () { finish(null); }, 4000);
    });
  }
  function sendFile(file, duration, row, retried) {
    return new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      x.open("POST", apiOrigin() + "/api/music/tracks");
      x.setRequestHeader("Authorization", "Bearer " + token());
      x.upload.onprogress = function (e) { if (e.lengthComputable) row.bar.value = Math.round((e.loaded / e.total) * 100); };
      x.onload = function () {
        var body = {};
        try { body = JSON.parse(x.responseText || "{}"); } catch (e) { body = {}; }
        resolve({ status: x.status, body: body });
      };
      x.onerror = function () { resolve({ status: 0, body: { error: "The upload could not reach BizForce. Check your connection." } }); };
      var form = new FormData();
      form.append("track", file, file.name);
      if (duration) form.append("duration", String(Math.round(duration * 1000) / 1000));
      x.send(form);
    }).then(function (r) {
      // An expired sign-in: one ordinary request lets the session renew it, then once more.
      if (r.status === 401 && !retried) return api("/api/music").then(function () { return sendFile(file, duration, row, true); });
      return r;
    });
  }
  function uploadFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return Promise.resolve([]);
    var box = q(".bfm-uploads");
    var chain = Promise.resolve(), results = [];
    files.forEach(function (file) {
      var li = doc.createElement("li"), label = doc.createElement("div"), bar = doc.createElement("progress");
      label.textContent = file.name;
      bar.max = 100; bar.value = 0;
      li.appendChild(label); li.appendChild(bar);
      if (box) box.appendChild(li);
      var row = { li: li, label: label, bar: bar };
      chain = chain.then(function () {
        var max = LIB.file_max_bytes || 0, cap = LIB.cap_bytes || 0;
        if (max && file.size > max) { label.textContent = file.name + ": too large; a music file is at most " + mbText(max) + "."; bar.remove(); results.push(false); return; }
        if (cap && LIB.used_bytes + file.size > cap) { label.textContent = file.name + ": your library is full (" + mbText(LIB.used_bytes) + " of " + mbText(cap) + "). Delete a track to make room."; bar.remove(); results.push(false); return; }
        return measure(file).then(function (d) { return sendFile(file, d, row); }).then(function (r) {
          if (r.status === 201 && r.body.track) {
            LIB.tracks.push(r.body.track);
            LIB.used_bytes = Number(r.body.used_bytes) || LIB.used_bytes + file.size;
            S.queue.push(r.body.track.id);
            bar.value = 100;
            label.textContent = "“" + r.body.track.title + "” added.";
            results.push(true);
          } else {
            label.textContent = file.name + ": " + (r.body.error || "the upload failed.");
            bar.remove();
            results.push(false);
          }
          save(); render();
        });
      });
    });
    return chain.then(function () { return results; });
  }

  /* ── drawing the console's state ────────────────────────────────────────── */
  function say(text, kind) {
    R.msg = text || ""; R.msgKind = kind || "";
    var m = q(".bfm-msg");
    if (m) { m.textContent = R.msg; m.setAttribute("data-kind", R.msgKind); }
  }
  function setBtn(sel, icon, label, pressed) {
    var b = q(sel);
    if (!b) return;
    if (icon && b.getAttribute("data-icon") !== icon) { b.innerHTML = svg(icon, b.classList.contains("bfm-main") && MODE !== "mini" ? 24 : 18); b.setAttribute("data-icon", icon); }
    if (label) b.setAttribute("aria-label", label);
    if (pressed !== undefined) b.setAttribute("aria-pressed", pressed ? "true" : "false");
  }
  function renderClock() {
    if (!root) return;
    var remote = popoutAlive() && R.remote;
    var pos = remote ? Number(R.remote.position) || 0 : currentPosition();
    var dur = remote ? Number(R.remote.duration) || 0 : currentDuration();
    var cur = q(".bfm-cur"), du = q(".bfm-dur"), sk = q(".bfm-seek");
    if (cur) cur.textContent = clock(pos);
    if (du) du.textContent = clock(dur);
    if (sk && doc.activeElement !== sk) { sk.max = String(Math.max(0, Math.floor(dur * 10) / 10)); sk.value = String(pos); }
  }
  function render() {
    if (!root) return;
    var remote = popoutAlive();
    var playing = remote ? !!(R.remote && R.remote.playing) : R.playing;
    var t = remote && R.remote ? { title: R.remote.title, artist: R.remote.artist } : trackById(S.track_id);
    root.setAttribute("data-armed", R.armed && !remote ? "true" : "false");
    root.setAttribute("data-remote", remote ? "true" : "false");
    root.setAttribute("data-playing", playing ? "true" : "false");
    var rem = q(".bfm-remote");
    if (rem) rem.textContent = remote ? (playing ? REMOTE_PLAYING : REMOTE_OPEN) : "";
    var np = q(".bfm-np-title"), na = q(".bfm-np-artist"), mt = q(".bfm-mini-title");
    var title = t && t.title ? t.title : "Nothing playing";
    if (np) np.textContent = title;
    if (na) na.textContent = t && t.artist ? t.artist : "";
    if (mt) mt.textContent = remote ? (playing ? REMOTE_PLAYING + ": " + title : REMOTE_OPEN) : title;
    setBtn("[data-act=toggle]", playing ? "pause" : "play", playing ? "Pause" : "Play");
    setBtn("[data-act=shuffle]", null, null, S.shuffle);
    setBtn("[data-act=repeat]", S.repeat === "one" ? "one" : "repeat", "Repeat: " + S.repeat, S.repeat !== "off");
    setBtn("[data-act=mute]", S.muted ? "mute" : "volume", S.muted ? "Unmute" : "Mute", S.muted);
    var vol = q(".bfm-volume"); if (vol && doc.activeElement !== vol) vol.value = String(Math.round(S.volume * 100));
    var vo = q(".bfm-vol-out"); if (vo) vo.textContent = S.muted ? "Muted" : Math.round(S.volume * 100) + "%";
    var mix = q(".bfm-mix"); if (mix && doc.activeElement !== mix) mix.value = String(S.crossfade);
    var mo = q(".bfm-mix-out"); if (mo) mo.textContent = S.crossfade ? S.crossfade + " s" : "Off";
    var ap = q(".bfm-autoplay"); if (ap) ap.checked = S.autoplay === true;
    Array.prototype.forEach.call(root.querySelectorAll("[data-view]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-view") === S.view ? "true" : "false"); });
    var vn = q(".bfm-viz-note"); if (vn) vn.textContent = reducedMotion() ? "Reduced motion is on, so the visualiser stays still." : "";
    var lim = q(".bfm-limits");
    if (lim && LIB.loaded) lim.textContent = "MP3, M4A, AAC, Ogg, Opus, FLAC or WAV, up to " + mbText(LIB.file_max_bytes) + " each. " + mbText(LIB.used_bytes) + " of " + mbText(LIB.cap_bytes) + " used.";
    renderPlaylists();
    renderQueue();
    var m = q(".bfm-msg"); if (m) { m.textContent = R.msg; m.setAttribute("data-kind", R.msgKind); }
    if (MODE === "mini") root.hidden = !(remote || S.track_id || R.playing);
    renderClock();
  }
  function renderPlaylists() {
    var sel = q(".bfm-playlist");
    if (!sel) return;
    var want = [["", "All tracks (" + LIB.tracks.length + ")"]].concat(LIB.playlists.map(function (p) { return [p.id, p.name + " (" + (p.track_ids || []).length + ")"]; }));
    var key = JSON.stringify(want);
    if (sel.getAttribute("data-key") !== key) {
      sel.innerHTML = "";
      want.forEach(function (w) { var o = doc.createElement("option"); o.value = w[0]; o.textContent = w[1]; sel.appendChild(o); });
      sel.setAttribute("data-key", key);
    }
    sel.value = S.playlist_id || "";
  }
  function renderQueue() {
    var list = q(".bfm-queue");
    if (!list) return;
    var focused = doc.activeElement && list.contains(doc.activeElement) && doc.activeElement.classList.contains("bfm-item") ? doc.activeElement.getAttribute("data-id") : null;
    list.innerHTML = "";
    var inPlaylist = !!(S.playlist_id && playlistById(S.playlist_id));
    if (!S.queue.length) {
      var empty = doc.createElement("li");
      empty.className = "bfm-note";
      empty.textContent = LIB.loaded ? (inPlaylist ? "This playlist is empty. Pick “All tracks” and add tracks to it." : "No music yet. Drop your files below to start your library.") : "Loading your music…";
      list.appendChild(empty);
      return;
    }
    S.queue.forEach(function (id, i) {
      var t = trackById(id);
      if (!t) return;
      var li = doc.createElement("li");
      li.className = "bfm-item";
      li.tabIndex = 0;
      li.draggable = true;
      li.setAttribute("data-id", id);
      li.setAttribute("aria-label", (i + 1) + " of " + S.queue.length + ": " + t.title + (t.artist ? " by " + t.artist : ""));
      if (id === S.track_id) li.setAttribute("aria-current", "true");
      var extra = inPlaylist
        ? '<button type="button" class="bfm-mini-btn" data-act="remove-track" data-id="' + id + '" aria-label="Remove from playlist" title="Remove from playlist">−</button>'
        : '<button type="button" class="bfm-chip" data-act="rename-track" data-id="' + id + '">Rename</button>' +
          '<button type="button" class="bfm-chip" data-act="delete-track" data-id="' + id + '" data-danger="1">Delete</button>';
      li.innerHTML = '<span class="bfm-grip" aria-hidden="true">' + svg("grip", 14) + "</span>" +
        '<button type="button" class="bfm-item-main" data-act="play-track" data-id="' + id + '"><span class="bfm-item-title"></span><span class="bfm-item-meta"></span></button>' +
        '<button type="button" class="bfm-mini-btn" data-act="move-up" data-id="' + id + '" aria-label="Move up">' + svg("up", 14) + "</button>" +
        '<button type="button" class="bfm-mini-btn" data-act="move-down" data-id="' + id + '" aria-label="Move down">' + svg("down", 14) + "</button>" + extra;
      li.querySelector(".bfm-item-title").textContent = t.title;
      li.querySelector(".bfm-item-meta").textContent = (t.artist ? t.artist + " · " : "") + clock(t.duration_secs);
      if (!inPlaylist && LIB.playlists.length) {
        var add = doc.createElement("select");
        add.className = "bfm-select";
        add.setAttribute("aria-label", "Add " + t.title + " to a playlist");
        var o0 = doc.createElement("option"); o0.value = ""; o0.textContent = "Add to playlist"; add.appendChild(o0);
        LIB.playlists.forEach(function (p) { var o = doc.createElement("option"); o.value = p.id; o.textContent = p.name; add.appendChild(o); });
        add.addEventListener("change", function () { if (this.value) addToPlaylist(id, this.value); this.value = ""; });
        li.appendChild(add);
      }
      list.appendChild(li);
    });
    if (focused) { var back = q('.bfm-item[data-id="' + focused + '"]'); if (back) back.focus(); }
  }

  /* ── boot ───────────────────────────────────────────────────────────────── */
  function boot() {
    injectStyle();
    if (MODE === "mini") buildMini();
    else buildConsole(doc.getElementById(MODE === "popout" ? "bfMusicPopout" : "bfMusicPanel"));
    render();
    startViz();
    if (MODE === "popout") {
      ticker = setInterval(tick, TICK_MS);
      post({ type: "popout-hello", from: ID });
      window.addEventListener("pagehide", function () {
        pauseLocal();
        if (ticker) { clearInterval(ticker); ticker = null; }
        post({ type: "popout-closed", from: ID });
      });
      loadLibrary();
      return;
    }
    window.addEventListener("pagehide", function () { if (R.playing) save(); });
    ticker = setInterval(tick, TICK_MS);
    var needLibrary = MODE === "panel" || S.autoplay || !!S.track_id;
    (needLibrary ? loadLibrary() : Promise.resolve(LIB)).then(function () {
      /* "Play when I open BizForce": play() refuses until the first
         interaction, and arms the player for it. */
      if (S.autoplay && LIB.tracks.length) play({ auto: true });
    });
  }

  window.BFMusic = {
    mode: MODE, id: ID,
    AUTOPLAY_LABEL: AUTOPLAY_LABEL, AUTOPLAY_NOTE: AUTOPLAY_NOTE, REMOTE_PLAYING: REMOTE_PLAYING, REMOTE_OPEN: REMOTE_OPEN,
    POPUP_BLOCKED: POPUP_BLOCKED, CROSSFADE_MAX: CROSSFADE_MAX, ENERGY_HZ: ENERGY_HZ, STORE_KEY: STORE_KEY, CHANNEL_NAME: CHANNEL_NAME,
    fadeGains: fadeGains, energyStep: energyStep, easeOut: easeOut, clamp01: clamp01,
    play: play, pause: pause, toggle: toggle, next: next, prev: prev, seek: seek, setVolume: setVolume, toggleMute: toggleMute,
    setShuffle: setShuffle, cycleRepeat: cycleRepeat, setRepeat: setRepeat, setCrossfade: setCrossfade, setView: setView,
    setAutoplay: setAutoplay, playTrack: playTrack, popOut: popOut, choosePlaylist: choosePlaylist, moveTrack: moveTrack, uploadFiles: uploadFiles,
    loadLibrary: loadLibrary,
    state: function () { return JSON.parse(JSON.stringify(S)); },
    library: function () { return LIB; },
    playing: function () { return R.playing; },
    armed: function () { return R.armed; },
    activated: function () { return R.activated; },
    audible: audible,
    position: currentPosition,
    popoutAlive: popoutAlive,
    energy: function () { return E.e; },
    _tick: tick,
    _energyTick: energyTick,
    _decks: function () { return decks; },
    _context: function () { return ctx; },
    _master: function () { return master; },
    _fade: function () { return R.fade; },
    _urls: urls
  };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

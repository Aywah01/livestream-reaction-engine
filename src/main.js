/**
 * App wiring: mode switch, icon picker, spawn buttons, speed slider, stats.
 * Each engine has the same interface: { spawn, active, setSpeed, destroy }.
 */
(function () {
  'use strict';

  const ICONS = ['heart', 'like', 'fire', 'star'];
  const BURST_COUNT = 60;
  const BURST_WINDOW_MS = 1000;

  const layer = document.getElementById('reaction-layer');
  const $ = (id) => document.getElementById(id);
  const ui = {
    mode: $('stat-mode'),
    active: $('stat-active'),
    nodes: $('stat-nodes'),
    total: $('stat-total'),
    speed: $('speed'),
    speedValue: $('speed-value'),
    speedGroup: $('speed-group'),
  };

  let selectedIcon = 'random';
  let total = 0;
  let engine = null;
  let burstTimer = null;

  // Batch stats DOM writes into one per frame so the counters don't add
  // their own work to the profile.
  let statsQueued = false;
  function scheduleStats() {
    if (statsQueued) return;
    statsQueued = true;
    requestAnimationFrame(() => {
      statsQueued = false;
      ui.active.textContent = engine ? engine.active : 0;
      ui.nodes.textContent = layer.childElementCount; // shows that finished nodes really leave the DOM
      ui.total.textContent = total;
    });
  }

  function setMode(mode) {
    if (engine) engine.destroy();
    clearInterval(burstTimer);
    engine = mode === 'gsap'
      ? window.createGsapEngine(layer, scheduleStats)
      : window.createCssEngine(layer, scheduleStats);

    ui.mode.textContent = engine.name;
    ui.speed.disabled = !engine.supportsSpeed;
    ui.speedGroup.classList.toggle('is-disabled', !engine.supportsSpeed);
    engine.setSpeed(parseFloat(ui.speed.value));
    scheduleStats();
  }

  function pickIcon() {
    return selectedIcon === 'random'
      ? ICONS[(Math.random() * ICONS.length) | 0]
      : selectedIcon;
  }

  function sendReaction() {
    engine.spawn(pickIcon());
    total++;
    scheduleStats();
  }

  // Several reactions at once. Engines that support batching (GSAP) get one
  // call, so they can do a single DOM write for the whole batch.
  function sendReactions(n) {
    const icons = Array.from({ length: n }, pickIcon);
    if (engine.spawnMany) engine.spawnMany(icons);
    else icons.forEach((icon) => engine.spawn(icon));
    total += n;
    scheduleStats();
  }

  // Repeatable load for profiling: 60 reactions spread over about 1 second,
  // so 50+ are in the air at the same time.
  // Under heavy load (6x CPU throttling + layout animations) timers fire late,
  // so each tick spawns however many reactions are "due" by elapsed time.
  // That keeps the load at 60 per second instead of letting it drift lower.
  function burst() {
    clearInterval(burstTimer);
    const start = performance.now();
    let sent = 0;
    burstTimer = setInterval(() => {
      const elapsed = performance.now() - start;
      const due = Math.min(BURST_COUNT, Math.ceil((elapsed / BURST_WINDOW_MS) * BURST_COUNT));
      const n = due - sent;
      if (n > 0) { sendReactions(n); sent = due; }
      if (sent >= BURST_COUNT) clearInterval(burstTimer);
    }, BURST_WINDOW_MS / BURST_COUNT);
  }

  // ---- Event wiring ----
  $('send-btn').addEventListener('click', sendReaction);
  $('burst-btn').addEventListener('click', burst);

  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener('change', (e) => setMode(e.target.value));
  });

  $('icon-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-icon]');
    if (!btn) return;
    selectedIcon = btn.dataset.icon;
    document.querySelectorAll('#icon-picker button').forEach((b) =>
      b.classList.toggle('is-selected', b === btn));
  });

  ui.speed.addEventListener('input', () => {
    const v = parseFloat(ui.speed.value);
    ui.speedValue.textContent = `${v.toFixed(1)}×`;
    engine.setSpeed(v);
  });

  // Keyboard shortcuts: Space = send, B = burst.
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, button')) return;
    if (e.code === 'Space') { e.preventDefault(); sendReaction(); }
    if (e.key === 'b' || e.key === 'B') burst();
  });

  // Start in whichever mode the radio shows (the browser may restore it on reload).
  setMode(document.querySelector('input[name="mode"]:checked').value);
})();

/**
 * Phase 1: CSS @keyframes engine.
 *
 * JS only creates the node and sets two custom properties for randomness.
 * The browser's CSS animation system does all the motion, but because the
 * keyframes animate layout properties (bottom, margin-left, width, height),
 * every frame on the main thread runs Recalculate Style -> Layout -> Paint.
 */
(function (global) {
  'use strict';

  function createCssEngine(layer, onChange) {
    let active = 0;

    function spawn(iconId) {
      const el = document.createElement('div');
      el.className = 'reaction reaction--css';
      el.innerHTML = `<svg aria-hidden="true"><use href="#icon-${iconId}"/></svg>`;

      // Random spawn column inside the spawn area (around the center) and random sway.
      el.style.setProperty('--x', `calc(50% + ${rand(-60, 60).toFixed(1)}px)`);
      el.style.setProperty('--sway', `${rand(14, 34).toFixed(1)}px`);
      // Random start offset for the sway so the reactions don't all move in step.
      el.style.animationDelay = `0s, -${rand(0, 0.75).toFixed(2)}s`;

      // Cleanup: the rise animation sets the lifespan. `animationend` also
      // fires for the sway animation, so check the name and remove the node
      // only once. Removing the node also removes this listener, so nothing leaks.
      el.addEventListener('animationend', function handleEnd(e) {
        if (e.animationName !== 'css-rise') return;
        el.removeEventListener('animationend', handleEnd);
        el.remove();
        active--;
        onChange();
      });

      layer.appendChild(el);
      active++;
      onChange();
    }

    return {
      name: 'CSS keyframes',
      spawn,
      get active() { return active; },
      supportsSpeed: false,
      setSpeed() { /* CSS keyframes have no easy speed control — see README §4 */ },
      destroy() {
        layer.querySelectorAll('.reaction--css').forEach((n) => n.remove());
        active = 0;
        onChange();
      },
    };
  }

  function rand(min, max) { return min + Math.random() * (max - min); }

  global.createCssEngine = createCssEngine;
})(window);

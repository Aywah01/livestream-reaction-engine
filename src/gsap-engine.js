/**
 * Phase 2: GSAP engine.
 *
 * Each reaction is one gsap.timeline() that animates ONLY:
 *   y        -> upward travel        (transform)
 *   x        -> horizontal sway      (transform)
 *   scale    -> grow during flight   (transform)
 *   opacity  -> fade in / fade out
 * These are applied at the compositor stage, so the element's box is never
 * laid out again and its pixels are never repainted. The GPU only moves and
 * blends an existing texture.
 *
 * Every live timeline is kept in a Set so the speed slider can change
 * timeScale() on reactions that are already in the air.
 */
(function (global) {
  'use strict';

  const LIFESPAN = 3;          // seconds, at timeScale 1
  const SIZE = 48;             // px, matches .reaction--gsap width/height
  const SCALE_START = 0.6;     // grow 0.6 -> 1.0 (never above 1, so the icon stays sharp)
  const SCALE_END = 1;

  function createGsapEngine(layer, onChange) {
    const timelines = new Set();
    let speed = 1;

    // Cache the stage size so spawn() never reads layout (which would force a
    // synchronous reflow). Update only on resize.
    let stageW = layer.clientWidth;
    let stageH = layer.clientHeight;
    const ro = new ResizeObserver(([entry]) => {
      stageW = entry.contentRect.width;
      stageH = entry.contentRect.height;
    });
    ro.observe(layer);

        // Spawns a batch of reactions without layout thrashing.
    //  1. Starting transform/opacity go in as inline CSS BEFORE insertion:
    //     pure writes, nothing read back.
    //  2. All nodes are inserted with one appendChild(fragment).
    //  3. Plain .to() tweens (no gsap.set / fromTo, which render immediately)
    //     start on GSAP's next ticker frame. There GSAP "lazy renders": it
    //     does every tween's DOM read first and puts all writes off to the end
    //     of the frame, so the batch costs one style recalc instead of one per
    //     reaction.
    function spawnMany(iconIds) {
      const frag = document.createDocumentFragment();
      const startY = stageH - SIZE - 8;
      const endY = startY - stageH * 0.82;    // stop (and be fully faded) before the top edge

      const items = iconIds.map((iconId) => {
        const startX = stageW / 2 - SIZE / 2 + gsap.utils.random(-60, 60);
        const sway = gsap.utils.random(14, 34) * (Math.random() < 0.5 ? 1 : -1);
        const el = document.createElement('div');
        el.className = 'reaction reaction--gsap';
        el.innerHTML = `<svg aria-hidden="true"><use href="#icon-${iconId}"/></svg>`;
        // `translate/scale/rotate: none` matches what GSAP writes when it first
        // parses an element, so that write changes nothing and doesn't mark
        // style as stale for the next reaction in the batch.
        el.style.cssText =
          `transform: translate3d(${startX - sway}px, ${startY}px, 0) scale(${SCALE_START});` +
          'opacity: 0; translate: none; scale: none; rotate: none;';
        frag.appendChild(el);
        return { el, startX, sway };
      });
      layer.appendChild(frag);                // one write for the whole batch

      items.forEach(({ el, startX, sway }) => {
        const tl = gsap.timeline({
          onComplete() {
            // Cleanup: kill the timeline (frees GSAP's references), remove the
            // node, and drop it from the Set so nothing keeps it alive.
            tl.kill();
            el.remove();
            timelines.delete(tl);
            onChange();
          },
        });

        // transformOrigin stays at the CSS default (50% 50%): setting it in
        // GSAP would make GSAP measure the element (a forced layout).
        // force3D keeps each reaction on its own compositor layer.
        tl.to(el, { y: endY, duration: LIFESPAN, ease: 'none', force3D: true }, 0)
          .to(el, {
            x: startX + sway,
            duration: LIFESPAN / 4,
            ease: 'sine.inOut',
            repeat: 3,
            yoyo: true,
          }, 0)
          .to(el, { scale: SCALE_END, duration: LIFESPAN, ease: 'power1.out' }, 0)
          .to(el, { opacity: 1, duration: 0.3, ease: 'power1.out' }, 0)
          .to(el, { opacity: 0, duration: 0.9, ease: 'power1.in' }, LIFESPAN - 0.9);

        tl.timeScale(speed);          // new reactions start at the current speed
        timelines.add(tl);
      });
      onChange();
    }

    function spawn(iconId) { spawnMany([iconId]); }

    function setSpeed(value) {
      speed = value;
      // Change every reaction that is currently in the air.
      timelines.forEach((tl) => tl.timeScale(value));
    }

    return {
      name: 'GSAP (compositor)',
      spawn,
      spawnMany,
      get active() { return timelines.size; },
      supportsSpeed: true,
      setSpeed,
      destroy() {
        timelines.forEach((tl) => tl.kill());
        timelines.clear();
        layer.querySelectorAll('.reaction--gsap').forEach((n) => n.remove());
        ro.disconnect();
        onChange();
      },
    };
  }

  global.createGsapEngine = createGsapEngine;
})(window);

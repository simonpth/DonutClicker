// FX: "flee" - UI tries to escape the pointer, panels drift, counter glitches.
// Uses the individual CSS `translate` / `rotate` properties so it composes with
// any existing `transform` animations. Decorative DOM is pointer-events:none.

const DODGE_SEL = '#shop button, #buildings li, #upgrades button';
const PANEL_SEL = '#stats, #shop';
const MAX_OFF = 40;          // hard cap in px so everything stays clickable
const SPRING_K = 180;
const SPRING_D = 2 * Math.sqrt(SPRING_K) * 0.8;

export function init(ctx) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const chaos = () => {
    try { return Math.max(0, Number(ctx.getChaos()) || 0); } catch (e) { return 0; }
  };

  const style = document.createElement('style');
  style.textContent = '#counter-ghost{position:fixed;z-index:9000;pointer-events:none;display:flex;align-items:center;justify-content:center;white-space:nowrap;margin:0}'
    + '#counter-ghost[hidden]{display:none!important}';
  document.head.appendChild(style);

  // ---------- Panel drift + rotate ----------
  const panels = [...document.querySelectorAll(PANEL_SEL)];
  const phases = panels.map((_, i) => i * 1.7);

  // ---------- Dodge ----------
  let items = [];
  let px = -1e5, py = -1e5;
  let running = false;
  let last = 0;

  function refreshItems() {
    const map = new Map(items.map(i => [i.el, i]));
    items = [...document.querySelectorAll(DODGE_SEL)].map(el =>
      map.get(el) || { el, x: 0, y: 0, vx: 0, vy: 0, cur: '' });
  }

  function dodgeFrame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const c = chaos();
    const maxOff = Math.min(MAX_OFF, 12 * (1 + c));
    const R = 90 + 15 * c;
    let busy = false;

    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      let tx = 0, ty = 0;
      if (r.width > 0) {
        // base centre = current rect minus our own offset
        const cx = r.left + r.width / 2 - it.x;
        const cy = r.top + r.height / 2 - it.y;
        const dx = cx - px, dy = cy - py;
        const d = Math.hypot(dx, dy) || 1;
        if (d < R) {
          const k = 1 - d / R;
          tx = (dx / d) * maxOff * k;
          ty = (dy / d) * maxOff * k;
        }
      }
      it.vx += (SPRING_K * (tx - it.x) - SPRING_D * it.vx) * dt;
      it.vy += (SPRING_K * (ty - it.y) - SPRING_D * it.vy) * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      const m = Math.hypot(it.x, it.y);
      if (m > MAX_OFF) { it.x *= MAX_OFF / m; it.y *= MAX_OFF / m; }

      if (tx || ty || Math.abs(it.x) > 0.02 || Math.abs(it.y) > 0.02
          || Math.abs(it.vx) > 0.02 || Math.abs(it.vy) > 0.02) busy = true;

      const next = (Math.abs(it.x) < 0.02 && Math.abs(it.y) < 0.02)
        ? '' : `${it.x.toFixed(2)}px ${it.y.toFixed(2)}px`;
      if (next !== it.cur) { it.el.style.translate = next; it.cur = next; }
    }

    if (busy) requestAnimationFrame(dodgeFrame);
    else running = false;
  }

  function kick() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(dodgeFrame);
  }

  if (fine && !reduce) {
    refreshItems();
    setInterval(refreshItems, 1000);
    document.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      kick();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
      px = py = -1e5;
      kick();
    });
  }

  // ---------- Panel drift loop (slow, ~30fps) ----------
  if (!reduce && panels.length) {
    let lastDrift = 0;
    const driftFrame = now => {
      requestAnimationFrame(driftFrame);
      if (now - lastDrift < 33) return;
      lastDrift = now;
      const c = chaos();
      const A = Math.min(6, 2 + c);
      const rot = Math.min(1.2, 0.3 + 0.3 * c);
      const t = now / 1000;
      panels.forEach((el, i) => {
        const p = phases[i];
        const x = A * Math.sin(t * 0.21 + p);
        const y = A * Math.cos(t * 0.17 + p * 0.6);
        const a = rot * Math.sin(t * 0.13 + p);
        el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
        el.style.rotate = `${a.toFixed(3)}deg`;
      });
    };
    requestAnimationFrame(driftFrame);
  }

  // ---------- Counter glitch (overlay, real element untouched) ----------
  const counter = document.getElementById('counter');
  if (counter) {
    const ghost = document.createElement('div');
    ghost.id = 'counter-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.hidden = true;
    document.body.appendChild(ghost);

    let busy = false;
    const schedule = ms => setTimeout(glitch, ms);

    function bgOf(el) {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      }
      return 'transparent';
    }

    function glitch() {
      const c = chaos();
      if (c < 0.3 || busy || document.hidden) return schedule(5000);
      const real = counter.textContent.trim();
      if (!/^[\d.,\s]+$/.test(real)) return schedule(5000);
      const value = parseInt(real.replace(/\D/g, ''), 10);
      if (!Number.isFinite(value) || value < 10) return schedule(5000);

      busy = true;
      const cs = getComputedStyle(counter);
      const r = counter.getBoundingClientRect();
      Object.assign(ghost.style, {
        left: r.left + 'px', top: r.top + 'px',
        width: r.width + 'px', height: r.height + 'px',
        fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight, color: cs.color,
        textShadow: cs.textShadow, background: bgOf(counter),
      });

      // wrong value: starts above the real one and counts backwards past it
      const from = Math.floor(value * (1.15 + Math.random() * 0.35)) + 3;
      const to = Math.max(0, Math.floor(value * (0.8 + Math.random() * 0.1)));
      const fmt = n => n.toLocaleString('de-DE');
      const DUR = 500;
      const t0 = performance.now();
      let shown = -1;
      ghost.hidden = false;

      const step = now => {
        const t = Math.min(1, (now - t0) / DUR);
        const v = Math.round(from + (to - from) * t);
        if (v !== shown) { ghost.textContent = fmt(v); shown = v; }
        if (t < 1) return requestAnimationFrame(step);
        ghost.hidden = true;   // snap back to the real number
        ghost.textContent = '';
        busy = false;
        schedule((20000 + Math.random() * 30000) / (1 + c * 0.5));
      };
      requestAnimationFrame(step);
    }

    schedule(15000);
  }
}

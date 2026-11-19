// DOM-based donut boss fight. Spawns periodically; click it down within 25 s or it steals 10% of your donuts.
import { formatNumber } from '../ui.js';

const NAMES = ['Der Schoko-Tyrann', 'Glasur-Godzilla', 'Kalorien-Kaiser', 'Zuckerschock-Zar', 'Puderzucker-Piranha'];
const BOSS_TIME = 25000;
const FIRST_MIN = 90000;
const MIN_BUILDINGS = 5;
const DEBRIS = ['🍩', '🍬', '💥', '✨', '🍫', '🔥'];

const CSS = `
#dc-boss-layer{position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden}
.dc-boss{position:fixed;left:0;top:0;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;transition:transform .6s ease-in-out;will-change:transform}
.dc-boss-name{font:900 clamp(.85rem,3.2vw,1.1rem)/1.1 system-ui,sans-serif;color:#fff;background:#2b0a16;border:2px solid #ff3b7a;border-radius:999px;padding:3px 12px;white-space:nowrap;text-shadow:0 2px 0 #000}
.dc-boss-hp{width:100%;height:14px;background:#2b0a16;border:2px solid #fff;border-radius:99px;overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.4)}
.dc-boss-hp i{display:block;height:100%;width:100%;background:linear-gradient(#8dff9a,#1db954);transition:width .15s}
.dc-boss-timer{font:800 13px system-ui,sans-serif;color:#ffe07a;text-shadow:0 1px 0 #000}
.dc-boss-body{position:relative;border-radius:50%;pointer-events:auto;cursor:crosshair;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;animation:dc-boss-wobble 1.1s ease-in-out infinite alternate;filter:drop-shadow(0 8px 14px rgba(120,0,40,.55));background:
  radial-gradient(circle 5px at 50% 15%,#fff 60%,transparent 62%),
  radial-gradient(circle 5px at 85% 50%,#7ff 60%,transparent 62%),
  radial-gradient(circle 5px at 50% 85%,#ff6 60%,transparent 62%),
  radial-gradient(circle 5px at 15% 50%,#fff 60%,transparent 62%),
  radial-gradient(circle 5px at 76% 24%,#7ff 60%,transparent 62%),
  radial-gradient(circle 5px at 24% 76%,#ff6 60%,transparent 62%),
  radial-gradient(circle closest-side,#2a0f1a 0 30%,#ff5fa8 31% 70%,#ffa3d1 71% 78%,#ff5fa8 79% 86%,#9a5426 87% 100%)}
.dc-boss-face{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);line-height:1;pointer-events:none;filter:drop-shadow(0 3px 0 #000)}
@keyframes dc-boss-wobble{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
.dc-boss-banner{position:fixed;left:0;right:0;top:16%;margin:0 auto;width:max-content;max-width:94vw;z-index:9001;pointer-events:none;color:#fff;font:900 clamp(1.1rem,5.5vw,2.2rem)/1.2 system-ui,sans-serif;letter-spacing:.04em;text-align:center;white-space:nowrap;padding:.4em .9em;border:4px solid #fff;border-radius:14px;box-shadow:0 0 0 4px #7a0008,0 0 40px #f00;animation:dc-boss-siren .35s steps(2,start) infinite alternate}
@keyframes dc-boss-siren{from{background:#d7000f}to{background:#ffd400;color:#7a0008}}
.dc-boss-bit{position:fixed;left:0;top:0;pointer-events:none;font-size:22px;line-height:1}
`;

const rnd = (a, b) => a + Math.random() * (b - a);

export function init(ctx) {
  const { game, ui, sfx } = ctx;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const layer = document.createElement('div');
  layer.id = 'dc-boss-layer';
  document.body.appendChild(layer);

  let boss = null; // {el, body, hpEl, timerEl, hp, maxHp, size, x, y, endAt, moveId, dead}
  let nextAt = performance.now() + FIRST_MIN + rnd(0, 60000);

  const chaos = () => {
    try { return Number(ctx.getChaos()) || 0; } catch { return 0; }
  };

  // Chaos 0: 3-5 min. Chaos 3+: 2-4 min.
  function scheduleNext() {
    const t = Math.min(1, chaos() / 3);
    const lo = 120 + 60 * (1 - t);
    const hi = 300 - 60 * t;
    nextAt = performance.now() + rnd(lo, hi) * 1000;
  }

  function ownedTotal() {
    let n = 0;
    for (const k in game.owned) n += game.owned[k] || 0;
    return n;
  }

  function shake(strength = 1) {
    const s = 8 * strength;
    try {
      document.body.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${-s}px,${s * 0.6}px)` },
          { transform: `translate(${s}px,${-s * 0.8}px)` },
          { transform: `translate(${-s * 0.6}px,${-s * 0.4}px)` },
          { transform: 'translate(0,0)' },
        ],
        { duration: 450, easing: 'linear' }
      );
    } catch { /* animation unsupported: skip */ }
  }

  function banner() {
    const b = document.createElement('div');
    b.className = 'dc-boss-banner';
    b.textContent = '⚠️ BOSS-ANGRIFF ⚠️';
    layer.appendChild(b);
    setTimeout(() => b.remove(), 2400);
  }

  function moveTo(x, y, dur) {
    if (!boss) return;
    boss.x = x;
    boss.y = y;
    boss.el.style.transition = `transform ${dur.toFixed(2)}s ease-in-out`;
    boss.el.style.transform = `translate3d(${x.toFixed(0)}px,${y.toFixed(0)}px,0)`;
  }

  function bounds() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const size = boss.size;
    return {
      maxX: Math.max(0, W - size - 8),
      minY: 80,
      maxY: Math.max(80, H - size - 120),
    };
  }

  // Erratic wandering: mostly long hops, sometimes short jitters.
  function wander() {
    if (!boss || boss.dead) return;
    const b = bounds();
    const dur = rnd(0.25, 0.6);
    if (Math.random() < 0.3) {
      const nx = Math.min(b.maxX, Math.max(0, boss.x + rnd(-90, 90)));
      const ny = Math.min(b.maxY, Math.max(b.minY, boss.y + rnd(-70, 70)));
      moveTo(nx, ny, dur);
    } else {
      moveTo(rnd(0, b.maxX), rnd(b.minY, b.maxY), dur);
    }
  }

  function spawn() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const size = Math.round(Math.max(160, Math.min(280, W * 0.7, H * 0.42)));

    const el = document.createElement('div');
    el.className = 'dc-boss';
    el.style.width = `${size}px`;
    el.innerHTML =
      '<div class="dc-boss-name"></div>' +
      '<div class="dc-boss-hp"><i></i></div>' +
      '<div class="dc-boss-timer"></div>' +
      `<div class="dc-boss-body" style="width:${size}px;height:${size}px">` +
      `<div class="dc-boss-face" style="font-size:${Math.round(size * 0.3)}px">😈</div></div>`;
    el.querySelector('.dc-boss-name').textContent = NAMES[Math.floor(Math.random() * NAMES.length)];

    const body = el.querySelector('.dc-boss-body');
    const maxHp = Math.max(30, game.getClickPower() * 30);
    boss = {
      el,
      body,
      hpEl: el.querySelector('.dc-boss-hp i'),
      timerEl: el.querySelector('.dc-boss-timer'),
      hp: maxHp,
      maxHp,
      size,
      x: W + 40,
      y: rnd(80, Math.max(80, H - size - 120)),
      endAt: performance.now() + BOSS_TIME,
      moveId: null,
      dead: false,
    };
    layer.appendChild(el);

    // Fly in from the right edge.
    el.style.transition = 'none';
    el.style.transform = `translate3d(${boss.x}px,${boss.y}px,0)`;
    void el.offsetWidth; // commit start position
    const b = bounds();
    moveTo(rnd(0, b.maxX), rnd(b.minY, b.maxY), 0.9);
    boss.moveId = setInterval(wander, 700);

    body.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onHit(e.clientX, e.clientY);
    });

    if (typeof ctx.bang === 'function') ctx.bang(2);
    shake(1.5);
    banner();
    tick();
  }

  function onHit(x, y) {
    if (!boss || boss.dead) return;
    const dmg = Math.max(1, game.getClickPower());
    boss.hp = Math.max(0, boss.hp - dmg);
    boss.hpEl.style.width = `${((boss.hp / boss.maxHp) * 100).toFixed(1)}%`;

    try {
      boss.body.animate(
        [
          { filter: 'brightness(2.4) saturate(.3)', transform: 'scale(.92)' },
          { filter: 'brightness(1)', transform: 'scale(1)' },
        ],
        { duration: 220, easing: 'ease-out' }
      );
    } catch { /* ignore */ }

    ui.floatText(x, y, `-${formatNumber(dmg)}`);
    if (sfx && typeof sfx.boing === 'function') sfx.boing();

    if (boss.hp <= 0) defeat();
  }

  function endFight() {
    if (!boss) return null;
    const b = boss;
    boss = null;
    b.dead = true;
    clearInterval(b.moveId);
    b.body.style.pointerEvents = 'none';
    scheduleNext();
    return b;
  }

  function escape() {
    const b = endFight();
    if (!b) return;
    const stolen = game.donuts * 0.1;
    game.donuts = Math.max(0, game.donuts * 0.9);
    ui.toast(`Der Boss hat dir ${formatNumber(stolen)} 🍩 gestohlen!`);

    // Fly off to the right, then remove.
    b.el.style.transition = 'transform .8s ease-in';
    b.el.style.transform = `translate3d(${window.innerWidth + 80}px,${b.y}px,0)`;
    setTimeout(() => b.el.remove(), 900);
  }

  function defeat() {
    const rect = boss ? boss.body.getBoundingClientRect() : null;
    const b = endFight();
    if (!b) return;
    const cx = rect ? rect.left + rect.width / 2 : b.x + b.size / 2;
    const cy = rect ? rect.top + rect.height / 2 : b.y + b.size / 2;
    b.el.remove();

    const reward = Math.max(game.getDps() * 120, game.donuts * 0.2);
    game.addDonuts(reward);

    // Massive DOM debris burst.
    for (let i = 0; i < 64; i++) {
      const p = document.createElement('div');
      p.className = 'dc-boss-bit';
      p.textContent = DEBRIS[i % DEBRIS.length];
      p.style.left = `${cx}px`;
      p.style.top = `${cy}px`;
      layer.appendChild(p);
      const a = rnd(0, Math.PI * 2);
      const d = rnd(140, 460);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d - 60;
      const spin = rnd(-540, 540);
      try {
        const anim = p.animate(
          [
            { transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 },
            { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.3) rotate(${spin}deg)`, opacity: 0 },
          ],
          { duration: rnd(800, 1400), easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'forwards' }
        );
        anim.onfinish = () => p.remove();
      } catch {
        setTimeout(() => p.remove(), 1000);
      }
    }

    if (typeof ctx.bang === 'function') ctx.bang(2);
    if (sfx && typeof sfx.explosion === 'function') sfx.explosion();
    shake(2.5);
    ui.toast(`🎉 Boss besiegt! +${formatNumber(reward)} 🍩`);
  }

  // Poll every 250 ms: fight countdown and spawn timing.
  function tick() {
    const now = performance.now();
    if (boss) {
      const left = Math.max(0, boss.endAt - now);
      boss.timerEl.textContent = `⏱ ${Math.ceil(left / 1000)} s`;
      if (left <= 0) escape();
      return;
    }
    if (now >= nextAt) {
      if (ownedTotal() >= MIN_BUILDINGS) {
        spawn();
      } else {
        nextAt = now + 10000; // not eligible yet, retry shortly
      }
    }
  }

  setInterval(tick, 250);
}

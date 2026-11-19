// Cursor FX: donut cursor, sprinkle trail, chaos jitter decoy, wandering fake cursor.
// Desktop (fine pointer) only. Decorative DOM is pointer-events:none.

const SPRINKLE_COLORS = ['#ff5fa2', '#ffd23f', '#5fd3ff', '#7cf29a', '#b67cff', '#ff8a3d'];
const POOL_SIZE = 60;
const GRAVITY = 0.12;

let pool = [];
let poolIdx = 0;
let decoy = null;
let fake = null;
let fakeTimer = 0;
let chaos = 0;
let mx = -100, my = -100, hasPointer = false;
let lastSpawnX = -100, lastSpawnY = -100, lastSpawnT = 0;
let decoyX = -100, decoyY = -100;
let fakeState = null; // {x, y, tx, ty, nextWp, endT}
let running = false;
let rafId = 0;

const CSS = `
.dc-spr{position:fixed;left:0;top:0;width:7px;height:3px;border-radius:2px;opacity:0;pointer-events:none;z-index:9000;will-change:transform,opacity}
.dc-decoy,.dc-fake{position:fixed;left:0;top:0;line-height:1;pointer-events:none;z-index:9001;opacity:0;transition:opacity .25s;user-select:none;will-change:transform}
.dc-decoy{font-size:28px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))}
.dc-fake{font-size:24px;filter:hue-rotate(150deg) saturate(1.6) drop-shadow(0 2px 3px rgba(0,0,0,.35))}
`;

function setCursorStyle(dataUrl) {
  const style = document.createElement('style');
  // Override any per-element cursor rules, but leave text entry alone.
  style.textContent = dataUrl
    ? `html, html *:not(input):not(textarea):not([contenteditable]){cursor:url("${dataUrl}") 16 16, auto !important}`
    : '';
  document.head.appendChild(style);
}

function makeDonutCursorUrl() {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    if (!g) return null;
    g.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('\u{1F369}', 16, 17);
    return c.toDataURL('image/png');
  } catch (e) {
    return null;
  }
}

function makeEl(cls, text) {
  const el = document.createElement('div');
  el.className = cls;
  if (text) el.textContent = text;
  document.body.appendChild(el);
  return el;
}

function spawnSprinkle(x, y, power = 1) {
  const p = pool[poolIdx];
  poolIdx = (poolIdx + 1) % POOL_SIZE; // round-robin: bounded at POOL_SIZE, oldest gets reused
  p.x = x;
  p.y = y;
  p.vx = (Math.random() - 0.5) * 1.6 * power;
  p.vy = (Math.random() - 0.8) * 1.4 * power;
  p.life = p.max = 0.6 + Math.random() * 0.5;
  p.rot = Math.random() * 360;
  p.vr = (Math.random() - 0.5) * 20;
  p.el.style.background = SPRINKLE_COLORS[(Math.random() * SPRINKLE_COLORS.length) | 0];
  p.el.style.opacity = '1';
  kick();
}

function burst(x, y, n) {
  for (let i = 0; i < n; i++) spawnSprinkle(x, y, 2.2);
}

function onMove(e) {
  mx = e.clientX;
  my = e.clientY;
  if (!hasPointer) {
    hasPointer = true;
    decoyX = mx; decoyY = my;
  }
  const now = performance.now();
  const dx = mx - lastSpawnX, dy = my - lastSpawnY;
  if (dx * dx + dy * dy > 36 && now - lastSpawnT > 25) {
    spawnSprinkle(mx, my);
    lastSpawnX = mx; lastSpawnY = my; lastSpawnT = now;
  }
  if (decoy && chaos >= 1) decoy.style.opacity = '1';
  kick();
}

function kick() {
  if (!running) {
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(frame);
  }
}

let lastT = 0;

function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  const f = dt * 60; // frame-scale factor

  // sprinkles
  let anyActive = false;
  for (let i = 0; i < POOL_SIZE; i++) {
    const p = pool[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.el.style.opacity = '0';
      continue;
    }
    anyActive = true;
    p.vy += GRAVITY * f;
    p.x += p.vx * f;
    p.y += p.vy * f;
    p.rot += p.vr * f;
    p.el.style.transform = `translate3d(${p.x}px,${p.y}px,0) rotate(${p.rot}deg)`;
    p.el.style.opacity = String(Math.max(0, p.life / p.max));
  }

  // jitter decoy: shakes around the real pointer, amplitude grows with chaos
  let decoyOn = decoy && chaos >= 1 && hasPointer;
  if (decoyOn) {
    const amp = Math.min(34, 4 + (chaos - 1) * 9);
    const tx = mx + (Math.random() - 0.5) * 2 * amp + 14;
    const ty = my + (Math.random() - 0.5) * 2 * amp + 10;
    decoyX += (tx - decoyX) * 0.35;
    decoyY += (ty - decoyY) * 0.35;
    decoy.style.transform = `translate3d(${decoyX}px,${decoyY}px,0)`;
  } else if (decoy && decoy.style.opacity !== '0') {
    decoy.style.opacity = '0';
  }

  // wandering fake cursor
  let fakeOn = false;
  if (fakeState) {
    const s = fakeState;
    if (t > s.endT) {
      fake.style.opacity = '0';
      fakeState = null;
    } else {
      if (t > s.nextWp) {
        s.tx = Math.random() * window.innerWidth;
        s.ty = Math.random() * window.innerHeight;
        s.nextWp = t + 500 + Math.random() * 700;
      }
      s.x += (s.tx - s.x) * 0.04 * f;
      s.y += (s.ty - s.y) * 0.04 * f;
      fake.style.transform = `translate3d(${s.x}px,${s.y}px,0)`;
      fakeOn = true;
    }
  }

  if (anyActive || decoyOn || fakeOn || (decoy && decoy.style.opacity === '1' && decoyOn)) {
    rafId = requestAnimationFrame(frame);
  } else {
    running = false;
  }
}

function maybeSpawnFake() {
  if (!fake || fakeState || chaos < 1 || !hasPointer) return;
  if (Math.random() > 0.25) return;
  const x = Math.random() * window.innerWidth;
  const y = Math.random() * window.innerHeight;
  const now = performance.now();
  fakeState = { x, y, tx: x, ty: y, nextWp: now, endT: now + 3000 + Math.random() * 2000 };
  fake.style.opacity = '0.9';
  kick();
}

export function init(ctx) {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (!window.matchMedia('(pointer: fine)').matches) return; // touch / coarse: skip
  } catch (e) {
    return;
  }

  try {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  } catch (e) { /* styling is cosmetic */ }

  const url = makeDonutCursorUrl();
  if (url) setCursorStyle(url); // else: browser default cursor stays

  for (let i = 0; i < POOL_SIZE; i++) {
    const el = makeEl('dc-spr');
    pool.push({ el, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, rot: 0, vr: 0 });
  }
  decoy = makeEl('dc-decoy', '\u{1F369}');
  fake = makeEl('dc-fake', '\u{1F369}');

  try { chaos = Number(ctx && ctx.getChaos ? ctx.getChaos() : 0) || 0; } catch (e) { chaos = 0; }

  document.addEventListener('mousemove', onMove, { passive: true });
  document.addEventListener('dc:chaos', (e) => {
    chaos = Number(e.detail && e.detail.level) || 0;
    if (decoy && chaos < 1) decoy.style.opacity = '0';
  });
  document.addEventListener('dc:click', (e) => {
    const d = e.detail || {};
    if (typeof d.x === 'number') burst(d.x, d.y, 8);
  });

  fakeTimer = setInterval(maybeSpawnFake, 4000);
}

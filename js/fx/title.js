// Tab title marquee + animated donut favicon + begging when hidden.
// Decorative only: no DOM overlay, nothing clickable.

const TITLE_TICK_MS = 200;
const ICON_TICK_MS = 125; // 8 fps
const BEG_CYCLE_MS = 1600;
const WINDOW = 30; // visible title length in code points
const PHRASES = ['BÄNG', 'KRACH', 'WUSCH', 'SPRITZ', 'MEGA-GLAZUR', 'ZACK', 'BOOM'];
const BEGS = [
  'Komm zurück!! 🍩😭',
  'Die Donuts werden kalt... 🥶',
  'Ich vermisse dich!! 😢',
  'Nur noch einen Klick!! 🍩🙏',
];

// Sprinkles: fixed positions/angles so the donut looks stable while spinning.
const SPRINKLES = [];
for (let i = 0; i < 11; i++) {
  const a = (i / 11) * Math.PI * 2 + (i % 3) * 0.3;
  const r = 14 + ((i * 37) % 7);
  SPRINKLES.push({
    x: Math.cos(a) * r,
    y: Math.sin(a) * r,
    rot: (i * 1.7) % Math.PI,
    color: ['#ffffff', '#3ad1ff', '#ffe03a', '#7dff6a', '#b06bff'][i % 5],
  });
}

let started = false;
let donutCtx = null;
let iconCanvas = null;
let iconCtx = null;
let linkEl = null;
let flashUntil = 0;
let game = null;
let getChaos = () => 0;
let titleOffset = 0;
let lastCount = -1;
let chars = [];
let phraseIdx = 0;

function safe(fn, fallback) {
  try { return fn(); } catch (e) { return fallback; }
}

function fmt(n) {
  return safe(() => Math.floor(n).toLocaleString('de-DE'), String(Math.floor(n)));
}

function donutsNow() {
  return game ? (game.donuts || 0) : 0;
}

// ---- Title -------------------------------------------------------------

function buildMarqueeChars(count, chaos) {
  // Chaos adds more and more explosive phrases between donut count segments.
  const explosive = chaos > 1.5 ? 2 : 1;
  let s = '';
  s += `🍩💥 ${fmt(count)} Donuts 💥 `;
  for (let i = 0; i < explosive; i++) {
    s += `${PHRASES[phraseIdx % PHRASES.length]} 🍩 `;
    phraseIdx++;
  }
  if (chaos > 3) s += '💥💥 ';
  return Array.from(s);
}

function tickTitle() {
  if (document.hidden) return;
  const count = Math.floor(donutsNow());
  const chaos = safe(() => getChaos(), 0) || 0;

  if (count !== lastCount || chars.length === 0 || (chaos > 0 && Math.random() < 0.02)) {
    lastCount = count;
    chars = buildMarqueeChars(count, chaos);
    // Repeat the segment so the window never runs out.
    while (chars.length < 120) chars = chars.concat(buildMarqueeChars(count, chaos));
  }

  // Chaos scales scroll speed: ~0.6 chars/tick calm, ~6 chars/tick at chaos 3+.
  const speed = 0.6 + Math.min(chaos, 4) * 1.4;
  titleOffset = (titleOffset + speed) % chars.length;

  const start = Math.floor(titleOffset);
  let out = '';
  for (let i = 0; i < WINDOW; i++) out += chars[(start + i) % chars.length];
  document.title = out;
}

let begIdx = 0;
function tickBeg() {
  if (!document.hidden) return;
  document.title = BEGS[begIdx % BEGS.length];
  begIdx++;
}

// ---- Favicon -----------------------------------------------------------

function ensureLink() {
  try {
    let el = document.querySelector('link[rel~="icon"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = 'icon';
      document.head.appendChild(el);
    }
    return el;
  } catch (e) {
    return null;
  }
}

function drawDonut(t, flashing) {
  const c = iconCtx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, 64, 64);

  if (flashing) {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 64, 64);
  }

  // Bounce + spin + hue shift.
  const bounce = Math.abs(Math.sin(t / 380)) * -6;
  const angle = t / 900;
  const hue = (t / 40) % 360;
  const glaze = `hsl(${(330 + hue * 0.25) % 360}, 90%, 62%)`;
  const dough = 'hsl(36, 70%, 58%)';

  c.save();
  c.translate(32, 32 + bounce);
  c.rotate(angle);
  c.scale(1 + Math.sin(t / 190) * 0.03, 1); // tiny squash for life

  // Dough ring.
  c.beginPath();
  c.arc(0, 0, 28, 0, Math.PI * 2);
  c.fillStyle = dough;
  c.fill();

  // Pink glaze on top.
  c.beginPath();
  c.arc(0, 0, 24, 0, Math.PI * 2);
  c.fillStyle = glaze;
  c.fill();

  // Hole (cut out).
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(0, 0, 9, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';

  // Sprinkles.
  c.lineCap = 'round';
  c.lineWidth = 2.4;
  for (const s of SPRINKLES) {
    c.strokeStyle = s.color;
    c.beginPath();
    const dx = Math.cos(s.rot) * 2.5;
    const dy = Math.sin(s.rot) * 2.5;
    c.moveTo(s.x - dx, s.y - dy);
    c.lineTo(s.x + dx, s.y + dy);
    c.stroke();
  }
  c.restore();
}

function tickIcon() {
  if (!iconCtx) return;
  const t = performance.now();
  drawDonut(t, t < flashUntil);
  try {
    if (!linkEl || !linkEl.isConnected) linkEl = ensureLink();
    if (linkEl) linkEl.href = iconCanvas.toDataURL('image/png');
  } catch (e) { /* ignore */ }
}

// ---- Init --------------------------------------------------------------

export function init(ctx) {
  if (started) return;
  started = true;
  game = ctx.game;
  if (typeof ctx.getChaos === 'function') getChaos = ctx.getChaos;

  safe(() => {
    iconCanvas = document.createElement('canvas');
    iconCanvas.width = 64;
    iconCanvas.height = 64;
    iconCtx = iconCanvas.getContext('2d');
  });

  document.addEventListener('dc:flashbang', () => {
    flashUntil = performance.now() + 350;
  });

  setInterval(tickTitle, TITLE_TICK_MS);
  setInterval(tickBeg, BEG_CYCLE_MS);
  setInterval(tickIcon, ICON_TICK_MS);
  tickIcon();
}

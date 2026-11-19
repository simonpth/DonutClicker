// Haptic feedback via navigator.vibrate. Feature-detected, rate-limited, fails silently.

const MIN_GAP_MS = 150;
const IDLE_INTERVAL_MS = 4000;

const SUPPORTED = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const PATTERN_BUY = [20, 40, 20];
const PATTERN_MILESTONE = [0, 80, 40, 80, 40, 200, 60, 40, 60, 40, 300];
const PATTERN_IDLE = [60, 50, 60, 50, 120];

let lastBuzz = 0;
let chaos = 0;
let idleTimer = null;

function buzz(pattern) {
  if (!SUPPORTED) return false;
  const now = performance.now();
  if (now - lastBuzz < MIN_GAP_MS) return false;
  lastBuzz = now;
  try {
    return navigator.vibrate(pattern);
  } catch (e) {
    return false;
  }
}

function clamp01(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function idleTick() {
  if (!SUPPORTED || document.hidden || chaos <= 0) return;
  // Rare: roughly 3% per tick per chaos level, capped at 25%.
  const chance = Math.min(0.25, 0.03 * chaos);
  if (Math.random() < chance) buzz(PATTERN_IDLE);
}

export function init(ctx) {
  if (!SUPPORTED) return;

  try {
    if (typeof ctx.getChaos === 'function') chaos = Number(ctx.getChaos()) || 0;
  } catch (e) { /* ignore */ }

  document.addEventListener('dc:click', () => buzz(8));

  document.addEventListener('dc:flashbang', (e) => {
    const s = clamp01(e.detail && e.detail.strength);
    buzz(Math.round(150 + 850 * s));
  });

  document.addEventListener('dc:chaos', (e) => {
    chaos = Number(e.detail && e.detail.level) || 0;
  });

  const game = ctx.game;
  if (game && typeof game.on === 'function') {
    game.on('buy', () => buzz(PATTERN_BUY));
    game.on('milestone', () => buzz(PATTERN_MILESTONE));
  }

  if (idleTimer === null) {
    idleTimer = setInterval(idleTick, IDLE_INTERVAL_MS);
  }
}

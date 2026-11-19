import { Game, BUILDINGS, UPGRADES } from './game.js';
import { DonutScene } from './scene.js';
import { UI, formatNumber } from './ui.js';
import { Sfx } from './audio.js';

const game = new Game();
const scene = new DonutScene(document.getElementById('scene'));
const ui = new UI(game);
const sfx = new Sfx();

// Browsers only allow audio after a user gesture: unlock + start music on first tap anywhere
document.addEventListener('pointerdown', () => {
  sfx.unlock();
  sfx.startMusic();
}, { once: true });

const btnMute = document.getElementById('btn-mute');
const syncMuteButton = () => {
  btnMute.textContent = sfx.muted ? '🔇 Ton aus' : '🔊 Ton an';
};
btnMute.addEventListener('click', () => {
  sfx.toggleMute();
  syncMuteButton();
});
syncMuteButton();

// ---------- Flash-Bangs ----------
// Single entry point: the UI rate limit (3/s) decides whether the effect plays at all.
function bang(strength = 1) {
  if (!ui.flashbang(strength)) return;
  sfx.flashbang();
  scene.flashbang?.(strength);
  document.dispatchEvent(new CustomEvent('dc:flashbang', { detail: { strength } }));
}

// Random flash-bangs while idle: rare at chaos 0 (~1/60 per s), ~every 3 s at chaos 3
function idleBangLoop() {
  const c = Math.min(chaos, 3);
  const p = (1 / 60) * Math.pow(20, c / 3);
  if (Math.random() < p) bang(1);
}
setInterval(idleBangLoop, 1000);

// ---------- Chaos ----------
// chaos = Σ_i log2(1 + count_i) * (1 + i*0.6) / 12  (grows with every building bought)
let chaos = 0;
let chaosLevelSeen = null;
function computeChaos() {
  let sum = 0;
  BUILDINGS.forEach((b, i) => {
    sum += Math.log2(1 + (game.owned[b.id] || 0)) * (1 + i * 0.6);
  });
  return sum / 12;
}
function applyChaos() {
  chaos = computeChaos();
  scene.setChaos?.(chaos);
  ui.setChaos(chaos);
  document.dispatchEvent(new CustomEvent('dc:chaos', { detail: { level: chaos } }));
  const lvl = Math.floor(chaos);
  if (chaosLevelSeen !== null && lvl > chaosLevelSeen) bang(2);
  chaosLevelSeen = lvl;
}

// Random extra explosion / boing sounds, more often at higher chaos
function chaosSfxLoop() {
  if (Math.random() < Math.min(0.9, 0.2 * (1 + chaos))) sfx.explosion();
  if (Math.random() < Math.min(0.6, 0.1 * (1 + chaos))) sfx.boing();
  setTimeout(chaosSfxLoop, 300);
}
chaosSfxLoop();

// ---------- Load ----------
const offline = game.load();
for (const b of BUILDINGS) {
  scene.setBuildingCount(b.id, game.owned[b.id] || 0);
}
applyChaos();
ui.render();
if (offline > 0) {
  setTimeout(() => {
    ui.toast(`🌙 Willkommen zurück! Im Schlaf verdient: ${formatNumber(offline)} Donuts`);
    bang(1);
  }, 800);
}

// ---------- Events ----------
scene.onDonutClick((x, y) => {
  const gained = game.click();
  sfx.click();
  scene.clickFx(x, y);
  ui.floatText(x, y, `+${formatNumber(gained)}`);
  document.dispatchEvent(new CustomEvent('dc:click', { detail: { x, y, amount: gained } }));
  if (game.clicks % 25 === 0) bang(1);
});

game.on('buy', (id, count) => {
  const b = BUILDINGS.find((x) => x.id === id);
  scene.setBuildingCount(id, count);
  scene.buyFx(id);
  sfx.buy();
  ui.toast(`🎉 ${b ? b.name : id} gekauft! Jetzt ${count}×`);
  bang(1);
  applyChaos();
});

game.on('upgrade', (id) => {
  const u = UPGRADES.find((x) => x.id === id);
  scene.upgradeFx();
  sfx.upgrade();
  ui.toast(`⬆️ Upgrade: ${u ? u.emoji + ' ' + u.name : id}!`);
  bang(1);
});

game.on('milestone', (n) => {
  scene.milestoneFx();
  sfx.milestone();
  ui.toast(`🏆 ${formatNumber(n)} Donuts erreicht!!!`);
  bang(2);
});

document.addEventListener('dc:reset', () => {
  for (const b of BUILDINGS) scene.setBuildingCount(b.id, 0);
  applyChaos();
  bang(1);
});

// ---------- Golden donut ----------
function scheduleGolden() {
  const delay = 60000 + Math.random() * 120000; // 60–180 s
  setTimeout(() => {
    scene.spawnGolden((x, y) => {
      sfx.golden();
      const reward = Math.max(game.donuts * 0.13, game.getDps() * 60);
      game.addDonuts(reward);
      ui.floatText(x, y, `✨ +${formatNumber(reward)}`);
      ui.toast(`✨ Goldener Donut eingefangen! Bonus: ${formatNumber(reward)} Donuts`);
      bang(2);
    });
    scheduleGolden();
  }, delay);
}
scheduleGolden();

// ---------- Main loop ----------
let last = performance.now();
let uiAcc = 0;
let lastChunkBang = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  const before = game.totalDonuts;
  game.tick(dt);
  // Every 100th donut gained (a gain that crosses a multiple of 100 in one frame)
  // (throttled to once per 8 s, otherwise high DPS would keep the screen permanently white)
  if (game.totalDonuts > before && Math.floor(game.totalDonuts / 100) > Math.floor(before / 100)
      && now - lastChunkBang > 8000) { lastChunkBang = now; bang(1); }
  scene.setDps(game.getDps());
  uiAcc += dt;
  if (uiAcc >= 0.1) {
    uiAcc = 0;
    ui.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Autosave ----------
setInterval(() => game.save(), 30000);
window.addEventListener('beforeunload', () => game.save());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') game.save();
});

// ---------- Extra FX modules (each isolated: a broken module never breaks the game) ----------
const fxCtx = { game, scene, ui, sfx, getChaos: () => chaos, bang };
const isBot = /bot|crawl|spider|slurp|lighthouse|headless/i.test(navigator.userAgent);
for (const name of [...(isBot ? [] : ['title']), 'cursor', 'vibrate', 'announcer', 'music', 'flee', 'glitch', 'achievements', 'boss']) {
  import(`./fx/${name}.js`)
    .then((m) => m.init?.(fxCtx))
    .catch((err) => console.warn(`FX-Modul ${name} nicht geladen:`, err));
}

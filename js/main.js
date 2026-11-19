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

// ---------- Chaos ----------
// chaos = Σ_i log2(1 + count_i) * (1 + i*0.6) / 12  (grows with every building bought)
let chaos = 0;
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
  setTimeout(() => ui.toast(`🌙 Willkommen zurück! Im Schlaf verdient: ${formatNumber(offline)} Donuts`), 800);
}

// ---------- Events ----------
scene.onDonutClick((x, y) => {
  const gained = game.click();
  sfx.click();
  scene.clickFx(x, y);
  ui.floatText(x, y, `+${formatNumber(gained)}`);
});

game.on('buy', (id, count) => {
  const b = BUILDINGS.find((x) => x.id === id);
  scene.setBuildingCount(id, count);
  scene.buyFx(id);
  sfx.buy();
  ui.toast(`🎉 ${b ? b.name : id} gekauft! Jetzt ${count}×`);
  applyChaos();
});

game.on('upgrade', (id) => {
  const u = UPGRADES.find((x) => x.id === id);
  scene.upgradeFx();
  sfx.upgrade();
  ui.toast(`⬆️ Upgrade: ${u ? u.emoji + ' ' + u.name : id}!`);
});

game.on('milestone', (n) => {
  scene.milestoneFx();
  sfx.milestone();
  ui.toast(`🏆 ${formatNumber(n)} Donuts erreicht!!!`);
});

document.addEventListener('dc:reset', () => {
  for (const b of BUILDINGS) scene.setBuildingCount(b.id, 0);
  applyChaos();
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
    });
    scheduleGolden();
  }, delay);
}
scheduleGolden();

// ---------- Main loop ----------
let last = performance.now();
let uiAcc = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  game.tick(dt);
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

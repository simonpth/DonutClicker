// FX: Erfolge (Achievements). Persisted as an array of ids in localStorage 'donutclicker-achievements'.
import { BUILDINGS } from '../game.js';

const STORE_KEY = 'donutclicker-achievements';
const FLASH_KEY = 'dc:flashbang';
const CHECK_MS = 1000;
const BURST_WINDOW_MS = 5000;
const MINUTE_10 = 10 * 60 * 1000;
const LOCKED = '???';

// test(s): s is a state snapshot built in check()
const ACHIEVEMENTS = [
  { id: 'first_click', emoji: '🍩', name: 'Erster Biss', desc: 'Den ersten Donut geklickt.', test: (s) => s.clicks >= 1 },
  { id: 'clicks_100', emoji: '👆', name: 'Fingerübung', desc: '100 Mal geklickt.', test: (s) => s.clicks >= 100 },
  { id: 'clicks_1000', emoji: '🤏', name: 'Daumenkrampf', desc: '1.000 Mal geklickt.', test: (s) => s.clicks >= 1000 },
  { id: 'clicks_10000', emoji: '🦴', name: 'Physiotherapie-Kandidat', desc: '10.000 Mal geklickt.', test: (s) => s.clicks >= 10000 },
  { id: 'burst_20', emoji: '⚙️', name: 'Klick-Maschine', desc: '20 Klicks in 5 Sekunden.', test: (s) => s.burst >= 20 },
  { id: 'flash_1', emoji: '⚡', name: 'Blitztaufe', desc: '1 Flash-Bang überlebt.', test: (s) => s.flashes >= 1 },
  { id: 'flash_10', emoji: '🌩️', name: 'Gewitterfest', desc: '10 Flash-Bangs überlebt.', test: (s) => s.flashes >= 10 },
  { id: 'flash_100', emoji: '🔌', name: 'Blitzableiter', desc: '100 Flash-Bangs überlebt.', test: (s) => s.flashes >= 100 },
  { id: 'flash_1000', emoji: '👁️', name: 'Netzhaut? Was ist das?', desc: '1.000 Flash-Bangs überlebt.', test: (s) => s.flashes >= 1000 },
  { id: 'chaos_1', emoji: '🌀', name: 'Chaos-Anfänger', desc: 'Chaos-Level 1 erreicht.', test: (s) => s.chaos >= 1 },
  { id: 'chaos_2', emoji: '🌪️', name: 'Chaos-Lehrling', desc: 'Chaos-Level 2 erreicht.', test: (s) => s.chaos >= 2 },
  { id: 'chaos_3', emoji: '💥', name: 'Chaos-Meister', desc: 'Chaos-Level 3 erreicht.', test: (s) => s.chaos >= 3 },
  { id: 'chaos_4', emoji: '🔥', name: 'Chaos-Großmeister', desc: 'Chaos-Level 4 erreicht.', test: (s) => s.chaos >= 4 },
  { id: 'chaos_5', emoji: '👹', name: 'Das Chaos hat dich', desc: 'Chaos-Level 5 erreicht.', test: (s) => s.chaos >= 5 },
  { id: 'sound_chaos_3', emoji: '🔊', name: 'Ton an bei Chaos 3', desc: 'Ton eingeschaltet bei Chaos-Level 3.', test: (s) => s.chaos >= 3 && !s.muted },
  { id: 'watch_10min', emoji: '👀', name: '10 Minuten nicht weggeschaut', desc: 'Tab 10 Minuten am Stück im Vordergrund.', test: (s) => s.visibleMs >= MINUTE_10 },
  { id: 'night_3am', emoji: '🌙', name: 'Nachtschicht um 3', desc: 'Um 3 Uhr nachts gespielt.', test: (s) => s.hour === 3 },
  { id: 'first_building', emoji: '🧑‍🍳', name: 'Erster Angestellter', desc: 'Das erste Gebäude gekauft.', test: (s) => s.buildings >= 1 },
  { id: 'buildings_100', emoji: '🏭', name: 'Hundertschaft', desc: '100 Gebäude insgesamt besessen.', test: (s) => s.buildings >= 100 },
  { id: 'all_buildings', emoji: '🛒', name: 'Vollsortiment', desc: 'Von jedem Gebäude mindestens eines besessen.', test: (s) => s.allOwned },
  { id: 'upgrade_1', emoji: '🧠', name: 'Klüger einkaufen', desc: 'Das erste Upgrade gekauft.', test: (s) => s.upgrades >= 1 },
  { id: 'baker_12', emoji: '👨‍🍳', name: 'Dutzend-Bäcker', desc: '12 Bäcker angestellt.', test: (s) => s.owned.baker >= 12 },
  { id: 'planet_1', emoji: '🪐', name: 'Planetarisch', desc: 'Einen Planeten aus Donuts besessen.', test: (s) => s.owned.planet >= 1 },
  { id: 'donuts_1k', emoji: '🕳️', name: 'Tausend Löcher', desc: '1.000 Donuts insgesamt.', test: (s) => s.total >= 1e3 },
  { id: 'donuts_1m', emoji: '💰', name: 'Millionen-Loch', desc: '1 Million Donuts insgesamt.', test: (s) => s.total >= 1e6 },
  { id: 'donuts_1b', emoji: '💎', name: 'Milliardär der Löcher', desc: '1 Milliarde Donuts insgesamt.', test: (s) => s.total >= 1e9 },
  { id: 'donuts_1t', emoji: '👑', name: 'Donut-Gott', desc: '1 Billion Donuts insgesamt.', test: (s) => s.total >= 1e12 },
];

const CSS = `
.fx-ach-btn{position:fixed;left:12px;bottom:12px;z-index:9000;pointer-events:auto;width:48px;height:48px;border-radius:50%;border:2px solid #d4a017;background:#2a1d0c;color:#fff;font-size:24px;line-height:44px;padding:0;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4);}
.fx-ach-overlay{position:fixed;inset:0;z-index:9300;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.6);pointer-events:auto;}
.fx-ach-overlay.open{display:flex;}
.fx-ach-box{background:#fff8e7;color:#3b2a10;border-radius:14px;max-width:420px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.5);}
.fx-ach-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e6d7b0;font:700 17px system-ui,sans-serif;}
.fx-ach-close{background:none;border:0;font-size:22px;cursor:pointer;color:#3b2a10;}
.fx-ach-list{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 16px 14px;}
.fx-ach-row{display:flex;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #efe3c4;font:14px/1.3 system-ui,sans-serif;}
.fx-ach-row.locked{opacity:.55;}
.fx-ach-icon{font-size:26px;width:34px;text-align:center;flex:none;}
.fx-ach-text{flex:1;min-width:0;}
.fx-ach-name{font-weight:700;}
.fx-ach-desc{font-size:12px;opacity:.75;}
.fx-ach-check{color:#2e8b3a;font-weight:700;flex:none;}
.fx-ach-banner{position:fixed;top:12%;left:50%;z-index:9200;pointer-events:none;max-width:90vw;padding:14px 22px;border-radius:16px;background:linear-gradient(90deg,#b8860b,#ffd700,#b8860b);color:#2a1a00;font:700 18px/1.25 system-ui,sans-serif;text-align:center;box-shadow:0 0 30px rgba(255,215,0,.85);transform:translate(-50%,-160%);animation:fx-ach-slide 4s ease both;}
.fx-ach-banner small{display:block;font-size:13px;font-weight:600;opacity:.85;margin-top:4px;}
.fx-ach-trophy{font-size:40px;display:block;line-height:1.1;}
@keyframes fx-ach-slide{0%{transform:translate(-50%,-160%);}12%{transform:translate(-50%,0);}85%{transform:translate(-50%,0);opacity:1;}100%{transform:translate(-50%,-160%);opacity:0;}}
.fx-ach-conf{position:fixed;left:50%;top:40%;width:9px;height:13px;z-index:9150;pointer-events:none;border-radius:2px;animation:fx-ach-burst var(--dur) cubic-bezier(.15,.7,.3,1) forwards;}
@keyframes fx-ach-burst{0%{transform:translate(0,0) rotate(0deg);opacity:1;}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:0;}}
`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

export function init(ctx) {
  const { game, sfx, ui } = ctx;

  // ----- persisted state -----
  const unlocked = new Set(readJSON(STORE_KEY, []).filter((id) => typeof id === 'string'));
  let flashes = Number(readJSON(FLASH_KEY, 0)) || 0;
  const saveFlashes = () => {
    try {
      localStorage.setItem(FLASH_KEY, String(flashes));
    } catch {
      /* ignore */
    }
  };

  // ----- in-memory state -----
  const clickTimes = [];
  let visibleMs = 0;
  let lastTick = Date.now();
  const pending = [];

  // ----- CSS -----
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ----- UI: button + modal -----
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fx-ach-btn';
  btn.textContent = '🏆';
  btn.setAttribute('aria-label', 'Erfolge anzeigen');
  btn.title = 'Erfolge';

  const overlay = document.createElement('div');
  overlay.className = 'fx-ach-overlay';
  overlay.innerHTML = `
    <div class="fx-ach-box" role="dialog" aria-modal="true" aria-labelledby="fx-ach-title">
      <div class="fx-ach-head">
        <span id="fx-ach-title"></span>
        <button type="button" class="fx-ach-close" aria-label="Schließen">✕</button>
      </div>
      <div class="fx-ach-list"></div>
    </div>`;
  const titleEl = overlay.querySelector('#fx-ach-title');
  const listEl = overlay.querySelector('.fx-ach-list');

  const renderList = () => {
    titleEl.textContent = `🏆 Erfolge ${unlocked.size} / ${ACHIEVEMENTS.length}`;
    listEl.textContent = '';
    for (const a of ACHIEVEMENTS) {
      const isOpen = unlocked.has(a.id);
      const row = document.createElement('div');
      row.className = 'fx-ach-row' + (isOpen ? '' : ' locked');

      const icon = document.createElement('div');
      icon.className = 'fx-ach-icon';
      icon.textContent = isOpen ? a.emoji : '❔';

      const text = document.createElement('div');
      text.className = 'fx-ach-text';
      const name = document.createElement('div');
      name.className = 'fx-ach-name';
      name.textContent = isOpen ? a.name : LOCKED;
      const desc = document.createElement('div');
      desc.className = 'fx-ach-desc';
      desc.textContent = isOpen ? a.desc : LOCKED;
      text.append(name, desc);

      const check = document.createElement('div');
      check.className = 'fx-ach-check';
      check.textContent = isOpen ? '✔' : '';

      row.append(icon, text, check);
      listEl.appendChild(row);
    }
  };

  const closeModal = () => overlay.classList.remove('open');
  btn.addEventListener('click', () => {
    renderList();
    overlay.classList.add('open');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  overlay.querySelector('.fx-ach-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  document.body.append(btn, overlay);

  // ----- unlock effects -----
  function confetti() {
    const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#ffe066', '#f39c12', '#ffffff'];
    const frag = document.createDocumentFragment();
    const pieces = [];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement('div');
      p.className = 'fx-ach-conf';
      const ang = Math.random() * Math.PI * 2;
      const dist = 120 + Math.random() * 260;
      p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(ang) * dist + 120}px`);
      p.style.setProperty('--rot', `${(Math.random() * 720 - 360).toFixed(0)}deg`);
      p.style.setProperty('--dur', `${(1.6 + Math.random() * 0.9).toFixed(2)}s`);
      p.style.background = colors[i % colors.length];
      frag.appendChild(p);
      pieces.push(p);
    }
    document.body.appendChild(frag);
    setTimeout(() => pieces.forEach((p) => p.remove()), 3000);
  }

  function banner(a) {
    const el = document.createElement('div');
    el.className = 'fx-ach-banner';
    const trophy = document.createElement('span');
    trophy.className = 'fx-ach-trophy';
    trophy.textContent = '🏆';
    const label = document.createElement('div');
    label.textContent = `Erfolg freigeschaltet: ${a.emoji} ${a.name}`;
    const sub = document.createElement('small');
    sub.textContent = a.desc;
    el.append(trophy, label, sub);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4100);
  }

  function unlock(a) {
    unlocked.add(a.id);
    writeJSON(STORE_KEY, [...unlocked]);
    banner(a);
    confetti();
    try { ctx.bang(1.5); } catch { /* no-op */ }
    try { sfx.buy(); } catch { /* ignore */ }
    try { ui.toast(`🏆 Erfolg: ${a.name}`); } catch { /* ignore */ }
  }

  // ----- checking -----
  const buildingCount = () => {
    let n = 0;
    for (const b of BUILDINGS) n += game.owned[b.id] || 0;
    return n;
  };
  const allOwned = () => BUILDINGS.every((b) => (game.owned[b.id] || 0) >= 1);

  function check() {
    const now = Date.now();
    const dt = Math.min(now - lastTick, 2000); // cap so sleep/throttling does not count
    lastTick = now;
    if (document.visibilityState === 'visible') visibleMs += dt;
    else visibleMs = 0;

    while (clickTimes.length && now - clickTimes[0] > BURST_WINDOW_MS) clickTimes.shift();

    if (unlocked.size >= ACHIEVEMENTS.length) return;

    let chaos = 0;
    try { chaos = Math.floor(ctx.getChaos() || 0); } catch { /* ignore */ }

    const s = {
      clicks: game.clicks,
      total: game.totalDonuts,
      flashes,
      chaos,
      muted: sfx.muted,
      burst: clickTimes.length,
      visibleMs,
      hour: new Date().getHours(),
      buildings: buildingCount(),
      allOwned: allOwned(),
      upgrades: game.boughtUpgrades ? game.boughtUpgrades.size : 0,
      owned: game.owned,
    };

    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id)) continue;
      let ok = false;
      try { ok = a.test(s); } catch { ok = false; }
      if (ok) pending.push(a);
    }
    // Unlock one at a time so effects do not pile up in a single frame
    while (pending.length) unlock(pending.shift());
  }

  // ----- events -----
  document.addEventListener('dc:click', () => {
    clickTimes.push(Date.now());
    check();
  });
  document.addEventListener('dc:flashbang', () => {
    flashes += 1;
    saveFlashes();
    check();
  });
  document.addEventListener('dc:chaos', () => check());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') visibleMs = 0;
    lastTick = Date.now();
  });
  game.on('change', () => check());
  game.on('buy', () => check());
  game.on('upgrade', () => check());

  setInterval(check, CHECK_MS);
  check();
}

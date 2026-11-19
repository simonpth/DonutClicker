import { BUILDINGS, UPGRADES } from './game.js';

const UNITS = ['', 'Tsd', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trd', 'Quadr'];
const COLORS = ['#ff6ad5', '#ffd166', '#06d6a0', '#4cc9f0', '#9b5de5', '#ff924c', '#ffffff'];
const NEWS = [
  'Lokale Bäckerin entdeckt Loch im Donut: "Das ist Kunst!"',
  'Wissenschaftler bestätigen: Donuts bestehen zu 73 % aus Glasur-Träumen',
  'Stau auf der A7 wegen Donut-Transporter – Fahrer weigert sich, Ladung zu teilen',
  'Experten warnen: Wer zu viel klickt, bekommt Donut-Finger',
  'Neue Studie: Streusel machen glücklicher als Geld',
  'Bürgermeister fordert Donut-Pflicht in allen Amtsstuben',
  'Hund stiehlt Donut, bekommt eigene Fernsehsendung',
  'Donut-Planet gesichtet? Astronomen rätseln über das Loch in der Mitte',
  'Glasur-Mine wirft Rekordgewinn ab – Zahnärzte jubeln nicht',
  'Breaking: Der Donut ist offiziell das runde Lieblingsgebäck des Universums',
];
const CHAOS_TOASTS = {
  1: 'Chaos-Stufe 1 erreicht! Der Donut zittert verdächtig.',
  2: 'Chaos-Stufe 2 erreicht! Die Physik gibt auf.',
  3: 'Chaos-Stufe 3 erreicht! Die Schwerkraft hat gekündigt.',
  4: 'Chaos-Stufe 4 erreicht! Die Donuts haben die Kontrolle übernommen.',
};
const CHAOS_EMOJI = ['💥', '🍩', '✨', '🎉', '🌈', '🍭', '⭐', '🎊', '🔥', '🍬'];

const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));
const $ = (sel) => document.querySelector(sel);
const rnd = (a, b) => a + Math.random() * (b - a);

/** 1234 -> "1,23 Tsd", 1.2e6 -> "1,2 Mio", 3.4e9 -> "3,4 Mrd" */
export function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  n = Math.abs(n);
  let s;
  if (n < 1000) {
    s = n < 10 ? String(Math.round(n * 10) / 10) : String(Math.floor(n));
  } else {
    const exp = Math.floor(Math.log10(n) / 3);
    if (exp >= UNITS.length) {
      s = n.toExponential(2);
    } else {
      const v = Number((n / 1000 ** exp).toPrecision(3));
      s = `${v} ${UNITS[exp]}`;
    }
  }
  return (neg ? '-' : '') + s.replace('.', ',');
}

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      root: $('#ui-root'),
      counter: $('#counter'),
      perSec: $('#per-sec'),
      statClicks: $('#stat-clicks'),
      statTotal: $('#stat-total'),
      statPower: $('#stat-power'),
      buildings: $('#buildings'),
      upgrades: $('#upgrades'),
      floatLayer: $('#float-layer'),
      particleLayer: $('#particle-layer'),
      toastLayer: $('#toast-layer'),
      ticker: $('#ticker-track'),
      shop: $('#shop'),
      shopToggle: $('#shop-toggle'),
      btnSave: $('#btn-save'),
      btnReset: $('#btn-reset'),
    };
    this.rows = new Map();
    this.upgradeKey = null;
    this.chaos = 0;
    this.chaosLevel = null; // null until the first setChaos() call (no toasts for the initial state)
    this.tip = document.createElement('div');
    this.tip.id = 'tooltip';
    document.body.appendChild(this.tip);

    this.buildShop();
    this.buildTicker();
    this.bindButtons();
    this.render();
    this.startChaos();
  }

  /**
   * Sets the chaos level (see main.js). Drives CSS --chaos and the intensity of
   * the effects below; toasts once for every integer level crossed upwards.
   */
  setChaos(level) {
    const c = Math.max(0, Number(level) || 0);
    this.chaos = c;
    document.documentElement.style.setProperty('--chaos', c.toFixed(3));

    const lvl = Math.floor(c);
    if (this.chaosLevel === null) {
      this.chaosLevel = lvl;
      return;
    }
    for (let n = this.chaosLevel + 1; n <= lvl; n++) {
      this.toast(CHAOS_TOASTS[n] || `Chaos-Stufe ${n} erreicht! Das Universum bittet um Gnade.`);
    }
    this.chaosLevel = lvl;
  }

  /** Emoji for an explosion: chaos set plus building emojis, weighted by what the player owns. */
  pickChaosEmoji() {
    const owned = this.game.owned;
    const items = CHAOS_EMOJI.map((e) => [e, 2]);
    let total = items.length * 2;
    for (const b of BUILDINGS) {
      const w = Math.min(owned[b.id] || 0, 25);
      if (w > 0) {
        items.push([b.emoji, w]);
        total += w;
      }
    }
    let r = Math.random() * total;
    for (const [e, w] of items) {
      if ((r -= w) < 0) return e;
    }
    return '💥';
  }

  spawnParticle(cx, cy) {
    const k = 1 + this.chaos * 0.3; // bigger flight distance at higher chaos
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = this.pickChaosEmoji();
    p.style.left = `${(cx + rnd(-40, 40)).toFixed(0)}px`;
    p.style.top = `${(cy + rnd(-40, 40)).toFixed(0)}px`;
    p.style.fontSize = `${rnd(1.2, 3).toFixed(2)}rem`;
    p.style.setProperty('--dx', `${(rnd(-220, 220) * k).toFixed(0)}px`);
    p.style.setProperty('--dy', `${(rnd(-220, 220) * k).toFixed(0)}px`);
    p.style.setProperty('--spin', `${rnd(-720, 720).toFixed(0)}deg`);
    const layer = this.el.particleLayer;
    layer.appendChild(p);
    while (layer.children.length > 150) layer.firstElementChild.remove();
    setTimeout(() => p.remove(), 1700);
  }

  /** Permanent visual chaos, scaled by this.chaos. Click-through by design (pointer-events: none). */
  startChaos() {
    // Emoji bursts: 300 ms between bursts at chaos 0, ~40 ms at chaos 3 and above
    const burst = () => {
      const cx = rnd(0, window.innerWidth);
      const cy = rnd(0, window.innerHeight);
      const count = 3 + Math.floor(this.chaos * 2);
      for (let i = 0; i < count; i++) this.spawnParticle(cx, cy);
      setTimeout(burst, 300 - (260 / 3) * Math.min(this.chaos, 3));
    };
    burst();

    // Full-screen flash: more frequent with chaos
    const flash = () => {
      const f = $('#flash');
      f.style.background = `hsl(${rnd(0, 360).toFixed(0)} 100% 70%)`;
      this.restart(f, 'go');
      setTimeout(flash, rnd(5000, 12000) / (1 + this.chaos));
    };
    setTimeout(flash, rnd(2000, 5000));

    // Page quake: more frequent with chaos (strength comes from --chaos in CSS)
    const quake = () => {
      this.restart(document.body, 'quake');
      setTimeout(() => document.body.classList.remove('quake'), 700);
      setTimeout(quake, rnd(8000, 18000) / (1 + this.chaos * 0.8));
    };
    setTimeout(quake, rnd(4000, 9000));

    // Whole UI rotates and flips hue (chaos > 1.5, occasionally)
    const spin = () => {
      if (this.chaos > 1.5 && Math.random() < 0.6) {
        this.restart(this.el.root, 'uiSpin');
        setTimeout(() => this.el.root.classList.remove('uiSpin'), 1300);
      }
      setTimeout(spin, rnd(12000, 20000));
    };
    setTimeout(spin, rnd(10000, 15000));

    // Giant "CHAOS" slam (chaos > 2.5, occasionally)
    const slam = () => {
      if (this.chaos > 2.5) this.chaosSlam();
      setTimeout(slam, rnd(15000, 25000));
    };
    setTimeout(slam, rnd(15000, 25000));
  }

  chaosSlam() {
    const s = document.createElement('div');
    s.className = 'chaos-slam';
    s.textContent = '💥 CHAOS 💥';
    this.el.root.appendChild(s);
    this.restart(document.body, 'quake');
    setTimeout(() => s.remove(), 1500);
  }

  buildShop() {
    const frag = document.createDocumentFragment();
    for (const b of BUILDINGS) {
      const li = document.createElement('li');
      li.className = 'bld';
      li.innerHTML = `
        <span class="bld-emoji">${b.emoji}</span>
        <div class="bld-info">
          <div class="bld-name">${b.name} <span class="bld-owned"></span></div>
          <div class="bld-desc">${b.desc}</div>
          <div class="bld-dps"></div>
        </div>
        <div class="bld-cost"></div>`;
      li.addEventListener('click', () => {
        if (!this.game.buy(b.id)) this.shake(li);
        this.render();
      });
      this.rows.set(b.id, {
        li,
        owned: li.querySelector('.bld-owned'),
        dps: li.querySelector('.bld-dps'),
        cost: li.querySelector('.bld-cost'),
        lastOwned: 0,
      });
      frag.appendChild(li);
    }
    this.el.buildings.appendChild(frag);
  }

  buildTicker() {
    const text = NEWS.join('   ✦   ') + '   ✦   ';
    this.el.ticker.textContent = text + text; // doubled for a seamless loop
  }

  bindButtons() {
    this.el.btnSave.addEventListener('click', () => {
      this.game.save();
      this.toast('💾 Gespeichert! Dein Donut-Imperium ist sicher.');
      this.pop(this.el.btnSave);
    });

    this.el.btnReset.addEventListener('click', () => {
      if (!window.confirm('Wirklich ALLES zurücksetzen? Donuts, Gebäude und Upgrades sind dann weg!')) return;
      this.game.reset();
      this.game.save();
      document.dispatchEvent(new CustomEvent('dc:reset'));
      this.upgradeKey = null;
      this.toast('💣 Alles weg! Zeit für Runde zwei.');
      this.render();
    });

    this.el.shopToggle.addEventListener('click', () => {
      const open = this.el.shop.classList.toggle('open');
      this.el.shopToggle.textContent = open ? '▼ Schließen' : '🛒 Shop';
    });
  }

  render() {
    const g = this.game;
    this.el.counter.textContent = formatNumber(g.donuts);
    this.el.perSec.textContent = `${formatNumber(g.getDps())} pro Sekunde`;
    this.el.statClicks.textContent = formatNumber(g.clicks);
    this.el.statTotal.textContent = formatNumber(g.totalDonuts);
    this.el.statPower.textContent = formatNumber(g.getClickPower());

    for (const b of BUILDINGS) {
      const r = this.rows.get(b.id);
      const owned = g.owned[b.id] || 0;
      const cost = g.getCost(b.id);
      r.owned.textContent = `×${owned}`;
      r.dps.textContent = `+${formatNumber(g.getBuildingDps(b.id))} /s pro Stück`;
      r.cost.textContent = `${formatNumber(cost)} 🍩`;
      r.li.classList.toggle('locked', !g.canAfford(cost));
      if (owned > r.lastOwned) this.pop(r.li);
      r.lastOwned = owned;
    }

    this.renderUpgrades();
  }

  renderUpgrades() {
    const g = this.game;
    const list = g.availableUpgrades();
    const key = list.map((u) => u.id).join(',');

    if (key === this.upgradeKey) {
      for (const btn of this.el.upgrades.querySelectorAll('.up-btn')) {
        const u = UPGRADE_BY_ID.get(btn.dataset.id);
        btn.classList.toggle('locked', !g.canAfford(u.cost));
      }
      return;
    }

    this.upgradeKey = key;
    this.hideTip();
    this.el.upgrades.innerHTML = '';
    if (!list.length) {
      const span = document.createElement('span');
      span.className = 'up-empty';
      span.textContent = '🔒 Upgrades folgen bald …';
      this.el.upgrades.appendChild(span);
      return;
    }

    for (const u of list) {
      const btn = document.createElement('button');
      btn.className = 'up-btn';
      btn.type = 'button';
      btn.dataset.id = u.id;
      btn.textContent = u.emoji;
      btn.setAttribute('aria-label', u.name);
      btn.classList.toggle('locked', !g.canAfford(u.cost));
      btn.addEventListener('pointerenter', () => this.showTip(btn, u));
      btn.addEventListener('pointerleave', () => this.hideTip());
      btn.addEventListener('click', () => {
        if (g.buyUpgrade(u.id)) {
          this.hideTip();
        } else {
          this.shake(btn);
          this.showTip(btn, u);
        }
        this.upgradeKey = null; // force rebuild on next render
        this.render();
      });
      this.el.upgrades.appendChild(btn);
    }
  }

  showTip(btn, u) {
    this.tip.innerHTML = `<strong>${u.emoji} ${u.name}</strong><br>${u.desc}<br><em>Kosten: ${formatNumber(u.cost)} 🍩</em>`;
    const r = btn.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    const h = this.tip.offsetHeight || 90;
    // Above the button if there is room, otherwise below; always clamped into the viewport
    let y = r.top - h - 10 >= 8 ? r.top - h - 10 : r.bottom + 10;
    y = Math.min(Math.max(y, 8), window.innerHeight - h - 8);
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.classList.add('show');
  }

  hideTip() {
    this.tip.classList.remove('show');
  }

  /** Restarts a CSS animation class on an element. */
  restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // force reflow so the animation runs again
    el.classList.add(cls);
  }

  pop(el) {
    this.restart(el, 'pop');
  }

  shake(el) {
    this.restart(el, 'shake');
    setTimeout(() => el.classList.remove('shake'), 450);
  }

  /** Floating "+N" text at screen coordinates. */
  floatText(x, y, text) {
    const f = document.createElement('div');
    f.className = 'float';
    f.textContent = text;
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    f.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    f.style.fontSize = `${(1 + Math.random() * 0.8).toFixed(2)}em`;
    f.style.setProperty('--rot', `${(Math.random() * 40 - 20).toFixed(1)}deg`);
    this.el.floatLayer.appendChild(f);
    while (this.el.floatLayer.children.length > 60) this.el.floatLayer.firstElementChild.remove();
    setTimeout(() => f.remove(), 1300);
  }

  /** Bouncy toast message at the bottom. */
  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.el.toastLayer.appendChild(t);
    while (this.el.toastLayer.children.length > 4) this.el.toastLayer.firstElementChild.remove();
    setTimeout(() => t.remove(), 3900);
  }
}

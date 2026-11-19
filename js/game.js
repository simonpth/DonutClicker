// Donut Clicker - Spiellogik (keine Abhaengigkeiten, keine DOM-Ausgabe)

export const BUILDINGS = [
  { id: 'cursor', name: 'Finger', emoji: '👆', baseCost: 15, dps: 0.1, desc: 'Klopft unermüdlich auf die Theke. Ein Finger, ein Donut.' },
  { id: 'baker', name: 'Bäcker', emoji: '👨‍🍳', baseCost: 100, dps: 1, desc: 'Knetet mit Schnurrbart und großen Gefühlen.' },
  { id: 'fryer', name: 'Fritteuse', emoji: '🍳', baseCost: 1100, dps: 8, desc: 'Blubbert vor sich hin, bis der Ring golden ist.' },
  { id: 'shop', name: 'Donut-Laden', emoji: '🏪', baseCost: 12000, dps: 47, desc: 'Mit Vitrine, Glocke und sehr viel Zuckerguss.' },
  { id: 'factory', name: 'Fabrik', emoji: '🏭', baseCost: 130000, dps: 260, desc: 'Produziert Donuts schneller, als man sie essen kann.' },
  { id: 'mine', name: 'Glasur-Mine', emoji: '⛏️', baseCost: 1400000, dps: 1400, desc: 'Gräbt tief nach der süßesten Glasur des Universums.' },
  { id: 'portal', name: 'Donut-Portal', emoji: '🌀', baseCost: 20000000, dps: 7800, desc: 'Holt Donuts aus einer Dimension, in der es nur Donuts gibt.' },
  { id: 'planet', name: 'Donut-Planet', emoji: '🪐', baseCost: 330000000, dps: 44000, desc: 'Ein ganzer Planet. Leider mit zu wenig Puderzucker.' },
];

export const UPGRADES = [
  // Klick-Upgrades
  { id: 'streusel', name: 'Extra Streusel', emoji: '🍬', cost: 100, desc: 'Mehr Streusel pro Klick. Knirsch!', type: 'click', target: null, mult: 2, req: { total: 50 } },
  { id: 'doppelglasur', name: 'Doppelte Glasur', emoji: '🍫', cost: 500, desc: 'Zweimal glasieren, zweimal so süß.', type: 'click', target: null, mult: 2, req: { total: 300 } },
  { id: 'zuckerhammer', name: 'Zuckerhammer', emoji: '🔨', cost: 5000, desc: 'Klopft härter als jeder Finger.', type: 'click', target: null, mult: 2, req: { total: 4000 } },
  { id: 'goldene_hand', name: 'Goldene Hand', emoji: '✋', cost: 100000, desc: 'Berührt alles und macht es süßer.', type: 'click', target: null, mult: 3, req: { total: 50000 } },
  { id: 'kosmischer_teig', name: 'Kosmischer Teig', emoji: '🌌', cost: 50000000, desc: 'Der Teig stammt aus einer anderen Galaxie.', type: 'click', target: null, mult: 3, req: { total: 10000000 } },

  // Gebäude-Upgrades
  { id: 'ergo_finger', name: 'Ergonomische Finger', emoji: '🧤', cost: 200, desc: 'Handschuhe für den Finger. Sogar Daumen-Support.', type: 'building', target: 'cursor', mult: 2, req: { building: 'cursor', count: 1 } },
  { id: 'knetmaschine', name: 'Knetmaschine', emoji: '⚙️', cost: 1000, desc: 'Der Bäcker darf jetzt ein Gerät benutzen.', type: 'building', target: 'baker', mult: 2, req: { building: 'baker', count: 1 } },
  { id: 'bio_mehl', name: 'Bio-Mehl', emoji: '🌾', cost: 10000, desc: 'Glücklich geerntetes Mehl. Die Bäcker singen.', type: 'building', target: 'baker', mult: 2, req: { building: 'baker', count: 10 } },
  { id: 'heisses_oel', name: 'Heißeres Öl', emoji: '🔥', cost: 12000, desc: 'Sehr heiß. Sehr gefährlich. Sehr lecker.', type: 'building', target: 'fryer', mult: 2, req: { building: 'fryer', count: 1 } },
  { id: 'doppelfritte', name: 'Doppelfritte', emoji: '♨️', cost: 120000, desc: 'Zwei Fritteusen sind besser als eine.', type: 'building', target: 'fryer', mult: 2, req: { building: 'fryer', count: 10 } },
  { id: 'ladenglocke', name: 'Goldene Ladenglocke', emoji: '🔔', cost: 150000, desc: 'Bimmel! Kundschaft kommt von allein.', type: 'building', target: 'shop', mult: 2, req: { building: 'shop', count: 1 } },
  { id: 'rabattschild', name: 'Rabattschild', emoji: '🏷️', cost: 1500000, desc: 'Zwei Donuts zum Preis von einem. Wirklich.', type: 'building', target: 'shop', mult: 2, req: { building: 'shop', count: 10 } },
  { id: 'fliessband', name: 'Fließband', emoji: '🛤️', cost: 1400000, desc: 'Donuts fahren jetzt in einer Reihe vorbei.', type: 'building', target: 'factory', mult: 2, req: { building: 'factory', count: 1 } },
  { id: 'roboterarme', name: 'Roboterarme', emoji: '🦾', cost: 14000000, desc: 'Sie glasieren schneller, als man zusehen kann.', type: 'building', target: 'factory', mult: 2, req: { building: 'factory', count: 10 } },
  { id: 'tiefbohrer', name: 'Tiefbohrer', emoji: '🪛', cost: 20000000, desc: 'Bohrt bis zum Mittelpunkt der Glasur.', type: 'building', target: 'mine', mult: 2, req: { building: 'mine', count: 1 } },
  { id: 'zeitschleife', name: 'Zeitschleife', emoji: '⏳', cost: 250000000, desc: 'Der Donut wird im Portal zweimal gebacken.', type: 'building', target: 'portal', mult: 2, req: { building: 'portal', count: 1 } },
  { id: 'ringsystem', name: 'Ringsystem', emoji: '💍', cost: 4000000000, desc: 'Der Planet bekommt einen eigenen Donut-Ring.', type: 'building', target: 'planet', mult: 2, req: { building: 'planet', count: 1 } },

  // Globale Upgrades
  { id: 'gluecks_kekse', name: 'Glückliche Kekse', emoji: '🥠', cost: 1000000, desc: 'Die Vorhersage lautet: mehr Donuts.', type: 'global', target: null, mult: 1.5, req: { total: 500000 } },
  { id: 'schoko_sprinkles', name: 'Schoko-Sprinkles', emoji: '🍩', cost: 100000000, desc: 'Sprinkles in allen Farben. Alle Farben.', type: 'global', target: null, mult: 1.5, req: { total: 50000000 } },
  { id: 'donut_kult', name: 'Donut-Kult', emoji: '🙏', cost: 10000000000, desc: 'Die Gemeinde betet jeden Morgen zum Ring.', type: 'global', target: null, mult: 2, req: { total: 1000000000 } },
  { id: 'quanten_glasur', name: 'Quanten-Glasur', emoji: '⚛️', cost: 1000000000000, desc: 'Gleichzeitig glasiert und nicht glasiert.', type: 'global', target: null, mult: 2, req: { total: 100000000000 } },
];

const SAVE_KEY = 'donutclicker-save';
const MAX_OFFLINE_SECONDS = 2 * 60 * 60;

const BUILDING_BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

function emptyOwned() {
  const owned = {};
  for (const b of BUILDINGS) owned[b.id] = 0;
  return owned;
}

export class Game {
  constructor() {
    this.listeners = {};
    this._resetState();
  }

  _resetState() {
    this.donuts = 0;
    this.totalDonuts = 0;
    this.clicks = 0;
    this.owned = emptyOwned();
    this.boughtUpgrades = new Set();
    this.nextMilestone = 100;
  }

  // ---------- Events ----------
  on(event, cb) {
    (this.listeners[event] ||= []).push(cb);
    return () => {
      this.listeners[event] = (this.listeners[event] || []).filter((f) => f !== cb);
    };
  }

  _emit(event, ...args) {
    for (const cb of this.listeners[event] || []) cb(...args);
  }

  _checkMilestones() {
    while (this.totalDonuts >= this.nextMilestone) {
      this._emit('milestone', this.nextMilestone);
      this.nextMilestone *= 10;
    }
  }

  // ---------- Multiplikatoren & Werte ----------
  _buildingMult(id) {
    let m = 1;
    for (const uid of this.boughtUpgrades) {
      const u = UPGRADE_BY_ID.get(uid);
      if (u && u.type === 'building' && u.target === id) m *= u.mult;
    }
    return m;
  }

  _globalMult() {
    let m = 1;
    for (const uid of this.boughtUpgrades) {
      const u = UPGRADE_BY_ID.get(uid);
      if (u && u.type === 'global') m *= u.mult;
    }
    return m;
  }

  _clickMult() {
    let m = 1;
    for (const uid of this.boughtUpgrades) {
      const u = UPGRADE_BY_ID.get(uid);
      if (u && u.type === 'click') m *= u.mult;
    }
    return m;
  }

  getBuildingDps(id) {
    const b = BUILDING_BY_ID.get(id);
    if (!b) return 0;
    return b.dps * this._buildingMult(id) * this._globalMult();
  }

  getDps() {
    let sum = 0;
    for (const b of BUILDINGS) {
      sum += (this.owned[b.id] || 0) * this.getBuildingDps(b.id);
    }
    return sum;
  }

  getClickPower() {
    return (1 + 0.01 * this.getDps()) * this._clickMult();
  }

  getCost(id) {
    const b = BUILDING_BY_ID.get(id);
    if (!b) return Infinity;
    return Math.ceil(b.baseCost * 1.15 ** (this.owned[id] || 0));
  }

  canAfford(cost) {
    return this.donuts >= cost;
  }

  // ---------- Aktionen ----------
  click() {
    const amount = this.getClickPower();
    this.donuts += amount;
    this.totalDonuts += amount;
    this.clicks += 1;
    this._emit('click', amount);
    this._emit('change');
    this._checkMilestones();
    return amount;
  }

  buy(id) {
    if (!BUILDING_BY_ID.has(id)) return false;
    const cost = this.getCost(id);
    if (!this.canAfford(cost)) return false;
    this.donuts -= cost;
    this.owned[id] = (this.owned[id] || 0) + 1;
    this._emit('buy', id, this.owned[id]);
    this._emit('change');
    return true;
  }

  _reqMet(req) {
    if (!req) return true;
    if (req.building !== undefined) {
      return (this.owned[req.building] || 0) >= (req.count || 0);
    }
    if (req.total !== undefined) {
      return this.totalDonuts >= req.total;
    }
    return true;
  }

  buyUpgrade(id) {
    const u = UPGRADE_BY_ID.get(id);
    if (!u || this.boughtUpgrades.has(id) || !this._reqMet(u.req)) return false;
    if (!this.canAfford(u.cost)) return false;
    this.donuts -= u.cost;
    this.boughtUpgrades.add(id);
    this._emit('upgrade', id);
    this._emit('change');
    return true;
  }

  availableUpgrades() {
    return UPGRADES.filter((u) => !this.boughtUpgrades.has(u.id) && this._reqMet(u.req));
  }

  addDonuts(n) {
    if (!(n > 0)) return;
    this.donuts += n;
    this.totalDonuts += n;
    this._emit('change');
    this._checkMilestones();
  }

  tick(dt) {
    const gain = this.getDps() * dt;
    if (gain > 0) {
      this.donuts += gain;
      this.totalDonuts += gain;
      this._checkMilestones();
    }
    this._emit('change');
  }

  // ---------- Speichern ----------
  save() {
    try {
      const data = {
        donuts: this.donuts,
        totalDonuts: this.totalDonuts,
        clicks: this.clicks,
        owned: this.owned,
        boughtUpgrades: [...this.boughtUpgrades],
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return 0;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return 0;

      this._resetState();
      const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
      this.donuts = num(data.donuts);
      this.totalDonuts = num(data.totalDonuts);
      this.clicks = Math.floor(num(data.clicks));
      if (data.owned && typeof data.owned === 'object') {
        for (const b of BUILDINGS) this.owned[b.id] = Math.floor(num(data.owned[b.id]));
      }
      if (Array.isArray(data.boughtUpgrades)) {
        for (const uid of data.boughtUpgrades) {
          if (UPGRADE_BY_ID.has(uid)) this.boughtUpgrades.add(uid);
        }
      }
      // Meilensteine, die schon erreicht sind, nicht erneut feuern
      while (this.nextMilestone <= this.totalDonuts) this.nextMilestone *= 10;

      // Offline-Einnahmen (max. 2 Stunden)
      let offline = 0;
      const savedAt = num(data.savedAt);
      if (savedAt > 0) {
        const seconds = Math.min(MAX_OFFLINE_SECONDS, Math.max(0, (Date.now() - savedAt) / 1000));
        offline = this.getDps() * seconds;
      }
      if (offline > 0) {
        this.donuts += offline;
        this.totalDonuts += offline;
        this._checkMilestones();
      }
      this._emit('change');
      return offline;
    } catch (e) {
      return 0;
    }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      /* ignorieren */
    }
    this._resetState();
    this._emit('change');
  }
}

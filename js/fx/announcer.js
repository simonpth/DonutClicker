// FX: uebertrieben begeisterter deutscher Sportkommentator (Web Speech API).
// Reine Ausgabe, beeinflusst kein Gameplay. Ohne speechSynthesis passiert einfach nichts.
import { BUILDINGS, UPGRADES } from '../game.js';

const HAS_WIN = typeof window !== 'undefined';
const SYNTH = HAS_WIN && 'speechSynthesis' in window ? window.speechSynthesis : null;
const SUPPORTED = !!(SYNTH && typeof window.SpeechSynthesisUtterance === 'function');

const LANG = 'de-DE';
const COMBO_CLICKS = 10;
const COMBO_WINDOW_MS = 3000;
const IDLE_MS = 8000;
const TICK_MS = 1000;
const UTTER_TIMEOUT_MS = 15000;

// Genus, Plural und Artikel fuer die Gebaeude-Ansagen.
const GENDER = {
  cursor:  { g: 'm', pl: 'FINGER' },
  baker:   { g: 'm', pl: 'BÄCKER' },
  fryer:   { g: 'f', pl: 'FRITTEUSEN' },
  shop:    { g: 'm', pl: 'DONUT-LÄDEN' },
  factory: { g: 'f', pl: 'FABRIKEN' },
  mine:    { g: 'f', pl: 'GLASUR-MINEN' },
  portal:  { g: 'n', pl: 'DONUT-PORTALE' },
  planet:  { g: 'm', pl: 'DONUT-PLANETEN' },
};
const ART = { m: 'DER', f: 'DIE', n: 'DAS' };
// Ordinalzahl-Stamm; mit Artikel immer auf -E (der/die/das zehnte).
const ORD = [null, 'ERST', 'ZWEIT', 'DRITT', 'VIERT', 'FÜNFT', 'SECHST', 'SIEBT', 'ACHT', 'NEUNT', 'ZEHNT', 'ELFT', 'ZWÖLFT'];

const BUY_SINGLE = [
  'UND DA IST {X}!!!',
  'OH MEIN GOTT, {X}!!! Die Theke bebt!',
  '{X}!!! Das Publikum springt von den Stühlen!',
  'ZACK! {X}! Der Trainer weint vor Freude!',
  'HAT ER ES GESCHAFFT? JA! {X}!!!',
  '{X} SCHLÄGT EIN WIE EINE ZUCKERBOMBE!!!',
  'WAHNSINN! {X}! Ich bin sprachlos! Nein, bin ich nicht!!!',
  'UND JETZT: {X}!!! Die Halle explodiert in Puderzucker!',
  '{X}!!! Die Kasse klingelt, die Schlange wird länger!',
  'SENSATION! {X}!!! Niemand hat damit gerechnet, außer mir!',
  'DAS IST ES, LIEBE ZUSCHAUER! {X}!!!',
  'ACHTUNG, ACHTUNG! {X} IST DA!!! Ich wiederhole: {X}!!!',
  '{X}!!! Die Glasur glänzt wie nie zuvor!',
  'ÜBERRASCHUNG! {X}!!! Das hat keiner kommen sehen!',
  'UNGLAUBLICH! {X}!!! Der Donut-Gott lächelt heute!',
  'BOOOM! {X}!!! Das ist Teigkunst auf höchstem Niveau!',
  'DA STEHT ER, DER NEUE ZUGANG: {X}!!!',
  '{X}!!! Ich brauche eine Sitzpause! Die Aufregung!',
  'KAUM ZU GLAUBEN! {X}!!! Die Kamera zittert!',
  'UND WIEDER EINE RUNDE ZUCKER: {X}!!!',
];

const BUY_MULTI = [
  'BUM! {C} AUF EINEN SCHLAG! {PL} ÜBERALL!!!',
  'UND DA SIND GLEICH {C} NEUE {PL}!!! Die Bank wackelt!',
  '{C} {PL} auf einmal!!! Das nennt man Expansion!!!',
  'DER GROSSE EINKAUF! {C} {PL}!!! Der Kassierer fällt in Ohnmacht!',
  '{C} NEUE {PL}!!! Mein Kopf sagt nein, mein Geldbeutel sagt JA!',
  'WAHNSINNSDEAL! {C} {PL} sind jetzt unser!!!',
  'DAS NENNE ICH MUTIG! {C} {PL} in einem Zug!!!',
  '{C} {PL}!!! Die Lieferwagen stehen Schlange!',
  'EIN SCHLAG, {C} {PL}!!! Das gab es noch nie!!!',
  'KASSENSTURM! {C} {PL} eingekauft!!! Die Donuts sind außer Kontrolle!',
  '{C} {PL} GLEICHZEITIG!!! Das Stadion ist AUS DEM HÄUSCHEN!',
  'ABSOLUT IRRE! {C} {PL} auf einen Streich!!!',
];

const UPGRADE_LINES = [
  'UPGRADE!!! {NAME} ist drin! Das ist keine Kleinigkeit, das ist PHYSIK!',
  'DAS NENNT MAN STRATEGIE! {NAME} ist jetzt aktiv!!!',
  '{NAME}!!! Der Schiedsrichter zückt die Goldkarte!',
  'WAS FÜR EIN ZUG! {NAME} wurde gekauft!!!',
  '{NAME}!!! Die Experten sind sprachlos, die Fans sind außer sich!',
  'NEUES UPGRADE: {NAME}!!! Die Maschine schnurrt!',
  'TECHNIK-WUNDER! {NAME} ist online!!!',
  '{NAME}!!! Das war der Plan all die Zeit!!!',
  'OHHH! {NAME}! Das ist ein Gamechanger, Freunde!!!',
  '{NAME} ist da! Und der Donut-Trainer nickt anerkennend!',
  'AUFRÜSTUNG!!! {NAME} wird eingebaut, mit Schmackes!',
  '{NAME}!!! Jetzt wird es richtig gefährlich süß!',
  'DAS UPGRADE DES JAHRHUNDERTS: {NAME}!!!',
  'ZACK, {NAME}!!! Die Konkurrenz schaut neidisch rüber!',
  '{NAME}!!! Ich wusste es, ich wusste es, ICH WUSSTE ES!',
];

const MILESTONE_LINES = [
  'MEILENSTEIN!!! {N} Donuts!!! Die Halle steht Kopf!',
  '{N} DONUTS!!! Wir haben ein Jubiläum, Leute!!!',
  'UNGLAUBLICH! {N} Donuts erreicht! Das Stadion bebt!',
  'HISTORISCH!!! {N} Donuts! Die Geschichtsbücher werden umgeschrieben!',
  'ZAHL DES TAGES: {N} Donuts!!! Ich kann es nicht fassen!',
  'MEILENSTEIN {N}!!! Der Bürgermeister hat eine Torte geschickt!',
  '{N} DONUTS!!! Das ist kein Wert, das ist ein LEBENSSTIL!',
  'WIR HABEN ES GESCHAFFT! {N} Donuts!!! Umarmt eure Bäcker!',
  '{N}!!! Die Puderzucker-Kanone feuert!',
  'ZIEL ERREICHT: {N} Donuts!!! Schiri, Pfiff, JETZT!',
  '{N} DONUTS!!! Jeder Krümel zählt, und jeder Krümel jubelt!',
];

const CHAOS_UP_LINES = [
  'CHAOS-STUFE {L}!!! Die Theke brennt, und das ist GUT so!',
  'ACHTUNG! Chaos-Stufe {L} erreicht! Ich habe keine Kontrolle mehr!',
  'ESKALATION! Stufe {L}!!! Die Donuts fliegen durch die Halle!',
  'CHAOS-STUFE {L}!!! Wer hat hier die Sprühsahne aufgemacht?!',
  'STUFE {L}!!! Das Chaos hat Hunger, und es frisst Zucker!',
  'WARNUNG: Chaos-Stufe {L}! Der Hausmeister hat aufgegeben!',
  'JETZT GEHT\'S AB! Chaos-Stufe {L}!!! Ich sehe nichts mehr vor lauter Glasur!',
  'CHAOS-STUFE {L}!!! Die Kamera wackelt, das Publikum schreit!',
  'EINE NEUE STUFE! {L}!!! Der Teig hat sich selbständig gemacht!',
  'STUFE {L} ERREICHT!!! Das ist kein Sport mehr, das ist ein Erdbeben!',
  'CHAOS-STUFE {L}!!! Die Feuerwehr fragt, ob wir Donuts brauchen!',
  'ZWO, DREI, CHAOS! Stufe {L}!!! Hält sich irgendjemand fest?!',
];

const CHAOS_DOWN_LINES = [
  'Ruhe kehrt ein... Stufe {L}. Die Donuts atmen auf.',
  'Chaos-Stufe {L}. Die Lage beruhigt sich. Vorerst.',
  'Stufe {L}! Der Hausmeister kommt zurück, mit Besen.',
  'Abkühlung! Chaos-Stufe {L}. Der Puderzucker setzt sich langsam.',
  'Stufe {L}. Ich hatte kurz Hoffnung. Ich hatte sie zu Unrecht.',
  'Chaos-Stufe runter auf {L}. Das Publikum buht, aber leise.',
];

const COMBO_LINES = [
  'KLICK-COMBO!!! Die Finger glühen!',
  'KLICK-COMBO! Zehn Klicks, drei Sekunden, pure Raserei!!!',
  'KLICK-COMBO!!! Das ist kein Tippen, das ist ein Schlagzeug-Solo!',
  'KLICK-COMBO!!! Der Daumen hat einen eigenen Puls!',
  'KLICK-COMBO! Die Theke hat Angst vor dir!!!',
  'KLICK-COMBO!!! Die Maus ist überhitzt!',
  'KLICK-COMBO!!! Ich habe mitgezählt, und ich bin fassungslos!',
  'KLICK-COMBO! Schnell wie ein Rennfahrer, süß wie ein Donut!!!',
  'KLICK-COMBO!!! Das Publikum klatscht im Takt!',
  'KLICK-COMBO!!! Fingerflink! Fingerflink!!!',
];

const IDLE_CALM = [
  'Und der Donut liegt einfach da. Wunderschön, nicht wahr?',
  'Ein kleiner Klick für den Finger, ein großer für die Menschheit!',
  'Die Theke wartet. Die Theke hat Geduld. Die Theke hat keine Geduld!',
  'Donut um Donut, Krümel um Krümel. Das ist Sport!',
  'Na, Finger bereit? Ich sehe, Sie sind bereit!',
  'Hallo? Hier läuft ein Spiel, und Sie sind still!',
  'Wir sind kurz in der Halbzeit. Die Zuckerwerte steigen!',
  'Der Schiedsrichter pfeift leise. Weiter, weiter!',
  'Die Theke glänzt, die Donuts glänzen, alles glänzt!',
  'Ruhig Blut, Puderzucker. Gleich geht es weiter!',
  'Ein Donut, ein Gedanke: Mehr Donuts!',
  'Die Stimmung ist gut. Sehr gut. Fast zu gut!',
  'Noch hält sich alles im Rahmen. Aber für wie lange?',
  'Der Teig geht auf. Wie wir alle hoffen!',
  'Zuschauer, bleiben Sie dran. Hier passiert gleich etwas!',
];

const IDLE_WILD = [
  'JETZT ODER NIE, LEUTE!!! KLICKT, KLICKT, KLICKT!!!',
  'DER DONUT ZITTERT!!! Ich sage nur: ZITTERT!!!',
  'NICHT EINSCHLAFEN! Die Glasur wartet nicht!!!',
  'ES BRENNT! Ich meine die Fritteuse! Klickt!!!',
  'WAS IST DAS FÜR EINE STILLE?! Ich will Krach, ich will Donuts!!!',
  'DIE FRITTEUSE SINGT!!! HÖRT IHR DAS?!',
  'DER PLANET DREHT SICH, UND WIR AUCH!!!',
  'KLICK! KLICK! KLICK! Der Finger wird berühmt!!!',
  'WIR GEHEN DURCH DIE DECKE!!! Also klickt doch!!!',
  'ICH HABE GÄNSEHAUT! Ihr auch? Ihr müsst!!!',
  'Der Zucker kocht über, und ich koche mit!!!',
  'HALLO?! Hier brennt die Hütte, und ihr schaut zu!!!',
  'DIE MASCHINEN LAUFEN HEISS! Ich auch!!!',
  'EIN DONUT, ZWEI DONUTS, DREI DONUTS! Mehr, mehr, MEHR!!!',
  'Die Lage ist ernst, die Glasur ist dick, und ich bin ein Wrack!!!',
];

function makeDeck(pool) {
  return { pool, bag: [], last: -1 };
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// Zieht ohne Wiederholung (Shuffle-Bag); kein direkter Repeat am Bag-Anfang.
function draw(deck) {
  if (deck.bag.length === 0) {
    deck.bag = shuffle(deck.pool.map((_, i) => i));
    const n = deck.bag.length;
    if (n > 1 && deck.bag[n - 1] === deck.last) {
      const t = deck.bag[n - 1]; deck.bag[n - 1] = deck.bag[0]; deck.bag[0] = t;
    }
  }
  const i = deck.bag.pop();
  deck.last = i;
  return deck.pool[i];
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

function upper(s) {
  return String(s).toLocaleUpperCase(LANG);
}

function fmt(n) {
  try { return Number(n).toLocaleString(LANG); } catch (e) { return String(n); }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function ordinalWord(n, g) {
  const stem = ORD[n];
  return stem ? stem + 'E' : n + '.';
}

const NOOP = { supported: false, say() {}, stop() {}, destroy() {} };

export function init(ctx) {
  if (!SUPPORTED) return NOOP;

  const game = ctx.game;
  const deckBuy = makeDeck(BUY_SINGLE);
  const deckBuyMulti = makeDeck(BUY_MULTI);
  const deckUpgrade = makeDeck(UPGRADE_LINES);
  const deckMilestone = makeDeck(MILESTONE_LINES);
  const deckChaosUp = makeDeck(CHAOS_UP_LINES);
  const deckChaosDown = makeDeck(CHAOS_DOWN_LINES);
  const deckCombo = makeDeck(COMBO_LINES);
  const deckIdleCalm = makeDeck(IDLE_CALM);
  const deckIdleWild = makeDeck(IDLE_WILD);

  let voice = null;
  let busy = false;      // eigene Sperre: genau ein Satz aktiv oder wartend
  let token = 0;         // identifiziert den aktuellen Satz (alte onend ignorieren)
  let busyTimer = 0;
  let lastSpokeAt = 0;
  let lastClickAt = 0;
  let prevChaos = 0;

  function chaosNow() {
    try { return Math.max(0, Number(ctx.getChaos()) || 0); } catch (e) { return 0; }
  }

  function isMuted() {
    return !!(ctx.sfx && ctx.sfx.muted);
  }

  function pickVoice() {
    let vs = [];
    try { vs = SYNTH.getVoices() || []; } catch (e) { vs = []; }
    if (!vs.length) return;
    voice = vs.find(v => /^de[-_]DE$/i.test(v.lang))
      || vs.find(v => /^de/i.test(v.lang))
      || null;
  }
  pickVoice();
  try { SYNTH.addEventListener('voiceschanged', pickVoice); } catch (e) { /* alte Browser */ }

  function stop() {
    token++;
    busy = false;
    clearTimeout(busyTimer);
    try { SYNTH.cancel(); } catch (e) { /* ignorieren */ }
  }

  // priority (Meilensteine) unterbricht; sonst wird uebersprungen, wenn schon gesprochen wird.
  function say(text, priority) {
    if (!text) return false;
    if (isMuted()) {
      if (SYNTH.speaking) stop();
      return false;
    }
    if (busy || SYNTH.speaking || SYNTH.pending) {
      if (!priority) return false;
      stop();
    }
    const chaos = chaosNow();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG;
    if (voice) u.voice = voice;
    u.rate = clamp(1.0 + 0.06 * chaos + (Math.random() - 0.5) * 0.1, 0.85, 1.6);
    u.pitch = clamp(1.05 + 0.12 * chaos + (Math.random() - 0.5) * 0.1, 0.8, 1.9);
    u.volume = 1;

    const tok = ++token;
    const release = () => { if (tok === token) busy = false; };
    u.onend = release;
    u.onerror = release;
    busy = true;
    clearTimeout(busyTimer);
    busyTimer = setTimeout(release, UTTER_TIMEOUT_MS);
    try {
      SYNTH.speak(u);
    } catch (e) {
      busy = false;
      return false;
    }
    lastSpokeAt = performance.now();
    return true;
  }

  function announce(deck, vars, priority) {
    if (!priority && (busy || SYNTH.speaking || SYNTH.pending)) return false;
    return say(fill(draw(deck), vars || {}), priority);
  }

  // Klick-Combo: >= 10 Klicks innerhalb von 3 s.
  const clickTimes = [];
  function onClick() {
    const now = performance.now();
    lastClickAt = now;
    clickTimes.push(now);
    while (clickTimes.length && now - clickTimes[0] > COMBO_WINDOW_MS) clickTimes.shift();
    if (clickTimes.length >= COMBO_CLICKS) {
      clickTimes.length = 0;
      announce(deckCombo, {}, false);
    }
  }

  function onChaos(e) {
    const level = Number(e && e.detail && e.detail.level) || 0;
    if (level === prevChaos) return;
    const up = level > prevChaos;
    prevChaos = level;
    announce(up ? deckChaosUp : deckChaosDown, { L: level }, false);
  }

  function onBuy(id, count) {
    const b = BUILDINGS.find(x => x.id === id);
    if (!b) return;
    const info = GENDER[id] || { g: 'm', pl: upper(b.name) };
    const c = Math.max(1, Number(count) || 1);
    if (c <= 1) {
      const owned = game && game.owned ? game.owned[id] : 0;
      const n = Math.max(1, Number(owned) || 1);
      const x = ART[info.g] + ' ' + ordinalWord(n, info.g) + ' ' + upper(b.name);
      announce(deckBuy, { X: x }, false);
    } else {
      announce(deckBuyMulti, { C: c, PL: info.pl }, false);
    }
  }

  function onUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    announce(deckUpgrade, { NAME: u ? u.name : String(id) }, false);
  }

  function onMilestone(n) {
    announce(deckMilestone, { N: fmt(n) }, true);
  }

  prevChaos = chaosNow();

  document.addEventListener('dc:click', onClick);
  document.addEventListener('dc:chaos', onChaos);

  const hasOn = game && typeof game.on === 'function';
  if (hasOn) {
    game.on('buy', onBuy);
    game.on('upgrade', onUpgrade);
    game.on('milestone', onMilestone);
  }

  // Leerlauf-Hype: seltener bei niedrigem Chaos.
  const tick = setInterval(() => {
    if (isMuted()) {
      if (SYNTH.speaking) stop();
      return;
    }
    if (busy || SYNTH.speaking || SYNTH.pending) return;
    const now = performance.now();
    const quiet = now - Math.max(lastClickAt, lastSpokeAt);
    if (quiet < IDLE_MS) return;
    const chaos = chaosNow();
    const p = Math.min(0.6, 0.04 + 0.08 * chaos);
    if (Math.random() >= p) return;
    const wild = chaos >= 3 || (chaos >= 2 && Math.random() < 0.5);
    say(draw(wild ? deckIdleWild : deckIdleCalm), false);
  }, TICK_MS);

  return {
    supported: true,
    say: (text) => say(text, false),
    stop,
    destroy() {
      clearInterval(tick);
      stop();
      document.removeEventListener('dc:click', onClick);
      document.removeEventListener('dc:chaos', onChaos);
      try { SYNTH.removeEventListener('voiceschanged', pickVoice); } catch (e) { /* ignorieren */ }
    },
  };
}

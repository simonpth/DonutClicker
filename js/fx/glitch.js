// Fake rendering glitches: RGB split, slice displacement, scanlines/noise,
// frozen frames and fake retro error dialogs. Frequency scales with chaos.

const MAX_DIALOGS = 8;
const DIALOG_LIFETIME_MS = 6000;

const DIALOGS = [
  { title: 'Donut.exe reagiert nicht', body: 'Die Anwendung wartet auf eine Antwort vom Teig.' },
  { title: 'Zu viele Streusel im Speicher', body: 'Speicherauslastung: 104 %. Bitte Streusel freigeben.' },
  { title: 'Glasur-Überlauf bei 0x00D0N07', body: 'Schwerwiegender Fehler im Modul GLAZE.DLL. Glasur wurde verschüttet.' },
];

const CSS = `
#fx-layer { position: fixed; inset: 0; pointer-events: none; z-index: 9000; overflow: hidden; }
#fx-layer .fx-slice { position: fixed; left: -5%; width: 110%; pointer-events: none;
  backdrop-filter: hue-rotate(120deg) invert(0.25) saturate(2); -webkit-backdrop-filter: hue-rotate(120deg) invert(0.25) saturate(2);
  will-change: transform; }
#fx-layer .fx-scan { position: fixed; inset: 0; opacity: 0; transition: opacity 80ms;
  background: repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px); }
#fx-layer .fx-noise { position: fixed; inset: -50%; opacity: 0; transition: opacity 80ms; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
#fx-layer .fx-scan.on, #fx-layer .fx-noise.on { opacity: 1; }
#fx-layer .fx-noise.on { animation: fx-noise-shift 120ms steps(3) infinite; }
@keyframes fx-noise-shift { 0% { transform: translate(0,0); } 33% { transform: translate(-7px,4px); } 66% { transform: translate(5px,-6px); } }

/* RGB split: colored drop-shadow ghosts on the scene and the UI */
#scene.fx-rgb, #ui-root.fx-rgb { filter: drop-shadow(3px 0 0 rgba(255,0,40,0.6)) drop-shadow(-3px 0 0 rgba(0,255,255,0.6)); }

/* Frozen frame: contrast/grayscale and paused animations for 300 ms */
body.fx-frozen #scene, body.fx-frozen #ui-root { filter: contrast(1.6) grayscale(0.7); }
body.fx-frozen #scene.fx-rgb, body.fx-frozen #ui-root.fx-rgb { filter: contrast(1.6) grayscale(0.7) drop-shadow(3px 0 0 rgba(255,0,40,0.6)) drop-shadow(-3px 0 0 rgba(0,255,255,0.6)); }
body.fx-frozen *, body.fx-frozen *::before, body.fx-frozen *::after { animation-play-state: paused !important; }

#fx-dialogs { position: fixed; inset: 0; pointer-events: none; z-index: 9100; }
#fx-dialogs .fx-win { position: fixed; width: min(300px, 86vw); pointer-events: auto;
  background: #c0c0c0; color: #000; border: 2px solid; border-color: #fff #404040 #404040 #fff;
  box-shadow: 4px 4px 0 rgba(0,0,0,0.5); font: 13px/1.3 "Courier New", monospace; user-select: none; }
#fx-dialogs .fx-bar { display: flex; align-items: center; gap: 6px; padding: 3px 4px;
  background: linear-gradient(90deg, #000080, #1084d0); color: #fff; font-weight: bold; cursor: move; }
#fx-dialogs .fx-bar span { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
#fx-dialogs .fx-x { width: 16px; height: 14px; background: #c0c0c0; color: #000; border: 1px solid; border-color: #fff #404040 #404040 #fff; font: bold 10px/1 monospace; text-align: center; line-height: 14px; }
#fx-dialogs .fx-body { display: flex; gap: 10px; padding: 12px 10px 8px; }
#fx-dialogs .fx-icon { flex: none; width: 28px; height: 28px; border-radius: 50%; background: #ff0000; color: #fff; font-weight: bold; text-align: center; line-height: 28px; }
#fx-dialogs .fx-msg { margin: 0; }
#fx-dialogs .fx-ok { display: block; margin: 8px auto 10px; min-width: 76px; padding: 4px 10px; background: #c0c0c0; color: #000; border: 2px solid; border-color: #fff #404040 #404040 #fff; font: bold 13px "Courier New", monospace; cursor: pointer; }
#fx-dialogs .fx-ok:active { border-color: #404040 #fff #fff #404040; }
`;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function init(ctx) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const layer = document.createElement('div');
  layer.id = 'fx-layer';
  const scan = document.createElement('div');
  scan.className = 'fx-scan';
  const noise = document.createElement('div');
  noise.className = 'fx-noise';
  const slices = document.createElement('div');
  layer.append(scan, noise, slices);

  const dialogLayer = document.createElement('div');
  dialogLayer.id = 'fx-dialogs';
  document.body.append(layer, dialogLayer);

  const scene = document.getElementById('scene');
  const uiRoot = document.getElementById('ui-root');
  const splitTargets = [scene, uiRoot].filter(Boolean);

  const timers = new Set();
  const later = (fn, ms) => {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
    return id;
  };

  // ---- chaos ----
  let chaosHint = 0;
  function currentChaos() {
    try {
      const c = Number(ctx.getChaos());
      return Number.isFinite(c) ? c : chaosHint;
    } catch (_) {
      return chaosHint;
    }
  }

  // ---- RGB split ----
  let rgbTimer = null;
  function rgbSplit(strength) {
    splitTargets.forEach((el) => el.classList.add('fx-rgb'));
    clearTimeout(rgbTimer);
    rgbTimer = later(() => splitTargets.forEach((el) => el.classList.remove('fx-rgb')), 90 + 110 * strength);
  }

  // ---- slice displacement (overlay bars with backdrop-filter + translateX) ----
  function sliceBurst(count) {
    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.className = 'fx-slice';
      const h = rand(1.5, 9); // percent of viewport height
      bar.style.top = rand(0, 100 - h) + 'vh';
      bar.style.height = h + 'vh';
      bar.style.transform = `translateX(${Math.round(rand(-60, 60))}px)`;
      bar.style.filter = `hue-rotate(${Math.round(rand(0, 360))}deg)`;
      slices.appendChild(bar);
      later(() => bar.remove(), Math.round(rand(60, 160)));
    }
  }

  // ---- scanlines + noise ----
  let scanTimer = null;
  function scanNoise() {
    scan.classList.add('on');
    noise.classList.add('on');
    clearTimeout(scanTimer);
    scanTimer = later(() => {
      scan.classList.remove('on');
      noise.classList.remove('on');
    }, Math.round(rand(180, 420)));
  }

  // ---- frozen frame ----
  let frozenTimer = null;
  function frozenFrame() {
    document.body.classList.add('fx-frozen');
    clearTimeout(frozenTimer);
    frozenTimer = later(() => document.body.classList.remove('fx-frozen'), 300);
  }

  // ---- fake error dialogs ----
  const openDialogs = new Set();

  function closeDialog(entry) {
    if (!openDialogs.has(entry)) return;
    openDialogs.delete(entry);
    clearTimeout(entry.timer);
    entry.el.remove();
  }

  function spawnDialog() {
    if (openDialogs.size >= MAX_DIALOGS) return false;
    const msg = pick(DIALOGS);

    const el = document.createElement('div');
    el.className = 'fx-win';
    el.setAttribute('role', 'alertdialog');
    el.style.left = Math.round(rand(4, 70)) + 'vw';
    el.style.top = Math.round(rand(6, 70)) + 'vh';

    const bar = document.createElement('div');
    bar.className = 'fx-bar';
    const title = document.createElement('span');
    title.textContent = msg.title.split(' ')[0] === 'Donut.exe' ? 'Donut.exe' : 'Fehler';
    const x = document.createElement('div');
    x.className = 'fx-x';
    x.textContent = 'X';
    bar.append(title, x);

    const body = document.createElement('div');
    body.className = 'fx-body';
    const icon = document.createElement('div');
    icon.className = 'fx-icon';
    icon.textContent = '!';
    const text = document.createElement('p');
    text.className = 'fx-msg';
    const strong = document.createElement('strong');
    strong.textContent = msg.title;
    text.append(strong, document.createElement('br'), document.createTextNode(msg.body));
    body.append(icon, text);

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'fx-ok';
    ok.textContent = 'OK';

    el.append(bar, body, ok);

    const entry = { el, timer: null };
    openDialogs.add(entry);
    dialogLayer.appendChild(el);

    ok.addEventListener('click', () => {
      closeDialog(entry);
      spawnDialog();
      spawnDialog();
    });
    x.addEventListener('click', () => closeDialog(entry));

    entry.timer = setTimeout(() => closeDialog(entry), DIALOG_LIFETIME_MS);
    return true;
  }

  // ---- glitch orchestration ----
  function glitch(strength = 1) {
    const chaos = currentChaos();
    const intensity = Math.max(0.5, Math.min(chaos, 4)) * strength;

    rgbSplit(Math.min(intensity, 3));
    sliceBurst(Math.round(rand(2, 4) + intensity * 2));
    if (Math.random() < 0.5) scanNoise();
    if (Math.random() < 0.3) frozenFrame();
    if (chaos >= 1 && Math.random() < 0.25 + 0.1 * Math.min(chaos, 3)) spawnDialog();
  }

  // ---- scheduler: none below chaos 1, ~20 s at 1 down to ~3 s at 3+ ----
  function nextDelay(chaos) {
    const t = Math.min(chaos, 3);
    const base = 20000 - ((t - 1) / 2) * 17000;
    return base * rand(0.6, 1.4);
  }

  let schedTimer = null;
  function schedule() {
    const chaos = currentChaos();
    if (chaos < 1) {
      schedTimer = setTimeout(schedule, 1000); // poll until chaos rises
      return;
    }
    schedTimer = setTimeout(() => {
      glitch(1);
      schedule();
    }, nextDelay(chaos));
  }
  schedule();

  // ---- event hooks ----
  document.addEventListener('dc:chaos', (e) => {
    const lvl = Number(e && e.detail && e.detail.level);
    if (Number.isFinite(lvl)) chaosHint = lvl;
  });
  document.addEventListener('dc:flashbang', (e) => {
    const s = Math.max(1, Math.min(3, Number(e && e.detail && e.detail.strength) || 1));
    glitch(s);
  });

  return {
    glitch,
    spawnDialog,
    destroy() {
      clearTimeout(schedTimer);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      [...openDialogs].forEach(closeDialog);
      layer.remove();
      dialogLayer.remove();
      style.remove();
      document.body.classList.remove('fx-frozen');
      splitTargets.forEach((el) => el.classList.remove('fx-rgb'));
    },
  };
}

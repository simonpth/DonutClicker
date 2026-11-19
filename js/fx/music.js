// Chaos-driven music layer for Donut Clicker, on top of the base chiptune (js/audio.js).
// Routed into sfx.master, so the existing mute toggle silences it too.

const LAYER_GAIN = 0.15;
const LOOKAHEAD = 0.12;   // seconds of audio scheduled ahead
const TICK_MS = 25;
const POLL_MS = 500;
const ARP = [57, 60, 64, 69, 64, 60, 67, 72];  // A minor arpeggio (MIDI)
// One bar of sixteenths, MIDI notes (null = rest)
const BASS = [33, null, 33, 36, null, 33, 31, null, 33, null, 36, 33, 31, null, 29, null];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function init(ctx) {
  const { game, sfx, getChaos } = ctx;
  let nodes = null;        // {ac, out, noise, wob, lfo}
  let tickTimer = null;
  let pollTimer = null;
  let nextT = 0;
  let step = 0;            // sixteenth-note counter
  let silenceUntil = 0;    // drop: layer is silent until this time
  let dropPending = false;

  const chaos = () => {
    const v = Number(getChaos());
    return v > 0 ? v : 0;
  };

  // Shared audio graph, created once the AudioContext exists.
  function setup() {
    const ac = sfx.ctx;
    const out = ac.createGain();
    out.gain.value = LAYER_GAIN;
    out.connect(sfx.master);

    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Wobble bass: shared lowpass whose cutoff is swept by an LFO
    const wob = ac.createBiquadFilter();
    wob.type = 'lowpass';
    wob.frequency.value = 600;
    wob.Q.value = 8;
    const bassGain = ac.createGain();
    bassGain.gain.value = 0.5;
    wob.connect(bassGain);
    bassGain.connect(out);

    const lfo = ac.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 2 * 120 / 60;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 450;
    lfo.connect(lfoDepth);
    lfoDepth.connect(wob.frequency);
    lfo.start();

    nodes = { ac, out, noise, wob, lfo };
  }

  // Per-note envelope: fast attack, exponential decay to silence over dur.
  function env(g, t, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function kick(t) {
    const { ac, out } = nodes;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.32);
  }

  function hat(t) {
    const { ac, out, noise } = nodes;
    const s = ac.createBufferSource();
    s.buffer = noise;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ac.createGain();
    env(g, t, 0.3, 0.04);
    s.connect(hp);
    hp.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 0.8, 0.05);
    s.stop(t + 0.06);
  }

  function lead(t, note, dur) {
    const { ac, out } = nodes;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.value = mtof(note);
    env(g, t, 0.12, dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function bass(t, note, dur) {
    const { ac, wob } = nodes;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.value = mtof(note);
    env(g, t, 0.8, dur);
    o.connect(g);
    g.connect(wob);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Drop: huge sub hit plus a riser sweeping up over the next two beats.
  function bigHit(t, beat) {
    const { ac, out, noise } = nodes;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 1.05);

    const s = ac.createOscillator();
    const sg = ac.createGain();
    s.type = 'sawtooth';
    s.frequency.setValueAtTime(55, t);
    s.frequency.exponentialRampToValueAtTime(30, t + 0.8);
    sg.gain.setValueAtTime(0.5, t);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    s.connect(sg);
    sg.connect(out);
    s.start(t);
    s.stop(t + 0.95);

    const riserDur = 2 * beat;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(200, t);
    bp.frequency.exponentialRampToValueAtTime(8000, t + riserDur);
    const rg = ac.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(0.8, t + riserDur);
    rg.gain.setValueAtTime(0.0001, t + riserDur + 0.01);
    src.connect(bp);
    bp.connect(rg);
    rg.connect(out);
    src.start(t, 0, riserDur + 0.05);
    src.stop(t + riserDur + 0.05);
  }

  // Lookahead scheduler: runs every 25 ms and queues notes LOOKAHEAD seconds ahead.
  function tick() {
    if (!nodes) return;
    const ac = nodes.ac;
    if (sfx.muted || ac.state !== 'running') {
      nextT = ac.currentTime + 0.05;
      return;
    }
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;

    const c = chaos();
    const bpm = 120 + 55 * Math.min(1, c / 4);   // 120 -> 175 BPM
    nodes.lfo.frequency.value = (bpm / 60) * 2;  // wobble: two cycles per beat, synced to tempo
    const stepDur = 60 / bpm / 4;

    while (nextT < ac.currentTime + LOOKAHEAD) {
      const t = nextT;
      const i = step % 16;

      if (i % 4 === 0 && dropPending) {
        // Drop: one beat of silence, then the hit
        dropPending = false;
        silenceUntil = t + 4 * stepDur;
        bigHit(silenceUntil, 4 * stepDur);
      }

      if (t >= silenceUntil) {
        if (c >= 0.5) {
          if (i % 4 === 0) kick(t);
          if (i % 4 === 2 || (c >= 2 && i % 2 === 1)) hat(t);
        }
        if (c >= 1 && i % 2 === 0) {
          lead(t, ARP[Math.floor(step / 2) % ARP.length], stepDur * 1.6);
        }
        if (c >= 2 && BASS[i] != null) {
          bass(t, BASS[i], stepDur * 1.8);
        }
      }

      nextT += stepDur;
      step++;
    }
  }

  function trigger() {
    if (nodes) dropPending = true;
  }

  function start() {
    if (!sfx.ctx || !sfx.master) return false;
    try {
      setup();
    } catch (_) {
      return false;
    }
    tickTimer = setInterval(tick, TICK_MS);
    return true;
  }

  if (game && typeof game.on === 'function') game.on('milestone', trigger);
  document.addEventListener('dc:flashbang', trigger);

  // Start lazily: poll until sfx has created its AudioContext.
  if (!start()) {
    pollTimer = setInterval(() => {
      if (start()) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, POLL_MS);
  }
}

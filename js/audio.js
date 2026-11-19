// Synthesized sound effects and chiptune music for Donut Clicker.
// No audio files: everything is generated with the Web Audio API.

const STORE_KEY = 'donutclicker-muted';
const MIN_GAP = 0.05;     // max 20 plays per second per sound type
const MASTER_VOL = 0.7;
const STEP = 0.2;         // seconds per eighth note (150 BPM)
const LOOKAHEAD = 0.12;   // seconds of music scheduled ahead

// MIDI note number -> frequency in Hz
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MELODY = [72, 74, 76, 79, 76, 74, 72, null, 76, 77, 79, 81, 79, 77, 76, null];
const BASS = [48, null, 48, null, 43, null, 43, null, 41, null, 41, null, 43, null, 43, null];

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.noiseBuf = null;
    this._muted = false;
    this._last = {};          // sound name -> last ctx time played
    this._musicOn = false;
    this._timer = null;
    this._nextT = 0;
    this._step = 0;
    try {
      this._muted = localStorage.getItem(STORE_KEY) === '1';
    } catch (_) { /* storage unavailable */ }
  }

  // Lazily create the AudioContext and the master chain.
  _ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
    } catch (_) {
      return null;
    }
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    comp.connect(this.ctx.destination);

    this.master = this.ctx.createGain();
    this.master.gain.value = this._muted ? 0 : MASTER_VOL;
    this.master.connect(comp);

    // Music goes through a lowpass so flash-bangs can muffle it (see flashbang())
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.Q.value = 0.7;
    this.muffle.frequency.value = 20000;
    this.muffle.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.1;   // music sits quietly under the SFX
    this.musicGain.connect(this.muffle);
    return this.ctx;
  }

  // Call on the first user gesture.
  unlock() {
    const c = this._ensure();
    if (!c) return;
    if (c.state !== 'running') c.resume().catch(() => {});
    if (this._musicOn) this._startTimer();
  }

  _ok() {
    return !this._muted && !!this.ctx && this.ctx.state === 'running';
  }

  // Returns the start time for a sound, or null if it should be skipped.
  _begin(name) {
    if (!this._ok()) return null;
    const t = this.ctx.currentTime;
    const last = this._last[name];
    if (last !== undefined && t - last < MIN_GAP) return null;
    this._last[name] = t;
    return t + 0.01;
  }

  _noiseBuffer() {
    if (!this.noiseBuf) {
      const rate = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, rate, rate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  // Oscillator with a simple attack/decay envelope.
  _tone({ type = 'sine', f0, f1, t, dur, vol = 0.3, dest }) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Filtered noise burst. The filter frequency sweeps from f0 to f1.
  _noise({ t, dur, vol = 0.3, filter = 'lowpass', f0, f1, q = 1, rate = 1, dest }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.playbackRate.value = rate;
    src.loop = dur > 0.4; // the noise buffer is 1 s long; loop it for long explosions
    const flt = c.createBiquadFilter();
    flt.type = filter;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(dest || this.master);
    if (src.loop) src.start(t, Math.random() * 0.5);
    else src.start(t, Math.random() * 0.5, dur);
    src.stop(t + dur + 0.02);
  }

  // Cartoony boing/pop with random pitch.
  click() {
    const t = this._begin('click');
    if (t == null) return;
    const base = 520 * (0.85 + Math.random() * 0.35);
    this._tone({ type: 'sine', f0: base, f1: base * 2.2, t, dur: 0.09, vol: 0.35 });
    this._noise({ t, dur: 0.02, vol: 0.08, filter: 'highpass', f0: 2000, q: 0.5 });
  }

  // Stun grenade: sharp crack, tinnitus ring, and muffled music that clears up again.
  flashbang() {
    const t = this._begin('flashbang');
    if (t == null) return;
    // Explosion: sharp crack, a deep sub-bass boom and a long rumbling debris tail
    this._noise({ t, dur: 0.12, vol: 1.0, filter: 'highpass', f0: 900, q: 0.5 });
    this._noise({ t, dur: 0.6, vol: 1.0, filter: 'lowpass', f0: 6000, f1: 300, q: 0.8 });
    this._tone({ type: 'sine', f0: 120, f1: 22, t, dur: 1.8, vol: 0.95 });
    this._tone({ type: 'triangle', f0: 70, f1: 18, t: t + 0.02, dur: 1.4, vol: 0.6 });
    this._noise({ t: t + 0.05, dur: 3.0, vol: 0.7, filter: 'lowpass', f0: 900, f1: 60, q: 1.2, rate: 0.5 });
    // Second, delayed rumble "echo" bouncing off the walls
    this._noise({ t: t + 0.35, dur: 1.6, vol: 0.35, filter: 'lowpass', f0: 500, f1: 50, q: 1 });
    // Tinnitus: two slightly detuned sines around 4.9 kHz, fading over 6 s
    const ring = t + 0.1;
    this._tone({ type: 'sine', f0: 4900, t: ring, dur: 6, vol: 0.08 });
    this._tone({ type: 'sine', f0: 4900 * 1.012, t: ring, dur: 6, vol: 0.06 });
    // Muffle the music: lowpass drops to 250 Hz and only slowly opens again over 6 s
    const m = this.muffle.frequency;
    m.cancelScheduledValues(t);
    m.setValueAtTime(250, t);
    m.setValueAtTime(250, t + 1.5);
    m.exponentialRampToValueAtTime(20000, t + 6);
  }

  // Happy rising arpeggio.
  buy() {
    const t = this._begin('buy');
    if (t == null) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      this._tone({ type: 'square', f0: f, t: t + i * 0.07, dur: 0.15, vol: 0.12 });
    });
  }

  // Magical shimmer sweep.
  upgrade() {
    const t = this._begin('upgrade');
    if (t == null) return;
    this._tone({ type: 'triangle', f0: 300, f1: 1800, t, dur: 0.5, vol: 0.14 });
    this._tone({ type: 'sine', f0: 303, f1: 1810, t, dur: 0.5, vol: 0.1 });
    this._noise({ t: t + 0.15, dur: 0.35, vol: 0.05, filter: 'highpass', f0: 3000, f1: 9000, q: 2 });
  }

  // Fanfare with a noise crash.
  milestone() {
    const t = this._begin('milestone');
    if (t == null) return;
    const seq = [523, 659, 784, 1047, 784, 1047, 1318];
    seq.forEach((f, i) => {
      this._tone({ type: 'square', f0: f, t: t + i * 0.12, dur: 0.14, vol: 0.16 });
    });
    const end = t + seq.length * 0.12;
    [523, 659, 784, 1047].forEach((f) => {
      this._tone({ type: 'triangle', f0: f, t: end, dur: 0.9, vol: 0.14 });
    });
    this._noise({ t: end, dur: 0.8, vol: 0.3, f0: 7000, f1: 300, q: 0.7 });
  }

  // Sparkly bell chime.
  golden() {
    const t = this._begin('golden');
    if (t == null) return;
    [1047, 1319, 1568, 2093].forEach((f, i) => {
      const s = t + i * 0.06;
      this._tone({ type: 'sine', f0: f, t: s, dur: 0.9, vol: 0.18 });
      this._tone({ type: 'sine', f0: f * 2.76, t: s, dur: 0.4, vol: 0.05 });
    });
  }

  // Short, quiet-ish noise burst with a lowpass sweep and random pitch.
  explosion() {
    const t = this._begin('explosion');
    if (t == null) return;
    const rate = 0.8 + Math.random() * 0.5;
    this._noise({ t, dur: 0.35, vol: 0.2, f0: 1400 * rate, f1: 80, q: 0.8, rate });
    this._tone({ type: 'sine', f0: 90 * rate, f1: 40, t, dur: 0.25, vol: 0.15 });
  }

  // Springy bounce.
  boing() {
    const t = this._begin('boing');
    if (t == null) return;
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.3);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.62);
  }

  startMusic() {
    this._musicOn = true;
    this._startTimer();
  }

  stopMusic() {
    this._musicOn = false;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._step = 0;
    this._nextT = 0;
  }

  _startTimer() {
    if (this._timer) return;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  // Lookahead scheduler: queues notes slightly ahead of the audio clock.
  _schedule() {
    if (!this._musicOn || !this._ok()) return;
    const c = this.ctx;
    if (this._nextT < c.currentTime) this._nextT = c.currentTime + 0.05;
    while (this._nextT < c.currentTime + LOOKAHEAD) {
      const i = this._step % MELODY.length;
      const t = this._nextT;
      const m = MELODY[i];
      const b = BASS[i];
      if (m != null) {
        this._tone({ type: 'square', f0: mtof(m), t, dur: STEP * 0.9, vol: 0.25, dest: this.musicGain });
      }
      if (b != null) {
        this._tone({ type: 'triangle', f0: mtof(b), t, dur: STEP * 0.9, vol: 0.5, dest: this.musicGain });
      }
      this._nextT += STEP;
      this._step++;
    }
  }

  toggleMute() {
    this._muted = !this._muted;
    try {
      localStorage.setItem(STORE_KEY, this._muted ? '1' : '0');
    } catch (_) { /* storage unavailable */ }
    if (this.master) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : MASTER_VOL, this.ctx.currentTime, 0.02);
    }
    return this._muted;
  }

  get muted() {
    return this._muted;
  }
}

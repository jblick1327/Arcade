// audio.js - Boarded Up sound engine (every sound is synthesized with Web Audio)
// Author: Reachnid Group
// Centennial College - Fall 2026

// Procedural sound engine. Every sound is synthesized with the Web Audio API
// (oscillators, filtered noise buffers, envelopes, LFOs); there are no audio files.
//
// Signal flow:
//   one-shot sources -> per-call out gain (vol) -> [StereoPanner] -> sfx bus ----\
//   gun one-shots    -> per-call out gain       -> [StereoPanner] -> gun drive -> sfx bus
//   echo sends       -> delay/feedback -> lowpass -> sfx bus                      |
//   ambience (wind, creaks, drips) -> amb bus -------------------------------------+-> master -> compressor -> destination
//
// Every public method is wrapped so it can never throw: no Web Audio support,
// calls before init() and calls after destroy() are silent no-ops.

const MIN = 0.0001; // floor for exponential ramps (they cannot reach or start from 0)
const pos = (v) => (v > MIN ? v : MIN); // also maps NaN/undefined to MIN
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const vary = (amt) => 1 + (Math.random() * 2 - 1) * amt;
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function expTo(param, v, t) {
  param.exponentialRampToValueAtTime(pos(v), t);
}

// Linear attack -> optional hold -> exponential decay. Returns the end time.
function env(param, t, peak, a, d, hold = 0) {
  const p = pos(peak);
  param.setValueAtTime(MIN, t);
  param.linearRampToValueAtTime(p, t + a);
  if (hold > 0) param.setValueAtTime(p, t + a + hold);
  expTo(param, MIN, t + a + hold + d);
  return t + a + hold + d;
}

// Frequency path: either { f2, glide } or fEnv: [[dt, freq], ...] (exponential segments).
function freqPath(param, t, o) {
  param.setValueAtTime(pos(o.f), t);
  if (o.fEnv) {
    for (const [dt, f] of o.fEnv) expTo(param, f, t + dt);
  } else if (o.f2) {
    expTo(param, o.f2, t + (o.glide != null ? o.glide : (o.a || 0) + (o.d || 0.1)));
  }
}

// Sounds that come from zombies/world get a concurrency cap so a horde can't
// pile up hundreds of nodes. Weapons/UI are never culled, except the flamer
// (re-triggered ~10x/s; 3 voices is plenty for its ~0.18s overlapping bursts).
// Long story/one-off sounds are capped low so a spammy caller can't stack them.
const LIMITS = {
  groan: 5,
  zattack: 4,
  zdie: 4,
  zhit: 6,
  plank: 3,
  repair: 3,
  door: 2,
  explode: 4,
  crate: 2,
  shot_flamer: 3,
  saw_hit: 4,
  burn: 4,
  zap: 3,
  brute: 2,
  brute_hit: 3,
  objective: 2,
  radio: 2,
  item: 3,
  switch: 2,
  power_on: 1,
  trap_on: 2,
  alarm: 1,
  heli: 1,
  mission_complete: 1,
  mission_fail: 1,
};

// Minor pentatonic (A) over two octaves for the mystery crate music box.
const PENTA = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this._muted = false;
    this._volume = 0.8;
    this._destroyed = false;
    this._ambTimer = null;
    this._ambNodes = [];
    this._voices = Object.create(null); // name -> [endTime, ...]
    this._recent = Object.create(null); // name -> { t, n }
  }

  //=============================================================
  //                         LIFECYCLE
  //=============================================================

  init() {
    try {
      if (this._destroyed) return;
      if (this.ctx) {
        this.resume();
        return;
      }
      const W = typeof window !== 'undefined' ? window : null;
      const AC = W && (W.AudioContext || W.webkitAudioContext);
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this._hasPan = typeof ctx.createStereoPanner === 'function';
      this._build();
      this._startAmbience();
      this.resume();
    } catch (e) {
      this._fail();
    }
  }

  setMuted(m) {
    try {
      this._muted = !!m;
      this._applyGain();
    } catch (e) {
      /* ignore */
    }
  }

  setVolume(v) {
    try {
      const n = Number(v);
      this._volume = Number.isFinite(n) ? clamp(n, 0, 1) : this._volume;
      this._applyGain();
    } catch (e) {
      /* ignore */
    }
  }

  suspend() {
    try {
      const c = this.ctx;
      if (c && c.state === 'running' && c.suspend) {
        const p = c.suspend();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
  }

  resume() {
    try {
      const c = this.ctx;
      if (c && !this._destroyed && c.state !== 'running' && c.state !== 'closed' && c.resume) {
        const p = c.resume();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
  }

  destroy() {
    try {
      this._destroyed = true;
      if (this._ambTimer != null) clearTimeout(this._ambTimer);
      this._ambTimer = null;
      for (const n of this._ambNodes) {
        try {
          n.stop();
        } catch (e) {
          /* ignore */
        }
      }
      this._ambNodes = [];
      const c = this.ctx;
      this.ctx = null;
      if (c && c.state !== 'closed' && c.close) {
        const p = c.close();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
    this.master = this.sfx = this.gunBus = this.ambBus = this.echoIn = null;
  }

  //=============================================================
  //                          PLAYBACK
  //=============================================================

  // play(name, { vol = 1, pan = 0 } = {}) -- options destructured inside the try
  // so a null/garbage options argument can't throw.
  play(name, opts) {
    try {
      const { vol = 1, pan = 0 } = opts || {};
      const c = this.ctx;
      if (!c || this._destroyed || this._muted || c.state !== 'running') return;
      const fn = SOUNDS[name];
      if (typeof fn !== 'function' || !Object.prototype.hasOwnProperty.call(SOUNDS, name)) return;
      let v = Number(vol);
      if (!Number.isFinite(v)) v = 1;
      v = clamp(v, 0, 2);
      if (v < 0.005) return;
      const now = c.currentTime;

      // Same-name stacking guard (e.g. 8 shotgun pellets -> 8 zhits in one frame).
      const r = this._recent[name];
      if (r && now - r.t < 0.025) {
        if (r.n >= 2) return;
        r.n++;
      } else {
        this._recent[name] = { t: now, n: 1 };
      }

      // Concurrency cap for horde sounds.
      const lim = LIMITS[name];
      let list = null;
      if (lim) {
        list = (this._voices[name] || []).filter((e) => e > now);
        this._voices[name] = list;
        if (list.length >= lim) return;
      }

      let p = Number(pan);
      p = Number.isFinite(p) ? clamp(p, -1, 1) : 0;
      const isGun = name.startsWith('shot_');
      const out = this._out(v, p, isGun ? this.gunBus : this.sfx);
      const t = now + 0.003;
      const dur = fn(this, out, t);
      if (list) list.push(t + (dur || 1));
    } catch (e) {
      /* never throw from play */
    }
  }

  //=============================================================
  //                         INTERNALS
  //=============================================================

  _fail() {
    try {
      if (this.ctx && this.ctx.close) this.ctx.close().catch(() => {});
    } catch (e) {
      /* ignore */
    }
    this.ctx = null;
  }

  _applyGain() {
    const c = this.ctx;
    if (!c || !this.master) return;
    const g = this.master.gain;
    const target = this._muted ? 0 : this._volume;
    g.cancelScheduledValues(c.currentTime);
    g.setTargetAtTime(target, c.currentTime, 0.02);
  }

  _build() {
    const c = this.ctx;
    const sr = c.sampleRate || 44100;

    // Noise buffers: 2s white, 3s brown (brown loops for the wind).
    const wl = Math.floor(sr * 2);
    this.white = c.createBuffer(1, wl, sr);
    const wd = this.white.getChannelData(0);
    for (let i = 0; i < wl; i++) wd[i] = Math.random() * 2 - 1;
    const bl = Math.floor(sr * 3);
    this.brown = c.createBuffer(1, bl, sr);
    const bd = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bl; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      bd[i] = last * 3.5;
    }

    // Master chain.
    this.comp = c.createDynamicsCompressor();
    const cp = this.comp;
    cp.threshold.value = -14;
    cp.knee.value = 12;
    cp.ratio.value = 6;
    cp.attack.value = 0.003;
    cp.release.value = 0.22;
    this.master = c.createGain();
    this.master.gain.value = this._muted ? 0 : this._volume;
    this.master.connect(cp);
    cp.connect(c.destination);

    this.sfx = c.createGain();
    this.sfx.gain.value = 0.75;
    this.sfx.connect(this.master);

    // Gun bus: gentle tanh saturation for punch/grit.
    const shaper = c.createWaveShaper();
    const n = 1024;
    const curve = new Float32Array(n);
    const k = 1.8;
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(k * x) / norm;
    }
    shaper.curve = curve;
    shaper.oversample = 'none';
    this.gunBus = c.createGain();
    this.gunBus.gain.value = 0.5; // headroom: tanh curve has ~1.9x small-signal gain, layered peaks ~2 saturate softly
    this.gunBus.connect(shaper);
    shaper.connect(this.sfx);

    // Shared echo send (music box, bells, drips).
    this.echoIn = c.createGain();
    this.echoIn.gain.value = 0.35;
    const delay = c.createDelay(1.0);
    delay.delayTime.value = 0.27;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const elp = c.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 2200;
    this.echoIn.connect(delay);
    delay.connect(elp);
    elp.connect(fb);
    fb.connect(delay);
    elp.connect(this.sfx);

    // Ambience bus (sits well below gameplay).
    this.ambBus = c.createGain();
    this.ambBus.gain.value = MIN;
    this.ambBus.connect(this.master);
  }

  // Per-call output: volume gain (+ optional stereo pan) into a bus.
  _out(vol, pan, bus) {
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = vol;
    if (pan && Math.abs(pan) > 0.01 && this._hasPan) {
      try {
        const p = c.createStereoPanner();
        p.pan.value = pan;
        g.connect(p);
        p.connect(bus);
        return g;
      } catch (e) {
        this._hasPan = false;
      }
    }
    g.connect(bus);
    return g;
  }

  _gain(dest, v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(dest);
    return g;
  }

  _filter(dest, type, f, q = 0.7, t = 0, o = null) {
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    if (o) freqPath(fl.frequency, t, { f, ...o });
    else fl.frequency.value = f;
    fl.Q.value = q;
    fl.connect(dest);
    return fl;
  }

  // Oscillator voice with envelope. o: { type, f, f2, glide, fEnv, a, d, hold, peak, detune }
  _osc(dest, t, o) {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    freqPath(osc.frequency, t, o);
    if (o.detune) osc.detune.value = o.detune;
    const g = c.createGain();
    const end = env(
      g.gain,
      t,
      o.peak != null ? o.peak : 0.5,
      o.a != null ? o.a : 0.002,
      o.d != null ? o.d : 0.2,
      o.hold || 0,
    );
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(end + 0.03);
    return osc;
  }

  // Filtered noise burst. o: { brown, type, f, f2, glide, fEnv, q, a, d, hold, peak, rate }
  _noise(dest, t, o) {
    const c = this.ctx;
    const src = c.createBufferSource();
    const buf = o.brown ? this.brown : this.white;
    src.buffer = buf;
    const rate = o.rate || 1;
    if (rate !== 1) src.playbackRate.value = rate;
    let node = src;
    if (o.type) {
      const fl = c.createBiquadFilter();
      fl.type = o.type;
      freqPath(fl.frequency, t, o);
      fl.Q.value = o.q != null ? o.q : 0.7;
      src.connect(fl);
      node = fl;
    }
    const g = c.createGain();
    const end = env(
      g.gain,
      t,
      o.peak != null ? o.peak : 0.5,
      o.a != null ? o.a : 0.001,
      o.d != null ? o.d : 0.1,
      o.hold || 0,
    );
    node.connect(g);
    g.connect(dest);
    const need = (end - t + 0.05) * rate;
    const bufDur = buf.duration || 2;
    let offset = 0;
    if (need < bufDur) offset = Math.random() * (bufDur - need);
    else src.loop = true;
    src.start(t, offset);
    src.stop(end + 0.03);
    return src;
  }

  // LFO: returns { osc, g } where g outputs +-depth; caller connects g to a param.
  _lfo(t, end, freq, depth, type = 'sine') {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = depth;
    osc.connect(g);
    osc.start(t);
    osc.stop(end + 0.03);
    return g;
  }

  //=============================================================
  //                          AMBIENCE
  //=============================================================

  _startAmbience() {
    const c = this.ctx;
    const t = c.currentTime;
    const bus = this.ambBus;
    bus.gain.setValueAtTime(MIN, t);
    bus.gain.linearRampToValueAtTime(0.2, t + 4);

    // Low wind: looping brown noise, lowpass with slowly drifting cutoff and level.
    const wind = c.createBufferSource();
    wind.buffer = this.brown;
    wind.loop = true;
    wind.playbackRate.value = 0.73;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 1.4;
    const wg = c.createGain();
    wg.gain.value = 0.55;
    wind.connect(lp);
    lp.connect(wg);
    wg.connect(bus);
    const l1 = c.createOscillator();
    l1.frequency.value = 0.053;
    const l1g = c.createGain();
    l1g.gain.value = 200;
    l1.connect(l1g);
    l1g.connect(lp.frequency);
    const l2 = c.createOscillator();
    l2.frequency.value = 0.117;
    const l2g = c.createGain();
    l2g.gain.value = 0.28;
    l2.connect(l2g);
    l2g.connect(wg.gain);

    // Faint whistle through the boards: narrow bandpass on white noise, drifting.
    const wh = c.createBufferSource();
    wh.buffer = this.white;
    wh.loop = true;
    wh.playbackRate.value = 0.91;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 820;
    bp.Q.value = 9;
    const whg = c.createGain();
    whg.gain.value = 0.05;
    wh.connect(bp);
    bp.connect(whg);
    whg.connect(bus);
    const l3 = c.createOscillator();
    l3.frequency.value = 0.041;
    const l3g = c.createGain();
    l3g.gain.value = 260;
    l3.connect(l3g);
    l3g.connect(bp.frequency);
    const l4 = c.createOscillator();
    l4.frequency.value = 0.067;
    const l4g = c.createGain();
    l4g.gain.value = 0.04;
    l4.connect(l4g);
    l4g.connect(whg.gain);

    for (const s of [wind, wh, l1, l2, l3, l4]) s.start(t);
    this._ambNodes = [wind, wh, l1, l2, l3, l4];
    this._scheduleAmbient();
  }

  _scheduleAmbient() {
    if (this._destroyed || typeof setTimeout !== 'function') return;
    this._ambTimer = setTimeout(
      () => {
        this._ambTimer = null;
        try {
          this._ambientEvent();
        } catch (e) {
          /* ignore */
        }
        this._scheduleAmbient();
      },
      rnd(6000, 16000),
    );
  }

  _ambientEvent() {
    const c = this.ctx;
    if (!c || this._destroyed || this._muted || c.state !== 'running') return;
    const t = c.currentTime + 0.01;
    const out = this._out(1, rnd(-0.9, 0.9), this.ambBus);
    if (Math.random() < 0.6) {
      // Distant creak: buzzy low saw through a resonant bandpass, muffled.
      const lp = this._filter(out, 'lowpass', 1100, 0.7);
      const bp = this._filter(lp, 'bandpass', rnd(450, 750), 11);
      const f = rnd(45, 70);
      this._osc(bp, t, {
        type: 'sawtooth',
        f,
        fEnv: [
          [0.35, f * rnd(1.2, 1.5)],
          [0.9, f * 0.85],
        ],
        a: 0.18,
        hold: 0.3,
        d: 0.45,
        peak: 0.7,
      });
    } else {
      // Drip: quick falling sine blip with echo.
      const f = rnd(900, 1500);
      const g = this._gain(out, 1);
      g.connect(this._gain(this.echoIn, 0.06)); // echo bus bypasses the quiet amb bus
      this._osc(g, t, { f, f2: f * 0.45, glide: 0.05, a: 0.001, d: 0.07, peak: 0.35 });
    }
  }
}

//=============================================================
//                       SOUND HELPERS
//=============================================================

// Piecewise-linear approximation of an equal-power (sine) fade. Overlapping
// copies of uncorrelated noise crossfade with near-constant loudness.
const SIN_Q = [0.383, 0.707, 0.924, 1];
function swell(param, t, peak, a, hold, r) {
  param.setValueAtTime(0, t);
  for (let i = 0; i < 4; i++) param.linearRampToValueAtTime(peak * SIN_Q[i], t + (a * (i + 1)) / 4);
  const t2 = t + a + hold;
  param.setValueAtTime(peak, t2);
  for (let i = 0; i < 4; i++)
    param.linearRampToValueAtTime(i < 3 ? peak * SIN_Q[2 - i] : 0, t2 + (r * (i + 1)) / 4);
  return t2 + r;
}

// Randomly stepped amplitude (electric crackle). Returns a gain node feeding
// dest; route sources into it. rate = steps/s, dens = chance a step is on.
function crackle(E, dest, t, dur, rate, peak, dens = 0.6) {
  const g = E._gain(dest, 0);
  const p = g.gain;
  p.setValueAtTime(0, t);
  const end = t + dur;
  let tt = t;
  while (tt < end) {
    const life = 1 - (tt - t) / dur;
    p.setValueAtTime(Math.random() < dens ? peak * rnd(0.25, 1) * (0.3 + 0.7 * life) : 0, tt);
    tt += rnd(0.5, 1.5) / rate;
  }
  p.setValueAtTime(0, end);
  return g;
}

// Hard tanh curve for the brute's distorted roar (built once per engine).
function distCurve(E) {
  if (!E._dist) {
    const n = 1024;
    const curve = new Float32Array(n);
    const k = 5;
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / norm;
    E._dist = curve;
  }
  return E._dist;
}

// One-sided squared pulse curve: turns an inverted saw LFO into sharp thumps.
function pulseCurve(E) {
  if (!E._pulse) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      const y = x > 0.15 ? (x - 0.15) / 0.85 : 0;
      curve[i] = y * y;
    }
    E._pulse = curve;
  }
  return E._pulse;
}

// Heavy mechanical clunk (breaker lever, relay).
function clunk(E, o, t, s = 1) {
  const v = vary(0.06);
  E._osc(o, t, { f: 130 * v, f2: 48, glide: 0.1, d: 0.13, peak: 0.95 * s, a: 0.001 });
  E._noise(o, t, { type: 'bandpass', f: 1600 * v, q: 1.6, d: 0.035, peak: 0.8 * s, a: 0.0005 });
  E._noise(o, t, { type: 'lowpass', f: 700, d: 0.09, peak: 0.5 * s });
  E._osc(o, t, { type: 'square', f: 420 * v, f2: 300, glide: 0.04, d: 0.04, peak: 0.06 * s });
}

// Mains hum (60Hz + harmonics, muffled).
function hum(E, o, t, a, hold, d, peak) {
  const lp = E._filter(o, 'lowpass', 420, 1.5);
  E._osc(lp, t, { type: 'sawtooth', f: 60, a, hold, d, peak });
  E._osc(lp, t, { type: 'sawtooth', f: 60, detune: 9, a, hold, d, peak: peak * 0.6 });
  E._osc(o, t, { f: 120, a, hold, d, peak: peak * 0.35 });
}

// Electric arc: crackle-gated noise + gated mains buzz + initial snap.
function arc(E, o, t, dur, peak) {
  const cr = crackle(E, o, t, dur, 160, peak, 0.65);
  E._noise(cr, t, { type: 'bandpass', f: rnd(2200, 3200), q: 0.7, hold: dur, d: 0.02, peak: 1.0 });
  E._noise(cr, t, { type: 'highpass', f: 5000, hold: dur, d: 0.02, peak: 0.5 });
  const bz = crackle(E, E._filter(o, 'lowpass', 1800, 1), t, dur, 60, peak * 0.6, 0.8);
  E._osc(bz, t, { type: 'sawtooth', f: rnd(110, 125), hold: dur, d: 0.02, peak: 0.8 });
  E._osc(bz, t, { type: 'square', f: rnd(175, 185), hold: dur, d: 0.02, peak: 0.3 });
  E._noise(o, t, { type: 'highpass', f: 3000, d: 0.012, peak, a: 0.0005 });
}

//=============================================================
//                          SOUNDS
//=============================================================
// Each entry: (engine, outNode, startTime) => approximate duration in seconds.

const SOUNDS = {
  //=============================================================
  //                          WEAPONS
  //=============================================================
  shot_pistol(E, o, t) {
    const v = vary(0.07);
    E._noise(o, t, {
      type: 'bandpass',
      f: 2600 * v,
      f2: 900,
      glide: 0.1,
      q: 0.8,
      d: 0.11,
      peak: 1.0,
    });
    E._noise(o, t, { type: 'highpass', f: 5000, d: 0.025, peak: 0.6, a: 0.0005 });
    E._osc(o, t, { f: 190 * v, f2: 55, glide: 0.09, d: 0.12, peak: 0.95, a: 0.001 });
    E._noise(o, t + 0.02, {
      brown: true,
      type: 'lowpass',
      f: 1200,
      f2: 300,
      glide: 0.3,
      a: 0.01,
      d: 0.25,
      peak: 0.2,
    });
    return 0.35;
  },

  shot_shotgun(E, o, t) {
    const v = vary(0.06);
    E._noise(o, t, {
      type: 'lowpass',
      f: 4500 * v,
      f2: 450,
      glide: 0.4,
      q: 0.5,
      d: 0.45,
      peak: 1.25,
    });
    E._noise(o, t, { type: 'highpass', f: 3000, d: 0.04, peak: 0.6, a: 0.0005 });
    E._osc(o, t, { f: 120 * v, f2: 36, glide: 0.3, d: 0.36, peak: 1.15, a: 0.001 });
    E._osc(o, t, { type: 'triangle', f: 70 * v, f2: 30, glide: 0.2, d: 0.25, peak: 0.5, a: 0.001 });
    E._noise(o, t + 0.01, {
      brown: true,
      type: 'lowpass',
      f: 650,
      f2: 110,
      glide: 0.8,
      a: 0.02,
      d: 0.9,
      peak: 0.6,
    });
    return 1.0;
  },

  shot_smg(E, o, t) {
    const v = vary(0.08);
    E._noise(o, t, {
      type: 'bandpass',
      f: 3200 * v,
      f2: 1400,
      glide: 0.05,
      q: 0.9,
      d: 0.055,
      peak: 0.85,
    });
    E._noise(o, t, { type: 'highpass', f: 6000, d: 0.015, peak: 0.4, a: 0.0005 });
    E._osc(o, t, { f: 240 * v, f2: 90, glide: 0.05, d: 0.06, peak: 0.6, a: 0.001 });
    return 0.12;
  },

  shot_rifle(E, o, t) {
    const v = vary(0.06);
    E._noise(o, t, { type: 'highpass', f: 1500 * v, d: 0.09, peak: 0.9, a: 0.0008 });
    E._noise(o, t, { type: 'bandpass', f: 4200 * v, q: 1.2, d: 0.03, peak: 0.75, a: 0.0005 });
    E._osc(o, t, { f: 160 * v, f2: 48, glide: 0.12, d: 0.16, peak: 1.0, a: 0.001 });
    E._noise(o, t + 0.015, {
      brown: true,
      type: 'lowpass',
      f: 900,
      f2: 200,
      glide: 0.5,
      a: 0.01,
      d: 0.45,
      peak: 0.25,
    });
    return 0.6;
  },

  shot_magnum(E, o, t) {
    const v = vary(0.05);
    E._noise(o, t, { type: 'lowpass', f: 6000 * v, f2: 700, glide: 0.35, d: 0.5, peak: 1.3 });
    E._noise(o, t, { type: 'highpass', f: 3500, d: 0.03, peak: 0.8, a: 0.0005 });
    E._osc(o, t, { f: 95 * v, f2: 28, glide: 0.4, d: 0.5, peak: 1.25, a: 0.001 });
    E._osc(E._filter(o, 'lowpass', 900), t, {
      type: 'sawtooth',
      f: 60 * v,
      f2: 25,
      glide: 0.2,
      d: 0.2,
      peak: 0.45,
      a: 0.001,
    });
    E._noise(o, t + 0.02, {
      brown: true,
      type: 'lowpass',
      f: 520,
      f2: 90,
      glide: 1.0,
      a: 0.03,
      d: 1.2,
      peak: 0.6,
    });
    return 1.3;
  },

  shot_lmg(E, o, t) {
    const v = vary(0.08);
    E._noise(o, t, {
      type: 'bandpass',
      f: 1700 * v,
      f2: 600,
      glide: 0.1,
      q: 0.7,
      d: 0.12,
      peak: 1.0,
    });
    E._noise(o, t, { type: 'highpass', f: 4500, d: 0.02, peak: 0.5, a: 0.0005 });
    E._osc(o, t, { f: 130 * v, f2: 45, glide: 0.1, d: 0.13, peak: 1.0, a: 0.001 });
    E._osc(o, t, { type: 'square', f: 65 * v, f2: 40, glide: 0.08, d: 0.07, peak: 0.25, a: 0.001 });
    return 0.2;
  },

  shot_rail(E, o, t) {
    const v = vary(0.05);
    const lp = E._filter(o, 'lowpass', 7000, 4, t, { f2: 700, glide: 0.4 });
    E._osc(o, t, { f: 700 * v, f2: 4200 * v, glide: 0.035, a: 0.001, d: 0.04, peak: 0.25 }); // charge chirp
    E._osc(lp, t, {
      type: 'sawtooth',
      f: 2400 * v,
      f2: 110,
      glide: 0.35,
      a: 0.002,
      d: 0.4,
      peak: 0.5,
    });
    E._osc(lp, t, {
      type: 'sawtooth',
      f: 2400 * v,
      f2: 110,
      glide: 0.35,
      a: 0.002,
      d: 0.4,
      peak: 0.35,
      detune: 28,
    });
    E._noise(o, t, { type: 'highpass', f: 3500, a: 0.005, d: 0.6, peak: 0.4 });
    E._osc(o, t, { f: 160 * v, f2: 40, glide: 0.18, d: 0.2, peak: 0.7, a: 0.001 });
    return 0.8;
  },

  shot_plasma(E, o, t) {
    const v = vary(0.08);
    const lp = E._filter(o, 'lowpass', 3200, 6, t, { f2: 400, glide: 0.2 });
    E._osc(lp, t, {
      type: 'square',
      f: 950 * v,
      f2: 180,
      glide: 0.18,
      d: 0.2,
      peak: 0.38,
      a: 0.002,
    });
    E._osc(o, t, {
      f: 420 * v,
      fEnv: [
        [0.03, 520 * v],
        [0.18, 70],
      ],
      d: 0.18,
      peak: 0.6,
      a: 0.003,
    });
    E._noise(o, t, { type: 'bandpass', f: 2000 * v, q: 2, d: 0.08, peak: 0.28 });
    return 0.3;
  },

  reload(E, o, t) {
    // Mag release + slide out
    E._noise(o, t, { type: 'bandpass', f: 3000, q: 1.5, d: 0.02, peak: 0.7 });
    E._osc(o, t, { type: 'square', f: 1400, f2: 900, glide: 0.015, d: 0.015, peak: 0.12 });
    E._noise(o, t + 0.03, { type: 'bandpass', f: 900, q: 1.2, a: 0.01, d: 0.06, peak: 0.3 });
    // Mag seated: thud + clack
    const t2 = t + 0.27;
    E._osc(o, t2, { f: 260, f2: 120, glide: 0.06, d: 0.07, peak: 0.55 });
    E._noise(o, t2, { type: 'bandpass', f: 1800, q: 2, d: 0.04, peak: 0.75 });
    // Slide/bolt rack: short scrape then sharp clack
    const t3 = t + 0.5;
    E._noise(o, t3, {
      type: 'bandpass',
      f: 1200,
      f2: 3000,
      glide: 0.07,
      q: 1.5,
      a: 0.01,
      d: 0.07,
      peak: 0.4,
    });
    E._noise(o, t3 + 0.09, { type: 'bandpass', f: 2600, q: 1.8, d: 0.03, peak: 0.85 });
    E._osc(o, t3 + 0.09, { type: 'square', f: 780, f2: 500, glide: 0.03, d: 0.03, peak: 0.12 });
    return 0.7;
  },

  empty(E, o, t) {
    E._noise(o, t, { type: 'bandpass', f: 3500, q: 3, d: 0.012, peak: 0.6, a: 0.0005 });
    E._osc(o, t, { type: 'square', f: 2200, d: 0.01, peak: 0.07, a: 0.0005 });
    E._osc(o, t, { f: 600, f2: 400, glide: 0.02, d: 0.02, peak: 0.15, a: 0.0005 });
    return 0.06;
  },

  equip(E, o, t) {
    E._noise(o, t, {
      type: 'bandpass',
      f: 700,
      f2: 2600,
      glide: 0.16,
      q: 1.2,
      a: 0.06,
      d: 0.12,
      peak: 0.35,
    });
    const t2 = t + 0.2;
    E._noise(o, t2, { type: 'bandpass', f: 3000, q: 2, d: 0.02, peak: 0.55 });
    E._osc(o, t2, { type: 'square', f: 1100, d: 0.02, peak: 0.07 });
    E._osc(o, t2, { f: 320, f2: 280, glide: 0.08, d: 0.08, peak: 0.2 });
    return 0.35;
  },

  swing(E, o, t) {
    const v = vary(0.08);
    E._noise(o, t, {
      type: 'bandpass',
      f: 500 * v,
      fEnv: [
        [0.1, 2400 * v],
        [0.24, 700],
      ],
      q: 3,
      a: 0.08,
      d: 0.16,
      peak: 0.6,
    });
    return 0.28;
  },

  stab(E, o, t) {
    const v = vary(0.08);
    E._osc(o, t, { f: 130 * v, f2: 50, glide: 0.1, d: 0.12, peak: 0.9, a: 0.001 });
    E._noise(o, t, { type: 'lowpass', f: 900, d: 0.08, peak: 0.5 });
    E._noise(o, t + 0.01, {
      type: 'bandpass',
      f: 500 * v,
      fEnv: [
        [0.04, 1200 * v],
        [0.13, 350],
      ],
      q: 5,
      a: 0.005,
      d: 0.12,
      peak: 0.55,
    });
    return 0.2;
  },

  explode(E, o, t) {
    const v = vary(0.06);
    E._noise(o, t, {
      brown: true,
      type: 'lowpass',
      f: 1500 * v,
      f2: 120,
      glide: 1.0,
      a: 0.005,
      d: 1.2,
      peak: 1.3,
    });
    E._osc(o, t, { f: 75 * v, f2: 28, glide: 0.6, d: 0.7, peak: 1.0, a: 0.002 });
    E._noise(o, t, { type: 'highpass', f: 2500, a: 0.002, d: 0.35, peak: 0.35 });
    E._osc(E._filter(o, 'lowpass', 2000), t, {
      type: 'sawtooth',
      f: 700 * v,
      f2: 90,
      glide: 0.25,
      d: 0.3,
      peak: 0.22,
    });
    E._noise(o, t + 0.01, {
      type: 'bandpass',
      f: 900,
      f2: 300,
      glide: 0.5,
      q: 1,
      a: 0.01,
      d: 0.5,
      peak: 0.45,
    });
    return 1.3;
  },

  //=============================================================
  //                          ZOMBIES
  //=============================================================
  groan(E, o, t) {
    const c = E.ctx;
    const f0 = rnd(68, 115) * vary(0.05);
    const dur = rnd(1.0, 1.5);
    const end = t + dur;
    const s = rnd(0.85, 1.15); // vowel/formant variation per zombie

    // Amplitude envelope (slow swell, sag, fade)
    const vg = E._gain(o, 0);
    const g = vg.gain;
    g.setValueAtTime(MIN, t);
    g.linearRampToValueAtTime(1.0, t + dur * 0.28);
    g.linearRampToValueAtTime(0.75, t + dur * 0.7);
    expTo(g, MIN, end);

    // Vocal fry / throat rattle: amplitude modulation between 0.4 and 1.0
    const am = E._gain(vg, 0.7);
    E._lfo(t, end, rnd(16, 27), 0.3).connect(am.gain);

    // Formant filters ("uuh" -> "aah" -> "uhh")
    const f1 = E._filter(am, 'bandpass', 340 * s, 5, t, {
      fEnv: [
        [dur * 0.4, 640 * s],
        [dur, 420 * s],
      ],
    });
    const f2g = E._gain(am, 0.6);
    const f2 = E._filter(f2g, 'bandpass', 880 * s, 7, t, {
      fEnv: [
        [dur * 0.45, 1150 * s],
        [dur, 780 * s],
      ],
    });
    const mix = c.createGain();
    mix.gain.value = 1.6;
    mix.connect(f1);
    mix.connect(f2);

    // Two detuned saws with a rise-then-sag pitch contour and slow vibrato.
    const vib = E._lfo(t, end, rnd(4.0, 6.0), f0 * 0.03);
    for (const det of [1, 1.013]) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      const fr = osc.frequency;
      fr.setValueAtTime(f0 * det * rnd(0.85, 0.95), t);
      fr.linearRampToValueAtTime(f0 * det * rnd(1.04, 1.12), t + dur * rnd(0.25, 0.45));
      expTo(fr, f0 * det * rnd(0.68, 0.8), end);
      vib.connect(fr);
      osc.connect(mix);
      osc.start(t);
      osc.stop(end + 0.03);
    }

    // Breath
    E._noise(o, t, {
      type: 'bandpass',
      f: 800 * s,
      q: 1.5,
      a: dur * 0.3,
      hold: dur * 0.3,
      d: dur * 0.4,
      peak: 0.1,
    });
    return dur;
  },

  zattack(E, o, t) {
    const c = E.ctx;
    const f0 = rnd(110, 150) * vary(0.05);
    const dur = 0.45;
    const end = t + dur;
    const vg = E._gain(o, 0);
    env(vg.gain, t, 1.4, 0.03, 0.27, 0.15);
    const am = E._gain(vg, 0.6);
    const growl = E._lfo(t, end, rnd(28, 38), 1);
    const amDepth = E._gain(am.gain, 0.4);
    growl.connect(amDepth);

    const f1 = E._filter(am, 'bandpass', 700, 3, t, {
      fEnv: [
        [0.1, 1000],
        [dur, 600],
      ],
    });
    const f2g = E._gain(am, 0.5);
    const f2 = E._filter(f2g, 'bandpass', 1800, 4);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    freqPath(osc.frequency, t, {
      f: f0,
      fEnv: [
        [0.08, f0 * 1.4],
        [dur, f0 * 0.7],
      ],
    });
    const pitchWobble = E._gain(osc.frequency, f0 * 0.25);
    growl.connect(pitchWobble);
    osc.connect(f1);
    osc.connect(f2);
    osc.start(t);
    osc.stop(end + 0.03);
    E._noise(am, t, { type: 'bandpass', f: 2500, q: 1, a: 0.02, d: 0.3, peak: 0.35 });
    return dur;
  },

  zhit(E, o, t) {
    const v = vary(0.1);
    E._noise(o, t, { type: 'lowpass', f: 1800 * v, f2: 400, glide: 0.08, d: 0.09, peak: 0.8 });
    E._osc(o, t, { f: 150 * v, f2: 55, glide: 0.08, d: 0.1, peak: 0.7, a: 0.001 });
    E._noise(o, t + 0.005, { type: 'bandpass', f: 700 * v, q: 3, d: 0.05, peak: 0.45 });
    return 0.15;
  },

  zdie(E, o, t) {
    const c = E.ctx;
    const f0 = rnd(130, 170) * vary(0.05);
    const dur = 1.1;
    const end = t + dur;
    const vg = E._gain(o, 0);
    env(vg.gain, t, 1.3, 0.02, dur - 0.22, 0.2);
    const am = E._gain(vg, 0.5);
    const gurgle = E._lfo(t, end, rnd(9, 14), 1);
    gurgle.connect(E._gain(am.gain, 0.5));

    const f1 = E._filter(am, 'bandpass', 600, 4, t, { f2: 300, glide: dur });
    const f2g = E._gain(am, 0.5);
    const f2 = E._filter(f2g, 'bandpass', 1100, 5, t, { f2: 700, glide: dur });
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    freqPath(osc.frequency, t, { f: f0, f2: f0 * 0.3, glide: dur });
    gurgle.connect(E._gain(osc.frequency, f0 * 0.15));
    osc.connect(f1);
    osc.connect(f2);
    osc.start(t);
    osc.stop(end + 0.03);
    E._noise(am, t, {
      type: 'lowpass',
      f: 700,
      f2: 200,
      glide: dur,
      a: 0.05,
      hold: 0.3,
      d: 0.7,
      peak: 0.3,
    });
    return dur;
  },

  plank(E, o, t) {
    const v = vary(0.08);
    // Splintering crackles
    const n = 4 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const tt = i === 0 ? t : t + rnd(0.005, 0.09);
      E._noise(o, tt, {
        type: 'bandpass',
        f: rnd(1800, 4500),
        q: rnd(1, 3),
        d: rnd(0.02, 0.05),
        peak: rnd(0.4, 0.85),
        a: 0.0005,
      });
    }
    // Board body knock
    E._osc(o, t, { type: 'triangle', f: 210 * v, f2: 150, glide: 0.1, d: 0.14, peak: 0.5 });
    E._noise(o, t, { type: 'lowpass', f: 1200, d: 0.12, peak: 0.45 });
    // Nail creak
    const bp = E._filter(o, 'bandpass', 700 * v, 9);
    const cf = rnd(60, 80) * v;
    E._osc(bp, t + 0.05, {
      type: 'sawtooth',
      f: cf,
      fEnv: [
        [0.15, cf * 1.35],
        [0.4, cf * 0.85],
      ],
      a: 0.03,
      hold: 0.15,
      d: 0.2,
      peak: 0.9,
    });
    return 0.5;
  },

  //=============================================================
  //                        WORLD / UI
  //=============================================================
  repair(E, o, t) {
    for (const k of [0, 0.19]) {
      const tt = t + k;
      const v = vary(0.06);
      E._osc(o, tt, { f: 180 * v, f2: 70, glide: 0.08, d: 0.1, peak: 0.9, a: 0.001 });
      E._noise(o, tt, { type: 'bandpass', f: 1400 * v, q: 1.5, d: 0.045, peak: 0.7 });
      E._osc(o, tt, { type: 'triangle', f: 620 * v, d: 0.05, peak: 0.15 });
    }
    return 0.35;
  },

  door(E, o, t) {
    E._noise(o, t, {
      brown: true,
      type: 'lowpass',
      f: 380,
      fEnv: [
        [0.3, 600],
        [0.8, 260],
        [1.2, 150],
      ],
      q: 1.5,
      a: 0.08,
      hold: 0.6,
      d: 0.5,
      peak: 1.1,
    });
    E._noise(o, t, {
      type: 'bandpass',
      f: 900,
      f2: 600,
      glide: 1.1,
      q: 0.8,
      a: 0.1,
      hold: 0.5,
      d: 0.4,
      peak: 0.12,
    });
    E._osc(o, t, { f: 55, f2: 40, glide: 1.1, a: 0.1, hold: 0.5, d: 0.5, peak: 0.4 });
    for (const dt of [0.05, rnd(0.3, 0.45), rnd(0.6, 0.8), rnd(0.9, 1.05)]) {
      const tt = t + dt;
      const f = rnd(380, 520);
      E._osc(o, tt, { type: 'triangle', f, d: 0.18, peak: 0.12 });
      E._osc(o, tt, { f: f * 2.71, d: 0.25, peak: 0.1 });
      E._noise(o, tt, { type: 'bandpass', f: 2500, q: 2, d: 0.03, peak: 0.4 });
    }
    return 1.3;
  },

  buy(E, o, t) {
    // mechanical "cha"
    E._noise(o, t, { type: 'bandpass', f: 2500, q: 1.5, d: 0.03, peak: 0.5 });
    E._osc(o, t, { type: 'square', f: 180, f2: 120, glide: 0.04, d: 0.04, peak: 0.1 });
    // "ching"
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    for (const [f, dt, pk] of [
      [1318.5, 0.06, 0.3],
      [1760, 0.12, 0.3],
      [2637, 0.12, 0.12],
    ]) {
      E._osc(e, t + dt, { f, d: 0.7, peak: pk });
      E._osc(e, t + dt, { type: 'triangle', f, d: 0.4, peak: pk * 0.4 });
    }
    return 0.9;
  },

  deny(E, o, t) {
    const lp = E._filter(o, 'lowpass', 900);
    E._osc(lp, t, { type: 'square', f: 110, a: 0.005, hold: 0.18, d: 0.06, peak: 0.25 });
    E._osc(lp, t, { type: 'square', f: 116.5, a: 0.005, hold: 0.18, d: 0.06, peak: 0.25 });
    return 0.28;
  },

  perk(E, o, t) {
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const tt = t + i * 0.09;
      E._osc(e, tt, { type: 'triangle', f, d: 0.18, peak: 0.3 });
      E._osc(e, tt, { f: f * 2, d: 0.1, peak: 0.08 });
    });
    const tp = t + 0.45;
    E._osc(o, tp, { f: 1100, f2: 280, glide: 0.04, d: 0.05, peak: 0.6, a: 0.001 });
    E._noise(o, tp, { type: 'bandpass', f: 3000, q: 1, d: 0.02, peak: 0.5 });
    E._noise(o, tp + 0.03, { type: 'highpass', f: 5000, a: 0.02, d: 0.6, peak: 0.12 });
    return 1.1;
  },

  powerup(E, o, t) {
    const am = E._gain(o, 0.6);
    E._lfo(t, t + 1.0, 14, 0.4).connect(am.gain);
    E._osc(am, t, { f: 500, f2: 1500, glide: 0.9, a: 0.1, hold: 0.4, d: 0.4, peak: 0.22 });
    E._osc(am, t, { f: 753, f2: 2260, glide: 0.9, a: 0.1, hold: 0.4, d: 0.4, peak: 0.15 });
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    for (let i = 0; i < 8; i++) {
      const tt = t + i * 0.1 + rnd(0, 0.05);
      E._osc(e, tt, { f: rnd(2500, 4500) * (1 + i * 0.08), d: 0.08, peak: 0.12 });
    }
    return 1.0;
  },

  pickup(E, o, t) {
    const notes = [783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, i) => {
      const tt = t + i * 0.055;
      const d = i === notes.length - 1 ? 0.35 : 0.15;
      E._osc(o, tt, { type: 'square', f, d, peak: 0.1 });
      E._osc(o, tt, { type: 'triangle', f, d, peak: 0.22 });
    });
    return 0.6;
  },

  crate(E, o, t) {
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    // Intervals slow down like a wheel winding down: 0.13s -> 0.30s, ~3.2s total.
    let tt = t;
    let prev = -1;
    for (let i = 0; i < 16; i++) {
      let idx;
      do idx = (Math.random() * PENTA.length) | 0;
      while (idx === prev);
      prev = idx;
      const f = PENTA[idx];
      E._osc(e, tt, { type: 'triangle', f, d: 0.45, peak: 0.22 });
      E._osc(e, tt, { f: f * 2, d: 0.25, peak: 0.07 });
      tt += 0.13 + (0.17 * i) / 15;
    }
    return 3.6;
  },

  crateDone(E, o, t) {
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    [220, 277.18, 329.63, 440, 554.37].forEach((f, i) => {
      const tt = t + i * 0.04;
      E._osc(e, tt, { type: 'triangle', f, d: 1.4, peak: 0.18 });
      E._osc(e, tt, { f: f * 2, d: 0.6, peak: 0.05 });
    });
    E._osc(e, t + 0.2, { f: 1760, d: 1.0, peak: 0.06, a: 0.05 });
    return 1.8;
  },

  hurt(E, o, t) {
    const v = vary(0.06);
    E._osc(o, t, { f: 95 * v, f2: 45, glide: 0.15, d: 0.2, peak: 1.0, a: 0.001 });
    E._osc(E._filter(o, 'lowpass', 1200), t, {
      type: 'square',
      f: 55 * v,
      f2: 40,
      glide: 0.12,
      d: 0.12,
      peak: 0.3,
      a: 0.001,
    });
    E._noise(o, t, { type: 'lowpass', f: 3000, d: 0.08, peak: 0.45, rate: 0.6 });
    E._noise(o, t, { type: 'bandpass', f: 1100, q: 0.9, d: 0.12, peak: 0.4 });
    return 0.3;
  },

  death(E, o, t) {
    const dur = 2.6;
    const lp = E._filter(o, 'lowpass', 700, 2, t, { f2: 120, glide: dur });
    for (const [f, det] of [
      [110, 0],
      [82.41, 0],
      [55, 0],
      [55, 14],
    ]) {
      E._osc(lp, t, {
        type: 'sawtooth',
        f,
        f2: f * 0.5,
        glide: dur,
        a: 0.15,
        hold: 0.6,
        d: dur - 0.75,
        peak: 0.25,
        detune: det,
      });
    }
    E._osc(o, t, { f: 55, f2: 27, glide: dur, a: 0.2, hold: 0.5, d: 1.8, peak: 0.5 });
    E._noise(o, t, {
      brown: true,
      type: 'lowpass',
      f: 300,
      f2: 120,
      glide: dur,
      a: 0.3,
      hold: 0.5,
      d: 1.6,
      peak: 0.4,
    });
    return dur + 0.1;
  },

  roundStart(E, o, t) {
    const c = E.ctx;
    const dur = 3.5;
    const end = t + dur;
    // Drone chord (D minor, very low) through a swelling lowpass.
    const lp = E._filter(o, 'lowpass', 180, 3, t, {
      fEnv: [
        [1.4, 600],
        [dur, 180],
      ],
    });
    const voices = [
      [73.42, -7, 0.22],
      [73.42, 7, 0.22],
      [110, -5, 0.16],
      [110, 6, 0.16],
      [174.61, 0, 0.1],
    ];
    for (const [f, det, pk] of voices) {
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = det;
      const g = E._gain(lp, 0);
      g.gain.setValueAtTime(MIN, t);
      g.gain.linearRampToValueAtTime(pk, t + 1.3);
      g.gain.linearRampToValueAtTime(pk * 0.8, t + 2.2);
      expTo(g.gain, MIN, end);
      osc.connect(g);
      osc.start(t);
      osc.stop(end + 0.03);
    }
    // Sub
    const sub = E._gain(o, 0);
    sub.gain.setValueAtTime(MIN, t);
    sub.gain.linearRampToValueAtTime(0.45, t + 1.3);
    expTo(sub.gain, MIN, end);
    const so = c.createOscillator();
    so.frequency.value = 36.71;
    so.connect(sub);
    so.start(t);
    so.stop(end + 0.03);
    // Distant bell (inharmonic partials, muffled, with echo).
    const bellOut = E._filter(o, 'lowpass', 2500);
    const bell = E._gain(bellOut, 1);
    bell.connect(E.echoIn);
    const fb = 293.66;
    const partials = [
      [0.5, 0.35, 3.0],
      [1, 0.5, 2.8],
      [1.2, 0.3, 2.0],
      [1.5, 0.18, 1.6],
      [2.0, 0.22, 1.4],
      [2.74, 0.08, 0.8],
    ];
    for (const [m, amp, d] of partials) {
      E._osc(bell, t + 0.35, { f: fb * m, d, peak: amp * 0.35, a: 0.003 });
    }
    for (const [m, amp, d] of partials.slice(0, 3)) {
      E._osc(bell, t + 1.9, { f: fb * m, d: d * 0.5, peak: amp * 0.15, a: 0.003 });
    }
    return dur + 0.1;
  },

  roundEnd(E, o, t) {
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    const notes = [440, 349.23, 329.63, 293.66];
    notes.forEach((f, i) => {
      const tt = t + i * 0.3;
      const d = i === notes.length - 1 ? 0.6 : 0.32;
      E._osc(e, tt, { type: 'triangle', f, d, peak: 0.25, a: 0.01 });
      E._osc(e, tt, { f: f / 2, d, peak: 0.12, a: 0.01 });
    });
    return 1.6;
  },

  //=============================================================
  //                       EXTRA WEAPONS
  //=============================================================
  shot_dbarrel(E, o, t) {
    const v = vary(0.05);
    // Two barrels a hair apart: big blast + a second, slightly darker one.
    E._noise(o, t, {
      type: 'lowpass',
      f: 5000 * v,
      f2: 380,
      glide: 0.5,
      q: 0.5,
      d: 0.6,
      peak: 1.3,
    });
    E._noise(o, t + 0.014, {
      type: 'lowpass',
      f: 3200 * v,
      f2: 260,
      glide: 0.5,
      q: 0.6,
      d: 0.55,
      peak: 1.0,
    });
    E._noise(o, t, { type: 'highpass', f: 2800, d: 0.05, peak: 0.7, a: 0.0005 });
    E._osc(o, t, { f: 105 * v, f2: 28, glide: 0.42, d: 0.55, peak: 1.3, a: 0.001 });
    E._osc(o, t + 0.014, {
      type: 'triangle',
      f: 62 * v,
      f2: 24,
      glide: 0.35,
      d: 0.45,
      peak: 0.7,
      a: 0.001,
    });
    E._osc(E._filter(o, 'lowpass', 700), t, {
      type: 'sawtooth',
      f: 52 * v,
      f2: 22,
      glide: 0.25,
      d: 0.25,
      peak: 0.4,
      a: 0.001,
    });
    E._noise(o, t + 0.02, {
      brown: true,
      type: 'lowpass',
      f: 600,
      f2: 80,
      glide: 1.2,
      a: 0.03,
      d: 1.4,
      peak: 0.75,
    });
    return 1.5;
  },

  shot_autoshot(E, o, t) {
    const v = vary(0.07);
    E._noise(o, t, {
      type: 'lowpass',
      f: 4200 * v,
      f2: 600,
      glide: 0.18,
      q: 0.6,
      d: 0.22,
      peak: 1.1,
    });
    E._noise(o, t, { type: 'highpass', f: 3200, d: 0.03, peak: 0.55, a: 0.0005 });
    E._osc(o, t, { f: 140 * v, f2: 45, glide: 0.12, d: 0.15, peak: 1.0, a: 0.001 });
    E._osc(o, t, { type: 'triangle', f: 80 * v, f2: 38, glide: 0.1, d: 0.1, peak: 0.35, a: 0.001 });
    E._noise(o, t + 0.01, {
      brown: true,
      type: 'lowpass',
      f: 700,
      f2: 150,
      glide: 0.3,
      a: 0.01,
      d: 0.3,
      peak: 0.3,
    });
    return 0.4;
  },

  // Re-triggered every ~0.1s: each burst is an equal-power swell of
  // uncorrelated noise (random buffer offsets, no oscillators), so overlapping
  // bursts crossfade into a steady roar without clicks or comb filtering.
  shot_flamer(E, o, t) {
    const v = vary(0.03);
    const g = E._gain(o, 0);
    const end = swell(g.gain, t, 1, 0.08, 0.02, 0.08);
    const hold = end - t;
    E._noise(g, t, {
      type: 'bandpass',
      f: 850 * v,
      q: 0.6,
      hold,
      d: 0.02,
      peak: 0.75,
      rate: vary(0.05),
    });
    E._noise(g, t, { brown: true, type: 'lowpass', f: 170 * v, q: 0.9, hold, d: 0.02, peak: 1.0 });
    E._noise(g, t, { type: 'highpass', f: 3200 * v, hold, d: 0.02, peak: 0.13 });
    return hold;
  },

  shot_tesla(E, o, t) {
    const v = vary(0.06);
    arc(E, o, t, 0.22, 0.85);
    const bp = E._filter(o, 'bandpass', 2600 * v, 2.5, t, { f2: 350, glide: 0.3 });
    const am = E._gain(bp, 0.6);
    E._lfo(t, t + 0.32, rnd(55, 75), 0.4, 'square').connect(am.gain);
    E._osc(am, t, { type: 'sawtooth', f: 1300 * v, f2: 140, glide: 0.3, d: 0.3, peak: 0.6 });
    E._osc(am, t, { type: 'square', f: 655 * v, f2: 72, glide: 0.3, d: 0.28, peak: 0.25 });
    E._osc(o, t, { f: 200 * v, f2: 60, glide: 0.08, d: 0.1, peak: 0.6, a: 0.001 });
    return 0.35;
  },

  shot_saw(E, o, t) {
    const c = E.ctx;
    const v = vary(0.06);
    // Pneumatic thunk + air release.
    E._osc(o, t, { f: 150 * v, f2: 55, glide: 0.09, d: 0.11, peak: 1.0, a: 0.001 });
    E._noise(o, t, { type: 'lowpass', f: 1400 * v, f2: 300, glide: 0.07, d: 0.08, peak: 0.8 });
    E._noise(o, t, { type: 'bandpass', f: 2200 * v, q: 1.5, d: 0.025, peak: 0.5, a: 0.0005 });
    E._noise(o, t + 0.005, {
      type: 'highpass',
      f: 2500,
      f2: 5000,
      glide: 0.15,
      a: 0.01,
      d: 0.16,
      peak: 0.3,
    });
    // Rising metallic whir (teeth flutter speeds up with the spin).
    const t2 = t + 0.04;
    const end = t2 + 0.38;
    const am = E._gain(o, 0.6);
    const lf = c.createOscillator();
    lf.type = 'square';
    lf.frequency.setValueAtTime(30, t2);
    expTo(lf.frequency, 95, t2 + 0.35);
    lf.connect(E._gain(am.gain, 0.4));
    lf.start(t2);
    lf.stop(end + 0.03);
    const bp = E._filter(am, 'bandpass', 700 * v, 7, t2, { f2: 2300 * v, glide: 0.35 });
    E._osc(bp, t2, {
      type: 'sawtooth',
      f: 350 * v,
      f2: 1150 * v,
      glide: 0.35,
      a: 0.03,
      hold: 0.08,
      d: 0.27,
      peak: 0.6,
    });
    for (const [m, pk] of [
      [1, 0.12],
      [2.76, 0.06],
      [5.4, 0.03],
    ]) {
      E._osc(am, t2, {
        f: 900 * v * m,
        f2: 1600 * v * m,
        glide: 0.35,
        a: 0.02,
        hold: 0.06,
        d: 0.3,
        peak: pk,
      });
    }
    return 0.45;
  },

  saw_hit(E, o, t) {
    const v = vary(0.08);
    const dur = 0.32;
    // Grinding whine, chopped by the blade teeth.
    const bp = E._filter(o, 'bandpass', 1500 * v, 6, t, {
      fEnv: [
        [0.06, 1900 * v],
        [dur, 900 * v],
      ],
    });
    const am = E._gain(bp, 0.55);
    E._lfo(t, t + dur, rnd(38, 50), 0.45, 'square').connect(am.gain);
    E._osc(am, t, {
      type: 'sawtooth',
      f: 900 * v,
      fEnv: [
        [0.05, 1150 * v],
        [dur, 650 * v],
      ],
      a: 0.01,
      hold: 0.12,
      d: 0.18,
      peak: 0.7,
    });
    // Wet squelch + gristle.
    E._noise(o, t, {
      type: 'bandpass',
      f: 400 * v,
      fEnv: [
        [0.05, 1100 * v],
        [0.25, 300],
      ],
      q: 5,
      a: 0.005,
      d: 0.22,
      peak: 0.6,
    });
    E._noise(o, t, { type: 'lowpass', f: 1500, f2: 400, glide: 0.1, d: 0.1, peak: 0.55 });
    const cr = crackle(E, o, t, 0.2, 180, 0.5, 0.5);
    E._noise(cr, t, { type: 'bandpass', f: 2600, q: 1.2, hold: 0.2, d: 0.02, peak: 1 });
    E._osc(o, t, { f: 140 * v, f2: 55, glide: 0.08, d: 0.1, peak: 0.5, a: 0.001 });
    return 0.35;
  },

  burn(E, o, t) {
    const v = vary(0.1);
    // Whoomp: lowpassed brown noise that flares open then closes.
    E._noise(o, t, {
      brown: true,
      type: 'lowpass',
      f: 180 * v,
      fEnv: [
        [0.06, 900 * v],
        [0.35, 250],
      ],
      q: 1.2,
      a: 0.04,
      d: 0.3,
      peak: 1.0,
    });
    E._osc(o, t, {
      f: 60 * v,
      fEnv: [
        [0.05, 95 * v],
        [0.3, 45],
      ],
      a: 0.03,
      d: 0.25,
      peak: 0.45,
    });
    // Sizzle + flame breath.
    const cr = crackle(E, o, t + 0.05, 0.45, 140, 0.5, 0.5);
    E._noise(cr, t + 0.05, { type: 'highpass', f: 3500, a: 0.03, hold: 0.25, d: 0.17, peak: 1.0 });
    E._noise(o, t + 0.04, { type: 'bandpass', f: 1400, q: 0.8, a: 0.05, d: 0.35, peak: 0.12 });
    return 0.55;
  },

  zap(E, o, t) {
    arc(E, o, t, 0.4, 0.95);
    E._osc(o, t, { f: 90, f2: 40, glide: 0.1, d: 0.12, peak: 0.5, a: 0.001 });
    return 0.45;
  },

  //=============================================================
  //                           BRUTE
  //=============================================================
  brute(E, o, t) {
    const c = E.ctx;
    const dur = 1.5;
    const end = t + dur;
    const f0 = rnd(42, 52) * vary(0.04);
    const s = rnd(0.9, 1.1);

    const vg = E._gain(o, 0);
    const g = vg.gain;
    g.setValueAtTime(MIN, t);
    g.linearRampToValueAtTime(1.1, t + 0.22);
    g.linearRampToValueAtTime(0.9, t + 0.95);
    expTo(g, MIN, end);

    // Distortion -> formants ("raaaugh") -> lowpass -> envelope.
    const lp = E._filter(vg, 'lowpass', 2200, 0.7);
    const f1 = E._filter(lp, 'bandpass', 280 * s, 3, t, {
      fEnv: [
        [0.35, 560 * s],
        [dur, 330 * s],
      ],
    });
    const f2g = E._gain(lp, 0.55);
    const f2 = E._filter(f2g, 'bandpass', 760 * s, 4, t, {
      fEnv: [
        [0.4, 1050 * s],
        [dur, 700 * s],
      ],
    });
    const body = E._gain(lp, 0.5);
    const sh = c.createWaveShaper();
    sh.curve = distCurve(E);
    sh.oversample = '2x';
    sh.connect(f1);
    sh.connect(f2);
    sh.connect(body);

    // Growl AM into the drive stage.
    const drive = E._gain(sh, 0.6);
    E._lfo(t, end, rnd(22, 30), 0.35).connect(drive.gain);
    const vib = E._lfo(t, end, rnd(5, 7), f0 * 0.04);
    for (const [det, type] of [
      [1, 'sawtooth'],
      [1.017, 'sawtooth'],
      [0.5, 'square'],
    ]) {
      const osc = c.createOscillator();
      osc.type = type;
      const fr = osc.frequency;
      fr.setValueAtTime(f0 * det * 0.8, t);
      fr.linearRampToValueAtTime(f0 * det * 1.15, t + 0.35);
      expTo(fr, f0 * det * 0.7, end);
      vib.connect(fr);
      osc.connect(drive);
      osc.start(t);
      osc.stop(end + 0.03);
    }
    // Throat noise through the same distortion, plus a clean sub.
    E._noise(drive, t, {
      type: 'bandpass',
      f: 500 * s,
      q: 1.2,
      a: 0.2,
      hold: 0.7,
      d: 0.55,
      peak: 0.5,
    });
    E._osc(o, t, {
      f: f0,
      fEnv: [
        [0.35, f0 * 1.15],
        [dur, f0 * 0.7],
      ],
      a: 0.15,
      hold: 0.6,
      d: 0.7,
      peak: 0.55,
    });
    return dur + 0.05;
  },

  brute_hit(E, o, t) {
    const v = vary(0.07);
    E._osc(o, t, { f: 85 * v, f2: 30, glide: 0.25, d: 0.3, peak: 1.3, a: 0.001 });
    E._noise(o, t, {
      brown: true,
      type: 'lowpass',
      f: 600 * v,
      f2: 100,
      glide: 0.3,
      d: 0.35,
      peak: 1.0,
    });
    E._noise(o, t, { type: 'bandpass', f: 400 * v, q: 1, d: 0.08, peak: 0.7 });
    E._noise(o, t + 0.01, { type: 'highpass', f: 2500, d: 0.05, peak: 0.3 });
    return 0.45;
  },

  //=============================================================
  //                       STORY / WORLD
  //=============================================================
  objective(E, o, t) {
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    for (const [dt, f, d] of [
      [0, 523.25, 0.22],
      [0.13, 783.99, 0.5],
    ]) {
      E._osc(e, t + dt, { type: 'triangle', f, d, peak: 0.28, a: 0.004 });
      E._osc(e, t + dt, { f: f * 2, d: d * 0.5, peak: 0.08, a: 0.004 });
    }
    const bf = 1567.98;
    for (const [m, amp, d] of [
      [1, 0.12, 0.7],
      [2.0, 0.05, 0.5],
      [2.76, 0.04, 0.35],
      [5.4, 0.015, 0.2],
    ]) {
      E._osc(e, t + 0.13, { f: bf * m, d, peak: amp, a: 0.002 });
    }
    return 0.85;
  },

  radio(E, o, t) {
    // Narrow radio band.
    const hp = E._filter(o, 'highpass', 350, 0.7);
    const band = E._filter(hp, 'lowpass', 3200, 0.9);
    // Squelch blips.
    E._osc(band, t, { type: 'square', f: 1250, a: 0.002, hold: 0.03, d: 0.045, peak: 0.12 });
    E._osc(band, t + 0.075, { type: 'square', f: 1650, a: 0.002, hold: 0.025, d: 0.04, peak: 0.1 });
    // Static burst.
    const cr = crackle(E, band, t + 0.02, 0.3, 90, 1.0, 0.75);
    E._noise(cr, t + 0.02, {
      type: 'bandpass',
      f: 1800,
      q: 0.6,
      a: 0.01,
      hold: 0.22,
      d: 0.08,
      peak: 0.6,
    });
    E._noise(band, t + 0.02, { a: 0.005, hold: 0.24, d: 0.06, peak: 0.12 });
    // Squelch tail.
    E._noise(band, t + 0.28, { type: 'highpass', f: 1500, a: 0.003, d: 0.05, peak: 0.35 });
    return 0.4;
  },

  item(E, o, t) {
    E._osc(o, t, { f: 620, f2: 1860, glide: 0.07, a: 0.003, d: 0.08, peak: 0.35 });
    E._noise(o, t, { type: 'bandpass', f: 4000, q: 2, d: 0.015, peak: 0.25 });
    const e = E._gain(o, 1);
    e.connect(E._gain(E.echoIn, 0.5));
    for (const [dt, f] of [
      [0.06, 1318.51],
      [0.12, 1975.53],
    ]) {
      E._osc(e, t + dt, { type: 'triangle', f, d: 0.3, peak: 0.22 });
      E._osc(e, t + dt, { f: f * 2, d: 0.15, peak: 0.07 });
      E._osc(e, t + dt, { type: 'square', f, d: 0.04, peak: 0.05 });
    }
    return 0.5;
  },

  switch(E, o, t) {
    clunk(E, o, t, 1.1);
    E._noise(o, t + 0.045, { type: 'bandpass', f: 2400, q: 2, d: 0.03, peak: 0.45 });
    const cr = crackle(E, o, t + 0.04, 0.08, 220, 0.7, 0.6);
    E._noise(cr, t + 0.04, { type: 'highpass', f: 2500, hold: 0.08, d: 0.02, peak: 0.5 });
    hum(E, o, t + 0.05, 0.04, 0.15, 0.28, 0.28);
    return 0.55;
  },

  power_on(E, o, t) {
    const c = E.ctx;
    const dur = 3.0;
    clunk(E, o, t, 1);
    // Motor whine spinning up.
    const bp = E._filter(o, 'bandpass', 160, 4, t, {
      fEnv: [
        [0.6, 300],
        [2.2, 1500],
        [dur, 1700],
      ],
    });
    E._osc(bp, t + 0.05, {
      type: 'sawtooth',
      f: 30,
      fEnv: [
        [0.6, 55],
        [2.2, 230],
        [dur - 0.05, 250],
      ],
      a: 0.8,
      hold: 1.5,
      d: 0.6,
      peak: 0.45,
    });
    E._osc(o, t + 0.05, {
      f: 120,
      fEnv: [
        [0.6, 220],
        [2.2, 920],
        [dur - 0.05, 1000],
      ],
      a: 1.2,
      hold: 1.1,
      d: 0.6,
      peak: 0.07,
    });
    // Engine chug: brown noise pulsed at a rising rate.
    const chug = E._gain(E._filter(o, 'lowpass', 320, 1), 0.5);
    const lf = c.createOscillator();
    lf.frequency.setValueAtTime(5, t);
    expTo(lf.frequency, 28, t + 2.2);
    lf.connect(E._gain(chug.gain, 0.5));
    lf.start(t);
    lf.stop(t + dur + 0.03);
    E._noise(chug, t, { brown: true, a: 0.4, hold: 2.0, d: 0.55, peak: 0.9 });
    // Deep hum swelling in + sub.
    hum(E, o, t + 0.4, 1.2, 1.0, 0.5, 0.35);
    E._osc(o, t + 0.2, { f: 30, f2: 50, glide: 2.0, a: 1.0, hold: 1.0, d: 0.8, peak: 0.4 });
    // Relay clunks.
    for (const dt of [0.9, 1.6, 2.15, 2.45]) clunk(E, o, t + dt + rnd(-0.04, 0.04), 0.55);
    return dur + 0.1;
  },

  trap_on(E, o, t) {
    const v = vary(0.04);
    // Capacitor charge whine.
    E._osc(o, t, {
      f: 300 * v,
      fEnv: [
        [0.75, 3600 * v],
        [0.85, 3900 * v],
      ],
      a: 0.6,
      hold: 0.2,
      d: 0.08,
      peak: 0.16,
    });
    E._osc(o, t, {
      type: 'triangle',
      f: 450 * v,
      fEnv: [
        [0.75, 5400 * v],
        [0.85, 5850 * v],
      ],
      a: 0.6,
      hold: 0.2,
      d: 0.08,
      peak: 0.06,
    });
    const bp = E._filter(o, 'bandpass', 400, 3, t, { f2: 2400, glide: 0.85 });
    E._osc(bp, t, {
      type: 'sawtooth',
      f: 60,
      f2: 120,
      glide: 0.85,
      a: 0.5,
      hold: 0.3,
      d: 0.08,
      peak: 0.25,
    });
    // Discharge crackle as it arms.
    arc(E, o, t + 0.78, 0.25, 0.7);
    return 1.05;
  },

  alarm(E, o, t) {
    const c = E.ctx;
    const dur = 2.5;
    const end = t + dur;
    const vg = E._gain(o, 0);
    env(vg.gain, t, 0.32, 0.04, 0.25, dur - 0.3);
    vg.connect(E._gain(E.echoIn, 0.3));
    const lp = E._filter(vg, 'lowpass', 2600, 1);
    const lo = 587.33;
    const hi = 783.99;
    const seg = 0.42;
    for (const [type, det] of [
      ['sawtooth', 0],
      ['square', -6],
    ]) {
      const osc = c.createOscillator();
      osc.type = type;
      osc.detune.value = det;
      const fr = osc.frequency;
      let cur = lo;
      let tt = t;
      fr.setValueAtTime(cur, t);
      while (tt < end) {
        const next = cur === lo ? hi : lo;
        fr.setValueAtTime(cur, tt);
        fr.linearRampToValueAtTime(next, tt + 0.06);
        cur = next;
        tt += seg;
      }
      osc.connect(lp);
      osc.start(t);
      osc.stop(end + 0.03);
    }
    return dur + 0.05;
  },

  heli(E, o, t) {
    const c = E.ctx;
    const dur = 5.0;
    const end = t + dur;
    // Approach: fade in over ~4s while a lowpass opens (distance -> close).
    const fade = E._gain(o, 0);
    const fg = fade.gain;
    fg.setValueAtTime(MIN, t);
    fg.linearRampToValueAtTime(0.08, t + 0.8);
    expTo(fg, 1, t + 4.0);
    fg.setValueAtTime(1, t + 4.3);
    expTo(fg, MIN, end);
    const lp = E._filter(fade, 'lowpass', 350, 0.8, t, { f2: 2400, glide: 4.0 });
    // Rotor: inverted saw at ~11Hz shaped into sharp one-sided thumps that gate the noise.
    const pulse = E._gain(lp, 0);
    const rotor = c.createOscillator();
    rotor.type = 'sawtooth';
    rotor.frequency.setValueAtTime(10.2, t);
    rotor.frequency.linearRampToValueAtTime(11.3, end);
    const sh = c.createWaveShaper();
    sh.curve = pulseCurve(E);
    const inv = E._gain(sh, -1);
    rotor.connect(inv);
    sh.connect(pulse.gain);
    rotor.start(t);
    rotor.stop(end + 0.03);
    E._noise(pulse, t, {
      brown: true,
      type: 'lowpass',
      f: 180,
      q: 1,
      a: 0.01,
      hold: dur - 0.3,
      d: 0.25,
      peak: 1.2,
    });
    E._noise(pulse, t, {
      type: 'bandpass',
      f: 900,
      q: 1,
      a: 0.01,
      hold: dur - 0.3,
      d: 0.25,
      peak: 0.25,
    });
    // Turbine whine + engine drone (unpulsed).
    E._osc(fade, t, { f: 2200, a: 0.5, hold: dur - 1.0, d: 0.45, peak: 0.03 });
    E._osc(E._filter(fade, 'lowpass', 200), t, {
      type: 'sawtooth',
      f: 55,
      a: 0.5,
      hold: dur - 1.0,
      d: 0.45,
      peak: 0.12,
    });
    return dur;
  },

  mission_complete(E, o, t) {
    const dur = 2.6;
    const tm = 1.05; // minor -> major resolution point
    const lp = E._filter(o, 'lowpass', 500, 1.2, t, {
      fEnv: [
        [1.0, 1400],
        [1.4, 2600],
        [dur, 1200],
      ],
    });
    const pad = { type: 'sawtooth', a: 0.7, hold: 1.0, d: 0.85 };
    for (const [f, detune, peak] of [
      [110, 0, 0.16],
      [220, -6, 0.14],
      [220, 6, 0.14],
      [329.63, -4, 0.12],
      [329.63, 5, 0.12],
      [440, 0, 0.08],
    ]) {
      E._osc(lp, t, { ...pad, f, detune, peak });
    }
    // The third: C -> C# (A minor -> A major).
    for (const [f, f2, detune, peak, type] of [
      [261.63, 277.18, -5, 0.13, 'sawtooth'],
      [261.63, 277.18, 5, 0.13, 'sawtooth'],
      [523.25, 554.37, 0, 0.08, 'triangle'],
    ]) {
      E._osc(lp, t, {
        ...pad,
        type,
        f,
        fEnv: [
          [tm, f],
          [tm + 0.12, f2],
        ],
        detune,
        peak,
      });
    }
    E._osc(o, t, { f: 55, a: 0.8, hold: 0.9, d: 0.85, peak: 0.35 });
    // Resolution: soft timpani + bells.
    E._osc(o, t + tm, { f: 110, f2: 55, glide: 0.4, a: 0.004, d: 0.5, peak: 0.45 });
    const e = E._gain(o, 1);
    e.connect(E.echoIn);
    [880, 1108.73, 1318.51].forEach((f, i) => {
      E._osc(e, t + tm + i * 0.07, { f, d: 1.2, peak: 0.09, a: 0.003 });
      E._osc(e, t + tm + i * 0.07, { f: f * 2.76, d: 0.4, peak: 0.02, a: 0.003 });
    });
    return dur + 0.1;
  },

  mission_fail(E, o, t) {
    const dur = 2.0;
    // Impact.
    E._osc(o, t, { f: 80, f2: 30, glide: 0.9, d: 1.0, peak: 0.8, a: 0.004 });
    E._noise(o, t, {
      brown: true,
      type: 'lowpass',
      f: 600,
      f2: 90,
      glide: 1.4,
      a: 0.01,
      d: 1.5,
      peak: 0.55,
    });
    // Diminished cluster sinking in pitch and brightness.
    const lp = E._filter(o, 'lowpass', 1400, 1.5, t, { f2: 180, glide: dur });
    for (const [f, detune, peak] of [
      [146.83, -6, 0.18],
      [146.83, 6, 0.18],
      [174.61, 0, 0.15],
      [207.65, 0, 0.13],
      [73.42, 0, 0.2],
    ]) {
      E._osc(lp, t, {
        type: 'sawtooth',
        f,
        fEnv: [
          [0.25, f],
          [dur, f * 0.7],
        ],
        a: 0.03,
        hold: 0.5,
        d: dur - 0.55,
        peak,
        detune,
      });
    }
    // Low bell toll + descending line, with echo.
    const e = E._gain(E._filter(o, 'lowpass', 1800), 1);
    e.connect(E.echoIn);
    for (const [m, amp, d] of [
      [0.5, 0.3, 1.8],
      [1, 0.4, 1.6],
      [1.19, 0.22, 1.2],
      [2.0, 0.15, 0.9],
      [2.74, 0.06, 0.5],
    ]) {
      E._osc(e, t + 0.02, { f: 146.83 * m, d, peak: amp * 0.4, a: 0.003 });
    }
    [
      [0, 293.66, 0.4],
      [0.4, 261.63, 0.4],
      [0.8, 207.65, 1.1],
    ].forEach(([dt, f, d]) => {
      E._osc(e, t + dt, { type: 'triangle', f, d, peak: 0.2, a: 0.01 });
    });
    return dur + 0.1;
  },
};

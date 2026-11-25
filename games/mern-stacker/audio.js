// audio.js - synthesised sound effects for MERN Stacker
// Author: Reachnid Group
// Centennial College - Fall 2026

(function () {
  'use strict';

  // every sound is synthesized with Web Audio: no files to load.
  // nothing in here may throw; a broken audio stack just means silence.

  //=============================================================
  //                           STATE
  //=============================================================

  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;

  //=============================================================
  //                        AUDIO SETUP
  //=============================================================

  // create (or resume) the audio context. Browsers only allow this after a user gesture
  function unlock() {
    if (muted) return;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 2.2;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -8;
        limiter.knee.value = 4;
        limiter.ratio.value = 12;
        master.connect(limiter).connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {
      ctx = null;
    }
  }

  //=============================================================
  //                   SOUND BUILDING BLOCKS
  //=============================================================

  // A volume envelope: quick attack, exponential tail
  function envelope(t, gain, attack, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  // an oscillator note, optionally sliding to `to` Hz and low-pass filtered
  function tone({ freq, to, type = 'sine', at = 0, dur, gain = 0.2, attack = 0.004, lowpass }) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    let node = osc;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = node.connect(f);
    }
    node.connect(envelope(t, gain, attack, dur)).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  // A burst of filtered noise (whooshes, clicks, crashes)
  function hiss({ at = 0, dur, gain = 0.2, type = 'bandpass', freq, to, q = 1, attack = 0.003 }) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    src
      .connect(f)
      .connect(envelope(t, gain, attack, dur))
      .connect(master);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.05);
  }

  // frequency `semitones` above `base`
  const note = (base, semitones) => base * Math.pow(2, semitones / 12);
  const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  //=============================================================
  //                           SOUNDS
  //=============================================================

  const sounds = {
    // two rising blips: npm start
    start() {
      tone({ freq: 392, type: 'square', dur: 0.07, gain: 0.06, lowpass: 2500 });
      tone({ freq: 784, type: 'square', at: 0.07, dur: 0.12, gain: 0.06, lowpass: 2500 });
    },

    // A block landing: a low thunk plus a tiny click. Each layer sits a step higher
    place(layer) {
      const base = [98, 110, 123, 131][layer % 4];
      tone({ freq: base * 2.2, to: base * 0.7, dur: 0.16, gain: 0.45 });
      hiss({ dur: 0.035, gain: 0.12, type: 'lowpass', freq: 2200 });
    },

    // overhang sliced off: a swish that is louder the more you lost (0..1)
    slice(amount) {
      const a = Math.max(0, Math.min(1, amount));
      hiss({ dur: 0.2, gain: 0.2 + 0.25 * a, freq: 5000, to: 700, q: 1.5 });
    },

    // perfect drop: a bell that climbs a pentatonic scale as the streak grows
    perfect(combo) {
      const step = PENTATONIC[Math.min(Math.max(combo, 1) - 1, PENTATONIC.length - 1)];
      const f = note(587.33, step);
      tone({ freq: f, type: 'triangle', dur: 0.4, gain: 0.34 });
      tone({ freq: f * 2, dur: 0.25, gain: 0.06 });
      tone({ freq: f * 3.01, dur: 0.12, gain: 0.03 });
    },

    // the tower earned width back
    grow() {
      tone({ freq: 440, to: 880, at: 0.06, dur: 0.14, gain: 0.07 });
    },

    // A full set shipped: a little major arpeggio fanfare
    release() {
      [0, 4, 7, 12].forEach((n, i) => {
        tone({
          freq: note(523.25, n),
          type: 'square',
          at: 0.08 + i * 0.075,
          dur: 0.16,
          gain: 0.06,
          lowpass: 2600,
        });
      });
      tone({ freq: 1046.5, type: 'triangle', at: 0.38, dur: 0.5, gain: 0.12 });
    },

    // build failed: a detuned error buzz sliding down, over a crash of noise
    fail() {
      tone({ freq: 220, to: 45, type: 'sawtooth', dur: 0.7, gain: 0.16, lowpass: 1400 });
      tone({ freq: 233, to: 48, type: 'square', dur: 0.7, gain: 0.07, lowpass: 900 });
      hiss({ dur: 0.55, gain: 0.3, type: 'lowpass', freq: 3000, to: 150, q: 0.7 });
    },
  };

  //=============================================================
  //                          EXPORTS
  //=============================================================

  // public API: unlock, muted, setMuted, plus one method per sound that never throws
  const api = {
    unlock,
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = !!value;
      if (!muted) unlock();
    },
  };
  for (const [name, play] of Object.entries(sounds)) {
    api[name] = function () {
      if (muted || !ctx) return;
      try {
        play.apply(null, arguments);
      } catch (e) {
        /* silence beats a crash */
      }
    };
  }
  window.MernSfx = api;
})();

'use strict';
const Core = require('../js/core.js');

/*
 * Plays rallies against the AI. The left paddle is "perfect" but aims with a
 * random offset, so the AI receives varied angles. Returns stats about how
 * many balls the AI returned before missing.
 */
function measureAI(level, seed, trials, opts) {
  opts = opts || {};
  const rng = Core.mulberry32(seed);
  const m = Core.createMatch({ mode: '1p', difficulty: level, winScore: 11, ballSpeed: opts.ballSpeed || 'normal', rng });
  let returns = 0, misses = 0, maxStep = 0;
  for (let t = 0; t < trials; t++) {
    Core.serve(m, 1);
    let guard = 0;
    while (m.ball.active && guard++ < 200000) {
      const b = m.ball;
      // Test-only left player: always reaches the ball, hits at a random spot.
      if (b.vx < 0 && b.x < 200) {
        const want = b.y + b.size / 2 - m.left.h / 2 + (rng() * 2 - 1) * 36;
        m.left.y = Math.max(0, Math.min(Core.FIELD.H - m.left.h, want));
      }
      const prevY = m.right.y;
      const prevVx = b.vx;
      Core.step(m, Core.FIXED_DT, { left: 0 });
      maxStep = Math.max(maxStep, Math.abs(m.right.y - prevY));
      if (prevVx > 0 && m.ball.vx < 0) returns++;
      if (guard > 20000 && m.ball.active) break; // safety: AI never misses in very long rally
    }
    if (!m.ball.active) misses++;
    m.scores = [0, 0];
    m.winner = 0;
  }
  return { returns, misses, perMiss: returns / Math.max(1, misses), maxStep };
}

function fakeStorage(initial) {
  const data = Object.assign({}, initial);
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

function fakeAudio() {
  const played = [];
  return { played, play: (n) => played.push(n) };
}

module.exports = { measureAI, fakeStorage, fakeAudio };

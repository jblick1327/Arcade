// core.cjs - tests for the Retro Paddle gameplay rules
// Author: Reachnid Group
// Centennial College - Fall 2026

'use strict';

//=============================================================
//                          IMPORTS
//=============================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const { measureAI, fakeStorage } = require('./helpers.js');

const { FIELD, PADDLE, FIXED_DT } = Core;

function match(opts) {
  return Core.createMatch(Object.assign({ mode: '2p', rng: Core.mulberry32(42) }, opts));
}

// Put the ball just in front of a paddle, moving toward it.
function aimAt(m, side, offsetFromCenter, speed) {
  const b = m.ball,
    p = side === 'left' ? m.left : m.right;
  speed = speed || 400;
  b.active = true;
  b.speed = speed;
  b.y = p.y + p.h / 2 - b.size / 2 + (offsetFromCenter || 0);
  b.vy = 0;
  if (side === 'left') {
    b.x = p.x + p.w + 30;
    b.vx = -speed;
  } else {
    b.x = p.x - b.size - 30;
    b.vx = speed;
  }
}

// Simulate up to `secs` seconds in frame-sized chunks; stops early on a point.
function advanceFor(m, secs, input) {
  let events = [];
  for (let t = 0; t < secs && m.ball.active; t += 1 / 60) {
    events = events.concat(Core.advance(m, 1 / 60, input || {}));
  }
  return events;
}

//=============================================================
//                          PADDLES
//=============================================================
test('paddles cannot leave the field', () => {
  const m = match();
  Core.movePaddle(m.left, -1, 10, PADDLE.SPEED);
  assert.equal(m.left.y, 0);
  Core.movePaddle(m.left, 1, 10, PADDLE.SPEED);
  assert.equal(m.left.y, FIELD.H - m.left.h);
  for (let i = 0; i < 2000; i++) Core.step(m, FIXED_DT, { left: -1, right: 1 });
  assert.equal(m.left.y, 0);
  assert.equal(m.right.y, FIELD.H - m.right.h);
});

test('both paddles move simultaneously and stop when input is released', () => {
  const m = match();
  const l0 = m.left.y,
    r0 = m.right.y;
  Core.advance(m, 0.05, { left: 1, right: -1 });
  assert.ok(m.left.y > l0, 'left moved down');
  assert.ok(m.right.y < r0, 'right moved up');
  const l1 = m.left.y,
    r1 = m.right.y;
  Core.advance(m, 0.05, { left: 0, right: 0 });
  assert.equal(m.left.y, l1);
  assert.equal(m.right.y, r1);
});

test('paddle movement is delta-time independent', () => {
  const a = match(),
    b = match();
  for (let i = 0; i < 30; i++) Core.advance(a, 1 / 30, { left: 1 }); // 30 fps
  for (let i = 0; i < 144; i++) Core.advance(b, 1 / 144, { left: 1 }); // 144 fps
  assert.ok(Math.abs(a.left.y - b.left.y) < 3, `${a.left.y} vs ${b.left.y}`);
});

//=============================================================
//                        BALL / WALLS
//=============================================================
test('ball bounces off top and bottom walls', () => {
  const m = match();
  const b = m.ball;
  Object.assign(b, { active: true, x: 400, y: 2, vx: 300, vy: -300, speed: 424 });
  const ev = Core.step(m, 1 / 60, {});
  assert.ok(ev.includes('wall'));
  assert.ok(b.vy > 0 && b.y >= 0);

  Object.assign(b, { y: FIELD.H - b.size - 2, vy: 300 });
  const ev2 = Core.step(m, 1 / 60, {});
  assert.ok(ev2.includes('wall'));
  assert.ok(b.vy < 0 && b.y + b.size <= FIELD.H);
});

test('serve starts at center with configured speed and enough horizontal velocity', () => {
  for (const speed of ['slow', 'normal', 'fast']) {
    const m = match({ ballSpeed: speed });
    for (let i = 0; i < 50; i++) {
      Core.serve(m);
      const b = m.ball;
      assert.equal(b.x, (FIELD.W - b.size) / 2);
      assert.equal(b.y, (FIELD.H - b.size) / 2);
      assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - Core.BALL_SPEEDS[speed].start) < 1e-6);
      assert.ok(Math.abs(b.vx) >= Core.MIN_VX_RATIO * b.speed - 1e-9);
    }
  }
  assert.ok(Core.BALL_SPEEDS.slow.start < Core.BALL_SPEEDS.normal.start);
  assert.ok(Core.BALL_SPEEDS.normal.start < Core.BALL_SPEEDS.fast.start);
});

//=============================================================
//                     PADDLE COLLISIONS
//=============================================================
test('ball bounces off both paddles', () => {
  const m = match();
  aimAt(m, 'left', 0);
  let ev = Core.advance(m, 0.1, {});
  assert.ok(ev.includes('paddle'));
  assert.ok(m.ball.vx > 0);
  assert.ok(m.ball.x >= m.left.x + m.left.w);

  aimAt(m, 'right', 0);
  ev = Core.advance(m, 0.1, {});
  assert.ok(ev.includes('paddle'));
  assert.ok(m.ball.vx < 0);
  assert.ok(m.ball.x + m.ball.size <= m.right.x);
});

test('bounce angle depends on where the ball hits the paddle', () => {
  const vyFor = (offset) => {
    const m = match();
    aimAt(m, 'left', offset);
    Core.advance(m, 0.1, {});
    return m.ball.vy;
  };
  const top = vyFor(-38),
    upper = vyFor(-15),
    mid = vyFor(0),
    lower = vyFor(15),
    bottom = vyFor(38);
  assert.ok(Math.abs(mid) < 1e-6, 'centre hit goes straight');
  assert.ok(top < upper && upper < 0, 'top half sends ball upward, edge steeper');
  assert.ok(bottom > lower && lower > 0, 'bottom half sends ball downward, edge steeper');
});

test('fast ball cannot tunnel through a paddle, even with one huge step', () => {
  for (const side of ['left', 'right']) {
    const m = match();
    aimAt(m, side, 10, 6000); // far above the max speed
    const ev = Core.step(m, 0.05, {}); // would travel 300px in one step
    assert.ok(ev.includes('paddle'), side + ' paddle should register the hit');
    assert.equal(Math.sign(m.ball.vx), side === 'left' ? 1 : -1);
  }
});

test('missing the paddle still scores (no false collisions)', () => {
  const m = match();
  aimAt(m, 'left', 0);
  m.left.y = 0; // paddle out of the way
  m.ball.y = 400;
  const ev = advanceFor(m, 1);
  assert.ok(!ev.includes('paddle'));
  assert.ok(ev.includes('score'));
});

test('one impact produces exactly one paddle collision', () => {
  const m = match();
  aimAt(m, 'left', 0);
  m.right.y = 0; // keep the right paddle out of the return path
  let hits = 0;
  for (let i = 0; i < 2000 && m.ball.active; i++) {
    // keep the left paddle chasing the ball to tempt a double hit
    const ev = Core.step(m, FIXED_DT, { left: 0 });
    hits += ev.filter((e) => e === 'paddle').length;
  }
  assert.equal(hits, 1);
  assert.deepEqual(m.scores, [1, 0]);
});

test('ball speeds up per hit and never exceeds the maximum', () => {
  for (const setting of ['slow', 'normal', 'fast']) {
    const m = match({ ballSpeed: setting });
    const max = Core.BALL_SPEEDS[setting].max;
    let speed = Core.BALL_SPEEDS[setting].start;
    let prev = speed;
    for (let i = 0; i < 60; i++) {
      aimAt(m, i % 2 ? 'right' : 'left', (i % 7) * 6 - 18, speed);
      const ev = Core.advance(m, 0.1, {}).concat(Core.advance(m, 0.1, {}));
      assert.ok(ev.includes('paddle'));
      const b = m.ball;
      assert.ok(b.speed <= max + 1e-9);
      assert.ok(b.speed >= prev - 1e-9);
      assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - b.speed) < 1e-6);
      assert.ok(Math.abs(b.vx) >= Core.MIN_VX_RATIO * b.speed - 1e-9);
      prev = speed = b.speed;
    }
    assert.equal(speed, max);
  }
});

//=============================================================
//                          SCORING
//=============================================================
test('correct player scores, exactly once, and the ball resets', () => {
  const m = match();
  aimAt(m, 'left', 0);
  m.left.y = 0;
  m.ball.y = 400;
  let events = advanceFor(m, 2);
  for (let i = 0; i < 20; i++) events = events.concat(Core.advance(m, 0.1, {})); // keep running after the point
  assert.equal(events.filter((e) => e === 'score').length, 1);
  assert.deepEqual(m.scores, [0, 1], 'right player (P2) scores when left misses');
  assert.equal(m.ball.active, false);
  assert.equal(m.nextServeDir, -1, 'next serve goes to the player who conceded');

  Core.serve(m, -1);
  assert.equal(m.ball.x, (FIELD.W - m.ball.size) / 2);
  aimAt(m, 'right', 0);
  m.right.y = 0;
  m.ball.y = 400;
  advanceFor(m, 2);
  assert.deepEqual(m.scores, [1, 1]);
});

test('reaching the winning score ends the match', () => {
  for (const winScore of [7, 11]) {
    const m = match({ winScore });
    assert.equal(m.winScore, winScore);
    m.scores = [winScore - 1, 3];
    aimAt(m, 'right', 0);
    m.right.y = 0;
    m.ball.y = 400;
    const ev = advanceFor(m, 2);
    assert.ok(ev.includes('win'));
    assert.equal(m.winner, 1);
  }
  assert.equal(match({}).winScore, 11, 'default is 11');
});

test('resetMatch clears scores, winner and ball', () => {
  const m = match();
  m.scores = [5, 11];
  m.winner = 2;
  m.ball.active = true;
  Core.resetMatch(m);
  assert.deepEqual(m.scores, [0, 0]);
  assert.equal(m.winner, 0);
  assert.equal(m.ball.active, false);
});

//=============================================================
//                            AI
//=============================================================
test('prediction matches a brute-force simulation including wall bounces', () => {
  const rng = Core.mulberry32(7);
  for (let i = 0; i < 50; i++) {
    const b = {
      x: 100 + rng() * 300,
      y: rng() * (FIELD.H - 12),
      vx: 300 + rng() * 500,
      vy: (rng() * 2 - 1) * 900,
      size: 12,
    };
    const targetX = FIELD.W - PADDLE.MARGIN - PADDLE.W;
    const predicted = Core.predictBallY(b, targetX);
    const s = Object.assign({}, b);
    const dt = 1 / 20000;
    while (s.x + s.size < targetX) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < 0) {
        s.y = -s.y;
        s.vy = Math.abs(s.vy);
      }
      if (s.y + s.size > FIELD.H) {
        s.y = 2 * (FIELD.H - s.size) - s.y;
        s.vy = -Math.abs(s.vy);
      }
    }
    assert.ok(Math.abs(predicted - (s.y + s.size / 2)) < 1, `${predicted} vs ${s.y + 6}`);
  }
});

test('AI never teleports and respects field bounds on every difficulty', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    const r = measureAI(level, 11, 30);
    const limit = Core.AI_LEVELS[level].speed * FIXED_DT + 1e-9;
    assert.ok(r.maxStep <= limit, `${level}: ${r.maxStep} > ${limit}`);
  }
  const m = match({ mode: '1p', difficulty: 'hard' });
  for (let i = 0; i < 5000; i++) {
    if (!m.ball.active) Core.serve(m);
    Core.step(m, FIXED_DT, {});
    assert.ok(m.right.y >= 0 && m.right.y <= FIELD.H - m.right.h);
  }
});

test('difficulties behave differently and every level can miss', () => {
  const stats = {};
  for (const level of ['easy', 'medium', 'hard']) {
    let returns = 0,
      misses = 0;
    for (const seed of [1, 2, 3]) {
      const r = measureAI(level, seed, 60);
      returns += r.returns;
      misses += r.misses;
    }
    stats[level] = { perMiss: returns / misses, misses };
    assert.ok(misses > 0, level + ' AI should be able to miss');
  }
  assert.ok(stats.easy.perMiss < stats.medium.perMiss, JSON.stringify(stats));
  assert.ok(stats.medium.perMiss < stats.hard.perMiss, JSON.stringify(stats));
  assert.ok(stats.hard.perMiss > 3 * stats.medium.perMiss, JSON.stringify(stats));
});

test('AI uses its configured speed and does not freeze', () => {
  const m = match({ mode: '1p', difficulty: 'medium' });
  assert.equal(m.ai.cfg, Core.AI_LEVELS.medium);
  m.right.y = 0;
  Core.serve(m, 1);
  m.ball.vy = 0;
  m.ball.vx = m.ball.speed;
  m.ball.y = 500;
  const y0 = m.right.y;
  Core.advance(m, 0.3, {});
  assert.ok(m.right.y > y0 + 20, 'AI moves toward the incoming ball');

  // Ball leaving: AI returns toward the centre instead of sitting still.
  m.ball.vx = -m.ball.speed;
  m.right.y = 0;
  Core.advance(m, 0.5, {});
  assert.ok(m.right.y > 20);
});

//=============================================================
//                          SETTINGS
//=============================================================
test('settings sanitize, save and load', () => {
  assert.deepEqual(Core.sanitizeSettings(null), Core.DEFAULT_SETTINGS);
  assert.deepEqual(
    Core.sanitizeSettings({ difficulty: 'insane', winScore: 3, sound: 'yes', ballSpeed: 'fast' }),
    { difficulty: 'medium', winScore: 11, sound: true, ballSpeed: 'fast' },
  );
  const st = fakeStorage();
  const s = { difficulty: 'hard', winScore: 7, sound: false, ballSpeed: 'slow' };
  assert.equal(Core.saveSettings(st, s), true);
  assert.deepEqual(Core.loadSettings(st), s);

  assert.deepEqual(
    Core.loadSettings(fakeStorage({ [Core.STORAGE_KEY]: '{broken' })),
    Core.DEFAULT_SETTINGS,
  );
  const throwing = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('denied');
    },
  };
  assert.deepEqual(Core.loadSettings(throwing), Core.DEFAULT_SETTINGS);
  assert.equal(Core.saveSettings(throwing, s), false);
});

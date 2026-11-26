// core.js - Retro Paddle gameplay rules (no DOM), shared with the tests
// Author: Reachnid Group
// Centennial College - Fall 2026

// pure gameplay logic: field constants, paddles, ball physics,
// collisions, scoring, computer opponent and settings persistence.
// No DOM access, so it runs unchanged in the browser and in Node tests.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PaddleCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  //=============================================================

  //                  FIXED LOGICAL PLAYFIELD

  //=============================================================

  // physics never depends on screen size
  var FIELD = { W: 800, H: 600 };
  var PADDLE = { W: 12, H: 80, MARGIN: 24, SPEED: 520 };
  var BALL_SIZE = 12;

  var FIXED_DT = 1 / 240; // physics sub-step (s); ball moves < 5px per step at max speed
  var MAX_FRAME_DT = 0.1; // clamp long frames (tab switch, debugger)
  var MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;
  var MAX_SERVE_ANGLE = (30 * Math.PI) / 180;
  var MIN_VX_RATIO = 0.5; // |vx| is always at least half the ball speed
  var SPEED_UP = 1.05; // speed multiplier per paddle hit

  var BALL_SPEEDS = {
    slow: { start: 300, max: 650 },
    normal: { start: 400, max: 850 },
    fast: { start: 500, max: 1050 },
  };

  // speed: px/s, reaction: s between target updates, error: aim offset (px),
  // mistakeChance: chance per incoming ball to badly misjudge it,
  // predict: compute landing point (incl. wall bounces) instead of chasing the ball.
  var AI_LEVELS = {
    easy: {
      speed: 290,
      reaction: 0.22,
      error: 36,
      mistakeChance: 0.15,
      predict: false,
      deadzone: 10,
    },
    medium: {
      speed: 380,
      reaction: 0.12,
      error: 22,
      mistakeChance: 0.06,
      predict: false,
      deadzone: 6,
    },
    hard: {
      speed: 520,
      reaction: 0.05,
      error: 22,
      mistakeChance: 0.04,
      predict: true,
      deadzone: 4,
    },
  };

  //=============================================================

  //                          SETTINGS

  //=============================================================
  var STORAGE_KEY = 'retroPaddle.settings.v1';
  var DEFAULT_SETTINGS = { difficulty: 'medium', winScore: 11, sound: true, ballSpeed: 'normal' };
  var OPTIONS = {
    difficulty: ['easy', 'medium', 'hard'],
    winScore: [7, 11],
    sound: [true, false],
    ballSpeed: ['slow', 'normal', 'fast'],
  };

  function sanitizeSettings(raw) {
    var out = {};
    raw = raw && typeof raw === 'object' ? raw : {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      out[key] = OPTIONS[key].indexOf(raw[key]) >= 0 ? raw[key] : DEFAULT_SETTINGS[key];
    });
    return out;
  }

  function loadSettings(storage) {
    try {
      var raw = storage ? storage.getItem(STORAGE_KEY) : null;
      return sanitizeSettings(raw ? JSON.parse(raw) : {});
    } catch (e) {
      return sanitizeSettings({});
    }
  }

  function saveSettings(storage, settings) {
    try {
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
      return true;
    } catch (e) {
      return false;
    }
  }

  //=============================================================

  //                          HELPERS

  //=============================================================
  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }
  function sign(v) {
    return v > 0 ? 1 : v < 0 ? -1 : 0;
  }

  // Small deterministic PRNG (used by tests for reproducible AI behaviour).
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makePaddle(x) {
    return { x: x, y: (FIELD.H - PADDLE.H) / 2, w: PADDLE.W, h: PADDLE.H };
  }

  function movePaddle(p, dir, dt, speed) {
    p.y = clamp(p.y + dir * speed * dt, 0, FIELD.H - p.h);
    return p;
  }

  //=============================================================

  //                           MATCH

  //=============================================================
  function createAI(level) {
    return {
      level: level,
      cfg: AI_LEVELS[level],
      timer: 0,
      targetY: FIELD.H / 2,
      offset: 0,
      retarget: true,
    };
  }

  function createMatch(opts) {
    opts = opts || {};
    var m = {
      mode: opts.mode === '2p' ? '2p' : '1p',
      difficulty: AI_LEVELS[opts.difficulty] ? opts.difficulty : 'medium',
      winScore: opts.winScore === 7 ? 7 : 11,
      ballSpeed: BALL_SPEEDS[opts.ballSpeed] ? opts.ballSpeed : 'normal',
      rng: opts.rng || Math.random,
      left: makePaddle(PADDLE.MARGIN),
      right: makePaddle(FIELD.W - PADDLE.MARGIN - PADDLE.W),
      ball: { x: 0, y: 0, vx: 0, vy: 0, size: BALL_SIZE, speed: 0, active: false },
      scores: [0, 0],
      winner: 0,
      rally: 0,
      accumulator: 0,
      nextServeDir: 0,
    };
    m.speeds = BALL_SPEEDS[m.ballSpeed];
    m.ai = createAI(m.difficulty);
    centerBall(m);
    return m;
  }

  function resetMatch(m) {
    m.scores = [0, 0];
    m.winner = 0;
    m.rally = 0;
    m.accumulator = 0;
    m.nextServeDir = 0;
    m.left.y = m.right.y = (FIELD.H - PADDLE.H) / 2;
    m.ai = createAI(m.difficulty);
    centerBall(m);
    return m;
  }

  function centerBall(m) {
    var b = m.ball;
    b.x = (FIELD.W - b.size) / 2;
    b.y = (FIELD.H - b.size) / 2;
    b.vx = b.vy = 0;
    b.speed = 0;
    b.active = false;
  }

  function enforceMinVx(b) {
    var minVx = MIN_VX_RATIO * b.speed;
    if (Math.abs(b.vx) < minVx) {
      var sx = sign(b.vx) || 1;
      var sy = sign(b.vy) || 1;
      b.vx = sx * minVx;
      b.vy = sy * Math.sqrt(Math.max(0, b.speed * b.speed - minVx * minVx));
    }
  }

  // dir: +1 serves toward the right player, -1 toward the left, 0/undefined = random.
  function serve(m, dir) {
    centerBall(m);
    var b = m.ball;
    dir = dir === 1 || dir === -1 ? dir : m.rng() < 0.5 ? -1 : 1;
    var angle = (m.rng() * 2 - 1) * MAX_SERVE_ANGLE;
    b.speed = m.speeds.start;
    b.vx = dir * b.speed * Math.cos(angle);
    b.vy = b.speed * Math.sin(angle);
    enforceMinVx(b);
    b.active = true;
    m.rally = 0;
    m.ai.retarget = true;
  }

  function bounceOff(m, p, dir) {
    var b = m.ball;
    var rel = (b.y + b.size / 2 - (p.y + p.h / 2)) / (p.h / 2 + b.size / 2);
    var angle = clamp(rel, -1, 1) * MAX_BOUNCE_ANGLE;
    b.speed = Math.min(b.speed * SPEED_UP, m.speeds.max);
    b.vx = dir * b.speed * Math.cos(angle);
    b.vy = b.speed * Math.sin(angle);
    enforceMinVx(b);
    m.rally++;
    m.ai.retarget = true;
  }

  /*
   * Swept paddle collision. dir = +1 for the left paddle (ball leaves to the
   * right), -1 for the right paddle. Only called while the ball moves toward
   * the paddle, so one impact can never register twice.
   */
  function collidePaddle(m, p, px, py, dir) {
    var b = m.ball,
      s = b.size;
    var face = dir === 1 ? p.x + p.w : p.x;
    var prevLead = dir === 1 ? px : px + s;
    var curLead = dir === 1 ? b.x : b.x + s;
    var before = (prevLead - face) * dir; // >= 0: leading edge was on the field side
    var after = (curLead - face) * dir; // < 0: leading edge is now past the face
    var hit = false;

    if (before >= 0 && after < 0) {
      // Interpolate where the ball was when it crossed the face plane.
      var t = before / (before - after);
      var yAt = py + (b.y - py) * t;
      hit = yAt + s > p.y && yAt < p.y + p.h;
    }
    if (!hit && after < 0) {
      // Ball already overlaps the paddle body (e.g. paddle moved onto it):
      // still a return if the ball's centre hasn't passed the paddle's centre.
      var inX = b.x < p.x + p.w && b.x + s > p.x;
      var inY = b.y + s > p.y && b.y < p.y + p.h;
      hit = inX && inY && (b.x + s / 2 - (p.x + p.w / 2)) * dir > 0;
    }
    if (!hit) return false;

    b.x = dir === 1 ? face : face - s;
    bounceOff(m, p, dir);
    return true;
  }

  // Predict the ball's centre Y when its leading edge reaches targetX, folding wall bounces.
  function predictBallY(b, targetX) {
    var s = b.size;
    if (b.vx <= 0) return b.y + s / 2;
    var t = Math.max(0, (targetX - (b.x + s)) / b.vx);
    var span = FIELD.H - s;
    var period = 2 * span;
    var y = b.y + b.vy * t;
    y = ((y % period) + period) % period;
    if (y > span) y = period - y;
    return y + s / 2;
  }

  // Returns a movement direction in [-1, 1] for the right paddle.
  function aiDecide(m, dt) {
    var ai = m.ai,
      cfg = ai.cfg,
      b = m.ball,
      p = m.right;

    if (ai.retarget) {
      // A new incoming ball: pick this rally's aim error and start the reaction delay.
      ai.retarget = false;
      if (m.rng() < cfg.mistakeChance) {
        ai.offset = (m.rng() < 0.5 ? -1 : 1) * (p.h / 2 + b.size + 10 + m.rng() * 30);
      } else {
        ai.offset = (m.rng() * 2 - 1) * cfg.error;
      }
      ai.timer = cfg.reaction;
    }

    ai.timer -= dt;
    if (ai.timer <= 0) {
      ai.timer = cfg.reaction;
      if (b.active && b.vx > 0) {
        var y = cfg.predict ? predictBallY(b, p.x) : b.y + b.size / 2;
        ai.targetY = y + ai.offset;
      } else {
        ai.targetY = FIELD.H / 2; // ball going away: drift back to the middle
      }
    }

    var diff = ai.targetY - (p.y + p.h / 2);
    if (Math.abs(diff) <= cfg.deadzone) return 0;
    var maxMove = cfg.speed * dt;
    return clamp(diff / maxMove, -1, 1); // never overshoots, never exceeds max speed
  }

  function humanDir(v) {
    return sign(v || 0);
  }

  function awardPoint(m, scorer, events) {
    m.ball.active = false;
    m.scores[scorer]++;
    m.nextServeDir = scorer === 0 ? 1 : -1; // serve toward the player who conceded
    events.push('score');
    if (m.scores[scorer] >= m.winScore) {
      m.winner = scorer + 1;
      events.push('win');
    }
  }

  // One fixed physics sub-step. input: { left: -1|0|1, right: -1|0|1 }.
  function step(m, dt, input) {
    var events = [];
    input = input || {};

    var rightDir = m.mode === '1p' ? aiDecide(m, dt) : humanDir(input.right);
    movePaddle(m.left, humanDir(input.left), dt, PADDLE.SPEED);
    movePaddle(m.right, rightDir, dt, m.mode === '1p' ? m.ai.cfg.speed : PADDLE.SPEED);

    var b = m.ball;
    if (!b.active || m.winner) return events;

    var px = b.x,
      py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (b.y < 0) {
      b.y = -b.y;
      b.vy = Math.abs(b.vy);
      events.push('wall');
    } else if (b.y + b.size > FIELD.H) {
      b.y = 2 * (FIELD.H - b.size) - b.y;
      b.vy = -Math.abs(b.vy);
      events.push('wall');
    }
    b.y = clamp(b.y, 0, FIELD.H - b.size);

    if (b.vx < 0) {
      if (collidePaddle(m, m.left, px, py, 1)) events.push('paddle');
    } else if (b.vx > 0) {
      if (collidePaddle(m, m.right, px, py, -1)) events.push('paddle');
    }

    if (b.x + b.size < 0) awardPoint(m, 1, events);
    else if (b.x > FIELD.W) awardPoint(m, 0, events);

    return events;
  }

  // Advance by a variable frame time using fixed sub-steps (delta-time independent).
  function advance(m, frameDt, input) {
    var events = [];
    m.accumulator += clamp(frameDt || 0, 0, MAX_FRAME_DT);
    while (m.accumulator >= FIXED_DT) {
      m.accumulator -= FIXED_DT;
      var ev = step(m, FIXED_DT, input);
      for (var i = 0; i < ev.length; i++) events.push(ev[i]);
      if (ev.indexOf('score') >= 0) {
        m.accumulator = 0;
        break;
      }
    }
    return events;
  }

  return {
    FIELD: FIELD,
    PADDLE: PADDLE,
    BALL_SIZE: BALL_SIZE,
    FIXED_DT: FIXED_DT,
    MAX_BOUNCE_ANGLE: MAX_BOUNCE_ANGLE,
    MIN_VX_RATIO: MIN_VX_RATIO,
    SPEED_UP: SPEED_UP,
    BALL_SPEEDS: BALL_SPEEDS,
    AI_LEVELS: AI_LEVELS,
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    OPTIONS: OPTIONS,
    sanitizeSettings: sanitizeSettings,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    mulberry32: mulberry32,
    createMatch: createMatch,
    resetMatch: resetMatch,
    centerBall: centerBall,
    serve: serve,
    movePaddle: movePaddle,
    predictBallY: predictBallY,
    aiDecide: aiDecide,
    step: step,
    advance: advance,
  };
});

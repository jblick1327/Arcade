// app.cjs - tests for the Retro Paddle menus and match flow
// Author: Reachnid Group
// Centennial College - Fall 2026

'use strict';

//=============================================================
//                          IMPORTS
//=============================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../js/core.js');
const { createApp, COUNT_STEP, COUNT_STEPS } = require('../js/app.js');
const { fakeStorage, fakeAudio } = require('./helpers.js');

function newApp(extra) {
  const deps = Object.assign(
    { storage: fakeStorage(), audio: fakeAudio(), rng: Core.mulberry32(5) },
    extra,
  );
  return { app: createApp(deps), deps };
}
function press(app, code) {
  app.keyDown(code, false);
  app.keyUp(code);
}
function run(app, seconds, dt) {
  dt = dt || 1 / 60;
  for (let t = 0; t < seconds; t += dt) app.update(dt);
}
function runUntil(app, pred, maxSeconds) {
  for (let t = 0; t < maxSeconds; t += 1 / 60) {
    if (pred()) return true;
    app.update(1 / 60);
  }
  return pred();
}
function labels(app) {
  return app.getMenu().items.map((i) => i.label);
}

//=============================================================
//                           TESTS
//=============================================================

test('main menu lists the four options and supports keyboard navigation', () => {
  const { app } = newApp();
  assert.equal(app.state, 'menu');
  assert.equal(app.getMenu().title, 'RETRO PADDLE');
  assert.deepEqual(labels(app), ['1 PLAYER', '2 PLAYERS', 'HOW TO PLAY', 'SETTINGS']);
  press(app, 'ArrowDown');
  assert.equal(app.selected, 1);
  press(app, 'ArrowUp');
  press(app, 'ArrowUp');
  assert.equal(app.selected, 3, 'wraps around');
  press(app, 'Enter');
  assert.equal(app.state, 'settings');
  press(app, 'Escape');
  assert.equal(app.state, 'menu');
});

test('mouse hover selects and click activates menu items', () => {
  const { app } = newApp();
  const r = app.getMenuLayout().items[2];
  app.pointerMove(r.x + 5, r.y + 5);
  assert.equal(app.selected, 2);
  assert.equal(app.pointerDown(r.x + 5, r.y + 5), true);
  assert.equal(app.state, 'howto');
  assert.equal(app.pointerDown(1, 1), false, 'click outside items does nothing');
  const back = app.getMenuLayout().items[0];
  app.pointerDown(back.x + 10, back.y + 10);
  assert.equal(app.state, 'menu');
});

test('1 player goes through difficulty selection, then countdown, then serve', () => {
  const { app } = newApp();
  press(app, 'Enter'); // 1 PLAYER
  assert.equal(app.state, 'modeSelect');
  assert.equal(app.getMenu().items[app.selected].id, 'medium', 'preselects saved difficulty');
  press(app, 'ArrowDown');
  press(app, 'Enter'); // HARD
  assert.equal(app.state, 'countdown');
  assert.equal(app.match.mode, '1p');
  assert.equal(app.match.difficulty, 'hard');
  assert.equal(app.settings.difficulty, 'hard', 'choice is remembered');
  assert.equal(app.match.ball.active, false);
  assert.equal(app.countdownValue(), 3);
  run(app, COUNT_STEP * COUNT_STEPS + 0.05);
  assert.equal(app.state, 'playing');
  assert.equal(app.match.ball.active, true);
});

test('2 players: W/S drive left paddle, arrows drive right paddle', () => {
  const { app } = newApp();
  press(app, 'ArrowDown');
  press(app, 'Enter');
  assert.equal(app.match.mode, '2p');
  const l0 = app.match.left.y,
    r0 = app.match.right.y;
  app.keyDown('KeyS');
  app.keyDown('ArrowUp');
  run(app, 0.2);
  assert.ok(app.match.left.y > l0);
  assert.ok(app.match.right.y < r0);
  app.keyUp('KeyS');
  app.keyUp('ArrowUp');
  const l1 = app.match.left.y,
    r1 = app.match.right.y;
  run(app, 0.2);
  assert.equal(app.match.left.y, l1, 'stops immediately on release');
  assert.equal(app.match.right.y, r1);
});

test('pause completely freezes the simulation; resume continues', () => {
  const { app } = newApp();
  app.startMatch('2p');
  run(app, 2.0); // into play
  assert.equal(app.state, 'playing');
  press(app, 'Escape');
  assert.equal(app.state, 'paused');
  assert.deepEqual(labels(app), ['RESUME', 'RESTART', 'MAIN MENU']);
  const snap = JSON.stringify([app.match.ball, app.match.left, app.match.right, app.match.scores]);
  app.keyDown('KeyW');
  run(app, 3);
  app.keyUp('KeyW');
  assert.equal(
    JSON.stringify([app.match.ball, app.match.left, app.match.right, app.match.scores]),
    snap,
  );
  press(app, 'Escape');
  assert.equal(app.state, 'playing');
  const x = app.match.ball.x;
  run(app, 0.1);
  assert.notEqual(app.match.ball.x, x);
});

test('pausing during countdown also freezes the countdown', () => {
  const { app } = newApp();
  app.startMatch('1p');
  run(app, 0.3);
  const c = app.countdown;
  press(app, 'Escape');
  run(app, 5);
  assert.equal(app.countdown, c);
  press(app, 'Enter'); // RESUME
  assert.equal(app.state, 'countdown');
});

test('pause menu: restart resets the match, main menu leaves it', () => {
  const { app } = newApp();
  app.startMatch('2p');
  app.match.scores = [4, 2];
  press(app, 'Escape');
  press(app, 'ArrowDown');
  press(app, 'Enter'); // RESTART
  assert.equal(app.state, 'countdown');
  assert.deepEqual(app.match.scores, [0, 0]);
  press(app, 'Escape');
  press(app, 'ArrowUp');
  press(app, 'Enter'); // MAIN MENU (wrap)
  assert.equal(app.state, 'menu');
  assert.equal(app.match, null);
});

test('losing window focus pauses and releases held keys', () => {
  const { app } = newApp();
  app.startMatch('2p');
  app.keyDown('KeyW');
  app.blur();
  assert.equal(app.state, 'paused');
  assert.deepEqual(app.keys, {});
});

test('full 1-player match from main menu to winner screen, then play again', () => {
  const { app, deps } = newApp();
  // Settings: first to 7, to keep the run short.
  press(app, 'ArrowUp');
  press(app, 'Enter'); // SETTINGS
  press(app, 'ArrowDown');
  press(app, 'ArrowRight'); // WINNING SCORE 11 -> 7
  assert.equal(app.settings.winScore, 7);
  press(app, 'Escape');
  press(app, 'ArrowDown');
  press(app, 'Enter'); // 1 PLAYER (menu remembers SETTINGS index 3 -> 0)
  assert.equal(app.state, 'modeSelect');
  press(app, 'Enter'); // MEDIUM

  // Human idles: the computer should win, but every point must be counted once.
  let points = 0,
    prev = app.state;
  const done = runUntil(
    app,
    () => {
      if (app.state === 'point' && prev !== 'point') points++;
      prev = app.state;
      return app.state === 'gameOver';
    },
    600,
  );
  assert.ok(done, 'match finished');
  const s = app.match.scores;
  assert.equal(s[0] + s[1], points, 'one score per point, no duplicates');
  assert.equal(Math.max(s[0], s[1]), 7);
  assert.ok(Math.min(s[0], s[1]) < 7);
  assert.equal(app.getMenu().title, 'PLAYER ' + (s[0] === 7 ? 1 : 2) + ' WINS');
  assert.deepEqual(labels(app), ['PLAY AGAIN', 'MAIN MENU']);
  assert.ok(deps.audio.played.includes('win'));
  assert.ok(deps.audio.played.includes('score'));
  assert.ok(deps.audio.played.includes('count'));

  press(app, 'Enter'); // PLAY AGAIN
  assert.equal(app.state, 'countdown');
  assert.deepEqual(app.match.scores, [0, 0]);
  assert.equal(app.match.winner, 0);
  assert.equal(app.match.mode, '1p');

  app.match.scores = [6, 0]; // jump near the end and go to MAIN MENU from game over
  runUntil(app, () => app.state === 'gameOver', 600);
  press(app, 'ArrowDown');
  press(app, 'Enter');
  assert.equal(app.state, 'menu');
});

test('onMatchEnd fires exactly once per finished match, with the final match', () => {
  const ended = [];
  const { app } = newApp({
    rng: Core.mulberry32(7),
    onMatchEnd: (m) => ended.push({ mode: m.mode, scores: m.scores.slice() }),
  });
  app.settings.winScore = 7;
  app.startMatch('1p');
  assert.ok(runUntil(app, () => app.state === 'gameOver', 600));
  run(app, 2); // staying on the game-over screen must not fire it again
  assert.equal(ended.length, 1);
  assert.equal(ended[0].mode, '1p');
  assert.equal(Math.max(ended[0].scores[0], ended[0].scores[1]), 7);
});

test('full 2-player match ends with the winner screen', () => {
  const { app } = newApp({ rng: Core.mulberry32(99) });
  app.settings.winScore = 7;
  app.startMatch('2p');
  assert.ok(runUntil(app, () => app.state === 'gameOver', 600));
  assert.equal(Math.max(...app.match.scores), 7);
});

test('settings persist across app instances and affect gameplay', () => {
  const storage = fakeStorage();
  const a = createApp({ storage, audio: fakeAudio() });
  press(a, 'ArrowUp');
  press(a, 'Enter'); // SETTINGS
  press(a, 'ArrowRight'); // difficulty medium -> hard
  press(a, 'ArrowDown');
  press(a, 'Enter'); // win score 11 -> 7
  press(a, 'ArrowDown');
  press(a, 'Enter'); // sound on -> off
  press(a, 'ArrowDown');
  press(a, 'ArrowLeft'); // ball normal -> slow
  const expected = { difficulty: 'hard', winScore: 7, sound: false, ballSpeed: 'slow' };
  assert.deepEqual(a.settings, expected);

  const b = createApp({ storage, audio: fakeAudio() }); // "after refresh"
  assert.deepEqual(b.settings, expected);
  b.settings.ballSpeed = 'fast';
  b.startMatch('1p');
  assert.equal(b.match.winScore, 7);
  assert.equal(b.match.ai.cfg, Core.AI_LEVELS.hard);
  run(b, 2);
  assert.ok(b.match.ball.speed >= Core.BALL_SPEEDS.fast.start);
});

test('sound off silences every effect; sound on plays them', () => {
  const on = newApp();
  on.app.startMatch('2p');
  run(on.app, 5);
  assert.ok(on.deps.audio.played.length > 0);

  const off = newApp();
  off.app.settings.sound = false;
  off.app.startMatch('2p');
  run(off.app, 5);
  press(off.app, 'Escape');
  press(off.app, 'ArrowDown');
  assert.equal(off.deps.audio.played.length, 0);
});

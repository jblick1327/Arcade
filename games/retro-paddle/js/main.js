/*
 * main.js — browser wiring: canvas scaling, keyboard/mouse input, game loop.
 */
(function () {
  'use strict';

  var Core = window.PaddleCore;
  var W = Core.FIELD.W, H = Core.FIELD.H;
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var audio = window.PaddleAudio.create();

  var storage = null;
  try { storage = window.localStorage; } catch (e) { storage = null; }

  // Arcade leaderboard: only 1-player matches count, and the score is the
  // number of points the player took off the AI. 2-player games aren't saved.
  function onMatchEnd(m) {
    if (m.mode !== '1p' || !window.Arcade) return;
    window.Arcade.submitScore(m.scores[0]);
  }

  var app = window.PaddleApp.createApp({ storage: storage, audio: audio, onMatchEnd: onMatchEnd });
  var view = { scale: 1, cssScale: 1 };

  // Fit the fixed 800x600 field into the window, keeping the 4:3 aspect ratio.
  function resize() {
    var cssScale = Math.min(window.innerWidth / W, window.innerHeight / H);
    var cssW = Math.floor(W * cssScale), cssH = Math.floor(H * cssScale);
    var dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    view.cssScale = cssW / W;
    view.scale = canvas.width / W;
  }

  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) };
  }

  var BLOCK_DEFAULT = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };

  window.addEventListener('keydown', function (e) {
    audio.unlock();
    var handled = app.keyDown(e.code, e.repeat);
    if (handled || BLOCK_DEFAULT[e.code]) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { app.keyUp(e.code); });
  window.addEventListener('blur', function () { app.blur(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) app.blur(); });

  canvas.addEventListener('mousemove', function (e) {
    var p = toLogical(e);
    app.pointerMove(p.x, p.y);
    canvas.style.cursor = app.hover >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('mousedown', function (e) {
    audio.unlock();
    var p = toLogical(e);
    if (app.pointerDown(p.x, p.y)) e.preventDefault();
    canvas.style.cursor = app.hitTest(p.x, p.y) >= 0 ? 'pointer' : 'default';
  });

  window.addEventListener('resize', resize);
  resize();

  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    app.update(dt);
    window.PaddleRender.render(ctx, app, view.scale);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  canvas.focus();
  window.RetroPaddle = { app: app, audio: audio, view: view }; // debugging hook
})();

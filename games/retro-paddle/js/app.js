// app.js - Retro Paddle game-state machine: menus, countdown, play, pause and game over
// Author: Reachnid Group
// Centennial College - Fall 2026

// game-state machine: menus, mode selection, countdown, playing,
// paused, point scored, game over, settings and how-to-play.
// Receives abstract key codes / pointer positions; owns no DOM.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.PaddleApp = factory(root.PaddleCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  var W = Core.FIELD.W;
  var COUNT_STEP = 0.6; // seconds per countdown number
  var COUNT_STEPS = 3; // 3, 2, 1
  var POINT_PAUSE = 0.9; // seconds of stillness after a point
  var IN_GAME = { countdown: true, playing: true, point: true };

  var LABELS = {
    difficulty: { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' },
    ballSpeed: { slow: 'SLOW', normal: 'NORMAL', fast: 'FAST' },
  };

  var HOWTO_LINES = [
    'SEND THE BALL PAST YOUR',
    "OPPONENT'S PADDLE TO SCORE.",
    'THE SPOT WHERE THE BALL HITS',
    'YOUR PADDLE SETS ITS ANGLE.',
    'LONG RALLIES GET FASTER.',
    '',
    '1 PLAYER   W/S  OR  UP/DOWN',
    '2 PLAYERS  P1 W/S   P2 UP/DOWN',
    'ESC        PAUSE / RESUME',
  ];

  function createApp(deps) {
    deps = deps || {};

    var app = {
      state: 'menu',
      selected: 0,
      hover: -1,
      settings: Core.loadSettings(deps.storage),
      match: null,
      keys: {},
      countdown: 0,
      lastCount: 0,
      pointTimer: 0,
      pausedFrom: null,
    };

    function sound(name) {
      if (app.settings.sound && deps.audio) deps.audio.play(name);
    }

    function setState(state, selected) {
      app.state = state;
      app.selected = selected || 0;
      app.hover = -1;
    }

    function saveSettings() {
      Core.saveSettings(deps.storage, app.settings);
    }

    //=============================================================

    //                           MENUS

    //=============================================================
    function getMenu() {
      var s = app.settings;
      switch (app.state) {
        case 'menu':
          return {
            title: 'RETRO PADDLE',
            items: [
              { id: '1p', label: '1 PLAYER' },
              { id: '2p', label: '2 PLAYERS' },
              { id: 'howto', label: 'HOW TO PLAY' },
              { id: 'settings', label: 'SETTINGS' },
            ],
          };
        case 'modeSelect':
          return {
            title: '1 PLAYER',
            subtitle: 'SELECT DIFFICULTY',
            items: [
              { id: 'easy', label: 'EASY' },
              { id: 'medium', label: 'MEDIUM' },
              { id: 'hard', label: 'HARD' },
              { id: 'back', label: 'BACK' },
            ],
          };
        case 'settings':
          return {
            title: 'SETTINGS',
            subtitle: 'LEFT / RIGHT OR ENTER TO CHANGE',
            items: [
              { id: 'difficulty', label: 'AI DIFFICULTY  ' + LABELS.difficulty[s.difficulty] },
              { id: 'winScore', label: 'WINNING SCORE  ' + s.winScore },
              { id: 'sound', label: 'SOUND  ' + (s.sound ? 'ON' : 'OFF') },
              { id: 'ballSpeed', label: 'BALL SPEED  ' + LABELS.ballSpeed[s.ballSpeed] },
              { id: 'back', label: 'BACK' },
            ],
          };
        case 'howto':
          return {
            title: 'HOW TO PLAY',
            lines: HOWTO_LINES,
            itemsY: 520,
            items: [{ id: 'back', label: 'BACK' }],
          };
        case 'paused':
          return {
            title: 'PAUSED',
            overlay: true,
            items: [
              { id: 'resume', label: 'RESUME' },
              { id: 'restart', label: 'RESTART' },
              { id: 'menu', label: 'MAIN MENU' },
            ],
          };
        case 'gameOver':
          return {
            title: 'PLAYER ' + (app.match ? app.match.winner : 1) + ' WINS',
            overlay: true,
            items: [
              { id: 'again', label: 'PLAY AGAIN' },
              { id: 'menu', label: 'MAIN MENU' },
            ],
          };
        default:
          return null;
      }
    }

    // Shared by the renderer and pointer hit-testing (logical coordinates).
    function getMenuLayout(menu) {
      menu = menu || getMenu();
      if (!menu) return null;
      var itemsY = menu.itemsY || 270;
      return {
        titleY: menu.lines ? 90 : 140,
        subtitleY: 205,
        linesY: 170,
        lineHeight: 34,
        items: menu.items.map(function (item, i) {
          return { x: W / 2 - 220, y: itemsY + i * 58, w: 440, h: 46 };
        }),
      };
    }

    function hitTest(x, y) {
      var layout = getMenuLayout();
      if (!layout) return -1;
      for (var i = 0; i < layout.items.length; i++) {
        var r = layout.items[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
      }
      return -1;
    }

    function toMenu(selected) {
      app.match = null;
      setState('menu', selected);
    }

    function cycleSetting(id, dir) {
      var opts = Core.OPTIONS[id];
      if (!opts) return;
      var i = opts.indexOf(app.settings[id]);
      app.settings[id] = opts[(i + dir + opts.length) % opts.length];
      saveSettings();
      sound('blip');
    }

    function activate(index) {
      var menu = getMenu();
      if (!menu || !menu.items[index]) return;
      var id = menu.items[index].id;
      app.selected = index;

      switch (app.state) {
        case 'menu':
          sound('blip');
          if (id === '1p')
            setState('modeSelect', Core.OPTIONS.difficulty.indexOf(app.settings.difficulty));
          else if (id === '2p') startMatch('2p');
          else if (id === 'howto') setState('howto');
          else if (id === 'settings') setState('settings');
          break;
        case 'modeSelect':
          sound('blip');
          if (id === 'back') {
            toMenu(0);
            break;
          }
          app.settings.difficulty = id;
          saveSettings();
          startMatch('1p');
          break;
        case 'settings':
          if (id === 'back') {
            sound('blip');
            toMenu(3);
          } else cycleSetting(id, 1);
          break;
        case 'howto':
          sound('blip');
          toMenu(2);
          break;
        case 'paused':
          sound('blip');
          if (id === 'resume') resume();
          else if (id === 'restart') startMatch(app.match.mode);
          else toMenu(0);
          break;
        case 'gameOver':
          sound('blip');
          if (id === 'again') startMatch(app.match.mode);
          else toMenu(0);
          break;
      }
    }

    function back() {
      if (app.state === 'paused') resume();
      else if (app.state === 'settings') toMenu(3);
      else if (app.state === 'howto') toMenu(2);
      else if (app.state === 'modeSelect') toMenu(0);
      else if (app.state === 'gameOver') toMenu(0);
    }

    function moveSelection(delta) {
      var menu = getMenu();
      var n = menu.items.length;
      app.selected = (app.selected + delta + n) % n;
      sound('blip');
    }

    //=============================================================

    //                        MATCH FLOW

    //=============================================================
    function startMatch(mode) {
      app.match = Core.createMatch({
        mode: mode,
        difficulty: app.settings.difficulty,
        winScore: app.settings.winScore,
        ballSpeed: app.settings.ballSpeed,
        rng: deps.rng,
      });
      startCountdown();
    }

    function startCountdown() {
      Core.centerBall(app.match);
      app.countdown = COUNT_STEPS * COUNT_STEP;
      app.lastCount = COUNT_STEPS + 1;
      setState('countdown');
    }

    function pause() {
      app.pausedFrom = app.state;
      setState('paused');
    }

    function resume() {
      setState(app.pausedFrom || 'playing');
      app.pausedFrom = null;
    }

    function input() {
      var k = app.keys,
        m = app.match;
      var up = !!k.KeyW,
        down = !!k.KeyS;
      if (m.mode === '1p') {
        up = up || !!k.ArrowUp;
        down = down || !!k.ArrowDown;
      }
      return {
        left: (down ? 1 : 0) - (up ? 1 : 0),
        right: m.mode === '2p' ? (k.ArrowDown ? 1 : 0) - (k.ArrowUp ? 1 : 0) : 0,
      };
    }

    function update(dt) {
      dt = Math.min(Math.max(dt || 0, 0), 0.1);
      var m = app.match;
      switch (app.state) {
        case 'countdown': {
          Core.advance(m, dt, input()); // paddles may move; ball is parked
          app.countdown -= dt;
          var n = Math.ceil(app.countdown / COUNT_STEP);
          if (n > 0 && n < app.lastCount) {
            app.lastCount = n;
            sound('count');
          }
          if (app.countdown <= 0) {
            Core.serve(m, m.nextServeDir);
            setState('playing');
            sound('go');
          }
          break;
        }
        case 'playing': {
          var events = Core.advance(m, dt, input());
          for (var i = 0; i < events.length; i++) {
            if (events[i] === 'paddle') sound('paddle');
            else if (events[i] === 'wall') sound('wall');
            else if (events[i] === 'score') {
              sound('score');
              app.pointTimer = POINT_PAUSE;
              setState('point');
            }
          }
          break;
        }
        case 'point':
          Core.advance(m, dt, input());
          app.pointTimer -= dt;
          if (app.pointTimer <= 0) {
            if (m.winner) {
              setState('gameOver');
              sound('win');
              if (deps.onMatchEnd) deps.onMatchEnd(m);
            } else startCountdown();
          }
          break;
        // paused / menus: simulation is frozen
      }
    }

    //=============================================================

    //                    INPUT ENTRY POINTS

    //=============================================================
    function keyDown(code, repeat) {
      app.keys[code] = true;
      var isUp = code === 'ArrowUp' || code === 'KeyW';
      var isDown = code === 'ArrowDown' || code === 'KeyS';
      var isEnter = code === 'Enter' || code === 'NumpadEnter' || code === 'Space';

      if (IN_GAME[app.state]) {
        if (code === 'Escape' && !repeat) {
          pause();
          return true;
        }
        return isUp || isDown || code === 'Space';
      }
      if (!getMenu()) return false;

      if (isUp) moveSelection(-1);
      else if (isDown) moveSelection(1);
      else if (isEnter) {
        if (!repeat) activate(app.selected);
      } else if (
        app.state === 'settings' &&
        (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD')
      ) {
        var item = getMenu().items[app.selected];
        if (item.id !== 'back')
          cycleSetting(item.id, code === 'ArrowLeft' || code === 'KeyA' ? -1 : 1);
      } else if (code === 'Escape') {
        if (!repeat) back();
      } else return false;
      return true;
    }

    function keyUp(code) {
      delete app.keys[code];
    }

    function pointerMove(x, y) {
      if (!getMenu()) {
        app.hover = -1;
        return;
      }
      var i = hitTest(x, y);
      app.hover = i;
      if (i >= 0) app.selected = i;
    }

    function pointerDown(x, y) {
      if (!getMenu()) return false;
      var i = hitTest(x, y);
      if (i < 0) return false;
      activate(i);
      return true;
    }

    // Window lost focus: forget held keys and pause a running game.
    function blur() {
      app.keys = {};
      if (IN_GAME[app.state]) pause();
    }

    function countdownValue() {
      return app.state === 'countdown' ? Math.max(1, Math.ceil(app.countdown / COUNT_STEP)) : 0;
    }

    app.getMenu = getMenu;
    app.getMenuLayout = getMenuLayout;
    app.hitTest = hitTest;
    app.update = update;
    app.keyDown = keyDown;
    app.keyUp = keyUp;
    app.pointerMove = pointerMove;
    app.pointerDown = pointerDown;
    app.blur = blur;
    app.countdownValue = countdownValue;
    app.startMatch = startMatch;
    app.isInGame = function () {
      return !!IN_GAME[app.state];
    };
    return app;
  }

  return {
    createApp: createApp,
    COUNT_STEP: COUNT_STEP,
    COUNT_STEPS: COUNT_STEPS,
    POINT_PAUSE: POINT_PAUSE,
  };
});

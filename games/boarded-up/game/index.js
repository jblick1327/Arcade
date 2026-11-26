// index.js - Boarded Up public entry point: menus, screens, sizing and the main loop (createGame)
// Author: Reachnid Group
// Centennial College - Fall 2026

// Public entry point. Embeddable anywhere (plain page, React component, etc.):
//
//   import { createGame } from './game/index.js';
//   const game = createGame(document.getElementById('host'), {
//     onGameOver: (stats) => console.log(stats),   // { level, round, kills, points, timeSeconds, ... }
//     onRoundStart: (round) => {},
//   });
//   game.destroy(); // when unmounting

import { Game } from './core/game.js';
import { LEVELS, getLevel } from './core/map.js';
import { CAMPAIGN, getMission } from './core/missions.js';
import { Renderer, VIEW_W, VIEW_H } from './core/renderer.js';
import { buildAssets } from './core/assets.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { drawHud } from './hud.js';

export const GAME_TITLE = 'BOARDED UP';
export { LEVELS };

const STYLE_ID = 'bu-game-styles';
const CSS = `
.bu-root{position:relative;width:100%;height:100%;min-height:240px;background:#000;overflow:hidden;user-select:none;-webkit-user-select:none;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#eee}
.bu-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair}
.bu-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(20,4,4,.55),rgba(0,0,0,.92));z-index:2;padding:16px;box-sizing:border-box;overflow:auto}
.bu-overlay[hidden]{display:none}
.bu-panel{max-width:680px;width:100%;text-align:center;margin:auto}
.bu-title{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:clamp(44px,10vw,96px);letter-spacing:.06em;color:#b3140e;margin:0;line-height:1;text-shadow:0 0 28px rgba(179,20,14,.55),3px 3px 0 #000}
.bu-h2{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:clamp(30px,6vw,48px);letter-spacing:.06em;color:#b3140e;margin:0 0 18px;text-shadow:2px 2px 0 #000}
.bu-sub{margin:10px 0 26px;color:#bfb3a8;font-size:clamp(13px,2vw,16px);letter-spacing:.04em}
.bu-menu{display:flex;flex-direction:column;gap:10px;align-items:center}
.bu-btn{font:inherit;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:#b3140e;color:#fff;border:0;border-radius:4px;padding:12px 30px;min-width:220px;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.15) inset,0 6px 24px rgba(179,20,14,.35)}
.bu-btn:hover{background:#d01a12}
.bu-btn.ghost{background:rgba(255,255,255,.06);box-shadow:0 0 0 1px rgba(255,255,255,.16) inset}
.bu-btn.ghost:hover{background:rgba(255,255,255,.12)}
.bu-btn:focus-visible{outline:2px solid #fff;outline-offset:3px}
.bu-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.bu-controls{display:grid;grid-template-columns:auto auto;gap:5px 18px;justify-content:center;margin:0 auto;font-size:14px;color:#a99d93;text-align:left}
.bu-controls b{color:#e8ddd2;font-weight:600;text-align:right}
.bu-tips{margin:20px auto 0;max-width:520px;text-align:left;color:#a99d93;font-size:14px;line-height:1.55;padding-left:18px}
.bu-tips li{margin:3px 0}
.bu-levels{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.bu-level{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:18px 16px;text-align:left;display:flex;flex-direction:column;gap:8px;cursor:pointer;color:inherit;font:inherit}
.bu-level:hover,.bu-level:focus-visible{border-color:#b3140e;background:rgba(179,20,14,.12);outline:none}
.bu-level .n{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:26px;letter-spacing:.04em;color:#f2efe6}
.bu-level .d{color:#a99d93;font-size:14px;line-height:1.45;flex:1}
.bu-level .b{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#f5d76e}
.bu-setting{display:grid;grid-template-columns:150px 1fr 48px;gap:12px;align-items:center;max-width:460px;margin:0 auto 14px;text-align:left;font-size:14px;color:#cfc4ba}
.bu-setting input{width:100%;accent-color:#b3140e}
.bu-setting output{text-align:right;color:#f5d76e;font-variant-numeric:tabular-nums}
.bu-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:0 0 8px}
.bu-stat{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:10px 6px}
.bu-stat .v{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:28px;color:#f5d76e}
.bu-stat .l{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a99d93}
.bu-best{color:#f5d76e;font-size:14px;letter-spacing:.06em;margin:6px 0 0}
.bu-missions{display:flex;flex-direction:column;gap:8px;max-width:520px;margin:0 auto}
.bu-mission{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;text-align:left;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:12px 14px;color:inherit;font:inherit;cursor:pointer}
.bu-mission:hover:not([disabled]),.bu-mission:focus-visible{border-color:#b3140e;background:rgba(179,20,14,.12);outline:none}
.bu-mission[disabled]{opacity:.4;cursor:not-allowed}
.bu-mission .num{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:28px;color:#b3140e;text-align:center}
.bu-mission .t{font-family:Impact,Haettenschweiler,"Arial Narrow Bold",sans-serif;font-size:20px;letter-spacing:.04em;color:#f2efe6}
.bu-mission .loc{font-size:12px;color:#a99d93;letter-spacing:.04em}
.bu-mission .st{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#f5d76e}
.bu-story{max-width:560px;margin:0 auto 8px;text-align:left;color:#cfc4ba;font-size:15px;line-height:1.65}
.bu-story p{margin:0 0 12px}
.bu-loc{color:#7fd4ff;font-size:13px;letter-spacing:.12em;text-transform:uppercase;margin:-8px 0 18px}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

const CONTROLS = [
  ['WASD', 'Move'],
  ['Mouse', 'Look'],
  ['Left click', 'Shoot'],
  ['Right click (hold)', 'Aim down sights'],
  ['Shift', 'Sprint'],
  ['E (hold)', 'Rebuild window barrier'],
  ['E', 'Buy / open door / crate / perk'],
  ['R', 'Reload'],
  ['V / F', 'Knife'],
  ['Q / Wheel / 1-2', 'Swap weapon'],
  ['Esc', 'Pause'],
];

const TIPS = [
  'Zombies break in through boarded windows. Hold E at a window to rebuild it: every board is worth points.',
  'Spend points to clear debris doors, buy the chalk weapons on the walls, and gamble at the Mystery Crate.',
  'Zombies come through the windows near you, so pick where you fight.',
  'Lead the horde around a loop (a pillar, a planter, a ring of rooms) instead of getting cornered.',
  'The knife out-reaches a zombie swing and staggers it. Use it to save ammo early on.',
  'Drink machines sell perks: Iron Hide for more health, Quick Hands for faster reloads and repairs.',
];

//=============================================================
//                          STORAGE
//=============================================================
const SETTINGS_KEY = 'boardedUp.settings';
const CAMPAIGN_KEY = 'boardedUp.campaign';
const BEST_KEY = 'boardedUp.best';
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === 'object' ? { ...fallback, ...v } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function createGame(container, options = {}) {
  injectStyles();
  const assets = buildAssets();
  const audio = new AudioEngine();
  const settings = load(SETTINGS_KEY, { sensitivity: 1, volume: 0.8 });
  const best = load(BEST_KEY, {});
  const progress = load(CAMPAIGN_KEY, { unlocked: 0, done: {} });

  const root = document.createElement('div');
  root.className = 'bu-root';
  const canvas = document.createElement('canvas');
  canvas.className = 'bu-canvas';
  canvas.tabIndex = 0;
  const overlay = document.createElement('div');
  overlay.className = 'bu-overlay';
  root.append(canvas, overlay);
  container.appendChild(root);

  const ctx = canvas.getContext('2d');
  const renderer = new Renderer(assets);
  const view = document.createElement('canvas');
  view.width = VIEW_W;
  view.height = VIEW_H;
  const vctx = view.getContext('2d');
  const imageData = new ImageData(new Uint8ClampedArray(renderer.buf.buffer), VIEW_W, VIEW_H);
  const input = new Input(canvas);

  function applySettings() {
    input.sensitivity = 0.0022 * settings.sensitivity;
    audio.setVolume(settings.volume);
    audio.setMuted(!!options.muted || settings.volume <= 0);
  }
  applySettings();

  let levelId = options.level || LEVELS[0].id;
  let missionId = null; // set while playing the campaign
  let game = new Game({ audio, level: getLevel(levelId) });
  // mode: menu | playing | paused | gameover
  let mode = 'menu';
  let screen = 'main';
  let raf = 0;
  let last = performance.now();
  let destroyed = false;
  let rect = { x: 0, y: 0, w: 1, h: 1 };
  let gameOverAt = 0;
  let lastStats = null;

  // A quiet scene behind the menus: the start room, camera slowly turning.
  function menuScene() {
    game = new Game({ audio: { play() {} }, level: getLevel(levelId) });
    game.intermission = 1e9;
  }
  menuScene();

  //=============================================================
  //                          SCREENS
  //=============================================================
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const controlsHtml = () =>
    `<div class="bu-controls">${CONTROLS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('')}</div>`;

  function show(name) {
    screen = name;
    overlay.hidden = false;
    let html = '';
    if (name === 'main') {
      html = `<div class="bu-panel">
        <h1 class="bu-title">${GAME_TITLE}</h1>
        <p class="bu-sub">Board up the windows. Hold the line. Survive the night.</p>
        <div class="bu-menu">
          <button class="bu-btn" data-act="story">Story</button>
          <button class="bu-btn" data-act="levels">Survival</button>
          <button class="bu-btn ghost" data-act="howto">How to play</button>
          <button class="bu-btn ghost" data-act="settings">Settings</button>
        </div>
      </div>`;
    } else if (name === 'levels') {
      html = `<div class="bu-panel">
        <h2 class="bu-h2">SURVIVAL</h2>
        <div class="bu-levels">${LEVELS.map(
          (l) => `
          <button class="bu-level" data-act="start" data-level="${l.id}">
            <span class="n">${esc(l.name)}</span>
            <span class="d">${esc(l.blurb)}</span>
            <span class="b">${best[l.id] ? `Best: round ${best[l.id]}` : 'Not survived yet'}</span>
          </button>`,
        ).join('')}
        </div>
        <div class="bu-row"><button class="bu-btn ghost" data-act="main">Back</button></div>
      </div>`;
    } else if (name === 'story') {
      html = `<div class="bu-panel">
        <h2 class="bu-h2">LAST BROADCAST</h2>
        <p class="bu-sub">A five-mission campaign through the night Harrow fell.</p>
        <div class="bu-missions">${CAMPAIGN.map((m, i) => {
          const locked = i > progress.unlocked;
          return `<button class="bu-mission" data-act="brief" data-mission="${m.id}" ${locked ? 'disabled' : ''}>
            <span class="num">${i + 1}</span>
            <span><div class="t">${locked ? 'Locked' : esc(m.title)}</div><div class="loc">${locked ? 'Complete the previous mission' : esc(m.location)}</div></span>
            <span class="st">${progress.done[m.id] ? 'Done' : locked ? '' : 'Play'}</span>
          </button>`;
        }).join('')}</div>
        <div class="bu-row"><button class="bu-btn ghost" data-act="main">Back</button></div>
      </div>`;
    } else if (name === 'briefing') {
      const m = getMission(missionId);
      const n = CAMPAIGN.indexOf(m) + 1;
      html = `<div class="bu-panel">
        <h2 class="bu-h2">MISSION ${n}: ${esc(m.title.toUpperCase())}</h2>
        <p class="bu-loc">${esc(m.location)}</p>
        <div class="bu-story">${m.briefing.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        <div class="bu-row">
          <button class="bu-btn" data-act="mission">Begin mission</button>
          <button class="bu-btn ghost" data-act="story">Back</button>
        </div>
      </div>`;
    } else if (name === 'debrief') {
      const m = getMission(missionId);
      const i = CAMPAIGN.indexOf(m);
      const next = CAMPAIGN[i + 1];
      const st = lastStats;
      const mm = Math.floor(st.timeSeconds / 60),
        ss = String(st.timeSeconds % 60).padStart(2, '0');
      html = `<div class="bu-panel">
        <h2 class="bu-h2">MISSION COMPLETE</h2>
        <p class="bu-loc">${esc(m.title)}</p>
        <div class="bu-story">${m.debrief.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        <div class="bu-stats">
          <div class="bu-stat"><div class="v">${st.kills}</div><div class="l">Kills</div></div>
          <div class="bu-stat"><div class="v">${mm}:${ss}</div><div class="l">Time</div></div>
          <div class="bu-stat"><div class="v">${st.accuracy}%</div><div class="l">Accuracy</div></div>
        </div>
        <div class="bu-row">
          ${next ? `<button class="bu-btn" data-act="brief" data-mission="${next.id}">Next: ${esc(next.title)}</button>` : ''}
          <button class="bu-btn ghost" data-act="story">Campaign</button>
        </div>
      </div>`;
    } else if (name === 'failed') {
      const m = getMission(missionId);
      html = `<div class="bu-panel">
        <h2 class="bu-h2" style="font-size:clamp(34px,7vw,60px)">MISSION FAILED</h2>
        <p class="bu-sub">${esc(m.title)}: ${esc((game.mission && game.mission.objective.text) || '')}</p>
        <div class="bu-row">
          <button class="bu-btn" data-act="mission">Retry</button>
          <button class="bu-btn ghost" data-act="story">Campaign</button>
        </div>
      </div>`;
    } else if (name === 'howto') {
      html = `<div class="bu-panel">
        <h2 class="bu-h2">HOW TO PLAY</h2>
        ${controlsHtml()}
        <ul class="bu-tips">${TIPS.map((t) => `<li>${t}</li>`).join('')}</ul>
        <div class="bu-row"><button class="bu-btn ghost" data-act="${mode === 'paused' ? 'paused' : 'main'}">Back</button></div>
      </div>`;
    } else if (name === 'settings') {
      html = `<div class="bu-panel">
        <h2 class="bu-h2">SETTINGS</h2>
        <label class="bu-setting">Mouse sensitivity
          <input type="range" min="0.3" max="2.5" step="0.05" value="${settings.sensitivity}" data-set="sensitivity">
          <output>${settings.sensitivity.toFixed(2)}</output></label>
        <label class="bu-setting">Volume
          <input type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-set="volume">
          <output>${Math.round(settings.volume * 100)}%</output></label>
        <div class="bu-row"><button class="bu-btn ghost" data-act="${mode === 'paused' ? 'paused' : 'main'}">Back</button></div>
      </div>`;
    } else if (name === 'paused') {
      html = `<div class="bu-panel">
        <h2 class="bu-h2">PAUSED</h2>
        <p class="bu-sub">${game.mission ? esc(game.mission.def.title) + ' &middot; ' + esc(game.mission.objective.text) : `${esc(game.level.name)} &middot; Round ${game.round} &middot; ${game.player.points} points`}</p>
        <div class="bu-menu">
          <button class="bu-btn" data-act="resume">Resume</button>
          <button class="bu-btn ghost" data-act="howto">How to play</button>
          <button class="bu-btn ghost" data-act="settings">Settings</button>
          <button class="bu-btn ghost" data-act="quit">Quit to main menu</button>
        </div>
      </div>`;
    } else if (name === 'gameover') {
      const s = lastStats;
      const mm = Math.floor(s.timeSeconds / 60),
        ss = String(s.timeSeconds % 60).padStart(2, '0');
      html = `<div class="bu-panel">
        <h2 class="bu-h2" style="font-size:clamp(34px,7vw,64px)">YOU DIDN'T MAKE IT</h2>
        <p class="bu-sub">${esc(s.levelName)} &middot; survived ${s.round} round${s.round === 1 ? '' : 's'}</p>
        <div class="bu-stats">
          <div class="bu-stat"><div class="v">${s.round}</div><div class="l">Rounds</div></div>
          <div class="bu-stat"><div class="v">${s.kills}</div><div class="l">Kills</div></div>
          <div class="bu-stat"><div class="v">${s.points}</div><div class="l">Points</div></div>
          <div class="bu-stat"><div class="v">${mm}:${ss}</div><div class="l">Time</div></div>
          <div class="bu-stat"><div class="v">${s.accuracy}%</div><div class="l">Accuracy</div></div>
        </div>
        <p class="bu-best">${s.newBest ? 'New best for this map!' : `Best on this map: round ${best[s.level] || s.round}`}</p>
        <div class="bu-row">
          <button class="bu-btn" data-act="restart">Play again</button>
          <button class="bu-btn ghost" data-act="quit">Main menu</button>
        </div>
      </div>`;
    }
    overlay.innerHTML = html;
    const first = overlay.querySelector('[data-act]');
    if (first) first.focus({ preventScroll: true });
  }

  function hideOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  function lockPointer() {
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch {
      /* unsupported */
    }
  }

  function startGame(id) {
    levelId = id;
    missionId = null;
    game = new Game({ audio, level: getLevel(id) });
    beginPlay();
  }

  function startMission(id) {
    missionId = id;
    game = new Game({ audio, mission: getMission(id) });
    beginPlay();
  }

  function beginPlay() {
    audio.init();
    applySettings();
    audio.resume();
    mode = 'playing';
    input.enabled = true;
    input.clear();
    hideOverlay();
    lockPointer();
    canvas.focus({ preventScroll: true });
    last = performance.now();
  }

  function toMenu() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    mode = 'menu';
    input.enabled = false;
    input.clear();
    menuScene();
    show('main');
  }

  overlay.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    audio.init();
    if (act === 'start') startGame(el.dataset.level);
    else if (act === 'brief') {
      missionId = el.dataset.mission;
      show('briefing');
    } else if (act === 'mission') startMission(missionId);
    else if (act === 'resume') beginPlay();
    else if (act === 'restart') {
      if (performance.now() - gameOverAt > 900) startGame(levelId);
    } else if (act === 'quit') toMenu();
    else show(act); // main | levels | howto | settings | paused
  });

  overlay.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.set;
    if (!key) return;
    settings[key] = parseFloat(e.target.value);
    const out = e.target.parentElement.querySelector('output');
    if (out)
      out.textContent =
        key === 'volume' ? `${Math.round(settings.volume * 100)}%` : settings[key].toFixed(2);
    applySettings();
    save(SETTINGS_KEY, settings);
  });

  canvas.addEventListener('click', () => {
    if (mode === 'playing' && document.pointerLockElement !== canvas) lockPointer();
  });

  const onLockChange = () => {
    if (document.pointerLockElement !== canvas && mode === 'playing') pause();
  };
  document.addEventListener('pointerlockchange', onLockChange);

  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused';
    input.enabled = false;
    input.clear();
    audio.suspend();
    show('paused');
  }

  const onVisibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener('visibilitychange', onVisibility);

  //=============================================================
  //                          SIZING
  //=============================================================
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = root.clientWidth,
      ch = root.clientHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    const aspect = VIEW_W / VIEW_H;
    let w = canvas.width,
      h = Math.round(w / aspect);
    if (h > canvas.height) {
      h = canvas.height;
      w = Math.round(h * aspect);
    }
    rect = { x: Math.round((canvas.width - w) / 2), y: Math.round((canvas.height - h) / 2), w, h };
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(root);
  else window.addEventListener('resize', resize);
  resize();

  //=============================================================
  //                            LOOP
  //=============================================================
  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (mode === 'playing' || mode === 'gameover') {
      game.update(dt, mode === 'playing' ? input.consume(dt) : undefined);
    } else if (mode === 'menu') {
      game.player.angle += dt * 0.12;
      game.time += dt;
    }

    for (const ev of game.events) {
      if (ev.type === 'round' && options.onRoundStart) options.onRoundStart(ev.round);
      if (ev.type === 'missionComplete') {
        mode = 'gameover';
        input.enabled = false;
        lastStats = ev.stats;
        const idx = CAMPAIGN.findIndex((m) => m.id === ev.mission);
        progress.done[ev.mission] = true;
        progress.unlocked = Math.max(progress.unlocked, Math.min(CAMPAIGN.length - 1, idx + 1));
        save(CAMPAIGN_KEY, progress);
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        setTimeout(() => {
          if (!destroyed && mode === 'gameover') show('debrief');
        }, 2600);
        if (options.onMissionComplete) {
          try {
            options.onMissionComplete({ mission: ev.mission, ...ev.stats });
          } catch (err) {
            console.error(err);
          }
        }
      }
      if (ev.type === 'gameover' && game.mission) {
        mode = 'gameover';
        input.enabled = false;
        gameOverAt = performance.now();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        audio.play('mission_fail');
        setTimeout(() => {
          if (!destroyed && mode === 'gameover') show('failed');
        }, 2200);
      } else if (ev.type === 'gameover') {
        mode = 'gameover';
        input.enabled = false;
        gameOverAt = performance.now();
        const s = ev.stats;
        s.newBest = s.round > (best[s.level] || 0);
        if (s.newBest) {
          best[s.level] = s.round;
          save(BEST_KEY, best);
        }
        lastStats = s;
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        setTimeout(() => {
          if (!destroyed && mode === 'gameover') show('gameover');
        }, 2200);
        if (options.onGameOver) {
          try {
            options.onGameOver({ ...s });
          } catch (err) {
            console.error(err);
          }
        }
      }
    }
    game.events.length = 0;

    renderer.render(game, mode === 'menu');
    vctx.putImageData(imageData, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(view, rect.x, rect.y, rect.w, rect.h);
    if (mode !== 'menu') drawHud(ctx, game, rect);
  }

  show('main');
  raf = requestAnimationFrame(frame);

  return {
    pause,
    setMuted: (m) => {
      options.muted = m;
      applySettings();
    },
    getStats: () => game.summary(),
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      input.destroy();
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', resize);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      audio.destroy();
      root.remove();
    },
  };
}

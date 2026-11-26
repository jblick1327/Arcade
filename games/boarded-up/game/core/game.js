// game.js - Boarded Up simulation: player, rounds, zombies, weapons and economy
// Author: Reachnid Group
// Centennial College - Fall 2026

// Core simulation: player, rounds, zombies, weapons, economy. No DOM access,
// so it can be driven headlessly (tests) or by the browser engine.

import { parseMap, LEVEL, K, getLevel, MARGIN } from './map.js';
import { WEAPONS, BOX_POOL, CRATE_COST, PERKS, POWERUPS, MELEE_DAMAGE, TRAP } from './weapons.js';
import { MissionRunner } from './missions.js';

const PLAYER_R = 0.22;
const ZOMBIE_R = 0.2;
const WALK_SPEED = 3.0;
const SPRINT_SPEED = 4.6;
const MAX_ALIVE = 24;
const MAX_POWERUPS_PER_ROUND = 4;
const REGEN_DELAY = 3.5;
const REGEN_RATE = 70;
const ZOMBIE_DAMAGE = 45;
const ADS_TIME = 0.18; // seconds to raise sights fully
const MELEE_RANGE = 1.7; // zombies start swinging at 0.75, so the knife out-reaches them
const DIRS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

const nullAudio = { play() {} };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const EMPTY_INPUT = Object.freeze({
  moveX: 0,
  moveY: 0,
  turn: 0,
  sprint: false,
  fireHeld: false,
  firePressed: false,
  reloadPressed: false,
  aimHeld: false,
  interactHeld: false,
  interactPressed: false,
  meleePressed: false,
  swapPressed: false,
  slot: -1,
});

export function zombieCountForRound(n) {
  const table = [0, 6, 8, 13, 18, 24];
  return n < table.length ? table[n] : Math.floor(24 + (n - 5) * 5.5);
}

// Gentle linear ramp to round 9, then ~8% per round after that.
export function zombieHealthForRound(n) {
  return n < 10 ? 150 + 60 * (n - 1) : Math.round(630 * Math.pow(1.08, n - 9));
}

export class Game {
  constructor(opts = {}) {
    this.audio = opts.audio || nullAudio;
    this.rand = opts.rng || Math.random;
    this.missionDef = opts.mission || null;
    this.level = this.missionDef ? getLevel(this.missionDef.level) : opts.level || LEVEL;
    this.map = parseMap(this.level);
    const m = this.map;
    this.playerZone = m.startZone;

    // Power: some maps start in a blackout and need the generator restarted.
    this.power = !this.level.needsPower;
    this.lightLevel = this.power ? 1 : 0.3;
    // Spawning: 'rounds' (survival), 'pressure' (continuous, story) or 'off'.
    this.spawnMode = 'rounds';
    this.pressure = { threat: 1, cap: 8, interval: 3 };

    this.time = 0;
    this.state = 'playing'; // 'playing' | 'dead'
    this.deadT = 0;
    this.events = [];
    this.player = {
      x: m.start.x,
      y: m.start.y,
      angle: -Math.PI / 2,
      health: 100,
      maxHealth: 100,
      points: 500,
      weapons: [this.makeWeapon('pistol')],
      cur: 0,
      perks: new Set(),
      lastHurt: -99,
      fireCd: 0,
      reloadT: 0,
      reloadDur: 1,
      switchT: 0,
      meleeT: 0,
      meleeHit: false,
      recoil: 0,
      flash: 0,
      fireLock: 0,
      moving: false,
      sprinting: false,
      bob: 0,
      repairT: 0,
      ads: 0,
    };
    this.zombies = [];
    this.particles = [];
    this.powerups = [];
    this.bolts = [];
    this.popups = [];
    this.banner = null;

    this.round = 0;
    this.toSpawn = 0;
    this.spawnT = 0;
    this.intermission = 3;
    this.powerupsThisRound = 0;
    this.doubleT = 0;

    this.prompt = '';
    this.target = null;
    this.hitMarkerT = 0;
    this.hurtFlash = 0;
    this.shake = 0;

    this.stats = { kills: 0, shots: 0, hits: 0, repairs: 0, doors: 0, time: 0, pointsEarned: 0 };
    this.openZones = new Set([m.startZone]);
    this.flow = new Int16Array(m.w * m.h).fill(-1);
    this.flowQueue = new Int32Array(m.w * m.h);
    this.flowFrom = -1;
    this.flowDirty = true;
    this.crate = m.crate
      ? { ...m.crate, state: 'idle', t: 0, weapon: null, display: 'shotgun', cycleT: 0 }
      : null;
    this.nextId = 1;
    this.saws = [];

    // Props: generator, trap consoles and anything a mission places.
    this.props = [];
    this.traps = [];
    if (m.generator) {
      this.generator = this.addProp({
        type: 'generator',
        x: m.generator.x,
        y: m.generator.y,
        solid: true,
        state: this.power ? 'on' : 'off',
        use: {
          prompt: () =>
            this.power
              ? ''
              : this.generator.locked
                ? this.generator.lockedText
                : 'Press E to start the generator',
          action: () => {
            if (!this.power && !this.generator.locked) this.powerOn();
          },
        },
      });
    }
    for (const t of m.traps) {
      const trap = { ...t, activeT: 0, cooldownT: 0, hurtT: 0 };
      trap.prop = this.addProp({
        type: 'trap',
        x: t.x,
        y: t.y,
        solid: true,
        state: 'off',
        use: {
          prompt: () => {
            if (!this.power) return 'The trap needs power';
            if (trap.activeT > 0) return '';
            if (trap.cooldownT > 0) return `Trap recharging (${Math.ceil(trap.cooldownT)}s)`;
            return `Press E to activate the electric trap [${TRAP.cost}]`;
          },
          action: () => {
            if (this.power && trap.activeT <= 0 && trap.cooldownT <= 0 && this.spend(TRAP.cost))
              this.activateTrap(trap);
          },
        },
      });
      this.traps.push(trap);
    }

    this.mission = this.missionDef ? new MissionRunner(this, this.missionDef) : null;
    if (this.mission) this.mission.start();
  }

  //=============================================================
  //                           PROPS
  //=============================================================
  // Level coordinates (as written in the map rows) -> world coordinates.
  toWorld(x, y) {
    return { x: x + MARGIN + 0.5, y: y + MARGIN + 0.5 };
  }

  addProp(p) {
    const prop = { id: this.nextId++, state: 'off', hidden: false, ...p };
    if (prop.solid) {
      const ci = this.cellIndex(prop.x, prop.y);
      if (ci >= 0) {
        this.map.object[ci] = 1;
        this.flowDirty = true;
      }
    }
    this.props.push(prop);
    return prop;
  }

  removeProp(prop) {
    this.props = this.props.filter((p) => p !== prop);
    if (prop.solid) {
      const ci = this.cellIndex(prop.x, prop.y);
      if (ci >= 0) {
        this.map.object[ci] = 0;
        this.flowDirty = true;
      }
    }
  }

  powerOn() {
    if (this.power) return;
    this.power = true;
    if (this.generator) this.generator.state = 'on';
    this.sfx('power_on');
    this.shake = 0.4;
    this.showBanner('POWER RESTORED', 'Lights, perks and traps are online', 3.5);
    for (const d of this.map.doors) if (d.powerDoor && !d.open) this.openDoor(d, true);
    this.events.push({ type: 'power' });
  }

  activateTrap(trap) {
    trap.activeT = TRAP.duration;
    trap.prop.state = 'on';
    this.sfx('trap_on', trap.x, trap.y);
  }

  updateTraps(dt) {
    const p = this.player;
    for (const t of this.traps) {
      if (t.activeT > 0) {
        t.activeT -= dt;
        const [x0, y0, x1, y1] = t.area;
        for (const z of this.zombies) {
          if (z.state === 'dying' || !this.isInside(z)) continue;
          if (z.x >= x0 && z.x < x1 + 1 && z.y >= y0 && z.y < y1 + 1) {
            for (let k = 0; k < 6; k++)
              this.spawnParticle('arc', z.x, z.y, 0.2 + this.rand() * 0.5, 2, 0.25, true);
            this.sfx('zap', z.x, z.y, 0.8);
            if (z.brute) this.damageZombie(z, 400 * dt * 10, 'trap');
            else this.damageZombie(z, 1e9, 'trap');
          }
        }
        if (this.rand() < dt * 25) {
          const ax = x0 + this.rand() * (x1 - x0 + 1),
            ay = y0 + this.rand() * (y1 - y0 + 1);
          this.spawnParticle('arc', ax, ay, this.rand() * 0.9, 1.5, 0.2, true);
        }
        t.hurtT -= dt;
        if (p.x >= x0 && p.x < x1 + 1 && p.y >= y0 && p.y < y1 + 1 && t.hurtT <= 0) {
          t.hurtT = 0.5;
          this.hurtPlayer(25);
        }
        if (t.activeT <= 0) {
          t.cooldownT = TRAP.cooldown;
          t.prop.state = 'off';
        }
      } else if (t.cooldownT > 0) t.cooldownT -= dt;
    }
  }

  //=============================================================
  //                          HELPERS
  //=============================================================
  makeWeapon(id) {
    const d = WEAPONS[id];
    return { id, mag: d.mag, reserve: d.reserve };
  }

  get weapon() {
    return this.player.weapons[this.player.cur];
  }
  get weaponDef() {
    return WEAPONS[this.weapon.id];
  }
  get aliveCount() {
    let n = 0;
    for (const z of this.zombies) if (z.state !== 'dying') n++;
    return n;
  }

  cellIndex(x, y) {
    const m = this.map;
    const tx = Math.floor(x),
      ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return -1;
    return ty * m.w + tx;
  }

  blocksMove(tx, ty) {
    const m = this.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return true;
    const i = ty * m.w + tx;
    const k = m.kind[i];
    return k !== K.FLOOR || m.object[i] === 1;
  }

  collides(x, y, r) {
    const x0 = Math.floor(x - r),
      x1 = Math.floor(x + r);
    const y0 = Math.floor(y - r),
      y1 = Math.floor(y + r);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) if (this.blocksMove(tx, ty)) return true;
    return false;
  }

  // Axis-separated movement with wall sliding.
  moveCircle(e, dx, dy, r) {
    if (dx) {
      const nx = e.x + dx;
      if (!this.collides(nx, e.y, r)) e.x = nx;
      else {
        const edge =
          dx > 0 ? Math.floor(e.x + r + dx) - r - 0.001 : Math.floor(e.x - r + dx) + 1 + r + 0.001;
        if ((dx > 0 ? edge > e.x : edge < e.x) && !this.collides(edge, e.y, r)) e.x = edge;
      }
    }
    if (dy) {
      const ny = e.y + dy;
      if (!this.collides(e.x, ny, r)) e.y = ny;
      else {
        const edge =
          dy > 0 ? Math.floor(e.y + r + dy) - r - 0.001 : Math.floor(e.y - r + dy) + 1 + r + 0.001;
        if ((dy > 0 ? edge > e.y : edge < e.y) && !this.collides(e.x, edge, r)) e.y = edge;
      }
    }
  }

  // Distance along a ray until it hits something that stops bullets
  // (walls, closed doors, wall-buys). Windows and the outside are see-through.
  rayDist(ox, oy, dx, dy, maxD = 40) {
    const m = this.map;
    let mx = Math.floor(ox),
      my = Math.floor(oy);
    const ddx = dx === 0 ? 1e30 : Math.abs(1 / dx);
    const ddy = dy === 0 ? 1e30 : Math.abs(1 / dy);
    let sx, sy, sdx, sdy;
    if (dx < 0) {
      sx = -1;
      sdx = (ox - mx) * ddx;
    } else {
      sx = 1;
      sdx = (mx + 1 - ox) * ddx;
    }
    if (dy < 0) {
      sy = -1;
      sdy = (oy - my) * ddy;
    } else {
      sy = 1;
      sdy = (my + 1 - oy) * ddy;
    }
    for (let i = 0; i < 256; i++) {
      let d;
      if (sdx < sdy) {
        d = sdx;
        sdx += ddx;
        mx += sx;
      } else {
        d = sdy;
        sdy += ddy;
        my += sy;
      }
      if (d > maxD) return maxD;
      if (mx < 0 || my < 0 || mx >= m.w || my >= m.h) return d;
      const k = m.kind[my * m.w + mx];
      if (k === K.WALL || k === K.DOOR || k === K.WALLBUY) return d;
    }
    return maxD;
  }

  sfx(name, x, y, vol = 1) {
    if (x === undefined) {
      this.audio.play(name, { vol });
      return;
    }
    const p = this.player;
    const dx = x - p.x,
      dy = y - p.y;
    const d = Math.hypot(dx, dy);
    const att = 1 / (1 + d * d * 0.07);
    if (att < 0.03) return;
    const pan = d > 0.01 ? ((dx * -Math.sin(p.angle) + dy * Math.cos(p.angle)) / d) * 0.8 : 0;
    this.audio.play(name, { vol: vol * att, pan });
  }

  addPoints(n) {
    if (this.doubleT > 0) n *= 2;
    this.player.points += n;
    this.stats.pointsEarned += n;
    this.popups.push({ v: n, t: 0, x: (this.rand() - 0.5) * 30 });
  }

  spend(cost) {
    if (this.player.points < cost) {
      this.sfx('deny');
      return false;
    }
    this.player.points -= cost;
    this.popups.push({ v: -cost, t: 0, x: 0 });
    return true;
  }

  showBanner(text, sub = '', dur = 3, big = false) {
    this.banner = { text, sub, t: 0, dur, big };
  }

  //=============================================================
  //                          UPDATE
  //=============================================================
  update(dt, input = EMPTY_INPUT) {
    this.time += dt;
    if (this.state !== 'playing') {
      this.deadT += dt;
      this.updateParticles(dt);
      for (const z of this.zombies) if (z.state === 'dying') z.deathT += dt;
      return;
    }
    this.stats.time = this.time;
    this.updateRounds(dt);
    this.updatePlayer(dt, input);
    this.computeFlow();
    this.updateInteraction(dt, input);
    this.updateWeapons(dt, input);
    this.updateZombies(dt);
    this.updateBolts(dt);
    this.updateSaws(dt);
    this.updateTraps(dt);
    this.updateParticles(dt);
    this.updatePowerups(dt);
    this.updateCrate(dt);
    if (this.mission) this.mission.update(dt);
    const lightTarget = this.power ? 1 : 0.3;
    this.lightLevel += (lightTarget - this.lightLevel) * Math.min(1, dt * 1.5);

    const p = this.player;
    if (this.time - p.lastHurt > REGEN_DELAY)
      p.health = Math.min(p.maxHealth, p.health + REGEN_RATE * dt);
    this.hitMarkerT = Math.max(0, this.hitMarkerT - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt);
    this.doubleT = Math.max(0, this.doubleT - dt);
    for (const pp of this.popups) pp.t += dt;
    this.popups = this.popups.filter((pp) => pp.t < 1.2);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
  }

  //=============================================================
  //                          ROUNDS
  //=============================================================
  updateRounds(dt) {
    if (this.spawnMode === 'off') return;
    if (this.spawnMode === 'pressure') {
      // Story mode: a steady stream of zombies at the mission's threat level.
      const pr = this.pressure;
      this.round = pr.threat;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.aliveCount < pr.cap) {
        this.spawnZombie();
        this.spawnT = pr.interval * (0.6 + this.rand() * 0.8);
      }
      return;
    }
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startRound(this.round + 1);
      return;
    }
    if (this.toSpawn === 0 && this.aliveCount === 0) {
      this.intermission = 9;
      this.sfx('roundEnd');
      this.showBanner('ROUND ' + this.round + ' SURVIVED', 'They will be back...', 4);
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.aliveCount < MAX_ALIVE) {
        this.spawnZombie();
        this.toSpawn--;
        this.spawnT = Math.max(0.45, 2.1 - this.round * 0.12) * (0.7 + this.rand() * 0.6);
      }
    }
  }

  startRound(n) {
    this.round = n;
    this.toSpawn = zombieCountForRound(n);
    this.spawnT = 1.5;
    this.powerupsThisRound = 0;
    this.sfx('roundStart');
    this.showBanner('ROUND ' + n, n === 1 ? 'Hold them off. Repair the windows.' : '', 4, true);
    this.events.push({ type: 'round', round: n });
  }

  tearTime() {
    return Math.max(0.7, 1.7 - this.round * 0.06);
  }

  // opts: { brute, hp, at: {x,y} world position to appear at directly (no window) }
  spawnZombie(opts = {}) {
    const p = this.player;
    let win = null,
      x,
      y,
      state = 'approach';
    if (opts.at) {
      x = opts.at.x;
      y = opts.at.y;
      state = 'chase';
    } else {
      const wins = this.spawnWindows();
      if (!wins.length) return null;
      const weights = wins.map((w) => Math.exp(-Math.hypot(w.ix - p.x, w.iy - p.y) / 6) + 0.08);
      let r = this.rand() * weights.reduce((a, b) => a + b, 0);
      win = wins[0];
      for (let i = 0; i < wins.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          win = wins[i];
          break;
        }
      }
      const lateral = (this.rand() - 0.5) * 1.4;
      x = win.cx - win.nx * 2.4 - win.ny * lateral;
      y = win.cy - win.ny * 2.4 + win.nx * lateral;
    }
    const brute = !!opts.brute;
    const hp = opts.hp || (brute ? 5000 : zombieHealthForRound(this.round));
    const z = {
      id: this.nextId++,
      x,
      y,
      hp,
      maxHp: hp,
      speed: brute ? 1.25 : this.rollZombieSpeed(this.round),
      state,
      win,
      t: 0,
      returnState: 'chase',
      anim: this.rand() * 4,
      attackT: 0,
      attackCd: 0.5,
      hitT: 0,
      swipeT: 0,
      variant: Math.floor(this.rand() * 4),
      groanT: 1 + this.rand() * 5,
      deathT: 0,
      moving: true,
      brute,
      burnT: 0,
      flamePtsT: 0,
    };
    this.zombies.push(z);
    if (brute) {
      this.sfx('brute', x, y, 1.4);
      this.shake = Math.max(this.shake, 0.3);
    }
    return z;
  }

  // Speed tiers: rounds 1-4 are all shamblers, joggers join from round 5,
  // sprinters only from round 10. Player walks at 3.0 and sprints at 4.6.
  rollZombieSpeed(n) {
    const r = this.rand(),
      j = this.rand();
    let runner = 0,
      jogger = 0;
    if (n >= 10) {
      runner = Math.min(0.7, 0.2 + (n - 10) * 0.08);
      jogger = 1 - runner;
    } else if (n >= 5) jogger = Math.min(0.75, 0.25 + (n - 5) * 0.12);
    if (r < runner) return 2.0 + j * 0.35;
    if (r < runner + jogger) return 1.3 + j * 0.25;
    return 0.72 + j * 0.2 + Math.min(0.1, n * 0.01);
  }

  // Zombies only come through windows near the player: the zone the player
  // is in plus zones one open door away. If none of those have windows (e.g.
  // the courtyard), widen the search one step at a time.
  spawnWindows() {
    const m = this.map;
    const dist = new Map([[this.playerZone, 0]]);
    const queue = [this.playerZone];
    while (queue.length) {
      const z = queue.shift();
      for (const d of m.zoneDoors[z] || []) {
        if (!d.open) continue;
        for (const o of d.zones)
          if (!dist.has(o)) {
            dist.set(o, dist.get(z) + 1);
            queue.push(o);
          }
      }
    }
    const open = m.windows.filter((w) => this.openZones.has(w.zone) && dist.has(w.zone));
    if (!open.length) return m.windows.filter((w) => this.openZones.has(w.zone));
    const near = open.filter((w) => dist.get(w.zone) <= 1);
    if (near.length) return near;
    const best = Math.min(...open.map((w) => dist.get(w.zone)));
    return open.filter((w) => dist.get(w.zone) === best);
  }

  //=============================================================
  //                          PLAYER
  //=============================================================
  updatePlayer(dt, input) {
    const p = this.player;
    // Aiming down sights: lower look sensitivity while zoomed.
    p.angle += input.turn * (1 - 0.4 * p.ads);
    p.fireLock = Math.max(0, p.fireLock - dt);

    let fx = clamp(input.moveY, -1, 1),
      sx = clamp(input.moveX, -1, 1);
    const len = Math.hypot(fx, sx);
    if (len > 1) {
      fx /= len;
      sx /= len;
    }
    const wantAim = !!input.aimHeld && p.reloadT <= 0 && p.meleeT <= 0 && p.switchT <= 0;
    p.ads = clamp(p.ads + (wantAim ? dt : -dt) / ADS_TIME, 0, 1);
    p.sprinting = !!input.sprint && !wantAim && fx > 0.1 && p.fireLock <= 0 && p.reloadT <= 0;
    const speed = (p.sprinting ? SPRINT_SPEED : WALK_SPEED) * (1 - 0.4 * p.ads);
    const ca = Math.cos(p.angle),
      sa = Math.sin(p.angle);
    const vx = (ca * fx - sa * sx) * speed,
      vy = (sa * fx + ca * sx) * speed;
    p.moving = len > 0.05;
    if (p.moving) {
      this.moveCircle(p, vx * dt, vy * dt, PLAYER_R);
      p.bob += dt * speed * 2.4;
    }
    const ci = this.cellIndex(p.x, p.y);
    if (ci >= 0 && this.map.zone[ci] >= 0 && this.map.kind[ci] === K.FLOOR) {
      const z = this.map.zone[ci];
      if (z !== this.playerZone && !this.map.doorAt.has(ci)) this.playerZone = z;
    }

    // Zombies physically push the player away.
    for (const z of this.zombies) {
      if (!this.isInside(z)) continue;
      const dx = p.x - z.x,
        dy = p.y - z.y;
      const d = Math.hypot(dx, dy);
      const min = PLAYER_R + (z.brute ? 0.32 : ZOMBIE_R);
      if (d < min && d > 1e-4) {
        const push = (min - d) * 0.6;
        this.moveCircle(p, (dx / d) * push, (dy / d) * push, PLAYER_R);
      }
    }
  }

  hurtPlayer(dmg, fromX, fromY) {
    const p = this.player;
    if (this.state !== 'playing') return;
    p.health -= dmg;
    p.lastHurt = this.time;
    this.hurtFlash = 1;
    this.shake = 0.3;
    this.sfx('hurt');
    if (p.health <= 0) {
      p.health = 0;
      this.state = 'dead';
      this.deadT = 0;
      this.sfx('death');
      this.events.push({ type: 'gameover', stats: this.summary() });
    }
  }

  summary() {
    return {
      level: this.level.id,
      levelName: this.level.name,
      round: this.round,
      kills: this.stats.kills,
      points: this.stats.pointsEarned,
      timeSeconds: Math.round(this.stats.time),
      shots: this.stats.shots,
      accuracy: this.stats.shots ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0,
      repairs: this.stats.repairs,
      doors: this.stats.doors,
    };
  }

  //=============================================================
  //                        INTERACTION
  //=============================================================
  findInteraction() {
    const p = this.player,
      m = this.map;
    let best = null,
      bestD = Infinity;
    const consider = (x, y, max, obj) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < max && d < bestD) {
        bestD = d;
        best = obj;
      }
    };
    for (const door of m.doors)
      if (!door.open) consider(door.cx, door.cy, 1.55, { type: 'door', door });
    for (const wb of m.wallbuys)
      if (this.openZones.has(wb.zone)) consider(wb.ix, wb.iy, 1.1, { type: 'wallbuy', wb });
    for (const w of m.windows)
      if (w.planks < 5 && this.openZones.has(w.zone))
        consider(w.ix, w.iy, 1.5, { type: 'window', win: w });
    if (this.crate && this.crate.state !== 'spinning')
      consider(this.crate.x, this.crate.y, 1.45, { type: 'crate' });
    for (const pk of m.perks)
      if (!p.perks.has(pk.perk)) consider(pk.x, pk.y, 1.35, { type: 'perk', pk });
    for (const pr of this.props) {
      if (pr.hidden || !pr.use) continue;
      const text = pr.use.prompt();
      if (text) consider(pr.x, pr.y, pr.use.range || 1.45, { type: 'prop', prop: pr, text });
    }
    return best;
  }

  updateInteraction(dt, input) {
    const p = this.player;
    const t = this.findInteraction();
    this.target = t;
    this.prompt = '';
    if (!t) {
      p.repairT = 0;
      this.useT = 0;
      return;
    }
    if (t.type !== 'prop') this.useT = 0;

    if (t.type === 'door') {
      const door = t.door;
      if (door.powerDoor) this.prompt = 'Sealed. Restore the power to open it';
      else if (door.locked) this.prompt = door.lockedText || 'Locked';
      else {
        const to = door.zones.find((z) => !this.openZones.has(z));
        const where = to !== undefined ? ` to the ${this.map.zoneName[to]}` : '';
        this.prompt =
          door.cost > 0
            ? `Press E to clear the debris${where} [${door.cost}]`
            : `Press E to open the door${where}`;
        if (input.interactPressed && (door.cost === 0 || this.spend(door.cost)))
          this.openDoor(door);
      }
    } else if (t.type === 'prop') {
      // Generic usable prop; `hold` seconds means hold E with a progress bar.
      const use = t.prop.use;
      this.prompt = t.text;
      if (use.hold) {
        if (input.interactHeld) {
          this.useT = (this.useT || 0) + dt;
          if (this.useT >= use.hold) {
            this.useT = 0;
            use.action();
          }
        } else this.useT = 0;
        this.useProgress = (this.useT || 0) / use.hold;
      } else if (input.interactPressed) use.action();
    } else if (t.type === 'wallbuy') {
      const def = WEAPONS[t.wb.weapon];
      const owned = p.weapons.find((w) => w.id === t.wb.weapon);
      const cost = owned ? Math.round(def.cost / 2) : def.cost;
      this.prompt = owned
        ? `Press E to buy ${def.name} ammo [${cost}]`
        : `Press E to buy ${def.name} [${cost}]`;
      if (input.interactPressed) {
        if (owned && owned.reserve >= def.reserve && owned.mag >= def.mag) this.sfx('deny');
        else if (this.spend(cost)) {
          this.sfx('buy');
          this.giveWeapon(t.wb.weapon);
        }
      }
    } else if (t.type === 'window') {
      this.prompt = 'Hold E to rebuild the barrier';
      if (input.interactHeld) {
        p.repairT += dt;
        const interval = p.perks.has('quick') ? 0.45 : 0.75;
        if (p.repairT >= interval) {
          p.repairT = 0;
          t.win.planks = Math.min(5, t.win.planks + 1);
          this.stats.repairs++;
          this.addPoints(10);
          this.sfx('repair', t.win.cx, t.win.cy);
        }
      } else p.repairT = 0;
    } else if (t.type === 'crate') {
      const c = this.crate;
      if (c.state === 'idle') {
        this.prompt = `Press E to open the Mystery Crate [${CRATE_COST}]`;
        if (input.interactPressed && this.spend(CRATE_COST)) {
          c.state = 'spinning';
          c.t = 3.2;
          c.cycleT = 0;
          this.sfx('crate', c.x, c.y);
        }
      } else if (c.state === 'presenting') {
        this.prompt = `Press E to take the ${WEAPONS[c.weapon].name}`;
        if (input.interactPressed) {
          this.giveWeapon(c.weapon);
          c.state = 'idle';
          c.weapon = null;
        }
      }
    } else if (t.type === 'perk') {
      const def = PERKS[t.pk.perk];
      if (!this.power) {
        this.prompt = `${def.name} needs power`;
        return;
      }
      this.prompt = `Press E for ${def.name} - ${def.desc} [${def.cost}]`;
      if (input.interactPressed && this.spend(def.cost)) {
        p.perks.add(t.pk.perk);
        this.sfx('perk', t.pk.x, t.pk.y);
        if (t.pk.perk === 'iron') {
          p.maxHealth = 250;
          p.health = 250;
        }
        this.showBanner(def.name.toUpperCase(), def.desc, 2.5);
      }
    }
    if (t.type !== 'window') p.repairT = 0;
  }

  openDoor(door, quiet = false) {
    const m = this.map;
    const newZones = door.zones.filter((z) => !this.openZones.has(z));
    door.open = true;
    door.locked = false;
    m.kind[door.i] = K.FLOOR;
    m.zone[door.i] = door.zones[0];
    for (const z of door.zones) this.openZones.add(z);
    this.flowDirty = true;
    this.stats.doors++;
    this.sfx('door', door.cx, door.cy);
    if (!quiet && newZones.length)
      this.showBanner(this.map.zoneName[newZones[0]].toUpperCase(), 'Area opened', 2.2);
    this.events.push({ type: 'door', door });
    for (let i = 0; i < 14; i++)
      this.spawnParticle('spark', door.cx, door.cy, 0.2 + this.rand() * 0.6, 1.5, 0.6, true);
  }

  giveWeapon(id) {
    const p = this.player;
    const owned = p.weapons.findIndex((w) => w.id === id);
    if (owned >= 0) {
      const d = WEAPONS[id];
      p.weapons[owned].reserve = d.reserve;
      p.weapons[owned].mag = d.mag;
      p.cur = owned;
    } else if (p.weapons.length < 2) {
      p.weapons.push(this.makeWeapon(id));
      p.cur = p.weapons.length - 1;
    } else {
      p.weapons[p.cur] = this.makeWeapon(id);
    }
    p.reloadT = 0;
    p.switchT = 0.45;
    this.sfx('equip');
  }

  //=============================================================
  //                          WEAPONS
  //=============================================================
  updateWeapons(dt, input) {
    const p = this.player;
    p.fireCd -= dt;
    p.recoil = Math.max(0, p.recoil - dt * 5);
    p.flash = Math.max(0, p.flash - dt);
    if (p.switchT > 0) p.switchT -= dt;

    if (p.reloadT > 0) {
      p.reloadT -= dt;
      if (p.reloadT <= 0) {
        const w = this.weapon,
          d = this.weaponDef;
        const take = Math.min(d.mag - w.mag, w.reserve);
        w.mag += take;
        w.reserve -= take;
      }
    }

    if (p.meleeT > 0) {
      p.meleeT -= dt;
      if (!p.meleeHit && p.meleeT < 0.4) {
        p.meleeHit = true;
        this.doMelee();
      }
    }

    if (input.meleePressed && p.meleeT <= 0 && p.switchT <= 0) {
      p.meleeT = 0.5;
      p.meleeHit = false;
      p.reloadT = 0;
      this.sfx('swing');
    }

    if (p.weapons.length > 1 && p.meleeT <= 0) {
      let next = -1;
      if (input.swapPressed) next = 1 - p.cur;
      else if (input.slot >= 0 && input.slot < p.weapons.length && input.slot !== p.cur)
        next = input.slot;
      if (next >= 0) {
        p.cur = next;
        p.switchT = 0.45;
        p.reloadT = 0;
        this.sfx('equip');
      }
    }

    const w = this.weapon,
      d = this.weaponDef;
    if (input.reloadPressed) this.startReload();

    const busy = p.reloadT > 0 || p.switchT > 0 || p.meleeT > 0;
    const want = d.auto ? input.fireHeld : input.firePressed;
    if (want && !busy && p.fireCd <= 0) {
      if (w.mag > 0) this.fire();
      else if (w.reserve > 0) this.startReload();
      else {
        this.sfx('empty');
        p.fireCd = 0.3;
      }
    }
  }

  startReload() {
    const p = this.player,
      w = this.weapon,
      d = this.weaponDef;
    if (p.reloadT > 0 || p.meleeT > 0 || p.switchT > 0 || w.mag >= d.mag || w.reserve <= 0) return;
    p.reloadDur = d.reload * (p.perks.has('quick') ? 0.5 : 1);
    p.reloadT = p.reloadDur;
    this.sfx('reload');
  }

  fire() {
    const p = this.player,
      w = this.weapon,
      d = this.weaponDef;
    w.mag--;
    p.fireCd = d.rate;
    p.recoil = Math.min(1.6, p.recoil + d.recoil);
    p.flash = d.type === 'flame' ? 0.03 : 0.06;
    p.fireLock = 0.35;
    if (d.type !== 'flame' || w.mag % 4 === 0) this.stats.shots++;
    this.sfx('shot_' + d.sound);
    // Aiming tightens spread a lot (shotguns only a little).
    const adsMul = 1 - p.ads * (d.pellets > 1 ? 0.3 : 0.8);
    const spreadMul = (p.moving ? 1.6 : 1) * adsMul;
    if (d.type === 'flame') {
      this.flameTick(d);
      return;
    }
    if (d.type === 'chain') {
      this.chainLightning(p.angle + (this.rand() - 0.5) * 2 * d.spread * spreadMul, d);
      return;
    }
    if (d.type === 'saw') {
      const ang = p.angle + (this.rand() - 0.5) * 2 * d.spread * spreadMul;
      this.saws.push({
        x: p.x + Math.cos(ang) * 0.3,
        y: p.y + Math.sin(ang) * 0.3,
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        life: 3,
        bounces: 3,
        hit: new Set(),
        dmg: d.dmg,
        spin: 0,
      });
      return;
    }
    for (let i = 0; i < d.pellets; i++) {
      const ang = p.angle + (this.rand() - 0.5) * 2 * d.spread * spreadMul;
      if (d.projectile) {
        this.bolts.push({
          x: p.x + Math.cos(ang) * 0.3,
          y: p.y + Math.sin(ang) * 0.3,
          dx: Math.cos(ang),
          dy: Math.sin(ang),
          life: 1.6,
          dmg: d.dmg,
          splash: d.splash,
        });
      } else this.hitscan(ang, d);
    }
  }

  hitscan(ang, d) {
    const p = this.player;
    const dx = Math.cos(ang),
      dy = Math.sin(ang);
    const wallD = this.rayDist(p.x, p.y, dx, dy, 40);
    const hits = [];
    for (const z of this.zombies) {
      if (z.state === 'dying') continue;
      const rx = z.x - p.x,
        ry = z.y - p.y;
      const along = rx * dx + ry * dy;
      if (along <= 0.05 || along > wallD) continue;
      if (Math.abs(rx * dy - ry * dx) < (z.brute ? 0.36 : 0.25)) hits.push({ z, along });
    }
    hits.sort((a, b) => a.along - b.along);
    const n = Math.min(hits.length, d.pierce);
    for (let i = 0; i < n; i++) {
      const { z, along } = hits[i];
      let dmg = d.dmg;
      if (d.pellets > 1) dmg *= clamp(1.4 - along * 0.12, 0.25, 1);
      for (let k = 0; k < 3; k++)
        this.spawnParticle(
          'blood',
          z.x - dx * 0.2,
          z.y - dy * 0.2,
          0.3 + this.rand() * 0.25,
          1.2,
          0.8,
        );
      this.damageZombie(z, dmg, 'gun');
    }
    const endD = n === hits.length || d.pierce > 1 ? wallD : hits[n - 1].along;
    if (n < d.pierce || n === 0) {
      const ex = p.x + dx * (wallD - 0.04),
        ey = p.y + dy * (wallD - 0.04);
      if (wallD < 39)
        for (let k = 0; k < 2; k++)
          this.spawnParticle('spark', ex, ey, 0.35 + this.rand() * 0.3, 0.8, 0.25, true);
    }
    if (d.beam) {
      for (let s = 0.5; s < endD; s += 0.22)
        this.particles.push({
          type: 'beam',
          x: p.x + dx * s,
          y: p.y + dy * s,
          z: 0.42,
          vx: 0,
          vy: 0,
          vz: 0,
          life: 0.3,
          max: 0.3,
          grav: 0,
        });
    }
  }

  // Flamethrower: short cone, damages everything in it and sets it alight.
  flameTick(d) {
    const p = this.player;
    const fx = Math.cos(p.angle),
      fy = Math.sin(p.angle);
    for (const z of this.zombies) {
      if (z.state === 'dying') continue;
      const dx = z.x - p.x,
        dy = z.y - p.y,
        dist = Math.hypot(dx, dy);
      if (dist > d.range || dist < 0.01) continue;
      if ((dx * fx + dy * fy) / dist < d.cone) continue;
      if (this.rayDist(p.x, p.y, dx / dist, dy / dist, dist) < dist - 0.25) continue;
      if (z.burnT <= 0) this.sfx('burn', z.x, z.y, 0.7);
      z.burnT = 2.5;
      this.damageZombie(z, d.dmg, 'flame');
    }
    for (let k = 0; k < 2; k++) {
      const a = p.angle + (this.rand() - 0.5) * 0.25;
      const s = 5.5 + this.rand() * 2;
      this.particles.push({
        // start out at the nozzle, which sits right of centre in the hip view
        type: 'flame',
        x: p.x + fx * 0.75 - fy * 0.13,
        y: p.y + fy * 0.75 + fx * 0.13,
        z: 0.32 + this.rand() * 0.06,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: 0.25 + this.rand() * 0.3,
        life: 0.55 + this.rand() * 0.15,
        max: 0.7,
        grav: -0.4,
        wallStop: true,
      });
    }
  }

  // Storm Coil: hits the first zombie along the aim line, then arcs to up to
  // `chain` more nearby zombies with falling damage.
  chainLightning(ang, d) {
    const p = this.player;
    const dx = Math.cos(ang),
      dy = Math.sin(ang);
    const wallD = this.rayDist(p.x, p.y, dx, dy, d.range);
    let first = null,
      bestAlong = wallD;
    for (const z of this.zombies) {
      if (z.state === 'dying') continue;
      const rx = z.x - p.x,
        ry = z.y - p.y;
      const along = rx * dx + ry * dy;
      if (along <= 0.05 || along > bestAlong) continue;
      if (Math.abs(rx * dy - ry * dx) < (z.brute ? 0.45 : 0.35)) {
        first = z;
        bestAlong = along;
      }
    }
    const ox = p.x + dx * 0.85 - dy * 0.13,
      oy = p.y + dy * 0.85 + dx * 0.13;
    if (!first) {
      this.arcLine(ox, oy, 0.38, p.x + dx * (wallD - 0.05), p.y + dy * (wallD - 0.05), 0.45);
      return;
    }
    let prev = { x: ox, y: oy, z: 0.38 };
    let cur = first,
      dmg = d.dmg;
    const hit = new Set();
    for (let k = 0; k <= d.chain && cur; k++) {
      this.arcLine(prev.x, prev.y, prev.z, cur.x, cur.y, 0.4);
      hit.add(cur);
      this.damageZombie(cur, dmg, 'gun');
      prev = { x: cur.x, y: cur.y, z: 0.4 };
      dmg *= 0.85;
      let next = null,
        nd = d.jump;
      for (const z of this.zombies) {
        if (z.state === 'dying' || hit.has(z)) continue;
        const dd = Math.hypot(z.x - prev.x, z.y - prev.y);
        if (
          dd < nd &&
          this.rayDist(prev.x, prev.y, (z.x - prev.x) / dd, (z.y - prev.y) / dd, dd) >= dd - 0.1
        ) {
          next = z;
          nd = dd;
        }
      }
      cur = next;
    }
  }

  arcLine(x0, y0, z0, x1, y1, z1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.ceil(len / 0.18));
    for (let i = 0; i <= n; i++) {
      const t = i / n,
        jit = Math.sin(t * Math.PI) * 0.12;
      this.particles.push({
        type: 'arc',
        x: x0 + (x1 - x0) * t + (this.rand() - 0.5) * jit,
        y: y0 + (y1 - y0) * t + (this.rand() - 0.5) * jit,
        z: z0 + (z1 - z0) * t + (this.rand() - 0.5) * jit,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0.16,
        max: 0.16,
        grav: 0,
      });
    }
  }

  // Ripjack sawblades: pierce everything once, ricochet off walls.
  updateSaws(dt) {
    const keep = [];
    for (const s of this.saws) {
      s.life -= dt;
      s.spin += dt * 30;
      const steps = 4,
        step = (11 * dt) / steps;
      for (let i = 0; i < steps; i++) {
        const nx = s.x + s.dx * step,
          ny = s.y + s.dy * step;
        const blockX = this.sawBlocked(nx, s.y),
          blockY = this.sawBlocked(s.x, ny);
        if (blockX || blockY) {
          if (blockX) s.dx = -s.dx;
          if (blockY) s.dy = -s.dy;
          s.bounces--;
          this.sfx('saw_hit', s.x, s.y, 0.4);
          for (let k = 0; k < 3; k++) this.spawnParticle('spark', s.x, s.y, 0.4, 1.2, 0.25, true);
          if (s.bounces < 0) {
            s.life = 0;
            break;
          }
          continue;
        }
        s.x = nx;
        s.y = ny;
        for (const z of this.zombies) {
          if (z.state === 'dying' || s.hit.has(z)) continue;
          if (Math.hypot(z.x - s.x, z.y - s.y) < (z.brute ? 0.45 : 0.32)) {
            s.hit.add(z);
            this.sfx('saw_hit', z.x, z.y);
            for (let k = 0; k < 6; k++) this.spawnParticle('blood', z.x, z.y, 0.35, 1.8, 0.8);
            this.damageZombie(z, s.dmg, 'gun');
          }
        }
      }
      if (s.life > 0) keep.push(s);
    }
    this.saws = keep;
  }

  sawBlocked(x, y) {
    const ci = this.cellIndex(x, y);
    if (ci < 0) return true;
    const k = this.map.kind[ci];
    return (
      k === K.WALL || k === K.DOOR || k === K.WALLBUY || k === K.WINDOW || this.map.object[ci] === 1
    );
  }

  doMelee() {
    const p = this.player;
    const fx = Math.cos(p.angle),
      fy = Math.sin(p.angle);
    let best = null,
      bestD = MELEE_RANGE;
    for (const z of this.zombies) {
      if (z.state === 'dying') continue;
      const dx = z.x - p.x,
        dy = z.y - p.y,
        d = Math.hypot(dx, dy);
      if (
        d < bestD &&
        (dx * fx + dy * fy) / (d || 1) > 0.4 &&
        this.rayDist(p.x, p.y, dx / d, dy / d, d) >= d
      ) {
        best = z;
        bestD = d;
      }
    }
    if (best) {
      this.sfx('stab');
      for (let k = 0; k < 5; k++)
        this.spawnParticle('blood', best.x - fx * 0.2, best.y - fy * 0.2, 0.4, 1.5, 0.8);
      this.damageZombie(best, MELEE_DAMAGE, 'melee');
      // A knife hit staggers: cancels the zombie's swing and shoves it back.
      // (Brutes shrug it off.)
      if (best.state !== 'dying' && !best.brute) {
        if (best.state === 'attack') best.state = best.returnState;
        best.attackCd = Math.max(best.attackCd, 0.7);
        if (this.isInside(best)) {
          const d = bestD || 1;
          this.moveCircle(best, ((best.x - p.x) / d) * 0.35, ((best.y - p.y) / d) * 0.35, ZOMBIE_R);
        }
      }
    }
  }

  // kind: gun | melee | flame | burn | blast | trap
  damageZombie(z, dmg, kind) {
    if (z.state === 'dying') return;
    z.hp -= dmg;
    const quiet = kind === 'burn' || kind === 'trap' || kind === 'blast';
    if (!quiet) {
      z.hitT = 0.09;
      this.hitMarkerT = 0.15;
      if (kind !== 'flame') this.stats.hits++;
    }
    if (z.hp <= 0) this.killZombie(z, kind, kind !== 'blast' && kind !== 'trap');
    else if (!quiet) {
      // Flame ticks very fast, so it only pays out a hit bonus twice a second.
      if (kind !== 'flame' || this.time - z.flamePtsT > 0.5) {
        z.flamePtsT = this.time;
        this.addPoints(10);
      }
      if (kind !== 'flame') this.sfx('zhit', z.x, z.y, 0.6);
    }
  }

  killZombie(z, kind, award = true) {
    const wasOutside =
      z.state === 'approach' ||
      z.state === 'tearing' ||
      z.state === 'entering' ||
      (z.state === 'attack' && z.returnState === 'tearing');
    z.state = 'dying';
    z.deathT = 0;
    z.hp = 0;
    if (z.win && z.win.occupant === z) z.win.occupant = null;
    this.stats.kills++;
    z.burnT = 0;
    if (award) this.addPoints(z.brute ? 500 : kind === 'melee' ? 130 : 60);
    this.sfx(z.brute ? 'brute' : 'zdie', z.x, z.y);
    if (z.brute) this.shake = 0.5;
    if (this.mission) this.mission.onKill(z);
    for (let k = 0; k < 6; k++)
      this.spawnParticle('blood', z.x, z.y, 0.25 + this.rand() * 0.3, 1.6, 1);
    if (award && this.powerupsThisRound < MAX_POWERUPS_PER_ROUND && this.rand() < 0.035) {
      const types = Object.keys(POWERUPS);
      const type = types[Math.floor(this.rand() * types.length)];
      const x = wasOutside ? z.win.ix : z.x,
        y = wasOutside ? z.win.iy : z.y;
      this.powerups.push({ type, x, y, t: 25 });
      this.powerupsThisRound++;
      this.sfx('powerup', x, y);
    }
  }

  //=============================================================
  //                          ZOMBIES
  //=============================================================
  isInside(z) {
    return (
      z.state === 'chase' ||
      z.state === 'entering' ||
      (z.state === 'attack' && z.returnState === 'chase')
    );
  }

  computeFlow() {
    const m = this.map,
      p = this.player;
    const from = this.cellIndex(p.x, p.y);
    if (!this.flowDirty && from === this.flowFrom) return;
    this.flowDirty = false;
    this.flowFrom = from;
    const flow = this.flow,
      q = this.flowQueue,
      w = m.w;
    flow.fill(-1);
    if (from < 0) return;
    const walk = (i) => m.kind[i] === K.FLOOR && m.object[i] === 0;
    let head = 0,
      tail = 0;
    flow[from] = 0;
    q[tail++] = from;
    while (head < tail) {
      const c = q[head++];
      const cx = c % w,
        cy = (c / w) | 0;
      for (const [ox, oy] of DIRS8) {
        const nx = cx + ox,
          ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= m.h) continue;
        const ni = ny * w + nx;
        if (flow[ni] !== -1 || !walk(ni)) continue;
        if (ox && oy && (!walk(cy * w + nx) || !walk(ny * w + cx))) continue;
        flow[ni] = flow[c] + 1;
        q[tail++] = ni;
      }
    }
  }

  updateZombies(dt) {
    const p = this.player;
    for (const z of this.zombies) {
      z.hitT = Math.max(0, z.hitT - dt);
      z.swipeT = Math.max(0, z.swipeT - dt);
      if (z.state === 'dying') {
        z.deathT += dt;
        continue;
      }
      z.attackCd = Math.max(0, z.attackCd - dt);
      z.groanT -= dt;
      if (z.groanT <= 0) {
        z.groanT = z.brute ? 4 + this.rand() * 4 : 3 + this.rand() * 6;
        this.sfx(z.brute ? 'brute' : 'groan', z.x, z.y, z.brute ? 0.9 : 0.7);
      }
      if (z.burnT > 0) {
        z.burnT -= dt;
        if (this.rand() < dt * 8)
          this.spawnParticle('ember', z.x, z.y, 0.2 + this.rand() * 0.4, 0.6, 0.6, true);
        this.damageZombie(z, (z.brute ? 120 : 70) * dt, 'burn');
        if (z.state === 'dying') continue;
      }
      const dpx = p.x - z.x,
        dpy = p.y - z.y;
      const dPlayer = Math.hypot(dpx, dpy);
      z.moving = false;

      switch (z.state) {
        case 'approach':
          this.zApproach(z, dt);
          break;
        case 'tearing':
          this.zTear(z, dt, dPlayer);
          break;
        case 'entering':
          this.zEnter(z, dt);
          break;
        case 'chase':
          this.zChase(z, dt, dPlayer, dpx, dpy);
          break;
        case 'attack':
          z.attackT -= dt;
          if (z.attackT <= 0) {
            const reach = (z.returnState === 'tearing' ? 1.15 : 0.95) + (z.brute ? 0.3 : 0);
            if (dPlayer < reach) {
              this.hurtPlayer(z.brute ? 80 : ZOMBIE_DAMAGE, z.x, z.y);
              if (z.brute) {
                this.sfx('brute_hit', z.x, z.y);
                this.shake = 0.5;
              }
            }
            z.attackCd = z.brute ? 1.6 : 1.1;
            z.state = z.returnState;
          }
          break;
      }
      if (z.moving) z.anim += dt * (1.5 + z.speed * 2.2);
    }
    this.zombies = this.zombies.filter((z) => !(z.state === 'dying' && z.deathT > 7));

    // Separation so the horde doesn't collapse into one sprite.
    const zs = this.zombies;
    for (let i = 0; i < zs.length; i++) {
      const a = zs[i];
      if (a.state === 'dying') continue;
      const aIn = this.isInside(a);
      for (let j = i + 1; j < zs.length; j++) {
        const b = zs[j];
        if (b.state === 'dying' || this.isInside(b) !== aIn) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.18 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2),
          push = (0.43 - d) * 0.5;
        const ux = dx / d,
          uy = dy / d;
        if (aIn) {
          this.moveCircle(a, -ux * push, -uy * push, ZOMBIE_R);
          this.moveCircle(b, ux * push, uy * push, ZOMBIE_R);
        } else {
          if (a.state === 'approach') {
            a.x -= ux * push;
            a.y -= uy * push;
          }
          if (b.state === 'approach') {
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
    }
  }

  zApproach(z, dt) {
    const w = z.win;
    const tx = w.cx + w.nx * 0.05,
      ty = w.cy + w.ny * 0.05;
    const dx = tx - z.x,
      dy = ty - z.y,
      d = Math.hypot(dx, dy);
    const occupied = w.occupant && w.occupant !== z;
    const stopD = occupied ? 0.6 : 0.25;
    if (d > stopD + 0.01) {
      const step = Math.min(z.speed * 0.85 * dt, d - stopD);
      z.x += (dx / d) * step;
      z.y += (dy / d) * step;
      z.moving = true;
    } else if (!occupied) {
      z.x = tx;
      z.y = ty;
      if (w.planks > 0) {
        w.occupant = z;
        z.state = 'tearing';
        z.t = this.tearTime();
      } else this.startClimb(z);
    }
  }

  zTear(z, dt, dPlayer) {
    const w = z.win;
    if (z.brute && w.planks > 0) {
      w.planks = 0;
      this.sfx('plank', w.cx, w.cy, 1.5);
      this.shake = 0.3;
    }
    if (w.planks <= 0) {
      this.startClimb(z);
      return;
    }
    if (dPlayer < 1.2 && z.attackCd <= 0) {
      z.state = 'attack';
      z.attackT = 0.45;
      z.returnState = 'tearing';
      this.sfx('zattack', z.x, z.y);
      return;
    }
    z.t -= dt;
    if (z.t <= 0.35) z.swipeT = 0.1;
    if (z.t <= 0) {
      w.planks--;
      z.t = this.tearTime();
      this.sfx('plank', w.cx, w.cy);
      this.spawnParticle('splinter', w.cx + w.nx * 0.45, w.cy + w.ny * 0.45, 0.4, 1.2, 0.7);
    }
  }

  // Climbing in takes a moment: early rounds ~1.9s, never faster than ~1.1s.
  climbTime(z) {
    return Math.max(1.1, 1.9 - this.round * 0.04) * (z.speed > 2 ? 0.8 : 1);
  }

  startClimb(z) {
    z.state = 'entering';
    z.t = 0;
    z.climbDur = this.climbTime(z);
    z.pose = 'grab';
    z.climbZ = 0;
    // The window stays "occupied" until the zombie is over the sill, so the
    // next one waits outside instead of climbing through it at the same time.
    z.win.occupant = z;
  }

  zEnter(z, dt) {
    const w = z.win;
    z.t += dt;
    const p = Math.min(1, z.t / z.climbDur);
    const SILL = 0.22; // sill height in world units (matches the window texture)
    let s; // distance along the window normal from the window centre
    if (p < 0.35) {
      // haul up onto the sill
      const q = p / 0.35;
      s = 0.05 + 0.3 * q;
      z.climbZ = SILL * (1 - (1 - q) * (1 - q));
      z.pose = 'grab';
    } else if (p < 0.75) {
      // crawl across it
      const q = (p - 0.35) / 0.4;
      s = 0.35 + 0.4 * q;
      z.climbZ = SILL;
      z.pose = 'crawl';
      if (w.occupant === z && q > 0.5) w.occupant = null;
    } else {
      // drop down inside
      const q = (p - 0.75) / 0.25;
      s = 0.75 + 0.25 * q;
      z.climbZ = SILL * (1 - q * q);
      z.pose = 'drop';
    }
    z.x = w.cx + w.nx * s;
    z.y = w.cy + w.ny * s;
    if (p >= 1) {
      if (w.occupant === z) w.occupant = null;
      z.state = 'chase';
      z.climbZ = 0;
      z.pose = null;
    }
  }

  zChase(z, dt, dPlayer, dpx, dpy) {
    if (dPlayer < (z.brute ? 1.0 : 0.75) && z.attackCd <= 0) {
      z.state = 'attack';
      z.attackT = z.brute ? 0.6 : 0.4;
      z.returnState = 'chase';
      this.sfx(z.brute ? 'brute' : 'zattack', z.x, z.y, z.brute ? 0.7 : 1);
      return;
    }
    let tx = this.player.x,
      ty = this.player.y;
    const m = this.map;
    const ci = this.cellIndex(z.x, z.y);
    const fd = ci >= 0 ? this.flow[ci] : -1;
    if (dPlayer > 1.0 && fd > 0) {
      const mx = ci % m.w,
        my = (ci / m.w) | 0;
      let best = fd,
        bx = -1,
        by = -1;
      for (const [ox, oy] of DIRS8) {
        const nx = mx + ox,
          ny = my + oy;
        const v = this.flow[ny * m.w + nx];
        if (v < 0 || v >= best) continue;
        if (ox && oy && (this.flow[my * m.w + nx] < 0 || this.flow[ny * m.w + mx] < 0)) continue;
        best = v;
        bx = nx;
        by = ny;
      }
      if (bx >= 0) {
        tx = bx + 0.5;
        ty = by + 0.5;
      }
    }
    const dx = tx - z.x,
      dy = ty - z.y,
      d = Math.hypot(dx, dy);
    if (d > 0.3 || dPlayer > 0.5) {
      const step = z.speed * dt;
      this.moveCircle(z, (dx / (d || 1)) * step, (dy / (d || 1)) * step, ZOMBIE_R);
      z.moving = true;
    }
  }

  //=============================================================
  //                        PROJECTILES
  //=============================================================
  updateBolts(dt) {
    const keep = [];
    for (const b of this.bolts) {
      b.life -= dt;
      let exploded = false;
      const steps = 4,
        step = (14 * dt) / steps;
      for (let s = 0; s < steps && !exploded; s++) {
        const nx = b.x + b.dx * step,
          ny = b.y + b.dy * step;
        const ci = this.cellIndex(nx, ny);
        const k = ci < 0 ? K.WALL : this.map.kind[ci];
        if (k === K.WALL || k === K.DOOR || k === K.WALLBUY) {
          this.explode(b);
          exploded = true;
          break;
        }
        b.x = nx;
        b.y = ny;
        for (const z of this.zombies) {
          if (z.state !== 'dying' && Math.hypot(z.x - b.x, z.y - b.y) < 0.3) {
            this.explode(b);
            exploded = true;
            break;
          }
        }
      }
      if (!exploded && b.life <= 0) {
        this.explode(b);
        exploded = true;
      }
      if (!exploded) keep.push(b);
    }
    this.bolts = keep;
  }

  explode(b) {
    this.sfx('explode', b.x, b.y);
    for (let k = 0; k < 14; k++) this.spawnParticle('plasma', b.x, b.y, 0.4, 2.2, 0.5, true);
    for (const z of this.zombies) {
      if (z.state === 'dying') continue;
      const d = Math.hypot(z.x - b.x, z.y - b.y);
      if (d < b.splash) this.damageZombie(z, b.dmg * (1 - d / (b.splash * 1.4)), 'gun');
    }
  }

  //=============================================================
  //                         PARTICLES
  //=============================================================
  spawnParticle(type, x, y, z, speed = 1, life = 0.6, noGravity = false) {
    if (this.particles.length > 400) return;
    const a = this.rand() * Math.PI * 2;
    const s = speed * (0.3 + this.rand() * 0.7);
    this.particles.push({
      type,
      x,
      y,
      z,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      vz: (this.rand() * 0.8 + 0.2) * s,
      life: life * (0.6 + this.rand() * 0.6),
      max: life,
      grav: noGravity ? 0 : 6,
    });
  }

  updateParticles(dt) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.vz -= q.grav * dt;
      if (q.z < 0) {
        q.z = 0;
        q.vx = q.vy = q.vz = 0;
      }
      if (q.wallStop && this.sawBlocked(q.x, q.y)) q.life = 0;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  //=============================================================
  //                          POWERUPS
  //=============================================================
  updatePowerups(dt) {
    const p = this.player;
    for (const u of this.powerups) {
      u.t -= dt;
      if (u.t > 0 && Math.hypot(u.x - p.x, u.y - p.y) < 0.6) {
        u.t = 0;
        this.applyPowerup(u.type);
      }
    }
    this.powerups = this.powerups.filter((u) => u.t > 0);
  }

  applyPowerup(type) {
    const p = this.player;
    this.sfx('pickup');
    this.showBanner(POWERUPS[type].name, '', 2.5);
    if (type === 'ammo') {
      for (const w of p.weapons) {
        const d = WEAPONS[w.id];
        w.mag = d.mag;
        w.reserve = d.reserve;
      }
    } else if (type === 'double') {
      this.doubleT = POWERUPS.double.duration;
    } else if (type === 'blast') {
      for (const z of this.zombies) if (z.state !== 'dying') this.damageZombie(z, 1e9, 'blast');
      this.addPoints(400);
      this.shake = 0.5;
    }
  }

  //=============================================================
  //                           CRATE
  //=============================================================
  updateCrate(dt) {
    const c = this.crate;
    if (!c) return;
    if (c.state === 'spinning') {
      c.t -= dt;
      c.cycleT -= dt;
      if (c.cycleT <= 0) {
        c.display = BOX_POOL[Math.floor(this.rand() * BOX_POOL.length)][0];
        c.cycleT = 0.07 + (3.2 - c.t) * 0.06;
      }
      if (c.t <= 0) {
        const owned = new Set(this.player.weapons.map((w) => w.id));
        const pool = BOX_POOL.filter(([id]) => !owned.has(id));
        let r = this.rand() * pool.reduce((a, [, wgt]) => a + wgt, 0);
        let pick = pool[0][0];
        for (const [id, wgt] of pool) {
          r -= wgt;
          if (r <= 0) {
            pick = id;
            break;
          }
        }
        c.weapon = pick;
        c.display = pick;
        c.state = 'presenting';
        c.t = 9;
        this.sfx('crateDone', c.x, c.y);
      }
    } else if (c.state === 'presenting') {
      c.t -= dt;
      if (c.t <= 0) {
        c.state = 'idle';
        c.weapon = null;
      }
    }
  }
}

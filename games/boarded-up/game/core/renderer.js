// renderer.js - Boarded Up software raycaster that draws the 3D view
// Author: Reachnid Group
// Centennial College - Fall 2026

// Software raycaster. Renders the game into a Uint32Array (ABGR) at a fixed
// low internal resolution with a per-pixel depth buffer, so see-through
// windows, sprites and the outside all composite correctly.

import { K, WALL_TEX, FLOOR_KIND, CEIL_KIND } from './map.js';
import { WEAPONS } from './weapons.js';

export const VIEW_W = 480;
export const VIEW_H = 270;
const HFOV = (75 * Math.PI) / 180;
const CAM_H = 0.5;
const TEX = 64;
const MAX_DIST = 24;
const LUT_RES = 32; // lut entries per world unit
const VM_SCALE = 1.4; // first-person weapon art is drawn at 160x120 and scaled up

const FOG_R = 6,
  FOG_G = 7,
  FOG_B = 12;

export class Renderer {
  constructor(assets, w = VIEW_W, h = VIEW_H) {
    this.assets = assets;
    this.W = w;
    this.H = h;
    this.buf = new Uint32Array(w * h);
    this.depth = new Float32Array(w * h);
    this.planeLen = Math.tan(HFOV / 2);
    this.proj = w / 2 / this.planeLen;
    this.lut = new Int32Array(MAX_DIST * LUT_RES + 1);
    const T = assets.textures;
    this.wallTex = WALL_TEX.map((n) => (T.walls[n] || T.walls.brick).data);
    // Indexed by FLOOR_KIND / CEIL_KIND (sky is handled separately).
    this.floorTex = [T.floor, T.dirt, T.concreteFloor || T.floor, T.grate || T.floor].map(
      (t) => t.data,
    );
    this.ceilTex = [T.ceiling, T.ceiling, T.ceilingMetal || T.ceiling].map((t) => t.data);
    this.skyRows = new Uint32Array(h);
    this.overlays = [];
    // Pixels that must not be darkened by the blackout pass (glows, sky).
    this.emis = new Uint8Array(w * h);
    // Flashlight: bright cone in the middle of the screen, dim ambient outside.
    this.flashMask = new Uint16Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (h * 0.62),
          dy = (y - h * 0.52) / (h * 0.5);
        const r2 = dx * dx + dy * dy;
        const cone = r2 >= 1 ? 0 : (1 - r2) * (1 - r2);
        this.flashMask[y * w + x] = Math.round((0.16 + 0.84 * cone) * 256);
      }
  }

  // Darkens everything outside the flashlight cone while the power is out.
  blackoutPass(level) {
    const dark = Math.max(0, Math.min(1, (1 - level) / 0.7));
    if (dark < 0.01) return;
    const { buf, emis, flashMask } = this;
    const keep = Math.round((1 - dark) * 256);
    for (let i = 0; i < buf.length; i++) {
      if (emis[i]) continue;
      const f = keep + (((256 - keep) * flashMask[i]) >> 8);
      const c = buf[i];
      buf[i] =
        0xff000000 |
        (((((c >>> 16) & 255) * f) >> 8) << 16) |
        (((((c >>> 8) & 255) * f) >> 8) << 8) |
        (((c & 255) * f) >> 8);
    }
  }

  // Light falloff: 0..256. `flash` briefly lights the room when firing.
  buildLut(flash) {
    const lut = this.lut;
    for (let i = 0; i < lut.length; i++) {
      const d = i / LUT_RES;
      let s = Math.exp(-0.17 * d) * 1.08;
      s += flash * 0.55 * Math.exp(-0.35 * d);
      lut[i] = Math.max(14, Math.min(256, (s * 256) | 0));
    }
  }

  shadeAt(d) {
    const i = (d * LUT_RES) | 0;
    return this.lut[i < this.lut.length ? i : this.lut.length - 1];
  }

  render(game, hideWeapon = false) {
    const { W, H, buf, depth } = this;
    const p = game.player;
    const t = game.time;

    const flashAmt = p.flash > 0 ? 1 : 0;
    this.buildLut(flashAmt);

    // Aim-down-sights zoom narrows the field of view.
    const zoomFov = ((WEAPONS[game.weapon.id].zoom || 55) * Math.PI) / 180;
    const fov = HFOV + (zoomFov - HFOV) * (p.ads || 0);
    this.planeLen = Math.tan(fov / 2);
    this.proj = W / 2 / this.planeLen;

    const bobY = p.moving ? Math.abs(Math.cos(p.bob)) * 3 - 1.5 : 0;
    const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake * 18 : 0;
    const shakeA = game.shake > 0 ? (Math.random() - 0.5) * game.shake * 0.02 : 0;
    const deadDrop = game.state === 'dead' ? Math.min(1, game.deadT * 1.5) : 0;
    this.camH = CAM_H - deadDrop * 0.38;
    this.horizon = H / 2 + bobY + shakeY;

    const a = p.angle + shakeA;
    this.dirX = Math.cos(a);
    this.dirY = Math.sin(a);
    this.rightX = -Math.sin(a);
    this.rightY = Math.cos(a);
    this.planeX = this.rightX * this.planeLen;
    this.planeY = this.rightY * this.planeLen;
    this.px = p.x;
    this.py = p.y;

    depth.fill(Infinity);
    this.emis.fill(0);
    this.renderFloorCeil(game);
    this.renderWalls(game);
    this.renderSprites(game);
    if ((game.lightLevel ?? 1) < 0.99) this.blackoutPass(game.lightLevel);
    if (!hideWeapon) this.renderViewmodel(game);
    return buf;
  }

  //=============================================================
  //                        FLOOR/CEIL
  //=============================================================
  renderFloorCeil(game) {
    const { W, H, buf, px, py, dirX, dirY, planeX, planeY, proj, horizon } = this;
    const m = game.map;
    const floorTex = this.floorTex,
      ceilTex = this.ceilTex,
      emis = this.emis;
    const camH = this.camH;

    // Night sky gradient rows (only visible through windows).
    for (let y = 0; y < H; y++) {
      const f = Math.max(0, Math.min(1, y / horizon));
      const r = 8 + f * 14,
        g = 10 + f * 16,
        b = 22 + f * 22;
      this.skyRows[y] = (255 << 24) | (b << 16) | (g << 8) | r;
    }

    for (let y = 0; y < H; y++) {
      const isFloor = y >= horizon;
      let pdist = isFloor ? y + 0.5 - horizon : horizon - y - 0.5;
      if (pdist < 0.5) pdist = 0.5;
      const rowDist = ((isFloor ? camH : 1 - camH) * proj) / pdist;
      let fx = px + rowDist * (dirX - planeX);
      let fy = py + rowDist * (dirY - planeY);
      const sx = (rowDist * 2 * planeX) / W,
        sy = (rowDist * 2 * planeY) / W;
      const s = this.shadeAt(rowDist);
      const is = 256 - s;
      const fogR = FOG_R * is,
        fogG = FOG_G * is,
        fogB = FOG_B * is;
      const sky = this.skyRows[y];
      const kinds = isFloor ? m.floorKind : m.ceilKind;
      let o = y * W;
      for (let x = 0; x < W; x++, o++, fx += sx, fy += sy) {
        const cx = Math.floor(fx),
          cy = Math.floor(fy);
        let kind = 1;
        if (cx >= 0 && cy >= 0 && cx < m.w && cy < m.h) kind = kinds[cy * m.w + cx];
        if (!isFloor && kind === CEIL_KIND.SKY) {
          buf[o] = sky;
          emis[o] = 1;
          continue;
        }
        const tex = isFloor ? floorTex[kind] || floorTex[0] : ceilTex[kind] || ceilTex[0];
        const c = tex[(((fy - cy) * TEX) & 63) * TEX + (((fx - cx) * TEX) & 63)];
        buf[o] =
          0xff000000 |
          (((((c >>> 16) & 255) * s + fogB) >> 8) << 16) |
          (((((c >>> 8) & 255) * s + fogG) >> 8) << 8) |
          (((c & 255) * s + fogR) >> 8);
      }
    }
  }

  //=============================================================
  //                           WALLS
  //=============================================================
  renderWalls(game) {
    const { W, px, py, dirX, dirY, planeX, planeY } = this;
    const m = game.map;
    const kind = m.kind,
      mw = m.w,
      mh = m.h;
    const T = this.assets.textures;
    const windows = m.windowStyle === 'metal' && T.windowsMetal ? T.windowsMetal : T.windows;
    const overlays = this.overlays;

    for (let x = 0; x < W; x++) {
      const camX = (2 * (x + 0.5)) / W - 1;
      const rdx = dirX + planeX * camX,
        rdy = dirY + planeY * camX;
      let mx = Math.floor(px),
        my = Math.floor(py);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      let stepX, stepY, sdx, sdy;
      if (rdx < 0) {
        stepX = -1;
        sdx = (px - mx) * ddx;
      } else {
        stepX = 1;
        sdx = (mx + 1 - px) * ddx;
      }
      if (rdy < 0) {
        stepY = -1;
        sdy = (py - my) * ddy;
      } else {
        stepY = 1;
        sdy = (my + 1 - py) * ddy;
      }
      overlays.length = 0;

      for (let i = 0; i < 96; i++) {
        let side;
        if (sdx < sdy) {
          sdx += ddx;
          mx += stepX;
          side = 0;
        } else {
          sdy += ddy;
          my += stepY;
          side = 1;
        }
        if (mx < 0 || my < 0 || mx >= mw || my >= mh) break;
        const ci = my * mw + mx;
        const k = kind[ci];
        if (k === K.FLOOR || k === K.OUTSIDE) continue;
        const perp = side === 0 ? sdx - ddx : sdy - ddy;
        if (perp > MAX_DIST) break;
        let wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
        wallX -= Math.floor(wallX);
        let texX = (wallX * TEX) | 0;
        if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = TEX - 1 - texX;
        if (k === K.WINDOW) {
          const win = m.windowAt.get(ci);
          overlays.push(perp, texX, side, win ? win.planks : 5);
          continue;
        }
        this.drawColumn(x, perp, this.wallTex[m.wallTex[ci]], texX, side, false);
        break;
      }
      for (let o = overlays.length - 4; o >= 0; o -= 4)
        this.drawColumn(
          x,
          overlays[o],
          windows[overlays[o + 3]].data,
          overlays[o + 1],
          overlays[o + 2],
          true,
        );
    }
  }

  drawColumn(x, perp, tex, texX, side, transparent) {
    const { W, H, buf, depth, horizon, proj } = this;
    const lineH = proj / perp;
    const top = horizon - (1 - this.camH) * lineH;
    const bottom = horizon + this.camH * lineH;
    const y0 = Math.max(0, Math.ceil(top)),
      y1 = Math.min(H, Math.ceil(bottom));
    let s = this.shadeAt(perp);
    if (side === 1) s = (s * 0.78) | 0;
    const is = 256 - s;
    const fogR = FOG_R * is,
      fogG = FOG_G * is,
      fogB = FOG_B * is;
    const texStep = TEX / lineH;
    let ty = (y0 - top) * texStep;
    for (let y = y0; y < y1; y++, ty += texStep) {
      const o = y * W + x;
      const c = tex[((ty | 0) & 63) * TEX + texX];
      if (transparent) {
        if (!(c >>> 24) || depth[o] <= perp) continue;
      }
      depth[o] = perp;
      this.emis[o] = 0;
      buf[o] =
        0xff000000 |
        (((((c >>> 16) & 255) * s + fogB) >> 8) << 16) |
        (((((c >>> 8) & 255) * s + fogG) >> 8) << 8) |
        (((c & 255) * s + fogR) >> 8);
    }
  }

  //=============================================================
  //                          SPRITES
  //=============================================================
  collectSprites(game) {
    const A = this.assets.sprites;
    const icons = this.assets.weaponArt.icons;
    const out = [];
    const t = game.time;

    const fx = this.assets.fx;
    const P = A.props || {};
    for (const z of game.zombies) {
      const set = z.brute && A.brute ? A.brute : A.zombies[z.variant % A.zombies.length];
      let img,
        zOff = 0;
      if (z.state === 'dying') {
        const d = z.deathT;
        img = d < 0.15 ? set.death[0] : d < 0.32 ? set.death[1] : set.death[2];
        if (d > 5) zOff = -(d - 5) * 0.12;
      } else if (z.state === 'entering') {
        // Climbing through the window: grab the sill, crawl over it, drop down.
        img = z.pose === 'grab' ? set.attack : z.pose === 'crawl' ? set.death[1] : set.walk[1];
        zOff = z.climbZ || 0;
      } else if (z.state === 'attack' || z.swipeT > 0) img = set.attack;
      else if (z.moving) {
        const f = Math.floor(z.anim) % 4;
        img = set.walk[f === 3 ? 1 : f];
      } else img = set.walk[1];
      const zw = z.brute ? (A.brute ? 0.69 : 0.6) : 0.42,
        zh = z.brute ? 0.92 : 0.67;
      out.push({ x: z.x, y: z.y, img, w: zw, h: zh, z: zOff, flash: z.hitT > 0 });
      if (z.burnT > 0 && fx && z.state !== 'dying') {
        const f = fx.burning[Math.floor(t * 12 + z.id) % fx.burning.length];
        out.push({ x: z.x, y: z.y, img: f, w: zw, h: zh, z: zOff, bias: -0.02 });
      }
    }

    // Props: generator, trap consoles, mission objects, set dressing.
    const propImg = (pr) => {
      switch (pr.type) {
        case 'generator':
          return pr.state === 'on' ? P.generatorOn : P.generatorOff;
        case 'trap':
          return pr.state === 'on' ? P.trapOn : P.trapOff;
        case 'breaker':
          return pr.state === 'on' ? P.breakerOn : P.breakerOff;
        case 'flare':
          return pr.state === 'on' ? P.flareOn : P.flareOff;
        default:
          return P[pr.type];
      }
    };
    const PROP_DIM = {
      generator: [0.95, 0.8],
      trap: [0.36, 0.6],
      breaker: [0.36, 0.6],
      flare: [0.2, 0.3],
      radio: [0.5, 0.5],
      heli: [2.6, 1.3],
    };
    for (const pr of game.props) {
      if (pr.hidden) continue;
      const img = propImg(pr);
      if (!img) continue;
      const [dw, dh] = PROP_DIM[pr.type] || [pr.w || 0.4, pr.h || 0.4];
      const bob = pr.float ? 0.08 + Math.sin(t * 3 + pr.id) * 0.04 : 0;
      out.push({ x: pr.x, y: pr.y, img, w: dw, h: dh, z: (pr.z || 0) + bob, glow: pr.float });
    }
    for (const d of game.map.decor || []) {
      const img = P[d.type];
      if (img) out.push({ x: d.x, y: d.y, img, w: 0.78, h: 0.78, z: 0 });
    }

    const c = game.crate;
    if (c && c.x !== undefined) {
      const open = c.state !== 'idle';
      out.push({
        x: c.x,
        y: c.y,
        img: open ? A.crate.open : A.crate.closed,
        w: 0.9,
        h: 0.5625,
        z: 0,
      });
      if (open && icons[c.display]) {
        const icon = icons[c.display];
        const rise = c.state === 'spinning' ? Math.min(1, (3.2 - c.t) / 1.2) : 1;
        out.push({
          x: c.x,
          y: c.y,
          img: icon,
          w: 0.62,
          h: (0.62 * icon.h) / icon.w,
          z: 0.35 + rise * 0.25 + Math.sin(t * 3) * 0.02,
          glow: true,
        });
      }
    }

    for (const pk of game.map.perks)
      out.push({ x: pk.x, y: pk.y, img: A.perks[pk.perk], w: 0.45, h: 0.84, z: 0 });

    for (const u of game.powerups) {
      if (u.t < 5 && Math.floor(t * 6) % 2 === 0) continue;
      out.push({
        x: u.x,
        y: u.y,
        img: A.powerups[u.type],
        w: 0.3,
        h: 0.3,
        z: 0.18 + Math.sin(t * 3 + u.x) * 0.05,
      });
    }

    for (const q of game.particles) {
      let img, size;
      if (q.type === 'flame' && fx) {
        const age = 1 - q.life / q.max;
        img = fx.flame[Math.min(fx.flame.length - 1, Math.floor(age * fx.flame.length))];
        size = 0.12 + age * 0.42;
      } else if ((q.type === 'arc' || q.type === 'ember' || q.type === 'smoke') && fx) {
        img = fx[q.type];
        size = q.type === 'arc' ? 0.1 : q.type === 'smoke' ? 0.3 : 0.045;
      } else {
        img = A.particles[q.type] || this.assets.extra[q.type];
        size = q.type === 'beam' ? 0.07 : q.type === 'plasma' ? 0.12 : 0.06;
      }
      if (!img) continue;
      out.push({ x: q.x, y: q.y, img, w: size, h: size, z: q.z - size / 2 });
    }

    for (const b of game.bolts) out.push({ x: b.x, y: b.y, img: A.bolt, w: 0.2, h: 0.2, z: 0.33 });
    if (fx)
      for (const sw of game.saws)
        out.push({
          x: sw.x,
          y: sw.y,
          img: fx.saw[Math.floor(sw.spin) % fx.saw.length],
          w: 0.26,
          h: 0.26,
          z: 0.3,
        });
    return out;
  }

  renderSprites(game) {
    const { W, H, buf, depth, px, py, dirX, dirY, rightX, rightY, proj, horizon } = this;
    const sprites = this.collectSprites(game);
    for (const s of sprites) {
      const rx = s.x - px,
        ry = s.y - py;
      const dz = rx * dirX + ry * dirY;
      if (dz < 0.12 || dz > MAX_DIST) continue;
      const dzTest = dz + (s.bias || 0);
      const lat = rx * rightX + ry * rightY;
      const scale = proj / dz;
      const sw = s.w * scale,
        sh = s.h * scale;
      const cx = W / 2 + lat * scale;
      const bottom = horizon + (this.camH - s.z) * scale;
      const top = bottom - sh;
      const left = cx - sw / 2;
      const x0 = Math.max(0, Math.ceil(left)),
        x1 = Math.min(W, Math.ceil(left + sw));
      const y0 = Math.max(0, Math.ceil(top)),
        y1 = Math.min(H, Math.ceil(bottom));
      if (x0 >= x1 || y0 >= y1) continue;

      const img = s.img,
        iw = img.w,
        ih = img.h,
        data = img.data;
      let sh8 = this.shadeAt(dz);
      if (s.glow) sh8 = 256;
      const is = 256 - sh8;
      const fogR = FOG_R * is,
        fogG = FOG_G * is,
        fogB = FOG_B * is;
      const flash = s.flash;
      const kx = iw / sw,
        ky = ih / sh;

      for (let x = x0; x < x1; x++) {
        const tx = Math.min(iw - 1, ((x - left) * kx) | 0);
        for (let y = y0; y < y1; y++) {
          const ty = Math.min(ih - 1, ((y - top) * ky) | 0);
          const c = data[ty * iw + tx];
          const al = c >>> 24;
          if (!al) continue;
          const o = y * W + x;
          if (depth[o] <= dzTest) continue;
          depth[o] = dzTest;
          let r = c & 255,
            g = (c >>> 8) & 255,
            b = (c >>> 16) & 255;
          this.emis[o] = al === 254 || s.glow ? 1 : 0;
          if (al !== 254) {
            r = (r * sh8 + fogR) >> 8;
            g = (g * sh8 + fogG) >> 8;
            b = (b * sh8 + fogB) >> 8;
          }
          if (flash) {
            r = (r + 255) >> 1;
            g = (g + 180) >> 1;
            b = (b + 170) >> 1;
          }
          buf[o] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
      }
    }
  }

  //=============================================================
  //                         VIEWMODEL
  //=============================================================
  blitLit(img, ox, oy, light, scale = 1) {
    const { W, H, buf } = this;
    ox = Math.round(ox);
    oy = Math.round(oy);
    const data = img.data;
    const dw = Math.round(img.w * scale),
      dh = Math.round(img.h * scale);
    const inv = 1 / scale;
    for (let y = 0; y < dh; y++) {
      const dy = y + oy;
      if (dy < 0 || dy >= H) continue;
      const sy = Math.min(img.h - 1, (y * inv) | 0);
      for (let x = 0; x < dw; x++) {
        const dx = x + ox;
        if (dx < 0 || dx >= W) continue;
        const c = data[sy * img.w + Math.min(img.w - 1, (x * inv) | 0)];
        const al = c >>> 24;
        if (!al) continue;
        if (al === 254) {
          buf[dy * W + dx] = c | 0xff000000;
          continue;
        }
        const r = Math.min(255, ((c & 255) * light) >> 8);
        const g = Math.min(255, (((c >>> 8) & 255) * light) >> 8);
        const b = Math.min(255, (((c >>> 16) & 255) * light) >> 8);
        buf[dy * W + dx] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
  }

  renderViewmodel(game) {
    if (game.state === 'dead') return;
    const { W, H } = this;
    const p = game.player;
    const art = this.assets.weaponArt;
    const w = game.weapon;
    const def = WEAPONS[w.id];
    const vm = art.viewmodels[w.id];
    if (!vm) return;

    const light = p.flash > 0 ? 300 : 200;
    const bobX = p.moving ? Math.sin(p.bob * 0.5) * 7 : 0;
    const bobY = p.moving ? Math.abs(Math.cos(p.bob * 0.5)) * 5 : 0;
    const sprintY = p.sprinting ? 22 : 0;
    let lower = 0;
    if (p.reloadT > 0) lower = Math.sin((1 - p.reloadT / p.reloadDur) * Math.PI) * 75;
    if (p.switchT > 0) lower = Math.max(lower, (p.switchT / 0.45) * 110);
    if (p.meleeT > 0) lower = Math.max(lower, 90);

    // Hip position, and an aim-down-sights position: the gun centres and drops
    // so only its sights poke up from the bottom of the screen (the HUD draws
    // the reticle at the crosshair). This keeps the view clear while aiming.
    const ads = p.ads || 0;
    const hipS = VM_SCALE;
    const hipX = W / 2 + 62 - (vm.img.w * hipS) / 2;
    const hipY = H - vm.img.h * hipS + 8;
    const adsS = hipS;
    const aimY = H * 0.83;
    const adsX = W / 2 - vm.muzzle.x * adsS;
    const adsY = Math.max(aimY - vm.muzzle.y * adsS, hipY);
    const S = hipS + (adsS - hipS) * ads;
    const wob = 1 - ads * 0.85;
    const ox = hipX + (adsX - hipX) * ads + (bobX + (p.sprinting ? 18 : 0)) * wob;
    const oy =
      hipY + (adsY - hipY) * ads + (bobY + sprintY) * wob + p.recoil * (9 - ads * 5) + lower;

    if (p.meleeT > 0 && art.viewmodels.knife) {
      const k = art.viewmodels.knife;
      const prog = 1 - p.meleeT / 0.5;
      const sw = Math.sin(prog * Math.PI);
      this.blitLit(
        k.img,
        W / 2 + 60 - (k.img.w * S) / 2 - sw * 120,
        H - k.img.h * S + 40 - sw * 40,
        210,
        S,
      );
    }

    this.blitLit(vm.img, ox, oy, light, S);

    if (p.flash > 0 && vm.muzzle) {
      const fl = art.muzzle[def.flash] || art.muzzle.normal;
      const fs = def.pellets > 1 || w.id === 'magnum' || w.id === 'rail' ? 1.6 : 1.2;
      this.blitLit(
        fl,
        ox + vm.muzzle.x * S - (fl.w * fs) / 2,
        oy + vm.muzzle.y * S - (fl.h * fs) / 2,
        256,
        fs,
      );
    }
  }
}

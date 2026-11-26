// sprites.js - Boarded Up zombie, crate, perk machine and power-up sprites
// Author: Reachnid Group
// Centennial College - Fall 2026

// Procedural billboard sprites: zombies (4 variants, walk/attack/death), mystery
// crate, perk machines, powerups, particles and the plasma bolt.
// Every image is generated in code with seeded noise so output is deterministic.
import {
  EMISSIVE,
  rgba,
  glow,
  tint,
  mix,
  makeImage,
  mulberry32,
  hash2,
  valueNoise,
  setPx,
  getPx,
  fillRect,
  fillEllipse,
  fillPoly,
  drawLine,
  outline,
  vary,
} from './pixel.js';

const OUTLINE = rgba(9, 7, 8);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

//=============================================================
//                      LAYERED CANVAS
//=============================================================

// Layered canvas: colour + part id per pixel. Part ids are assigned in draw
// order, which lets the shading pass find occlusion edges between body parts.

function makeLayer(w, h) {
  return { img: makeImage(w, h), id: new Uint8Array(w * h) };
}

function plot(L, x, y, id, col) {
  const { w, h } = L.img;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const c = typeof col === 'function' ? col(x, y) : col;
  if (!c) return;
  const i = y * w + x;
  L.img.data[i] = c;
  L.id[i] = id;
}

function ellipseL(L, cx, cy, rx, ry, id, col) {
  const y0 = Math.floor(cy - ry),
    y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (dy * dy > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const xa = Math.round(cx - half),
      xb = Math.round(cx + half);
    for (let x = xa; x < xb; x++) plot(L, x, y, id, col);
  }
}

function polyL(L, pts, id, col) {
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const xs = [];
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const yc = y + 0.5;
    xs.length = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i],
        [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc))
        xs.push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.round(xs[k]),
        xb = Math.round(xs[k + 1]);
      for (let x = xa; x < xb; x++) plot(L, x, y, id, col);
    }
  }
}

// Tapered capsule from a (radius ra) to b (radius rb).
function capsule(L, ax, ay, bx, by, ra, rb, id, col) {
  const x0 = Math.floor(Math.min(ax - ra, bx - rb)),
    x1 = Math.ceil(Math.max(ax + ra, bx + rb));
  const y0 = Math.floor(Math.min(ay - ra, by - rb)),
    y1 = Math.ceil(Math.max(ay + ra, by + rb));
  const dx = bx - ax,
    dy = by - ay,
    len2 = dx * dx + dy * dy || 1e-6;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      const t = clamp01(((px - ax) * dx + (py - ay) * dy) / len2);
      const qx = ax + dx * t,
        qy = ay + dy * t;
      const r = ra + (rb - ra) * t;
      if ((px - qx) ** 2 + (py - qy) ** 2 <= r * r) plot(L, x, y, id, col);
    }
  }
}

// Directional shading: light comes from the upper right. Edges facing the
// light brighten, edges away from it (and edges occluded by a part in front)
// darken; the lower body fades darker.
function shadeLayer(L, opts = {}) {
  const { w, h, data } = L.img;
  const src = new Uint32Array(data);
  const ids = L.id;
  const top = opts.top ?? 0,
    bottom = opts.bottom ?? h;
  const bbox = new Map();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!(src[i] >>> 24)) continue;
      const b = bbox.get(ids[i]);
      if (!b) bbox.set(ids[i], [x, x]);
      else {
        if (x < b[0]) b[0] = x;
        if (x > b[1]) b[1] = x;
      }
    }
  const nb = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return -1;
    const i = y * w + x;
    return src[i] >>> 24 ? ids[i] : -1;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = src[i];
      if (c >>> 24 !== 255) continue;
      const me = ids[i];
      if (me === 0) continue; // id 0 = unshaded (floor decals etc.)
      let f = 1.12 - 0.34 * clamp01((y - top) / (bottom - top));
      const b = bbox.get(me);
      if (b[1] - b[0] > 2) f *= 0.78 + 0.4 * ((x - b[0]) / (b[1] - b[0]));
      const l = nb(x - 1, y),
        r = nb(x + 1, y),
        u = nb(x, y - 1),
        d = nb(x, y + 1);
      if (l < 0) f *= 0.7;
      else if (l > me) f *= 0.68;
      else if (l < me && l !== me) f *= 0.82;
      if (r < 0) f *= 1.16;
      else if (r > me) f *= 0.7;
      else if (r < me) f *= 1.08;
      if (u < 0) f *= 1.2;
      else if (u > me) f *= 0.74;
      else if (u < me) f *= 1.1;
      if (d < 0) f *= 0.84;
      else if (d > me) f *= 0.7;
      else if (d < me) f *= 0.88;
      const l2 = nb(x - 2, y);
      if (l2 < 0 && l >= 0) f *= 0.88;
      data[i] = tint(c, f);
    }
}

//=============================================================
//                 ZOMBIE PALETTE & TEXTURES
//=============================================================

// Zombie palette & textures

const SKIN = [rgba(126, 142, 104), rgba(132, 138, 98), rgba(118, 136, 108), rgba(136, 146, 118)];
const ROT = rgba(78, 90, 60);
const BRUISE = rgba(92, 72, 84);
const BLOOD = rgba(112, 14, 14);
const BLOOD_DK = rgba(62, 8, 9);
const GORE = rgba(150, 40, 36);
const SOCKET = rgba(26, 18, 20);
const MOUTH = rgba(30, 6, 8);
const TEETH = rgba(176, 164, 122);
const EYE = glow(255, 96, 28);
const EYE_DIM = glow(170, 40, 12);

const VARIANTS = [
  {
    // 0: dark green work shirt + jeans
    shirt: rgba(54, 82, 50),
    sleeve: rgba(54, 82, 50),
    pants: rgba(54, 70, 104),
    shoes: rgba(46, 34, 26),
    hair: rgba(34, 26, 20),
    belt: rgba(46, 34, 24),
    style: 'work',
    seed: 11,
  },
  {
    // 1: maroon shirt + brown pants
    shirt: rgba(118, 30, 40),
    sleeve: rgba(118, 30, 40),
    pants: rgba(94, 66, 42),
    shoes: rgba(34, 28, 26),
    hair: rgba(66, 44, 28),
    belt: rgba(40, 30, 22),
    style: 'casual',
    seed: 23,
  },
  {
    // 2: blue-grey security uniform
    shirt: rgba(92, 106, 124),
    sleeve: rgba(92, 106, 124),
    pants: rgba(52, 60, 78),
    shoes: rgba(24, 24, 28),
    hair: rgba(28, 24, 22),
    belt: rgba(22, 22, 24),
    style: 'security',
    seed: 37,
  },
  {
    // 3: stained white lab coat
    shirt: rgba(198, 198, 188),
    sleeve: rgba(198, 198, 188),
    pants: rgba(64, 62, 66),
    shoes: rgba(40, 30, 26),
    hair: rgba(104, 100, 92),
    belt: rgba(30, 28, 30),
    style: 'lab',
    seed: 51,
    inner: rgba(108, 132, 156),
    tie: rgba(96, 30, 32),
    stain: rgba(150, 128, 84),
  },
];

// Cloth texture: weave noise, grime, blood stains and torn holes showing rotting skin.
function clothFn(base, skin, seed, ox, oy, opts = {}) {
  const bloodAmt = opts.blood ?? 0.76;
  const tearAmt = opts.tear ?? 0.8;
  const stain = opts.stain;
  return (x, y) => {
    const u = x - ox,
      v = y - oy;
    let c = tint(base, 0.86 + 0.24 * valueNoise(u * 0.45, v * 0.45, 64, seed));
    if (hash2(u, v, seed + 3) < 0.07) c = tint(c, 0.84);
    if (stain && valueNoise(u * 0.22 + 4, v * 0.22 + 1, 64, seed + 12) > 0.6)
      c = mix(c, stain, 0.45);
    const tear = valueNoise(u * 0.42 + 3, v * 0.42 + 7, 64, seed + 9);
    if (tear > tearAmt) return tear > tearAmt + 0.05 ? tint(skin, 0.72) : tint(skin, 0.45);
    const bl =
      valueNoise(u * 0.3 + 11, v * 0.3, 64, seed + 15) +
      (opts.bloodBias ? opts.bloodBias(u, v) : 0);
    if (bl > bloodAmt + 0.1) return mix(c, BLOOD_DK, 0.8);
    if (bl > bloodAmt) return mix(c, BLOOD, 0.55);
    return c;
  };
}

function skinFn(skin, seed, ox, oy) {
  return (x, y) => {
    const u = x - ox,
      v = y - oy;
    let c = tint(skin, 0.9 + 0.16 * valueNoise(u * 0.5, v * 0.5, 64, seed));
    const rot = valueNoise(u * 0.35 + 5, v * 0.35 + 2, 64, seed + 21);
    if (rot > 0.74) c = mix(c, ROT, 0.75);
    else if (rot < 0.18) c = mix(c, BRUISE, 0.55);
    const gash = valueNoise(u * 0.6 + 1, v * 0.6 + 9, 64, seed + 33);
    if (gash > 0.86) c = gash > 0.9 ? BLOOD_DK : GORE;
    return c;
  };
}

//=============================================================
//                     ZOMBIE BODY PARTS
//=============================================================

// Zombie body parts

// Hand: a palm plus splayed bony fingers with dark claw tips pointing along
// `dir` (down for limp dangling wrists, up/out for clawing).
function drawHand(L, hx, hy, dir, id, skin, claw, fingerC) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len,
    uy = dir[1] / len;
  ellipseL(L, hx, hy, claw ? 2.5 : 2.2, claw ? 2.4 : 2.1, id, skin);
  const nf = claw ? 4 : 3;
  const spread = claw ? 0.42 : 0.32;
  for (let k = 0; k < nf; k++) {
    const off = k - (nf - 1) / 2;
    const a = off * spread;
    const cs = Math.cos(a),
      sn = Math.sin(a);
    const fx = ux * cs - uy * sn,
      fy = ux * sn + uy * cs;
    const l = (claw ? 3.6 : 3.6) - Math.abs(off) * 0.6;
    const sx = hx + fx * 1.4 - uy * off * 1.15,
      sy = hy + fy * 1.4 + ux * off * 1.15;
    for (let s = 0; s <= l; s += 0.5) {
      plot(
        L,
        Math.floor(sx + fx * s),
        Math.floor(sy + fy * s),
        id,
        s > l - 0.8 ? rgba(40, 34, 28) : tint(fingerC, 0.95 - s * 0.06),
      );
    }
  }
}

function drawArm(L, v, skin, sh, el, ha, id, seed, claw, fdir) {
  const skinC = skinFn(skin, seed, sh[0], sh[1]);
  const sleeveC = clothFn(v.sleeve, skin, seed + 1, sh[0], sh[1], { blood: 0.8, stain: v.stain });
  // upper arm (sleeve)
  capsule(L, sh[0], sh[1], el[0], el[1], 2.6, 2.2, id, sleeveC);
  // forearm: long sleeve for lab coat / security, rolled or torn for the others
  const sleeveLen = v.style === 'lab' ? 0.65 : v.style === 'security' ? 0.3 : 0.15;
  const mx = el[0] + (ha[0] - el[0]) * sleeveLen,
    my = el[1] + (ha[1] - el[1]) * sleeveLen;
  capsule(L, el[0], el[1], ha[0], ha[1], 2.0, 1.7, id, skinC);
  capsule(L, el[0], el[1], mx, my, 2.25, 2.1, id, sleeveC);
  // ragged sleeve end
  const ex = mx - el[0],
    ey = my - el[1];
  for (let k = -2; k <= 2; k++) {
    if (hash2(k, seed, 77) < 0.5) continue;
    const len = Math.hypot(ex, ey) || 1;
    const px = mx + (-ey / len) * k * 0.9 + (ex / len) * 0.8,
      py = my + (ex / len) * k * 0.9 + (ey / len) * 0.8;
    plot(L, Math.floor(px), Math.floor(py), id, tint(v.sleeve, 0.7));
  }
  drawHand(L, ha[0], ha[1], fdir || [ha[0] - el[0], ha[1] - el[1]], id, skinC, claw, skin);
}

function drawLeg(L, v, skin, hip, knee, foot, id, seed) {
  const pantsC = clothFn(v.pants, skin, seed, hip[0], hip[1], { blood: 0.8, tear: 0.87 });
  capsule(L, hip[0], hip[1], knee[0], knee[1], 3.3, 2.8, id, pantsC);
  capsule(L, knee[0], knee[1], foot[0], foot[1] - 1, 2.8, 2.3, id, pantsC);
  // knee seam shading
  plot(L, Math.round(knee[0]) - 1, Math.round(knee[1]), id, tint(v.pants, 0.7));
  // shoe
  const shoe = (x, y) => (y >= foot[1] + 1 ? tint(v.shoes, 0.7) : v.shoes);
  ellipseL(L, foot[0] + 0.3, foot[1] + 0.2, 3.3, 2.0, id, shoe);
  fillRowL(L, foot[0] - 3, foot[0] + 3.6, Math.round(foot[1]) + 1, id, tint(v.shoes, 0.75));
}

function fillRowL(L, xa, xb, y, id, col) {
  for (let x = Math.round(xa); x < Math.round(xb); x++) plot(L, x, y, id, col);
}

function drawTorso(L, v, skin, P, id) {
  const { shL, shR, hipL, hipR } = P;
  const seed = v.seed;
  const waistY = (hipL[1] + hipR[1]) / 2 - 2;
  const wcx = (hipL[0] + hipR[0]) / 2;
  const scx = (shL[0] + shR[0]) / 2,
    scy = (shL[1] + shR[1]) / 2;
  // blood drool down the chest from the mouth
  // drool streak from the mouth down the front of the shirt
  const bias = (u, vv) =>
    Math.max(0, 0.42 - Math.abs(u + 0.5 - (vv > 6 ? 1 : 0)) * 0.14 - Math.max(0, vv - 3) * 0.03);
  const shirtC = clothFn(v.shirt, skin, seed, scx, scy, {
    blood: 0.74,
    bloodBias: bias,
    stain: v.stain,
  });
  // hunched trapezius sloping from the neck to rounded shoulders, tapering to the waist
  const pts = [
    [scx - 3, scy - 2.6],
    [scx + 3, scy - 2.6],
    [shR[0] + 0.8, shR[1] - 1.6],
    [shR[0] + 2.0, shR[1] - 0.2],
    [shR[0] + 1.6, shR[1] + 7],
    [wcx + 6.0, waistY],
    [wcx - 6.0, waistY],
    [shL[0] - 1.6, shL[1] + 7],
    [shL[0] - 2.0, shL[1] - 0.2],
    [shL[0] - 0.8, shL[1] - 1.6],
  ];
  polyL(L, pts, id, shirtC);
  // ragged hem
  for (let x = Math.round(wcx - 6); x < Math.round(wcx + 6); x++) {
    const hh = hash2(x, 3, seed);
    if (hh < 0.45) plot(L, x, Math.round(waistY), id, tint(v.shirt, 0.78));
    if (hh < 0.15) plot(L, x, Math.round(waistY) + 1, id, tint(v.shirt, 0.7));
  }
  const cx = Math.round(scx),
    cy = Math.round(scy);
  const dark = tint(v.shirt, 0.62);
  // collar / neckline
  if (v.style === 'lab') {
    // open coat: inner shirt V + tie
    polyL(
      L,
      [
        [scx - 3.4, scy - 1.4],
        [scx + 3.4, scy - 1.4],
        [scx + 1.6, waistY],
        [scx - 1.6, waistY],
      ],
      id,
      clothFn(v.inner, skin, seed + 4, scx, scy, { blood: 0.72, bloodBias: bias }),
    );
    capsule(
      L,
      scx,
      scy + 0.5,
      scx + 0.3,
      scy + 10,
      0.9,
      1.3,
      id,
      clothFn(v.tie, skin, seed + 6, scx, scy, { blood: 0.9 }),
    );
    for (let y = cy; y < waistY; y++) {
      const t = (y - (scy - 1.4)) / (waistY - (scy - 1.4));
      plot(L, Math.round(scx - 3.4 + 1.8 * t) - 1, y, id, tint(v.shirt, 0.72));
      plot(L, Math.round(scx + 3.4 - 1.8 * t), y, id, tint(v.shirt, 0.82));
    }
    // pocket with pens
    fillRowL(L, cx + 3, cx + 7, cy + 6, id, tint(v.shirt, 0.72));
    plot(L, cx + 4, cy + 5, id, rgba(40, 60, 150));
    plot(L, cx + 5, cy + 5, id, rgba(150, 30, 30));
  } else {
    // neck hole
    polyL(
      L,
      [
        [scx - 2.5, scy - 1.3],
        [scx + 2.5, scy - 1.3],
        [scx, scy + 2.2],
      ],
      id,
      skinFn(skin, seed, scx, scy),
    );
    plot(L, cx - 3, cy - 1, id, dark);
    plot(L, cx + 2, cy - 1, id, dark);
    if (v.style === 'work' || v.style === 'security') {
      // button placket
      for (let y = cy + 2; y < waistY; y++)
        plot(L, cx, y, id, (y - cy) % 3 === 0 ? tint(v.shirt, 1.3) : dark);
      // chest pockets
      fillRowL(L, cx - 6, cx - 2, cy + 4, id, dark);
      fillRowL(L, cx + 2, cx + 6, cy + 4, id, dark);
      plot(L, cx - 6, cy + 5, id, dark);
      plot(L, cx - 3, cy + 5, id, dark);
    }
    if (v.style === 'security') {
      // badge + shoulder epaulets + name tag
      plot(L, cx - 5, cy + 2, id, rgba(214, 176, 70));
      plot(L, cx - 4, cy + 2, id, rgba(240, 206, 96));
      plot(L, cx - 5, cy + 3, id, rgba(170, 130, 50));
      plot(L, cx - 4, cy + 3, id, rgba(200, 160, 60));
      fillRowL(L, cx + 3, cx + 6, cy + 3, id, rgba(30, 32, 40));
      fillRowL(L, shL[0] - 2, shL[0] + 2, Math.round(shL[1]) - 1, id, tint(v.shirt, 0.6));
      fillRowL(L, shR[0] - 2, shR[0] + 2, Math.round(shR[1]) - 1, id, tint(v.shirt, 0.6));
    }
    if (v.style === 'casual') {
      // ragged gash across the belly: dark wet hole with a glimpse of rib
      const gx = cx - 1,
        gy = cy + 10;
      ellipseL(L, gx + 0.5, gy + 0.5, 3.6, 2.2, id, (x, y) =>
        hash2(x, y, seed) < 0.3 ? GORE : BLOOD_DK,
      );
      ellipseL(L, gx + 0.5, gy + 0.8, 2.2, 1.2, id, rgba(40, 6, 8));
      plot(L, gx - 1, gy, id, rgba(176, 160, 128));
      plot(L, gx, gy - 1, id, rgba(150, 136, 108));
      plot(L, gx + 2, gy, id, rgba(176, 160, 128));
      plot(L, gx + 3, gy - 1, id, rgba(150, 136, 108));
      plot(L, gx - 3, gy + 2, id, BLOOD);
      plot(L, gx + 1, gy + 3, id, BLOOD);
      plot(L, gx + 1, gy + 4, id, BLOOD_DK);
    }
  }
}

function drawPelvis(L, v, skin, P, id) {
  const { hipL, hipR } = P;
  const y = (hipL[1] + hipR[1]) / 2;
  const cx = (hipL[0] + hipR[0]) / 2;
  const pantsC = clothFn(v.pants, skin, v.seed + 2, cx, y, { blood: 0.74, tear: 0.9 });
  polyL(
    L,
    [
      [cx - 6.6, y - 3],
      [cx + 6.6, y - 3],
      [cx + 7, y + 3],
      [cx - 7, y + 3],
    ],
    id,
    pantsC,
  );
  // belt
  fillRowL(L, cx - 6.6, cx + 6.6, Math.round(y - 3), id, v.belt);
  if (v.style !== 'lab') fillRowL(L, cx - 6.6, cx + 6.6, Math.round(y - 2), id, tint(v.belt, 0.85));
  plot(L, Math.round(cx), Math.round(y - 3), id, rgba(150, 140, 110));
  plot(L, Math.round(cx), Math.round(y - 2), id, rgba(110, 100, 80));
  // fly seam
  plot(L, Math.round(cx), Math.round(y), id, tint(v.pants, 0.7));
  plot(L, Math.round(cx), Math.round(y + 1), id, tint(v.pants, 0.7));
}

function drawCoatFlaps(L, v, skin, P, id) {
  const { hipL, hipR, kneeL, kneeR } = P;
  const y = (hipL[1] + hipR[1]) / 2 - 3.5;
  const cx = (hipL[0] + hipR[0]) / 2;
  const coatC = clothFn(v.shirt, skin, v.seed + 8, cx, y, {
    blood: 0.74,
    tear: 0.84,
    stain: v.stain,
  });
  const bl = Math.min(kneeL[1] + 1.5, 62),
    br = Math.min(kneeR[1] + 1.5, 62);
  // flaps hang open from the waist, following each thigh, leaving a V that shows the trousers
  polyL(
    L,
    [
      [cx - 7.2, y],
      [cx - 0.6, y],
      [kneeL[0] + 1.2, bl],
      [kneeL[0] - 5.2, bl + 0.5],
    ],
    id,
    coatC,
  );
  polyL(
    L,
    [
      [cx + 0.6, y],
      [cx + 7.2, y],
      [kneeR[0] + 5.2, br + 0.5],
      [kneeR[0] - 1.2, br],
    ],
    id,
    coatC,
  );
  // ragged hem
  for (let x = 0; x < 40; x++) {
    for (const by of [bl, br]) {
      const yy = Math.round(by);
      for (const ry of [yy, yy + 1]) {
        const i = ry * 40 + x;
        if (L.id[i] === id && hash2(x, ry, v.seed) < (ry === yy ? 0.3 : 0.7)) {
          L.img.data[i] = 0;
          L.id[i] = 0;
        }
      }
    }
  }
}

function drawHead(L, v, skin, P, id) {
  const [hx, hy] = P.head;
  const jaw = P.jaw ?? 0;
  const seed = v.seed + 40;
  const sk = skinFn(skin, seed, hx, hy);
  // cranium + gaunt jaw
  ellipseL(L, hx, hy - 1.2, 4.6, 4.7, id, sk);
  polyL(
    L,
    [
      [hx - 4.4, hy - 0.8],
      [hx + 4.4, hy - 0.8],
      [hx + 3.4, hy + 3.4 + jaw * 0.4],
      [hx + 1.9, hy + 5 + jaw],
      [hx - 1.9, hy + 5 + jaw],
      [hx - 3.4, hy + 3.4 + jaw * 0.4],
    ],
    id,
    sk,
  );
  const cx = Math.floor(hx),
    ey = Math.round(hy) - 1;
  // ears
  plot(L, cx - 5, ey + 1, id, tint(skin, 0.75));
  plot(L, cx - 5, ey + 2, id, tint(skin, 0.7));
  plot(L, cx + 5, ey + 1, id, tint(skin, 0.9));
  plot(L, cx + 5, ey + 2, id, tint(skin, 0.8));
  // hair
  const hairC = v.hair;
  const style = v.style;
  if (style === 'security') {
    // peaked cap
    ellipseL(L, hx, hy - 3.6, 5.0, 2.8, id, rgba(40, 46, 62));
    fillRowL(L, hx - 5, hx + 5, ey - 3, id, rgba(40, 46, 62));
    fillRowL(L, hx - 5.5, hx + 5.5, ey - 2, id, rgba(20, 22, 30)); // brim
    plot(L, cx, ey - 4, id, rgba(210, 176, 80)); // cap badge
    plot(L, cx - 4, ey - 1, id, hairC);
    plot(L, cx + 4, ey - 1, id, hairC);
  } else {
    for (let y = Math.floor(hy - 6.5); y <= ey + 1; y++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        const i = y * 40 + x;
        if (y < 0 || x < 0 || x >= 40 || L.id[i] !== id) continue;
        const rel = y - (hy - 6);
        const side = Math.abs(x + 0.5 - hx);
        let want;
        if (style === 'lab')
          want = (side > 3.2 && rel > 1.5 && rel < 5.5) || (rel < 0.8 && hash2(x, y, seed) < 0.25);
        else if (style === 'casual') want = rel < 2.6 + (side > 3 ? 4 : 0) - (side < 1.5 ? 0.5 : 0);
        else want = rel < 2.2 + (side > 3.4 ? 1.5 : 0);
        // bald / torn patches
        if (want && valueNoise(x * 0.7, y * 0.7, 64, seed + 2) > 0.7) want = false;
        if (want) L.img.data[i] = tint(hairC, 0.8 + 0.4 * hash2(x, y, seed + 1));
      }
    }
    if (style === 'casual') {
      // straggly long strands down the sides
      for (const sx of [cx - 5, cx + 5]) {
        for (let y = ey - 1; y < ey + 6; y++)
          if (hash2(sx, y, seed) < 0.75) plot(L, sx, y, id, tint(hairC, 0.85));
      }
      plot(L, cx - 6, ey + 3, id, tint(hairC, 0.7));
      plot(L, cx + 5, ey + 6, id, tint(hairC, 0.7));
    }
  }
  // heavy brow, sunken sockets with glowing pupils
  const brow = tint(skin, 1.08);
  fillRowL(L, cx - 3, cx - 1, ey - 1, id, brow);
  fillRowL(L, cx + 2, cx + 4, ey - 1, id, brow);
  for (const ox of [-3, 2]) {
    plot(L, cx + ox, ey, id, SOCKET);
    plot(L, cx + ox + 1, ey, id, SOCKET);
    plot(L, cx + ox, ey + 1, id, SOCKET);
    plot(L, cx + ox + 1, ey + 1, id, SOCKET);
    plot(L, cx + ox + (ox < 0 ? -1 : 2), ey + 1, id, tint(skin, 0.6));
  }
  if (P.eyesDim) {
    plot(L, cx - 2, ey + 1, id, EYE_DIM);
    plot(L, cx + 2, ey + 1, id, EYE_DIM);
  } else {
    plot(L, cx - 2, ey + 1, id, EYE);
    plot(L, cx + 2, ey + 1, id, EYE);
    plot(L, cx - 3, ey + 1, id, EYE_DIM);
    plot(L, cx + 3, ey + 1, id, EYE_DIM);
  }
  // nose cavity & cheek hollows
  plot(L, cx, ey + 2, id, tint(skin, 0.55));
  plot(L, cx, ey + 3, id, SOCKET);
  plot(L, cx + 1, ey + 3, id, tint(skin, 0.5));
  plot(L, cx - 3, ey + 3, id, tint(skin, 0.7));
  plot(L, cx + 3, ey + 3, id, tint(skin, 0.75));
  // open mouth
  const my = ey + 4;
  const mw = jaw >= 2 ? 3 : 2;
  for (let y = my; y <= my + 1 + jaw; y++) {
    for (let x = cx - mw + 1; x <= cx + mw - 1; x++) plot(L, x, y, id, MOUTH);
  }
  fillRowL(L, cx - mw + 1, cx + mw, my - 1, id, tint(skin, 0.6)); // upper lip shadow
  for (let x = cx - mw + 1; x <= cx + mw - 1; x++) if ((x + cx) & 1) plot(L, x, my, id, TEETH);
  if (jaw >= 1)
    for (let x = cx - mw + 1; x <= cx + mw - 1; x++)
      if (!((x + cx) & 1)) plot(L, x, my + 1 + jaw, id, tint(TEETH, 0.8));
  plot(L, cx - mw, my + 1, id, MOUTH);
  plot(L, cx + mw, my + 1, id, MOUTH);
  // blood drool
  plot(L, cx - 1, my + 2 + jaw, id, BLOOD);
  plot(L, cx - 1, my + 3 + jaw, id, BLOOD_DK);
}

//=============================================================
//                        ZOMBIE POSES
//=============================================================

// Zombie poses

// Arm layouts per variant: 'reach' = arm held out toward the player with a
// limp, dangling hand; 'hang' = arm drooping at the side.
const ARM_STYLE = [
  ['reach', 'reach'],
  ['reach', 'hang'],
  ['reach', 'reach'],
  ['hang', 'reach'],
];

function setArm(P, side, style) {
  const m = side === 'L' ? -1 : 1,
    cx = 20;
  if (style === 'reach') {
    P['el' + side] = [cx + m * 11.5, 23.5];
    P['hand' + side] = [cx + m * 14.5, 22.5];
    P['fdir' + side] = [m * 0.25, 1];
  } else {
    P['el' + side] = [cx + m * 11.2, 26.5];
    P['hand' + side] = [cx + m * 12.2, 34];
    P['fdir' + side] = [m * 0.1, 1];
  }
}

function standPose(vi) {
  const P = {
    head: [20.5, 8.5],
    jaw: 0,
    shL: [13, 16],
    shR: [27, 16],
    hipL: [16.5, 38],
    hipR: [23.5, 38],
    kneeL: [16, 49.5],
    kneeR: [24, 49.5],
    footL: [15.5, 61],
    footR: [24.5, 61],
  };
  setArm(P, 'L', ARM_STYLE[vi][0]);
  setArm(P, 'R', ARM_STYLE[vi][1]);
  return P;
}

const UPPER = ['head', 'shL', 'shR', 'elL', 'elR', 'handL', 'handR'];
function shiftUpper(P, dx, dy) {
  for (const k of UPPER) P[k] = [P[k][0] + dx, P[k][1] + dy];
  return P;
}
const add = (p, dx, dy) => [p[0] + dx, p[1] + dy];

function walkPose(vi, f) {
  const P = standPose(vi);
  if (f === 1) {
    P.head = add(P.head, 0, -0.5);
    return P;
  }
  const s = f === 0 ? 1 : -1; // +1: viewer-left leg forward
  // Forward leg: foot planted low and slightly out. Back leg: further away so its
  // foot sits higher in the frame with the heel lifted and the knee bent.
  if (s > 0) {
    P.footL = [14.5, 61];
    P.kneeL = [15.2, 49.5];
    P.footR = [24.2, 57.5];
    P.kneeR = [24.8, 47.5];
  } else {
    P.footR = [25.5, 61];
    P.kneeR = [24.8, 49.5];
    P.footL = [15.8, 57.5];
    P.kneeL = [15.2, 47.5];
  }
  // body drops and sways over the planted leg, head lolls the other way
  shiftUpper(P, -0.8 * s, 1);
  P.head = add(P.head, 0.6 * s, 0);
  P.hipL = add(P.hipL, -0.4 * s, 0.6);
  P.hipR = add(P.hipR, -0.4 * s, 0.6);
  // shoulders tilt, arms sway opposite to the legs
  P.shL = add(P.shL, 0, 0.5 * s);
  P.shR = add(P.shR, 0, -0.5 * s);
  P.handL = add(P.handL, 0.6 * s, -1.8 * s);
  P.elL = add(P.elL, 0.3 * s, -0.8 * s);
  P.handR = add(P.handR, 0.6 * s, 1.8 * s);
  P.elR = add(P.elR, 0.3 * s, 0.8 * s);
  return P;
}

function attackPose(vi) {
  const P = standPose(vi);
  P.head = [20.5, 10];
  P.jaw = 2;
  P.shL = [12.5, 17];
  P.shR = [27.5, 17];
  P.hipL = [16.5, 38.5];
  P.hipR = [23.5, 38.5];
  P.elL = [6.5, 13];
  P.handL = [8, 6.5];
  P.fdirL = [-0.2, -1];
  P.elR = [33.5, 13];
  P.handR = [32, 6.5];
  P.fdirR = [0.2, -1];
  P.kneeL = [15.5, 50];
  P.kneeR = [24.5, 50];
  P.footL = [14.5, 61];
  P.footR = [25.5, 61];
  P.claw = true;
  return P;
}

function death0Pose(vi) {
  const P = standPose(vi);
  // recoiling: head snapped back and to the side, torso twisting, arms flung out
  P.head = [23.5, 10.5];
  P.jaw = 2;
  P.eyesDim = true;
  P.shL = [15, 18.5];
  P.shR = [29, 17.5];
  P.elL = [8, 16];
  P.handL = [4, 10];
  P.fdirL = [-0.6, -1];
  P.elR = [35, 24];
  P.handR = [37.5, 17];
  P.fdirR = [0.5, -1];
  P.hipL = [17, 39];
  P.hipR = [24, 38.5];
  P.kneeL = [15, 50];
  P.kneeR = [25.5, 50];
  P.footL = [14, 61];
  P.footR = [26.5, 61];
  P.claw = true;
  return P;
}

function death1Pose() {
  // collapsed on the knees, slumped forward, arms dangling to the floor
  return {
    head: [19.5, 31],
    jaw: 1,
    eyesDim: true,
    shL: [12.5, 36],
    shR: [26.5, 37],
    hipL: [16, 52],
    hipR: [23.5, 52],
    kneeL: [14, 58.5],
    kneeR: [25.5, 58.5],
    footL: [14, 61],
    footR: [25.5, 61],
    elL: [9, 46],
    handL: [8.5, 56],
    fdirL: [-0.2, 1],
    elR: [30.5, 47],
    handR: [31.5, 57],
    fdirR: [0.2, 1],
    kneel: true,
  };
}

function drawZombieFrame(vi, P, frameSeed) {
  const v = VARIANTS[vi];
  const skin = SKIN[vi];
  const L = makeLayer(40, 64);
  let id = 1;
  // legs (behind everything)
  if (P.kneel) {
    // shins fold back out of view; draw thighs down to the knees and knee caps on the floor
    const pantsC = clothFn(v.pants, skin, v.seed, 20, 50, { blood: 0.78 });
    capsule(L, P.hipL[0], P.hipL[1], P.kneeL[0], P.kneeL[1], 3.4, 3.2, id, pantsC);
    ellipseL(L, P.kneeL[0], P.kneeL[1] + 1.5, 3.4, 2.4, id, pantsC);
    id++;
    capsule(L, P.hipR[0], P.hipR[1], P.kneeR[0], P.kneeR[1], 3.4, 3.2, id, pantsC);
    ellipseL(L, P.kneeR[0], P.kneeR[1] + 1.5, 3.4, 2.4, id, pantsC);
    id++;
  } else {
    drawLeg(L, v, skin, P.hipL, P.kneeL, P.footL, id++, v.seed + 60);
    drawLeg(L, v, skin, P.hipR, P.kneeR, P.footR, id++, v.seed + 61);
  }
  drawPelvis(L, v, skin, P, id++);
  if (v.style === 'lab' && !P.kneel) drawCoatFlaps(L, v, skin, P, id++);
  // neck
  const nx = (P.shL[0] + P.shR[0]) / 2,
    ny = (P.shL[1] + P.shR[1]) / 2;
  const nid = id++;
  capsule(L, P.head[0], P.head[1] + 3, nx, ny, 1.9, 2.3, nid, skinFn(skin, v.seed, nx, ny));
  drawTorso(L, v, skin, P, id++);
  if (v.style === 'lab' && P.kneel) {
    // coat tails pool over the thighs
    const coatC = clothFn(v.shirt, skin, v.seed + 8, 20, 48, { blood: 0.72, stain: v.stain });
    polyL(
      L,
      [
        [12, 47],
        [28, 47],
        [30, 58],
        [10, 58],
      ],
      id - 1,
      coatC,
    );
  }
  const headFirst = P.head[1] > 20; // when slumped, the head hangs in front of the chest
  if (!headFirst) drawHead(L, v, skin, P, id++);
  drawArm(L, v, skin, P.shL, P.elL, P.handL, id++, v.seed + 70, P.claw, P.fdirL);
  drawArm(L, v, skin, P.shR, P.elR, P.handR, id++, v.seed + 71, P.claw, P.fdirR);
  if (headFirst) drawHead(L, v, skin, P, id++);
  shadeLayer(L, { top: 0, bottom: 64 });
  vary(L.img, mulberry32(frameSeed), 0.1);
  return outline(L.img, OUTLINE);
}

function drawCorpse(vi) {
  const v = VARIANTS[vi];
  const skin = SKIN[vi];
  const L = makeLayer(40, 64);
  // blood pool on the floor (id 0 = no directional shading)
  const rng = mulberry32(900 + vi);
  const pool = (x, y) => tint(BLOOD_DK, 0.7 + 0.35 * hash2(x, y, 5));
  ellipseL(L, 20, 60.5, 19, 3.5, 0, pool);
  for (let k = 0; k < 5; k++)
    ellipseL(L, 3 + rng() * 34, 60 + rng() * 3, 2 + rng() * 3, 1.2, 0, pool);
  for (let x = 6; x < 34; x += 2) if (rng() < 0.4) plot(L, x, 59, 0, rgba(130, 18, 16));
  // body lying sideways along the floor: legs to the right, head to the left
  let id = 1;
  const pantsC = clothFn(v.pants, skin, v.seed, 26, 58);
  capsule(L, 23, 58, 31, 58.5, 3, 2.6, id, pantsC);
  capsule(L, 31, 58.5, 36, 59.5, 2.6, 2.2, id, pantsC);
  ellipseL(L, 37.5, 59, 1.8, 2.6, id, v.shoes);
  id++;
  capsule(L, 23, 60, 30, 61, 2.6, 2.4, id, tint(v.pants, 0.8));
  capsule(L, 30, 61, 34, 61.5, 2.3, 2, id, tint(v.pants, 0.8));
  ellipseL(L, 35.5, 61.5, 1.6, 2, id, tint(v.shoes, 0.8));
  id++;
  const shirtC = clothFn(v.shirt, skin, v.seed, 14, 56, { blood: 0.66, stain: v.stain });
  polyL(
    L,
    [
      [10, 54],
      [24, 55],
      [25, 61.5],
      [10, 62],
    ],
    id,
    shirtC,
  );
  if (v.style === 'lab')
    polyL(
      L,
      [
        [20, 55],
        [30, 56],
        [31, 62.5],
        [21, 62.5],
      ],
      id,
      clothFn(v.shirt, skin, v.seed + 3, 20, 56, { blood: 0.66, stain: v.stain }),
    );
  id++;
  const sk = skinFn(skin, v.seed, 6, 57);
  // head on its side, face toward viewer
  ellipseL(L, 6.5, 57.5, 4.2, 3.9, id, sk);
  for (let x = 2; x < 6; x++)
    for (let y = 54; y < 62; y++) {
      if (L.id[y * 40 + x] === id && v.style !== 'security' && hash2(x, y, v.seed) < 0.6)
        L.img.data[y * 40 + x] = v.hair;
    }
  if (v.style === 'security') {
    ellipseL(L, 2.5, 58, 2, 3.5, id, rgba(40, 46, 62));
  }
  plot(L, 6, 56, id, SOCKET);
  plot(L, 7, 56, id, SOCKET);
  plot(L, 6, 58, id, SOCKET);
  plot(L, 7, 58, id, SOCKET);
  plot(L, 9, 57, id, MOUTH);
  plot(L, 9, 58, id, MOUTH);
  plot(L, 10, 57, id, MOUTH);
  plot(L, 10, 58, id, MOUTH);
  plot(L, 10, 59, id, BLOOD);
  id++;
  // arms flopped out
  capsule(L, 13, 55.5, 18, 51.5, 2, 1.7, id, clothFn(v.sleeve, skin, v.seed + 1, 13, 55));
  capsule(L, 18, 51.5, 23, 52, 1.7, 1.5, id, sk);
  drawHand(L, 24.5, 52.5, [1, 0.3], id, sk, false, skin);
  id++;
  capsule(L, 14, 61, 19, 62, 1.8, 1.6, id, sk);
  ellipseL(L, 20, 62, 1.8, 1.4, id, sk);
  shadeLayer(L, { top: 48, bottom: 64 });
  vary(L.img, mulberry32(950 + vi), 0.1);
  return outline(L.img, OUTLINE);
}

function buildZombie(vi) {
  const base = 1000 + vi * 100;
  return {
    walk: [0, 1, 2].map((f) => drawZombieFrame(vi, walkPose(vi, f), base + f)),
    attack: drawZombieFrame(vi, attackPose(vi), base + 10),
    death: [
      drawZombieFrame(vi, death0Pose(vi), base + 20),
      drawZombieFrame(vi, death1Pose(), base + 21),
      drawCorpse(vi),
    ],
  };
}

//=============================================================
//                    TINY BITMAP GLYPHS
//=============================================================

// Tiny bitmap glyphs

const GLYPHS = {
  '?': ['01110', '11011', '00011', '00110', '01100', '00000', '01100'],
  x: ['00000', '00000', '11011', '01110', '00100', '01110', '11011'],
  2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
};

function drawGlyph(img, ch, ox, oy, scale, c) {
  const g = GLYPHS[ch];
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++)
      if (g[y][x] === '1') fillRect(img, ox + x * scale, oy + y * scale, scale, scale, c);
}

//=============================================================
//                       MYSTERY CRATE
//=============================================================

// Mystery crate (48x30)

function woodPx(x, y, seed, base) {
  const grain = valueNoise(x * 0.12, y * 0.9, 64, seed);
  const f = 0.78 + grain * 0.38 + (hash2(x, y, seed + 1) - 0.5) * 0.08;
  return tint(base, f);
}

function crateBody(img, top, seed) {
  const wood = rgba(118, 82, 48),
    dark = rgba(52, 34, 20),
    metal = rgba(96, 98, 104),
    metalD = rgba(56, 58, 64);
  const x0 = 2,
    x1 = 46,
    y1 = 30;
  // front planks
  for (let y = top; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      let c = woodPx(x, y, seed, wood);
      // left side darker, right side lighter
      c = tint(c, 0.86 + 0.24 * ((x - x0) / (x1 - x0)) - 0.18 * ((y - top) / (y1 - top)));
      setPx(img, x, y, c);
    }
  const h = y1 - top;
  // plank seams
  for (let k = 1; k < 3; k++) {
    const y = top + Math.round((h * k) / 3);
    for (let x = x0; x < x1; x++) setPx(img, x, y, dark);
    for (let x = x0; x < x1; x++) setPx(img, x, y + 1, tint(getPx(img, x, y + 1), 1.15));
  }
  // vertical end boards
  for (const bx of [x0, x1 - 5]) {
    for (let y = top; y < y1; y++)
      for (let x = bx; x < bx + 5; x++)
        setPx(
          img,
          x,
          y,
          tint(woodPx(y, x, seed + 7, wood), x === bx ? 0.7 : 0.95 + (x - bx) * 0.03),
        );
    for (let y = top; y < y1; y++) setPx(img, bx + 5, y, dark);
  }
  // knots / scratches
  const rng = mulberry32(seed);
  for (let k = 0; k < 4; k++) {
    const kx = 10 + rng() * 26,
      ky = top + 2 + rng() * (h - 4);
    setPx(img, kx, ky, dark);
    setPx(img, kx + 1, ky, tint(wood, 0.6));
  }
  // corner brackets with rivets
  const bracket = (bx, by, sx, sy) => {
    for (let i = 0; i < 6; i++) {
      setPx(img, bx + sx * i, by, metal);
      setPx(img, bx + sx * i, by + sy, metalD);
      setPx(img, bx, by + sy * i, metal);
      setPx(img, bx + sx, by + sy * i, metalD);
    }
    setPx(img, bx + sx * 3, by, rgba(160, 160, 165));
    setPx(img, bx, by + sy * 3, rgba(160, 160, 165));
  };
  bracket(x0, top, 1, 1);
  bracket(x1 - 1, top, -1, 1);
  bracket(x0, y1 - 1, 1, -1);
  bracket(x1 - 1, y1 - 1, -1, -1);
  // bottom shadow row
  for (let x = x0; x < x1; x++) setPx(img, x, y1 - 1, tint(getPx(img, x, y1 - 1), 0.6));
  // stenciled glowing "?" with a faint halo
  const qx = 19,
    qy = top + Math.round((h - 14) / 2) + 1;
  const halo = glow(10, 60, 70);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 5; x++) {
      if (GLYPHS['?'][y][x] !== '1') continue;
      for (const [dx, dy] of [
        [-1, 0],
        [2, 0],
        [0, -1],
        [0, 2],
        [-1, -1],
        [2, 2],
        [2, -1],
        [-1, 2],
      ]) {
        const px = qx + x * 2 + dx,
          py = qy + y * 2 + dy;
        if (getPx(img, px, py) >>> 24 === 255)
          setPx(img, px, py, (mix(getPx(img, px, py), halo, 0.5) & 0x00ffffff) | (EMISSIVE << 24));
      }
    }
  drawGlyph(img, '?', qx, qy, 2, glow(90, 235, 255));
  // stencil wear: knock out a few pixels
  for (let k = 0; k < 6; k++) {
    const px = qx + Math.floor(rng() * 10),
      py = qy + Math.floor(rng() * 14);
    if (getPx(img, px, py) >>> 24 === EMISSIVE) setPx(img, px, py, glow(40, 150, 175));
  }
}

function buildCrate() {
  const seamGlow = glow(30, 130, 150);
  // closed
  const closed = makeImage(48, 30);
  crateBody(closed, 10, 301);
  // lid: overhanging plank on top
  const lidW = rgba(104, 72, 42);
  for (let y = 5; y < 10; y++)
    for (let x = 1; x < 47; x++)
      setPx(closed, x, y, tint(woodPx(x, y + 40, 302, lidW), y === 5 ? 1.25 : y === 9 ? 0.7 : 1));
  for (let x = 1; x < 47; x++) setPx(closed, x, 10, seamGlow); // glowing seam under the lid
  for (let x = 1; x < 6; x++) {
    setPx(closed, x, 6, rgba(96, 98, 104));
    setPx(closed, 46 - x, 6, rgba(96, 98, 104));
  }
  for (const sx of [17, 30]) {
    setPx(closed, sx, 10, glow(80, 220, 240));
    setPx(closed, sx + 1, 10, glow(80, 220, 240));
  }
  // seam glow leaking from plank gaps
  for (let x = 8; x < 40; x++) if (hash2(x, 1, 9) < 0.2) setPx(closed, x, 16, glow(20, 80, 95));
  outline(closed, OUTLINE);

  // open
  const open = makeImage(48, 30);
  // lid flipped up & back: we see its weathered inner face, foreshortened, behind the opening
  fillPoly(
    open,
    [
      [5, 3],
      [43, 3],
      [45, 9],
      [3, 9],
    ],
    rgba(70, 48, 28),
  );
  for (let y = 3; y < 9; y++)
    for (let x = 3; x < 45; x++) {
      if (getPx(open, x, y) >>> 24 === 0) continue;
      setPx(open, x, y, tint(woodPx(x, y + 80, 303, rgba(84, 58, 34)), 0.7 + (y - 3) * 0.05));
    }
  for (let x = 5; x < 43; x++) setPx(open, x, 3, rgba(124, 88, 52));
  for (const bx of [5, 41])
    for (let y = 3; y < 9; y++) {
      setPx(open, bx, y, rgba(96, 98, 104));
      setPx(open, bx + 1, y, rgba(60, 62, 68));
    }
  // golden light pouring up out of the box: a fan of god-rays radiating from
  // a point deep inside the crate, fading with height
  for (let y = 0; y < 11; y++)
    for (let x = 1; x < 47; x++) {
      const ang = Math.atan2(x + 0.5 - 24, 30 - y);
      const ray = 0.5 + 0.5 * Math.sin(ang * 23 + 0.6) * (0.75 + 0.25 * Math.sin(ang * 9));
      const t = (11 - y) / 11;
      const edge = clamp01(Math.min(x - 1, 46 - x) / 5);
      const inten = (1 - t * 0.72) * (0.3 + 0.8 * ray) * (0.4 + 0.6 * edge);
      const thr = 0.32 + (hash2(x, y, 3) - 0.5) * 0.12;
      if (inten < thr) continue;
      const k = clamp01((inten - thr) / 0.5);
      setPx(open, x, y, glow(235 + 20 * k, 165 + 85 * k, 50 + 160 * k * k));
    }
  // sparkles in the beams
  const rng = mulberry32(77);
  for (let k = 0; k < 7; k++)
    setPx(open, 4 + Math.floor(rng() * 40), Math.floor(rng() * 6), glow(255, 250, 220));
  // glowing interior rim
  for (let x = 2; x < 46; x++) {
    setPx(open, x, 11, glow(255, 244, 190));
    setPx(open, x, 12, glow(255, 214, 96));
  }
  crateBody(open, 13, 301);
  // light spill on the upper planks
  for (let y = 13; y < 16; y++)
    for (let x = 2; x < 46; x++) {
      const c = getPx(open, x, y);
      if (c >>> 24 === 255) setPx(open, x, y, mix(c, rgba(220, 170, 80), 0.5 - (y - 13) * 0.15));
    }
  outline(open, OUTLINE);
  return { closed, open };
}

//=============================================================
//                       PERK MACHINES
//=============================================================

// Perk machines (32x60)

function buildPerk(kind) {
  const img = makeImage(32, 60);
  const iron = kind === 'iron';
  const body = iron ? rgba(128, 22, 26) : rgba(30, 62, 150);
  const trim = iron ? rgba(70, 12, 14) : rgba(16, 32, 84);
  const accent = iron ? glow(255, 150, 50) : glow(120, 220, 255);
  const accentDim = iron ? glow(150, 60, 20) : glow(40, 110, 170);
  const liquid = iron
    ? [glow(255, 70, 40), glow(220, 40, 30)]
    : [glow(70, 200, 255), glow(40, 140, 255)];
  const x0 = 3,
    x1 = 29;
  // cabinet: front face plus a darker left side strip for depth
  for (let y = 2; y < 58; y++)
    for (let x = x0; x < x1; x++) {
      const side = x < x0 + 3;
      let c = tint(
        body,
        (side ? 0.55 : 0.9 + 0.2 * ((x - x0) / (x1 - x0))) * (1.05 - 0.25 * (y / 60)),
      );
      c = tint(c, 0.95 + 0.1 * valueNoise(x * 0.5, y * 0.5, 64, iron ? 5 : 6));
      setPx(img, x, y, c);
    }
  // top cap & chrome edge
  for (let x = x0 - 1; x < x1 + 1; x++) {
    setPx(img, x, 1, rgba(150, 150, 156));
    setPx(img, x, 2, rgba(90, 90, 96));
  }
  for (let y = 2; y < 58; y++) setPx(img, x1 - 1, y, tint(body, 1.25));
  // feet
  fillRect(img, x0, 58, 4, 2, rgba(30, 30, 34));
  fillRect(img, x1 - 4, 58, 4, 2, rgba(30, 30, 34));
  // glowing sign panel with emblem
  const sx0 = x0 + 4,
    sx1 = x1 - 2,
    sy0 = 4,
    sy1 = 17;
  fillRect(img, sx0 - 1, sy0 - 1, sx1 - sx0 + 2, sy1 - sy0 + 2, trim);
  for (let y = sy0; y < sy1; y++)
    for (let x = sx0; x < sx1; x++) {
      const d = Math.hypot((x - (sx0 + sx1) / 2) / 8, (y - (sy0 + sy1) / 2) / 6);
      setPx(img, x, y, iron ? glow(90 - d * 30, 14, 10) : glow(10, 30, 100 - d * 30));
    }
  const ex = Math.floor((sx0 + sx1) / 2),
    ey = sy0 + 1;
  if (iron) {
    // shield emblem
    const pts = [
      [ex - 5, ey],
      [ex + 5, ey],
      [ex + 5, ey + 5],
      [ex, ey + 11],
      [ex - 5, ey + 5],
    ];
    fillPoly(img, pts, accent);
    fillPoly(
      img,
      [
        [ex - 3, ey + 2],
        [ex + 3, ey + 2],
        [ex + 3, ey + 5],
        [ex, ey + 8.5],
        [ex - 3, ey + 5],
      ],
      glow(200, 60, 20),
    );
    fillRect(img, ex - 1, ey + 2, 1, 6, glow(255, 220, 140));
    fillRect(img, ex - 3, ey + 4, 6, 1, glow(255, 220, 140));
  } else {
    // open hand with a lightning bolt
    fillRect(img, ex - 4, ey + 4, 7, 6, accent);
    for (let k = 0; k < 4; k++)
      fillRect(img, ex - 4 + k * 2, ey + 0 + (k === 0 || k === 3 ? 1 : 0), 1, 5, accent);
    drawLine(img, ex + 3, ey + 7, ex + 5, ey + 4, accent, 1);
    setPx(img, ex + 5, ey + 3, accent);
    fillRect(img, ex - 4, ey + 10, 6, 1, accent);
    const bolt = glow(255, 240, 110);
    fillPoly(
      img,
      [
        [ex, ey + 2],
        [ex + 2, ey + 2],
        [ex + 1, ey + 5],
        [ex + 3, ey + 5],
        [ex - 1, ey + 11],
        [ex, ey + 7],
        [ex - 2, ey + 7],
      ],
      bolt,
    );
  }
  // bottle window with lit rows
  const wx0 = x0 + 4,
    wx1 = x1 - 8,
    wy0 = 20,
    wy1 = 42;
  fillRect(img, wx0 - 1, wy0 - 1, wx1 - wx0 + 2, wy1 - wy0 + 2, rgba(20, 20, 24));
  for (let y = wy0; y < wy1; y++)
    for (let x = wx0; x < wx1; x++) setPx(img, x, y, iron ? glow(40, 10, 10) : glow(8, 18, 44));
  for (let row = 0; row < 3; row++) {
    const by = wy0 + 1 + row * 7;
    for (let k = 0; k < 4; k++) {
      const bx = wx0 + 1 + k * 3;
      const lq = liquid[(row + k) & 1];
      setPx(img, bx, by, glow(200, 200, 200)); // cap
      setPx(img, bx, by + 1, accentDim);
      fillRect(img, bx, by + 2, 2, 3, lq);
      setPx(img, bx + 1, by + 2, glow(255, 255, 230)); // glint
    }
    fillRect(img, wx0, by + 5, wx1 - wx0, 1, rgba(90, 90, 96)); // shelf
  }
  // glass sheen
  for (let k = 0; k < wy1 - wy0; k += 1) {
    const x = wx1 - 2 - Math.floor(k * 0.4);
    if (k % 9 < 4) setPx(img, x, wy0 + k, glow(150, 160, 170));
  }
  // control column: price display, coin slot, buttons
  const cx0 = x1 - 7;
  fillRect(img, cx0, wy0, 5, 4, rgba(14, 14, 16));
  fillRect(img, cx0 + 1, wy0 + 1, 3, 2, accent);
  fillRect(img, cx0 + 1, wy0 + 7, 3, 5, rgba(70, 70, 76));
  fillRect(img, cx0 + 2, wy0 + 8, 1, 3, rgba(8, 8, 10)); // coin slot
  setPx(img, cx0 + 2, wy0 + 13, glow(255, 230, 120));
  for (let k = 0; k < 3; k++) {
    fillRect(img, cx0 + 1, wy0 + 15 + k * 2, 3, 1, k === 0 ? accent : accentDim);
  }
  // dispensing tray
  fillRect(img, x0 + 5, 46, x1 - x0 - 9, 7, rgba(60, 60, 66));
  fillRect(img, x0 + 6, 47, x1 - x0 - 11, 5, rgba(8, 8, 10));
  fillRect(img, x0 + 6, 51, x1 - x0 - 11, 1, accentDim); // light strip inside tray
  fillRect(img, x0 + 5, 53, x1 - x0 - 9, 1, rgba(120, 120, 126));
  // kick plate & grime
  fillRect(img, x0, 55, x1 - x0, 3, trim);
  vary(img, mulberry32(iron ? 41 : 42), 0.08);
  // scratches / grime
  const rng = mulberry32(iron ? 43 : 44);
  for (let k = 0; k < 30; k++) {
    const x = x0 + Math.floor(rng() * (x1 - x0)),
      y = 2 + Math.floor(rng() * 56);
    const c = getPx(img, x, y);
    if (c >>> 24 === 255) setPx(img, x, y, tint(c, 0.7));
  }
  return outline(img, OUTLINE);
}

//=============================================================
//                          POWERUPS
//=============================================================

// Powerups (20x20)

function haloFill(img, cx, cy, r, rgb) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d >= 1 || getPx(img, x, y) >>> 24) continue;
      const k = (1 - d) * 0.5;
      if (hash2(x, y, 7) > (1 - d) * 1.4) continue; // dithered falloff
      setPx(img, x, y, glow(rgb[0] * k, rgb[1] * k, rgb[2] * k));
    }
}

function buildPowerups() {
  const ammo = makeImage(20, 20);
  {
    const box = glow(220, 170, 50),
      boxD = glow(150, 100, 24),
      boxL = glow(255, 220, 110);
    // three bullets standing in the box
    for (let k = 0; k < 3; k++) {
      const bx = 5 + k * 4;
      fillRect(ammo, bx, 4, 2, 6, glow(230, 160, 70));
      fillRect(ammo, bx, 3, 2, 1, glow(255, 220, 160));
      setPx(ammo, bx, 2, glow(250, 200, 140));
      setPx(ammo, bx + 1, 4, glow(255, 240, 200));
    }
    fillRect(ammo, 3, 9, 14, 8, box);
    fillRect(ammo, 3, 9, 14, 1, boxL);
    fillRect(ammo, 3, 16, 14, 1, boxD);
    fillRect(ammo, 3, 9, 1, 8, boxD);
    fillRect(ammo, 7, 11, 6, 3, glow(90, 60, 10)); // label
    fillRect(ammo, 8, 12, 4, 1, glow(255, 230, 140));
    outline(ammo, OUTLINE);
  }
  const double = makeImage(20, 20);
  {
    const c = glow(190, 255, 60),
      cd = glow(110, 170, 30);
    // drop shadow then glyphs
    drawGlyph(double, 'x', 2, 5, 1, cd);
    drawGlyph(double, 2, 9, 3, 2, cd);
    drawGlyph(double, 'x', 1, 4, 1, c);
    drawGlyph(double, 2, 8, 2, 2, c);
    for (let x = 8; x < 18; x++)
      if (getPx(double, x, 2) >>> 24) setPx(double, x, 2, glow(240, 255, 190));
    outline(double, OUTLINE);
  }
  const blast = makeImage(20, 20);
  {
    // round bomb with a sparking fuse
    fillEllipse(blast, 9.5, 11.5, 6.5, 6.5, glow(200, 60, 24));
    fillEllipse(blast, 9.5, 11.5, 5, 5, glow(240, 96, 30));
    fillEllipse(blast, 11.5, 9.5, 2, 2, glow(255, 180, 90));
    setPx(blast, 12, 8, glow(255, 240, 200));
    // skull face stencil
    fillRect(blast, 6, 10, 2, 2, glow(60, 10, 4));
    fillRect(blast, 11, 10, 2, 2, glow(60, 10, 4));
    setPx(blast, 9, 13, glow(60, 10, 4));
    for (let x = 7; x < 13; x += 2) setPx(blast, x, 15, glow(60, 10, 4));
    fillRect(blast, 13, 4, 2, 2, glow(140, 140, 140));
    drawLine(blast, 15, 4, 17, 2, glow(170, 120, 60));
    setPx(blast, 18, 1, glow(255, 255, 200));
    setPx(blast, 17, 1, glow(255, 200, 80));
    setPx(blast, 18, 0, glow(255, 160, 40));
    setPx(blast, 19, 1, glow(255, 160, 40));
    setPx(blast, 18, 2, glow(255, 200, 80));
    outline(blast, OUTLINE);
  }
  return { ammo, double, blast };
}

//=============================================================
//                      PARTICLES & BOLT
//=============================================================

// Particles & bolt

function radial(size, fn) {
  const img = makeImage(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
      const col = fn(d, x, y);
      if (col) setPx(img, x, y, col);
    }
  return img;
}

function buildParticles() {
  const blood = makeImage(6, 6);
  fillEllipse(blood, 3, 3.3, 2.6, 2.6, rgba(120, 14, 14));
  fillRect(blood, 2, 0, 2, 2, rgba(120, 14, 14));
  setPx(blood, 2, 2, rgba(170, 40, 36));
  setPx(blood, 4, 5, rgba(70, 8, 8));
  setPx(blood, 3, 5, rgba(80, 10, 10));
  const spark = radial(4, (d) =>
    d < 0.55 ? glow(255, 255, 220) : d < 1.0 ? glow(255, 210, 90) : 0,
  );
  const plasma = radial(8, (d, x, y) => {
    if (d > 1) return 0;
    if (d < 0.35) return glow(220, 255, 200);
    if (d < 0.65) return glow(90, 255, 90);
    return hash2(x, y, 3) < 1.3 - d ? glow(30, 170, 40) : 0;
  });
  const beam = radial(6, (d) =>
    d < 0.4
      ? glow(220, 255, 255)
      : d < 0.75
        ? glow(80, 220, 255)
        : d < 1.05
          ? glow(20, 110, 160)
          : 0,
  );
  return { blood, spark, plasma, beam };
}

function buildBolt() {
  return radial(10, (d) => {
    if (d > 1.02) return 0;
    if (d < 0.28) return glow(255, 255, 255);
    if (d < 0.5) return glow(190, 255, 170);
    if (d < 0.75) return glow(70, 240, 60);
    return glow(20, 130, 30);
  });
}

//=============================================================
//                     BRUTE BOSS ZOMBIE
//=============================================================

// Brute boss zombie (48x64): hulking asylum escapee in shredded scrubs, iron
// restraint cuffs with broken chains, a metal jaw brace and yellow eyes.

const BW = 48;
const B_SKIN = rgba(152, 138, 162);
const B_SKIN_DK = rgba(100, 84, 112);
const B_VEIN = rgba(78, 58, 100);
const B_MUSCLE = rgba(156, 46, 54);
const B_MUSCLE_DK = rgba(92, 20, 30);
const B_SINEW = rgba(206, 164, 150);
const B_SCRUB = rgba(112, 142, 132);
const B_IRON = rgba(104, 104, 112);
const B_IRON_LT = rgba(176, 176, 182);
const B_IRON_DK = rgba(36, 36, 42);
const B_RUST = rgba(112, 60, 32);
const B_EYE = glow(250, 240, 70);
const B_EYE_DIM = glow(190, 180, 40);

// Pale grey-purple hide with veins, bruising and torn patches of raw striated muscle.
function bruteSkinFn(seed, ox, oy, opts = {}) {
  const musc = opts.muscle ?? 0.72;
  return (x, y) => {
    const u = x - ox,
      v = y - oy;
    let c = tint(B_SKIN, 0.86 + 0.22 * valueNoise(u * 0.4, v * 0.4, 64, seed));
    const m = valueNoise(u * 0.25 + 3, v * 0.25 + 8, 64, seed + 5);
    if (m < 0.24) c = mix(c, B_SKIN_DK, 0.55);
    const vn = valueNoise(u * 0.5 + 2, v * 0.28 + 5, 64, seed + 11);
    if (Math.abs(vn - 0.5) < 0.03) c = mix(c, B_VEIN, 0.65);
    const mm = valueNoise(u * 0.17 + 7, v * 0.17 + 1, 64, seed + 17);
    if (mm > musc) {
      if (mm < musc + 0.03) return mix(B_SINEW, B_SKIN_DK, 0.4); // torn skin rim
      const stri = Math.floor(u * 0.9 + v * 0.45) & 1;
      if (hash2(x, y, seed + 19) < 0.08) return B_SINEW;
      return stri ? B_MUSCLE : mix(B_MUSCLE, B_MUSCLE_DK, 0.65);
    }
    const g = valueNoise(u * 0.6 + 1, v * 0.6 + 9, 64, seed + 33);
    if (g > 0.93) c = g > 0.95 ? BLOOD_DK : GORE;
    return c;
  };
}

function darkenL(L, x, y, id, f) {
  x = Math.round(x);
  y = Math.round(y);
  const { w, h } = L.img;
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = y * w + x;
  if (!(L.img.data[i] >>> 24)) return;
  L.img.data[i] = tint(L.img.data[i], f);
  L.id[i] = id;
}

// Dangling chain of iron links; lies along the floor once it reaches it.
function drawChain(L, sx, sy, len, id, sway) {
  let x = Math.round(sx),
    y = Math.round(sy);
  for (let i = 0; i < len; i++) {
    if (y > 62) {
      y = 62;
      x += sway || 1;
    }
    if (i === len - 1) {
      plot(L, x, y, id, B_RUST);
      break;
    } // broken link
    if (i & 1) plot(L, x, y, id, B_IRON);
    else {
      plot(L, x, y, id, B_IRON_LT);
      plot(L, x + 1, y, id, B_IRON_DK);
    }
    if (i > 2 && i % 3 === 0) x += sway;
    y++;
  }
}

function drawBruteFist(L, c, u, id, sk) {
  const [ux, uy] = u,
    px = -uy,
    py = ux;
  ellipseL(L, c[0], c[1], 4.7, 4.5, id, sk);
  // knuckle ridge and finger creases on the leading edge
  for (let k = 0; k < 4; k++) {
    const o = (k - 1.5) * 2.0;
    plot(
      L,
      Math.floor(c[0] + ux * 2.2 + px * o),
      Math.floor(c[1] + uy * 2.2 + py * o),
      id,
      tint(B_SKIN, 1.2),
    );
    plot(
      L,
      Math.floor(c[0] + ux * 3.6 + px * o),
      Math.floor(c[1] + uy * 3.6 + py * o),
      id,
      rgba(58, 46, 40),
    ); // cracked nail
    if (k < 3) {
      const o2 = o + 1.0;
      for (let s = 2.0; s <= 4.2; s += 0.5)
        darkenL(L, c[0] + ux * s + px * o2, c[1] + uy * s + py * o2, id, 0.74);
    }
  }
  // thumb curled across the front
  for (let s = -2.4; s <= 0.6; s += 0.5)
    darkenL(L, c[0] + px * s - ux * 0.8, c[1] + py * s - uy * 0.8, id, 0.85);
}

function drawBruteArm(L, sh, el, ha, id, seed, side, chainLen) {
  const sk = bruteSkinFn(seed, sh[0], sh[1], { muscle: 0.64 });
  // deltoid + bicep
  capsule(L, sh[0], sh[1], el[0], el[1], 6.2, 4.8, id, sk);
  // shredded scrub sleeve cap
  // forearm
  const dx = ha[0] - el[0],
    dy = ha[1] - el[1],
    len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  capsule(L, el[0], el[1], ha[0] - ux * 3, ha[1] - uy * 3, 4.9, 4.1, id, sk);
  // iron restraint cuff around the wrist (the fist is drawn over its lower rim)
  const c0x = ha[0] - ux * 7.6,
    c0y = ha[1] - uy * 7.6,
    c1x = ha[0] - ux * 5.0,
    c1y = ha[1] - uy * 5.0;
  const cuff = (x, y) => {
    const t = ((x + 0.5 - c0x) * ux + (y + 0.5 - c0y) * uy) / 2.6;
    const p = (x + 0.5 - c0x) * -uy + (y + 0.5 - c0y) * ux;
    let c = t < 0.15 || t > 0.85 ? B_IRON_DK : B_IRON;
    if (t > 0.3 && t < 0.55) c = tint(c, 1.25);
    if (valueNoise(x * 0.8, y * 0.8, 64, seed + 7) > 0.76) c = mix(c, B_RUST, 0.5);
    return tint(c, 0.9 + 0.1 * Math.sign(p));
  };
  capsule(L, c0x, c0y, c1x, c1y, 4.7, 4.7, id, cuff);
  drawBruteFist(L, ha, [ux, uy], id, sk);
  const mx = (c0x + c1x) / 2,
    my = (c0y + c1y) / 2;
  plot(L, Math.floor(mx - uy * 2.5), Math.floor(my + ux * 2.5), id, B_IRON_LT); // rivet
  plot(L, Math.floor(mx + uy * 2.5), Math.floor(my - ux * 2.5), id, B_IRON_LT);
  // broken chain hanging from the cuff ring
  const dir = side === 'L' ? -1 : 1;
  drawChain(L, mx + dir * 4.5, my + 1, chainLen, id, dir);
}

function drawBruteLeg(L, hip, knee, foot, id, seed) {
  const pantsC = clothFn(B_SCRUB, B_SKIN, seed, hip[0], hip[1], { blood: 0.8, tear: 0.84 });
  const sk = bruteSkinFn(seed + 5, knee[0], knee[1], { muscle: 0.8 });
  // bare shin and huge bare foot
  capsule(L, knee[0], knee[1], foot[0], foot[1] - 1.5, 4.4, 3.5, id, sk);
  ellipseL(L, foot[0], foot[1] + 0.4, 4.9, 2.4, id, sk);
  const fy = Math.round(foot[1]) + 2;
  for (let k = -3; k <= 3; k += 2) plot(L, Math.round(foot[0] + k), fy, id, tint(B_SKIN_DK, 0.6)); // toe gaps
  plot(L, Math.round(foot[0]) - 4, fy, id, rgba(80, 70, 52));
  plot(L, Math.round(foot[0]) + 3, fy, id, rgba(80, 70, 52));
  // pant leg torn off below the knee
  capsule(L, hip[0], hip[1], knee[0], knee[1], 5.4, 4.8, id, pantsC);
  const hx = knee[0] + (foot[0] - knee[0]) * 0.3,
    hy = knee[1] + (foot[1] - knee[1]) * 0.3;
  capsule(L, knee[0], knee[1], hx, hy, 4.9, 4.6, id, pantsC);
  for (let k = -4; k <= 4; k++) {
    const r = hash2(k, seed, 5);
    if (r < 0.4) continue;
    for (let j = 1; j <= (r > 0.8 ? 3 : 1); j++)
      plot(L, Math.round(hx + k), Math.round(hy + 4 + j), id, tint(B_SCRUB, 0.7));
  }
}

function drawBrutePelvis(L, P, id) {
  const { hipL, hipR } = P;
  const y = (hipL[1] + hipR[1]) / 2,
    cx = (hipL[0] + hipR[0]) / 2;
  const pantsC = clothFn(B_SCRUB, B_SKIN, 404, cx, y, { blood: 0.72, tear: 0.9 });
  polyL(
    L,
    [
      [cx - 9.6, y - 3],
      [cx + 9.6, y - 3],
      [cx + 10.2, y + 4],
      [cx - 10.2, y + 4],
    ],
    id,
    pantsC,
  );
  fillRowL(L, cx - 9.6, cx + 9.6, Math.round(y - 3), id, tint(B_SCRUB, 1.15)); // waistband
  fillRowL(L, cx - 9.6, cx + 9.6, Math.round(y - 2), id, tint(B_SCRUB, 0.75));
  const c = Math.round(cx);
  plot(L, c - 1, Math.round(y - 1), id, rgba(196, 196, 184));
  plot(L, c - 1, Math.round(y), id, rgba(170, 170, 160)); // drawstring
  plot(L, c + 1, Math.round(y - 1), id, rgba(196, 196, 184));
  plot(L, c + 2, Math.round(y + 1), id, rgba(170, 170, 160));
}

function drawBruteTorso(L, P, id) {
  const { shL, shR, hipL, hipR } = P;
  const scx = (shL[0] + shR[0]) / 2,
    scy = (shL[1] + shR[1]) / 2;
  const wcx = (hipL[0] + hipR[0]) / 2,
    waistY = (hipL[1] + hipR[1]) / 2 - 2;
  const sk = bruteSkinFn(61, scx, scy, { muscle: 0.7 });
  // hunched trapezius hump rising behind the head
  ellipseL(L, scx, scy - 4.5, 11.5, 6.8, id, sk);
  polyL(
    L,
    [
      [shL[0] - 1, shL[1] - 4],
      [shR[0] + 1, shR[1] - 4],
      [shR[0] + 4, shR[1] + 1],
      [shR[0] + 3, shR[1] + 10],
      [wcx + 9, waistY],
      [wcx - 9, waistY],
      [shL[0] - 3, shL[1] + 10],
      [shL[0] - 4, shL[1] + 1],
    ],
    id,
    sk,
  );
  const cx = Math.round(scx),
    cy = Math.round(scy);
  // pectorals, sternum and abdominal plates
  for (let dx = -10; dx <= 10; dx++) {
    const y = cy + 5 + Math.round(Math.abs(dx) * 0.22);
    darkenL(L, cx + dx, y, id, 0.62);
    darkenL(L, cx + dx, y - 1, id, 1.12);
  }
  for (let y = cy + 1; y < waistY - 1; y++) darkenL(L, cx, y, id, y < cy + 6 ? 0.62 : 0.72);
  for (const ay of [cy + 10, cy + 14]) {
    if (ay >= waistY - 1) continue;
    for (let dx = -4; dx <= 4; dx++)
      if (dx) {
        darkenL(L, cx + dx, ay, id, 0.74);
        darkenL(L, cx + dx, ay + 1, id, 1.1);
      }
  }
  // scrub top split open down the front, hanging off the flanks in shreds
  const scrub = clothFn(B_SCRUB, B_SKIN, 77, scx, scy, { blood: 0.7, tear: 0.82 });
  polyL(
    L,
    [
      [shL[0] - 4.2, shL[1] + 1],
      [shL[0] + 2.5, shL[1] - 2.5],
      [shL[0] + 4.5, shL[1] + 8],
      [wcx - 5, waistY + 2],
      [wcx - 9.4, waistY + 2],
      [shL[0] - 3.2, shL[1] + 10],
    ],
    id,
    scrub,
  );
  polyL(
    L,
    [
      [shR[0] + 4.2, shR[1] + 1],
      [shR[0] - 2.5, shR[1] - 2.5],
      [shR[0] - 4.5, shR[1] + 8],
      [wcx + 5, waistY + 2],
      [wcx + 9.4, waistY + 2],
      [shR[0] + 3.2, shR[1] + 10],
    ],
    id,
    scrub,
  );
  // dangling shreds below the flaps
  for (const [x0, l] of [
    [wcx - 8, 3],
    [wcx - 6, 2],
    [wcx + 6, 4],
    [wcx + 8, 2],
  ]) {
    for (let j = 0; j < l; j++)
      plot(L, Math.round(x0), Math.round(waistY + 3 + j), id, tint(B_SCRUB, 0.75 - j * 0.05));
  }
}

function drawBruteHead(L, P, id) {
  const [hx, hy] = P.head;
  const jaw = P.jaw ?? 0;
  const sk = bruteSkinFn(81, hx, hy, { muscle: 0.9 });
  ellipseL(L, hx, hy - 1.5, 5.4, 5.2, id, sk);
  polyL(
    L,
    [
      [hx - 5.3, hy - 1.5],
      [hx + 5.3, hy - 1.5],
      [hx + 5.1, hy + 3 + jaw * 0.5],
      [hx + 3.4, hy + 5.6 + jaw],
      [hx - 3.4, hy + 5.6 + jaw],
      [hx - 5.1, hy + 3 + jaw * 0.5],
    ],
    id,
    sk,
  );
  const cx = Math.floor(hx),
    ey = Math.round(hy) - 2;
  // ears (torn)
  plot(L, cx - 6, ey + 1, id, tint(B_SKIN, 0.7));
  plot(L, cx - 6, ey + 2, id, tint(B_SKIN, 0.6));
  plot(L, cx + 5, ey + 1, id, tint(B_SKIN, 0.9));
  // stapled surgical scar across the bald scalp
  for (let x = cx - 3; x <= cx + 3; x++) {
    const y = ey - 4 + (x > cx ? 1 : 0);
    plot(L, x, y, id, rgba(70, 34, 44));
    if (!(x & 1)) {
      plot(L, x, y - 1, id, rgba(150, 150, 150));
      plot(L, x, y + 1, id, rgba(110, 110, 116));
    }
  }
  // heavy brow ridge, deep sockets, sickly yellow glowing eyes
  fillRowL(L, cx - 4, cx + 5, ey - 1, id, tint(B_SKIN, 1.12));
  for (const ox of [-3, 2]) {
    for (const [ax, ay] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      plot(L, cx + ox + ax, ey + ay, id, SOCKET);
  }
  if (P.eyesDim) {
    plot(L, cx - 2, ey, id, B_EYE_DIM);
    plot(L, cx + 2, ey, id, B_EYE_DIM);
  } else {
    plot(L, cx - 2, ey, id, B_EYE);
    plot(L, cx + 2, ey, id, B_EYE);
    plot(L, cx - 3, ey, id, B_EYE_DIM);
    plot(L, cx + 3, ey, id, B_EYE_DIM);
  }
  plot(L, cx - 1, ey + 2, id, SOCKET);
  plot(L, cx + 1, ey + 2, id, SOCKET); // flattened nose
  darkenL(L, cx, ey + 2, id, 1.1);
  // metal jaw brace: strap across the face, cage bars over the mouth, chin strap
  const my0 = ey + 3,
    my1 = Math.round(hy + 5 + jaw);
  for (let y = my0 + 1; y < my1; y++)
    for (let x = cx - 3; x <= cx + 3; x++) plot(L, x, y, id, MOUTH);
  for (let x = cx - 2; x <= cx + 2; x += 2) plot(L, x, my0 + 1, id, TEETH);
  if (jaw >= 1) for (let x = cx - 2; x <= cx + 2; x += 2) plot(L, x, my1 - 1, id, tint(TEETH, 0.8));
  if (jaw >= 2) plot(L, cx, my0 + 2, id, BLOOD);
  fillRowL(L, cx - 5, cx + 6, my0, id, B_IRON);
  for (const bx of [cx - 3, cx - 1, cx + 1, cx + 3]) {
    for (let y = my0; y <= my1; y++) plot(L, bx, y, id, y === my0 ? B_IRON_LT : B_IRON);
  }
  fillRowL(L, cx - 4, cx + 5, my1, id, B_IRON_DK);
  plot(L, cx - 5, my0, id, B_IRON_LT);
  plot(L, cx + 5, my0, id, B_IRON_LT);
  plot(L, cx - 5, my0 + 1, id, B_IRON_DK);
  plot(L, cx + 5, my0 + 1, id, B_IRON_DK);
  plot(L, cx - 4, my1 + 1, id, BLOOD);
  plot(L, cx + 2, my1 + 1, id, BLOOD_DK); // drool through the cage
}

function bruteStand() {
  return {
    head: [24.5, 15],
    jaw: 0,
    shL: [11, 20],
    shR: [37, 20],
    hipL: [19.5, 43],
    hipR: [28.5, 43],
    kneeL: [17.5, 52.5],
    kneeR: [30.5, 52.5],
    footL: [16.5, 61],
    footR: [31.5, 61],
    elL: [6.5, 32],
    handL: [8.5, 45],
    elR: [41.5, 32],
    handR: [39.5, 45],
  };
}

function bruteWalk(f) {
  const P = bruteStand();
  if (f === 1) {
    P.head = add(P.head, 0, -0.5);
    return P;
  }
  const s = f === 0 ? 1 : -1;
  if (s > 0) {
    P.footL = [15.5, 61];
    P.kneeL = [16.8, 52.5];
    P.footR = [31.2, 58];
    P.kneeR = [31.2, 50.5];
  } else {
    P.footR = [32.5, 61];
    P.kneeR = [31.2, 52.5];
    P.footL = [16.8, 58];
    P.kneeL = [16.8, 50.5];
  }
  for (const k of ['head', 'shL', 'shR', 'elL', 'elR', 'handL', 'handR'])
    P[k] = add(P[k], -0.8 * s, 1);
  P.head = add(P.head, 0.8 * s, 0);
  P.hipL = add(P.hipL, -0.5 * s, 0.5);
  P.hipR = add(P.hipR, -0.5 * s, 0.5);
  P.shL = add(P.shL, 0, 0.6 * s);
  P.shR = add(P.shR, 0, -0.6 * s);
  P.handL = add(P.handL, 0.8 * s, -2 * s);
  P.elL = add(P.elL, 0.3 * s, -0.8 * s);
  P.handR = add(P.handR, 0.8 * s, 2 * s);
  P.elR = add(P.elR, 0.3 * s, 0.8 * s);
  return P;
}

function bruteAttack() {
  // both fists raised overhead for a hammer blow, roaring against the brace
  const P = bruteStand();
  P.head = [24.5, 16];
  P.jaw = 2;
  P.shL = [11, 19];
  P.shR = [37, 19];
  P.elL = [4.5, 12];
  P.handL = [17, 6];
  P.elR = [43.5, 12];
  P.handR = [31, 6];
  P.kneeL = [16, 52.5];
  P.kneeR = [32, 52.5];
  P.footL = [14.5, 61];
  P.footR = [33.5, 61];
  return P;
}

function bruteDeath0() {
  // staggering back: head snapped aside, one arm flung up, torso twisting
  const P = bruteStand();
  P.head = [28, 16.5];
  P.jaw = 2;
  P.eyesDim = true;
  P.shL = [13.5, 21.5];
  P.shR = [39, 20];
  P.elL = [6, 20];
  P.handL = [6.5, 7.5];
  P.elR = [43, 33];
  P.handR = [42.5, 46];
  P.hipL = [20, 43.5];
  P.hipR = [29, 43];
  P.kneeL = [17, 53];
  P.kneeR = [31.5, 52.5];
  P.footL = [15, 61];
  P.footR = [33.5, 61];
  return P;
}

function bruteDeath1() {
  // collapsed onto its knees, slumped forward on its knuckles
  return {
    head: [24, 33],
    jaw: 1,
    eyesDim: true,
    shL: [11.5, 34],
    shR: [36.5, 35],
    hipL: [19, 50],
    hipR: [29, 50],
    kneeL: [16, 58],
    kneeR: [32, 58],
    elL: [7, 44],
    handL: [9, 57.5],
    elR: [41, 45],
    handR: [39, 57.5],
    kneel: true,
  };
}

function drawBruteFrame(P, frameSeed) {
  const L = makeLayer(BW, 64);
  let id = 1;
  if (P.kneel) {
    const pantsC = clothFn(B_SCRUB, B_SKIN, 640, 24, 54, { blood: 0.76 });
    for (const [hip, knee] of [
      [P.hipL, P.kneeL],
      [P.hipR, P.kneeR],
    ]) {
      capsule(L, hip[0], hip[1], knee[0], knee[1], 5.4, 5, id, pantsC);
      ellipseL(L, knee[0], knee[1] + 2, 5, 3, id, pantsC);
      id++;
    }
  } else {
    drawBruteLeg(L, P.hipL, P.kneeL, P.footL, id++, 610);
    drawBruteLeg(L, P.hipR, P.kneeR, P.footR, id++, 611);
  }
  drawBrutePelvis(L, P, id++);
  drawBruteTorso(L, P, id++);
  const headFirst = P.head[1] > 26;
  if (!headFirst) drawBruteHead(L, P, id++);
  drawBruteArm(L, P.shL, P.elL, P.handL, id++, 620, 'L', 7);
  drawBruteArm(L, P.shR, P.elR, P.handR, id++, 621, 'R', 5);
  if (headFirst) drawBruteHead(L, P, id++);
  shadeLayer(L, { top: 0, bottom: 64 });
  vary(L.img, mulberry32(frameSeed), 0.1);
  return outline(L.img, OUTLINE);
}

function drawBruteCorpse() {
  const L = makeLayer(BW, 64);
  const rng = mulberry32(977);
  const pool = (x, y) => tint(BLOOD_DK, 0.7 + 0.35 * hash2(x, y, 6));
  ellipseL(L, 24, 60.5, 23.5, 3.6, 0, pool);
  for (let k = 0; k < 6; k++)
    ellipseL(L, 3 + rng() * 42, 60 + rng() * 3, 2 + rng() * 3, 1.3, 0, pool);
  for (let x = 4; x < 44; x += 2) if (rng() < 0.4) plot(L, x, 59, 0, rgba(130, 18, 16));
  let id = 1;
  const pantsC = clothFn(B_SCRUB, B_SKIN, 650, 34, 57, { blood: 0.7 });
  const legSk = bruteSkinFn(651, 40, 58, { muscle: 0.8 });
  // legs stretched out to the right
  capsule(L, 29, 56, 38, 56.5, 4.6, 4, id, pantsC);
  capsule(L, 38, 56.5, 44, 57.5, 3.6, 3, id, legSk);
  ellipseL(L, 45.5, 57, 2, 3.2, id, legSk);
  id++;
  capsule(L, 29, 60, 37, 61, 4.2, 3.8, id, (x, y) => tint(pantsC(x, y), 0.85));
  capsule(L, 37, 61, 42, 61.5, 3.2, 2.8, id, legSk);
  ellipseL(L, 43.5, 61.2, 1.8, 2.4, id, legSk);
  id++;
  // massive torso lying on its side, back hump up
  const sk = bruteSkinFn(652, 18, 55, { muscle: 0.66 });
  polyL(
    L,
    [
      [9, 52],
      [30, 53],
      [32, 62.5],
      [9, 63],
    ],
    id,
    sk,
  );
  ellipseL(L, 19, 52.5, 11, 4.5, id, sk);
  const scrub = clothFn(B_SCRUB, B_SKIN, 653, 22, 56, { blood: 0.64, tear: 0.8 });
  polyL(
    L,
    [
      [22, 50],
      [31, 53],
      [32, 62.5],
      [24, 62.5],
    ],
    id,
    scrub,
  );
  for (let y = 51; y < 62; y++) if (hash2(y, 3, 9) < 0.5) plot(L, 21, y, id, tint(B_SCRUB, 0.8));
  id++;
  // head with the jaw brace, face toward the viewer
  const hs = bruteSkinFn(654, 5, 57, { muscle: 0.9 });
  ellipseL(L, 5.5, 57, 4.8, 4.6, id, hs);
  plot(L, 4, 55, id, SOCKET);
  plot(L, 5, 55, id, SOCKET);
  plot(L, 7, 55, id, SOCKET);
  plot(L, 8, 55, id, SOCKET);
  plot(L, 5, 55, id, rgba(96, 92, 40));
  plot(L, 8, 55, id, rgba(96, 92, 40)); // dead eyes
  fillRowL(L, 2, 10, 57, id, B_IRON);
  for (const bx of [3, 5, 7, 9]) for (let y = 57; y <= 60; y++) plot(L, bx, y, id, B_IRON);
  for (const bx of [4, 6, 8]) for (let y = 58; y <= 59; y++) plot(L, bx, y, id, MOUTH);
  fillRowL(L, 3, 10, 60, id, B_IRON_DK);
  plot(L, 6, 61, id, BLOOD);
  plot(L, 7, 62, id, BLOOD_DK);
  id++;
  // arm flopped over the body, cuffed fist and chain trailing to the floor
  const as = bruteSkinFn(655, 14, 50, { muscle: 0.64 });
  capsule(L, 14, 53, 21, 47.5, 4.6, 4, id, as);
  capsule(L, 21, 47.5, 29, 49, 4, 3.6, id, as);
  drawBruteFist(L, [31.5, 50], [1, 0.15], id, as);
  capsule(L, 26.5, 49, 27.5, 49.2, 4, 4, id, (x) =>
    x === 25 ? B_IRON_DK : x === 28 ? B_IRON_LT : B_IRON,
  );
  drawChain(L, 27, 53, 12, id, 1);
  id++;
  capsule(L, 12, 61, 17, 62, 3.4, 3, id, as);
  ellipseL(L, 19, 61.5, 3, 2.4, id, as);
  shadeLayer(L, { top: 44, bottom: 64 });
  vary(L.img, mulberry32(978), 0.1);
  return outline(L.img, OUTLINE);
}

function buildBrute() {
  return {
    walk: [0, 1, 2].map((f) => drawBruteFrame(bruteWalk(f), 1600 + f)),
    attack: drawBruteFrame(bruteAttack(), 1610),
    death: [
      drawBruteFrame(bruteDeath0(), 1620),
      drawBruteFrame(bruteDeath1(), 1621),
      drawBruteCorpse(),
    ],
  };
}

//=============================================================
//                   MISSION / LEVEL PROPS
//=============================================================

// Mission / level props (front-on floor billboards)

const asEmissive = (c) => ((c & 0x00ffffff) | (EMISSIVE << 24)) >>> 0;

// Shaded rectangular panel: light from the upper right, darker toward the bottom.
function panelRect(img, x0, y0, w, h, base, seed, o = {}) {
  const bevel = o.bevel ?? true;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      let f =
        0.9 + 0.18 * valueNoise(x * 0.5, y * 0.5, 64, seed) + (hash2(x, y, seed + 1) - 0.5) * 0.08;
      f *= 1.08 - 0.25 * ((y - y0) / Math.max(1, h - 1));
      f *= 0.9 + 0.18 * ((x - x0) / Math.max(1, w - 1));
      if (bevel) {
        if (y === y0) f *= 1.3;
        else if (y === y0 + h - 1) f *= 0.6;
        if (x === x0) f *= 0.72;
        else if (x === x0 + w - 1) f *= 1.15;
      }
      setPx(img, x, y, tint(base, f));
    }
}

function rivetPx(img, x, y) {
  setPx(img, x, y, rgba(170, 170, 172));
  setPx(img, x + 1, y + 1, rgba(30, 30, 34));
}

// A light: bright core pixel(s) with an emissive bloom tinting nearby opaque pixels.
function lamp(img, x, y, core, rim, halo, r = 2.6) {
  for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++)
    for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
      const d = Math.hypot(xx - x, yy - y) / r;
      if (d >= 1) continue;
      const c = getPx(img, xx, yy);
      if (!(c >>> 24)) continue;
      setPx(img, xx, yy, asEmissive(mix(c, halo, (1 - d) * 0.75)));
    }
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    setPx(img, x + dx, y + dy, rim);
  setPx(img, x, y, core);
}

const deadLamp = (img, x, y, glass) => {
  setPx(img, x, y, glass);
  setPx(img, x + 1, y, tint(glass, 0.7));
  setPx(img, x, y + 1, tint(glass, 0.6));
  setPx(img, x + 1, y + 1, tint(glass, 0.45));
  setPx(img, x, y, tint(glass, 1.5));
};

function buildRadioPart() {
  const img = makeImage(16, 16);
  // vacuum tube standing in its socket
  fillRect(img, 2, 6, 6, 2, rgba(40, 36, 32));
  fillEllipse(img, 5, 3.6, 2.6, 3.6, rgba(110, 128, 136));
  fillRect(img, 4, 2, 2, 4, rgba(60, 64, 66)); // plate electrode
  setPx(img, 4, 5, glow(230, 110, 40));
  setPx(img, 5, 5, glow(170, 70, 30)); // faint filament
  setPx(img, 6, 1, rgba(220, 232, 236));
  setPx(img, 6, 2, rgba(180, 196, 202)); // glass glint
  setPx(img, 5, 0, rgba(80, 90, 96));
  // circuit board
  panelRect(img, 1, 8, 14, 8, rgba(36, 96, 56), 811);
  const gold = rgba(176, 150, 72);
  for (const [y, xa, xb] of [
    [10, 2, 8],
    [12, 4, 13],
    [14, 2, 7],
    [14, 9, 13],
  ])
    for (let x = xa; x <= xb; x++) if (hash2(x, y, 3) > 0.15) setPx(img, x, y, gold);
  for (const [x, y] of [
    [2, 10],
    [8, 10],
    [4, 12],
    [7, 14],
    [13, 12],
  ])
    setPx(img, x, y, rgba(210, 206, 190)); // solder
  fillRect(img, 9, 9, 4, 3, rgba(22, 22, 24)); // chip
  for (let x = 9; x < 13; x++) {
    setPx(img, x, 8, rgba(170, 170, 170));
  }
  setPx(img, 12, 9, rgba(80, 80, 84));
  fillRect(img, 3, 11, 2, 2, rgba(40, 70, 150));
  setPx(img, 4, 11, rgba(90, 130, 210)); // capacitor
  // quartz crystal can
  fillRect(img, 10, 5, 4, 3, rgba(170, 172, 176));
  setPx(img, 13, 5, rgba(220, 222, 226));
  setPx(img, 10, 7, rgba(110, 112, 116));
  // cut wires
  setPx(img, 0, 11, rgba(170, 30, 26));
  setPx(img, 0, 12, rgba(140, 24, 20));
  setPx(img, 15, 13, rgba(200, 170, 40));
  setPx(img, 15, 14, rgba(170, 140, 30));
  outline(img, OUTLINE);
  lamp(img, 13, 14, glow(200, 255, 200), glow(60, 255, 90), glow(30, 200, 60), 2.4);
  return img;
}

function buildKeycard() {
  const img = makeImage(16, 12);
  fillRect(img, 1, 3, 14, 9, rgba(214, 214, 206));
  setPx(img, 1, 3, 0);
  setPx(img, 14, 3, 0);
  setPx(img, 1, 11, 0);
  setPx(img, 14, 11, 0);
  fillRect(img, 2, 3, 12, 3, rgba(176, 30, 30)); // red header band
  for (let x = 2; x < 14; x++) setPx(img, x, 3, rgba(214, 60, 52));
  fillRect(img, 6, 4, 4, 1, rgba(30, 26, 26)); // lanyard slot
  // clip
  fillRect(img, 6, 0, 4, 3, rgba(150, 152, 158));
  fillRect(img, 7, 1, 2, 1, rgba(40, 40, 46));
  setPx(img, 9, 0, rgba(210, 212, 216));
  // photo + text lines
  fillRect(img, 2, 6, 4, 4, rgba(90, 104, 124));
  fillRect(img, 3, 7, 2, 1, rgba(190, 160, 140));
  fillRect(img, 3, 8, 2, 2, rgba(60, 64, 80));
  fillRect(img, 7, 6, 6, 1, rgba(90, 90, 96));
  fillRect(img, 7, 8, 4, 1, rgba(120, 120, 126));
  for (let x = 1; x < 15; x++) setPx(img, x, 11, rgba(150, 150, 146));
  // glowing mag/holo stripe
  for (let x = 2; x < 14; x++) setPx(img, x, 10, x & 1 ? glow(110, 235, 255) : glow(70, 190, 240));
  vary(img, mulberry32(812), 0.05);
  return outline(img, OUTLINE);
}

function buildRadio() {
  const img = makeImage(32, 32);
  // supply crate
  const wood = rgba(112, 80, 48);
  for (let y = 21; y < 32; y++)
    for (let x = 2; x < 30; x++)
      setPx(
        img,
        x,
        y,
        tint(woodPx(x, y, 821, wood), 0.9 + 0.2 * ((x - 2) / 28) - 0.15 * ((y - 21) / 11)),
      );
  for (let x = 2; x < 30; x++) {
    setPx(img, x, 26, rgba(52, 34, 20));
    setPx(img, x, 21, tint(wood, 1.25));
  }
  for (const bx of [2, 26])
    for (let y = 21; y < 32; y++)
      for (let x = bx; x < bx + 4; x++)
        setPx(img, x, y, tint(woodPx(y, x, 822, wood), x === bx ? 0.7 : 1));
  for (let x = 10; x < 21; x++) if (hash2(x, 1, 823) < 0.7) setPx(img, x, 28, rgba(30, 30, 30)); // stencil
  // handset resting on the crate
  fillRect(img, 0, 18, 5, 3, rgba(26, 26, 28));
  setPx(img, 4, 18, rgba(70, 70, 74));
  // radio body
  const olive = rgba(82, 92, 54);
  panelRect(img, 4, 9, 24, 12, olive, 824);
  fillRect(img, 11, 6, 10, 1, rgba(40, 40, 42));
  fillRect(img, 11, 7, 1, 2, rgba(40, 40, 42));
  fillRect(img, 20, 7, 1, 2, rgba(40, 40, 42));
  setPx(img, 20, 6, rgba(110, 110, 114));
  fillRect(img, 6, 11, 20, 8, rgba(36, 40, 30)); // front panel
  for (let y = 12; y < 18; y += 2) fillRect(img, 7, y, 6, 1, rgba(16, 16, 14)); // speaker grille
  for (let y = 13; y < 18; y += 2) fillRect(img, 7, y, 6, 1, rgba(64, 68, 54));
  // knobs
  for (const kx of [17, 22]) {
    fillEllipse(img, kx + 0.5, 16.5, 2, 2, rgba(24, 24, 24));
    setPx(img, kx + 1, 15, rgba(170, 170, 170));
    setPx(img, kx, 15, rgba(70, 70, 72));
  }
  setPx(img, 25, 18, rgba(170, 170, 170));
  setPx(img, 25, 17, rgba(110, 110, 110)); // toggle
  rivetPx(img, 5, 10);
  rivetPx(img, 26, 10);
  rivetPx(img, 5, 19);
  rivetPx(img, 26, 19);
  // antenna with tip
  drawLine(img, 25, 9, 29, 1, rgba(120, 122, 126));
  setPx(img, 29, 0, rgba(200, 200, 204));
  setPx(img, 29, 1, rgba(150, 150, 154));
  fillRect(img, 24, 8, 3, 1, rgba(40, 40, 44));
  vary(img, mulberry32(825), 0.06);
  outline(img, OUTLINE);
  // amber frequency window + lamp
  for (let x = 15; x < 25; x++) {
    setPx(img, x, 12, glow(255, 176, 52));
    setPx(img, x, 13, x % 3 === 0 ? glow(150, 80, 20) : glow(230, 140, 40));
  }
  setPx(img, 19, 12, glow(255, 240, 200));
  setPx(img, 19, 13, glow(60, 20, 8)); // needle
  lamp(img, 24, 15, glow(255, 230, 150), glow(255, 170, 40), glow(200, 110, 30), 2);
  return img;
}

function buildBreaker(on) {
  const img = makeImage(24, 40);
  const steel = rgba(92, 102, 96);
  // post and base plate
  panelRect(img, 9, 25, 5, 13, rgba(70, 72, 76), 831);
  panelRect(img, 5, 37, 14, 3, rgba(48, 48, 52), 832);
  rivetPx(img, 6, 38);
  rivetPx(img, 16, 38);
  // box
  panelRect(img, 2, 4, 18, 22, steel, 833);
  for (let y = 6; y < 24; y++) {
    setPx(img, 4, y, tint(steel, 0.6));
    setPx(img, 18, y, tint(steel, 1.2));
  }
  for (let x = 4; x < 19; x++) {
    setPx(img, x, 6, tint(steel, 0.65));
    setPx(img, x, 23, tint(steel, 1.15));
  }
  fillRect(img, 2, 7, 1, 3, rgba(150, 150, 150));
  fillRect(img, 2, 19, 1, 3, rgba(150, 150, 150)); // hinges
  fillRect(img, 3, 2, 16, 2, rgba(60, 66, 62)); // rain hood
  for (let x = 3; x < 19; x++) setPx(img, x, 2, rgba(120, 128, 122));
  // hazard sticker: yellow triangle with a black bolt
  fillPoly(
    img,
    [
      [11, 10],
      [16, 19],
      [6, 19],
    ],
    rgba(206, 168, 40),
  );
  fillPoly(
    img,
    [
      [11.5, 12],
      [9.5, 15.5],
      [11.2, 15.5],
      [10, 18.5],
      [13, 14.5],
      [11.4, 14.5],
      [12.5, 12],
    ],
    rgba(20, 18, 14),
  );
  // ON/OFF marks by the lever
  fillRect(img, 19, 5, 1, 2, rgba(60, 130, 60));
  fillRect(img, 19, 23, 1, 2, rgba(150, 40, 30));
  // label plate under the light
  fillRect(img, 5, 21, 5, 1, rgba(190, 190, 180));
  // lever
  const pv = [20, 14];
  const end = on ? [21, 3] : [21, 26];
  drawLine(img, pv[0], pv[1], end[0], end[1], rgba(150, 152, 156), 2);
  drawLine(img, pv[0] + 0.6, pv[1], end[0] + 0.6, end[1], rgba(90, 92, 96), 1);
  fillEllipse(img, 20.5, 14.5, 2, 2, rgba(40, 40, 44));
  setPx(img, 20, 14, rgba(160, 160, 166));
  const gy = on ? 1 : 26;
  fillRect(img, 18, gy, 6, 3, rgba(150, 30, 26));
  fillRect(img, 18, gy, 6, 1, rgba(210, 60, 50));
  for (let x = 19; x < 24; x += 2) setPx(img, x, gy + 2, rgba(90, 16, 14));
  vary(img, mulberry32(on ? 834 : 835), 0.06);
  // grime
  const rng = mulberry32(836);
  for (let k = 0; k < 20; k++) {
    const x = 2 + Math.floor(rng() * 18),
      y = 4 + Math.floor(rng() * 34);
    const c = getPx(img, x, y);
    if (c >>> 24 === 255) setPx(img, x, y, tint(c, 0.7));
  }
  outline(img, OUTLINE);
  if (on) lamp(img, 7, 9, glow(220, 255, 220), glow(70, 255, 100), glow(30, 200, 60), 3);
  else lamp(img, 7, 9, glow(255, 200, 190), glow(255, 50, 40), glow(170, 20, 16), 2.2);
  return img;
}

function buildGenerator(on) {
  const img = makeImage(48, 40);
  const yellow = rgba(188, 148, 40),
    grey = rgba(92, 94, 98);
  // skid base with hazard edge
  panelRect(img, 1, 35, 46, 5, rgba(52, 52, 56), 841);
  for (let x = 2; x < 46; x++)
    setPx(img, x, 35, (x >> 1) & 1 ? rgba(200, 160, 30) : rgba(24, 22, 20));
  for (const bx of [4, 23, 42]) setPx(img, bx, 37, rgba(16, 16, 18));
  // fuel line out of the left side down to the skid
  fillRect(img, 0, 20, 4, 2, rgba(60, 62, 66));
  fillRect(img, 0, 20, 2, 15, rgba(60, 62, 66));
  for (let y = 20; y < 35; y++) setPx(img, 1, y, rgba(110, 112, 116));
  setPx(img, 2, 20, rgba(120, 122, 126));
  // engine enclosure
  panelRect(img, 3, 11, 25, 24, yellow, 842);
  panelRect(img, 27, 11, 18, 24, grey, 843);
  // rounded roof + lifting eyes
  fillRect(img, 4, 9, 40, 2, tint(yellow, 0.9));
  for (let x = 4; x < 44; x++) setPx(img, x, 9, tint(yellow, 1.3));
  for (const ex of [7, 40]) {
    fillRect(img, ex, 6, 3, 1, rgba(80, 80, 84));
    setPx(img, ex, 7, rgba(80, 80, 84));
    setPx(img, ex + 2, 7, rgba(80, 80, 84));
    setPx(img, ex, 8, rgba(80, 80, 84));
    setPx(img, ex + 2, 8, rgba(80, 80, 84));
  }
  // exhaust stack with rain cap and soot
  panelRect(img, 33, 2, 3, 8, rgba(58, 54, 50), 844);
  fillRect(img, 32, 1, 5, 1, rgba(40, 38, 36));
  fillRect(img, 32, 0, 5, 1, rgba(90, 86, 80));
  for (let x = 30; x < 40; x++)
    for (let y = 9; y < 13; y++)
      if (hash2(x, y, 845) < 0.5) {
        const c = getPx(img, x, y);
        if (c >>> 24) setPx(img, x, y, tint(c, 0.6));
      }
  // louvered vents
  for (let y = 14; y < 31; y += 3) {
    fillRect(img, 6, y, 18, 1, rgba(24, 20, 14));
    fillRect(img, 6, y + 1, 18, 1, tint(yellow, 0.7));
    fillRect(img, 6, y - 1, 18, 1, tint(yellow, 1.18));
  }
  // stencil block + bolts
  fillRect(img, 6, 32, 9, 1, rgba(30, 26, 18));
  for (const [x, y] of [
    [4, 12],
    [25, 12],
    [4, 32],
    [25, 32],
    [28, 12],
    [43, 12],
    [28, 32],
    [43, 32],
  ])
    rivetPx(img, x, y);
  // rust streaks
  for (const sx of [5, 14, 21, 30, 41])
    for (let y = 13; y < 13 + 4 + (sx % 7); y++) {
      const c = getPx(img, sx, y);
      if (c >>> 24 === 255) setPx(img, sx, y, mix(c, rgba(110, 56, 26), 0.5));
    }
  // control panel
  fillRect(img, 29, 14, 14, 18, rgba(34, 36, 40));
  for (let x = 29; x < 43; x++) setPx(img, x, 31, rgba(80, 82, 88));
  fillEllipse(img, 33.5, 19.5, 3.6, 3.6, rgba(150, 120, 50)); // gauge bezel
  fillEllipse(img, 33.5, 19.5, 2.7, 2.7, rgba(70, 66, 56));
  fillEllipse(img, 39.5, 19.5, 2, 2, rgba(120, 24, 20));
  setPx(img, 39, 18, rgba(200, 70, 60)); // e-stop
  fillRect(img, 30, 28, 12, 2, rgba(20, 20, 22));
  vary(img, mulberry32(on ? 846 : 847), 0.06);
  outline(img, OUTLINE);
  if (on) {
    // lit amber gauge with needle pointing high
    for (let y = 16; y < 24; y++)
      for (let x = 30; x < 38; x++) {
        const d = Math.hypot(x + 0.5 - 33.5, y + 0.5 - 19.5);
        if (d < 2.7) setPx(img, x, y, d < 1.6 ? glow(255, 210, 110) : glow(240, 160, 50));
      }
    setPx(img, 34, 19, glow(40, 16, 6));
    setPx(img, 35, 18, glow(40, 16, 6));
    setPx(img, 33, 19, glow(40, 16, 6));
    for (const [x, y] of [
      [30, 19],
      [37, 19],
      [33, 16],
    ])
      setPx(img, x, y, glow(255, 220, 150));
    deadLamp(img, 31, 28, rgba(70, 20, 18));
    lamp(img, 35, 28, glow(210, 255, 210), glow(60, 255, 90), glow(20, 180, 50), 2.2);
    lamp(img, 39, 28, glow(210, 255, 210), glow(60, 255, 90), glow(20, 180, 50), 2.2);
    lamp(img, 34, 24, glow(255, 230, 170), glow(255, 170, 50), glow(180, 100, 20), 1.6);
  } else {
    setPx(img, 32, 20, rgba(30, 28, 24));
    setPx(img, 31, 21, rgba(30, 28, 24)); // needle at rest
    lamp(img, 31, 28, glow(255, 190, 180), glow(255, 40, 30), glow(150, 16, 12), 2.2);
    deadLamp(img, 35, 28, rgba(30, 60, 34));
    deadLamp(img, 39, 28, rgba(30, 60, 34));
  }
  return img;
}

function boltShape(cx, cy, s) {
  return [
    [cx + 0.6 * s, cy - 4 * s],
    [cx - 2.2 * s, cy + 0.6 * s],
    [cx - 0.1 * s, cy + 0.6 * s],
    [cx - 1.0 * s, cy + 4.2 * s],
    [cx + 2.4 * s, cy - 0.8 * s],
    [cx + 0.4 * s, cy - 0.8 * s],
    [cx + 1.8 * s, cy - 4 * s],
  ];
}

function buildTrap(on) {
  const img = makeImage(24, 40);
  const steel = rgba(72, 76, 84);
  panelRect(img, 9, 23, 6, 14, rgba(60, 62, 68), 851);
  panelRect(img, 5, 36, 14, 4, rgba(44, 44, 48), 852);
  for (let x = 6; x < 18; x++)
    setPx(img, x, 36, (x >> 1) & 1 ? rgba(200, 160, 30) : rgba(24, 22, 20));
  // console head with a slanted lid
  panelRect(img, 2, 6, 20, 18, steel, 853);
  fillPoly(
    img,
    [
      [3, 6],
      [21, 6],
      [19, 3],
      [5, 3],
    ],
    rgba(96, 100, 108),
  );
  for (let x = 5; x < 19; x++) setPx(img, x, 3, rgba(140, 144, 150));
  // screen
  fillRect(img, 4, 7, 16, 5, rgba(26, 28, 32));
  // lightning plate
  fillRect(img, 4, 13, 10, 9, rgba(30, 32, 36));
  for (let x = 4; x < 14; x++) setPx(img, x, 13, rgba(100, 104, 112));
  // lever slot + hazard-striped lever
  fillRect(img, 16, 13, 3, 9, rgba(20, 20, 24));
  rivetPx(img, 3, 22);
  rivetPx(img, 19, 22);
  const pv = [17.5, 17.5],
    end = on ? [22, 8] : [22, 27];
  const dx = end[0] - pv[0],
    dy = end[1] - pv[1],
    len = Math.hypot(dx, dy);
  for (let t = 0; t <= len; t += 0.4) {
    const x = pv[0] + (dx * t) / len,
      y = pv[1] + (dy * t) / len;
    const band = Math.floor(t / 2) & 1;
    fillEllipse(img, x, y, 1.6, 1.6, band ? rgba(24, 22, 20) : rgba(214, 172, 36));
  }
  fillEllipse(img, end[0] - 0.5, end[1], 2.2, 2.2, rgba(30, 30, 32));
  setPx(img, Math.round(end[0]), Math.round(end[1]) - 1, rgba(110, 110, 116));
  fillEllipse(img, 17.5, 17.5, 1.6, 1.6, rgba(120, 122, 128));
  vary(img, mulberry32(on ? 854 : 855), 0.06);
  outline(img, OUTLINE);
  const bolt = boltShape(9, 17.5, 1.12);
  if (on) {
    // lit screen with a voltage trace
    for (let y = 7; y < 12; y++) for (let x = 4; x < 20; x++) setPx(img, x, y, glow(16, 70, 90));
    for (let x = 4; x < 20; x++) {
      const y = 9 + Math.round(Math.sin(x * 1.3) * 1.4 * (hash2(x, 0, 3) + 0.4));
      setPx(img, x, Math.max(7, Math.min(11, y)), glow(150, 240, 255));
    }
    setPx(img, 5, 7, glow(90, 255, 120));
    setPx(img, 6, 7, glow(90, 255, 120));
    // crackling blue bolt
    for (let y = 13; y < 22; y++) for (let x = 4; x < 14; x++) setPx(img, x, y, glow(14, 30, 60));
    fillPoly(img, bolt, glow(120, 190, 255));
    fillPoly(img, boltShape(9, 17.5, 0.62), glow(235, 248, 255));
    const rng = mulberry32(856);
    for (let k = 0; k < 4; k++) {
      let x = 9 + (rng() - 0.5) * 4,
        y = 17 + (rng() - 0.5) * 6;
      const sx = rng() < 0.5 ? -1 : 1;
      for (let s = 0; s < 4; s++) {
        x += sx;
        y += rng() < 0.5 ? -1 : 1;
        setPx(img, x, y, s === 3 ? glow(80, 140, 255) : glow(170, 220, 255));
      }
    }
  } else {
    fillPoly(img, bolt, rgba(132, 118, 58));
    fillPoly(img, boltShape(9, 17.5, 0.62), rgba(108, 96, 48));
    for (let y = 8; y < 11; y++) setPx(img, 17 - (y - 8), y, rgba(56, 62, 70)); // dead-screen reflection
  }
  return img;
}

function buildFlare(on) {
  const img = makeImage(16, 24);
  fillEllipse(img, 8, 23.4, 6, 2, rgba(52, 40, 30)); // dirt mound
  for (let x = 3; x < 13; x++) if (hash2(x, 2, 861) < 0.4) setPx(img, x, 22, rgba(70, 56, 40));
  // red stick, slightly tilted
  for (let y = 8; y < 23; y++) {
    const ox = y < 14 ? 1 : 0;
    setPx(img, 6 + ox, y, rgba(110, 18, 18));
    setPx(img, 7 + ox, y, rgba(176, 34, 30));
    setPx(img, 8 + ox, y, rgba(210, 70, 56));
  }
  fillRect(img, 6, 16, 3, 2, rgba(214, 206, 190));
  setPx(img, 7, 17, rgba(40, 40, 40)); // label band
  if (on) {
    outline(img, OUTLINE);
    haloFill(img, 8.5, 7, 7.5, [420, 120, 200]);
    // burning tip and flame tongue
    for (let y = 8; y < 11; y++)
      for (let x = 7; x < 10; x++)
        setPx(img, x, y, asEmissive(mix(getPx(img, x, y), rgba(255, 140, 150), 0.6)));
    fillEllipse(img, 8.5, 7, 2.4, 2.4, glow(255, 70, 110));
    fillEllipse(img, 8.5, 6.4, 1.6, 2.2, glow(255, 160, 180));
    fillRect(img, 8, 6, 1, 2, glow(255, 245, 245));
    setPx(img, 9, 7, glow(255, 230, 235));
    setPx(img, 8, 3, glow(255, 110, 140));
    setPx(img, 9, 2, glow(255, 80, 120));
    setPx(img, 7, 4, glow(255, 140, 160));
    for (const [x, y] of [
      [4, 5],
      [12, 4],
      [11, 9],
      [5, 2],
      [13, 7],
    ])
      setPx(img, x, y, glow(255, 210, 160)); // sparks
  } else {
    fillRect(img, 7, 6, 3, 2, rgba(200, 196, 184));
    setPx(img, 7, 7, rgba(140, 136, 128)); // striker cap
    outline(img, OUTLINE);
  }
  return img;
}

function buildHeli() {
  const W = 96,
    H = 48;
  const img = makeImage(W, H);
  const olive = rgba(86, 96, 58),
    oliveD = rgba(58, 64, 40);
  const glass = (x, y) => {
    const t = (x + y * 0.6) % 9;
    const c = mix(rgba(30, 48, 56), rgba(70, 100, 104), clamp01((y - 14) / 22));
    return t < 1.4 ? mix(c, rgba(150, 180, 180), 0.6) : c;
  };
  // tail boom (behind), tail fin and tail rotor
  fillPoly(
    img,
    [
      [62, 19],
      [90, 19],
      [90, 24],
      [62, 31],
    ],
    oliveD,
  );
  for (let x = 64; x < 90; x++) setPx(img, x, 19, tint(olive, 1.2));
  for (let x = 74; x < 78; x++)
    for (let y = 19; y < 27; y++) if (getPx(img, x, y) >>> 24) setPx(img, x, y, rgba(190, 160, 50)); // rescue band
  fillPoly(
    img,
    [
      [86, 22],
      [93, 22],
      [94, 8],
      [90, 7],
    ],
    olive,
  );
  for (let y = 8; y < 22; y++) setPx(img, 93, y, tint(olive, 1.25));
  drawLine(img, 90, 9, 95, 19, rgba(44, 44, 42), 1);
  drawLine(img, 95, 9, 89, 18, rgba(44, 44, 42), 1);
  fillRect(img, 91, 13, 2, 2, rgba(70, 70, 70));
  // engine cowling with intakes and exhaust
  fillPoly(
    img,
    [
      [30, 16],
      [34, 10],
      [62, 10],
      [66, 17],
    ],
    olive,
  );
  for (let x = 34; x < 62; x++) setPx(img, x, 10, tint(olive, 1.3));
  fillRect(img, 38, 12, 6, 3, rgba(26, 28, 24));
  fillRect(img, 50, 12, 6, 3, rgba(26, 28, 24));
  for (let x = 38; x < 44; x += 2) setPx(img, x, 13, rgba(60, 62, 56));
  fillEllipse(img, 60, 14, 2.4, 2, rgba(30, 26, 24));
  // rotor mast, hub and blades
  fillRect(img, 45, 5, 4, 6, rgba(64, 66, 62));
  fillRect(img, 43, 4, 8, 2, rgba(50, 52, 50));
  setPx(img, 46, 4, rgba(130, 132, 128));
  drawLine(img, 1, 6, 46, 4, rgba(36, 38, 36), 2);
  drawLine(img, 48, 4, 95, 5, rgba(36, 38, 36), 2);
  for (let x = 4; x < 92; x++)
    if (getPx(img, x, 4) >>> 24 && !(getPx(img, x, 3) >>> 24) && x % 3)
      setPx(img, x, 4, rgba(84, 86, 82));
  // main cabin (rounded)
  fillEllipse(img, 40, 28, 26, 12.5, olive);
  fillRect(img, 40, 16, 26, 22, olive);
  fillPoly(
    img,
    [
      [64, 16],
      [70, 20],
      [70, 34],
      [64, 38],
    ],
    olive,
  );
  for (let y = 14; y < 42; y++)
    for (let x = 13; x < 72; x++) {
      const c = getPx(img, x, y);
      if (c !== olive) continue;
      let f = 1.12 - 0.42 * ((y - 15) / 26) + 0.12 * valueNoise(x * 0.3, y * 0.3, 64, 871);
      if (x > 64) f *= 0.8;
      setPx(img, x, y, tint(olive, f));
    }
  // windshield (two panes) + chin windows
  fillPoly(
    img,
    [
      [16, 25],
      [26, 17],
      [40, 17],
      [40, 29],
      [17, 31],
    ],
    rgba(0, 0, 0, 255),
  );
  for (let y = 16; y < 32; y++)
    for (let x = 15; x < 41; x++)
      if (getPx(img, x, y) === rgba(0, 0, 0, 255)) setPx(img, x, y, glass(x, y));
  for (let y = 17; y < 30; y++) setPx(img, 29, y, oliveD);
  drawLine(img, 16, 25, 26, 17, oliveD);
  fillRect(img, 17, 30, 24, 1, oliveD);
  fillPoly(
    img,
    [
      [19, 33],
      [30, 33],
      [29, 37],
      [21, 37],
    ],
    rgba(0, 0, 0, 255),
  );
  for (let y = 32; y < 38; y++)
    for (let x = 18; x < 31; x++)
      if (getPx(img, x, y) === rgba(0, 0, 0, 255)) setPx(img, x, y, tint(glass(x, y), 0.8));
  // sliding door with windows
  for (let x = 42; x < 65; x++) {
    setPx(img, x, 17, oliveD);
    setPx(img, x, 37, oliveD);
  }
  for (let y = 17; y < 38; y++) {
    setPx(img, 42, y, oliveD);
    setPx(img, 64, y, oliveD);
  }
  for (const wx of [45, 55])
    for (let y = 19; y < 27; y++) for (let x = wx; x < wx + 7; x++) setPx(img, x, y, glass(x, y));
  fillRect(img, 46, 31, 3, 1, rgba(150, 150, 140)); // handle
  fillRect(img, 54, 31, 8, 2, rgba(190, 160, 50)); // rescue stripe
  for (let x = 44; x < 62; x += 3) setPx(img, x, 35, rgba(200, 200, 190)); // stencil
  // searchlight under the nose
  fillEllipse(img, 24, 39, 2.6, 1.8, rgba(40, 40, 40));
  // skids and struts (far one first)
  fillRect(img, 30, 42, 44, 2, rgba(50, 52, 46));
  for (const sx of [38, 64]) fillRect(img, sx, 38, 2, 5, rgba(44, 46, 40));
  fillRect(img, 14, 45, 52, 2, rgba(70, 74, 64));
  for (let x = 14; x < 66; x++) setPx(img, x, 45, rgba(110, 114, 104));
  fillRect(img, 12, 43, 3, 2, rgba(70, 74, 64));
  setPx(img, 11, 42, rgba(70, 74, 64));
  for (const sx of [24, 54]) {
    fillRect(img, sx, 38, 2, 7, rgba(60, 64, 54));
    setPx(img, sx + 1, 38, rgba(100, 104, 94));
  }
  vary(img, mulberry32(872), 0.06);
  // grime and panel lines
  for (const px of [34, 52]) for (let y = 11; y < 16; y++) setPx(img, px, y, oliveD);
  const rng = mulberry32(873);
  for (let k = 0; k < 40; k++) {
    const x = 14 + Math.floor(rng() * 56),
      y = 16 + Math.floor(rng() * 24);
    const c = getPx(img, x, y);
    if (c >>> 24 === 255) setPx(img, x, y, tint(c, 0.75));
  }
  outline(img, OUTLINE);
  // nav lights, beacons and the landing light
  lamp(img, 15, 32, glow(255, 200, 190), glow(255, 40, 30), glow(160, 20, 16), 2.4);
  lamp(img, 69, 31, glow(210, 255, 210), glow(50, 255, 80), glow(20, 160, 40), 2.4);
  lamp(img, 91, 8, glow(255, 220, 210), glow(255, 60, 40), glow(160, 30, 20), 2);
  lamp(img, 48, 10, glow(255, 255, 255), glow(220, 230, 255), glow(120, 130, 160), 1.8);
  setPx(img, 23, 39, glow(255, 250, 220));
  setPx(img, 24, 39, glow(255, 255, 240));
  setPx(img, 25, 39, glow(255, 240, 200));
  setPx(img, 24, 40, glow(220, 210, 170));
  return img;
}

function buildCrateStack() {
  const img = makeImage(32, 32);
  const crate = (x0, y0, w, h, tone, seed, brace) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        let c = woodPx(x, y, seed, tone);
        c = tint(c, 0.86 + 0.24 * ((x - x0) / w) - 0.16 * ((y - y0) / h));
        setPx(img, x, y, c);
      }
    for (let k = 1; k < 3; k++) {
      const y = y0 + Math.round((h * k) / 3);
      for (let x = x0; x < x0 + w; x++) setPx(img, x, y, tint(tone, 0.45));
    }
    // frame boards
    for (let x = x0; x < x0 + w; x++) {
      setPx(img, x, y0, tint(tone, 1.3));
      setPx(img, x, y0 + 1, tint(tone, 1.05));
      setPx(img, x, y0 + h - 2, tint(tone, 0.9));
      setPx(img, x, y0 + h - 1, tint(tone, 0.55));
    }
    for (let y = y0; y < y0 + h; y++) {
      setPx(img, x0, y, tint(tone, 0.6));
      setPx(img, x0 + 1, y, tint(tone, 0.85));
      setPx(img, x0 + w - 2, y, tint(tone, 1.0));
      setPx(img, x0 + w - 1, y, tint(tone, 1.15));
    }
    if (brace) drawLine(img, x0 + 2, y0 + h - 3, x0 + w - 3, y0 + 2, tint(tone, 0.95), 2);
    for (const [nx, ny] of [
      [x0 + 1, y0 + 1],
      [x0 + w - 2, y0 + 1],
      [x0 + 1, y0 + h - 2],
      [x0 + w - 2, y0 + h - 2],
    ])
      setPx(img, nx, ny, rgba(150, 150, 146));
  };
  crate(0, 18, 16, 14, rgba(112, 80, 48), 881, true);
  crate(16, 18, 16, 14, rgba(124, 92, 56), 882, false);
  // stencil arrows on the right crate
  // weathered shipping label on the right crate
  fillRect(img, 19, 23, 9, 5, rgba(176, 164, 132));
  for (let x = 19; x < 28; x++) setPx(img, x, 27, rgba(130, 120, 96));
  fillRect(img, 20, 24, 5, 1, rgba(60, 54, 44));
  fillRect(img, 20, 26, 7, 1, rgba(90, 82, 66));
  // top crate casts a shadow on the lower ones
  for (let x = 6; x < 26; x++)
    for (const y of [18, 19]) setPx(img, x, y, tint(getPx(img, x, y), 0.55));
  crate(7, 4, 18, 14, rgba(100, 74, 46), 883, true);
  for (let x = 9; x < 23; x++)
    for (const y of [8, 9])
      if (hash2(x, y, 884) < 0.85) setPx(img, x, y, mix(getPx(img, x, y), rgba(150, 40, 30), 0.7)); // red stencil band
  vary(img, mulberry32(885), 0.06);
  return outline(img, OUTLINE);
}

function buildProps() {
  return {
    radioPart: buildRadioPart(),
    keycard: buildKeycard(),
    radio: buildRadio(),
    breakerOff: buildBreaker(false),
    breakerOn: buildBreaker(true),
    generatorOff: buildGenerator(false),
    generatorOn: buildGenerator(true),
    trapOff: buildTrap(false),
    trapOn: buildTrap(true),
    flareOff: buildFlare(false),
    flareOn: buildFlare(true),
    heli: buildHeli(),
    crateStack: buildCrateStack(),
  };
}

//=============================================================
//                          EXPORTS
//=============================================================

export function buildSprites() {
  return {
    zombies: [0, 1, 2, 3].map(buildZombie),
    crate: buildCrate(),
    perks: { iron: buildPerk('iron'), quick: buildPerk('quick') },
    powerups: buildPowerups(),
    particles: buildParticles(),
    bolt: buildBolt(),
    brute: buildBrute(),
    props: buildProps(),
  };
}

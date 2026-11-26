// textures.js - Boarded Up wall, window, floor and ceiling textures
// Author: Reachnid Group
// Centennial College - Fall 2026

// Procedural 64x64 wall / window / floor textures.
import {
  rgba,
  unpack,
  tint,
  mix,
  makeImage,
  cloneImage,
  mulberry32,
  hash2,
  valueNoise,
  fbm,
  setPx,
  getPx,
  fillRect,
  fillPoly,
  drawLine,
} from './pixel.js';

export const TEX = 64;
const S = TEX;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const col = (c, f = 1) => rgba(c[0] * f, c[1] * f, c[2] * f);
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const wrap = (v) => ((v % S) + S) % S;
// wrapping pixel write (for seamless textures)
const setW = (img, x, y, c) => {
  img.data[wrap(Math.round(y)) * S + wrap(Math.round(x))] = c;
};
const getW = (img, x, y) => img.data[wrap(Math.round(y)) * S + wrap(Math.round(x))];

function paint(img, fn) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) img.data[y * img.w + x] = fn(x, y);
}

// darken every pixel of an image by a multiplicative factor field
function shadeAll(img, fn) {
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) {
      const i = y * img.w + x;
      const c = img.data[i];
      if (!(c >>> 24)) continue;
      img.data[i] = tint(c, fn(x, y));
    }
}

//=============================================================
//                          BRICKS
//=============================================================

// Bricks

function brickWall(seed, o = {}) {
  const base = o.base || [112, 52, 40];
  const alt = o.alt || [86, 44, 36];
  const mortar = o.mortar || [52, 48, 44];
  const bw = o.bw || 16,
    bh = o.bh || 8,
    off = o.off ?? 8;
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  paint(img, (x, y) => {
    const row = Math.floor(y / bh),
      yy = y % bh;
    const sx = wrap(x + (row & 1) * off);
    const colI = Math.floor(sx / bw),
      xx = sx % bw;
    const bid = hash2(colI, row, seed);
    const n = hash2(x, y, seed + 1) - 0.5;
    const grit = fbm(x, y, S, seed + 3, 3, 8);
    // mortar
    const chip =
      hash2(colI * 7 + xx, row * 3 + yy, seed + 9) < 0.07 &&
      (yy === 0 || yy === bh - 2 || xx === 0 || xx === bw - 2);
    if (yy === bh - 1 || xx === bw - 1 || chip) {
      const f = 0.75 + grit * 0.5 + n * 0.25;
      return col(mortar, f * (yy === bh - 1 && xx !== bw - 1 ? 0.95 : 0.85));
    }
    let c = lerp3(base, alt, bid);
    if (hash2(colI, row, seed + 5) < 0.12) c = lerp3(c, [60, 34, 28], 0.6); // burnt / dark brick
    if (hash2(colI, row, seed + 6) < 0.1) c = lerp3(c, [140, 80, 58], 0.4); // lighter brick
    let f = 0.86 + grit * 0.3 + n * 0.16;
    // brick-face mottling
    f *= 0.92 + 0.16 * valueNoise((x + colI * 13) / 3, (y + row * 7) / 2, 4096, seed + 11);
    // bevel: light top / right, dark bottom / left
    if (yy === 0) f *= 1.22;
    else if (yy === bh - 2) f *= 0.72;
    if (xx === bw - 2) f *= 1.1;
    else if (xx === 0) f *= 0.84;
    return col(c, f);
  });
  // grime: darker toward the bottom, plus vertical dirt streaks running down (tileable in x)
  shadeAll(img, (x, y) => {
    const t = y / (S - 1);
    const streak = valueNoise(x / 4, y / 22, 16, seed + 21); // period 16 cells * 4px = 64
    const blot = fbm(x, y, S, seed + 31, 4, 4);
    let f = 1 - 0.42 * t * t - 0.28 * Math.max(0, streak - 0.5) * (0.4 + t);
    f *= 0.86 + 0.28 * blot;
    return f;
  });
  // soot / moss specks near the bottom
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * S),
      y = Math.floor(S - 1 - Math.pow(rng(), 2) * 22);
    const c = getPx(img, x, y);
    setPx(img, x, y, o.moss && rng() < 0.5 ? mix(c, rgba(48, 66, 30), 0.6) : tint(c, 0.6));
  }
  return img;
}

function addBlood(img, seed) {
  const rng = mulberry32(seed);
  const blood = (k) => rgba(62 + k * 52, 5 + k * 9, 6 + k * 6);
  const cx = 30,
    cy = 22;
  // splat at the impact point
  for (let y = 8; y < 38; y++)
    for (let x = 14; x < 48; x++) {
      const d = Math.hypot((x - 24) / 8, (y - cy) / 7);
      const n = fbm(x, y, S, seed + 4, 4, 8);
      const v = 1 - d + (n - 0.5) * 1.3;
      if (v > 0)
        setPx(
          img,
          x,
          y,
          mix(
            getPx(img, x, y),
            blood(clamp(v * 1.2, 0, 1) * 0.7 + (hash2(x, y, seed) - 0.5) * 0.15),
            clamp(0.55 + v, 0.6, 0.92),
          ),
        );
    }
  // dragged smear trailing right and slightly down, made of horizontal streaks
  for (let y = 14; y < 40; y++)
    for (let x = 24; x < 58; x++) {
      const t = (x - 24) / 34;
      const yc = cy + t * 8,
        hw = 5.5 * (1 - t * 0.6);
      const dy = Math.abs(y - yc) / hw;
      const streak = valueNoise(x / 9, y / 0.9, 4096, seed + 8);
      const v = 1 - dy - t * 0.7 + (streak - 0.5) * 1.1;
      if (v > 0)
        setPx(
          img,
          x,
          y,
          mix(
            getPx(img, x, y),
            blood(clamp(0.15 + streak * 0.75, 0, 1)),
            clamp(0.55 + v * 1.6, 0.55, 0.92),
          ),
        );
    }
  // drips
  for (let i = 0; i < 9; i++) {
    let x = 16 + Math.floor(rng() * 26);
    const y0 = cy - 4 + Math.floor(rng() * 14);
    const len = 8 + Math.floor(rng() * 30);
    const w = rng() < 0.35 ? 2 : 1;
    for (let j = 0; j < len && y0 + j < S - 2; j++) {
      if (rng() < 0.06) x += rng() < 0.5 ? -1 : 1;
      const k = 0.5 - (j / len) * 0.35;
      for (let q = 0; q < w; q++) setPx(img, x + q, y0 + j, blood(k));
    }
    const ye = Math.min(S - 2, y0 + len);
    fillRect(img, x - (w === 2 ? 0 : 0), ye, w + 1, 2, blood(0.25));
    setPx(img, x, ye, rgba(150, 30, 30)); // wet glint
  }
  // spatter
  for (let i = 0; i < 60; i++) {
    const a = rng() * Math.PI * 2,
      r = 12 + rng() * 20;
    const x = cx + Math.cos(a) * r * 1.3,
      y = cy + Math.sin(a) * r * 0.8;
    if (x < 3 || x > 60) continue;
    setPx(img, x, y, blood(rng() * 0.5));
    if (rng() < 0.3) setPx(img, x + 1, y, blood(0.2));
  }
  // smeared hand print sliding down (four finger streaks + palm)
  for (let f = 0; f < 4; f++) {
    const x0 = 44 + f * 2.6,
      y0 = 36 + (f === 0 || f === 3 ? 2 : 0);
    drawLine(img, x0, y0, x0 + 1, y0 + 12, blood(0.3), 1.6);
  }
  fillPoly(
    img,
    [
      [43, 47],
      [54, 46],
      [54, 53],
      [45, 54],
    ],
    blood(0.25),
  );
}

//=============================================================
//                          CONCRETE
//=============================================================

// Concrete

function crack(img, rng, x, y, len, dark) {
  let a = rng() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    setPx(img, x, y, dark);
    if (rng() < 0.35) setPx(img, x + 1, y, tint(getPx(img, x + 1, y), 1.15)); // lit lip on the right
    a += (rng() - 0.5) * 0.9;
    x += Math.cos(a);
    y += Math.sin(a) * 0.9 + 0.35;
    if (rng() < 0.08 && len - i > 4) crack(img, rng, x, y, Math.floor((len - i) / 2), dark);
  }
}

function concreteWall(seed, o = {}) {
  const base = o.base || [96, 96, 92];
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  const bw = 32,
    bh = 16;
  paint(img, (x, y) => {
    const row = Math.floor(y / bh),
      yy = y % bh;
    const sx = wrap(x + (row & 1) * 16);
    const colI = Math.floor(sx / bw),
      xx = sx % bw;
    const n = hash2(x, y, seed) - 0.5;
    const g = fbm(x, y, S, seed + 2, 4, 8);
    if (yy === bh - 1 || xx === bw - 1) return col([62, 62, 60], 0.85 + g * 0.3 + n * 0.1);
    const bid = hash2(colI, row, seed + 4);
    let f = 0.84 + 0.14 * bid + g * 0.25 + n * 0.12;
    if (hash2(x, y, seed + 7) < 0.06) f *= 0.7; // pores
    if (yy === 0) f *= 1.16;
    else if (yy === bh - 2) f *= 0.8;
    if (xx === bw - 2) f *= 1.08;
    else if (xx === 0) f *= 0.88;
    return col(base, f);
  });
  // stains: brown water marks + general grime toward bottom
  shadeAll(img, (x, y) => {
    const t = y / (S - 1);
    const st = fbm(x, y, S, seed + 13, 4, 4);
    const streak = valueNoise(x / 4, y / 18, 16, seed + 17);
    return (1 - 0.3 * t * t) * (st > 0.58 ? 0.78 : 1) * (1 - 0.25 * Math.max(0, streak - 0.55));
  });
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const st = fbm(x, y, S, seed + 13, 4, 4);
      if (st > 0.56 && st < 0.6) setPx(img, x, y, mix(getPx(img, x, y), rgba(70, 58, 40), 0.45)); // stain rims
    }
  for (let i = 0; i < (o.cracks ?? 3); i++)
    crack(img, rng, 6 + rng() * 52, 4 + rng() * 40, 10 + rng() * 16, rgba(30, 30, 30));
  return img;
}

function concreteWall2(seed) {
  // poured concrete top with form-tie holes, painted institutional green lower half with peeling
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  paint(img, (x, y) => {
    const n = hash2(x, y, seed) - 0.5;
    const g = fbm(x, y, S, seed + 2, 4, 8);
    if (y < 34) {
      let f = 0.82 + g * 0.3 + n * 0.12;
      if (x % 32 === 31) f *= 0.65; // form panel seam
      if (y === 15) f *= 0.7;
      if (y === 16) f *= 1.1;
      return col([100, 98, 92], f);
    }
    if (y === 34 || y === 35) return col([34, 34, 32], 1 + n * 0.2);
    // painted lower half
    const peel = fbm(x, y, S, seed + 40, 4, 4);
    if (peel > 0.64) return col([92, 90, 84], 0.8 + g * 0.3 + n * 0.1);
    let f = 0.86 + g * 0.2 + n * 0.08;
    if (peel > 0.6) f *= 1.2; // lifted paint edge
    if (y >= 52 && y <= 54) return col([70, 52, 34], f); // stripe
    return col([58, 78, 66], f);
  });
  for (let ty = 7; ty < 34; ty += 16)
    for (let tx = 8; tx < 64; tx += 16) {
      // form-tie holes
      fillRect(img, tx, ty, 2, 2, rgba(34, 34, 32));
      setPx(img, tx + 1, ty + 2, rgba(120, 118, 110));
    }
  shadeAll(img, (x, y) => {
    const t = y / (S - 1);
    const streak = valueNoise(x / 4, y / 16, 16, seed + 17);
    return (1 - 0.3 * t * t) * (1 - 0.3 * Math.max(0, streak - 0.55));
  });
  for (let i = 0; i < 2; i++)
    crack(img, rng, 10 + rng() * 44, 2 + rng() * 20, 14 + rng() * 10, rgba(32, 32, 30));
  return img;
}

//=============================================================
//                            DOOR
//=============================================================

// Door: rusty roller shutter, hazard band, boards nailed across in an X

function woodPlankPx(u, v, half, tone, seed) {
  // u = along plank, v = across (-half..half)
  const gr = valueNoise(u / 9, v * 0.9 + seed * 3.1, 4096, seed);
  const fine = hash2(Math.round(u), Math.round(v * 2), seed) - 0.5;
  let f = 0.78 + gr * 0.4 + fine * 0.12;
  if (v < -half + 1)
    f *= 1.3; // lit top edge
  else if (v > half - 1) f *= 0.62; // shadowed bottom edge
  return col(tone, f);
}

function drawBoard(img, x0, y0, x1, y1, w, tone, seed) {
  const dx = x1 - x0,
    dy = y1 - y0,
    len = Math.hypot(dx, dy);
  const ux = dx / len,
    uy = dy / len,
    px = -uy,
    py = ux;
  const half = w / 2;
  const minX = Math.floor(Math.min(x0, x1) - w),
    maxX = Math.ceil(Math.max(x0, x1) + w);
  const minY = Math.floor(Math.min(y0, y1) - w),
    maxY = Math.ceil(Math.max(y0, y1) + w);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const rx = x + 0.5 - x0,
        ry = y + 0.5 - y0;
      const u = rx * ux + ry * uy,
        v = rx * px + ry * py;
      const vv = py >= 0 ? v : -v; // keep "top" edge on the upper side
      if (u < 0 || u > len || Math.abs(v) > half) {
        // drop shadow under the board
        if (u >= 0 && u <= len && vv > half && vv < half + 1.5)
          setPx(img, x, y, tint(getPx(img, x, y), 0.55));
        continue;
      }
      setPx(img, x, y, woodPlankPx(u, vv, half, tone, seed));
    }
  const nail = (t) => {
    const nx = x0 + ux * t,
      ny = y0 + uy * t;
    setPx(img, nx, ny, rgba(170, 168, 160));
    setPx(img, nx + 1, ny + 1, rgba(40, 34, 30));
    setPx(img, nx, ny + 1, rgba(90, 60, 40));
  };
  nail(3);
  nail(len - 4);
  return nail;
}

function doorTex(seed) {
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  paint(img, (x, y) => {
    const n = hash2(x, y, seed) - 0.5;
    // side guide rails
    if (x < 4 || x > 59) {
      let f = 0.8 + n * 0.15;
      if (x === 3 || x === 63) f *= 0.6;
      if (x === 0 || x === 60) f *= 1.3;
      const rust = fbm(x, y, S, seed + 5, 3, 8);
      return rust > 0.6 ? col([96, 52, 28], f) : col([62, 64, 66], f);
    }
    // header box
    if (y < 6) {
      let f = 0.85 + n * 0.12;
      if (y === 0) f *= 1.3;
      if (y === 5) f *= 0.5;
      if ((x === 8 || x === 55) && y === 2) return rgba(150, 150, 140);
      return col([58, 60, 62], f);
    }
    // bottom bar
    if (y >= 58) {
      let f = 0.8 + n * 0.12;
      if (y === 58) f *= 1.25;
      if (y === 63) f *= 0.5;
      if (x >= 28 && x <= 35 && y >= 59 && y <= 61) return col([30, 30, 30], 1); // handle slot
      return col([54, 56, 58], f);
    }
    // hazard band
    if (y >= 50 && y < 57) {
      const s = Math.floor((x + y) / 4) & 1;
      let f = 0.85 + n * 0.15;
      if (y === 50) f *= 1.2;
      if (y === 56) f *= 0.7;
      const wear = fbm(x, y, S, seed + 9, 3, 8);
      if (wear > 0.66) return col([96, 70, 44], f * 0.8);
      return s ? col([200, 160, 30], f) : col([26, 24, 22], f);
    }
    if (y === 57) return rgba(24, 22, 20);
    // corrugated slats (horizontal ribs, 4px)
    const sy = (y - 6) % 4;
    let f = [1.25, 1.0, 0.82, 0.5][sy] * (0.92 + n * 0.12);
    const rust = fbm(x, y, S, seed + 1, 4, 4);
    const streak = valueNoise(x / 3, y / 14, 4096, seed + 3);
    let c = [104, 110, 112];
    const r = rust + (streak - 0.5) * 0.5;
    if (r > 0.52) c = lerp3(c, [124, 62, 26], clamp((r - 0.52) * 4, 0, 1));
    if (r > 0.75) c = lerp3(c, [70, 36, 18], 0.6);
    return col(c, f);
  });
  // grime toward the bottom
  shadeAll(img, (x, y) => 1 - 0.25 * (y / 63) * (y / 63));
  // boards nailed in an X
  drawBoard(img, 3, 9, 60, 50, 8, [128, 92, 54], seed + 50);
  const nail2 = drawBoard(img, 60, 10, 3, 51, 8, [116, 82, 48], seed + 60);
  nail2(Math.hypot(57, 41) / 2); // centre nail
  // spray-painted warning dots / chalk arrow? keep minimal: a couple of bullet dents
  for (let i = 0; i < 5; i++) {
    const x = 8 + rng() * 48,
      y = 10 + rng() * 36;
    setPx(img, x, y, rgba(24, 24, 24));
    setPx(img, x + 1, y + 1, rgba(150, 150, 150));
  }
  return img;
}

//=============================================================
//             CHALK WEAPON OUTLINES ON CONCRETE
//=============================================================

// Chalk weapon outlines on concrete (wall-buy markers)

function chalkBuy(icon, seed) {
  const img = concreteWall(seed, { base: [92, 92, 88], cracks: 1 });
  const rng = mulberry32(seed + 99);
  // icon bbox
  let x0 = icon.w,
    x1 = -1,
    y0 = icon.h,
    y1 = -1;
  for (let y = 0; y < icon.h; y++)
    for (let x = 0; x < icon.w; x++)
      if (icon.data[y * icon.w + x] >>> 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const bw = x1 - x0 + 1,
    bh = y1 - y0 + 1;
  const sc = 52 / bw;
  const tw = Math.round(bw * sc),
    th = Math.round(bh * sc);
  const ox = Math.round(32 - tw / 2),
    oy = Math.round(29 - th / 2);
  const inside = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= tw || ty >= th) return false;
    const sx = x0 + Math.floor(tx / sc),
      sy = y0 + Math.floor(ty / sc);
    return icon.data[sy * icon.w + sx] >>> 24 !== 0;
  };
  const chalk = (k) => rgba(222 * k, 218 * k, 204 * k);
  for (let ty = -1; ty <= th; ty++)
    for (let tx = -1; tx <= tw; tx++) {
      if (!inside(tx, ty)) continue;
      const edge =
        !inside(tx - 1, ty) || !inside(tx + 1, ty) || !inside(tx, ty - 1) || !inside(tx, ty + 1);
      const X = ox + tx,
        Y = oy + ty;
      if (edge) {
        if (rng() < 0.16) continue; // dropout
        setPx(img, X, Y, chalk(0.82 + rng() * 0.2));
      } else if (rng() < 0.05) {
        setPx(img, X, Y, mix(getPx(img, X, Y), chalk(1), 0.35)); // faint dust smudge inside
      }
    }
  // dust specks around the drawing
  for (let i = 0; i < 40; i++) {
    const X = ox - 2 + rng() * (tw + 4),
      Y = oy - 2 + rng() * (th + 4);
    setPx(img, X, Y, mix(getPx(img, X, Y), chalk(1), 0.3));
  }
  // tally ticks + underline
  const ty = Math.min(56, oy + th + 6);
  for (let i = 0; i < 4; i++) {
    const X = 22 + i * 3;
    for (let j = 0; j < 5; j++)
      if (rng() > 0.15) setPx(img, X + (j > 2 ? 1 : 0), ty + j, chalk(0.9));
  }
  for (let j = 0; j < 13; j++)
    if (rng() > 0.2) setPx(img, 20 + j, ty + 4 - Math.floor(j / 3), chalk(0.85));
  for (let j = 0; j < 14; j++)
    if (rng() > 0.25) setPx(img, 36 + j, ty + 2 + (j > 6 ? 1 : 0), chalk(0.8));
  // little corner brackets
  const corner = (x, y, dx, dy) => {
    for (let j = 0; j < 4; j++) {
      if (rng() > 0.2) setPx(img, x + dx * j, y, chalk(0.8));
      if (rng() > 0.2) setPx(img, x, y + dy * j, chalk(0.8));
    }
  };
  corner(4, oy - 4, 1, 1);
  corner(59, oy - 4, -1, 1);
  return img;
}

//=============================================================
//                          WINDOWS
//=============================================================

// Windows (brick wall, wooden frame, transparent opening, 0..5 planks)

const OPEN = { x0: 10, x1: 53, y0: 12, y1: 50 }; // inclusive opening
const SLOT_ORDER = [2, 0, 4, 1, 3];

function makePlanks(seed) {
  const rng = mulberry32(seed);
  const planks = [];
  for (let i = 0; i < 5; i++) {
    const slot = SLOT_ORDER[i];
    const yc = OPEN.y0 + 3.2 + slot * 7.95;
    const sgn = i % 2 ? 1 : -1;
    planks.push({
      slot,
      yc,
      slope: sgn * (0.025 + rng() * 0.045),
      x0: 5 + Math.floor(rng() * 3),
      x1: 58 - Math.floor(rng() * 3),
      tone: [
        [120, 88, 56],
        [104, 78, 52],
        [132, 100, 64],
        [96, 76, 58],
        [114, 84, 50],
      ][i],
      seed: seed + i * 31,
      knot: 14 + rng() * 34,
      ragL: [rng(), rng(), rng(), rng(), rng(), rng()],
      ragR: [rng(), rng(), rng(), rng(), rng(), rng()],
      extraNail: rng() < 0.5,
      stubSide: Math.floor(rng() * 3), // 0 left, 1 right, 2 both
    });
  }
  return planks;
}

function drawPlank(img, p, owner) {
  const half = 2.9;
  for (let y = Math.floor(p.yc - 6); y <= Math.ceil(p.yc + 6); y++) {
    for (let x = p.x0 - 1; x <= p.x1 + 1; x++) {
      const v = y + 0.5 - (p.yc + p.slope * (x - 32));
      const rowI = clamp(Math.floor(v + half), 0, 5);
      const xl = p.x0 + (p.ragL[rowI] < 0.4 ? 1 : 0),
        xr = p.x1 - (p.ragR[rowI] < 0.4 ? 1 : 0);
      if (x < xl || x > xr) continue;
      if (v >= -half && v < half) {
        let c = woodPlankPx(x, v, half, p.tone, p.seed);
        const kd = Math.hypot((x - p.knot) / 2, v / 1.2);
        if (kd < 1) c = tint(c, 0.55);
        else if (kd < 1.6) c = tint(c, 0.8);
        setPx(img, x, y, c);
        owner[y * S + x] = 1;
      } else if (v >= half && v < half + 1.2 && !owner[y * S + x]) {
        const c = getPx(img, x, y);
        if (c >>> 24) setPx(img, x, y, tint(c, 0.5)); // shadow cast on the frame/wall
      }
    }
  }
  const nail = (x, dv) => {
    const y = Math.floor(p.yc + p.slope * (x - 32) + dv);
    setPx(img, x, y, rgba(176, 176, 168));
    setPx(img, x + 1, y, rgba(60, 56, 50));
    setPx(img, x, y + 1, rgba(64, 44, 30));
  };
  nail(p.x0 + 2, -0.5);
  nail(p.x1 - 3, -0.5);
  if (p.extraNail) {
    nail(p.x0 + 3, 1.2);
    nail(p.x1 - 2, 1.2);
  }
}

function drawStub(img, p) {
  // broken splinter left on the frame where a plank was torn away
  const side = (s) => {
    const yc = p.yc + p.slope * ((s ? OPEN.x1 : OPEN.x0) - 32);
    const xe = s ? OPEN.x1 + 1 : OPEN.x0 - 1; // frame edge
    const dir = s ? -1 : 1;
    const len = [3, 5, 2, 4, 6, 3][Math.floor(p.ragL[2] * 6)];
    for (let v = -2; v <= 2; v++) {
      const l = Math.max(
        0,
        len - Math.abs(v) * (1 + Math.floor(p.ragR[v + 2] * 2)) + (v === 0 ? 1 : 0),
      );
      for (let k = 0; k <= l; k++) {
        const x = xe + dir * k,
          y = Math.round(yc + v);
        setPx(img, x, y, woodPlankPx(k + 5, v * 1.1, 2.9, p.tone, p.seed));
      }
    }
    setPx(img, xe - dir * 1, Math.round(yc), rgba(176, 176, 168)); // nail still in the frame
  };
  if (p.stubSide !== 1) side(0);
  if (p.stubSide !== 0) side(1);
}

function windowBase(brick) {
  const img = cloneImage(brick);
  const wood = [66, 44, 28];
  const F = { x0: OPEN.x0 - 3, x1: OPEN.x1 + 3, y0: OPEN.y0 - 3, y1: OPEN.y1 };
  // shadow of the frame on the brick
  for (let y = F.y0 - 1; y <= F.y1 + 1; y++)
    for (let x = F.x0 - 1; x <= F.x1 + 1; x++) setPx(img, x, y, tint(getPx(img, x, y), 0.55));
  // frame
  for (let y = F.y0; y <= F.y1; y++)
    for (let x = F.x0; x <= F.x1; x++) {
      const n = hash2(x, y, 77) - 0.5;
      const gr = valueNoise(x / 2, y / 8, 4096, 5);
      const vertical = x < OPEN.x0 || x > OPEN.x1;
      const g2 = vertical ? gr : valueNoise(x / 8, y / 2, 4096, 6);
      let f = 0.75 + g2 * 0.35 + n * 0.1;
      if (y === F.y0 || x === F.x1) f *= 1.3; // lit outer edges (top/right)
      if (x === F.x0) f *= 0.75;
      if (y === OPEN.y0 - 1 || x === OPEN.x0 - 1) f *= 0.55; // inner reveal in shadow
      if (x === OPEN.x1 + 1) f *= 1.15;
      setPx(img, x, y, col(wood, f));
    }
  // sill
  for (let y = OPEN.y1 + 1; y <= OPEN.y1 + 5; y++)
    for (let x = F.x0 - 2; x <= F.x1 + 2; x++) {
      const n = hash2(x, y, 78) - 0.5;
      const gr = valueNoise(x / 8, y / 1.5, 4096, 8);
      let f = 0.8 + gr * 0.35 + n * 0.1;
      if (y === OPEN.y1 + 1) f *= 1.45;
      if (y === OPEN.y1 + 5) f *= 0.5;
      setPx(img, x, y, col([92, 64, 40], f));
    }
  for (let x = F.x0 - 2; x <= F.x1 + 2; x++)
    setPx(img, x, OPEN.y1 + 6, tint(getPx(img, x, OPEN.y1 + 6), 0.45));
  // the opening itself is transparent
  for (let y = OPEN.y0; y <= OPEN.y1; y++)
    for (let x = OPEN.x0; x <= OPEN.x1; x++) img.data[y * S + x] = 0;
  return img;
}

function buildWindows(brick) {
  const base = windowBase(brick);
  const planks = makePlanks(4242);
  const out = [];
  for (let n = 0; n <= 5; n++) {
    const img = cloneImage(base);
    for (let i = n; i < 5; i++) drawStub(img, planks[i]);
    // draw present planks from top slot to bottom so lower ones overlap shadows correctly
    const present = planks.slice(0, n).sort((a, b) => a.slot - b.slot);
    const owner = new Uint8Array(S * S);
    for (const p of present) drawPlank(img, p, owner);
    out.push(img);
  }
  return out;
}

//=============================================================
//                  FLOOR / CEILING / DIRT
//=============================================================

// Floor / ceiling / dirt (seamless)

function torusDist(x, y, cx, cy) {
  let dx = Math.abs(x - cx),
    dy = Math.abs(y - cy);
  if (dx > S / 2) dx = S - dx;
  if (dy > S / 2) dy = S - dy;
  return [dx, dy];
}

function floorTex(seed) {
  const img = makeImage(S, S);
  const A = [58, 60, 56],
    B = [92, 86, 74],
    grout = [28, 28, 26];
  paint(img, (x, y) => {
    const tx = x >> 4,
      ty = y >> 4,
      lx = x & 15,
      ly = y & 15;
    const n = hash2(x, y, seed) - 0.5;
    const g = fbm(x, y, S, seed + 1, 4, 4);
    if (lx === 0 || ly === 0) return col(grout, 0.8 + g * 0.4 + n * 0.2);
    const base = (tx + ty) & 1 ? A : B;
    let f = 0.84 + hash2(tx, ty, seed + 2) * 0.12 + n * 0.1;
    if (ly === 1) f *= 1.14;
    if (lx === 15) f *= 1.06;
    if (ly === 15) f *= 0.84;
    if (lx === 1) f *= 0.9;
    return col(base, f);
  });
  // dirt / grime
  shadeAll(img, (x, y) => {
    const g = fbm(x, y, S, seed + 5, 4, 4);
    return 0.62 + g * 0.55;
  });
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const st = fbm(x, y, S, seed + 9, 4, 8);
      if (st > 0.62) setPx(img, x, y, mix(getPx(img, x, y), rgba(50, 42, 30), 0.45));
    }
  // cracked tile
  const rng = mulberry32(seed + 3);
  let cx = 37,
    cy = 20;
  for (let i = 0; i < 12; i++) {
    setW(img, cx, cy, rgba(24, 24, 22));
    cx += rng() < 0.6 ? 1 : 0;
    cy += rng() < 0.7 ? 1 : 0;
  }
  // dried blood stain (seamless via torus distance)
  const bx = 14,
    by = 44;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const [dx, dy] = torusDist(x, y, bx, by);
      const d = Math.hypot(dx / 10, dy / 7);
      const v = 1 - d + (fbm(x, y, S, seed + 21, 4, 8) - 0.5) * 1.4;
      if (v > 0) {
        const k = clamp(v * 2, 0, 1);
        setPx(img, x, y, mix(getPx(img, x, y), rgba(46 + 22 * (1 - k), 14, 10), 0.45 + 0.35 * k));
      }
    }
  for (let i = 0; i < 18; i++) {
    // droplets
    const a = rng() * Math.PI * 2,
      r = 9 + rng() * 9;
    setW(img, bx + Math.cos(a) * r * 1.4, by + Math.sin(a) * r, rgba(58, 16, 12));
  }
  return img;
}

function ceilingTex(seed) {
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  paint(img, (x, y) => {
    const lx = x & 31,
      ly = y & 31;
    const n = hash2(x, y, seed) - 0.5;
    // T-bar grid (2px: lit + dark)
    if (lx === 0 || ly === 0) return col([96, 96, 92], 1 + n * 0.1);
    if (lx === 1 || ly === 1) return col([44, 44, 42], 1 + n * 0.1);
    const tile = hash2(x >> 5, y >> 5, seed + 1);
    let f = 0.82 + tile * 0.12 + n * 0.08;
    if (hash2(x, y, seed + 3) < 0.13) f *= 0.72; // perforations / fissures
    if (lx === 2 || ly === 2) f *= 0.82;
    let c = [80, 78, 72];
    if (x >> 5 === 1 && y >> 5 === 0) c = [60, 58, 54]; // one sagging darker tile
    return col(c, f);
  });
  // water stains with darker rims
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if ((x & 31) < 2 || (y & 31) < 2) continue;
      const st = fbm(x, y, S, seed + 7, 4, 4);
      if (st > 0.6) {
        const rim = st < 0.63 || (st > 0.7 && st < 0.72);
        setPx(
          img,
          x,
          y,
          mix(getPx(img, x, y), rim ? rgba(64, 46, 26) : rgba(96, 78, 52), rim ? 0.6 : 0.35),
        );
      }
    }
  shadeAll(img, (x, y) => 0.75 + fbm(x, y, S, seed + 11, 3, 4) * 0.35);
  for (let i = 0; i < 8; i++) setW(img, rng() * 64, rng() * 64, rgba(30, 28, 24)); // dead bugs / holes
  return img;
}

function dirtTex(seed) {
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  paint(img, (x, y) => {
    const g = fbm(x, y, S, seed, 5, 4);
    const g2 = fbm(x, y, S, seed + 7, 3, 8);
    const n = hash2(x, y, seed) - 0.5;
    let c = lerp3([40, 30, 22], [70, 54, 38], g);
    if (g2 > 0.62) c = lerp3(c, [30, 24, 20], 0.6); // wet mud
    return col(c, 0.85 + n * 0.3);
  });
  // pebbles
  for (let i = 0; i < 16; i++) {
    const x = rng() * 64,
      y = rng() * 64,
      k = 0.8 + rng() * 0.5;
    setW(img, x, y, col([96, 90, 80], k));
    setW(img, x + 1, y, col([80, 74, 66], k));
    setW(img, x, y + 1, col([30, 26, 22], 1));
    setW(img, x + 1, y + 1, col([30, 26, 22], 1));
  }
  // grass specks / tufts
  for (let i = 0; i < 55; i++) {
    const x = rng() * 64,
      y = rng() * 64;
    const g = rng() < 0.3 ? [86, 96, 44] : [44, 74, 30];
    const k = 0.7 + rng() * 0.5;
    setW(img, x, y, col(g, k));
    if (rng() < 0.6) setW(img, x, y - 1, col(g, k * 1.2));
    if (rng() < 0.4) setW(img, x + 1, y - 1, col(g, k));
    if (rng() < 0.3) setW(img, x - 1, y, col(g, k * 0.8));
  }
  return img;
}

//=============================================================
//                      INDUSTRIAL SET
//=============================================================

// Industrial set (power station / campaign): steel plate, pipes, hazard wall,
// lab tiles, security + blast doors, steel window frames, concrete floor,
// floor grating and a metal ceiling.

// Value noise with separate cell sizes per axis that wraps every S pixels on
// both axes (cw and ch must divide 64).
function tnoise(x, y, cw, ch, seed) {
  const px = S / cw,
    py = S / ch;
  const u = x / cw,
    v = y / ch;
  const x0 = Math.floor(u),
    y0 = Math.floor(v);
  const fx = u - x0,
    fy = v - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const wx = (a) => ((a % px) + px) % px,
    wy = (a) => ((a % py) + py) % py;
  const a = hash2(wx(x0), wy(y0), seed),
    b = hash2(wx(x0 + 1), wy(y0), seed);
  const c = hash2(wx(x0), wy(y0 + 1), seed),
    d = hash2(wx(x0 + 1), wy(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const RUST = [120, 62, 30];

function rivetW(img, x, y) {
  setW(img, x, y, rgba(176, 180, 186));
  setW(img, x + 1, y, rgba(128, 132, 138));
  setW(img, x, y + 1, rgba(96, 100, 106));
  setW(img, x + 1, y + 1, rgba(36, 38, 42));
  setW(img, x + 1, y + 2, tint(getW(img, x + 1, y + 2), 0.6));
}

function rustStreak(img, x, y0, len, seed, k = 0.55) {
  for (let j = 0; j < len; j++) {
    const a = k * (1 - j / len) * (0.6 + 0.4 * hash2(x, y0 + j, seed));
    setW(img, x, y0 + j, mix(getW(img, x, y0 + j), col(RUST), a));
    if (j < len * 0.5 && hash2(x + 1, y0 + j, seed) < 0.5)
      setW(img, x + 1, y0 + j, mix(getW(img, x + 1, y0 + j), col(RUST), a * 0.6));
  }
}

function steelWall(seed, o = {}) {
  const base = o.base || [80, 90, 104];
  const corr = o.corrosion ?? 0.66;
  const pw = 32,
    ph = 32;
  const img = makeImage(S, S);
  paint(img, (x, y) => {
    const lx = x % pw,
      ly = y % ph;
    const pid = hash2(Math.floor(x / pw), Math.floor(y / ph), seed);
    const n = hash2(x, y, seed + 1) - 0.5;
    const g = fbm(x, y, S, seed + 2, 4, 8);
    const brush = tnoise(x, y, 16, 1, seed + 3);
    if (lx === pw - 1 || ly === ph - 1) return col(base, 0.34 + n * 0.1); // plate seam
    let f = (0.82 + 0.1 * pid + g * 0.22 + n * 0.06) * (0.95 + 0.08 * brush);
    if (ly === 0) f *= 1.25;
    else if (ly === ph - 2) f *= 0.78;
    if (lx === pw - 2) f *= 1.12;
    else if (lx === 0) f *= 0.85;
    let c = base;
    const r = fbm(x, y, S, seed + 5, 4, 4);
    if (r > corr) c = lerp3(c, RUST, clamp((r - corr) * 5, 0, 0.85));
    return col(c, f);
  });
  // bolt rows along the top and bottom of each plate, some weeping rust
  for (let py = 0; py < S; py += ph)
    for (let px = 0; px < S; px += pw) {
      for (let bx = 3; bx < pw - 3; bx += 6)
        for (const by of [2, ph - 6]) {
          rivetW(img, px + bx, py + by);
          if (hash2(px + bx, py + by, seed + 7) < 0.4)
            rustStreak(
              img,
              px + bx,
              py + by + 2,
              4 + Math.floor(hash2(bx, by + py, seed + 8) * 10),
              seed + 9,
            );
        }
    }
  shadeAll(img, (x, y) => {
    const t = y / (S - 1);
    const st = tnoise(x, y, 4, 16, seed + 21);
    return (1 - 0.25 * t * t) * (1 - 0.3 * Math.max(0, st - 0.55));
  });
  return img;
}

function steelWall2(seed) {
  const img = steelWall(seed, { base: [62, 68, 76], corrosion: 0.5 });
  // horizontal ribbed (corrugated) band
  for (let y = 24; y < 40; y++)
    for (let x = 0; x < S; x++) {
      const n = hash2(x, y, seed + 30) - 0.5;
      let f;
      if (y === 24 || y === 39) f = 0.32;
      else if (y === 25) f = 1.3;
      else if (y === 38) f = 0.55;
      else f = [1.25, 1.0, 0.72, 0.48][(y - 26) % 4];
      let c = [72, 76, 82];
      const r = fbm(x, y, S, seed + 31, 4, 8) + (tnoise(x, y, 4, 16, seed + 32) - 0.5) * 0.3;
      if (r > 0.55) c = lerp3(c, RUST, clamp((r - 0.55) * 4, 0, 0.8));
      setPx(img, x, y, col(c, f * (0.92 + n * 0.12)));
    }
  for (let x = 2; x < S; x += 8) rivetW(img, x, 25);
  // corrosion bleeding down from the band
  for (let x = 0; x < S; x++)
    if (hash2(x, 0, seed + 33) < 0.3)
      rustStreak(img, x, 40, 3 + Math.floor(hash2(x, 1, seed + 33) * 14), seed + 34, 0.5);
  return img;
}

// Cylinder shading across a pipe: t = -1 (top / lit side) .. 1.
function cylShade(t) {
  const z = Math.sqrt(Math.max(0, 1 - t * t));
  let f = 0.3 + 0.8 * z * (0.75 - 0.35 * t);
  if (Math.abs(t + 0.45) < 0.14) f += 0.3;
  return f;
}

function pipeH(img, yc, r, base, seed) {
  for (let y = Math.floor(yc - r); y <= Math.ceil(yc + r); y++)
    for (let x = 0; x < S; x++) {
      const t = (y + 0.5 - yc) / r;
      if (Math.abs(t) > 1) continue;
      let c = base;
      const rr = fbm(x, y, S, seed, 4, 8);
      if (rr > 0.6) c = lerp3(c, RUST, clamp((rr - 0.6) * 4, 0, 0.8));
      setW(img, x, y, col(c, cylShade(t) * (0.93 + (hash2(x, y, seed + 1) - 0.5) * 0.1)));
    }
  for (let x = 0; x < S; x++)
    setW(img, x, Math.round(yc + r) + 1, tint(getW(img, x, Math.round(yc + r) + 1), 0.45)); // cast shadow
}

function pipeV(img, xc, r, base, seed) {
  for (let y = 0; y < S; y++)
    for (let x = Math.floor(xc - r); x <= Math.ceil(xc + r); x++) {
      const t = (x + 0.5 - xc) / r;
      if (Math.abs(t) > 1) continue;
      let c = base;
      const rr = fbm(x, y, S, seed, 4, 8);
      if (rr > 0.6) c = lerp3(c, RUST, clamp((rr - 0.6) * 4, 0, 0.8));
      setW(img, x, y, col(c, cylShade(-t) * (0.93 + (hash2(x, y, seed + 1) - 0.5) * 0.1)));
    }
  for (let y = 0; y < S; y++)
    setW(img, Math.floor(xc - r) - 1, y, tint(getW(img, Math.floor(xc - r) - 1, y), 0.5));
}

function pipesWall(seed) {
  const img = steelWall(seed, { base: [52, 56, 62], corrosion: 0.6 });
  // small yellow gas line (behind the vertical pipe)
  pipeH(img, 51, 3, [160, 128, 40], seed + 2);
  // big steel main
  pipeH(img, 16, 7, [100, 108, 112], seed + 1);
  // flange on the main
  for (let y = 8; y <= 24; y++)
    for (let x = 6; x <= 10; x++) {
      const t = (y + 0.5 - 16) / 8.5;
      let f = cylShade(t) * 0.9;
      if (x === 6) f *= 0.7;
      if (x === 10) f *= 1.15;
      setW(img, x, y, col([96, 100, 104], f));
    }
  for (const by of [9, 15, 21]) rivetW(img, 7, by);
  rustStreak(img, 8, 25, 18, seed + 5, 0.6);
  // clamp band on the main + wall bracket
  for (let y = 8; y <= 24; y++)
    for (let x = 34; x <= 35; x++)
      setW(img, x, y, col([46, 48, 52], cylShade((y + 0.5 - 16) / 8) * (x === 35 ? 1.2 : 0.9)));
  for (let y = 25; y < 29; y++) {
    setW(img, 34, y, rgba(44, 46, 50));
    setW(img, 35, y, rgba(70, 72, 76));
  }
  // pressure gauge on a riser from the main
  for (let y = 24; y < 31; y++) {
    setW(img, 21, y, col([110, 112, 116], 0.7));
    setW(img, 22, y, col([110, 112, 116], 1.2));
  }
  const gx = 22,
    gy = 36;
  for (let y = gy - 6; y <= gy + 6; y++)
    for (let x = gx - 6; x <= gx + 6; x++) {
      const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy);
      if (d > 5.6) continue;
      if (d > 4.3)
        setW(img, x, y, col([150, 120, 60], 0.8 + 0.4 * (x - gx - (y - gy) > 0 ? 1 : 0)));
      else setW(img, x, y, col([212, 208, 192], 0.9 + 0.1 * hash2(x, y, seed)));
    }
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.75 + k * 0.25);
    setW(img, gx - 0.5 + Math.cos(a) * 3.4, gy - 0.5 + Math.sin(a) * 3.4, rgba(40, 38, 34));
  }
  for (let s = 0; s <= 3.2; s += 0.5)
    setW(img, gx - 0.5 + Math.cos(-0.6) * s, gy - 0.5 + Math.sin(-0.6) * s, rgba(180, 26, 20));
  setW(img, gx - 1, gy - 1, rgba(30, 30, 30));
  setW(img, gx - 3, gy - 3, rgba(250, 250, 246));
  // vertical red pipe with flange, valve body and handwheel
  pipeV(img, 49, 4.5, [124, 40, 34], seed + 3);
  for (let y = 41; y <= 44; y++)
    for (let x = 43; x <= 55; x++)
      setW(
        img,
        x,
        y,
        col(
          [110, 36, 30],
          (y === 41 ? 1.3 : y === 44 ? 0.55 : 0.95) * (0.8 + 0.3 * ((x - 43) / 12)),
        ),
      );
  rivetW(img, 44, 42);
  rivetW(img, 53, 42);
  const wx = 49,
    wy = 29;
  for (let y = wy - 7; y <= wy + 7; y++)
    for (let x = wx - 7; x <= wx + 7; x++) {
      const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy);
      if (d > 6.2) continue;
      const lit = x - wx - (y - wy) > 0 ? 1.2 : 0.85;
      if (d > 4.8) setW(img, x, y, col([196, 40, 30], lit * (d > 5.8 ? 0.7 : 1)));
      else if (d < 1.6) setW(img, x, y, col([70, 70, 74], d < 0.8 ? 1.4 : 1));
      else if (
        Math.abs(x + 0.5 - wx - (y + 0.5 - wy)) < 0.8 ||
        Math.abs(x + 0.5 - wx + (y + 0.5 - wy)) < 0.8
      )
        setW(img, x, y, col([170, 34, 26], lit));
      else if (d < 6.8) setW(img, x, y, tint(getW(img, x, y), 0.75)); // shadow behind the spokes
    }
  shadeAll(img, (x, y) => 0.92 + 0.12 * fbm(x, y, S, seed + 9, 3, 4));
  return img;
}

function hazardWall(seed) {
  const img = concreteWall(seed, { base: [90, 90, 86], cracks: 2 });
  // faded stencil: warning triangle with a lightning bolt
  const m = makeImage(S, S);
  fillPoly(
    m,
    [
      [32, 4],
      [50, 34],
      [14, 34],
    ],
    1,
  );
  fillPoly(
    m,
    [
      [32, 9.5],
      [45.4, 31.5],
      [18.6, 31.5],
    ],
    2,
  );
  fillPoly(
    m,
    [
      [34.5, 12],
      [26, 24],
      [31, 24],
      [28, 31],
      [38.5, 18.5],
      [33.5, 18.5],
      [37, 12],
    ],
    1,
  );
  // stencil "lettering" blocks under the sign (shapes only)
  let x = 11;
  for (const len of [6, 4, 7]) {
    for (let l = 0; l < len && x < 54; l++, x += 4)
      for (let yy = 37; yy < 41; yy++)
        for (let xx = x; xx < x + 3; xx++)
          if (hash2(xx, yy, seed + l) < 0.72) m.data[yy * S + xx] = 3;
    x += 3;
  }
  for (let y = 0; y < S; y++)
    for (let xx = 0; xx < S; xx++) {
      const v = m.data[y * S + xx];
      if (!v) continue;
      const wear = fbm(xx, y, S, seed + 40, 4, 8);
      let a = v === 3 ? 0.55 : 0.82;
      if (wear > 0.6) a *= 0.3;
      setPx(img, xx, y, mix(getPx(img, xx, y), v === 2 ? rgba(200, 160, 36) : rgba(24, 22, 20), a));
    }
  // yellow/black hazard band
  for (let y = 43; y <= 54; y++)
    for (let xx = 0; xx < S; xx++) {
      const n = hash2(xx, y, seed + 50) - 0.5;
      if (y === 43 || y === 54) {
        setPx(img, xx, y, col([40, 40, 42], 1 + n * 0.2));
        continue;
      }
      let f = 0.86 + n * 0.14;
      if (y === 44) f *= 1.2;
      if (y === 53) f *= 0.7;
      const s = ((xx + y) & 15) < 8;
      const wear = fbm(xx, y, S, seed + 51, 3, 8);
      if (wear > 0.66) {
        setPx(img, xx, y, mix(getPx(img, xx, y), rgba(70, 60, 40), 0.5));
        continue;
      }
      setPx(img, xx, y, s ? col([206, 164, 32], f) : col([28, 26, 24], f));
    }
  shadeAll(img, (xx, y) => 1 - 0.2 * Math.max(0, tnoise(xx, y, 4, 16, seed + 60) - 0.5));
  return img;
}

function tileWall(seed) {
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  const missing = new Set(['2,1', '6,4', '3,6', '4,6']);
  paint(img, (x, y) => {
    const tx = x >> 3,
      ty = y >> 3,
      lx = x & 7,
      ly = y & 7;
    const n = hash2(x, y, seed) - 0.5;
    const g = fbm(x, y, S, seed + 1, 4, 4);
    if (missing.has(tx + ',' + ty)) {
      // exposed adhesive bed with trowel ridges
      let f = 0.72 + g * 0.3 + n * 0.15;
      if ((x + y) % 3 === 0) f *= 0.72;
      if (lx === 0 || ly === 0) f *= 0.5;
      if (lx === 7 || ly === 7) f *= 1.1;
      return col([86, 82, 72], f);
    }
    if (lx === 7 || ly === 7) return col([74, 72, 64], 0.8 + g * 0.3 + n * 0.2); // grout
    const tone = hash2(tx, ty, seed + 2);
    let f = 0.88 + tone * 0.1 + n * 0.05;
    if (ly === 0 || lx === 0) f *= 1.07;
    if (lx === 6 || ly === 6) f *= 0.86;
    return col(lerp3([200, 204, 198], [180, 190, 186], tone), f);
  });
  shadeAll(img, (x, y) => {
    const t = y / (S - 1);
    const st = tnoise(x, y, 4, 16, seed + 5);
    return (
      (0.95 - 0.35 * t * t) *
      (0.82 + 0.26 * fbm(x, y, S, seed + 6, 4, 4)) *
      (1 - 0.3 * Math.max(0, st - 0.5))
    );
  });
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const st = fbm(x, y, S, seed + 7, 4, 4);
      if (st > 0.58)
        setPx(img, x, y, mix(getPx(img, x, y), rgba(118, 98, 58), clamp((st - 0.58) * 3, 0, 0.45)));
    }
  // cracked tiles
  for (const [tx, ty] of [
    [5, 2],
    [1, 4],
    [6, 6],
    [0, 1],
  ]) {
    let cx = tx * 8 + 1 + Math.floor(rng() * 5),
      cy = ty * 8;
    for (let i = 0; i < 8; i++) {
      setPx(img, cx, cy, rgba(58, 56, 50));
      if (rng() < 0.4) setPx(img, cx + 1, cy, tint(getPx(img, cx + 1, cy), 1.1));
      cy++;
      if (rng() < 0.5) cx += rng() < 0.5 ? -1 : 1;
      cx = clamp(cx, tx * 8, tx * 8 + 6);
    }
  }
  // blood spatter with drips (wrapping)
  const blood = (k) => rgba(70 + k * 60, 6 + k * 10, 8 + k * 6);
  const bx = 40,
    by = 22;
  for (let y = by - 12; y < by + 12; y++)
    for (let x = bx - 14; x < bx + 14; x++) {
      const d = Math.hypot((x - bx) / 7, (y - by) / 5.5);
      const v = 1 - d + (fbm(wrap(x), wrap(y), S, seed + 20, 4, 8) - 0.5) * 1.4;
      if (v > 0)
        setW(
          img,
          x,
          y,
          mix(getW(img, x, y), blood(clamp(v, 0, 1) * 0.6), clamp(0.6 + v, 0.6, 0.9)),
        );
    }
  for (let i = 0; i < 7; i++) {
    const x = bx - 6 + Math.floor(rng() * 12);
    const y0 = by + Math.floor(rng() * 4);
    const len = 6 + Math.floor(rng() * 22);
    for (let j = 0; j < len; j++) setW(img, x, y0 + j, blood(0.45 - (j / len) * 0.3));
    setW(img, x, y0 + len, blood(0.2));
    setW(img, x + 1, y0 + len, blood(0.2));
  }
  for (let i = 0; i < 45; i++) {
    const a = rng() * Math.PI * 2,
      r = 8 + rng() * 16;
    setW(img, bx + Math.cos(a) * r * 1.3, by + Math.sin(a) * r * 0.8, blood(rng() * 0.5));
  }
  return img;
}

// "Glowing" light on a lit wall: saturated core + coloured bleed onto neighbours.
function wallLamp(img, x, y, w, h, core, hot, bleed, r = 3) {
  for (let yy = y - r; yy < y + h + r; yy++)
    for (let xx = x - r; xx < x + w + r; xx++) {
      const dx = Math.max(x - xx, 0, xx - (x + w - 1)),
        dy = Math.max(y - yy, 0, yy - (y + h - 1));
      const d = Math.hypot(dx, dy) / r;
      if (d >= 1 || d === 0) continue;
      setPx(img, xx, yy, mix(getPx(img, xx, yy), bleed, (1 - d) * 0.6));
    }
  fillRect(img, x, y, w, h, core);
  setPx(img, x + Math.floor(w / 2), y + Math.floor(h / 2) - (h > 1 ? 1 : 0), hot);
}

function doorFrame(img, seed, stripes) {
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!(x < 5 || x > 58 || y < 5)) continue;
      const n = hash2(x, y, seed) - 0.5;
      const g = fbm(x, y, S, seed + 1, 3, 8);
      let f = 0.82 + g * 0.25 + n * 0.1;
      if (x === 0 || x === 59 || y === 0) f *= 1.3;
      if (x === 4 || x === 63 || (y === 4 && x > 3 && x < 60)) f *= 0.5;
      let c = [62, 64, 68];
      if (stripes && f > 0.5 && !(x === 4 || x === 59 || y === 4 || y === 0 || x === 0 || x === 63))
        c = ((x + y) & 7) < 4 ? [200, 160, 32] : [30, 28, 26];
      setPx(img, x, y, col(c, f));
    }
}

function securityDoor(seed) {
  const img = makeImage(S, S);
  paint(img, (x, y) => {
    const n = hash2(x, y, seed + 2) - 0.5;
    const g = fbm(x, y, S, seed + 3, 4, 8);
    let f = 0.84 + g * 0.22 + n * 0.07;
    let c = [92, 100, 112];
    if (x === 5) f *= 0.6;
    if (x === 58) f *= 1.2;
    // reinforcement bars
    if ((y >= 25 && y <= 27) || (y >= 51 && y <= 53)) {
      c = [80, 86, 96];
      if (y === 25 || y === 51) f *= 1.3;
      else if (y === 27 || y === 53) f *= 0.6;
    }
    // kick plate with hazard stripes
    if (y >= 57) {
      if (y === 57) f *= 1.2;
      c = ((x + y) & 7) < 4 ? [190, 150, 30] : [30, 28, 26];
      if (y === 63) f *= 0.6;
    }
    const r = fbm(x, y, S, seed + 4, 4, 4);
    if (r > 0.68 && y < 57) c = lerp3(c, RUST, 0.5);
    return col(c, f);
  });
  // wired vision window
  for (let y = 9; y <= 21; y++)
    for (let x = 23; x <= 40; x++) {
      if (y === 9 || y === 21 || x === 23 || x === 40) {
        setPx(img, x, y, col([130, 136, 146], y === 9 || x === 40 ? 1.2 : 0.6));
        continue;
      }
      let c = col([26, 32, 40], 0.9 + 0.2 * hash2(x, y, seed));
      if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) c = rgba(70, 78, 84);
      if (x - 24 === 20 - y || x - 25 === 20 - y) c = mix(c, rgba(150, 170, 180), 0.5);
      setPx(img, x, y, c);
    }
  // hinges
  for (const hy of [12, 42]) {
    fillRect(img, 5, hy, 3, 7, rgba(70, 72, 78));
    fillRect(img, 7, hy, 1, 7, rgba(130, 134, 140));
  }
  // large red stenciled padlock
  const lx = 27,
    ly = 30;
  for (let y = ly; y < ly + 8; y++)
    for (let x = lx - 6; x <= lx + 6; x++) {
      const d = Math.hypot(x + 0.5 - (lx + 0.5), y + 0.5 - (ly + 7));
      if (d <= 6 && d >= 3.6 && y < ly + 7)
        setPx(img, x, y, col([170, 28, 26], 0.8 + 0.3 * hash2(x, y, seed + 5)));
    }
  for (let y = ly + 6; y < ly + 18; y++)
    for (let x = lx - 7; x <= lx + 7; x++) {
      let c = col([186, 32, 28], (y === ly + 6 ? 1.25 : 0.9) + 0.15 * hash2(x, y, seed + 6));
      if (fbm(x, y, S, seed + 7, 3, 8) > 0.66) c = mix(c, getPx(img, x, y), 0.6);
      setPx(img, x, y, c);
    }
  fillRect(img, lx - 1, ly + 9, 3, 3, rgba(24, 20, 20));
  fillRect(img, lx, ly + 12, 1, 3, rgba(24, 20, 20));
  // keycard reader with a bright red "denied" LED
  for (let y = 31; y <= 45; y++)
    for (let x = 45; x <= 53; x++) {
      let f = 0.9;
      if (y === 31 || x === 53) f = 1.4;
      if (y === 45 || x === 45) f = 0.55;
      setPx(img, x, y, col([30, 32, 36], f));
    }
  fillRect(img, 47, 39, 5, 1, rgba(8, 8, 10));
  fillRect(img, 47, 40, 5, 1, rgba(90, 94, 100)); // card slot
  for (let k = 0; k < 3; k++) fillRect(img, 47 + k * 2, 42, 1, 1, rgba(70, 74, 80));
  wallLamp(img, 47, 34, 4, 2, rgba(255, 34, 26), rgba(255, 190, 170), rgba(255, 40, 30), 3);
  // door handle
  fillRect(img, 46, 48, 7, 2, rgba(150, 154, 160));
  fillRect(img, 46, 49, 7, 1, rgba(70, 72, 78));
  doorFrame(img, seed + 10, false);
  // red warning beacon in the header
  wallLamp(img, 29, 1, 6, 3, rgba(255, 30, 24), rgba(255, 200, 180), rgba(255, 40, 30), 3);
  return img;
}

function blastDoor(seed) {
  const img = makeImage(S, S);
  paint(img, (x, y) => {
    const n = hash2(x, y, seed + 2) - 0.5;
    const g = fbm(x, y, S, seed + 3, 4, 8);
    let f = 0.84 + g * 0.24 + n * 0.07;
    const c = [64, 68, 74];
    if (x === 31) return col(c, 0.25); // leaf seam
    if (x === 32) f *= 1.3;
    if (x === 30) f *= 0.75;
    const ry = (y - 8) % 12;
    if (y >= 8 && ry === 0) f *= 1.35;
    if (y >= 8 && ry === 1) f *= 1.1;
    if (y >= 8 && ry === 2) f *= 0.5;
    const r = fbm(x, y, S, seed + 4, 4, 4);
    return col(r > 0.64 ? lerp3(c, RUST, clamp((r - 0.64) * 4, 0, 0.7)) : c, f);
  });
  for (let y = 8; y < S; y += 12) for (const x of [8, 20, 40, 52]) rivetW(img, x, y + 4);
  // big lightning-bolt sign: yellow disc, black ring, black bolt
  const cx = 32,
    cy = 31;
  const m = makeImage(S, S);
  fillPoly(
    m,
    [
      [34.5, 18],
      [24.5, 33],
      [30.5, 33],
      [27, 44.5],
      [40, 28],
      [34, 28],
      [38.5, 18],
    ],
    1,
  );
  for (let y = cy - 14; y <= cy + 14; y++)
    for (let x = cx - 14; x <= cx + 14; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 13.5) continue;
      let c;
      if (d > 12)
        c = col([150, 150, 150], 0.7 + 0.5 * (x > cx ? 1 : 0)); // steel rim
      else if (d > 10.5 || m.data[y * S + x]) c = rgba(22, 20, 18);
      else c = col([210, 168, 36], 0.9 + 0.12 * hash2(x, y, seed + 8));
      if (fbm(x, y, S, seed + 9, 4, 8) > 0.68 && d <= 12) c = mix(c, rgba(120, 90, 50), 0.4);
      setPx(img, x, y, c);
    }
  for (let y = cy - 12; y <= cy + 12; y++)
    setPx(img, 31, y, mix(getPx(img, 31, y), rgba(10, 10, 10), 0.4));
  for (const [rx, ry] of [
    [cx - 1, cy - 13],
    [cx - 1, cy + 12],
    [cx - 13, cy - 1],
    [cx + 12, cy - 1],
  ])
    rivetW(img, rx, ry);
  doorFrame(img, seed + 10, true);
  // dead indicator lamps in the header
  for (const lxp of [20, 30, 40]) {
    fillRect(img, lxp - 1, 0, 5, 5, rgba(22, 22, 24));
    fillRect(img, lxp, 1, 3, 3, rgba(44, 52, 46));
    setPx(img, lxp + 2, 1, rgba(90, 100, 92));
    setPx(img, lxp, 3, rgba(30, 34, 30));
  }
  // small unlit status panel beside the sign
  fillRect(img, 48, 46, 7, 7, rgba(26, 28, 30));
  for (const [px, py] of [
    [49, 47],
    [52, 47],
    [49, 50],
    [52, 50],
  ]) {
    fillRect(img, px, py, 2, 2, rgba(50, 40, 36));
    setPx(img, px + 1, py, rgba(80, 70, 64));
  }
  return img;
}

// Steel window: riveted steel frame and sill set into a steel plate wall.
function windowBaseMetal(wall) {
  const img = cloneImage(wall);
  const F = { x0: OPEN.x0 - 3, x1: OPEN.x1 + 3, y0: OPEN.y0 - 3, y1: OPEN.y1 };
  for (let y = F.y0 - 1; y <= F.y1 + 1; y++)
    for (let x = F.x0 - 1; x <= F.x1 + 1; x++) setPx(img, x, y, tint(getPx(img, x, y), 0.5));
  for (let y = F.y0; y <= F.y1; y++)
    for (let x = F.x0; x <= F.x1; x++) {
      const n = hash2(x, y, 177) - 0.5;
      const g = fbm(x, y, S, 178, 3, 8);
      let f = 0.8 + g * 0.3 + n * 0.08;
      if (y === F.y0 || x === F.x1) f *= 1.35;
      if (x === F.x0) f *= 0.7;
      if (y === OPEN.y0 - 1 || x === OPEN.x0 - 1) f *= 0.5;
      if (x === OPEN.x1 + 1) f *= 1.15;
      let c = [74, 80, 90];
      const r = fbm(x, y, S, 179, 4, 8);
      if (r > 0.62) c = lerp3(c, RUST, 0.6);
      setPx(img, x, y, col(c, f));
    }
  for (let x = F.x0 + 3; x < F.x1 - 1; x += 6) {
    setPx(img, x, F.y0 + 1, rgba(170, 174, 180));
    setPx(img, x + 1, F.y0 + 2, rgba(34, 36, 40));
  }
  for (let y = F.y0 + 4; y < F.y1; y += 6)
    for (const x of [F.x0 + 1, F.x1 - 1]) {
      setPx(img, x, y, rgba(170, 174, 180));
      setPx(img, x, y + 1, rgba(34, 36, 40));
    }
  // steel sill
  for (let y = OPEN.y1 + 1; y <= OPEN.y1 + 4; y++)
    for (let x = F.x0 - 2; x <= F.x1 + 2; x++) {
      const n = hash2(x, y, 180) - 0.5;
      let f = 0.85 + n * 0.12;
      if (y === OPEN.y1 + 1) f *= 1.5;
      if (y === OPEN.y1 + 4) f *= 0.5;
      setPx(img, x, y, col([84, 90, 98], f));
    }
  for (let x = F.x0 - 2; x <= F.x1 + 2; x++)
    setPx(img, x, OPEN.y1 + 5, tint(getPx(img, x, OPEN.y1 + 5), 0.45));
  for (let k = 0; k < 4; k++)
    rustStreak(img, F.x0 + 6 + k * 13, OPEN.y1 + 5, 5 + k * 2, 181 + k, 0.5);
  for (let y = OPEN.y0; y <= OPEN.y1; y++)
    for (let x = OPEN.x0; x <= OPEN.x1; x++) img.data[y * S + x] = 0;
  return img;
}

function buildMetalWindows(wall) {
  const base = windowBaseMetal(wall);
  const planks = makePlanks(4242); // same layout as the brick windows
  const out = [];
  for (let n = 0; n <= 5; n++) {
    const img = cloneImage(base);
    for (let i = n; i < 5; i++) drawStub(img, planks[i]);
    const present = planks.slice(0, n).sort((a, b) => a.slot - b.slot);
    const owner = new Uint8Array(S * S);
    for (const p of present) drawPlank(img, p, owner);
    out.push(img);
  }
  return out;
}

function crackW(img, rng, x, y, len, dark) {
  let a = rng() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    setW(img, x, y, dark);
    if (rng() < 0.35) setW(img, x + 1, y, tint(getW(img, x + 1, y), 1.12));
    a += (rng() - 0.5) * 0.9;
    x += Math.cos(a);
    y += Math.sin(a);
    if (rng() < 0.08 && len - i > 4) crackW(img, rng, x, y, Math.floor((len - i) / 2), dark);
  }
}

function concreteFloorTex(seed) {
  const img = makeImage(S, S);
  const rng = mulberry32(seed);
  paint(img, (x, y) => {
    const g = fbm(x, y, S, seed, 5, 4);
    const n = hash2(x, y, seed + 1) - 0.5;
    let c = lerp3([74, 74, 70], [102, 100, 94], g);
    let f = 0.88 + n * 0.16;
    const agg = hash2(x, y, seed + 2);
    if (agg < 0.05) f *= 1.2;
    else if (agg > 0.95) f *= 0.75;
    if (x === 0 || y === 0) f *= 0.45; // saw-cut control joints
    if (x === 1 || y === 1) f *= 1.12;
    return col(c, f);
  });
  // faded painted corner marks (form a cross at every slab corner when tiled)
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const [dx, dy] = torusDist(x, y, 3, 3);
      const onH = (y === 3 || y === 4) && dx <= 14,
        onV = (x === 3 || x === 4) && dy <= 14;
      if (!onH && !onV) continue;
      const wear = fbm(x, y, S, seed + 5, 4, 8);
      if (wear > 0.64 || hash2(x, y, seed + 6) < 0.12) continue;
      setPx(img, x, y, mix(getPx(img, x, y), rgba(196, 164, 46), 0.6 + 0.4 * (0.64 - wear)));
    }
  // oil stains and rust marks
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const st = fbm(x, y, S, seed + 7, 4, 4);
      if (st > 0.6)
        setPx(img, x, y, mix(getPx(img, x, y), rgba(26, 26, 28), clamp((st - 0.6) * 4, 0, 0.6)));
      const ru = fbm(x, y, S, seed + 8, 3, 8);
      if (ru > 0.7) setPx(img, x, y, mix(getPx(img, x, y), col(RUST), 0.3));
    }
  shadeAll(img, (x, y) => 0.8 + 0.3 * fbm(x, y, S, seed + 9, 3, 4));
  for (let i = 0; i < 3; i++)
    crackW(img, rng, 10 + rng() * 44, 10 + rng() * 44, 12 + rng() * 14, rgba(28, 28, 26));
  return img;
}

function grateTex(seed) {
  const img = makeImage(S, S);
  paint(img, (x, y) => {
    const n = hash2(x, y, seed) - 0.5;
    const g = fbm(x, y, S, seed + 1, 4, 8);
    const fx = x & 31,
      fy = y & 31;
    if (fx < 2 || fy < 2) {
      // panel frame angle
      const f = fx === 0 || fy === 0 ? 1.15 : 0.7;
      return col([66, 70, 74], f * (0.85 + g * 0.3 + n * 0.1));
    }
    const lx = x & 3;
    const bar = lx === 0 || lx === 1;
    if ((y & 15) === 8) return col([74, 76, 80], (bar ? 1.15 : 0.85) * (0.85 + g * 0.3)); // cross rod
    if (bar) return col([72, 76, 82], (lx === 0 ? 1.15 : 0.78) * (0.8 + g * 0.35 + n * 0.1));
    const deep = fbm(x, y, S, seed + 5, 3, 4);
    if ((y & 15) === 9) return col([10, 10, 12], 1); // rod shadow
    return col([16, 18, 18], 0.5 + deep * 0.9);
  });
  // grime clumps fill the voids, rust on the bars
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const gr = fbm(x, y, S, seed + 7, 4, 4);
      if (gr > 0.6)
        setPx(img, x, y, mix(getPx(img, x, y), rgba(52, 44, 34), clamp((gr - 0.6) * 4, 0, 0.75)));
      const ru = fbm(x, y, S, seed + 8, 3, 8);
      if (ru > 0.66 && (x & 3) < 2) setPx(img, x, y, mix(getPx(img, x, y), col(RUST), 0.45));
    }
  return img;
}

function ceilingMetalTex(seed) {
  const img = makeImage(S, S);
  paint(img, (x, y) => {
    const n = hash2(x, y, seed) - 0.5;
    const g = fbm(x, y, S, seed + 1, 4, 8);
    const lx = x & 31,
      ly = y & 31;
    if (lx === 31 || ly === 31) return col([20, 22, 24], 1 + n * 0.2);
    let f = 0.82 + g * 0.25 + n * 0.06 + 0.08 * hash2(x >> 5, y >> 5, seed + 2);
    if (lx === 0 || ly === 0) f *= 1.2;
    if (lx === 30 || ly === 30) f *= 0.75;
    return col([52, 56, 60], f);
  });
  for (const [px, py] of [
    [0, 0],
    [32, 0],
    [0, 32],
    [32, 32],
  ])
    for (const [dx, dy] of [
      [2, 2],
      [27, 2],
      [2, 27],
      [27, 27],
    ])
      rivetW(img, px + dx, py + dy);
  // red-oxide I-beam (bottom flange seen from below)
  for (let y = 22; y <= 33; y++)
    for (let x = 0; x < S; x++) {
      const n = hash2(x, y, seed + 3) - 0.5;
      const g = fbm(x, y, S, seed + 4, 4, 8);
      let f = 0.82 + g * 0.24 + n * 0.08;
      if (y === 22) f *= 1.4;
      else if (y === 23) f *= 1.1;
      else if (y === 33) f *= 0.4;
      else if (y === 32) f *= 0.7;
      if (y === 27 || y === 28) f *= 0.9;
      setPx(img, x, y, col(g > 0.62 ? RUST : [100, 46, 34], f));
    }
  for (let x = 0; x < S; x++) setPx(img, x, 34, tint(getPx(img, x, 34), 0.45));
  for (let x = 3; x < S; x += 8) {
    rivetW(img, x, 24);
    rivetW(img, x, 30);
  }
  // electrical conduit with clamps
  for (const [cy, r, base] of [
    [47, 1.6, [110, 112, 116]],
    [52, 1.2, [96, 98, 100]],
  ]) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = 0; x < S; x++) {
        const t = (y + 0.5 - cy) / r;
        if (Math.abs(t) > 1) continue;
        setPx(img, x, y, col(base, cylShade(t)));
      }
    for (let x = 0; x < S; x++)
      setPx(img, x, Math.round(cy + r) + 1, tint(getPx(img, x, Math.round(cy + r) + 1), 0.55));
  }
  for (const cx of [6, 38])
    for (let y = 44; y <= 55; y++) {
      setPx(img, cx, y, rgba(40, 42, 44));
      setPx(img, cx + 1, y, rgba(84, 86, 90));
    }
  // junction box
  for (let y = 41; y <= 49; y++)
    for (let x = 20; x <= 28; x++) {
      let f = 0.9;
      if (y === 41 || x === 28) f = 1.3;
      if (y === 49 || x === 20) f = 0.5;
      setPx(img, x, y, col([70, 74, 70], f));
    }
  shadeAll(img, (x, y) => 0.78 + 0.3 * fbm(x, y, S, seed + 9, 3, 4));
  return img;
}

//=============================================================
//                          EXPORTS
//=============================================================

export function buildTextures(icons) {
  const brick = brickWall(101);
  const brick2 = brickWall(202, {
    base: [96, 58, 44],
    alt: [74, 46, 38],
    mortar: [46, 44, 40],
    off: 4,
    moss: true,
  });
  const brickBlood = brickWall(101);
  addBlood(brickBlood, 303);
  const walls = {
    brick,
    brick2,
    brickBlood,
    concrete: concreteWall(404),
    concrete2: concreteWall2(505),
    door: doorTex(606),
  };
  // chalk wall-buys for every weapon icon that exists
  const BUY_SEEDS = { shotgun: 707, smg: 808, rifle: 909, dbarrel: 1010, autoshot: 1111 };
  for (const id of ['shotgun', 'smg', 'rifle', 'dbarrel', 'autoshot']) {
    if (icons && icons[id]) walls['buy_' + id] = chalkBuy(icons[id], BUY_SEEDS[id]);
  }
  // industrial set
  const metal = steelWall(1414);
  Object.assign(walls, {
    metal,
    metal2: steelWall2(1515),
    pipes: pipesWall(1616),
    hazard: hazardWall(1717),
    tiles: tileWall(1818),
    door_locked: securityDoor(1919),
    door_power: blastDoor(2020),
  });
  // guarantee full opacity on walls
  for (const w of Object.values(walls))
    for (let i = 0; i < w.data.length; i++) w.data[i] = (w.data[i] | 0xff000000) >>> 0;
  const windows = buildWindows(brick);
  const floor = floorTex(1111),
    ceiling = ceilingTex(1212),
    dirt = dirtTex(1313);
  const windowsMetal = buildMetalWindows(metal);
  const concreteFloor = concreteFloorTex(1414 + 1000),
    grate = grateTex(2525),
    ceilingMetal = ceilingMetalTex(2626);
  for (const t of [floor, ceiling, dirt, concreteFloor, grate, ceilingMetal])
    for (let i = 0; i < t.data.length; i++) t.data[i] = (t.data[i] | 0xff000000) >>> 0;
  return { walls, windows, floor, ceiling, dirt, windowsMetal, concreteFloor, grate, ceilingMetal };
}

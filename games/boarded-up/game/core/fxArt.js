// fxArt.js - Boarded Up effect sprites: flames, smoke, electric arcs and sawblades
// Author: Reachnid Group
// Centennial College - Fall 2026

// Procedural effect sprites: flamethrower puffs, embers, smoke, electric arcs,
// spinning sawblades and burning-zombie flame overlays.
import { rgba, glow, unpack, makeImage, mulberry32, hash2, valueNoise, setPx } from './pixel.js';

// Fire palette lookup: heat 1 = white-yellow core, 0 = dark red edge.
function fireColor(heat) {
  const stops = [
    [0.0, [150, 26, 8]],
    [0.25, [214, 60, 12]],
    [0.5, [250, 128, 24]],
    [0.75, [255, 204, 70]],
    [1.0, [255, 252, 220]],
  ];
  heat = Math.max(0, Math.min(1, heat));
  for (let i = 1; i < stops.length; i++) {
    if (heat <= stops[i][0]) {
      const [t0, c0] = stops[i - 1],
        [t1, c1] = stops[i];
      const t = (heat - t0) / (t1 - t0);
      return glow(
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      );
    }
  }
  return glow(255, 252, 220);
}

// One flame puff. age 0 (young, small, hot) .. 1 (old, large, red, ragged).
function flamePuff(age, seed) {
  const S = 16,
    img = makeImage(S, S);
  const R = 3.6 + age * 4.1;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 8,
        dy = y + 0.5 - 8;
      // slightly teardrop: stretched upward
      const d = Math.hypot(dx, dy * (dy < 0 ? 0.82 : 1.1));
      const n = valueNoise(x / 2.6, y / 2.6, 64, seed) - 0.5;
      const edge = R * (1 + n * (0.35 + age * 0.55));
      if (d > edge) continue;
      // older puffs thin out: holes appear in the outer body
      if (age > 0.4 && d > edge * 0.45 && hash2(x, y, seed + 9) < (age - 0.4) * 0.55) continue;
      const t = d / edge;
      let heat = (1 - t) * (1.5 - age * 1.05) + n * 0.25;
      if (age < 0.2 && t < 0.5) heat = 1;
      img.data[y * S + x] = fireColor(heat);
    }
  return img;
}

function ember() {
  const img = makeImage(4, 4);
  const px = [
    [1, 1, glow(255, 236, 160)],
    [2, 1, glow(255, 170, 50)],
    [1, 2, glow(255, 150, 40)],
    [2, 2, glow(240, 96, 20)],
    [0, 1, glow(200, 70, 14)],
    [3, 2, glow(170, 46, 10)],
    [1, 0, glow(220, 90, 20)],
    [2, 3, glow(180, 50, 10)],
  ];
  for (const [x, y, c] of px) setPx(img, x, y, c);
  return img;
}

function smoke() {
  const S = 12,
    img = makeImage(S, S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - 6,
        dy = y + 0.5 - 6.3;
      const d = Math.hypot(dx, dy);
      const n = valueNoise(x / 2.2, y / 2.2, 64, 41) - 0.5;
      if (d > 5.4 + n * 2.4) continue;
      // lumpy shading: lighter top-left, darker bottom-right
      const l = 0.85 + (-dx - dy) * 0.035 + n * 0.35 + (hash2(x, y, 3) - 0.5) * 0.08;
      const v = 58 * l;
      img.data[y * S + x] = rgba(v, v * 0.98, v * 0.96);
    }
  return img;
}

function arc() {
  const img = makeImage(8, 8);
  const rng = mulberry32(5);
  const core = glow(250, 240, 255),
    mid = glow(196, 140, 255),
    dim = glow(130, 70, 230);
  // three jagged prongs out of a bright centre
  const prongs = [
    [-1, -1],
    [1, 0.4],
    [-0.3, 1],
  ];
  for (const [ax, ay] of prongs) {
    let x = 3.5,
      y = 3.5;
    for (let i = 0; i < 4; i++) {
      x += ax + (rng() - 0.5) * 1.2;
      y += ay + (rng() - 0.5) * 1.2;
      setPx(img, x, y, i < 2 ? mid : dim);
    }
  }
  for (const [x, y] of [
    [3, 3],
    [4, 3],
    [3, 4],
    [4, 4],
  ])
    setPx(img, x, y, core);
  setPx(img, 2, 4, mid);
  setPx(img, 5, 3, mid);
  return img;
}

function sawFrame(rot) {
  const S = 16,
    img = makeImage(S, S);
  const teeth = 9,
    cx = 8,
    cy = 8;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx) - rot;
      const ph = ((((a / (Math.PI * 2)) * teeth) % 1) + 1) % 1; // 0..1 across a tooth
      const rim = 5.3 + (1 - ph) * 2.6; // sawtooth profile
      if (r > rim) continue;
      let c;
      if (r < 1.6) c = rgba(150, 152, 160);
      else if (r < 2.8) c = rgba(52, 52, 58);
      else {
        const lit = 0.78 + 0.32 * Math.cos(Math.atan2(dy, dx) * 2 + 0.9 + rot * 2);
        c = r > 5.2 ? rgba(196 * lit, 200 * lit, 210 * lit) : rgba(140 * lit, 144 * lit, 154 * lit);
        // radial slots
        const sa = ((((a / (Math.PI * 2)) * 4) % 1) + 1) % 1;
        if (r > 3.2 && r < 4.8 && sa < 0.1) c = rgba(46, 46, 52);
      }
      img.data[y * S + x] = c;
    }
  // emissive glint on a tooth tip
  const ga = -2.2 + rot;
  setPx(img, cx + Math.cos(ga) * 6.4, cy + Math.sin(ga) * 6.4, glow(255, 255, 240));
  setPx(img, cx + Math.cos(ga) * 5.4, cy + Math.sin(ga) * 5.4, glow(210, 216, 228));
  return img;
}

// Flame overlay for a burning zombie (40x64 frame, zombie roughly centred,
// feet at the bottom). Tongues rise from the hips/legs and the forearms.
function burning(frame) {
  const W = 40,
    H = 64,
    img = makeImage(W, H);
  const rng = mulberry32(100 + frame * 31);
  const bases = [
    // [x, y, height, width]
    [15, 60, 14, 3.2],
    [24, 60, 13, 3.2],
    [19, 52, 16, 4],
    [13, 46, 15, 3.5],
    [26, 46, 16, 3.5],
    [20, 40, 13, 3.6],
    [8, 36, 11, 2.8],
    [32, 36, 11, 2.8],
    [10, 30, 9, 2.4],
    [30, 30, 10, 2.4],
  ];
  const ph = frame * 2.1;
  for (const [bx, by, bh, bw] of bases) {
    const h = bh * (0.75 + 0.5 * rng());
    const sway = (rng() - 0.5) * 3;
    for (let y = Math.floor(by - h); y <= by + 1; y++)
      for (let x = Math.floor(bx - bw - 3); x <= bx + bw + 3; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const t = (by - y) / h; // 0 at base, 1 at tip
        if (t < -0.08 || t > 1) continue;
        const wob = Math.sin(t * 5 + ph + bx) * 1.2 * t + sway * t * t;
        const half = bw * (1 - t) ** 0.8 * (t < 0.12 ? 0.6 + t * 3.3 : 1);
        const dx = Math.abs(x + 0.5 - (bx + wob));
        const n = valueNoise(x / 2, (y + frame * 5) / 2, 64, 7) - 0.5;
        if (dx > half + n * 1.6) continue;
        const heat = (1 - t) * 0.85 * (1 - dx / (half + 1.5)) + 0.15 + n * 0.3;
        const cur = img.data[y * W + x];
        const c = fireColor(heat);
        if (cur >>> 24) {
          // keep the hotter of overlapping tongues
          const [r1, g1] = unpack(cur),
            [r2, g2] = unpack(c);
          if (r1 + g1 >= r2 + g2) continue;
        }
        img.data[y * W + x] = c;
      }
  }
  // a few loose sparks above the flames
  for (let i = 0; i < 5; i++) {
    const x = 8 + rng() * 24,
      y = 10 + rng() * 22;
    setPx(img, x, y, rng() < 0.5 ? glow(255, 200, 80) : glow(255, 130, 30));
  }
  return img;
}

export function buildFx() {
  const flame = [0, 1, 2, 3].map((i) => flamePuff(i / 3, 11 + i * 7));
  return {
    flame,
    ember: ember(),
    smoke: smoke(),
    arc: arc(),
    saw: [sawFrame(0), sawFrame(Math.PI / 10)],
    burning: [0, 1, 2].map(burning),
  };
}

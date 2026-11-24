// pixel.js - Boarded Up pixel-art toolkit used by all the procedural art
// Author: Reachnid Group
// Centennial College - Fall 2026

// Tiny pixel-art toolkit. Images are { w, h, data: Uint32Array } in 0xAABBGGRR
// (little-endian RGBA, same layout as canvas ImageData viewed as Uint32).
// Alpha conventions used by the renderer:
//   0   = transparent
//   254 = EMISSIVE (drawn full-bright, ignores distance fog/darkness)
//   255 = normal opaque, lit by the scene

export const EMISSIVE = 254;

const c255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

export function rgba(r, g, b, a = 255) {
  return ((c255(a) << 24) | (c255(b) << 16) | (c255(g) << 8) | c255(r)) >>> 0;
}
export const glow = (r, g, b) => rgba(r, g, b, EMISSIVE);

export function unpack(c) {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
}

export function tint(c, f) {
  const [r, g, b, a] = unpack(c);
  return rgba(r * f, g * f, b * f, a);
}

export function mix(c1, c2, t) {
  const [r1, g1, b1, a1] = unpack(c1);
  const [r2, g2, b2] = unpack(c2);
  return rgba(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t, a1);
}

export function makeImage(w, h) {
  return { w, h, data: new Uint32Array(w * h) };
}

export function cloneImage(img) {
  return { w: img.w, h: img.h, data: new Uint32Array(img.data) };
}

export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, seed = 0) {
  let h =
    (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Tileable value noise. x,y are in "cells"; period = number of cells before wrapping.
export function valueNoise(x, y, period, seed = 0) {
  const x0 = Math.floor(x),
    y0 = Math.floor(y);
  const fx = x - x0,
    fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const w = (v) => ((v % period) + period) % period;
  const a = hash2(w(x0), w(y0), seed),
    b = hash2(w(x0 + 1), w(y0), seed);
  const c = hash2(w(x0), w(y0 + 1), seed),
    d = hash2(w(x0 + 1), w(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

// Fractal noise over a square texture of `size` pixels; tiles seamlessly. Returns 0..1.
export function fbm(x, y, size, seed = 0, octaves = 4, baseFreq = 4) {
  let v = 0,
    amp = 0.5,
    total = 0,
    freq = baseFreq;
  for (let o = 0; o < octaves; o++) {
    v += amp * valueNoise((x / size) * freq, (y / size) * freq, freq, seed + o * 17);
    total += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / total;
}

export function setPx(img, x, y, c) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  img.data[y * img.w + x] = c;
}

export function getPx(img, x, y) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return 0;
  return img.data[y * img.w + x];
}

export function fillRect(img, x, y, w, h, c) {
  const x0 = Math.max(0, Math.round(x)),
    y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(img.w, Math.round(x + w)),
    y1 = Math.min(img.h, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * img.w;
    for (let xx = x0; xx < x1; xx++) img.data[row + xx] = c;
  }
}

export function fillEllipse(img, cx, cy, rx, ry, c) {
  const y0 = Math.max(0, Math.floor(cy - ry)),
    y1 = Math.min(img.h - 1, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (dy * dy > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const xa = Math.max(0, Math.round(cx - half)),
      xb = Math.min(img.w, Math.round(cx + half));
    for (let x = xa; x < xb; x++) img.data[y * img.w + x] = c;
  }
}

// Scanline polygon fill (even-odd). pts = [[x,y], ...]
export function fillPoly(img, pts, c) {
  let minY = Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const ys = Math.max(0, Math.floor(minY)),
    ye = Math.min(img.h - 1, Math.ceil(maxY));
  const xs = [];
  for (let y = ys; y <= ye; y++) {
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
      const xa = Math.max(0, Math.round(xs[k])),
        xb = Math.min(img.w, Math.round(xs[k + 1]));
      for (let x = xa; x < xb; x++) img.data[y * img.w + x] = c;
    }
  }
}

// Thick line made by stamping discs.
export function drawLine(img, x0, y0, x1, y1, c, thick = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len * 2));
  const r = thick / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t,
      y = y0 + (y1 - y0) * t;
    if (thick <= 1.01) setPx(img, x, y, c);
    else fillEllipse(img, x, y, r, r, c);
  }
}

// Trapezoid centred on cx: bottom edge at yb (width wb), top edge at yt (width wt).
export function fillTrap(img, cx, yb, yt, wb, wt, c) {
  fillPoly(
    img,
    [
      [cx - wb / 2, yb],
      [cx + wb / 2, yb],
      [cx + wt / 2, yt],
      [cx - wt / 2, yt],
    ],
    c,
  );
}

// Random per-pixel brightness variation on opaque, non-emissive pixels.
export function vary(img, rng, amount = 0.15) {
  const d = img.data;
  for (let i = 0; i < d.length; i++) {
    const a = d[i] >>> 24;
    if (a === 0 || a === EMISSIVE) continue;
    d[i] = tint(d[i], 1 + (rng() - 0.5) * amount);
  }
}

// 1px outline around opaque pixels (helps sprites read against dark scenes).
export function outline(img, c) {
  const { w, h, data } = img;
  const out = new Uint32Array(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] >>> 24) continue;
      const n =
        (x > 0 && data[y * w + x - 1] >>> 24) ||
        (x < w - 1 && data[y * w + x + 1] >>> 24) ||
        (y > 0 && data[(y - 1) * w + x] >>> 24) ||
        (y < h - 1 && data[(y + 1) * w + x] >>> 24);
      if (n) out[y * w + x] = c;
    }
  }
  img.data = out;
  return img;
}

// Copy src onto dst at (ox, oy), skipping transparent pixels.
export function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) {
    const dy = y + oy;
    if (dy < 0 || dy >= dst.h) continue;
    for (let x = 0; x < src.w; x++) {
      const dx = x + ox;
      if (dx < 0 || dx >= dst.w) continue;
      const c = src.data[y * src.w + x];
      if (c >>> 24) dst.data[dy * dst.w + dx] = c;
    }
  }
}

export function flipX(img) {
  const out = makeImage(img.w, img.h);
  for (let y = 0; y < img.h; y++)
    for (let x = 0; x < img.w; x++) out.data[y * img.w + x] = img.data[y * img.w + (img.w - 1 - x)];
  return out;
}

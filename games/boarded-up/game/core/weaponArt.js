// weaponArt.js - Boarded Up weapon icons, first-person viewmodels and muzzle flashes
// Author: Reachnid Group
// Centennial College - Fall 2026

// Procedural weapon art: HUD icons (side profile), first-person viewmodels and muzzle flashes.
import {
  EMISSIVE,
  rgba,
  glow,
  unpack,
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
} from './pixel.js';

const OUTLINE = rgba(14, 13, 16);

//=============================================================
//                       SMALL HELPERS
//=============================================================

// Small helpers

// Scanline polygon fill with a per-pixel colour callback (return 0 to skip).
function fillPolyFn(img, pts, fn) {
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
      for (let x = xa; x < xb; x++) {
        const c = fn(x, y);
        if (c) img.data[y * img.w + x] = c;
      }
    }
  }
}

// Bevel-style shading for flat side-profile art: light top edges, dark bottom edges.
function autoShade(img) {
  const { w, h, data } = img;
  const src = new Uint32Array(data);
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] >>> 24 !== 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = src[y * w + x];
      if (!(c >>> 24)) continue;
      let f = 1;
      if (!op(x, y - 1)) f = 1.38;
      else if (!op(x, y - 2)) f = 1.14;
      if (!op(x, y + 1)) f *= 0.66;
      else if (!op(x, y + 2)) f *= 0.86;
      if (!op(x - 1, y)) f *= 0.9;
      data[y * w + x] = tint(c, f);
    }
}

//=============================================================
//                           ICONS
//=============================================================

// Icons: 48x20 side profiles pointing right

function iconPistol() {
  const img = makeImage(48, 20);
  const slide = rgba(78, 82, 92),
    frame = rgba(46, 48, 54),
    grip = rgba(36, 36, 40),
    dark = rgba(22, 22, 26);
  // grip, angled back
  fillPoly(
    img,
    [
      [11, 10],
      [21, 10],
      [19, 18],
      [9, 18],
    ],
    grip,
  );
  fillRect(img, 8, 17, 11, 2, frame); // mag base
  for (let y = 12; y < 17; y += 2) drawLine(img, 11, y, 19, y, rgba(28, 28, 32));
  // frame & trigger guard
  fillRect(img, 18, 10, 20, 2, frame);
  drawLine(img, 21, 12, 21, 14, frame);
  drawLine(img, 21, 14, 28, 14, frame);
  drawLine(img, 28, 14, 29, 12, frame);
  drawLine(img, 24, 12, 24, 13, dark);
  // slide
  fillRect(img, 10, 5, 29, 5, slide);
  fillRect(img, 39, 6, 2, 3, rgba(60, 62, 70)); // barrel tip
  setPx(img, 40, 7, dark);
  for (let x = 12; x < 18; x += 2) drawLine(img, x, 6, x, 8, rgba(40, 42, 48));
  fillRect(img, 36, 4, 2, 1, slide);
  fillRect(img, 10, 4, 3, 1, slide); // sights
  drawLine(img, 28, 7, 33, 7, rgba(58, 60, 68)); // ejection port line
  return img;
}

function iconShotgun() {
  const img = makeImage(48, 20);
  const wood = rgba(132, 82, 42),
    woodD = rgba(98, 58, 28),
    steel = rgba(66, 66, 72),
    dark = rgba(30, 30, 34);
  fillPoly(
    img,
    [
      [1, 9],
      [14, 6],
      [15, 11],
      [12, 12],
      [2, 15],
    ],
    wood,
  ); // stock
  fillRect(img, 1, 9, 2, 6, rgba(30, 24, 20)); // butt pad
  drawLine(img, 4, 12, 12, 9, woodD);
  fillRect(img, 14, 5, 9, 6, rgba(58, 58, 64)); // receiver
  drawLine(img, 15, 11, 15, 12, dark);
  drawLine(img, 15, 12, 19, 12, dark);
  drawLine(img, 19, 12, 19, 11, dark); // guard
  fillRect(img, 23, 5, 24, 3, steel); // barrel
  fillRect(img, 23, 8, 21, 2, rgba(50, 50, 56)); // mag tube
  fillRect(img, 27, 8, 11, 4, wood); // pump
  for (let x = 28; x < 38; x += 2) drawLine(img, x, 9, x, 11, woodD);
  setPx(img, 46, 4, rgba(200, 200, 190)); // bead
  return img;
}

function iconSmg() {
  const img = makeImage(48, 20);
  const blk = rgba(44, 44, 50),
    blk2 = rgba(32, 32, 36),
    dark = rgba(20, 20, 22);
  // folded wire stock
  drawLine(img, 4, 6, 12, 6, blk);
  drawLine(img, 4, 9, 12, 9, blk);
  fillRect(img, 3, 5, 2, 7, blk);
  fillRect(img, 12, 5, 23, 6, blk); // receiver
  for (let x = 14; x < 33; x += 3) setPx(img, x, 4, blk); // rail teeth
  fillRect(img, 14, 4, 19, 1, blk2);
  fillRect(img, 35, 6, 6, 4, blk2); // shroud
  fillRect(img, 41, 7, 3, 2, blk); // barrel
  fillPoly(
    img,
    [
      [24, 11],
      [28, 11],
      [29, 19],
      [25, 19],
    ],
    blk2,
  ); // magazine
  fillPoly(
    img,
    [
      [14, 11],
      [19, 11],
      [18, 17],
      [13, 17],
    ],
    blk,
  ); // grip
  drawLine(img, 19, 12, 23, 12, dark);
  drawLine(img, 23, 11, 23, 12, dark);
  fillRect(img, 30, 7, 3, 1, rgba(70, 70, 78)); // ejection port
  return img;
}

function iconRifle() {
  const img = makeImage(48, 20);
  const tan = rgba(168, 146, 100),
    tanD = rgba(130, 110, 72),
    blk = rgba(48, 50, 46),
    olive = rgba(92, 98, 62);
  fillPoly(
    img,
    [
      [1, 7],
      [12, 6],
      [12, 11],
      [1, 13],
    ],
    tan,
  ); // stock
  fillRect(img, 1, 7, 2, 6, rgba(36, 34, 30));
  fillRect(img, 12, 5, 15, 6, blk); // receiver
  fillRect(img, 14, 3, 10, 2, blk); // optic rail / sight
  fillRect(img, 16, 2, 6, 1, blk);
  setPx(img, 21, 3, rgba(220, 40, 30)); // red dot lens
  fillRect(img, 27, 5, 11, 5, tan); // handguard
  for (let x = 29; x < 37; x += 2) setPx(img, x, 7, tanD);
  fillRect(img, 38, 7, 7, 2, blk); // barrel
  fillRect(img, 44, 6, 2, 4, blk); // flash hider
  fillPoly(
    img,
    [
      [36, 5],
      [38, 5],
      [38, 2],
      [37, 2],
    ],
    blk,
  ); // front sight post
  fillPoly(
    img,
    [
      [19, 11],
      [24, 11],
      [27, 18],
      [22, 18],
    ],
    olive,
  ); // curved mag
  fillPoly(
    img,
    [
      [13, 11],
      [17, 11],
      [16, 16],
      [12, 16],
    ],
    blk,
  ); // grip
  drawLine(img, 17, 12, 19, 12, blk);
  return img;
}

function iconMagnum() {
  const img = makeImage(48, 20);
  const chrome = rgba(196, 200, 210),
    chromeD = rgba(130, 134, 145),
    wood = rgba(118, 64, 36),
    dark = rgba(40, 40, 46);
  fillPoly(
    img,
    [
      [10, 10],
      [16, 10],
      [15, 13],
      [13, 18],
      [6, 18],
      [8, 13],
    ],
    wood,
  ); // grip
  setPx(img, 10, 14, rgba(200, 170, 90)); // medallion
  fillPoly(
    img,
    [
      [10, 4],
      [16, 4],
      [16, 11],
      [10, 11],
    ],
    chromeD,
  ); // frame
  fillRect(img, 10, 2, 2, 2, dark); // hammer
  fillRect(img, 16, 4, 8, 8, chrome); // cylinder
  drawLine(img, 18, 5, 18, 10, chromeD);
  drawLine(img, 21, 5, 21, 10, chromeD);
  fillRect(img, 24, 5, 20, 3, chrome); // barrel
  fillRect(img, 24, 4, 20, 1, rgba(230, 232, 238)); // rib
  fillRect(img, 24, 8, 10, 1, chromeD); // ejector shroud
  fillRect(img, 42, 3, 2, 1, chrome); // front sight
  drawLine(img, 13, 12, 13, 14, chromeD);
  drawLine(img, 13, 14, 18, 14, chromeD);
  drawLine(img, 18, 14, 18, 12, chromeD);
  setPx(img, 15, 12, dark);
  return img;
}

function iconLmg() {
  const img = makeImage(48, 20);
  const ol = rgba(88, 98, 56),
    olD = rgba(64, 72, 40),
    blk = rgba(42, 42, 44),
    brass = rgba(200, 160, 70);
  fillPoly(
    img,
    [
      [1, 6],
      [10, 6],
      [10, 12],
      [1, 14],
    ],
    olD,
  ); // stock
  fillRect(img, 1, 6, 2, 8, blk);
  fillRect(img, 10, 4, 21, 8, ol); // receiver
  fillRect(img, 10, 3, 21, 1, olD);
  fillRect(img, 19, 1, 9, 1, blk);
  fillRect(img, 19, 1, 1, 3, blk);
  fillRect(img, 27, 1, 1, 3, blk); // carry handle
  fillRect(img, 16, 12, 11, 6, rgba(104, 112, 70)); // box mag
  fillRect(img, 17, 13, 9, 1, olD);
  for (let x = 27; x < 31; x++) setPx(img, x, 12, brass); // belt
  fillRect(img, 31, 5, 11, 5, blk); // shroud
  for (let x = 32; x < 41; x += 2) {
    setPx(img, x, 6, rgba(20, 20, 20));
    setPx(img, x + 1, 8, rgba(20, 20, 20));
  }
  fillRect(img, 42, 6, 5, 2, blk); // barrel
  drawLine(img, 33, 11, 42, 11, olD); // folded bipod
  fillPoly(
    img,
    [
      [12, 12],
      [16, 12],
      [15, 17],
      [11, 17],
    ],
    blk,
  ); // grip
  return img;
}

function iconRail() {
  const img = makeImage(48, 20);
  const wht = rgba(214, 218, 224),
    gry = rgba(140, 146, 154),
    drk = rgba(64, 68, 76),
    cy = rgba(70, 225, 255);
  fillPoly(
    img,
    [
      [2, 7],
      [11, 5],
      [11, 11],
      [3, 13],
    ],
    gry,
  ); // stock
  fillPoly(
    img,
    [
      [10, 5],
      [34, 5],
      [37, 7],
      [37, 10],
      [10, 10],
    ],
    wht,
  ); // body
  fillPoly(
    img,
    [
      [15, 4],
      [29, 4],
      [27, 2],
      [17, 2],
    ],
    gry,
  ); // top fin
  fillRect(img, 34, 4, 13, 2, drk);
  fillRect(img, 34, 10, 13, 2, drk); // prongs
  fillRect(img, 34, 6, 12, 4, rgba(30, 70, 90));
  fillRect(img, 35, 7, 11, 2, cy); // rail glow
  for (const x of [18, 22, 26]) fillRect(img, x, 5, 2, 5, cy); // coils
  fillPoly(
    img,
    [
      [12, 10],
      [16, 10],
      [15, 16],
      [11, 16],
    ],
    drk,
  ); // grip
  return img;
}

function iconPlasma() {
  const img = makeImage(48, 20);
  const body = rgba(112, 128, 112),
    bodyD = rgba(70, 82, 72),
    grn = rgba(100, 255, 130);
  fillEllipse(img, 8, 9, 6, 4, bodyD); // rounded stock
  fillEllipse(img, 22, 8.5, 13, 5.5, body); // main body
  fillPoly(
    img,
    [
      [33, 5],
      [42, 7],
      [42, 10],
      [33, 12],
    ],
    bodyD,
  ); // nozzle cone
  fillRect(img, 42, 6, 3, 5, rgba(56, 66, 58));
  fillRect(img, 45, 7, 2, 3, grn); // emitter
  fillPoly(
    img,
    [
      [24, 4],
      [32, 4],
      [30, 2],
      [26, 2],
    ],
    bodyD,
  ); // fin
  fillEllipse(img, 21, 8, 4.5, 4.5, rgba(40, 48, 42)); // chamber ring
  fillEllipse(img, 21, 8, 3.2, 3.2, grn);
  fillRect(img, 20, 7, 2, 1, rgba(230, 255, 230));
  fillPoly(
    img,
    [
      [14, 13],
      [18, 13],
      [17, 18],
      [13, 18],
    ],
    bodyD,
  ); // grip
  return img;
}

function iconDbarrel() {
  const img = makeImage(48, 20);
  const wood = rgba(112, 64, 32),
    woodD = rgba(82, 46, 22),
    blue = rgba(62, 70, 92),
    blueD = rgba(42, 48, 64),
    dark = rgba(22, 22, 26);
  // sawn-off pistol-grip stock
  fillPoly(
    img,
    [
      [6, 9],
      [16, 8],
      [17, 11],
      [12, 12],
      [9, 18],
      [4, 18],
      [6, 12],
    ],
    wood,
  );
  drawLine(img, 7, 12, 10, 17, woodD);
  fillRect(img, 4, 17, 6, 1, rgba(36, 26, 20));
  // action with hammers
  fillRect(img, 16, 6, 8, 6, blue);
  fillPoly(
    img,
    [
      [17, 6],
      [19, 3],
      [20, 3],
      [20, 6],
    ],
    blueD,
  ); // hammer
  drawLine(img, 18, 8, 22, 8, rgba(110, 118, 140)); // engraving
  drawLine(img, 18, 12, 18, 14, dark);
  drawLine(img, 18, 14, 22, 14, dark);
  drawLine(img, 22, 14, 22, 12, dark);
  // two barrels (stacked in profile: top + bottom edge highlight), short
  fillRect(img, 24, 5, 17, 3, blue);
  fillRect(img, 24, 8, 17, 2, blueD);
  drawLine(img, 24, 7, 40, 7, rgba(30, 34, 46));
  fillRect(img, 40, 5, 1, 5, rgba(150, 156, 170)); // sawn ends
  // walnut forend
  fillPoly(
    img,
    [
      [24, 9],
      [33, 9],
      [32, 12],
      [24, 12],
    ],
    wood,
  );
  drawLine(img, 26, 11, 31, 11, woodD);
  setPx(img, 39, 4, rgba(230, 200, 120)); // bead
  return img;
}

function iconAutoshot() {
  const img = makeImage(48, 20);
  const blk = rgba(46, 46, 50),
    blk2 = rgba(32, 32, 36),
    org = rgba(236, 118, 30);
  fillPoly(
    img,
    [
      [1, 6],
      [12, 5],
      [12, 11],
      [2, 13],
    ],
    blk2,
  ); // stock
  fillRect(img, 1, 6, 2, 7, org); // butt pad
  fillRect(img, 12, 4, 18, 8, blk); // bulky receiver
  drawLine(img, 13, 7, 29, 7, org); // accent stripe
  fillRect(img, 14, 3, 13, 1, blk2); // rail
  fillPoly(
    img,
    [
      [13, 12],
      [17, 12],
      [16, 17],
      [12, 17],
    ],
    blk2,
  ); // grip
  // drum magazine
  fillEllipse(img, 24.5, 14, 5.5, 5.5, blk2);
  fillEllipse(img, 24.5, 14, 3.6, 3.6, rgba(66, 66, 72));
  fillEllipse(img, 24.5, 14, 1.6, 1.6, org);
  fillRect(img, 30, 5, 10, 3, rgba(66, 68, 74)); // barrel
  fillRect(img, 31, 8, 8, 3, blk); // foregrip
  fillRect(img, 40, 4, 5, 5, blk2); // muzzle brake
  setPx(img, 41, 5, rgba(14, 14, 16));
  setPx(img, 43, 5, rgba(14, 14, 16));
  fillRect(img, 42, 3, 1, 1, org); // front sight
  return img;
}

function iconFlamer() {
  const img = makeImage(48, 20);
  const steel = rgba(96, 98, 104),
    steelD = rgba(60, 60, 64),
    brass = rgba(186, 140, 62),
    red = rgba(186, 40, 32),
    hose = rgba(40, 36, 34);
  fillPoly(
    img,
    [
      [2, 6],
      [11, 6],
      [11, 11],
      [3, 12],
    ],
    steelD,
  ); // stock
  fillRect(img, 11, 5, 13, 6, steelD); // body
  fillRect(img, 13, 6, 3, 1, rgba(140, 140, 146));
  fillPoly(
    img,
    [
      [12, 11],
      [16, 11],
      [15, 16],
      [11, 16],
    ],
    rgba(44, 42, 40),
  ); // grip
  // red fuel tank under the body
  fillRect(img, 17, 12, 13, 5, red);
  fillEllipse(img, 17, 14.5, 1.5, 2.5, red);
  fillEllipse(img, 30, 14.5, 1.5, 2.5, red);
  drawLine(img, 17, 12, 29, 12, rgba(236, 120, 104));
  fillRect(img, 22, 12, 1, 5, rgba(90, 20, 16));
  // hose from tank to nozzle
  drawLine(img, 31, 13, 34, 11, hose);
  drawLine(img, 34, 11, 38, 10, hose);
  // perforated shield + barrel
  fillRect(img, 24, 5, 13, 5, rgba(84, 86, 90));
  for (let x = 25; x < 36; x += 2) {
    setPx(img, x, 6, rgba(30, 30, 32));
    setPx(img, x + 1, 8, rgba(30, 30, 32));
  }
  fillRect(img, 37, 6, 3, 3, steel);
  // flared brass nozzle, scorched lip
  fillPoly(
    img,
    [
      [40, 6],
      [45, 4],
      [45, 11],
      [40, 9],
    ],
    brass,
  );
  fillRect(img, 45, 4, 1, 7, rgba(70, 52, 34));
  fillRect(img, 41, 10, 4, 1, steelD); // igniter
  setPx(img, 45, 11, rgba(80, 150, 255)); // pilot
  return img;
}

function iconTesla() {
  const img = makeImage(48, 20);
  const iron = rgba(60, 58, 64),
    ironD = rgba(40, 38, 44),
    cu = rgba(214, 120, 66),
    cuD = rgba(150, 80, 42),
    vio = rgba(200, 140, 255);
  fillPoly(
    img,
    [
      [2, 7],
      [11, 6],
      [11, 11],
      [3, 13],
    ],
    ironD,
  ); // stock
  fillRect(img, 11, 5, 15, 7, iron); // body
  for (const x of [13, 17, 21, 25]) setPx(img, x, 10, rgba(126, 120, 130)); // rivets
  fillPoly(
    img,
    [
      [13, 12],
      [17, 12],
      [16, 17],
      [12, 17],
    ],
    ironD,
  ); // grip
  // glass capacitor on top with violet filament
  fillRect(img, 13, 2, 11, 3, rgba(96, 84, 140));
  drawLine(img, 14, 3, 22, 3, vio);
  fillRect(img, 12, 2, 1, 3, ironD);
  fillRect(img, 24, 2, 1, 3, ironD);
  // copper coil stack flaring toward the tip
  fillRect(img, 26, 7, 16, 3, cuD); // core rod
  for (let i = 0; i < 6; i++) {
    const x = 27 + i * 2.6,
      h = 2 + i * 0.6;
    fillRect(img, x, 8.5 - h, 2, h * 2, i & 1 ? cuD : cu);
  }
  fillEllipse(img, 44, 8.5, 2.2, 2.2, rgba(236, 210, 255)); // electrode
  setPx(img, 44, 8, rgba(255, 255, 255));
  return img;
}

function iconSaw() {
  const img = makeImage(48, 20);
  const yel = rgba(226, 182, 36),
    blk = rgba(34, 34, 36),
    steel = rgba(160, 164, 174);
  fillPoly(
    img,
    [
      [2, 7],
      [11, 6],
      [11, 12],
      [3, 13],
    ],
    blk,
  ); // stock
  fillRect(img, 11, 4, 20, 9, yel); // chunky body
  for (let x = 11; x < 31; x += 4)
    fillPoly(
      img,
      [
        [x, 13],
        [x + 2, 13],
        [x + 4, 9],
        [x + 2, 9],
      ],
      blk,
    ); // hazard band
  fillRect(img, 13, 3, 15, 1, blk); // top rail
  fillRect(img, 14, 6, 6, 2, rgba(90, 92, 98)); // motor plate
  fillPoly(
    img,
    [
      [13, 13],
      [17, 13],
      [16, 18],
      [12, 18],
    ],
    blk,
  ); // grip
  fillRect(img, 31, 9, 8, 3, blk); // launch rail
  // sawblade, mostly in front of the body
  const cx = 38.5,
    cy = 7.5;
  for (let y = 0; y < 20; y++)
    for (let x = 30; x < 48; x++) {
      const dx = x + 0.5 - cx,
        dy = y + 0.5 - cy,
        r = Math.hypot(dx, dy);
      const ph = ((((Math.atan2(dy, dx) / (Math.PI * 2)) * 12) % 1) + 1) % 1;
      if (r > 5.2 + (1 - ph) * 1.6) continue;
      setPx(img, x, y, r < 1.6 ? rgba(50, 50, 56) : r > 4.8 ? rgba(200, 204, 212) : steel);
    }
  return img;
}

function finishIcon(img) {
  autoShade(img);
  outline(img, OUTLINE);
  return img;
}

//=============================================================
//                        VIEWMODELS
//=============================================================

// Viewmodels: tiny 3D painter's-algorithm renderer

const VW = 160,
  VH = 120;
const CAM = { cx: 74, cy: 4, f: 100 };
const LIGHT = (() => {
  const l = [0.45, 0.8, -0.42];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function proj(p) {
  const z = Math.max(0.03, p[2]);
  return [CAM.cx + (CAM.f * p[0]) / z, CAM.cy - (CAM.f * p[1]) / z];
}

// Viewmodels use a "fattened" cross-section around the gun's axis (like a narrow
// viewmodel FOV): x/y offsets from the axis are scaled by K, z is untouched.
let AXX = 0,
  AXY = 0,
  K = 1,
  ZOFF = 0;
const FAT = 1.25;
// zoff pushes the whole model further from the camera
function setAxis(x, y, k = 2, zoff = 0) {
  AXX = x;
  AXY = y;
  K = k * FAT;
  ZOFF = zoff;
}
const T = (p) => [AXX + (p[0] - AXX) * K, AXY + (p[1] - AXY) * K, p[2] + ZOFF];
const P = (p) => proj(T(p)); // project a model-space point

// Materials ------------------------------------------------------------------
function M(type, r, g, b, extra = {}) {
  return { type, c: [r, g, b], seed: (r * 7 + g * 13 + b * 17) | 0, ...extra };
}

function shadeFactor(n) {
  const d = Math.max(0, dot(n, LIGHT));
  return 0.3 + 0.8 * d;
}

function matColor(m, s, x, y) {
  const [r, g, b] = m.c;
  const n = hash2(x, y, m.seed) - 0.5;
  switch (m.type) {
    case 'glow': {
      const f = 0.75 + 0.35 * s;
      return glow(r * f, g * f, b * f);
    }
    case 'chrome': {
      const t = Math.min(1, s);
      const k = t * t;
      let f = 0.25 + 1.0 * k + n * 0.05;
      if (t > 0.92) f += 0.25;
      return rgba(r * f + 8, g * f + 8, b * f + 12);
    }
    case 'wood': {
      const gr = valueNoise(x / 1.6, y / 9, 4096, m.seed);
      const f = s * (0.78 + 0.34 * gr + n * 0.06);
      return rgba(r * f, g * f, b * f);
    }
    case 'metal': {
      let f = s * (1 + n * 0.06);
      if (s > 0.95) f += 0.12;
      return rgba(r * f, g * f, b * f);
    }
    case 'cloth': {
      const gr = valueNoise(x / 3, y / 3, 4096, m.seed);
      const f = s * (0.85 + 0.25 * gr + n * 0.1);
      return rgba(r * f, g * f, b * f);
    }
    case 'hazard': {
      // diagonal yellow/black warning stripes
      const band = ((x + y) >> 2) & 1;
      const f = s * (1 + n * 0.06);
      return band ? rgba(34 * f, 32 * f, 28 * f) : rgba(r * f, g * f, b * f);
    }
    case 'glass': {
      // pale glass: bright specular band, darker body
      const t = Math.min(1, s);
      const f = 0.45 + 0.55 * t * t + (t > 0.9 ? 0.3 : 0);
      return rgba(r * f, g * f, b * f);
    }
    case 'perf': {
      // perforated shroud: holes in a grid
      const hole = ((x >> 1) + (y >> 1)) % 3 === 0 && ((x + y) & 1) === 0;
      const f = hole ? 0.25 : s * (1 + n * 0.06);
      return rgba(r * f, g * f, b * f);
    }
    default: {
      const f = s * (1 + n * 0.08);
      return rgba(r * f, g * f, b * f);
    }
  }
}

class Scene {
  constructor() {
    this.items = [];
  }
  // hexahedron from 8 corners: 0..3 near face, 4..7 far face (same winding)
  hexa(c0, mat, caps = true) {
    const c = c0.map(T);
    const idx = [
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ];
    if (caps) idx.push([0, 1, 2, 3], [4, 5, 6, 7]);
    const cen = scl(c.reduce(add, [0, 0, 0]), 1 / 8);
    const faces = idx.map((f) => {
      const pts = f.map((i) => c[i]);
      let n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
      if (Math.hypot(...n) < 1e-9) n = cross(sub(pts[2], pts[0]), sub(pts[3], pts[0]));
      n = norm(n);
      const fc = scl(pts.reduce(add, [0, 0, 0]), 1 / 4);
      if (dot(n, sub(fc, cen)) < 0) n = scl(n, -1);
      return { pts, n };
    });
    this.items.push({ kind: 'faces', faces, mat });
    return this;
  }
  // axis-aligned box, optional far-face rect for taper: far = [x0,x1,y0,y1]
  box(x0, x1, y0, y1, z0, z1, mat, far, caps = true) {
    const [fx0, fx1, fy0, fy1] = far || [x0, x1, y0, y1];
    return this.hexa(
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y1, z0],
        [x0, y1, z0],
        [fx0, fy0, z1],
        [fx1, fy0, z1],
        [fx1, fy1, z1],
        [fx0, fy1, z1],
      ],
      mat,
      caps,
    );
  }
  // prism with chamfered top: bottom half-width hb, top half-width ht, centred on xc
  prism(xc, hb, ht, y0, y1, z0, z1, mat) {
    return this.hexa(
      [
        [xc - hb, y0, z0],
        [xc + hb, y0, z0],
        [xc + ht, y1, z0],
        [xc - ht, y1, z0],
        [xc - hb, y0, z1],
        [xc + hb, y0, z1],
        [xc + ht, y1, z1],
        [xc - ht, y1, z1],
      ],
      mat,
    );
  }
  tube(p0, p1, r0, r1, mat, sides = 12, caps = true) {
    const a = norm(sub(p1, p0));
    let u = cross(a, [0, 1, 0]);
    if (Math.hypot(...u) < 1e-3) u = cross(a, [1, 0, 0]);
    u = norm(u);
    const v = norm(cross(u, a));
    const ring = (p, r, th) => T(add(p, add(scl(u, r * Math.cos(th)), scl(v, r * Math.sin(th)))));
    const faces = [];
    const cap0 = [],
      cap1 = [];
    for (let i = 0; i < sides; i++) {
      const t0 = (i / sides) * Math.PI * 2 + Math.PI / sides,
        t1 = ((i + 1) / sides) * Math.PI * 2 + Math.PI / sides;
      const tm = (t0 + t1) / 2;
      faces.push({
        pts: [ring(p0, r0, t0), ring(p0, r0, t1), ring(p1, r1, t1), ring(p1, r1, t0)],
        n: norm(add(scl(u, Math.cos(tm)), scl(v, Math.sin(tm)))),
      });
      cap0.push(ring(p0, r0, t0));
      cap1.push(ring(p1, r1, t0));
    }
    if (caps) faces.push({ pts: cap0, n: scl(a, -1) }, { pts: cap1, n: a });
    this.items.push({ kind: 'faces', faces, mat });
    return this;
  }
  ball(p, rx, ry, rz, mat) {
    this.items.push({ kind: 'ball', p: T(p), rx: rx * K, ry: ry * K, rz, mat });
    return this;
  }
  fn(f) {
    this.items.push({ kind: 'fn', f });
    return this;
  }

  render(img) {
    for (const it of this.items) {
      if (it.kind === 'fn') {
        it.f(img);
        continue;
      }
      if (it.kind === 'ball') {
        drawBall(img, it);
        continue;
      }
      for (const f of it.faces) {
        const cen = scl(f.pts.reduce(add, [0, 0, 0]), 1 / f.pts.length);
        if (dot(f.n, cen) >= 0) continue; // back-face
        const s = shadeFactor(f.n);
        const p2 = f.pts.map(proj);
        fillPolyFn(img, p2, (x, y) => matColor(it.mat, s, x, y));
      }
    }
  }
}

function drawBall(img, it) {
  const [cx, cy] = proj(it.p);
  const z = Math.max(0.03, it.p[2]);
  const rx = (CAM.f * it.rx) / z,
    ry = (CAM.f * it.ry) / z;
  const y0 = Math.floor(cy - ry),
    y1 = Math.ceil(cy + ry);
  const x0 = Math.floor(cx - rx),
    x1 = Math.ceil(cx + rx);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx,
        ny = -(y + 0.5 - cy) / ry;
      const q = nx * nx + ny * ny;
      if (q > 1 || x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
      const nz = -Math.sqrt(1 - q);
      let s = shadeFactor([nx, ny, nz]);
      s = Math.round(s * 6) / 6; // posterize for pixel-art banding
      img.data[y * img.w + x] = matColor(it.mat, s, x, y);
    }
}

// screen-space line between two model-space points
function line3(img, a, b, c, th = 1) {
  const p = P(a),
    q = P(b);
  drawLine(img, p[0], p[1], q[0], q[1], c, th);
}

//=============================================================
//                           HANDS
//=============================================================

// Hands: painted in screen space (anchored to projected gun points) so the
// fingers, knuckles and creases read clearly at this tiny resolution.

const GLOVE_C = [50, 50, 45];
const GLOVE_HI = [58, 58, 52]; // knuckle / leather patch tone
const SLEEVE_C = [96, 104, 60];
const CUFF_C = [40, 40, 36];
// screen-space light: x right, y down, z toward the viewer (upper-left, in front)
const SL = (() => {
  const l = [-0.5, -0.72, 0.62];
  const n = Math.hypot(...l);
  return l.map((v) => v / n);
})();

function clothPx(col, s, x, y, seed, grain = 1) {
  const n = hash2(x, y, seed) - 0.5;
  const gr = valueNoise(x / (2.2 * grain), y / (2.2 * grain), 4096, seed);
  const f = s * (0.9 + 0.2 * gr + n * 0.07);
  return rgba(col[0] * f, col[1] * f, col[2] * f);
}

// light factor for a 2D-shape normal (nx, ny in screen, nz toward viewer)
function lightOf(nx, ny, nz, amb = 0.34) {
  let s = amb + 1.3 * Math.max(0, nx * SL[0] + ny * SL[1] + nz * SL[2]);
  return Math.round(s * 7) / 7;
}

// Shaded capsule (finger segment, forearm...). rim darkens the silhouette so
// overlapping fingers stay separated by a crease.
function capsule(img, ax, ay, bx, by, ra, rb, col, o = {}) {
  const rim = o.rim ?? 0.8,
    seed = o.seed ?? 3,
    grain = o.grain ?? 1,
    bright = o.bright ?? 1;
  const dx = bx - ax,
    dy = by - ay,
    L2 = dx * dx + dy * dy || 1e-6;
  const R = Math.max(ra, rb);
  const x0 = Math.floor(Math.min(ax, bx) - R - 1),
    x1 = Math.ceil(Math.max(ax, bx) + R + 1);
  const y0 = Math.floor(Math.min(ay, by) - R - 1),
    y1 = Math.ceil(Math.max(ay, by) + R + 1);
  for (let y = Math.max(0, y0); y <= Math.min(img.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(img.w - 1, x1); x++) {
      const px = x + 0.5,
        py = y + 0.5;
      let t = ((px - ax) * dx + (py - ay) * dy) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = ax + dx * t,
        cy = ay + dy * t,
        r = ra + (rb - ra) * t;
      const ex = px - cx,
        ey = py - cy,
        d = Math.hypot(ex, ey);
      if (d > r) continue;
      const q = d / r;
      const nz = Math.sqrt(Math.max(0, 1 - q * q));
      let s = lightOf(ex / r, ey / r, nz, o.amb) * bright;
      if (q > rim) s *= 0.62;
      img.data[y * img.w + x] = clothPx(col, s, x, y, seed, grain);
    }
}

// Shaded rotated ellipse (palm, back of hand). ang = rotation of the rx axis.
function blob(img, cx, cy, rx, ry, ang, col, o = {}) {
  const rim = o.rim ?? 0.86,
    seed = o.seed ?? 5,
    bright = o.bright ?? 1;
  const ca = Math.cos(ang),
    sa = Math.sin(ang),
    R = Math.max(rx, ry);
  for (
    let y = Math.max(0, Math.floor(cy - R - 1));
    y <= Math.min(img.h - 1, Math.ceil(cy + R + 1));
    y++
  )
    for (
      let x = Math.max(0, Math.floor(cx - R - 1));
      x <= Math.min(img.w - 1, Math.ceil(cx + R + 1));
      x++
    ) {
      const px = x + 0.5 - cx,
        py = y + 0.5 - cy;
      const u = (px * ca + py * sa) / rx,
        v = (-px * sa + py * ca) / ry;
      const q2 = u * u + v * v;
      if (q2 > 1) continue;
      const nz = Math.sqrt(1 - q2);
      // back to screen-space normal
      const nx = u * ca - v * sa,
        ny = u * sa + v * ca;
      let s = lightOf(nx * 0.8, ny * 0.8, nz, o.amb) * bright;
      if (Math.sqrt(q2) > rim) s *= 0.62;
      img.data[y * img.w + x] = clothPx(col, s, x, y, seed);
    }
}

// Polyline finger made of capsules with joint creases and a knuckle highlight.
function finger(img, pts, r0, r1, col = GLOVE_C, seed = 7) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + (r1 - r0) * (i / n),
      rb = r0 + (r1 - r0) * ((i + 1) / n);
    capsule(img, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], ra, rb, col, {
      seed: seed + i,
      rim: 0.74,
    });
  }
}

// Sleeve + glove cuff from offscreen point O to wrist W (radii in px).
function forearm(img, O, Wr, rO, rW) {
  const dx = Wr[0] - O[0],
    dy = Wr[1] - O[1],
    L = Math.hypot(dx, dy);
  const ux = dx / L,
    uy = dy / L;
  const cuff = [Wr[0] - ux * rW * 1.5, Wr[1] - uy * rW * 1.5];
  capsule(img, O[0], O[1], cuff[0], cuff[1], rO, rW * 1.18, SLEEVE_C, {
    seed: 21,
    grain: 1.6,
    rim: 0.88,
    amb: 0.36,
    bright: 0.85,
  });
  // sleeve folds
  for (let k = 1; k < 4; k++) {
    const t = 0.25 + k * 0.17,
      fx = O[0] + (cuff[0] - O[0]) * t,
      fy = O[1] + (cuff[1] - O[1]) * t;
    const r = (rO + (rW * 1.18 - rO) * t) * 0.8;
    drawLine(
      img,
      fx - uy * r * 0.2 - ux * 1.5,
      fy + ux * r * 0.2 - uy * 1.5,
      fx + uy * r * 0.9,
      fy - ux * r * 0.9,
      rgba(62, 68, 38),
    );
  }
  capsule(img, cuff[0], cuff[1], Wr[0], Wr[1], rW * 1.08, rW, CUFF_C, { seed: 23, rim: 0.84 });
}

// Support hand gripping a foregrip from below-left.
// A = screen point on the LEFT flank of the foregrip where the fingertips end,
// V = gun vanishing point (the "forward" direction on screen), s = finger radius,
// O = offscreen point the forearm comes from (lower-left).
function supportHand(img, A, s, O = [-20, 150], V = [74, 4]) {
  let ux = V[0] - A[0],
    uy = V[1] - A[1];
  const ul = Math.hypot(ux, uy);
  ux /= ul;
  uy /= ul; // forward along the gun
  const nx = uy,
    ny = -ux; // left of the gun
  const at = (a, b) => [A[0] + ux * a + nx * b, A[1] + uy * a + ny * b];
  // palm, underneath and left of the grip; wrist further back
  const palm = at(-1.2 * s, 3.4 * s);
  const wrist = at(-4.6 * s, 4.8 * s);
  forearm(img, O, wrist, 5.2 * s, 3.1 * s);
  const ang = Math.atan2(uy, ux);
  blob(img, palm[0], palm[1], 4.8 * s, 3.6 * s, ang, GLOVE_C, { seed: 31 });
  blob(
    img,
    wrist[0] * 0.4 + palm[0] * 0.6,
    wrist[1] * 0.4 + palm[1] * 0.6,
    3.6 * s,
    3.3 * s,
    ang,
    GLOVE_C,
    { seed: 33 },
  );
  // four fingers curling up round the left flank, pinky nearest the camera
  for (let i = 3; i >= 0; i--) {
    const a = (i - 1.6) * 1.75 * s,
      k = 1 - i * 0.045;
    const r = s * (0.98 - (i === 0 ? 0.16 : 0)) * k;
    const base = at(a - 0.4 * s, 2.7 * s);
    const mid = at(a + 0.75 * s, 1.45 * s);
    const tip = at(a + 0.35 * s, 0.05 * s);
    finger(img, [base, mid, tip], r * 1.08, r * 0.9, GLOVE_C, 40 + i);
    // knuckle highlight on the middle joint
    setPx(img, mid[0] - 0.6, mid[1] - 0.9, clothPx(GLOVE_HI, 1.55, mid[0], mid[1], 9));
  }
  // knuckle ridge line across the back of the hand
  const k0 = at(-3.2 * s, 3.1 * s),
    k1 = at(3.4 * s, 2.9 * s);
  drawLine(img, k0[0], k0[1], k1[0], k1[1], rgba(30, 30, 27));
  // stitch seam on the back of the glove
  for (let i = 0; i < 4; i++) {
    const p = at(-1.6 * s - i * s * 0.9, 4.4 * s + i * 0.25 * s);
    setPx(img, p[0], p[1], rgba(34, 34, 30));
  }
}

// support hand on a foregrip; p = model-space point on the foregrip's left flank
function gripFore(S, p, s, O) {
  S.fn((img) => supportHand(img, P(p), s, O));
}

function finishVM(S, muzzle3) {
  const img = makeImage(VW, VH);
  S.render(img);
  outline(img, OUTLINE);
  const m = P(muzzle3).map((v) => Math.round(v));
  return { img, muzzle: { x: m[0], y: m[1] } };
}

// Two-handed handgun grip seen from behind, painted in screen space.
// BL/BR = bottom-left/right corners of the slide (or frame) at its rear,
// FL = bottom-left corner further forward (gives the 'forward' direction).
function handgunHands(img, BL, BR, FL) {
  const W = BR[0] - BL[0],
    k = W / 30,
    yb = (BL[1] + BR[1]) / 2,
    xl = BL[0],
    xr = BR[0],
    xc = (xl + xr) / 2;
  const fx = FL[0] - BL[0],
    fy = FL[1] - BL[1];
  const fwd = (t, ox, oy) => [xl + fx * t + ox * k, BL[1] + fy * t + oy * k];
  const s = 2.6 * k;
  // support (left) hand: forearm from lower-left, palm cupping the grip's left side
  forearm(img, [xl - 30 * k, yb + 52 * k], [xl - 2 * k, yb + 25 * k], 9.5 * k, 7.5 * k);
  // its fingers wrap round the front of the grip, under the right hand's fingers
  for (let i = 2; i >= 0; i--) {
    const y = yb + (19 + i * 5.4) * k;
    finger(
      img,
      [
        [xc - 2 * k, y],
        [xr + 1 * k, y - 1 * k],
        [xr + 5 * k, y + 2.5 * k],
      ],
      s * (1.05 - i * 0.05),
      s * 0.85,
      GLOVE_C,
      60 + i,
    );
  }
  blob(img, xl + 1 * k, yb + 17 * k, 9 * k, 12 * k, 0.3, GLOVE_C, { seed: 64 });
  // right hand: fingers wrapping the front-right of the grip (peek out right)
  for (let i = 2; i >= 0; i--) {
    const y = yb + (6.5 + i * 5) * k;
    finger(
      img,
      [
        [xc + 4 * k, y],
        [xr + 1.5 * k, y - 0.5 * k],
        [xr + 4.5 * k, y + 2.5 * k],
      ],
      s * 1.05,
      s * 0.9,
      GLOVE_C,
      50 + i,
    );
  }
  forearm(img, [xr + 34 * k, yb + 50 * k], [xr + 4 * k, yb + 25 * k], 10 * k, 8 * k);
  // back of the hand: wide where it wraps under the slide, narrowing to the wrist
  blob(img, xc + 5 * k, yb + 15 * k, 12 * k, 11 * k, 0.75, GLOVE_C, { seed: 70 });
  blob(img, xc + 0.5 * k, yb + 5.5 * k, 11.5 * k, 5.5 * k, 0.12, GLOVE_C, { seed: 76 });
  // knuckle ridge + tendons on the back of the hand
  for (let i = 0; i < 3; i++) {
    const kx = xr - 1.5 * k + i * 0.3 * k,
      ky = yb + (5 + i * 5) * k;
    setPx(img, kx, ky, clothPx(GLOVE_HI, 1.45, kx, ky, 2));
    setPx(img, kx + 1, ky, clothPx(GLOVE_HI, 1.3, kx, ky, 3));
  }
  drawLine(img, xc + 2 * k, yb + 10 * k, xc + 8 * k, yb + 24 * k, rgba(32, 32, 28));
  drawLine(img, xc + 8 * k, yb + 9 * k, xc + 13 * k, yb + 20 * k, rgba(34, 34, 30));
  // left thumb, then right thumb on top: forward along the frame below the slide
  finger(
    img,
    [[xl + 1 * k, yb + 12 * k], fwd(0.12, -3.5, 6), fwd(0.3, -2.5, 4.5)],
    s * 1.35,
    s * 1.05,
    GLOVE_C,
    66,
  );
  finger(
    img,
    [[xl + 6 * k, yb + 5 * k], fwd(0.1, -2, 1.8), fwd(0.27, -1.2, 0.8)],
    s * 1.4,
    s * 1.1,
    GLOVE_C,
    78,
  );
  const t = fwd(0.27, -1.6, 0.2);
  setPx(img, t[0], t[1], clothPx(GLOVE_HI, 1.5, 0, 0, 1));
}

function vmPistol() {
  const gx = 0.024,
    gy = -0.122,
    z0 = 0.06;
  setAxis(gx, gy, 1.9);
  const S = new Scene();
  const slide = M('metal', 88, 92, 104),
    frame = M('matte', 48, 50, 56),
    dark = M('matte', 26, 26, 30);
  const Z = (v) => v + z0;
  // grip (raked back) under the rear of the frame
  S.hexa(
    [
      [gx - 0.011, gy - 0.03, Z(0.162)],
      [gx + 0.011, gy - 0.03, Z(0.162)],
      [gx + 0.011, gy - 0.1, Z(0.14)],
      [gx - 0.011, gy - 0.1, Z(0.14)],
      [gx - 0.011, gy - 0.03, Z(0.205)],
      [gx + 0.011, gy - 0.03, Z(0.205)],
      [gx + 0.011, gy - 0.1, Z(0.185)],
      [gx - 0.011, gy - 0.1, Z(0.185)],
    ],
    M('matte', 36, 36, 40),
  );
  S.box(gx - 0.003, gx + 0.003, gy - 0.054, gy - 0.04, Z(0.205), Z(0.25), frame); // trigger guard
  S.box(gx - 0.012, gx + 0.012, gy - 0.04, gy - 0.022, Z(0.16), Z(0.32), frame); // frame / dust cover
  S.prism(gx, 0.015, 0.0095, gy - 0.024, gy, Z(0.16), Z(0.33), slide); // slide (chamfered)
  S.fn((img) => {
    for (let i = 0; i < 5; i++) {
      // rear serrations on the left face
      const z = Z(0.168 + i * 0.008);
      line3(img, [gx - 0.015, gy - 0.004, z], [gx - 0.015, gy - 0.024, z], rgba(36, 38, 44));
    }
    line3(
      img,
      [gx - 0.015, gy - 0.026, Z(0.16)],
      [gx - 0.015, gy - 0.026, Z(0.33)],
      rgba(40, 42, 48),
    );
    // ejection port on top-right
    const a = P([gx + 0.001, gy, Z(0.235)]),
      b = P([gx + 0.008, gy, Z(0.285)]);
    fillRect(img, a[0], b[1], Math.max(2, b[0] - a[0]), a[1] - b[1], rgba(28, 28, 32));
    // rear face: striker plate
    const c = P([gx - 0.004, gy - 0.012, Z(0.16)]),
      d = P([gx + 0.004, gy - 0.02, Z(0.16)]);
    fillRect(img, c[0], c[1], d[0] - c[0], d[1] - c[1], rgba(50, 52, 60));
  });
  // rear sight (two posts with notch) and front sight
  S.box(gx - 0.0085, gx - 0.0025, gy, gy + 0.005, Z(0.162), Z(0.17), dark);
  S.box(gx + 0.0025, gx + 0.0085, gy, gy + 0.005, Z(0.162), Z(0.17), dark);
  S.box(gx - 0.0025, gx + 0.0025, gy, gy + 0.008, Z(0.31), Z(0.32), dark);
  S.fn((img) => {
    const p = P([gx, gy + 0.006, Z(0.315)]);
    setPx(img, p[0], p[1], glow(220, 255, 200));
  });
  S.fn((img) =>
    handgunHands(
      img,
      P([gx - 0.015, gy - 0.024, Z(0.16)]),
      P([gx + 0.015, gy - 0.024, Z(0.16)]),
      P([gx - 0.015, gy - 0.024, Z(0.33)]),
    ),
  );
  return finishVM(S, [gx, gy - 0.014, Z(0.335)]);
}

function vmShotgun() {
  const gx = 0.03,
    gy = -0.1;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const steel = M('metal', 78, 80, 88),
    recv = M('metal', 64, 64, 70),
    wood = M('wood', 152, 92, 44),
    woodD = M('wood', 112, 66, 32);
  S.tube([gx, gy - 0.033, 0.27], [gx, gy - 0.033, 0.6], 0.0095, 0.0095, M('metal', 54, 54, 60)); // mag tube
  S.tube([gx, gy - 0.011, 0.27], [gx, gy - 0.011, 0.64], 0.011, 0.011, steel); // barrel
  S.tube([gx, gy - 0.035, 0.34], [gx, gy - 0.035, 0.47], 0.019, 0.019, wood); // pump
  for (let i = 0; i < 6; i++) {
    const z = 0.355 + i * 0.019;
    S.tube([gx, gy - 0.035, z], [gx, gy - 0.035, z + 0.006], 0.0196, 0.0196, woodD, 12, false);
  }
  S.ball([gx, gy + 0.001, 0.632], 0.003, 0.003, 0.003, M('metal', 230, 225, 200));
  S.box(gx - 0.02, gx + 0.02, gy - 0.045, gy, 0.1, 0.27, recv); // receiver
  S.fn((img) => {
    line3(img, [gx + 0.02, gy - 0.01, 0.17], [gx + 0.02, gy - 0.01, 0.24], rgba(20, 20, 22), 2); // ejection port
    line3(img, [gx - 0.02, gy - 0.032, 0.11], [gx - 0.02, gy - 0.032, 0.26], rgba(46, 46, 50));
    line3(img, [gx, gy, 0.11], [gx, gy, 0.26], rgba(96, 98, 106)); // top rib groove highlight
  });
  gripFore(S, [gx - 0.019, gy - 0.035, 0.4], 2.6);
  return finishVM(S, [gx, gy - 0.011, 0.65]);
}

function vmSmg() {
  const gx = 0.028,
    gy = -0.11;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const blk = M('metal', 56, 56, 62),
    blk2 = M('matte', 38, 38, 42),
    dark = M('matte', 22, 22, 24);
  S.tube([gx, gy - 0.02, 0.34], [gx, gy - 0.02, 0.41], 0.013, 0.013, blk2); // shroud
  S.tube([gx, gy - 0.02, 0.41], [gx, gy - 0.02, 0.44], 0.007, 0.007, blk);
  S.box(gx - 0.008, gx + 0.008, gy - 0.12, gy - 0.035, 0.27, 0.295, blk2); // magazine
  S.prism(gx, 0.018, 0.013, gy - 0.042, gy, 0.11, 0.34, blk); // receiver
  S.fn((img) => {
    line3(img, [gx - 0.018, gy - 0.012, 0.22], [gx - 0.018, gy - 0.012, 0.31], rgba(18, 18, 20)); // charging slot
    line3(img, [gx + 0.018, gy - 0.014, 0.22], [gx + 0.018, gy - 0.014, 0.28], rgba(18, 18, 20), 2);
    line3(img, [gx - 0.018, gy - 0.03, 0.12], [gx - 0.018, gy - 0.03, 0.33], rgba(36, 36, 40));
  });
  S.box(gx - 0.008, gx + 0.008, gy, gy + 0.004, 0.12, 0.33, blk2); // top rail
  for (let i = 0; i < 10; i++) {
    const z = 0.13 + i * 0.02;
    S.box(gx - 0.009, gx + 0.009, gy + 0.004, gy + 0.007, z, z + 0.009, blk);
  }
  S.box(gx - 0.002, gx + 0.002, gy - 0.008, gy + 0.012, 0.39, 0.4, dark); // front post
  S.box(gx - 0.007, gx - 0.002, gy + 0.007, gy + 0.013, 0.135, 0.14, dark); // rear sight ears
  S.box(gx + 0.002, gx + 0.007, gy + 0.007, gy + 0.013, 0.135, 0.14, dark);
  gripFore(S, [gx - 0.018, gy - 0.025, 0.3], 2.8);
  return finishVM(S, [gx, gy - 0.02, 0.45]);
}

function vmRifle() {
  const gx = 0.03,
    gy = -0.102;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const blk = M('metal', 58, 60, 56),
    tan = M('matte', 178, 156, 108),
    olive = M('matte', 92, 100, 62),
    dark = M('matte', 24, 24, 24);
  S.tube([gx, gy - 0.022, 0.5], [gx, gy - 0.022, 0.6], 0.0075, 0.0075, blk); // barrel
  S.tube([gx, gy - 0.022, 0.6], [gx, gy - 0.022, 0.63], 0.0105, 0.0105, M('metal', 40, 40, 40), 8); // flash hider
  S.box(gx - 0.008, gx + 0.008, gy - 0.02, gy + 0.004, 0.5, 0.515, blk, [
    gx - 0.003,
    gx + 0.003,
    gy - 0.02,
    gy + 0.03,
  ]); // A-frame sight
  S.box(gx - 0.02, gx + 0.02, gy - 0.046, gy - 0.002, 0.24, 0.5, olive); // handguard
  S.fn((img) => {
    for (let i = 0; i < 6; i++) {
      const z = 0.26 + i * 0.038;
      line3(img, [gx - 0.02, gy - 0.016, z], [gx - 0.02, gy - 0.016, z + 0.014], rgba(34, 38, 22));
      line3(img, [gx - 0.02, gy - 0.03, z], [gx - 0.02, gy - 0.03, z + 0.014], rgba(34, 38, 22));
      line3(
        img,
        [gx - 0.009, gy - 0.002, z],
        [gx - 0.009, gy - 0.002, z + 0.014],
        rgba(52, 58, 34),
      );
      line3(
        img,
        [gx + 0.009, gy - 0.002, z],
        [gx + 0.009, gy - 0.002, z + 0.014],
        rgba(52, 58, 34),
      );
    }
  });
  S.box(gx - 0.018, gx + 0.018, gy - 0.045, gy, 0.1, 0.24, tan); // receiver
  S.box(gx - 0.007, gx + 0.007, gy, gy + 0.004, 0.11, 0.24, M('matte', 42, 44, 42)); // rail
  S.fn((img) => {
    line3(img, [gx + 0.018, gy - 0.012, 0.15], [gx + 0.018, gy - 0.012, 0.21], rgba(20, 20, 20), 2);
    line3(img, [gx - 0.018, gy - 0.03, 0.11], [gx - 0.018, gy - 0.03, 0.235], rgba(110, 94, 62));
  });
  // red-dot optic
  S.box(gx - 0.01, gx + 0.01, gy + 0.004, gy + 0.01, 0.17, 0.23, blk);
  S.tube([gx, gy + 0.021, 0.17], [gx, gy + 0.021, 0.23], 0.012, 0.012, M('metal', 54, 56, 54), 10);
  S.fn((img) => {
    const p = P([gx, gy + 0.021, 0.17]);
    const r = (CAM.f * 0.009 * K) / 0.17;
    fillEllipse(img, p[0], p[1], r, r, rgba(26, 32, 40));
    fillEllipse(img, p[0] - r * 0.3, p[1] - r * 0.35, r * 0.35, r * 0.28, rgba(80, 100, 120));
    const q = P([gx, gy + 0.021, 0.23]);
    fillRect(img, q[0] - 1, q[1] - 1, 2, 2, glow(255, 40, 30));
  });
  gripFore(S, [gx - 0.02, gy - 0.024, 0.38], 2.6);
  return finishVM(S, [gx, gy - 0.022, 0.64]);
}

function vmMagnum() {
  const gx = 0.024,
    gy = -0.104;
  setAxis(gx, gy, 1.9, 0.065);
  const S = new Scene();
  const chrome = M('chrome', 150, 156, 172),
    chromeB = M('chrome', 190, 196, 210),
    chromeD = M('chrome', 112, 116, 130),
    dark = M('matte', 30, 30, 34);
  // barrel (farthest) with full-length underlug and vent rib
  S.box(gx - 0.009, gx + 0.009, gy - 0.036, gy - 0.004, 0.25, 0.44, chrome);
  S.box(gx - 0.005, gx + 0.005, gy - 0.004, gy + 0.002, 0.25, 0.44, chromeB);
  S.fn((img) => {
    for (let i = 0; i < 6; i++) {
      const z = 0.27 + i * 0.03;
      line3(img, [gx - 0.005, gy - 0.001, z], [gx + 0.005, gy - 0.001, z], rgba(70, 72, 80));
    }
  });
  S.box(gx - 0.0025, gx + 0.0025, gy + 0.002, gy + 0.011, 0.42, 0.436, M('matte', 210, 60, 30)); // red ramp sight
  // cylinder (fluted, 8 sides)
  S.tube([gx, gy - 0.022, 0.198], [gx, gy - 0.022, 0.252], 0.024, 0.024, chrome, 8);
  S.fn((img) => {
    for (let i = 0; i < 8; i++) {
      const th = (i / 8) * Math.PI * 2;
      const ox = Math.cos(th) * 0.0245,
        oy = Math.sin(th) * 0.0245;
      if (oy < -0.005 || ox > 0.02) continue;
      line3(
        img,
        [gx + ox, gy - 0.022 + oy, 0.204],
        [gx + ox, gy - 0.022 + oy, 0.246],
        rgba(60, 62, 70),
      );
    }
  });
  S.box(gx - 0.012, gx + 0.012, gy - 0.045, gy - 0.008, 0.16, 0.2, chromeD); // rear frame
  S.box(gx - 0.006, gx + 0.006, gy - 0.008, gy - 0.002, 0.165, 0.255, chromeB); // top strap
  S.box(gx - 0.008, gx - 0.003, gy - 0.002, gy + 0.004, 0.168, 0.174, dark); // rear sight
  S.box(gx + 0.003, gx + 0.008, gy - 0.002, gy + 0.004, 0.168, 0.174, dark);
  S.box(gx - 0.003, gx + 0.003, gy - 0.006, gy + 0.006, 0.154, 0.164, M('metal', 60, 60, 66), [
    gx - 0.003,
    gx + 0.003,
    gy - 0.006,
    gy,
  ]); // hammer spur
  S.fn((img) => {
    const p = P([gx, gy + 0.008, 0.152]);
    fillRect(img, p[0] - 1, p[1], 3, 1, rgba(70, 70, 76));
  });
  S.fn((img) =>
    handgunHands(
      img,
      P([gx - 0.016, gy - 0.02, 0.16]),
      P([gx + 0.016, gy - 0.02, 0.16]),
      P([gx - 0.016, gy - 0.02, 0.26]),
    ),
  );
  return finishVM(S, [gx, gy - 0.02, 0.45]);
}

function vmLmg() {
  const gx = 0.032,
    gy = -0.098;
  setAxis(gx, gy, 1.75);
  const S = new Scene();
  const ol = M('matte', 98, 110, 64),
    olD = M('matte', 74, 84, 48),
    blk = M('metal', 54, 54, 56),
    dark = M('matte', 26, 26, 26);
  S.tube([gx, gy - 0.025, 0.62], [gx, gy - 0.025, 0.65], 0.013, 0.013, dark, 6); // flash hider
  S.tube([gx, gy - 0.025, 0.54], [gx, gy - 0.025, 0.62], 0.009, 0.009, blk);
  S.box(gx - 0.003, gx + 0.003, gy - 0.008, gy + 0.016, 0.52, 0.53, dark); // front post
  S.box(gx - 0.02, gx - 0.014, gy - 0.05, gy - 0.044, 0.4, 0.56, blk); // folded bipod
  S.box(gx + 0.014, gx + 0.02, gy - 0.05, gy - 0.044, 0.4, 0.56, blk);
  S.tube([gx, gy - 0.025, 0.33], [gx, gy - 0.025, 0.54], 0.02, 0.02, M('perf', 60, 60, 62)); // shroud
  // box magazine on the left side
  S.box(gx - 0.066, gx - 0.026, gy - 0.085, gy - 0.03, 0.19, 0.27, M('matte', 118, 128, 80));
  S.box(gx - 0.068, gx - 0.024, gy - 0.036, gy - 0.028, 0.186, 0.274, olD);
  S.fn((img) => {
    line3(img, [gx - 0.066, gy - 0.055, 0.2], [gx - 0.066, gy - 0.055, 0.26], rgba(210, 196, 120));
    line3(img, [gx - 0.066, gy - 0.062, 0.2], [gx - 0.066, gy - 0.062, 0.235], rgba(210, 196, 120));
  });
  S.box(gx - 0.026, gx + 0.026, gy - 0.06, gy, 0.11, 0.33, ol); // receiver
  S.box(gx - 0.024, gx + 0.024, gy, gy + 0.006, 0.15, 0.31, olD); // feed cover
  S.fn((img) => {
    for (let i = 0; i < 6; i++) {
      const z = 0.17 + i * 0.024;
      line3(img, [gx - 0.02, gy + 0.006, z], [gx + 0.02, gy + 0.006, z], rgba(56, 64, 36));
    }
    line3(img, [gx - 0.026, gy - 0.02, 0.12], [gx - 0.026, gy - 0.02, 0.32], rgba(60, 68, 38));
    for (let i = 0; i < 4; i++) {
      // belt rounds entering on the left
      const a = P([gx - 0.027, gy - 0.036, 0.2 + i * 0.017]);
      fillRect(img, a[0] - 4, a[1] - 1, 5, 3, rgba(214, 172, 82));
      setPx(img, a[0] - 4, a[1] - 1, rgba(250, 222, 150));
    }
  });
  S.tube([gx - 0.026, gy + 0.006, 0.16], [gx + 0.026, gy + 0.006, 0.16], 0.004, 0.004, blk, 6); // hinge
  // carry handle
  S.box(gx - 0.006, gx + 0.006, gy + 0.03, gy + 0.038, 0.23, 0.315, blk);
  S.box(gx - 0.004, gx + 0.004, gy + 0.006, gy + 0.03, 0.3, 0.31, blk);
  S.box(gx - 0.004, gx + 0.004, gy + 0.006, gy + 0.03, 0.235, 0.245, blk);
  gripFore(S, [gx - 0.025, gy - 0.025, 0.4], 2.6);
  return finishVM(S, [gx, gy - 0.025, 0.66]);
}

function vmRail() {
  const gx = 0.028,
    gy = -0.102;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const wht = M('metal', 226, 230, 236),
    gry = M('metal', 138, 144, 156),
    drk = M('metal', 62, 66, 76);
  const cyan = M('glow', 90, 230, 255),
    cyanD = M('glow', 30, 150, 210);
  // twin prongs + glowing channel (farthest parts first)
  S.box(gx - 0.006, gx + 0.006, gy - 0.034, gy - 0.02, 0.33, 0.66, cyanD);
  S.tube(
    [gx, gy - 0.025, 0.33],
    [gx, gy - 0.025, 0.66],
    0.0035,
    0.0035,
    M('glow', 210, 255, 255),
    6,
  );
  S.box(gx - 0.02, gx - 0.007, gy - 0.044, gy - 0.008, 0.33, 0.68, gry, [
    gx - 0.016,
    gx - 0.006,
    gy - 0.04,
    gy - 0.014,
  ]);
  S.box(gx + 0.007, gx + 0.02, gy - 0.044, gy - 0.008, 0.33, 0.68, gry, [
    gx + 0.006,
    gx + 0.016,
    gy - 0.04,
    gy - 0.014,
  ]);
  S.fn((img) => {
    line3(
      img,
      [gx - 0.0085, gy - 0.009, 0.35],
      [gx - 0.0075, gy - 0.0145, 0.66],
      glow(120, 240, 255),
    );
    line3(
      img,
      [gx + 0.0085, gy - 0.009, 0.35],
      [gx + 0.0075, gy - 0.0145, 0.66],
      glow(120, 240, 255),
    );
    for (let i = 0; i < 5; i++) {
      const p = P([gx - 0.013, gy - 0.009 - i * 0.001, 0.38 + i * 0.06]);
      setPx(img, p[0], p[1], glow(200, 250, 255));
    }
  });
  // main body tapered
  const bz0 = 0.1,
    bz1 = 0.345;
  S.box(gx - 0.022, gx + 0.022, gy - 0.05, gy, bz0, bz1, wht, [
    gx - 0.016,
    gx + 0.016,
    gy - 0.044,
    gy - 0.008,
  ]);
  S.fn((img) => {
    // panel lines
    line3(img, [gx - 0.022, gy - 0.03, bz0], [gx - 0.016, gy - 0.03, bz1], rgba(120, 126, 136));
    line3(img, [gx - 0.011, gy, bz0], [gx - 0.008, gy - 0.008, bz1], rgba(170, 176, 186));
    line3(img, [gx + 0.011, gy, bz0], [gx + 0.008, gy - 0.008, bz1], rgba(170, 176, 186));
  });
  // coil rings (emissive), open-ended so they only wrap the body
  for (let i = 0; i < 4; i++) {
    const z = 0.15 + i * 0.05;
    const t = (z - bz0) / (bz1 - bz0);
    const hw = 0.022 - 0.006 * t + 0.0015,
      top = gy - 0.008 * t + 0.0015,
      bot = gy - 0.05 + 0.006 * t - 0.0015;
    S.box(
      gx - hw - 0.002,
      gx + hw + 0.002,
      bot - 0.002,
      top + 0.002,
      z,
      z + 0.018,
      cyan,
      null,
      false,
    );
  }
  S.box(gx - 0.006, gx + 0.006, gy, gy + 0.012, 0.11, 0.3, gry, [
    gx - 0.003,
    gx + 0.003,
    gy - 0.006,
    gy + 0.002,
  ]); // top fin
  S.fn((img) => {
    const p = P([gx, gy + 0.011, 0.13]);
    fillRect(img, p[0] - 1, p[1], 3, 2, glow(255, 80, 60));
  }); // status LED
  gripFore(S, [gx - 0.02, gy - 0.03, 0.4], 2.6);
  return finishVM(S, [gx, gy - 0.025, 0.69]);
}

function vmPlasma() {
  const gx = 0.03,
    gy = -0.112;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const body = M('metal', 122, 140, 122),
    bodyD = M('metal', 84, 98, 86),
    dark = M('matte', 40, 48, 42);
  const green = M('glow', 90, 255, 120);
  // emitter cone + rings (far)
  S.tube([gx, gy - 0.026, 0.33], [gx, gy - 0.026, 0.5], 0.025, 0.011, bodyD, 12);
  for (let i = 0; i < 3; i++) {
    const z = 0.36 + i * 0.04,
      r = 0.0235 - i * 0.0042;
    S.tube([gx, gy - 0.026, z], [gx, gy - 0.026, z + 0.01], r + 0.002, r + 0.0012, dark, 12, false);
  }
  S.tube([gx, gy - 0.026, 0.5], [gx, gy - 0.026, 0.512], 0.012, 0.012, green, 12);
  // rounded main body (lathe of segments)
  const prof = [
    [0.09, 0.03],
    [0.14, 0.033],
    [0.24, 0.033],
    [0.3, 0.03],
    [0.34, 0.026],
  ];
  for (let i = prof.length - 2; i >= 0; i--)
    S.tube(
      [gx, gy - 0.026, prof[i][0]],
      [gx, gy - 0.026, prof[i + 1][0]],
      prof[i][1],
      prof[i + 1][1],
      body,
      14,
    );
  S.fn((img) => {
    // glowing vent slits on the left flank + seam
    for (let i = 0; i < 3; i++) {
      const z = 0.25 + i * 0.022;
      line3(img, [gx - 0.03, gy - 0.018, z], [gx - 0.03, gy - 0.034, z], glow(60, 220, 100), 1.3);
    }
    line3(img, [gx - 0.033, gy - 0.026, 0.1], [gx - 0.03, gy - 0.026, 0.33], rgba(70, 84, 72));
  });
  S.box(gx - 0.003, gx + 0.003, gy + 0.004, gy + 0.016, 0.28, 0.33, bodyD, [
    gx - 0.002,
    gx + 0.002,
    gy + 0.004,
    gy + 0.008,
  ]); // fin
  // orb chamber: dark cradle, glowing orb, cage bars
  S.box(gx - 0.02, gx + 0.02, gy - 0.002, gy + 0.01, 0.17, 0.26, dark);
  S.fn((img) => {
    const p = P([gx, gy + 0.02, 0.215]);
    const r = (CAM.f * 0.019 * K) / 0.215;
    for (let y = Math.floor(p[1] - r); y <= p[1] + r; y++)
      for (let x = Math.floor(p[0] - r); x <= p[0] + r; x++) {
        const d = Math.hypot(x + 0.5 - p[0], y + 0.5 - p[1]) / r;
        if (d > 1) continue;
        const hl = Math.hypot(x + 0.5 - (p[0] + r * 0.3), y + 0.5 - (p[1] - r * 0.35)) / r;
        let c;
        if (hl < 0.2) c = glow(245, 255, 245);
        else if (d < 0.4) c = glow(180, 255, 180);
        else if (d < 0.72) c = glow(90, 245, 120);
        else c = glow(30, 175, 70);
        setPx(img, x, y, c);
      }
  });
  for (const i of [-1, 1])
    S.box(gx + i * 0.015 - 0.003, gx + i * 0.015 + 0.003, gy, gy + 0.03, 0.19, 0.24, dark, [
      gx + i * 0.013 - 0.003,
      gx + i * 0.013 + 0.003,
      gy,
      gy + 0.026,
    ]);
  S.box(gx - 0.018, gx + 0.018, gy + 0.03, gy + 0.036, 0.205, 0.225, dark);
  gripFore(S, [gx - 0.024, gy - 0.026, 0.36], 2.6);
  return finishVM(S, [gx, gy - 0.026, 0.52]);
}

// --- Twin Widow: sawed-off side-by-side double barrel ----------------------
function vmDbarrel() {
  const gx = 0.03,
    gy = -0.1;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const blued = M('metal', 60, 68, 88),
    bluedD = M('metal', 40, 45, 58),
    wood = M('wood', 112, 64, 32),
    dark = M('matte', 14, 14, 16);
  const bz0 = 0.17,
    bz1 = 0.46,
    br = 0.0112,
    bx = 0.0132,
    by = gy - 0.012;
  // walnut forend: wider than the barrels so it shows either side of them
  S.box(gx - 0.031, gx + 0.031, gy - 0.034, gy - 0.014, 0.19, 0.33, wood, [
    gx - 0.028,
    gx + 0.028,
    gy - 0.032,
    gy - 0.014,
  ]);
  S.fn((img) => {
    for (let i = 0; i < 6; i++) {
      const z = 0.2 + i * 0.022;
      line3(img, [gx - 0.031, gy - 0.018, z], [gx - 0.031, gy - 0.03, z], rgba(62, 34, 16));
    }
  });
  // two short barrels side by side, dark valley between them
  S.box(gx - 0.005, gx + 0.005, gy - 0.022, gy - 0.006, bz0, bz1, dark);
  for (const sx of [-1, 1])
    S.tube([gx + sx * bx, by, bz0], [gx + sx * bx, by, bz1], br, br, blued, 12);
  S.fn((img) => {
    for (const sx of [-1, 1]) {
      line3(
        img,
        [gx + sx * bx - 0.004, by + br - 0.0005, bz0 + 0.01],
        [gx + sx * bx - 0.004, by + br - 0.0005, bz1 - 0.01],
        rgba(140, 152, 180),
      );
      // sawn-off ends: bright raw steel lip
      const c = P([gx + sx * bx, by, bz1]),
        r = (CAM.f * br * K) / bz1;
      drawLine(
        img,
        c[0] - r * 0.9,
        c[1] - r * 0.85,
        c[0] + r * 0.9,
        c[1] - r * 0.85,
        rgba(176, 182, 194),
      );
    }
    line3(img, [gx, gy - 0.004, bz0], [gx, gy - 0.004, bz1], rgba(8, 8, 10), 1.6); // rib valley
    const b = P([gx, gy - 0.001, bz1 - 0.01]);
    fillRect(img, b[0] - 1, b[1] - 1, 2, 2, rgba(236, 204, 120)); // brass bead
  });
  // short action body (top sits at barrel mid-height), top lever, twin hammers
  S.box(gx - 0.026, gx + 0.026, gy - 0.05, gy - 0.014, 0.1, 0.18, blued, [
    gx - 0.025,
    gx + 0.025,
    gy - 0.048,
    gy - 0.014,
  ]);
  S.fn((img) => {
    line3(
      img,
      [gx - 0.026, gy - 0.024, 0.105],
      [gx - 0.026, gy - 0.024, 0.175],
      rgba(110, 118, 140),
    );
    line3(
      img,
      [gx - 0.026, gy - 0.036, 0.105],
      [gx - 0.026, gy - 0.032, 0.175],
      rgba(110, 118, 140),
    );
  });
  S.box(gx - 0.003, gx + 0.003, gy - 0.014, gy - 0.009, 0.13, 0.17, bluedD); // top lever
  S.box(gx - 0.003, gx + 0.014, gy - 0.014, gy - 0.009, 0.13, 0.14, bluedD);
  for (const sx of [-1, 1])
    S.box(
      gx + sx * 0.017 - 0.0025,
      gx + sx * 0.017 + 0.0025,
      gy - 0.014,
      gy - 0.002,
      0.14,
      0.15,
      bluedD,
      [gx + sx * 0.017 - 0.002, gx + sx * 0.017 + 0.002, gy - 0.012, gy - 0.006],
    ); // hammer spurs
  gripFore(S, [gx - 0.031, gy - 0.024, 0.27], 2.6);
  return finishVM(S, [gx, by, bz1 + 0.01]);
}

// --- Hailstorm: drum-fed automatic combat shotgun --------------------------
function vmAutoshot() {
  const gx = 0.03,
    gy = -0.098;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const poly = M('matte', 46, 46, 50),
    polyD = M('matte', 30, 30, 34),
    orange = M('matte', 236, 118, 30),
    steel = M('metal', 70, 72, 78);
  // barrel + boxy muzzle brake with orange front post
  S.box(gx - 0.012, gx + 0.012, gy - 0.024, gy - 0.004, 0.56, 0.61, polyD);
  S.fn((img) => {
    for (let i = 0; i < 3; i++)
      line3(
        img,
        [gx - 0.012, gy - 0.008, 0.565 + i * 0.015],
        [gx - 0.012, gy - 0.02, 0.565 + i * 0.015],
        rgba(10, 10, 12),
      );
  });
  S.box(gx - 0.003, gx + 0.003, gy - 0.004, gy + 0.012, 0.55, 0.56, orange);
  S.tube([gx, gy - 0.008, 0.24], [gx, gy - 0.008, 0.56], 0.0085, 0.0085, steel);
  // polymer foregrip
  S.box(gx - 0.02, gx + 0.02, gy - 0.044, gy - 0.01, 0.39, 0.53, poly, [
    gx - 0.018,
    gx + 0.018,
    gy - 0.04,
    gy - 0.012,
  ]);
  S.fn((img) => {
    for (let i = 0; i < 4; i++) {
      const z = 0.41 + i * 0.028;
      line3(img, [gx - 0.02, gy - 0.02, z], [gx - 0.02, gy - 0.036, z], rgba(22, 22, 24));
    }
  });
  // big drum magazine ahead of the receiver, rear face toward us
  const dz0 = 0.28,
    dz1 = 0.345,
    dc = [gx, gy - 0.058],
    dr = 0.046;
  S.tube([dc[0], dc[1], dz0], [dc[0], dc[1], dz1], dr, dr, M('matte', 66, 66, 72), 18);
  S.fn((img) => {
    const c = P([dc[0], dc[1], dz0]);
    const R = (CAM.f * dr * K) / dz0;
    for (let y = Math.floor(c[1] - R); y <= c[1] + R; y++)
      for (let x = Math.floor(c[0] - R); x <= c[0] + R; x++) {
        const d = Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]) / R;
        if (d > 1 || x < 0 || y < 0 || x >= VW || y >= VH) continue;
        const th = Math.atan2(y + 0.5 - c[1], x + 0.5 - c[0]);
        const lit = 0.72 + 0.4 * Math.max(0, Math.cos(th + 2.3));
        let col;
        if (d > 0.93) col = rgba(22, 22, 26);
        else if (d > 0.84)
          col = rgba(240 * lit, 124 * lit, 32 * lit); // orange rim band
        else if (d > 0.8) col = rgba(20, 20, 24);
        else if (d > 0.3)
          col =
            Math.floor((th + Math.PI) / (Math.PI / 8)) & 1
              ? rgba(84 * lit, 84 * lit, 92 * lit)
              : rgba(62 * lit, 62 * lit, 70 * lit); // ribbed face
        else if (d > 0.18)
          col = rgba(232 * lit, 112 * lit, 28 * lit); // orange hub
        else col = rgba(80, 82, 88);
        setPx(img, x, y, col);
      }
  });
  // bulky, short receiver with orange accent stripes
  S.box(gx - 0.026, gx + 0.026, gy - 0.06, gy - 0.02, 0.1, 0.25, poly, [
    gx - 0.024,
    gx + 0.024,
    gy - 0.056,
    gy - 0.02,
  ]);
  S.fn((img) => {
    line3(
      img,
      [gx - 0.028, gy - 0.03, 0.105],
      [gx - 0.024, gy - 0.03, 0.245],
      rgba(236, 118, 30),
      1.8,
    );
    line3(
      img,
      [gx + 0.026, gy - 0.03, 0.105],
      [gx + 0.024, gy - 0.03, 0.245],
      rgba(236, 118, 30),
      1.8,
    );
    line3(img, [gx - 0.026, gy - 0.046, 0.11], [gx - 0.024, gy - 0.044, 0.245], rgba(26, 26, 28));
  });
  // narrow top cover / rail over the low receiver, orange-tipped rear aperture
  S.box(gx - 0.009, gx + 0.009, gy - 0.02, gy - 0.002, 0.1, 0.25, polyD, [
    gx - 0.008,
    gx + 0.008,
    gy - 0.02,
    gy - 0.003,
  ]);
  for (let i = 0; i < 5; i++) {
    const z = 0.14 + i * 0.022;
    S.box(gx - 0.009, gx + 0.009, gy - 0.002, gy + 0.001, z, z + 0.01, poly);
  }
  S.box(gx - 0.006, gx - 0.0025, gy - 0.002, gy + 0.006, 0.16, 0.165, orange);
  S.box(gx + 0.0025, gx + 0.006, gy - 0.002, gy + 0.006, 0.16, 0.165, orange);
  gripFore(S, [gx - 0.02, gy - 0.026, 0.45], 2.6);
  return finishVM(S, [gx, gy - 0.014, 0.615]);
}

// --- Cinder Torch: flamethrower --------------------------------------------
function vmFlamer() {
  const gx = 0.03,
    gy = -0.1;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const steel = M('metal', 100, 102, 108),
    steelD = M('metal', 60, 60, 64),
    brass = M('chrome', 180, 136, 64),
    soot = M('metal', 70, 56, 42);
  const red = M('metal', 190, 40, 32),
    redD = M('metal', 120, 24, 22),
    hose = M('matte', 40, 36, 34);
  const by = gy - 0.016;
  // red fuel tank slung low on the right
  const tx = gx + 0.042,
    ty = gy - 0.036;
  S.tube([tx, ty, 0.14], [tx, ty, 0.32], 0.02, 0.02, red, 14);
  S.tube([tx, ty, 0.32], [tx, ty, 0.335], 0.02, 0.012, redD, 14);
  S.tube([tx, ty, 0.335], [tx, ty, 0.345], 0.005, 0.005, brass, 8); // valve
  S.fn((img) => {
    line3(img, [tx - 0.012, ty + 0.015, 0.15], [tx - 0.012, ty + 0.015, 0.31], rgba(250, 140, 120)); // highlight
    for (const z of [0.18, 0.28]) {
      const a = P([tx - 0.02, ty + 0.004, z]),
        b = P([tx + 0.006, ty + 0.02, z]);
      drawLine(img, a[0], a[1], b[0], b[1], rgba(60, 14, 12), 1.6);
    } // straps
    const w = P([tx - 0.004, ty + 0.01, 0.23]); // white hazard diamond
    fillPoly(
      img,
      [
        [w[0], w[1] - 3],
        [w[0] + 3, w[1]],
        [w[0], w[1] + 3],
        [w[0] - 3, w[1]],
      ],
      rgba(226, 220, 204),
    );
    setPx(img, w[0], w[1], rgba(190, 40, 32));
  });
  // fuel hose: tank valve -> nozzle base, sagging along the right
  S.tube([tx, ty + 0.002, 0.34], [gx + 0.026, by - 0.006, 0.4], 0.0042, 0.0042, hose, 8);
  S.tube([gx + 0.026, by - 0.006, 0.4], [gx + 0.012, by - 0.004, 0.5], 0.0042, 0.0042, hose, 8);
  // scorched brass nozzle (flared) + igniter tube with the pilot flame
  S.tube([gx, gy - 0.034, 0.49], [gx, gy - 0.034, 0.595], 0.0035, 0.0035, steelD, 6);
  S.tube([gx, by, 0.5], [gx, by, 0.6], 0.011, 0.019, brass, 12);
  S.tube([gx, by, 0.56], [gx, by, 0.6], 0.0172, 0.0195, soot, 12, false);
  // steel barrel inside a perforated heat shield
  S.tube([gx, by, 0.22], [gx, by, 0.5], 0.0095, 0.0095, steel);
  S.tube([gx, by, 0.27], [gx, by, 0.47], 0.017, 0.017, M('perf', 86, 88, 92), 12);
  S.fn((img) => {
    for (let i = 0; i < 7; i++) {
      // soot streaks on the flare
      const a = -Math.PI + (i / 6) * Math.PI;
      line3(
        img,
        [gx + Math.cos(a) * 0.0185, by - Math.sin(a) * 0.0185, 0.595],
        [gx + Math.cos(a) * 0.013, by - Math.sin(a) * 0.013, 0.53],
        rgba(44, 32, 24),
      );
    }
    const p = P([gx, gy - 0.034, 0.598]); // blue pilot flame
    fillRect(img, p[0] - 1, p[1] - 2, 3, 3, glow(60, 120, 255));
    fillRect(img, p[0], p[1] - 3, 1, 3, glow(200, 236, 255));
    setPx(img, p[0], p[1] - 4, glow(110, 170, 255));
    setPx(img, p[0] + 1, p[1] - 4, glow(50, 100, 240));
  });
  // short body with brass fittings
  S.box(gx - 0.023, gx + 0.023, gy - 0.052, gy - 0.008, 0.1, 0.23, steelD, [
    gx - 0.021,
    gx + 0.021,
    gy - 0.048,
    gy - 0.01,
  ]);
  S.fn((img) => {
    line3(img, [gx - 0.023, gy - 0.028, 0.105], [gx - 0.021, gy - 0.028, 0.225], rgba(38, 38, 42));
    for (let i = 0; i < 3; i++) {
      const p = P([gx - 0.023, gy - 0.014, 0.12 + i * 0.045]);
      setPx(img, p[0], p[1], rgba(160, 160, 166));
    }
  });
  S.box(gx - 0.0025, gx + 0.0025, gy - 0.008, gy - 0.002, 0.15, 0.23, steel); // top sight rib
  S.box(gx - 0.006, gx - 0.002, gy - 0.008, gy + 0.002, 0.14, 0.146, steelD); // rear notch
  S.box(gx + 0.002, gx + 0.006, gy - 0.008, gy + 0.002, 0.14, 0.146, steelD);
  gripFore(S, [gx - 0.018, by - 0.002, 0.38], 2.6);
  return finishVM(S, [gx, by, 0.61]);
}

// --- Storm Coil: tesla gun ---------------------------------------------------
function vmTesla() {
  const gx = 0.03,
    gy = -0.1;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const iron = M('metal', 60, 58, 64),
    ironD = M('metal', 40, 38, 44),
    copper = M('chrome', 214, 120, 66),
    copperD = M('chrome', 150, 78, 40);
  const glass = M('glass', 96, 84, 140),
    brass = M('metal', 70, 64, 60);
  const ax = [gx, gy - 0.016];
  const N = 7,
    cz = (i) => 0.27 + i * 0.036,
    cr = (i) => 0.0135 + i * 0.0026; // stepped cone flaring toward the tip
  // coil stack: central rod + copper discs (far to near), tip electrode
  S.tube([ax[0], ax[1], 0.25], [ax[0], ax[1], 0.56], 0.0045, 0.0045, copperD, 8);
  S.ball([ax[0], ax[1], 0.575], 0.011, 0.011, 0.011, M('glow', 210, 160, 255));
  for (let i = N - 1; i >= 0; i--) {
    S.tube(
      [ax[0], ax[1], cz(i) + 0.014],
      [ax[0], ax[1], cz(i) + 0.03],
      cr(i) * 0.55,
      cr(i) * 0.55,
      ironD,
      10,
    ); // iron spacer
    S.tube(
      [ax[0], ax[1], cz(i)],
      [ax[0], ax[1], cz(i) + 0.014],
      cr(i),
      cr(i),
      i & 1 ? copperD : copper,
      14,
    );
    S.fn((img) => {
      // winding highlight on each disc's top edge
      line3(
        img,
        [ax[0] - cr(i) * 0.6, ax[1] + cr(i) * 0.8, cz(i) + 0.006],
        [ax[0] + cr(i) * 0.6, ax[1] + cr(i) * 0.8, cz(i) + 0.006],
        rgba(250, 190, 130),
      );
    });
  }
  // crackling electricity between the discs and round the tip
  S.fn((img) => {
    const rng = mulberry32(77);
    const bolt = (a, b, jit, c1, c2) => {
      const n = 4;
      let prev = a;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const q =
          i === n
            ? b
            : [
                a[0] + (b[0] - a[0]) * t + (rng() - 0.5) * jit,
                a[1] + (b[1] - a[1]) * t + (rng() - 0.5) * jit,
              ];
        drawLine(img, prev[0], prev[1], q[0], q[1], c1, 1);
        prev = q;
      }
      setPx(img, b[0], b[1], c2);
    };
    for (let i = 0; i < N - 1; i++) {
      const side = i & 1 ? 1 : -1;
      const a = P([ax[0] + side * cr(i) * 1.05, ax[1] + cr(i) * 0.2, cz(i) + 0.012]),
        b = P([ax[0] + side * cr(i + 1) * 1.05, ax[1] + cr(i + 1) * 0.3, cz(i + 1)]);
      bolt(a, b, 3.5, glow(196, 132, 255), glow(255, 240, 255));
    }
    const tip = P([ax[0], ax[1], 0.575]);
    for (let k = 0; k < 6; k++) {
      const an = -Math.PI / 2 + (k - 2.5) * 0.62;
      bolt(
        tip,
        [tip[0] + Math.cos(an) * (6 + rng() * 4), tip[1] + Math.sin(an) * (4 + rng() * 3)],
        3,
        glow(180, 110, 255),
        glow(255, 235, 255),
      );
    }
    fillEllipse(img, tip[0], tip[1], 2.4, 2.4, glow(255, 244, 255));
  });
  // iron body (short, so the coil stack shows above it) + front collar
  S.box(gx - 0.026, gx + 0.026, gy - 0.056, gy - 0.012, 0.1, 0.25, iron, [
    gx - 0.024,
    gx + 0.024,
    gy - 0.052,
    gy - 0.014,
  ]);
  S.box(gx - 0.03, gx + 0.03, gy - 0.046, gy - 0.016, 0.24, 0.265, ironD);
  S.fn((img) => {
    for (let i = 0; i < 4; i++) {
      const z = 0.115 + i * 0.04;
      const p = P([gx - 0.026, gy - 0.018, z]),
        q = P([gx - 0.026, gy - 0.048, z]);
      setPx(img, p[0], p[1], rgba(126, 120, 130));
      setPx(img, q[0], q[1], rgba(126, 120, 130));
    }
    line3(img, [gx - 0.026, gy - 0.032, 0.105], [gx - 0.024, gy - 0.032, 0.245], rgba(30, 28, 34));
  });
  // glass capacitor tubes on the top flanks with glowing filaments
  for (const sx of [-1, 1]) {
    const x = gx + sx * 0.016,
      y = gy - 0.008;
    S.tube([x, y, 0.17], [x, y, 0.245], 0.005, 0.005, glass, 10);
    S.fn((img) => {
      line3(img, [x, y, 0.175], [x, y, 0.24], glow(200, 140, 255), 1.6);
      const rng = mulberry32(sx > 0 ? 5 : 9);
      for (let z = 0.18; z < 0.24; z += 0.012) {
        const p = P([x + (rng() - 0.5) * 0.006, y, z]);
        setPx(img, p[0], p[1], glow(250, 236, 255));
      }
    });
    S.tube([x, y, 0.243], [x, y, 0.252], 0.006, 0.006, brass, 10);
  }
  // rear notch sight in the channel between the tubes
  S.box(gx - 0.0045, gx - 0.0015, gy - 0.012, gy - 0.002, 0.14, 0.146, ironD);
  S.box(gx + 0.0015, gx + 0.0045, gy - 0.012, gy - 0.002, 0.14, 0.146, ironD);
  gripFore(S, [gx - 0.03, gy - 0.034, 0.26], 2.6);
  return finishVM(S, [ax[0], ax[1], 0.575]);
}

// --- Ripjack: sawblade launcher ---------------------------------------------
function vmSaw() {
  const gx = 0.03,
    gy = -0.104;
  setAxis(gx, gy, 1.8);
  const S = new Scene();
  const yel = M('matte', 226, 182, 36),
    yelD = M('matte', 176, 136, 24),
    haz = M('hazard', 230, 186, 40),
    blk = M('matte', 34, 34, 36),
    steel = M('metal', 90, 92, 98);
  const bc = [gx, gy + 0.006, 0.45],
    br = 0.044,
    tilt = 0.62; // blade centre, radius, lean-back
  // launch rails / prongs either side of the blade
  for (const sx of [-1, 1])
    S.box(gx + sx * 0.022 - 0.005, gx + sx * 0.022 + 0.005, gy - 0.03, gy - 0.004, 0.34, 0.5, blk, [
      gx + sx * 0.021 - 0.004,
      gx + sx * 0.021 + 0.004,
      gy - 0.026,
      gy - 0.008,
    ]);
  S.box(gx - 0.026, gx + 0.026, gy - 0.034, gy - 0.026, 0.34, 0.49, blk); // lower guide plate
  // the sawblade: a leaning disc drawn from projected rim points
  S.fn((img) => {
    const pt = (rr, a) =>
      P([
        bc[0] + Math.cos(a) * rr,
        bc[1] + Math.sin(a) * rr * Math.sin(tilt),
        bc[2] + Math.sin(a) * rr * Math.cos(tilt),
      ]);
    const teeth = 18,
      rim = [];
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      rim.push(pt(br * 0.9, a0), pt(br * 1.08, a0 + (0.55 / teeth) * Math.PI * 2));
    }
    const C = P(bc);
    fillPolyFn(img, rim, (x, y) => {
      const dx = x + 0.5 - C[0],
        dy = y + 0.5 - C[1];
      const f = 0.8 + 0.3 * Math.cos(Math.atan2(dy, dx) * 2 + 0.8) + (hash2(x, y, 4) - 0.5) * 0.08;
      return rgba(150 * f, 156 * f, 166 * f);
    });
    // inner ring, hub and bolts
    const ring = [];
    for (let i = 0; i < 24; i++) ring.push(pt(br * 0.72, (i / 24) * Math.PI * 2));
    for (let i = 0; i < 24; i++)
      drawLine(
        img,
        ring[i][0],
        ring[i][1],
        ring[(i + 1) % 24][0],
        ring[(i + 1) % 24][1],
        rgba(96, 100, 110),
      );
    for (let i = 0; i < 6; i++) {
      const a = pt(br * 0.32, (i / 6) * Math.PI * 2 + 0.3),
        b = pt(br * 0.68, (i / 6) * Math.PI * 2 + 0.55);
      drawLine(img, a[0], a[1], b[0], b[1], rgba(110, 114, 124));
    }
    const hub = [];
    for (let i = 0; i < 12; i++) hub.push(pt(br * 0.26, (i / 12) * Math.PI * 2));
    fillPoly(img, hub, rgba(50, 50, 56));
    const hub2 = [];
    for (let i = 0; i < 12; i++) hub2.push(pt(br * 0.13, (i / 12) * Math.PI * 2));
    fillPoly(img, hub2, rgba(120, 122, 130));
    // glints on the teeth
    for (const a of [-2.3, -1.9, 0.6]) {
      const g = pt(br * 0.98, a);
      setPx(img, g[0], g[1], glow(255, 255, 240));
      setPx(img, g[0] + 1, g[1], glow(220, 225, 235));
    }
  });
  // chunky body: hazard-striped front band, yellow shell, black spine
  S.box(gx - 0.03, gx + 0.03, gy - 0.06, gy - 0.004, 0.27, 0.35, haz, [
    gx - 0.028,
    gx + 0.028,
    gy - 0.056,
    gy - 0.006,
  ]);
  S.box(gx - 0.03, gx + 0.03, gy - 0.06, gy - 0.004, 0.1, 0.27, yel);
  S.fn((img) => {
    line3(img, [gx - 0.03, gy - 0.03, 0.11], [gx - 0.03, gy - 0.03, 0.26], rgba(120, 92, 14));
    for (let i = 0; i < 3; i++) {
      const z = 0.14 + i * 0.04;
      line3(img, [gx - 0.03, gy - 0.04, z], [gx - 0.03, gy - 0.052, z], rgba(40, 36, 30), 1.4);
    } // vents
  });
  S.box(gx - 0.004, gx + 0.004, gy - 0.004, gy + 0.001, 0.17, 0.3, blk); // spine rail
  S.box(gx - 0.009, gx - 0.003, gy + 0.004, gy + 0.014, 0.12, 0.13, blk); // rear sight ears
  S.box(gx + 0.003, gx + 0.009, gy + 0.004, gy + 0.014, 0.12, 0.13, blk);
  S.box(gx + 0.03, gx + 0.036, gy - 0.03, gy - 0.014, 0.16, 0.24, steel); // motor housing bolt-on
  S.box(gx - 0.034, gx - 0.03, gy - 0.026, gy - 0.012, 0.15, 0.2, yelD);
  gripFore(S, [gx - 0.03, gy - 0.034, 0.33], 2.7);
  return finishVM(S, bc);
}

function vmKnife() {
  const img = makeImage(VW, VH);
  // blade angled up-left: from hilt (98,84) to tip (44,26)
  const hx = 100,
    hy = 86,
    tx = 46,
    ty = 26;
  const ax = tx - hx,
    ay = ty - hy,
    len = Math.hypot(ax, ay);
  const ux = ax / len,
    uy = ay / len; // along blade
  const px = -uy,
    py = ux; // perpendicular (towards upper-right side = spine)
  const P = (t, o) => [hx + ux * t + px * o, hy + uy * t + py * o];
  // blade polygon: edge side (negative o) curves into a clip point
  const spine = [P(0, 5), P(len * 0.72, 5), P(len * 0.86, 3.2), P(len, 0)];
  const edge = [P(len * 0.93, -2.5), P(len * 0.75, -5.5), P(len * 0.2, -6), P(0, -6)];
  fillPoly(img, [...spine, ...edge], rgba(150, 156, 168));
  // spine half darker, bevel edge lighter
  fillPoly(
    img,
    [P(0, 5), P(len * 0.72, 5), P(len * 0.86, 3.2), P(len, 0), P(len * 0.86, 0.5), P(len * 0.1, 1)],
    rgba(112, 118, 130),
  );
  fillPoly(
    img,
    [
      P(len * 0.93, -2.5),
      P(len * 0.75, -5.5),
      P(len * 0.2, -6),
      P(len * 0.2, -4),
      P(len * 0.75, -3.6),
    ],
    rgba(208, 214, 224),
  );
  // fuller groove
  const f0 = P(len * 0.12, 2.5),
    f1 = P(len * 0.6, 2.5);
  drawLine(img, f0[0], f0[1], f1[0], f1[1], rgba(70, 74, 84), 1.6);
  // serrations near hilt on spine
  for (let i = 0; i < 6; i++) {
    const q = P(len * 0.08 + i * 3, 5.4);
    setPx(img, q[0], q[1], rgba(60, 62, 70));
  }
  // edge glint
  for (let t = len * 0.25; t < len * 0.75; t += 1) {
    const q = P(t, -5.4);
    setPx(img, q[0], q[1], rgba(240, 244, 250));
  }
  // crossguard
  const g0 = P(0, 10),
    g1 = P(0, -11);
  drawLine(img, g0[0], g0[1], g1[0], g1[1], rgba(46, 46, 50), 4.5);
  drawLine(img, g0[0] - 0.5, g0[1] - 1, g1[0] - 0.5, g1[1] - 1, rgba(80, 80, 88), 1.5);
  // handle (ridged rubber) going down-right into the fist
  const H = (t, o) => [hx - ux * t + px * o, hy - uy * t + py * o];
  fillPoly(img, [H(2, 4.5), H(30, 4), H(30, -4), H(2, -4.5)], rgba(34, 34, 36));
  for (let t = 4; t < 30; t += 3) {
    const a = H(t, 4),
      b = H(t, -4);
    drawLine(img, a[0], a[1], b[0], b[1], rgba(52, 52, 56));
  }
  // fist (gloved) wrapping the handle
  const fist = (cx, cy, rx, ry, base) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx,
          ny = (y + 0.5 - cy) / ry;
        const q = nx * nx + ny * ny;
        if (q > 1) continue;
        const nz = Math.sqrt(1 - q);
        let s = 0.3 + 0.8 * Math.max(0, nx * 0.45 - ny * 0.8 + nz * 0.42);
        s = Math.round(s * 7) / 7;
        const n = hash2(x, y, 5) - 0.5;
        setPx(img, x, y, tint(base, s * (1 + n * 0.1)));
      }
  };
  const glove = rgba(60, 60, 54);
  // sleeve from bottom-right
  fillPoly(
    img,
    [
      [118, 120],
      [160, 120],
      [160, 96],
      [136, 92],
    ],
    rgba(78, 84, 50),
  );
  fillPoly(
    img,
    [
      [124, 120],
      [160, 120],
      [160, 104],
      [140, 100],
    ],
    rgba(92, 98, 58),
  );
  fist(132, 102, 16, 13, rgba(50, 50, 46)); // wrist / back of hand
  fist(116, 98, 15, 13, glove);
  // finger knuckle rolls wrapping over the handle (left side)
  for (let i = 0; i < 4; i++) fist(104 + i * 4.5, 92 + i * 4.2, 6, 5.2, glove);
  // thumb pressing on top of guard
  fist(108, 86, 7, 4.5, rgba(66, 66, 60));
  // seam stitches on glove
  for (let i = 0; i < 6; i++) setPx(img, 120 + i * 2, 92 + i, rgba(36, 36, 32));
  outline(img, OUTLINE);
  return { img, muzzle: { x: 0, y: 0 } };
}

//=============================================================
//                      MUZZLE FLASHES
//=============================================================

// Muzzle flashes (40x40, fully emissive)

function muzzleFlash(seed, core, mid, outer) {
  const img = makeImage(40, 40);
  const rng = mulberry32(seed);
  const spikes = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    spikes.push({
      a: (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.4,
      len: 6 + rng() * 9,
      w: 0.22 + rng() * 0.15,
    });
  }
  for (let i = 0; i < 6; i++)
    spikes.push({ a: rng() * Math.PI * 2, len: 3 + rng() * 5, w: 0.15 + rng() * 0.1 });
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++) {
      const dx = x + 0.5 - 20,
        dy = y + 0.5 - 20;
      const r = Math.hypot(dx, dy);
      const th = Math.atan2(dy, dx);
      let ext = 0;
      for (const s of spikes) {
        let d = Math.abs(th - s.a) % (Math.PI * 2);
        if (d > Math.PI) d = Math.PI * 2 - d;
        const k = Math.max(0, 1 - d / s.w);
        ext = Math.max(ext, s.len * Math.pow(k, 1.4));
      }
      const rmax = Math.min(19.5, 7 + ext + (hash2(x, y, seed) - 0.5) * 1.5);
      if (r > rmax) continue;
      const t = r / rmax;
      let c;
      if (t < 0.32) c = core;
      else if (t < 0.62) c = mix(core, mid, (t - 0.32) / 0.3);
      else c = mix(mid, outer, (t - 0.62) / 0.38);
      const [cr, cg, cb] = unpack(c);
      img.data[y * 40 + x] = glow(cr, cg, cb);
    }
  return img;
}

// Flamethrower burst: soft, lumpy orange-yellow fireball with a blue core.
function flameFlash() {
  const img = makeImage(40, 40);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 40; x++) {
      const dx = x + 0.5 - 20,
        dy = y + 0.5 - 20;
      const n = valueNoise(x / 3.2, y / 3.2, 64, 91) - 0.5;
      const r = Math.hypot(dx, dy * 1.12);
      const rmax = 13 + n * 9;
      if (r > rmax) continue;
      const t = r / rmax;
      let c;
      if (r < 3.2) c = mix(rgba(210, 236, 255), rgba(80, 140, 255), r / 3.2);
      else if (r < 5) c = mix(rgba(110, 160, 255), rgba(255, 246, 200), (r - 3.2) / 1.8);
      else if (t < 0.55) c = mix(rgba(255, 246, 200), rgba(255, 196, 70), (t - 0.2) / 0.35);
      else c = mix(rgba(255, 190, 64), rgba(220, 80, 18), (t - 0.55) / 0.45);
      // ragged, flickering outer edge
      if (t > 0.75 && hash2(x, y, 17) < (t - 0.75) * 1.6) continue;
      const [cr, cg, cb] = unpack(c);
      img.data[y * 40 + x] = glow(cr, cg, cb);
    }
  return img;
}

// Tesla discharge: jagged violet-white forks out of a hot core.
function teslaFlash() {
  const img = makeImage(40, 40);
  const rng = mulberry32(53);
  const outer = glow(120, 60, 230),
    mid = glow(190, 130, 255),
    core = glow(250, 240, 255);
  const fork = (x, y, ang, len, depth) => {
    let px = x,
      py = y;
    const steps = Math.max(2, Math.round(len / 3));
    for (let i = 0; i < steps; i++) {
      ang += (rng() - 0.5) * 1.3;
      const nx = px + Math.cos(ang) * 3,
        ny = py + Math.sin(ang) * 3;
      drawLine(img, px, py, nx, ny, outer, depth === 0 ? 2.2 : 1.6);
      drawLine(img, px, py, nx, ny, i < steps / 2 || depth > 0 ? mid : outer, 1);
      if (depth < 1 && rng() < 0.4)
        fork(nx, ny, ang + (rng() < 0.5 ? -0.9 : 0.9), len * 0.45, depth + 1);
      px = nx;
      py = ny;
    }
  };
  for (let i = 0; i < 9; i++) fork(20, 20, (i / 9) * Math.PI * 2 + rng() * 0.4, 13 + rng() * 6, 0);
  fillEllipse(img, 20, 20, 5, 5, mid);
  fillEllipse(img, 20, 20, 3.4, 3.4, core);
  for (let i = 0; i < 6; i++) setPx(img, 20 + (rng() - 0.5) * 30, 20 + (rng() - 0.5) * 30, core); // stray sparks
  return img;
}

//=============================================================
//                          EXPORTS
//=============================================================

export function buildWeaponArt() {
  const icons = {
    pistol: finishIcon(iconPistol()),
    shotgun: finishIcon(iconShotgun()),
    smg: finishIcon(iconSmg()),
    rifle: finishIcon(iconRifle()),
    magnum: finishIcon(iconMagnum()),
    lmg: finishIcon(iconLmg()),
    rail: finishIcon(iconRail()),
    plasma: finishIcon(iconPlasma()),
    dbarrel: finishIcon(iconDbarrel()),
    autoshot: finishIcon(iconAutoshot()),
    flamer: finishIcon(iconFlamer()),
    tesla: finishIcon(iconTesla()),
    saw: finishIcon(iconSaw()),
  };
  const viewmodels = {
    pistol: vmPistol(),
    shotgun: vmShotgun(),
    smg: vmSmg(),
    rifle: vmRifle(),
    magnum: vmMagnum(),
    lmg: vmLmg(),
    rail: vmRail(),
    plasma: vmPlasma(),
    dbarrel: vmDbarrel(),
    autoshot: vmAutoshot(),
    flamer: vmFlamer(),
    tesla: vmTesla(),
    saw: vmSaw(),
    knife: vmKnife(),
  };
  const muzzle = {
    normal: muzzleFlash(11, rgba(255, 255, 235), rgba(255, 215, 90), rgba(230, 110, 25)),
    rail: muzzleFlash(23, rgba(240, 255, 255), rgba(140, 235, 255), rgba(30, 140, 255)),
    plasma: muzzleFlash(37, rgba(240, 255, 240), rgba(150, 255, 160), rgba(30, 190, 70)),
    flame: flameFlash(),
    tesla: teslaFlash(),
  };
  return { icons, viewmodels, muzzle };
}

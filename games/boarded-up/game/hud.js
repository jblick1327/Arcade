// hud.js - Boarded Up HUD: points, ammo, round and prompts drawn over the 3D view
// Author: Reachnid Group
// Centennial College - Fall 2026

// Canvas-2D HUD drawn at display resolution on top of the scaled-up 3D view.
import { WEAPONS, PERKS } from './core/weapons.js';

const FONT = 'Impact, Haettenschweiler, "Arial Narrow Bold", "Franklin Gothic Bold", sans-serif';
const UI_FONT = '"Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function text(ctx, str, x, y, size, color, align = 'left', font = FONT, shadow = 0.75) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = `rgba(0,0,0,${shadow})`;
  const o = Math.max(1, size * 0.06);
  ctx.fillText(str, x + o, y + o);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function drawHud(ctx, game, rect) {
  const { w, h } = rect;
  const u = h / 270;
  const p = game.player;
  ctx.save();
  ctx.translate(rect.x, rect.y);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // Damage vignette
  const hpFrac = p.health / p.maxHealth;
  const vig = Math.max((1 - hpFrac) * 0.9, game.hurtFlash * 0.55);
  if (vig > 0.01) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(120,0,0,0)');
    g.addColorStop(1, `rgba(140,0,0,${Math.min(0.85, vig)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  if (game.state === 'dead') {
    ctx.fillStyle = `rgba(60,0,0,${Math.min(0.55, game.deadT * 0.4)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    return;
  }

  // Crosshair
  const def = WEAPONS[game.weapon.id];
  const adsMul = 1 - p.ads * (def.pellets > 1 ? 0.3 : 0.8);
  const spread = (def.spread * (p.moving ? 1.6 : 1) * adsMul * 480 + 4 + p.recoil * 6) * u;
  const cx = w / 2,
    cy = h / 2;
  const len = 5 * u;
  ctx.strokeStyle = `rgba(255,255,255,${0.85 * Math.max(0, 1 - p.ads * 1.6)})`;
  ctx.lineWidth = Math.max(1, u * 0.8);
  ctx.beginPath();
  if (p.sprinting || p.reloadT > 0) {
    ctx.arc(cx, cy, 1.2 * u, 0, Math.PI * 2);
  } else {
    ctx.moveTo(cx - spread - len, cy);
    ctx.lineTo(cx - spread, cy);
    ctx.moveTo(cx + spread, cy);
    ctx.lineTo(cx + spread + len, cy);
    ctx.moveTo(cx, cy - spread - len);
    ctx.lineTo(cx, cy - spread);
    ctx.moveTo(cx, cy + spread);
    ctx.lineTo(cx, cy + spread + len);
  }
  ctx.stroke();
  if (game.hitMarkerT > 0) {
    const a = 4 * u,
      b = 9 * u;
    ctx.strokeStyle = `rgba(255,255,255,${game.hitMarkerT / 0.15})`;
    ctx.lineWidth = Math.max(1, u * 1.2);
    ctx.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      ctx.moveTo(cx + sx * a, cy + sy * a);
      ctx.lineTo(cx + sx * b, cy + sy * b);
    }
    ctx.stroke();
  }

  // Aim-down-sights: subtle tunnel vignette + a reticle for the weapon type
  if (p.ads > 0.05) drawReticle(ctx, game.weapon.id, cx, cy, u, p.ads, w, h);

  // Round counter (bottom-left)
  if (game.round > 0 && !game.mission) {
    const pulse = game.intermission > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(game.time * 3)) : 1;
    text(
      ctx,
      'ROUND',
      14 * u,
      h - 52 * u,
      9 * u,
      `rgba(200,180,170,${0.8 * pulse})`,
      'left',
      UI_FONT,
    );
    text(ctx, String(game.round), 12 * u, h - 12 * u, 44 * u, `rgba(170,18,12,${pulse})`);
  }

  // Perk icons (above round)
  let px = 14 * u;
  for (const id of p.perks) {
    const pk = PERKS[id];
    const s = 14 * u,
      y = h - 82 * u;
    ctx.fillStyle = pk.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = u;
    roundRect(ctx, px, y, s, s, 3 * u);
    ctx.fill();
    ctx.stroke();
    text(ctx, pk.letter, px + s / 2, y + s * 0.78, 10 * u, '#fff', 'center');
    px += s + 4 * u;
  }

  // Ammo + weapon (bottom-right)
  const wpn = game.weapon;
  text(
    ctx,
    def.name.toUpperCase(),
    w - 14 * u,
    h - 40 * u,
    8.5 * u,
    'rgba(230,225,210,0.9)',
    'right',
    UI_FONT,
  );
  const magCol =
    wpn.mag === 0 ? '#e74c3c' : wpn.mag <= Math.ceil(def.mag * 0.25) ? '#f39c12' : '#f2efe6';
  ctx.font = `${22 * u}px ${FONT}`;
  const resStr = ' / ' + wpn.reserve;
  ctx.font = `${13 * u}px ${FONT}`;
  const resW = ctx.measureText(resStr).width;
  text(ctx, resStr, w - 14 * u, h - 14 * u, 13 * u, 'rgba(200,195,185,0.85)', 'right');
  text(ctx, String(wpn.mag), w - 14 * u - resW, h - 14 * u, 22 * u, magCol, 'right');
  if (p.weapons.length > 1) {
    const other = p.weapons[1 - p.cur];
    text(
      ctx,
      WEAPONS[other.id].name,
      w - 14 * u,
      h - 52 * u,
      7 * u,
      'rgba(180,175,165,0.6)',
      'right',
      UI_FONT,
    );
  }
  if (wpn.mag === 0 && wpn.reserve > 0 && p.reloadT <= 0)
    text(ctx, 'Press R to reload', w / 2, h / 2 + 26 * u, 8 * u, '#f39c12', 'center', UI_FONT);
  else if (wpn.mag === 0 && wpn.reserve === 0)
    text(ctx, 'NO AMMO', w / 2, h / 2 + 26 * u, 9 * u, '#e74c3c', 'center');

  // Points (right side, above ammo)
  const ptsY = h - 66 * u;
  const pstr = String(p.points);
  ctx.font = `${16 * u}px ${FONT}`;
  const pw = ctx.measureText(pstr).width;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, w - 22 * u - pw, ptsY - 15 * u, pw + 12 * u, 19 * u, 3 * u);
  ctx.fill();
  text(ctx, pstr, w - 16 * u, ptsY, 16 * u, game.doubleT > 0 ? '#c6f26b' : '#f5d76e', 'right');
  for (const pp of game.popups) {
    const a = 1 - pp.t / 1.2;
    const pos = pp.v > 0;
    text(
      ctx,
      (pos ? '+' : '') + pp.v,
      w - 30 * u - pw - pp.t * 26 * u + pp.x * u * 0.3,
      ptsY - pp.t * 22 * u,
      (pos ? 9 : 10) * u,
      pos ? `rgba(245,215,110,${a})` : `rgba(231,76,60,${a})`,
      'right',
    );
  }

  // Active power-ups (bottom centre)
  if (game.doubleT > 0) {
    text(
      ctx,
      `DOUBLE SCORE  ${Math.ceil(game.doubleT)}`,
      w / 2,
      h - 14 * u,
      10 * u,
      game.doubleT < 5 && Math.floor(game.time * 6) % 2 ? 'rgba(198,242,107,0.4)' : '#c6f26b',
      'center',
    );
  }

  // Interaction prompt
  if (game.prompt) {
    ctx.font = `${8.5 * u}px ${UI_FONT}`;
    const tw = ctx.measureText(game.prompt).width;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, w / 2 - tw / 2 - 8 * u, h * 0.66 - 10 * u, tw + 16 * u, 15 * u, 3 * u);
    ctx.fill();
    let col = '#f2efe6';
    const m = game.prompt.match(/\[(\d+)\]/);
    if (m && +m[1] > p.points) col = '#ff8a7a';
    text(ctx, game.prompt, w / 2, h * 0.66, 8.5 * u, col, 'center', UI_FONT, 0.6);
    if (game.target && game.target.type === 'prop' && game.useT > 0 && game.target.prop.use.hold) {
      const bw = 60 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(w / 2 - bw / 2, h * 0.66 + 8 * u, bw, 3 * u);
      ctx.fillStyle = '#7fd4ff';
      ctx.fillRect(
        w / 2 - bw / 2,
        h * 0.66 + 8 * u,
        bw * Math.min(1, game.useT / game.target.prop.use.hold),
        3 * u,
      );
    }
    if (game.target && game.target.type === 'window' && p.repairT > 0) {
      const interval = p.perks.has('quick') ? 0.45 : 0.75;
      const bw = 60 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(w / 2 - bw / 2, h * 0.66 + 8 * u, bw, 3 * u);
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(w / 2 - bw / 2, h * 0.66 + 8 * u, bw * Math.min(1, p.repairT / interval), 3 * u);
    }
  }

  if (game.mission) drawMission(ctx, game, w, h, u);
  else if (!game.power) {
    text(ctx, 'NO POWER', 14 * u, 18 * u, 9 * u, 'rgba(255,90,70,0.9)', 'left');
    text(
      ctx,
      'Find the generator',
      14 * u,
      28 * u,
      7 * u,
      'rgba(220,200,190,0.75)',
      'left',
      UI_FONT,
    );
  }

  // Centre banner
  const b = game.banner;
  if (b) {
    const fadeIn = Math.min(1, b.t / 0.4),
      fadeOut = Math.min(1, (b.dur - b.t) / 0.8);
    const a = Math.max(0, Math.min(fadeIn, fadeOut));
    if (b.big) {
      text(ctx, b.text, w / 2, h * 0.36, 34 * u, `rgba(178,20,14,${a})`, 'center');
    } else {
      text(ctx, b.text, w / 2, h * 0.3, 16 * u, `rgba(242,239,230,${a})`, 'center');
    }
    if (b.sub)
      text(
        ctx,
        b.sub,
        w / 2,
        h * (b.big ? 0.36 : 0.3) + 16 * u,
        8.5 * u,
        `rgba(220,210,200,${a * 0.9})`,
        'center',
        UI_FONT,
      );
  }

  ctx.restore();
}

function drawReticle(ctx, id, cx, cy, u, a, w, h) {
  const g = ctx.createRadialGradient(cx, cy, h * 0.35, cx, cy, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.45 * a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const al = Math.min(1, (a - 0.05) * 1.6);
  ctx.save();
  ctx.lineCap = 'round';
  const glowDot = (r, col) => {
    ctx.shadowColor = col;
    ctx.shadowBlur = 6 * u;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };
  const ring = (r, col, lw = 1) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, lw * u);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  if (id === 'pistol' || id === 'magnum') {
    // iron sights: front post sitting in a rear notch
    ctx.fillStyle = `rgba(20,20,22,${0.85 * al})`;
    const pw = 2.4 * u,
      gap = 4.5 * u,
      nh = 9 * u,
      nw = 12 * u;
    ctx.fillRect(cx - pw / 2, cy, pw, nh);
    ctx.fillRect(cx - gap - nw, cy + 1.5 * u, nw, nh);
    ctx.fillRect(cx + gap, cy + 1.5 * u, nw, nh);
    glowDot(1.3 * u, `rgba(120,255,140,${al})`);
  } else if (id === 'rifle') {
    ring(9 * u, `rgba(20,20,20,${0.55 * al})`, 3);
    glowDot(1.5 * u, `rgba(255,50,40,${al})`);
  } else if (id === 'smg' || id === 'lmg') {
    ring(7 * u, `rgba(255,70,60,${0.9 * al})`, 0.9);
    glowDot(1.2 * u, `rgba(255,70,60,${al})`);
  } else if (id === 'shotgun') {
    ring(16 * u, `rgba(255,255,255,${0.55 * al})`, 1);
    glowDot(1.2 * u, `rgba(255,255,255,${0.8 * al})`);
  } else if (id === 'rail') {
    ctx.strokeStyle = `rgba(110,230,255,${al})`;
    ctx.lineWidth = Math.max(1, 0.9 * u);
    ctx.beginPath();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      ctx.moveTo(cx + dx * 4 * u, cy + dy * 4 * u);
      ctx.lineTo(cx + dx * 22 * u, cy + dy * 22 * u);
    }
    for (let i = 1; i <= 3; i++) {
      ctx.moveTo(cx - 3 * u, cy + (6 + i * 4) * u);
      ctx.lineTo(cx + 3 * u, cy + (6 + i * 4) * u);
    }
    ctx.stroke();
    ring(26 * u, `rgba(110,230,255,${0.35 * al})`, 0.8);
  } else {
    ring(8 * u, `rgba(120,255,120,${0.85 * al})`, 1.2);
    glowDot(1.4 * u, `rgba(170,255,170,${al})`);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

//=============================================================
//                         STORY HUD
//=============================================================
function wrapLines(ctx, str, maxW) {
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const wd of words) {
    const test = line ? line + ' ' + wd : wd;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = wd;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawMission(ctx, game, w, h, u) {
  const m = game.mission;
  const o = m.objective;
  const p = game.player;

  // Objective panel (top-left)
  if (o.text && game.state === 'playing') {
    const x = 12 * u,
      y = 12 * u,
      pw = 170 * u;
    ctx.font = `${8 * u}px ${UI_FONT}`;
    const lines = wrapLines(ctx, o.text, pw - 14 * u);
    const ph = (20 + lines.length * 10 + (o.bar !== null ? 7 : 0)) * u;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, y, pw, ph, 3 * u);
    ctx.fill();
    ctx.fillStyle =
      m.flash > 0
        ? `rgba(245,215,110,${0.5 + 0.5 * Math.abs(Math.sin(game.time * 8))})`
        : '#b3140e';
    ctx.fillRect(x, y, 2 * u, ph);
    text(
      ctx,
      m.def.title.toUpperCase(),
      x + 8 * u,
      y + 10 * u,
      6.5 * u,
      'rgba(200,180,170,0.85)',
      'left',
      UI_FONT,
    );
    if (o.progress)
      text(ctx, o.progress, x + pw - 7 * u, y + 10 * u, 7 * u, '#f5d76e', 'right', UI_FONT);
    lines.forEach((ln, i) =>
      text(ctx, ln, x + 8 * u, y + (21 + i * 10) * u, 8 * u, '#f2efe6', 'left', UI_FONT, 0.6),
    );
    if (o.bar !== null) {
      const by = y + ph - 7 * u,
        bw = pw - 16 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 8 * u, by, bw, 2.5 * u);
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(x + 8 * u, by, bw * Math.max(0, Math.min(1, o.bar)), 2.5 * u);
    }
  }

  // Waypoints: a diamond over each objective target, clamped to the screen edge.
  const fovDeg = 75 + ((game.weaponDef.zoom || 55) - 75) * p.ads;
  const half = Math.tan((fovDeg * Math.PI) / 360);
  for (const tg of o.targets.slice(0, 4)) {
    const dx = tg.x - p.x,
      dy = tg.y - p.y;
    const dist = Math.hypot(dx, dy);
    const fwd = dx * Math.cos(p.angle) + dy * Math.sin(p.angle);
    const lat = dx * -Math.sin(p.angle) + dy * Math.cos(p.angle);
    let sx;
    if (fwd > 0.05) sx = w / 2 + (lat / fwd / half) * (w / 2);
    else sx = lat >= 0 ? w : 0;
    const off = sx < 18 * u || sx > w - 18 * u;
    sx = Math.max(18 * u, Math.min(w - 18 * u, sx));
    const sy = 44 * u;
    const pulse = 0.65 + 0.35 * Math.sin(game.time * 4);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = `rgba(245,215,110,${pulse})`;
    ctx.lineWidth = Math.max(1, 1.4 * u);
    ctx.strokeRect(-3.5 * u, -3.5 * u, 7 * u, 7 * u);
    ctx.restore();
    if (off)
      text(
        ctx,
        sx < w / 2 ? '<' : '>',
        sx + (sx < w / 2 ? -9 : 9) * u,
        sy + 3 * u,
        9 * u,
        `rgba(245,215,110,${pulse})`,
        'center',
      );
    text(
      ctx,
      `${Math.round(dist)}m`,
      sx,
      sy + 14 * u,
      6.5 * u,
      'rgba(245,215,110,0.85)',
      'center',
      UI_FONT,
    );
  }

  // Boss health bar
  const boss = m.boss;
  if (boss) {
    const bw = 160 * u,
      bx = w / 2 - bw / 2,
      by = 18 * u;
    text(ctx, 'BRUTE', w / 2, by - 3 * u, 8 * u, '#e8d9c0', 'center');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, bw, 5 * u);
    ctx.fillStyle = '#b3140e';
    ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), 5 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, 5 * u);
  }

  // Radio transmission (bottom centre, above the prompt area)
  const r = m.radio;
  if (r) {
    const a = Math.min(1, r.t / 0.25, (r.dur - r.t) / 0.4);
    const shown = r.text.slice(0, Math.floor(r.t * 55));
    const rw = 260 * u,
      rx = w / 2 - rw / 2;
    ctx.font = `${8 * u}px ${UI_FONT}`;
    const lines = wrapLines(ctx, r.text, rw - 20 * u);
    const rh = (18 + lines.length * 10) * u,
      ry = h - rh - 8 * u;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = 'rgba(8,10,12,0.72)';
    roundRect(ctx, rx, ry, rw, rh, 3 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(127,212,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    text(
      ctx,
      r.speaker,
      rx + 10 * u,
      ry + 11 * u,
      7 * u,
      r.speaker === 'YOU' ? '#cfc4ba' : '#7fd4ff',
      'left',
      UI_FONT,
    );
    let left = shown.length;
    lines.forEach((ln, i) => {
      const part = ln.slice(0, Math.max(0, left));
      left -= ln.length + 1;
      text(ctx, part, rx + 10 * u, ry + (22 + i * 10) * u, 8 * u, '#f2efe6', 'left', UI_FONT, 0.5);
    });
    ctx.globalAlpha = 1;
  }
}

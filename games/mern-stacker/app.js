(function () {
  'use strict';

  const R = window.MernStacker;
  const W = R.FIELD_W;
  const H = 640;
  const BH = 28;          // block height
  const GROUND_H = 64;    // height of the node_modules slab
  const FOCUS = 230;      // keep the sliding block this far from the top of the frame
  const GRAVITY = 1500;
  const DYING_MS = 900;   // pause on the wreckage before the game-over card
  const RESTART_GUARD_MS = 500; // stops a frantic last tap from instantly restarting

  const $ = (id) => document.getElementById(id);
  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // ---------------------------------------------------------------- state
  let phase = 'intro';     // intro | playing | dying | over
  let blocks, mover, debris, popups, rings;
  let score, combo, camY, shake, dyingFor, overSince, failMsg, failWhere, cuts, banner;
  let best = 0;
  let runId = 0;

  function reset() {
    blocks = [{ x: (W - R.START_W) / 2, w: R.START_W }];
    debris = [];
    popups = [];
    rings = [];
    cuts = [];
    banner = null;
    score = 0;
    combo = 0;
    camY = 0;
    shake = 0;
    dyingFor = 0;
    spawnMover();
  }

  function spawnMover() {
    const top = blocks[blocks.length - 1];
    const dir = blocks.length % 2 ? 1 : -1;
    mover = { w: top.w, x: dir === 1 ? 0 : W - top.w, dir, speed: R.speedFor(score) };
  }

  // World height (pixels above the ground slab) of the top of level `i`.
  const worldTop = (i) => (i + 1) * BH;
  const screenY = (wy) => H - GROUND_H - wy + camY;

  // ---------------------------------------------------------------- sound
  const Sfx = window.MernSfx;
  const soundBtn = $('sound');
  function showSound() { soundBtn.textContent = 'sound: ' + (Sfx.muted ? 'off' : 'on'); }
  try { Sfx.setMuted(localStorage.getItem('mern-stacker:muted') === '1'); } catch (e) { /* storage blocked */ }
  showSound();
  soundBtn.addEventListener('click', () => {
    Sfx.setMuted(!Sfx.muted);
    try { localStorage.setItem('mern-stacker:muted', Sfx.muted ? '1' : '0'); } catch (e) { /* fine */ }
    showSound();
    soundBtn.blur();
  });

  // ---------------------------------------------------------------- game flow
  function start() {
    Sfx.unlock();
    Sfx.start();
    reset();
    phase = 'playing';
    $('intro').hidden = true;
    $('over').hidden = true;
  }

  function addDebris(piece, level, style, fall) {
    const centre = piece.x + piece.w / 2;
    const side = fall || (centre < W / 2 ? -1 : 1);
    debris.push({
      x: piece.x, w: piece.w, wy: worldTop(level), style,
      vx: side * (50 + Math.random() * 80), vy: -60, rot: 0, vr: side * (0.6 + Math.random()),
    });
  }

  // Floating text for a drop at `level`. It starts just above the next sliding block,
  // so it never sits on top of the block you are about to aim.
  function popup(text, level, x, color) {
    for (const p of popups) p.t = Math.max(p.t, 0.9); // hurry older ones off so they never overlap
    popups.push({ text, wx: x, wy: worldTop(level + 1) + 12, t: 0, color: color || '#e6edf3' });
  }

  function drop() {
    const level = blocks.length;
    const top = blocks[level - 1];
    const style = R.blockFor(level);
    const res = R.drop(top, { x: mover.x, w: mover.w });

    if (!res.ok) {
      addDebris(res.cut, level, style, mover.dir);
      failMsg = R.pick(style.fail);
      failWhere = style.name + ' layer crashed at tower.js:' + level;
      phase = 'dying';
      dyingFor = 0;
      shake = reduceMotion ? 0 : 10;
      Sfx.fail();
      return;
    }

    if (res.cut) {
      addDebris(res.cut, level, style);
      const label = R.cutLabel(cuts.length);
      cuts.push(label);
      popup('- ' + label, level, res.cut.x + res.cut.w / 2, '#ff7b72');
      Sfx.slice(res.cut.w / top.w);
    }
    Sfx.place(level);

    let placed = res.placed;
    if (res.perfect) {
      combo++;
      const grown = R.regrow(placed, combo);
      const regrew = grown.w > placed.w;
      placed = grown;
      rings.push({ x: placed.x, w: placed.w, wy: worldTop(level), t: 0 });
      popup(R.pick(style.perfect) + (combo > 1 ? ' x' + combo : '') + (regrew ? ' +width' : ''),
        level, placed.x + placed.w / 2, '#7ee787');
      Sfx.perfect(combo);
      if (regrew) Sfx.grow();
    } else {
      combo = 0;
    }

    blocks.push(placed);
    score++;
    const release = R.releaseAt(level);
    if (release) {
      banner = { text: R.releaseLabel(release), t: 0 };
      Sfx.release();
    }
    spawnMover();
  }

  function press() {
    if (phase === 'intro') start();
    else if (phase === 'playing') drop();
    else if (phase === 'over' && performance.now() - overSince > RESTART_GUARD_MS) start();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    Sfx.unlock();
    press();
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowDown') return;
    if (e.target instanceof HTMLButtonElement) return; // let a focused button act as a button
    e.preventDefault();
    Sfx.unlock();
    press();
  });

  $('start').addEventListener('click', start);
  $('again').addEventListener('click', start);

  // ---------------------------------------------------------------- game over
  async function finish() {
    phase = 'over';
    overSince = performance.now();
    const mine = ++runId;
    const finalScore = score;
    const newBest = finalScore > best;
    best = Math.max(best, finalScore);

    $('fail-msg').textContent = failMsg;
    $('fail-where').textContent = failWhere;
    $('cut').textContent = cuts.length
      ? 'Shipped without: ' + R.cutSummary(cuts) + (cuts.length > 3 ? ' (' + cuts.length + ' cuts)' : '')
      : 'Shipped with zero scope cuts. Suspicious.';
    $('final').textContent = finalScore;
    $('rank').textContent = 'Rank: ' + R.rankFor(finalScore);
    $('best').hidden = !(newBest && finalScore > 0);
    $('status').textContent = finalScore > 0 ? 'Deploying score…' : 'Nothing was shipped.';
    $('board').replaceChildren();
    $('over').hidden = false;

    if (finalScore > 0) {
      const r = await Arcade.submitScore(finalScore);
      if (mine !== runId) return;
      if (r.ok && r.offline) $('status').textContent = 'Offline mode: score not saved.';
      else if (r.ok) $('status').textContent = 'Score deployed to the leaderboard.';
      else if (r.reason === 'guest') $('status').textContent = 'Log in to get on the leaderboard.';
      else $('status').textContent = 'Score not saved (' + r.reason + ').';
    }

    const lb = await Arcade.getLeaderboard(5);
    if (mine !== runId || !lb.ok || !Array.isArray(lb.entries)) return;
    const rows = lb.entries.slice().sort((a, b) => b.score - a.score).slice(0, 5);
    const board = $('board');
    board.replaceChildren(...rows.map((row) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      const pts = document.createElement('b');
      name.textContent = row.name;   // names come from other players: text only, never HTML
      pts.textContent = row.score;
      li.append(name, pts);
      return li;
    }));
  }

  // ---------------------------------------------------------------- update
  function update(dt) {
    if (phase === 'intro' || phase === 'playing') {
      mover.x += mover.dir * mover.speed * dt;
      const max = W - mover.w;
      if (mover.x < 0) { mover.x = -mover.x; mover.dir = 1; }
      else if (mover.x > max) { mover.x = 2 * max - mover.x; mover.dir = -1; }
    }

    const target = Math.max(0, worldTop(blocks.length) - (H - GROUND_H - FOCUS));
    camY += (target - camY) * Math.min(1, dt * 6);

    for (const d of debris) {
      d.vy += GRAVITY * dt;
      d.wy -= d.vy * dt;
      d.x += d.vx * dt;
      d.rot += d.vr * dt;
    }
    debris = debris.filter((d) => screenY(d.wy) < H + 120);

    for (const p of popups) p.t += dt;
    popups = popups.filter((p) => p.t < 1.1);
    for (const r of rings) r.t += dt;
    rings = rings.filter((r) => r.t < 0.4);
    shake = Math.max(0, shake - dt * 30);
    if (banner && (banner.t += dt) > 1.8) banner = null;

    if (phase === 'dying') {
      dyingFor += dt * 1000;
      if (dyingFor >= DYING_MS) finish();
    }
  }

  // ---------------------------------------------------------------- draw
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.max(0, Math.min(255, v + amt));
    return 'rgb(' + c(n >> 16) + ',' + c((n >> 8) & 255) + ',' + c(n & 255) + ')';
  }

  function drawBlock(x, y, w, style) {
    ctx.fillStyle = style.color;
    ctx.fillRect(x, y, w, BH);
    ctx.fillStyle = shade(style.color, 38);
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = shade(style.color, -45);
    ctx.fillRect(x, y + BH - 3, w, 3);
    if (w < 14) return;
    ctx.fillStyle = style.ink;
    ctx.font = '700 14px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = ctx.measureText(style.name).width + 10 <= w ? style.name : style.letter;
    ctx.fillText(label, x + w / 2, y + BH / 2 + 1);
  }

  function drawBackdrop() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0f17');
    g.addColorStop(1, '#161b22');
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Editor gutter: faint line numbers that scroll with the tower.
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const base = H - GROUND_H + camY;
    const first = Math.max(1, Math.floor((base - H) / BH));
    for (let k = first; k <= first + H / BH + 2; k++) {
      const y = base - k * BH;
      if (y < -BH || y > H) continue;
      ctx.fillStyle = 'rgba(139,148,158,0.07)';
      ctx.fillRect(0, y, W, 1);
      ctx.fillStyle = 'rgba(139,148,158,0.25)';
      ctx.fillText(String(k), 8, y - 8);
    }
  }

  function drawGround() {
    const y = screenY(0);
    if (y > H + 40) return;
    ctx.fillStyle = '#2d333b';
    ctx.fillRect(-20, y, W + 40, H);
    ctx.fillStyle = '#444c56';
    ctx.fillRect(-20, y, W + 40, 3);
    ctx.fillStyle = '#8b949e';
    ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('node_modules/  (1.2 GB)', W / 2, y + 26);
  }

  // Text with a dark outline so it stays readable over blocks and gutter numbers.
  function outlinedText(text, x, y, color) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(13,17,23,0.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawHud() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(230,237,243,0.9)';
    ctx.font = '700 56px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText(String(score), W / 2, 78);
    ctx.fillStyle = 'rgba(139,148,158,0.8)';
    ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
    const scope = Math.round(100 * blocks[blocks.length - 1].w / R.START_W);
    ctx.fillText('stack.length  \u00b7  scope ' + scope + '%', W / 2, 98);
    if (combo >= 2) {
      ctx.fillStyle = '#7ee787';
      ctx.fillText('perfect streak x' + combo, W / 2, 118);
    }
    if (banner) {
      const k = banner.t / 1.8;
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25;
      ctx.font = '700 18px ui-monospace, Menlo, Consolas, monospace';
      outlinedText(banner.text, W / 2, 148 - Math.min(1, banner.t * 8) * 6, '#f2cc60');
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawBackdrop();
    drawGround();

    blocks.forEach((b, i) => {
      const y = screenY(worldTop(i));
      if (y > H || y < -BH) return;
      drawBlock(b.x, y, b.w, R.blockFor(i));
    });

    if (phase === 'intro' || phase === 'playing') {
      drawBlock(mover.x, screenY(worldTop(blocks.length)), mover.w, R.blockFor(blocks.length));
    }

    for (const d of debris) {
      ctx.save();
      ctx.translate(d.x + d.w / 2, screenY(d.wy) + BH / 2);
      ctx.rotate(d.rot);
      ctx.globalAlpha = 0.9;
      drawBlock(-d.w / 2, -BH / 2, d.w, d.style);
      ctx.restore();
    }

    for (const r of rings) {
      const k = r.t / 0.4;
      const grow = k * 14;
      ctx.strokeStyle = 'rgba(126,231,135,' + (1 - k) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - grow, screenY(r.wy) - grow, r.w + grow * 2, BH + grow * 2);
    }

    ctx.font = '700 15px ui-monospace, Menlo, Consolas, monospace';
    for (const p of popups) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      // Keep the whole string inside the frame, however long it is.
      const half = ctx.measureText(p.text).width / 2 + 10;
      const x = Math.max(half, Math.min(W - half, p.wx));
      outlinedText(p.text, x, screenY(p.wy) - p.t * 36, p.color);
    }
    ctx.globalAlpha = 1;

    if (phase === 'playing' || phase === 'dying') drawHud();
    ctx.restore();
  }

  // ---------------------------------------------------------------- boot
  reset();
  Arcade.ready().then(({ user }) => {
    $('who-intro').textContent = user ? 'Playing as ' + user.name : 'Playing as guest: scores will not be saved.';
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

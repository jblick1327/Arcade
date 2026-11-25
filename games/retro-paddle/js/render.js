/*
 * render.js — draws the app state onto a canvas in logical 800x600 units.
 * Pure black and white, block-pixel score digits, no effects.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.PaddleRender = factory(root.PaddleCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  var W = Core.FIELD.W, H = Core.FIELD.H;
  var BLACK = '#000000', WHITE = '#FFFFFF';
  var FONT = '"Courier New", Courier, monospace';

  // 3x5 block digits, row-major.
  var DIGITS = [
    '111101101101111', '001001001001001', '111001111100111', '111001111001111', '101101111001001',
    '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'
  ];

  function drawNumber(ctx, value, cx, y, cell) {
    var str = String(value);
    var dw = 3 * cell, gap = 2 * cell;
    var x = Math.round(cx - (str.length * dw + (str.length - 1) * gap) / 2);
    for (var n = 0; n < str.length; n++) {
      var glyph = DIGITS[+str[n]];
      for (var i = 0; i < 15; i++) {
        if (glyph[i] === '1') ctx.fillRect(x + (i % 3) * cell, y + Math.floor(i / 3) * cell, cell, cell);
      }
      x += dw + gap;
    }
  }

  function text(ctx, str, x, y, size, align) {
    ctx.font = 'bold ' + size + 'px ' + FONT;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawField(ctx, app) {
    var m = app.match;
    ctx.fillStyle = WHITE;

    for (var y = 0; y < H; y += 30) ctx.fillRect(W / 2 - 3, y + 8, 6, 14); // dashed divider

    drawNumber(ctx, m.scores[0], W / 4, 30, 12);
    drawNumber(ctx, m.scores[1], (3 * W) / 4, 30, 12);

    [m.left, m.right].forEach(function (p) {
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.w, p.h);
    });

    var b = m.ball;
    if (b.active || app.state === 'countdown') {
      ctx.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size);
    }

    var count = app.countdownValue();
    if (count) {
      ctx.fillStyle = BLACK;
      ctx.fillRect(W / 2 - 22, H / 2 - 112, 44, 64);
      ctx.fillStyle = WHITE;
      drawNumber(ctx, count, W / 2, H / 2 - 105, 10);
    }
  }

  function drawMenu(ctx, app, menu) {
    var layout = app.getMenuLayout(menu);

    if (menu.overlay) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = WHITE;
    text(ctx, menu.title, W / 2, layout.titleY, menu.title.length > 12 ? 50 : 60);
    if (menu.subtitle) text(ctx, menu.subtitle, W / 2, layout.subtitleY, 20);

    if (menu.lines) {
      ctx.font = 'bold 22px ' + FONT;
      var widest = 0;
      menu.lines.forEach(function (l) { widest = Math.max(widest, ctx.measureText(l).width); });
      var lx = Math.round(W / 2 - widest / 2);
      menu.lines.forEach(function (l, i) {
        text(ctx, l, lx, layout.linesY + i * layout.lineHeight, 22, 'left');
      });
    }

    menu.items.forEach(function (item, i) {
      var r = layout.items[i];
      var selected = i === app.selected;
      if (selected) {
        ctx.fillStyle = WHITE;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = BLACK;
      } else {
        ctx.fillStyle = WHITE;
      }
      text(ctx, item.label, W / 2, r.y + r.h / 2 + 1, 28);
    });
  }

  // scale = device pixels per logical unit.
  function render(ctx, app, scale) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, W, H);

    if (app.match && (app.isInGame() || app.state === 'paused' || app.state === 'gameOver')) {
      drawField(ctx, app);
    }
    var menu = app.getMenu();
    if (menu) drawMenu(ctx, app, menu);
  }

  return { render: render, DIGITS: DIGITS };
});

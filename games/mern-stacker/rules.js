(function () {
  'use strict';

  const FIELD_W = 480;
  const START_W = 240;
  const PERFECT_PX = 5;   // within this many pixels counts as a perfect drop
  const REGROW_PX = 8;    // width handed back per perfect once the combo is going
  const REGROW_AT = 3;    // consecutive perfects before blocks start to grow back
  const MIN_W = 2;        // anything thinner than this is just gone

  // Blocks cycle through the stack in order: M, E, R, N, M, E, ...
  const STACK = [
    { letter: 'M', name: 'MongoDB', color: '#13aa52', ink: '#ffffff' },
    { letter: 'E', name: 'Express', color: '#aab2bd', ink: '#1b1f24' },
    { letter: 'R', name: 'React', color: '#61dafb', ink: '#0b2530' },
    { letter: 'N', name: 'Node', color: '#9ccc3c', ink: '#1b2a08' },
  ];

  const RANKS = [
    [0, 'Unemployed'],
    [1, 'Intern'],
    [6, 'Junior Dev'],
    [12, 'Mid-Level Dev'],
    [20, 'Senior Dev'],
    [32, 'Staff Engineer'],
    [48, 'Principal Engineer'],
    [70, 'Distinguished Engineer'],
    [100, 'CTO (still has root access)'],
  ];

  const PERFECT_QUIPS = ['Hot reload!', 'Zero downtime!', 'LGTM', 'Cache hit!', 'Shipped to prod!', 'Tests passing!'];
  const FAIL_QUIPS = [
    'Build failed: block not found',
    'Uncaught TypeError: tower is undefined',
    'ECONNREFUSED: block never connected',
    'Segmentation fault (core dumped)',
    'npm ERR! missing peer dependency',
    'Merge conflict in tower.js',
    'Works on my machine',
  ];

  function blockFor(index) {
    return STACK[((index % STACK.length) + STACK.length) % STACK.length];
  }

  // Pixels per second for the block that is about to slide, given how many blocks are stacked.
  function speedFor(score) {
    return Math.min(520, 170 + score * 7);
  }

  // Land `mover` on `top`. Both are { x, w } measured from the left edge of the field.
  // Returns { ok:false, cut } when it misses completely, otherwise
  // { ok:true, perfect, placed, cut } where cut is the overhanging piece (or null).
  function drop(top, mover) {
    if (Math.abs(mover.x - top.x) <= PERFECT_PX && Math.abs(mover.w - top.w) <= PERFECT_PX) {
      return { ok: true, perfect: true, placed: { x: top.x, w: Math.min(top.w, mover.w) }, cut: null };
    }
    const left = Math.max(top.x, mover.x);
    const right = Math.min(top.x + top.w, mover.x + mover.w);
    const overlap = right - left;
    if (overlap < MIN_W) return { ok: false, perfect: false, placed: null, cut: { x: mover.x, w: mover.w } };

    const placed = { x: left, w: overlap };
    let cut = null;
    if (mover.x < left) cut = { x: mover.x, w: left - mover.x };
    else if (mover.x + mover.w > right) cut = { x: right, w: mover.x + mover.w - right };
    return { ok: true, perfect: false, placed, cut };
  }

  // After enough perfects in a row the tower earns some width back (never past the starting width).
  function regrow(placed, combo) {
    if (combo < REGROW_AT || placed.w >= START_W) return placed;
    const w = Math.min(START_W, placed.w + REGROW_PX);
    const x = Math.min(Math.max(0, placed.x - (w - placed.w) / 2), FIELD_W - w);
    return { x, w };
  }

  function rankFor(score) {
    let title = RANKS[0][1];
    for (const [min, name] of RANKS) if (score >= min) title = name;
    return title;
  }

  function pick(list, random) {
    return list[Math.floor((random || Math.random)() * list.length) % list.length];
  }

  const rules = {
    FIELD_W, START_W, PERFECT_PX, REGROW_PX, REGROW_AT, MIN_W,
    STACK, RANKS, PERFECT_QUIPS, FAIL_QUIPS,
    blockFor, speedFor, drop, regrow, rankFor, pick,
  };
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else window.MernStacker = rules;
})();

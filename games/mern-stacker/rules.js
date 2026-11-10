(function () {
  'use strict';

  const FIELD_W = 480;
  const START_W = 240;
  const PERFECT_PX = 5;   // within this many pixels counts as a perfect drop
  const REGROW_PX = 8;    // width handed back per perfect once the combo is going
  const REGROW_AT = 3;    // consecutive perfects before blocks start to grow back
  const MIN_W = 2;        // anything thinner than this is just gone

  // Blocks cycle bottom-up in real architecture order: the database at the bottom,
  // the runtime on top of it, the server framework on the runtime, the client on top.
  // (The acronym says M-E-R-N. The acronym was never in order.)
  const STACK = [
    {
      letter: 'M', name: 'MongoDB', color: '#13aa52', ink: '#ffffff',
      perfect: ['Index hit!', 'Write acknowledged', 'Replica set happy'],
      fail: ['MongoServerError: connection refused', 'E11000 duplicate key error', 'Schema? We said schemaless.'],
    },
    {
      letter: 'N', name: 'Node', color: '#9ccc3c', ink: '#1b2a08',
      perfect: ['Event loop clear', 'Non-blocking!', '0 vulnerabilities'],
      fail: ['FATAL ERROR: JavaScript heap out of memory', 'UnhandledPromiseRejection', "Error: Cannot find module 'tower'"],
    },
    {
      letter: 'E', name: 'Express', color: '#aab2bd', ink: '#1b1f24',
      perfect: ['200 OK', 'Route matched', 'next() called'],
      fail: ['Cannot GET /tower', '500 Internal Server Error', "Can't set headers after they are sent"],
    },
    {
      letter: 'R', name: 'React', color: '#61dafb', ink: '#0b2530',
      perfect: ['No re-renders!', 'Hydrated cleanly', 'Hooks in order'],
      fail: ['Too many re-renders', 'Each child in a list should have a unique "key" prop', 'Hydration mismatch'],
    },
  ];

  // Every overhang you slice off is scope you just cut. It gets worse as the run goes on.
  const CUTS = [
    'dark mode', 'i18n', 'animations', 'the onboarding tour', 'docs', 'the README',
    'mobile layout', 'accessibility', 'unit tests', 'integration tests', 'error handling',
    'input validation', 'logging', 'rate limiting', 'auth', 'backups', 'password hashing', 'the database',
  ];
  const CUTS_AFTER = 'whatever was left';

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

  // Name of the n-th feature cut in a run (0-based).
  function cutLabel(n) {
    return n < CUTS.length ? CUTS[n] : CUTS_AFTER;
  }

  // "dark mode, i18n, ... password hashing" for the game-over card: the first two and the
  // latest, because the escalation is the joke.
  function cutSummary(cuts) {
    if (cuts.length === 0) return '';
    if (cuts.length <= 3) return cuts.join(', ');
    return cuts[0] + ', ' + cuts[1] + ', \u2026 ' + cuts[cuts.length - 1];
  }

  // Placing the block at `level` finishes a whole Mongo-Node-Express-React set.
  // Returns the release number it ships (1, 2, ...) or 0.
  function releaseAt(level) {
    return level % STACK.length === STACK.length - 1 ? (level + 1) / STACK.length : 0;
  }

  function releaseLabel(n) {
    return n === 1 ? 'v1.0.0: MVP shipped!' : 'v' + n + '.0.0 shipped!';
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
    STACK, CUTS, RANKS,
    blockFor, speedFor, drop, regrow, cutLabel, cutSummary, releaseAt, releaseLabel, rankFor, pick,
  };
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else window.MernStacker = rules;
})();

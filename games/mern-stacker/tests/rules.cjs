const assert = require('node:assert/strict');
const { test } = require('node:test');
const R = require('../rules.js');

test('blocks stack bottom-up in architecture order, not acronym order', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((i) => R.blockFor(i).name), ['MongoDB', 'Node', 'Express', 'React', 'MongoDB', 'Node']);
});

test('every layer has its own perfect and failure lines', () => {
  for (const layer of R.STACK) {
    assert.ok(layer.perfect.length > 0, layer.name);
    assert.ok(layer.fail.length > 0, layer.name);
  }
});

test('scope cuts escalate in order and then run out', () => {
  assert.equal(R.cutLabel(0), R.CUTS[0]);
  assert.equal(R.cutLabel(R.CUTS.length - 1), 'the database');
  assert.equal(R.cutLabel(R.CUTS.length), 'whatever was left');
});

test('a release ships when a React block completes a set', () => {
  // Level 0 is the starting MongoDB block, so levels 3, 7, 11 are React.
  assert.deepEqual([1, 2, 3, 4, 7, 11].map(R.releaseAt), [0, 0, 1, 0, 2, 3]);
  for (const level of [3, 7, 11]) assert.equal(R.blockFor(level).name, 'React');
  assert.equal(R.releaseLabel(1), 'v1.0.0: MVP shipped!');
  assert.equal(R.releaseLabel(3), 'v3.0.0 shipped!');
});

test('a drop within the tolerance is perfect and snaps to the block below', () => {
  const r = R.drop({ x: 100, w: 200 }, { x: 103, w: 200 });
  assert.equal(r.ok, true);
  assert.equal(r.perfect, true);
  assert.deepEqual(r.placed, { x: 100, w: 200 });
  assert.equal(r.cut, null);
});

test('overhanging on the right slices off the right edge', () => {
  const r = R.drop({ x: 100, w: 200 }, { x: 140, w: 200 });
  assert.equal(r.ok, true);
  assert.equal(r.perfect, false);
  assert.deepEqual(r.placed, { x: 140, w: 160 });
  assert.deepEqual(r.cut, { x: 300, w: 40 });
});

test('overhanging on the left slices off the left edge', () => {
  const r = R.drop({ x: 100, w: 200 }, { x: 60, w: 200 });
  assert.deepEqual(r.placed, { x: 100, w: 160 });
  assert.deepEqual(r.cut, { x: 60, w: 40 });
});

test('a narrower block resting inside the one below is not cut', () => {
  const r = R.drop({ x: 100, w: 200 }, { x: 150, w: 100 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.placed, { x: 150, w: 100 });
  assert.equal(r.cut, null);
});

test('missing completely (or only touching) fails the build', () => {
  const miss = R.drop({ x: 100, w: 100 }, { x: 300, w: 100 });
  assert.equal(miss.ok, false);
  assert.deepEqual(miss.cut, { x: 300, w: 100 });
  assert.equal(R.drop({ x: 100, w: 100 }, { x: 200, w: 100 }).ok, false);
});

test('blocks only grow back after a streak of perfects, and never past the start width', () => {
  assert.deepEqual(R.regrow({ x: 100, w: 100 }, R.REGROW_AT - 1), { x: 100, w: 100 });
  const grown = R.regrow({ x: 100, w: 100 }, R.REGROW_AT);
  assert.equal(grown.w, 100 + R.REGROW_PX);
  assert.equal(grown.x, 100 - R.REGROW_PX / 2);
  assert.deepEqual(R.regrow({ x: 100, w: R.START_W }, 10), { x: 100, w: R.START_W });
  const edge = R.regrow({ x: 0, w: 100 }, 5);
  assert.ok(edge.x >= 0 && edge.x + edge.w <= R.FIELD_W);
});

test('speed rises with height but is capped', () => {
  assert.ok(R.speedFor(10) > R.speedFor(0));
  assert.equal(R.speedFor(10000), 520);
});

test('ranks are non-decreasing in score and the top rank is reachable', () => {
  assert.equal(R.rankFor(0), 'Unemployed');
  assert.equal(R.rankFor(1), 'Intern');
  assert.equal(R.rankFor(25), 'Senior Dev');
  assert.equal(R.rankFor(500), R.RANKS[R.RANKS.length - 1][1]);
});

test('pick always returns an item from the list', () => {
  assert.equal(R.pick(['a', 'b', 'c'], () => 0.999999), 'c');
  assert.equal(R.pick(['a', 'b', 'c'], () => 0), 'a');
});

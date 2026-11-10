const assert = require('node:assert/strict');
const A = require('../setup.js');
const R = require('../rules.js');
const idx = square => (8 - Number(square[1])) * 8 + 'abcdefgh'.indexOf(square[0]);

let draft = A.create();
function put(piece, square) {
  const result = A.perform(draft, piece, idx(square));
  assert.equal(result.error, '');
  draft = result.state;
}
assert.equal(A.placementError(draft, 'Q', idx('d1')), 'Place both kings first.');
put('K', 'e1');
assert.equal(draft.turn, 'b');
put('K', 'e8');
assert.equal(draft.turn, 'w');
assert.equal(A.placementError(draft, 'K', idx('c1')), 'One king per player.');
assert.equal(A.placementError(draft, 'P', idx('c1')), 'Pawns cannot go on the back rank.');
assert.equal(A.placementError(draft, 'R', idx('e3')), 'Both kings must stay out of check.');
assert.ok(A.placementError(draft, 'P', idx('a5')));
put('Q', 'd1');
assert.ok(A.placementError(draft, 'X', idx('e8'), 'b'));
assert.equal(A.placementError(draft, 'Q', idx('e1'), 'w'), 'Square occupied.');
assert.equal(draft.armies.w[idx('d1')], 'Q');

let skipped = false;
while (!A.complete(draft)) {
  const color = draft.turn;
  const pieces = color === 'w' ? ['Q', 'N', 'P'] : ['P', 'N', 'Q'];
  const placement = pieces.flatMap(p => Array.from({ length: 64 }, (_, i) => [p, i]))
    .find(([p, i]) => !A.placementError(draft, p, i));
  assert.ok(placement, 'a side without placements has already been skipped');
  draft = A.perform(draft, ...placement).state;
  if (draft.turn === color && !A.complete(draft)) skipped = true;
  assert.ok(A.points(draft.armies[color]) <= A.BUDGET);
}
assert.ok(skipped, 'the remaining player takes a turn when the other runs out');
assert.equal(A.hasPlacement(draft, 'w'), false);
assert.equal(A.hasPlacement(draft, 'b'), false);
const position = A.battlePosition(draft);
assert.equal(position.b[R.index('e1')], 'K');
assert.equal(position.b[R.index('e8')], 'k');
console.log('Draft rules verified: kings first, permanent placements, skipped turns, and automatic battle.');

import assert from 'node:assert/strict';
import { test } from 'node:test';
import Army from '../games/automate/setup.js';
import Chess from '../games/automate/rules.js';
import { currentAutomateState, restartIncompatibleDraft, validateAutomateUpdate } from './automate.js';

const seat = color => color === 'w' ? 0 : 1;
const patch = (draft, runner = null, moves = []) => ({
  state: { phase: runner === null ? 'draft' : 'battle', draft: Army.snapshot(draft), runner, moves },
  turn: runner ?? seat(draft.turn),
});

function apply(state, actor, proposal) {
  const next = validateAutomateUpdate(state, actor, proposal);
  assert.ok(next, 'the server accepts the legal transition');
  return next;
}

function draftKings() {
  const white = Army.perform(Army.create(), 'K', 60).state;
  const black = Army.perform(white, 'K', 4).state;
  return apply(apply(null, 0, patch(white)).state, 1, patch(black)).state;
}

test('draft writes allow one placement without changing either army’s existing pieces', () => {
  const ready = draftKings();
  const one = Army.perform(ready.draft, 'N', 57).state;
  for (const modify of [
    proposal => { proposal.state.draft.armies.b[4] = null; },
    proposal => { proposal.state.draft.armies.w[58] = 'B'; },
    proposal => { proposal.state.draft.armies.w[60] = null; },
    proposal => { proposal.turn = 0; },
    proposal => { proposal.result = { winner: 0 }; },
  ]) {
    const proposal = patch(one);
    modify(proposal);
    assert.equal(validateAutomateUpdate(ready, 0, proposal), null);
  }
  assert.equal(validateAutomateUpdate(ready, 1, patch(one)), null);
  assert.equal(validateAutomateUpdate(ready, 0, patch(one, 0)), null);
  assert.equal(apply(ready, 0, patch(one)).turn, 1);
});

test('compatible saved drafts recalculate availability while incompatible drafts stay read-only', () => {
  const ready = draftKings();
  const legacy = patch(ready.draft).state;
  legacy.draft.done.w = true;
  assert.deepEqual(currentAutomateState(legacy).draft.done, { w: false, b: false });
  legacy.draft.armies.w[60] = null;
  legacy.draft.armies.w[57] = 'N';
  assert.equal(currentAutomateState(legacy).restartRequired, true);
  assert.equal(validateAutomateUpdate(legacy, 0, patch(ready.draft)), null);
});

test('restart permits incompatible saved drafts but not healthy drafts or battles', () => {
  const ready = draftKings();
  const legacy = patch(ready.draft).state;
  legacy.draft.armies.w[60] = null;
  legacy.draft.armies.w[57] = 'N';
  assert.deepEqual(restartIncompatibleDraft(legacy), { state: null, turn: 0, winner: null });
  assert.equal(restartIncompatibleDraft(patch(ready.draft).state), null);
  assert.equal(restartIncompatibleDraft(patch(ready.draft, 0).state), null);
  const cleared = restartIncompatibleDraft(legacy);
  const king = Army.perform(Army.create(), 'K', 60).state;
  assert.ok(validateAutomateUpdate(cleared.state, cleared.turn, patch(king)));
});

test('a full draft starts the battle and the server accepts only one legal move from the runner', () => {
  let state = draftKings();
  let runner;
  while (state.phase === 'draft') {
    runner = seat(state.draft.turn);
    const placement = ['P', 'Q', 'N', 'B', 'R'].flatMap(p => Array.from({ length: 64 }, (_, i) => [p, i]))
      .find(([p, i]) => !Army.placementError(state.draft, p, i));
    assert.ok(placement);
    const draft = Army.perform(state.draft, ...placement).state;
    if (Army.complete(draft)) assert.equal(validateAutomateUpdate(state, runner, patch(draft)), null);
    state = apply(state, runner, patch(draft, Army.complete(draft) ? runner : null)).state;
  }
  const position = Army.battlePosition(state.draft);
  const move = Chess.legal(position)[0];
  const uci = Chess.key(move);
  const proposed = patch(state.draft, runner, [uci]);
  const next = apply(state, runner, proposed);
  assert.equal(next.status, undefined);
  assert.equal(validateAutomateUpdate(state, 1 - runner, proposed), null);
  assert.equal(validateAutomateUpdate(state, runner, { ...proposed, result: { winner: runner } }), null);
  const altered = patch(state.draft, runner, [uci]);
  altered.state.draft.armies.w[60] = null;
  assert.equal(validateAutomateUpdate(state, runner, altered), null);

  const reply = Chess.key(Chess.legal(Chess.apply(position, move))[0]);
  assert.equal(validateAutomateUpdate(state, runner, patch(state.draft, runner, [uci, reply])), null);
  assert.equal(validateAutomateUpdate(next.state, runner, patch(state.draft, runner, [])), null);
  assert.equal(validateAutomateUpdate(next.state, runner, patch(state.draft, runner, [uci, uci])), null);
  assert.deepEqual(apply(next.state, runner, patch(state.draft, runner, [uci, reply])).state.moves, [uci, reply]);
});

test('the server derives the winner from checkmate in a resumed battle', () => {
  const draft = Army.create();
  for (const [color, back, pawns] of [['w', 56, 48], ['b', 0, 8]]) {
    const army = draft.armies[color];
    [...'RNBQKBNR'].slice(1).forEach((piece, i) => { army[back + i + 1] = piece; });
    army.fill('P', pawns, pawns + 8);
  }
  draft.done = { w: true, b: true };
  const runner = 0;
  let state = patch(draft, runner).state;
  const moves = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
  for (let i = 1; i < moves.length; i++) {
    state = apply(state, runner, patch(draft, runner, moves.slice(0, i))).state;
  }
  const proposed = patch(draft, runner, moves);
  assert.equal(validateAutomateUpdate(state, runner, { ...proposed, result: { winner: 0 } }), null);
  assert.deepEqual(apply(state, runner, proposed), { ...proposed, status: 'done', winner: 1 });
});

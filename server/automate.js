import { isDeepStrictEqual } from 'node:util';
import Army from '../games/automate/setup.js';
import Chess from '../games/automate/rules.js';

function validDraft(draft) {
  return (draft?.turn === 'w' || draft?.turn === 'b')
    && typeof draft.done?.w === 'boolean' && typeof draft.done?.b === 'boolean'
    && Army.validArmy(draft.armies?.w, 'w') && Army.validArmy(draft.armies?.b, 'b');
}

const seat = color => color === 'w' ? 0 : 1;

export function currentAutomateState(state) {
  if (state?.phase !== 'draft' || state.placementOnly || state.restartRequired) return state;
  const valid = validDraft(state.draft);
  const draft = valid ? Army.snapshot(state.draft) : Army.create();
  const kings = Army.countKing(draft.armies.w) + Army.countKing(draft.armies.b);
  const hasOtherPieces = Army.points(draft.armies.w) + Army.points(draft.armies.b) > 0;
  if (!valid || (kings < 2 && hasOtherPieces) || (kings === 2 && !Army.battlePosition(draft))) {
    return { phase: 'draft', draft, runner: null, moves: [], restartRequired: true };
  }

  // Preserve compatible saved armies and derive readiness from placements, not old lock flags.
  const settled = Army.settle(draft);
  if (Army.complete(settled)) return { phase: 'battle', draft: settled, runner: seat(settled.turn), moves: [] };
  return { phase: 'draft', draft: settled, runner: null, moves: [], placementOnly: true };
}

/** Only incompatible legacy drafts may be reset. The following placement starts at White. */
export function restartIncompatibleDraft(state) {
  if (!currentAutomateState(state)?.restartRequired) return null;
  return { state: null, turn: 0, winner: null };
}

function save(patch, state, turn, history) {
  if (patch.turn !== turn || !isDeepStrictEqual(patch.state, state)) return null;
  const result = history && Chess.status(history);
  const terminal = result && (result.done || result.claim);
  if (!terminal) {
    if (patch.result != null) return null;
    return { state: state.phase === 'draft' ? { ...state, placementOnly: true } : state, turn };
  }

  const position = history.at(-1);
  const mate = Chess.checked(position) && Chess.legal(position).length === 0;
  const winner = mate ? (position.t === 1 ? 1 : 0) : null;
  if (patch.result != null && patch.result.winner !== winner) return null;
  return { state, turn, status: 'done', winner };
}

function updateDraft(draft, actor, patch) {
  const color = actor === 0 ? 'w' : 'b';
  if (draft.turn !== color || draft.done[color]) return null;
  const requested = patch.state?.draft?.armies?.[color];
  if (!Array.isArray(requested) || requested.length !== 64) return null;

  const index = draft.armies[color].findIndex((piece, i) => piece !== requested[i]);
  if (index === -1 || draft.armies[color][index] !== null) return null;
  const action = Army.perform(draft, requested[index], index);
  if (action.error) return null;

  const next = action.state;
  if (!Army.complete(next)) {
    return save(patch, { phase: 'draft', draft: next, runner: null, moves: [] }, seat(next.turn));
  }
  return save(patch, { phase: 'battle', draft: next, runner: actor, moves: [] }, actor, [Army.battlePosition(next)]);
}

function legalMove(position, uci) {
  if (typeof uci !== 'string') return null;
  const move = Chess.fromUci(position, uci);
  return move && Chess.key(move) === uci ? move : null;
}

function updateBattle(previous, actor, patch) {
  const { draft, runner, moves } = previous;
  if (runner !== actor || !Army.complete(draft) || !Array.isArray(moves)) return null;
  const proposed = patch.state?.moves;
  if (!Array.isArray(proposed) || proposed.length < moves.length || proposed.length > moves.length + 1
      || !moves.every((move, i) => move === proposed[i])) return null;

  const first = Army.battlePosition(draft);
  if (!first) return null;
  const history = [first];
  for (const uci of moves) {
    const position = history.at(-1);
    const move = legalMove(position, uci);
    if (!move) return null;
    history.push(Chess.apply(position, move));
  }

  const status = Chess.status(history);
  if (status.done || status.claim) {
    if (proposed.length !== moves.length) return null;
  } else {
    if (proposed.length !== moves.length + 1) return null;
    const position = history.at(-1);
    const move = legalMove(position, proposed.at(-1));
    if (!move) return null;
    history.push(Chess.apply(position, move));
  }
  return save(patch, { phase: 'battle', draft: Army.snapshot(draft), runner, moves: proposed }, runner, history);
}

export function validateAutomateUpdate(state, actor, patch) {
  const previous = currentAutomateState(state) ?? { phase: 'draft', draft: Army.create() };
  const { draft } = previous;
  if (previous.restartRequired || !validDraft(draft)) return null;
  if (previous.phase === 'draft') return updateDraft(draft, actor, patch);
  if (previous.phase === 'battle') return updateBattle(previous, actor, patch);
  return null;
}

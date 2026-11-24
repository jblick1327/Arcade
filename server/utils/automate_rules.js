// automate_rules.js - server-side checks for Automate matches
// Author: Reachnid Group
// Centennial College - Fall 2026

// The server never trusts the browser: before saving an Automate move it replays the whole game
// from the drafted armies and only accepts one legal draft placement or one legal engine move.
//
// A saved Automate state looks like:
//   { phase: 'draft' | 'battle', draft, runner, moves, placementOnly?, restartRequired? }
//   draft   - the two armies being drafted (see games/automate/setup.js)
//   runner  - seat whose browser runs Stockfish during the battle
//   moves   - the battle so far, as UCI strings like "e2e4"

//=============================================================
//                          IMPORTS
//=============================================================

// import node's deep-compare helper
import { isDeepStrictEqual } from 'node:util';

// import the game's own draft & chess rules, so browser and server agree
import Army from '../../games/automate/setup.js';
import Chess from '../../games/automate/rules.js';

//=============================================================
//                          HELPERS
//=============================================================

// check that a draft has a valid turn, valid done flags and two legal armies
function validDraft(draft) {
  return (
    (draft?.turn === 'w' || draft?.turn === 'b') &&
    typeof draft.done?.w === 'boolean' &&
    typeof draft.done?.b === 'boolean' &&
    Army.validArmy(draft.armies?.w, 'w') &&
    Army.validArmy(draft.armies?.b, 'b')
  );
}

// seat number for a colour - White is seat 0, Black is seat 1
const seat = (color) => (color === 'w' ? 0 : 1);

// accept the browser's write only if it matches exactly what the server worked out
// (returns the fields to save on the match, or null to reject)
function save(patch, state, turn, history) {
  // the browser must propose exactly the state and turn we computed
  if (patch.turn !== turn || !isDeepStrictEqual(patch.state, state)) return null;

  // is the game over after this move?
  const result = history && Chess.status(history);
  const terminal = result && (result.done || result.claim);
  if (!terminal) {
    // the game isn't over, so the browser may not claim a result
    if (patch.result != null) return null;
    return { state: state.phase === 'draft' ? { ...state, placementOnly: true } : state, turn };
  }

  // the game is over - the server decides the winner, not the browser
  const position = history.at(-1);
  const mate = Chess.checked(position) && Chess.legal(position).length === 0;
  const winner = mate ? (position.t === 1 ? 1 : 0) : null;
  if (patch.result != null && patch.result.winner !== winner) return null;
  return { state, turn, status: 'done', winner };
}

// check a draft write: exactly one new piece, placed legally by the colour whose turn it is
function updateDraft(draft, actor, patch) {
  // make sure it is this player's turn to place
  const color = actor === 0 ? 'w' : 'b';
  if (draft.turn !== color || draft.done[color]) return null;
  const requested = patch.state?.draft?.armies?.[color];
  if (!Array.isArray(requested) || requested.length !== 64) return null;

  // find the one square that changed - it must have been empty before
  const index = draft.armies[color].findIndex((piece, i) => piece !== requested[i]);
  if (index === -1 || draft.armies[color][index] !== null) return null;

  // apply the placement with the real draft rules
  const action = Army.perform(draft, requested[index], index);
  if (action.error) return null;

  // still drafting - the next placement goes to whoever's turn it is now
  const next = action.state;
  if (!Army.complete(next)) {
    return save(patch, { phase: 'draft', draft: next, runner: null, moves: [] }, seat(next.turn));
  }

  // the draft is finished - the battle starts and this player runs the engine
  return save(patch, { phase: 'battle', draft: next, runner: actor, moves: [] }, actor, [
    Army.battlePosition(next),
  ]);
}

// return the move for a UCI string if it is legal and written the standard way, else null
function legalMove(position, uci) {
  if (typeof uci !== 'string') return null;
  const move = Chess.fromUci(position, uci);
  return move && Chess.key(move) === uci ? move : null;
}

// check a battle write from the engine runner: earlier moves unchanged, plus one new legal move
function updateBattle(previous, actor, patch) {
  const { draft, runner, moves } = previous;

  // only the runner may write battle moves
  if (runner !== actor || !Army.complete(draft) || !Array.isArray(moves)) return null;

  // the new move list must start with the saved moves and add at most one
  const proposed = patch.state?.moves;
  if (
    !Array.isArray(proposed) ||
    proposed.length < moves.length ||
    proposed.length > moves.length + 1 ||
    !moves.every((move, i) => move === proposed[i])
  ) {
    return null;
  }

  // replay the saved moves from the starting position
  const first = Army.battlePosition(draft);
  if (!first) return null;
  const history = [first];
  for (const uci of moves) {
    const position = history.at(-1);
    const move = legalMove(position, uci);
    if (!move) return null;
    history.push(Chess.apply(position, move));
  }

  // a finished game takes no new move; otherwise exactly one legal move is added
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

  return save(
    patch,
    { phase: 'battle', draft: Army.snapshot(draft), runner, moves: proposed },
    runner,
    history,
  );
}

//=============================================================
//                          EXPORTS
//=============================================================

// bring a saved state up to date with the current rules
// (old drafts are re-checked; drafts that can't continue are flagged restartRequired)
export function currentAutomateState(state) {
  if (state?.phase !== 'draft' || state.placementOnly || state.restartRequired) return state;

  // start from the saved draft if it is valid, otherwise an empty one
  const valid = validDraft(state.draft);
  const draft = valid ? Army.snapshot(state.draft) : Army.create();
  const kings = Army.countKing(draft.armies.w) + Army.countKing(draft.armies.b);
  const hasOtherPieces = Army.points(draft.armies.w) + Army.points(draft.armies.b) > 0;

  // the current rules can't continue this draft - it needs a restart
  if (!valid || (kings < 2 && hasOtherPieces) || (kings === 2 && !Army.battlePosition(draft))) {
    return { phase: 'draft', draft, runner: null, moves: [], restartRequired: true };
  }

  // keep compatible saved armies and work out readiness from the placements, not old lock flags
  const settled = Army.settle(draft);
  if (Army.complete(settled)) {
    return { phase: 'battle', draft: settled, runner: seat(settled.turn), moves: [] };
  }
  return { phase: 'draft', draft: settled, runner: null, moves: [], placementOnly: true };
}

// reset an old draft that can't continue (returns null for any other state)
// the next placement starts with White
export function restartIncompatibleDraft(state) {
  if (!currentAutomateState(state)?.restartRequired) return null;
  return { state: null, turn: 0, winner: null };
}

// check an Automate update before it is saved
// state = the match's saved state, actor = seat writing, patch = { state, turn, result? }
// returns the fields to save, or null when the update is not allowed
export function validateAutomateUpdate(state, actor, patch) {
  const previous = currentAutomateState(state) ?? { phase: 'draft', draft: Army.create() };
  const { draft } = previous;
  if (previous.restartRequired || !validDraft(draft)) return null;
  if (previous.phase === 'draft') return updateDraft(draft, actor, patch);
  if (previous.phase === 'battle') return updateBattle(previous, actor, patch);
  return null;
}

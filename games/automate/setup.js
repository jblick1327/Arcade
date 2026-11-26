// setup.js - army draft rules shared by the Automate game and the server
// Author: Reachnid Group
// Centennial College - Fall 2026

// the two-player draft that comes before the Stockfish battle. Players take turns placing one
// piece at a time in their own three home ranks, paying from a fixed points budget. Every
// placement is final. Used by the browser (window.ArmySetup) and by the server (require).
//
// squares here are 0-63 with 0 = a8 and 63 = h1 (row 0 is Black's back rank).
//
// draft state: { armies: { w, b }, turn, done: { w, b } }
//   armies.w / armies.b  64-entry arrays of uppercase piece letters or null
//   turn                 'w' or 'b': who places next
//   done                 per colour, true when that colour has no legal placement left

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./rules.js'));
  else root.ArmySetup = factory(root.ChessRules);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Chess) {
  'use strict';

  //=============================================================
  //                          SETTINGS
  //=============================================================

  // points each piece costs. The king is free but must be placed first
  const COST = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
  // points each player may spend
  const BUDGET = 35;
  const names = { w: 'White', b: 'Black' };

  //=============================================================
  //                          HELPERS
  //=============================================================

  const opponent = (color) => (color === 'w' ? 'b' : 'w');
  // board row of square `i` (0 = rank 8)
  const row = (i) => Math.floor(i / 8);
  // algebraic name of square `i`, e.g. 60 -> 'e1'
  const square = (i) => 'abcdefgh'[i % 8] + (8 - row(i));
  // true when `color` may place on square `i`: White on ranks 1-3, Black on ranks 6-8
  const eligible = (color, i) =>
    Number.isInteger(i) && i >= 0 && i < 64 && (color === 'w' ? row(i) >= 5 : row(i) <= 2);
  // number of kings in an army (0 or 1 in a valid draft)
  const countKing = (army) => army.filter((x) => x === 'K').length;
  // points spent by an army
  const points = (army) => army.reduce((sum, p) => sum + (p ? COST[p] : 0), 0);

  //=============================================================
  //                        DRAFT STATE
  //=============================================================

  // A fresh, empty draft with White to place first
  function create() {
    return {
      armies: { w: Array(64).fill(null), b: Array(64).fill(null) },
      turn: 'w',
      done: { w: false, b: false },
    };
  }

  // A deep copy of a draft, safe to modify or send over the network
  function snapshot(draft) {
    return {
      armies: { w: draft.armies.w.slice(), b: draft.armies.b.slice() },
      turn: draft.turn,
      done: { ...draft.done },
    };
  }

  //=============================================================
  //                      PLACEMENT RULES
  //=============================================================

  // basic per-piece rules: known piece, own zone, empty square, no pawns on the back rank,
  // one king, within budget. Returns an error message, or '' when the placement is fine.
  function pieceError(draft, piece, i, color) {
    const army = draft.armies[color];
    if (typeof piece !== 'string' || !Object.hasOwn(COST, piece)) return 'Choose a piece.';
    if (!eligible(color, i)) return 'Wrong square.';
    if (draft.armies.w[i] || draft.armies.b[i]) return 'Square occupied.';
    if (piece === 'P' && (row(i) === 0 || row(i) === 7)) return 'Pawns cannot go on the back rank.';
    if (piece === 'K' && countKing(army)) return 'One king per player.';
    if (points(army) + COST[piece] > BUDGET) return 'Not enough points.';
    return '';
  }

  // true when `army` is a 64-square array that could have been drafted legally by `color`
  function validArmy(army, color) {
    if (!Array.isArray(army) || army.length !== 64) return false;
    const draft = create();
    for (const [i, piece] of army.entries()) {
      if (piece === null) continue;
      if (pieceError(draft, piece, i, color)) return false;
      draft.armies[color][i] = piece;
    }
    return true;
  }

  // full placement rules for `color` (default: whoever's turn it is). On top of pieceError:
  // both kings must be down before any other piece, and no placement may put a king in check.
  // returns an error message, or '' when the placement is legal.
  function placementError(draft, piece, i, color = draft.turn) {
    const error = pieceError(draft, piece, i, color);
    if (error) return error;
    const otherHasKing = countKing(draft.armies[opponent(color)]);
    if (piece !== 'K' && (!countKing(draft.armies[color]) || !otherHasKing)) {
      return 'Place both kings first.';
    }
    if (otherHasKing) {
      const proposed = snapshot(draft);
      proposed.armies[color][i] = piece;
      if (!battlePosition(proposed)) return 'Both kings must stay out of check.';
    }
    return '';
  }

  // true when `color` has at least one legal placement left
  function hasPlacement(draft, color) {
    const army = draft.armies[color];
    const candidates = countKing(army) ? ['P', 'N', 'B', 'R', 'Q'] : ['K'];
    const left = BUDGET - points(army);
    const zoneStart = color === 'w' ? 40 : 0; // first square of the colour's three home ranks
    return candidates.some(
      (piece) =>
        COST[piece] <= left &&
        army
          .slice(zoneStart, zoneStart + 24)
          .some((_, offset) => !placementError(draft, piece, zoneStart + offset, color)),
    );
  }

  // recompute which colours are finished, and pass the turn to the other colour when `turn` has
  // nothing left to place but the other colour still does (a skipped turn).
  function settle(draft, turn = draft.turn) {
    const done = { w: !hasPlacement(draft, 'w'), b: !hasPlacement(draft, 'b') };
    const other = opponent(turn);
    return { ...draft, done, turn: done[turn] && !done[other] ? other : turn };
  }

  // place `piece` on square `i` for the colour whose turn it is.
  // returns { state, error } - the new draft (turn passed to the opponent), or the
  //          unchanged draft plus an error message
  function perform(draft, piece, i) {
    const error = placementError(draft, piece, i);
    if (error) return { state: draft, error };
    const next = snapshot(draft);
    next.armies[draft.turn][i] = piece;
    return { state: settle(next, opponent(draft.turn)), error: '' };
  }

  // true when neither colour can place anything else: the battle can start
  function complete(draft) {
    return draft.done.w && draft.done.b;
  }

  //=============================================================
  //                      BATTLE POSITION
  //=============================================================

  // the drafted armies as a FEN with White to move. Castling rights are granted wherever a king
  // and rook happen to stand on their standard starting squares.
  function fen(draft) {
    const board = Array(64).fill(null);
    for (const color of ['w', 'b']) {
      for (let i = 0; i < 64; i++) {
        const piece = draft.armies[color][i];
        if (piece) board[i] = color === 'w' ? piece : piece.toLowerCase();
      }
    }

    const ranks = [];
    for (let r = 0; r < 8; r++) {
      let word = '';
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = board[r * 8 + c];
        if (!p) {
          empty++;
        } else {
          if (empty) {
            word += empty;
            empty = 0;
          }
          word += p;
        }
      }
      if (empty) word += empty;
      ranks.push(word);
    }

    let castle = '';
    if (board[60] === 'K') {
      if (board[63] === 'R') castle += 'K';
      if (board[56] === 'R') castle += 'Q';
    }
    if (board[4] === 'k') {
      if (board[7] === 'r') castle += 'k';
      if (board[0] === 'r') castle += 'q';
    }
    return ranks.join('/') + ' w ' + (castle || '-') + ' - 0 1';
  }

  // the chess position the battle starts from, or null when the draft is not playable
  // (a king is missing, or either king is in check).
  function battlePosition(draft) {
    try {
      const position = Chess.parseFen(fen(draft));
      if (!Chess.checked(position, 1) && !Chess.checked(position, -1)) return position;
    } catch {
      /* incomplete draft: parseFen rejects a missing king */
    }
    return null;
  }

  //=============================================================
  //                          EXPORTS
  //=============================================================

  return {
    COST,
    BUDGET,
    names,
    opponent,
    row,
    square,
    eligible,
    countKing,
    points,
    create,
    snapshot,
    validArmy,
    placementError,
    hasPlacement,
    settle,
    perform,
    complete,
    fen,
    battlePosition,
  };
});

// rules.js - chess rules shared by the Automate game and the server
// Author: Reachnid Group
// Centennial College - Fall 2026

// dependency-free chess rules on a 0x88 board. Used by the browser (window.ChessRules) and by the
// server (require) so both sides agree on what is legal. MIT-licensed original code.
//
// board: an array of 128 squares where index = rank * 16 + file, with rank 0 = the 8th rank
// (Black's back rank) and file 0 = the a-file. Only indices where `(i & 0x88) === 0` are on the
// board; the other half is padding that makes off-board detection a single bit test.
// each square holds '.', an uppercase White piece (PNBRQK) or a lowercase Black piece (pnbrqk).
//
// position: { b, t, c, ep, half, full }
//   b     the 128-square board described above
//   t     side to move: 1 = White, -1 = Black
//   c     castling rights bitmask: 1 = White O-O, 2 = White O-O-O, 4 = Black O-O, 8 = Black O-O-O
//   ep    en-passant target square index, or -1
//   half  half-move clock (moves since the last capture or pawn move)
//   full  full-move number, starting at 1
//
// move: [from, to, promotion, flag]
//   promotion  '' or the lowercase piece letter a pawn promotes to ('q', 'r', 'b', 'n')
//   flag       '' for a normal move, 'ep' for en passant, 'castle' for castling

(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.ChessRules = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  //=============================================================
  //                          SETTINGS
  //=============================================================

  const FILES = 'abcdefgh';

  // Step offsets for each piece type on the 0x88 board. Queens use the king's (all 8) lines
  const dirs = {
    n: [-33, -31, -18, -14, 14, 18, 31, 33],
    b: [-17, -15, 15, 17],
    r: [-16, -1, 1, 16],
    k: [-17, -16, -15, -1, 1, 15, 16, 17],
  };

  // castling-rights bit lost when a rook leaves (or is captured on) its starting corner
  const ROOK_CORNER_BIT = { 119: 1, 112: 2, 7: 4, 0: 8 }; // h1, a1, h8, a8

  //=============================================================
  //                       SQUARE HELPERS
  //=============================================================

  // true when `i` is a real square (not 0x88 padding)
  const on = (i) => i >= 0 && i < 128 && !(i & 0x88);
  // owner of a piece letter: 1 for White, -1 for Black, 0 for an empty square
  const side = (p) => (!p || p === '.' ? 0 : p === p.toUpperCase() ? 1 : -1);
  // square index -> algebraic name, e.g. 116 -> 'e1'
  const sq = (i) => FILES[i & 7] + (8 - (i >> 4));
  // algebraic name -> square index, e.g. 'e1' -> 116
  const index = (name) => (8 - Number(name[1])) * 16 + FILES.indexOf(name[0]);
  // A move in UCI notation, e.g. 'e2e4' or 'e7e8q'
  const key = (m) => sq(m[0]) + sq(m[1]) + (m[2] || '');

  //=============================================================
  //                            FEN
  //=============================================================

  // parse a FEN string into a position. Throws on anything malformed
  function parseFen(fen) {
    const fields = fen.trim().split(/\s+/);
    const rows = fields[0].split('/');
    const board = Array(128).fill('.');
    if (
      rows.length !== 8 ||
      !/^[wb]$/.test(fields[1]) ||
      !/^(?:-|K?Q?k?q?)$/.test(fields[2]) ||
      !/^(?:-|[a-h][36])$/.test(fields[3])
    ) {
      throw Error('Invalid starting FEN');
    }

    rows.forEach((row, rank) => {
      let file = 0;
      for (const ch of row) {
        if (/^[1-8]$/.test(ch)) {
          file += Number(ch); // a digit is a run of empty squares
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(ch) || file >= 8) throw Error('Invalid FEN rank');
          board[rank * 16 + file++] = ch;
        }
      }
      if (file !== 8) throw Error('Invalid FEN rank');
    });
    if (
      board.filter((p) => p === 'K').length !== 1 ||
      board.filter((p) => p === 'k').length !== 1
    ) {
      throw Error('Exactly one king per side is required');
    }

    const rights = fields[2];
    const castling =
      (rights.includes('K') ? 1 : 0) |
      (rights.includes('Q') ? 2 : 0) |
      (rights.includes('k') ? 4 : 0) |
      (rights.includes('q') ? 8 : 0);
    const half = Number(fields[4] ?? 0);
    const full = Number(fields[5] ?? 1);
    if (!Number.isSafeInteger(half) || half < 0 || !Number.isSafeInteger(full) || full < 1) {
      throw Error('Invalid move counter');
    }
    return {
      b: board,
      t: fields[1] === 'w' ? 1 : -1,
      c: castling,
      ep: fields[3] === '-' ? -1 : index(fields[3]),
      half,
      full,
    };
  }

  // write a position back out as FEN (used to send positions to Stockfish)
  function toFen(pos) {
    const ranks = [];
    for (let rank = 0; rank < 8; rank++) {
      let text = '';
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = pos.b[rank * 16 + file];
        if (p === '.') {
          empty++;
        } else {
          if (empty) text += empty;
          empty = 0;
          text += p;
        }
      }
      if (empty) text += empty;
      ranks.push(text);
    }
    const castling =
      (pos.c & 1 ? 'K' : '') +
      (pos.c & 2 ? 'Q' : '') +
      (pos.c & 4 ? 'k' : '') +
      (pos.c & 8 ? 'q' : '');
    return [
      ranks.join('/'),
      pos.t === 1 ? 'w' : 'b',
      castling || '-',
      pos.ep === -1 ? '-' : sq(pos.ep),
      pos.half,
      pos.full,
    ].join(' ');
  }

  //=============================================================
  //                     ATTACKS AND CHECK
  //=============================================================

  // true when any piece of side `by` (1 or -1) attacks square `target`
  function attacked(pos, target, by) {
    for (let from = 0; from < 128; from++) {
      if (!on(from) || side(pos.b[from]) !== by) continue;
      const piece = pos.b[from].toLowerCase();
      if (piece === 'p') {
        // pawns attack one rank forward, one file to either side
        const ahead = from - 16 * by;
        if (target === ahead - 1 || target === ahead + 1) return true;
        continue;
      }
      for (const d of dirs[piece] || dirs.k) {
        for (let to = from + d; on(to); to += d) {
          if (to === target) return true;
          // sliders stop at the first piece; knights and kings take a single step
          if (pos.b[to] !== '.' || piece === 'n' || piece === 'k') break;
        }
      }
    }
    return false;
  }

  // true when `color`'s king (default: the side to move) is in check, or missing
  const checked = (pos, color = pos.t) => {
    const king = pos.b.indexOf(color === 1 ? 'K' : 'k');
    return king < 0 || attacked(pos, king, -color);
  };

  //=============================================================
  //                        MAKING MOVES
  //=============================================================

  // return the position after playing move `m`. The input position is not modified
  function apply(pos, m) {
    const [from, to, promo, flag] = m;
    const board = pos.b.slice();
    const piece = board[from];
    const captured = board[to];
    let castling = pos.c;

    board[from] = '.';
    board[to] = promo ? (pos.t === 1 ? promo.toUpperCase() : promo) : piece;
    if (flag === 'ep') board[to + 16 * pos.t] = '.'; // remove the pawn captured en passant
    if (flag === 'castle') {
      const rookFrom = to > from ? from + 3 : from - 4;
      const rookTo = to > from ? from + 1 : from - 1;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = '.';
    }

    if (piece === 'K') castling &= ~3;
    if (piece === 'k') castling &= ~12;
    if (piece.toLowerCase() === 'r') castling &= ~(ROOK_CORNER_BIT[from] || 0);
    if (captured.toLowerCase() === 'r') castling &= ~(ROOK_CORNER_BIT[to] || 0);

    const pawnMove = piece.toLowerCase() === 'p';
    return {
      b: board,
      t: -pos.t,
      c: castling,
      ep: pawnMove && Math.abs(to - from) === 32 ? (to + from) / 2 : -1, // after a double step
      half: pawnMove || captured !== '.' || flag === 'ep' ? 0 : pos.half + 1,
      full: pos.full + (pos.t === -1 ? 1 : 0),
    };
  }

  //=============================================================
  //                      MOVE GENERATION
  //=============================================================

  // every move for the side to move, ignoring whether it leaves their own king in check
  function pseudo(pos) {
    const out = [];
    const us = pos.t;
    for (let from = 0; from < 128; from++) {
      if (!on(from) || side(pos.b[from]) !== us) continue;
      const piece = pos.b[from].toLowerCase();

      // record a move to `to`, expanding pawn moves to the last rank into four promotions
      const add = (to, flag = '') => {
        if (pos.b[to].toLowerCase() === 'k') return; // kings are never captured
        if (piece === 'p' && (to >> 4 === 0 || to >> 4 === 7)) {
          for (const promo of ['q', 'r', 'b', 'n']) out.push([from, to, promo, flag]);
        } else {
          out.push([from, to, '', flag]);
        }
      };

      if (piece === 'p') {
        const ahead = from - 16 * us;
        if (on(ahead) && pos.b[ahead] === '.') {
          add(ahead);
          const twoAhead = ahead - 16 * us;
          const onStartRank = from >> 4 === (us === 1 ? 6 : 1);
          if (onStartRank && pos.b[twoAhead] === '.') add(twoAhead);
        }
        for (const d of [-1, 1]) {
          const diag = ahead + d;
          if (!on(diag)) continue;
          if (side(pos.b[diag]) === -us) {
            add(diag);
          } else if (
            diag === pos.ep &&
            pos.b[diag] === '.' &&
            pos.b[diag + 16 * us] === (us === 1 ? 'p' : 'P')
          ) {
            add(diag, 'ep');
          }
        }
        continue;
      }

      for (const d of dirs[piece] || dirs.k) {
        for (let to = from + d; on(to); to += d) {
          if (side(pos.b[to]) === us) break; // own piece blocks
          add(to);
          if (pos.b[to] !== '.' || piece === 'n' || piece === 'k') break;
        }
      }

      // castling: king on its home square, not in check, path empty and not attacked
      const home = us === 1 ? 116 : 4; // e1 / e8
      const rook = us === 1 ? 'R' : 'r';
      const [kingSide, queenSide] = us === 1 ? [1, 2] : [4, 8];
      if (piece === 'k' && from === home && !checked(pos)) {
        if (
          pos.c & kingSide &&
          pos.b[from + 3] === rook &&
          pos.b[from + 1] === '.' &&
          pos.b[from + 2] === '.' &&
          !attacked(pos, from + 1, -us) &&
          !attacked(pos, from + 2, -us)
        ) {
          add(from + 2, 'castle');
        }
        if (
          pos.c & queenSide &&
          pos.b[from - 4] === rook &&
          pos.b[from - 1] === '.' &&
          pos.b[from - 2] === '.' &&
          pos.b[from - 3] === '.' &&
          !attacked(pos, from - 1, -us) &&
          !attacked(pos, from - 2, -us)
        ) {
          add(from - 2, 'castle');
        }
      }
    }
    return out;
  }

  // every legal move for the side to move
  const legal = (pos) => pseudo(pos).filter((m) => !checked(apply(pos, m), pos.t));

  // move `m` in Standard Algebraic Notation, e.g. 'Nbd7', 'exd5', 'e8=Q+', 'O-O#'
  function san(pos, m) {
    const [from, to, promo, flag] = m;
    const piece = pos.b[from].toUpperCase();
    const capture = pos.b[to] !== '.' || flag === 'ep';
    let text = '';
    if (flag === 'castle') {
      text = to > from ? 'O-O' : 'O-O-O';
    } else {
      if (piece !== 'P') {
        text = piece;
        // disambiguate when another identical piece could reach the same square:
        // by file if that is enough, otherwise by rank, otherwise by full square.
        const rivals = legal(pos).filter(
          (x) => x[0] !== from && x[1] === to && pos.b[x[0]] === pos.b[from],
        );
        if (rivals.length) {
          const sameFile = rivals.some((x) => (x[0] & 7) === (from & 7));
          const sameRank = rivals.some((x) => x[0] >> 4 === from >> 4);
          text += !sameFile ? sq(from)[0] : !sameRank ? sq(from)[1] : sq(from);
        }
      } else if (capture) {
        text = sq(from)[0]; // pawn captures name the starting file
      }
      text += (capture ? 'x' : '') + sq(to) + (promo ? '=' + promo.toUpperCase() : '');
    }
    const next = apply(pos, m);
    return text + (checked(next) ? (legal(next).length ? '+' : '#') : '');
  }

  //=============================================================
  //                          GAME END
  //=============================================================

  // identity of a position for repetition counting. The en-passant square only counts when an
  // en-passant capture is actually possible.
  function positionKey(pos) {
    const ep = pos.ep >= 0 && legal(pos).some((m) => m[3] === 'ep') ? pos.ep : -1;
    return pos.b.join('') + ':' + pos.t + ':' + pos.c + ':' + ep;
  }

  // true when neither side can possibly checkmate (K v K, K+minor v K, or same-colour bishops)
  function insufficient(pos) {
    const pieces = []; // [letter, square colour] for everything except kings
    for (let i = 0; i < 128; i++) {
      if (on(i) && pos.b[i] !== '.' && pos.b[i].toLowerCase() !== 'k') {
        pieces.push([pos.b[i].toLowerCase(), ((i >> 4) + (i & 7)) % 2]);
      }
    }
    return (
      pieces.length === 0 ||
      (pieces.length === 1 && ['b', 'n'].includes(pieces[0][0])) ||
      (pieces.every((p) => p[0] === 'b') && new Set(pieces.map((p) => p[1])).size === 1)
    );
  }

  // Game status after the last position in `history`.
  // returns { done, text, claim? }
  //   done   the game is over (mate, stalemate, insufficient material, 75-move or fivefold rule)
  //   text   human-readable status line
  //   claim  when not done: a draw either side may claim ('threefold repetition' / '50-move rule')
  function status(history) {
    const pos = history[history.length - 1];
    const moves = legal(pos);
    const check = checked(pos);
    const id = positionKey(pos);
    const repeats = history.filter((p) => positionKey(p) === id).length;

    if (!moves.length) {
      return {
        done: true,
        text: check
          ? 'Checkmate — ' + (pos.t === 1 ? 'Black' : 'White') + ' wins!'
          : 'Draw — stalemate.',
      };
    }
    if (insufficient(pos)) return { done: true, text: 'Draw — insufficient material.' };
    if (pos.half >= 150 || repeats >= 5) {
      return {
        done: true,
        text: pos.half >= 150 ? 'Draw — 75-move rule.' : 'Draw — fivefold repetition.',
      };
    }
    return {
      done: false,
      text: (pos.t === 1 ? 'White' : 'Black') + ' to move' + (check ? ' · Check' : ''),
      claim: repeats >= 3 ? 'threefold repetition' : pos.half >= 100 ? '50-move rule' : '',
    };
  }

  // the legal move matching a UCI string (case-insensitive), or null
  function fromUci(pos, uci) {
    return legal(pos).find((m) => key(m) === uci.toLowerCase()) || null;
  }

  return {
    dirs,
    on,
    side,
    sq,
    index,
    key,
    parseFen,
    toFen,
    attacked,
    checked,
    apply,
    legal,
    san,
    positionKey,
    insufficient,
    status,
    fromUci,
  };
});

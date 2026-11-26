// game.js - Crowns & Bones rules, rendering and input
// Author: Reachnid Group
// Centennial College - Fall 2026

// A four-player board game that combines a property race around three rings of estates,
// a shared domino table, and a four-army chess battle on a 3x3 field of chessboards.
//
// everything is rendered as HTML strings into #app; clicks are routed through data-act
// attributes to onAction(). All game state lives in the single `state` object so it can be
// saved to localStorage or, in online play, synced through window.CrownsArcade (arcade.js).
//
// tunable numbers live in RULES so they are easy to tweak.

(() => {
  'use strict';
  //=============================================================
  //                          SETTINGS
  //=============================================================

  const room = window.CrownsArcade; // online-match transport (arcade.js)
  const RULES = {
    startCash: 1500,
    reviveCash: 350,
    lastStandRounds: 1, // domino rounds a bankrupt player may still play (the round in progress counts)
    mintFreeRounds: 1, // forging dice into dominoes is free during the first N domino rounds
    mintBaseCost: 50, // afterwards each forge costs base × (stalled turns in a row + forges this turn + 1)
    deployRadius: 3, // reserve pieces deploy within this many squares of your king
    ringFees: [100, 250], // cost to enter ring 2 / ring 3
    slotPrice: 400,
  };
  const SAVE_KEY = 'deadlock-save-v2',
    AUTO_KEY = 'deadlock-autosave-v2',
    LEGACY_KEY = 'deadlock-game-v1';
  const $ = (sel) => document.querySelector(sel),
    PLAYER_COLORS = ['#c77b6b', '#82a7b0', '#cfb876', '#9cb598'];
  const PLAYER_NAMES = ['Crimson Court', 'Azure Syndicate', 'Gilded Crown', 'Verdant Order'];
  const SYMBOL = {
    king: '♚',
    queen: '♛',
    rook: '♜',
    bishop: '♝',
    knight: '♞',
    pawn: '♟',
    archbishop: '♝',
    chancellor: '♜',
  };
  const PIECE_VALUE = {
    pawn: 45,
    knight: 120,
    bishop: 125,
    rook: 170,
    queen: 280,
    archbishop: 310,
    chancellor: 340,
  };
  const FAIRY_COST = { archbishop: 500, chancellor: 550 };
  const DIE_FACES = '⚀⚁⚂⚃⚄⚅';
  const JOKER_INFO = {
    golden: {
      name: 'Golden Dice',
      sub: 'Cash on discard',
      desc: 'When lost, gain $1 for every space moved by all players since you received it.',
    },
    ingsoc: {
      name: 'Ingsoc',
      sub: 'No revolutions',
      desc: 'Your vassals cannot attempt revolutions. Set their rent tax as high as 100%.',
    },
    teddy: {
      name: 'Teddy Bear',
      sub: 'Steal + relocate',
      desc: 'Take an opponent’s Joker, give a Joker in return; Teddy Bear goes to bottom of deck. The mystery box moves.',
    },
    magnate: {
      name: 'Property Magnate',
      sub: '+50% base rent',
      desc: 'Your properties charge 50% more rent before vassal taxes are distributed.',
    },
    gambit: {
      name: 'Royal Gambit',
      sub: '+1 chess action',
      desc: 'You can make one additional chess action every turn.',
    },
    rabbit: {
      name: 'Lucky Rabbit',
      sub: '+$100 on START',
      desc: 'Collect an additional $100 whenever you pass the outer START tile.',
    },
    doubles: {
      name: 'Loaded Bones',
      sub: '+2 move on rolls',
      desc: 'Each Monopoly movement roll gains 2 extra spaces.',
    },
    liberty: { name: 'Red Flag', sub: 'Revolt +2', desc: 'Add 2 to your revolution rolls.' },
    vault: {
      name: 'Iron Vault',
      sub: 'Rent shield',
      desc: 'Reduce rent owed by 25% (rounded down).',
    },
    crown: {
      name: 'Crown Jewels',
      sub: '+$80 per turn',
      desc: 'Earn $80 from the bank at the start of your turn.',
    },
    mirror: {
      name: 'Mirror Palace',
      sub: 'Captures pay +50%',
      desc: 'Selling a captured chess piece directly to the bank pays 50% more.',
    },
  };
  const CARD_DECK = [
    'golden',
    'magnate',
    'ingsoc',
    'gambit',
    'vault',
    'teddy',
    'rabbit',
    'doubles',
    'crown',
    'liberty',
    'golden',
    'magnate',
    'mirror',
    'teddy',
    'ingsoc',
    'gambit',
    'vault',
    'crown',
  ];
  let nextId = 1;
  const uid = () => nextId++;
  const random = (n) => Math.floor(Math.random() * n);
  const randDie = () => random(6) + 1;
  const shuffle = (a) => {
    a = [...a];
    for (let i = a.length - 1; i > 0; i--) {
      let j = random(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const $n = (n) => '$' + Math.max(0, Math.round(n)).toLocaleString('en-US');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  //=============================================================
  //                           SETUP
  //=============================================================
  // build the three rings of board spaces (outer to inner), with names, prices and rents
  function tileFactory() {
    let rings = [];
    const titles = [
      [
        'Ash',
        'Brass',
        'Canal',
        'Cinder',
        'Dock',
        'Elm',
        'Forge',
        'Garden',
        'Harbor',
        'Ivory',
        'Juniper',
        'King',
        'Larch',
        'Moss',
        'North',
        'Orchard',
        'Pine',
        'Quarry',
        'Reed',
        'Silk',
        'Temple',
        'Union',
        'Vale',
        'Willow',
        'Yard',
        'Zephyr',
        'Rook',
        'Bishop',
        'Knight',
        'Marble',
        'Silver',
        'Golden',
        'Copper',
        'Hollow',
        'Tallow',
        'Old',
        'Market',
        'Lantern',
        'Marsh',
        'Crown',
      ],
      [
        'Crystal',
        'Marquis',
        'Academy',
        'Sapphire',
        'Duchess',
        'Foundry',
        'Arcade',
        'Galleria',
        'Imperial',
        'Jade',
        'Ember',
        'Obsidian',
        'Citadel',
        'Royal',
        'Parliament',
        'Dusk',
        'Cobalt',
        'Palace',
        'Emerald',
        'Upper',
        'Pearl',
        'Orchid',
        'Velvet',
        'Tower',
        'Grand',
        'Dynasty',
        'Noble',
        'Velour',
      ],
      [
        'Diamond',
        'Sovereign',
        'Ivory',
        'Velvet',
        'Joker',
        'Penthouse',
        'Eclipse',
        'Empire',
        'Tribute',
        'Elysium',
        'Astral',
        'Throne',
        'Fortune',
        'Seraph',
        'Regent',
        'Monarch',
      ],
    ];
    const specials = [
      {
        0: 'start',
        5: 'utility-chess',
        8: 'chance',
        10: 'gate',
        16: 'utility-domino',
        20: 'tax',
        24: 'chance',
        30: 'free',
        35: 'market',
      },
      {
        0: 'gate',
        5: 'chance',
        7: 'utility-domino',
        12: 'tax',
        14: 'gate',
        19: 'utility-chess',
        21: 'chance',
        25: 'market',
      },
      { 0: 'gate', 4: 'joker', 8: 'tax', 12: 'joker', 15: 'utility-chess' },
    ];
    [40, 28, 16].forEach((n, level) => {
      let ring = [];
      for (let i = 0; i < n; i++) {
        let special = specials[level][i] || 'property';
        let base = [78, 245, 525][level],
          price = Math.round((base + i * [10, 15, 30][level]) / 10) * 10;
        const t = {
          ring: level,
          index: i,
          id: `${level}-${i}`,
          name: titles[level][i] + (level === 0 ? ' St' : level === 1 ? ' District' : ' Estate'),
          short: titles[level][i],
          type: special,
          price,
          rent: Math.round((price * [0.14, 0.17, 0.19][level]) / 5) * 5,
          owner: null,
          group: Math.floor(i / (level === 0 ? 5 : 4)),
        };
        if (special === 'start') {
          t.name = 'THE EXCHANGE';
          t.short = 'START';
        }
        if (special === 'gate') {
          t.name = ['INNER PASSAGE', 'ROYAL LIFT', 'CROWN GATE'][level];
          t.short = 'GATE';
        }
        if (special === 'joker') {
          t.name = 'JOKER DEN';
          t.short = 'JOKER';
        }
        if (special === 'tax') {
          t.name = 'The Levy';
          t.short = 'TAX';
        }
        if (special === 'free') {
          t.name = 'Free Court';
          t.short = 'REST';
        }
        if (special === 'chance') {
          t.name = 'Fate & Fortune';
          t.short = 'FATE';
        }
        if (special === 'market') {
          t.name = 'The Auction Hall';
          t.short = 'MARKET';
        }
        if (special === 'utility-chess') {
          t.name = 'The Chess Forge';
          t.short = 'FORGE';
          t.price = Math.round(price * 0.8);
          t.rent = 20;
        }
        if (special === 'utility-domino') {
          t.name = 'The Bone Foundry';
          t.short = 'BONES';
          t.price = Math.round(price * 0.8);
          t.rent = 20;
        }
        ring.push(t);
      }
      rings.push(ring);
    });
    return rings;
  }
  // place each player's starting army on their edge board
  function setupChess() {
    let p = [];
    const back = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let id = 0; id < 4; id++)
      for (let i = 0; i < 8; i++) {
        let x, y, px, py;
        if (id === 0) {
          x = 8 + i;
          y = 0;
          px = x;
          py = 1;
        } else if (id === 2) {
          x = 8 + i;
          y = 23;
          px = x;
          py = 22;
        } else if (id === 3) {
          x = 0;
          y = 8 + i;
          px = 1;
          py = y;
        } else {
          x = 23;
          y = 8 + i;
          px = 22;
          py = y;
        }
        p.push({ id: uid(), owner: id, type: back[i], x, y });
        p.push({ id: uid(), owner: id, type: 'pawn', x: px, y: py });
      }
    return p;
  }
  // the four courts with starting cash and empty holdings
  function initialPlayers() {
    return PLAYER_NAMES.map((name, i) => ({
      id: i,
      name,
      cash: RULES.startCash,
      ring: 0,
      pos: 0,
      bankrupt: false,
      chessOut: false,
      chessRetired: false,
      conquests: 0,
      overlord: null,
      tax: 25,
      jokerSlots: 1,
      jokers: [],
      reserve: [],
      loot: [],
      momentum: 0,
      chessBuff: 0,
      dominoHand: [],
      dominoWins: 0,
      bankruptcies: 0,
      dominoOut: false,
      lastStandRounds: 0,
      stallStreak: 0,
    }));
  }
  // per-turn counters for player `pid` (the domino champion gets extra rolls)
  function freshTurn(s, pid) {
    return {
      chessUsed: 0,
      dominoUsed: false,
      rolls: pid === s.dominoChampion ? 3 : 1,
      rolled: false,
      walked: false,
      minted: 0,
      consecutiveDoubles: 0,
      revolted: false,
      ringChanged: false,
    };
  }
  // A complete new game state
  function newGame() {
    const s = {
      version: 2,
      players: initialPlayers(),
      rings: tileFactory(),
      chess: setupChess(),
      turnIndex: 0,
      round: 1,
      dominoRound: 1,
      dominoChampion: null,
      chain: [],
      dominoDeck: [],
      jokerDeck: shuffle(CARD_DECK),
      totalSpacesMoved: 0,
      mystery: { ring: 0, pos: 8, claims: 0 },
      selectedTab: 'monopoly',
      selectedTile: null,
      selectedPiece: null,
      deploy: null,
      lastChessMove: null,
      pendingPurchase: null,
      pendingTeddy: null,
      pendingJoker: null,
      auction: null,
      slotAuction: 0,
      logs: [],
      lastRoll: null,
      winner: null,
      winnerSeen: false,
    };
    s.turn = freshTurn(s, 0);
    dealDomino(s);
    log(s, 'Game begun. Crimson Court to play.');
    return s;
  }
  /* bring old saves (incl. ones stuck in deploy mode) up to date */
  // upgrade a saved state from an older version so it can be loaded
  function migrate(s) {
    s.version = 2;
    s.dominoRound ??= 1;
    s.deploy = null;
    delete s.deployingIndex;
    s.lastChessMove ??= null;
    s.winner ??= null;
    s.winnerSeen ??= false;
    s.selectedPiece = null;
    s.modal = null;
    s.logs ??= [];
    s.logs = s.logs.map((x) =>
      String(x).replace(
        /Four courts enter\. Only one can own the board\./g,
        'Game begun. Crimson Court to play.',
      ),
    );
    for (const p of s.players) {
      p.dominoOut ??= false;
      p.lastStandRounds ??= p.bankrupt ? RULES.lastStandRounds : 0;
      p.stallStreak ??= 0;
      p.reserve ??= [];
      p.loot ??= [];
      p.dominoHand ??= [];
    }
    const old = s.turn || {};
    s.turn = { ...freshTurn(s, s.turnIndex), ...old };
    if (old.hasMoved !== undefined) {
      s.turn.rolled = !!old.hasMoved;
      delete s.turn.hasMoved;
    }
    return s;
  }

  let state;
  // add a line to the game log (newest first, capped at 80 entries)
  function log(s, msg) {
    s.logs.unshift(msg);
    s.logs = s.logs.slice(0, 80);
  }
  const me = () => state.players[state.turnIndex];
  const player = (id) => state.players[id];
  const tileAt = (r, i) => state.rings[r][i];
  const hasJoker = (p, type) => p.jokers.some((j) => j.type === type);
  const chessAlive = (p) => !p.chessOut && !p.chessRetired;
  const isEliminated = (p) => p.bankrupt && p.dominoOut && !chessAlive(p);
  const busy = () =>
    !!(state.pendingPurchase || state.pendingTeddy || state.pendingJoker || state.auction);
  // show a short pop-up message
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  //=============================================================
  //                          DOMINOES
  //=============================================================
  const fullDominoSet = () =>
    Array.from({ length: 7 }, (_, a) =>
      Array.from({ length: 7 - a }, (_, j) => ({ a, b: a + j })),
    ).flat();
  // shuffle a new domino set and deal five tiles to every player still in the round
  function dealDomino(s) {
    const deck = shuffle(fullDominoSet());
    for (const p of s.players) p.dominoHand = p.dominoOut ? [] : deck.splice(0, 5);
    s.dominoDeck = deck;
    s.chain = [];
  }
  // take one domino from the deck, reshuffling a fresh set when it runs out
  function drawDominoTile() {
    if (!state.dominoDeck.length) state.dominoDeck = shuffle(fullDominoSet());
    return state.dominoDeck.pop();
  }
  // top up a player's domino hand to five tiles
  function refillHand(p) {
    while (p.dominoHand.length < 5) p.dominoHand.push(drawDominoTile());
  }
  // price of forging a die into a domino for player `p` (free in the opening rounds)
  function mintCost(p) {
    if (p.bankrupt || state.dominoRound <= RULES.mintFreeRounds) return 0;
    return RULES.mintBaseCost * (p.stallStreak + state.turn.minted + 1);
  }
  // true when `tile` matches either open end of the domino chain
  function dominoCanPlay(tile) {
    if (!state.chain.length) return true;
    return (
      [tile.a, tile.b].includes(state.chain[0].a) || [tile.a, tile.b].includes(state.chain.at(-1).b)
    );
  }
  // play the current player's domino at `index` in their hand
  function playDomino(index) {
    if (!room.canAct()) return;
    let p = me();
    if (state.winner !== null || p.dominoOut) return;
    if (state.turn.dominoUsed) {
      toast('You already played a domino this turn.');
      return;
    }
    const d = p.dominoHand[index];
    if (!d) return;
    if (!dominoCanPlay(d)) {
      toast(`[${d.a}|${d.b}] doesn't match either end of the chain.`);
      return;
    }
    p.dominoHand.splice(index, 1);
    if (!state.chain.length) state.chain.push({ ...d });
    else {
      let left = state.chain[0].a,
        right = state.chain.at(-1).b;
      if (d.a === right) state.chain.push({ ...d });
      else if (d.b === right) state.chain.push({ a: d.b, b: d.a });
      else if (d.b === left) state.chain.unshift({ ...d });
      else if (d.a === left) state.chain.unshift({ a: d.b, b: d.a });
    }
    state.turn.dominoUsed = true;
    const gain = 1 + Math.abs(d.a - d.b);
    p.momentum += gain;
    log(
      state,
      `${p.name} played [${d.a}|${d.b}] and banked +${gain} momentum (total +${p.momentum}).`,
    );
    if (p.dominoHand.length === 0) endDominoRound(p);
    render();
  }
  // finish the domino round won by `w`: crown the champion and deal again
  function endDominoRound(w) {
    state.dominoChampion = w.id;
    w.dominoWins++;
    log(
      state,
      `${w.name} wins domino round ${state.dominoRound}: up to three optional rolls each turn.`,
    );
    toast(`${w.name} wins the domino round.`);
    for (const q of state.players) {
      if (q.id === w.id || !q.bankrupt || q.dominoOut) continue;
      q.lastStandRounds--;
      if (q.lastStandRounds <= 0) {
        q.dominoOut = true;
        q.lastStandRounds = 0;
        log(state, `${q.name} is out of dominoes.`);
      }
    }
    if (w.bankrupt) revive(w, 'winning dominoes');
    state.dominoRound++;
    dealDomino(state);
    if (state.dominoRound === RULES.mintFreeRounds + 1)
      log(state, 'From now on, forging dominoes from dice costs money.');
    state.turn.rolls = Math.max(state.turn.rolls, 3);
  }

  //=============================================================
  //                       BOARD GEOMETRY
  //=============================================================
  // position of space `i` on ring `r`, as [x%, y%] on the board image
  function ringPoint(r, i) {
    const n = [40, 28, 16][r],
      per = n / 4,
      margins = [
        [4.6, 95.4],
        [20.9, 79.1],
        [34, 66],
      ][r],
      min = margins[0],
      max = margins[1],
      side = Math.floor(i / per),
      f = (i % per) / per;
    return side === 0
      ? [max - (max - min) * f, max]
      : side === 1
        ? [min, max - (max - min) * f]
        : side === 2
          ? [min + (max - min) * f, min]
          : [max, min + (max - min) * f];
  }
  // display colour of space `i` on ring `r`
  function ringColor(r, i) {
    const palettes = [
      ['#b4a6e2', '#88a8da', '#89d9bd', '#e6cc82', '#dc9b98', '#bfa2ed', '#8ed3d3', '#edae73'],
      ['#98d7e0', '#9ab6f2', '#e0b59b', '#c7abe9', '#84d3b1', '#e5cd89', '#bcafd9'],
      ['#f1c17b', '#b595f2', '#e89fb2', '#b5d5f4'],
    ];
    return palettes[r][Math.floor(i / [5, 4, 4][r]) % palettes[r].length];
  }
  // true when the mystery box currently sits on space `t`
  function isMystery(t) {
    return t.ring === state.mystery.ring && t.index === state.mystery.pos;
  }
  // symbol shown on a board space
  function tileIcon(t) {
    if (isMystery(t)) return '✣';
    return {
      start: '↻',
      gate: '⇄',
      tax: '⚖',
      'utility-chess': '♜',
      'utility-domino': '⚄',
      chance: '?',
      joker: '★',
      free: '✦',
      market: '♧',
      property: '⌂',
    }[t.type];
  }

  //=============================================================
  //                         RENDERING
  //=============================================================
  // HTML for the four player nameplates
  function renderPlayers() {
    return state.players
      .map(
        (p) =>
          `<button type="button" class="player station-${p.id} ${p.id === state.turnIndex ? 'active' : ''} ${isEliminated(p) ? 'out' : ''}" style="--pc:${PLAYER_COLORS[p.id]}" data-court="${p.id}" aria-label="${esc(p.name)}. ${$n(p.cash)}.${p.id === state.turnIndex ? ' To play.' : ''} Open court register."><span class="pname">${esc(p.name)}</span><span class="seat-name">${esc(room.playerName(p.id))}</span><span class="funds">${$n(p.cash)}</span>${p.id === state.turnIndex ? '<span class="to-play">To play</span>' : ''}${isEliminated(p) ? '<span class="to-play">Eliminated</span>' : ''}</button>`,
      )
      .join('');
  }

  // HTML for the ring board with spaces, owners and player tokens
  function renderBoard() {
    return `<div class="boardbox"><div class="board-head"><div class="section-label">Estates · 84 spaces</div><button type="button" data-act="boardSize" aria-pressed="${boardLarge}">${boardLarge ? 'Whole board' : 'Enlarge board'}</button></div><div class="board-scroll ${boardLarge ? 'expanded' : ''}" tabindex="0" aria-label="Estate board. Scroll to inspect an enlarged board."><div class="board"><div class="orbit outer"></div><div class="orbit middle"></div><div class="orbit inner"></div><div class="board-center"><div class="center-crest">♛ <span>✧</span> ⚄</div><strong>CROWNS<br><em>&amp;</em> BONES</strong></div>${state.rings
      .flat()
      .map((t) => {
        const [x, y] = ringPoint(t.ring, t.index),
          here = state.players.filter((p) => !p.bankrupt && p.ring === t.ring && p.pos === t.index);
        const type = isMystery(t) ? 'joker' : t.type;
        return `<button type="button" class="tile level${t.ring} sp-${type}${t.owner !== null ? ' owned' : ''}${state.selectedTile === t.id ? ' selected' : ''}" style="left:${x}%;top:${y}%;--owned:${t.owner !== null ? PLAYER_COLORS[t.owner] : 'transparent'}" data-tile="${t.id}" aria-label="${esc(t.name)}. ${t.owner !== null ? 'Owner: ' + esc(player(t.owner).name) : 'Unowned'}. ${$n(t.price)}. Inspect space." title="${esc(t.name)} · ${t.owner !== null ? 'Owned by ' + esc(player(t.owner).name) : t.type === 'property' ? 'Buy ' + $n(t.price) : t.type}">${t.type === 'property' ? `<span class="stripe" style="background:${ringColor(t.ring, t.index)}"></span>` : ''}<div class="sicon">${tileIcon(t)}</div><div class="tlabel">${esc(isMystery(t) ? 'MYSTERY' : t.short)}</div><div class="tprice">${t.type === 'property' || t.type.startsWith('utility') ? $n(t.price) : ''}</div>${here.length ? `<div class="token-wrap">${here.map((p) => `<div class="token ${p.id === state.turnIndex ? 'current' : ''}" style="background:${PLAYER_COLORS[p.id]}"></div>`).join('')}</div>` : ''}</button>`;
      })
      .join('')}</div></div></div>`;
  }

  // HTML for the chess field, the selected piece and its legal moves
  function renderChess() {
    const p = me(),
      t = state.turn,
      alive = chessAlive(p);
    const sel = state.selectedPiece ? state.chess.find((q) => q.id === state.selectedPiece) : null;
    const moves = new Set(sel ? legalMoves(sel).map((m) => m.x + ',' + m.y) : []);
    const deploys = new Set(state.deploy ? legalDeploySquares(p).map((m) => m.x + ',' + m.y) : []);
    const checked = new Set();
    for (const q of state.players)
      if (chessAlive(q) && inCheck(q.id)) {
        const k = kingOf(q.id);
        if (k) checked.add(k.x + ',' + k.y);
      }
    const lm = state.lastChessMove,
      left = Math.max(0, allowedChessActions(p) - t.chessUsed),
      cells = [];
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        const key = x + ',' + y,
          piece = pieceAt(x, y),
          block = (Math.floor(x / 8) + Math.floor(y / 8)) % 2,
          cls = ['square', (x + y) % 2 ? 'dark' : 'light'];
        if (block) cls.push('no-zone');
        if (lm && ((lm.fx === x && lm.fy === y) || (lm.tx === x && lm.ty === y)))
          cls.push('lastmove');
        if (checked.has(key)) cls.push('incheck');
        if (sel && sel.x === x && sel.y === y) cls.push('selected');
        if (moves.has(key)) cls.push(piece ? 'capture' : 'move');
        if (deploys.has(key)) cls.push('deploy');
        if (piece && piece.owner === p.id && alive) cls.push('mine');
        cells.push(
          `<button type="button" class="${cls.join(' ')}" data-square="${key}" aria-label="Square ${x + 1}, ${y + 1}${piece ? ', ' + esc(player(piece.owner).name + ' ' + piece.type) : ', empty'}${moves.has(key) ? ', legal move' : ''}${deploys.has(key) ? ', legal deployment' : ''}" title="${piece ? esc(player(piece.owner).name + ' ' + piece.type) : ''}">${piece ? `<span class="piece p${piece.owner}">${SYMBOL[piece.type]}</span>` : ''}</button>`,
        );
      }
    let status;
    if (!alive)
      status = p.chessRetired
        ? 'Your king has retired. Your army has left the board; you cannot be checkmated.'
        : 'Your king was checkmated. Your army has left the board.';
    else if (state.deploy)
      status = `<b style="color:#9fd3f0">Deploying your ${esc(p.reserve[state.deploy.index])}</b> — click a highlighted ◇ square (${deploys.size} available). ${inCheck(p.id) ? '<b style="color:#ff9aa1">Your king is in check, so only squares that block the check are allowed.</b>' : ''} Esc cancels.`;
    else if (sel)
      status = `${esc(sel.type)} selected · ${plural(moves.size, 'legal move')}${left ? '' : ' · <b style="color:#ff9aa1">no chess actions left this turn</b>'}.`;
    else
      status = `Your army: ${plural(state.chess.filter((q) => q.owner === p.id).length, 'piece')} · <b style="color:#eac489">${plural(left, 'chess action')} left</b>. Click one of your pieces to see its moves.${inCheck(p.id) ? ' <b style="color:#ff9aa1">Your king is in check!</b>' : ''}`;
    const armies = state.players
      .map(
        (q) =>
          `<span class="${chessAlive(q) ? (inCheck(q.id) ? 'check' : '') : 'out'}"><b style="color:${PLAYER_COLORS[q.id]}">●</b> ${esc(q.name)}${chessAlive(q) ? (inCheck(q.id) ? ' · CHECK' : '') : q.chessRetired ? ' · retired' : ' · mated'}</span>`,
      )
      .join('');
    const fairyBtn = (type) =>
      `<button class="btn tiny" data-act="buyFairy" data-type="${type}" ${alive && !p.bankrupt && p.cash >= FAIRY_COST[type] ? '' : 'disabled'}>Buy for reserve</button>`;
    return `<div class="chess-controls"><div style="min-width:0;flex:1"><div class="section-label">CHESS <span style="color:#b6cad7;font-weight:500">· 24 × 24</span></div><div class="tiny-text" style="margin-top:6px">${status}</div><div class="armies">${armies}</div></div><div class="btn-row" style="margin:0">${state.deploy ? '<button class="btn slim red" data-act="cancelDeploy">Cancel deploy</button>' : ''}${p.conquests && alive ? '<button class="btn slim red" data-act="exitChess">Retire your king</button>' : ''}</div></div><div class="chess-frame"><div class="chessboard">${cells.join('')}</div></div><div class="chess-meta"><span>♚ Checkmate an enemy to make them your vassal</span><span>♟ Captured pieces may be sold or auctioned</span><span>♜ No castling or en passant</span><span>▢ Gold outline = last move</span></div><div class="gamecard"><h3>Chess reserves & fairy pieces</h3><div class="tiny-text">Buy fairy pieces any time while your king is in play. Deploying one onto a square within ${RULES.deployRadius} of your king uses a chess action.</div><div class="market-grid" style="margin-top:11px"><div class="market-item"><strong>Archbishop · ${$n(FAIRY_COST.archbishop)}</strong><p>Bishop + knight movement</p>${fairyBtn('archbishop')}</div><div class="market-item"><strong>Chancellor · ${$n(FAIRY_COST.chancellor)}</strong><p>Rook + knight movement</p>${fairyBtn('chancellor')}</div></div><div style="margin-top:12px">${p.reserve.length ? `<div class="section-label" style="margin-bottom:7px">YOUR RESERVE</div><div class="btn-row">${p.reserve.map((piece, i) => (state.deploy && state.deploy.index === i ? `<button class="btn slim red" data-act="cancelDeploy">Cancel deploying ${esc(piece)}</button>` : `<button class="btn slim" data-act="deployReserve" data-index="${i}" ${alive && left ? '' : 'disabled'}>${SYMBOL[piece]} Deploy ${esc(piece)}</button>`)).join('')}</div>${alive && !left ? '<div class="float-tip">No chess actions left this turn — deploy next turn.</div>' : ''}` : '<div class="tiny-text">No reserve pieces yet.</div>'}</div><div style="margin-top:14px"><div class="section-label">CAPTURED PIECES · SELL OR AUCTION</div>${renderLoot()}</div></div>`;
  }
  // HTML for the current player's captured pieces (to auction or sell)
  function renderLoot() {
    const p = me();
    if (!p.loot.length)
      return '<p class="tiny-text">Capture an enemy piece to auction it for cash, or sell directly to the bank.</p>';
    return p.loot
      .map(
        (item, i) =>
          `<div class="market-item" style="margin-top:7px"><strong>${SYMBOL[item]} ${esc(item)} · bank pays ${$n(PIECE_VALUE[item] * (hasJoker(p, 'mirror') ? 1.5 : 1))}</strong><div class="btn-row"><button class="btn tiny" data-act="sellLoot" data-index="${i}">Sell to bank</button><button class="btn tiny" data-act="auctionLoot" data-index="${i}">Open auction</button></div></div>`,
      )
      .join('');
  }

  // HTML for one domino tile
  function dominoHTML(d, cls = '', index = '', enabled = true) {
    const dots = (n) => {
      const positions = {
        0: [],
        1: [[50, 50]],
        2: [
          [25, 25],
          [75, 75],
        ],
        3: [
          [25, 25],
          [50, 50],
          [75, 75],
        ],
        4: [
          [25, 25],
          [75, 25],
          [25, 75],
          [75, 75],
        ],
        5: [
          [25, 25],
          [75, 25],
          [50, 50],
          [25, 75],
          [75, 75],
        ],
        6: [
          [25, 25],
          [75, 25],
          [25, 50],
          [75, 50],
          [25, 75],
          [75, 75],
        ],
      };
      return positions[n]
        .map(([x, y]) => `<i class="pip-dot" style="--x:${x}%;--y:${y}%"></i>`)
        .join('');
    };
    const interactive = index !== '';
    return `<button type="button" class="domino ${cls} ${enabled ? 'playable' : 'disabled'}" ${interactive ? `data-domino="${index}"` : ''} ${enabled && interactive ? '' : 'disabled'} aria-label="Domino ${d.a} and ${d.b}${interactive ? (enabled ? ', play tile' : ', unavailable this turn') : ''}" title="${d.a} | ${d.b}${enabled && interactive ? ' · Play' : ''}"><span class="half" aria-hidden="true">${dots(d.a)}</span><span class="half" aria-hidden="true">${dots(d.b)}</span></button>`;
  }
  // HTML for the viewer's own domino hand
  function renderDominoRack() {
    const p = room.playerForView(state),
      t = state.turn;
    if (!p)
      return '<section class="domino-rack spectator-hand"><button class="text-key" data-folio="domino">Domino table</button><p>Player hands are not shown to spectators.</p></section>';
    return `<section class="domino-rack" aria-label="Current player's domino hand"><div class="rack-head"><button class="text-key" type="button" data-folio="domino">Domino table</button><span>Momentum +${p.momentum}</span></div><div class="hand-tray">${p.dominoOut ? '<span class="rack-note">Out of dominoes.</span>' : p.dominoHand.length ? p.dominoHand.map((d, i) => dominoHTML(d, 'hand', i, room.canAct() && p.id === state.turnIndex && !busy() && !t.dominoUsed && dominoCanPlay(d))).join('') : '<span class="rack-note">Empty hand.</span>'}</div><p class="rack-note">${state.chain.length ? `Open ends: ${state.chain[0].a} and ${state.chain.at(-1).b}.` : 'Any tile may start the chain.'} ${t.dominoUsed ? 'Domino played this turn.' : 'One domino may be played per turn.'}</p></section>`;
  }

  // HTML for the domino table: chain, status and forge button
  function renderDomino() {
    const p = room.playerForView(state) || me(),
      cost = mintCost(p),
      t = state.turn;
    const status = p.dominoOut
      ? '<div class="notice warn">You are out of dominoes. A checkmate returns you to play.</div>'
      : p.bankrupt
        ? `<div class="notice warn"><b>Bankrupt.</b> Win this domino round to return with ${$n(RULES.reviveCash)}. If anyone else wins it first, you're out of dominoes.</div>`
        : '';
    const mintNote =
      state.dominoRound <= RULES.mintFreeRounds
        ? `Forging is <b>free</b> during the first domino round. From round ${RULES.mintFreeRounds + 1} on it costs ${$n(RULES.mintBaseCost)} × (turns in a row you've stalled + 1), the count resets when you move.`
        : p.bankrupt
          ? 'Bankrupt players forge for free during their last stand.'
          : `Your next forge costs <b>${$n(cost)}</b>. It gets pricier every turn in a row you forge instead of moving, and resets once you move.`;
    return `<div class="domino-wrap"><div class="domino-banner"><div><div class="section-label">DOMINOES · ROUND ${state.dominoRound}</div><h2 style="font-family:Georgia,serif;margin:7px 0 4px">Dominoes</h2><div class="tiny-text">Play one matching domino per turn. Empty your hand to win the round and become movement champion.</div></div><div style="text-align:right"><div class="tiny-text">BANKED MOMENTUM</div><div class="momentum-big">+${p.momentum}</div></div></div>${status}<div class="row-info"><span class="section-label">SHARED DOMINO CHAIN</span><span class="tag ${state.dominoChampion === null ? '' : 'positive'}">${state.dominoChampion === null ? 'NO CHAMPION YET' : esc(player(state.dominoChampion).name) + ' · champion'}</span></div><div class="domino-chain">${state.chain.length ? state.chain.map((d) => dominoHTML(d, '', '', false)).join('') : '<div class="tiny-text" style="padding:14px">The table is empty. Any tile begins the chain.</div>'}</div><div class="gamecard"><div class="section-label">YOUR HAND (${plural(p.dominoHand.length, 'TILE')}) ${t.dominoUsed ? '· <span>PLAYED THIS TURN</span>' : ''}</div><div class="hand-tray">${room.online && !room.playerForView(state) ? '<div class="tiny-text">Player hands are not shown to spectators.</div>' : p.dominoOut ? '<div class="tiny-text">No hand — out of dominoes.</div>' : p.dominoHand.length ? p.dominoHand.map((d, i) => dominoHTML(d, 'hand', i, room.canAct() && p.id === state.turnIndex && !busy() && !t.dominoUsed && dominoCanPlay(d))).join('') : '<div class="tiny-text">Empty hand.</div>'}</div><p style="margin-top:14px">A played tile banks momentum equal to 1 + the difference between its halves. Your next movement roll spends all banked momentum at once. The champion may keep momentum between turns by declining to roll.</p><div class="notice">${mintNote}</div></div><div class="gamecard"><h3>The 28 double-six tiles</h3><p>Starting hands contain 5 tiles. Any dice roll can be forged into a domino [d1|d2] instead of moving. When a round ends, every active player is dealt a fresh hand and the chain clears; the new winner replaces the old champion.</p><div class="row-info"><span>Unused tile stock</span><strong>${state.dominoDeck.length}</strong></div></div></div>`;
  }

  // HTML describing the selected board space
  function renderTileInfo() {
    let t = state.selectedTile
      ? state.rings.flat().find((t) => t.id === state.selectedTile)
      : tileAt(me().ring, me().pos);
    if (!t) return '';
    const owner = t.owner === null ? 'Unowned' : player(t.owner).name;
    const type = isMystery(t) ? 'Wandering Mystery Box' : t.type.replaceAll('-', ' ').toUpperCase();
    const buyable = t.type === 'property' || t.type.startsWith('utility');
    const rent =
      t.owner !== null && hasJoker(player(t.owner), 'magnate') ? Math.round(t.rent * 1.5) : t.rent;
    return `<div class="panel"><div class="panel-title">DEED REGISTER · RING ${t.ring + 1}</div><div class="turn-title" style="font-size:20px">${esc(isMystery(t) ? 'The Mystery Box' : t.name)}</div><div class="tiny-text" style="text-transform:uppercase;letter-spacing:1px;color:#796344;margin:6px 0 12px">${esc(type)}</div>${buyable ? `<div class="row-info"><span>Owner</span><strong style="color:${t.owner !== null ? PLAYER_COLORS[t.owner] : 'inherit'}">${esc(owner)}</strong></div><div class="row-info"><span>Buy price</span><strong>${$n(t.price)}</strong></div><div class="row-info"><span>Rent</span><strong>${$n(rent)}${rent !== t.rent ? ' (Magnate)' : ''}</strong></div>` : ''}${t.type === 'gate' ? '<div class="tiny-text">Landing here lets you pay to enter a more expensive inner ring, or travel back outward. One ring change per turn.</div>' : ''}${t.type.startsWith('utility') ? '<div class="tiny-text">When someone else lands here, the owner gets a ' + (t.type === 'utility-chess' ? 'bonus chess action' : 'free domino') + ' on top of rent.</div>' : ''}${t.type === 'tax' ? `<div class="tiny-text">Pay the bank ${$n([95, 175, 280][t.ring])}.</div>` : ''}${isMystery(t) || t.type === 'joker' ? '<div class="tiny-text">Draw a permanent Joker, or swap one when your slots are full.</div>' : ''}</div>`;
  }
  // HTML for the viewer's Joker cards
  function renderJokers() {
    const p = room.playerForView(state) || me(),
      marks = {
        golden: '⚄',
        ingsoc: '⚑',
        teddy: '♧',
        magnate: '⌂',
        gambit: '♞',
        rabbit: '♧',
        doubles: '⚅',
        liberty: '⚑',
        vault: '▥',
        crown: '♛',
        mirror: '◇',
      };
    return `<div class="panel"><div class="panel-title">${esc(p.name)} · ${p.jokers.length}/${p.jokerSlots} Jokers</div><div class="jokers">${p.jokers.map((j, i) => `<article class="joker"><button class="x" data-act="discardJoker" data-index="${i}" aria-label="Discard ${esc(JOKER_INFO[j.type].name)}">Discard</button><span class="joker-mark" aria-hidden="true">${marks[j.type]}</span><strong>${esc(JOKER_INFO[j.type].name)}</strong><p>${esc(JOKER_INFO[j.type].desc)}</p></article>`).join('')}${Array.from({ length: Math.max(0, p.jokerSlots - p.jokers.length) }, () => '<div class="empty-slot">Vacant</div>').join('')}</div><p class="tiny-text">Bankrupting an opponent adds one Joker slot, to a maximum of three.</p>${state.slotAuction > 0 ? `<div class="notice">${plural(state.slotAuction, 'Joker slot')} available from the bank.</div><button class="btn primary" data-act="bankSlot" ${p.bankrupt || p.cash < RULES.slotPrice || p.jokerSlots >= 3 ? 'disabled' : ''}>Buy slot · ${$n(RULES.slotPrice)}</button>` : ''}</div>`;
  }

  // HTML for vassalage: who serves whom, taxes and revolts
  function renderPolitical() {
    let p = me();
    let subjects = state.players.filter((v) => v.overlord === p.id);
    const ingsoc = p.overlord !== null && hasJoker(player(p.overlord), 'ingsoc');
    return `<div class="panel"><div class="panel-title">Vassalage · ${esc(p.name)}</div>${p.overlord !== null ? `<div class="notice warn">You serve <strong>${esc(player(p.overlord).name)}</strong> and surrender ${p.tax}% of rent earned on your properties.</div><button class="btn full" data-act="revolt" ${ingsoc || state.turn.revolted ? 'disabled' : ''}>${ingsoc ? 'INGSOC · REVOLUTION BLOCKED' : state.turn.revolted ? 'REVOLUTION ALREADY ATTEMPTED' : `Attempt revolution · 2d6${hasJoker(p, 'liberty') ? '+2' : ''} vs ${revoltTarget(p.tax)}+`}</button>` : '<div class="tiny-text">No court currently holds your king in vassalage.</div>'}${subjects.length ? `<div class="mini-divider"></div><div class="section-label">YOUR VASSALS</div>${subjects.map((v) => `<div class="row-info"><span>${esc(v.name)} · <strong>${v.tax}%</strong></span><button class="btn tiny" data-act="changeTax" data-who="${v.id}">Cycle tax</button></div>`).join('')}` : ''}</div>`;
  }

  // why the current player cannot end their turn yet, or an empty string
  function endTurnBlocker() {
    const p = me(),
      t = state.turn;
    if (state.pendingPurchase) return 'Buy, auction or skip the property first.';
    if (state.auction || state.pendingJoker || state.pendingTeddy)
      return 'Finish the open decision first.';
    if (p.id !== state.dominoChampion && !p.bankrupt && t.rolls > 0) {
      if (!t.rolled) return 'Use your dice roll first (move or forge a domino).';
      if (t.consecutiveDoubles) return 'You rolled doubles — one more roll is required.';
    }
    return null;
  }
  // one-line hint about what the current player should do next
  function nextStepHint() {
    const p = me(),
      t = state.turn;
    if (state.winner !== null) return 'The game is over.';
    if (state.pendingPurchase) return 'Decide on the property below: buy it, auction it, or skip.';
    if (busy()) return 'Resolve the open window first.';
    if (state.deploy)
      return 'Click a highlighted ◇ square on the chess board to deploy, or press <kbd>Esc</kbd>.';
    const playable = !p.dominoOut && !t.dominoUsed && p.dominoHand.some(dominoCanPlay);
    if (p.bankrupt) {
      if (p.dominoOut)
        return 'You are bankrupt and out of dominoes. A checkmate returns you to play. End your turn when ready <kbd>E</kbd>.';
      return `You are bankrupt. Win this domino round or checkmate a king to return. ${playable ? 'Play a domino, ' : ''}${t.rolls ? 'forge dice into dominoes <kbd>M</kbd>, ' : ''}use your chess army, and win this domino round to come back.`;
    }
    const must =
      p.id !== state.dominoChampion && t.rolls > 0 && (!t.rolled || t.consecutiveDoubles);
    if (must)
      return `${t.consecutiveDoubles ? '<b>Doubles!</b> Roll again' : 'Roll to move'} <kbd>R</kbd> — or forge the dice into a domino <kbd>M</kbd>.${playable ? ' A domino played before rolling adds its momentum to the move.' : ''}`;
    if (p.id === state.dominoChampion && t.rolls > 0)
      return `Champion: up to ${plural(t.rolls, 'optional roll')}. Skip them to keep banking momentum, then end your turn <kbd>E</kbd>.`;
    return `Optional: ${playable ? 'play a domino, ' : ''}make a chess move, then end your turn <kbd>E</kbd>.`;
  }
  // HTML for the roll / end-turn controls
  function renderTurnControls() {
    const p = me(),
      t = state.turn,
      cost = mintCost(p),
      b = busy(),
      blocker = endTurnBlocker(),
      onGate = !p.bankrupt && tileAt(p.ring, p.pos).type === 'gate',
      roll = state.lastRoll && state.lastRoll.player === p.id ? state.lastRoll : null;
    return `<section class="turn-desk" aria-label="Current turn"><div class="desk-engraving">${esc(p.name)}<span>Round ${state.round}</span></div><div class="turn-tallies">${plural(t.rolls, 'roll')}${p.id === state.dominoChampion ? ' (optional)' : ''} · ${chessAlive(p) ? plural(Math.max(0, allowedChessActions(p) - t.chessUsed), 'chess action') : 'Out of chess'}</div><p class="hint">${nextStepHint()}</p>${chessAlive(p) && inCheck(p.id) ? '<button class="text-key check-mark" data-folio="chess">King in check · Open chess board</button>' : ''}${roll ? `<div class="roll-record"><span class="dice" aria-label="Dice ${roll.a} and ${roll.b}">${DIE_FACES[roll.a - 1]}${DIE_FACES[roll.b - 1]}</span>${roll.a} + ${roll.b} · ${esc(roll.action)}</div>` : ''}
${state.pendingPurchase ? renderPurchase() : `<div class="btn-row"><button class="btn primary" data-act="rollMove" ${!b && t.rolls > 0 && !p.bankrupt && state.winner === null ? '' : 'disabled'}>Roll & move<kbd>R</kbd></button><button class="btn" data-act="rollMint" ${!b && t.rolls > 0 && !p.dominoOut && p.cash >= cost && state.winner === null ? '' : 'disabled'}>Forge domino · ${p.dominoOut ? 'out' : cost ? $n(cost) : 'free'}<kbd>M</kbd></button><button class="btn line end-turn" data-act="endTurn" ${blocker || state.winner !== null ? 'disabled' : ''}>End turn<kbd>E</kbd></button></div>`}
${onGate && !b ? `<div class="btn-row">${p.ring < 2 ? `<button class="btn" data-act="enterRing" ${p.cash < RULES.ringFees[p.ring] || t.ringChanged ? 'disabled' : ''}>Enter ring ${p.ring + 2} · ${$n(RULES.ringFees[p.ring])}</button>` : ''}${p.ring > 0 ? `<button class="btn" data-act="exitRing" ${t.ringChanged ? 'disabled' : ''}>Go outward</button>` : ''}</div>` : ''}</section>`;
  }

  // HTML for the buy-or-auction prompt after landing on an unowned space
  function renderPurchase() {
    const x = state.pendingPurchase;
    if (!x) return '';
    const t = tileAt(x.ring, x.pos);
    return `<div class="notice gold"><strong>UNOWNED SPACE:</strong> ${esc(t.name)} · ${$n(t.price)}<div style="margin-top:5px">Rent ${$n(t.rent)} per visit. Buy it, open an auction, or skip.</div><div class="btn-row"><button class="btn primary" data-act="buyProperty" ${me().cash < t.price ? 'disabled' : ''}>Buy<kbd>B</kbd></button><button class="btn" data-act="auctionProperty">Auction</button><button class="btn line" data-act="skipProperty">Skip<kbd>S</kbd></button></div></div>`;
  }
  let openFolio = null,
    selectedCourt = null,
    boardLarge = false,
    focusReturn = null;
  // HTML table summarising every court
  function renderCourtRegister() {
    return `<table class="court-register"><thead><tr><th scope="col">Court</th><th scope="col">Cash</th><th scope="col">Pieces & hand</th></tr></thead><tbody>${state.players.map((p) => `<tr ${selectedCourt === p.id ? 'aria-current="true"' : ''}><td><span class="court-mark" style="--pc:${PLAYER_COLORS[p.id]}"></span>${esc(p.name)}<small>${isEliminated(p) ? 'Eliminated' : p.bankrupt ? 'Bankrupt' : `Ring ${p.ring + 1} · ${esc(tileAt(p.ring, p.pos).name)}`}${p.id === state.turnIndex ? ' · To play' : ''}</small>${p.overlord !== null ? `<small>Vassal of ${esc(player(p.overlord).name)} · ${p.tax}% rent tax</small>` : ''}</td><td>${$n(p.cash)}</td><td>${p.chessRetired ? 'King retired' : p.chessOut ? 'Checkmated' : plural(state.chess.filter((q) => q.owner === p.id).length, 'chess piece')}<small>${p.dominoOut ? 'Out of dominoes' : plural(p.dominoHand.length, 'domino')} · ${p.jokers.length}/${p.jokerSlots} Jokers</small><small>${plural(p.conquests, 'checkmate')} · ${plural(p.dominoWins, 'domino win')} · Momentum +${p.momentum}</small></td></tr>`).join('')}</tbody></table><div class="gamecard">${renderPolitical()}</div>`;
  }
  // HTML for the open folio (deeds, jokers, courts, record, chess, dominoes, rules, save), if any
  function renderCabinet() {
    if (!openFolio) return '';
    const title = {
      deeds: 'Deed register',
      jokers: 'Jokers',
      courts: 'Court register',
      chronicle: 'Game record',
      chess: 'Chess',
      domino: 'Dominoes',
      rules: 'Rules',
      session: 'Saved game',
    }[openFolio];
    const inside =
      openFolio === 'deeds'
        ? renderTileInfo()
        : openFolio === 'jokers'
          ? renderJokers()
          : openFolio === 'courts'
            ? renderCourtRegister()
            : openFolio === 'chronicle'
              ? `<div class="log">${state.logs.map((x) => `<p class="logline">${esc(x)}</p>`).join('')}</div>`
              : openFolio === 'chess'
                ? renderChess()
                : openFolio === 'domino'
                  ? renderDomino()
                  : openFolio === 'rules'
                    ? renderRules()
                    : room.online
                      ? '<p class="online-note">This online match saves to Arcade after each action. Start or resume matches from the Arcade lobby.</p>'
                      : `<p class="tiny-text">This game saves automatically in this browser. Save keeps an additional manual copy; Load restores it.</p><div class="btn-row"><button class="btn" data-act="saveGame">Save</button><button class="btn" data-act="loadGame">Load</button><button class="btn red" data-act="resetGame">New game</button></div>`;
    return `<div class="folio-wrap" data-backdrop="folio"><section class="folio folio-${openFolio}" role="dialog" aria-modal="true" aria-labelledby="folio-title" tabindex="-1"><header class="folio-header"><h2 id="folio-title">${title}</h2><button type="button" class="folio-close" data-act="closeFolio">Return to table</button></header>${inside}</section></div>`;
  }

  // HTML for the rules folio
  function renderRules() {
    return `<div class="section-label" style="margin:5px 0 14px">CROWNS & BONES · RULES</div><div class="rule-grid">
<div class="gamecard"><h3>1. A turn</h3><p>On your turn, in any order: play <b>one domino</b> (optional), make your <b>chess action(s)</b> (optional), and use your <b>dice roll</b>, either to move or to forge a domino. Then end your turn. Doubles give one more compulsory roll, up to three. The domino champion's rolls are all optional.</p></div>
<div class="gamecard"><h3>2. Property</h3><p>Buy property, collect rent, pay to travel inward through gates (one ring change per turn), and force players into bankruptcy. Owned utilities give their owner a bonus chess action or a free domino when others land there. Passing the outer START pays $200.</p></div>
<div class="gamecard"><h3>3. Chess</h3><p>Four armies start on the edge boards of a 3×3 field of chessboards. Checkmate a king to make that player your vassal. After your first conquest you may retire your king to become immune to checkmate. Fairy pieces can be bought and deployed within ${RULES.deployRadius} squares of your king; the legal squares are highlighted.</p></div>
<div class="gamecard"><h3>4. Dominoes</h3><p>Playing a tile banks momentum (1 + the difference between its halves), which your next movement roll spends all at once. Empty your hand to win the round. The winner becomes champion: up to three <i>optional</i> rolls per turn, Unused momentum carries over between turns.</p></div>
<div class="gamecard"><h3>5. Forging costs</h3><p>Forging dice into a domino is free in the first domino round. After that it costs ${$n(RULES.mintBaseCost)} × (consecutive turns you've stalled + 1), and the count resets when you move. Moving resets the consecutive-turn count.</p></div>
<div class="gamecard"><h3>6. Bankruptcy</h3><p>A bankrupt player loses their deeds but keeps playing chess, and gets <b>one last domino round</b> (the one in progress). Win it to revive with ${$n(RULES.reviveCash)}. If someone else wins it, they're out of dominoes. A checkmate also revives you and puts you back into dominoes.</p></div>
<div class="gamecard"><h3>7. Elimination & victory</h3><p>A player who is bankrupt, out of dominoes, and out of the chess game is eliminated, and their turns are skipped. The last court not eliminated wins.</p></div>
<div class="gamecard"><h3>8. Vassals & revolutions</h3><p>Vassals pay their overlord a share of all rent they collect (25 → 50 → 75 → 100%), and overlords pay no rent on their vassals' land. On their turn a vassal may attempt one revolution: 2d6 against a target that gets easier as the tax rises. Ingsoc blocks revolts. An overlord who covers a vassal's unpaid rent frees them.</p></div>
<div class="gamecard"><h3>9. Jokers & auctions</h3><p>Start with one Joker slot; bankrupting an opponent adds one (max 3). Bank foreclosures put slots up for ${$n(RULES.slotPrice)}. Joker Dens and the wandering Mystery Box hand out Jokers. Captured chess pieces can be sold to the bank or auctioned; the winner adds the piece to their reserve.</p></div>
<div class="gamecard"><h3>10. Controls</h3><p><kbd>R</kbd> roll & move · <kbd>M</kbd> forge domino · <kbd>E</kbd> end turn · <kbd>B</kbd>/<kbd>S</kbd> buy/skip property · <kbd>1</kbd>–<kbd>4</kbd> open Estates, Chess, Dominoes or Rules · <kbd>Esc</kbd> cancel a selection or deployment; otherwise return to the table. Dice shortcuts apply at the table. The game autosaves in this browser after every action; Save/Load hold one extra manual slot.</p></div>
</div>`;
  }
  // HTML for the local (hot-seat) auction modal
  function renderAuction() {
    const a = state.auction;
    if (!a) return '';
    if (room.online) return renderOnlineAuction(a);
    const item =
      a.kind === 'piece'
        ? `${a.thing} chess piece`
        : a.kind === 'property'
          ? a.thing
          : 'a Joker slot';
    return `<div class="modal-wrap"><div class="modal"><div class="eyebrow">OPEN AUCTION · ALL FOUR COURTS</div><h2>${esc(item)}</h2><p>${a.kind === 'piece' ? 'The winning bidder adds this chess piece to their reserve.' : 'The highest bidder wins this asset.'} Pass the device to each bidder. Seller: ${a.seller === -1 ? 'THE BANK' : esc(player(a.seller).name)}.</p><div class="notice gold">Highest bid: <strong>${$n(a.highest)}</strong> · ${a.bidder === null ? 'No bids' : esc(player(a.bidder).name)}</div>${state.players
      .filter((x) => x.id !== a.seller && !x.bankrupt)
      .map(
        (x) =>
          `<div class="row-info"><span style="color:${PLAYER_COLORS[x.id]}">${esc(x.name)} (${$n(x.cash)})</span><div class="btn-row" style="margin:0"><button class="btn tiny" data-act="bidAuction" data-who="${x.id}" data-delta="25" ${x.cash < a.highest + 25 ? 'disabled' : ''}>+25</button><button class="btn tiny" data-act="bidAuction" data-who="${x.id}" data-delta="100" ${x.cash < a.highest + 100 ? 'disabled' : ''}>+100</button></div></div>`,
      )
      .join(
        '',
      )}<div class="btn-row"><button class="btn primary" data-act="settleAuction" ${a.bidder === null ? 'disabled' : ''}>Sell to high bidder</button><button class="btn red" data-act="cancelAuction">Cancel auction</button></div></div></div>`;
  }
  // HTML for the online auction modal, where seats bid in turn
  function renderOnlineAuction(a) {
    const bidder = a.actor === null ? null : player(a.actor);
    return `<div class="modal-wrap"><div class="modal"><div class="eyebrow">AUCTION</div><h2>${esc(a.thing)}</h2><p class="auction-turn">${bidder ? esc(bidder.name) + ' to bid.' : 'Auction complete.'}</p><p>Highest bid: <strong>${$n(a.highest)}</strong> · ${a.bidder === null ? 'No bids' : esc(player(a.bidder).name)}</p><p class="tiny-text">Bidders act in order. Passing withdraws you from this auction.</p><div class="btn-row"><button class="btn primary" data-act="bidAuction" data-who="${a.actor}" data-delta="25" ${bidder && bidder.cash >= a.highest + 25 ? '' : 'disabled'}>Bid ${$n(a.highest + 25)}</button><button class="btn" data-act="bidAuction" data-who="${a.actor}" data-delta="100" ${bidder && bidder.cash >= a.highest + 100 ? '' : 'disabled'}>Bid ${$n(a.highest + 100)}</button><button class="btn line" data-act="passAuction">Pass</button></div></div></div>`;
  }
  // HTML for the "keep or swap" prompt after drawing a Joker
  function renderJokerModal() {
    let x = state.pendingJoker;
    if (!x) return '';
    let p = player(x.owner),
      newJ = JOKER_INFO[x.type];
    return `<div class="modal-wrap"><div class="modal"><div class="eyebrow">JOKER DRAW</div><h2>★ ${esc(newJ.name)}</h2><p>${esc(newJ.desc)}</p><p>Choose which Joker to replace, or return the new Joker to the bottom of the deck.</p><div class="btn-row">${p.jokers.map((j, i) => `<button class="btn" data-act="swapJoker" data-index="${i}">Replace ${esc(JOKER_INFO[j.type].name)}</button>`).join('')}<button class="btn red" data-act="rejectJoker">Keep mine</button></div></div></div>`;
  }
  // HTML for the Teddy Bear steal prompt
  function renderTeddyModal() {
    let x = state.pendingTeddy;
    if (!x) return '';
    const p = player(x.owner),
      targets = state.players.filter((q) => q.id !== p.id && q.jokers.length);
    return `<div class="modal-wrap"><div class="modal"><div class="eyebrow">TEDDY BEAR · FORCED JOKER EXCHANGE</div><h2>Move the Mystery Box.</h2><p>Select one opponent’s Joker to take. If you have multiple Joker slots, select one of yours to give in exchange; otherwise your opponent draws the next Joker from the deck. Teddy Bear returns to the deck bottom.</p>${targets.length ? '' : '<div class="notice">Nobody has a Joker to steal.</div>'}${targets.map((target) => `<div class="market-item" style="margin-top:10px"><strong style="color:${PLAYER_COLORS[target.id]}">${esc(target.name)}</strong>${target.jokers.map((j, i) => `<div class="row-info"><span>${esc(JOKER_INFO[j.type].name)}</span><button class="btn tiny" data-act="teddySteal" data-who="${target.id}" data-index="${i}">Take</button></div>`).join('')}</div>`).join('')}${p.jokerSlots > 1 && p.jokers.length ? `<div class="mini-divider"></div><label class="tiny-text" for="teddy-offer">Joker offered in return (your possession):</label><select class="small-select" id="teddy-offer" style="display:block;margin-top:8px">${p.jokers.map((j, i) => `<option value="${i}">${esc(JOKER_INFO[j.type].name)}</option>`).join('')}</select>` : ''}<div class="btn-row"><button class="btn red" data-act="cancelTeddy">Decline exchange</button></div></div></div>`;
  }
  // HTML for the game-over modal
  function renderWinner() {
    if (state.winner === null || state.winnerSeen) return '';
    const w = player(state.winner);
    return `<div class="modal-wrap"><div class="modal" style="text-align:center"><div class="eyebrow">GAME OVER</div><h2 style="color:${PLAYER_COLORS[w.id]}">${esc(w.name)} wins.</h2><p>Every other court has been eliminated.</p><p><b>${plural(w.conquests, 'checkmate')}</b> · <b>${plural(w.dominoWins, 'domino win')}</b> · <b>${$n(w.cash)}</b> · ${state.round} rounds</p><div class="btn-row"><button class="btn line" data-act="dismissWinner">Look at the board</button>${room.online ? '' : '<button class="btn primary" data-act="resetGame">New game</button>'}</div></div></div>`;
  }
  // declare a winner when only one court is left standing
  function checkWinner() {
    if (state.winner !== null) return;
    const alive = state.players.filter((p) => !isEliminated(p));
    if (alive.length === 1) {
      state.winner = alive[0].id;
      log(state, `${alive[0].name} wins.`);
    }
  }
  // redraw the whole UI from `state`, keeping scroll positions
  function render() {
    checkWinner();
    const p = me(),
      oldBoard = $('.board-scroll'),
      boardPosition = oldBoard ? [oldBoard.scrollLeft, oldBoard.scrollTop] : [0, 0],
      oldPaper = $('.folio'),
      paperScroll = oldPaper ? oldPaper.scrollTop : 0,
      scrollY = window.scrollY;
    const wasFolio = !!oldPaper,
      oldFocus = document.activeElement,
      focusKey = oldFocus && oldFocus.dataset ? JSON.stringify(oldFocus.dataset) : null;
    if (state.deploy) openFolio = 'chess';
    const required = !!(
      state.auction ||
      state.pendingJoker ||
      state.pendingTeddy ||
      (state.winner !== null && !state.winnerSeen)
    );
    document.body.classList.toggle('has-folio', !!openFolio || required);
    $('#app').innerHTML =
      `<header class="mast" ${openFolio || required ? 'inert' : ''}><div class="mast-heading"><h1>CROWNS <span>&amp;</span> BONES</h1><p class="mast-caption">Work in progress — player feedback welcome.</p></div><div class="session-controls"><button class="text-key" data-folio="session">Game</button></div></header>
<p id="arcade-status" class="match-status" role="status" aria-live="polite"></p>${room.failed ? '<button class="text-key connection-reload" data-act="reloadMatch">Reload match</button>' : ''}<main class="game-table" aria-label="Game table" ${openFolio || required ? 'inert' : ''}><div class="table-arrangement">${renderPlayers()}<section class="central-table"><div class="surface">${renderBoard()}</div></section></div><div class="apparatus">${renderTurnControls()}${renderDominoRack()}</div>
<div class="table-objects"><button type="button" class="chess-object" data-folio="chess" aria-label="Open chess board"><span class="mini-chess" aria-hidden="true"><span>♞</span></span><span>Chess${chessAlive(p) && inCheck(p.id) ? '<br><span class="check-mark">King in check</span>' : ''}</span></button><button type="button" class="rules-object" data-folio="rules">Rules</button><div class="paper-links"><button class="text-key" data-folio="deeds">Deeds</button><button class="text-key" data-folio="jokers">Jokers · ${p.jokers.length}</button><button class="text-key" data-folio="courts">Courts</button><button class="text-key" data-folio="chronicle">Record</button></div></div><p class="last-entry"><span>Record</span>${esc(state.logs[0] || 'No entries.')}</p></main>
${required ? '' : renderCabinet()}${renderAuction()}${renderJokerModal()}${renderTeddyModal()}${renderWinner()}`;
    window.scrollTo(0, scrollY);
    const newBoard = $('.board-scroll');
    if (newBoard) {
      newBoard.scrollLeft = boardPosition[0];
      newBoard.scrollTop = boardPosition[1];
    }
    const newPaper = $('.folio');
    if (newPaper) {
      newPaper.scrollTop = paperScroll;
      if (!wasFolio) newPaper.focus({ preventScroll: true });
      else if (focusKey) {
        const match = [...newPaper.querySelectorAll('button,[tabindex]')].find(
          (el) => JSON.stringify(el.dataset) === focusKey,
        );
        match?.focus({ preventScroll: true });
      }
    }
    if (!newPaper && wasFolio && focusReturn) {
      document.querySelector(focusReturn)?.focus({ preventScroll: true });
      focusReturn = null;
    }
    const modal = $('.modal');
    if (modal) {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-label', modal.querySelector('h2')?.textContent || 'Game decision');
      modal.setAttribute('tabindex', '-1');
      if (!modal.contains(document.activeElement)) modal.focus({ preventScroll: true });
    }
    if (!room.online && !room.connecting) {
      try {
        localStorage.setItem(AUTO_KEY, JSON.stringify(state));
      } catch (e) {}
    }
    room.changed();
    room.decorate();
  }

  //=============================================================
  //                         TURN FLOW
  //=============================================================

  // end the current turn and pass play to the next court still in the game
  function nextTurn() {
    if (!room.canAct()) return;
    if (state.winner !== null) return;
    const blocker = endTurnBlocker();
    if (blocker) {
      toast(blocker);
      render();
      return;
    }
    const out = me();
    out.chessBuff = 0;
    if (state.turn.walked) out.stallStreak = 0;
    else if (state.turn.minted) out.stallStreak++;
    state.deploy = null;
    state.selectedPiece = null;
    state.selectedTile = null;
    state.lastRoll = null;
    let guard = 0;
    do {
      state.turnIndex = (state.turnIndex + 1) % 4;
      if (state.turnIndex === 0) state.round++;
    } while (isEliminated(me()) && ++guard < 8);
    const p = me();
    state.turn = freshTurn(state, p.id);
    if (hasJoker(p, 'crown') && !p.bankrupt) {
      p.cash += 80;
      log(state, `${p.name} receives $80 from Crown Jewels.`);
    }
    log(state, `Round ${state.round} · ${p.name}'s turn.`);
    toast(`${p.name}'s turn`);
    render();
  }
  // pay rent between players: vassals owe their overlord nothing, an overlord may cover a vassal's shortfall, and the owner's overlord takes their tax. Returns false if the payer went bankrupt
  function transferToOwner(payerId, ownerId, amount, reason) {
    let payer = player(payerId),
      owner = player(ownerId);
    if (payerId === ownerId) return true;
    if (payer.overlord === ownerId) {
      log(state, `${payer.name} pays no rent to their overlord ${owner.name}.`);
      return true;
    }
    let bill = Math.max(0, Math.floor(amount));
    if (hasJoker(payer, 'vault')) bill = Math.floor(bill * 0.75);
    if (bill === 0) return true;
    let total = Math.min(payer.cash, bill),
      shortfall = bill - total;
    let overlordPaid = 0;
    if (shortfall > 0 && payer.overlord !== null) {
      let master = player(payer.overlord);
      if (master.cash >= shortfall) {
        master.cash -= shortfall;
        overlordPaid = shortfall;
        log(
          state,
          `${master.name} pays ${$n(shortfall)} to rescue ${payer.name}, freeing their vassal.`,
        );
        payer.overlord = null;
        shortfall = 0;
      } else {
        log(state, `${master.name} cannot cover the unpaid rent. Their vassalage ends.`);
        payer.overlord = null;
      }
    }
    payer.cash -= total;
    let received = total + overlordPaid;
    if (owner.overlord !== null) {
      const master = player(owner.overlord);
      const tax = Math.round((received * owner.tax) / 100);
      master.cash += tax;
      owner.cash += received - tax;
      log(
        state,
        `${owner.name} earned ${$n(received - tax)} rent; ${master.name} collected ${$n(tax)} vassal tax.`,
      );
    } else owner.cash += received;
    if (shortfall > 0) {
      log(state, `${payer.name} owed ${$n(bill)} to ${owner.name} and was bankrupted.`);
      bankruptPlayer(payerId, ownerId);
    } else log(state, `${payer.name} paid ${$n(bill)} to ${owner.name} (${reason}).`);
    return shortfall <= 0;
  }
  // pay `amount` to the bank, bankrupting the player if they cannot cover it
  function chargeBank(p, amount, reason) {
    if (p.bankrupt) return;
    let paid = Math.min(amount, p.cash);
    p.cash -= paid;
    if (paid < amount) {
      log(state, `${p.name} cannot pay the bank's ${$n(amount)} ${reason}.`);
      bankruptPlayer(p.id, -1);
    } else log(state, `${p.name} paid ${$n(amount)} in ${reason}.`);
  }
  // bankrupt `loser`: their deeds return to the bank, and the creditor (a player, or -1 for the bank) gains a Joker slot
  function bankruptPlayer(loser, creditor) {
    let p = player(loser);
    if (p.bankrupt) return;
    p.bankrupt = true;
    p.cash = 0;
    p.momentum = 0;
    p.overlord = null;
    p.bankruptcies++;
    for (let t of state.rings.flat()) if (t.owner === loser) t.owner = null;
    p.dominoOut = false;
    p.lastStandRounds = RULES.lastStandRounds;
    refillHand(p);
    log(
      state,
      `${p.name} is bankrupt. Win the current domino round or checkmate a king to return.`,
    );
    toast(`${p.name} is bankrupt.`);
    if (creditor >= 0 && creditor !== loser) {
      const c = player(creditor);
      let old = c.jokerSlots;
      c.jokerSlots = Math.min(3, c.jokerSlots + 1);
      if (c.jokerSlots > old)
        log(state, `${c.name} gains an extra Joker slot (${c.jokerSlots}/3).`);
    } else if (creditor === -1) {
      state.slotAuction++;
      log(state, `THE BANK seized a Joker slot and listed it for ${$n(RULES.slotPrice)}.`);
    }
    if (state.pendingPurchase && state.pendingPurchase.owner === loser)
      state.pendingPurchase = null;
  }
  // bring `p` back from bankruptcy with RULES.reviveCash (earned by a domino win or a checkmate)
  function revive(p, method) {
    const wasOut = p.dominoOut;
    p.dominoOut = false;
    p.lastStandRounds = 0;
    if (!p.bankrupt) {
      return;
    }
    p.bankrupt = false;
    p.cash = RULES.reviveCash;
    p.ring = 0;
    p.pos = 0;
    p.stallStreak = 0;
    if (wasOut || !p.dominoHand.length) refillHand(p);
    log(
      state,
      `✦ ${p.name} revived with ${$n(RULES.reviveCash)} by ${method}. Their old deeds remain lost.`,
    );
    toast(`${p.name} is back!`);
  }
  // resolve landing on a space: buy prompt, rent, fees, Jokers or fate
  function land(p) {
    if (p.bankrupt) return;
    const t = tileAt(p.ring, p.pos);
    state.selectedTile = t.id;
    if (isMystery(t) || t.type === 'joker') {
      const wasMystery = isMystery(t);
      drawJoker(p.id);
      if (wasMystery && isMystery(t)) {
        state.mystery.claims++;
        if (state.mystery.claims >= 2) moveMystery();
      }
      return;
    }
    switch (t.type) {
      case 'property':
      case 'utility-chess':
      case 'utility-domino':
        if (t.owner === null) {
          state.pendingPurchase = { owner: p.id, ring: t.ring, pos: t.index };
          log(state, `${p.name} found ${t.name}, for sale at ${$n(t.price)}.`);
        } else if (t.owner !== p.id) {
          let owner = player(t.owner);
          if (t.type === 'utility-chess') {
            owner.chessBuff = Math.min(3, owner.chessBuff + 1);
            log(state, `${owner.name}'s Chess Forge grants one bonus chess action.`);
          }
          if (t.type === 'utility-domino' && !owner.dominoOut) {
            let tile = drawDominoTile();
            owner.dominoHand.push(tile);
            log(state, `${owner.name}'s Bone Foundry draws a domino.`);
          }
          let rent = t.rent;
          if (hasJoker(owner, 'magnate')) rent = Math.round(rent * 1.5);
          transferToOwner(p.id, t.owner, rent, t.name);
        }
        break;
      case 'tax':
        chargeBank(p, [95, 175, 280][p.ring], 'property levy');
        break;
      case 'chance':
        fate(p);
        break;
      case 'gate':
        log(state, `${p.name} reached the gate. A ring change is available below the board.`);
        break;
      case 'start':
        log(state, `${p.name} is at THE EXCHANGE.`);
        break;
      case 'market':
        p.cash += 40;
        log(state, `${p.name} collects $40 at the auction hall.`);
        break;
      case 'free':
        p.cash += 65;
        log(state, `${p.name} collects a $65 free-court stipend.`);
        break;
      default:
        break;
    }
  }
  // A random fate event: cash, a fine, momentum, a domino, or a bonus chess move
  function fate(p) {
    const r = random(5);
    if (r === 0) {
      p.cash += 200;
      log(state, `FATE: ${p.name} inherits $200.`);
    } else if (r === 1) {
      chargeBank(p, 110, 'chance penalty');
    } else if (r === 2) {
      p.momentum += 4;
      log(state, `FATE: ${p.name} gets +4 movement momentum.`);
    } else if (r === 3) {
      let d = drawDominoTile();
      p.dominoHand.push(d);
      log(state, `FATE: ${p.name} obtains a [${d.a}|${d.b}] domino.`);
    } else {
      p.chessBuff++;
      log(state, `FATE: ${p.name} gains a bonus chess move.`);
    }
  }
  // move a player `steps` spaces around their ring (paying the outer-ring START bonus), then resolve the landing
  function movePlayer(p, steps) {
    const n = state.rings[p.ring].length;
    let start = p.pos,
      potential = p.pos + steps;
    p.pos = potential % n;
    state.totalSpacesMoved += steps;
    if (p.ring === 0 && potential >= n) {
      let laps = Math.floor(potential / n);
      const pay = (200 + (hasJoker(p, 'rabbit') ? 100 : 0)) * laps;
      p.cash += pay;
      log(
        state,
        `${p.name} crossed THE EXCHANGE${laps > 1 ? ' ' + laps + ' times' : ''}, collecting ${$n(pay)}.`,
      );
    }
    log(state, `${p.name} moved ${steps} spaces on ring ${p.ring + 1} (${start} → ${p.pos}).`);
    land(p);
  }
  // roll two dice, either to move ('move') or to forge them into a domino ('mint')
  function rollAction(action) {
    if (!room.canAct()) return;
    const p = me(),
      t = state.turn;
    if (state.winner !== null || busy() || t.rolls <= 0) return;
    if (action === 'move' && p.bankrupt) return;
    let cost = 0;
    if (action === 'mint') {
      if (p.dominoOut) return;
      cost = mintCost(p);
      if (p.cash < cost) {
        toast(`Forging costs ${$n(cost)} — you can't afford it.`);
        return;
      }
    }
    const a = randDie(),
      b = randDie();
    t.rolls--;
    t.rolled = true;
    if (action === 'move') {
      t.walked = true;
      const bones = hasJoker(p, 'doubles') ? 2 : 0,
        steps = a + b + p.momentum + bones;
      state.lastRoll = {
        player: p.id,
        a,
        b,
        action: `Moved ${steps}${p.momentum || bones ? ` (dice ${a + b}${p.momentum ? ` + ${p.momentum} momentum` : ''}${bones ? ' + 2 Loaded Bones' : ''})` : ''}`,
      };
      p.momentum = 0;
      movePlayer(p, steps);
    } else {
      p.cash -= cost;
      t.minted++;
      p.dominoHand.push({ a: Math.min(a, b), b: Math.max(a, b) });
      state.lastRoll = {
        player: p.id,
        a,
        b,
        action: `Forged [${Math.min(a, b)}|${Math.max(a, b)}]${cost ? ' for ' + $n(cost) : ''}`,
      };
      log(
        state,
        `${p.name} forged a [${a}|${b}] domino instead of moving${cost ? ' (' + $n(cost) + ')' : ''}.`,
      );
    }
    if (p.id !== state.dominoChampion && a === b) {
      if (t.consecutiveDoubles < 2) {
        t.rolls++;
        t.consecutiveDoubles++;
        log(state, `${p.name} rolled doubles: one extra compulsory roll.`);
      } else {
        t.consecutiveDoubles = 0;
        log(state, 'Third consecutive double: no extra roll.');
      }
    } else t.consecutiveDoubles = 0;
    render();
  }

  //=============================================================
  //                           JOKERS
  //=============================================================
  // move the mystery box to a different spot
  function moveMystery() {
    const spots = [
      [0, 8],
      [0, 24],
      [1, 5],
      [1, 21],
      [2, 10],
      [0, 3],
      [1, 3],
      [2, 6],
      [0, 28],
    ];
    const available = spots.filter(([r, i]) => r !== state.mystery.ring || i !== state.mystery.pos);
    const [ring, pos] = available[random(available.length)];
    state.mystery = { ring, pos, claims: 0 };
    log(state, `The Mystery Box relocates to ring ${ring + 1}, tile ${pos}.`);
  }
  // take the top Joker card, reshuffling the deck when it is empty
  function jokerDrawRaw() {
    if (!state.jokerDeck.length) state.jokerDeck = shuffle(CARD_DECK);
    return state.jokerDeck.shift();
  }
  // put a Joker back at the bottom of the deck
  function returnJoker(type) {
    state.jokerDeck.push(type);
  }
  // remove a Joker from a player's hand (paying out Golden Dice when lost)
  function loseJoker(p, index, backToDeck = true) {
    if (index < 0 || index >= p.jokers.length) return null;
    const j = p.jokers.splice(index, 1)[0];
    if (j.type === 'golden') {
      const bonus = state.totalSpacesMoved - (j.acquiredAt || 0);
      p.cash += bonus;
      log(state, `GOLDEN DICE pays ${p.name} ${$n(bonus)} for all players' movement since pickup.`);
    }
    if (backToDeck) returnJoker(j.type);
    return j;
  }
  // give a Joker to a player (Teddy Bear triggers a steal instead)
  function addJoker(p, type) {
    if (type === 'teddy') {
      state.pendingTeddy = { owner: p.id };
      log(state, `${p.name} drew TEDDY BEAR, forcing a Joker exchange.`);
      moveMystery();
      return;
    }
    if (p.jokers.length < p.jokerSlots) {
      p.jokers.push({ type, acquiredAt: state.totalSpacesMoved });
      log(state, `${p.name} received ${JOKER_INFO[type].name}.`);
    } else {
      state.pendingJoker = { owner: p.id, type };
      log(state, `${p.name} drew ${JOKER_INFO[type].name}; choose a Joker to replace.`);
    }
  }
  // draw a Joker for player `id`
  function drawJoker(id) {
    addJoker(player(id), jokerDrawRaw());
  }
  // resolve a Teddy Bear: take a target's Joker and give one in return
  function teddySteal(targetId, index, offerIndex = 0) {
    const theft = state.pendingTeddy;
    if (!theft) return;
    let thief = player(theft.owner),
      target = player(targetId);
    if (!target || !target.jokers[index]) return;
    let j = loseJoker(target, index, false);
    if (thief.jokerSlots > 1 && thief.jokers.length) {
      let o = loseJoker(thief, Math.min(Math.max(0, offerIndex), thief.jokers.length - 1), false);
      target.jokers.push({ ...o, acquiredAt: state.totalSpacesMoved });
    } else {
      let gift = jokerDrawRaw();
      if (gift === 'teddy') {
        returnJoker('teddy');
        gift = jokerDrawRaw();
      }
      if (gift !== 'teddy') {
        if (target.jokers.length >= target.jokerSlots && target.jokers.length) loseJoker(target, 0);
        target.jokers.push({ type: gift, acquiredAt: state.totalSpacesMoved });
      }
    }
    if (thief.jokers.length >= thief.jokerSlots && thief.jokers.length) loseJoker(thief, 0);
    thief.jokers.push({ ...j, acquiredAt: state.totalSpacesMoved });
    returnJoker('teddy');
    state.pendingTeddy = null;
    log(state, `${thief.name} stole ${JOKER_INFO[j.type].name} from ${target.name}.`);
  }

  //=============================================================
  //                          POLITICS
  //=============================================================
  // cycle a vassal's rent tribute: 25% -> 50% -> 75% -> 100% -> 25%
  function changeTax(id) {
    const v = player(id);
    if (v.overlord !== me().id) return;
    v.tax = { 25: 50, 50: 75, 75: 100, 100: 25 }[v.tax];
    log(state, `${me().name} set ${v.name}'s rental tribute to ${v.tax}%.`);
    render();
  }
  const revoltTarget = (tax) => ({ 25: 12, 50: 10, 75: 8, 100: 6 })[tax] || 12;
  // A vassal rolls to break free of their overlord
  function revolt() {
    let p = me();
    if (p.overlord === null || hasJoker(player(p.overlord), 'ingsoc') || state.turn.revolted)
      return;
    let a = randDie(),
      b = randDie(),
      target = revoltTarget(p.tax),
      sum = a + b + (hasJoker(p, 'liberty') ? 2 : 0);
    if (sum >= target) {
      log(
        state,
        `Revolution: ${p.name} rolled ${sum} vs ${target}+ and broke free from ${player(p.overlord).name}.`,
      );
      toast('Revolution succeeded.');
      p.overlord = null;
    } else {
      log(state, `${p.name}'s revolution failed: rolled ${sum} vs target ${target}+.`);
      toast(`Revolt failed: ${sum} vs ${target}+`);
    }
    state.turn.revolted = true;
    render();
  }

  //=============================================================
  //                           CHESS
  //=============================================================
  // the chess piece on square (x, y), if any
  function pieceAt(x, y, pcs = state.chess) {
    return pcs.find((q) => q.x === x && q.y === y);
  }
  // A player's king
  function kingOf(owner, pcs = state.chess) {
    return pcs.find((q) => q.owner === owner && q.type === 'king');
  }
  // true when (x, y) is on the 24x24 chess field
  function inside(x, y) {
    return x >= 0 && x < 24 && y >= 0 && y < 24;
  }
  // moves for `piece` ignoring check (or only its attacked squares when `onlyAttacks`)
  function pseudoMoves(piece, pcs = state.chess, onlyAttacks = false) {
    const { x, y, type, owner } = piece,
      m = [];
    const add = (xx, yy) => {
      if (!inside(xx, yy)) return false;
      let occ = pieceAt(xx, yy, pcs);
      if (!occ || occ.owner !== owner) m.push({ x: xx, y: yy });
      return !occ;
    };
    const slide = (dirs) => {
      for (const [dx, dy] of dirs) {
        let xx = x + dx,
          yy = y + dy;
        while (inside(xx, yy)) {
          if (!add(xx, yy)) break;
          xx += dx;
          yy += dy;
        }
      }
    };
    const jump = (dirs) => {
      for (let [dx, dy] of dirs) add(x + dx, y + dy);
    };
    const orth = [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ],
      diag = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ],
      knight = [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ];
    if (type === 'rook' || type === 'queen' || type === 'chancellor') slide(orth);
    if (type === 'bishop' || type === 'queen' || type === 'archbishop') slide(diag);
    if (type === 'knight' || type === 'archbishop' || type === 'chancellor') jump(knight);
    if (type === 'king') jump([...orth, ...diag]);
    if (type === 'pawn') {
      const [dx, dy] =
        owner === 0 ? [0, 1] : owner === 2 ? [0, -1] : owner === 1 ? [-1, 0] : [1, 0];
      const vx = dx === 0 ? [1, -1] : [0, 0],
        vy = dx === 0 ? [0, 0] : [1, -1];
      for (let k = 0; k < 2; k++) {
        let xx = x + dx + vx[k],
          yy = y + dy + vy[k],
          other = pieceAt(xx, yy, pcs);
        if (inside(xx, yy) && (onlyAttacks || (other && other.owner !== owner)))
          m.push({ x: xx, y: yy });
      }
      if (!onlyAttacks) {
        let xx = x + dx,
          yy = y + dy;
        let starts =
          owner === 0 ? y === 1 : owner === 2 ? y === 22 : owner === 1 ? x === 22 : x === 1;
        if (inside(xx, yy) && !pieceAt(xx, yy, pcs)) {
          m.push({ x: xx, y: yy });
          let xxx = xx + dx,
            yyy = yy + dy;
          if (starts && inside(xxx, yyy) && !pieceAt(xxx, yyy, pcs)) m.push({ x: xxx, y: yyy });
        }
      }
    }
    return m;
  }
  // the piece list after `piece` moves, for check testing
  function simulatedMove(piece, move, pcs) {
    const without = pcs.filter((q) => q.id !== piece.id && !(q.x === move.x && q.y === move.y));
    return [...without, { ...piece, x: move.x, y: move.y }];
  }
  // true when `owner`'s king is attacked by any other army
  function inCheck(owner, pcs = state.chess) {
    let king = kingOf(owner, pcs);
    if (!king) return false;
    return pcs.some(
      (p) =>
        p.owner !== owner &&
        chessAlive(state.players[p.owner]) &&
        pseudoMoves(p, pcs, true).some((m) => m.x === king.x && m.y === king.y),
    );
  }
  // moves for `piece` that do not leave its own king in check
  function legalMoves(piece, pcs = state.chess) {
    if (!chessAlive(state.players[piece.owner])) return [];
    return pseudoMoves(piece, pcs, false).filter((m) => {
      let victim = pieceAt(m.x, m.y, pcs);
      if (victim && victim.type === 'king') return false;
      return !inCheck(piece.owner, simulatedMove(piece, m, pcs));
    });
  }
  // how many chess actions player `p` may take this turn
  function allowedChessActions(p) {
    return chessAlive(p) ? 1 + (hasJoker(p, 'gambit') ? 1 : 0) + p.chessBuff : 0;
  }
  // handle a click on chess square (x, y): select, move or deploy
  function chessClick(x, y) {
    if (!room.canAct()) return;
    const p = me();
    if (state.winner !== null) return;
    if (state.deploy) {
      deployAt(x, y);
      return;
    }
    if (!chessAlive(p)) {
      toast('Your army is out of the chess game.');
      return;
    }
    const occupied = pieceAt(x, y),
      selected = state.selectedPiece ? state.chess.find((q) => q.id === state.selectedPiece) : null;
    if (selected && legalMoves(selected).some((m) => m.x === x && m.y === y)) {
      if (state.turn.chessUsed >= allowedChessActions(p)) {
        toast('No chess actions left this turn.');
        return;
      }
      makeChessMove(selected, x, y);
      return;
    }
    if (occupied && occupied.owner === p.id)
      state.selectedPiece = occupied.id === state.selectedPiece ? null : occupied.id;
    else {
      if (occupied && !selected) toast(`That's ${player(occupied.owner).name}'s ${occupied.type}.`);
      state.selectedPiece = null;
    }
    render();
  }
  // move a piece, capturing anything on the target square
  function makeChessMove(piece, x, y) {
    const p = me(),
      victim = pieceAt(x, y);
    if (victim) {
      if (victim.type === 'king') return;
      p.loot.push(victim.type);
      state.chess = state.chess.filter((q) => q.id !== victim.id);
      log(
        state,
        `${p.name} captured ${player(victim.owner).name}'s ${victim.type} for future auction.`,
      );
    }
    state.lastChessMove = { fx: piece.x, fy: piece.y, tx: x, ty: y };
    piece.x = x;
    piece.y = y;
    if (
      piece.type === 'pawn' &&
      ((piece.owner === 0 && y === 23) ||
        (piece.owner === 2 && y === 0) ||
        (piece.owner === 1 && x === 0) ||
        (piece.owner === 3 && x === 23))
    ) {
      piece.type = 'queen';
      log(state, `${p.name} promoted a pawn to queen.`);
    }
    state.turn.chessUsed++;
    state.selectedPiece = null;
    state.deploy = null;
    log(state, `${p.name} moved ${piece.type} to (${x + 1}, ${y + 1}).`);
    resolveCheckmates(p.id);
    render();
  }
  // after a move by `attackerId`, turn every checkmated king into a vassal
  function resolveCheckmates(attackerId) {
    for (let victim of state.players) {
      if (victim.id === attackerId || !chessAlive(victim)) continue;
      if (!inCheck(victim.id)) continue;
      const canEscape = state.chess
        .filter((q) => q.owner === victim.id)
        .some((q) => legalMoves(q).length > 0);
      if (canEscape) {
        log(state, `Check: ${victim.name}'s king is under attack.`);
        toast(`Check on ${victim.name}.`);
      } else {
        victim.chessOut = true;
        state.chess = state.chess.filter((q) => q.owner !== victim.id);
        if (player(attackerId).overlord === victim.id) player(attackerId).overlord = null;
        victim.overlord = attackerId;
        victim.tax = 25;
        player(attackerId).conquests++;
        log(
          state,
          `Checkmate: ${victim.name} becomes ${player(attackerId).name}'s vassal (25% rent tax).`,
        );
        toast(`Checkmate. ${victim.name} is now a vassal.`);
        revive(player(attackerId), 'checkmating a king');
      }
    }
  }
  // withdraw your whole army from the chess field for good; you can then never be checkmated
  function retireKing() {
    let p = me();
    if (!p.conquests || !chessAlive(p)) return;
    if (
      !confirm(
        'Retire your king? Your whole army leaves the chess board for good, but you can never be checkmated.',
      )
    )
      return;
    p.chessRetired = true;
    state.chess = state.chess.filter((q) => q.owner !== p.id);
    state.selectedPiece = null;
    state.deploy = null;
    log(state, `${p.name} retired from chess and cannot be checkmated.`);
    render();
  }
  // buy a fairy piece (archbishop or chancellor) into the reserve
  function buyFairy(type) {
    let p = me(),
      cost = FAIRY_COST[type];
    if (!cost || !chessAlive(p) || p.bankrupt || p.cash < cost) return;
    p.cash -= cost;
    p.reserve.push(type);
    log(state, `${p.name} bought a ${type} for ${$n(cost)}. Deploy it near their king.`);
    toast(`${type} added to your reserve`);
    render();
  }
  // empty squares near the king where a reserve piece may be placed
  function legalDeploySquares(p) {
    const king = kingOf(p.id);
    if (!king) return [];
    const out = [],
      R = RULES.deployRadius;
    for (let dx = -R; dx <= R; dx++)
      for (let dy = -R; dy <= R; dy++) {
        if (!dx && !dy) continue;
        const x = king.x + dx,
          y = king.y + dy;
        if (
          inside(x, y) &&
          !pieceAt(x, y) &&
          !inCheck(p.id, [...state.chess, { id: -22, owner: p.id, type: 'knight', x, y }])
        )
          out.push({ x, y });
      }
    return out;
  }
  // begin placing reserve piece `idx`
  function startDeploy(idx) {
    if (!room.canAct()) return;
    const p = me();
    if (!p.reserve[idx]) return;
    if (!chessAlive(p)) {
      toast('Your army is out of the chess game.');
      return;
    }
    if (state.turn.chessUsed >= allowedChessActions(p)) {
      toast('No chess actions left this turn.');
      return;
    }
    state.selectedTab = 'chess';
    openFolio = 'chess';
    state.selectedPiece = null;
    if (!legalDeploySquares(p).length) {
      state.deploy = null;
      toast(
        inCheck(p.id)
          ? 'Your king is in check and no deploy square blocks it — move instead.'
          : 'No empty squares near your king right now.',
      );
      render();
      return;
    }
    state.deploy = { index: idx };
    render();
  }
  // place the reserve piece being deployed on (x, y)
  function deployAt(x, y) {
    const p = me(),
      d = state.deploy;
    if (!d || !p.reserve[d.index] || state.turn.chessUsed >= allowedChessActions(p)) {
      state.deploy = null;
      render();
      return;
    }
    if (!legalDeploySquares(p).some((a) => a.x === x && a.y === y)) {
      const occ = pieceAt(x, y);
      if (occ && occ.owner === p.id) {
        state.deploy = null;
        state.selectedPiece = occ.id;
        render();
        return;
      }
      toast(
        inCheck(p.id)
          ? 'Your king is in check — pick a highlighted square that blocks it.'
          : `Pick a highlighted ◇ square within ${RULES.deployRadius} of your king.`,
      );
      return;
    }
    const type = p.reserve.splice(d.index, 1)[0];
    state.chess.push({ id: uid(), owner: p.id, type, x, y });
    state.deploy = null;
    state.turn.chessUsed++;
    state.lastChessMove = { fx: x, fy: y, tx: x, ty: y };
    log(state, `${p.name} deployed a ${type} at (${x + 1}, ${y + 1}).`);
    resolveCheckmates(p.id);
    render();
  }

  //=============================================================
  //                    AUCTIONS & PURCHASES
  //=============================================================
  // open an auction for a property or captured piece
  function startAuction(kind, thing, seller, sourceTile = null) {
    state.auction = { kind, thing, seller, sourceTile, highest: 0, bidder: null };
    if (room.online) {
      room.openAuction(state.auction, state);
      if (state.auction.actor === null) {
        state.auction = null;
        log(state, 'No eligible bidders.');
        render();
        return;
      }
    }
    log(state, `Auction opened for ${thing}.`);
    render();
  }
  // raise the bid by `delta` on behalf of player `id`
  function bidAuction(id, delta) {
    let a = state.auction;
    if (!a || id === a.seller || (room.online && id !== a.actor)) return;
    let bid = a.highest + delta;
    if (player(id).cash < bid) return;
    a.highest = bid;
    a.bidder = id;
    log(state, `${player(id).name} bid ${$n(bid)} for ${a.thing}.`);
    if (room.online) {
      room.advanceAuction(a, state);
      if (a.actor === null) {
        settleAuction();
        return;
      }
    }
    render();
  }
  // online auction: the seat to act drops out
  function passAuction() {
    const a = state.auction;
    if (!room.online || !a || !room.canAct()) return;
    a.passed.push(a.actor);
    log(state, `${player(a.actor).name} passed on ${a.thing}.`);
    room.advanceAuction(a, state);
    if (a.actor === null) {
      if (a.bidder !== null) {
        settleAuction();
        return;
      }
      state.auction = null;
      state.pendingPurchase = null;
      log(state, 'Auction closed without a bid.');
    }
    render();
  }
  // award the auctioned item to the highest bidder
  function settleAuction() {
    let a = state.auction;
    if (!a || a.bidder === null) return;
    let buyer = player(a.bidder);
    if (buyer.cash < a.highest) {
      toast('Buyer can no longer afford that bid.');
      return;
    }
    buyer.cash -= a.highest;
    if (a.seller >= 0) player(a.seller).cash += a.highest;
    if (a.kind === 'piece') {
      buyer.reserve.push(a.thing);
      let seller = player(a.seller),
        i = seller.loot.indexOf(a.thing);
      if (i >= 0) seller.loot.splice(i, 1);
    } else if (a.kind === 'property') {
      let t = state.rings.flat().find((t) => t.id === a.sourceTile);
      if (t) t.owner = a.bidder;
      state.pendingPurchase = null;
    }
    log(state, `AUCTION: ${buyer.name} won ${a.thing} for ${$n(a.highest)}.`);
    state.auction = null;
    render();
  }
  // close the buy prompt, buying the space when `buy` is true
  function endPurchase(buy = false) {
    let x = state.pendingPurchase;
    if (!x) return;
    let t = tileAt(x.ring, x.pos);
    if (buy) {
      if (me().cash < t.price || t.owner !== null) return;
      me().cash -= t.price;
      t.owner = me().id;
      log(state, `${me().name} bought ${t.name} for ${$n(t.price)}.`);
    } else log(state, `${me().name} passed on ${t.name}.`);
    state.pendingPurchase = null;
    render();
  }
  // auction the space the player declined to buy
  function openPropertyAuction() {
    let x = state.pendingPurchase;
    if (!x) return;
    let t = tileAt(x.ring, x.pos);
    startAuction('property', t.name, -1, t.id);
  }

  //=============================================================
  //                        SAVE / LOAD
  //=============================================================
  // replace the game with a saved JSON state
  function loadFrom(raw) {
    const s = migrate(JSON.parse(raw));
    state = s;
    nextId = Math.max(0, ...state.chess.map((p) => p.id)) + 1;
  }

  //=============================================================
  //                           INPUT
  //=============================================================
  // switch the side-panel tab
  function setTab(id) {
    state.selectedTab = id;
    state.selectedPiece = null;
    state.deploy = null;
    openFolio = id === 'monopoly' ? null : id;
    focusReturn = id === 'monopoly' ? null : '[data-folio="' + id + '"]';
    render();
  }
  // route a click on an element with data-act to the matching game action
  function onAction(el) {
    let act = el.dataset.act,
      idx = Number(el.dataset.index),
      who = Number(el.dataset.who);
    switch (act) {
      case 'reloadMatch':
        window.location.reload();
        break;
      case 'passAuction':
        passAuction();
        break;
      case 'closeFolio':
        openFolio = null;
        state.selectedTab = 'monopoly';
        state.deploy = null;
        state.selectedPiece = null;
        render();
        break;
      case 'boardSize':
        boardLarge = !boardLarge;
        render();
        break;
      case 'rollMove':
        rollAction('move');
        break;
      case 'rollMint':
        rollAction('mint');
        break;
      case 'endTurn':
        nextTurn();
        break;
      case 'buyProperty':
        endPurchase(true);
        break;
      case 'skipProperty':
        endPurchase(false);
        break;
      case 'auctionProperty':
        openPropertyAuction();
        break;
      case 'buyFairy':
        buyFairy(el.dataset.type);
        break;
      case 'deployReserve':
        startDeploy(idx);
        break;
      case 'cancelDeploy':
        state.deploy = null;
        render();
        break;
      case 'sellLoot': {
        let p = me(),
          type = p.loot[idx];
        if (!type) return;
        p.loot.splice(idx, 1);
        let amount = Math.round(PIECE_VALUE[type] * (hasJoker(p, 'mirror') ? 1.5 : 1));
        p.cash += amount;
        log(state, `${p.name} sold a captured ${type} to the bank for ${$n(amount)}.`);
        render();
        break;
      }
      case 'auctionLoot':
        if (me().loot[idx]) startAuction('piece', me().loot[idx], me().id);
        break;
      case 'bidAuction':
        bidAuction(who, Number(el.dataset.delta));
        break;
      case 'settleAuction':
        settleAuction();
        break;
      case 'cancelAuction':
        if (room.online) return;
        state.auction = null;
        log(state, 'Auction cancelled.');
        render();
        break;
      case 'revolt':
        revolt();
        break;
      case 'changeTax':
        changeTax(who);
        break;
      case 'exitChess':
        retireKing();
        break;
      case 'enterRing': {
        let p = me(),
          cost = RULES.ringFees[p.ring];
        if (
          tileAt(p.ring, p.pos).type !== 'gate' ||
          p.ring === 2 ||
          p.cash < cost ||
          state.turn.ringChanged ||
          p.bankrupt
        )
          return;
        p.cash -= cost;
        p.ring++;
        p.pos = 0;
        state.turn.ringChanged = true;
        state.selectedTile = tileAt(p.ring, 0).id;
        log(state, `${p.name} paid ${$n(cost)} and entered ring ${p.ring + 1}.`);
        render();
        break;
      }
      case 'exitRing': {
        let p = me();
        if (tileAt(p.ring, p.pos).type !== 'gate' || p.ring === 0 || state.turn.ringChanged) return;
        p.ring--;
        p.pos = 0;
        state.turn.ringChanged = true;
        state.selectedTile = tileAt(p.ring, 0).id;
        log(state, `${p.name} returned to ring ${p.ring + 1}.`);
        render();
        break;
      }
      case 'discardJoker': {
        let p = me();
        if (!p.jokers[idx]) return;
        log(state, `${p.name} discarded ${JOKER_INFO[p.jokers[idx].type].name}.`);
        loseJoker(p, idx);
        render();
        break;
      }
      case 'swapJoker': {
        let x = state.pendingJoker;
        if (!x) return;
        let p = player(x.owner);
        loseJoker(p, idx);
        p.jokers.push({ type: x.type, acquiredAt: state.totalSpacesMoved });
        log(state, `${p.name} received ${JOKER_INFO[x.type].name}.`);
        state.pendingJoker = null;
        render();
        break;
      }
      case 'rejectJoker':
        if (state.pendingJoker) {
          returnJoker(state.pendingJoker.type);
          state.pendingJoker = null;
          render();
        }
        break;
      case 'teddySteal':
        teddySteal(who, idx, Number($('#teddy-offer')?.value || 0));
        render();
        break;
      case 'cancelTeddy':
        if (state.pendingTeddy) {
          returnJoker('teddy');
          state.pendingTeddy = null;
          render();
        }
        break;
      case 'bankSlot': {
        let p = me();
        if (state.slotAuction > 0 && p.jokerSlots < 3 && p.cash >= RULES.slotPrice && !p.bankrupt) {
          p.cash -= RULES.slotPrice;
          p.jokerSlots++;
          state.slotAuction--;
          log(state, `${p.name} bought the bank's Joker slot for ${$n(RULES.slotPrice)}.`);
          render();
        }
        break;
      }
      case 'dismissWinner':
        state.winnerSeen = true;
        render();
        break;
      case 'saveGame':
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(state));
          toast('Game saved to the manual slot.');
        } catch (e) {
          toast('Save blocked by browser settings.');
        }
        break;
      case 'loadGame':
        try {
          const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_KEY);
          if (!raw) {
            toast('No manual save found.');
          } else {
            loadFrom(raw);
            log(state, 'Saved game restored.');
            toast('Saved game restored.');
            render();
          }
        } catch (e) {
          toast('Could not load saved game.');
        }
        break;
      case 'resetGame':
        if (
          confirm('Start a new CROWNS & BONES game? The current game will be lost unless saved.')
        ) {
          state = newGame();
          render();
        }
        break;
      default:
        break;
    }
  }
  // load the autosave (or start a new game), wire up input, and draw the first frame
  function initialize() {
    try {
      const raw = localStorage.getItem(AUTO_KEY);
      if (raw) {
        loadFrom(raw);
        log(state, 'Resumed your last game (autosave).');
      }
    } catch (e) {
      state = null;
    }
    if (!state) state = newGame();
    if (['chess', 'domino', 'rules'].includes(state.selectedTab)) openFolio = state.selectedTab;
    document.addEventListener('click', (e) => {
      const required = !!(
        state.auction ||
        state.pendingJoker ||
        state.pendingTeddy ||
        (state.winner !== null && !state.winnerSeen)
      );
      if (required && !e.target.closest('.modal-wrap')) return;
      if (openFolio && !required && !e.target.closest('.folio-wrap')) return;
      if (e.target.matches('[data-backdrop="folio"]')) {
        openFolio = null;
        state.deploy = null;
        state.selectedPiece = null;
        state.selectedTab = 'monopoly';
        render();
        return;
      }
      const action = e.target.closest('[data-act]');
      if (action) {
        if (!action.disabled && room.allowed(action.dataset.act)) onAction(action);
        return;
      }
      const folio = e.target.closest('[data-folio]');
      if (folio) {
        focusReturn = '[data-folio="' + folio.dataset.folio + '"]';
        openFolio = folio.dataset.folio;
        if (['chess', 'domino', 'rules'].includes(openFolio)) state.selectedTab = openFolio;
        render();
        return;
      }
      const court = e.target.closest('[data-court]');
      if (court) {
        selectedCourt = Number(court.dataset.court);
        focusReturn = '[data-court="' + court.dataset.court + '"]';
        openFolio = 'courts';
        render();
        return;
      }
      const tile = e.target.closest('[data-tile]');
      if (tile) {
        state.selectedTile = tile.dataset.tile;
        focusReturn = '[data-tile="' + tile.dataset.tile + '"]';
        openFolio = 'deeds';
        render();
        return;
      }
      const square = e.target.closest('[data-square]');
      if (square && room.canAct()) {
        const [x, y] = square.dataset.square.split(',').map(Number);
        chessClick(x, y);
        return;
      }
      const domino = e.target.closest('[data-domino]');
      if (domino && room.canAct() && !domino.disabled && !busy()) {
        playDomino(Number(domino.dataset.domino));
        return;
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.target.closest && e.target.closest('input,select,textarea')) return;
      const k = e.key.toLowerCase();
      if (k === 'tab') {
        const root = $('.modal') || $('.folio');
        if (root) {
          const items = [...root.querySelectorAll('button:not(:disabled),select,[tabindex="0"]')];
          if (!items.length) {
            e.preventDefault();
            root.focus();
            return;
          }
          const first = items[0],
            last = items.at(-1);
          if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
            e.preventDefault();
            last.focus();
          } else if (
            !e.shiftKey &&
            (document.activeElement === last || document.activeElement === root)
          ) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (
        state.auction ||
        state.pendingJoker ||
        state.pendingTeddy ||
        (state.winner !== null && !state.winnerSeen)
      )
        return;
      if (k === 'escape') {
        if (state.deploy || state.selectedPiece) {
          state.deploy = null;
          state.selectedPiece = null;
        } else {
          openFolio = null;
          state.selectedTab = 'monopoly';
        }
        render();
        return;
      }
      if (['1', '2', '3', '4'].includes(k)) {
        setTab(['monopoly', 'chess', 'domino', 'rules'][+k - 1]);
        return;
      }
      if (openFolio) return;
      if (!room.canAct()) return;
      if (k === 'r') rollAction('move');
      else if (k === 'm') rollAction('mint');
      else if (k === 'e') nextTurn();
      else if (k === 'b') endPurchase(true);
      else if (k === 's') endPurchase(false);
    });

    render();
  }
  window.__crownsAndBones = window.__deadlock = {
    get state() {
      return state;
    },
    replace(next) {
      loadFrom(JSON.stringify(next));
      render();
    },
    fresh() {
      state = newGame();
      render();
    },
    chessClick,
    startDeploy,
    nextTurn,
    rollAction,
    playDomino,
    legalDeploySquares,
    bankruptPlayer,
    endDominoRound,
    mintCost,
    render,
  };
  initialize();
  room.bind(window.__crownsAndBones);
})();

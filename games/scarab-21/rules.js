// rules.js - Scarab 21 rules (no DOM), shared with the tests
// Author: Reachnid Group
// Centennial College - Fall 2026

// pure game rules (no DOM), shared by the browser and the tests.
//
// one 52-card deck, five columns. Each draw must go on a column without busting (over 21) or
// exceeding five cards. Hitting 21, or five cards under 21, clears the column and scores; some
// whole-board patterns clear every column. The run ends when the draw fits nowhere.
//
// Game state: { columns, card, deck, discard, score, previousQueenSuit, over }

(function () {
  'use strict';

  //=============================================================
  //                          SETTINGS
  //=============================================================

  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  // sorted rank patterns that make a 21 "Full House"
  const fullHouses = ['3,3,3,6,6', '3,3,5,5,5', '9,9,A,A,A'];

  //=============================================================
  //                          HELPERS
  //=============================================================

  // Fisher-Yates shuffle in place. `random` is injectable so tests are deterministic
  function shuffle(cards, random) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  // blackjack total: faces count 10, one ace counts 11 when that does not bust
  function total(cards) {
    let sum = 0;
    let hasAce = false;
    for (const { rank } of cards) {
      hasAce ||= rank === 'A';
      sum += rank === 'A' ? 1 : Number(rank) || 10;
    }
    return hasAce && sum <= 11 ? sum + 10 : sum;
  }

  // A column may hold at most five cards and must not exceed 21
  function fits(cards, value) {
    return cards.length <= 5 && value <= 21;
  }

  // true when `card` can legally go on `column`
  function canPlay(column, card) {
    const cards = [...column, card];
    return fits(cards, total(cards));
  }

  // award for a column worth `value`, as [label, points], or null when it does not clear.
  // `previousQueenSuit` is the suit of the last A+Q blackjack, for the Double Blackjack bonus.
  function columnAward(cards, previousQueenSuit, value) {
    if (value < 21) return cards.length === 5 ? ['5 under 21', 5] : null;

    const pattern = cards
      .map(({ rank }) => rank)
      .sort()
      .join(',');
    if (fullHouses.includes(pattern)) return ['Full House', 200];

    if (cards.length === 2) {
      const ace = cards.find(({ rank }) => rank === 'A');
      const partner = cards.find(({ rank }) => rank !== 'A');
      if (ace.suit === 'spades' && partner.suit === 'spades' && partner.rank === 'J') {
        return ['Super Blackjack', 50];
      }
      if (queenSuit(cards) && previousQueenSuit && previousQueenSuit !== ace.suit) {
        return ['Double Blackjack', 50];
      }
      return ['Blackjack', 21];
    }

    if (pattern === '7,7,7') return ['7-7-7', 15];
    if (pattern === '6,7,8') return ['6-7-8', 15];
    return cards.length >= 4 ? ['Large 21', 15] : ['21', 10];
  }

  // for an A+Q blackjack in spades or hearts (matching suits), that suit; otherwise null
  function queenSuit(cards) {
    if (cards.length !== 2) return null;
    const ace = cards.find(({ rank }) => rank === 'A');
    if (!ace || (ace.suit !== 'spades' && ace.suit !== 'hearts')) return null;
    return cards.some(({ rank, suit }) => rank === 'Q' && suit === ace.suit) ? ace.suit : null;
  }

  // whole-board award ([label, points]) when all five totals form a pattern, else null
  function boardAward(columns) {
    const totals = columns.map(total).sort((a, b) => a - b);
    if (totals[0] >= 16 && totals[0] === totals[4]) return ['5 of a Kind', 100];
    if (totals.join(',') === '16,17,18,19,20') return ['Straight', 100];
    return null;
  }

  //=============================================================
  //                        GAME ACTIONS
  //=============================================================

  // A freshly shuffled game with the first card drawn
  function newGame(random = Math.random) {
    const deck = shuffle(
      suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit }))),
      random,
    );
    return {
      columns: Array.from({ length: 5 }, () => []),
      card: deck.pop(),
      deck,
      discard: [],
      score: 0,
      previousQueenSuit: null,
      over: false,
    };
  }

  // what would happen if the current card went on column `index`, without changing the game.
  // returns { value, legal, clear, award } or null - clear is 'column', 'board' or null
  function preview(game, index) {
    const column = game.columns[index];
    if (!column) return null;

    const cards = [...column, game.card];
    const value = total(cards);
    if (!fits(cards, value)) return { value, legal: false, clear: null };

    const award = columnAward(cards, game.previousQueenSuit, value);
    if (award) return { value, legal: true, clear: 'column', award };

    const board = boardAward(game.columns.map((pile, lane) => (lane === index ? cards : pile)));
    return { value, legal: true, clear: board ? 'board' : null, award: board };
  }

  // place the current card on column `index`, apply clears and awards, and draw the next card.
  // returns the list of [label, points] awards, or null when the move is not allowed.
  function play(game, index, random = Math.random) {
    if (game.over) return null;
    const outcome = preview(game, index);
    if (!outcome?.legal) return null;

    const { award, clear } = outcome;
    const column = game.columns[index];
    const awards = award ? [award] : [];
    column.push(game.card);

    if (clear === 'column') {
      game.previousQueenSuit = queenSuit(column);
      game.discard.push(...column.splice(0));
    } else if (clear === 'board') {
      game.previousQueenSuit = null;
      for (const pile of game.columns) game.discard.push(...pile.splice(0));
    }

    if (!game.deck.length) {
      awards.push(['Deck Clear', 10]);
      game.deck = shuffle(game.discard, random);
      game.discard = [];
    }

    for (const [, points] of awards) game.score += points;
    game.card = game.deck.pop();
    game.over = !game.columns.some((pile) => canPlay(pile, game.card));
    return awards;
  }

  //=============================================================
  //                          EXPORTS
  //=============================================================

  const rules = { total, canPlay, newGame, play, preview };
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else window.Scarab21 = rules;
})();

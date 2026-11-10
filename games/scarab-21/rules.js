(function () {
  'use strict';

  const suits = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const fullHouses = ['3,3,3,6,6', '3,3,5,5,5', '9,9,A,A,A'];

  function shuffle(cards, random) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  function total(cards) {
    let sum = 0;
    let hasAce = false;
    for (const { rank } of cards) {
      hasAce ||= rank === 'A';
      sum += rank === 'A' ? 1 : Number(rank) || 10;
    }
    return hasAce && sum <= 11 ? sum + 10 : sum;
  }

  function canPlay(column, card) {
    return column.length < 5 && total([...column, card]) <= 21;
  }

  function columnAward(cards, previousQueenSuit) {
    const value = total(cards);
    if (value < 21) return cards.length === 5 ? ['5 under 21', 5] : null;

    const pattern = cards.map(({ rank }) => rank).sort().join(',');
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

  function queenSuit(cards) {
    if (cards.length !== 2) return null;
    const ace = cards.find(({ rank }) => rank === 'A');
    if (!ace || (ace.suit !== 'spades' && ace.suit !== 'hearts')) return null;
    return cards.some(({ rank, suit }) => rank === 'Q' && suit === ace.suit) ? ace.suit : null;
  }

  function boardAward(columns) {
    const totals = columns.map(total).sort((a, b) => a - b);
    if (totals[0] >= 16 && totals[0] === totals[4]) return ['5 of a Kind', 100];
    if (totals.join(',') === '16,17,18,19,20') return ['Straight', 100];
    return null;
  }

  function newGame(random = Math.random) {
    const deck = shuffle(suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit }))), random);
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

  function play(game, index, random = Math.random) {
    const column = game.columns[index];
    if (game.over || !column || !canPlay(column, game.card)) return null;

    const awards = [];
    column.push(game.card);
    const award = columnAward(column, game.previousQueenSuit);
    const board = award ? null : boardAward(game.columns);

    if (award) {
      awards.push(award);
      game.previousQueenSuit = queenSuit(column);
      game.discard.push(...column.splice(0));
    } else if (board) {
      awards.push(board);
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

  const rules = { total, canPlay, newGame, play };
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else window.Scarab21 = rules;
})();

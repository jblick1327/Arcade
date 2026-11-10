const assert = require('node:assert/strict');
const { test } = require('node:test');
const { total, canPlay, newGame, play, preview } = require('../rules.js');

const card = (rank, suit = 'clubs') => ({ rank, suit });
const pile = (...ranks) => ranks.map((rank, i) => card(rank, ['clubs', 'diamonds', 'hearts', 'spades'][i % 4]));
const deal = (cards, columns) => ({
  ...newGame(),
  card: cards[0],
  deck: [...cards.slice(1)].reverse(),
  columns: columns || Array.from({ length: 5 }, () => []),
});

test('soft aces become low as needed, and face cards count as ten', () => {
  assert.equal(total(pile('A', 'A')), 12);
  assert.equal(total(pile('A', 'K')), 21);
  assert.equal(total(pile('A', '6', '8')), 15);
  assert.equal(total(pile('A', 'Q', 'K')), 21);
  assert.equal(canPlay(pile('A', '7'), card('K')), true);
  assert.equal(canPlay(pile('9', 'Q'), card('3')), false);
});

const clears = [
  [pile('10', 'A'), 'Blackjack', 21],
  [pile('3', '8', 'J'), '21', 10],
  [pile('8', '6', '7'), '6-7-8', 15],
  [pile('7', '7', '7'), '7-7-7', 15],
  [pile('2', '4', '6', '9'), 'Large 21', 15],
  [pile('2', '3', '4', '5', '7'), 'Large 21', 15],
  [pile('2', '2', '3', '4', '5'), '5 under 21', 5],
  [pile('3', '5', '5', '3', '5'), 'Full House', 200],
  [pile('6', '3', '3', '6', '3'), 'Full House', 200],
  [pile('9', '9', 'A', 'A', 'A'), 'Full House', 200],
  [[card('A', 'spades'), card('J', 'spades')], 'Super Blackjack', 50],
];

for (const [cards, label, points] of clears) {
  test(`${label} clears the column for ${points}`, () => {
    const game = deal([...cards, card('2')]);
    for (let i = 1; i < cards.length; i++) assert.deepEqual(play(game, 0), []);
    assert.equal(preview(game, 0).clear, 'column');
    assert.deepEqual(play(game, 0), [[label, points]]);
    assert.equal(game.score, points);
    assert.equal(game.columns[0].length, 0);
    assert.deepEqual(game.discard, cards);
  });
}

test('Double Blackjack requires consecutive suited spade and heart queen clears', () => {
  const spades = [card('A', 'spades'), card('Q', 'spades')];
  const hearts = [card('Q', 'hearts'), card('A', 'hearts')];

  for (const [first, second] of [[spades, hearts], [hearts, spades]]) {
    const game = deal([...first, card('3'), ...second, card('2')]);
    assert.deepEqual(play(game, 0), []);
    assert.deepEqual(play(game, 0), [['Blackjack', 21]]);
    assert.deepEqual(play(game, 1), []);
    assert.deepEqual(play(game, 2), []);
    assert.deepEqual(play(game, 2), [['Double Blackjack', 50]]);
    assert.equal(game.score, 71);
  }

  const interrupted = deal([...spades, ...pile('8', '7', '6'), ...hearts, card('2')]);
  for (let i = 0; i < 6; i++) play(interrupted, 0);
  assert.deepEqual(play(interrupted, 0), [['Blackjack', 21]]);

  const offSuit = deal([...spades, card('Q', 'clubs'), card('A', 'hearts'), card('2')]);
  for (let i = 0; i < 3; i++) play(offSuit, 0);
  assert.deepEqual(play(offSuit, 0), [['Blackjack', 21]]);
});

test('Straight clears all columns in any order', () => {
  const columns = [pile('10', '9'), pile('9', '7'), pile('10', 'K'), pile('8', '9'), pile('10')];
  const game = deal(pile('8', '2'), columns);
  const before = structuredClone(game);
  assert.equal(preview(game, 4).clear, 'board');
  assert.deepEqual(game, before, 'A preview does not place the card');
  assert.deepEqual(play(game, 4), [['Straight', 100]]);
  assert.ok(game.columns.every((column) => !column.length));
  assert.equal(game.discard.length, 10);
});

test('Five of a Kind clears equal totals of 16 and leaves lower totals alone', () => {
  for (const value of [15, 16, 17, 18, 19, 20]) {
    const rank = String(value - 10);
    const columns = Array.from({ length: 5 }, (_, i) => i === 4 ? pile('J') : pile('J', rank));
    const game = deal(pile(rank, '2'), columns);
    const qualifies = value >= 16;
    assert.deepEqual(play(game, 4), qualifies ? [['5 of a Kind', 100]] : []);
    assert.equal(game.columns.every((column) => !column.length), qualifies);
  }
});

test('a deck starts with 52 distinct cards', () => {
  const game = newGame();
  assert.equal(game.deck.length, 51);
  assert.equal(new Set([game.card, ...game.deck].map(({ rank, suit }) => `${rank} ${suit}`)).size, 52);
});

test('depleting the draw pile reshuffles discards and preserves cards in play', () => {
  const held = card('9', 'hearts');
  const used = card('K', 'diamonds');
  const game = deal([card('2')], [[held], [], [], [], []]);
  game.discard.push(used);
  assert.deepEqual(play(game, 1), [['Deck Clear', 10]]);
  assert.equal(game.card, used);
  assert.deepEqual(game.columns[0], [held]);
  assert.deepEqual(game.discard, []);
  assert.equal(game.score, 10);
});

test('illegal placement changes nothing, and no legal columns ends the game', () => {
  const game = deal(pile('10', 'K', '4'), [pile('6', '7'), pile('6', '7'), pile('6', '7'), pile('6', '7'), pile('8')]);
  const before = structuredClone(game);
  assert.equal(play(game, 0), null);
  assert.deepEqual(game, before);
  assert.deepEqual(play(game, 4), []);
  assert.equal(game.over, true);
  assert.equal(game.card.rank, 'K');
  assert.equal(play(game, 4), null);
});

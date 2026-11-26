// rules.cjs - tests for the 2048 rules
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createBoard, addRandomTile, moveBoard, isGameOver, hasWon } = require('../rules.js');

// build a board from 16 numbers (0 = empty)
let id = 100;
const make = (values) => values.map((v) => (v ? { id: id++, value: v } : null));
const values = (board) => board.map((t) => (t ? t.value : 0));

//=============================================================
//                           TESTS
//=============================================================

test('a new board starts with two tiles', () => {
  const board = createBoard();
  assert.equal(board.length, 16);
  assert.equal(board.filter(Boolean).length, 2);
});

test('sliding left merges a pair once and scores the merged value', () => {
  const board = make([2, 2, 2, 2, 4, 0, 4, 0, 0, 0, 0, 0, 8, 0, 0, 8]);
  const r = moveBoard(board, 'left');
  assert.deepEqual(values(r.board), [4, 4, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0]);
  assert.equal(r.points, 4 + 4 + 8 + 16);
  assert.equal(r.changed, true);
  assert.equal(r.mergedIds.length, 4);
});

test('sliding right and down follow the same rules from the other side', () => {
  const row = make([2, 0, 2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(values(moveBoard(row, 'right').board).slice(0, 4), [0, 0, 4, 4]);
  const col = make([2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]);
  assert.deepEqual(
    values(moveBoard(col, 'down').board).filter((_, i) => i % 4 === 0),
    [0, 0, 2, 4],
  );
});

test('a move that changes nothing reports changed: false', () => {
  const board = make([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(moveBoard(board, 'left').changed, false);
});

test('a new tile only lands on an empty cell', () => {
  const board = make([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0]);
  const next = addRandomTile(board, () => 0);
  assert.ok(next[15]);
  assert.equal(addRandomTile(next), next, 'a full board is returned unchanged');
});

test('the game is over only when the board is full with no equal neighbours', () => {
  assert.equal(isGameOver(make([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])), true);
  assert.equal(isGameOver(make([2, 2, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])), false);
  assert.equal(isGameOver(make([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0])), false);
});

test('reaching the 2048 tile wins', () => {
  assert.equal(hasWon(make([2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), true);
  assert.equal(hasWon(make([1024, 1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])), false);
});

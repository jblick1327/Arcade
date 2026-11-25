// rules.js - 2048 rules (no DOM), shared with the tests
// Author: Reachnid Group
// Centennial College - Fall 2026

// The board is an array of 16 cells (row by row). Each cell is null or a tile { id, value }.
// Tiles keep their id when they slide, so the page can animate them; a merged tile keeps the id
// of the tile it moved into.

(function () {
  'use strict';

  //=============================================================
  //                          SETTINGS
  //=============================================================

  const SIZE = 4;
  const WIN_VALUE = 2048;

  // a new tile is a 2 nine times out of ten, otherwise a 4
  const FOUR_CHANCE = 0.1;

  //=============================================================
  //                          HELPERS
  //=============================================================

  // ids for new tiles (reset by createBoard)
  let nextTileId = 1;

  // the board indexes of one row or column, in the order tiles slide towards
  function getLineIndices(direction, line) {
    const indices = [];
    for (let i = 0; i < SIZE; i++) {
      if (direction === 'left') indices.push(line * SIZE + i);
      if (direction === 'right') indices.push(line * SIZE + (SIZE - 1 - i));
      if (direction === 'up') indices.push(i * SIZE + line);
      if (direction === 'down') indices.push((SIZE - 1 - i) * SIZE + line);
    }
    return indices;
  }

  //=============================================================
  //                         GAME RULES
  //=============================================================

  // put a 2 (or sometimes a 4) on a random empty cell - returns a new board
  function addRandomTile(board, random = Math.random) {
    const emptyCells = board
      .map((tile, index) => (tile === null ? index : null))
      .filter((index) => index !== null);
    if (emptyCells.length === 0) return board;

    const newBoard = [...board];
    const index = emptyCells[Math.floor(random() * emptyCells.length)];
    newBoard[index] = { id: nextTileId++, value: random() < 1 - FOUR_CHANCE ? 2 : 4 };
    return newBoard;
  }

  // a fresh board with two starting tiles
  function createBoard(random = Math.random) {
    nextTileId = 1;
    let board = Array(SIZE * SIZE).fill(null);
    board = addRandomTile(board, random);
    board = addRandomTile(board, random);
    return board;
  }

  // slide every tile one way, merging equal neighbours once per move
  // returns { board, points, changed, mergedIds }
  function moveBoard(board, direction) {
    const newBoard = [...board];
    let points = 0;
    let changed = false;
    const mergedIds = [];

    for (let line = 0; line < SIZE; line++) {
      const indices = getLineIndices(direction, line);
      const tiles = indices.map((index) => newBoard[index]).filter((tile) => tile !== null);

      // merge pairs from the front of the line
      const mergedTiles = [];
      for (let i = 0; i < tiles.length; i++) {
        if (i < tiles.length - 1 && tiles[i].value === tiles[i + 1].value) {
          const mergedTile = { id: tiles[i].id, value: tiles[i].value * 2 };
          mergedTiles.push(mergedTile);
          mergedIds.push(mergedTile.id);
          points += mergedTile.value;
          i++;
        } else {
          mergedTiles.push(tiles[i]);
        }
      }

      // pad the rest of the line with empty cells
      while (mergedTiles.length < SIZE) mergedTiles.push(null);

      // write the line back, noting if anything moved
      indices.forEach((index, position) => {
        if (newBoard[index]?.id !== mergedTiles[position]?.id) changed = true;
        newBoard[index] = mergedTiles[position];
      });
    }

    return { board: newBoard, points, changed, mergedIds };
  }

  // no empty cells and no equal neighbours - nothing can move
  function isGameOver(board) {
    if (board.some((tile) => tile === null)) return false;

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const index = row * SIZE + col;
        const tile = board[index];
        if (col < SIZE - 1 && tile.value === board[index + 1].value) return false;
        if (row < SIZE - 1 && tile.value === board[index + SIZE].value) return false;
      }
    }
    return true;
  }

  // has the board reached the 2048 tile?
  const hasWon = (board) => board.some((tile) => tile?.value === WIN_VALUE);

  //=============================================================
  //                          EXPORTS
  //=============================================================

  const rules = { SIZE, createBoard, addRandomTile, moveBoard, isGameOver, hasWon };
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else window.Game2048 = rules;
})();

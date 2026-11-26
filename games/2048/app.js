// app.js - 2048 page: drawing the board, keyboard controls, popups and score saving
// Author: Reachnid Group
// Centennial College - Fall 2026

// The rules live in rules.js (window.Game2048). The score is sent to the site with
// Arcade.submitScore when the game ends, or when a new game is started part-way through.

(function () {
  'use strict';

  //=============================================================
  //                           SETUP
  //=============================================================

  const { SIZE, createBoard, addRandomTile, moveBoard, isGameOver, hasWon } = window.Game2048;
  const $ = (id) => document.getElementById(id);

  // arrow keys and WASD
  const KEYS = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    a: 'left',
    d: 'right',
    w: 'up',
    s: 'down',
  };

  //=============================================================
  //                           STATE
  //=============================================================

  let board = createBoard();
  let score = 0;
  let best = readBest();
  let won = false;
  let keepPlaying = false;
  let over = false;
  let submitted = false; // this game's score has already been sent
  let newTileId = null;
  let mergedIds = [];

  //=============================================================
  //                          HELPERS
  //=============================================================

  // best score saved in this browser (0 when storage is blocked)
  function readBest() {
    try {
      return Number(localStorage.getItem('2048-best')) || 0;
    } catch {
      return 0;
    }
  }

  // remember the best score in this browser
  function saveBest() {
    try {
      localStorage.setItem('2048-best', best);
    } catch {
      // storage unavailable - the best score lasts for this visit only
    }
  }

  // send this game's score to the site once (guests get { ok: false } back, which is fine)
  function submitScore() {
    if (submitted || score === 0) return;
    submitted = true;
    Arcade.submitScore(score);
  }

  //=============================================================
  //                         RENDERING
  //=============================================================

  // draw the empty grid once
  function drawGrid() {
    const grid = $('emptyGrid');
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement('div');
      cell.className = 'empty-cell';
      grid.appendChild(cell);
    }
  }

  // draw the tiles, scores and popups from the current state
  function render() {
    // tiles are re-used by id so CSS can animate them sliding
    const layer = $('tiles');
    const existing = new Map([...layer.children].map((el) => [el.dataset.id, el]));
    const seen = new Set();

    board.forEach((tile, index) => {
      if (!tile) return;
      const id = String(tile.id);
      seen.add(id);

      let el = existing.get(id);
      if (!el) {
        el = document.createElement('div');
        el.dataset.id = id;
        el.innerHTML = '<div class="tile-value"></div>';
        layer.appendChild(el);
      }

      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      el.className = [
        'tile',
        `tile-${tile.value}`,
        tile.id === newTileId ? 'new-tile' : '',
        mergedIds.includes(tile.id) ? 'merged-tile' : '',
      ].join(' ');
      el.style.left = `calc(${col * 25}% + ${col * 2.5}px)`;
      el.style.top = `calc(${row * 25}% + ${row * 2.5}px)`;
      el.firstChild.textContent = tile.value;
    });

    // remove tiles that merged away
    for (const [id, el] of existing) if (!seen.has(id)) el.remove();

    // scores and popups
    $('score').textContent = score;
    $('best').textContent = best;
    $('finalScore').textContent = score;
    $('winMessage').hidden = !(won && !keepPlaying);
    $('gameOver').hidden = !over;
  }

  //=============================================================
  //                         GAME FLOW
  //=============================================================

  // start a fresh board (saves the old score first if it was never sent)
  function newGame() {
    submitScore();
    board = createBoard();
    score = 0;
    won = false;
    keepPlaying = false;
    over = false;
    submitted = false;
    newTileId = null;
    mergedIds = [];
    $('tiles').replaceChildren();
    render();
  }

  // slide the tiles one way, then add a new tile
  function handleMove(direction) {
    // no moves while a popup is open
    if (!$('howToPlay').hidden || over || (won && !keepPlaying)) return;

    const result = moveBoard(board, direction);
    if (!result.changed) return;

    const updated = addRandomTile(result.board);
    const newTile = updated.find(
      (tile) => tile && !result.board.some((old) => old?.id === tile.id),
    );

    // update the score and best score
    score += result.points;
    if (score > best) {
      best = score;
      saveBest();
    }

    newTileId = newTile?.id ?? null;
    mergedIds = result.mergedIds;
    board = updated;

    if (!won && hasWon(result.board)) won = true;
    over = isGameOver(board);
    if (over) submitScore();

    render();
  }

  //=============================================================
  //                           INPUT
  //=============================================================

  window.addEventListener('keydown', (event) => {
    const direction = KEYS[event.key];
    if (!direction) return;
    event.preventDefault();
    handleMove(direction);
  });

  $('newGame').addEventListener('click', newGame);
  $('tryAgain').addEventListener('click', newGame);
  $('keepPlaying').addEventListener('click', () => {
    keepPlaying = true;
    render();
  });
  $('startPlaying').addEventListener('click', () => {
    $('howToPlay').hidden = true;
  });

  //=============================================================
  //                           START
  //=============================================================

  drawGrid();
  render();
})();

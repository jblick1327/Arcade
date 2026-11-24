// snake.js - Snake game loop, drawing and controls
// Author: Reachnid Group
// Centennial College - Fall 2026

// The board is a 20 x 20 grid drawn on the canvas. Each apple is worth 10 points; hitting a wall
// or your own body ends the game and the score is sent to the site with Arcade.submitScore.

//=============================================================
//                          SETTINGS
//=============================================================

// canvas and grid size
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const tileSize = 20;
const tileCount = canvas.width / tileSize;

// how often the snake moves (ms) and how much an apple is worth
const STEP_MS = 120;
const APPLE_POINTS = 10;

// page elements
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore');
const statusElement = document.getElementById('gameStatus');
const playerElement = document.getElementById('player');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');

// keys -> direction
const KEYS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

//=============================================================
//                           STATE
//=============================================================

let snake;
let food;
let direction;
let nextDirection;
let score;
let highScore = readHighScore();
let gameLoop = null;
let isPlaying = false;

highScoreElement.textContent = highScore;

//=============================================================
//                          HELPERS
//=============================================================

// best score saved in this browser (0 when storage is blocked)
function readHighScore() {
  try {
    return Number(localStorage.getItem('snakeHighScore')) || 0;
  } catch {
    return 0;
  }
}

// remember the best score in this browser
function saveHighScore() {
  try {
    localStorage.setItem('snakeHighScore', highScore);
  } catch {
    // storage unavailable - the high score lasts for this visit only
  }
}

// pick a random empty square for the next apple
function generateFood() {
  let newFood;
  do {
    newFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount),
    };
  } while (snake.some((part) => part.x === newFood.x && part.y === newFood.y));
  return newFood;
}

//=============================================================
//                          DRAWING
//=============================================================

// draw the grid, the apple and the snake
function drawGame() {
  // background
  ctx.fillStyle = '#10182a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // grid lines
  ctx.strokeStyle = '#202d45';
  for (let i = 0; i <= tileCount; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tileSize, 0);
    ctx.lineTo(i * tileSize, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * tileSize);
    ctx.lineTo(canvas.width, i * tileSize);
    ctx.stroke();
  }

  // apple
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(food.x * tileSize + 2, food.y * tileSize + 2, tileSize - 4, tileSize - 4);

  // snake - the head is a lighter green
  snake.forEach((part, index) => {
    ctx.fillStyle = index === 0 ? '#a3ff48' : '#56d52f';
    ctx.fillRect(part.x * tileSize + 1, part.y * tileSize + 1, tileSize - 2, tileSize - 2);
  });
}

//=============================================================
//                         GAME FLOW
//=============================================================

// put the snake back in the middle with a score of 0
function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };

  score = 0;
  scoreElement.textContent = score;

  food = generateFood();
  drawGame();
}

// move the snake one square
function updateGame() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // when eating, the tail stays put, so the head may not land on it
  const eating = head.x === food.x && head.y === food.y;
  const body = eating ? snake : snake.slice(0, -1);

  // crash into a wall or into itself
  const hitWall = head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount;
  const hitSnake = body.some((part) => part.x === head.x && part.y === head.y);
  if (hitWall || hitSnake) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (eating) {
    // score the apple
    score += APPLE_POINTS;
    scoreElement.textContent = score;
    if (score > highScore) {
      highScore = score;
      highScoreElement.textContent = highScore;
      saveHighScore();
    }

    // the snake fills the whole board - you win
    if (snake.length === tileCount * tileCount) {
      endGame(true);
      return;
    }
    food = generateFood();
  } else {
    // not eating - drop the tail so the snake keeps its length
    snake.pop();
  }

  drawGame();
}

// start (or restart) a game
function startGame() {
  clearInterval(gameLoop);
  resetGame();
  isPlaying = true;
  statusElement.textContent = 'Game in progress!';
  gameLoop = setInterval(updateGame, STEP_MS);
}

// stop the game and send the score to the site
async function endGame(won = false) {
  clearInterval(gameLoop);
  gameLoop = null;
  isPlaying = false;
  drawGame();

  const message = won ? 'You win! You filled the board!' : `Game Over! Final Score: ${score}`;
  statusElement.textContent = message;

  // guests (and offline play) get { ok: false } back - the game carries on either way
  const r = await Arcade.submitScore(score);
  statusElement.textContent = r.ok ? `${message} (score saved)` : message;
}

//=============================================================
//                           INPUT
//=============================================================

// arrow keys / WASD steer - the snake can't turn straight back on itself
document.addEventListener('keydown', (event) => {
  const newDirection = KEYS[event.key];
  if (!newDirection || !isPlaying) return;
  event.preventDefault();
  if (newDirection.x === -direction.x && newDirection.y === -direction.y) return;
  nextDirection = newDirection;
});

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);

//=============================================================
//                           START
//=============================================================

// show who is playing (scores are only saved for logged-in players)
Arcade.ready().then(({ user }) => {
  playerElement.textContent = user
    ? `Playing as ${user.name}`
    : 'Playing as guest (score will not be saved)';
});

resetGame();

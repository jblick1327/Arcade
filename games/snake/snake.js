
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const tileSize = 20;
const tileCount = canvas.width / tileSize;

const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const statusElement = document.getElementById("gameStatus");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

let snake;
let food;
let direction;
let nextDirection;
let score;
let highScore = Number(localStorage.getItem("snakeHighScore")) || 0;
let gameLoop = null;
let isPlaying = false;

highScoreElement.textContent = highScore;

function resetGame() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 }
  ];

  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };

  score = 0;
  scoreElement.textContent = score;

  food = generateFood();
  drawGame();
}

function generateFood() {
  let newFood;

  do {
    newFood = {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  } while (snake.some(part => part.x === newFood.x && part.y === newFood.y));

  return newFood;
}

function drawGame() {
  ctx.fillStyle = "#10182a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#202d45";

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

  ctx.fillStyle = "#ef4444";
  ctx.fillRect(
    food.x * tileSize + 2,
    food.y * tileSize + 2,
    tileSize - 4,
    tileSize - 4
  );

  snake.forEach((part, index) => {
    ctx.fillStyle = index === 0 ? "#a3ff48" : "#56d52f";
    ctx.fillRect(
      part.x * tileSize + 1,
      part.y * tileSize + 1,
      tileSize - 2,
      tileSize - 2
    );
  });
}

function updateGame() {
  direction = nextDirection;

  const head = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  const eating = head.x === food.x && head.y === food.y;
  const body = eating ? snake : snake.slice(0, -1);

  const hitWall =
    head.x < 0 ||
    head.x >= tileCount ||
    head.y < 0 ||
    head.y >= tileCount;

  const hitSnake = body.some(
    part => part.x === head.x && part.y === head.y
  );

  if (hitWall || hitSnake) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (eating) {
    score += 10;
    scoreElement.textContent = score;

    if (score > highScore) {
      highScore = score;
      highScoreElement.textContent = highScore;
      localStorage.setItem("snakeHighScore", highScore);
    }

    if (snake.length === tileCount * tileCount) {
      endGame(true);
      return;
    }

    food = generateFood();
  } else {
    snake.pop();
  }

  drawGame();
}

function startGame() {
  clearInterval(gameLoop);
  resetGame();

  isPlaying = true;
  statusElement.textContent = "Game in progress!";

  gameLoop = setInterval(updateGame, 120);
}

function endGame(won = false) {
  clearInterval(gameLoop);
  gameLoop = null;
  isPlaying = false;

  drawGame();
  statusElement.textContent = won
    ? "You win! You filled the board!"
    : `Game Over! Final Score: ${score}`;
}

document.addEventListener("keydown", event => {
  const keys = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    d: { x: 1, y: 0 }
  };

  const newDirection = keys[event.key];

  if (!newDirection || !isPlaying) return;

  event.preventDefault();

  if (
    newDirection.x === -direction.x &&
    newDirection.y === -direction.y
  ) {
    return;
  }

  nextDirection = newDirection;
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

resetGame();

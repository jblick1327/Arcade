
import { useState, useEffect, useCallback } from "react";
import "./App.css";

let nextTileId = 1;

function createBoard() {
  nextTileId = 1;
  let board = Array(16).fill(null);

  board = addRandomTile(board);
  board = addRandomTile(board);

  return board;
}

function addRandomTile(board) {
  const emptyCells = board
    .map((tile, index) => tile === null ? index : null)
    .filter(index => index !== null);

  if (emptyCells.length === 0) return board;

  const randomIndex =
    emptyCells[Math.floor(Math.random() * emptyCells.length)];

  const newBoard = [...board];

  newBoard[randomIndex] = {
    id: nextTileId++,
    value: Math.random() < 0.9 ? 2 : 4
  };

  return newBoard;
}

function getLineIndices(direction, line) {
  const indices = [];

  for (let i = 0; i < 4; i++) {
    if (direction === "left") indices.push(line * 4 + i);
    if (direction === "right") indices.push(line * 4 + (3 - i));
    if (direction === "up") indices.push(i * 4 + line);
    if (direction === "down") indices.push((3 - i) * 4 + line);
  }

  return indices;
}

function moveBoard(board, direction) {
  const newBoard = [...board];
  let points = 0;
  let changed = false;
  const mergedIds = [];

  for (let line = 0; line < 4; line++) {
    const indices = getLineIndices(direction, line);

    const tiles = indices
      .map(index => newBoard[index])
      .filter(tile => tile !== null);

    const mergedTiles = [];

    for (let i = 0; i < tiles.length; i++) {
      if (
        i < tiles.length - 1 &&
        tiles[i].value === tiles[i + 1].value
      ) {
        const mergedTile = {
          id: tiles[i].id,
          value: tiles[i].value * 2
        };

        mergedTiles.push(mergedTile);
        mergedIds.push(mergedTile.id);

        points += mergedTile.value;
        i++;
      } else {
        mergedTiles.push(tiles[i]);
      }
    }

    while (mergedTiles.length < 4) {
      mergedTiles.push(null);
    }

    indices.forEach((index, position) => {
      if (newBoard[index]?.id !== mergedTiles[position]?.id) {
        changed = true;
      }

      newBoard[index] = mergedTiles[position];
    });
  }

  return {
    board: newBoard,
    points,
    changed,
    mergedIds
  };
}

function isGameOver(board) {
  if (board.some(tile => tile === null)) return false;

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const index = row * 4 + col;
      const tile = board[index];

      if (col < 3 && tile.value === board[index + 1].value) {
        return false;
      }

      if (row < 3 && tile.value === board[index + 4].value) {
        return false;
      }
    }
  }

  return true;
}

function App() {
  const [board, setBoard] = useState(createBoard);

  const [score, setScore] = useState(0);

  const [best, setBest] = useState(
    () => Number(localStorage.getItem("2048-best")) || 0
  );

  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [over, setOver] = useState(false);

  const [newTileId, setNewTileId] = useState(null);
  const [mergedIds, setMergedIds] = useState([]);

  // Show How to Play automatically when the game opens
  const [showInstructions, setShowInstructions] = useState(true);

  const newGame = useCallback(() => {
    setBoard(createBoard());
    setScore(0);
    setWon(false);
    setKeepPlaying(false);
    setOver(false);
    setNewTileId(null);
    setMergedIds([]);
  }, []);

  const handleMove = useCallback((direction) => {
    // Prevent movement while instructions are open
    if (showInstructions || over || (won && !keepPlaying)) return;

    setBoard(currentBoard => {
      const result = moveBoard(currentBoard, direction);

      if (!result.changed) return currentBoard;

      let updatedBoard = addRandomTile(result.board);

      const newTile = updatedBoard.find(
        tile => tile && !result.board.some(
          oldTile => oldTile?.id === tile.id
        )
      );

      setScore(currentScore => {
        const updatedScore = currentScore + result.points;

        setBest(currentBest => {
          const updatedBest = Math.max(currentBest, updatedScore);
          localStorage.setItem("2048-best", updatedBest);
          return updatedBest;
        });

        return updatedScore;
      });

      setNewTileId(newTile?.id ?? null);
      setMergedIds(result.mergedIds);

      if (!won && result.board.some(
        tile => tile?.value === 2048
      )) {
        setWon(true);
      }

      setOver(isGameOver(updatedBoard));

      return updatedBoard;
    });
  }, [over, won, keepPlaying, showInstructions]);

  useEffect(() => {
    function handleKeyDown(event) {
      const keyMap = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down"
      };

      const direction = keyMap[event.key];

      if (direction) {
        event.preventDefault();
        handleMove(direction);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMove]);

  return (
    <div className="app">
      <div className="game-container">

        {/* GAME HEADER */}

        <header className="game-header">
          <div>
            <h1>2048</h1>
            <p>Join the numbers. Reach the 2048 tile!</p>
          </div>

          <button className="new-game-button" onClick={newGame}>
            New Game
          </button>
        </header>

        {/* SCORE AND BEST */}

        <div className="score-container">
          <div className="score-box">
            <span>SCORE</span>
            <strong>{score}</strong>
          </div>

          <div className="score-box">
            <span>BEST</span>
            <strong>{best}</strong>
          </div>
        </div>

        {/* WIN MESSAGE */}

        {won && !keepPlaying && (
          <div className="win-message">
            <h2>You reached 2048!</h2>
            <button onClick={() => setKeepPlaying(true)}>
              Keep Playing
            </button>
          </div>
        )}

        {/* GAME BOARD */}

        <div className="game-board">
          <div className="game-board-inner">

            <div className="empty-grid">
              {Array.from({ length: 16 }).map((_, index) => (
                <div className="empty-cell" key={index}></div>
              ))}
            </div>

            {board.map((tile, index) => {
              if (!tile) return null;

              const row = Math.floor(index / 4);
              const col = index % 4;

              const tileClasses = [
                "tile",
                `tile-${tile.value}`,
                tile.id === newTileId ? "new-tile" : "",
                mergedIds.includes(tile.id) ? "merged-tile" : ""
              ].join(" ");

              return (
                <div
                  key={tile.id}
                  className={tileClasses}
                  style={{
                    left: `calc(${col * 25}% + ${col * 2.5}px)`,
                    top: `calc(${row * 25}% + ${row * 2.5}px)`,
                    width: "calc(25% - 7.5px)",
                    height: "calc(25% - 7.5px)"
                  }}
                >
                  <div className="tile-value">
                    {tile.value}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* INSTRUCTIONS */}

        <div className="instructions">
          <p>
            <strong>How to play:</strong> Use your arrow keys or WASD
            to move the tiles.
          </p>
          <p>Combine matching numbers to reach 2048!</p>
        </div>

      </div>

      {/* HOW TO PLAY POPUP */}

      {showInstructions && (
        <div className="game-overlay">
          <div className="how-to-play-popup">

            <h2>HOW TO PLAY</h2>

            <p>
              Welcome to 2048! Your goal is to combine numbers
              until you reach the 2048 tile.
            </p>

            <div className="how-to-play-details">

              <p>
                <strong>1. Move Your Tiles</strong>
                <br />
                Use your arrow keys or WASD to move tiles around.
              </p>

              <p>
                <strong>2. Combine Numbers</strong>
                <br />
                Match two tiles with the same number to combine them.
              </p>

              <p>
                <strong>3. Reach 2048</strong>
                <br />
                Keep combining numbers until you create the 2048 tile!
              </p>

              <p>
                <strong>4. Don't Fill the Board</strong>
                <br />
                If there are no empty spaces or matching neighbours,
                the game is over.
              </p>

            </div>

            <button onClick={() => setShowInstructions(false)}>
              Got It, Let's Play!
            </button>

          </div>
        </div>
      )}

      {/* GAME OVER POPUP */}

      {over && (
        <div className="game-overlay">
          <div className="game-over-popup">

            <div className="game-over-icon">!</div>

            <h2>GAME OVER</h2>

            <p>No more moves available.</p>

            <div className="final-score">
              <span>YOUR FINAL SCORE</span>
              <strong>{score}</strong>
            </div>

            <button onClick={newGame}>
              Try Again
            </button>

          </div>
        </div>
      )}

    </div>
  );
}

export default App;

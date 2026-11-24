import { setupPage } from './shared.js';

const games = [
  { name: 'Snake', type: 'Arcade', img: '/games/snake.svg', description: 'Collect apples, grow longer, and avoid the walls.' },
  { name: 'Tetris', type: 'Puzzle', img: '/games/tetris.svg', description: 'Stack the falling blocks and clear lines.' },
  { name: 'Pong', type: 'Classic', img: '/games/pong.svg', description: 'Keep the ball in play and outscore your opponent.' },
  { name: 'Breakout', type: 'Arcade', img: '/games/breakout.svg', description: 'Bounce the ball to clear all the colorful bricks.' },
  { name: 'Flappy Bird', type: 'Skill', img: '/games/flappy.svg', description: 'Time your jumps and fly between the pipes.' }
];
const root = setupPage('games');
root.innerHTML = `
  <section class="page-intro">
    <span class="eyebrow">REACHNID / COLLECTION</span>
    <h1>Games</h1>
    <p>Pick a classic, discover a favorite, and get ready to play.</p>
  </section>
  <section class="content-panel game-panel">
    <div class="panel-heading"><div><h2>All Games</h2><p>Five arcade classics</p></div><span class="panel-tag">5 games</span></div>
    <div class="games-grid">${games.map((game, i) => `
      <article class="game-card">
        <img class="game-art" src="${game.img}" alt="${game.name} pixel-art preview">
        <div class="game-details"><span class="game-type">${game.type}</span><h3>${game.name}</h3><p>${game.description}</p><button type="button" class="game-button" data-game="${i}">View Game</button></div>
      </article>`).join('')}</div>
  </section>
  <dialog class="game-dialog" id="gameDialog" aria-labelledby="dialogTitle">
    <form method="dialog"><button class="close-dialog" aria-label="Close" type="submit">×</button></form>
    <img id="dialogArt" alt="" class="dialog-art"><span class="eyebrow" id="dialogType"></span>
    <h2 id="dialogTitle"></h2><p id="dialogDescription"></p><p class="dialog-notice">Game launch is not connected yet. This is a UI preview.</p>
    <form method="dialog"><button class="game-button" type="submit">Back to Games</button></form>
  </dialog>
`;
const dialog = document.querySelector('#gameDialog');
document.querySelectorAll('[data-game]').forEach(button => {
  button.addEventListener('click', () => {
    const game = games[Number(button.dataset.game)];
    document.querySelector('#dialogArt').src = game.img;
    document.querySelector('#dialogArt').alt = `${game.name} preview`;
    document.querySelector('#dialogType').textContent = game.type;
    document.querySelector('#dialogTitle').textContent = game.name;
    document.querySelector('#dialogDescription').textContent = game.description;
    dialog.showModal();
  });
});

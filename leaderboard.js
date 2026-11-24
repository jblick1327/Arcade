import { setupPage } from './shared.js';

const players = [
  { name: 'Daren', score: 12450 },
  { name: 'Adrian', score: 10320 },
  { name: 'Ahmed', score: 8970 },
  { name: 'Lex', score: 7860 },
  { name: 'James', score: 6540 }
];

const root = setupPage('leaderboard');
root.innerHTML = `
  <section class="page-intro">
    <span class="eyebrow">REACHNID / COMMUNITY</span>
    <h1>Leaderboard</h1>
    <p>See who's at the top and challenge yourself to climb the rankings.</p>
  </section>
  <section class="content-panel leaderboard-panel" aria-label="Leaderboard rankings">
    <div class="panel-heading"><div><h2>Top Players</h2><p>Sample rankings for the website design</p></div><span class="panel-tag">All Games</span></div>
    <div class="table-scroll"><table class="score-table">
      <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col" class="numeric">Total Score</th></tr></thead>
      <tbody>${players.map((player, i) => `
        <tr><td><span class="rank-pill ${i === 0 ? 'first' : ''}">${i + 1}</span></td><td><span class="player-cell"><span class="player-avatar">${player.name[0]}</span><strong>${player.name}</strong></span></td><td class="numeric score-value">${player.score.toLocaleString('en-CA')}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>
  <p class="page-footnote">Scores are mock data for the UI and are not yet connected to live game results.</p>
`;

// Leaderboard.jsx - leaderboard page with the top players for each game
// Author: Reachnid Group
// Centennial College - Fall 2026

// Score games rank each player's best score; online match games rank players by wins.

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks
import { useEffect, useState } from 'react';

// import the API helper
import { api } from '../utils/api.js';

//=============================================================
//                          SETTINGS
//=============================================================

// how many players to show
const LIMIT = 10;

//=============================================================
//                         COMPONENT
//=============================================================

// leaderboard page - pick a game, see its top players
const Leaderboard = () => {
  const [games, setGames] = useState(null); // null = still loading
  const [slug, setSlug] = useState('');
  const [rows, setRows] = useState(null); // null = still loading

  // load the game list, then show the first game
  useEffect(() => {
    api('GET', '/games').then((r) => {
      const list = r.status === 200 ? r.data : [];
      setGames(list);
      if (list.length) setSlug(list[0].slug);
    });
  }, []);

  // load the chosen game's leaderboard
  useEffect(() => {
    if (!slug) return;
    setRows(null);
    api('GET', `/games/${slug}/leaderboard?limit=${LIMIT}`).then((r) =>
      setRows(r.status === 200 ? r.data : []),
    );
  }, [slug]);

  const game = games?.find((g) => g.slug === slug);
  const scoreLabel = game?.mode === 'match' ? 'Wins' : 'Best Score';

  return (
    <main className="page-main">
      {/* heading */}
      <section className="page-intro">
        <span className="eyebrow">REACHNID / COMMUNITY</span>
        <h1>Leaderboard</h1>
        <p>See who&apos;s at the top and challenge yourself to climb the rankings.</p>
      </section>

      <section className="content-panel leaderboard-panel" aria-label="Leaderboard rankings">
        <div className="panel-heading">
          <div>
            <h2>Top Players</h2>
            <p>The top {LIMIT} for each game</p>
          </div>

          {/* game picker */}
          {games && games.length > 0 && (
            <select
              className="panel-select"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              aria-label="Game"
            >
              {games.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* rankings */}
        {games !== null && games.length === 0 ? (
          <p>No games yet.</p>
        ) : rows === null ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p>No scores yet - be the first!</p>
        ) : (
          <div className="table-scroll">
            <table className="score-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  <th scope="col" className="numeric">
                    {scoreLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span className={`rank-pill ${i === 0 ? 'first' : ''}`}>{i + 1}</span>
                    </td>
                    <td>
                      <span className="player-cell">
                        <span className="player-avatar">{(row.name || '?')[0]}</span>
                        <strong>{row.name || '?'}</strong>
                      </span>
                    </td>
                    <td className="numeric score-value">{row.score.toLocaleString('en-CA')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Leaderboard;

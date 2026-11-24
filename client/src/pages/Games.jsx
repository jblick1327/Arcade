// Games.jsx - games page that shows every game as a card
// Author: Reachnid Group
// Centennial College - Fall 2026

// URL: /play (each card links to /play/<slug>). The list comes from GET /api/games, so a new
// game folder shows up here without any client changes.

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// import the API helper
import { api } from '../utils/api.js';

//=============================================================
//                          HELPERS
//=============================================================

// short label for the card - online match games vs score games
const gameType = (g) =>
  g.mode === 'match' ? `Online · ${g.maxPlayers === 4 ? '4' : '2'} players` : 'Single player';

//=============================================================
//                         COMPONENT
//=============================================================

// games page - with ?dev=1 in a dev build, links keep the flag so dev helpers stay on
const Games = () => {
  const [params] = useSearchParams();
  const showDev = import.meta.env.DEV && params.get('dev') === '1';
  const [games, setGames] = useState(null); // null = still loading

  // load the game list once
  useEffect(() => {
    api('GET', '/games').then((r) => setGames(r.status === 200 ? r.data : []));
  }, []);

  return (
    <main className="page-main">
      {/* heading */}
      <section className="page-intro">
        <span className="eyebrow">REACHNID / COLLECTION</span>
        <h1>Games</h1>
        <p>Pick a classic, discover a favourite, and get ready to play.</p>
      </section>

      <section className="content-panel game-panel">
        <div className="panel-heading">
          <div>
            <h2>All Games</h2>
            <p>Made by the REACHNID team</p>
          </div>
          {games && <span className="panel-tag">{games.length} games</span>}
        </div>

        {/* one card per game */}
        {games === null ? (
          <p>Loading…</p>
        ) : (
          <div className="games-grid">
            {games.map((g) => (
              <article className="game-card" key={g.slug}>
                {g.thumbnail ? (
                  <img className="game-art" src={g.thumbnail} alt={`${g.title} preview`} />
                ) : (
                  <div className="game-art game-art-blank" aria-hidden="true">
                    {g.title[0]}
                  </div>
                )}
                <div className="game-details">
                  <span className="game-type">{gameType(g)}</span>
                  <h3>{g.title}</h3>
                  <p>{g.description}</p>
                  <Link className="game-button" to={`/play/${g.slug}${showDev ? '?dev=1' : ''}`}>
                    Play
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Games;

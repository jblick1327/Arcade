// Home.jsx - home page that lists every game
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// import the API helper
import { api } from '../api.js';

//=============================================================
//                         COMPONENT
//=============================================================

// list of games - with ?dev=1 in a dev build, links keep the flag so dev helpers stay on
const Home = () => {
  const [params] = useSearchParams();
  const showDev = import.meta.env.DEV && params.get('dev') === '1';
  const [games, setGames] = useState(null); // null = still loading

  // load the game list once
  useEffect(() => {
    api('GET', '/games').then((r) => setGames(r.status === 200 ? r.data : []));
  }, []);

  return (
    <main>
      <h1>Arcade</h1>
      {games === null ? (
        <p>Loading…</p>
      ) : (
        <ul className="game-list">
          {games.map((g) => (
            <li key={g.slug}>
              <Link to={`/play/${g.slug}${showDev ? '?dev=1' : ''}`}>{g.title}</Link>
              <p>{g.description}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Home;

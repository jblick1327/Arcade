import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function Home() {
  const [params] = useSearchParams();
  const showDev = import.meta.env.DEV && params.get('dev') === '1';
  const [games, setGames] = useState(null);

  useEffect(() => {
    api('GET', '/games').then((r) => setGames(r.status === 200 ? r.data : []));
  }, []);

  return (
    <main>
      <h1>Arcade</h1>
      {games === null ? <p>Loading…</p> : (
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
}

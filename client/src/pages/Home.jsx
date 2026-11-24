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
          {games.map((g) => {
            const to = `/play/${g.slug}${showDev ? '?dev=1' : ''}`;
            return (
              <li key={g.slug} className={g.thumbnail ? 'has-thumb' : undefined}>
                {g.thumbnail && (
                  <Link to={to} tabIndex={-1} aria-hidden="true">
                    <img className="game-thumb" src={g.thumbnail} alt="" />
                  </Link>
                )}
                <div>
                  <Link to={to}>{g.title}</Link>
                  <p>{g.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

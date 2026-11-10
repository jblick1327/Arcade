import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Home() {
  const [games, setGames] = useState(null);

  useEffect(() => {
    api('GET', '/games').then((r) => setGames(r.status === 200 ? r.data : []));
  }, []);

  return (
    <main>
      <h1>Arcade</h1>
      {games === null ? <p>Loading…</p> : (
        <ul>
          {games.map((g) => (
            <li key={g.slug}>
              <Link to={`/play/${g.slug}`}>{g.title}</Link> {g.description}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

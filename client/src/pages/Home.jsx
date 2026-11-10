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
      {showDev && games && (
        <details open>
          <summary>Dev shortcuts</summary>
          <ul>
            {games.filter(({ slug }) => slug === 'automate' || slug === 'scarab-21').map(({ slug, title }) => (
              <li key={slug}>
                {title}{' · '}
                <Link to={`/play/${slug}?dev=1`}>Arcade play page</Link>{' · '}
                <a href={`/games/${slug}/`}>Open standalone</a>
              </li>
            ))}
          </ul>
          <Link to="/">Hide dev shortcuts</Link>
        </details>
      )}
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

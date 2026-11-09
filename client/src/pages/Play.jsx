import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { attachBridge } from '../bridge.js';

function statusLine(m) {
  if (m.status === 'waiting') return `Waiting for an opponent. Send them this link: ${window.location.href}`;
  const [a, b] = m.players.map((p) => p.name);
  if (m.status === 'done') return `${a} vs ${b} — ${m.winner === null ? 'draw' : m.players[m.winner].name + ' won'}`;
  return `${a} vs ${b} — in progress`;
}

export default function Play({ user }) {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get('match');

  const [game, setGame] = useState(null); // null = loading, false = not found
  const [board, setBoard] = useState([]);
  const [match, setMatch] = useState(null);
  const [lobby, setLobby] = useState([]);
  const iframeRef = useRef(null);

  useEffect(() => {
    setGame(null);
    api('GET', `/games/${slug}`).then((r) => setGame(r.status === 200 ? r.data : false));
  }, [slug]);

  const loadBoard = useCallback(async () => {
    const r = await api('GET', `/games/${slug}/leaderboard?limit=10`);
    if (r.status === 200) setBoard(r.data);
  }, [slug]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    setMatch(null);
    if (!game || !iframeRef.current) return undefined;
    return attachBridge(iframeRef.current, { slug, user, matchId, onScore: loadBoard, onMatch: setMatch });
  }, [game, slug, user?.id, matchId, loadBoard]);

  const isMatchGame = game && game.mode === 'match';

  const loadLobby = useCallback(async () => {
    const r = await api('GET', `/games/${slug}/matches`);
    if (r.status === 200) setLobby(r.data);
  }, [slug]);

  useEffect(() => {
    if (!isMatchGame || matchId) return undefined;
    loadLobby();
    const t = setInterval(loadLobby, 5000);
    return () => clearInterval(t);
  }, [isMatchGame, matchId, loadLobby, user?.id]);

  async function newMatch() {
    const r = await api('POST', `/games/${slug}/matches`);
    if (r.status === 201) navigate(`?match=${r.data.id}`);
  }

  async function join(id) {
    const r = await api('POST', `/matches/${id}/join`);
    if (r.status === 200) {
      if (id === matchId) setMatch(r.data);
      else navigate(`?match=${id}`);
    } else {
      loadLobby();
    }
  }

  if (game === null) return <p>Loading…</p>;
  if (game === false) return <p>Game not found</p>;

  const inMatch = match && match.you !== null;

  return (
    <main>
      <h1>{game.title}</h1>

      {isMatchGame && !matchId && (
        <section>
          {user ? <p><button type="button" onClick={newMatch}>New online match</button></p>
            : <p>Log in to play online</p>}
          <ul>
            {lobby.map((m) => (
              <li key={m.id}>
                {m.players[0].name}{' '}
                {user && (m.you !== null
                  ? <button type="button" onClick={() => navigate(`?match=${m.id}`)}>Resume</button>
                  : <button type="button" onClick={() => join(m.id)}>Join</button>)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isMatchGame && matchId && (
        <section>
          <p>{match ? statusLine(match) : 'Loading match…'}</p>
          {user && match && !inMatch && match.status === 'waiting' && (
            <p><button type="button" onClick={() => join(matchId)}>Join this match</button></p>
          )}
          <p><Link to={`/play/${slug}`}>Leave</Link></p>
        </section>
      )}

      <iframe
        ref={iframeRef}
        key={slug + ':' + (matchId || 'local')}
        src={`/games/${slug}/`}
        width={game.width}
        height={game.height}
        title={game.title}
      />

      {!user && <p>Log in to save your score.</p>}

      <h2>Leaderboard</h2>
      <table>
        <thead><tr><th>Rank</th><th>Name</th><th>Score</th></tr></thead>
        <tbody>
          {board.map((row, i) => (
            <tr key={i}><td>{i + 1}</td><td>{row.name}</td><td>{row.score}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

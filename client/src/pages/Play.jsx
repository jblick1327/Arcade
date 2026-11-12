import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { attachBridge } from '../bridge.js';

function inviteUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('dev')) url.searchParams.delete('dev');
  return url.href;
}

function statusLine(m, showDev, maxPlayers) {
  const link = showDev ? inviteUrl() : window.location.href;
  if (m.status === 'waiting') return maxPlayers === 4
    ? `Waiting for players (${m.players.length}/4). Send them this link: ${link}`
    : `Waiting for an opponent. Send them this link: ${link}`;
  const players = m.players.map((p) => p.name).join(' vs ');
  if (m.status === 'done') return `${players} — ${m.winner === null ? 'draw' : m.players[m.winner].name + ' won'}`;
  return `${players} — in progress`;
}

/** An active Automate match whose legacy draft the current rules cannot continue. */
const needsRestart = (m) => m?.game === 'automate' && m.status === 'active' && !!m.state?.restartRequired;

function CopyInvite() {
  const [status, setStatus] = useState('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl());
      setStatus('Invite copied.');
    } catch {
      setStatus('Copy the link shown above.');
    }
  }

  return <p><button type="button" onClick={copy}>Copy invite link</button>{' '}<span role="status">{status}</span></p>;
}

export default function Play({ user }) {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get('match');
  const showDev = import.meta.env.DEV && params.get('dev') === '1';
  const showAutomateDev = showDev && slug === 'automate';

  const [game, setGame] = useState(null); // null = loading, false = not found
  const [board, setBoard] = useState([]);
  const [match, setMatch] = useState(null);
  const [lobby, setLobby] = useState([]);
  const [reloadCount, setReloadCount] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState('');
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

  // A restart error belongs to the view it happened in.
  useEffect(() => { setRestartError(''); }, [slug, matchId]);

  useEffect(() => {
    setMatch(null);
    if (!game || !iframeRef.current) return undefined;
    return attachBridge(iframeRef.current, { slug, user, matchId, onScore: loadBoard, onMatch: setMatch });
  }, [game, slug, user?.id, matchId, loadBoard, reloadCount]);

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

  function openMatch(id) {
    const search = new URLSearchParams({ match: id });
    if (showDev) search.set('dev', '1');
    navigate(`?${search}`);
  }

  async function newMatch() {
    const r = await api('POST', `/games/${slug}/matches`);
    if (r.status === 201) openMatch(r.data.id);
  }

  async function join(id) {
    const r = await api('POST', `/matches/${id}/join`);
    if (r.status === 200) {
      if (id === matchId) setMatch(r.data);
      else openMatch(id);
    } else {
      loadLobby();
    }
  }

  async function restartDraft(m) {
    if (!window.confirm('Restart this incompatible Automate draft for both players? All placed pieces will be cleared.')) return;
    setRestartError('');
    setRestarting(true);
    const r = await api('POST', `/matches/${m.id}/restart-draft`, { version: m.version });
    setRestarting(false);
    if (r.status === 200) {
      if (matchId === m.id) setMatch(r.data);
      else loadLobby();
    } else {
      if (r.data?.match && matchId === m.id) setMatch(r.data.match);
      if (!matchId) loadLobby();
      // If the other player already restarted it, the refreshed match is the success case.
      if (!(r.data?.match && !needsRestart(r.data.match))) {
        setRestartError(r.data?.error || 'Could not restart the draft. Please try again.');
      }
    }
  }

  if (game === null) return <p>Loading…</p>;
  if (game === false) return <p>Game not found</p>;

  const inMatch = match && match.you !== null;

  return (
    <main>
      <h1>{game.title}</h1>
      {restartError && <p role="alert">{restartError}</p>}

      {isMatchGame && !matchId && (
        <section>
          {user ? <p><button type="button" onClick={newMatch}>New online match</button></p>
            : <p>Log in to play online</p>}
          <ul>
            {lobby.map((m) => (
              <li key={m.id}>
                {m.players[0].name}{game.maxPlayers === 4 ? ` (${m.players.length}/4 players)` : ''}{' '}
                {needsRestart(m) && <span>Draft needs restart. </span>}
                {user && (m.you !== null
                  ? needsRestart(m)
                    ? <button type="button" disabled={restarting} onClick={() => restartDraft(m)}>Restart draft</button>
                    : <button type="button" onClick={() => openMatch(m.id)}>Resume</button>
                  : <button type="button" onClick={() => join(m.id)}>Join</button>)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isMatchGame && matchId && (
        <section>
          <p>{match ? statusLine(match, showAutomateDev, game.maxPlayers) : 'Loading match…'}</p>
          {needsRestart(match) && (
            <p>This saved draft cannot continue under the new placement rules.{' '}
              {inMatch
                ? <button type="button" disabled={restarting} onClick={() => restartDraft(match)}>Restart draft for both players</button>
                : 'Either player can restart the draft.'}
            </p>
          )}
          {showAutomateDev && inMatch && match.status === 'waiting' && <CopyInvite key={matchId} />}
          {user && match && !inMatch && match.status === 'waiting' && (
            <p><button type="button" onClick={() => join(matchId)}>Join this match</button></p>
          )}
          <p><Link to={`/play/${slug}${showDev ? '?dev=1' : ''}`}>Leave</Link></p>
        </section>
      )}

      {showDev && <p><button type="button" onClick={() => setReloadCount((n) => n + 1)}>Reload game iframe</button></p>}

      <iframe
        ref={iframeRef}
        key={slug + ':' + (matchId || 'local') + ':' + reloadCount}
        src={`/games/${slug}/`}
        width={game.width}
        height={game.height}
        title={game.title}
        className="game-frame"
        style={{ aspectRatio: `${game.width} / ${game.height}` }}
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

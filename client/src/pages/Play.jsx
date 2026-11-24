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

/** Buttons for the named actions a game's server hook currently offers on a match. */
function ActionButtons({ m, busy, onRun }) {
  return (m?.actions || []).map((a) => (
    <button key={a.name} type="button" disabled={busy} onClick={() => onRun(m, a)}>{a.label}</button>
  ));
}

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

  const [game, setGame] = useState(null); // null = loading, false = not found
  const [board, setBoard] = useState([]);
  const [match, setMatch] = useState(null);
  const [lobby, setLobby] = useState([]);
  const [reloadCount, setReloadCount] = useState(0);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
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

  // An action error belongs to the view it happened in.
  useEffect(() => { setActionError(''); setCancelError(''); }, [slug, matchId]);

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

  async function runAction(m, action) {
    if (action.confirm && !window.confirm(action.confirm)) return;
    setActionError('');
    setActing(true);
    const r = await api('POST', `/matches/${m.id}/actions/${action.name}`, { version: m.version });
    setActing(false);
    if (r.status === 200) {
      if (matchId === m.id) setMatch(r.data);
      else loadLobby();
    } else {
      if (r.data?.match && matchId === m.id) setMatch(r.data.match);
      if (!matchId) loadLobby();
      // If the other player already ran it, the refreshed match no longer offers it: that is success.
      if (!(r.data?.match && !r.data.match.actions?.some((a) => a.name === action.name))) {
        setActionError(r.data?.error || 'Could not complete that action. Please try again.');
      }
    }
  }

  async function cancelMatch(m) {
    if (!window.confirm('Cancel this waiting match?')) return;
    setCancelError('');
    setCancelling(true);
    const r = await api('DELETE', `/matches/${m.id}`);
    setCancelling(false);
    if (r.status === 204) {
      navigate(`/play/${slug}${showDev ? '?dev=1' : ''}`);
    } else {
      setCancelError(r.data?.error || 'Could not cancel match. Please try again.');
    }
  }

  if (game === null) return <p>Loading…</p>;
  if (game === false) return <p>Game not found</p>;

  const inMatch = match && match.you !== null;
  const canCancel = user && match?.status === 'waiting'
    && match.players.length === 1 && match.players[0].id === user.id;

  return (
    <main>
      <h1>{game.title}</h1>
      {actionError && <p role="alert">{actionError}</p>}
      {cancelError && <p role="alert">{cancelError}</p>}

      {isMatchGame && !matchId && (
        <section>
          {user ? <p><button type="button" onClick={newMatch}>New online match</button></p>
            : <p>Log in to play online</p>}
          <ul>
            {lobby.map((m) => (
              <li key={m.id}>
                {m.players[0].name}{game.maxPlayers === 4 ? ` (${m.players.length}/4 players)` : ''}{' '}
                {m.blocked && <span>{m.blocked} </span>}
                {user && (m.you !== null
                  ? m.blocked
                    ? <ActionButtons m={m} busy={acting} onRun={runAction} />
                    : <button type="button" onClick={() => openMatch(m.id)}>Resume</button>
                  : <button type="button" onClick={() => join(m.id)}>Join</button>)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isMatchGame && matchId && (
        <section>
          <p>{match ? statusLine(match, showDev, game.maxPlayers) : 'Loading match…'}</p>
          {match?.blocked && <p>{match.blocked}</p>}
          {match?.actions?.length > 0 && <p><ActionButtons m={match} busy={acting} onRun={runAction} /></p>}
          {showDev && inMatch && match.status === 'waiting' && <CopyInvite key={matchId} />}
          {user && match && !inMatch && match.status === 'waiting' && (
            <p><button type="button" onClick={() => join(matchId)}>Join this match</button></p>
          )}
          {canCancel && (
            <p><button type="button" disabled={cancelling} onClick={() => cancelMatch(match)}>Cancel match</button></p>
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

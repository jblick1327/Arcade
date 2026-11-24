// Play.jsx - play page with the game iframe, leaderboard and match lobby
// Author: Reachnid Group
// Centennial College - Fall 2026

// URL: /play/:slug[?match=<id>][&dev=1]
//   match  open that online match instead of the lobby / local play
//   dev    (dev builds only) show developer helpers such as "Reload game iframe"

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

// import the API helper & the SDK bridge
import { api } from '../api.js';
import { attachBridge } from '../bridge.js';

//=============================================================
//                          SETTINGS
//=============================================================

const LEADERBOARD_SIZE = 10;
const LOBBY_POLL_MS = 5000;

//=============================================================
//                          HELPERS
//=============================================================

// the current page URL without the dev flag, safe to send to another player
function inviteUrl() {
  const url = new URL(window.location.href);
  if (url.searchParams.has('dev')) url.searchParams.delete('dev');
  return url.href;
}

// one-line description of a match: who is playing and how it stands
function statusLine(m, showDev, maxPlayers) {
  const link = showDev ? inviteUrl() : window.location.href;
  if (m.status === 'waiting')
    return maxPlayers === 4
      ? `Waiting for players (${m.players.length}/4). Send them this link: ${link}`
      : `Waiting for an opponent. Send them this link: ${link}`;
  const players = m.players.map((p) => p.name).join(' vs ');
  if (m.status === 'done')
    return `${players} — ${m.winner === null ? 'draw' : m.players[m.winner].name + ' won'}`;
  return `${players} — in progress`;
}

// an active Automate match whose legacy draft the current rules cannot continue
const needsRestart = (m) =>
  m?.game === 'automate' && m.status === 'active' && !!m.state?.restartRequired;

// button that copies the invite link to the clipboard
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

  return (
    <p>
      <button type="button" onClick={copy}>
        Copy invite link
      </button>{' '}
      <span role="status">{status}</span>
    </p>
  );
}

//=============================================================
//                         COMPONENT
//=============================================================

// the game page - `user` is the signed-in user, or null for guests
const Play = ({ user }) => {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchId = params.get('match');
  const showDev = import.meta.env.DEV && params.get('dev') === '1';
  const showAutomateDev = showDev && slug === 'automate';
  const lobbyPath = `/play/${slug}${showDev ? '?dev=1' : ''}`;

  const [game, setGame] = useState(null); // null = loading, false = not found
  const [board, setBoard] = useState([]);
  const [match, setMatch] = useState(null);
  const [lobby, setLobby] = useState([]);
  const [reloadCount, setReloadCount] = useState(0);
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const iframeRef = useRef(null);

  //=============================================================
  //                        DATA LOADING
  //=============================================================

  useEffect(() => {
    setGame(null);
    api('GET', `/games/${slug}`).then((r) => setGame(r.status === 200 ? r.data : false));
  }, [slug]);

  const loadBoard = useCallback(async () => {
    const r = await api('GET', `/games/${slug}/leaderboard?limit=${LEADERBOARD_SIZE}`);
    if (r.status === 200) setBoard(r.data);
  }, [slug]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // clear old errors when moving to a different game or match
  useEffect(() => {
    setRestartError('');
    setCancelError('');
  }, [slug, matchId]);

  // connect the game iframe to the site. Re-attaches when the game, user or match changes,
  // or when the dev "Reload game iframe" button remounts the iframe.
  useEffect(() => {
    setMatch(null);
    if (!game || !iframeRef.current) return undefined;
    return attachBridge(iframeRef.current, {
      slug,
      user,
      matchId,
      onScore: loadBoard,
      onMatch: setMatch,
    });
  }, [game, slug, user?.id, matchId, loadBoard, reloadCount]);

  const isMatchGame = game && game.mode === 'match';

  const loadLobby = useCallback(async () => {
    const r = await api('GET', `/games/${slug}/matches`);
    if (r.status === 200) setLobby(r.data);
  }, [slug]);

  // keep the lobby fresh while it is on screen
  useEffect(() => {
    if (!isMatchGame || matchId) return undefined;
    loadLobby();
    const t = setInterval(loadLobby, LOBBY_POLL_MS);
    return () => clearInterval(t);
  }, [isMatchGame, matchId, loadLobby, user?.id]);

  //=============================================================
  //                       MATCH ACTIONS
  //=============================================================

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

  // reset an Automate draft that the current rules cannot continue (asks first)
  async function restartDraft(m) {
    if (
      !window.confirm(
        'Restart this incompatible Automate draft for both players? All placed pieces will be cleared.',
      )
    )
      return;
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
      // if the other player already restarted it, the refreshed match is the success case
      if (!(r.data?.match && !needsRestart(r.data.match))) {
        setRestartError(r.data?.error || 'Could not restart the draft. Please try again.');
      }
    }
  }

  // delete a waiting match nobody has joined yet, then return to the lobby
  async function cancelMatch(m) {
    if (!window.confirm('Cancel this waiting match?')) return;
    setCancelError('');
    setCancelling(true);
    const r = await api('DELETE', `/matches/${m.id}`);
    setCancelling(false);
    if (r.status === 204) {
      navigate(lobbyPath);
    } else {
      setCancelError(r.data?.error || 'Could not cancel match. Please try again.');
    }
  }

  // the button for one lobby row: Join someone else's match, or Resume / Restart your own
  function lobbyAction(m) {
    if (!user) return null;
    if (m.you === null) {
      return (
        <button type="button" onClick={() => join(m.id)}>
          Join
        </button>
      );
    }
    if (needsRestart(m)) {
      return (
        <button type="button" disabled={restarting} onClick={() => restartDraft(m)}>
          Restart draft
        </button>
      );
    }
    return (
      <button type="button" onClick={() => openMatch(m.id)}>
        Resume
      </button>
    );
  }

  //=============================================================
  //                           RENDER
  //=============================================================

  if (game === null) return <p>Loading…</p>;
  if (game === false) return <p>Game not found</p>;

  const inMatch = match && match.you !== null;
  const canCancel =
    user &&
    match?.status === 'waiting' &&
    match.players.length === 1 &&
    match.players[0].id === user.id;

  return (
    <main>
      <h1>{game.title}</h1>
      {restartError && <p role="alert">{restartError}</p>}
      {cancelError && <p role="alert">{cancelError}</p>}

      {/* lobby - list of open matches */}
      {isMatchGame && !matchId && (
        <section>
          {user ? (
            <p>
              <button type="button" onClick={newMatch}>
                New online match
              </button>
            </p>
          ) : (
            <p>Log in to play online</p>
          )}
          <ul>
            {lobby.map((m) => (
              <li key={m.id}>
                {m.players[0].name}
                {game.maxPlayers === 4 ? ` (${m.players.length}/4 players)` : ''}{' '}
                {needsRestart(m) && <span>Draft needs restart. </span>}
                {lobbyAction(m)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* inside one match */}
      {isMatchGame && matchId && (
        <section>
          <p>{match ? statusLine(match, showAutomateDev, game.maxPlayers) : 'Loading match…'}</p>
          {needsRestart(match) && (
            <p>
              This saved draft cannot continue under the new placement rules.{' '}
              {inMatch ? (
                <button type="button" disabled={restarting} onClick={() => restartDraft(match)}>
                  Restart draft for both players
                </button>
              ) : (
                'Either player can restart the draft.'
              )}
            </p>
          )}
          {showAutomateDev && inMatch && match.status === 'waiting' && <CopyInvite key={matchId} />}
          {user && match && !inMatch && match.status === 'waiting' && (
            <p>
              <button type="button" onClick={() => join(matchId)}>
                Join this match
              </button>
            </p>
          )}
          {canCancel && (
            <p>
              <button type="button" disabled={cancelling} onClick={() => cancelMatch(match)}>
                Cancel match
              </button>
            </p>
          )}
          <p>
            <Link to={lobbyPath}>Leave</Link>
          </p>
        </section>
      )}

      {showDev && (
        <p>
          <button type="button" onClick={() => setReloadCount((n) => n + 1)}>
            Reload game iframe
          </button>
        </p>
      )}

      {/* the iframe is keyed so switching game/match (or a dev reload) mounts a fresh one */}
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
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {board.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{row.name}</td>
              <td>{row.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Play;

// bridge.js - site half of the Arcade SDK (answers requests from the game iframe)
// Author: Reachnid Group
// Centennial College - Fall 2026

// Games run in a same-origin iframe and talk to this file over postMessage (see sdk/arcade.js for
// the message format). This file makes the real API calls and sends the results back.
//
// usage from the React game page:
//
//   useEffect(() => attachBridge(iframeRef.current, { slug, user, matchId, onScore }), [...]);
//
// call it BEFORE the iframe finishes loading (render <iframe> and attach in the same effect);
// the returned function detaches everything.
//
//   slug     - game folder name
//   user     - { id, name } or null for guests
//   matchId  - string or null (single-player / local play)
//   onScore  - optional, called after a score is saved (refresh the leaderboard)
//   onMatch  - optional, called with the match whenever it changes (update lobby text)

//=============================================================
//                          IMPORTS
//=============================================================

// import the API helper
import { api } from './api.js';

//=============================================================
//                          SETTINGS
//=============================================================

// how often an open match is re-fetched to pick up the other players' moves
const POLL_MS = 1500;

// turn a failed API response into the SDK's { ok: false, reason } shape
const fail = (r) => ({
  ok: false,
  reason: (r.data && r.data.error) || (r.status === 0 ? 'network' : 'http-' + r.status),
});

//=============================================================
//                          EXPORTS
//=============================================================

// start answering SDK calls from the iframe - returns a function that stops everything
export function attachBridge(iframe, { slug, user, matchId = null, onScore, onMatch }) {
  let stopped = false;
  let pollTimer = null;
  let lastVersion = -1;

  // send a message to the game (ignored once detached)
  const post = (msg) => {
    if (!stopped && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ arcade: 1, ...msg }, location.origin);
    }
  };

  // remember a newer copy of the match
  // push = also send it to the game (replies to the game's own writes already include it)
  const sawMatch = (match, push) => {
    if (!match || match.version <= lastVersion) return;
    lastVersion = match.version;
    if (push) post({ event: 'match', data: match });
    if (onMatch) onMatch(match);
  };

  // re-fetch the match until it is finished, so the game sees the other players' moves
  const poll = async () => {
    if (stopped) return;
    const r = await api('GET', `/matches/${matchId}`);
    if (stopped) return;
    if (r.status === 200) sawMatch(r.data, true);
    if (!(r.status === 200 && r.data.status === 'done')) pollTimer = setTimeout(poll, POLL_MS);
  };

  // one handler per SDK method - each returns { ok, ... } and must never throw
  const handlers = {
    // the game is starting - send it the user, game info and match
    async init() {
      const [g, m] = await Promise.all([
        api('GET', `/games/${slug}`),
        matchId ? api('GET', `/matches/${matchId}`) : null,
      ]);
      const match = m && m.status === 200 ? m.data : null;
      if (match) {
        sawMatch(match, false);
        if (!pollTimer && match.status !== 'done') pollTimer = setTimeout(poll, POLL_MS);
      }
      return { ok: true, user: user || null, game: g.status === 200 ? g.data : null, match };
    },

    // save a score (guests can't)
    async submitScore({ score, meta }) {
      if (!user) return { ok: false, reason: 'guest' };
      const r = await api('POST', `/games/${slug}/scores`, { score, meta });
      if (r.status !== 201) return fail(r);
      if (onScore) onScore();
      return { ok: true };
    },

    // read the leaderboard
    async getLeaderboard({ limit }) {
      const r = await api('GET', `/games/${slug}/leaderboard?limit=${Number(limit) || 10}`);
      return r.status === 200 ? { ok: true, entries: r.data } : fail(r);
    },

    // write a turn to the match
    async 'match.update'(body) {
      if (!matchId) return { ok: false, reason: 'no-match' };
      const r = await api('PUT', `/matches/${matchId}`, body);

      // saved
      if (r.status === 200) {
        sawMatch(r.data, false);
        if (r.data.status === 'done' && onScore) onScore();
        return { ok: true, match: r.data };
      }

      // someone else wrote first - hand back the latest match
      if (r.status === 409 && r.data && r.data.match) {
        sawMatch(r.data.match, false);
        return { ok: false, reason: 'conflict', match: r.data.match };
      }
      return fail(r);
    },
  };

  // answer requests from this game's iframe only, replying with the same id
  const onMessage = async (e) => {
    if (e.source !== iframe.contentWindow || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.arcade !== 1 || !msg.id || !Object.hasOwn(handlers, msg.method)) return;

    let result;
    try {
      result = await handlers[msg.method](msg.params || {});
    } catch (err) {
      console.error('[bridge]', err);
      result = { ok: false, reason: 'bridge-error' };
    }
    post({ id: msg.id, result });
  };

  // start listening, and return the clean-up function
  window.addEventListener('message', onMessage);
  return () => {
    stopped = true;
    clearTimeout(pollTimer);
    window.removeEventListener('message', onMessage);
  };
}

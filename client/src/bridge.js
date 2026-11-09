/* Shell half of the Arcade SDK (see sdk/arcade.js for the protocol).
 *
 * Usage from the React game page:
 *
 *   useEffect(() => attachBridge(iframeRef.current, { slug, user, matchId, onScore }), [slug, user?.id, matchId]);
 *
 * Call it BEFORE the iframe finishes loading (render <iframe> and attach in the same effect);
 * the returned function detaches everything.
 *
 *   slug     game folder name
 *   user     { id, name } or null for guests
 *   matchId  string or null (single-player / local play)
 *   onScore  optional callback, called after a score is saved (refresh the leaderboard)
 *   onMatch  optional callback(match), called whenever the match changes (update lobby text)
 */

const POLL_MS = 1500;

async function http(method, path, body) {
  try {
    const res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

const fail = (r) => ({ ok: false, reason: (r.data && r.data.error) || (r.status === 0 ? 'network' : 'http-' + r.status) });

export function attachBridge(iframe, { slug, user, matchId = null, onScore, onMatch }) {
  let stopped = false;
  let pollTimer = null;
  let lastVersion = -1;

  const post = (msg) => {
    if (!stopped && iframe.contentWindow) iframe.contentWindow.postMessage({ arcade: 1, ...msg }, location.origin);
  };

  const sawMatch = (match, push) => {
    if (!match || match.version <= lastVersion) return;
    lastVersion = match.version;
    if (push) post({ event: 'match', data: match });
    if (onMatch) onMatch(match);
  };

  const poll = async () => {
    if (stopped) return;
    const r = await http('GET', `/matches/${matchId}`);
    if (stopped) return;
    if (r.status === 200) sawMatch(r.data, true);
    if (!(r.status === 200 && r.data.status === 'done')) pollTimer = setTimeout(poll, POLL_MS);
  };

  const handlers = {
    async init() {
      const [g, m] = await Promise.all([
        http('GET', `/games/${slug}`),
        matchId ? http('GET', `/matches/${matchId}`) : null,
      ]);
      const match = m && m.status === 200 ? m.data : null;
      if (match) {
        sawMatch(match, false);
        if (!pollTimer && match.status !== 'done') pollTimer = setTimeout(poll, POLL_MS);
      }
      return { ok: true, user: user || null, game: g.status === 200 ? g.data : null, match };
    },

    async submitScore({ score, meta }) {
      if (!user) return { ok: false, reason: 'guest' };
      const r = await http('POST', `/games/${slug}/scores`, { score, meta });
      if (r.status !== 201) return fail(r);
      if (onScore) onScore();
      return { ok: true };
    },

    async getLeaderboard({ limit }) {
      const r = await http('GET', `/games/${slug}/leaderboard?limit=${Number(limit) || 10}`);
      return r.status === 200 ? { ok: true, entries: r.data } : fail(r);
    },

    async 'match.update'(body) {
      if (!matchId) return { ok: false, reason: 'no-match' };
      const r = await http('PUT', `/matches/${matchId}`, body);
      if (r.status === 200) {
        sawMatch(r.data, false);
        if (r.data.status === 'done' && onScore) onScore();
        return { ok: true, match: r.data };
      }
      if (r.status === 409 && r.data && r.data.match) {
        sawMatch(r.data.match, false);
        return { ok: false, reason: 'conflict', match: r.data.match };
      }
      return fail(r);
    },
  };

  const onMessage = async (e) => {
    if (e.source !== iframe.contentWindow || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.arcade !== 1 || !msg.id || !Object.hasOwn(handlers, msg.method)) return;
    let result;
    try { result = await handlers[msg.method](msg.params || {}); }
    catch (err) { console.error('[bridge]', err); result = { ok: false, reason: 'bridge-error' }; }
    post({ id: msg.id, result });
  };

  window.addEventListener('message', onMessage);
  return () => {
    stopped = true;
    clearTimeout(pollTimer);
    window.removeEventListener('message', onMessage);
  };
}

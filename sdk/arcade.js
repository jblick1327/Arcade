/* Arcade SDK v1 — the ONLY thing a game needs to talk to the site.
 *
 *   <script src="/sdk/arcade.js"></script>
 *
 *   const { user, match } = await Arcade.ready();   // user is {id,name} or null (guest)
 *   Arcade.submitScore(1200);                       // single-player games: that's it
 *
 * Rules this file guarantees (do not break them when editing):
 *  - No method ever throws or rejects. Failures resolve as { ok:false, reason }.
 *  - Opened outside the site (double-clicked index.html, any local server) everything
 *    still works in "offline" mode: no user, scores kept in memory only.
 *  - Games never see URLs, cookies or tokens. All traffic goes through the parent page
 *    via postMessage; the parent half lives in client/src/bridge.js.
 *
 * Wire protocol (same-origin postMessage, every message has arcade:1):
 *   game  -> shell  { arcade:1, id, method, params }
 *   shell -> game   { arcade:1, id, result }            result is always { ok, ... }
 *   shell -> game   { arcade:1, event:'match', data }   pushed when the match changes
 * Methods: init, submitScore, getLeaderboard, match.update
 */
(function () {
  'use strict';

  var TIMEOUT_MS = 10000;
  var embedded = window.parent !== window;
  var offline = !embedded;
  var pending = {};
  var nextId = 1;
  var ctx = { user: null, match: null, game: null, offline: offline };
  var readyPromise = null;
  var listeners = [];
  var offlineScores = [];

  function call(method, params) {
    return new Promise(function (resolve) {
      var id = nextId++;
      var timer = setTimeout(function () {
        delete pending[id];
        resolve({ ok: false, reason: 'timeout' });
      }, TIMEOUT_MS);
      pending[id] = function (result) {
        clearTimeout(timer);
        resolve(result && typeof result === 'object' ? result : { ok: false, reason: 'bad-reply' });
      };
      try {
        window.parent.postMessage({ arcade: 1, id: id, method: method, params: params || {} }, location.origin);
      } catch (e) {
        clearTimeout(timer);
        delete pending[id];
        resolve({ ok: false, reason: 'no-shell' });
      }
    });
  }

  function setMatch(match) {
    // Ignore anything that is not newer than what the game already has.
    if (!match || (ctx.match && match.version <= ctx.match.version)) return false;
    ctx.match = match;
    return true;
  }

  window.addEventListener('message', function (e) {
    if (!embedded || e.source !== window.parent || e.origin !== location.origin) return;
    var msg = e.data;
    if (!msg || msg.arcade !== 1) return;
    if (msg.id && pending[msg.id]) {
      var done = pending[msg.id];
      delete pending[msg.id];
      done(msg.result);
    } else if (msg.event === 'match' && setMatch(msg.data)) {
      listeners.slice().forEach(function (fn) {
        try { fn(ctx.match); } catch (err) { console.error('[Arcade] onChange handler failed', err); }
      });
    }
  });

  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = (offline ? Promise.resolve({ ok: false }) : call('init')).then(function (r) {
      if (r.ok) {
        ctx.user = r.user || null;
        ctx.game = r.game || null;
        ctx.match = r.match || null;
      } else {
        offline = ctx.offline = true;
        console.info('[Arcade] Not running inside the site: offline mode, scores are not saved.');
      }
      return { user: ctx.user, match: ctx.match, game: ctx.game, offline: ctx.offline };
    });
    return readyPromise;
  }

  function submitScore(score, meta) {
    if (typeof score !== 'number' || !isFinite(score)) {
      console.warn('[Arcade] submitScore needs a finite number, got:', score);
      return Promise.resolve({ ok: false, reason: 'invalid-score' });
    }
    return ready().then(function () {
      if (offline) {
        offlineScores.push({ name: 'You (offline)', score: score, at: new Date().toISOString() });
        console.info('[Arcade] offline score:', score);
        return { ok: true, offline: true };
      }
      return call('submitScore', { score: score, meta: meta || null });
    });
  }

  function getLeaderboard(limit) {
    return ready().then(function () {
      if (offline) return { ok: true, offline: true, entries: offlineScores.slice() };
      return call('getLeaderboard', { limit: limit || 10 });
    });
  }

  var match = {
    /** Latest known match object, or null when the game was opened without a match. */
    get: function () { return ctx.match; },

    /** Write the match. patch = { state, turn, result? }.
     *  turn: next player's seat (0–1, or 0–3 for a four-player game).
     *  result: { winner: seat index | null } ends the match (null = draw).
     *  Resolves { ok:true, match } or { ok:false, reason, match? } ('conflict' = someone wrote first;
     *  the returned match is the current one). */
    update: function (patch) {
      return ready().then(function () {
        if (!ctx.match) return { ok: false, reason: 'no-match' };
        var body = { version: ctx.match.version, state: patch.state, turn: patch.turn };
        if (patch.result) body.result = patch.result;
        return call('match.update', body).then(function (r) {
          if (r.match) setMatch(r.match);
          return r;
        });
      });
    },

    /** fn(match) runs whenever another player (or the server) changes the match. Returns an unsubscribe function. */
    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    }
  };

  window.Arcade = { version: 1, ready: ready, submitScore: submitScore, getLeaderboard: getLeaderboard, match: match };
})();

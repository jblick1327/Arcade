// match_routes.test.js - tests for creating, joining, cancelling and playing matches
// Author: Reachnid Group
// Centennial College - Fall 2026

// Mongoose calls are replaced with in-memory stubs, so no database is needed.
// These platform tests only use fixture games created below, never a real game from games/, so
// any real game can be deleted without touching this file. Game tests live in games/<slug>/tests/

//=============================================================
//                          IMPORTS
//=============================================================

import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import fs from 'node:fs';

// import the code being tested
import Match from '../models/match_model.js';
import User from '../models/user_model.js';
import router from '../routes/match_routes.js';

//=============================================================
//                         TEST SETUP
//=============================================================

// in-memory stand-ins for the Mongoose calls the match routes make
const ids = Object.fromEntries(
  'abcde'.split('').map((key) => [key, new mongoose.Types.ObjectId()]),
);
const fourSlug = `four-player-test-${process.pid}`;
const fourDir = `games/${fourSlug}`;
const hookSlug = `hook-test-${process.pid}`;
const hookDir = `games/${hookSlug}`;
let docs;
const clone = (doc) => ({ ...doc, players: [...doc.players], state: structuredClone(doc.state) });
const matches = (doc, filter) =>
  Object.entries(filter).every(([k, v]) => {
    if (k.startsWith('players.')) {
      const player = doc.players[Number(k.slice(8))];
      return v?.$exists !== undefined
        ? (player !== undefined) === v.$exists
        : String(player) === String(v);
    }
    return String(doc[k]) === String(v);
  });

Match.findById = async (id) => {
  const d = docs.get(String(id));
  return d ? clone(d) : null;
};
Match.findOneAndUpdate = async (filter, update) => {
  const doc = docs.get(String(filter._id));
  if (!doc || !matches(doc, filter)) return null;
  Object.assign(doc, update.$set);
  if (update.$push?.players) doc.players.push(update.$push.players);
  for (const [k, n] of Object.entries(update.$inc || {})) doc[k] += n;
  return clone(doc);
};
Match.findOneAndDelete = async (filter) => {
  const doc = docs.get(String(filter._id));
  if (!doc || !matches(doc, filter)) return null;
  docs.delete(String(doc._id));
  return clone(doc);
};
Match.create = async (fields) => {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    status: 'waiting',
    turn: 0,
    state: null,
    winner: null,
    version: 0,
    ...fields,
  };
  docs.set(String(doc._id), doc);
  return clone(doc);
};
User.find = async () => Object.entries(ids).map(([key, _id]) => ({ _id, name: key.toUpperCase() }));

function put(id, fields) {
  docs.set(String(id), {
    _id: id,
    game: hookSlug,
    players: [ids.a, ids.b],
    status: 'active',
    turn: 0,
    state: 'stuck',
    winner: null,
    version: 3,
    ...fields,
  });
}

function waiting(id, fields = {}) {
  put(id, { status: 'waiting', players: [ids.a], state: null, ...fields });
}

let server;
let base;
let as = null;
before(async () => {
  fs.mkdirSync(fourDir);
  fs.writeFileSync(`${fourDir}/index.html`, '<!doctype html>');
  fs.writeFileSync(`${fourDir}/game.json`, JSON.stringify({ mode: 'match', maxPlayers: 4 }));
  // a minimal two-player game with a server hook: only even numbers may be saved,
  // a 'stuck' match is blocked, and the "reset" action clears it
  fs.mkdirSync(hookDir);
  fs.writeFileSync(`${hookDir}/index.html`, '<!doctype html>');
  fs.writeFileSync(`${hookDir}/game.json`, JSON.stringify({ mode: 'match' }));
  fs.writeFileSync(
    `${hookDir}/server.js`,
    `module.exports = {
    view: ({ state, turn }) => (state === 'stuck' ? { state, turn, blocked: 'Stuck.' } : { state, turn }),
    validateUpdate: (prev, actor, { state, turn }) => (state % 2 === 0 ? { state, turn } : null),
    actions: { reset: { label: 'Reset', available: ({ state, status }) => status === 'active' && state === 'stuck',
      run: () => ({ state: null, turn: 0, winner: null }) } },
  };`,
  );
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { userId: as && String(as) };
    next();
  });
  app.use('/api', router);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => {
  server.close();
  fs.rmSync(fourDir, { recursive: true, force: true });
  fs.rmSync(hookDir, { recursive: true, force: true });
});
beforeEach(() => {
  docs = new Map();
  as = ids.a;
});

async function action(id, name, body) {
  const r = await fetch(`${base}/matches/${id}/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}

//=============================================================
//                           TESTS
//=============================================================

test('either participant can run an action the game offers', async () => {
  const id = new mongoose.Types.ObjectId();
  for (const player of [ids.a, ids.b]) {
    put(id);
    as = player;
    const r = await action(id, 'reset', { version: 3 });
    assert.equal(r.status, 200);
    assert.equal(r.data.state, null);
    assert.equal(r.data.turn, 0);
    assert.equal(r.data.version, 4);
    assert.equal(r.data.blocked, null);
  }
});

test('actions are refused for guests, outsiders, bad ids and missing matches', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id);
  as = null;
  assert.equal((await action(id, 'reset', { version: 3 })).status, 401);
  as = ids.c;
  assert.equal((await action(id, 'reset', { version: 3 })).status, 403);
  as = ids.a;
  assert.equal((await action('not-an-id', 'reset', { version: 3 })).status, 404);
  assert.equal((await action(new mongoose.Types.ObjectId(), 'reset', { version: 3 })).status, 404);
  assert.equal(docs.get(String(id)).version, 3, 'nothing was written');
});

test('actions the game does not currently offer are refused', async () => {
  const id = new mongoose.Types.ObjectId();
  for (const [name, fields] of [
    ['reset', { state: 2 }], // available() says no
    ['reset', { status: 'done' }],
    ['nope', {}], // not defined by the game
    ['toString', {}], // inherited properties are not actions
    ['reset', { game: fourSlug }], // game without a hook
    ['reset', { game: 'deleted-game' }], // game folder removed
  ]) {
    put(id, fields);
    const r = await action(id, name, { version: 3 });
    assert.equal(r.status, 409, `${name} ${JSON.stringify(fields)}`);
    assert.equal(r.data.error, 'Action is not available');
    assert.equal(docs.get(String(id)).version, 3);
  }
});

test('a stale version gets a refresh, including when the other player already ran the action', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id);
  assert.equal((await action(id, 'reset', { version: 3 })).status, 200);
  as = ids.b;
  const late = await action(id, 'reset', { version: 3 });
  assert.equal(late.status, 409);
  assert.equal(late.data.error, 'Match changed, refresh');
  assert.equal(late.data.match.version, 4);
  assert.deepEqual(late.data.match.actions, [], 'the refreshed match no longer offers it');
});

test('an action that loses the race to another update is reported as a conflict', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id);
  const original = Match.findOneAndUpdate;
  Match.findOneAndUpdate = async () => {
    docs.get(String(id)).version = 4;
    return null;
  };
  try {
    const r = await action(id, 'reset', { version: 3 });
    assert.equal(r.status, 409);
    assert.equal(r.data.match.version, 4);
  } finally {
    Match.findOneAndUpdate = original;
  }
});

async function request(method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}

test('creator can cancel a waiting match with no opponent', async () => {
  const id = new mongoose.Types.ObjectId();
  waiting(id);
  const r = await request('DELETE', `/matches/${id}`);
  assert.equal(r.status, 204);
  assert.equal(docs.has(String(id)), false);
});

test('cancel requires login and creator ownership', async () => {
  const id = new mongoose.Types.ObjectId();
  waiting(id);
  as = null;
  assert.equal((await request('DELETE', `/matches/${id}`)).status, 401);
  as = ids.b;
  assert.equal((await request('DELETE', `/matches/${id}`)).status, 403);
  as = ids.a;
  assert.equal((await request('DELETE', '/matches/invalid-id')).status, 404);
  assert.equal((await request('DELETE', `/matches/${new mongoose.Types.ObjectId()}`)).status, 404);
  assert.equal(docs.has(String(id)), true);
});

test('joined, active and completed matches cannot be cancelled', async () => {
  const id = new mongoose.Types.ObjectId();
  for (const fields of [{ players: [ids.a, ids.b] }, { status: 'active' }, { status: 'done' }]) {
    waiting(id, fields);
    assert.equal((await request('DELETE', `/matches/${id}`)).status, 409);
    assert.equal(docs.has(String(id)), true);
  }
});

test('cancel is atomic against a simultaneous join', async () => {
  const id = new mongoose.Types.ObjectId();
  waiting(id);
  const original = Match.findOneAndDelete;
  Match.findOneAndDelete = async () => {
    docs.get(String(id)).players.push(ids.b);
    docs.get(String(id)).version += 1;
    return null;
  };
  try {
    assert.equal((await request('DELETE', `/matches/${id}`)).status, 409);
    assert.equal(docs.get(String(id)).players.length, 2);
  } finally {
    Match.findOneAndDelete = original;
  }
});

test('four-player matches wait for all seats and accept turns and winners 2 and 3', async () => {
  const created = await request('POST', `/games/${fourSlug}/matches`);
  assert.equal(created.status, 201);
  const id = created.data.id;
  let match = created.data;
  for (const [player, count] of [
    [ids.b, 2],
    [ids.c, 3],
    [ids.d, 4],
  ]) {
    as = player;
    const joined = await request('POST', `/matches/${id}/join`);
    assert.equal(joined.status, 200);
    match = joined.data;
    assert.equal(match.players.length, count);
    assert.equal(match.status, count === 4 ? 'active' : 'waiting');
  }
  as = ids.e;
  assert.equal((await request('POST', `/matches/${id}/join`)).status, 409);
  as = ids.a;
  assert.equal(
    (await request('PUT', `/matches/${id}`, { version: match.version, state: {}, turn: 4 })).status,
    400,
  );
  const move = await request('PUT', `/matches/${id}`, {
    version: match.version,
    state: { moved: true },
    turn: 2,
  });
  assert.equal(move.status, 200);
  assert.equal(move.data.turn, 2);
  as = ids.c;
  const end = await request('PUT', `/matches/${id}`, {
    version: move.data.version,
    state: { finished: true },
    turn: 3,
    result: { winner: 3 },
  });
  assert.equal(end.status, 200);
  assert.equal(end.data.status, 'done');
  assert.equal(end.data.winner, 3);
});

test('match games default to two players', async () => {
  const created = await request('POST', `/games/${hookSlug}/matches`);
  assert.equal(created.status, 201);
  as = ids.b;
  const joined = await request('POST', `/matches/${created.data.id}/join`);
  assert.equal(joined.data.status, 'active');
  assert.equal(joined.data.players.length, 2);
  as = ids.c;
  assert.equal((await request('POST', `/matches/${created.data.id}/join`)).status, 409);
});

test('a game server hook validates writes, reports blocked matches and refuses moves on them', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id, { state: 2, version: 0 });
  assert.equal(
    (await request('PUT', `/matches/${id}`, { version: 0, state: 3, turn: 1 })).status,
    400,
  );
  const ok = await request('PUT', `/matches/${id}`, { version: 0, state: 4, turn: 1 });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data.actions, []);

  put(id, { version: 5 });
  const read = await request('GET', `/matches/${id}`);
  assert.equal(read.data.blocked, 'Stuck.');
  assert.deepEqual(read.data.actions, [{ name: 'reset', label: 'Reset' }]);
  as = ids.c;
  assert.deepEqual(
    (await request('GET', `/matches/${id}`)).data.actions,
    [],
    'spectators get no actions',
  );
  as = ids.a;
  assert.equal(
    (await request('PUT', `/matches/${id}`, { version: 5, state: 6, turn: 1 })).status,
    409,
  );
});

test('games without a hook keep the trusting defaults, and removed games cannot be written', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id, { game: fourSlug, state: null, version: 0 });
  const r = await request('PUT', `/matches/${id}`, {
    version: 0,
    state: { any: 'thing' },
    turn: 1,
    result: { winner: 0 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.status, 'done');
  assert.deepEqual(r.data.actions, []);
  put(id, { game: 'deleted-game', state: null, version: 0 });
  assert.equal(
    (await request('PUT', `/matches/${id}`, { version: 0, state: 1, turn: 1 })).status,
    404,
  );
});

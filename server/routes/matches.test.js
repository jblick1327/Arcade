import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import fs from 'node:fs';
import Army from '../../games/automate/setup.js';
import { Match, User } from '../models.js';
import router from './matches.js';

// In-memory stand-ins for the few Mongoose calls the restart route makes, so no database is needed.
const ids = Object.fromEntries('abcde'.split('').map((key) => [key, new mongoose.Types.ObjectId()]));
const fourSlug = `four-player-test-${process.pid}`;
const fourDir = `games/${fourSlug}`;
let docs;
const clone = (doc) => ({ ...doc, players: [...doc.players], state: structuredClone(doc.state) });
const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => {
  if (k.startsWith('players.')) return (Number(k.slice(8)) < doc.players.length) === v.$exists;
  return String(doc[k]) === String(v);
});

Match.findById = async (id) => { const d = docs.get(String(id)); return d ? clone(d) : null; };
Match.findOneAndUpdate = async (filter, update) => {
  const doc = docs.get(String(filter._id));
  if (!doc || !matches(doc, filter)) return null;
  Object.assign(doc, update.$set);
  if (update.$push?.players) doc.players.push(update.$push.players);
  for (const [k, n] of Object.entries(update.$inc || {})) doc[k] += n;
  return clone(doc);
};
Match.create = async (fields) => {
  const doc = { _id: new mongoose.Types.ObjectId(), status: 'waiting', turn: 0,
    state: null, winner: null, version: 0, ...fields };
  docs.set(String(doc._id), doc);
  return clone(doc);
};
User.find = async () => Object.entries(ids).map(([key, _id]) => ({ _id, name: key.toUpperCase() }));

function legacyDraft() {
  const draft = Army.create();
  draft.armies.w[57] = 'N'; // pieces without kings: the old rules allowed this, the new ones cannot continue it
  return { phase: 'draft', draft, runner: null, moves: [] };
}

function put(id, fields) {
  docs.set(String(id), { _id: id, game: 'automate', players: [ids.a, ids.b], status: 'active',
    turn: 0, state: legacyDraft(), winner: null, version: 3, ...fields });
}

let server;
let base;
let as = null;
before(async () => {
  fs.mkdirSync(fourDir);
  fs.writeFileSync(`${fourDir}/index.html`, '<!doctype html>');
  fs.writeFileSync(`${fourDir}/game.json`, JSON.stringify({ mode: 'match', maxPlayers: 4 }));
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { userId: as && String(as) }; next(); });
  app.use('/api', router);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => { server.close(); fs.rmSync(fourDir, { recursive: true, force: true }); });
beforeEach(() => { docs = new Map(); as = ids.a; });

async function restart(id, body) {
  const r = await fetch(`${base}/matches/${id}/restart-draft`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}

test('either participant can restart an incompatible draft, which clears it to White’s first placement', async () => {
  const id = new mongoose.Types.ObjectId();
  for (const [player, version] of [[ids.a, 3], [ids.b, 3]]) {
    put(id);
    as = player;
    const r = await restart(id, { version });
    assert.equal(r.status, 200);
    assert.equal(r.data.state, null);
    assert.equal(r.data.turn, 0);
    assert.equal(r.data.version, 4);
  }
});

test('restart is refused for guests, outsiders, bad ids and missing matches', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id);
  as = null;
  assert.equal((await restart(id, { version: 3 })).status, 401);
  as = ids.c;
  assert.equal((await restart(id, { version: 3 })).status, 403);
  as = ids.a;
  assert.equal((await restart('not-an-id', { version: 3 })).status, 404);
  assert.equal((await restart(new mongoose.Types.ObjectId(), { version: 3 })).status, 404);
  assert.equal(docs.get(String(id)).version, 3, 'nothing was written');
});

test('restart is refused for healthy drafts, battles, finished matches and other games', async () => {
  const id = new mongoose.Types.ObjectId();
  const healthy = { phase: 'draft', draft: Army.create(), runner: null, moves: [], placementOnly: true };
  for (const fields of [{ state: healthy }, { status: 'done' }, { game: 'other' }, { state: null }]) {
    put(id, fields);
    const r = await restart(id, { version: 3 });
    assert.equal(r.status, 409);
    assert.equal(r.data.error, 'Draft restart is not available');
    assert.equal(docs.get(String(id)).version, 3);
  }
});

test('a stale version gets a refresh, including when the other player already restarted', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id);
  assert.equal((await restart(id, { version: 3 })).status, 200);
  as = ids.b;
  const late = await restart(id, { version: 3 });
  assert.equal(late.status, 409);
  assert.equal(late.data.error, 'Match changed, refresh');
  assert.equal(late.data.match.version, 4);
  assert.equal(late.data.match.state, null);
});

test('a write that loses the race to another update is reported as a conflict', async () => {
  const id = new mongoose.Types.ObjectId();
  put(id);
  const original = Match.findOneAndUpdate;
  Match.findOneAndUpdate = async () => { docs.get(String(id)).version = 4; return null; };
  try {
    const r = await restart(id, { version: 3 });
    assert.equal(r.status, 409);
    assert.equal(r.data.match.version, 4);
  } finally {
    Match.findOneAndUpdate = original;
  }
});

async function request(method, path, body) {
  const r = await fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: r.status, data: await r.json() };
}

test('four-player matches wait for all seats and accept turns and winners 2 and 3', async () => {
  const created = await request('POST', `/games/${fourSlug}/matches`);
  assert.equal(created.status, 201);
  const id = created.data.id;
  let match = created.data;
  for (const [player, count] of [[ids.b, 2], [ids.c, 3], [ids.d, 4]]) {
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
  assert.equal((await request('PUT', `/matches/${id}`,
    { version: match.version, state: {}, turn: 4 })).status, 400);
  const move = await request('PUT', `/matches/${id}`,
    { version: match.version, state: { moved: true }, turn: 2 });
  assert.equal(move.status, 200);
  assert.equal(move.data.turn, 2);
  as = ids.c;
  const end = await request('PUT', `/matches/${id}`,
    { version: move.data.version, state: { finished: true }, turn: 3, result: { winner: 3 } });
  assert.equal(end.status, 200);
  assert.equal(end.data.status, 'done');
  assert.equal(end.data.winner, 3);
});

test('Automate keeps its two-player limit', async () => {
  const created = await request('POST', '/games/automate/matches');
  assert.equal(created.status, 201);
  as = ids.b;
  const joined = await request('POST', `/matches/${created.data.id}/join`);
  assert.equal(joined.data.status, 'active');
  assert.equal(joined.data.players.length, 2);
  as = ids.c;
  assert.equal((await request('POST', `/matches/${created.data.id}/join`)).status, 409);
});

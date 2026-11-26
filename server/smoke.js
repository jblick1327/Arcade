// Smoke test: boots the real server (as `npm start` would, on a throwaway in-memory database)
// and checks that the site, API, SDK and every game actually load. Catches "the site won't
// start" breakage that the unit tests can't. Needs `npm run build` first.
// Run with `npm run test:smoke`. Not part of `npm test`, because it downloads mongod on first run.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = Number(process.env.SMOKE_PORT) || 3999;
const BASE = `http://127.0.0.1:${PORT}`;
let server;
let cookie = '';

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['server/server.js', '--memory-db'], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development', MONGODB_URI: '', SESSION_SECRET: '' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    server.stdout.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
      if (output.includes('Arcade on')) resolve();
    });
    server.once('exit', (code) => reject(new Error(`server exited early with code ${code}`)));
  });
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return res;
}

before(async () => {
  assert.ok(fs.existsSync('client/dist/index.html'), 'run `npm run build` before the smoke test');
  await startServer();
}, { timeout: 180_000 }); // the first run downloads mongod

after(() => server?.kill('SIGTERM'));

test('health check reports the database as connected', async () => {
  const res = await call('GET', '/healthz');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('the client is served, including for deep links', async () => {
  for (const path of ['/', '/play/anything']) {
    const res = await call('GET', path);
    assert.equal(res.status, 200, path);
    assert.match(await res.text(), /<div id="root">/, path);
  }
});

test('the SDK is served', async () => {
  const res = await call('GET', '/sdk/arcade.js');
  assert.equal(res.status, 200);
});

test('every listed game loads', async () => {
  const res = await call('GET', '/api/games');
  assert.equal(res.status, 200);
  const games = await res.json();
  assert.ok(games.length > 0, 'no games listed');
  for (const game of games) {
    const page = await call('GET', `/games/${game.slug}/`);
    assert.equal(page.status, 200, `games/${game.slug}/ did not load`);
  }
});

test('a player can register, stay logged in, and post a score', async () => {
  const name = `smoke_${Date.now() % 1e6}`;
  assert.equal((await call('POST', '/api/auth/register', { name, password: 'smoke-test-pw' })).status, 201);

  const me = await (await call('GET', '/api/me')).json();
  assert.equal(me.user?.name, name);

  const games = await (await call('GET', '/api/games')).json();
  const scored = games.find((g) => g.mode === 'score');
  assert.ok(scored, 'no score-mode game to test with');
  assert.equal((await call('POST', `/api/games/${scored.slug}/scores`, { score: 7 })).status, 201);

  const board = await (await call('GET', `/api/games/${scored.slug}/leaderboard`)).json();
  assert.ok(board.some((row) => row.name === name), 'score missing from the leaderboard');
});

test('a player can open an online match', async () => {
  const games = await (await call('GET', '/api/games')).json();
  const online = games.find((g) => g.mode === 'match');
  if (!online) return;
  const created = await call('POST', `/api/games/${online.slug}/matches`);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal((await call('GET', `/api/matches/${id}`)).status, 200);
});

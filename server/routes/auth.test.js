import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import { User } from '../models.js';
import { requireAuth } from '../auth.js';
import router from './auth.js';

// Exercise the real Express routes and session cookies without requiring MongoDB.
let users;
let nextId;
User.create = async ({ name, nameLower, passwordHash }) => {
  if (users.has(nameLower)) {
    const error = new Error('duplicate username');
    error.code = 11000;
    throw error;
  }
  const user = { _id: String(++nextId), name, nameLower, passwordHash };
  users.set(nameLower, user);
  return user;
};
User.findOne = async ({ nameLower }) => users.get(nameLower) ?? null;
User.findById = async (id) => [...users.values()].find((u) => u._id === String(id)) ?? null;

let server;
let base;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: 'auth-test-only-secret', resave: false, saveUninitialized: false }));
  app.use('/api', router);
  app.get('/api/protected-test', requireAuth, (req, res) => res.json({ userId: req.userId }));
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});
beforeEach(() => { users = new Map(); nextId = 0; });

// fetch does not persist cookies automatically in Node; keep one session per client.
function client() {
  let cookie;
  return async (method, path, body) => {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + path, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, data: res.status === 204 ? null : await res.json() };
  };
}

test('registration hashes passwords and creates an authenticated session', async () => {
  const request = client();
  const registered = await request('POST', '/auth/register', { name: 'Player_1', password: 'secret123' });
  assert.equal(registered.status, 201);
  assert.deepEqual(registered.data, { id: '1', name: 'Player_1' });
  const saved = users.get('player_1');
  assert.notEqual(saved.passwordHash, 'secret123');
  assert.equal(await bcrypt.compare('secret123', saved.passwordHash), true);
  assert.deepEqual((await request('GET', '/me')).data, { user: { id: '1', name: 'Player_1' } });
  assert.deepEqual((await request('GET', '/protected-test')).data, { userId: '1' });
});

test('registration validates usernames and passwords', async () => {
  const request = client();
  for (const body of [
    { name: 'ab', password: 'secret123' },
    { name: 'bad name', password: 'secret123' },
    { name: 'ValidName', password: 'short' },
  ]) {
    assert.equal((await request('POST', '/auth/register', body)).status, 400);
  }
  assert.equal(users.size, 0);
});

test('registration rejects duplicate usernames regardless of case', async () => {
  const first = client();
  const second = client();
  assert.equal((await first('POST', '/auth/register', { name: 'PlayerTwo', password: 'secret123' })).status, 201);
  assert.equal((await second('POST', '/auth/register', { name: 'playertwo', password: 'secret456' })).status, 409);
  assert.equal(users.size, 1);
});

test('login, protected routes and logout enforce the session', async () => {
  const owner = client();
  const visitor = client();
  assert.equal((await owner('POST', '/auth/register', { name: 'PlayerThree', password: 'secret123' })).status, 201);
  assert.deepEqual((await visitor('GET', '/me')).data, { user: null });
  assert.equal((await visitor('GET', '/protected-test')).status, 401);
  assert.equal((await visitor('POST', '/auth/login', { name: 'unknown', password: 'secret123' })).status, 401);
  assert.equal((await visitor('POST', '/auth/login', { name: 'PlayerThree', password: 'wrong-password' })).status, 401);
  const login = await visitor('POST', '/auth/login', { name: 'playerthree', password: 'secret123' });
  assert.equal(login.status, 200);
  assert.deepEqual(login.data, { id: '1', name: 'PlayerThree' });
  assert.equal((await visitor('GET', '/protected-test')).status, 200);
  assert.equal((await visitor('POST', '/auth/logout')).status, 204);
  assert.deepEqual((await visitor('GET', '/me')).data, { user: null });
  assert.equal((await visitor('GET', '/protected-test')).status, 401);
});

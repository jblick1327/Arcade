const test = require('node:test');
const assert = require('node:assert/strict');
const { DoorGame } = require('../game.js');
const { connect } = require('../arcade.js');

function finishUntil(game, condition, limit = 2000) {
  for (let frame = 0; !condition(); frame++) {
    assert.ok(frame < limit, 'sequence completes');
    game.tick();
  }
}

test('only completed door crossings report their starting number', () => {
  const crossed = [];
  const game = new DoorGame({ walkedThrough: number => crossed.push(number) });
  finishUntil(game, () => !game.locked);
  assert.deepEqual(crossed, [], 'loading is not a score');
  game.press();
  assert.deepEqual(crossed, [], 'pressing A is not walking through');
  finishUntil(game, () => game.scene === 'hall1');
  assert.deepEqual(crossed, [0n], 'initial free door begins at zero');
  finishUntil(game, () => game.scene === 'room' && !game.locked);
  assert.equal(game.variables[1], 1n);
  finishUntil(game, () => game.variables[3] === 1);
  assert.deepEqual(crossed, [0n], 'countdown completion is not a score');
  game.press();
  finishUntil(game, () => game.scene === 'hall1');
  assert.deepEqual(crossed, [0n, 1n]);
  finishUntil(game, () => game.scene === 'room' && !game.locked);
  assert.equal(game.variables[1], 1n, 'next starting number is not credited early');
});

test('restored countdown scores the starting count, not remaining time', () => {
  const crossed = [];
  const game = new DoorGame({ walkedThrough: number => crossed.push(number), saved: {
    version: 2, variables: ['3', '5', '5', 0, '1', 2, 1], music: 'track2'
  } });
  finishUntil(game, () => !game.locked);
  finishUntil(game, () => game.variables[3] === 1);
  assert.equal(game.variables[4], 0n);
  game.press(); finishUntil(game, () => game.scene === 'hall1');
  assert.deepEqual(crossed, [5n]);
});

test('SDK gets one finite number per newly improved completed round', async () => {
  const calls = [];
  const bridge = await connect({ ready: async () => ({ user: { id: 'alice' } }),
    submitScore: async (...args) => { calls.push(args); return { ok: true }; } });
  for (const number of [0n, 1n, 1n, 2n, 1n, 3n]) await bridge.walkedThrough(number);
  assert.deepEqual(calls.map(call => call[0]), [0, 1, 2, 3]);
  assert.deepEqual(calls.at(-1)[1], { highestDoorStart: '3' });
});

test('save keys isolate users and guests without changing the Arcade API', async () => {
  const user = id => ({ ready: async () => ({ user: { id } }), submitScore: async () => ({ ok: true }) });
  const a = await connect(user('alice')), b = await connect(user('bob'));
  const guest = await connect({ ready: async () => ({ user: null }), submitScore: async () => ({ ok: false, reason: 'guest' }) });
  const local = await connect(null);
  assert.notEqual(a.progressKey('progress'), b.progressKey('progress'));
  assert.notEqual(a.progressKey('progress'), guest.progressKey('progress'));
  assert.equal(local.progressKey('progress'), 'progress');
});

test('guest, offline and failed submissions do not stop the game', async () => {
  const guest = await connect({ ready: async () => ({ user: null }), submitScore: async () => ({ ok: false, reason: 'guest' }) });
  assert.equal((await guest.walkedThrough(1n)).reason, 'guest');
  const broken = await connect({ ready: async () => { throw Error('offline'); }, submitScore: async () => { throw Error('network'); } });
  assert.equal((await broken.walkedThrough(2n)).reason, 'unavailable');
  assert.equal((await broken.walkedThrough(3n)).reason, 'unavailable');
  await (await connect(null)).walkedThrough(1n);
});

test('large endless counts stay within finite-number and metadata contracts', async () => {
  const calls = [];
  const bridge = await connect({ ready: async () => ({ user: { id: 'alice' } }), submitScore: async (...args) => { calls.push(args); return { ok: true }; } });
  await bridge.walkedThrough(9007199254740993n);
  assert.equal(calls[0][1].highestDoorStart, '9007199254740993');
  await bridge.walkedThrough(10n ** 1000n);
  assert.ok(Number.isFinite(calls[1][0]));
  assert.ok(JSON.stringify(calls[1][1]).length < 2000);
});

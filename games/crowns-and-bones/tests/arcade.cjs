const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const adapter = fs.readFileSync(path.join(dir, 'arcade.js'), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };

function hub(status = 'active') {
  return {
    data: { id: 'test-match', status, game: 'crowns-and-bones', version: 3, turn: 0,
      players: [0, 1, 2, 3].map(i => ({ id: String(i), name: 'Player_' + i })), state: null, winner: null },
    clients: [], writes: [], fail: null,
    view(you) { return { ...clone(this.data), you }; },
    push() { for (const c of this.clients) c.receive(this.view(c.seat)); },
    async update(seat, body, version) {
      this.writes.push({ seat, body: clone(body), version });
      await new Promise(setImmediate);
      if (this.fail === 'network') { this.fail = null; return { ok: false, reason: 'network' }; }
      if (this.fail === 'conflict') {
        this.fail = null; this.data.version++; this.data.state.players[0].cash += 17;
      }
      if (this.data.turn !== seat || this.data.version !== version || this.data.status !== 'active') {
        return { ok: false, reason: 'conflict', match: this.view(seat) };
      }
      assert(JSON.stringify(body.state).length <= 64000);
      assert(Number.isInteger(body.turn) && body.turn >= 0 && body.turn < 4);
      this.data.state = clone(body.state); this.data.turn = body.turn; this.data.version++;
      if (body.result) { this.data.status = 'done'; this.data.winner = body.result.winner; }
      this.push();
      return { ok: true, match: this.view(seat) };
    }
  };
}

function client(server, seat, { saved, embedded = false, offline = false } = {}) {
  const handlers = {}, storage = new Map(saved ? [['deadlock-autosave-v2', JSON.stringify(saved)]] : []);
  const app = { innerHTML: '' }, status = { textContent: '' };
  let doc;
  const element = () => ({ dataset: {}, scrollTop: 0, scrollLeft: 0, textContent: '',
    classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    contains() { return false; }, focus() { doc.activeElement = this; },
    matches() { return false; }, closest() { return null; } });
  const paper = element(), modal = element(), board = element(), toast = element();
  doc = { body: element(), activeElement: null, querySelectorAll() { return []; },
    addEventListener(name, fn) { handlers[name] = fn; },
    querySelector(selector) {
      if (selector === '#app') return app;
      if (selector === '#arcade-status') return status;
      if (selector === '#toast') return toast;
      if (selector === '.board-scroll') return app.innerHTML.includes('class="board-scroll') ? board : null;
      if (selector === '.folio') return app.innerHTML.includes('class="folio folio-') ? paper : null;
      if (selector === '.modal') return app.innerHTML.includes('class="modal"') ? modal : null;
      return null;
    }
  };
  let latest = server ? server.view(seat) : null, listeners = [], dice = [];
  const win = { scrollY: 0, scrollTo() {}, location: { reload() {} } };
  win.parent = embedded ? {} : win;
  win.Arcade = {
    ready: async () => ({ user: seat === null ? null : { id: String(seat), name: 'Player_' + seat }, match: latest, offline }),
    submitScore() { throw new Error('Local games and match wins must not submit a single-player score'); },
    match: {
      get: () => latest,
      onChange(fn) { listeners.push(fn); return () => {}; },
      async update(body) {
        const result = await server.update(seat, body, latest.version);
        if (result.match && result.match.version > latest.version) latest = clone(result.match);
        return result;
      }
    }
  };
  const math = Object.create(Math); math.random = () => dice.length ? dice.shift() : .4;
  const context = { window: win, document: doc, console, queueMicrotask, Math: math,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v) }, confirm: () => true };
  vm.createContext(context); vm.runInContext(adapter, context); vm.runInContext(code, context);
  const c = { seat, app, status, storage, game: win.__crownsAndBones, room: win.CrownsArcade,
    receive(match) {
      if (latest && match.version <= latest.version) return;
      latest = clone(match); for (const fn of listeners) fn(latest);
    },
    click(data, { folio = false, required = false } = {}) {
      const el = element(); el.dataset = data;
      el.closest = selector => {
        if (selector === '.folio-wrap') return folio ? el : null;
        if (selector === '.modal-wrap') return required ? el : null;
        const attr = selector.match(/^\[data-([a-z-]+)\]$/)?.[1];
        const key = attr?.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        return key && data[key] !== undefined ? el : null;
      };
      handlers.click({ target: el });
    },
    key(key) { handlers.keydown({ key, target: element(), preventDefault() {} }); },
    dice(...values) { dice = values; }
  };
  if (server) server.clients.push(c);
  return c;
}

test('registry metadata and the SDK entry point match Arcade conventions', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'game.json')));
  assert.equal(meta.mode, 'match'); assert.equal(meta.maxPlayers, 4);
  assert.equal(meta.description, 'Work in progress — player feedback welcome.');
  assert(html.includes('<script src="/sdk/arcade.js"></script>'));
  assert(!html.includes('game-switches'));
  assert(!html.includes('Four courts enter. Only one can own the board.'));
});

test('one host initializes four shared seats; local saves cannot seed an online match', async () => {
  const local = client(null, null); await flush(); local.game.state.players[0].cash = 99;
  const h = hub(); const clients = [0, 1, 2, 3].map(i => client(h, i, { saved: local.game.state }));
  await flush();
  assert.equal(h.writes.length, 1);
  assert.equal(h.data.state.players[0].cash, 1500);
  for (const c of clients) assert.equal(JSON.stringify(c.room.snapshot(c.game.state)), JSON.stringify(h.data.state));
  assert(clients[0].room.canAct()); assert(!clients[1].room.canAct());
  assert(clients[1].status.textContent.includes('Azure Syndicate'));
  assert(clients[0].app.innerHTML.includes('Player_0'));
  assert(!clients[0].storage.has('deadlock-save-v2'));
});

test('waiting players and spectators cannot write; only a host starts a filled match', async () => {
  const h = hub('waiting'); h.data.players = h.data.players.slice(0, 2);
  const host = client(h, 0), guest = client(h, null); await flush();
  host.click({ act: 'rollMove' }); guest.key('m'); await flush(); assert.equal(h.writes.length, 0);
  assert(host.status.textContent.includes('2/4'));
  h.data.players = [0, 1, 2, 3].map(i => ({ id: String(i), name: 'Player_' + i }));
  h.data.status = 'active'; h.data.version++; h.push(); await flush();
  assert.equal(h.writes.length, 1); assert(h.data.state);
  assert(guest.app.innerHTML.includes('Player hands are not shown to spectators.'));
  guest.click({ folio: 'domino' }); assert(guest.app.innerHTML.includes('Player hands are not shown to spectators.'));
  guest.key('Escape'); guest.click({ act: 'rollMove' }); await flush(); assert.equal(h.writes.length, 1);
});

test('on-table dominoes, dice and end-turn actions sync once; other seats and UI reads do not write', async () => {
  const h = hub(), a = client(h, 0), b = client(h, 1); await flush();
  const before = h.writes.length, count = a.game.state.players[0].dominoHand.length;
  b.click({ act: 'rollMove' }); b.click({ domino: '0' }); a.click({ tile: '0-1' }); a.key('Escape'); await flush();
  assert.equal(h.writes.length, before);
  a.click({ domino: '0' }); assert(!a.room.canAct(), 'Saving immediately blocks a second mutation'); await flush();
  assert.equal(h.writes.length, before + 1);
  assert.equal(b.game.state.players[0].dominoHand.length, count - 1);
  assert(b.game.state.players[0].momentum > 0);
  a.dice(0, .2); a.click({ act: 'rollMove' }); await flush();
  assert.equal(h.data.state.players[0].momentum, 0);
  if (a.game.state.pendingPurchase) { a.click({ act: 'skipProperty' }); await flush(); }
  a.click({ act: 'endTurn' }); await flush();
  assert.equal(h.data.turn, 1); assert.equal(h.data.state.turnIndex, 1);
  assert(b.room.canAct()); assert(!a.room.canAct());
  assert.equal(h.data.state.selectedTile, null);
  assert.equal(h.data.state.selectedTab, 'monopoly');
});

test('online auctions rotate bidders, settle, and return control to the interrupted court', async () => {
  const h = hub(), cs = [0, 1, 2, 3].map(i => client(h, i)); await flush();
  const a = cs[0]; a.dice(0, 0); a.click({ act: 'rollMove' }); await flush();
  assert(a.game.state.pendingPurchase);
  a.click({ act: 'auctionProperty' }); await flush();
  assert.equal(h.data.state.auction.actor, 0); assert.equal(h.data.turn, 0);
  const space = h.data.state.auction.sourceTile;
  cs[1].click({ act: 'bidAuction', who: '1', delta: '25' }, { required: true }); await flush();
  assert.equal(h.data.state.auction.highest, 0);
  a.click({ act: 'bidAuction', who: '0', delta: '25' }, { required: true }); await flush();
  assert.equal(h.data.turn, 1);
  for (let seat = 1; seat < 4; seat++) {
    cs[seat].click({ act: 'passAuction' }, { required: true }); await flush();
  }
  assert.equal(h.data.state.auction, null); assert.equal(h.data.turn, 0);
  const tile = h.data.state.rings.flat().find(t => t.id === space);
  assert.equal(tile.owner, 0); assert.equal(h.data.state.players[0].cash, 1475);
  assert.equal(h.data.state.pendingPurchase, null);
});

test('a no-bid auction closes cleanly; a seller cannot bid on their own captured piece', async () => {
  const h = hub(), cs = [0, 1, 2, 3].map(i => client(h, i)); await flush();
  cs[0].dice(0, 0); cs[0].click({ act: 'rollMove' }); await flush();
  cs[0].click({ act: 'auctionProperty' }); await flush();
  for (let i = 0; i < 4; i++) { cs[i].click({ act: 'passAuction' }, { required: true }); await flush(); }
  assert.equal(h.data.state.auction, null); assert.equal(h.data.state.pendingPurchase, null);
  cs[0].game.state.players[0].loot.push('pawn'); cs[0].game.render(); await flush();
  cs[0].click({ folio: 'chess' });
  cs[0].click({ act: 'auctionLoot', index: '0' }, { folio: true }); await flush();
  assert.equal(h.data.turn, 1); assert.equal(h.data.state.auction.seller, 0);
  cs[1].click({ act: 'bidAuction', who: '1', delta: '100' }, { required: true }); await flush();
  cs[2].click({ act: 'passAuction' }, { required: true }); await flush();
  cs[3].click({ act: 'passAuction' }, { required: true }); await flush();
  assert.equal(h.data.state.auction, null); assert.equal(h.data.turn, 0);
  assert.equal(h.data.state.players[1].reserve[0], 'pawn');
  assert.equal(h.data.state.players[0].cash, 1600);
});

test('conflicts restore the authoritative position; ambiguous failures lock play until a newer update', async () => {
  const h = hub(), a = client(h, 0); await flush(); h.fail = 'conflict';
  a.click({ domino: '0' }); await flush();
  assert.equal(a.game.state.players[0].cash, 1517);
  assert.equal(a.game.state.chain.length, 0);
  assert(a.room.canAct());
  h.fail = 'network'; a.click({ domino: '0' }); await flush();
  assert(!a.room.canAct()); assert(a.app.innerHTML.includes('Reload match'));
  const writes = h.writes.length; a.key('m'); a.click({ domino: '0' }); await flush();
  assert.equal(h.writes.length, writes);
  assert.equal(a.game.state.chain.length, 0);
  h.data.version++; h.push(); await flush(); assert(a.room.canAct());
  const reconnect = client(h, 0); await flush();
  assert.equal(JSON.stringify(reconnect.room.snapshot(reconnect.game.state)), JSON.stringify(h.data.state));
  assert.equal(h.writes.length, writes);
});

test('an auction with no eligible bidders cannot strand the match on a null turn', async () => {
  const h = hub(), a = client(h, 0); await flush();
  for (const p of a.game.state.players.slice(1)) p.bankrupt = true;
  a.game.state.players[0].loot.push('pawn'); a.game.render(); await flush();
  a.click({ folio: 'chess' });
  a.click({ act: 'auctionLoot', index: '0' }, { folio: true }); await flush();
  assert.equal(h.data.state.auction, null); assert.equal(h.data.turn, 0);
  assert.equal(h.data.state.players[0].loot[0], 'pawn');
});

test('match completion reports the winning seat once; finished matches cannot mutate or reset', async () => {
  const h = hub(), a = client(h, 0); await flush();
  for (const p of a.game.state.players.slice(1)) { p.bankrupt = p.dominoOut = p.chessOut = true; }
  a.game.render(); await flush();
  assert.equal(h.data.status, 'done'); assert.equal(h.data.winner, 0);
  assert.equal(h.writes.filter(w => w.body.result).length, 1);
  a.click({ act: 'dismissWinner' }, { required: true }); a.game.render(); await flush();
  assert.equal(h.writes.filter(w => w.body.result).length, 1);
  a.click({ act: 'resetGame' }); a.key('r'); await flush(); assert.equal(h.data.status, 'done');
});

test('local play keeps manual saves and rules/chess/domino apparatus without submitting scores', async () => {
  const c = client(null, null); await flush(); assert(c.room.canAct());
  c.click({ folio: 'session' }); c.click({ act: 'saveGame' }, { folio: true });
  assert(c.storage.has('deadlock-save-v2')); c.key('Escape');
  for (const view of ['chess', 'rules', 'domino', 'jokers', 'courts', 'chronicle']) {
    c.click({ folio: view }); assert(c.app.innerHTML.includes('folio-' + view)); c.key('Escape');
  }
  c.click({ domino: '0' }); assert(c.game.state.turn.dominoUsed);
  const pawn = c.game.state.chess.find(p => p.owner === 0 && p.type === 'pawn');
  c.click({ folio: 'chess' });
  c.click({ square: `${pawn.x},${pawn.y}` }, { folio: true });
  c.click({ square: `${pawn.x},${pawn.y + 1}` }, { folio: true });
  assert.equal(c.game.state.turn.chessUsed, 1);
  c.key('Escape'); c.dice(0, .2); c.key('m'); assert(c.game.state.lastRoll);
});

test('an embedded SDK connection failure never silently enables local match controls', async () => {
  const c = client(null, null, { embedded: true, offline: true }); await flush();
  assert(!c.room.canAct()); assert(c.status.textContent.includes('could not connect'));
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const rules = require('../rules.js');

class Element {
  children = [];
  dataset = {};
  listeners = {};
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(event, callback) { this.listeners[event] = callback; }
  setAttribute() {}
  focus() {}
}

test('Scarab keeps accepting placements during a clear and plays one cue per outcome', async () => {
  const card = rank => ({ rank, suit: 'hearts' });
  const game = {
    ...rules.newGame(),
    columns: [[card('10')], [], [], [], []],
    card: card('A'),
    deck: [card('2'), card('3')],
  };
  const played = [];
  class AudioContext {
    state = 'running';
    createGain() {
      return { gain: { setTargetAtTime() {} }, connect() {} };
    }
    createBufferSource() {
      return { playbackRate: {}, connect() {}, start() { played.push(this.buffer); } };
    }
    async decodeAudioData(file) { return file; }
  }
  const elements = new Map();
  const document = new Element();
  document.createElement = () => new Element();
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const window = {
    AudioContext,
    Scarab21: { ...rules, newGame: () => game },
    matchMedia: () => ({ matches: false }),
  };
  const fetch = async url => ({
    ok: fs.statSync(path.join(__dirname, '..', url)).isFile(),
    arrayBuffer: async () => path.basename(url, '.wav'),
  });
  const context = vm.createContext({ window, document, fetch, console });
  for (const script of ['audio', 'app']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, `../${script}.js`), 'utf8'), context);
  }
  const toggle = elements.get('sound');
  toggle.checked = true;
  toggle.listeners.change();
  assert.deepEqual(played, [], 'Enabling sound has no cold-load preview');
  await new Promise(setImmediate);

  document.listeners.keydown({ key: '1' });
  assert.equal(elements.get('score').textContent, 21);
  assert.equal(elements.get('columns').children[0].children.at(-1).textContent, 'Blackjack +21');
  document.listeners.keydown({ key: '2' });
  assert.deepEqual(game.columns[1], [card('3')]);
  assert.deepEqual(played, ['column-clear', 'place']);
  game.columns = [[card('6'), card('7')], [card('6'), card('7')],
    [card('6'), card('7')], [card('6'), card('7')], [card('8')]];
  game.card = card('10');
  game.deck = [card('4'), card('K')];
  document.listeners.keydown({ key: '5' });
  assert.equal(game.over, true);
  assert.match(elements.get('result').textContent, /No column can take the King/);
  assert.deepEqual(played, ['column-clear', 'place', 'end']);
  toggle.checked = false;
  toggle.listeners.change();
  window.ScarabAudio.play('place');
  assert.deepEqual(played, ['column-clear', 'place', 'end']);
});

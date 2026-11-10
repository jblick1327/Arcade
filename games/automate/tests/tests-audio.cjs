const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('Automate plays decoded samples and respects mute', async () => {
  const played = [];
  class AudioContext {
    currentTime = 1;
    state = 'running';
    createGain() {
      return { gain: { setTargetAtTime() {} }, connect() {} };
    }
    createBufferSource() {
      return { playbackRate: {}, connect() {}, start() { played.push(this.buffer); } };
    }
    async decodeAudioData(file) { return file; }
  }
  const window = { AudioContext };
  const fetch = async url => ({
    ok: fs.statSync(path.join(__dirname, '..', url)).isFile(),
    arrayBuffer: async () => path.basename(url, '.wav'),
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../audio.js'), 'utf8'), { window, fetch, console });
  const audio = window.AutomateAudio;
  audio.play('move');
  assert.deepEqual(played, []);
  audio.setEnabled(true);
  audio.play('move');
  assert.deepEqual(played, [], 'Decoding plays no placeholder');
  await new Promise(setImmediate);

  audio.play('move');
  audio.play('castle');
  audio.play('checkmate', { capture: true });
  audio.setEnabled(false);
  audio.play('draw');
  assert.deepEqual(played, ['piece', 'piece', 'piece', 'capture', 'checkmate']);
});

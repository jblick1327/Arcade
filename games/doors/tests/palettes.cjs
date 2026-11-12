const test = require('node:test');
const assert = require('node:assert/strict');
const { presets, paletteAt, lookup } = require('../palettes.js');

const staticPresets = presets.filter(p => !p.motion);
const animatedPresets = presets.filter(p => p.motion);
const added = ['opal', 'tide', 'eclipse', 'signal', 'mirage'];

test('original still palettes remain intact and five experimental animations are added', () => {
  assert.equal(presets.length, 37);
  assert.equal(staticPresets.length, 28);
  assert.equal(animatedPresets.length, 9);
  assert.deepEqual(presets.slice(0, 2).map(p => p.id), ['original', 'dmg']);
  assert.deepEqual(animatedPresets.map(p => p.id).slice(-5), added);
  assert.deepEqual(paletteAt('original'), ['#ffffff', '#aaaaaa', '#555555', '#000000']);
  assert.deepEqual(paletteAt('dmg'), ['#e0f8d0', '#88c070', '#346856', '#081820']);
});

test('every palette always produces exactly four valid display colors', () => {
  for (const p of presets) for (const time of [0, 0.7, 4.2, 19, 70]) {
    const colors = paletteAt(p.id, time);
    assert.equal(colors.length, 4, p.id);
    for (const c of colors) assert.match(c, /^#[0-9a-f]{6}$/i, p.id);
  }
});

test('still palettes never animate, and moving palettes do', () => {
  for (const p of staticPresets) assert.deepEqual(paletteAt(p.id, 13), paletteAt(p.id, 0));
  for (const p of animatedPresets) assert.notDeepEqual(paletteAt(p.id, 5), paletteAt(p.id, 0), p.id);
});

test('reduced motion freezes each animation at its original colors', () => {
  for (const p of animatedPresets) {
    const initial = paletteAt(p.id, 0);
    assert.deepEqual(paletteAt(p.id, 999, true), initial, p.id);
    assert.deepEqual(paletteAt(p.id, 12, true), initial, p.id);
  }
});

test('signal is stepped but time-dependent; tide and mirage use spatial effects', () => {
  assert.deepEqual(paletteAt('signal', 1), paletteAt('signal', 1.1));
  assert.notDeepEqual(paletteAt('signal', 1), paletteAt('signal', 2));
  for (const id of ['signal', 'tide', 'mirage']) {
    assert.ok(presets.find(p => p.id === id).motion.warp);
  }
});

test('four-color lookup preserves luminance ordering', () => {
  assert.equal(lookup(0, 'dmg'), paletteAt('dmg')[3]);
  assert.equal(lookup(255, 'dmg'), paletteAt('dmg')[0]);
  assert.deepEqual(paletteAt('not-found'), paletteAt('original'));
});

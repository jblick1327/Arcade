/* Four-color display palettes. Native canvas pixels remain untouched. */
(function (global) {
  'use strict';
  const definitions = [
    ['original', 'Original grayscale', ['ffffff', 'aaaaaa', '555555', '000000']],
    ['dmg', 'Classic Game Boy', ['e0f8d0', '88c070', '346856', '081820']],
    ['olive', 'Olive LCD', ['d6df92', '9aaf51', '526b31', '20351f']],
    ['pea', 'Pea green', ['d9e7a1', '9bbb63', '4b7345', '18372c']],
    ['pocket', 'Game Boy Pocket', ['e9ebdb', 'aab3a1', '596558', '202b27']],
    ['light', 'Game Boy Light', ['c9fff2', '76c6ad', '367a6c', '113a35']],
    ['amber', 'Amber monitor', ['fff1b2', 'efb547', 'a15d24', '2e1b13']],
    ['sepia', 'Sepia paper', ['fff0ce', 'c9a779', '806044', '32261e']],
    ['ice', 'Ice blue', ['e8fbff', '8ebfdd', '466e9b', '142b4e']],
    ['blue', 'Blue cartridge', ['e2efff', '89a4ed', '4d51a2', '181d49']],
    ['rose', 'Rose cartridge', ['ffe6ef', 'd99eb7', '934f77', '341b3a']],
    ['lavender', 'Lavender LCD', ['f2eaff', 'b7a4d9', '6b5b91', '251d3d']],
    ['candy', 'Candy pink and cyan', ['fff1fa', 'ff77ca', '34b9cc', '22204f']],
    ['acid', 'Acid yellow', ['f7ff92', 'bcff00', '49752a', '122b2b']],
    ['vapor', 'Vaporwave', ['ffbfff', '70e7f4', '8b4cc0', '24123f']],
    ['sunset', 'Sunset', ['fff0a1', 'ffac70', 'c3436e', '391e50']],
    ['thermal', 'Thermal vision', ['fff69b', 'ff8c31', 'b92b68', '241e53']],
    ['solar', 'Solar blue', ['fff6c5', 'e3b55d', '397f92', '123744']],
    ['mint', 'Mint chocolate', ['ecffd7', '8cd9a5', '567365', '2b2830']],
    ['copper', 'Copper oxide', ['ffead0', 'c79259', '438e83', '193b3a']],
    ['radioactive', 'Radioactive', ['f3ffb1', '55ff63', '24876a', '102b41']],
    ['laser', 'Laser red', ['ffe2b6', 'ff6270', 'a22a57', '281937']],
    ['electric', 'Electric blue', ['e5fffe', '47d9ff', '4961ef', '201245']],
    ['orchid', 'Orchid', ['fff3be', 'e688d6', '8146ae', '292447']],
    ['terminal', 'Green terminal', ['c3ffac', '5fcb6c', '285e43', '071e1b']],
    ['infrared', 'Infrared', ['ffe9ec', 'ff4d99', '5f37ad', '140e31']],
    ['negative', 'Photographic negative', ['111624', '57667e', 'b4c7d5', 'f6fff6']],
    ['ultraviolet', 'Ultraviolet negative', ['27154d', '872caa', 'ec82ff', 'f6f8bb']],
    ['aurora', 'Animated aurora', null, { period: 48, hue: [145, 175, 245, 275], saturation: [75, 85, 62, 60], lightness: [88, 66, 35, 12] }],
    ['spectrum', 'Animated spectrum', null, { period: 36, hue: [40, 115, 225, 300], saturation: [95, 90, 80, 72], lightness: [86, 64, 35, 11] }],
    ['liquid', 'Animated liquid neon', null, { period: 60, hue: [85, 145, 295, 220], saturation: [90, 94, 83, 72], lightness: [85, 62, 38, 10], sway: 70 }],
    ['dream', 'Animated psychedelic dream', null, { period: 44, hue: [325, 45, 190, 265], saturation: [90, 94, 87, 63], lightness: [88, 65, 37, 13], sway: 105 }],
    ['opal', 'Opal interference', null, { kind: 'interference', period: 26, hue: [165, 265, 345, 225], saturation: [90, 85, 76, 78], lightness: [88, 66, 38, 11] }],
    ['tide', 'Bioluminescent tide', null, { kind: 'tide', period: 32, hue: [160, 190, 225, 268], saturation: [87, 83, 75, 70], lightness: [86, 62, 32, 10], warp: { amount: 2.5, frequency: 0.018 } }],
    ['eclipse', 'Solar eclipse', null, { kind: 'eclipse', period: 38, hue: [45, 15, 332, 250], saturation: [95, 92, 83, 72], lightness: [90, 65, 35, 12] }],
    ['signal', 'Corrupted signal', null, { kind: 'signal', period: 24, hue: [50, 170, 292, 240], saturation: [92, 94, 87, 84], lightness: [88, 63, 36, 12], warp: { amount: 6, frequency: 0.045 } }],
    ['mirage', 'Chromatic mirage', null, { kind: 'mirage', period: 29, hue: [315, 75, 190, 255], saturation: [95, 94, 86, 74], lightness: [90, 66, 35, 11], warp: { amount: 4, frequency: 0.024 } }]
  ];

  function hsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const channel = n => {
      const k = (n + h * 12) % 12;
      return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
    };
    return '#' + channel(0) + channel(8) + channel(4);
  }

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function animatedColors(motion, time) {
    const t = Number.isFinite(time) ? time : 0;
    const turn = t / motion.period;
    const phase = turn * Math.PI * 2;
    // Existing four animations keep their original pitch of color change.
    if (!motion.kind) return motion.hue.map((hue, index) => hsl(
      motion.sway ? hue + motion.sway * Math.sin(phase + index * 0.7) : hue + turn * 360,
      motion.saturation[index], motion.lightness[index]
    ));

    // New presets use different motion profiles, rather than only rotating hue.
    // Preserve four display tones at every instant: no brightness flicker or flashing frames.
    return motion.hue.map((hue, i) => {
      let saturation = motion.saturation[i], lightness = motion.lightness[i];
      if (motion.kind === 'interference') {
        hue += 118 * Math.sin(phase * (i % 3 + 1) + i * 1.5) + 35 * Math.sin(phase * 4 - i);
        lightness += 7 * Math.sin(phase * 2 + i * 1.3);
      } else if (motion.kind === 'tide') {
        hue += 65 * Math.sin(phase + i * 0.8) + 18 * Math.cos(phase * 2 - i);
        saturation += 10 * Math.cos(phase + i * 1.2);
        lightness += 9 * Math.sin(phase + i * 0.6);
      } else if (motion.kind === 'eclipse') {
        hue += 95 * Math.sin(phase + i * 0.65);
        lightness += (i % 2 ? -1 : 1) * 12 * Math.sin(phase) + 6 * Math.cos(phase * 2 + i);
      } else if (motion.kind === 'signal') {
        // Deterministic stepped 'broken transmission' color jumps (~1.5 Hz).
        const step = Math.floor(t * 1.5);
        const rand = seed => { const x = Math.sin(seed * 127.1 + 78.233) * 43758.5453; return x - Math.floor(x); };
        hue += (Math.floor(rand(step * 7 + i) * 7) - 3) * 34;
        lightness += (rand(step * 11 + i + 91) - 0.5) * 18;
      } else if (motion.kind === 'mirage') {
        hue += 160 * Math.sin(phase * 2 + i * Math.PI / 2) + 25 * Math.sin(phase * 5 - i);
        saturation += 8 * Math.cos(phase * 3 + i);
        lightness += 9 * Math.sin(phase * 3 + i * 0.6);
      }
      return hsl(hue, clamp(saturation, 20, 100), clamp(lightness, 3, 96));
    });
  }

  const presets = Object.freeze(definitions.map(([id, name, colors, motion]) => Object.freeze({
    id, name, colors: Object.freeze(colors ? colors.map(c => '#' + c) : animatedColors(motion, 0)),
    ...(motion ? { motion } : {})
  })));
  const byId = new Map(presets.map(p => [p.id, p]));
  function paletteAt(id, time = 0, reducedMotion = false) {
    const preset = byId.get(id) || presets[0];
    return preset.motion && !reducedMotion ? animatedColors(preset.motion, time) : [...preset.colors];
  }
  function lookup(grayByte, id = 'original', time = 0) {
    const index = 3 - Math.max(0, Math.min(3, Math.round(Number(grayByte) / 85)));
    return paletteAt(id, time)[index];
  }

  let serial = 0;
  function install(canvas, container, options = {}) {
    const doc = canvas.ownerDocument;
    const view = doc.defaultView || global;
    const ns = 'http://www.w3.org/2000/svg';
    const element = name => doc.createElementNS(ns, name);
    const svg = element('svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    const defs = element('defs');
    const filter = element('filter');
    const id = 'door-palette-' + (++serial);
    filter.id = id;
    for (const [key, value] of Object.entries({ x: '0', y: '0', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' })) filter.setAttribute(key, value);
    const transfer = element('feComponentTransfer');
    const channels = ['R', 'G', 'B'].map(channel => {
      const fn = element('feFunc' + channel); fn.setAttribute('type', 'table'); transfer.append(fn); return fn;
    });
    filter.append(transfer); defs.append(filter);
    // Optional low-amplitude texture displacement makes the experimental
    // presets spatial, rather than just a uniform color-table animation.
    const warpId = id + '-warp';
    const warpFilter = element('filter');
    warpFilter.id = warpId;
    for (const [key, value] of Object.entries({ x: '-8%', y: '-8%', width: '116%', height: '116%' })) warpFilter.setAttribute(key, value);
    const texture = element('feTurbulence');
    texture.setAttribute('type', 'fractalNoise');
    texture.setAttribute('numOctaves', '1');
    texture.setAttribute('baseFrequency', '0.018');
    texture.setAttribute('result', 'texture');
    const displacement = element('feDisplacementMap');
    displacement.setAttribute('in', 'SourceGraphic');
    displacement.setAttribute('in2', 'texture');
    displacement.setAttribute('xChannelSelector', 'R');
    displacement.setAttribute('yChannelSelector', 'G');
    displacement.setAttribute('scale', '0');
    warpFilter.append(texture, displacement);
    defs.append(warpFilter);
    svg.append(defs); container.append(svg);
    container.classList.add('palette-picker');
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Display colors');
    const stillRow = doc.createElement('div'), movingRow = doc.createElement('div');
    stillRow.className = movingRow.className = 'palette-row';
    stillRow.setAttribute('role', 'group');
    stillRow.setAttribute('aria-label', 'Still palettes');
    movingRow.setAttribute('role', 'group');
    movingRow.setAttribute('aria-label', 'Animated palettes');
    const divider = doc.createElement('div');
    divider.className = 'palette-divider';
    divider.setAttribute('aria-hidden', 'true');
    container.append(stillRow, divider, movingRow);
    const detail = container.closest?.('details');
    const preview = doc.getElementById?.('palette-current');
    let storage;
    try { storage = options.storage === false ? null : options.storage || view.localStorage; } catch (_) { storage = null; }
    const storageKey = options.storageKey || 'door-palette';
    let selected = 'original';
    try { const saved = storage && storage.getItem(storageKey); if (byId.has(saved)) selected = saved; } catch (_) { /* Private browser storage may be unavailable. */ }
    let frame = 0, lastTime = -Infinity, destroyed = false;
    const media = view.matchMedia ? view.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reduced = !!(media && media.matches);
    const now = () => view.performance ? view.performance.now() : Date.now();
    const origin = now();
    const buttons = presets.map(preset => {
      const button = doc.createElement('button');
      button.type = 'button'; button.className = 'palette-swatch';
      button.dataset.palette = preset.id;
      button.setAttribute('aria-label', preset.name);
      const c = preset.colors;
      button.style.background = swatchBackground(c);
      button.addEventListener('click', () => select(preset.id));
      (preset.motion ? movingRow : stillRow).append(button); return button;
    });
    function swatchBackground(colors) {
      return `conic-gradient(${colors[0]} 0 25%,${colors[1]} 25% 50%,${colors[2]} 50% 75%,${colors[3]} 75% 100%)`;
    }
    function paint(time) {
      const colors = paletteAt(selected, time, reduced);
      if (preview) preview.style.background = swatchBackground(colors);
      const reversed = [...colors].reverse();
      channels.forEach((fn, channel) => fn.setAttribute('tableValues', reversed.map(color => (parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16) / 255).toFixed(6)).join(' ')));
      const motion = byId.get(selected).motion;
      if (motion?.warp && !reduced) {
        const phase = time / motion.period * Math.PI * 2;
        const jitter = motion.kind === 'signal' ? Math.floor(time * 1.5) : 1;
        texture.setAttribute('seed', String(1 + jitter % 97));
        texture.setAttribute('baseFrequency', `${(motion.warp.frequency * (1 + 0.25 * Math.sin(phase))).toFixed(4)} ${(motion.warp.frequency * (1.4 + 0.2 * Math.cos(phase))).toFixed(4)}`);
        displacement.setAttribute('scale', String(motion.warp.amount * (0.75 + 0.25 * Math.sin(phase * 2))));
      }
      canvas.style.filter = selected === 'original' ? 'none' : motion?.warp && !reduced ? `url(#${id}) url(#${warpId})` : `url(#${id})`;
    }
    function wantsAnimation() {
      return !reduced && (Boolean(byId.get(selected).motion) || Boolean(detail?.open));
    }
    function animate(time) {
      if (destroyed || !wantsAnimation()) return;
      if (time - lastTime >= 80) {
        const seconds = (time - origin) / 1000;
        if (byId.get(selected).motion) paint(seconds);
        // Moving previews make the dividing rule self-explanatory, without labels.
        if (detail?.open) presets.filter(p => p.motion).forEach(p => {
          const button = buttons[byIdIndex.get(p.id)];
          button.style.background = swatchBackground(paletteAt(p.id, seconds));
        });
        lastTime = time;
      }
      frame = view.requestAnimationFrame(animate);
    }
    const byIdIndex = new Map(presets.map((p, i) => [p.id, i]));
    function restartAnimation() {
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0; lastTime = -Infinity;
      if (wantsAnimation()) frame = view.requestAnimationFrame(animate);
    }
    function select(next) {
      if (!byId.has(next)) next = 'original';
      selected = next;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === selected)));
      paint((now() - origin) / 1000);
      try { if (storage) storage.setItem(storageKey, selected); } catch (_) { /* Selection still works without persistence. */ }
      restartAnimation();
    }
    function motionChanged(event) { reduced = event.matches; select(selected); }
    function drawerChanged() { restartAnimation(); }
    if (detail) detail.addEventListener('toggle', drawerChanged);
    if (media) {
      if (media.addEventListener) media.addEventListener('change', motionChanged);
      else if (media.addListener) media.addListener(motionChanged);
    }
    select(selected);
    return {
      select,
      get selected() { return selected; },
      destroy() {
        destroyed = true;
        if (frame) view.cancelAnimationFrame(frame);
        if (detail) detail.removeEventListener('toggle', drawerChanged);
        if (media && media.removeEventListener) media.removeEventListener('change', motionChanged);
        else if (media && media.removeListener) media.removeListener(motionChanged);
        buttons.forEach(button => button.remove());
        stillRow.remove(); movingRow.remove(); divider.remove(); svg.remove(); canvas.style.filter = 'none';
      }
    };
  }
  const api = { presets, paletteAt, lookup, install };
  global.DoorPalettes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

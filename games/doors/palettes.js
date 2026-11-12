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
    ['dream', 'Animated psychedelic dream', null, { period: 44, hue: [325, 45, 190, 265], saturation: [90, 94, 87, 63], lightness: [88, 65, 37, 13], sway: 105 }]
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

  function animatedColors(motion, time) {
    const turn = (Number.isFinite(time) ? time : 0) / motion.period;
    return motion.hue.map((hue, index) => hsl(
      motion.sway ? hue + motion.sway * Math.sin(turn * Math.PI * 2 + index * 0.7) : hue + turn * 360,
      motion.saturation[index], motion.lightness[index]
    ));
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
    filter.append(transfer); defs.append(filter); svg.append(defs); container.append(svg);
    container.classList.add('palette-picker');
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Display colors');
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
      button.style.background = `conic-gradient(${c[0]} 0 25%,${c[1]} 25% 50%,${c[2]} 50% 75%,${c[3]} 75% 100%)`;
      button.addEventListener('click', () => select(preset.id));
      container.append(button); return button;
    });
    function paint(time) {
      const colors = paletteAt(selected, time, reduced).reverse();
      channels.forEach((fn, channel) => fn.setAttribute('tableValues', colors.map(color => (parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16) / 255).toFixed(6)).join(' ')));
      canvas.style.filter = selected === 'original' ? 'none' : `url(#${id})`;
    }
    function animate(time) {
      if (destroyed || reduced || !byId.get(selected).motion) return;
      if (time - lastTime >= 80) { paint((time - origin) / 1000); lastTime = time; }
      frame = view.requestAnimationFrame(animate);
    }
    function select(next) {
      if (!byId.has(next)) next = 'original';
      selected = next;
      if (frame) view.cancelAnimationFrame(frame);
      frame = 0; lastTime = -Infinity;
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.palette === selected)));
      paint((now() - origin) / 1000);
      try { if (storage) storage.setItem(storageKey, selected); } catch (_) { /* Selection still works without persistence. */ }
      if (!reduced && byId.get(selected).motion) frame = view.requestAnimationFrame(animate);
    }
    function motionChanged(event) { reduced = event.matches; select(selected); }
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
        if (media && media.removeEventListener) media.removeEventListener('change', motionChanged);
        else if (media && media.removeListener) media.removeListener(motionChanged);
        buttons.forEach(button => button.remove()); svg.remove(); canvas.style.filter = 'none';
      }
    };
  }
  const api = { presets, paletteAt, lookup, install };
  global.DoorPalettes = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

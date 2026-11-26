// map.js - Boarded Up maps and the map parser
// Author: Reachnid Group
// Centennial College - Fall 2026

// Level definition + parser.
//
// Legend
//   #  brick wall            =  concrete wall
//   .  floor                 S  player start (floor)
//   B  boarded window (zombies come in through these)
//   %  steel wall            &  pipe wall      !  hazard wall     ^  tiled wall
//   ,  open-air floor (dirt underfoot, sky overhead)
//   _  concrete floor, metal ceiling      +  steel grating, metal ceiling
//   :  concrete floor under open sky (helipad, roads)
//   D / E / F  debris doors costing 750 / 1000 / 1250
//   P  blast door, opens when the power comes on
//   L  locked security door (opened by story missions; see level.locks)
//   s m r d a  wall-buy for shotgun / smg / rifle / double-barrel / auto-shotgun
//   X  mystery crate    J  Iron Hide perk    Q  Quick Hands perk
//   G  generator (restores power)    T  electric trap console (see level.traps)
//   C  stack of crates (solid cover)
//
// The building is surrounded by MARGIN tiles of open "outside" ground where
// zombies spawn and walk up to the windows.

import { hash2 } from './pixel.js';

export const K = { OUTSIDE: 0, FLOOR: 1, WALL: 2, DOOR: 3, WINDOW: 4, WALLBUY: 5 };
export const FLOOR_KIND = { TILE: 0, DIRT: 1, CONCRETE: 2, GRATE: 3 };
export const CEIL_KIND = { TILE: 0, SKY: 1, METAL: 2 };

// Wall texture ids (renderer maps these to textures.walls[name]).
export const WALL_TEX = [
  'brick',
  'brick2',
  'brickBlood',
  'concrete',
  'concrete2',
  'door',
  'buy_shotgun',
  'buy_smg',
  'buy_rifle',
  'metal',
  'metal2',
  'pipes',
  'hazard',
  'tiles',
  'door_locked',
  'door_power',
  'buy_dbarrel',
  'buy_autoshot',
];
const TEX_ID = Object.fromEntries(WALL_TEX.map((n, i) => [n, i]));

export const MARGIN = 3;

const OUTPOST = {
  id: 'outpost',
  name: 'Harrow Outpost',
  blurb: 'A small four-room outpost. Tight, fast and brutal.',
  zoneLabels: [
    [5, 5, 'Lobby'],
    [17, 5, 'East Hall'],
    [5, 14, 'Storage'],
    [17, 14, 'Lab'],
  ],
  rows: [
    '###s##B##########B######',
    '#..........=...........#',
    '#..........=...........m',
    'B..........=...........#',
    '#..........D....=......#',
    '#....S.....=...........B',
    '#..........=...........#',
    '#..........=.........J.#',
    '#..........=...........#',
    '#====D===========E=====#',
    '#..........=.........Q.#',
    '#..........=...........#',
    '#..........=...........#',
    '#....=.....=...........B',
    'B..........=...=...=...#',
    '#..........E...........#',
    '#.......X..=...........#',
    '#..........=...........#',
    '#..........=...........#',
    '######B#######r###B#####',
  ],
};

const ASYLUM = {
  id: 'asylum',
  name: 'Saint Vael Asylum',
  blurb: 'Eight wards ringed around an open-air courtyard. More room to run, more loops to master.',
  zoneLabels: [
    [17, 4, 'Reception'],
    [5, 2, 'West Wing'],
    [30, 2, 'East Wing'],
    [2, 10, 'Ward A'],
    [15, 10, 'Courtyard'],
    [33, 10, 'Labs'],
    [2, 20, 'Morgue'],
    [17, 20, 'Chapel'],
    [33, 20, 'Boiler Room'],
  ],
  rows: [
    '#####B########B###B##s#####m##B#####',
    '#..........=............=..........#',
    '#..........=............=..........#',
    '#...=......=............=....==....#',
    'B...=......D.....S......D....==....B',
    '#...=......=............=..........#',
    '#..........=............=..........#',
    '#..........=............=..........#',
    '#====E=====######E#######=====E====#',
    '#..........#,,,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,#..........#',
    'B..........#,,,,,,,,,,,,#..........B',
    '#....==....#,,,,####,,,,#..=====...#',
    '#....==....E,,,,####,,,,E..........r',
    '#....==....#,,,,####,,,,#..........#',
    'B..........#,,,,,,,,,,,,#...=====..B',
    '#..........#,X,,,,,,,,,,#..........#',
    '#..........#,,,,,,,,,,,,#..........#',
    '#====F=====######F#######=====F====#',
    '#..........=............=..........#',
    '#..........=............=..........#',
    '#...=......=..=......=..=...=......#',
    'B..........F............F...=......B',
    '#......=...=..=......=..=...=......#',
    '#..........=..........J.=........Q.#',
    '#..........=............=..........#',
    '#####B#########B####B#########B#####',
  ],
};

// Kessler: a blackout map. Fight the long way round to the generator;
// restoring power lights the station, powers perks and traps, and opens blast
// doors that turn the Turbine Hall into a hub connecting everything.
const KESSLER = {
  id: 'kessler',
  name: 'Kessler Power Station',
  blurb:
    'Pitch black. Fight your way to the generator; power opens the station up and arms the electric traps.',
  needsPower: true,
  windowStyle: 'metal',
  zoneLabels: [
    [6, 4, 'Loading Dock'],
    [20, 4, 'Control Offices'],
    [30, 4, 'Generator Hall'],
    [2, 15, 'West Service Corridor'],
    [20, 25, 'Pump Gallery'],
    [37, 15, 'East Service Corridor'],
    [20, 15, 'Turbine Hall'],
  ],
  // Trap consoles (T) and the tiles they electrify, in level coordinates.
  traps: [
    { at: [3, 10], area: [1, 11, 3, 15] },
    { at: [26, 24], area: [27, 24, 31, 26] },
    { at: [36, 10], area: [36, 11, 38, 15] },
  ],
  rows: [
    '####B##d##B####%%%%B%%m%%%%%%%%%B%%%%%%%',
    '#,,,,,,,,,,,,,!..........&+++++++++++++%',
    '#,,,,,,,,,,,,,!..........&+++++++++++++%',
    '#,,C,,,,,,,,,,!..........&+++++++++++++%',
    'B,,,,,S,,,,,,,D..........P++++++G++++++B',
    '#,,,,,,,,,,,,,!..........&+++++++++++++%',
    '#,,,,,,,,,,CC,!..........&++++++++++C++%',
    '#,,,,,,,,,,,,,!..........&+++++++++++++%',
    '#%D%&&&&P&&&&&&&&&&&&&&&&&&&&&&&&&&&%F%%',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%__T&++++++++++++++++++++++++++++++&T__%',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%___&++++%%++++%%++++%%++++%%++++++&___%',
    'B___&++++%%++++%%++++%%++++%%++++++&___B',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%___&+++++++J++++++++++++++Q+++++++&___%',
    '%___P++++++++++++++++++++++++++++++P___r',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%___&++++%%++++%%++++%%++++%%++++++&___%',
    'B___&++++%%++++%%++++%%++++%%++++++&___B',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%___&++++++++++++++++++++++++++++++&___%',
    '%%E%&&&&&&&&&&&&&&&&P&&&&&&&&&&&&&&&%E%%',
    '%_________________________T____________%',
    '%___________________X__________________%',
    '%______________________________________%',
    '%%%%%%%%B%%%%%a%%%%%B%%%%%%%%%%B%%%%%%%%',
  ],
};

// Story-only maps
const DEPOT = {
  id: 'depot',
  name: 'Harrow Rail Depot',
  blurb: 'A freight yard and warehouse between you and the only road out of town.',
  storyOnly: true,
  windowStyle: 'metal',
  zoneLabels: [
    [4, 9, 'Platform'],
    [12, 9, 'Freight Yard'],
    [22, 15, 'Guard Hut'],
    [32, 9, 'Warehouse'],
    [41, 9, 'Signal Box'],
    [41, 16, 'Exit Road'],
  ],
  locks: [
    [26, 5, 'gate1', 'Locked. Needs the yard keycard'],
    [38, 9, 'gate2', 'Locked. Needs the warehouse keycard'],
    [41, 13, 'gate3', 'The depot gate is shut. Find the signal box controls'],
  ],
  rows: [
    '%%%%B%d%%#####B######B#####%%%%B%%%%B%%%%%%%%%',
    '%________%,,,,,,,,,,,,,,,,&___________&%%%%%%%',
    '%________%,,,,,,,,,,,,,,,,&___________&%%%%%%%',
    '%________%,,,,,,,,,,,,,,,,&___________&%%%%%%%',
    '%________%,,,CC,,,,,,,C,,,&__&&&&&&&__&%%%%%%%',
    'B________%,,,C,,,,,,,,,,,,L___________&%%%%%%%',
    '%________%,,,,,,,,,,,,,,,,&___________&++++++%',
    '%________%,,,,,,,,,,,,,C,,&___________&++++++%',
    '%________%,,,,,,,,,,,,,,,,&__&&&&&&&__&++++++B',
    '%___S____D,,,,,,,C,,,,,,,,&___________L++++++%',
    '%________%,,,,,,,C,,,,,,,,&___________&++++++%',
    '%________%,,,,,,,,,,,,,,,,&___________&++++++B',
    '%________%,,,,,,,,,&&&D&&&&__&&&&&&&__&++++++%',
    '%________%,,,,,,,,,&......&___________&%%L%%%%',
    'B________%,,C,,,,,,&......&___________&::::::%',
    '%________%,,,,,,,,,&......&___________&::::::%',
    '%________%,,,,,,,,,&......&___________&::::::B',
    '%________%,,,,,,,,,&......&___________&::::::%',
    '%________%,,,,,,,,,&......&___________&::::::%',
    '%%%%B%%%%#####B############%a%%B%%%%B%%%%%B%%%',
  ],
};

const ROOFTOP = {
  id: 'rooftop',
  name: 'Harrow General Rooftop',
  blurb: 'The hospital roof and its helipad. The last way out.',
  storyOnly: true,
  zoneLabels: [
    [4, 4, 'Stairwell'],
    [15, 4, 'Rooftop'],
    [27, 21, 'Maintenance Shed'],
  ],
  locks: [[9, 4, 'roof', 'The roof door is jammed. Mara is working on it']],
  rows: [
    '%%%%B%%%%%####B#######B#########',
    '%________%,,,,,,,,,,,,,,,,,,,,,#',
    '%________%,,,,,,,,,,,,,,,,,&&,,#',
    '%________%,,,,,,,,,,,,,,,,,&&,,#',
    'B___S____L,,,,,,,,,,,,,,,,,,,,,#',
    '%________%,,,,,,,,,,,,,,,%%,,,,#',
    '%________%,,,,,,,,,,,,,,,,,,,,,B',
    '%________%,,,,,,,,,,,,,,,,,,,,,#',
    '%%%%%%%%%%,,,,,,,,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,::::::::::,,,,,,,,,,#',
    '#,,,,,,,,,,::::::::::,,,,,,,,,,#',
    '#,,,,,,,,,,::::::::::,,,,,%,,,,#',
    'B,,,%%,,,,,::::::::::,,,,,%,,,,#',
    '#,,,%%,,,,,::::::::::,,,,,,,,,,B',
    '#,,,,,,,,,,::::::::::,,,,,,,,,,#',
    '#,,,,,,,,,,::::::::::,,,,,,,,,,#',
    '#,,,,,,,,,,::::::::::,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,,,,,,,,,%%%%%%%%%',
    '#,,,,,,,,,,,,,,,,,,,,,,%.......%',
    'B,,,,,,,,,,,,,,,,,,,,,,%.....J.%',
    '#,,,,,,,,,,,,,,,,,,,,,,%.......a',
    '#,,,,,,,,,,,,,%%%,,,,,,D.......%',
    '#,,,,,,,,,,,,,,,,,,,,,,%.......%',
    '#,,,,,,,,,,,,,,,,,,,,,,%.X...Q.%',
    '#,,,,,,,,,,,,,,,,,,,,,,%.......%',
    '#d####B#######B####B###%%%%%B%%%',
  ],
};

const SHARED = {
  doorCost: { D: 750, E: 1000, F: 1250 },
  wallBuys: { s: 'shotgun', m: 'smg', r: 'rifle', d: 'dbarrel', a: 'autoshot' },
  perks: { J: 'iron', Q: 'quick' },
};

export const ALL_LEVELS = [OUTPOST, ASYLUM, KESSLER, DEPOT, ROOFTOP].map((l) => ({
  ...SHARED,
  ...l,
}));
export const LEVELS = ALL_LEVELS.filter((l) => !l.storyOnly); // survival map list
export const LEVEL = LEVELS[0];
export const getLevel = (id) => ALL_LEVELS.find((l) => l.id === id) || LEVELS[0];

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function parseMap(level = LEVEL) {
  const rows = level.rows;
  const ih = rows.length,
    iw = rows[0].length;
  for (const r of rows) if (r.length !== iw) throw new Error('Map rows must have equal length');
  const w = iw + MARGIN * 2,
    h = ih + MARGIN * 2;
  const n = w * h;
  const map = {
    w,
    h,
    kind: new Uint8Array(n), // K.*
    wallTex: new Uint8Array(n), // WALL_TEX index
    floorKind: new Uint8Array(n), // FLOOR_KIND.*
    ceilKind: new Uint8Array(n), // CEIL_KIND.*
    zone: new Int16Array(n).fill(-1),
    object: new Uint8Array(n), // 1 = solid prop (crate / perk machine)
    doors: [],
    windows: [],
    wallbuys: [],
    perks: [],
    traps: [],
    decor: [],
    generator: null,
    windowStyle: level.windowStyle || 'brick',
    doorAt: new Map(),
    windowAt: new Map(),
    crate: null,
    start: null,
    zoneCount: 0,
    idx: (x, y) => y * w + x,
  };
  map.floorKind.fill(FLOOR_KIND.DIRT);
  map.ceilKind.fill(CEIL_KIND.SKY);

  const pending = [];
  const inherit = []; // special floor cells that copy floor/ceiling style from a neighbour
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const ch = rows[y][x];
      const mx = x + MARGIN,
        my = y + MARGIN,
        i = my * w + mx;
      const hsh = hash2(mx, my, 7);
      const interior = () => {
        map.floorKind[i] = FLOOR_KIND.TILE;
        map.ceilKind[i] = CEIL_KIND.TILE;
      };
      const wall = (tex) => {
        map.kind[i] = K.WALL;
        map.wallTex[i] = TEX_ID[tex];
        interior();
      };
      switch (ch) {
        case '%':
          wall(hsh < 0.4 ? 'metal2' : 'metal');
          break;
        case '&':
          wall('pipes');
          break;
        case '!':
          wall('hazard');
          break;
        case '^':
          wall('tiles');
          break;
        case '_':
          map.kind[i] = K.FLOOR;
          map.floorKind[i] = FLOOR_KIND.CONCRETE;
          map.ceilKind[i] = CEIL_KIND.METAL;
          break;
        case '+':
          map.kind[i] = K.FLOOR;
          map.floorKind[i] = FLOOR_KIND.GRATE;
          map.ceilKind[i] = CEIL_KIND.METAL;
          break;
        case ':':
          map.kind[i] = K.FLOOR;
          map.floorKind[i] = FLOOR_KIND.CONCRETE;
          map.ceilKind[i] = CEIL_KIND.SKY;
          break;
        case 'P':
          map.kind[i] = K.DOOR;
          map.wallTex[i] = TEX_ID.door_power;
          interior();
          pending.push({ type: 'door', x: mx, y: my, i, cost: 0, powerDoor: true });
          break;
        case 'L':
          map.kind[i] = K.DOOR;
          map.wallTex[i] = TEX_ID.door_locked;
          interior();
          pending.push({ type: 'door', x: mx, y: my, i, cost: 0, locked: true });
          break;
        case 'G':
        case 'T':
        case 'C':
          map.kind[i] = K.FLOOR;
          map.object[i] = 1;
          inherit.push(i);
          if (ch === 'G') map.generator = { x: mx + 0.5, y: my + 0.5 };
          if (ch === 'T') {
            const t = (level.traps || []).find((q) => q.at[0] === x && q.at[1] === y);
            if (!t) throw new Error(`Trap console at ${x},${y} has no entry in level.traps`);
            const [ax0, ay0, ax1, ay1] = t.area;
            map.traps.push({
              x: mx + 0.5,
              y: my + 0.5,
              area: [ax0 + MARGIN, ay0 + MARGIN, ax1 + MARGIN, ay1 + MARGIN],
            });
          }
          if (ch === 'C') map.decor.push({ type: 'crateStack', x: mx + 0.5, y: my + 0.5 });
          break;
        case '#':
          map.kind[i] = K.WALL;
          map.wallTex[i] = TEX_ID[hsh < 0.12 ? 'brickBlood' : hsh < 0.5 ? 'brick2' : 'brick'];
          break;
        case '=':
          map.kind[i] = K.WALL;
          map.wallTex[i] = TEX_ID[hsh < 0.5 ? 'concrete2' : 'concrete'];
          interior();
          break;
        case 'D':
        case 'E':
        case 'F':
          map.kind[i] = K.DOOR;
          map.wallTex[i] = TEX_ID.door;
          interior();
          pending.push({ type: 'door', x: mx, y: my, i, cost: level.doorCost[ch] });
          break;
        case 'B':
          map.kind[i] = K.WINDOW;
          map.wallTex[i] = TEX_ID.brick;
          pending.push({ type: 'window', x: mx, y: my, i });
          break;
        case 's':
        case 'm':
        case 'r':
        case 'd':
        case 'a': {
          const weapon = level.wallBuys[ch];
          map.kind[i] = K.WALLBUY;
          map.wallTex[i] = TEX_ID['buy_' + weapon];
          pending.push({ type: 'wallbuy', x: mx, y: my, i, weapon });
          break;
        }
        case 'X':
          map.kind[i] = K.FLOOR;
          map.object[i] = 1;
          inherit.push(i);
          map.crate = { tx: mx, ty: my, x: mx + 0.5, y: my + 0.5 };
          break;
        case 'J':
        case 'Q':
          map.kind[i] = K.FLOOR;
          map.object[i] = 1;
          inherit.push(i);
          map.perks.push({ perk: level.perks[ch], tx: mx, ty: my, x: mx + 0.5, y: my + 0.5 });
          break;
        case 'S':
          map.kind[i] = K.FLOOR;
          inherit.push(i);
          map.start = { x: mx + 0.5, y: my + 0.5 };
          break;
        case '.':
          map.kind[i] = K.FLOOR;
          interior();
          break;
        case ',': // open-air courtyard: walkable, dirt underfoot, night sky above
          map.kind[i] = K.FLOOR;
          break;
        default:
          map.kind[i] = K.OUTSIDE;
      }
    }
  }
  if (!map.start) throw new Error('Map needs a start tile S');
  for (const i of inherit) {
    let src = -1;
    for (const [dx, dy] of DIRS4) {
      const ni = i + dy * w + dx;
      if (map.kind[ni] === K.FLOOR && !inherit.includes(ni)) {
        src = ni;
        break;
      }
    }
    map.floorKind[i] = src >= 0 ? map.floorKind[src] : FLOOR_KIND.TILE;
    map.ceilKind[i] = src >= 0 ? map.ceilKind[src] : CEIL_KIND.TILE;
  }

  // Flood-fill zones over floor cells (doors split zones).
  let zc = 0;
  for (let i = 0; i < n; i++) {
    if (map.kind[i] !== K.FLOOR || map.zone[i] !== -1) continue;
    const stack = [i];
    map.zone[i] = zc;
    while (stack.length) {
      const c = stack.pop();
      const cx = c % w,
        cy = (c / w) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = cx + dx,
          ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (map.kind[ni] === K.FLOOR && map.zone[ni] === -1) {
          map.zone[ni] = zc;
          stack.push(ni);
        }
      }
    }
    zc++;
  }
  map.zoneCount = zc;

  const floorNeighbours = (x, y) => {
    const out = [];
    for (const [dx, dy] of DIRS4) {
      const ni = (y + dy) * w + (x + dx);
      if (map.kind[ni] === K.FLOOR) out.push({ dx, dy, zone: map.zone[ni] });
    }
    return out;
  };

  for (const p of pending) {
    const nb = floorNeighbours(p.x, p.y);
    const cx = p.x + 0.5,
      cy = p.y + 0.5;
    if (p.type === 'door') {
      const zones = [...new Set(nb.map((q) => q.zone))];
      const door = {
        tx: p.x,
        ty: p.y,
        i: p.i,
        cx,
        cy,
        cost: p.cost,
        zones,
        open: false,
        powerDoor: !!p.powerDoor,
        locked: !!p.locked,
        tag: null,
        lockedText: 'Locked',
      };
      map.doors.push(door);
      map.doorAt.set(p.i, door);
    } else if (p.type === 'window') {
      if (!nb.length) throw new Error(`Window at ${p.x},${p.y} has no floor neighbour`);
      const { dx, dy, zone } = nb[0];
      const win = {
        tx: p.x,
        ty: p.y,
        i: p.i,
        cx,
        cy,
        nx: dx,
        ny: dy,
        zone,
        ix: cx + dx,
        iy: cy + dy, // interior standing point (centre of the floor tile in front)
        planks: 5,
        occupant: null,
      };
      map.windows.push(win);
      map.windowAt.set(p.i, win);
    } else if (p.type === 'wallbuy') {
      const { dx, dy, zone } = nb[0];
      map.wallbuys.push({
        tx: p.x,
        ty: p.y,
        i: p.i,
        weapon: p.weapon,
        zone,
        ix: cx + dx * 0.85,
        iy: cy + dy * 0.85,
      });
    }
  }
  map.startZone = map.zone[Math.floor(map.start.y) * w + Math.floor(map.start.x)];

  // Human-readable zone names (labels are given in level coordinates).
  map.zoneName = Array.from({ length: zc }, (_, z) => `Area ${z + 1}`);
  for (const [lx, ly, name] of level.zoneLabels || []) {
    const z = map.zone[(ly + MARGIN) * w + (lx + MARGIN)];
    if (z >= 0) map.zoneName[z] = name;
  }

  // Story locks: tag + message for locked doors, given in level coordinates.
  for (const [lx, ly, tag, text] of level.locks || []) {
    const d = map.doorAt.get((ly + MARGIN) * w + (lx + MARGIN));
    if (d) {
      d.locked = true;
      d.tag = tag;
      d.lockedText = text;
    }
  }

  // Zone adjacency through doors (used for spawn selection).
  map.zoneDoors = Array.from({ length: zc }, () => []);
  for (const d of map.doors) for (const z of d.zones) map.zoneDoors[z].push(d);
  return map;
}

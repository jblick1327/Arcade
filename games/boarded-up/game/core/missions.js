// missions.js - Boarded Up story campaign ("Last Broadcast") and mission runner
// Author: Reachnid Group
// Centennial College - Fall 2026

// Story mode: the "Last Broadcast" campaign and the runner that drives a
// mission inside a Game. Missions are data: a map, a starting loadout and a
// list of objective steps. Coordinates are level coordinates (column, row in
// the map's rows), the same as the map editor view.
//
// Step types
//   repair   { count }                       rebuild window boards
//   survive  { time }                        stay alive for `time` seconds
//   collect  { item, at: [[x,y],...] }       walk over items to pick them up
//   use      { prop, at, hold, prompt }      interact with props (hold = seconds)
//   power    {}                              start the map's generator
//   reach    { at, radius }                  get to a place
//   hold     { at, radius, time }            stay near a place for `time` seconds
//   kill     { brutes, at, hp }              kill boss Brutes (spawned at `at`)
// Common step fields
//   text, say: [[speaker, line], ...] (radio on start), done: [...] (radio on finish),
//   spawn: { mode, threat, cap, interval }, unlock / unlockOnDone: door tag,
//   props: [{ type, at, solid }] extra props placed when the step starts.

export const CAMPAIGN = [
  {
    id: 'm1',
    title: 'First Night',
    level: 'outpost',
    location: 'Harrow Outpost, 11:40 PM',
    briefing: [
      'Three days ago the people of Harrow started getting sick. Two days ago they stopped being people.',
      'You have barricaded yourself in the old ranger outpost on the edge of town. The boards on the windows did not hold last night. They have to tonight.',
    ],
    debrief: [
      "Mara Voss is a former paramedic running a ham radio out of a farmhouse on Cutter's Ridge. She has been collecting survivors' signals for two days. Yours is the first she has heard from inside town.",
      'She has a plan: the emergency transmitter at Saint Vael Asylum can reach the National Guard. But it needs parts, and it needs someone to switch it on.',
    ],
    start: { points: 1500, weapons: ['pistol'], planks: 1, spawn: { mode: 'off' } },
    steps: [
      {
        type: 'repair',
        count: 6,
        text: 'Board up the windows (hold E at a window)',
        say: [['YOU', 'They came through the windows last night. Not again.']],
      },
      {
        type: 'survive',
        time: 70,
        text: 'Survive the first wave',
        spawn: { mode: 'pressure', threat: 1, cap: 6, interval: 3.2 },
        say: [['YOU', 'Movement outside. Here they come.']],
      },
      {
        type: 'use',
        prop: 'radio',
        at: [[20, 16]],
        prompt: 'Press E to answer the radio',
        text: 'A radio is crackling in the Lab. Clear a path to it',
        spawn: { mode: 'pressure', threat: 2, cap: 8, interval: 2.8 },
        say: [
          [
            'RADIO',
            "...is anyone receiving? This is Mara Voss on Cutter's Ridge. If you can hear me, pick up...",
          ],
        ],
        done: [
          [
            'MARA',
            'Oh thank God. A real voice. Listen to me: you are in the outpost, right? I can see your signal.',
          ],
          [
            'MARA',
            'Keep this channel open while I lock onto you. Do not let them near that radio.',
          ],
        ],
      },
      {
        type: 'hold',
        at: [20, 16],
        radius: 3.2,
        time: 45,
        text: 'Stay near the radio while Mara locks your signal',
        spawn: { mode: 'pressure', threat: 2, cap: 10, interval: 2 },
        done: [
          [
            'MARA',
            'Got you. Now get some rest if you can. At first light, head for Saint Vael Asylum.',
          ],
        ],
      },
    ],
  },
  {
    id: 'm2',
    title: 'Static',
    level: 'asylum',
    location: 'Saint Vael Asylum, 1:15 AM',
    briefing: [
      'Saint Vael was a private psychiatric hospital with a research wing nobody in Harrow liked to talk about. It also has an emergency transmitter powerful enough to reach the Guard at Fort Callen.',
      'The transmitter was stripped for parts. Mara thinks the orderlies hid what they took inside the wards. Find the parts, rebuild the transmitter in the courtyard, and keep it alive while it broadcasts.',
    ],
    debrief: [
      "Fort Callen answered. The Guard is sending a helicopter, but Harrow's power grid is dead and their pilots will not fly into a black valley.",
      'Someone has to restart the Kessler power station. Mara found something else in the transmitter logs: Saint Vael\'s research wing called the infection "Lazarus". They were not trying to cure it.',
    ],
    start: {
      points: 2000,
      weapons: ['pistol', 'shotgun'],
      spawn: { mode: 'pressure', threat: 3, cap: 10, interval: 2.6 },
    },
    steps: [
      {
        type: 'collect',
        item: 'radioPart',
        at: [
          [2, 16],
          [33, 10],
          [13, 24],
        ],
        text: 'Recover the transmitter parts',
        say: [
          [
            'MARA',
            'Three parts: a tuning crystal, a power tube and the amplifier board. Check Ward A, the Labs and the Chapel.',
          ],
        ],
      },
      {
        type: 'use',
        prop: 'radio',
        at: [[21, 10]],
        hold: 2.5,
        prompt: 'Hold E to install the parts',
        text: 'Rebuild the transmitter in the Courtyard',
        say: [
          [
            'MARA',
            "That's all of them. The transmitter mast is in the courtyard. Put it back together.",
          ],
        ],
      },
      {
        type: 'hold',
        at: [21, 10],
        radius: 4.5,
        time: 60,
        text: 'Defend the transmitter while it broadcasts',
        spawn: { mode: 'pressure', threat: 4, cap: 14, interval: 1.4 },
        say: [
          [
            'MARA',
            "It's transmitting! It is also screaming on every frequency in the valley. They can hear it too.",
          ],
          ['MARA', 'Sixty seconds. Stay with it.'],
        ],
        done: [['RADIO', '...Fort Callen to unknown station, we read you. Stand by...']],
      },
    ],
  },
  {
    id: 'm3',
    title: 'Blackout',
    level: 'kessler',
    location: 'Kessler Power Station, 3:05 AM',
    briefing: [
      "Kessler Station feeds the whole valley. The Guard needs Harrow's lights on before they will risk a helicopter.",
      'The station is dark. The breakers tripped when the crew abandoned it, and the generator will not start until they are reset. Something has been seen moving inside: something bigger than the others.',
    ],
    debrief: [
      "Harrow's streetlights flicker back on for the first time in three days. From the ridge, Mara says it looks like the town is breathing again.",
      'The big one wore Saint Vael restraints. The Lazarus program did not just spread the infection. It built things with it.',
    ],
    start: {
      points: 2500,
      weapons: ['pistol', 'smg'],
      spawn: { mode: 'pressure', threat: 4, cap: 10, interval: 2.4 },
      generatorLocked: "The generator won't start. The breakers are still tripped",
    },
    steps: [
      {
        type: 'use',
        prop: 'breaker',
        at: [
          [2, 19],
          [10, 25],
          [37, 19],
        ],
        hold: 1.5,
        prompt: 'Hold E to reset the breaker',
        text: 'Reset the tripped breakers',
        say: [
          [
            'MARA',
            'I have the station schematics. There are three breakers on the service level: west corridor, the pump gallery and the east corridor.',
          ],
          ['MARA', 'Use your flashlight. And keep moving.'],
        ],
      },
      {
        type: 'power',
        text: 'Start the generator',
        say: [
          [
            'MARA',
            'All three are green on my end. The generator is in the hall up past the east corridor.',
          ],
        ],
        done: [
          [
            'MARA',
            'You did it! Every light in the valley just came on... and so did every one of those things.',
          ],
        ],
      },
      {
        type: 'survive',
        time: 80,
        text: 'Survive the horde',
        spawn: { mode: 'pressure', threat: 6, cap: 16, interval: 1.15 },
        say: [
          [
            'MARA',
            'The blast doors are open now. Use the traps and the Turbine Hall. Do not get boxed in.',
          ],
        ],
      },
      {
        type: 'kill',
        brutes: 1,
        at: [[20, 16]],
        hp: 6000,
        text: 'Kill the Brute',
        say: [
          [
            'MARA',
            'Something just set off every motion sensor in the Turbine Hall. Something big.',
          ],
        ],
      },
    ],
  },
  {
    id: 'm4',
    title: 'Through the Yard',
    level: 'depot',
    location: 'Harrow Rail Depot, 4:30 AM',
    briefing: [
      'The Guard will land on the roof of Harrow General, across the river. The only bridge is past the rail depot, and the depot gates are locked down.',
      'Find the keycards, get through the warehouse, and open the main gate from the signal box. Mara has picked up heavy movement in the warehouse.',
    ],
    debrief: [
      'The depot gate grinds open onto the river road. Harrow General is a black shape against a sky that is starting to go grey.',
      'Mara\'s voice is tired now. "One more push. Get to the roof. I\'ll talk the pilot in."',
    ],
    start: {
      points: 2000,
      weapons: ['rifle', 'dbarrel'],
      spawn: { mode: 'pressure', threat: 5, cap: 10, interval: 2.4 },
    },
    steps: [
      {
        type: 'collect',
        item: 'keycard',
        at: [[24, 17]],
        text: 'Find the yard keycard in the guard hut',
        unlockOnDone: 'gate1',
        say: [['MARA', 'The yard guard kept the gate keycard in his hut. Then the warehouse.']],
        done: [['MARA', 'That should open the warehouse gate.']],
      },
      {
        type: 'collect',
        item: 'keycard',
        at: [[36, 17]],
        text: 'Find the warehouse keycard',
        spawn: { mode: 'pressure', threat: 6, cap: 12, interval: 2 },
        say: [
          [
            'MARA',
            "The shift manager's card should be at the back of the warehouse. Careful in those aisles.",
          ],
        ],
      },
      {
        type: 'kill',
        brutes: 1,
        at: [[32, 10]],
        hp: 7000,
        text: 'Kill the Brute',
        unlockOnDone: 'gate2',
        say: [['MARA', 'Move! Something just broke through the shelving!']],
        done: [
          ['MARA', 'The signal box is through the east gate. The main gate controls are in there.'],
        ],
      },
      {
        type: 'use',
        prop: 'breaker',
        at: [[43, 9]],
        hold: 2,
        prompt: 'Hold E to throw the gate switch',
        text: 'Throw the gate switch in the signal box',
      },
      {
        type: 'survive',
        time: 55,
        text: 'Hold out while the gate opens',
        spawn: { mode: 'pressure', threat: 7, cap: 16, interval: 1.1 },
        unlockOnDone: 'gate3',
        say: [
          [
            'MARA',
            'The gate motor is ancient. It needs about a minute. Make it a quiet one... never mind.',
          ],
        ],
      },
      { type: 'reach', at: [42, 17], radius: 1.6, text: 'Get out to the road' },
    ],
  },
  {
    id: 'm5',
    title: 'Last Light',
    level: 'rooftop',
    location: 'Harrow General Hospital, 5:50 AM',
    briefing: [
      'You made it to the hospital. The helicopter is ten minutes out, and the pilot needs a lit landing zone on the roof.',
      'The roof door is jammed and the stairwell is filling up behind you. Light the flares, hold the helipad, and get on that helicopter.',
    ],
    debrief: [
      'The helicopter lifts off as the sun comes up over the ridge. Below you, Harrow is quiet for the first time in four days.',
      'Mara is waiting at Fort Callen with a stack of transmitter logs and a lot of questions about the Lazarus program. Somebody built this. Somebody is going to answer for it.',
      'THE END... for now.',
    ],
    start: {
      points: 3000,
      weapons: ['autoshot', 'rifle'],
      spawn: { mode: 'pressure', threat: 6, cap: 8, interval: 2.6 },
    },
    steps: [
      {
        type: 'survive',
        time: 25,
        text: 'Hold the stairwell while Mara opens the roof door',
        unlockOnDone: 'roof',
        say: [
          [
            'MARA',
            "The roof door is on the hospital's security system. Give me thirty seconds to talk my way in.",
          ],
        ],
        done: [['MARA', "Door's open! Go, go!"]],
      },
      {
        type: 'use',
        prop: 'flare',
        at: [
          [12, 10],
          [19, 10],
          [15, 15],
        ],
        hold: 1,
        prompt: 'Hold E to light the flare',
        text: 'Light the landing flares on the helipad',
        spawn: { mode: 'pressure', threat: 7, cap: 14, interval: 1.6 },
        say: [
          [
            'ROOK',
            'This is Rook, inbound. I need three flares on that pad or I am not putting down.',
          ],
        ],
      },
      {
        type: 'survive',
        time: 90,
        text: 'Hold the helipad until the helicopter arrives',
        spawn: { mode: 'pressure', threat: 8, cap: 18, interval: 1 },
        say: [['ROOK', 'I see your flares. Ninety seconds out. Keep that pad clear.']],
      },
      {
        type: 'kill',
        brutes: 2,
        at: [
          [6, 20],
          [27, 8],
        ],
        hp: 8000,
        text: 'Kill the Brutes',
        say: [
          [
            'ROOK',
            "I have two big contacts climbing the north and south walls. I can't land with those on the roof!",
          ],
        ],
      },
      {
        type: 'reach',
        at: [15, 12],
        radius: 2.2,
        text: 'Get to the helicopter!',
        props: [{ type: 'heli', at: [15, 12] }],
        say: [['ROOK', "Pad is clear, I'm coming down. Get aboard. We are leaving!"]],
      },
    ],
  },
];

export const getMission = (id) => CAMPAIGN.find((m) => m.id === id);

const PROP_SIZE = {
  radioPart: { w: 0.24, h: 0.24, z: 0.08, float: true },
  keycard: { w: 0.24, h: 0.18, z: 0.12, float: true },
  radio: { w: 0.5, h: 0.5 },
  breaker: { w: 0.36, h: 0.6 },
  flare: { w: 0.2, h: 0.3 },
  heli: { w: 2.6, h: 1.3 },
};

export class MissionRunner {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.stepIndex = -1;
    this.step = null;
    this.objective = { text: '', progress: '', bar: null, targets: [] };
    this.radioQueue = [];
    this.radio = null;
    this.bosses = [];
    this.complete = false;
    this.flash = 0; // "objective complete" flash timer
  }

  start() {
    const g = this.game,
      st = this.def.start || {};
    const p = g.player;
    p.points = st.points ?? 500;
    if (st.weapons) {
      p.weapons = st.weapons.map((id) => g.makeWeapon(id));
      p.cur = 0;
    }
    if (st.planks !== undefined) for (const w of g.map.windows) w.planks = st.planks;
    if (g.generator && st.generatorLocked) {
      g.generator.locked = true;
      g.generator.lockedText = st.generatorLocked;
    }
    this.applySpawn(st.spawn || { mode: 'off' });
    g.intermission = 0;
    this.next();
  }

  applySpawn(s) {
    if (!s) return;
    const g = this.game;
    g.spawnMode = s.mode || 'pressure';
    if (g.spawnMode === 'pressure') {
      g.pressure = { threat: s.threat || 1, cap: s.cap || 8, interval: s.interval || 3 };
      g.round = g.pressure.threat;
      g.spawnT = Math.min(g.spawnT || 1.5, 1.5);
    }
  }

  say(lines) {
    for (const [speaker, text] of lines || []) this.radioQueue.push({ speaker, text });
  }

  unlock(tag) {
    const g = this.game;
    for (const d of g.map.doors) if (d.tag === tag && !d.open) g.openDoor(d);
  }

  pos(at) {
    return this.game.toWorld(at[0], at[1]);
  }

  next() {
    const g = this.game;
    if (this.step) {
      const s = this.step.def;
      this.say(s.done);
      if (s.unlockOnDone) this.unlock(s.unlockOnDone);
      for (const pr of this.step.props) g.removeProp(pr);
    }
    this.stepIndex++;
    const def = this.def.steps[this.stepIndex];
    if (!def) {
      this.finish();
      return;
    }
    const step = { def, t: 0, count: 0, props: [], items: [], hold: 0 };
    this.step = step;
    this.say(def.say);
    if (def.spawn) this.applySpawn(def.spawn);
    if (def.unlock) this.unlock(def.unlock);
    for (const pr of def.props || [])
      step.props.push(this.placeProp(pr.type, pr.at, { solid: pr.solid }));

    if (def.type === 'collect') {
      for (const at of def.at) {
        const prop = this.placeProp(def.item, at, {
          pickup: () => {
            g.removeProp(prop);
            step.count++;
            g.sfx('item');
            g.showBanner(
              def.item === 'keycard' ? 'KEYCARD' : 'PART RECOVERED',
              `${step.count} / ${def.at.length}`,
              1.8,
            );
          },
        });
        step.items.push(prop);
      }
    } else if (def.type === 'use') {
      for (const at of def.at) {
        const prop = this.placeProp(def.prop, at, {
          solid: def.prop === 'radio',
          use: {
            hold: def.hold || 0,
            prompt: () => (prop.state === 'on' ? '' : def.prompt),
            action: () => {
              if (prop.state === 'on') return;
              prop.state = 'on';
              step.count++;
              g.sfx(
                def.prop === 'breaker' ? 'switch' : def.prop === 'flare' ? 'burn' : 'item',
                prop.x,
                prop.y,
              );
            },
          },
        });
        step.items.push(prop);
      }
    } else if (def.type === 'power') {
      if (g.generator) g.generator.locked = false;
    } else if (def.type === 'kill') {
      this.bosses = [];
      for (let i = 0; i < def.brutes; i++) {
        const at = def.at && def.at[i % def.at.length];
        const z = g.spawnZombie({ brute: true, hp: def.hp, at: at ? this.pos(at) : undefined });
        if (z) this.bosses.push(z);
      }
      g.showBanner('BRUTE', 'Boss incoming', 2.5, true);
    } else if (def.type === 'repair') {
      step.base = g.stats.repairs;
    }
  }

  placeProp(type, at, extra = {}) {
    const g = this.game;
    const { x, y } = this.pos(at);
    const size = PROP_SIZE[type] || { w: 0.4, h: 0.4 };
    // Persistent props (radio, breakers, flares) stay after the step ends.
    return g.addProp({
      type,
      x,
      y,
      ...size,
      solid: !!extra.solid,
      pickup: extra.pickup,
      use: extra.use,
      state: 'off',
    });
  }

  finish() {
    const g = this.game;
    this.complete = true;
    this.step = null;
    g.state = 'won';
    g.spawnMode = 'off';
    g.sfx('mission_complete');
    g.events.push({ type: 'missionComplete', mission: this.def.id, stats: g.summary() });
  }

  onKill(z) {
    if (this.step && this.step.def.type === 'kill' && this.bosses.includes(z)) this.step.count++;
  }

  update(dt) {
    const g = this.game,
      p = g.player;
    // Radio messages, one at a time.
    if (this.radio) {
      this.radio.t += dt;
      if (this.radio.t > this.radio.dur) this.radio = null;
    }
    if (!this.radio && this.radioQueue.length) {
      const m = this.radioQueue.shift();
      this.radio = { ...m, t: 0, dur: Math.min(9, 2.8 + m.text.length * 0.045) };
      g.sfx('radio');
    }
    this.flash = Math.max(0, this.flash - dt);

    // Pickups: walk over items.
    for (const pr of g.props) {
      if (pr.pickup && Math.hypot(pr.x - p.x, pr.y - p.y) < 0.7) pr.pickup();
    }

    const step = this.step;
    if (!step) return;
    const def = step.def;
    step.t += dt;
    const o = this.objective;
    o.text = def.text;
    o.progress = '';
    o.bar = null;
    o.targets = [];
    let done = false;

    switch (def.type) {
      case 'repair': {
        const n = g.stats.repairs - step.base;
        o.progress = `${Math.min(n, def.count)} / ${def.count}`;
        o.targets = g.map.windows
          .filter((w) => w.planks < 5 && g.openZones.has(w.zone))
          .map((w) => ({ x: w.ix, y: w.iy }));
        done = n >= def.count;
        break;
      }
      case 'survive': {
        const left = Math.ceil(Math.max(0, def.time - step.t));
        o.progress = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        o.bar = step.t / def.time;
        done = step.t >= def.time;
        break;
      }
      case 'collect':
      case 'use': {
        const total = def.at.length;
        o.progress = `${step.count} / ${total}`;
        o.targets = step.items
          .filter((it) => (def.type === 'collect' ? g.props.includes(it) : it.state !== 'on'))
          .map((it) => ({ x: it.x, y: it.y }));
        done = step.count >= total;
        break;
      }
      case 'power':
        if (g.generator) o.targets = [{ x: g.generator.x, y: g.generator.y }];
        done = g.power;
        break;
      case 'reach': {
        const t = this.pos(def.at);
        o.targets = [t];
        done = Math.hypot(t.x - p.x, t.y - p.y) < def.radius;
        break;
      }
      case 'hold': {
        const t = this.pos(def.at);
        o.targets = [t];
        const inside = Math.hypot(t.x - p.x, t.y - p.y) < def.radius;
        if (inside) step.hold += dt;
        o.bar = step.hold / def.time;
        o.progress = inside ? `${Math.ceil(def.time - step.hold)}s` : 'Get back in the zone!';
        done = step.hold >= def.time;
        break;
      }
      case 'kill': {
        o.progress = `${step.count} / ${def.brutes}`;
        o.targets = this.bosses.filter((z) => z.state !== 'dying').map((z) => ({ x: z.x, y: z.y }));
        done = step.count >= def.brutes;
        break;
      }
    }
    if (done) {
      g.sfx('objective');
      this.flash = 2;
      this.next();
    }
  }

  // Living boss for the HUD health bar.
  get boss() {
    return this.bosses.find((z) => z.state !== 'dying') || null;
  }
}

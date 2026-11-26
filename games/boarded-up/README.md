# Boarded Up

_Author: Reachnid Group_

A wave-survival zombie FPS drawn by a software raycaster in plain JavaScript. It has no
engine and no image or audio files: every texture, sprite and sound is generated in code
at startup.

The main menu has two modes, plus settings (mouse sensitivity, volume) and how-to-play.

**Story: Last Broadcast.** A five-mission campaign with briefings, radio contact and objectives: board up the outpost, rebuild a transmitter in the asylum, restore power at Kessler Station, fight through the rail depot, and hold a hospital helipad until the helicopter lands. Missions unlock in order, and progress is saved in the browser.

**Survival.** Endless rounds on three maps:

- **Harrow Outpost**: a tight four-room outpost.
- **Saint Vael Asylum**: eight rooms ringed around an open-air courtyard, with lots of loops to run zombies around.
- **Kessler Power Station**: starts in a blackout with only your flashlight. Restoring power at the generator lights the station, powers the perks, arms three buyable electric traps, and opens blast doors that turn the Turbine Hall into a hub.

Zombies tear the boards off the windows and climb in, but only through windows near you (the room you're in and the rooms next to it). You rebuild the boards for points,
spend points to clear debris doors into new rooms, buy weapons off the walls, gamble at
the Mystery Crate, and buy perks from drink machines. Each round brings more zombies,
and they are tougher and faster.

## Play it

- **On the site:** `npm run dev` from the repo root, then pick Boarded Up from the Games page. Click the game to lock the mouse.
- **On its own:** start a static server in the repo root (e.g. `python3 -m http.server`) and open <http://localhost:8000/games/boarded-up/>. The SDK runs in offline mode and prints scores to the console.

## Leaderboard

When a survival run ends, the total points earned are sent with `Arcade.submitScore` (the map, round, kills, time and accuracy go along as meta). Story missions aren't scored.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / turn |
| Mouse | Look (click the game to lock the pointer) |
| Left click | Shoot |
| Right click (hold) | Aim down sights (zoom, weapon reticle, tighter spread, slower movement) |
| Shift | Sprint |
| E (hold) | Rebuild a window barrier |
| E | Buy a weapon / clear debris / Mystery Crate / perk |
| R | Reload |
| V or F | Knife |
| Q, mouse wheel, 1 / 2 | Swap weapon |
| Esc | Pause |

## Economy

| Thing | Cost |
| --- | --- |
| Hit on a zombie / kill / knife kill | +10 / +60 / +130 |
| Rebuilding one board | +10 |
| Debris doors | 750 / 1000 / 1250 |
| Trench Sweeper shotgun / Hornet SMG / Warden AR (wall buys) | 500 / 1000 / 1200 (ammo at half price) |
| Twin Widow double-barrel / Hailstorm auto-shotgun (wall buys) | 900 / 1600 |
| Mystery Crate (random weapon, including the Rail Lance, Plasma Caster, Cinder Torch flamethrower, Storm Coil tesla gun and Ripjack sawblade launcher) | 950 |
| Electric trap (Kessler, needs power) | 1000 |
| Iron Hide (250 max health) / Quick Hands (2x reload and repair speed) | 2500 / 3000 |

Killed zombies sometimes drop power-ups: Ammo Refill, Double Score (30 s) and Shockwave
(kills everything on the map).

## Project layout

```
games/boarded-up/
  index.html           loads the Arcade SDK and main.js
  main.js              starts the game and sends survival scores to the site
  game.json            title, description and frame size for the Games page
  game/
    index.js           createGame(container, options): menus, screens, sizing, main loop
    input.js           keyboard + pointer-lock mouse
    audio.js           Web Audio synthesized sound effects + ambience
    hud.js             canvas HUD (points, ammo, round, prompts)
    core/              no DOM access in here; can run headless in Node
      game.js          simulation: rounds, zombies, weapons, economy
      map.js           all maps + parser (add a map by adding to ALL_LEVELS)
      missions.js      story campaign data + mission runner (objectives, radio, bosses)
      weapons.js       weapon / perk / power-up stats
      renderer.js      raycaster: textured walls, see-through windows, floor/ceiling, sprites
      assets.js, textures.js, sprites.js, weaponArt.js, fxArt.js, pixel.js   procedural art
```

The game files are plain ES modules, so the browser loads them directly with no build step.

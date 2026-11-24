# Retro Paddle

_Author: Reachnid Group_

A two-paddle arcade tennis game in the style of the early-1970s arcade machines:
black screen, white paddles, a square ball, a dashed centre line and block-digit scores.
Plain HTML5 Canvas, vanilla JavaScript, CSS and the Web Audio API. It has no dependencies
and needs no build step.

## Run it

- **On the site:** `npm run dev` from the repo root, then pick Retro Paddle from the game list.
- **On its own:** start a static server in the repo root (e.g. `python3 -m http.server`) and
  open <http://localhost:8000/games/retro-paddle/>. The SDK runs in offline mode and prints
  scores to the console.

## Leaderboard

Only 1-player matches are scored. When a match ends, the game submits the number of points
the player won against the AI (higher is better). 2-player matches aren't submitted.

## Run the tests

`npm test` from the repo root runs `games/retro-paddle/tests/*.cjs` with the other games' tests.

## Controls

| | Up | Down |
|---|---|---|
| 1 player (left paddle) | W or ↑ | S or ↓ |
| 2 players, player 1 (left) | W | S |
| 2 players, player 2 (right) | ↑ | ↓ |

- **Menus:** ↑/↓ (or W/S) and Enter/Space, or the mouse. In Settings, ←/→ change a value.
- **Esc:** pause/resume during a match. It also goes back from sub-menus.
- If the window loses focus, the game pauses.

## Settings (saved in localStorage)

- **AI difficulty:** Easy / Medium / Hard
- **Winning score:** 7 / 11 (default 11)
- **Sound:** On / Off
- **Ball speed:** Slow / Normal / Fast. This changes both the serve speed and the speed cap.

## Project structure

```
retro-paddle/
  game.json         Arcade listing (title, description, frame size)
  index.html        canvas + script tags (loads the Arcade SDK)
  style.css         full-window black page, centred canvas
  js/core.js        physics, collisions, scoring, AI, settings (pure, no DOM)
  js/app.js         game-state machine and menus (pure, no DOM)
  js/render.js      canvas drawing
  js/audio.js       Web Audio square-wave beeps
  js/main.js        canvas scaling, keyboard/mouse input, requestAnimationFrame loop
  tests/            node:test suites for core.js and app.js
```

## Design notes

- **Fixed logical field (800×600).** All physics runs in logical units. The canvas is
  scaled to the largest 4:3 box that fits the window and uses devicePixelRatio for
  sharpness, so the screen size never changes gameplay.
- **Fixed-step physics.** Each frame's delta time is clamped to 0.1 s, then simulated in
  1/240 s sub-steps. Paddle collisions are swept: the code checks where the ball crossed
  the paddle face, so even a very fast ball can't tunnel through. A paddle collision is
  only checked while the ball moves toward that paddle, so one impact can't register twice.
- **Bounce angle** depends on where the ball meets the paddle (up to ±55°). Every hit adds
  5 % speed up to the cap, and horizontal speed never drops below 50 % of total speed.
- **Scoring:** a point is awarded once, when the ball has fully left the field. The ball
  is then deactivated. The next serve goes toward the player who conceded.
- **AI:** obeys the same bounds and moves at a capped speed, so it can't teleport.
  - Easy: slow, reacts late, often misjudges.
  - Medium: tracks the ball with a short delay.
  - Hard: fast, predicts the landing point including wall bounces, still has small aim errors.
  - Measured against a perfect test opponent, the AI returns about 1.6 (Easy), 4.8 (Medium)
    and 26 (Hard) balls per miss.

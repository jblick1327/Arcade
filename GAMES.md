# Adding your game

Your game is a folder of plain web files. No build step, no accounts to set up, no API keys.

## 1. Make the folder

Copy `games/_template/` to `games/<your-game>/`. The folder name becomes the URL, so use lowercase letters, digits and dashes only (`space-rocks`, not `Space Rocks!`).

The folder must contain:

- `index.html` — your game. Put everything else (JS, CSS, images, sounds) beside it.
- `game.json` — a few facts about it:

```json
{
  "title": "Space Rocks",
  "description": "One sentence shown in the game list.",
  "mode": "score",
  "scoreOrder": "desc",
  "width": 800,
  "height": 600
}
```

`scoreOrder` is `"desc"` when a higher score is better and `"asc"` when lower is better (golf, fastest time). `width` and `height` are the size of the frame your game is shown in, in pixels.

## 2. Use relative paths

Write `src="player.png"` or `src="./js/main.js"`. Never start a path with `/` (the only exception is the SDK line below). If your paths are relative, the game works both on the site and when you open it on your own machine.

## 3. Report the score

```html
<script src="/sdk/arcade.js"></script>
<script>
  // when the game ends:
  Arcade.submitScore(1200);
</script>
```

That is the whole integration. The site knows who is logged in and which game this is.

Optional extras:

```js
const { user } = await Arcade.ready();        // { id, name }, or null for a guest
const r = await Arcade.submitScore(1200);     // r.ok is false for guests (r.reason === 'guest')
const board = await Arcade.getLeaderboard(10); // board.entries = [{ name, score, at }]
```

Nothing in the SDK ever throws. If something goes wrong you get `{ ok: false, reason }` back and your game keeps running.

## 4. Test it

Run the site (`npm run dev`), open it, and your game appears in the list. Play it logged in and check that your score shows on the leaderboard.

You don't need the full site (or MongoDB) while you're building. Start any static file server in the repo root, for example:

```sh
python3 -m http.server
```

and open `http://localhost:8000/games/<your-game>/`. The SDK notices it isn't running inside the site, switches to offline mode, and prints scores to the browser console instead of saving them. Double-clicking `index.html` does *not* work, because `/sdk/arcade.js` is a root-relative path that only resolves when a server is serving the repo root.

## Rules

- One number per finished game. Submit when the game ends, not every frame.
- Do not call `/api/...` yourself and do not use `localStorage` for scores. Use the SDK.
- Your game owns everything inside its frame, including its look. Nothing outside the frame is yours to style.

## Getting your game into the repo

All changes reach `master` through a pull request.

1. Fork the repo (or create a branch if you have write access) and make a branch for your game, e.g. `add-space-rocks`.
2. Add your folder `games/<your-game>/` as described above. Keep your changes inside it, so your PR can't conflict with anyone else's game.
3. Run the site, or use the static server from section 4, and play it through once.
4. Run `npm test` and `npm run build` from the repo root. Both must pass; CI runs them again on your PR.
5. Open a pull request into `master`. In the description, say what the game is and how to play it. A screenshot helps.
6. The maintainer will review it, may ask for changes, and merges it once CI is green.

If you add tests for your game, put them in `games/<your-game>/tests/*.cjs` and `npm test` will pick them up.

## Online multiplayer games

Set `"mode": "match"` in `game.json`. Matches default to 2 players; add `"maxPlayers": 4` for four-player matches. `games/automate/` is the two-player worked example; the full API is in the "Matches" section of `ARCHITECTURE.md`. The short version:

- A **match** is a shared piece of data: whose turn it is, a `state` object that you define (up to 64,000 characters of JSON), a version number, and who won. The site keeps it in the database and handles creating, listing and joining matches, so you only write the game.
- Get the current match with `const { match } = await Arcade.ready()` or `Arcade.match.get()`. `match.you` is your seat, `0` or `1` (also `2` or `3` in four-player games), or `null` if you're only watching, and `match.turn` is whose move it is.
- On your turn, save your move with `await Arcade.match.update({ state, turn: nextSeat })`. To end the game, add `result: { winner: 0 }` (or another player's seat index, or `null` for a draw).
- Redraw your board when `Arcade.match.onChange(fn)` fires. It runs whenever another player moves; the site checks for changes every second or two.
- If players act at once, a conflicting write is rejected with `{ ok: false, reason: 'conflict' }` and the current match attached. Use that match and carry on.

The server doesn't know your game's rules: it checks that it's the sender's turn and the version matches, and nothing else. A determined player could cheat by sending the server a move your game would never allow. That's fine for a casual game. Automate is the exception, with its own checks in `server/automate.js`, because it's a competitive game. If you want that, talk to the maintainer first.

To try a match you need the full site running (see the README) and a separate logged-in browser session for each player (two by default, or four with `"maxPlayers": 4`).

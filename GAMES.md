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

You can also open your `index.html` without the site. The SDK notices, switches to offline mode, and prints scores to the browser console instead of saving them. (For that to work on its own, the `/sdk/arcade.js` line has to load; the simplest way is to run the site. If it fails to load, guard your calls with `window.Arcade && Arcade.submitScore(n)`.)

## Rules

- One number per finished game. Submit when the game ends, not every frame.
- Do not call `/api/...` yourself and do not use `localStorage` for scores. Use the SDK.
- Your game owns everything inside its frame, including its look. Nothing outside the frame is yours to style.

## Two-player games

Set `"mode": "match"` in `game.json` and read the "Matches" section of `SPEC.md`. `games/automate/` is the worked example.

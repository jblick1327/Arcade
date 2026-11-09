# Arcade — build spec

A small MERN site that hosts web games made by a group of classmates. Players log in, play, and their scores are recorded. One game (Automate) is two-player online.

This spec is written for an implementing agent. Build the phases in order. Each phase ends with checks that must pass before starting the next.

## Ground rules

1. **Simplest thing that works.** If this spec does not ask for it, do not add it. In particular: no TypeScript, no CSS framework, no state library, no WebSockets, no Docker, no email, no password reset, no admin pages, no rate limiting, no upload UI.
2. **The interface is bare HTML.** The React app uses plain semantic elements (`<h1>`, `<nav>`, `<table>`, `<form>`, `<button>`) and no stylesheet at all. The only styling permitted is the `width`/`height` attributes on the game iframe. A theme comes later.
3. **Games are static folders.** A game is `games/<slug>/index.html` plus `game.json`. Adding a game must never require editing server or client code.
4. **Four files are already written and tested. Do not rewrite them.** Use them as they are; if one seems wrong, stop and report instead of changing it.
   - `sdk/arcade.js` — what games include
   - `client/src/bridge.js` — the site's half of the SDK
   - `games/_template/` — the starter game
   - `GAMES.md` — instructions for classmates
5. Everything is served from **one origin** by one Express process. No CORS configuration anywhere.

## Layout

```
arcade/
  package.json          one package for server and client
  .env.example          MONGODB_URI, SESSION_SECRET, PORT
  vite.config.js        root: 'client'; dev proxy for /api, /games, /sdk -> http://localhost:3000
  SPEC.md  GAMES.md  README.md
  sdk/arcade.js         (given)
  games/
    _template/          (given)
    automate/           added in phase 1
  server/
    index.js            app setup, static serving, starts listening
    models.js           User, Score, Match
    games.js            reads games/*/game.json
    routes/auth.js  routes/games.js  routes/matches.js
  client/
    index.html
    src/main.jsx  App.jsx  api.js  bridge.js (given)
    src/pages/Home.jsx  Play.jsx  Login.jsx  Register.jsx
```

Dependencies: `express`, `mongoose`, `express-session`, `connect-mongo`, `bcryptjs`, `dotenv`; `react`, `react-dom`, `react-router-dom`; dev: `vite`, `@vitejs/plugin-react`, `concurrently`. Nothing else without a reason stated in the README.

Scripts:

- `npm run dev` — Express on 3000 (`node --watch server/index.js`) and Vite on 5173 together. Developers open `http://localhost:5173`.
- `npm run build` — Vite build to `client/dist`.
- `npm start` — Express only, serving `client/dist`.

## Static serving (server/index.js)

Mount in this order:

1. `express.json({ limit: '100kb' })`, then the session middleware.
2. `/api` → the routers. Unknown `/api/*` → `404 {"error":"Not found"}`.
3. `/sdk` → `express.static('sdk')`.
4. `/games` → `express.static('games')`. A missing file under `/games` or `/sdk` must return 404, **not** the React page.
5. `express.static('client/dist')`, then a fallback that sends `client/dist/index.html` for any other GET.

Sessions: `express-session` with `connect-mongo`, secret from `SESSION_SECRET`, cookie `httpOnly`, `sameSite: 'lax'`, 30 days, `saveUninitialized: false`. The session stores only `userId`.

## Game registry (server/games.js)

On each request to the games endpoints, read the `games/` directory (no caching, so a new folder shows up on refresh). A folder is a game when:

- its name matches `^[a-z0-9][a-z0-9-]*$` (this deliberately skips `_template`), and
- it contains `index.html` and a `game.json` that parses.

`game.json` fields and defaults:

| Field | Type | Default |
|---|---|---|
| `title` | string | the folder name |
| `description` | string | `""` |
| `mode` | `"score"` or `"match"` | `"score"` |
| `scoreOrder` | `"desc"` or `"asc"` | `"desc"` |
| `width`, `height` | number | 800, 600 |

A folder with a broken `game.json` is skipped and logged with `console.warn`; it must not crash the server. The game object returned by the API is these fields plus `slug`.

## Data (server/models.js)

```
User   { name, nameLower (unique index), passwordHash, createdAt }
Score  { user: ObjectId, game: slug string, score: Number, meta: Mixed, createdAt }      index { game, score }
Match  { game: slug string, players: [ObjectId] (1 or 2), status: 'waiting'|'active'|'done',
         turn: 0|1, state: Mixed (default null), winner: 0|1|null, version: Number (default 0),
         createdAt, updatedAt }                                                         index { game, status }
```

## API

All bodies are JSON. Every error is `{ "error": "<short human message>" }` with the status shown. "Auth" means a logged-in session is required, otherwise `401`.

### Auth

| Request | Success | Errors |
|---|---|---|
| `POST /api/auth/register` `{name, password}` | `201 {id, name}` and logs in | `400` name not `^[A-Za-z0-9_]{3,20}$` or password shorter than 6; `409` name taken (compare case-insensitively) |
| `POST /api/auth/login` `{name, password}` | `200 {id, name}` | `401` for any wrong name or password, same message for both |
| `POST /api/auth/logout` | `204` | — |
| `GET /api/me` | `200 {user: {id, name}}` or `200 {user: null}` | — |

Hash with `bcryptjs`, cost 10. Never return `passwordHash`.

### Games and scores

| Request | Success | Errors |
|---|---|---|
| `GET /api/games` | `200 [game, ...]` sorted by title | — |
| `GET /api/games/:slug` | `200 game` | `404` |
| `POST /api/games/:slug/scores` `{score, meta?}` (auth) | `201 {ok: true}` | `404` unknown game; `400` if `score` is not a finite number or `meta` serialises to more than 2000 characters |
| `GET /api/games/:slug/leaderboard?limit=10` | `200 [{name, score, at}, ...]` | `404` |

Leaderboard rules (limit clamped to 1–100):

- `mode: "score"` — each user appears once with their best score. Best means highest for `desc`, lowest for `asc`. Ties: earlier `createdAt` first. `at` is when that score was set.
- `mode: "match"` — each user appears once; `score` is the number of `done` matches of this game they won; highest first; `at` is their latest win. Users with no wins are left out.

### Matches

A match is a shared JSON blob with a version number and a turn. The server does not know any game's rules.

The match object returned everywhere:

```json
{
  "id": "…", "game": "automate",
  "players": [{"id": "…", "name": "ann"}, {"id": "…", "name": "bob"}],
  "status": "active", "turn": 0, "state": {}, "winner": null, "version": 3,
  "you": 0
}
```

`you` is the requester's index in `players` (0 or 1), or `null` for spectators and guests. `players[0]` is always the creator.

| Request | Success | Errors |
|---|---|---|
| `GET /api/games/:slug/matches` | `200 [match, ...]` — `waiting` matches, plus `active` matches the requester is in; newest first, max 50 | `404` |
| `POST /api/games/:slug/matches` (auth) | `201 match` — `players: [me]`, `waiting`, `turn 0`, `state null`, `version 0` | `404`; `400` if the game's mode is not `match` |
| `POST /api/matches/:id/join` (auth) | `200 match` — adds me as `players[1]`, `status: active`, `version + 1`. If I am already in the match, return it unchanged. | `404`; `409` already has two players |
| `GET /api/matches/:id` | `200 match` (no auth needed) | `404` |
| `PUT /api/matches/:id` `{version, state, turn, result?}` (auth) | `200 match` | see below |

`PUT` checks, in order:

1. `404` if the match does not exist. `403` if the requester is not one of the players.
2. `409 {error, match}` (including the current match object) if `status` is not `active`, or the requester's index is not `match.turn`, or `version` does not equal `match.version`.
3. `400` if `turn` is not 0 or 1, if `state` serialises to more than 64,000 characters, or if `result` is present and `result.winner` is not `0`, `1` or `null`.
4. Otherwise store `state` and `turn`, add 1 to `version`. If `result` is present, also set `winner` and `status: 'done'`.

Make the write atomic: `findOneAndUpdate` filtered on `_id`, `version`, `status: 'active'`; if it matches nothing, answer `409` with the current match. Join is atomic the same way (filter on `status: 'waiting'`).

## Client

Four routes with `react-router-dom`. `App.jsx` fetches `/api/me` once, keeps `user` in state, and renders a `<nav>` on every page: site name linking to `/`, then either "`<name>` · Log out" or "Log in · Register".

`api.js` is one function, `api(method, path, body)`, returning `{ status, data }` (same shape as `http` in `bridge.js`).

**`/` Home** — `<h1>`, then a `<ul>` of games: title as a link to `/play/<slug>`, description beside it.

**`/login`, `/register`** — a form with name and password. On success set `user` and go to `/`. On failure show the `error` text in a `<p role="alert">`.

**`/play/:slug` Play** — fetch the game (show "Game not found" on 404), then render:

1. `<h1>` title.
2. For `match` games only, the lobby (below).
3. The iframe: `<iframe src="/games/<slug>/" width height title>`. Give it `key={slug + ':' + (matchId || 'local')}` so it reloads when the match changes. Attach the bridge in a `useEffect` exactly as the comment at the top of `bridge.js` shows.
4. If the user is a guest: `<p>Log in to save your score.</p>`
5. `<h2>Leaderboard</h2>` and a `<table>` (rank, name, score). Refetch it when the bridge calls `onScore`.

Lobby for `match` games. The current match comes from the `?match=<id>` query parameter.

- No `match` parameter: the iframe runs the game in local mode. Above it show a "New online match" button (guests see "Log in to play online" instead) and a list of matches from `GET /api/games/:slug/matches`, each with the host's name and a "Join" button (or "Resume" for the requester's own). Refresh the list every 5 seconds. New match → `POST`, then navigate to `?match=<id>`. Join → `POST …/join`, then navigate.
- With a `match` parameter: show one status line driven by the bridge's `onMatch` callback — "Waiting for an opponent. Send them this link: `<current URL>`", "ann vs bob — in progress", or "ann vs bob — bob won" / "draw". If the user is logged in, not in the match, and it is `waiting`, show a "Join this match" button. Always show a "Leave" link back to `/play/<slug>`.

## Phases

### Phase 1 — shell and the first game

Build the layout, static serving, the registry, `GET /api/games`, `GET /api/games/:slug`, Home, and Play (iframe only, bridge attached with `user: null`). No database code yet beyond connecting.

Move Automate in:

1. Copy the existing game into `games/automate/`. Delete `server.cjs`, `start_windows.bat`, `start_mac_linux.sh`, `scripts/`, and its `package.json`. Move the three `tests*.cjs` files to `games/automate/tests/` and fix their require paths.
2. Commit the two engine files into `games/automate/engine/`: `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm`. Get them with `npm pack stockfish@19.0.1` and take them from `package/bin/`. Keep `engine/README.txt` (GPLv3 notice and source link).
3. In `app.js` `checkEngine`, delete the whole `./engine/status` polling block; keep the `HEAD` checks for the two files. Fix the error messages that tell the user to run `npm start` / `npm run engine`.
4. Add `game.json`: title "Automate", `mode: "match"`, width 980, height 720 (adjust until nothing is clipped).
5. Do not change `rules.js`, `setup.js`, or either CSS file.

Checks:

- `npm run dev`, open `:5173`: Home lists Automate and nothing else. `_template` is not listed, but `/games/_template/` loads.
- Automate plays a full local game in the iframe: draft both sides, both press DONE, Stockfish moves appear, the game reaches a result.
- `npm run build && npm start` behaves the same on `:3000`.
- `/games/nope/x.js` and `/api/nope` return 404.
- The three Automate test files still pass with `node`.

### Phase 2 — accounts and scores

Add auth, scores, the leaderboard, Login/Register, and pass the real `user` to the bridge.

Checks:

- Register, log out, log in. A wrong password gives the error text. A duplicate name differing only in case is refused.
- Copy `games/_template` to `games/clicker` (leave it in the repo as the example score game). It appears on Home with no code changes. Play it logged in: the score appears on the leaderboard without a page reload. Play again with a lower score: the leaderboard still shows the best.
- As a guest the game says the score was not saved and nothing is written.
- Change `scoreOrder` to `asc`, refresh: the order flips and the lowest score is the one shown. Change it back.
- Open `/games/clicker/` directly (not through the site): the game runs and the console shows the SDK's offline message.

### Phase 3 — matches and online Automate

Add the Match model, the match routes, the lobby, and online play in Automate.

Automate's changes are confined to `games/automate/app.js` and `index.html` (add the SDK script tag before the other scripts). At startup call `Arcade.ready()`:

- `match` is `null` → behave exactly as today (two people at one screen). Do not submit anything.
- `match` is set → online mode, as follows.

Online mode:

- `players[0]` is White, `players[1]` is Black. `you` says which this browser is (`null` = spectator: render only, all controls disabled).
- **Shared state** is `{ phase: 'draft' | 'battle', draft: { armies, turn, done }, runner: 0|1|null, moves: [uci strings] }`. Never send `draft.history` (it is large); when loading a draft from the match, set `history: []`.
- **Initial state.** `state` is `null` until the first write. Treat `null` as `{ phase: 'draft', draft: <fresh A.create() without history>, runner: null, moves: [] }`.
- **Rendering** always comes from the latest match. Subscribe with `Arcade.match.onChange` and re-render. While `status` is `waiting`, show "WAITING FOR OPPONENT" in the message line and disable the board.
- **Drafting.** The board and tools are enabled only when `status === 'active'`, `match.turn === you`, and it is this colour's turn in `draft`. On a successful `A.perform` or `A.finish`, immediately call `Arcade.match.update({ state, turn })` where `turn` is `0` if the new `draft.turn` is `'w'`, else `1`. If the update returns `ok: false`, discard the local change and render the match that came back (or the last known one), showing "Out of date — refreshed." Hide UNDO and CLEAR online.
- **Starting the battle.** When a player's DONE completes the draft (`A.complete`), run the existing `validate` first. If it fails, show the error and send nothing. If it passes, send `{ phase: 'battle', draft, runner: you, moves: [] }` with `turn: you`.
- **Running the battle.** Only the runner's browser starts Stockfish. After each engine move, append its UCI string (`R.key(move)`) to `moves` and send the state with `turn: you`. Updates must be sent one at a time: do not request the next engine move until the previous update has resolved. When the game ends, send the final state with `result: { winner }` — `0` if White delivered checkmate, `1` if Black did, `null` for every kind of draw. Detect the winner from the position (side to move has no legal moves and is in check → the other side won), not by parsing status text.
- **Watching the battle.** The non-runner and spectators never start the engine. On every change, rebuild the game by replaying `moves` from `A.fen(draft)` with `R.fromUci` / `R.apply` / `R.san`, then render. Hide PAUSE, STEP, TIME, REMATCH and NEW; show the runner's name ("ann's browser is running the engine").
- **Runner reload.** If this browser is the runner and loads a `battle` state that is not finished, replay `moves` and carry on from there. The runner keeps PAUSE, STEP and TIME; REMATCH and NEW are hidden for everyone online.
- A finished match (`status: 'done'`) is replayable read-only by anyone with the link.

Checks (use two browser profiles, two accounts):

- Ann creates a match and sees the waiting line with the link. Bob opens the link, joins; both see an empty board and it is White's turn only in Ann's browser.
- Pieces placed by one appear for the other within about two seconds. Neither can act out of turn. After one presses DONE, the other keeps placing until they press DONE.
- The battle plays in the finishing player's browser and the other watches the same moves appear. Both end on the same final position and result.
- Reload the runner mid-battle: it resumes. Reload the watcher: it catches up.
- The Automate leaderboard shows the winner with 1 win. A drawn match adds nothing.
- With `curl`: a `PUT` with a stale `version` gets `409` and the current match; a `PUT` from the player whose turn it is not gets `409`; a `PUT` from a third account gets `403`.
- Local Automate (no `match` parameter) still works exactly as in phase 1.

### Phase 4 — README

Write `README.md`: prerequisites (Node 20+, a MongoDB URI — local `mongod` or a free Atlas cluster), `.env` setup, the three scripts, and a pointer to `GAMES.md`. Under one page.

## Known limits (accepted, do not fix)

- Scores and match results are whatever the browser reports; a determined player can fake them. Acceptable for a class project among people who know each other.
- Games share the site's origin, so a game could call the API directly. They are asked not to in `GAMES.md`.
- Match updates arrive by polling every 1.5 seconds. No real-time transport.
- If the runner of an Automate battle closes their browser, the battle pauses until they return.

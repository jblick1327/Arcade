# Arcade — architecture

How the site, the API and the SDK fit together. **You don't need this to add a game:** start with [GAMES.md](GAMES.md). Read this when you change the server, the client or the SDK, or when you build an online multiplayer game.

A small MERN site that hosts web games made by a group of classmates. Players log in, play, and their scores are recorded. One game (Automate) is two-player online.

Design principles: keep it simple (no TypeScript, CSS framework, state library, WebSockets or Docker); games are static folders, so adding one never requires editing server or client code; everything is served from one origin by one Express process, so there is no CORS configuration.

## Layout

```
arcade/
  package.json          one package for server and client
  .env.example          MONGODB_URI, SESSION_SECRET, PORT
  vite.config.js        root: 'client'; dev proxy for /api, /games, /sdk -> http://localhost:3000
  ARCHITECTURE.md  GAMES.md  README.md
  .github/workflows/ci.yml   runs npm test, npm run build and npm audit on every PR
  sdk/arcade.js         what games include
  games/
    _template/          the starter game
    automate/  scarab-21/
  server/
    index.js            app setup, static serving, starts listening
    models.js           User, Score, Match
    games.js            reads games/*/game.json
    automate.js         server-side rules for Automate matches
    routes/auth.js  routes/games.js  routes/matches.js
  client/
    index.html
    src/main.jsx  App.jsx  api.js  bridge.js (the site half of the SDK)
    src/pages/Home.jsx  Play.jsx  Login.jsx  Register.jsx
```

Dependencies: `express`, `mongoose`, `express-session`, `connect-mongo`, `bcryptjs`, `dotenv`; `react`, `react-dom`, `react-router-dom`; dev: `vite`, `@vitejs/plugin-react`, `concurrently`. Keep it that way unless there is a good reason.

Scripts:

- `npm run dev` — Express on 3000 (`node --watch server/index.js`) and Vite on 5173 together. Developers open `http://localhost:5173`.
- `npm test` — server and game tests with Node's built-in runner (no database needed).
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
| `maxPlayers` | `2` or `4` (match games only) | `2` |
| `scoreOrder` | `"desc"` or `"asc"` | `"desc"` |
| `width`, `height` | number | 800, 600 |

A folder with a broken `game.json` is skipped and logged with `console.warn`; it must not crash the server. The game object returned by the API is these fields plus `slug`.

## Data (server/models.js)

```
User   { name, nameLower (unique index), passwordHash, createdAt }
Score  { user: ObjectId, game: slug string, score: Number, meta: Mixed, createdAt }      index { game, score }
Match  { game: slug string, players: [ObjectId] (1 to maxPlayers, max 4), status: 'waiting'|'active'|'done',
         turn: 0|1|2|3, state: Mixed (default null), winner: 0|1|2|3|null, version: Number (default 0),
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

A match is a shared JSON blob with a version number and a turn. The server does not know any game's rules, except Automate's (see below).

The match object returned everywhere (two-player Automate example; four-player matches include up to four entries in `players`):

```json
{
  "id": "…", "game": "automate",
  "players": [{"id": "…", "name": "ann"}, {"id": "…", "name": "bob"}],
  "status": "active", "turn": 0, "state": {}, "winner": null, "version": 3,
  "you": 0
}
```

`you` is the requester's index in `players` (0–1 for two-player games, 0–3 for four-player games), or `null` for spectators and guests. `players[0]` is always the creator.

| Request | Success | Errors |
|---|---|---|
| `GET /api/games/:slug/matches` | `200 [match, ...]` — `waiting` matches, plus `active` matches the requester is in; newest first, max 50 | `404` |
| `POST /api/games/:slug/matches` (auth) | `201 match` — `players: [me]`, `waiting`, `turn 0`, `state null`, `version 0` | `404`; `400` if the game's mode is not `match` |
| `POST /api/matches/:id/join` (auth) | `200 match` — adds me in the next seat, `version + 1`; stays `waiting` until `maxPlayers` joins, then becomes `active`. If already joined, return unchanged. | `404`; `409` full or concurrent join conflict |
| `GET /api/matches/:id` | `200 match` (no auth needed) | `404` |
| `PUT /api/matches/:id` `{version, state, turn, result?}` (auth) | `200 match` | see below |
| `POST /api/matches/:id/restart-draft` `{version}` (auth) | `200 match` — Automate only: resets an active draft that the current rules cannot continue (`state.restartRequired`) to an empty draft, `version + 1`. Either player may call it. | `404`; `403` not a player; `409 {error, match}` if `version` is stale or the match is not a restartable Automate draft |

`PUT` checks, in order:

1. `404` if the match does not exist. `403` if the requester is not one of the players.
2. `409 {error, match}` (including the current match object) if `status` is not `active`, or the requester's index is not `match.turn`, or `version` does not equal `match.version`.
3. `400` if `turn` is not an occupied player seat (0 through `players.length - 1`), if `state` serialises to more than 64,000 characters, or if `result` is present and `result.winner` is not an occupied seat or `null`.
4. For `automate` matches, the update must also pass `validateAutomateUpdate` in `server/automate.js` (one legal placement or move at a time; the result is computed from the position), otherwise `400`.
5. Otherwise store `state` and `turn`, add 1 to `version`. If `result` is present, also set `winner` and `status: 'done'`.

For Automate, saved drafts from older rule versions are checked when a match is read; if the current rules cannot continue one, its `state` is returned as `{ restartRequired: true, … }` and only `restart-draft` can change it.

Make the write atomic: `findOneAndUpdate` filtered on `_id`, `version`, `status: 'active'`; if it matches nothing, answer `409` with the current match. Join also filters on `status: 'waiting'` and `version`, preventing concurrent joins from overfilling a lobby.

## Client

Four routes with `react-router-dom`. `App.jsx` fetches `/api/me` once, keeps `user` in state, and renders a `<nav>` on every page: site name linking to `/`, then either "`<name>` · Log out" or "Log in · Register".

`api.js` is one function, `api(method, path, body)`, returning `{ status, data }` (same shape as `http` in `bridge.js`).

**`/` Home** — `<h1>`, then a `<ul>` of games: title as a link to `/play/<slug>`, description beside it.

**`/login`, `/register`** — a form with name and password. On success set `user` and go to `/`. On failure show the `error` text in a `<p role="alert">`.

**`/play/:slug` Play** — fetch the game (show "Game not found" on 404), then render:

1. `<h1>` title.
2. For `match` games only, the lobby (below).
3. The iframe: `<iframe src="/games/<slug>/" width height title>`. Give it a `key` of the slug, the match id (or `local`) and a reload counter, so it reloads when the match changes or when the dev "Reload game iframe" button is pressed. Attach the bridge in a `useEffect` exactly as the comment at the top of `bridge.js` shows.
4. If the user is a guest: `<p>Log in to save your score.</p>`
5. `<h2>Leaderboard</h2>` and a `<table>` (rank, name, score). Refetch it when the bridge calls `onScore`.

Lobby for `match` games. The current match comes from the `?match=<id>` query parameter.

- No `match` parameter: the iframe runs the game in local mode. Above it show a "New online match" button (guests see "Log in to play online" instead) and a list of matches from `GET /api/games/:slug/matches`, each with the host's name and a "Join" button (or "Resume" for the requester's own). Refresh the list every 5 seconds. New match → `POST`, then navigate to `?match=<id>`. Join → `POST …/join`, then navigate.
- With a `match` parameter: show one status line driven by the bridge's `onMatch` callback — for two-player games, "Waiting for an opponent" or "ann vs bob — in progress"; for four-player games, waiting displays the occupied seat count (e.g. "2/4") and active matches list all players. A finished match displays the winner or "draw". If the user is logged in, not in the match, and it is `waiting`, show a "Join this match" button. Always show a "Leave" link back to `/play/<slug>`. For an Automate match that needs a restart, show a "Restart draft" button (in the lobby list and on the match page).

**Dev shortcuts** — in `vite` dev mode only, `?dev=1` on the home or play page adds an iframe reload button and, on a waiting Automate match, a "Copy invite link" button. They are not in production builds.

## Known limits

- Scores and results for other games rely on browser reports. Automate validates legal draft transitions, legal battle moves, and results, but the runner's browser still supplies the moves, so their Stockfish origin is unverified.
- Games share the site's origin, so a game could call the API directly. They are asked not to in `GAMES.md`.
- Match updates arrive by polling every 1.5 seconds. No real-time transport.
- If the runner of an Automate battle closes their browser, the battle pauses until they return.

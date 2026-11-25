# Arcade

_Author: Reachnid Group_

Arcade hosts browser games made by classmates, with leaderboards and online multiplayer.

[Play Arcade](https://arcade-ivmq.onrender.com/) · [Watch the project demo](https://github.com/user-attachments/assets/3b82cf3b-05ee-453c-82a3-95c21cf3db77)

## What's inside

- **Pages:** Home, Games, Leaderboard, About Us, Contact, sign-in / register, and a play page for each game, with a light/dark theme.
- **Games:** 2048, Automate (online, 2 players), Boarded Up, Crowns & Bones (online, 4 players), Doors, MERN Stacker, Retro Paddle, Scarab 21 and Snake. Each one is a folder in `games/`.
- **Code:** an Express + MongoDB API in `server/` (models, controllers, routes, middleware, utils), a React client in `client/src/` (components, hooks, pages, styles, utils), and the game SDK in `sdk/`.

Made by the REACHNID team: Darryn, Adrian, Ahmed, Lex and James.

## Contribute

- [Add a game](GAMES.md) using `games/_template/` and a static file server. You don't need MongoDB or the full site for this.
- [Read the architecture guide](ARCHITECTURE.md) for the client, server, SDK, and [hosting setup](ARCHITECTURE.md#free-hosting-render--mongodb-atlas).

Open pull requests against `master`. Run `npm test` and `npm run build` before submitting.

## Run locally

Install Node 22+ and run:

```sh
npm ci
npm run dev:local        # Express on :3000 and Vite on :5173 - open http://localhost:5173
```

No database or `.env` needed: `dev:local` uses a throwaway in-memory MongoDB (downloaded on first run, about 100 MB) that resets whenever the server restarts.

To use a persistent database instead (a local `mongod` such as `mongodb://127.0.0.1:27017/arcade`, or a free Atlas cluster), copy `.env.example` to `.env`, set `MONGODB_URI` and `SESSION_SECRET`, and run `npm run dev`.

## Scripts

- `npm run dev:local` — Express on :3000 and Vite on :5173 on a throwaway in-memory database. Open http://localhost:5173.
- `npm run dev` — the same, using the database in `.env`.
- `npm test` — every test with Node's built-in runner; no database needed. `npm run test:platform` runs only `server/tests/*.test.js`, `npm run test:games` only each game's `tests/*.cjs`.
- `npm run build` — build the client to `client/dist`.
- `npm run test:smoke` — after a build, boots the real server on an in-memory database and checks the site, every game, registration, scores and matches.
- `npm start` — Express only, serving `client/dist` on :3000.
- `npm run format` — format the code with Prettier (`npm run format:check` only reports).

## Notes

- `games/package.json` only marks game files as CommonJS so the games' Node tests (and server hooks) can use `require` despite the root `"type": "module"`.
- A game's tests can be run alone, e.g. `node --test games/scarab-21/tests/rules.cjs`. CI (`.github/workflows/ci.yml`) runs the tests, the build, the smoke test and a high-severity `npm audit` on every push and pull request.
- Hosting on Render + MongoDB Atlas is covered in [ARCHITECTURE.md](ARCHITECTURE.md#free-hosting-render--mongodb-atlas).

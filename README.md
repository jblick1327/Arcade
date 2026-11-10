# Arcade

A small MERN site that hosts web games made by classmates. Players log in, play, and their scores are recorded. Automate is two-player online.

## Prerequisites

- Node 22+
- A MongoDB URI: a local `mongod` (`mongodb://127.0.0.1:27017/arcade`) or a free Atlas cluster.

## Setup

```sh
npm install
cp .env.example .env     # then edit MONGODB_URI and SESSION_SECRET
```

## Scripts

- `npm run dev` — Express on :3000 and Vite on :5173. Open http://localhost:5173.
- `npm test` — run every test (server, Automate, Scarab 21) with Node's built-in runner; no database needed.
- `npm run build` — build the client to `client/dist`.
- `npm start` — Express only, serving `client/dist` on :3000.

## Adding a game

See [GAMES.md](GAMES.md). Drop a folder into `games/` and refresh; no server or client code changes.

## Notes

- No extra dependencies beyond those in `SPEC.md`. `games/package.json` only marks game files as CommonJS so Automate's Node tests can `require` them despite the root `"type": "module"`.
- Tests: `npm test` runs `server/**/*.test.js` and each game's `tests/*.cjs`. A game's tests can also be run alone, e.g. `node --test games/scarab-21/tests/rules.cjs`. CI (`.github/workflows/ci.yml`) runs the tests, the build and a high-severity `npm audit` on every push and pull request.

# Arcade

A small MERN site that hosts web games made by classmates. Players log in, play, and their scores are recorded. Automate is two-player online.

## I just want to make a game

You don't need MongoDB, accounts or the full site. Read [GAMES.md](GAMES.md): copy `games/_template/`, edit it, and try it with a plain static file server started in the repo root (for example `python3 -m http.server`, then open `http://localhost:8000/games/<your-game>/`). Scores print to the browser console in that offline mode. Opening `index.html` by double-clicking it does not work, because the SDK is loaded from `/sdk/arcade.js`. When your game works, send it in as a pull request (steps in GAMES.md).

## Running the whole site

You only need this to check scores, the leaderboard or online matches on the real site, or to work on the server and client.

### Prerequisites

- Node 22+
- A MongoDB URI: a local `mongod` (`mongodb://127.0.0.1:27017/arcade`) or a free Atlas cluster.

### Setup

```sh
npm install
cp .env.example .env     # then edit MONGODB_URI and SESSION_SECRET
```

## Scripts

- `npm run dev` — Express on :3000 and Vite on :5173. Open http://localhost:5173.
- `npm test` — run every test (server, Automate, Scarab 21) with Node's built-in runner; no database needed.
- `npm run build` — build the client to `client/dist`.
- `npm start` — Express only, serving `client/dist` on :3000.

## Contributing

Everything goes through pull requests into `master`; please don't push to it directly.

- **Adding a game:** see [GAMES.md](GAMES.md). Drop a folder into `games/` and refresh; no server or client code changes. Keep your changes inside your own game's folder.
- **Changing the site itself** (server, client, SDK): keep it small and say why in the PR.
- Before opening a PR, run `npm test` and `npm run build`. CI runs both on every PR and must pass before it can be merged.
- [SPEC.md](SPEC.md) is the original design document. It's a useful reference for how the site works, but you don't need it to add a game.

## Notes

- No extra dependencies beyond those in `SPEC.md`. `games/package.json` only marks game files as CommonJS so Automate's Node tests can `require` them despite the root `"type": "module"`.
- Tests: `npm test` runs `server/**/*.test.js` and each game's `tests/*.cjs`. A game's tests can also be run alone, e.g. `node --test games/scarab-21/tests/rules.cjs`. CI (`.github/workflows/ci.yml`) runs the tests, the build and a high-severity `npm audit` on every push and pull request.

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

## Free hosting: Render + MongoDB Atlas

The root [`render.yaml`](render.yaml) creates one **Free** Render web service in Virginia. Express serves the React build, API, games and SDK from the same HTTPS origin. Render generates `SESSION_SECRET`, supplies `PORT`, and deploys updates from `master` after CI passes.

1. In [MongoDB Atlas](https://cloud.mongodb.com/), create a **Free (M0)** cluster, preferably on AWS in Northern Virginia (`us-east-1`). Create a database user with `readWrite` access to the `arcade` database.
2. Copy the cluster's **Drivers** connection string, replace the username/password placeholders, and set the database name to `arcade`: `mongodb+srv://<username>:<password>@<cluster-host>/arcade?retryWrites=true&w=majority`. URL-encode special characters in the username and password. Keep the completed URI out of Git.
3. In [Render](https://dashboard.render.com/), choose **New → Blueprint**, connect this repository and select `master`. Review that the service uses the **Free** plan, then enter the connection string as `MONGODB_URI`.
4. Once the service exists, copy its outbound IP ranges from **Connect → Outbound** into Atlas's **Network Access** IP access list. Allow all listed ranges so the connection survives Render's routing changes. If the first deploy fails before the allowlist is ready, redeploy after saving it.
5. Open the assigned `https://…onrender.com` URL. `/healthz` should return `{"status":"ok"}`. Register, refresh to check that your login persists, then play a game and check its leaderboard. Use two accounts to check an Automate match.

Free Render services sleep after 15 minutes without incoming traffic and can take about a minute to wake up. Leave payment details unset for a strictly free setup: if included bandwidth or build minutes run out, Render suspends the relevant service or builds instead of billing overages. Atlas Free clusters do not expire. See [Render's free limits](https://render.com/docs/free) and [Atlas Free setup](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).

## Contributing

Everything goes through pull requests into `master`; please don't push to it directly.

- **Adding a game:** see [GAMES.md](GAMES.md). Drop a folder into `games/` and refresh; no server or client code changes. Keep your changes inside your own game's folder.
- **Changing the site itself** (server, client, SDK): keep it small and say why in the PR.
- Before opening a PR, run `npm test` and `npm run build`. CI runs both on every PR and must pass before it can be merged.
- [ARCHITECTURE.md](ARCHITECTURE.md) explains how the site, the API and the SDK fit together. It's a useful reference, but you don't need it to add a game.

## Notes

- No extra dependencies beyond those listed in `ARCHITECTURE.md`. `games/package.json` only marks game files as CommonJS so Automate's Node tests can `require` them despite the root `"type": "module"`.
- Tests: `npm test` runs `server/**/*.test.js` and each game's `tests/*.cjs`. A game's tests can also be run alone, e.g. `node --test games/scarab-21/tests/rules.cjs`. CI (`.github/workflows/ci.yml`) runs the tests, the build and a high-severity `npm audit` on every push and pull request.

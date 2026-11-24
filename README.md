# Arcade

Arcade hosts browser games made by classmates, with leaderboards and online multiplayer.

[Play Arcade](https://arcade-ivmq.onrender.com/) · [Watch the project demo](https://github.com/user-attachments/assets/3b82cf3b-05ee-453c-82a3-95c21cf3db77)

## Contribute

- [Add a game](GAMES.md) using `games/_template/` and a static file server. You don't need MongoDB or the full site for this.
- [Read the architecture guide](ARCHITECTURE.md) for the client, server, SDK, and [hosting setup](ARCHITECTURE.md#free-hosting-render--mongodb-atlas).

Open pull requests against `master`. Run `npm test` and `npm run build` before submitting.

## Run locally

Install Node 22+ and have a MongoDB URI ready. Run `npm ci`, copy `.env.example` to `.env`, and set `MONGODB_URI` and `SESSION_SECRET`. Run `npm run dev` and open [localhost:5173](http://localhost:5173).

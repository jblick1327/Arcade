// server.js - main server file for the application
// Author: Reachnid Group
// Centennial College - Fall 2026

// Needs MONGODB_URI and SESSION_SECRET in .env (see .env.example). PORT and NODE_ENV are optional.
// `npm run dev:local` (the --memory-db flag) runs without either, on a throwaway database

//=============================================================
//                          IMPORTS
//=============================================================

// attaching .env file to the project
import 'dotenv/config';

// import express, sessions & mongoose
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// import routes
import authRoutes from './routes/auth_routes.js';
import gameRoutes from './routes/game_routes.js';
import matchRoutes from './routes/match_routes.js';

//=============================================================
//                         SETTINGS
//=============================================================

// read settings from .env
const { MONGODB_URI, SESSION_SECRET, PORT = 3000 } = process.env;
const isProduction = process.env.NODE_ENV === 'production';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// `--memory-db` (npm run dev:local, the smoke test) and Render PR previews use a throwaway
// in-memory database. Previews inherit production's MONGODB_URI, so they must never use it
const memoryDb = process.argv.includes('--memory-db') || process.env.IS_PULL_REQUEST === 'true';

// stop straight away if a required setting is missing
if (!memoryDb && (!MONGODB_URI || !SESSION_SECRET)) {
  console.error(
    'Set MONGODB_URI and SESSION_SECRET in .env (see .env.example), or run npm run dev:local.',
  );
  process.exit(1);
}

//=============================================================
//                       CONNECT TO DB
//=============================================================

// pick the database: the real one from .env, or a throwaway one for --memory-db
let mongoUri = MONGODB_URI;
if (memoryDb) {
  const { startMemoryDb } = await import('./memory-db.js');
  mongoUri = await startMemoryDb();
  console.log('Using a throwaway in-memory database: everything is lost when the server stops.');
}

// without a configured secret, sessions only need to last as long as the throwaway database
const sessionSecret = SESSION_SECRET || randomBytes(32).toString('hex');

// connect to the database (the session store below reuses this connection)
await mongoose.connect(mongoUri);

// express app
const app = express();

// in production the app sits behind Render's proxy - trust it so secure cookies work
if (isProduction) app.set('trust proxy', 1);

//=============================================================
//                        HEALTH CHECK
//=============================================================

// used by Render to check the app is up - fails when MongoDB is disconnected
app.get('/healthz', (req, res) => {
  const healthy = mongoose.connection.readyState === 1;
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'unavailable' });
});

//=============================================================
//                         MIDDLEWARE
//=============================================================

// allows json data to be sent to the server
app.use(express.json({ limit: '100kb' }));

// cookie sessions, stored in MongoDB so logins survive a restart
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ client: mongoose.connection.getClient() }),
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: THIRTY_DAYS_MS,
    },
  }),
);

//=============================================================
//                         API ROUTES
//=============================================================

// use routes - everything under /api
const api = express.Router();
api.use(authRoutes, gameRoutes, matchRoutes);

// any other /api path is not found
api.use((req, res) => res.status(404).json({ error: 'Not found' }));

// error handler - Express 5 sends errors from async handlers here
// (`next` must stay in the list so Express treats this as an error handler)
api.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Body too large' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

app.use('/api', api);

//=============================================================
//                        STATIC FILES
//=============================================================

// the SDK and the games are plain folders - unknown paths 404 instead of falling through
app.use('/sdk', express.static('sdk'), (req, res) => res.status(404).end());
app.use('/games', express.static('games'), (req, res) => res.status(404).end());

// the built React app - any other GET returns index.html so page reloads work
app.use(express.static('client/dist'));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.resolve('client/dist/index.html'));
});

//=============================================================
//                       START SERVER
//=============================================================

// listen for requests
app.listen(PORT, () => console.log(`Arcade on http://localhost:${PORT}`));

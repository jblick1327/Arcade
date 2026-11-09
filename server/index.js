import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import path from 'node:path';
import authRoutes from './routes/auth.js';
import gameRoutes from './routes/games.js';
import matchRoutes from './routes/matches.js';

const { MONGODB_URI, SESSION_SECRET, PORT = 3000 } = process.env;
if (!MONGODB_URI || !SESSION_SECRET) {
  console.error('Set MONGODB_URI and SESSION_SECRET in .env (see .env.example).');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ client: mongoose.connection.getClient() }),
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 },
}));

// Express 5 forwards errors from async handlers here.
const api = express.Router();
api.use(authRoutes, gameRoutes, matchRoutes);
api.use((req, res) => res.status(404).json({ error: 'Not found' }));
api.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Body too large' });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});
app.use('/api', api);

app.use('/sdk', express.static('sdk'), (req, res) => res.status(404).end());
app.use('/games', express.static('games'), (req, res) => res.status(404).end());
app.use(express.static('client/dist'));
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.resolve('client/dist/index.html'));
});

app.listen(PORT, () => console.log(`Arcade on http://localhost:${PORT}`));

import { Router } from 'express';
import { Score, Match } from '../models.js';
import { requireAuth } from '../auth.js';
import { listGames, getGame } from '../games.js';

const router = Router();

router.get('/games', (req, res) => res.json(listGames()));

router.get('/games/:slug', (req, res) => {
  const game = getGame(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

router.post('/games/:slug/scores', requireAuth, async (req, res) => {
  const game = getGame(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const { score, meta } = req.body || {};
  if (typeof score !== 'number' || !Number.isFinite(score)) return res.status(400).json({ error: 'score must be a finite number' });
  if (meta !== undefined && meta !== null && JSON.stringify(meta).length > 2000) return res.status(400).json({ error: 'meta is too large' });
  await Score.create({ user: req.userId, game: game.slug, score, meta: meta ?? null });
  res.status(201).json({ ok: true });
});

const lookup = [
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
  { $project: { _id: 0, name: { $arrayElemAt: ['$u.name', 0] }, score: 1, at: 1 } },
];

router.get('/games/:slug/leaderboard', async (req, res) => {
  const game = getGame(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  let rows;
  if (game.mode === 'match') {
    rows = await Match.aggregate([
      { $match: { game: game.slug, status: 'done', winner: { $in: [0, 1, 2, 3] } } },
      { $project: { winnerId: { $arrayElemAt: ['$players', '$winner'] }, updatedAt: 1 } },
      { $group: { _id: '$winnerId', score: { $sum: 1 }, at: { $max: '$updatedAt' } } },
      { $sort: { score: -1, at: 1 } },
      { $limit: limit },
      ...lookup,
    ]);
  } else {
    const dir = game.scoreOrder === 'asc' ? 1 : -1;
    rows = await Score.aggregate([
      { $match: { game: game.slug } },
      { $sort: { score: dir, createdAt: 1 } },
      { $group: { _id: '$user', score: { $first: '$score' }, at: { $first: '$createdAt' } } },
      { $sort: { score: dir, at: 1 } },
      { $limit: limit },
      ...lookup,
    ]);
  }
  res.json(rows);
});

export default router;

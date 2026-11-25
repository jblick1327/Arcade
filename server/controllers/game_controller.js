// game_controller.js - controller for handling game, score and leaderboard requests
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import the score & match models
import Score from '../models/score_model.js';
import Match from '../models/match_model.js';

// import the game catalogue helpers
import { listGames, getGame } from '../utils/game_catalog.js';

//=============================================================
//                         SETTINGS
//=============================================================

const MAX_META_LENGTH = 2000; // characters of JSON
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

//=============================================================
//                          HELPERS
//=============================================================

// look up the game in req.params.slug, or send a 404 and return null
function findGame(req, res) {
  const game = getGame(req.params.slug);
  if (!game) res.status(404).json({ error: 'Game not found' });
  return game;
}

// aggregation steps that turn grouped user ids into { name, score, at } rows
const withPlayerNames = [
  { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
  { $project: { _id: 0, name: { $arrayElemAt: ['$u.name', 0] }, score: 1, at: 1 } },
];

//=============================================================
//                      REQUEST HANDLERS
//=============================================================

// GET all games
export const getAllGames = (req, res) => {
  res.json(listGames());
};

// GET a single game
export const getSingleGame = (req, res) => {
  const game = findGame(req, res);
  if (game) res.json(game);
};

// POST a score for the logged-in user - body: { score, meta? }
export const submitScore = async (req, res) => {
  const game = findGame(req, res);
  if (!game) return;

  // destructure the request body to get the score details
  const { score, meta } = req.body || {};

  // check the score is a real number and meta isn't too big
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return res.status(400).json({ error: 'score must be a finite number' });
  }
  if (meta !== undefined && meta !== null && JSON.stringify(meta).length > MAX_META_LENGTH) {
    return res.status(400).json({ error: 'meta is too large' });
  }

  // create a new score document in database
  await Score.create({ user: req.userId, game: game.slug, score, meta: meta ?? null });
  res.status(201).json({ ok: true });
};

// GET the leaderboard for a game, one row per player
// score games: each player's best score / match games: number of matches won
// ties go to whoever reached the score first
export const getLeaderboard = async (req, res) => {
  const game = findGame(req, res);
  if (!game) return;
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

  let rows;
  if (game.mode === 'match') {
    // count wins per player from finished matches
    rows = await Match.aggregate([
      { $match: { game: game.slug, status: 'done', winner: { $in: [0, 1, 2, 3] } } },
      { $project: { winnerId: { $arrayElemAt: ['$players', '$winner'] }, updatedAt: 1 } },
      { $group: { _id: '$winnerId', score: { $sum: 1 }, at: { $max: '$updatedAt' } } },
      { $sort: { score: -1, at: 1 } },
      { $limit: limit },
      ...withPlayerNames,
    ]);
  } else {
    // best score per player (highest, or lowest when scoreOrder is "asc")
    const direction = game.scoreOrder === 'asc' ? 1 : -1;
    rows = await Score.aggregate([
      { $match: { game: game.slug } },
      { $sort: { score: direction, createdAt: 1 } },
      // after sorting, the first score for each user is their best
      { $group: { _id: '$user', score: { $first: '$score' }, at: { $first: '$createdAt' } } },
      { $sort: { score: direction, at: 1 } },
      { $limit: limit },
      ...withPlayerNames,
    ]);
  }

  res.json(rows);
};

// game_routes.js - routes for the game list, scores and leaderboards
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import express & create router
import { Router } from 'express';
const router = Router();

// import the login check
import { requireAuth } from '../middleware/auth_middleware.js';

// import game controller
import {
  getAllGames,
  getSingleGame,
  submitScore,
  getLeaderboard,
} from '../controllers/game_controller.js';

//=============================================================
//                        GAME ROUTES
//=============================================================

// GET all games
router.get('/games', getAllGames);

// GET a single game
router.get('/games/:slug', getSingleGame);

// POST a new score (must be logged in)
router.post('/games/:slug/scores', requireAuth, submitScore);

// GET a game's leaderboard
router.get('/games/:slug/leaderboard', getLeaderboard);

//=============================================================
//                          EXPORT
//=============================================================

// export the router
export default router;

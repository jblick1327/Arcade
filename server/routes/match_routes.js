// match_routes.js - routes for online matches
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

// import match controller
import {
  getLobby,
  createMatch,
  joinMatch,
  cancelMatch,
  runAction,
  getMatch,
  updateMatch,
} from '../controllers/match_controller.js';

//=============================================================
//                        MATCH ROUTES
//=============================================================

// GET the lobby for a game
router.get('/games/:slug/matches', getLobby);

// POST a new match (must be logged in)
router.post('/games/:slug/matches', requireAuth, createMatch);

// POST join a match
router.post('/matches/:id/join', requireAuth, joinMatch);

// DELETE (cancel) a waiting match
router.delete('/matches/:id', requireAuth, cancelMatch);

// POST run a named action from the game's server hook
router.post('/matches/:id/actions/:action', requireAuth, runAction);

// GET a single match
router.get('/matches/:id', getMatch);

// PUT a turn
router.put('/matches/:id', requireAuth, updateMatch);

//=============================================================
//                          EXPORT
//=============================================================

// export the router
export default router;

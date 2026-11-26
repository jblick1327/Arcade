// main.js - starts Boarded Up on the page and sends survival scores to the Arcade site
// Author: Reachnid Group
// Centennial College - Fall 2026

// Survival runs are scored by the total points earned (the round, kills and map go along as
// meta). Story missions save their progress in the browser and are not sent to the leaderboard.

//=============================================================
//                          IMPORTS
//=============================================================

// import the game's public entry point
import { createGame } from './game/index.js';

//=============================================================
//                           START
//=============================================================

createGame(document.getElementById('game'), {
  // a survival run ended - guests (and offline play) get { ok: false } back, which is fine
  onGameOver: (stats) => {
    window.Arcade.submitScore(stats.points, {
      map: stats.levelName,
      round: stats.round,
      kills: stats.kills,
      timeSeconds: stats.timeSeconds,
      accuracy: stats.accuracy,
    });
  },
});

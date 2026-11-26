// match_model.js - model for the matches collection in the database
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import mongoose & schema
import mongoose from 'mongoose';
const { Schema } = mongoose;

//=============================================================
//                          SCHEMA
//=============================================================

// create a schema for the matches collection
// (one document per online match of a "match" game, with 2 or 4 seats)
const matchSchema = new Schema(
  {
    // the game's folder name, e.g. "automate"
    game: { type: String, required: true },

    // user ids in seat order - seat 0 is the player who created the match
    players: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // waiting = seats still open, active = being played, done = finished
    status: { type: String, enum: ['waiting', 'active', 'done'], default: 'waiting' },

    // seat number of the player whose move it is
    turn: { type: Number, enum: [0, 1, 2, 3], default: 0 },

    // the game's own saved state (the server only checks it for Automate)
    state: { type: Schema.Types.Mixed, default: null },

    // winning seat, or null for a draw / unfinished match
    winner: { type: Number, enum: [0, 1, 2, 3, null], default: null },

    // goes up by one on every write, so two players can't overwrite each other
    version: { type: Number, default: 0 },
  },
  // minimize: false keeps empty objects inside `state` instead of dropping them
  { timestamps: true, minimize: false },
);

// index used by the lobby query
matchSchema.index({ game: 1, status: 1 });

//=============================================================
//                          EXPORTS
//=============================================================

// export the model to be used in other files
export default mongoose.model('Match', matchSchema);

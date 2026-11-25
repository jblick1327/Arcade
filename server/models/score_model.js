// score_model.js - model for the scores collection in the database
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

// create a schema for the scores collection
// (one document per score submitted to a single-player "score" game)
const scoreSchema = new Schema({
  // the player who earned the score
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  // the game's folder name, e.g. "scarab-21"
  game: { type: String, required: true },

  score: { type: Number, required: true },

  // optional extra data the game wants to keep with the score
  meta: Schema.Types.Mixed,

  createdAt: { type: Date, default: Date.now },
});

// index used by the leaderboard query
scoreSchema.index({ game: 1, score: 1 });

//=============================================================
//                          EXPORTS
//=============================================================

// export the model to be used in other files
export default mongoose.model('Score', scoreSchema);

import mongoose from 'mongoose';
const { Schema } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true },
  nameLower: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const scoreSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  game: { type: String, required: true },
  score: { type: Number, required: true },
  meta: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});
scoreSchema.index({ game: 1, score: 1 });

const matchSchema = new Schema({
  game: { type: String, required: true },
  players: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['waiting', 'active', 'done'], default: 'waiting' },
  turn: { type: Number, enum: [0, 1, 2, 3], default: 0 },
  state: { type: Schema.Types.Mixed, default: null },
  winner: { type: Number, enum: [0, 1, 2, 3, null], default: null },
  version: { type: Number, default: 0 },
}, { timestamps: true, minimize: false });
matchSchema.index({ game: 1, status: 1 });

export const User = mongoose.model('User', userSchema);
export const Score = mongoose.model('Score', scoreSchema);
export const Match = mongoose.model('Match', matchSchema);

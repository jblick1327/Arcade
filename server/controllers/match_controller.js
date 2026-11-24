// match_controller.js - controller for handling online match requests
// Author: Reachnid Group
// Centennial College - Fall 2026

// Every match has a `version` number that goes up by one on each write. A write must send the
// version it last saw; if someone else wrote first the request gets a 409 plus the latest match,
// so the browser can refresh and try again. This stops two players overwriting each other.

//=============================================================
//                          IMPORTS
//=============================================================

// import mongoose (for id checks)
import mongoose from 'mongoose';

// import the match & user models
import Match from '../models/match_model.js';
import User from '../models/user_model.js';

// import the game catalogue & Automate rule checks
import { getGame } from '../utils/game_catalog.js';
import {
  currentAutomateState,
  restartIncompatibleDraft,
  validateAutomateUpdate,
} from '../utils/automate_rules.js';

//=============================================================
//                          HELPERS
//=============================================================

// seat number (0-3) of a user in the match, or -1 when they are not playing
const seatOf = (match, userId) => match.players.findIndex((p) => String(p) === String(userId));

// the state and turn the browser should see
// (Automate drafts are re-checked so older saves stay playable)
function matchState(match) {
  if (match.game !== 'automate') return { state: match.state, turn: match.turn };
  const state = currentAutomateState(match.state);
  let turn = match.turn;

  // during the draft the turn always follows the colour placing next
  if (state?.phase === 'draft' && !state.restartRequired) turn = state.draft.turn === 'w' ? 0 : 1;
  return { state, turn };
}

// turn one match (or a list of matches) into the JSON the browser uses
// `you` is the viewer's seat, or null for spectators
async function present(docs, me) {
  const list = Array.isArray(docs) ? docs : [docs];

  // look up every player's name in one query
  const ids = [...new Set(list.flatMap((m) => m.players.map(String)))];
  const users = await User.find({ _id: { $in: ids } }, 'name');
  const names = Object.fromEntries(users.map((u) => [String(u._id), u.name]));

  const out = list.map((m) => {
    const seat = me ? seatOf(m, me) : -1;
    const { state, turn } = matchState(m);
    return {
      id: String(m._id),
      game: m.game,
      players: m.players.map((p) => ({ id: String(p), name: names[String(p)] || '?' })),
      status: m.status,
      turn,
      state,
      winner: m.winner,
      version: m.version,
      you: seat < 0 ? null : seat,
    };
  });
  return Array.isArray(docs) ? out : out[0];
}

// load the match in req.params.id, or send a 404 and return null
async function findMatch(req, res) {
  // check if the id is a valid mongoose ObjectId, then find the match by id
  const match = mongoose.isValidObjectId(req.params.id)
    ? await Match.findById(req.params.id)
    : null;

  // check if the match exists
  if (!match) res.status(404).json({ error: 'Match not found' });
  return match;
}

// send a 409 with the latest copy of the match so the browser can refresh
async function sendConflict(res, match, userId, error = 'Match changed, refresh') {
  res.status(409).json({ error, match: match ? await present(match, userId) : null });
}

//=============================================================
//                      REQUEST HANDLERS
//=============================================================

// GET the lobby - open matches anyone can join, plus the viewer's own active matches
export const getLobby = async (req, res) => {
  if (!getGame(req.params.slug)) return res.status(404).json({ error: 'Game not found' });

  const me = req.session.userId;
  const or = [{ status: 'waiting' }];
  if (me) or.push({ status: 'active', players: new mongoose.Types.ObjectId(me) });

  // newest first, at most 50
  const docs = await Match.find({ game: req.params.slug, $or: or })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(await present(docs, me));
};

// POST a new match with the caller in seat 0
export const createMatch = async (req, res) => {
  const game = getGame(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.mode !== 'match') {
    return res.status(400).json({ error: 'This game has no online matches' });
  }

  // create a new match document in database
  const m = await Match.create({ game: game.slug, players: [req.userId] });
  res.status(201).json(await present(m, req.userId));
};

// POST join a match - takes the next free seat; the match starts once every seat is filled
export const joinMatch = async (req, res) => {
  const m = await findMatch(req, res);
  if (!m) return;

  // already in this match - just send it back
  if (seatOf(m, req.userId) >= 0) return res.json(await present(m, req.userId));

  // check there is a free seat
  const maxPlayers = getGame(m.game)?.maxPlayers || 2;
  if (m.players.length >= maxPlayers || m.status !== 'waiting') {
    return res.status(409).json({ error: 'Match is full' });
  }

  // the last-seat check stops two players joining at once from overfilling the match
  const upd = await Match.findOneAndUpdate(
    {
      _id: m._id,
      status: 'waiting',
      version: m.version,
      [`players.${maxPlayers - 1}`]: { $exists: false },
    },
    {
      $push: { players: req.userId },
      $set: { status: m.players.length + 1 === maxPlayers ? 'active' : 'waiting' },
      $inc: { version: 1 },
    },
    { new: true },
  );
  if (!upd) return res.status(409).json({ error: 'Match changed, try joining again' });
  res.json(await present(upd, req.userId));
};

// DELETE a match - the creator may cancel it only before anyone has joined
export const cancelMatch = async (req, res) => {
  const m = await findMatch(req, res);
  if (!m) return;

  // only the creator can cancel
  if (String(m.players[0]) !== req.userId) {
    return res.status(403).json({ error: 'Only the creator can cancel this match' });
  }

  // only a waiting match that nobody else has joined
  if (m.status !== 'waiting' || m.players.length !== 1) {
    return res.status(409).json({ error: 'Only unjoined waiting matches can be cancelled' });
  }

  // the conditions stop us deleting a match if another player joins at the same moment
  const deleted = await Match.findOneAndDelete({
    _id: m._id,
    status: 'waiting',
    version: m.version,
    'players.0': req.userId,
    'players.1': { $exists: false },
  });
  if (!deleted) return res.status(409).json({ error: 'Match changed, refresh' });
  res.status(204).end();
};

// POST restart an old Automate draft that the current rules can't continue
// (either player in the match may do this)
export const restartDraft = async (req, res) => {
  const m = await findMatch(req, res);
  if (!m) return;

  // only players in the match
  if (seatOf(m, req.userId) < 0) {
    return res.status(403).json({ error: 'You are not in this match' });
  }

  // check the version first, so a player racing a restart that already happened gets a refresh
  if (req.body?.version !== m.version) return sendConflict(res, m, req.userId);

  // only drafts flagged restartRequired can be restarted
  const restart =
    m.game === 'automate' && m.status === 'active' ? restartIncompatibleDraft(m.state) : null;
  if (!restart) return sendConflict(res, m, req.userId, 'Draft restart is not available');

  // save the reset draft
  const updated = await Match.findOneAndUpdate(
    { _id: m._id, game: 'automate', status: 'active', version: m.version },
    { $set: restart, $inc: { version: 1 } },
    { new: true },
  );
  if (!updated) return sendConflict(res, await Match.findById(m._id), req.userId);
  res.json(await present(updated, req.userId));
};

// GET a single match (spectators and guests may read it; `you` is null for them)
export const getMatch = async (req, res) => {
  const m = await findMatch(req, res);
  if (!m) return;
  res.json(await present(m, req.session.userId));
};

// PUT a turn - body: { version, state, turn, result? }
// only the player whose turn it is may write, and only against the latest version
// turn = the next player's seat, result.winner = winning seat (or null for a draw) to end the match
export const updateMatch = async (req, res) => {
  const m = await findMatch(req, res);
  if (!m) return;

  // only players in the match
  const seat = seatOf(m, req.userId);
  if (seat < 0) return res.status(403).json({ error: 'You are not in this match' });

  // destructure the request body to get the turn details
  const { version, state, turn, result } = req.body || {};

  // it must be this player's turn, and they must have the latest version
  const current = matchState(m);
  if (m.status !== 'active' || seat !== current.turn || version !== m.version) {
    return sendConflict(res, m, req.userId);
  }

  // check the body is valid
  if (!Number.isInteger(turn) || turn < 0 || turn >= m.players.length) {
    return res.status(400).json({ error: 'turn must identify a player in the match' });
  }
  if (state === undefined || JSON.stringify(state).length > 64000) {
    return res.status(400).json({ error: 'state missing or too large' });
  }
  if (result != null && ![null, ...m.players.map((_, i) => i)].includes(result.winner)) {
    return res.status(400).json({ error: 'result.winner must identify a player or be null' });
  }

  // Automate moves are fully re-checked on the server; other games are trusted
  const set =
    m.game === 'automate'
      ? validateAutomateUpdate(current.state, seat, { state, turn, result })
      : { state, turn };
  if (!set) return res.status(400).json({ error: 'invalid-automate-update' });
  if (m.game !== 'automate' && result) {
    set.winner = result.winner;
    set.status = 'done';
  }

  // save only if nobody else wrote first
  const upd = await Match.findOneAndUpdate(
    { _id: m._id, version: m.version, status: 'active' },
    { $set: set, $inc: { version: 1 } },
    { new: true },
  );
  if (!upd) return sendConflict(res, await Match.findById(m._id), req.userId);
  res.json(await present(upd, req.userId));
};

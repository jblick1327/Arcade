import { Router } from 'express';
import mongoose from 'mongoose';
import { Match, User } from '../models.js';
import { requireAuth } from '../auth.js';
import { getGame, getGameServer } from '../games.js';

const router = Router();

/** Applies the game's optional view hook; without one the saved state is returned as is. */
function matchState(match, hooks) {
  const raw = { state: match.state, turn: match.turn };
  return hooks?.view ? hooks.view({ ...raw, status: match.status }) : raw;
}

/** Named actions the game currently offers on this match. */
function availableActions(match, hooks) {
  return Object.entries(hooks?.actions || {})
    .filter(([, a]) => a.available?.({ state: match.state, status: match.status }))
    .map(([name, a]) => ({ name, label: a.label || name, ...(a.confirm ? { confirm: a.confirm } : {}) }));
}

async function present(docs, me) {
  const list = Array.isArray(docs) ? docs : [docs];
  const hookList = await Promise.all([...new Set(list.map((m) => m.game))].map(async (g) => [g, await getGameServer(g)]));
  const hooks = Object.fromEntries(hookList);
  const ids = [...new Set(list.flatMap((m) => m.players.map(String)))];
  const users = await User.find({ _id: { $in: ids } }, 'name');
  const names = Object.fromEntries(users.map((u) => [String(u._id), u.name]));
  const out = list.map((m) => {
    const idx = me ? m.players.findIndex((p) => String(p) === String(me)) : -1;
    const { state, turn, blocked } = matchState(m, hooks[m.game]);
    return {
      id: String(m._id),
      game: m.game,
      players: m.players.map((p) => ({ id: String(p), name: names[String(p)] || '?' })),
      status: m.status,
      turn,
      state,
      winner: m.winner,
      version: m.version,
      you: idx < 0 ? null : idx,
      blocked: blocked || null,
      actions: idx < 0 ? [] : availableActions(m, hooks[m.game]),
    };
  });
  return Array.isArray(docs) ? out : out[0];
}

const validId = (id) => mongoose.isValidObjectId(id);

router.get('/games/:slug/matches', async (req, res) => {
  if (!getGame(req.params.slug)) return res.status(404).json({ error: 'Game not found' });
  const me = req.session.userId;
  const or = [{ status: 'waiting' }];
  if (me) or.push({ status: 'active', players: new mongoose.Types.ObjectId(me) });
  const docs = await Match.find({ game: req.params.slug, $or: or }).sort({ createdAt: -1 }).limit(50);
  res.json(await present(docs, me));
});

router.post('/games/:slug/matches', requireAuth, async (req, res) => {
  const game = getGame(req.params.slug);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.mode !== 'match') return res.status(400).json({ error: 'This game has no online matches' });
  const m = await Match.create({ game: game.slug, players: [req.userId] });
  res.status(201).json(await present(m, req.userId));
});

router.post('/matches/:id/join', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const m = await Match.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  if (m.players.some((p) => String(p) === req.userId)) return res.json(await present(m, req.userId));
  const maxPlayers = getGame(m.game)?.maxPlayers || 2;
  if (m.players.length >= maxPlayers || m.status !== 'waiting') return res.status(409).json({ error: 'Match is full' });
  const upd = await Match.findOneAndUpdate(
    { _id: m._id, status: 'waiting', version: m.version, [`players.${maxPlayers - 1}`]: { $exists: false } },
    { $push: { players: req.userId }, $set: { status: m.players.length + 1 === maxPlayers ? 'active' : 'waiting' }, $inc: { version: 1 } },
    { new: true },
  );
  if (!upd) return res.status(409).json({ error: 'Match changed, try joining again' });
  res.json(await present(upd, req.userId));
});

/** A creator may cancel their waiting match only before anyone has joined. */
router.delete('/matches/:id', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const m = await Match.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  if (String(m.players[0]) !== req.userId) {
    return res.status(403).json({ error: 'Only the creator can cancel this match' });
  }
  if (m.status !== 'waiting' || m.players.length !== 1) {
    return res.status(409).json({ error: 'Only unjoined waiting matches can be cancelled' });
  }
  // The conditions prevent deleting a match if another player joins concurrently.
  const deleted = await Match.findOneAndDelete({
    _id: m._id, status: 'waiting', version: m.version,
    'players.0': req.userId, 'players.1': { $exists: false },
  });
  if (!deleted) return res.status(409).json({ error: 'Match changed, refresh' });
  res.status(204).end();
});

/** Runs a named action that the match's game offers in its server hook (see GAMES.md). */
router.post('/matches/:id/actions/:action', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const m = await Match.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  const actor = m.players.findIndex((p) => String(p) === req.userId);
  if (actor < 0) return res.status(403).json({ error: 'You are not in this match' });
  // Check staleness first so a player racing an already-applied action gets a refresh, not a refusal.
  if (req.body?.version !== m.version) {
    return res.status(409).json({ error: 'Match changed, refresh', match: await present(m, req.userId) });
  }
  const hooks = getGame(m.game) ? await getGameServer(m.game) : null;
  const action = Object.hasOwn(hooks?.actions || {}, req.params.action) ? hooks.actions[req.params.action] : null;
  const ctx = { state: m.state, status: m.status, actor };
  const set = action?.available?.(ctx) ? action.run(ctx) : null;
  if (!set) {
    return res.status(409).json({ error: 'Action is not available', match: await present(m, req.userId) });
  }
  const updated = await Match.findOneAndUpdate(
    { _id: m._id, game: m.game, status: m.status, version: m.version },
    { $set: set, $inc: { version: 1 } },
    { new: true },
  );
  if (!updated) {
    const latest = await Match.findById(m._id);
    return res.status(409).json({ error: 'Match changed, refresh',
      match: latest ? await present(latest, req.userId) : null });
  }
  res.json(await present(updated, req.userId));
});

router.get('/matches/:id', async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const m = await Match.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  res.json(await present(m, req.session.userId));
});

router.put('/matches/:id', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const m = await Match.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  const idx = m.players.findIndex((p) => String(p) === req.userId);
  if (idx < 0) return res.status(403).json({ error: 'You are not in this match' });
  const { version, state, turn, result } = req.body || {};
  const conflict = async (doc) =>
    res.status(409).json({ error: 'Match changed, refresh', match: await present(doc, req.userId) });
  if (!getGame(m.game)) return res.status(404).json({ error: 'Game not found' });
  const hooks = await getGameServer(m.game);
  const current = matchState(m, hooks);
  if (current.blocked) return conflict(m);
  if (m.status !== 'active' || idx !== current.turn || version !== m.version) return conflict(m);
  if (!Number.isInteger(turn) || turn < 0 || turn >= m.players.length) return res.status(400).json({ error: 'turn must identify a player in the match' });
  if (state === undefined || JSON.stringify(state).length > 64000) {
    return res.status(400).json({ error: 'state missing or too large' });
  }
  if (result != null && ![null, ...m.players.map((_, i) => i)].includes(result.winner)) {
    return res.status(400).json({ error: 'result.winner must identify a player or be null' });
  }
  // A game's validateUpdate decides what is saved (including any result); otherwise the client is trusted.
  const set = hooks?.validateUpdate
    ? hooks.validateUpdate(current.state, idx, { state, turn, result })
    : { state, turn, ...(result ? { winner: result.winner, status: 'done' } : {}) };
  if (!set) return res.status(400).json({ error: 'invalid-update' });
  const upd = await Match.findOneAndUpdate(
    { _id: m._id, version: m.version, status: 'active' },
    { $set: set, $inc: { version: 1 } },
    { new: true },
  );
  if (!upd) return conflict(await Match.findById(m._id));
  res.json(await present(upd, req.userId));
});

export default router;

import { Router } from 'express';
import mongoose from 'mongoose';
import { Match, User } from '../models.js';
import { requireAuth } from '../auth.js';
import { getGame } from '../games.js';
import { currentAutomateState, restartIncompatibleDraft, validateAutomateUpdate } from '../automate.js';

const router = Router();

function matchState(match) {
  if (match.game !== 'automate') return { state: match.state, turn: match.turn };
  const state = currentAutomateState(match.state);
  let turn = match.turn;
  if (state?.phase === 'draft' && !state.restartRequired) turn = state.draft.turn === 'w' ? 0 : 1;
  return { state, turn };
}

async function present(docs, me) {
  const list = Array.isArray(docs) ? docs : [docs];
  const ids = [...new Set(list.flatMap((m) => m.players.map(String)))];
  const users = await User.find({ _id: { $in: ids } }, 'name');
  const names = Object.fromEntries(users.map((u) => [String(u._id), u.name]));
  const out = list.map((m) => {
    const idx = me ? m.players.findIndex((p) => String(p) === String(me)) : -1;
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
      you: idx < 0 ? null : idx,
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
  if (m.players.length >= 2 || m.status !== 'waiting') return res.status(409).json({ error: 'Match is full' });
  const upd = await Match.findOneAndUpdate(
    { _id: m._id, status: 'waiting', 'players.1': { $exists: false } },
    { $push: { players: req.userId }, $set: { status: 'active' }, $inc: { version: 1 } },
    { new: true },
  );
  if (!upd) return res.status(409).json({ error: 'Match is full' });
  res.json(await present(upd, req.userId));
});

/** Either participant can reset a legacy draft that current rules cannot continue. */
router.post('/matches/:id/restart-draft', requireAuth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: 'Match not found' });
  const m = await Match.findById(req.params.id);
  if (!m) return res.status(404).json({ error: 'Match not found' });
  if (!m.players.some((p) => String(p) === req.userId)) {
    return res.status(403).json({ error: 'You are not in this match' });
  }
  const restart = m.game === 'automate' && m.status === 'active'
    ? restartIncompatibleDraft(m.state) : null;
  if (!restart) {
    return res.status(409).json({ error: 'Draft restart is not available', match: await present(m, req.userId) });
  }
  if (req.body?.version !== m.version) {
    return res.status(409).json({ error: 'Match changed, refresh', match: await present(m, req.userId) });
  }
  const updated = await Match.findOneAndUpdate(
    { _id: m._id, game: 'automate', status: 'active', version: m.version },
    { $set: restart, $inc: { version: 1 } },
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
  const current = matchState(m);
  if (m.status !== 'active' || idx !== current.turn || version !== m.version) return conflict(m);
  if (turn !== 0 && turn !== 1) return res.status(400).json({ error: 'turn must be 0 or 1' });
  if (state === undefined || JSON.stringify(state).length > 64000) {
    return res.status(400).json({ error: 'state missing or too large' });
  }
  if (result != null && ![0, 1, null].includes(result.winner)) {
    return res.status(400).json({ error: 'result.winner must be 0, 1 or null' });
  }
  const set = m.game === 'automate'
    ? validateAutomateUpdate(current.state, idx, { state, turn, result })
    : { state, turn };
  if (!set) return res.status(400).json({ error: 'invalid-automate-update' });
  if (m.game !== 'automate' && result) { set.winner = result.winner; set.status = 'done'; }
  const upd = await Match.findOneAndUpdate(
    { _id: m._id, version: m.version, status: 'active' },
    { $set: set, $inc: { version: 1 } },
    { new: true },
  );
  if (!upd) return conflict(await Match.findById(m._id));
  res.json(await present(upd, req.userId));
});

export default router;

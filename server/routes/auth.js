import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models.js';

const router = Router();

router.post('/auth/register', async (req, res) => {
  const { name, password } = req.body || {};
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(name)) {
    return res.status(400).json({ error: 'Name must be 3-20 letters, numbers or underscores' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const user = await User.create({ name, nameLower: name.toLowerCase(), passwordHash: await bcrypt.hash(password, 10) });
    req.session.userId = String(user._id);
    res.status(201).json({ id: String(user._id), name: user.name });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'That name is taken' });
    throw e;
  }
});

router.post('/auth/login', async (req, res) => {
  const { name, password } = req.body || {};
  const user = typeof name === 'string' && typeof password === 'string'
    ? await User.findOne({ nameLower: name.toLowerCase() }) : null;
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong name or password' });
  }
  req.session.userId = String(user._id);
  res.json({ id: String(user._id), name: user.name });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

router.get('/me', async (req, res) => {
  const user = req.session.userId ? await User.findById(req.session.userId) : null;
  res.json({ user: user ? { id: String(user._id), name: user.name } : null });
});

export default router;

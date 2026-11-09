export function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Log in first' });
  req.userId = req.session.userId;
  next();
}

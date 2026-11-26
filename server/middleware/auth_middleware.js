// auth_middleware.js - middleware that protects routes which need a logged-in user
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                         MIDDLEWARE
//=============================================================

// only let the request through when the session has a logged-in user
export function requireAuth(req, res, next) {
  // no user in the session - stop here
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Log in first' });
  }

  // copy the user id onto the request so handlers can use req.userId
  req.userId = req.session.userId;
  next();
}

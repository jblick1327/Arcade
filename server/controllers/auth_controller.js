// auth_controller.js - controller for handling register, login and logout requests
// Author: Reachnid Group
// Centennial College - Fall 2026

// Sessions are cookie-based (see server.js). The logged-in user's id is kept in req.session.userId

//=============================================================
//                          IMPORTS
//=============================================================

// import bcrypt for hashing passwords
import bcrypt from 'bcryptjs';

// import the user model
import User from '../models/user_model.js';

//=============================================================
//                         SETTINGS
//=============================================================

// 3-20 letters, numbers or underscores
const NAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

// the user details we send back (never the password hash)
const publicUser = (user) => ({ id: String(user._id), name: user.name });

//=============================================================
//                      REQUEST HANDLERS
//=============================================================

// POST register a new account and log it in
export const register = async (req, res) => {
  // destructure the request body to get the name and password
  const { name, password } = req.body || {};

  // check the name and password are acceptable
  if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
    return res.status(400).json({ error: 'Name must be 3-20 letters, numbers or underscores' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // create the user and start their session
  try {
    const user = await User.create({
      name,
      nameLower: name.toLowerCase(),
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    });
    req.session.userId = String(user._id);
    res.status(201).json(publicUser(user));
  } catch (e) {
    // 11000 = duplicate key, so the name is already taken
    if (e.code === 11000) return res.status(409).json({ error: 'That name is taken' });
    throw e;
  }
};

// POST log in with a name and password
export const login = async (req, res) => {
  // destructure the request body to get the name and password
  const { name, password } = req.body || {};

  // find the user by name (names are not case-sensitive)
  const user =
    typeof name === 'string' && typeof password === 'string'
      ? await User.findOne({ nameLower: name.toLowerCase() })
      : null;

  // same message for a wrong name or a wrong password, so names can't be guessed
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Wrong name or password' });
  }

  // start the session
  req.session.userId = String(user._id);
  res.json(publicUser(user));
};

// POST log out by destroying the session
export const logout = (req, res) => {
  req.session.destroy(() => res.status(204).end());
};

// GET the logged-in user, or { user: null } for guests
export const getMe = async (req, res) => {
  const user = req.session.userId ? await User.findById(req.session.userId) : null;
  res.json({ user: user ? publicUser(user) : null });
};

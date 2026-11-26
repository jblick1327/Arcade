// auth_routes.js - routes for registering, logging in and logging out
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import express & create router
import { Router } from 'express';
const router = Router();

// import auth controller
import { register, login, logout, getMe } from '../controllers/auth_controller.js';

//=============================================================
//                        AUTH ROUTES
//=============================================================

// POST register a new account
router.post('/auth/register', register);

// POST log in
router.post('/auth/login', login);

// POST log out
router.post('/auth/logout', logout);

// GET the logged-in user
router.get('/me', getMe);

//=============================================================
//                          EXPORT
//=============================================================

// export the router
export default router;

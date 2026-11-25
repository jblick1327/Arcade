// Auth.jsx - sign-in and register page (both forms side by side with the arcade machine)
// Author: Reachnid Group
// Centennial College - Fall 2026

// Shown at /login and /register. Accounts are a name + password (see auth_controller.js);
// on success the user is signed in and sent to the home page.

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// import the API helper & the arcade machine decoration
import { api } from '../utils/api.js';
import ArcadeMachine from '../components/ArcadeMachine.jsx';

//=============================================================
//                          SETTINGS
//=============================================================

// same rules as the server, so mistakes show before sending
const NAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 6;

//=============================================================
//                         COMPONENT
//=============================================================

// sign-in page - `setUser` receives the signed-in user
const Auth = ({ setUser }) => {
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');

  // signed in - remember the user and go home
  function signedIn(user) {
    setUser(user);
    navigate('/');
  }

  // POST /auth/login with the name & password
  async function login(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const r = await api('POST', '/auth/login', {
      name: form.get('name').trim(),
      password: form.get('password'),
    });
    if (r.status === 200) signedIn(r.data);
    else setLoginError(r.data?.error || 'Could not sign in');
  }

  // POST /auth/register - checks the fields first
  async function register(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = form.get('name').trim();
    const password = form.get('password');

    // check the fields
    if (!NAME_PATTERN.test(name)) {
      return setRegisterError('Username must be 3-20 letters, numbers or underscores');
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setRegisterError('Your password must be at least 6 characters long');
    }
    if (password !== form.get('confirm')) {
      return setRegisterError('Your passwords do not match');
    }

    // create the account (this also signs the user in)
    const r = await api('POST', '/auth/register', { name, password });
    if (r.status === 201) signedIn(r.data);
    else setRegisterError(r.data?.error || 'Could not create the account');
  }

  return (
    <main className="auth-page">
      <section className="auth-layout">
        {/* sign in */}
        <div className="auth-card login-card">
          <div className="card-heading">
            <h1>Welcome Back</h1>
            <p>Sign in to continue your gaming journey.</p>
          </div>

          <form onSubmit={login}>
            <div className="form-group">
              <label htmlFor="loginName">Username</label>
              <input
                id="loginName"
                name="name"
                placeholder="Enter your username"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="loginPassword">Password</label>
              <input
                id="loginPassword"
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>

            {loginError && (
              <p role="alert" className="form-error">
                {loginError}
              </p>
            )}
            <button type="submit" className="submit-btn">
              SIGN IN
            </button>
          </form>

          <div className="card-footer">
            Don&apos;t have an account? Create one using the Register form.
          </div>
        </div>

        {/* arcade machine */}
        <ArcadeMachine />

        {/* register */}
        <div className="auth-card register-card">
          <div className="card-heading">
            <h1>Create Account</h1>
            <p>Join the REACHNID gaming community.</p>
          </div>

          <form onSubmit={register}>
            <div className="form-group">
              <label htmlFor="registerName">Username</label>
              <input
                id="registerName"
                name="name"
                placeholder="Choose a username"
                autoComplete="username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="registerPassword">Password</label>
              <input
                id="registerPassword"
                name="password"
                type="password"
                placeholder="Create a password"
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirm"
                type="password"
                placeholder="Confirm your password"
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                required
              />
            </div>

            {registerError && (
              <p role="alert" className="form-error">
                {registerError}
              </p>
            )}
            <button type="submit" className="submit-btn">
              CREATE ACCOUNT
            </button>
          </form>

          <div className="card-footer">
            By registering, you agree to join the REACHNID community.
          </div>
        </div>
      </section>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Auth;

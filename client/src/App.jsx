import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Home from './pages/Home.jsx';
import Play from './pages/Play.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => {
    api('GET', '/me').then((r) => setUser(r.data ? r.data.user : null));
  }, []);

  async function logout() {
    await api('POST', '/auth/logout');
    setUser(null);
  }

  if (user === undefined) return <div className="site-shell"><main><p>Loading…</p></main></div>;

  return (
    <div className="site-shell">
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="brand" to="/">Arcade</Link>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="user-name">{user.name}</span>
              <button className="quiet-button" type="button" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="/play/:slug" element={<Play user={user} />} />
        <Route path="*" element={<main><p>Page not found</p></main>} />
      </Routes>
    </div>
  );
}

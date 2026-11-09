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

  if (user === undefined) return <p>Loading…</p>;

  return (
    <>
      <nav>
        <Link to="/">Arcade</Link>{' '}
        {user ? (
          <>
            {user.name} · <button type="button" onClick={logout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link> · <Link to="/register">Register</Link>
          </>
        )}
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="/play/:slug" element={<Play user={user} />} />
        <Route path="*" element={<p>Page not found</p>} />
      </Routes>
    </>
  );
}

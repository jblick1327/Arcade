import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { api } from './api.js';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Play from './pages/Play.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';

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
      <Navbar user={user} onLogout={logout} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="/play/:slug" element={<Play user={user} />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<main><p>Page not found</p></main>} />
      </Routes>
    </div>
  );
}

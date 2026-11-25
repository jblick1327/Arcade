// App.jsx - top-level layout with the nav bar and page routes
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

// import the API helper
import { api } from './utils/api.js';

// import the nav bar
import Navbar from './components/Navbar.jsx';

// import pages
import Home from './pages/Home.jsx';
import Games from './pages/Games.jsx';
import Play from './pages/Play.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Auth from './pages/Auth.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';

//=============================================================
//                         COMPONENT
//=============================================================

// root component - owns the signed-in user and passes it down to the pages
const App = () => {
  const [user, setUser] = useState(undefined); // undefined = still loading, null = guest

  // ask the server who is signed in (the session cookie is sent automatically)
  useEffect(() => {
    api('GET', '/me').then((r) => setUser(r.data ? r.data.user : null));
  }, []);

  // end the session and fall back to guest mode
  async function logout() {
    await api('POST', '/auth/logout');
    setUser(null);
  }

  // still checking the session
  if (user === undefined) {
    return (
      <div className="site-shell">
        <main>
          <p>Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="site-shell">
      {/* nav bar */}
      <Navbar user={user} onLogout={logout} />

      {/* pages */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Auth setUser={setUser} />} />
        <Route path="/register" element={<Auth setUser={setUser} />} />
        <Route path="/play" element={<Games />} />
        <Route path="/play/:slug" element={<Play user={user} />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route
          path="*"
          element={
            <main>
              <p>Page not found</p>
            </main>
          }
        />
      </Routes>
    </div>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default App;

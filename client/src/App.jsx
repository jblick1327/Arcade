// App.jsx - top-level layout with the nav bar and page routes
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks & the router
import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';

// import the API helper
import { api } from './api.js';

// import pages
import Home from './pages/Home.jsx';
import Play from './pages/Play.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

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
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="brand" to="/">
          Arcade
        </Link>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="user-name">{user.name}</span>
              <button className="quiet-button" type="button" onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>

      {/* pages */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="/play/:slug" element={<Play user={user} />} />
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

// Navbar.jsx - REACHNID nav bar with page links, theme toggle and login status
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import the router links
import { Link, NavLink } from 'react-router-dom';

// import the light/dark theme hook
import { useTheme } from '../hooks/useTheme.js';

//=============================================================
//                          SETTINGS
//=============================================================

// pages shown in the nav bar
const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/play', label: 'Games' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
];

//=============================================================
//                           ICONS
//=============================================================

// sun - on the knob in light mode, on the track in dark mode
const SunIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </svg>
);

// moon - on the knob in dark mode, on the track in light mode
const MoonIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
  </svg>
);

//=============================================================
//                         COMPONENT
//=============================================================

// site nav bar - `user` is null for guests or { name } when logged in, `onLogout` runs "Log out"
const Navbar = ({ user, onLogout }) => {
  const [theme, toggleTheme] = useTheme();

  return (
    <header className="rn-root">
      <nav className="rn-navbar" aria-label="Main navigation">
        {/* logo - a light and a dark version, CSS shows the one for the current theme */}
        <Link to="/" className="rn-logo" aria-label="REACHNID home">
          <img className="rn-logo-img rn-logo-light" src="/img/logo-light.webp" alt="" />
          <img className="rn-logo-img rn-logo-dark" src="/img/logo-dark.webp" alt="" />
        </Link>

        {/* page links */}
        <ul className="rn-nav-links">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end={l.to === '/'}>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="rn-nav-actions">
          {/* light/dark switch */}
          <button
            type="button"
            className="rn-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {/* the icon for the other mode sits on the track, the knob slides over it */}
            <SunIcon className="rn-track-icon rn-track-sun" />
            <MoonIcon className="rn-track-icon rn-track-moon" />
            <span className="rn-knob">{theme === 'dark' ? <MoonIcon /> : <SunIcon />}</span>
          </button>

          {/* logged in: name + log out, guest: link to the sign-in page */}
          {user ? (
            <>
              <span className="rn-user-name">{user.name}</span>
              <button type="button" className="rn-pill" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="rn-pill">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Navbar;

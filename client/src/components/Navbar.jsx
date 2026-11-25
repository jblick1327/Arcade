import { Link, NavLink } from 'react-router-dom';
import { useTheme } from '../useTheme.js';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/games', label: 'Games' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
];

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="rn-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </svg>
  );
}

// Site navbar from the REACHNID design.
// user: undefined/null when logged out, { name } when logged in. onLogout: called by "Log out".
export default function Navbar({ user, onLogout }) {
  const [theme, toggleTheme] = useTheme();

  return (
    <header className="rn-root">
      <nav className="rn-navbar" aria-label="Main navigation">
        <Link to="/" className="rn-logo" aria-label="REACHNID home">
          <img className="rn-logo-img rn-logo-light" src="/img/logo-light.webp" alt="" />
          <img className="rn-logo-img rn-logo-dark" src="/img/logo-dark.webp" alt="" />
        </Link>

        <ul className="rn-nav-links">
          {LINKS.map((l) => (
            <li key={l.to}>
              <NavLink to={l.to} end>
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="rn-nav-actions">
          <button
            type="button"
            className="rn-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="rn-knob">
              <SunIcon />
            </span>
            <MoonIcon />
          </button>

          {user ? (
            <>
              <span className="rn-user-name">{user.name}</span>
              <button type="button" className="rn-pill" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <Link to="/register" className="rn-pill">
              Register
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

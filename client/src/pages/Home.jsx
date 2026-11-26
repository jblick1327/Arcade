// Home.jsx - home page with the welcome banner and the site's features
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import the router link & the arcade machine decoration
import { Link, useSearchParams } from 'react-router-dom';
import ArcadeMachine from '../components/ArcadeMachine.jsx';

//=============================================================
//                          SETTINGS
//=============================================================

// feature cards - each one links to its page
const FEATURES = [
  { icon: '🎮', title: 'GAMES', text: 'Discover games and find your next challenge.', to: '/play' },
  {
    icon: '🌎',
    title: 'CONNECT',
    text: 'Meet players and connect with the community.',
    to: '/about',
  },
  {
    icon: '🏆',
    title: 'LEADERBOARD',
    text: 'Compete, climb the rankings and earn your place.',
    to: '/leaderboard',
  },
];

//=============================================================
//                         COMPONENT
//=============================================================

// home page - with ?dev=1 in a dev build, the games link keeps the flag so dev helpers stay on
const Home = () => {
  const [params] = useSearchParams();
  const showDev = import.meta.env.DEV && params.get('dev') === '1';

  return (
    <main className="auth-page">
      {/* welcome banner */}
      <section className="home-hero">
        <div className="home-hero-text">
          <span className="eyebrow">REACHNID ARCADE</span>
          <h1>Play, compete and climb the leaderboard.</h1>
          <p>
            Browser games made by the REACHNID team - from quick high-score runs to online matches
            against your friends.
          </p>
          <Link className="submit-btn home-cta" to={`/play${showDev ? '?dev=1' : ''}`}>
            BROWSE GAMES
          </Link>
        </div>
        <ArcadeMachine />
      </section>

      {/* features */}
      <section className="features-section">
        <h2>GAME. CONNECT. COMPETE.</h2>
        <p className="features-description">
          Everything you need to be part of the gaming community.
        </p>

        <div className="features-container">
          {FEATURES.map((f) => (
            <Link className="feature-item" to={f.to} key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default Home;

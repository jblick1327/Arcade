// About.jsx - about us page with the team members
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          SETTINGS
//=============================================================

// team members shown as cards
const TEAM = ['Darryn', 'Adrian', 'Ahmed', 'Lex', 'James'];

//=============================================================
//                         COMPONENT
//=============================================================

// about page - who we are and the team cards
const About = () => {
  return (
    <main className="rn-root">
      <div className="rn-about">
        <h1 className="rn-title">About Us</h1>
        <p className="rn-intro">
          We are REACHNID, a team of game development students <br />
          who created an arcade-style website featuring a collection of <br />
          classic and modern browser games.
        </p>

        {/* one card per member, with their first letter as the avatar */}
        <ul className="rn-team">
          {TEAM.map((name) => (
            <li className="rn-member" key={name}>
              <div className="rn-avatar" aria-hidden="true">
                {name[0]}
              </div>
              <span className="rn-member-name">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default About;

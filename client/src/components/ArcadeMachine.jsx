// ArcadeMachine.jsx - glowing REACHNID arcade cabinet (decoration, drawn with CSS)
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                         COMPONENT
//=============================================================

// the cabinet: marquee, screen, joystick & buttons, coin slot (styles in auth.css)
const ArcadeMachine = () => {
  return (
    <div className="arcade-section" aria-hidden="true">
      <div className="arcade-glow"></div>

      <div className="arcade-machine">
        <div className="arcade-top">REACHNID</div>

        {/* screen */}
        <div className="arcade-screen-frame">
          <div className="arcade-screen">
            <div className="screen-logo">
              REACH<span>NID</span>
            </div>
            <div className="screen-text">PRESS START</div>
            <div className="screen-coin">★ ★ ★</div>
          </div>
        </div>

        {/* joystick & buttons */}
        <div className="arcade-controls">
          <div className="joystick">
            <span></span>
          </div>
          <div className="arcade-buttons">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>

        {/* coin slot */}
        <div className="arcade-bottom">
          <div className="arcade-slot"></div>
        </div>
      </div>
    </div>
  );
};

//=============================================================
//                          EXPORTS
//=============================================================

export default ArcadeMachine;

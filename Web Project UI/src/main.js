
import './style.css';

document.querySelector('#app').innerHTML = `
  <header class="navbar">
    <a href="/" class="logo">
      <img src="/reachnid-logo.png" alt="REACHNID Logo">
    </a>

    <div class="theme-controls">
      <button class="theme-btn active" id="lightMode" type="button">☀ Light Mode</button>
      <button class="theme-btn" id="darkMode" type="button">☾ Dark Mode</button>
    </div>
  </header>

  <main>
    <section class="auth-layout">

      <!-- SIGN IN -->
      <div class="auth-card login-card">
        <div class="card-heading">
          <h1>Welcome Back</h1>
          <p>Sign in to continue your gaming journey.</p>
        </div>

        <form id="loginForm">
          <div class="form-group">
            <label for="loginEmail">Email Address</label>
            <input
              type="email"
              id="loginEmail"
              placeholder="Enter your email"
              required
            >
          </div>

          <div class="form-group">
            <label for="loginPassword">Password</label>
            <input
              type="password"
              id="loginPassword"
              placeholder="Enter your password"
              required
            >
          </div>

          <div class="form-options">
            <label>
              <input type="checkbox" id="rememberMe">
              Remember me
            </label>
            <a href="#" id="forgotPassword">Forgot password?</a>
          </div>

          <button type="submit" class="submit-btn">SIGN IN</button>
        </form>

        <div class="card-footer">
          Don't have an account? Create one using the Register form.
        </div>
      </div>

      <!-- ARCADE MACHINE -->
      <div class="arcade-section">
        <div class="arcade-glow"></div>

        <div class="arcade-machine">
          <div class="arcade-top">REACHNID</div>

          <div class="arcade-screen-frame">
            <div class="arcade-screen">
              <div class="screen-logo">REACH<span>NID</span></div>
              <div class="screen-text">PRESS START</div>
              <div class="screen-coin">★ ★ ★</div>
            </div>
          </div>

          <div class="arcade-controls">
            <div class="joystick">
              <span></span>
            </div>

            <div class="arcade-buttons">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div class="arcade-bottom">
            <div class="arcade-slot"></div>
          </div>
        </div>
      </div>

      <!-- REGISTER -->
      <div class="auth-card register-card">
        <div class="card-heading">
          <h1>Create Account</h1>
          <p>Join the REACHNID gaming community.</p>
        </div>

        <form id="registerForm">
          <div class="form-group">
            <label for="registerUsername">Username</label>
            <input
              type="text"
              id="registerUsername"
              placeholder="Choose a username"
              required
            >
          </div>

          <div class="form-group">
            <label for="registerEmail">Email Address</label>
            <input
              type="email"
              id="registerEmail"
              placeholder="Enter your email"
              required
            >
          </div>

          <div class="form-group">
            <label for="registerPassword">Password</label>
            <input
              type="password"
              id="registerPassword"
              placeholder="Create a password"
              minlength="6"
              required
            >
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Confirm your password"
              minlength="6"
              required
            >
          </div>

          <button type="submit" class="submit-btn">CREATE ACCOUNT</button>
        </form>

        <div class="card-footer">
          By registering, you agree to join the REACHNID community.
        </div>
      </div>

    </section>

    <!-- GAMING FEATURES -->
    <section class="features-section">
      <h2>GAME. CONNECT. COMPETE.</h2>
      <p class="features-description">
        Everything you need to be part of the gaming community.
      </p>

      <div class="features-container">

        <div class="feature-item">
          <div class="feature-icon">🎮</div>
          <h3>GAMES</h3>
          <p>Discover games and find your next challenge.</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🌎</div>
          <h3>CONNECT</h3>
          <p>Meet players and connect with the community.</p>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🏆</div>
          <h3>LEADERBOARD</h3>
          <p>Compete, climb the rankings and earn your place.</p>
        </div>

      </div>
    </section>
  </main>
`;

/* ==============================
   LIGHT MODE AND DARK MODE
================================ */

const lightModeButton = document.querySelector('#lightMode');
const darkModeButton = document.querySelector('#darkMode');

function setTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');

  lightModeButton.classList.toggle('active', theme === 'light');
  darkModeButton.classList.toggle('active', theme === 'dark');

  localStorage.setItem('reachnidTheme', theme);
}

const savedTheme = localStorage.getItem('reachnidTheme') || 'light';
setTheme(savedTheme);

lightModeButton.addEventListener('click', () => setTheme('light'));
darkModeButton.addEventListener('click', () => setTheme('dark'));

/* ==============================
   REGISTRATION
================================ */

const registerForm = document.querySelector('#registerForm');

registerForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const username = document.querySelector('#registerUsername').value.trim();
  const email = document.querySelector('#registerEmail').value.trim().toLowerCase();
  const password = document.querySelector('#registerPassword').value;
  const confirmPassword = document.querySelector('#confirmPassword').value;

  if (password !== confirmPassword) {
    alert('Your passwords do not match.');
    return;
  }

  if (password.length < 6) {
    alert('Your password must be at least 6 characters long.');
    return;
  }

  const users = JSON.parse(localStorage.getItem('reachnidUsers')) || [];

  const existingUser = users.find((user) => user.email === email);

  if (existingUser) {
    alert('An account with this email already exists.');
    return;
  }

  users.push({
    username,
    email,
    password
  });

  localStorage.setItem('reachnidUsers', JSON.stringify(users));

  alert('Your REACHNID account has been created successfully!');

  registerForm.reset();
});

/* ==============================
   SIGN IN
================================ */

const loginForm = document.querySelector('#loginForm');

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const email = document.querySelector('#loginEmail').value.trim().toLowerCase();
  const password = document.querySelector('#loginPassword').value;

  const users = JSON.parse(localStorage.getItem('reachnidUsers')) || [];

  const matchingUser = users.find(
    (user) => user.email === email && user.password === password
  );

  if (!matchingUser) {
    alert('Incorrect email or password. Please try again.');
    return;
  }

  alert(`Welcome back, ${matchingUser.username}!`);

  loginForm.reset();
});

/* ==============================
   FORGOT PASSWORD
================================ */

document.querySelector('#forgotPassword').addEventListener('click', (event) => {
  event.preventDefault();
  alert('Password recovery will be added in a future update.');
});

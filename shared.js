import './style.css';
import './pages.css';

export function setupPage(currentPage) {
  document.querySelector('#app').innerHTML = `
    <header class="navbar">
      <a href="/" class="logo"><img src="/reachnid-logo.png" alt="REACHNID Logo"></a>
      <nav class="site-nav" aria-label="Main navigation">
        <a class="nav-link ${currentPage === 'home' ? 'active' : ''}" href="/">Login / Register</a>
        <a class="nav-link ${currentPage === 'games' ? 'active' : ''}" href="/games.html">Games</a>
        <a class="nav-link ${currentPage === 'leaderboard' ? 'active' : ''}" href="/leaderboard.html">Leaderboard</a>
      </nav>
      <div class="theme-controls">
        <button class="theme-btn" id="lightMode" type="button">☀ Light Mode</button>
        <button class="theme-btn" id="darkMode" type="button">☾ Dark Mode</button>
      </div>
    </header>
    <main class="page-main" id="pageContent"></main>`;
  const light = document.querySelector('#lightMode');
  const dark = document.querySelector('#darkMode');
  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    light.classList.toggle('active', theme === 'light');
    dark.classList.toggle('active', theme === 'dark');
    localStorage.setItem('reachnidTheme', theme);
  }
  applyTheme(localStorage.getItem('reachnidTheme') === 'dark' ? 'dark' : 'light');
  light.addEventListener('click', () => applyTheme('light'));
  dark.addEventListener('click', () => applyTheme('dark'));
  return document.querySelector('#pageContent');
}

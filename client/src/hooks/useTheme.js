// useTheme.js - light/dark theme hook (remembers the choice in the browser)
// Author: Reachnid Group
// Centennial College - Fall 2026

// The theme is written to <html data-theme="light|dark">; every stylesheet keys its dark colours
// off html[data-theme='dark'].

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks
import { useEffect, useState } from 'react';

//=============================================================
//                          SETTINGS
//=============================================================

// localStorage key for the saved theme
const KEY = 'theme';

//=============================================================
//                          HELPERS
//=============================================================

// the saved theme, or light when none is saved (or storage is blocked)
function initialTheme() {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

//=============================================================
//                          EXPORTS
//=============================================================

// returns [theme, toggle]
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  // apply the theme to the page and remember it
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // storage unavailable (private mode) - the theme still works for this visit
    }
  }, [theme]);

  // switch between light and dark
  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return [theme, toggle];
}

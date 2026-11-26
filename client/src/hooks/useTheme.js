// useTheme.js - light/dark theme hook (remembers the choice in the browser)
// Author: Reachnid Group
// Centennial College - Fall 2026

// The theme is written to <html data-theme="light|dark">; every stylesheet keys its dark colours
// off html[data-theme='dark']. The site starts in dark mode. A small script in index.html sets
// the same attribute before React loads, so the page never flashes light first.

//=============================================================
//                          IMPORTS
//=============================================================

// import react hooks
import { useEffect, useState } from 'react';

//=============================================================
//                          SETTINGS
//=============================================================

// localStorage key for the theme the visitor picked (only written when they use the switch;
// renamed from 'theme', which older versions saved automatically as light)
const KEY = 'reachnid-theme';

//=============================================================
//                          HELPERS
//=============================================================

// the saved theme - dark unless the visitor has picked light (also dark when storage is blocked)
function initialTheme() {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

//=============================================================
//                          EXPORTS
//=============================================================

// returns [theme, toggle]
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);

  // apply the theme to the page
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // switch between light and dark, and remember the choice
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable (private mode) - the theme still works for this visit
    }
  };
  return [theme, toggle];
}

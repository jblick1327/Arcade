// main.jsx - entry point that mounts the React app
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import react & the router
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// import the app & the site styles
import App from './App.jsx';
import './styles/site.css';
import './styles/reachnid.css';
import './styles/pages.css';
import './styles/auth.css';

//=============================================================
//                         MOUNT APP
//=============================================================

// render the app into <div id="root"> in index.html
createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);

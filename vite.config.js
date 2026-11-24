// vite.config.js - build settings for the React client and the dev-server proxy
// Author: Reachnid Group
// Centennial College - Fall 2026

//=============================================================
//                          IMPORTS
//=============================================================

// import vite & the react plugin
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

//=============================================================
//                          SETTINGS
//=============================================================

// the Express server started by `npm run dev` (see package.json)
const target = 'http://localhost:3000';

export default defineConfig({
  // the React app lives in client/
  root: 'client',
  plugins: [react()],

  // in dev, send API, game and SDK requests to the Express server
  server: { port: 5173, proxy: { '/api': target, '/games': target, '/sdk': target } },

  // build into client/dist (served by Express in production)
  build: { outDir: 'dist', emptyOutDir: true },
});

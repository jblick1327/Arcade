// game_catalog.js - finds the games on disk and reads their game.json settings
// Author: Reachnid Group
// Centennial College - Fall 2026

// A game is any folder games/<slug>/ that has an index.html and a game.json.
// Games are re-read on every request, so adding a folder needs no server restart.

//=============================================================
//                          IMPORTS
//=============================================================

// import node's file system & path helpers
import fs from 'node:fs';
import path from 'node:path';

//=============================================================
//                         SETTINGS
//=============================================================

// folder that holds every game
const GAMES_DIR = path.resolve('games');

// valid folder names - folders starting with "_" (like _template) are never listed
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

// iframe size used when game.json does not give one
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

//=============================================================
//                          HELPERS
//=============================================================

// return value if it is a positive number, otherwise the fallback
const positive = (value, fallback) =>
  typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;

// read one game's settings (returns null when the game is missing or broken)
function load(slug) {
  // reject names that could escape the games folder
  if (!SLUG.test(slug)) return null;
  const dir = path.join(GAMES_DIR, slug);

  // the game must have an index.html
  try {
    if (!fs.statSync(path.join(dir, 'index.html')).isFile()) return null;
  } catch {
    return null;
  }

  // read and parse game.json
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('not an object');
  } catch (e) {
    console.warn(`[games] skipping "${slug}": ${e.message}`);
    return null;
  }

  // fill in safe defaults for anything missing or invalid
  return {
    slug,
    title: typeof meta.title === 'string' && meta.title ? meta.title : slug,
    description: typeof meta.description === 'string' ? meta.description : '',
    mode: meta.mode === 'match' ? 'match' : 'score',
    ...(meta.mode === 'match' ? { maxPlayers: meta.maxPlayers === 4 ? 4 : 2 } : {}),
    scoreOrder: meta.scoreOrder === 'asc' ? 'asc' : 'desc',
    width: positive(meta.width, DEFAULT_WIDTH),
    height: positive(meta.height, DEFAULT_HEIGHT),
  };
}

//=============================================================
//                          EXPORTS
//=============================================================

// get one game's settings, or null when it does not exist
export function getGame(slug) {
  return load(String(slug));
}

// get every installed game, sorted by title
export function listGames() {
  let names = [];
  try {
    names = fs
      .readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    // no games folder yet
  }

  return names
    .map(load)
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title));
}

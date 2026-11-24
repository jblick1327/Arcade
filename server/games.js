import fs from 'node:fs';
import path from 'node:path';

const GAMES_DIR = path.resolve('games');
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

function load(slug) {
  if (!SLUG.test(slug)) return null;
  const dir = path.join(GAMES_DIR, slug);
  try {
    if (!fs.statSync(path.join(dir, 'index.html')).isFile()) return null;
  } catch { return null; }
  let j;
  try {
    j = JSON.parse(fs.readFileSync(path.join(dir, 'game.json'), 'utf8'));
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not an object');
  } catch (e) {
    console.warn(`[games] skipping "${slug}": ${e.message}`);
    return null;
  }
  const num = (v, d) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : d);
  return {
    slug,
    title: typeof j.title === 'string' && j.title ? j.title : slug,
    description: typeof j.description === 'string' ? j.description : '',
    mode: j.mode === 'match' ? 'match' : 'score',
    ...(j.mode === 'match' ? { maxPlayers: j.maxPlayers === 4 ? 4 : 2 } : {}),
    scoreOrder: j.scoreOrder === 'asc' ? 'asc' : 'desc',
    width: num(j.width, 800),
    height: num(j.height, 600),
  };
}

export function getGame(slug) {
  return load(String(slug));
}

export function listGames() {
  let names = [];
  try {
    names = fs.readdirSync(GAMES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch { /* no games dir */ }
  return names.map(load).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title));
}

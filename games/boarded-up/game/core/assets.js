// assets.js - Boarded Up asset builder: makes every procedural texture and sprite at startup
// Author: Reachnid Group
// Centennial College - Fall 2026

// Builds every procedural asset once at startup.
import { buildWeaponArt } from './weaponArt.js';
import { buildTextures } from './textures.js';
import { buildSprites } from './sprites.js';
import { buildFx } from './fxArt.js';
import { makeImage, fillRect, rgba } from './pixel.js';

let cached = null;

export function buildAssets() {
  if (cached) return cached;
  const weaponArt = buildWeaponArt();
  const textures = buildTextures(weaponArt.icons);
  const sprites = buildSprites();

  const splinter = makeImage(4, 4);
  fillRect(splinter, 0, 1, 4, 2, rgba(120, 82, 48));
  fillRect(splinter, 1, 0, 2, 1, rgba(150, 105, 62));

  const fx = buildFx();
  cached = { weaponArt, textures, sprites, fx, extra: { splinter } };
  return cached;
}

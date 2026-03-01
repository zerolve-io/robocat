import type { PatrolConfig } from './types';

/**
 * mulberry32 — fast seeded 32-bit PRNG.
 * Returns a closure that yields [0, 1) floats, same as Math.random().
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive a numeric seed from an arbitrary string.
 */
export function hashSeed(str: string): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 2654435761);
  }
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Generate a rectangular patrol path and vision config from a seed.
 * The patrol rectangle is expressed in world-pixel space.
 *
 * @param seed   - numeric seed (or string, auto-hashed)
 * @param worldW - world pixel width
 * @param worldH - world pixel height
 */
export function seedToPatrolConfig(
  seed: number | string,
  worldW = 1280,
  worldH = 960
): PatrolConfig {
  const s = typeof seed === 'string' ? hashSeed(seed) : seed;
  const rng = mulberry32(s);

  // Patrol rect: random position + size clamped to world bounds
  const margin = 128;
  const rectW = 200 + rng() * 300;
  const rectH = 150 + rng() * 200;
  const rectX = margin + rng() * (worldW - rectW - margin * 2);
  const rectY = margin + rng() * (worldH - rectH - margin * 2);

  const points = [
    { x: rectX, y: rectY },
    { x: rectX + rectW, y: rectY },
    { x: rectX + rectW, y: rectY + rectH },
    { x: rectX, y: rectY + rectH },
  ];

  return {
    points,
    speed: 80 + rng() * 60,
    visionAngle: Math.PI / 3 + rng() * (Math.PI / 6), // 60–90°
    visionRange: 120 + rng() * 80,
  };
}

import { mulberry32, hashSeed } from '@robocat/shared';

export const TILE_SIZE = 32;
export const GRID_COLS = 40;
export const GRID_ROWS = 30;

export enum TileKind {
  Path = 0,
  Building = 1,
  Neon = 2,
}

/**
 * Seed-based procedural city layout generator.
 *
 * Algorithm:
 * 1. Fill with Path tiles.
 * 2. Randomly place building blocks of varying sizes.
 * 3. Ensure path border around the whole map.
 * 4. Sprinkle Neon tiles on some path tiles near buildings.
 */
export class CityGenerator {
  private rng: () => number;

  constructor(seed: string | number) {
    const s = typeof seed === 'string' ? hashSeed(seed) : seed;
    this.rng = mulberry32(s);
  }

  generate(): TileKind[][] {
    const grid: TileKind[][] = Array.from({ length: GRID_ROWS }, () =>
      new Array(GRID_COLS).fill(TileKind.Path)
    );

    // ── Place buildings ────────────────────────────────────────────────────
    const numBuildings = 55 + Math.floor(this.rng() * 30);
    for (let i = 0; i < numBuildings; i++) {
      const bw = 2 + Math.floor(this.rng() * 4); // 2–5 tiles wide
      const bh = 2 + Math.floor(this.rng() * 4); // 2–5 tiles tall
      // Keep a 1-tile border free around the map
      const bx = 1 + Math.floor(this.rng() * (GRID_COLS - bw - 2));
      const by = 1 + Math.floor(this.rng() * (GRID_ROWS - bh - 2));

      // Ensure there's always a walkable path between buildings
      // by leaving a 1-tile gap. We'll enforce this by only placing
      // if the ring around the block is not already fully buildings.
      if (this.canPlace(grid, bx, by, bw, bh)) {
        for (let row = by; row < by + bh; row++) {
          for (let col = bx; col < bx + bw; col++) {
            grid[row][col] = TileKind.Building;
          }
        }
      }
    }

    // ── Ensure perimeter is always walkable ────────────────────────────────
    for (let col = 0; col < GRID_COLS; col++) {
      grid[0][col] = TileKind.Path;
      grid[GRID_ROWS - 1][col] = TileKind.Path;
    }
    for (let row = 0; row < GRID_ROWS; row++) {
      grid[row][0] = TileKind.Path;
      grid[row][GRID_COLS - 1] = TileKind.Path;
    }

    // ── Ensure connectivity: clear horizontal + vertical corridors ─────────
    // One horizontal corridor through the middle
    const midRow = Math.floor(GRID_ROWS / 2);
    for (let col = 0; col < GRID_COLS; col++) {
      grid[midRow][col] = TileKind.Path;
    }
    // One vertical corridor through the middle
    const midCol = Math.floor(GRID_COLS / 2);
    for (let row = 0; row < GRID_ROWS; row++) {
      grid[row][midCol] = TileKind.Path;
    }

    // ── Sprinkle neon accents on path tiles adjacent to buildings ──────────
    const neonChance = 0.08;
    for (let row = 1; row < GRID_ROWS - 1; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        if (grid[row][col] !== TileKind.Path) continue;
        if (this.hasAdjacentBuilding(grid, col, row) && this.rng() < neonChance) {
          grid[row][col] = TileKind.Neon;
        }
      }
    }

    return grid;
  }

  private canPlace(grid: TileKind[][], bx: number, by: number, bw: number, bh: number): boolean {
    // Check if there's at least a 1-tile gap around the building
    for (let row = by - 1; row <= by + bh; row++) {
      for (let col = bx - 1; col <= bx + bw; col++) {
        if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) {
          return false;
        }
        // Don't place if adjacent tile is already a building (ensures gap)
        if (row < by || row >= by + bh || col < bx || col >= bx + bw) {
          // It's on the ring — if it's a building, skip
          if (grid[row][col] === TileKind.Building) return false;
        }
      }
    }
    return true;
  }

  private hasAdjacentBuilding(grid: TileKind[][], col: number, row: number): boolean {
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const [dc, dr] of dirs) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        if (grid[nr][nc] === TileKind.Building) return true;
      }
    }
    return false;
  }
}

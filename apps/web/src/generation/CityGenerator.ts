import { mulberry32, hashSeed } from '@robocat/shared';

export const TILE_SIZE = 32;
export const GRID_COLS = 40;
export const GRID_ROWS = 30;

export enum TileKind {
  Path = 0,
  Building = 1,
  Neon = 2,
}

export interface ObjectiveLocation {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
}

export class CityGenerator {
  private rng: () => number;
  private seed: number;

  constructor(seed: string | number) {
    const s = typeof seed === 'string' ? hashSeed(seed) : seed;
    this.seed = s;
    this.rng = mulberry32(s);
  }

  generate(): TileKind[][] {
    const grid: TileKind[][] = Array.from({ length: GRID_ROWS }, () =>
      new Array(GRID_COLS).fill(TileKind.Path)
    );

    const numBuildings = 55 + Math.floor(this.rng() * 30);
    for (let i = 0; i < numBuildings; i++) {
      const bw = 2 + Math.floor(this.rng() * 4);
      const bh = 2 + Math.floor(this.rng() * 4);
      const bx = 1 + Math.floor(this.rng() * (GRID_COLS - bw - 2));
      const by = 1 + Math.floor(this.rng() * (GRID_ROWS - bh - 2));
      if (this.canPlace(grid, bx, by, bw, bh)) {
        for (let row = by; row < by + bh; row++) {
          for (let col = bx; col < bx + bw; col++) {
            grid[row][col] = TileKind.Building;
          }
        }
      }
    }

    for (let col = 0; col < GRID_COLS; col++) {
      grid[0][col] = TileKind.Path;
      grid[GRID_ROWS - 1][col] = TileKind.Path;
    }
    for (let row = 0; row < GRID_ROWS; row++) {
      grid[row][0] = TileKind.Path;
      grid[row][GRID_COLS - 1] = TileKind.Path;
    }

    const midRow = Math.floor(GRID_ROWS / 2);
    for (let col = 0; col < GRID_COLS; col++) grid[midRow][col] = TileKind.Path;
    const midCol = Math.floor(GRID_COLS / 2);
    for (let row = 0; row < GRID_ROWS; row++) grid[row][midCol] = TileKind.Path;

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
    for (let row = by - 1; row <= by + bh; row++) {
      for (let col = bx - 1; col <= bx + bw; col++) {
        if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return false;
        if (row < by || row >= by + bh || col < bx || col >= bx + bw) {
          if (grid[row][col] === TileKind.Building) return false;
        }
      }
    }
    return true;
  }

  private hasAdjacentBuilding(grid: TileKind[][], col: number, row: number): boolean {
    for (const [dc, dr] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        if (grid[nr][nc] === TileKind.Building) return true;
      }
    }
    return false;
  }

  getObjectiveLocations(grid: TileKind[][], count: number): ObjectiveLocation[] {
    const objRng = mulberry32(this.seed + 0xf00d);
    const locations: ObjectiveLocation[] = [];
    const occupied = new Set<string>();

    const centerCol = Math.floor(GRID_COLS / 2);
    const centerRow = Math.floor(GRID_ROWS / 2);
    for (let r = centerRow - 3; r <= centerRow + 3; r++) {
      for (let c = centerCol - 3; c <= centerCol + 3; c++) occupied.add(`${c},${r}`);
    }

    const candidates: { col: number; row: number }[] = [];
    for (let row = 3; row < GRID_ROWS - 3; row++) {
      for (let col = 3; col < GRID_COLS - 3; col++) {
        if (grid[row][col] === TileKind.Path || grid[row][col] === TileKind.Neon) {
          candidates.push({ col, row });
        }
      }
    }

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(objRng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const MIN_DIST = 6;
    for (const cand of candidates) {
      if (locations.length >= count) break;
      const key = `${cand.col},${cand.row}`;
      if (occupied.has(key)) continue;
      let tooClose = false;
      for (const loc of locations) {
        if (Math.abs(loc.col - cand.col) < MIN_DIST && Math.abs(loc.row - cand.row) < MIN_DIST) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      occupied.add(key);
      locations.push({
        col: cand.col,
        row: cand.row,
        worldX: cand.col * TILE_SIZE,
        worldY: cand.row * TILE_SIZE,
      });
    }
    return locations;
  }
}

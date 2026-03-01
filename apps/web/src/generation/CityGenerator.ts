import { mulberry32, hashSeed } from '@robocat/shared';

export const TILE_SIZE = 32;
export const GRID_COLS = 40;
export const GRID_ROWS = 30;

// ---------------------------------------------------------------------------
// TileType — expanded tile vocabulary
// ---------------------------------------------------------------------------
export enum TileType {
  EMPTY = 0,
  BUILDING = 1,
  PATH = 2,
  NEON = 3,
  VENT = 4, // Can crawl through — like path but distinct visual
  STEAM = 5, // Periodic steam burst (visual only for now)
  PUDDLE = 6, // Reflective, slippery (visual only for now)
  KIOSK = 7, // Objective spawn point, interactable
  TERMINAL = 8, // Hackable terminal
  LADDER = 9, // Transition point (future vertical layers)
  CRATE = 10, // Charging crate / hiding spot
}

/** Legacy alias so PatrolScene can migrate incrementally */
export const TileKind = TileType;

// ---------------------------------------------------------------------------
// City mood
// ---------------------------------------------------------------------------
export type CityMood = 'clear' | 'rain' | 'blackout' | 'festival';
const MOODS: CityMood[] = ['clear', 'rain', 'blackout', 'festival'];

// ---------------------------------------------------------------------------
// Block templates
// ---------------------------------------------------------------------------
export type BlockTemplate =
  | 'rooftops'
  | 'market'
  | 'vent_network'
  | 'noodle_alley'
  | 'drone_lane'
  | 'data_center'
  | 'residential';

const TEMPLATE_SIZE = 10; // each block is 10×10 tiles

/**
 * Define tile patterns for each block template.
 * B = Building, P = Path, V = Vent, S = Steam, U = Puddle,
 * K = Kiosk, T = Terminal, L = Ladder, C = Crate, N = Neon
 * Numbers map directly to TileType values.
 */
const BLOCK_PATTERNS: Record<BlockTemplate, string[]> = {
  rooftops: [
    'BBBBBBBBBB',
    'B P P P PB',
    'B BBBB  PB',
    'B B  B L B',
    'B B  B  PB',
    'B BBBB  PB',
    'B P  P  NB',
    'B BBBBBBPB',
    'B P P P PB',
    'BBBBBBBBBB',
  ],
  market: [
    'PPPPPPPPPP',
    'P K P K PP',
    'PPPPPPPPPP',
    'P   K   PP',
    'PPPPPPPPPP',
    'P K P K PP',
    'PPPPPPPPPP',
    'P T  T  PP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
  ],
  vent_network: [
    'BBBBBBBBBB',
    'BVVVBVVVBB',
    'B   B   BB',
    'BVVVPVVVBB',
    'BB  P  BBB',
    'BB  P  BBB',
    'BVVVPVVVBB',
    'B   B   BB',
    'BVVVBVVVBB',
    'BBBBBBBBBB',
  ],
  noodle_alley: [
    'BB P PBBBB',
    'BB P PBBBB',
    'NB P PBBN N',
    'BB S PBBBB',
    'BB P PBBBB',
    'NB P PBBN N',
    'BB S PBBBB',
    'BB P PBBBB',
    'NB P PBBN N',
    'BB P PBBBB',
  ],
  drone_lane: [
    'BBBBBBBBBB',
    'B        B',
    'B        B',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'UUUUUUUUUU',
    'PPPPPPPPPP',
    'B        B',
    'B        B',
    'BBBBBBBBBB',
  ],
  data_center: [
    'BBBBBBBBBB',
    'B BBBBBB B',
    'B B T  B B',
    'B B    B B',
    'BPBBBBBBPB',
    'BPBBBBBBPB',
    'B B    B B',
    'B B T  B B',
    'B BBBBBB B',
    'BBBBBBBBBB',
  ],
  residential: [
    'BBPPPBBPBB',
    'BB   BB  B',
    'PP C PP  P',
    'BB   BB  B',
    'BBPPPBBPBB',
    'B  P  P  B',
    'B  P  P  B',
    'BBPPPBBPBB',
    'PP   PP  P',
    'BBPPPBBPBB',
  ],
};

function charToTile(ch: string): TileType {
  switch (ch) {
    case 'B':
      return TileType.BUILDING;
    case 'P':
      return TileType.PATH;
    case 'N':
      return TileType.NEON;
    case 'V':
      return TileType.VENT;
    case 'S':
      return TileType.STEAM;
    case 'U':
      return TileType.PUDDLE;
    case 'K':
      return TileType.KIOSK;
    case 'T':
      return TileType.TERMINAL;
    case 'L':
      return TileType.LADDER;
    case 'C':
      return TileType.CRATE;
    default:
      return TileType.PATH; // spaces & unknown → walkable path
  }
}

// ---------------------------------------------------------------------------
// Objective location result
// ---------------------------------------------------------------------------
export interface ObjectiveLocation {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  /** Tile-type hint for objective spawning logic */
  tileHint: TileType;
}

// ---------------------------------------------------------------------------
// Connectivity graph node
// ---------------------------------------------------------------------------
export interface ConnNode {
  col: number;
  row: number;
}

// ---------------------------------------------------------------------------
// CityGenerator
// ---------------------------------------------------------------------------
export class CityGenerator {
  private rng: () => number;
  private seed: number;
  private _mood: CityMood = 'clear';
  private _connectivityGraph: ConnNode[] = [];

  constructor(seed: string | number) {
    const s = typeof seed === 'string' ? hashSeed(seed) : seed;
    this.seed = s;
    this.rng = mulberry32(s);
  }

  get mood(): CityMood {
    return this._mood;
  }

  get connectivityGraph(): ConnNode[] {
    return this._connectivityGraph;
  }

  // ── Main generation entry point ──────────────────────────────────────────

  generate(): TileType[][] {
    // Pick mood deterministically from seed
    this._mood = MOODS[Math.floor(this.rng() * MOODS.length)];

    const grid = this._buildGrid();
    this._ensureConnectivity(grid);
    this._buildConnectivityGraph(grid);
    return grid;
  }

  // ── Grid construction ────────────────────────────────────────────────────

  private _buildGrid(): TileType[][] {
    const grid: TileType[][] = Array.from({ length: GRID_ROWS }, () =>
      new Array(GRID_COLS).fill(TileType.PATH)
    );

    // Place 4–6 block templates
    const templateCount = 4 + Math.floor(this.rng() * 3);
    const allTemplates = Object.keys(BLOCK_PATTERNS) as BlockTemplate[];
    const placed: { col: number; row: number }[] = [];

    // Shuffle template list
    const shuffled = [...allTemplates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let attempts = 0;
    let placed_count = 0;
    while (placed_count < templateCount && attempts < 60) {
      attempts++;
      const template = shuffled[placed_count % shuffled.length];
      // Leave 1-tile margin for border wall
      const maxCol = GRID_COLS - TEMPLATE_SIZE - 1;
      const maxRow = GRID_ROWS - TEMPLATE_SIZE - 1;
      if (maxCol < 1 || maxRow < 1) break;

      const startCol = 1 + Math.floor(this.rng() * maxCol);
      const startRow = 1 + Math.floor(this.rng() * maxRow);

      // Avoid overlap with already placed blocks (keep 2-tile gap)
      let overlaps = false;
      for (const p of placed) {
        if (
          Math.abs(p.col - startCol) < TEMPLATE_SIZE + 2 &&
          Math.abs(p.row - startRow) < TEMPLATE_SIZE + 2
        ) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      this._stampTemplate(grid, template, startCol, startRow);
      placed.push({ col: startCol, row: startRow });
      placed_count++;
    }

    // Fill remaining interior with organic buildings + neon accents
    this._fillOrganic(grid);

    // Cross-axis paths ensure baseline connectivity before flood-fill
    this._carveCrossAxis(grid);

    // Border wall
    this._drawBorder(grid);

    // Scatter steam/puddle details
    this._scatterDetails(grid);

    return grid;
  }

  private _stampTemplate(
    grid: TileType[][],
    template: BlockTemplate,
    startCol: number,
    startRow: number
  ): void {
    const pattern = BLOCK_PATTERNS[template];
    for (let dr = 0; dr < TEMPLATE_SIZE; dr++) {
      const rowStr = pattern[dr] ?? '';
      for (let dc = 0; dc < TEMPLATE_SIZE; dc++) {
        const ch = rowStr[dc] ?? ' ';
        const tile = charToTile(ch);
        const r = startRow + dr;
        const c = startCol + dc;
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
          grid[r][c] = tile;
        }
      }
    }
  }

  private _fillOrganic(grid: TileType[][]): void {
    const numBuildings = 30 + Math.floor(this.rng() * 20);
    for (let i = 0; i < numBuildings; i++) {
      const bw = 2 + Math.floor(this.rng() * 3);
      const bh = 2 + Math.floor(this.rng() * 3);
      const bx = 2 + Math.floor(this.rng() * (GRID_COLS - bw - 4));
      const by = 2 + Math.floor(this.rng() * (GRID_ROWS - bh - 4));
      if (this._canPlace(grid, bx, by, bw, bh)) {
        for (let row = by; row < by + bh; row++) {
          for (let col = bx; col < bx + bw; col++) {
            grid[row][col] = TileType.BUILDING;
          }
        }
      }
    }

    // Neon accents adjacent to buildings
    const neonChance = 0.07;
    for (let row = 1; row < GRID_ROWS - 1; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        if (grid[row][col] !== TileType.PATH) continue;
        if (this._hasAdjacentBuilding(grid, col, row) && this.rng() < neonChance) {
          grid[row][col] = TileType.NEON;
        }
      }
    }
  }

  private _carveCrossAxis(grid: TileType[][]): void {
    // Horizontal mid-row
    const midRow = Math.floor(GRID_ROWS / 2);
    for (let col = 0; col < GRID_COLS; col++) {
      if (grid[midRow][col] === TileType.BUILDING) grid[midRow][col] = TileType.PATH;
    }
    // Vertical mid-col
    const midCol = Math.floor(GRID_COLS / 2);
    for (let row = 0; row < GRID_ROWS; row++) {
      if (grid[row][midCol] === TileType.BUILDING) grid[row][midCol] = TileType.PATH;
    }
  }

  private _drawBorder(grid: TileType[][]): void {
    for (let col = 0; col < GRID_COLS; col++) {
      grid[0][col] = TileType.BUILDING;
      grid[GRID_ROWS - 1][col] = TileType.BUILDING;
    }
    for (let row = 0; row < GRID_ROWS; row++) {
      grid[row][0] = TileType.BUILDING;
      grid[row][GRID_COLS - 1] = TileType.BUILDING;
    }
  }

  private _scatterDetails(grid: TileType[][]): void {
    for (let row = 2; row < GRID_ROWS - 2; row++) {
      for (let col = 2; col < GRID_COLS - 2; col++) {
        if (grid[row][col] !== TileType.PATH) continue;
        const r = this.rng();
        if (r < 0.015) {
          grid[row][col] = TileType.STEAM;
        } else if (r < 0.03) {
          grid[row][col] = TileType.PUDDLE;
        }
      }
    }
  }

  // ── Connectivity guarantee ───────────────────────────────────────────────

  private _walkable(t: TileType): boolean {
    return (
      t === TileType.PATH ||
      t === TileType.NEON ||
      t === TileType.VENT ||
      t === TileType.STEAM ||
      t === TileType.PUDDLE ||
      t === TileType.KIOSK ||
      t === TileType.TERMINAL ||
      t === TileType.LADDER ||
      t === TileType.CRATE
    );
  }

  private _floodFill(grid: TileType[][], startCol: number, startRow: number): Set<string> {
    const visited = new Set<string>();
    const queue: [number, number][] = [[startCol, startRow]];
    while (queue.length > 0) {
      const [c, r] = queue.pop()!;
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      visited.add(key);
      for (const [dc, dr] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as [number, number][]) {
        const nc = c + dc;
        const nr = r + dr;
        if (
          nc >= 0 &&
          nc < GRID_COLS &&
          nr >= 0 &&
          nr < GRID_ROWS &&
          this._walkable(grid[nr][nc])
        ) {
          queue.push([nc, nr]);
        }
      }
    }
    return visited;
  }

  private _ensureConnectivity(grid: TileType[][]): void {
    const spawnCol = Math.floor(GRID_COLS / 2);
    const spawnRow = Math.floor(GRID_ROWS / 2);

    // Ensure spawn tile is walkable
    if (!this._walkable(grid[spawnRow][spawnCol])) {
      grid[spawnRow][spawnCol] = TileType.PATH;
    }

    const reachable = this._floodFill(grid, spawnCol, spawnRow);

    // Find any walkable tile that's not reachable and connect it via a carved corridor
    for (let row = 1; row < GRID_ROWS - 1; row++) {
      for (let col = 1; col < GRID_COLS - 1; col++) {
        if (!this._walkable(grid[row][col])) continue;
        if (reachable.has(`${col},${row}`)) continue;

        // Carve L-shaped path from (col, row) to (spawnCol, spawnRow)
        // Horizontal segment
        const hDir = col < spawnCol ? 1 : -1;
        let c = col;
        while (c !== spawnCol) {
          if (grid[row][c] === TileType.BUILDING) grid[row][c] = TileType.PATH;
          c += hDir;
        }
        // Vertical segment
        const vDir = row < spawnRow ? 1 : -1;
        let r = row;
        while (r !== spawnRow) {
          if (grid[r][spawnCol] === TileType.BUILDING) grid[r][spawnCol] = TileType.PATH;
          r += vDir;
        }

        // Re-flood from spawn to update reachable set
        const newReachable = this._floodFill(grid, spawnCol, spawnRow);
        newReachable.forEach((k) => reachable.add(k));
        // Stop iterating after fix — next pass will catch remaining islands
        break;
      }
    }
  }

  private _buildConnectivityGraph(grid: TileType[][]): void {
    this._connectivityGraph = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this._walkable(grid[row][col])) {
          this._connectivityGraph.push({ col, row });
        }
      }
    }
  }

  // ── Objective location API ───────────────────────────────────────────────

  /**
   * Returns `count` objective positions that are:
   * - On walkable (path/kiosk/terminal) tiles
   * - Not on the spawn point
   * - At least 8 tiles apart (Chebyshev distance)
   * - Each carries a tileHint to guide objective spawning
   */
  getObjectiveLocations(grid: TileType[][], count: number): ObjectiveLocation[] {
    const objRng = mulberry32(this.seed + 0xf00d);
    const locations: ObjectiveLocation[] = [];
    const occupied = new Set<string>();

    // Block spawn area
    const centerCol = Math.floor(GRID_COLS / 2);
    const centerRow = Math.floor(GRID_ROWS / 2);
    for (let r = centerRow - 3; r <= centerRow + 3; r++) {
      for (let c = centerCol - 3; c <= centerCol + 3; c++) {
        occupied.add(`${c},${r}`);
      }
    }

    // Collect candidates — prefer KIOSK and TERMINAL tiles, then PATH
    const priority: { col: number; row: number; tile: TileType }[] = [];
    const fallback: { col: number; row: number; tile: TileType }[] = [];

    for (let row = 3; row < GRID_ROWS - 3; row++) {
      for (let col = 3; col < GRID_COLS - 3; col++) {
        const t = grid[row][col];
        if (t === TileType.KIOSK || t === TileType.TERMINAL || t === TileType.NEON) {
          priority.push({ col, row, tile: t });
        } else if (t === TileType.PATH || t === TileType.VENT) {
          fallback.push({ col, row, tile: t });
        }
      }
    }

    // Shuffle both lists
    for (let i = priority.length - 1; i > 0; i--) {
      const j = Math.floor(objRng() * (i + 1));
      [priority[i], priority[j]] = [priority[j], priority[i]];
    }
    for (let i = fallback.length - 1; i > 0; i--) {
      const j = Math.floor(objRng() * (i + 1));
      [fallback[i], fallback[j]] = [fallback[j], fallback[i]];
    }

    const candidates = [...priority, ...fallback];
    const MIN_DIST = 8;

    for (const cand of candidates) {
      if (locations.length >= count) break;
      const key = `${cand.col},${cand.row}`;
      if (occupied.has(key)) continue;

      let tooClose = false;
      for (const loc of locations) {
        const dx = Math.abs(loc.col - cand.col);
        const dy = Math.abs(loc.row - cand.row);
        if (dx < MIN_DIST && dy < MIN_DIST) {
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
        tileHint: cand.tile,
      });
    }

    return locations;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private _canPlace(grid: TileType[][], bx: number, by: number, bw: number, bh: number): boolean {
    for (let row = by - 1; row <= by + bh; row++) {
      for (let col = bx - 1; col <= bx + bw; col++) {
        if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return false;
        if (row < by || row >= by + bh || col < bx || col >= bx + bw) {
          if (grid[row][col] === TileType.BUILDING) return false;
        }
      }
    }
    return true;
  }

  private _hasAdjacentBuilding(grid: TileType[][], col: number, row: number): boolean {
    for (const [dc, dr] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as [number, number][]) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
        if (grid[nr][nc] === TileType.BUILDING) return true;
      }
    }
    return false;
  }
}

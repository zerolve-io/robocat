import Phaser from 'phaser';
import {
  CityGenerator,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TileKind,
} from '../generation/CityGenerator';
import { RoboCat } from '../entities/RoboCat';
import { Drone } from '../entities/Drone';
import { AttentionSystem } from '../systems/AttentionSystem';
import { PurrSystem } from '../systems/PurrSystem';
import { HackMinigame } from '../systems/HackMinigame';

const WORLD_WIDTH = GRID_COLS * TILE_SIZE; // 40 * 32 = 1280
const WORLD_HEIGHT = GRID_ROWS * TILE_SIZE; // 30 * 32 = 960

interface NeonTile {
  row: number;
  col: number;
  worldX: number;
  worldY: number;
  hacked: boolean;
  gfx: Phaser.GameObjects.Graphics;
  flashTimer: number;
  flashColor: number | null;
}

export class PatrolScene extends Phaser.Scene {
  private tileGrid!: TileKind[][];
  private buildingGroup!: Phaser.Physics.Arcade.StaticGroup;
  private roboCat!: RoboCat;
  private drone!: Drone;
  private attentionSystem!: AttentionSystem;
  private purrSystem!: PurrSystem;
  private hackMinigame!: HackMinigame;
  private neonTiles: NeonTile[] = [];
  private hackLine!: Phaser.GameObjects.Graphics;
  private activeTileHack: NeonTile | null = null;

  constructor() {
    super({ key: 'PatrolScene' });
  }

  create(): void {
    // ── World bounds ───────────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // ── Generate city ──────────────────────────────────────────────────────
    const generator = new CityGenerator('robocat-seed-001');
    this.tileGrid = generator.generate();
    this.buildingGroup = this.physics.add.staticGroup();
    this.drawWorld();

    // ── Neon tiles tracking ────────────────────────────────────────────────
    this.collectNeonTiles();

    // ── Hack line graphics ─────────────────────────────────────────────────
    this.hackLine = this.add.graphics();
    this.hackLine.setDepth(14);

    // ── Spawn RoboCat ──────────────────────────────────────────────────────
    const spawnTile = this.findWalkableSpawn();
    const spawnX = spawnTile.x * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = spawnTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.roboCat = new RoboCat(this, spawnX, spawnY);

    // ── Spawn Drone ────────────────────────────────────────────────────────
    this.drone = new Drone(this, WORLD_WIDTH, WORLD_HEIGHT);

    // ── Camera follows cat ─────────────────────────────────────────────────
    this.cameras.main.startFollow(this.roboCat.sprite, true, 0.1, 0.1);

    // ── Collision: cat vs buildings ────────────────────────────────────────
    this.physics.add.collider(this.roboCat.sprite, this.buildingGroup);

    // ── HUD scene (runs in parallel) ───────────────────────────────────────
    this.scene.launch('HUDScene');

    // ── Systems ───────────────────────────────────────────────────────────
    this.attentionSystem = new AttentionSystem(this);
    this.purrSystem = new PurrSystem(this);
    this.hackMinigame = new HackMinigame(this);

    // Right-click context menu disable (for aim)
    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update(time: number, delta: number): void {
    this.roboCat.update(delta);
    this.drone.update(delta);
    this.attentionSystem.update(this.roboCat.sprite, this.drone, delta);

    // Purr system
    this.purrSystem.update(
      this.roboCat.x,
      this.roboCat.y,
      this.roboCat.spaceDown,
      [this.drone],
      delta,
      this.roboCat.sprite
    );

    // Hack interactions
    this.updateHackInteraction();
    this.hackMinigame.update();

    // Neon tile flash timers
    this.updateNeonFlash(delta);
  }

  // ── Hack logic ───────────────────────────────────────────────────────────

  private updateHackInteraction(): void {
    this.hackLine.clear();

    if (this.hackMinigame.isActive) return;

    // Find nearest neon tile
    const nearest = this.findNearestNeon();

    if (nearest) {
      // Draw hack line from cat to terminal
      this.hackLine.lineStyle(1.5, 0x00ffff, 0.6);
      this.hackLine.beginPath();
      this.hackLine.moveTo(this.roboCat.x, this.roboCat.y);
      this.hackLine.lineTo(nearest.worldX + TILE_SIZE / 2, nearest.worldY + TILE_SIZE / 2);
      this.hackLine.strokePath();

      // Draw pulsing dot on terminal
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      this.hackLine.fillStyle(0x00ffff, pulse);
      this.hackLine.fillCircle(nearest.worldX + TILE_SIZE / 2, nearest.worldY + TILE_SIZE / 2, 4);

      // E to hack
      if (this.roboCat.eJustDown && !nearest.hacked) {
        this.activeTileHack = nearest;
        this.hackMinigame.start((result) => {
          this.onHackResult(result);
        });
      }
    }
  }

  private onHackResult(result: 'success' | 'fail' | 'timeout'): void {
    const tile = this.activeTileHack;
    if (!tile) return;
    this.activeTileHack = null;

    if (result === 'success') {
      tile.hacked = true;
      tile.flashColor = 0x00ff88;
      tile.flashTimer = 600;
      this.roboCat.addScore(10);
      this.spawnHackSuccessParticles(tile);
    } else if (result === 'fail' || result === 'timeout') {
      tile.flashColor = 0xff0000;
      tile.flashTimer = 400;
      this.attentionSystem.bump(0.25);
    }
  }

  private spawnHackSuccessParticles(tile: NeonTile): void {
    const cx = tile.worldX + TILE_SIZE / 2;
    const cy = tile.worldY + TILE_SIZE / 2;

    for (let i = 0; i < 12; i++) {
      const gfx = this.add.graphics();
      gfx.setDepth(15);
      const angle = (i / 12) * Math.PI * 2;
      const speed = 40 + Math.random() * 40;
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;
      let x = cx;
      let y = cy;
      let life = 500 + Math.random() * 300;
      const maxLife = life;

      const update = (dt: number) => {
        life -= dt;
        if (life <= 0) {
          gfx.destroy();
          return;
        }
        x += (vx * dt) / 1000;
        y += (vy * dt) / 1000;
        vy += (80 * dt) / 1000;
        const alpha = life / maxLife;
        gfx.clear();
        gfx.fillStyle(0x00ff88, alpha);
        gfx.fillRect(x - 2, y - 2, 4, 4);
      };

      const ev = this.events.on('update', (_t: number, d: number) => update(d));
      this.time.delayedCall(maxLife, () => {
        this.events.off('update', ev as unknown as (...args: unknown[]) => void);
        if (gfx.active) gfx.destroy();
      });
    }
  }

  private updateNeonFlash(delta: number): void {
    for (const tile of this.neonTiles) {
      if (tile.flashTimer > 0) {
        tile.flashTimer -= delta;
        const progress = tile.flashTimer > 0 ? 1 : 0;
        tile.gfx.clear();

        if (tile.hacked) {
          // Green if hacked
          tile.gfx.fillStyle(0x00ff88, 0.4);
          tile.gfx.fillRect(tile.worldX + 4, tile.worldY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          tile.gfx.lineStyle(1, 0x00ff88, 0.8);
          tile.gfx.strokeRect(tile.worldX + 4, tile.worldY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else if (tile.flashColor !== null) {
          const flashAlpha = progress * 0.6;
          tile.gfx.fillStyle(tile.flashColor, flashAlpha);
          tile.gfx.fillRect(tile.worldX, tile.worldY, TILE_SIZE, TILE_SIZE);
          if (tile.flashTimer <= 0) {
            tile.flashColor = null;
          }
        }
      } else if (tile.hacked) {
        // Keep hacked tile green (no flash needed, static)
      }
    }
  }

  private findNearestNeon(): NeonTile | null {
    let best: NeonTile | null = null;
    let bestDist = Infinity;

    for (const tile of this.neonTiles) {
      if (tile.hacked) continue;
      const dx = this.roboCat.x - (tile.worldX + TILE_SIZE / 2);
      const dy = this.roboCat.y - (tile.worldY + TILE_SIZE / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TILE_SIZE * 1.5 && dist < bestDist) {
        bestDist = dist;
        best = tile;
      }
    }
    return best;
  }

  private collectNeonTiles(): void {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        if (this.tileGrid[row][col] === TileKind.Neon) {
          const worldX = col * TILE_SIZE;
          const worldY = row * TILE_SIZE;
          const gfx = this.add.graphics();
          gfx.setDepth(3);
          this.neonTiles.push({
            row,
            col,
            worldX,
            worldY,
            hacked: false,
            gfx,
            flashTimer: 0,
            flashColor: null,
          });
        }
      }
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private drawWorld(): void {
    const graphics = this.add.graphics();

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const kind = this.tileGrid[row][col];
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        switch (kind) {
          case TileKind.Building:
            graphics.fillStyle(0x1a1a2e);
            graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            graphics.lineStyle(1, 0x2a2a3e, 0.8);
            graphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            this.addBuildingBody(x, y, TILE_SIZE, TILE_SIZE);
            break;

          case TileKind.Neon:
            graphics.fillStyle(0x0d0d18);
            graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            graphics.fillStyle(0x00ffff, 0.15);
            graphics.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            graphics.lineStyle(1, 0x00ffff, 0.6);
            graphics.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            break;

          case TileKind.Path:
          default:
            graphics.fillStyle(0x16213e);
            graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            break;
        }
      }
    }
  }

  private addBuildingBody(x: number, y: number, w: number, h: number): void {
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1a1a2e);
    this.physics.add.existing(rect, true);
    this.buildingGroup.add(rect);
  }

  private findWalkableSpawn(): { x: number; y: number } {
    const cx = Math.floor(GRID_COLS / 2);
    const cy = Math.floor(GRID_ROWS / 2);
    for (let r = 0; r < Math.max(GRID_COLS, GRID_ROWS); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const col = cx + dx;
          const row = cy + dy;
          if (
            col >= 0 &&
            col < GRID_COLS &&
            row >= 0 &&
            row < GRID_ROWS &&
            this.tileGrid[row][col] !== TileKind.Building
          ) {
            return { x: col, y: row };
          }
        }
      }
    }
    return { x: 1, y: 1 };
  }
}

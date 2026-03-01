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

const WORLD_WIDTH = GRID_COLS * TILE_SIZE; // 40 * 32 = 1280
const WORLD_HEIGHT = GRID_ROWS * TILE_SIZE; // 30 * 32 = 960

export class PatrolScene extends Phaser.Scene {
  private tileGrid!: TileKind[][];
  private buildingGroup!: Phaser.Physics.Arcade.StaticGroup;
  private roboCat!: RoboCat;
  private drone!: Drone;
  private attentionSystem!: AttentionSystem;

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

    // ── Spawn RoboCat ──────────────────────────────────────────────────────
    // Find a walkable spawn for the cat
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

    // ── Attention system ───────────────────────────────────────────────────
    this.attentionSystem = new AttentionSystem(this);
  }

  update(time: number, delta: number): void {
    this.roboCat.update(delta);
    this.drone.update(delta);
    this.attentionSystem.update(this.roboCat.sprite, this.drone, delta);
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
            // Subtle border
            graphics.lineStyle(1, 0x2a2a3e, 0.8);
            graphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            // Add invisible static body for collision
            this.addBuildingBody(x, y, TILE_SIZE, TILE_SIZE);
            break;

          case TileKind.Neon:
            graphics.fillStyle(0x0d0d18);
            graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            // Cyan neon accent — small inner glow square
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
    // Use a rectangle game object as a static physics body
    const rect = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x1a1a2e);
    this.physics.add.existing(rect, true);
    this.buildingGroup.add(rect);
  }

  private findWalkableSpawn(): { x: number; y: number } {
    // Start near center and walk outward
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

import Phaser from 'phaser';
import {
  CityGenerator,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  TileKind,
} from '../generation/CityGenerator';
import { hashSeed } from '@robocat/shared';
import { RoboCat } from '../entities/RoboCat';
import { Drone } from '../entities/Drone';
import { AttentionSystem } from '../systems/AttentionSystem';
import { PurrSystem } from '../systems/PurrSystem';
import { HackMinigame } from '../systems/HackMinigame';
import { ObjectiveSystem, loadTotalScraps, saveTotalScraps } from '../systems/ObjectiveSystem';
import type { PatrolObjective } from '../systems/ObjectiveSystem';
import {
  HUD_ATTENTION_KEY,
  HUD_PURR_KEY,
  HUD_SCORE_KEY,
  HUD_POUNCE_COOLDOWN_KEY,
  HUD_SCRAPS_KEY,
  HUD_TIMER_KEY,
  HUD_OBJECTIVES_KEY,
  HUD_SEED_KEY,
  HUD_INTERACTION_KEY,
} from './HUDScene';

const WORLD_WIDTH = GRID_COLS * TILE_SIZE;
const WORLD_HEIGHT = GRID_ROWS * TILE_SIZE;

const SCATTERED_SCRAPS_COUNT = 10;
const SCATTERED_SCRAP_VALUE = 5;

interface ScatteredScrap {
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  gfx: Phaser.GameObjects.Graphics;
  collected: boolean;
}

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

interface ChargingCrate {
  worldX: number;
  worldY: number;
  gfx: Phaser.GameObjects.Graphics;
}

type PatrolPhase = 'briefing' | 'active' | 'debrief';

// Suppress unused import warnings — these constants are used by game.events.emit
void HUD_ATTENTION_KEY;
void HUD_PURR_KEY;
void HUD_SCORE_KEY;
void HUD_POUNCE_COOLDOWN_KEY;

export class PatrolScene extends Phaser.Scene {
  private tileGrid!: TileKind[][];
  private buildingGroup!: Phaser.Physics.Arcade.StaticGroup;
  private roboCat!: RoboCat;
  private drone!: Drone;
  private attentionSystem!: AttentionSystem;
  private purrSystem!: PurrSystem;
  private hackMinigame!: HackMinigame;

  private objectiveSystem!: ObjectiveSystem;

  private neonTiles: NeonTile[] = [];
  private hackLine!: Phaser.GameObjects.Graphics;
  private activeTileHack: NeonTile | null = null;

  private totalScraps = 0;
  private patrolScraps = 0;
  private scatteredScraps: ScatteredScrap[] = [];

  private patrolNumber = 1;
  private patrolSeed: number | string = 'robocat-seed-001';
  private patrolTimer = 0;
  private phase: PatrolPhase = 'briefing';
  private generator!: CityGenerator;

  private chargingCrate!: ChargingCrate;
  private crateGfx!: Phaser.GameObjects.Graphics;

  private overlayContainer: Phaser.GameObjects.Container | null = null;

  private lastInteraction = '';
  private keyEnter!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'PatrolScene' });
  }

  init(data?: { patrolNumber?: number; totalScraps?: number }): void {
    this.patrolNumber = data?.patrolNumber ?? 1;
    this.totalScraps = data?.totalScraps ?? loadTotalScraps();
    this.patrolSeed = this.patrolNumber;
    this.patrolTimer = 0;
    this.patrolScraps = 0;
    this.phase = 'briefing';
    this.neonTiles = [];
    this.scatteredScraps = [];
    this.activeTileHack = null;
    this.overlayContainer = null;
    this.lastInteraction = '';
  }

  create(): void {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.generator = new CityGenerator(this.patrolSeed);
    this.tileGrid = this.generator.generate();
    this.buildingGroup = this.physics.add.staticGroup();
    this.drawWorld();

    this.collectNeonTiles();

    this.hackLine = this.add.graphics();
    this.hackLine.setDepth(14);

    const spawnTile = this.findWalkableSpawn();
    const spawnX = spawnTile.x * TILE_SIZE + TILE_SIZE / 2;
    const spawnY = spawnTile.y * TILE_SIZE + TILE_SIZE / 2;
    this.roboCat = new RoboCat(this, spawnX, spawnY);

    this.drone = new Drone(this, WORLD_WIDTH, WORLD_HEIGHT);

    this.cameras.main.startFollow(this.roboCat.sprite, true, 0.1, 0.1);
    this.physics.add.collider(this.roboCat.sprite, this.buildingGroup);

    if (!this.scene.isActive('HUDScene')) {
      this.scene.launch('HUDScene');
    }

    this.attentionSystem = new AttentionSystem(this);
    this.purrSystem = new PurrSystem(this);
    this.hackMinigame = new HackMinigame(this);
    this.objectiveSystem = new ObjectiveSystem(this);

    const locations = this.generator.getObjectiveLocations(this.tileGrid, 12);
    this.objectiveSystem.generate(this.patrolSeed, locations);
    this.objectiveSystem.spawnObjects();

    this.objectiveSystem.onObjectiveComplete = (obj: PatrolObjective, scrapsEarned: number) => {
      this.onObjectiveCompleted(obj, scrapsEarned);
    };

    this.spawnChargingCrate(spawnTile.x, spawnTile.y);
    this.spawnScatteredScraps();

    this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.emitSeed();
    this.emitScraps();
    this.emitObjectives();

    this.time.delayedCall(100, () => this.showBriefing());
  }

  update(_time: number, delta: number): void {
    this.roboCat.update(delta);
    this.drone.update(delta);
    this.attentionSystem.update(this.roboCat.sprite, this.drone, delta);
    this.purrSystem.update(
      this.roboCat.x,
      this.roboCat.y,
      this.roboCat.spaceDown,
      [this.drone],
      delta,
      this.roboCat.sprite
    );

    if (this.phase === 'briefing' || this.phase === 'debrief') {
      if (Phaser.Input.Keyboard.JustDown(this.keyEnter)) {
        if (this.phase === 'briefing') {
          this.startPatrol();
        } else if (this.phase === 'debrief') {
          this.startNextPatrol();
        }
      }
      return;
    }

    this.patrolTimer += delta;
    this.emitTimer();

    const { completedId, interaction } = this.objectiveSystem.update(
      this.roboCat.x,
      this.roboCat.y,
      this.roboCat.eJustDown,
      this.roboCat.eIsDown,
      delta
    );

    if (completedId) {
      this.emitObjectives();
    }

    this.updateBillboardHackInteraction();
    this.updateHackInteraction();
    this.hackMinigame.update();
    this.updateNeonFlash(delta);
    this.updateScatteredScraps();
    this.updateCrateInteraction(interaction);
  }

  // ── Briefing overlay ──────────────────────────────────────────────────────

  private showBriefing(): void {
    this.phase = 'briefing';
    const W = this.scale.width;
    const H = this.scale.height;
    const objectives = this.objectiveSystem.getObjectives();
    const lines: string[] = [
      `NIGHT PATROL #${this.patrolNumber}`,
      '',
      'OBJECTIVES:',
      ...objectives.map((o) => `  \u2610  ${o.title}`),
      '',
      '[Press ENTER to begin]',
    ];
    this.showOverlay(lines, W / 2, H / 2);
  }

  private startPatrol(): void {
    this.phase = 'active';
    this.destroyOverlay();
  }

  // ── Debrief overlay ───────────────────────────────────────────────────────

  private showDebrief(): void {
    this.phase = 'debrief';
    const W = this.scale.width;
    const H = this.scale.height;

    const seconds = Math.floor(this.patrolTimer / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    const completed = this.objectiveSystem.getCompletedCount();
    const total = this.objectiveSystem.getObjectives().length;
    const patrolEarned = this.objectiveSystem.getPatrolScraps();
    const comboBonus = this.objectiveSystem.getComboBonusTotal();
    const totalEarned = patrolEarned + this.patrolScraps;
    const newTotal = this.totalScraps + totalEarned;

    const lines: string[] = [
      'PATROL COMPLETE',
      '',
      `Time:          ${timeStr}`,
      `Objectives:    ${completed}/${total}`,
      `Scraps earned: ${totalEarned}`,
      ...(comboBonus > 0 ? [`Combo bonus:  +${comboBonus}`] : []),
      '',
      `Total scraps:  ${newTotal}`,
      '',
      '[Press ENTER for next patrol]',
    ];

    saveTotalScraps(newTotal);
    this.totalScraps = newTotal;

    this.showOverlay(lines, W / 2, H / 2);
  }

  private startNextPatrol(): void {
    this.destroyOverlay();
    this.objectiveSystem.destroyObjects();
    for (const s of this.scatteredScraps) {
      if (!s.collected) s.gfx.destroy();
    }
    this.crateGfx?.destroy();
    this.scene.restart({
      patrolNumber: this.patrolNumber + 1,
      totalScraps: this.totalScraps,
    });
  }

  // ── Overlay helper ────────────────────────────────────────────────────────

  private showOverlay(lines: string[], cx: number, cy: number): void {
    this.destroyOverlay();

    const padding = 24;
    const lineH = 20;
    const boxH = lines.length * lineH + padding * 2;
    const boxW = 380;

    const bg = this.add
      .rectangle(cx, cy, boxW, boxH, 0x000000, 0.92)
      .setScrollFactor(0)
      .setDepth(300);
    bg.setStrokeStyle(2, 0x00ffcc);

    const children: Phaser.GameObjects.GameObject[] = [bg];

    lines.forEach((line, i) => {
      const isTitle = i === 0;
      const isFooter = line.startsWith('[Press');
      const color = isTitle ? '#00ffcc' : isFooter ? '#888888' : '#ccddee';
      const fontSize = isTitle ? '16px' : '11px';
      const t = this.add
        .text(cx, cy - boxH / 2 + padding + i * lineH + (isTitle ? 4 : 0), line, {
          fontFamily: 'monospace',
          fontSize,
          color,
          align: 'left',
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(301);
      children.push(t);
    });

    this.overlayContainer = this.add.container(0, 0, children);
    this.overlayContainer.setDepth(300);
  }

  private destroyOverlay(): void {
    if (this.overlayContainer) {
      this.overlayContainer.destroy(true);
      this.overlayContainer = null;
    }
  }

  // ── Objective completion ──────────────────────────────────────────────────

  private onObjectiveCompleted(obj: PatrolObjective, scrapsEarned: number): void {
    this.emitScraps();
    this.emitObjectives();
    this.spawnFloatingText(
      this.roboCat.x,
      this.roboCat.y - 24,
      `+${scrapsEarned} scraps`,
      0xffdd44
    );
    this.spawnFloatingText(this.roboCat.x, this.roboCat.y - 44, `\u2713 ${obj.title}`, 0x00ff88);
    this.roboCat.addScore(scrapsEarned);
  }

  // ── Billboard hack ────────────────────────────────────────────────────────

  private updateBillboardHackInteraction(): void {
    if (this.hackMinigame.isActive) return;
    const billboardObj = this.objectiveSystem.getBillboardObjective();
    if (!billboardObj) return;

    const dist = Math.sqrt(
      (this.roboCat.x - billboardObj.targetX) ** 2 + (this.roboCat.y - billboardObj.targetY) ** 2
    );

    if (dist < TILE_SIZE * 2.5 && this.roboCat.eJustDown) {
      this.hackMinigame.start(
        (result) => {
          if (result === 'success') {
            this.objectiveSystem.completeBillboardHack();
            this.emitScraps();
            this.emitObjectives();
            this.spawnFloatingText(
              this.roboCat.x,
              this.roboCat.y - 24,
              '+30 scraps  BILLBOARD HACKED',
              0x00ffcc
            );
            this.roboCat.addScore(30);
          } else {
            this.attentionSystem.bump(0.25);
          }
        },
        { sequenceLength: 4, title: 'BILLBOARD HACK' }
      );
    }
  }

  // ── Charging crate ────────────────────────────────────────────────────────

  private spawnChargingCrate(spawnCol: number, spawnRow: number): void {
    let crateCol = spawnCol + 3;
    let crateRow = spawnRow;
    if (crateCol >= GRID_COLS || this.tileGrid[crateRow]?.[crateCol] === TileKind.Building) {
      crateCol = Math.max(1, spawnCol - 3);
    }
    if (this.tileGrid[crateRow]?.[crateCol] === TileKind.Building) {
      crateCol = spawnCol;
      crateRow = Math.min(GRID_ROWS - 2, spawnRow + 3);
    }

    const crateX = crateCol * TILE_SIZE;
    const crateY = crateRow * TILE_SIZE;

    this.crateGfx = this.add.graphics();
    this.crateGfx.setDepth(5);
    this.drawCrateGfx(crateX, crateY);

    this.chargingCrate = { worldX: crateX, worldY: crateY, gfx: this.crateGfx };
  }

  private drawCrateGfx(x: number, y: number): void {
    this.crateGfx.clear();
    this.crateGfx.fillStyle(0x00ff88, 0.25);
    this.crateGfx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    this.crateGfx.lineStyle(2, 0x00ff88, 0.9);
    this.crateGfx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    // Lightning bolt
    this.crateGfx.fillStyle(0x00ff88, 0.9);
    this.crateGfx.fillTriangle(x + 19, y + 6, x + 13, y + 16, x + 17, y + 16);
    this.crateGfx.fillTriangle(x + 15, y + 16, x + 10, y + 26, x + 19, y + 18);
  }

  private updateCrateInteraction(objectiveInteraction: string | null): void {
    const crateX = this.chargingCrate.worldX + TILE_SIZE / 2;
    const crateY = this.chargingCrate.worldY + TILE_SIZE / 2;
    const dist = Math.sqrt((this.roboCat.x - crateX) ** 2 + (this.roboCat.y - crateY) ** 2);
    const nearby = dist < TILE_SIZE * 1.5;

    let interactionText = objectiveInteraction ?? '';

    if (nearby) {
      const completedCount = this.objectiveSystem.getCompletedCount();
      if (completedCount > 0) {
        interactionText = 'E: return to crate — end patrol';
        if (this.roboCat.eJustDown) {
          this.showDebrief();
          return;
        }
      } else {
        interactionText = 'Complete an objective first to end patrol';
      }
    }

    if (interactionText !== this.lastInteraction) {
      this.lastInteraction = interactionText;
      this.game.events.emit(HUD_INTERACTION_KEY, interactionText);
    }
  }

  // ── Scattered scraps ──────────────────────────────────────────────────────

  private spawnScatteredScraps(): void {
    const seedNum =
      typeof this.patrolSeed === 'string'
        ? hashSeed(this.patrolSeed + '_scraps')
        : (this.patrolSeed as number) + 0xca77;
    const rng = (() => {
      let s = seedNum >>> 0;
      return () => {
        s += 0x6d2b79f5;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();

    const paths: { col: number; row: number }[] = [];
    for (let row = 2; row < GRID_ROWS - 2; row++) {
      for (let col = 2; col < GRID_COLS - 2; col++) {
        if (this.tileGrid[row][col] === TileKind.Path) {
          paths.push({ col, row });
        }
      }
    }
    for (let i = paths.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [paths[i], paths[j]] = [paths[j], paths[i]];
    }

    const selected = paths.slice(0, SCATTERED_SCRAPS_COUNT);
    for (const p of selected) {
      const gfx = this.add.graphics();
      gfx.setDepth(4);
      const wx = p.col * TILE_SIZE;
      const wy = p.row * TILE_SIZE;
      gfx.fillStyle(0x00ffff, 0.7);
      gfx.fillCircle(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2, 3);
      gfx.lineStyle(1, 0x00ffff, 0.5);
      gfx.strokeCircle(wx + TILE_SIZE / 2, wy + TILE_SIZE / 2, 5);
      this.scatteredScraps.push({
        col: p.col,
        row: p.row,
        worldX: wx,
        worldY: wy,
        gfx,
        collected: false,
      });
    }
  }

  private updateScatteredScraps(): void {
    for (const scrap of this.scatteredScraps) {
      if (scrap.collected) continue;
      const cx = scrap.worldX + TILE_SIZE / 2;
      const cy = scrap.worldY + TILE_SIZE / 2;
      const dist = Math.sqrt((this.roboCat.x - cx) ** 2 + (this.roboCat.y - cy) ** 2);
      if (dist < TILE_SIZE * 0.7) {
        scrap.collected = true;
        scrap.gfx.destroy();
        this.patrolScraps += SCATTERED_SCRAP_VALUE;
        this.emitScraps();
        this.spawnFloatingText(cx, cy - 10, `+${SCATTERED_SCRAP_VALUE}`, 0x00ffff);
      }
    }
  }

  // ── HUD emitters ─────────────────────────────────────────────────────────

  private emitSeed(): void {
    this.game.events.emit(HUD_SEED_KEY, this.patrolSeed);
  }

  private emitScraps(): void {
    const total = this.totalScraps + this.objectiveSystem.getPatrolScraps() + this.patrolScraps;
    this.game.events.emit(HUD_SCRAPS_KEY, total);
  }

  private emitTimer(): void {
    this.game.events.emit(HUD_TIMER_KEY, this.patrolTimer / 1000);
  }

  private emitObjectives(): void {
    this.game.events.emit(HUD_OBJECTIVES_KEY, this.objectiveSystem.getObjectives());
  }

  // ── Floating text ─────────────────────────────────────────────────────────

  private spawnFloatingText(x: number, y: number, text: string, color: number): void {
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const t = this.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '10px', color: hex })
      .setDepth(50)
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 30,
      alpha: 0,
      duration: 1200,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    });
  }

  // ── Neon tile hack (existing mechanic) ───────────────────────────────────

  private updateHackInteraction(): void {
    this.hackLine.clear();
    if (this.hackMinigame.isActive) return;

    const nearest = this.findNearestNeon();
    if (nearest) {
      this.hackLine.lineStyle(1.5, 0x00ffff, 0.6);
      this.hackLine.beginPath();
      this.hackLine.moveTo(this.roboCat.x, this.roboCat.y);
      this.hackLine.lineTo(nearest.worldX + TILE_SIZE / 2, nearest.worldY + TILE_SIZE / 2);
      this.hackLine.strokePath();

      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      this.hackLine.fillStyle(0x00ffff, pulse);
      this.hackLine.fillCircle(nearest.worldX + TILE_SIZE / 2, nearest.worldY + TILE_SIZE / 2, 4);

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
    } else {
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
      let px = cx;
      let py = cy;
      let life = 500 + Math.random() * 300;
      const maxLife = life;
      const ev = (_: number, d: number) => {
        life -= d;
        if (life <= 0) {
          gfx.destroy();
          return;
        }
        px += (vx * d) / 1000;
        py += (vy * d) / 1000;
        vy += (80 * d) / 1000;
        gfx.clear();
        gfx.fillStyle(0x00ff88, life / maxLife);
        gfx.fillRect(px - 2, py - 2, 4, 4);
      };
      this.events.on('update', ev);
      this.time.delayedCall(maxLife, () => {
        this.events.off('update', ev);
        if (gfx.active) gfx.destroy();
      });
    }
  }

  private updateNeonFlash(delta: number): void {
    for (const tile of this.neonTiles) {
      if (tile.flashTimer > 0) {
        tile.flashTimer -= delta;
        tile.gfx.clear();
        if (tile.hacked) {
          tile.gfx.fillStyle(0x00ff88, 0.4);
          tile.gfx.fillRect(tile.worldX + 4, tile.worldY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          tile.gfx.lineStyle(1, 0x00ff88, 0.8);
          tile.gfx.strokeRect(tile.worldX + 4, tile.worldY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        } else if (tile.flashColor !== null) {
          const flashAlpha = (tile.flashTimer > 0 ? 1 : 0) * 0.6;
          tile.gfx.fillStyle(tile.flashColor, flashAlpha);
          tile.gfx.fillRect(tile.worldX, tile.worldY, TILE_SIZE, TILE_SIZE);
          if (tile.flashTimer <= 0) tile.flashColor = null;
        }
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

  // ── World drawing ─────────────────────────────────────────────────────────

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

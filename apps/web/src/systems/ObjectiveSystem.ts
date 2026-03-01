import Phaser from 'phaser';
import { mulberry32, hashSeed } from '@robocat/shared';
import { TILE_SIZE } from '../generation/CityGenerator';
import type { ObjectiveLocation } from '../generation/CityGenerator';

export type ObjectiveType =
  | 'steal_fish'
  | 'deliver_collar'
  | 'hack_billboard'
  | 'retrieve_yarnball'
  | 'rescue_bot'
  | 'plant_listener';

export interface PatrolObjective {
  id: string;
  type: ObjectiveType;
  title: string;
  description: string;
  targetX: number;
  targetY: number;
  targetX2?: number;
  targetY2?: number;
  completed: boolean;
  reward: number;
}

const SCRAPS_STORAGE_KEY = 'robocat_total_scraps';

export function loadTotalScraps(): number {
  try {
    // eslint-disable-next-line no-undef
    return parseInt(localStorage.getItem(SCRAPS_STORAGE_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveTotalScraps(n: number): void {
  try {
    // eslint-disable-next-line no-undef
    localStorage.setItem(SCRAPS_STORAGE_KEY, String(n));
  } catch {
    // ignore
  }
}

interface ObjectiveTemplate {
  type: ObjectiveType;
  title: string;
  description: string;
  reward: number;
  extraLocations: number;
}

const TEMPLATES: ObjectiveTemplate[] = [
  {
    type: 'steal_fish',
    title: 'Steal Heat-Battery Fish',
    description: 'Grab the fish from the kiosk.',
    reward: 20,
    extraLocations: 0,
  },
  {
    type: 'deliver_collar',
    title: 'Deliver Stolen Collar',
    description: 'Pick up the collar, deliver to the beacon.',
    reward: 25,
    extraLocations: 1,
  },
  {
    type: 'hack_billboard',
    title: 'Hack the Billboard',
    description: 'Tail-hack the neon billboard (4 inputs).',
    reward: 30,
    extraLocations: 0,
  },
  {
    type: 'retrieve_yarnball',
    title: 'Retrieve Memory Yarnball',
    description: 'Sneak in and grab the encrypted yarnball.',
    reward: 35,
    extraLocations: 0,
  },
  {
    type: 'rescue_bot',
    title: 'Rescue Downed Bot',
    description: 'Reboot the bot and escort it to safety.',
    reward: 30,
    extraLocations: 1,
  },
  {
    type: 'plant_listener',
    title: 'Plant Listener Device',
    description: 'Hold E for 3s to plant the bug.',
    reward: 40,
    extraLocations: 0,
  },
];

interface ObjectiveObject {
  objectiveId: string;
  gfx: Phaser.GameObjects.Graphics;
  worldX: number;
  worldY: number;
  secondary?: { gfx: Phaser.GameObjects.Graphics; worldX: number; worldY: number };
  botFollowing?: boolean;
  botX?: number;
  botY?: number;
  plantHoldMs?: number;
  coinsLeft?: boolean;
  collarPickedUp?: boolean;
}

export class ObjectiveSystem {
  private scene: Phaser.Scene;
  private objectives: PatrolObjective[] = [];
  private objects: ObjectiveObject[] = [];
  private patrolScraps = 0;
  private comboCount = 0;
  private comboBonusTotal = 0;
  private blinkTimer = 0;
  private blinkVisible = true;
  onObjectiveComplete?: (obj: PatrolObjective, scrapsEarned: number) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generate(seed: number | string, locations: ObjectiveLocation[]): PatrolObjective[] {
    const s = typeof seed === 'string' ? hashSeed(seed) : seed;
    const rng = mulberry32(s + 0xbeef);
    this.objectives = [];
    this.objects = [];
    this.patrolScraps = 0;
    this.comboCount = 0;
    this.comboBonusTotal = 0;
    const shuffled = [...TEMPLATES];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = shuffled.slice(0, 3);
    let locIdx = 0;
    for (let i = 0; i < chosen.length; i++) {
      const tmpl = chosen[i];
      if (locIdx >= locations.length) break;
      const loc = locations[locIdx++];
      let loc2: ObjectiveLocation | undefined;
      if (tmpl.extraLocations > 0 && locIdx < locations.length) loc2 = locations[locIdx++];
      this.objectives.push({
        id: `obj_${i}_${tmpl.type}`,
        type: tmpl.type,
        title: tmpl.title,
        description: tmpl.description,
        targetX: loc.worldX + TILE_SIZE / 2,
        targetY: loc.worldY + TILE_SIZE / 2,
        targetX2: loc2 ? loc2.worldX + TILE_SIZE / 2 : undefined,
        targetY2: loc2 ? loc2.worldY + TILE_SIZE / 2 : undefined,
        completed: false,
        reward: tmpl.reward,
      });
    }
    return this.objectives;
  }

  getObjectives(): PatrolObjective[] {
    return this.objectives;
  }
  getCompletedCount(): number {
    return this.objectives.filter((o) => o.completed).length;
  }
  getPatrolScraps(): number {
    return this.patrolScraps;
  }
  getComboBonusTotal(): number {
    return this.comboBonusTotal;
  }

  spawnObjects(): void {
    for (const obj of this.objectives) this.spawnObj(obj);
  }

  private spawnObj(obj: PatrolObjective): void {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(5);
    const oo: ObjectiveObject = {
      objectiveId: obj.id,
      gfx,
      worldX: obj.targetX - TILE_SIZE / 2,
      worldY: obj.targetY - TILE_SIZE / 2,
    };
    if (
      (obj.type === 'deliver_collar' || obj.type === 'rescue_bot') &&
      obj.targetX2 !== undefined &&
      obj.targetY2 !== undefined
    ) {
      const gfx2 = this.scene.add.graphics();
      gfx2.setDepth(5);
      oo.secondary = {
        gfx: gfx2,
        worldX: obj.targetX2 - TILE_SIZE / 2,
        worldY: obj.targetY2 - TILE_SIZE / 2,
      };
    }
    if (obj.type === 'deliver_collar') oo.collarPickedUp = false;
    if (obj.type === 'rescue_bot') {
      oo.botFollowing = false;
      oo.botX = obj.targetX;
      oo.botY = obj.targetY;
    }
    if (obj.type === 'plant_listener') oo.plantHoldMs = 0;
    this.objects.push(oo);
    this.drawObject(oo, obj);
  }

  private drawObject(oo: ObjectiveObject, obj: PatrolObjective): void {
    if (obj.completed) {
      oo.gfx.clear();
      oo.secondary?.gfx.clear();
      return;
    }
    oo.gfx.clear();
    const x = oo.worldX;
    const y = oo.worldY;
    const s = TILE_SIZE;
    switch (obj.type) {
      case 'steal_fish':
        oo.gfx.fillStyle(0xff8800, 0.9);
        oo.gfx.fillRect(x + 6, y + 6, s - 12, s - 12);
        oo.gfx.lineStyle(2, 0xffaa00, 1);
        oo.gfx.strokeRect(x + 6, y + 6, s - 12, s - 12);
        oo.gfx.fillStyle(0xffffff, 0.7);
        oo.gfx.fillTriangle(x + 10, y + 13, x + 22, y + 16, x + 10, y + 19);
        oo.gfx.fillCircle(x + 20, y + 16, 3);
        break;
      case 'deliver_collar':
        if (!oo.collarPickedUp) {
          oo.gfx.fillStyle(0x0088ff, 0.85);
          oo.gfx.fillRect(x + 6, y + 6, s - 12, s - 12);
          oo.gfx.lineStyle(2, 0x44aaff, 1);
          oo.gfx.strokeRect(x + 6, y + 6, s - 12, s - 12);
          oo.gfx.lineStyle(3, 0xffffff, 0.8);
          oo.gfx.strokeCircle(x + 16, y + 16, 6);
        }
        if (oo.secondary && this.blinkVisible) {
          oo.secondary.gfx.clear();
          oo.secondary.gfx.fillStyle(0xffffff, 0.85);
          oo.secondary.gfx.fillRect(
            oo.secondary.worldX + 8,
            oo.secondary.worldY + 8,
            s - 16,
            s - 16
          );
          oo.secondary.gfx.lineStyle(2, 0xaaffff, 1);
          oo.secondary.gfx.strokeRect(
            oo.secondary.worldX + 8,
            oo.secondary.worldY + 8,
            s - 16,
            s - 16
          );
        } else if (oo.secondary && !this.blinkVisible) {
          oo.secondary.gfx.clear();
        }
        break;
      case 'hack_billboard':
        for (let dr = 0; dr < 2; dr++)
          for (let dc = 0; dc < 2; dc++) {
            const bx = x + dc * s;
            const by = y + dr * s;
            oo.gfx.fillStyle(0x00ffff, 0.3);
            oo.gfx.fillRect(bx, by, s, s);
            oo.gfx.lineStyle(2, 0x00ffff, 0.9);
            oo.gfx.strokeRect(bx, by, s, s);
          }
        oo.gfx.fillStyle(0x00ffff, 0.7);
        oo.gfx.fillRect(x + 4, y + 4, s * 2 - 8, 4);
        break;
      case 'retrieve_yarnball':
        oo.gfx.fillStyle(0xff00cc, 0.8);
        oo.gfx.fillRect(x + 8, y + 8, s - 16, s - 16);
        oo.gfx.lineStyle(2, 0xff44ff, 1);
        oo.gfx.strokeRect(x + 8, y + 8, s - 16, s - 16);
        oo.gfx.lineStyle(1.5, 0xffffff, 0.6);
        oo.gfx.strokeCircle(x + 16, y + 16, 5);
        oo.gfx.strokeCircle(x + 16, y + 16, 3);
        break;
      case 'rescue_bot':
        if (this.blinkVisible) {
          oo.gfx.fillStyle(0xffff00, 0.85);
          oo.gfx.fillRect(x + 6, y + 6, s - 12, s - 12);
          oo.gfx.lineStyle(2, 0xffee44, 1);
          oo.gfx.strokeRect(x + 6, y + 6, s - 12, s - 12);
        }
        if (oo.secondary) {
          oo.secondary.gfx.clear();
          oo.secondary.gfx.fillStyle(0x00ff88, 0.35);
          oo.secondary.gfx.fillRect(oo.secondary.worldX, oo.secondary.worldY, s, s);
          oo.secondary.gfx.lineStyle(2, 0x00ff88, 0.9);
          oo.secondary.gfx.strokeRect(oo.secondary.worldX, oo.secondary.worldY, s, s);
        }
        break;
      case 'plant_listener':
        oo.gfx.fillStyle(0xcc0000, 0.85);
        oo.gfx.fillRect(x + 8, y + 8, s - 16, s - 16);
        oo.gfx.lineStyle(2, 0xff4444, 1);
        oo.gfx.strokeRect(x + 8, y + 8, s - 16, s - 16);
        oo.gfx.lineStyle(2, 0xff4444, 0.9);
        oo.gfx.beginPath();
        oo.gfx.moveTo(x + 16, y + 8);
        oo.gfx.lineTo(x + 16, y + 2);
        oo.gfx.strokePath();
        if ((oo.plantHoldMs ?? 0) > 0) {
          const prog = Math.min(1, (oo.plantHoldMs ?? 0) / 3000);
          oo.gfx.fillStyle(0xff4444, 0.9);
          oo.gfx.fillRect(x + 4, y + s - 8, (s - 8) * prog, 4);
        }
        break;
    }
  }

  update(
    catX: number,
    catY: number,
    eJustDown: boolean,
    eIsDown: boolean,
    delta: number
  ): { completedId: string | null; interaction: string | null } {
    this.blinkTimer += delta;
    if (this.blinkTimer > 400) {
      this.blinkTimer = 0;
      this.blinkVisible = !this.blinkVisible;
    }
    let completedId: string | null = null;
    let interaction: string | null = null;
    for (const oo of this.objects) {
      const obj = this.objectives.find((o) => o.id === oo.objectiveId);
      if (!obj || obj.completed) continue;
      const dist = Math.sqrt((catX - obj.targetX) ** 2 + (catY - obj.targetY) ** 2);
      const nearby = dist < TILE_SIZE * 1.8;
      switch (obj.type) {
        case 'steal_fish':
          if (nearby) {
            interaction = 'Walk over to steal fish  |  E: leave coins';
            if (dist < TILE_SIZE * 0.8) completedId = obj.id;
            if (eJustDown && !oo.coinsLeft) oo.coinsLeft = true;
          }
          break;
        case 'deliver_collar':
          if (!oo.collarPickedUp) {
            if (nearby) {
              interaction = 'E: pick up collar';
              if (eJustDown) {
                oo.collarPickedUp = true;
                this.drawObject(oo, obj);
              }
            }
          } else if (obj.targetX2 !== undefined && obj.targetY2 !== undefined) {
            const d2 = Math.sqrt((catX - obj.targetX2) ** 2 + (catY - obj.targetY2) ** 2);
            if (d2 < TILE_SIZE * 1.2) {
              interaction = 'E: deliver collar';
              if (eJustDown) completedId = obj.id;
            } else interaction = 'Deliver collar to beacon';
          }
          break;
        case 'hack_billboard':
          if (nearby) interaction = 'E: tail-hack billboard';
          break;
        case 'retrieve_yarnball':
          if (nearby) {
            interaction = 'Walk over to retrieve yarnball';
            if (dist < TILE_SIZE * 0.8) completedId = obj.id;
          }
          break;
        case 'rescue_bot':
          if (!oo.botFollowing) {
            if (nearby) {
              interaction = 'E: reboot bot';
              if (eJustDown) oo.botFollowing = true;
            }
          } else {
            const bx = oo.botX ?? obj.targetX;
            const by = oo.botY ?? obj.targetY;
            const bdx = catX - bx;
            const bdy = catY - by;
            const bdist = Math.sqrt(bdx * bdx + bdy * bdy);
            if (bdist > TILE_SIZE * 1.5) {
              const sp = (60 * delta) / 1000;
              oo.botX = bx + (bdx / bdist) * sp;
              oo.botY = by + (bdy / bdist) * sp;
            }
            if (obj.targetX2 !== undefined && obj.targetY2 !== undefined) {
              const sd = Math.sqrt(
                ((oo.botX ?? 0) - obj.targetX2) ** 2 + ((oo.botY ?? 0) - obj.targetY2) ** 2
              );
              if (sd < TILE_SIZE * 1.5) completedId = obj.id;
              else interaction = 'Escort bot to safe zone';
            }
            oo.gfx.clear();
            const bxd = (oo.botX ?? obj.targetX) - TILE_SIZE / 2;
            const byd = (oo.botY ?? obj.targetY) - TILE_SIZE / 2;
            if (this.blinkVisible) {
              oo.gfx.fillStyle(0xffff00, 0.85);
              oo.gfx.fillRect(bxd + 6, byd + 6, TILE_SIZE - 12, TILE_SIZE - 12);
              oo.gfx.lineStyle(2, 0xffee44, 1);
              oo.gfx.strokeRect(bxd + 6, byd + 6, TILE_SIZE - 12, TILE_SIZE - 12);
            }
          }
          break;
        case 'plant_listener':
          if (nearby) {
            if (eIsDown) {
              oo.plantHoldMs = (oo.plantHoldMs ?? 0) + delta;
              interaction = `Hold E to plant... ${Math.min(100, Math.round(((oo.plantHoldMs ?? 0) / 3000) * 100))}%`;
              if ((oo.plantHoldMs ?? 0) >= 3000) completedId = obj.id;
            } else {
              oo.plantHoldMs = Math.max(0, (oo.plantHoldMs ?? 0) - delta * 2);
              interaction = 'Hold E: plant listener (3s)';
            }
          }
          break;
      }
      if (obj.type !== 'rescue_bot' || !oo.botFollowing) this.drawObject(oo, obj);
      if (completedId) {
        this.finishObjective(completedId);
        break;
      }
    }
    return { completedId, interaction };
  }

  private finishObjective(id: string): void {
    const obj = this.objectives.find((o) => o.id === id);
    if (!obj || obj.completed) return;
    obj.completed = true;
    this.comboCount++;
    let scraps = obj.reward;
    let bonus = 0;
    if (this.comboCount > 1) {
      bonus = Math.floor(scraps * 0.5);
      scraps += bonus;
      this.comboBonusTotal += bonus;
    }
    this.patrolScraps += scraps;
    const oo = this.objects.find((o) => o.objectiveId === id);
    if (oo) {
      oo.gfx.clear();
      oo.secondary?.gfx.clear();
    }
    if (this.onObjectiveComplete) this.onObjectiveComplete(obj, scraps);
  }

  completeBillboardHack(): void {
    const obj = this.objectives.find((o) => o.type === 'hack_billboard' && !o.completed);
    if (obj) this.finishObjective(obj.id);
  }

  getBillboardObjective(): PatrolObjective | undefined {
    return this.objectives.find((o) => o.type === 'hack_billboard' && !o.completed);
  }

  destroyObjects(): void {
    for (const oo of this.objects) {
      oo.gfx.destroy();
      oo.secondary?.gfx.destroy();
    }
    this.objects = [];
  }

  getNearestObjective(catX: number, catY: number): { obj: PatrolObjective; dist: number } | null {
    let best: { obj: PatrolObjective; dist: number } | null = null;
    for (const obj of this.objectives) {
      if (obj.completed) continue;
      const dist = Math.sqrt((catX - obj.targetX) ** 2 + (catY - obj.targetY) ** 2);
      if (!best || dist < best.dist) best = { obj, dist };
    }
    return best;
  }
}

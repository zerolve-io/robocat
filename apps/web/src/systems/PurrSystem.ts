import Phaser from 'phaser';
import { Drone } from '../entities/Drone';
import { HUD_PURR_KEY } from '../scenes/HUDScene';

const PURR_RADIUS = 96; // ~3 tiles at 32px each
const PURR_DRAIN = 0.4; // energy per second while active
const PURR_RECHARGE = 0.25; // energy per second while inactive
const DRONE_SLOW_FACTOR = 0.5;
const DRONE_CONE_NARROW = 0.5; // multiplier for vision angle when purred

export { HUD_PURR_KEY };

export class PurrSystem {
  private scene: Phaser.Scene;
  private energy = 1.0; // 0–1
  private purring = false;
  private rings: Phaser.GameObjects.Graphics[] = [];
  private ringTimer = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(
    catX: number,
    catY: number,
    isHeld: boolean,
    drones: Drone[],
    delta: number,
    catSprite: Phaser.Physics.Arcade.Sprite
  ): void {
    const dt = delta / 1000;

    if (isHeld && this.energy > 0) {
      this.purring = true;
      this.energy = Math.max(0, this.energy - PURR_DRAIN * dt);
    } else {
      this.purring = false;
      this.energy = Math.min(1, this.energy + PURR_RECHARGE * dt);
    }

    // Apply drone slow / cone narrow
    for (const drone of drones) {
      const dx = drone.x - catX;
      const dy = drone.y - catY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (this.purring && dist <= PURR_RADIUS) {
        drone.setPurrAffected(true, DRONE_SLOW_FACTOR, DRONE_CONE_NARROW);
      } else {
        drone.setPurrAffected(false, 1, 1);
      }
    }

    // Cat pulse effect when purring
    if (this.purring) {
      const pulse = 1 + 0.08 * Math.sin(Date.now() * 0.01);
      catSprite.setScale(pulse);
      catSprite.setTint(0xaa88ff);
    } else {
      catSprite.setScale(1);
      catSprite.clearTint();
    }

    // Ring spawning
    if (this.purring) {
      this.ringTimer += delta;
      if (this.ringTimer > 300) {
        this.ringTimer = 0;
        this.spawnRing(catX, catY);
      }
    }

    // Update rings
    this.rings = this.rings.filter((ring) => {
      if (!ring.active) return false;
      const data = ring.getData('life') as number;
      const maxLife = ring.getData('maxLife') as number;
      const newLife = data - delta;
      if (newLife <= 0) {
        ring.destroy();
        return false;
      }
      ring.setData('life', newLife);
      const progress = 1 - newLife / maxLife;
      const r = PURR_RADIUS * progress;
      const alpha = (1 - progress) * 0.5;
      ring.clear();
      ring.lineStyle(2, 0x9966ff, alpha);
      ring.strokeCircle(catX, catY, r);
      return true;
    });

    // Emit energy to HUD
    this.scene.game.events.emit(HUD_PURR_KEY, this.energy);
  }

  private spawnRing(x: number, y: number): void {
    const ring = this.scene.add.graphics();
    ring.setDepth(5);
    ring.setData('life', 800);
    ring.setData('maxLife', 800);
    this.rings.push(ring);
    // Draw initial small ring
    ring.lineStyle(2, 0x9966ff, 0.5);
    ring.strokeCircle(x, y, 4);
  }

  get isPurring(): boolean {
    return this.purring;
  }

  get purrEnergy(): number {
    return this.energy;
  }

  destroy(): void {
    for (const r of this.rings) r.destroy();
    this.rings = [];
  }
}

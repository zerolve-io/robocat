import Phaser from 'phaser';
import { seedToPatrolConfig, PatrolConfig } from '@robocat/shared';

const DRONE_SIZE = 16;

export class Drone {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private visionCone!: Phaser.GameObjects.Graphics;
  private config: PatrolConfig;
  private patrolIndex = 0;

  // Vision parameters
  readonly visionRange: number;
  readonly visionAngle: number; // total angle in radians
  private facingAngle = 0; // radians, direction drone faces

  constructor(scene: Phaser.Scene, worldW: number, worldH: number) {
    this.config = seedToPatrolConfig('robocat-seed-001', worldW, worldH);
    this.visionRange = this.config.visionRange;
    this.visionAngle = this.config.visionAngle;

    // ── Create drone texture ─────────────────────────────────────────────
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0xff2244, 1);
    gfx.fillRect(0, 0, DRONE_SIZE, DRONE_SIZE);
    // Red blinking light (small)
    gfx.fillStyle(0xff8800, 1);
    gfx.fillRect(6, 6, 4, 4);
    gfx.generateTexture('drone', DRONE_SIZE, DRONE_SIZE);
    gfx.destroy();

    const startPt = this.config.points[0];
    this.sprite = scene.physics.add.sprite(startPt.x, startPt.y, 'drone');
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(false);

    // ── Vision cone graphics ─────────────────────────────────────────────
    this.visionCone = scene.add.graphics();
    this.visionCone.setDepth(7);

    this.drawVisionCone();
  }

  update(delta: number): void {
    const dt = delta / 1000;
    const target = this.config.points[this.patrolIndex];
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const speed = this.config.speed;
    if (dist < 4) {
      // Reached waypoint — move to next
      this.patrolIndex = (this.patrolIndex + 1) % this.config.points.length;
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(
        nx * speed,
        ny * speed
      );
      this.facingAngle = Math.atan2(ny, nx);
    }

    this.drawVisionCone();
  }

  private drawVisionCone(): void {
    this.visionCone.clear();

    const x = this.sprite.x;
    const y = this.sprite.y;

    // Semi-transparent yellow fill
    this.visionCone.fillStyle(0xffff00, 0.12);
    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);

    const halfAngle = this.visionAngle / 2;
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = this.facingAngle - halfAngle + t * this.visionAngle;
      this.visionCone.lineTo(
        x + Math.cos(angle) * this.visionRange,
        y + Math.sin(angle) * this.visionRange
      );
    }
    this.visionCone.closePath();
    this.visionCone.fillPath();

    // Yellow stroke for the cone edges
    this.visionCone.lineStyle(1.5, 0xffee00, 0.7);
    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);
    this.visionCone.lineTo(
      x + Math.cos(this.facingAngle - halfAngle) * this.visionRange,
      y + Math.sin(this.facingAngle - halfAngle) * this.visionRange
    );
    this.visionCone.strokePath();

    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);
    this.visionCone.lineTo(
      x + Math.cos(this.facingAngle + halfAngle) * this.visionRange,
      y + Math.sin(this.facingAngle + halfAngle) * this.visionRange
    );
    this.visionCone.strokePath();

    // Arc
    this.visionCone.beginPath();
    this.visionCone.arc(
      x, y,
      this.visionRange,
      this.facingAngle - halfAngle,
      this.facingAngle + halfAngle,
      false
    );
    this.visionCone.strokePath();
  }

  /**
   * Check whether a world-space point is inside this drone's vision cone.
   */
  isInVisionCone(px: number, py: number): boolean {
    const dx = px - this.sprite.x;
    const dy = py - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.visionRange) return false;

    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - this.facingAngle;
    // Normalise to [-π, π]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    return Math.abs(diff) <= this.visionAngle / 2;
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}

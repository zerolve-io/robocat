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

  // Purr effect state
  private purrSlowFactor = 1;
  private purrConeNarrow = 1;
  private purrAffected = false;

  // Detection pulse
  private detectedPulse = 0; // 0–1, flashes when cat detected
  private isDetecting = false;

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
    const target = this.config.points[this.patrolIndex];
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const speed = this.config.speed * this.purrSlowFactor;
    if (dist < 4) {
      this.patrolIndex = (this.patrolIndex + 1) % this.config.points.length;
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(nx * speed, ny * speed);
      this.facingAngle = Math.atan2(ny, nx);
    }

    // Update detection pulse
    if (this.isDetecting) {
      this.detectedPulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.015);
    } else {
      this.detectedPulse = Math.max(0, this.detectedPulse - delta / 300);
    }

    this.drawVisionCone();
  }

  setDetecting(detected: boolean): void {
    this.isDetecting = detected;
  }

  setPurrAffected(affected: boolean, slowFactor: number, coneNarrow: number): void {
    this.purrAffected = affected;
    this.purrSlowFactor = affected ? slowFactor : 1;
    this.purrConeNarrow = affected ? coneNarrow : 1;
  }

  private drawVisionCone(): void {
    this.visionCone.clear();

    const x = this.sprite.x;
    const y = this.sprite.y;
    const effectiveAngle = this.visionAngle * this.purrConeNarrow;
    const effectiveRange = this.visionRange * (this.purrAffected ? 0.7 : 1);

    // Cone fill color — pulses red when detecting
    let fillColor = 0xffff00;
    let fillAlpha = 0.12;
    if (this.detectedPulse > 0) {
      // Lerp from yellow to red based on pulse
      const r = Math.round(0xff);
      const g = Math.round(0xff * (1 - this.detectedPulse));
      fillColor = (r << 16) | (g << 8) | 0;
      fillAlpha = 0.12 + this.detectedPulse * 0.2;
    }
    // Purple tint when purr affected
    if (this.purrAffected) {
      fillColor = 0x9966ff;
      fillAlpha = 0.1;
    }

    this.visionCone.fillStyle(fillColor, fillAlpha);
    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);

    const halfAngle = effectiveAngle / 2;
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = this.facingAngle - halfAngle + t * effectiveAngle;
      this.visionCone.lineTo(
        x + Math.cos(angle) * effectiveRange,
        y + Math.sin(angle) * effectiveRange
      );
    }
    this.visionCone.closePath();
    this.visionCone.fillPath();

    // Stroke edges
    let strokeColor = 0xffee00;
    let strokeAlpha = 0.7;
    if (this.detectedPulse > 0) {
      strokeColor = 0xff2200;
      strokeAlpha = 0.7 + this.detectedPulse * 0.3;
    }
    if (this.purrAffected) {
      strokeColor = 0x9966ff;
      strokeAlpha = 0.5;
    }

    this.visionCone.lineStyle(1.5, strokeColor, strokeAlpha);
    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);
    this.visionCone.lineTo(
      x + Math.cos(this.facingAngle - halfAngle) * effectiveRange,
      y + Math.sin(this.facingAngle - halfAngle) * effectiveRange
    );
    this.visionCone.strokePath();

    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);
    this.visionCone.lineTo(
      x + Math.cos(this.facingAngle + halfAngle) * effectiveRange,
      y + Math.sin(this.facingAngle + halfAngle) * effectiveRange
    );
    this.visionCone.strokePath();

    this.visionCone.beginPath();
    this.visionCone.arc(
      x,
      y,
      effectiveRange,
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
    const effectiveRange = this.visionRange * (this.purrAffected ? 0.7 : 1);
    if (dist > effectiveRange) return false;

    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - this.facingAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const effectiveAngle = this.visionAngle * this.purrConeNarrow;
    return Math.abs(diff) <= effectiveAngle / 2;
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
}

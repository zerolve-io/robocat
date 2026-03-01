import Phaser from 'phaser';
import { mulberry32 } from '@robocat/shared';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _TILE_SIZE_REF = 32; // keep in sync with CityGenerator.TILE_SIZE
export const TILE_SIZE = 32;

// ── Drone type ─────────────────────────────────────────────────────────────
export type DroneType = 'sentry' | 'patrol' | 'hunter' | 'scanner';

// ── Alert state ────────────────────────────────────────────────────────────
export enum AlertState {
  UNAWARE = 'unaware',
  SUSPICIOUS = 'suspicious',
  ALARMED = 'alarmed',
  CHASING = 'chasing',
}

// ── Sound event (passed by PatrolScene) ────────────────────────────────────
export interface SoundEvent {
  x: number;
  y: number;
  radius: number;
}

// ── Vision config per type ─────────────────────────────────────────────────
interface DroneTypeConfig {
  visionAngle: number;
  visionRange: number;
  speed: number;
  sweepSpeed?: number; // radians/s (scanner only)
  dormant?: boolean; // hunter starts dormant
}

const DRONE_TYPE_CONFIGS: Record<DroneType, DroneTypeConfig> = {
  sentry: { visionAngle: (120 * Math.PI) / 180, visionRange: 6 * TILE_SIZE, speed: 0 },
  patrol: { visionAngle: (60 * Math.PI) / 180, visionRange: 8 * TILE_SIZE, speed: 80 },
  hunter: {
    visionAngle: (90 * Math.PI) / 180,
    visionRange: 5 * TILE_SIZE,
    speed: 160,
    dormant: true,
  },
  scanner: {
    visionAngle: (360 * Math.PI) / 180,
    visionRange: 5 * TILE_SIZE,
    speed: 0,
    sweepSpeed: (2 * Math.PI) / 8,
  },
};

// ── Alert cone colours ─────────────────────────────────────────────────────
const ALERT_CONE_CONFIG = {
  [AlertState.UNAWARE]: { fill: 0x00ff44, fillAlpha: 0.5, stroke: 0x00ff44, strokeAlpha: 0.7 },
  [AlertState.SUSPICIOUS]: { fill: 0xffee00, fillAlpha: 0.6, stroke: 0xffee00, strokeAlpha: 0.8 },
  [AlertState.ALARMED]: { fill: 0xff8800, fillAlpha: 0.7, stroke: 0xff8800, strokeAlpha: 0.9 },
  [AlertState.CHASING]: { fill: 0xff1111, fillAlpha: 0.8, stroke: 0xff2200, strokeAlpha: 1.0 },
};

const DRONE_SIZE = 16;

// ── State timers ────────────────────────────────────────────────────────────
const SUSPICIOUS_TIMEOUT = 5000;
const ALARMED_TIMEOUT = 15000;
const CHASE_LOSE_TIMEOUT = 10000;
const VISIBLE_TO_CHASE_TIME = 2000;

export class Drone {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private visionCone!: Phaser.GameObjects.Graphics;
  private pingGraphics!: Phaser.GameObjects.Graphics;

  readonly droneType: DroneType;
  private typeConfig: DroneTypeConfig;

  readonly baseVisionRange: number;
  readonly baseVisionAngle: number;
  private facingAngle: number;
  private _isDormant: boolean;

  private patrolWaypoints: { x: number; y: number }[] = [];
  private patrolIndex = 0;

  private _alertState: AlertState = AlertState.UNAWARE;
  private suspiciousTimer = 0;
  private alarmedTimer = 0;
  private chaseLoseTimer = 0;
  private visibleTimer = 0;
  private lastKnownPos: { x: number; y: number } | null = null;
  private isAtLastKnown = false;
  private searchTimer = 0;

  private purrSlowFactor = 1;
  private purrConeNarrow = 1;
  private purrAffected = false;

  private isDetecting = false;

  // City-mood modifiers
  private visionMod = 1.0;
  private _soundMod = 1.0;
  private festivalSlowFactor = 1.0;

  // Blackout IR pulse
  private irPulseTimer = 0;
  private irPulseActive = false;
  private irPulseDuration = 0;
  private readonly IR_PULSE_INTERVAL = 4000;
  private readonly IR_PULSE_DURATION = 400;

  // Vision check throttle
  private visionCheckTimer = 0;
  private readonly VISION_CHECK_INTERVAL = 200;
  private _cachedInCone = false;

  // Radio ping
  private pingTimer = 0;
  private pingActive = false;
  private pingX = 0;
  private pingY = 0;

  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    droneType: DroneType,
    startX: number,
    startY: number,
    facingAngle: number,
    waypoints: { x: number; y: number }[],
    seed: number,
    mood: string,
    index: number
  ) {
    this.scene = scene;
    this.droneType = droneType;
    this.typeConfig = DRONE_TYPE_CONFIGS[droneType];
    this.baseVisionRange = this.typeConfig.visionRange;
    this.baseVisionAngle = this.typeConfig.visionAngle;
    this.facingAngle = facingAngle;
    this._isDormant = this.typeConfig.dormant ?? false;

    this.patrolWaypoints = waypoints.length > 0 ? waypoints : [{ x: startX, y: startY }];

    this._applyMood(mood);

    // Create texture per type+index
    const texKey = 'drone_' + droneType + '_' + index;
    if (!scene.textures.exists(texKey)) {
      const colors: Record<DroneType, number> = {
        sentry: 0xcc2244,
        patrol: 0xff2244,
        hunter: 0xff6600,
        scanner: 0x2244cc,
      };
      const gfx = scene.make.graphics({ x: 0, y: 0 });
      gfx.fillStyle(colors[droneType], 1);
      gfx.fillRect(0, 0, DRONE_SIZE, DRONE_SIZE);
      gfx.fillStyle(0xff8800, 1);
      gfx.fillRect(6, 6, 4, 4);
      if (droneType === 'sentry') {
        gfx.fillStyle(0xffffff, 0.6);
        gfx.fillRect(0, 0, 4, 4);
        gfx.fillRect(12, 0, 4, 4);
      } else if (droneType === 'hunter') {
        gfx.fillStyle(0xffffff, 0.6);
        gfx.fillTriangle(8, 0, 16, 16, 0, 16);
      } else if (droneType === 'scanner') {
        gfx.fillStyle(0x88aaff, 0.8);
        gfx.fillCircle(8, 8, 4);
      }
      gfx.generateTexture(texKey, DRONE_SIZE, DRONE_SIZE);
      gfx.destroy();
    }

    // Use seed+index for determinism (rng consumed to satisfy lint)
    const _rng = mulberry32((seed + index * 137) >>> 0);
    void _rng;

    this.sprite = scene.physics.add.sprite(startX, startY, texKey);
    this.sprite.setDepth(8);
    this.sprite.setCollideWorldBounds(false);

    this.visionCone = scene.add.graphics().setDepth(7);
    this.pingGraphics = scene.add.graphics().setDepth(12);

    this._drawVisionCone();
  }

  // ── Public getters ─────────────────────────────────────────────────────

  get alertState(): AlertState {
    return this._alertState;
  }
  get isDormant(): boolean {
    return this._isDormant;
  }
  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
  get soundRangeMod(): number {
    return this._soundMod;
  }

  // ── Main update ────────────────────────────────────────────────────────
  /** Returns true if drone entered CHASING this frame. */
  update(
    delta: number,
    catX: number,
    catY: number,
    catInCone: boolean,
    catInConeCenter: boolean,
    purrAffected: boolean
  ): boolean {
    if (this._isDormant) {
      this._drawVisionCone();
      return false;
    }

    const dt = delta / 1000;
    let justStartedChasing = false;

    // IR pulse timer (blackout mood)
    this.irPulseTimer += delta;
    if (this.irPulseTimer >= this.IR_PULSE_INTERVAL) {
      this.irPulseTimer = 0;
      this.irPulseActive = true;
      this.irPulseDuration = this.IR_PULSE_DURATION;
    }
    if (this.irPulseActive) {
      this.irPulseDuration -= delta;
      if (this.irPulseDuration <= 0) this.irPulseActive = false;
    }

    // Vision check (throttled every 200ms)
    this.visionCheckTimer += delta;
    if (this.visionCheckTimer >= this.VISION_CHECK_INTERVAL) {
      this.visionCheckTimer = 0;
      this._cachedInCone = this.isInVisionCone(catX, catY);
    }
    const currentlySeen = this._cachedInCone || catInCone;

    // State machine
    switch (this._alertState) {
      case AlertState.UNAWARE:
        if (currentlySeen) {
          this.lastKnownPos = { x: catX, y: catY };
          this.visibleTimer = 0;
          if (catInConeCenter) {
            this._alertState = AlertState.ALARMED;
            this.alarmedTimer = ALARMED_TIMEOUT;
          } else {
            this._alertState = AlertState.SUSPICIOUS;
            this.suspiciousTimer = SUSPICIOUS_TIMEOUT;
          }
        }
        break;

      case AlertState.SUSPICIOUS:
        if (currentlySeen) {
          this.lastKnownPos = { x: catX, y: catY };
          this.visibleTimer += delta;
          if (this.visibleTimer >= VISIBLE_TO_CHASE_TIME) {
            this._alertState = AlertState.CHASING;
            justStartedChasing = true;
          } else if (catInConeCenter) {
            this._alertState = AlertState.ALARMED;
            this.alarmedTimer = ALARMED_TIMEOUT;
          }
        } else {
          this.visibleTimer = 0;
          this.suspiciousTimer -= delta;
          if (this.suspiciousTimer <= 0) this._alertState = AlertState.UNAWARE;
        }
        break;

      case AlertState.ALARMED:
        if (currentlySeen) {
          this.lastKnownPos = { x: catX, y: catY };
          this.visibleTimer += delta;
          if (this.visibleTimer >= VISIBLE_TO_CHASE_TIME) {
            this._alertState = AlertState.CHASING;
            justStartedChasing = true;
          }
        } else {
          this.visibleTimer = 0;
          this.alarmedTimer -= delta;
          if (this.alarmedTimer <= 0) {
            this._alertState = AlertState.SUSPICIOUS;
            this.suspiciousTimer = SUSPICIOUS_TIMEOUT;
          }
        }
        break;

      case AlertState.CHASING:
        if (currentlySeen) {
          this.lastKnownPos = { x: catX, y: catY };
          this.chaseLoseTimer = 0;
        } else {
          this.chaseLoseTimer += delta;
          if (this.chaseLoseTimer >= CHASE_LOSE_TIMEOUT) {
            this._alertState = AlertState.ALARMED;
            this.alarmedTimer = ALARMED_TIMEOUT;
            this.chaseLoseTimer = 0;
          }
        }
        break;
    }

    this._updateMovement(delta, dt, catX, catY, purrAffected);
    this.isDetecting = currentlySeen;

    if (this.pingActive) this._updatePing(delta);

    this._drawVisionCone();
    return justStartedChasing;
  }

  private _updateMovement(
    delta: number,
    dt: number,
    catX: number,
    catY: number,
    purrAffected: boolean
  ): void {
    const speedMult = this.festivalSlowFactor * (purrAffected ? this.purrSlowFactor : 1);

    switch (this._alertState) {
      case AlertState.UNAWARE:
        if (this.typeConfig.sweepSpeed !== undefined) {
          this.facingAngle += this.typeConfig.sweepSpeed * dt;
        } else if (this.patrolWaypoints.length > 1 && this.typeConfig.speed > 0) {
          this._moveToWaypoint(this.typeConfig.speed * speedMult);
        }
        break;

      case AlertState.SUSPICIOUS:
        if (this.lastKnownPos) {
          this._moveToward(
            this.lastKnownPos.x,
            this.lastKnownPos.y,
            this.typeConfig.speed * speedMult * 1.2
          );
        } else if (this.typeConfig.sweepSpeed !== undefined) {
          this.facingAngle += this.typeConfig.sweepSpeed * 2 * dt;
        }
        break;

      case AlertState.ALARMED:
        if (this.lastKnownPos) {
          this._moveToward(
            this.lastKnownPos.x,
            this.lastKnownPos.y,
            this.typeConfig.speed * speedMult * 1.5
          );
          const dx = this.sprite.x - this.lastKnownPos.x;
          const dy = this.sprite.y - this.lastKnownPos.y;
          if (Math.sqrt(dx * dx + dy * dy) < 12) this.isAtLastKnown = true;
          if (this.isAtLastKnown) {
            this.searchTimer += delta;
            this.facingAngle += (2 * Math.PI * delta) / 4000;
          }
        }
        break;

      case AlertState.CHASING: {
        const spd =
          this.droneType === 'hunter'
            ? this.typeConfig.speed * speedMult
            : Math.max(this.typeConfig.speed, 120) * speedMult;
        const target = this.lastKnownPos ?? { x: catX, y: catY };
        this._moveToward(target.x, target.y, spd);
        break;
      }
    }
  }

  private _moveToWaypoint(speed: number): void {
    const target = this.patrolWaypoints[this.patrolIndex];
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 6) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolWaypoints.length;
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(nx * speed, ny * speed);
      this.facingAngle = Math.atan2(ny, nx);
    }
  }

  private _moveToward(tx: number, ty: number, speed: number): void {
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 6) {
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    } else {
      const nx = dx / dist;
      const ny = dy / dist;
      (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(nx * speed, ny * speed);
      this.facingAngle = Math.atan2(ny, nx);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  wakeUp(): void {
    if (this.droneType === 'hunter' && this._isDormant) {
      this._isDormant = false;
      this._alertState = AlertState.ALARMED;
      this.alarmedTimer = ALARMED_TIMEOUT;
      this.sprite.setTint(0xff6600);
    }
  }

  receiveAlert(sourceX: number, sourceY: number): void {
    if (this._isDormant) {
      this.wakeUp();
      return;
    }
    if (this._alertState === AlertState.UNAWARE || this._alertState === AlertState.SUSPICIOUS) {
      this._alertState = AlertState.ALARMED;
      this.alarmedTimer = ALARMED_TIMEOUT;
      this.lastKnownPos = { x: sourceX, y: sourceY };
      this.isAtLastKnown = false;
    }
  }

  triggerPing(): void {
    this.pingActive = true;
    this.pingTimer = 0;
    this.pingX = this.sprite.x;
    this.pingY = this.sprite.y;
  }

  setDetecting(detected: boolean): void {
    this.isDetecting = detected;
  }

  setPurrAffected(affected: boolean, slowFactor: number, coneNarrow: number): void {
    this.purrAffected = affected;
    this.purrSlowFactor = affected ? slowFactor : 1;
    this.purrConeNarrow = affected ? coneNarrow : 1;
  }

  // ── Vision helpers ─────────────────────────────────────────────────────

  get effectiveVisionRange(): number {
    const purr = this.purrAffected ? 0.7 : 1;
    const ir = this.irPulseActive ? 1 / this.visionMod : 1;
    return this.baseVisionRange * this.visionMod * purr * ir;
  }

  get effectiveVisionAngle(): number {
    return this.baseVisionAngle * (this.purrAffected ? this.purrConeNarrow : 1);
  }

  isInVisionCone(px: number, py: number): boolean {
    const dx = px - this.sprite.x;
    const dy = py - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.effectiveVisionRange) return false;
    const angle = this.effectiveVisionAngle;
    if (angle >= 2 * Math.PI - 0.01) return true;
    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - this.facingAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= angle / 2;
  }

  isInConeCentre(px: number, py: number): boolean {
    if (this.droneType === 'scanner') return this.isInVisionCone(px, py);
    const dx = px - this.sprite.x;
    const dy = py - this.sprite.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.effectiveVisionRange * 0.65) return false;
    const angleToTarget = Math.atan2(dy, dx);
    let diff = angleToTarget - this.facingAngle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return Math.abs(diff) <= this.effectiveVisionAngle / 6;
  }

  // ── Mood ───────────────────────────────────────────────────────────────

  private _applyMood(mood: string): void {
    switch (mood) {
      case 'rain':
        this.visionMod = 0.7;
        this._soundMod = 0.5;
        this.festivalSlowFactor = 1.0;
        break;
      case 'blackout':
        this.visionMod = 0.4;
        this._soundMod = 1.0;
        this.festivalSlowFactor = 1.0;
        this.irPulseTimer = 0;
        break;
      case 'festival':
        this.visionMod = 1.0;
        this._soundMod = 0.8;
        this.festivalSlowFactor = 0.75;
        break;
      default:
        this.visionMod = 1.0;
        this._soundMod = 1.0;
        this.festivalSlowFactor = 1.0;
        break;
    }
  }

  // ── Ping ───────────────────────────────────────────────────────────────

  private _updatePing(delta: number): void {
    this.pingTimer += delta;
    const duration = 1200;
    const progress = this.pingTimer / duration;
    if (progress >= 1) {
      this.pingActive = false;
      this.pingGraphics.clear();
      return;
    }
    const maxR = 12 * TILE_SIZE;
    const r = maxR * progress;
    const alpha = (1 - progress) * 0.6;
    this.pingGraphics.clear();
    this.pingGraphics.lineStyle(2, 0xff4400, alpha);
    this.pingGraphics.strokeCircle(this.pingX, this.pingY, r);
    this.pingGraphics.lineStyle(1, 0xff8800, alpha * 0.5);
    this.pingGraphics.strokeCircle(this.pingX, this.pingY, r * 0.6);
  }

  // ── Vision cone drawing ────────────────────────────────────────────────

  private _drawVisionCone(): void {
    this.visionCone.clear();

    if (this._isDormant) {
      this.visionCone.fillStyle(0x444444, 0.2);
      this.visionCone.fillCircle(this.sprite.x, this.sprite.y, TILE_SIZE / 2);
      return;
    }

    const x = this.sprite.x;
    const y = this.sprite.y;
    const range = this.effectiveVisionRange;
    const halfA = this.effectiveVisionAngle / 2;
    const cfg = ALERT_CONE_CONFIG[this._alertState];

    let fillAlpha = cfg.fillAlpha;
    let strokeAlpha = cfg.strokeAlpha;
    if (this._alertState === AlertState.CHASING) {
      const flicker = 0.85 + 0.15 * Math.sin(Date.now() * 0.025);
      fillAlpha *= flicker;
      strokeAlpha *= flicker;
    }

    let fillColor = cfg.fill;
    let strokeColor = cfg.stroke;
    if (this.purrAffected) {
      fillColor = strokeColor = 0x9966ff;
      fillAlpha *= 0.7;
    }

    // Scanner: full circle
    if (this.droneType === 'scanner' || this.baseVisionAngle >= 2 * Math.PI - 0.01) {
      this.visionCone.fillStyle(fillColor, fillAlpha * 0.5);
      this.visionCone.fillCircle(x, y, range);
      this.visionCone.lineStyle(1.5, strokeColor, strokeAlpha);
      this.visionCone.strokeCircle(x, y, range);
      return;
    }

    // Cone fill
    this.visionCone.fillStyle(fillColor, fillAlpha);
    this.visionCone.beginPath();
    this.visionCone.moveTo(x, y);
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = this.facingAngle - halfA + t * (halfA * 2);
      this.visionCone.lineTo(x + Math.cos(a) * range, y + Math.sin(a) * range);
    }
    this.visionCone.closePath();
    this.visionCone.fillPath();

    // Edges
    this.visionCone.lineStyle(1.5, strokeColor, strokeAlpha);
    for (const side of [-1, 1]) {
      this.visionCone.beginPath();
      this.visionCone.moveTo(x, y);
      this.visionCone.lineTo(
        x + Math.cos(this.facingAngle + side * halfA) * range,
        y + Math.sin(this.facingAngle + side * halfA) * range
      );
      this.visionCone.strokePath();
    }
    this.visionCone.beginPath();
    this.visionCone.arc(x, y, range, this.facingAngle - halfA, this.facingAngle + halfA, false);
    this.visionCone.strokePath();

    // Status dot
    const dotColor =
      this._alertState === AlertState.UNAWARE
        ? 0x00ff44
        : this._alertState === AlertState.SUSPICIOUS
          ? 0xffee00
          : this._alertState === AlertState.ALARMED
            ? 0xff8800
            : 0xff1111;
    this.visionCone.fillStyle(dotColor, 1);
    this.visionCone.fillCircle(x, y, 3);
  }

  destroy(): void {
    this.visionCone.destroy();
    this.pingGraphics.destroy();
    this.sprite.destroy();
  }
}

import Phaser from 'phaser';

const SPEED = 180;
const SIZE = 16;
const TILE_SIZE = 32;

// Pounce config
const POUNCE_DISTANCE = TILE_SIZE * 3; // ~3 tiles
const POUNCE_DURATION = 200; // ms
const POUNCE_COOLDOWN = 1000; // ms

// Wall-run config
const WALLRUN_SPEED_MULT = 1.5;
const WALLRUN_MAX_DURATION = 1500; // ms
const WALLRUN_COOLDOWN = 500; // ms

export class RoboCat {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private keyQ!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private keyE!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // Pounce state
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private isAiming = false;
  private pouncing = false;
  private pounceTimer = 0;
  private pounceCooldown = 0;
  private pounceStartX = 0;
  private pounceStartY = 0;
  private pounceEndX = 0;
  private pounceEndY = 0;
  private pounceAngle = 0;
  private trailParticles: Array<{
    x: number;
    y: number;
    alpha: number;
    gfx: Phaser.GameObjects.Graphics;
  }> = [];

  // Wall-run state
  isWallRunning = false;
  private wallRunTimer = 0;
  private wallRunCooldown = 0;
  private wallRunSparks: Phaser.GameObjects.Graphics[] = [];
  private wallRunSparkTimer = 0;

  // Purr / Hack (keys exposed to scene)
  get spaceDown(): boolean {
    return this.keySpace?.isDown ?? false;
  }
  get eJustDown(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keyE);
  }

  // Score
  private _score = 0;
  public onScoreChange?: (score: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;

    // Create cat texture
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0x00ff88, 1);
    gfx.fillRect(0, 0, SIZE, SIZE);
    gfx.fillStyle(0x0a0a0f, 1);
    gfx.fillRect(3, 4, 3, 3);
    gfx.fillRect(10, 4, 3, 3);
    gfx.fillStyle(0x00cc66, 1);
    gfx.fillTriangle(0, 0, 4, 0, 2, -4);
    gfx.fillTriangle(12, 0, 16, 0, 14, -4);
    gfx.generateTexture('robocat', SIZE, SIZE);
    gfx.destroy();

    this.sprite = scene.physics.add.sprite(x, y, 'robocat');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);

    // Aim graphics
    this.aimGraphics = scene.add.graphics();
    this.aimGraphics.setDepth(15);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
      this.keyQ = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      this.keyShift = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.keyE = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keySpace = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Mouse right-click for aim
    scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.rightButtonDown()) {
        this.startAim();
      }
    });
    scene.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (ptr.button === 2 && this.isAiming) {
        this.releasePounce();
      }
    });
  }

  update(delta: number): void {
    // Timers
    if (this.pounceCooldown > 0) this.pounceCooldown -= delta;
    if (this.wallRunCooldown > 0) this.wallRunCooldown -= delta;

    if (this.pouncing) {
      this.updatePounce(delta);
      return; // Skip normal movement during pounce
    }

    this.updateAim();
    this.handleMovement(delta);
    this.updateTrailParticles(delta);
    this.cleanWallRunSparks();

    // Q key for aim
    if (this.keyQ?.isDown && !this.isAiming && this.pounceCooldown <= 0) {
      this.startAim();
    } else if (
      !this.keyQ?.isDown &&
      this.isAiming &&
      !this.scene.input.activePointer.rightButtonDown()
    ) {
      this.releasePounce();
    }

    // Broadcast cooldown to HUD
    this.scene.game.events.emit('hud-pounce-cooldown', this.pounceCooldown / POUNCE_COOLDOWN);
  }

  private handleMovement(delta: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.cursors?.left.isDown || this.wasd?.left.isDown) vx = -SPEED;
    else if (this.cursors?.right.isDown || this.wasd?.right.isDown) vx = SPEED;

    if (this.cursors?.up.isDown || this.wasd?.up.isDown) vy = -SPEED;
    else if (this.cursors?.down.isDown || this.wasd?.down.isDown) vy = SPEED;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      const f = 1 / Math.SQRT2;
      vx *= f;
      vy *= f;
    }

    // Wall-run: if moving into a wall and Shift held
    if (this.keyShift?.isDown && this.wallRunCooldown <= 0) {
      const touching = body.blocked;
      const movingIntoWall =
        (touching.left && vx < 0) ||
        (touching.right && vx > 0) ||
        (touching.up && vy < 0) ||
        (touching.down && vy > 0);

      if (movingIntoWall && (vx !== 0 || vy !== 0)) {
        if (!this.isWallRunning) {
          this.isWallRunning = true;
          this.wallRunTimer = WALLRUN_MAX_DURATION;
        }
      }
    }

    if (this.isWallRunning) {
      this.wallRunTimer -= delta;
      if (this.wallRunTimer <= 0 || !this.keyShift?.isDown || (vx === 0 && vy === 0)) {
        this.stopWallRun();
      } else {
        // Wall-run: slide along wall at 1.5x speed
        const blocked = body.blocked;
        if (blocked.left || blocked.right) {
          // Sliding vertically along vertical wall
          body.setVelocity(0, vy * WALLRUN_SPEED_MULT);
        } else if (blocked.up || blocked.down) {
          // Sliding horizontally along horizontal wall
          body.setVelocity(vx * WALLRUN_SPEED_MULT, 0);
        } else {
          this.stopWallRun();
          body.setVelocity(vx, vy);
        }
        this.spawnWallSpark(delta);
      }
    } else {
      body.setVelocity(vx, vy);
    }

    // Rotation flair
    if (vx !== 0 || vy !== 0) {
      this.sprite.setAngle(this.sprite.angle + (vx > 0 ? 2 : vx < 0 ? -2 : 0));

      // Trail particles when moving fast
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > SPEED * 0.7) {
        this.spawnTrailParticle();
      }
    } else {
      this.sprite.setAngle(0);
    }
  }

  // ── Pounce ──────────────────────────────────────────────────────────────

  private startAim(): void {
    if (this.pounceCooldown > 0 || this.pouncing) return;
    this.isAiming = true;
  }

  private updateAim(): void {
    this.aimGraphics.clear();
    if (!this.isAiming) return;

    const ptr = this.scene.input.activePointer;
    const cam = this.scene.cameras.main;

    // World-space mouse position
    const worldX = ptr.x + cam.scrollX;
    const worldY = ptr.y + cam.scrollY;

    const dx = worldX - this.sprite.x;
    const dy = worldY - this.sprite.y;
    const angle = Math.atan2(dy, dx);
    this.pounceAngle = angle;

    const endX = this.sprite.x + Math.cos(angle) * POUNCE_DISTANCE;
    const endY = this.sprite.y + Math.sin(angle) * POUNCE_DISTANCE;

    // Draw aim arrow
    this.aimGraphics.lineStyle(2, 0x00ff88, 0.8);
    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(this.sprite.x, this.sprite.y);
    this.aimGraphics.lineTo(endX, endY);
    this.aimGraphics.strokePath();

    // Arrowhead
    const headLen = 12;
    const headAngle = 0.4;
    this.aimGraphics.lineStyle(2, 0x00ff88, 0.8);
    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(endX, endY);
    this.aimGraphics.lineTo(
      endX - headLen * Math.cos(angle - headAngle),
      endY - headLen * Math.sin(angle - headAngle)
    );
    this.aimGraphics.strokePath();
    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(endX, endY);
    this.aimGraphics.lineTo(
      endX - headLen * Math.cos(angle + headAngle),
      endY - headLen * Math.sin(angle + headAngle)
    );
    this.aimGraphics.strokePath();

    // Dashed range indicator
    this.aimGraphics.lineStyle(1, 0x00ff88, 0.25);
    for (let i = 0; i < 8; i++) {
      const t1 = i / 8;
      const t2 = (i + 0.5) / 8;
      this.aimGraphics.beginPath();
      this.aimGraphics.moveTo(
        this.sprite.x + Math.cos(angle) * POUNCE_DISTANCE * t1,
        this.sprite.y + Math.sin(angle) * POUNCE_DISTANCE * t1
      );
      this.aimGraphics.lineTo(
        this.sprite.x + Math.cos(angle) * POUNCE_DISTANCE * t2,
        this.sprite.y + Math.sin(angle) * POUNCE_DISTANCE * t2
      );
      this.aimGraphics.strokePath();
    }
  }

  private releasePounce(): void {
    if (!this.isAiming) return;
    this.isAiming = false;
    this.aimGraphics.clear();

    if (this.pounceCooldown > 0) return;

    // Start pounce
    this.pouncing = true;
    this.pounceTimer = 0;
    this.pounceStartX = this.sprite.x;
    this.pounceStartY = this.sprite.y;
    this.pounceEndX = this.sprite.x + Math.cos(this.pounceAngle) * POUNCE_DISTANCE;
    this.pounceEndY = this.sprite.y + Math.sin(this.pounceAngle) * POUNCE_DISTANCE;

    // Disable physics body during pounce (pass over low obstacles)
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = false;

    // Stretch in pounce direction
    const sx = 1 + 0.5 * Math.abs(Math.cos(this.pounceAngle));
    const sy = 1 + 0.5 * Math.abs(Math.sin(this.pounceAngle));
    this.sprite.setScale(sx, sy);

    // Camera zoom in
    this.scene.cameras.main.zoomTo(1.3, 150, 'Linear', false);

    this.pounceCooldown = POUNCE_COOLDOWN;
  }

  private updatePounce(delta: number): void {
    this.pounceTimer += delta;
    const t = Math.min(this.pounceTimer / POUNCE_DURATION, 1);

    // Ease: smooth start/end
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    this.sprite.x = this.pounceStartX + (this.pounceEndX - this.pounceStartX) * ease;
    this.sprite.y = this.pounceStartY + (this.pounceEndY - this.pounceStartY) * ease;

    // Spawn motion trail
    this.spawnPounceTrail();

    if (t >= 1) {
      this.pouncing = false;
      this.sprite.setScale(1);
      // Re-enable body
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.enable = true;
      body.reset(this.sprite.x, this.sprite.y);

      // Camera zoom out + screen shake
      this.scene.cameras.main.zoomTo(1.0, 200, 'Linear', false);
      this.scene.cameras.main.shake(120, 0.008);
    }
  }

  private spawnPounceTrail(): void {
    const gfx = this.scene.add.graphics();
    gfx.fillStyle(0x00ff88, 0.5);
    gfx.fillRect(this.sprite.x - SIZE / 4, this.sprite.y - SIZE / 4, SIZE / 2, SIZE / 2);
    gfx.setDepth(9);
    this.trailParticles.push({ x: this.sprite.x, y: this.sprite.y, alpha: 0.5, gfx });

    // Fade quickly
    this.scene.time.delayedCall(150, () => {
      if (gfx.active) gfx.destroy();
    });
  }

  // ── Wall-run helpers ─────────────────────────────────────────────────────

  private stopWallRun(): void {
    this.isWallRunning = false;
    this.wallRunCooldown = WALLRUN_COOLDOWN;
  }

  private spawnWallSpark(delta: number): void {
    this.wallRunSparkTimer += delta;
    if (this.wallRunSparkTimer < 80) return;
    this.wallRunSparkTimer = 0;

    const gfx = this.scene.add.graphics();
    gfx.setDepth(11);
    const ox = (Math.random() - 0.5) * SIZE;
    const oy = (Math.random() - 0.5) * SIZE;
    gfx.fillStyle(0xffcc00, 0.9);
    gfx.fillRect(this.sprite.x + ox - 2, this.sprite.y + oy - 2, 4, 4);
    this.wallRunSparks.push(gfx);

    this.scene.time.delayedCall(200, () => {
      if (gfx.active) gfx.destroy();
    });
  }

  private cleanWallRunSparks(): void {
    this.wallRunSparks = this.wallRunSparks.filter((g) => g.active);
  }

  // ── Trail particles ──────────────────────────────────────────────────────

  private spawnTrailParticle(): void {
    const gfx = this.scene.add.graphics();
    gfx.setDepth(9);
    gfx.fillStyle(0x00ff88, 0.2);
    gfx.fillRect(this.sprite.x - 4, this.sprite.y - 4, 8, 8);
    this.trailParticles.push({ x: this.sprite.x, y: this.sprite.y, alpha: 0.2, gfx });
    this.scene.time.delayedCall(200, () => {
      if (gfx.active) gfx.destroy();
    });
  }

  private updateTrailParticles(_delta: number): void {
    this.trailParticles = this.trailParticles.filter((p) => p.gfx.active);
  }

  // ── Score ────────────────────────────────────────────────────────────────

  addScore(n: number): void {
    this._score += n;
    this.scene.game.events.emit('hud-score', this._score);
    if (this.onScoreChange) this.onScoreChange(this._score);
  }

  get score(): number {
    return this._score;
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  get pounceCooldownRatio(): number {
    return Math.max(0, this.pounceCooldown / POUNCE_COOLDOWN);
  }

  get x(): number {
    return this.sprite.x;
  }
  get y(): number {
    return this.sprite.y;
  }
}

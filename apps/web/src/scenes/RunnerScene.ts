import Phaser from 'phaser';
import { getZoneForScore, ZoneConfig } from '../zones/ZoneConfig';
import { soundManager } from '../audio/SoundManager';
import {
  getDeathMeme,
  getZoneMeme,
  getScrapMeme,
  getHighScoreMeme,
  preloadCatImages,
} from '../memes/CatMemes';

// Cyberpunk palette
const COLORS = {
  bg: 0x0a0a0f,
  building: 0x1a1a2e,
  buildingLight: 0x25253a,
  neonPink: 0xff2a6d,
  neonCyan: 0x05d9e8,
  neonPurple: 0xd300c5,
  cat: 0xffcc00,
  catDark: 0xcc9900,
  catPanel: 0xe6b800,
  catEyes: 0x05d9e8,
  catEyeGlow: 0x88ffff,
  catAntenna: 0xff2a6d,
  catGear: 0xaaaaaa,
  catThruster: 0x05d9e8,
  catThrusterFire: 0xff6600,
  drone: 0xff0044,
  droneCone: 0xff0044,
  scrap: 0xffd700,
  obstacle: 0x444466,
  obstaclePipe: 0x556677,
};

const CAT_X = 150;
const JUMP_VELOCITY = -420;
const DOUBLE_JUMP_VELOCITY = -380;
const DASH_VELOCITY = 400;
const DASH_DURATION = 200; // ms
const WALL_SLIDE_VELOCITY = 80; // slow fall
const WALL_JUMP_VELOCITY_X = 200;
const WALL_JUMP_VELOCITY_Y = -350;
const POUNCE_VELOCITY = 500; // downward slam
const POUNCE_BOUNCE = -450; // bounce after hitting drone

export class RunnerScene extends Phaser.Scene {
  private cat!: Phaser.GameObjects.Container;
  private catBody!: Phaser.Physics.Arcade.Body;
  private buildings!: Phaser.GameObjects.Group;
  private drones!: Phaser.GameObjects.Group;
  private scraps!: Phaser.GameObjects.Group;
  private neonSigns!: Phaser.GameObjects.Group;
  private obstacles!: Phaser.GameObjects.Group;

  // Zone tracking
  private currentZone!: ZoneConfig;
  private zoneText!: Phaser.GameObjects.Text;
  private distanceTravelled = 0;

  // Thruster references so we can glow them on pounce
  private thrusterL!: Phaser.GameObjects.Rectangle;
  private thrusterR!: Phaser.GameObjects.Rectangle;
  private thrusterFireL!: Phaser.GameObjects.Rectangle;
  private thrusterFireR!: Phaser.GameObjects.Rectangle;

  // Evolution visuals (unlocked as score rises)
  private catArmorPlates: Phaser.GameObjects.Rectangle[] = [];
  private catVisor?: Phaser.GameObjects.Rectangle;
  private catShoulderCannons: Phaser.GameObjects.Rectangle[] = [];
  private catEvolutionStage = 0;
  private isZoneAnnouncing = false;
  private deathRenderToken = 0;

  private score = 0;
  private highScore = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOver = false;
  private started = false;

  // Movement state
  private canDoubleJump = true;
  private canDash = true;
  private isDashing = false;
  private dashEndTime = 0;
  private isWallSliding = false;
  private wallSlideSide: 'left' | 'right' | null = null;
  private isPouncing = false;

  // Scrap (persistent currency)
  private scrapCount = 0;
  private scrapText!: Phaser.GameObjects.Text;

  // Coyote time & input buffering
  private coyoteTimer = 0; // ms remaining where jump still allowed after leaving ground
  private jumpBufferTimer = 0; // ms remaining for buffered jump input
  private wasOnGround = false;
  private static readonly COYOTE_TIME = 100; // ms grace period
  private static readonly JUMP_BUFFER = 120; // ms input buffer

  // Mute button
  private muteText!: Phaser.GameObjects.Text;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private shiftKey!: Phaser.Input.Keyboard.Key;

  private lastBuildingX = 0;
  private lastBuildingHeight = 160;
  private buildingPool: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('RunnerScene');
  }

  create(): void {
    // Reset all state on restart (scene.restart() reuses the same instance)
    this.score = 0;
    this.gameOver = false;
    this.started = false;
    this.lastBuildingX = 0;
    this.lastBuildingHeight = 160;
    this.buildingPool = [];
    this.canDoubleJump = true;
    this.canDash = true;
    this.isDashing = false;
    this.dashEndTime = 0;
    this.isWallSliding = false;
    this.wallSlideSide = null;
    this.isPouncing = false;
    this.distanceTravelled = 0;
    this.currentZone = getZoneForScore(0);
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wasOnGround = false;
    this.catEvolutionStage = 0;
    this.isZoneAnnouncing = false;
    this.deathRenderToken += 1;

    // Init sound
    soundManager.init();
    preloadCatImages();

    // Load persistent data
    this.highScore = parseInt(localStorage.getItem('robocat_highscore') || '0', 10);
    this.scrapCount = parseInt(localStorage.getItem('robocat_scrap') || '0', 10);

    // Background gradient (fake with rectangles) — use runtime dimensions
    this.add.rectangle(
      this.screenWidth / 2,
      this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
      this.currentZone.color.bgTint
    );

    // Distant city silhouette
    this.createBackgroundCity();

    // Groups
    this.buildings = this.add.group();
    this.drones = this.add.group();
    this.scraps = this.add.group();
    this.neonSigns = this.add.group();
    this.obstacles = this.add.group();

    // Initial buildings
    this.lastBuildingX = 0;
    this.spawnInitialBuildings();

    // Cat
    this.createCat();

    // HUD
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#05d9e8',
    });

    // Zone indicator (top right)
    this.zoneText = this.add
      .text(this.screenWidth - 20, 20, this.currentZone.name, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#888888',
      })
      .setOrigin(1, 0);

    // Scrap counter
    this.scrapText = this.add.text(20, 50, `⚙ ${this.scrapCount}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffd700',
    });

    // Mute button
    this.muteText = this.add
      .text(this.screenWidth - 20, 50, '🔊', {
        fontFamily: 'monospace',
        fontSize: '20px',
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.muteText.on('pointerdown', () => {
      const muted = soundManager.toggleMute();
      this.muteText.setText(muted ? '🔇' : '🔊');
    });

    // Instructions
    this.add
      .text(
        this.screenWidth / 2,
        this.screenHeight / 2 - 50,
        'SPACE/TAP: Jump  |  SHIFT/→: Dash  |  DOWN/↓: Pounce',
        {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#ffffff',
        }
      )
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.add
      .text(
        this.screenWidth / 2,
        this.screenHeight / 2,
        'Double-tap: double jump. Swipe: dash/pounce. Wall-slide on buildings.',
        {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#888888',
        }
      )
      .setOrigin(0.5)
      .setAlpha(0.6);

    // Input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);

    // Keyboard input
    this.input.keyboard?.on('keydown-SPACE', () => this.handleJump());
    this.input.keyboard?.on('keydown-SHIFT', () => this.handleDash());
    this.input.keyboard?.on('keydown-DOWN', () => this.handlePounce());
    this.input.keyboard?.on('keydown-M', () => {
      const muted = soundManager.toggleMute();
      this.muteText.setText(muted ? '🔇' : '🔊');
    });

    // Touch / pointer: tap = jump, swipe right = dash, swipe down = pounce
    let pointerStartX = 0;
    let pointerStartY = 0;
    let pointerStartTime = 0;
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      pointerStartX = ptr.x;
      pointerStartY = ptr.y;
      pointerStartTime = this.time.now;
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      const dx = ptr.x - pointerStartX;
      const dy = ptr.y - pointerStartY;
      const dt = this.time.now - pointerStartTime;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 40 && dt < 400) {
        // Swipe detected
        if (Math.abs(dx) > Math.abs(dy) && dx > 0) {
          this.handleDash(); // swipe right
        } else if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
          this.handlePounce(); // swipe down
        } else {
          this.handleJump(); // swipe up or left = jump
        }
      } else {
        this.handleJump(); // tap = jump
      }
    });

    // Collision — use callback to detect wall slides
    this.physics.add.collider(this.cat, this.buildings, (_cat, building) => {
      this.onBuildingCollision(building as Phaser.GameObjects.Rectangle);
    });
    this.physics.add.collider(this.cat, this.obstacles, (_cat, _obstacle) => {
      this.onObstacleCollision();
    });
    this.physics.add.overlap(this.cat, this.drones, (_cat, drone) => {
      this.onDroneContact(drone as Phaser.GameObjects.Container);
    });
    this.physics.add.overlap(this.cat, this.scraps, (_cat, scrap) => {
      this.onCollectScrap(scrap as Phaser.GameObjects.Arc);
    });
  }

  private onObstacleCollision(): void {
    // Obstacles block movement but don't kill — cat needs to jump over
    // Just ensure physics handles blocking
  }

  private createBackgroundCity(): void {
    // Parallax background buildings (non-interactive)
    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(0, this.screenWidth);
      const height = Phaser.Math.Between(100, 300);
      const width = Phaser.Math.Between(30, 80);
      const shade = Phaser.Math.Between(0x08, 0x15);
      const color = (shade << 16) | (shade << 8) | (shade + 0x10);

      this.add.rectangle(x, this.worldBottom - height / 2, width, height, color).setAlpha(0.5);
    }
  }

  private createCat(): void {
    // ─────────────────────────────────────────────────────────────
    // ROBOCAT — all Phaser primitives, no sprite sheets
    // Collision footprint: ~40×30 centred at (0,0)
    // ─────────────────────────────────────────────────────────────
    // Spawn cat on first building's roof
    const firstBuilding = this.buildings.getChildren()[0] as Phaser.GameObjects.Rectangle;
    const catY = firstBuilding
      ? firstBuilding.y - firstBuilding.height / 2 - 20
      : this.screenHeight - 200;
    this.cat = this.add.container(CAT_X, catY);

    // ── Tail: 3 segments (slightly staggered, mechanical joints) ──
    // Segment 3 (tip)
    const tailSeg3 = this.add.rectangle(-36, -2, 8, 4, COLORS.catDark).setAngle(-30);
    // Segment 2
    const tailSeg2 = this.add.rectangle(-28, -1, 9, 5, COLORS.catPanel).setAngle(-15);
    // Segment 1 (base)
    const tailSeg1 = this.add.rectangle(-20, 0, 10, 6, COLORS.cat).setAngle(-5);
    // Thin neon line along tail
    const tailNeon = this.add.rectangle(-28, -4, 28, 1, COLORS.neonCyan);
    this.cat.add([tailSeg3, tailSeg2, tailSeg1, tailNeon]);

    // ── Jet thrusters on back (glow when pouncing) ──
    // Thruster housing L
    this.thrusterL = this.add.rectangle(-14, -2, 6, 10, COLORS.catGear);
    // Thruster housing R
    this.thrusterR = this.add.rectangle(-14, 8, 6, 10, COLORS.catGear);
    // Thruster flame L (hidden at rest)
    this.thrusterFireL = this.add.rectangle(-18, -2, 5, 7, COLORS.catThrusterFire).setAlpha(0);
    // Thruster flame R (hidden at rest)
    this.thrusterFireR = this.add.rectangle(-18, 8, 5, 7, COLORS.catThrusterFire).setAlpha(0);
    this.cat.add([this.thrusterL, this.thrusterR, this.thrusterFireL, this.thrusterFireR]);

    // ── Main body: sleeker, 3-panel design ──
    // Lower belly (slightly darker)
    const belly = this.add.rectangle(0, 4, 40, 20, COLORS.catDark);
    // Main torso
    const torso = this.add.rectangle(0, -2, 38, 22, COLORS.cat);
    // Panel line across chest
    const panelLine1 = this.add.rectangle(0, -10, 36, 2, COLORS.catPanel);
    // Vertical rivet lines
    const rivet1 = this.add.rectangle(-10, -2, 1, 18, COLORS.catDark);
    const rivet2 = this.add.rectangle(8, -2, 1, 18, COLORS.catDark);
    // Neon underbelly trim
    const neonBelly = this.add.rectangle(0, 7, 36, 2, COLORS.neonCyan);
    neonBelly.setAlpha(0.7);
    this.cat.add([belly, torso, panelLine1, rivet1, rivet2, neonBelly]);

    // ── Legs (chunky mechanical stumps) ──
    const legFL = this.add.rectangle(-8, 14, 8, 10, COLORS.catDark);
    const legFR = this.add.rectangle(8, 14, 8, 10, COLORS.catDark);
    const footFL = this.add.rectangle(-8, 19, 10, 5, COLORS.cat);
    const footFR = this.add.rectangle(8, 19, 10, 5, COLORS.cat);
    this.cat.add([legFL, legFR, footFL, footFR]);

    // ── Head ──
    // Head base
    const head = this.add.rectangle(22, -14, 26, 22, COLORS.cat);
    // Face plate (slightly lighter inset)
    const facePlate = this.add.rectangle(24, -13, 20, 16, COLORS.catPanel);
    // Chin/jaw seam
    const jawLine = this.add.rectangle(22, -4, 24, 2, COLORS.catDark);
    // Snout (small box)
    const snout = this.add.rectangle(33, -12, 8, 6, COLORS.catDark);
    // Neon trim on head top
    const headNeon = this.add.rectangle(22, -24, 24, 2, COLORS.neonCyan).setAlpha(0.8);
    this.cat.add([head, facePlate, jawLine, snout, headNeon]);

    // ── Ears ──
    // Left ear (organic triangle shape)
    const earL = this.add.triangle(13, -28, 0, 12, 5, 0, 11, 12, COLORS.cat);
    // Right ear (antenna ear — has a thin rod on top)
    const earR = this.add.triangle(28, -28, 0, 12, 5, 0, 11, 12, COLORS.cat);
    // Antenna rod on right ear
    const antennaRod = this.add.rectangle(34, -38, 2, 14, COLORS.catGear);
    // Antenna tip (neon pink dot)
    const antennaTip = this.add.circle(34, -46, 3, COLORS.catAntenna);
    // Inner ear marker (left)
    const earInnerL = this.add.triangle(14, -25, 1, 8, 4, 1, 8, 8, COLORS.neonPink).setAlpha(0.6);
    this.cat.add([earL, earR, antennaRod, antennaTip, earInnerL]);

    // ── Eyes — large expressive neon cyan with glow halo ──
    // Glow halo L
    const eyeGlowL = this.add.circle(16, -15, 7, COLORS.catEyeGlow).setAlpha(0.25);
    // Glow halo R
    const eyeGlowR = this.add.circle(27, -15, 7, COLORS.catEyeGlow).setAlpha(0.25);
    // Eye L
    const eyeL = this.add.circle(16, -15, 4, COLORS.catEyes);
    // Eye R
    const eyeR = this.add.circle(27, -15, 4, COLORS.catEyes);
    // Pupil slit L (dark)
    const pupilL = this.add.rectangle(16, -15, 2, 6, 0x003344);
    // Pupil slit R
    const pupilR = this.add.rectangle(27, -15, 2, 6, 0x003344);
    // Brow L (neon cyan ridge for expressiveness)
    const browL = this.add.rectangle(16, -21, 8, 2, COLORS.neonCyan).setAlpha(0.9);
    // Brow R
    const browR = this.add.rectangle(27, -21, 8, 2, COLORS.neonCyan).setAlpha(0.9);
    this.cat.add([eyeGlowL, eyeGlowR, eyeL, eyeR, pupilL, pupilR, browL, browR]);

    // ── Small circuit/gear detail on torso ──
    // Gear circle
    const gear = this.add.circle(-2, -2, 6, COLORS.catGear);
    const gearCenter = this.add.circle(-2, -2, 3, COLORS.catDark);
    // Gear teeth (4 tiny rectangles arranged cross-like)
    const gearT1 = this.add.rectangle(-2, -9, 2, 3, COLORS.catGear);
    const gearT2 = this.add.rectangle(-2, 5, 2, 3, COLORS.catGear);
    const gearT3 = this.add.rectangle(-9, -2, 3, 2, COLORS.catGear);
    const gearT4 = this.add.rectangle(5, -2, 3, 2, COLORS.catGear);
    this.cat.add([gear, gearCenter, gearT1, gearT2, gearT3, gearT4]);

    // ── Evolution unlock parts (hidden at start) ──
    const armor1 = this.add.rectangle(-6, -8, 10, 6, 0x8899aa).setAlpha(0);
    const armor2 = this.add.rectangle(6, -8, 10, 6, 0x8899aa).setAlpha(0);
    const armor3 = this.add.rectangle(0, 10, 20, 4, 0x667788).setAlpha(0);
    this.catArmorPlates = [armor1, armor2, armor3];

    this.catVisor = this.add.rectangle(21, -15, 16, 4, 0xff2a6d).setAlpha(0);

    const cannonL = this.add.rectangle(-16, -10, 8, 4, 0x4d5a6a).setAlpha(0);
    const cannonR = this.add.rectangle(-16, 10, 8, 4, 0x4d5a6a).setAlpha(0);
    this.catShoulderCannons = [cannonL, cannonR];

    this.cat.add([...this.catArmorPlates, this.catVisor, ...this.catShoulderCannons]);

    // ── Physics ──
    this.physics.add.existing(this.cat);
    this.catBody = this.cat.body as Phaser.Physics.Arcade.Body;
    this.catBody.setSize(40, 40);
    this.catBody.setOffset(-20, -20);
    this.catBody.setCollideWorldBounds(false);
  }

  private get screenWidth(): number {
    return this.scale.width;
  }

  private get screenHeight(): number {
    return this.scale.height;
  }

  // Bottom bound for gameplay to avoid mobile browser UI overlap (Safari/Chrome bars)
  private get worldBottom(): number {
    const isMobile = this.screenWidth < 900;
    if (!isMobile) return this.screenHeight;

    const vv = window.visualViewport;
    const occluded = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    // Keep a minimum safety margin on mobile even if occlusion reports 0
    return this.screenHeight - Math.max(40, occluded + 24);
  }

  private spawnInitialBuildings(): void {
    let x = 0;
    const z = this.currentZone;
    while (x < this.screenWidth + 400) {
      const width = Phaser.Math.Between(z.buildingWidthMin, z.buildingWidthMax);
      const rawHeight = Phaser.Math.Between(z.buildingHeightMin, z.buildingHeightMax);
      const height = Phaser.Math.Clamp(
        rawHeight,
        Math.max(z.buildingHeightMin, this.lastBuildingHeight - z.maxHeightStep),
        Math.min(z.buildingHeightMax, this.lastBuildingHeight + z.maxHeightStep)
      );
      this.lastBuildingHeight = height;
      this.spawnBuilding(x + width / 2, height, width);
      x += width + Phaser.Math.Between(0, 20); // Minimal gaps at start
    }
  }

  private spawnBuilding(x: number, height: number, width: number): Phaser.GameObjects.Rectangle {
    const y = this.worldBottom - height / 2;

    // Main building
    const building = this.add.rectangle(x, y, width, height, COLORS.building);
    this.physics.add.existing(building, true); // Static body
    this.buildings.add(building);

    // Neon accent on top
    const accent = this.add.rectangle(
      x,
      y - height / 2 + 3,
      width,
      6,
      Phaser.Math.RND.pick([COLORS.neonPink, COLORS.neonCyan, COLORS.neonPurple])
    );
    accent.setAlpha(0.8);
    this.neonSigns.add(accent);
    (accent as unknown as { parentBuilding: typeof building }).parentBuilding = building;

    // Random windows
    const windowRows = Math.floor(height / 25);
    const windowCols = Math.floor(width / 20);
    for (let row = 0; row < windowRows; row++) {
      for (let col = 0; col < windowCols; col++) {
        if (Math.random() > 0.6) {
          const wx = x - width / 2 + 10 + col * 20;
          const wy = y - height / 2 + 20 + row * 25;
          const lit = Math.random() > 0.5;
          const win = this.add.rectangle(wx, wy, 8, 12, lit ? 0xffffcc : 0x111122);
          win.setAlpha(lit ? 0.7 : 0.3);
          (win as unknown as { parentBuilding: typeof building }).parentBuilding = building;
          this.neonSigns.add(win);
        }
      }
    }

    this.lastBuildingX = x + width / 2;
    return building;
  }

  private startGame(): void {
    if (this.started) return;
    this.started = true;
    // Remove instructions
    this.children.list
      .filter(
        (c) =>
          c instanceof Phaser.GameObjects.Text &&
          ((c as Phaser.GameObjects.Text).text.includes('SPACE') ||
            (c as Phaser.GameObjects.Text).text.includes('Double-tap'))
      )
      .forEach((c) => c.destroy());
  }

  private handleJump(): void {
    if (this.gameOver) {
      this.restart();
      return;
    }

    this.startGame();
    soundManager.ensureResumed();

    const onGround = this.catBody.blocked.down || this.catBody.touching.down;

    // Wall jump
    if (this.isWallSliding && this.wallSlideSide) {
      this.isWallSliding = false;
      const jumpX = this.wallSlideSide === 'right' ? -WALL_JUMP_VELOCITY_X : WALL_JUMP_VELOCITY_X;
      this.catBody.setVelocity(jumpX, WALL_JUMP_VELOCITY_Y);
      this.canDoubleJump = true;
      this.createJumpEffect();
      soundManager.jump();
      this.wallSlideSide = null;
      return;
    }

    // Ground jump (includes coyote time)
    if (onGround || this.coyoteTimer > 0) {
      this.catBody.setVelocityY(JUMP_VELOCITY);
      this.canDoubleJump = true;
      this.coyoteTimer = 0; // consume coyote
      this.jumpBufferTimer = 0;
      this.createJumpEffect();
      soundManager.jump();
      return;
    }

    // Double jump (air)
    if (this.canDoubleJump && !onGround) {
      this.catBody.setVelocityY(DOUBLE_JUMP_VELOCITY);
      this.canDoubleJump = false;
      this.createDoubleJumpEffect();
      soundManager.doubleJump();
      return;
    }

    // If none worked, buffer the input
    this.jumpBufferTimer = RunnerScene.JUMP_BUFFER;
  }

  private handleDash(): void {
    if (this.gameOver || !this.canDash || this.isDashing) return;

    this.startGame();
    soundManager.ensureResumed();

    this.isDashing = true;
    this.canDash = false;
    this.dashEndTime = this.time.now + DASH_DURATION;

    this.catBody.setVelocityX(DASH_VELOCITY);
    this.catBody.setVelocityY(0);
    this.catBody.setAllowGravity(false);

    this.createDashEffect();
    soundManager.dash();

    this.cameras.main.shake(100, 0.005);

    this.tweens.add({
      targets: this.cat,
      angle: 15,
      duration: 100,
      yoyo: false,
    });
  }

  private handlePounce(): void {
    if (this.gameOver) return;

    const onGround = this.catBody.blocked.down || this.catBody.touching.down;
    if (onGround || this.isPouncing) return;

    this.startGame();
    soundManager.ensureResumed();

    this.isPouncing = true;
    this.catBody.setVelocityY(POUNCE_VELOCITY);
    this.catBody.setVelocityX(0);
    soundManager.pounce();

    // Rotate cat downward
    this.tweens.add({
      targets: this.cat,
      angle: 45,
      duration: 100,
    });

    // Cyan aura
    const aura = this.add.circle(this.cat.x, this.cat.y, 30, COLORS.neonCyan);
    aura.setAlpha(0.4);
    this.tweens.add({
      targets: aura,
      scale: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => aura.destroy(),
    });
  }

  private onBuildingCollision(building: Phaser.GameObjects.Rectangle): void {
    const catX = this.cat.x;
    const catY = this.cat.y;
    const catHalfWidth = 20;
    const catBottom = catY + 20;
    const catRight = catX + catHalfWidth;
    const catLeft = catX - catHalfWidth;

    const buildingLeft = building.x - building.width / 2;
    const buildingRight = building.x + building.width / 2;
    const buildingTop = building.y - building.height / 2;

    // Check if landing on top
    if (this.catBody.blocked.down || this.catBody.touching.down) {
      this.onLand();
      return;
    }

    // Pounce land
    if (this.isPouncing && this.cat.y < buildingTop + 20) {
      this.onPounceLand();
      return;
    }

    // Wall slide detection (cat hits side of building while falling)
    if (this.catBody.velocity.y > 0 && !this.catBody.blocked.down) {
      // Check if hitting left wall of building (cat's right side touches building's left)
      if (
        catRight >= buildingLeft - 5 &&
        catRight <= buildingLeft + 15 &&
        catBottom > buildingTop + 10
      ) {
        this.startWallSlide('right');
      }
      // Check if hitting right wall (less common in runner, but possible)
      else if (
        catLeft <= buildingRight + 5 &&
        catLeft >= buildingRight - 15 &&
        catBottom > buildingTop + 10
      ) {
        this.startWallSlide('left');
      }
    }
  }

  private startWallSlide(side: 'left' | 'right'): void {
    if (this.isWallSliding) return;

    this.isWallSliding = true;
    this.wallSlideSide = side;
    this.catBody.setVelocityY(WALL_SLIDE_VELOCITY);
    this.canDoubleJump = true;
    soundManager.wallSlide();

    // Visual: tilt cat toward wall
    this.cat.setAngle(side === 'right' ? -10 : 10);

    // Spark particles
    this.createWallSlideParticles();
  }

  private onLand(): void {
    // Reset rotation
    this.cat.setAngle(0);

    // Reset abilities
    this.canDoubleJump = true;
    this.canDash = true;
    this.isWallSliding = false;
    this.wallSlideSide = null;
    this.isPouncing = false;
  }

  private onPounceLand(): void {
    this.isPouncing = false;
    this.cat.setAngle(0);
    soundManager.pounceLand();

    // Screen shake
    this.cameras.main.shake(150, 0.015);

    // Impact effect
    const impact = this.add.circle(this.cat.x, this.cat.y + 20, 20, COLORS.neonCyan);
    impact.setAlpha(0.6);
    this.tweens.add({
      targets: impact,
      scaleX: 3,
      scaleY: 0.5,
      alpha: 0,
      duration: 200,
      onComplete: () => impact.destroy(),
    });

    this.score += 5;
    this.scoreText.setText(`SCORE: ${this.score}`);
  }

  private onDroneContact(drone: Phaser.GameObjects.Container): void {
    // If pouncing, destroy drone and bounce
    if (this.isPouncing) {
      this.destroyDrone(drone);
      this.catBody.setVelocityY(POUNCE_BOUNCE);
      this.isPouncing = false;
      this.cat.setAngle(0);
      soundManager.droneDestroy();

      // Style bonus
      this.score += 25;
      this.scoreText.setText(`SCORE: ${this.score}`);

      const pop = this.add
        .text(drone.x, drone.y, '+25 POUNCE!', {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ff2a6d',
        })
        .setOrigin(0.5);
      this.tweens.add({
        targets: pop,
        y: drone.y - 40,
        alpha: 0,
        duration: 500,
        onComplete: () => pop.destroy(),
      });
      return;
    }

    // If dashing, phase through (invincible)
    if (this.isDashing) {
      // Near-miss style bonus
      this.score += 5;
      return;
    }

    // Otherwise, death
    this.onHitDrone();
  }

  private destroyDrone(drone: Phaser.GameObjects.Container): void {
    // Explosion effect
    this.cameras.main.flash(100, 255, 42, 109);

    for (let i = 0; i < 8; i++) {
      const spark = this.add.circle(
        drone.x + Phaser.Math.Between(-20, 20),
        drone.y + Phaser.Math.Between(-20, 20),
        Phaser.Math.Between(3, 6),
        COLORS.neonPink
      );
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-50, 50),
        y: spark.y + Phaser.Math.Between(-50, 50),
        alpha: 0,
        scale: 0,
        duration: 300,
        onComplete: () => spark.destroy(),
      });
    }

    drone.destroy();
  }

  private createJumpEffect(): void {
    // Thruster glow burst
    this.thrusterFireL.setAlpha(0.9);
    this.thrusterFireR.setAlpha(0.9);
    this.tweens.add({
      targets: [this.thrusterFireL, this.thrusterFireR],
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
    });

    // Thruster housing flash to cyan
    this.thrusterL.setFillStyle(COLORS.catThruster);
    this.thrusterR.setFillStyle(COLORS.catThruster);
    this.tweens.add({
      targets: this.thrusterL,
      duration: 350,
      onComplete: () => {
        if (this.thrusterL?.active) this.thrusterL.setFillStyle(COLORS.catGear);
      },
    });
    this.tweens.add({
      targets: this.thrusterR,
      duration: 350,
      onComplete: () => {
        if (this.thrusterR?.active) this.thrusterR.setFillStyle(COLORS.catGear);
      },
    });

    // Pounce animation - rotate cat up
    this.tweens.add({
      targets: this.cat,
      angle: -15,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    this.createTrail();
  }

  private createDoubleJumpEffect(): void {
    // Extra thruster burst
    this.thrusterFireL.setAlpha(1);
    this.thrusterFireR.setAlpha(1);
    this.tweens.add({
      targets: [this.thrusterFireL, this.thrusterFireR],
      alpha: 0,
      scaleY: 2,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.thrusterFireL?.active) this.thrusterFireL.setScale(1);
        if (this.thrusterFireR?.active) this.thrusterFireR.setScale(1);
      },
    });

    // Ring effect
    const ring = this.add.circle(this.cat.x, this.cat.y, 15, COLORS.neonCyan);
    ring.setAlpha(0.7);
    ring.setFillStyle(undefined as unknown as number);
    ring.setStrokeStyle(3, COLORS.neonCyan);
    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy(),
    });

    // Rotate
    this.tweens.add({
      targets: this.cat,
      angle: { from: 0, to: -360 },
      duration: 300,
      ease: 'Linear',
    });
  }

  private createDashEffect(): void {
    // Speed lines
    for (let i = 0; i < 5; i++) {
      const line = this.add.rectangle(
        this.cat.x - 30 - i * 20,
        this.cat.y + Phaser.Math.Between(-15, 15),
        40,
        2,
        COLORS.neonCyan
      );
      line.setAlpha(0.8 - i * 0.15);
      this.tweens.add({
        targets: line,
        x: line.x - 100,
        alpha: 0,
        duration: 200,
        onComplete: () => line.destroy(),
      });
    }

    // Thruster overdrive
    this.thrusterFireL.setAlpha(1);
    this.thrusterFireR.setAlpha(1);
    this.thrusterFireL.setScale(1.5, 2);
    this.thrusterFireR.setScale(1.5, 2);
  }

  private createWallSlideParticles(): void {
    const sparkInterval = this.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.isWallSliding) {
          sparkInterval.remove();
          return;
        }
        const spark = this.add.circle(
          this.cat.x + (this.wallSlideSide === 'right' ? 25 : -25),
          this.cat.y + Phaser.Math.Between(-10, 10),
          2,
          COLORS.neonPink
        );
        this.tweens.add({
          targets: spark,
          y: spark.y + 30,
          alpha: 0,
          duration: 200,
          onComplete: () => spark.destroy(),
        });
      },
      loop: true,
    });
  }

  private updateCatEvolution(): void {
    // Stage unlocks by score:
    // 1: armor plates, 2: visor, 3: shoulder cannons + stronger thrusters
    const stage = this.score >= 150 ? 3 : this.score >= 75 ? 2 : this.score >= 30 ? 1 : 0;
    if (stage === this.catEvolutionStage) return;
    this.catEvolutionStage = stage;

    if (stage >= 1) {
      this.catArmorPlates.forEach((p) => p.setAlpha(1));
    }
    if (stage >= 2 && this.catVisor) {
      this.catVisor.setAlpha(0.95);
    }
    if (stage >= 3) {
      this.catShoulderCannons.forEach((c) => c.setAlpha(1));
      this.thrusterL.setFillStyle(0x88c0ff);
      this.thrusterR.setFillStyle(0x88c0ff);
    }

    const evoText = this.add
      .text(this.screenWidth / 2, this.screenHeight * 0.16, `ROBO UPGRADE ${stage}/3`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.tweens.add({
      targets: evoText,
      alpha: 0,
      y: evoText.y - 30,
      duration: 1200,
      onComplete: () => evoText.destroy(),
    });
  }

  private createTrail(): void {
    for (let i = 0; i < 3; i++) {
      const particle = this.add.circle(
        this.cat.x - 20 - i * 10,
        this.cat.y + Phaser.Math.Between(-5, 5),
        4 - i,
        COLORS.neonCyan
      );
      particle.setAlpha(0.6);
      this.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 0,
        duration: 200,
        onComplete: () => particle.destroy(),
      });
    }
  }

  private onHitDrone(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    soundManager.death();

    // Flash screen red
    this.cameras.main.flash(200, 255, 0, 68);
    this.cameras.main.shake(200, 0.02);

    // Stop cat
    this.catBody.setVelocity(0, 0);
    this.catBody.setAllowGravity(false);

    // Save persistent data
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('robocat_highscore', String(this.highScore));
    }
    localStorage.setItem('robocat_scrap', String(this.scrapCount));

    // Get a cat meme
    const meme = getDeathMeme();

    // Dark overlay
    const overlay = this.add.rectangle(
      this.screenWidth / 2,
      this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
      0x000000
    );
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 0.7, duration: 300 });

    // "DETECTED" title
    const title = this.add
      .text(this.screenWidth / 2, this.screenHeight * 0.15, 'DETECTED', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ff2a6d',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: title.y + 10, duration: 400 });

    // Cat meme image (loaded as DOM image, rendered as Phaser texture)
    // Guard with token so an old death-image load can't leak into a restarted run.
    const renderToken = this.deathRenderToken;
    const memeKey = `catmeme_${Date.now()}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!this.scene.isActive() || this.deathRenderToken !== renderToken || !this.gameOver) return;
      try {
        this.textures.addImage(memeKey, img);
        const memeImg = this.add
          .image(this.screenWidth / 2, this.screenHeight * 0.42, memeKey)
          .setOrigin(0.5)
          .setAlpha(0);
        // Scale to fit ~250px wide
        const scale = 250 / Math.max(img.width, 1);
        memeImg.setScale(scale);
        this.tweens.add({ targets: memeImg, alpha: 1, duration: 300, delay: 200 });
      } catch {
        // Texture add can fail, just show caption
      }
    };
    img.onerror = () => {
      // If image fails, just show the caption text bigger
    };
    img.src = meme.imageUrl;

    // Meme caption (always shown as fallback too)
    const caption = this.add
      .text(this.screenWidth / 2, this.screenHeight * 0.62, `"${meme.caption}"`, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffcc00',
        fontStyle: 'italic',
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: caption, alpha: 1, duration: 300, delay: 400 });

    // Score + high score
    const isNewBest = this.score >= this.highScore;
    const scoreLine = this.add
      .text(
        this.screenWidth / 2,
        this.screenHeight * 0.72,
        `Score: ${this.score}  |  Best: ${this.highScore}${isNewBest ? '  🏆 NEW!' : ''}`,
        {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#ffffff',
        }
      )
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: scoreLine, alpha: 1, duration: 300, delay: 500 });

    // Zone reached + scrap collected this run
    const statsLine = this.add
      .text(
        this.screenWidth / 2,
        this.screenHeight * 0.78,
        `Zone: ${this.currentZone.name}  |  ⚙ ${this.scrapCount} total`,
        {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#888888',
        }
      )
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: statsLine, alpha: 1, duration: 300, delay: 550 });

    // High score celebration meme
    if (isNewBest) {
      const hsMeme = this.add
        .text(this.screenWidth / 2, this.screenHeight * 0.83, getHighScoreMeme(), {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#00ff88',
          fontStyle: 'italic',
        })
        .setOrigin(0.5)
        .setAlpha(0);
      this.tweens.add({ targets: hsMeme, alpha: 1, duration: 300, delay: 600 });
    }

    // Share button
    const shareBtn = this.add
      .text(this.screenWidth / 2 - 70, this.screenHeight * 0.8, '📤 SHARE', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#05d9e8',
        backgroundColor: '#1a1a2e',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    shareBtn.on('pointerdown', () => this.shareScore());
    this.tweens.add({ targets: shareBtn, alpha: 1, duration: 300, delay: 700 });

    // Retry button
    const retryBtn = this.add
      .text(this.screenWidth / 2 + 70, this.screenHeight * 0.8, '🔄 RETRY', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#00ff88',
        backgroundColor: '#1a1a2e',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    retryBtn.on('pointerdown', () => this.restart());
    this.tweens.add({ targets: retryBtn, alpha: 1, duration: 300, delay: 700 });

    // Tap to retry hint
    this.add
      .text(this.screenWidth / 2, this.screenHeight * 0.86, 'SPACE / TAP to retry', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#555555',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);
  }

  private shareScore(): void {
    const text = `🐱⚡ ROBOCAT: Neon Dash\nScore: ${this.score} | Zone: ${this.currentZone.name}\nCan you beat me? 🏙️\nhttps://robocat-web-prod.pages.dev`;
    if (navigator.share) {
      navigator.share({ title: 'ROBOCAT: Neon Dash', text }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        const copied = this.add
          .text(this.screenWidth / 2, this.screenHeight * 0.82, 'Copied to clipboard!', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#00ff88',
          })
          .setOrigin(0.5);
        this.tweens.add({
          targets: copied,
          alpha: 0,
          y: copied.y - 20,
          duration: 1500,
          onComplete: () => copied.destroy(),
        });
      });
    }
  }

  private onCollectScrap(scrap: Phaser.GameObjects.Arc): void {
    const s = scrap;
    soundManager.collectScrap();

    // Pop animation
    this.tweens.add({
      targets: s,
      scale: 1.5,
      alpha: 0,
      duration: 100,
      onComplete: () => s.destroy(),
    });

    this.score += 10;
    this.scrapCount += 1;
    this.scoreText.setText(`SCORE: ${this.score}`);
    this.scrapText.setText(`⚙ ${this.scrapCount}`);

    // Score pop
    const pop = this.add
      .text(s.x, s.y, '+10', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd700',
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: pop,
      y: s.y - 30,
      alpha: 0,
      duration: 400,
      onComplete: () => pop.destroy(),
    });

    // Occasional scrap meme (skip during zone announcements to avoid overlap clutter)
    const scrapMeme = !this.isZoneAnnouncing ? getScrapMeme() : null;
    if (scrapMeme) {
      const memeText = this.add
        .text(s.x, s.y - 56, scrapMeme, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffcc00',
          fontStyle: 'italic',
        })
        .setOrigin(0.5)
        .setAlpha(0.85);
      this.tweens.add({
        targets: memeText,
        y: memeText.y - 45,
        alpha: 0,
        duration: 900,
        onComplete: () => memeText.destroy(),
      });
    }
  }

  private restart(): void {
    this.deathRenderToken += 1;
    this.scene.restart();
  }

  update(_time: number, delta: number): void {
    if (!this.started || this.gameOver) return;

    // === Coyote Time & Jump Buffer ===
    const onGround = this.catBody.blocked.down || this.catBody.touching.down;

    if (onGround) {
      this.coyoteTimer = RunnerScene.COYOTE_TIME;
      this.wasOnGround = true;
    } else {
      if (this.wasOnGround) {
        // Just left ground — start coyote timer
        this.wasOnGround = false;
      }
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
    }

    // Process buffered jump
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
      if (onGround || this.coyoteTimer > 0) {
        this.catBody.setVelocityY(JUMP_VELOCITY);
        this.canDoubleJump = true;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.createJumpEffect();
        soundManager.jump();
      }
    }

    // === Movement Physics ===

    // Handle dash end
    if (this.isDashing && this.time.now >= this.dashEndTime) {
      this.isDashing = false;
      this.catBody.setAllowGravity(true);
      this.catBody.setVelocityX(0);
      this.cat.setAngle(0);
      // Reset thruster visuals
      this.thrusterFireL.setAlpha(0);
      this.thrusterFireR.setAlpha(0);
      this.thrusterFireL.setScale(1);
      this.thrusterFireR.setScale(1);
    }

    // Wall slide physics - slow fall
    if (this.isWallSliding) {
      this.catBody.setVelocityY(WALL_SLIDE_VELOCITY);
      // Stop wall slide if landed
      if (this.catBody.blocked.down) {
        this.isWallSliding = false;
        this.wallSlideSide = null;
        this.onLand();
      }
    }

    // Keep cat at fixed X position (runner style) unless dashing
    if (!this.isDashing) {
      this.cat.x = CAT_X;
      this.catBody.setVelocityX(0);
    }

    // Check for zone transition
    const newZone = getZoneForScore(this.score);
    if (newZone !== this.currentZone) {
      this.onZoneTransition(newZone);
    }

    // Cat upgrades as score increases
    this.updateCatEvolution();

    // Dynamic scroll speed from current zone
    const speedGain = (this.score - this.currentZone.scoreThreshold) * 0.5;
    const currentSpeed = Math.min(
      this.currentZone.scrollSpeedBase + speedGain,
      this.currentZone.scrollSpeedCap
    );
    const scrollDelta = (currentSpeed * delta) / 1000;
    this.distanceTravelled += scrollDelta;

    // Scroll buildings
    this.buildings.getChildren().forEach((b) => {
      const building = b as Phaser.GameObjects.Rectangle;
      building.x -= scrollDelta;
      const staticBody = building.body as Phaser.Physics.Arcade.StaticBody;
      staticBody.x = building.x - building.width / 2;
      staticBody.updateFromGameObject();

      // Remove off-screen buildings
      if (building.x + building.width / 2 < -50) {
        building.destroy();
        this.score += 1; // Score for passing buildings
        this.scoreText.setText(`SCORE: ${this.score}`);
      }
    });

    // Scroll neon signs with their buildings
    this.neonSigns.getChildren().forEach((n) => {
      const neon = n as Phaser.GameObjects.Rectangle & {
        parentBuilding?: Phaser.GameObjects.Rectangle;
      };
      if (neon.parentBuilding && neon.parentBuilding.active) {
        neon.x -= scrollDelta;
      } else {
        neon.destroy();
      }
    });

    // Scroll obstacles
    this.obstacles.getChildren().forEach((o) => {
      const obs = o as Phaser.GameObjects.Rectangle & {
        parentBuilding?: Phaser.GameObjects.Rectangle;
      };
      if (obs.parentBuilding && obs.parentBuilding.active) {
        obs.x -= scrollDelta;
        const obsBody = obs.body as Phaser.Physics.Arcade.StaticBody;
        if (obsBody) {
          obsBody.updateFromGameObject();
        }
      } else {
        obs.destroy();
      }
    });

    // Scroll drones
    this.drones.getChildren().forEach((d) => {
      const drone = d as Phaser.GameObjects.Container;
      drone.x -= scrollDelta;
      if (drone.x < -50) drone.destroy();
    });

    // Scroll scraps
    this.scraps.getChildren().forEach((s) => {
      const scrap = s as Phaser.GameObjects.Arc;
      scrap.x -= scrollDelta;
      if (scrap.x < -50) scrap.destroy();
    });

    // Track scroll for building spawner
    this.lastBuildingX -= scrollDelta;

    // Spawn new buildings using zone parameters
    const z = this.currentZone;
    while (this.lastBuildingX < this.screenWidth + 400) {
      const gap = Phaser.Math.Between(z.gapMin, z.gapMax);
      const width = Phaser.Math.Between(z.buildingWidthMin, z.buildingWidthMax);
      // Constrain height: random within zone range but clamped to ±maxHeightStep of previous
      const rawHeight = Phaser.Math.Between(z.buildingHeightMin, z.buildingHeightMax);
      const height = Phaser.Math.Clamp(
        rawHeight,
        Math.max(z.buildingHeightMin, this.lastBuildingHeight - z.maxHeightStep),
        Math.min(z.buildingHeightMax, this.lastBuildingHeight + z.maxHeightStep)
      );
      this.lastBuildingHeight = height;
      const x = this.lastBuildingX + gap + width / 2;
      const building = this.spawnBuilding(x, height, width);

      // Maybe spawn rooftop obstacle
      if (Math.random() < z.obstacleChance) {
        this.spawnObstacle(building);
      }

      // Maybe spawn drone
      if (Math.random() < z.droneChance) {
        this.spawnDrone(x, this.worldBottom - height - 60);
      }

      // Maybe spawn scrap
      if (Math.random() < z.scrapChance) {
        this.spawnScrap(x - width / 4, this.worldBottom - height - 40);
      }
    }

    // Check if cat fell
    if (this.cat.y > this.screenHeight + 100) {
      this.onHitDrone(); // Same death handling
    }

    // Neon pulse
    this.neonSigns.getChildren().forEach((n, i) => {
      const neon = n as Phaser.GameObjects.Rectangle;
      neon.setAlpha(0.6 + Math.sin(Date.now() / 200 + i) * 0.3);
    });
  }

  private onZoneTransition(newZone: ZoneConfig): void {
    this.currentZone = newZone;
    this.isZoneAnnouncing = true;
    soundManager.zoneTransition();

    // Update zone indicator
    this.zoneText.setText(newZone.name);

    // Flash effect for zone transition
    const flash = this.add.rectangle(
      this.screenWidth / 2,
      this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
      0xffffff
    );
    flash.setAlpha(0.3);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy(),
    });

    // Zone announcement
    const announceY = this.screenHeight * 0.28;
    const announceBg = this.add.rectangle(
      this.screenWidth / 2,
      announceY,
      Math.min(this.screenWidth * 0.8, 360),
      50,
      0x000000
    );
    announceBg.setAlpha(0.35);

    const announce = this.add
      .text(this.screenWidth / 2, announceY, `» ${newZone.name} «`, {
        fontFamily: 'monospace',
        fontSize: this.screenWidth < 900 ? '22px' : '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: [announce, announceBg],
      alpha: 0,
      y: announceY - 40,
      duration: 1500,
      onComplete: () => {
        announce.destroy();
        announceBg.destroy();
        this.isZoneAnnouncing = false;
      },
    });

    // Cat meme for zone transition (desktop only to avoid mobile text clutter)
    if (this.screenWidth >= 900) {
      const zoneMeme = getZoneMeme();
      const memeCaption = this.add
        .text(this.screenWidth / 2, announceY + 36, zoneMeme.caption, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffcc00',
          fontStyle: 'italic',
        })
        .setOrigin(0.5)
        .setAlpha(0.8);
      this.tweens.add({
        targets: memeCaption,
        alpha: 0,
        y: memeCaption.y - 30,
        duration: 2000,
        onComplete: () => memeCaption.destroy(),
      });
    }

    // Screen shake
    this.cameras.main.shake(200, 0.01);
  }

  private spawnObstacle(building: Phaser.GameObjects.Rectangle): void {
    const buildingTop = building.y - building.height / 2;
    const obstacleType = Phaser.Math.RND.pick(['ac_unit', 'antenna', 'pipe']);

    let obstacle: Phaser.GameObjects.Rectangle;

    switch (obstacleType) {
      case 'ac_unit':
        obstacle = this.add.rectangle(
          building.x + Phaser.Math.Between(-building.width / 4, building.width / 4),
          buildingTop - 15,
          30,
          30,
          COLORS.obstacle
        );
        break;
      case 'antenna':
        obstacle = this.add.rectangle(
          building.x + Phaser.Math.Between(-building.width / 4, building.width / 4),
          buildingTop - 25,
          6,
          50,
          COLORS.obstaclePipe
        );
        break;
      case 'pipe':
      default:
        obstacle = this.add.rectangle(
          building.x + Phaser.Math.Between(-building.width / 4, building.width / 4),
          buildingTop - 10,
          40,
          20,
          COLORS.obstaclePipe
        );
        break;
    }

    // Make obstacle collidable
    this.physics.add.existing(obstacle, true);
    (obstacle as unknown as { parentBuilding: typeof building }).parentBuilding = building;
    this.obstacles.add(obstacle);
  }

  private spawnDrone(x: number, y: number): void {
    const drone = this.add.container(x, y);

    // Drone core body (hex-ish)
    const core = this.add.rectangle(0, 0, 26, 18, 0x222a33);
    const coreInner = this.add.rectangle(0, 0, 18, 10, COLORS.drone);
    drone.add(core);
    drone.add(coreInner);

    // Side arms
    const armL = this.add.rectangle(-22, 0, 10, 4, 0x445566);
    const armR = this.add.rectangle(22, 0, 10, 4, 0x445566);
    drone.add([armL, armR]);

    // Rotors
    const rotorL = this.add.circle(-28, 0, 7, 0x666666);
    const rotorR = this.add.circle(28, 0, 7, 0x666666);
    const rotorLInner = this.add.circle(-28, 0, 3, 0x999999);
    const rotorRInner = this.add.circle(28, 0, 3, 0x999999);
    drone.add([rotorL, rotorR, rotorLInner, rotorRInner]);

    // Camera eye + lens glow
    const cam = this.add.circle(8, 2, 4, 0xffffff);
    const camGlow = this.add.circle(8, 2, 7, 0xff2a6d).setAlpha(0.25);
    drone.add([camGlow, cam]);

    // Vision cone (triangle pointing down-left)
    const cone = this.add.triangle(-18, 22, 0, 0, 36, 30, 0, 30, COLORS.droneCone);
    cone.setAlpha(0.25);
    drone.add(cone);

    // Hover animation
    this.tweens.add({
      targets: drone,
      y: y - 10,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.physics.add.existing(drone);
    const droneBody = drone.body as Phaser.Physics.Arcade.Body;
    droneBody.setSize(60, 40);
    droneBody.setOffset(-30, -20);
    droneBody.setAllowGravity(false);

    this.drones.add(drone);
  }

  private spawnScrap(x: number, y: number): void {
    const scrap = this.add.circle(x, y, 8, COLORS.scrap);
    scrap.setAlpha(0.9);

    // Sparkle
    this.tweens.add({
      targets: scrap,
      scale: 1.2,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });

    this.physics.add.existing(scrap);
    const scrapBody = scrap.body as Phaser.Physics.Arcade.Body;
    scrapBody.setAllowGravity(false);

    this.scraps.add(scrap);
  }
}

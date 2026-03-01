import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

// Cyberpunk palette
const COLORS = {
  bg: 0x0a0a0f,
  building: 0x1a1a2e,
  buildingLight: 0x25253a,
  neonPink: 0xff2a6d,
  neonCyan: 0x05d9e8,
  neonPurple: 0xd300c5,
  cat: 0xffcc00,
  catEyes: 0x05d9e8,
  drone: 0xff0044,
  droneCone: 0xff0044,
  scrap: 0xffd700,
};

const GROUND_Y = GAME_HEIGHT - 100;
const CAT_X = 150;
const POUNCE_VELOCITY = -400;
const SCROLL_SPEED = 250;
const GAP_MIN = 80;
const GAP_MAX = 150;
const BUILDING_WIDTH_MIN = 120;
const BUILDING_WIDTH_MAX = 250;

export class RunnerScene extends Phaser.Scene {
  private cat!: Phaser.GameObjects.Container;
  private catBody!: Phaser.Physics.Arcade.Body;
  private buildings!: Phaser.GameObjects.Group;
  private drones!: Phaser.GameObjects.Group;
  private scraps!: Phaser.GameObjects.Group;
  private neonSigns!: Phaser.GameObjects.Group;

  private score = 0;
  private highScore = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOver = false;
  private started = false;

  private lastBuildingX = 0;
  private buildingPool: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super('RunnerScene');
  }

  create(): void {
    // Load high score
    this.highScore = parseInt(localStorage.getItem('robocat_highscore') || '0', 10);

    // Background gradient (fake with rectangles)
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a0f);

    // Distant city silhouette
    this.createBackgroundCity();

    // Groups
    this.buildings = this.add.group();
    this.drones = this.add.group();
    this.scraps = this.add.group();
    this.neonSigns = this.add.group();

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

    // Instructions
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 50, 'TAP or SPACE to pounce', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0.8);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Avoid drones. Collect scraps.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#888888',
      })
      .setOrigin(0.5)
      .setAlpha(0.6);

    // Input
    this.input.on('pointerdown', () => this.pounce());
    this.input.keyboard?.on('keydown-SPACE', () => this.pounce());

    // Collision
    this.physics.add.collider(this.cat, this.buildings);
    this.physics.add.overlap(this.cat, this.drones, () => this.onHitDrone());
    this.physics.add.overlap(this.cat, this.scraps, (_cat, scrap) => {
      this.onCollectScrap(scrap as Phaser.GameObjects.Arc);
    });
  }

  private createBackgroundCity(): void {
    // Parallax background buildings (non-interactive)
    for (let i = 0; i < 15; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const height = Phaser.Math.Between(100, 300);
      const width = Phaser.Math.Between(30, 80);
      const shade = Phaser.Math.Between(0x08, 0x15);
      const color = (shade << 16) | (shade << 8) | (shade + 0x10);

      this.add.rectangle(x, GAME_HEIGHT - height / 2, width, height, color).setAlpha(0.5);
    }
  }

  private createCat(): void {
    // Cat container (body + ears + eyes + tail)
    this.cat = this.add.container(CAT_X, GROUND_Y - 50);

    // Body
    const body = this.add.rectangle(0, 0, 40, 30, COLORS.cat);
    this.cat.add(body);

    // Head
    const head = this.add.rectangle(15, -15, 25, 20, COLORS.cat);
    this.cat.add(head);

    // Ears
    const earL = this.add.triangle(5, -30, 0, 10, 5, 0, 10, 10, COLORS.cat);
    const earR = this.add.triangle(20, -30, 0, 10, 5, 0, 10, 10, COLORS.cat);
    this.cat.add([earL, earR]);

    // Eyes (neon cyan)
    const eyeL = this.add.circle(10, -15, 3, COLORS.catEyes);
    const eyeR = this.add.circle(22, -15, 3, COLORS.catEyes);
    this.cat.add([eyeL, eyeR]);

    // Tail
    const tail = this.add.rectangle(-25, -5, 20, 6, COLORS.cat).setAngle(-20);
    this.cat.add(tail);

    // Physics
    this.physics.add.existing(this.cat);
    this.catBody = this.cat.body as Phaser.Physics.Arcade.Body;
    this.catBody.setSize(40, 40);
    this.catBody.setOffset(-20, -20);
    this.catBody.setCollideWorldBounds(false);
  }

  private spawnInitialBuildings(): void {
    let x = 0;
    while (x < GAME_WIDTH + 300) {
      const width = Phaser.Math.Between(BUILDING_WIDTH_MIN, BUILDING_WIDTH_MAX);
      const height = Phaser.Math.Between(80, 150);
      this.spawnBuilding(x + width / 2, height, width);
      x += width + Phaser.Math.Between(0, 30); // Slight gaps OK at start
    }
  }

  private spawnBuilding(x: number, height: number, width: number): Phaser.GameObjects.Rectangle {
    const y = GAME_HEIGHT - height / 2;

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

  private pounce(): void {
    if (this.gameOver) {
      this.restart();
      return;
    }

    if (!this.started) {
      this.started = true;
      // Remove instructions
      this.children.list
        .filter(
          (c) =>
            c instanceof Phaser.GameObjects.Text &&
            (c as Phaser.GameObjects.Text).text.includes('TAP')
        )
        .forEach((c) => c.destroy());
      this.children.list
        .filter(
          (c) =>
            c instanceof Phaser.GameObjects.Text &&
            (c as Phaser.GameObjects.Text).text.includes('Avoid')
        )
        .forEach((c) => c.destroy());
    }

    // Only pounce if on or near ground
    if (this.catBody.blocked.down || this.catBody.touching.down || this.cat.y > GROUND_Y - 80) {
      this.catBody.setVelocityY(POUNCE_VELOCITY);

      // Pounce animation - rotate cat
      this.tweens.add({
        targets: this.cat,
        angle: -15,
        duration: 100,
        yoyo: true,
        ease: 'Quad.easeOut',
      });

      // Trail particles
      this.createTrail();
    }
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

  private onLand(): void {
    // Reset rotation
    this.cat.setAngle(0);
  }

  private onHitDrone(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    // Flash screen red
    this.cameras.main.flash(200, 255, 0, 68);
    this.cameras.main.shake(200, 0.02);

    // Stop cat
    this.catBody.setVelocity(0, 0);
    this.catBody.setAllowGravity(false);

    // Update high score
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('robocat_highscore', String(this.highScore));
    }

    // Game over text
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'DETECTED', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ff2a6d',
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 20,
        `Score: ${this.score}  |  Best: ${this.highScore}`,
        {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#ffffff',
        }
      )
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'Tap to retry', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#888888',
      })
      .setOrigin(0.5);
  }

  private onCollectScrap(scrap: Phaser.GameObjects.Arc): void {
    const s = scrap;

    // Pop animation
    this.tweens.add({
      targets: s,
      scale: 1.5,
      alpha: 0,
      duration: 100,
      onComplete: () => s.destroy(),
    });

    this.score += 10;
    this.scoreText.setText(`SCORE: ${this.score}`);

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
  }

  private restart(): void {
    this.scene.restart();
  }

  update(_time: number, delta: number): void {
    if (!this.started || this.gameOver) return;

    const scrollDelta = (SCROLL_SPEED * delta) / 1000;

    // Scroll buildings
    this.buildings.getChildren().forEach((b) => {
      const building = b as Phaser.GameObjects.Rectangle;
      building.x -= scrollDelta;
      (building.body as Phaser.Physics.Arcade.StaticBody).x = building.x - building.width / 2;

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
        const dx = neon.x - neon.parentBuilding.x;
        neon.x = neon.parentBuilding.x + dx - scrollDelta + scrollDelta; // Stay relative
        neon.x -= scrollDelta;
      } else {
        neon.destroy();
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

    // Spawn new buildings
    while (this.lastBuildingX < GAME_WIDTH + 400) {
      const gap = Phaser.Math.Between(GAP_MIN, GAP_MAX);
      const width = Phaser.Math.Between(BUILDING_WIDTH_MIN, BUILDING_WIDTH_MAX);
      const height = Phaser.Math.Between(80, 180);
      const x = this.lastBuildingX + gap + width / 2;
      this.spawnBuilding(x, height, width);

      // Maybe spawn drone
      if (Math.random() < 0.3 && this.score > 5) {
        this.spawnDrone(x, GAME_HEIGHT - height - 60);
      }

      // Maybe spawn scrap
      if (Math.random() < 0.4) {
        this.spawnScrap(x - width / 4, GAME_HEIGHT - height - 40);
      }
    }

    // Check if cat fell
    if (this.cat.y > GAME_HEIGHT + 50) {
      this.onHitDrone(); // Same death handling
    }

    // Neon pulse
    this.neonSigns.getChildren().forEach((n, i) => {
      const neon = n as Phaser.GameObjects.Rectangle;
      neon.setAlpha(0.6 + Math.sin(Date.now() / 200 + i) * 0.3);
    });
  }

  private spawnDrone(x: number, y: number): void {
    const drone = this.add.container(x, y);

    // Drone body
    const body = this.add.rectangle(0, 0, 30, 15, COLORS.drone);
    drone.add(body);

    // Eye
    const eye = this.add.circle(8, 0, 4, 0xffffff);
    drone.add(eye);

    // Vision cone (triangle pointing down-left)
    const cone = this.add.triangle(-20, 20, 0, 0, 40, 30, 0, 30, COLORS.droneCone);
    cone.setAlpha(0.3);
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
    droneBody.setSize(50, 50);
    droneBody.setOffset(-25, -25);
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

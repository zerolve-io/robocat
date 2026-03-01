import Phaser from 'phaser';

const SPEED = 180;
const SIZE = 16;

export class RoboCat {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create a green rectangle texture for the cat
    const gfx = scene.make.graphics({ x: 0, y: 0 });
    gfx.fillStyle(0x00ff88, 1);
    gfx.fillRect(0, 0, SIZE, SIZE);
    // Eyes
    gfx.fillStyle(0x0a0a0f, 1);
    gfx.fillRect(3, 4, 3, 3);
    gfx.fillRect(10, 4, 3, 3);
    // Ears
    gfx.fillStyle(0x00cc66, 1);
    gfx.fillTriangle(0, 0, 4, 0, 2, -4);
    gfx.fillTriangle(12, 0, 16, 0, 14, -4);
    gfx.generateTexture('robocat', SIZE, SIZE);
    gfx.destroy();

    this.sprite = scene.physics.add.sprite(x, y, 'robocat');
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);

    if (scene.input.keyboard) {
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.wasd = {
        up: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  update(_delta: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;

    if (this.cursors?.left.isDown || this.wasd?.left.isDown) vx = -SPEED;
    else if (this.cursors?.right.isDown || this.wasd?.right.isDown) vx = SPEED;

    if (this.cursors?.up.isDown || this.wasd?.up.isDown) vy = -SPEED;
    else if (this.cursors?.down.isDown || this.wasd?.down.isDown) vy = SPEED;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const factor = 1 / Math.SQRT2;
      vx *= factor;
      vy *= factor;
    }

    body.setVelocity(vx, vy);

    // Rotate slightly based on movement direction for visual flair
    if (vx !== 0 || vy !== 0) {
      this.sprite.setAngle(this.sprite.angle + (vx > 0 ? 2 : vx < 0 ? -2 : 0));
    } else {
      this.sprite.setAngle(0);
    }
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
}

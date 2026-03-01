import Phaser from 'phaser';

export type HackResult = 'success' | 'fail' | 'timeout';

const HACK_TIME = 2000; // ms
const SEQUENCE_LENGTH = 3;
const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;
type Direction = (typeof DIRECTIONS)[number];

const DIR_SYMBOLS: Record<Direction, string> = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
};

const DIR_KEYS: Record<string, Direction> = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
};

export class HackMinigame {
  private scene: Phaser.Scene;
  private sequence: Direction[] = [];
  private playerInput: Direction[] = [];
  private container!: Phaser.GameObjects.Container;
  private timer!: Phaser.Time.TimerEvent;
  private timerBar!: Phaser.GameObjects.Rectangle;
  private symbols: Phaser.GameObjects.Text[] = [];
  private onComplete!: (result: HackResult) => void;
  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private active = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(callback: (result: HackResult) => void): void {
    if (this.active) return;
    this.active = true;
    this.onComplete = callback;
    this.playerInput = [];

    // Generate random sequence
    this.sequence = Array.from({ length: SEQUENCE_LENGTH }, () => {
      return DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    });

    this.buildUI();
    this.bindKeys();

    // Timeout timer
    this.timer = this.scene.time.addEvent({
      delay: HACK_TIME,
      callback: () => this.finish('timeout'),
    });
  }

  private buildUI(): void {
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2;

    const bg = this.scene.add.rectangle(0, 0, 260, 110, 0x000000, 0.85).setStrokeStyle(2, 0x00ffff);

    const title = this.scene.add
      .text(0, -38, 'TAIL HACK', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#00ffff',
      })
      .setOrigin(0.5);

    const hint = this.scene.add
      .text(0, -18, 'Enter the sequence:', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.symbols = this.sequence.map((dir, i) => {
      return this.scene.add
        .text(-60 + i * 60, 10, DIR_SYMBOLS[dir], {
          fontFamily: 'monospace',
          fontSize: '28px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    });

    // Timer bar background
    const timerBg = this.scene.add.rectangle(0, 40, 200, 8, 0x333333).setOrigin(0.5, 0.5);
    this.timerBar = this.scene.add.rectangle(-100, 40, 200, 8, 0x00ffff).setOrigin(0, 0.5);

    this.container = this.scene.add.container(cx, cy, [
      bg,
      title,
      hint,
      ...this.symbols,
      timerBg,
      this.timerBar,
    ]);
    this.container.setDepth(200);
  }

  private bindKeys(): void {
    if (!this.scene.input.keyboard) return;
    this.keys = {
      up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    };

    this.keys.up.on('down', () => this.handleInput('UP'));
    this.keys.down.on('down', () => this.handleInput('DOWN'));
    this.keys.left.on('down', () => this.handleInput('LEFT'));
    this.keys.right.on('down', () => this.handleInput('RIGHT'));
  }

  private handleInput(dir: string): void {
    if (!this.active) return;
    const direction = DIR_KEYS[dir];
    if (!direction) return;

    this.playerInput.push(direction);
    const idx = this.playerInput.length - 1;

    if (this.playerInput[idx] !== this.sequence[idx]) {
      // Wrong input
      this.symbols[idx]?.setColor('#ff0000');
      this.finish('fail');
      return;
    }

    // Correct input — highlight green
    this.symbols[idx]?.setColor('#00ff88');

    if (this.playerInput.length === SEQUENCE_LENGTH) {
      this.finish('success');
    }
  }

  update(): void {
    if (!this.active || !this.timer) return;
    const progress = 1 - this.timer.getProgress();
    this.timerBar.width = 200 * progress;
    // Color warning near timeout
    if (progress < 0.3) {
      this.timerBar.fillColor = 0xff4400;
    }
  }

  private finish(result: HackResult): void {
    if (!this.active) return;
    this.active = false;

    if (this.timer) this.timer.remove();
    this.unbindKeys();

    // Brief delay before destroying UI
    this.scene.time.delayedCall(400, () => {
      this.container?.destroy();
    });

    this.onComplete(result);
  }

  private unbindKeys(): void {
    if (!this.keys) return;
    this.keys.up.removeAllListeners();
    this.keys.down.removeAllListeners();
    this.keys.left.removeAllListeners();
    this.keys.right.removeAllListeners();
  }

  get isActive(): boolean {
    return this.active;
  }
}

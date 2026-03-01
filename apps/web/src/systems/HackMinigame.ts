import Phaser from 'phaser';

export type HackResult = 'success' | 'fail' | 'timeout';

const HACK_TIME = 2000;
const DEFAULT_SEQUENCE_LENGTH = 3;
const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;
type Direction = (typeof DIRECTIONS)[number];

const DIR_SYMBOLS: Record<Direction, string> = {
  UP: '\u2191',
  DOWN: '\u2193',
  LEFT: '\u2190',
  RIGHT: '\u2192',
};
const DIR_KEYS: Record<string, Direction> = {
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
};

export interface HackMinigameOptions {
  sequenceLength?: number;
  timeLimit?: number;
  title?: string;
}

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
  private sequenceLength = DEFAULT_SEQUENCE_LENGTH;
  private hackTime = HACK_TIME;
  private hackTitle = 'TAIL HACK';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(callback: (result: HackResult) => void, options?: HackMinigameOptions): void {
    if (this.active) return;
    this.active = true;
    this.onComplete = callback;
    this.playerInput = [];
    this.sequenceLength = options?.sequenceLength ?? DEFAULT_SEQUENCE_LENGTH;
    this.hackTime = options?.timeLimit ?? HACK_TIME;
    this.hackTitle = options?.title ?? 'TAIL HACK';

    this.sequence = Array.from({ length: this.sequenceLength }, () => {
      return DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    });

    this.buildUI();
    this.bindKeys();

    this.timer = this.scene.time.addEvent({
      delay: this.hackTime,
      callback: () => this.finish('timeout'),
    });
  }

  private buildUI(): void {
    const cx = this.scene.scale.width / 2;
    const cy = this.scene.scale.height / 2;
    const boxW = Math.max(260, 60 + this.sequenceLength * 60);
    const bg = this.scene.add
      .rectangle(0, 0, boxW, 110, 0x000000, 0.85)
      .setStrokeStyle(2, 0x00ffff);
    const title = this.scene.add
      .text(0, -38, this.hackTitle, { fontFamily: 'monospace', fontSize: '14px', color: '#00ffff' })
      .setOrigin(0.5);
    const hint = this.scene.add
      .text(0, -18, 'Enter the sequence:', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
    const spacing = Math.min(60, Math.floor((boxW - 40) / this.sequenceLength));
    const startX = -((this.sequenceLength - 1) * spacing) / 2;
    this.symbols = this.sequence.map((dir, i) => {
      return this.scene.add
        .text(startX + i * spacing, 10, DIR_SYMBOLS[dir], {
          fontFamily: 'monospace',
          fontSize: '28px',
          color: '#ffffff',
        })
        .setOrigin(0.5);
    });
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
      this.symbols[idx]?.setColor('#ff0000');
      this.finish('fail');
      return;
    }
    this.symbols[idx]?.setColor('#00ff88');
    if (this.playerInput.length === this.sequenceLength) this.finish('success');
  }

  update(): void {
    if (!this.active || !this.timer) return;
    const progress = 1 - this.timer.getProgress();
    this.timerBar.width = 200 * progress;
    if (progress < 0.3) this.timerBar.fillColor = 0xff4400;
  }

  private finish(result: HackResult): void {
    if (!this.active) return;
    this.active = false;
    if (this.timer) this.timer.remove();
    this.unbindKeys();
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

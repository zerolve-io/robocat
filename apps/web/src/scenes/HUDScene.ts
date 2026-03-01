import Phaser from 'phaser';

export const HUD_ATTENTION_KEY = 'hud-attention';

export class HUDScene extends Phaser.Scene {
  private barBg!: Phaser.GameObjects.Rectangle;
  private barFill!: Phaser.GameObjects.Rectangle;
  private label!: Phaser.GameObjects.Text;

  private readonly BAR_W = 300;
  private readonly BAR_H = 16;
  private readonly BAR_X = 20;
  private readonly BAR_Y = 16;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    // Semi-transparent background strip
    this.add.rectangle(0, 0, 800, 48, 0x000000, 0.6).setOrigin(0, 0);

    // Label
    this.label = this.add.text(this.BAR_X, this.BAR_Y - 2, 'ATTENTION', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0, 1);

    // Bar background
    this.barBg = this.add.rectangle(
      this.BAR_X,
      this.BAR_Y + 4,
      this.BAR_W,
      this.BAR_H,
      0x222244
    ).setOrigin(0, 0);

    // Bar fill (cyan → red depending on level)
    this.barFill = this.add.rectangle(
      this.BAR_X,
      this.BAR_Y + 4,
      0,
      this.BAR_H,
      0x00ffff
    ).setOrigin(0, 0);

    // Border
    const border = this.add.graphics();
    border.lineStyle(1, 0x00ffff, 0.4);
    border.strokeRect(this.BAR_X, this.BAR_Y + 4, this.BAR_W, this.BAR_H);

    // Bind to attention system updates
    this.game.events.on(HUD_ATTENTION_KEY, (level: number) => {
      this.setAttention(level);
    });
  }

  private setAttention(level: number): void {
    // level is 0–1
    const w = Math.floor(this.BAR_W * level);
    this.barFill.width = w;

    // Color: cyan (low) → yellow (mid) → red (high)
    let color: number;
    if (level < 0.5) {
      // cyan → yellow
      const t = level / 0.5;
      const r = Math.round(0x00 + t * 0xff);
      const g = 0xff;
      const b = Math.round(0xff - t * 0xff);
      color = (r << 16) | (g << 8) | b;
    } else {
      // yellow → red
      const t = (level - 0.5) / 0.5;
      const r = 0xff;
      const g = Math.round(0xff - t * 0xff);
      color = (r << 16) | (g << 8) | 0;
    }
    this.barFill.fillColor = color;

    // Flash label when full
    if (level >= 1.0) {
      this.label.setColor('#ff0000');
      this.label.setText('⚠ DETECTED');
    } else if (level > 0) {
      this.label.setColor('#ffff00');
      this.label.setText('ATTENTION');
    } else {
      this.label.setColor('#888888');
      this.label.setText('ATTENTION');
    }
  }
}

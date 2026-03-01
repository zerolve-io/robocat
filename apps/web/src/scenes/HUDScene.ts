import Phaser from 'phaser';

export const HUD_ATTENTION_KEY = 'hud-attention';
export const HUD_PURR_KEY = 'hud-purr';
export const HUD_SCORE_KEY = 'hud-score';
export const HUD_POUNCE_COOLDOWN_KEY = 'hud-pounce-cooldown';

export class HUDScene extends Phaser.Scene {
  // Attention bar
  private attentionBarBg!: Phaser.GameObjects.Rectangle;
  private attentionBarFill!: Phaser.GameObjects.Rectangle;
  private attentionLabel!: Phaser.GameObjects.Text;

  // Purr energy bar
  private purrBarBg!: Phaser.GameObjects.Rectangle;
  private purrBarFill!: Phaser.GameObjects.Rectangle;
  private purrLabel!: Phaser.GameObjects.Text;

  // Score
  private scoreText!: Phaser.GameObjects.Text;

  // Pounce cooldown indicator
  private pounceIcon!: Phaser.GameObjects.Graphics;
  private pounceLabel!: Phaser.GameObjects.Text;

  // Control hints
  private hints!: Phaser.GameObjects.Text;

  private readonly BAR_W = 200;
  private readonly BAR_H = 12;
  private readonly BAR_X = 16;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    // ── Top-left panel background ──────────────────────────────────────────
    this.add.rectangle(0, 0, 280, 72, 0x000000, 0.65).setOrigin(0, 0);

    // ── Attention bar ──────────────────────────────────────────────────────
    const attY = 14;
    this.attentionLabel = this.add
      .text(this.BAR_X, attY - 1, 'ATTENTION', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#888888',
      })
      .setOrigin(0, 1);

    this.attentionBarBg = this.add
      .rectangle(this.BAR_X, attY + 2, this.BAR_W, this.BAR_H, 0x222244)
      .setOrigin(0, 0);

    this.attentionBarFill = this.add
      .rectangle(this.BAR_X, attY + 2, 0, this.BAR_H, 0x00ffff)
      .setOrigin(0, 0);

    const attBorder = this.add.graphics();
    attBorder.lineStyle(1, 0x00ffff, 0.4);
    attBorder.strokeRect(this.BAR_X, attY + 2, this.BAR_W, this.BAR_H);

    // ── Purr energy bar ────────────────────────────────────────────────────
    const purrY = attY + this.BAR_H + 14;
    this.purrLabel = this.add
      .text(this.BAR_X, purrY - 1, 'PURR ENERGY', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#9966ff',
      })
      .setOrigin(0, 1);

    this.purrBarBg = this.add
      .rectangle(this.BAR_X, purrY + 2, this.BAR_W, this.BAR_H, 0x221133)
      .setOrigin(0, 0);

    this.purrBarFill = this.add
      .rectangle(this.BAR_X, purrY + 2, this.BAR_W, this.BAR_H, 0x9966ff)
      .setOrigin(0, 0);

    const purrBorder = this.add.graphics();
    purrBorder.lineStyle(1, 0x9966ff, 0.4);
    purrBorder.strokeRect(this.BAR_X, purrY + 2, this.BAR_W, this.BAR_H);

    // ── Pounce cooldown indicator ──────────────────────────────────────────
    const pounceX = this.BAR_X + this.BAR_W + 16;
    const pounceY = 16;
    this.pounceIcon = this.add.graphics();
    this.pounceIcon.setDepth(100);
    this.drawPounceIcon(1); // start ready

    this.pounceLabel = this.add
      .text(pounceX, pounceY + 18, 'Q', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#00ff88',
      })
      .setOrigin(0.5, 0);

    // ── Score (top right) ──────────────────────────────────────────────────
    this.scoreText = this.add
      .text(W - 16, 16, 'SCORE: 0', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#00ffcc',
      })
      .setOrigin(1, 0);

    // ── Control hints (bottom) ─────────────────────────────────────────────
    const hintBg = this.add.rectangle(0, H, W, 22, 0x000000, 0.7).setOrigin(0, 1);
    hintBg.setDepth(99);

    this.hints = this.add
      .text(W / 2, H - 4, 'WASD Move  |  Q Pounce  |  Shift Wall-run  |  E Hack  |  Space Purr', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#556677',
      })
      .setOrigin(0.5, 1)
      .setDepth(100);

    // ── Event bindings ─────────────────────────────────────────────────────
    this.game.events.on(HUD_ATTENTION_KEY, (level: number) => {
      this.setAttention(level);
    });

    this.game.events.on(HUD_PURR_KEY, (energy: number) => {
      this.setPurrEnergy(energy);
    });

    this.game.events.on(HUD_SCORE_KEY, (score: number) => {
      this.scoreText.setText(`SCORE: ${score}`);
    });

    this.game.events.on(HUD_POUNCE_COOLDOWN_KEY, (ratio: number) => {
      this.drawPounceIcon(1 - ratio);
    });
  }

  private drawPounceIcon(readyRatio: number): void {
    // readyRatio 0 = just used (gray), 1 = ready (green)
    const pounceX = this.BAR_X + this.BAR_W + 32;
    const pounceY = 22;
    const radius = 9;

    this.pounceIcon.clear();

    // Background circle (dark)
    this.pounceIcon.fillStyle(0x222222, 0.8);
    this.pounceIcon.fillCircle(pounceX, pounceY, radius);

    // Progress arc
    const color = readyRatio >= 1 ? 0x00ff88 : 0x446644;
    this.pounceIcon.lineStyle(2.5, color, readyRatio >= 1 ? 1 : 0.5);
    if (readyRatio >= 1) {
      this.pounceIcon.strokeCircle(pounceX, pounceY, radius);
    } else {
      // Draw filled arc for cooldown progress
      this.pounceIcon.beginPath();
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + readyRatio * Math.PI * 2;
      this.pounceIcon.arc(pounceX, pounceY, radius, startAngle, endAngle, false);
      this.pounceIcon.strokePath();
    }

    // Arrow icon inside
    this.pounceIcon.fillStyle(readyRatio >= 1 ? 0x00ff88 : 0x445544, 1);
    this.pounceIcon.fillTriangle(
      pounceX - 4,
      pounceY + 3,
      pounceX - 4,
      pounceY - 3,
      pounceX + 5,
      pounceY
    );
  }

  private setAttention(level: number): void {
    const w = Math.floor(this.BAR_W * level);
    this.attentionBarFill.width = w;

    let color: number;
    if (level < 0.5) {
      const t = level / 0.5;
      const r = Math.round(0x00 + t * 0xff);
      const g = 0xff;
      const b = Math.round(0xff - t * 0xff);
      color = (r << 16) | (g << 8) | b;
    } else {
      const t = (level - 0.5) / 0.5;
      const r = 0xff;
      const g = Math.round(0xff - t * 0xff);
      color = (r << 16) | (g << 8) | 0;
    }
    this.attentionBarFill.fillColor = color;

    if (level >= 1.0) {
      this.attentionLabel.setColor('#ff0000');
      this.attentionLabel.setText('⚠ DETECTED');
    } else if (level > 0) {
      this.attentionLabel.setColor('#ffff00');
      this.attentionLabel.setText('ATTENTION');
    } else {
      this.attentionLabel.setColor('#888888');
      this.attentionLabel.setText('ATTENTION');
    }
  }

  private setPurrEnergy(energy: number): void {
    this.purrBarFill.width = Math.floor(this.BAR_W * energy);

    if (energy < 0.25) {
      this.purrLabel.setColor('#ff4488');
      this.purrBarFill.fillColor = 0xff4488;
    } else {
      this.purrLabel.setColor('#9966ff');
      this.purrBarFill.fillColor = 0x9966ff;
    }
  }
}

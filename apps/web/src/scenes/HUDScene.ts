import Phaser from 'phaser';
import type { PatrolObjective } from '../systems/ObjectiveSystem';

export const HUD_ATTENTION_KEY = 'hud-attention';
export const HUD_PURR_KEY = 'hud-purr';
export const HUD_SCORE_KEY = 'hud-score';
export const HUD_POUNCE_COOLDOWN_KEY = 'hud-pounce-cooldown';
export const HUD_SCRAPS_KEY = 'hud-scraps';
export const HUD_TIMER_KEY = 'hud-timer';
export const HUD_OBJECTIVES_KEY = 'hud-objectives';
export const HUD_SEED_KEY = 'hud-seed';
export const HUD_INTERACTION_KEY = 'hud-interaction';

export class HUDScene extends Phaser.Scene {
  private attentionBarBg!: Phaser.GameObjects.Rectangle;
  private attentionBarFill!: Phaser.GameObjects.Rectangle;
  private attentionLabel!: Phaser.GameObjects.Text;

  private purrBarBg!: Phaser.GameObjects.Rectangle;
  private purrBarFill!: Phaser.GameObjects.Rectangle;
  private purrLabel!: Phaser.GameObjects.Text;

  private scoreText!: Phaser.GameObjects.Text;
  private scrapsText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private seedText!: Phaser.GameObjects.Text;

  private objectiveContainer!: Phaser.GameObjects.Container;
  private objectiveTexts: Phaser.GameObjects.Text[] = [];
  private objectiveBg!: Phaser.GameObjects.Rectangle;

  private interactionText!: Phaser.GameObjects.Text;

  private pounceIcon!: Phaser.GameObjects.Graphics;
  private pounceLabel!: Phaser.GameObjects.Text;

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

    // Top-left panel
    this.add.rectangle(0, 0, 280, 72, 0x000000, 0.65).setOrigin(0, 0);

    // Attention bar
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

    // Purr energy bar
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

    // Pounce cooldown
    this.pounceIcon = this.add.graphics();
    this.pounceIcon.setDepth(100);
    this.drawPounceIcon(1);
    const pounceX = this.BAR_X + this.BAR_W + 32;
    const pounceY = 22 + 18;
    this.pounceLabel = this.add
      .text(pounceX, pounceY, 'Q', { fontFamily: 'monospace', fontSize: '8px', color: '#00ff88' })
      .setOrigin(0.5, 0);

    // Score (top right)
    this.scoreText = this.add
      .text(W - 16, 16, 'SCORE: 0', { fontFamily: 'monospace', fontSize: '13px', color: '#00ffcc' })
      .setOrigin(1, 0);

    // Scraps (top right, below score)
    this.add
      .rectangle(W - 90, 34, 88, 18, 0x000000, 0.6)
      .setOrigin(0, 0)
      .setDepth(50);
    this.scrapsText = this.add
      .text(W - 16, 40, '\u2B21 0 scraps', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffdd44',
      })
      .setOrigin(1, 0)
      .setDepth(51);

    // Patrol timer (top center)
    this.add
      .rectangle(W / 2, 0, 120, 24, 0x000000, 0.7)
      .setOrigin(0.5, 0)
      .setDepth(50);
    this.timerText = this.add
      .text(W / 2, 4, '00:00', { fontFamily: 'monospace', fontSize: '15px', color: '#88ccff' })
      .setOrigin(0.5, 0)
      .setDepth(51);

    // Objective checklist (left side)
    const objY = 80;
    this.objectiveBg = this.add.rectangle(0, objY, 280, 80, 0x000000, 0.6).setOrigin(0, 0);
    this.objectiveBg.setDepth(50);
    this.objectiveContainer = this.add.container(0, objY);
    this.objectiveContainer.setDepth(51);
    this.objectiveTexts = [];

    // Seed display (bottom left)
    this.seedText = this.add
      .text(8, H - 22, 'seed: ---', { fontFamily: 'monospace', fontSize: '8px', color: '#334455' })
      .setOrigin(0, 1)
      .setDepth(51);

    // Interaction hint (center bottom)
    this.interactionText = this.add
      .text(W / 2, H - 28, '', { fontFamily: 'monospace', fontSize: '10px', color: '#aaffcc' })
      .setOrigin(0.5, 1)
      .setDepth(100);

    // Control hints bar
    this.add.rectangle(0, H, W, 22, 0x000000, 0.7).setOrigin(0, 1).setDepth(99);
    this.hints = this.add
      .text(
        W / 2,
        H - 4,
        'WASD Move  |  Q Pounce  |  Shift Wall-run  |  E Interact  |  Space Purr',
        {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#556677',
        }
      )
      .setOrigin(0.5, 1)
      .setDepth(100);

    // Events
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
    this.game.events.on(HUD_SCRAPS_KEY, (scraps: number) => {
      this.scrapsText.setText(`\u2B21 ${scraps} scraps`);
    });
    this.game.events.on(HUD_TIMER_KEY, (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      this.timerText.setText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    });
    this.game.events.on(HUD_OBJECTIVES_KEY, (objectives: PatrolObjective[]) => {
      this.updateObjectiveChecklist(objectives);
    });
    this.game.events.on(HUD_SEED_KEY, (seed: number | string) => {
      this.seedText.setText(`seed: ${seed}`);
    });
    this.game.events.on(HUD_INTERACTION_KEY, (text: string) => {
      this.interactionText.setText(text ?? '');
    });
  }

  private updateObjectiveChecklist(objectives: PatrolObjective[]): void {
    for (const t of this.objectiveTexts) t.destroy();
    this.objectiveTexts = [];
    this.objectiveContainer.removeAll(false);

    const lineH = 18;
    const totalH = 16 + objectives.length * lineH;
    this.objectiveBg.setSize(280, totalH);

    const header = this.add
      .text(this.BAR_X, 6, 'OBJECTIVES', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#556677',
      })
      .setOrigin(0, 0);
    this.objectiveContainer.add(header);
    this.objectiveTexts.push(header);

    objectives.forEach((obj, i) => {
      const icon = obj.completed ? '\u2713' : '\u2610';
      const color = obj.completed ? '#00ff88' : '#ccddee';
      const title = obj.title.length > 28 ? obj.title.slice(0, 27) + '\u2026' : obj.title;
      const text = this.add
        .text(this.BAR_X, 16 + i * lineH, `${icon} ${title}`, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color,
        })
        .setOrigin(0, 0);
      this.objectiveContainer.add(text);
      this.objectiveTexts.push(text);
    });
  }

  private drawPounceIcon(readyRatio: number): void {
    const pounceX = this.BAR_X + this.BAR_W + 32;
    const pounceY = 22;
    const radius = 9;
    this.pounceIcon.clear();
    this.pounceIcon.fillStyle(0x222222, 0.8);
    this.pounceIcon.fillCircle(pounceX, pounceY, radius);
    const color = readyRatio >= 1 ? 0x00ff88 : 0x446644;
    this.pounceIcon.lineStyle(2.5, color, readyRatio >= 1 ? 1 : 0.5);
    if (readyRatio >= 1) {
      this.pounceIcon.strokeCircle(pounceX, pounceY, radius);
    } else {
      this.pounceIcon.beginPath();
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + readyRatio * Math.PI * 2;
      this.pounceIcon.arc(pounceX, pounceY, radius, startAngle, endAngle, false);
      this.pounceIcon.strokePath();
    }
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
      const r = Math.round(t * 0xff);
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
      this.attentionLabel.setText('\u26a0 DETECTED');
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

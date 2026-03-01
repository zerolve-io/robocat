import Phaser from 'phaser';
import { RunnerScene } from './scenes/RunnerScene';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0a0f',
  antialias: false,
  pixelArt: true,
  roundPixels: true,
  powerPreference: 'high-performance',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 600 },
      debug: false,
    },
  },
  scene: [RunnerScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

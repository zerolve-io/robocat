import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PatrolScene } from './scenes/PatrolScene';
import { HUDScene } from './scenes/HUDScene';

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0a0f',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PatrolScene, HUDScene],
};

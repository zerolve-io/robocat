import Phaser from 'phaser';

export const GAME_WIDTH = typeof window !== 'undefined' ? window.innerWidth : 800;
export const GAME_HEIGHT = typeof window !== 'undefined' ? window.innerHeight : 600;

/**
 * Base Phaser config WITHOUT scene — scene is added in main.ts
 * to avoid circular dependency (RunnerScene imports GAME_WIDTH/HEIGHT from here).
 */
export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a0a0f',
  antialias: true,
  powerPreference: 'high-performance',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 600 },
      debug: false,
    },
  },
  scene: [],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

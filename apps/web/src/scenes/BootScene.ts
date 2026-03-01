import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // No external assets — all graphics are drawn programmatically.
    // This scene is kept minimal for future asset loading.
  }

  create(): void {
    this.scene.start('PatrolScene');
  }
}

import Phaser from 'phaser';
import { Drone } from '../entities/Drone';
import { HUD_ATTENTION_KEY } from '../scenes/HUDScene';

const RISE_RATE = 0.6; // units per second while in cone
const FALL_RATE = 0.35; // units per second while hidden

export class AttentionSystem {
  private level = 0; // 0–1
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(catSprite: Phaser.Physics.Arcade.Sprite, drone: Drone, delta: number): void {
    const dt = delta / 1000;
    const inCone = drone.isInVisionCone(catSprite.x, catSprite.y);

    if (inCone) {
      this.level = Math.min(1, this.level + RISE_RATE * dt);
    } else {
      this.level = Math.max(0, this.level - FALL_RATE * dt);
    }

    // Broadcast to HUD
    this.scene.game.events.emit(HUD_ATTENTION_KEY, this.level);
  }

  get attentionLevel(): number {
    return this.level;
  }
}

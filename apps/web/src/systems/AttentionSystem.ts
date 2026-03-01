import Phaser from 'phaser';
import { Drone, AlertState } from '../entities/Drone';
import { HUD_ATTENTION_KEY } from '../scenes/HUDScene';

const RISE_RATE = 0.6; // units per second while in cone
const FALL_RATE = 0.35; // units per second while hidden

export class AttentionSystem {
  private level = 0; // 0-1
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Legacy single-drone update — delegates to multi-drone version. */
  update(catSprite: Phaser.Physics.Arcade.Sprite, drone: Drone, delta: number): void {
    this.updateMulti(catSprite, [drone], delta);
  }

  updateMulti(catSprite: Phaser.Physics.Arcade.Sprite, drones: Drone[], delta: number): void {
    const dt = delta / 1000;

    let anySees = false;
    for (const drone of drones) {
      if (drone.isDormant) continue;
      const inCone = drone.isInVisionCone(catSprite.x, catSprite.y);
      drone.setDetecting(inCone);
      if (inCone) anySees = true;
    }

    if (anySees) {
      this.level = Math.min(1, this.level + RISE_RATE * dt);
    } else {
      this.level = Math.max(0, this.level - FALL_RATE * dt);
    }

    this.scene.game.events.emit(HUD_ATTENTION_KEY, this.level);
  }

  bump(amount: number): void {
    this.level = Math.min(1, this.level + amount);
  }

  get attentionLevel(): number {
    return this.level;
  }

  /** Get the highest alert state across all active drones. */
  static getHighestAlert(drones: Drone[]): AlertState | null {
    const priority = [
      AlertState.CHASING,
      AlertState.ALARMED,
      AlertState.SUSPICIOUS,
      AlertState.UNAWARE,
    ];
    for (const p of priority) {
      if (drones.some((d) => !d.isDormant && d.alertState === p)) return p;
    }
    return null;
  }
}

// ─── Factions ────────────────────────────────────────────────────────────────
export type Faction = 'corp' | 'street' | 'neutral';

// ─── City tile types ─────────────────────────────────────────────────────────
export type TileType = 'building' | 'path' | 'neon' | 'empty';

export interface CityBlock {
  x: number;
  y: number;
  width: number;
  height: number;
  faction: Faction;
}

// ─── Objectives ──────────────────────────────────────────────────────────────
export type ObjectiveStatus = 'pending' | 'active' | 'complete' | 'failed';

export interface Objective {
  id: string;
  title: string;
  description: string;
  status: ObjectiveStatus;
  faction: Faction;
  rewardCredits: number;
}

// ─── Upgrades ─────────────────────────────────────────────────────────────────
export type UpgradeId =
  | 'stealth_cloak'
  | 'emp_pulse'
  | 'speed_boost'
  | 'sensor_jam'
  | 'double_jump';

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
  currentLevel: number;
}

// ─── Patrol Config (returned by seed functions) ───────────────────────────────
export interface PatrolPoint {
  x: number;
  y: number;
}

export interface PatrolConfig {
  points: PatrolPoint[];
  speed: number;
  visionAngle: number; // radians
  visionRange: number; // pixels
}

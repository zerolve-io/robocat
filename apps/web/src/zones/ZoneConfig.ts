// Zone definitions for progressive difficulty
export interface ZoneConfig {
  name: string;
  color: {
    building: number;
    neonAccents: number[];
    bgTint: number;
  };
  scrollSpeedBase: number;
  scrollSpeedCap: number;
  gapMin: number;
  gapMax: number;
  buildingWidthMin: number;
  buildingWidthMax: number;
  buildingHeightMin: number;
  buildingHeightMax: number;
  droneChance: number;
  scrapChance: number;
  obstacleChance: number; // rooftop obstacles (AC units, antennas)
  scoreThreshold: number; // score needed to enter this zone
}

export const ZONES: ZoneConfig[] = [
  {
    name: 'NEON CITY',
    color: {
      building: 0x1a1a2e,
      neonAccents: [0xff2a6d, 0x05d9e8, 0xd300c5],
      bgTint: 0x0a0a0f,
    },
    scrollSpeedBase: 220,
    scrollSpeedCap: 350,
    gapMin: 5,
    gapMax: 25,
    buildingWidthMin: 180,
    buildingWidthMax: 300,
    buildingHeightMin: 150,
    buildingHeightMax: 170,
    droneChance: 0,
    scrapChance: 0.4,
    obstacleChance: 0,
    scoreThreshold: 0,
  },
  {
    name: 'DOWNTOWN',
    color: {
      building: 0x1e1e3a,
      neonAccents: [0xff2a6d, 0x05d9e8, 0x00ff88],
      bgTint: 0x0c0c14,
    },
    scrollSpeedBase: 260,
    scrollSpeedCap: 400,
    gapMin: 15,
    gapMax: 45,
    buildingWidthMin: 150,
    buildingWidthMax: 280,
    buildingHeightMin: 130,
    buildingHeightMax: 190,
    droneChance: 0.1,
    scrapChance: 0.45,
    obstacleChance: 0.15,
    scoreThreshold: 15,
  },
  {
    name: 'INDUSTRIAL',
    color: {
      building: 0x1a1a25,
      neonAccents: [0xff6600, 0xff2a6d, 0xffcc00],
      bgTint: 0x0a0a10,
    },
    scrollSpeedBase: 300,
    scrollSpeedCap: 450,
    gapMin: 25,
    gapMax: 65,
    buildingWidthMin: 120,
    buildingWidthMax: 260,
    buildingHeightMin: 120,
    buildingHeightMax: 210,
    droneChance: 0.2,
    scrapChance: 0.5,
    obstacleChance: 0.25,
    scoreThreshold: 40,
  },
  {
    name: 'SKYLINE',
    color: {
      building: 0x151530,
      neonAccents: [0xd300c5, 0x05d9e8, 0xff2a6d],
      bgTint: 0x080815,
    },
    scrollSpeedBase: 340,
    scrollSpeedCap: 500,
    gapMin: 35,
    gapMax: 80,
    buildingWidthMin: 100,
    buildingWidthMax: 240,
    buildingHeightMin: 100,
    buildingHeightMax: 240,
    droneChance: 0.3,
    scrapChance: 0.5,
    obstacleChance: 0.35,
    scoreThreshold: 80,
  },
];

export function getZoneForScore(score: number): ZoneConfig {
  let zone = ZONES[0];
  for (const z of ZONES) {
    if (score >= z.scoreThreshold) zone = z;
  }
  return zone;
}

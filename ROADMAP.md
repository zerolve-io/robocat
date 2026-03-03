# ROBOCAT: Neon Dash — Roadmap

> Cyberpunk endless runner. RoboCat dashes across neon rooftops, dodging drones, collecting scraps, unlocking upgrades.

## 🏁 M0: Scaffold (DONE ✅)
- [x] Monorepo: pnpm + Vite + Phaser 3 + TypeScript
- [x] Endless runner scene with procedural buildings
- [x] RoboCat with mechanical design (primitives, no sprites)
- [x] Basic jump, drone obstacles, scrap collection
- [x] Score + high score (localStorage)
- [x] Neon cyberpunk palette, HiDPI text, dynamic scroll speed

---

## 🐱 M1: Movement Abilities ← NEXT
*Make the cat feel incredible to control.*

- [ ] **Double jump** — tap again mid-air for thruster boost (1 air jump)
- [ ] **Dash** — horizontal burst (Shift/swipe), 1 charge, recharges on ground, phases through thin obstacles
- [ ] **Wall slide** — hit building side → slide down slowly, wall-jump for height
- [ ] **Pounce attack** — downward slam (hold Down mid-air) onto drones = destroy + bounce
- [ ] **Tail whip** — auto-deflect nearby projectiles (passive upgrade later)
- [ ] Juice: screen shake on pounce land, speed lines during dash, particle trails
- [ ] Input: WASD/arrows + Space (jump), Shift (dash), Down (pounce)
- [ ] Mobile: tap (jump), swipe-right (dash), swipe-down (pounce)

## 🌆 M2: Zone System
*Visual variety keeps every run fresh.*

- [ ] **5 zones** (transition every ~500m):
  1. Neon District (current) — standard buildings, neon signs
  2. Industrial Pipes — steam vents, conveyor obstacles, orange palette
  3. Data Center — server racks, laser grids, blue/white palette
  4. Rooftop Gardens — vines, water, green/teal palette
  5. Undercity Tunnels — low ceilings, darkness, purple/red palette
- [ ] Each zone: unique palette, obstacle types, building shapes
- [ ] **Events** mid-run (random triggers):
  - Blackout (neon outlines only, 10s)
  - Drone swarm (dense wave, weave through)
  - Collapsing buildings (floor crumbles behind you)
  - Train crossing (time your jump)
  - Data storm (glitch VFX, brief control inversion)
- [ ] Zone transition animation (color wipe + zone name text)

## ⚡ M3: Power-ups
*Randomness = replayability.*

- [ ] Power-up capsules spawn on buildings (glowing containers)
- [ ] **6 power-ups:**
  - Holo-Cloak — phase through everything (5s)
  - Magnet Paws — scraps fly to you (10s)
  - EMP Hairball — destroy all drones on screen
  - Turbo Boost — 2x speed + invincible (5s)
  - Grapple Tail — auto-swing between buildings (8s)
  - Tiny Mode — shrink to dodge through gaps (8s)
- [ ] HUD: active power-up icon + duration bar
- [ ] VFX per power-up (shield glow, magnet lines, size change)

## 🤖 M4: Enemy Variety
*Make dodging interesting.*

- [ ] **Drone types:**
  - Sentry (stationary, wide vision cone)
  - Patrol (moves back/forth on platform)
  - Hunter (chases horizontally when you're in range)
  - Bomber (drops projectiles from above)
  - Scanner (sweeps laser beam across gap)
- [ ] Gradual introduction: sentry from start, patrol at 500m, hunter at 1000m, etc.
- [ ] Drone destroy mechanic: pounce-attack kills drones for bonus scraps

## 🏆 M5: Progression & Upgrade Shop
*The "one more run" hook.*

- [ ] **Upgrade shop** between runs (scraps currency):
  - +1 Air Jump
  - Dash Distance +25%
  - Wall Slide Duration +50%
  - Pounce Radius +25%
  - Scrap Magnet (passive, short range)
  - Shield (absorb 1 hit per run)
  - Lucky Start (begin with random power-up)
  - Silent Paws (drones detect later)
  - Turbo Whiskers (show obstacles ahead)
  - Spring Legs (higher base jump)
- [ ] **Cat skins** (cosmetic, expensive):
  - Default (yellow mech)
  - Steampunk (bronze + gears)
  - Ghost (translucent white)
  - Neon (color-shifting)
  - Golden (prestige unlock)
  - Glitch (pixel distortion effect)
- [ ] **Missions** (3 active at a time):
  - "Reach 2000m without dashing"
  - "Destroy 15 drones in one run"
  - "Collect 500 scraps total"
  - "Survive 3 blackouts"
  - Reward: bonus scraps + unlock progress
- [ ] **Daily challenges** — unique modifier + leaderboard seed

## 🤖 M6: Boss Encounters
*The spectacle — every 1000m.*

- [ ] **Mega Drone** — fills half screen, laser grid patterns to jump through
- [ ] **Spider Tank** — runs alongside, slams legs as obstacles
- [ ] **Firewall** — advancing code wall, must outrun it
- [ ] **Rogue AI Cat** — mirror that copies your moves 1s delayed
- [ ] Boss health bar, defeat for big scrap reward
- [ ] Boss defeated → brief celebration + zone transition

## 📊 M7: Scoring & Style System
*Reward skilled play.*

- [ ] Score = Distance × Multiplier + Scraps + Kills + Style
- [ ] **Style points:**
  - Near-miss (pass within 10px of drone)
  - Air chain (kill 3+ drones without landing)
  - Perfect zone (no hits in entire zone)
  - Gap thread (dash through narrow gap)
  - Boss defeat bonus
- [ ] Multiplier: builds with style, resets on hit
- [ ] End-of-run summary screen with stats + grades (S/A/B/C)

## 🌐 M8: Backend & Online
*Cloudflare Workers + D1 + KV.*

- [ ] Daily seed endpoint (`/api/seed`)
- [ ] Anonymous accounts → email OTP (Workers + D1)
- [ ] Save sync (unlocks, upgrades, stats)
- [ ] Daily leaderboard (same seed, compare scores)
- [ ] Weekly events (global modifiers)

## 🎨 M9: Art & Audio
*Make it beautiful.*

- [ ] Pixel art sprites (cat, drones, buildings)
- [ ] Particle effects (rain, sparks, data streams)
- [ ] Lo-fi synthwave music (patrol loop, chase beat)
- [ ] Full SFX (movement, drones, power-ups, UI)

## 🚀 M10: Launch
- [ ] Custom domain
- [ ] Mobile touch controls
- [ ] Gamepad support
- [ ] PWA / installable
- [ ] Social sharing (screenshot + score)

---

## Priority Order
**M0** ✅ → **M1** (movement) → **M2** (zones) → **M3** (power-ups) → **M4** (enemies) → **M5** (progression) → **M6** (bosses) → **M7** (scoring) → **M8** (backend) → **M9** (art) → **M10** (launch)

*Movement feel first. If the cat feels great to control, everything else follows.*

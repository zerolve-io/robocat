# ROBOCAT: Infinite Neon Alley Patrol — Roadmap

## 🏁 Milestone 0: Scaffold (DONE ✅)
- [x] Monorepo: pnpm + Vite + Phaser 3 + TypeScript
- [x] Procedural city block from seed (buildings, paths, neon accents)
- [x] RoboCat movement (WASD/arrows) + collision
- [x] One patrol drone with vision cone
- [x] Attention meter (HUD)
- [x] Camera follow
- [x] Cyberpunk color palette

---

## 🎮 Milestone 1: Core Movement Feel
*Make the cat feel great to control.*

- [ ] **Pounce** — aim arc + short dash, passes over low obstacles
- [ ] **Wall-run** — short burst along building edges (hold direction + shift)
- [ ] **Tail Hack** — interact with terminals (press E near cyan tiles → quick mini-game)
- [ ] **Purr Field** — hold Space to emit calming radius (slows nearby drones)
- [ ] **Smooth animations** — replace rects with animated sprite sheets (idle, run, pounce, hack)
- [ ] Movement juice: screen shake on pounce land, speed lines, particle trails
- [ ] Sound: footstep ticks, pounce whoosh, purr hum

## 🌆 Milestone 2: City Generation v2
*Make every patrol feel different.*

- [ ] **Block templates** — rooftops, markets, vent networks, noodle stalls, drone lanes
- [ ] **Tile variety** — multiple building types, neon signs, steam vents, puddles
- [ ] **Connectivity rules** — guaranteed path between spawn and objectives
- [ ] **Vertical layers** — ground level + rooftop layer (ladders/vents to transition)
- [ ] **City mood system** — rain (slippery, better stealth), blackout (IR vision), festival (crowds)
- [ ] **Tilemap art** — pixel art tileset (16x16 or 32x32)

## 🎯 Milestone 3: Objectives & Patrols
*The 8-12 minute patrol loop.*

- [ ] **Objective generator** — 3 random objectives per patrol from template pool
- [ ] **10 objective templates:**
  1. Steal heat-battery fish from kiosk (optional: leave coins)
  2. Deliver lost microchip collar to owner drone
  3. Hack billboard → cat propaganda
  4. Sneak into data center → retrieve Memory Yarnball
  5. Rescue stray maintenance bot from recycler
  6. Reroute power to a blacked-out block
  7. Plant a listening device on a Corp Cloud terminal
  8. Escort a lost kitten-bot home
  9. Photograph a secret drone meeting
  10. Sabotage a surveillance relay
- [ ] **Combo system** — completing objectives in clever order = bonus scraps
- [ ] **Patrol timer** — optional, shows elapsed time
- [ ] **Return to charging crate** — end patrol, tally rewards, story beat
- [ ] **Patrol seed display** — share seeds with friends for same layout

## 🤖 Milestone 4: Drones & AI
*Make stealth interesting.*

- [ ] **Multiple drone types:**
  - Sentry (stationary, wide cone)
  - Patrol (fixed path, narrow cone)
  - Hunter (activates on alarm, chases)
  - Scanner (sweeps area periodically)
- [ ] **Alert states** — unaware → suspicious → alarmed → chasing
- [ ] **Drone communication** — alarmed drones alert nearby drones
- [ ] **Chase mechanics** — 60-90s escape timer, parkour to safety
- [ ] **Vision cone affected by environment** — rain reduces range, blackout = IR only
- [ ] **Sound detection** — running makes noise, drones investigate

## ⚡ Milestone 5: Upgrades & Progression
*Roguelite between-run meta.*

- [ ] **Scraps currency** — collected during patrols
- [ ] **Secrets currency** — rare, from stealth objectives
- [ ] **Upgrade tree (20 mods):**
  - Magnet Paws (cling to metal walls)
  - Holo-Fur Cloak (brief invisibility, 5s cooldown)
  - Snack Printer (bait guards, bribe bots)
  - Double Pounce + Air Dash
  - EMP Hairball (short radius stun)
  - Silent Paws (no sound when running)
  - Night Vision (permanent IR overlay)
  - Turbo Whiskers (detect drones through walls)
  - Grapple Tail (swing between buildings)
  - Data Sniffer (auto-mark objectives on map)
  - Neon Camouflage (invisible near neon signs)
  - Battery Extender (longer wall-run)
  - Decoy Hologram (project fake cat)
  - Overclock Purr (larger purr radius)
  - Spring Legs (higher pounce arc)
  - Firewall Tail (hack faster)
  - Emergency Reboot (revive once per patrol)
  - Scrap Magnet (auto-collect nearby scraps)
  - Street Smarts (reveal one objective location)
  - Lucky Cat (rare loot chance +25%)
- [ ] **Mod slots** — limited equip slots, choose your build
- [ ] **Chassis cosmetics** — unlockable cat styles

## 🏛️ Milestone 6: Factions & Reputation
*The city evolves based on your choices.*

- [ ] **Three factions:**
  - **CIVIC AI** — order, surveillance, "good citizen cat"
  - **SCRAP KIDS** — street hackers who worship you
  - **CORP CLOUD** — wants to capture or recruit you
- [ ] **Rep system** — actions shift faction standing (−10 to +10)
- [ ] **Faction consequences:**
  - CIVIC AI high → fewer drones in your area, access to secure zones
  - SCRAP KIDS high → secret passages revealed, discount upgrades
  - CORP CLOUD high → rare tech drops, but tracked by elite drones
- [ ] **Faction NPCs** — dialogue, quests, story progression
- [ ] **City mutation** — faction dominance changes district aesthetics & spawns

## 🌐 Milestone 7: Backend & Online
*Cloudflare Workers + D1 + KV.*

- [ ] **Daily seed endpoint** — `/api/seed?mode=daily` (Workers + KV)
- [ ] **Player accounts** — anonymous → email OTP (Workers + D1)
- [ ] **Save sync** — unlocks, faction rep, patrol history (D1)
- [ ] **Daily leaderboards** — same seed, compare times/scores (KV)
- [ ] **Weekly city events** — global modifiers affecting all players
- [ ] **Anti-cheat** — server validates run summaries

## 🎨 Milestone 8: Art & Audio
*Make it beautiful.*

- [ ] **Pixel art tileset** — full cyberpunk city kit
- [ ] **RoboCat sprite** — idle, run, pounce, hack, purr, sleep animations
- [ ] **Drone sprites** — per type, alert state indicators
- [ ] **NPC sprites** — faction representatives, shopkeepers, strays
- [ ] **Particle effects** — rain, neon glow, sparks, steam, data streams
- [ ] **Music** — lo-fi synthwave patrol loop, stealth tension layer, chase beat
- [ ] **SFX** — full sound design (movement, hacking, drones, UI)

## 🏔️ Milestone 9: The Tower of Updates (Endgame)
*Late-game content for dedicated players.*

- [ ] **Tower unlock** — reach max rep with any faction
- [ ] **Tower floors** — increasingly difficult procedural challenges
- [ ] **Boss encounters** — elite AI systems
- [ ] **Three endings:**
  - Mischievous helper (keep playing, city loves you)
  - City guardian (unlock permanent patrol bonuses)
  - Patch the AI (rewrite city rules — new game+)

## 🚀 Milestone 10: Launch & Community
- [ ] **Cloudflare Pages deploy** (custom domain)
- [ ] **Open beta** — daily seeds, leaderboards live
- [ ] **User-generated patrols** — share custom seeds
- [ ] **Mobile touch controls**
- [ ] **Gamepad support**
- [ ] **Replay recording** (R2 storage)

---

## Priority Order
**M0** ✅ → **M1** (feel) → **M3** (objectives) → **M2** (city gen) → **M4** (AI) → **M5** (upgrades) → **M8** (art) → **M6** (factions) → **M7** (backend) → **M9** (endgame) → **M10** (launch)

*Movement feel first. If the cat feels great to control, everything else follows.*

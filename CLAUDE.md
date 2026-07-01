# Mario Kart Racing Game – Project Guide

## Overview
Browser-based Mario Kart-style racing game with dynamic city themes (Berlin, Amsterdam, Vilnius, Vinted).

## Tech Stack
- JavaScript (ES6+)
- Three.js for 3D rendering
- Vite for bundling & dev server
- Web Audio API for sound
- Vercel for deployment

## Game Mechanics
- 2.5-minute race, 4 racers (1 player + 3 AI)
- WASD controls with drifting (Mario Kart-style)
- 4 power-up categories: speed boost, theme swap, mode swap (good/bad), slow-motion
- Mario Kart points: 1st=10pts, 2nd=6pts, 3rd=3pts, 4th=1pt
- Theme swap = visuals only, track path constant
- All transformations visible to all racers simultaneously

## File Structure
```
/src
  main.js          → entry point
  game.js          → game loop & state manager
  track.js         → track geometry & collision
  racer.js         → player + AI racer class
  powerups.js      → 4 power-up types
  ai.js            → AI pathfinding & attacks
  ui.js            → HUD, results screen, leaderboard
  audio.js         → music & sound effects
  themes.js        → Berlin, Amsterdam, Vilnius, Vinted data
  config.js        → power-up positions, tuning params
/public            → static assets (empty for MVP)
```

## Build & Deploy
- `npm run dev` → local dev server (localhost:5173)
- `npm run build` → production build to /dist
- Git + GitHub for version control
- Vercel for deployment

## Commit After Each Phase
- Phase 3A: Core racing (track, movement, AI, timer)
- Phase 3B: Drifting mechanics
- Phase 3C: Power-ups (4 types)
- Phase 3D: AI attacks
- Phase 3E: Leaderboard & points
- Phase 3F: Polish & audio

## Notes
- Keep AI speed capped at 80% of player max
- Fixed power-up locations (no random spawning MVP)
- Default theme: Berlin (Good mode)
- Test locally before each commit

## Shape Building Guide

### Pretzel
Shape: 4 torus objects grouped together
- Torus 1 (top): TorusGeometry(0.5, 0.15, 16, 16), rotate Z by 45°, position (0, 0.5, 0)
- Torus 2 (left): TorusGeometry(0.5, 0.15, 16, 16), rotate Z by 90°, position (-0.3, -0.2, 0)
- Torus 3 (right): TorusGeometry(0.5, 0.15, 16, 16), rotate Z by 270°, position (0.3, -0.2, 0)
- Torus 4 (bottom): TorusGeometry(0.5, 0.15, 16, 16), rotate Z by 180°, position (0, -0.8, 0)
- Material: MeshStandardMaterial, color 0xD2B48C (tan/brown)
- Scale: 1.5 units overall
- Group all 4 torus objects together

### High Heel Shoe (Ladies Stiletto)
Shape: 3 components grouped together
- Main body: BoxGeometry(0.6, 0.4, 0.8), color 0xFF1493 (hot pink), position (0, 0.2, 0)
- Heel: CylinderGeometry(0.08, 0.08, 1.2), color 0x333333 (dark grey), position (0.25, -0.3, 0.3)
- Toe: Cone stretched, or tapered BoxGeometry, color matches body, position (-0.3, 0, 0.4)
- Material: MeshStandardMaterial with slight metallic sheen
- Scale: 1.2 units overall height
- Group all components together

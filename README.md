# 🏎️ Vinted Kart

A browser kart racer through a shifting **collage** of cities. Race a kart
made of local food against 3 AI racers, eat power-ups that warp the entire world, and
beat the 2:30 clock.

Built with **Three.js** (via CDN import map) — no build step, no bundler, pure static files.

## Play locally

Because it uses ES modules, open it through a local server (not `file://`):

```bash
# any static server works — e.g.
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed URL (e.g. `http://localhost:8080`).

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | Accelerate |
| `S` / `↓` | Brake / reverse |
| `A` `D` / `←` `→` | Steer left / right |
| `Space` | Drift — hold while turning, **release for a mini-boost** |

## How it plays

- **2:30 countdown** governs the race. Complete **3 laps** to finish early — or hold the
  best position when the clock hits zero.
- **4 racers**: you (currywurst kart) + 3 AI (pretzel, döner, beer). AI lob projectiles
  that briefly slow you; they cannot eat power-ups.
- **Mario Kart points**: 1st = 10, 2nd = 6, 3rd = 3, 4th = 1. Career totals persist in
  `localStorage` across replays.

### Power-ups (only the player can collect them)

| Type | Object | Effect |
| --- | --- | --- |
| ⚡ Speed boost | glowing coffee cup | 5–10s speed boost |
| 🌀 Theme portal | white oval w/ icon | instantly swaps the world theme (Berlin / Amsterdam / Vilnius / Vinted) — **track path unchanged** |
| 🌞/🌧 Mode portal | green / red square | toggles **Good** (bright, flowers) vs **Bad** (dark, gritty) mode |
| 🍄 Slow-motion | giant mushroom | slows all racers + the timer for 15s, zooms the camera out, and makes you **invincible** |

Themes and modes change only the visuals, lighting, music key, and scenery — the road
geometry, lap count, and finish line never change.

## Deploy to Vercel

It's a static site, so deployment is zero-config:

```bash
npx vercel        # or connect the repo in the Vercel dashboard
```

`vercel.json` is included. The only runtime dependency (Three.js) loads from a CDN.

## Project layout

```
index.html        # markup, HUD, screens, import map
styles.css        # neon Mario-Kart-style UI
js/
  main.js         # game controller, loop, camera, slow-mo, results
  config.js       # tuning, track points, themes, power-up layout
  track.js        # Catmull-Rom circuit + road mesh + progress helpers
  kart.js         # food-themed karts, player physics & drift, AI
  environment.js  # swappable themed scenery (landmarks/medium/small)
  powerups.js     # pickups + AI projectiles
  input.js        # keyboard
  ui.js           # start / countdown / HUD / results
  audio.js        # fully synthesized music + SFX (Web Audio API)
```

## Notes & scope

- Audio is **synthesized at runtime** (no asset files) and degrades gracefully if the
  Web Audio API is unavailable. Click or press a key once to unlock sound.
- All four themes are implemented as palette + landmark swaps; Berlin (Good) is the default.
- No backend, no multiplayer. Career points are the only persisted state.

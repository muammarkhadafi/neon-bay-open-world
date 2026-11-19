# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muammarkhadafi/neon-bay-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muammarkhadafi/neon-bay-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original sun-soaked open-world crime game — an entry for the make.fun
`gta6-01` bounty ("Make GTA 6"). Built from scratch in a single recorded
session: every line of the game was written for this entry, and nothing is
copied from any commercial game.

You are **Rio Vale**, a driver-for-hire in **Neon Bay**, a palm-lined coastal
city of glass towers, a marina and a beach. Work three story missions for the
fixer Marisol "Sol" Reyes, steal cars, outrun the Bay City Police, and build
your fortune.

## What is in the game

- **A city to explore on foot and by car** — third-person walking, running
  and jumping, plus drivable cars you can enter, exit and steal.
- **Traffic and pedestrians** — cars drive the road grid, people walk the
  sidewalks and flee from gunfire and speeding cars.
- **Wanted level (0–5 stars) and police** — crimes raise your heat, police
  cars chase and ram, officers on foot chase and arrest you. Stay clean and
  out of sight and the heat cools off.
- **Missions and a story** — three jobs with timers, objectives and pay:
  *First Fare* (pick up and deliver a client), *Bay Getaway* (steal a coupe
  and lose the police), *Harbor Chase* (run down a courier and bring the
  package home).
- **Combat** — punches and a pistol (hitscan with tracers, ammo and reload).
- **HUD with a minimap** — health, cash, wanted stars, speed, ammo, mission
  objective and timer, plus a live top-down minimap.
- **Start screen, pause menu, save/load** (localStorage), synthesized sound
  (WebAudio only — engine hum, sirens, gunshots, mission jingles) with a
  sound toggle, and day lighting over the whole city.

## How to play

Serve `game/` with any static server and open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

Controls: **WASD** move / drive, **Shift** run, **Space** jump / handbrake,
**E** enter or exit a car, **M** start a mission at the gold marker,
**Click / J** shoot, **F** punch, **R** reload, **Esc** pause. Drag the mouse
to look around.

## How to hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and
writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## Tech

- three.js 0.170.0, vendored as `game/vendor/three.module.min.js`.
- ES modules under `game/src/`, one job per file: `config`, `world`,
  `vehicles`, `people`, `police`, `missions`, `combat`, `hud`, `audio`,
  `input`, `save`, `main`.
- Static files only — no network requests, no external assets, no build step.

## License

MIT — see `LICENSE`.

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

# Neon Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muammarkhadafi/neon-bay-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muammarkhadafi/neon-bay-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Neon Bay is an original open-world crime game made for make.fun's `gta6-01`
bounty ("Make GTA 6"). It was written from a blank page for this entry: no
art, map, character or music from any commercial game, just a sunny coastal
city built out of code.

You play **Rio Vale**, a driver-for-hire in **Neon Bay** — a palm-lined city
with glass towers, a marina and a beach. Take three story jobs from the fixer
Marisol "Sol" Reyes, borrow cars you do not own, outrun the Bay City Police,
and grow your fortune.

## How to play

Serve the game folder, then open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| Space | Jump / handbrake |
| E | Get in or out of a car |
| M | Start a mission (at the gold marker) |
| Click / J | Shoot |
| F | Punch |
| R | Reload |
| Esc | Pause |

Drag the mouse to look around. Stealing cars and hurting people raises your
wanted level, and the Bay City Police will chase you down.

## The city

An 8×8-block coastal city: roads with traffic, parked cars, pedestrians who
flee from trouble, a beach and a pier, a marina, and a downtown skyline.
The wanted system runs from 0 to 5 stars — patrol cars ram you, officers
chase you on foot and, from 2 stars, open fire. Lose them and the heat cools
down, one star at a time.

## Missions

1. **First Fare** — pick up a client and drive them to the Azure Hotel ($350).
2. **Bay Getaway** — steal the gold coupe from the Palm Row garage and lose
   the police, then deliver it.
3. **Harbor Chase** — run down the courier, stop them, and grab the package.

Progress saves to localStorage, so you can pick up where you left off.

## Tech

- Three.js (vendored) renders the city; no build step, no network requests
  at runtime.
- Synthesised WebAudio only — every sound effect is generated in code.
- `main.ts` copies `game/` and `screenshots/` into `/output` and writes
  `dossier.json` for the make.fun grader.

## Screenshots

| File | Scene |
| --- | --- |
| `screenshots/1-drive.jpg` | Driving through the city |
| `screenshots/2-chase.jpg` | A police chase |
| `screenshots/3-mission.jpg` | A mission in progress |
| `screenshots/4-foot.jpg` | On foot in Neon Bay |

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

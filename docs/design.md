# Neon Bay — design note

An original sun-soaked modern coastal city, built from scratch in this
session. No Rockstar / GTA names, characters, maps, art or music anywhere.

## Fantasy
You are Rio Vale, a driver-for-hire in Neon Bay, a neon-lit coastal city of
palm-lined boulevards, a marina, a beach and a downtown of glass towers.
Take fares, steal cars when you must, outrun the Bay City Police, and work
your way through three story missions for the fixer Marisol "Sol" Reyes.

## World
- A grid city, 8 x 8 blocks, roads with lane markings, sidewalks, palm trees,
  street lamps, a beach and animated ocean on the south edge, a marina pier.
- Buildings are procedural low-poly boxes with lit window strips; no external
  art. Day lighting: warm sun, blue sky, soft fog.
- Traffic cars drive the road graph; pedestrians walk the sidewalks and flee
  from gunfire and speeding cars.

## Systems
- On foot: third-person, WASD walk/run (Shift), Space jump, camera orbits
  with mouse drag (click to pointer-lock).
- Cars: E enters/exits the nearest car; WASD drives, Space handbrake.
  Stealing a parked or occupied car raises the wanted level.
- Wanted 0-5 stars: crimes raise it, it decays while you stay clean and out
  of sight. Police cars chase and ram; officers on foot chase and arrest.
  Arrest ("BUSTED") costs cash and clears the wanted level.
- Combat: F punches, mouse / J fires the pistol (hitscan, tracer, ammo,
  R reloads). Officers shoot back at wanted 2+. No gore: hits spark, the
  target falls.
- Missions (start at the gold marker by the hideout, or walk into it):
  1. "First Fare" — pick up a passenger and deliver them to the hotel
     before the timer runs out.
  2. "Bay Getaway" — steal the marked coupe, lose a 2-star wanted level,
     deliver it to the garage.
  3. "Harbor Chase" — chase down the courier's car, stop it, grab the
     package, bring it back to the hideout.
  Each mission has start / objective / complete / fail states and pays cash.
- HUD: health bar, cash, wanted stars, speed, mission objective, minimap
  (canvas, top-down: player, cars, police, mission marker).
- Start screen with story + controls, pause menu (Esc), save/load via
  localStorage, sound toggle (M), synthesized WebAudio only (engine hum,
  sirens, gunshots, chimes) — no audio files.

## Tech
- three.js 0.170.0 vendored as game/vendor/three.module.min.js (import map).
- ES modules under game/src/, one job per file; game/index.html + style.css.
- Static files only, zero network requests; runs offline from any static
  server. Screenshots are taken headless with ?shot= modes that stage a
  real gameplay state (drive / chase / mission) after load.

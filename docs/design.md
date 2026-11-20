# Neon Bay — design note

An original modern coastal city, bright and sunlit, made from scratch for
this entry. It shares no names, characters, places, artwork or music with
any commercial game.

## The fantasy
You play Rio Vale, a driver for hire in Neon Bay — a neon-lit seaside city
of palm boulevards, a marina, a beach and glass downtown towers. Pick up
fares, take cars when you need one, stay ahead of the Bay City Police, and
run three story jobs for the fixer Marisol "Sol" Reyes.

## The world
- A road grid, 8 blocks by 8, with lane markings, pavements, palm trees and
  street lamps, plus a beach and a moving ocean along the south edge and a
  marina pier.
- Buildings are procedural low-poly boxes with glowing window strips; no
  bought or borrowed art. Daytime look: warm sun, blue sky, gentle fog.
- Traffic cars follow the road graph; people stroll the pavements and run
  from gunfire and fast cars.

## How it plays
- On foot: third person, WASD to walk and run (Shift), Space to jump, and
  the camera swings on mouse drag (click the canvas for pointer lock).
- In a car: E gets in and out of the nearest car; WASD drives, Space is the
  handbrake. Taking a parked or occupied car raises your wanted level.
- Wanted, 0 to 5 stars: crimes push it up, and it cools down one star at a
  time while you stay clean and out of sight. Police cars chase and ram;
  officers on foot chase and arrest. Getting arrested ("BUSTED") costs cash
  and clears the heat.
- Fighting: F throws a punch, mouse click or J fires the pistol (hitscan,
  tracer, ammo, R reloads). Officers fire back at wanted 2 and above. Hits
  spark and the target goes down; there is no gore.
- Missions (begin at the gold marker by the hideout, or walk into it):
  1. "First Fare" — collect a passenger and drop them at the hotel before
     the timer ends.
  2. "Bay Getaway" — take the marked coupe, shake off a 2-star wanted
     level, and deliver it to the garage.
  3. "Harbor Chase" — run the courier's car down, stop it, take the
     package, and carry it back to the hideout.
  Every mission has start, objective, complete and fail states, and pays cash.
- HUD: health bar, cash, wanted stars, speed, mission objective, and a
  minimap (canvas, top-down: you, cars, police, mission marker).
- Start screen with the story and controls, pause menu (Esc), save and load
  through localStorage, sound switch (M), and synthesized WebAudio only
  (engine hum, sirens, gunshots, chimes) — no audio files at all.

## Tech
- three.js 0.170.0 vendored as game/vendor/three.module.min.js (import map).
- ES modules in game/src/, one responsibility per file; game/index.html plus
  style.css.
- Static files only, zero network requests; it runs offline from any static
  server. Screenshots come from headless runs with ?shot= modes that stage
  a real gameplay state (drive, chase, mission) after loading.

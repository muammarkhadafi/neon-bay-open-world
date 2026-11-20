// Neon Bay — the game itself: wires the world, traffic, people, police,
// missions, combat, sound and HUD together, and runs the frame loop.

import * as THREE from 'three';
import { CITY, PLAYER, CAR, WANTED, MISSIONS, PLACES, SAVE_KEY, SHOOTING, STORY, PALETTE } from './config.js';
import { World } from './world.js';
import { Car, TrafficManager } from './vehicles.js';
import { Player, PedestrianManager } from './people.js';
import { WantedSystem, PoliceManager } from './police.js';
import { MissionManager } from './missions.js';
import { SoundEngine } from './audio.js';
import { HUD } from './hud.js';
import { Combat } from './combat.js';
import { Input } from './input.js';
import { saveGame, loadGame, hasSave } from './save.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 900);

const world = new World(scene);
const traffic = new TrafficManager(scene, world);
const peds = new PedestrianManager(scene, world);
const player = new Player(scene, world, PLACES.hideout.x, PLACES.hideout.z);
const wanted = new WantedSystem();
const sound = new SoundEngine();
const hud = new HUD();
const combat = new Combat(scene, world, sound);
const input = new Input(canvas);
const missions = new MissionManager(scene, world, traffic, sound, {
  onEvent: (text) => hud.showMessage(text, 5),
  onPay: (amount) => { state.money += amount; },
  onComplete: () => {},
  onFail: () => {},
});
const police = new PoliceManager(scene, world, wanted, sound);

// Camera rig: a third-person follow camera with drag orbit and zoom.
const cam = { yaw: 0, pitch: 0.32, dist: 10, targetYaw: 0 };

const state = {
  mode: 'menu', // menu | playing | paused | busted | wasted
  money: 120,
  inCar: null, // the Car the player is driving, or null
  lastDamageAt: 0,
  arrestTimer: 0,
  time: 0,
  shotMode: new URLSearchParams(location.search).get('shot'),
  muted: false,
};

// ---------- screens ----------

const $ = (id) => document.getElementById(id);
const screens = { menu: $('start-screen'), pause: $('pause-screen'), busted: $('busted-screen'), wasted: $('wasted-screen') };
function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) if (el) el.style.display = k === name ? 'flex' : 'none';
  $('hud').style.display = name === null ? 'block' : 'none';
  document.body.style.cursor = name === null ? 'none' : 'default';
}

function startGame(fresh) {
  sound.unlock();
  sound.startMusic();
  if (fresh) {
    state.money = 120;
    player.health = PLAYER.maxHealth;
    wanted.clear();
    missions.index = 0;
    missions.active = null;
  }
  state.mode = 'playing';
  state.inCar = null;
  showScreen(null);
  hud.showMessage('Welcome to Neon Bay. Head to the gold marker to start a mission.', 5);
  window.__game = api;
  window.__gameReady = true;
}

$('start-btn').addEventListener('click', () => startGame(true));
$('continue-btn').addEventListener('click', () => {
  const saved = loadGame();
  if (saved) {
    state.money = saved.money;
    player.health = saved.health;
    player.pos.x = saved.playerX; player.pos.z = saved.playerZ;
    missions.index = saved.missionIndex || 0;
  }
  startGame(false);
});
if (hasSave()) $('continue-btn').style.display = 'block';
$('resume-btn').addEventListener('click', () => { state.mode = 'playing'; showScreen(null); });
$('save-btn').addEventListener('click', () => {
  saveGame({ money: state.money, health: player.health, playerX: player.pos.x, playerZ: player.pos.z, missionIndex: missions.index, wanted: wanted.stars });
  hud.showMessage('Game saved.', 3);
});
$('load-btn').addEventListener('click', () => {
  const saved = loadGame();
  if (saved) {
    state.money = saved.money;
    player.health = saved.health;
    player.pos.x = saved.playerX; player.pos.z = saved.playerZ;
    missions.index = saved.missionIndex || 0;
    wanted.stars = saved.wanted || 0;
    state.mode = 'playing';
    showScreen(null);
    hud.showMessage('Game loaded.', 3);
  }
});
const toggleSound = () => {
  state.muted = !state.muted;
  sound.setEnabled(!state.muted);
  for (const id of ['sound-btn', 'sound-btn2']) { const b = $(id); if (b) b.textContent = state.muted ? 'Sound: Off' : 'Sound: On'; }
};
$('sound-btn').addEventListener('click', toggleSound);
$('sound-btn2').addEventListener('click', toggleSound);
$('pause-btn').addEventListener('click', () => { if (state.mode === 'playing') { state.mode = 'paused'; showScreen('pause'); } });
$('quit-btn').addEventListener('click', () => { state.mode = 'menu'; showScreen('menu'); });
$('quit-btn2').addEventListener('click', () => { state.mode = 'menu'; showScreen('menu'); });
$('restart-btn').addEventListener('click', () => respawn());
$('restart-btn2').addEventListener('click', () => respawn());

function respawn() {
  player.health = PLAYER.maxHealth;
  player.pos.set(PLACES.hideout.x, 0, PLACES.hideout.z);
  player.heading = 0;
  if (state.inCar) { state.inCar = null; }
  wanted.clear();
  state.mode = 'playing';
  showScreen(null);
  hud.showMessage('Back on the streets.', 3);
}

// ---------- actions ----------

function enterCar(car) {
  if (!car) return;
  if (car.occupied && !car.isParked && !car.isPolice) {
    // Stealing a car someone is driving: that is a crime.
    wanted.addStars(1, state.time);
    hud.showMessage('Car stolen! The police are on their way.', 3);
  } else if (car.isPolice) {
    wanted.addStars(2, state.time);
    hud.showMessage('You stole a police car!', 3);
  }
  car.occupied = true;
  // Once the player takes a car, traffic stops driving it — otherwise the
  // traffic AI would fight the player's steering.
  car.isTraffic = false;
  state.inCar = car;
  player.mesh.visible = false;
  sound.setEngine(0, true);
}

function exitCar() {
  if (!state.inCar) return;
  const car = state.inCar;
  car.isParked = true; // stays where the player left it
  state.inCar = null;
  player.mesh.visible = true;
  // Step out beside the car.
  const side = car.heading + Math.PI / 2;
  player.pos.set(car.pos.x + Math.sin(side) * 2.5, 0, car.pos.z + Math.cos(side) * 2.5);
  player.heading = car.heading;
  sound.setEngine(0, false);
}

function shootAt(dir) {
  const from = new THREE.Vector3();
  if (state.inCar) {
    from.copy(state.inCar.pos).add(new THREE.Vector3(0, 1.4, 0));
  } else {
    from.copy(player.pos).add(new THREE.Vector3(0, 1.5, 0));
  }
  const targets = [];
  for (const p of peds.peds) {
    if (!p.dead) targets.push({ pos: p.mesh.position, radius: 1.1, kind: 'ped', ref: p });
  }
  for (const car of traffic.cars) {
    if (!car.dead && car !== state.inCar) targets.push({ pos: car.pos, radius: 2.2, kind: 'car', ref: car });
  }
  for (const cop of police.cops) {
    targets.push({ pos: cop.mesh.position, radius: 1.1, kind: 'cop', ref: cop });
  }
  const hit = combat.shoot(from, dir, targets);
  if (!hit) return;
  combat.sparkAt(hit.pos);
  if (hit.kind === 'ped') {
    peds.knockDown(hit.ref);
    wanted.addStars(1, state.time);
    peds.scare(hit.pos.x, hit.pos.z, 25);
    hud.showMessage('You hit a pedestrian! Wanted level up.', 3);
  } else if (hit.kind === 'cop') {
    // A shot officer goes down and gets back up later.
    const cop = hit.ref;
    cop.mesh.rotation.z = Math.PI / 2;
    cop.mesh.position.y = 0.3;
    setTimeout(() => { cop.mesh.rotation.z = 0; cop.mesh.position.y = 0; }, 4000);
    wanted.addStars(2, state.time);
    hud.showMessage('You shot a police officer! Wanted level up.', 3);
  } else if (hit.kind === 'car') {
    const car = hit.ref;
    car.health -= SHOOTING.damage;
    car.slowTimer = 1.2;
    if (car.health <= 0 && !car.dead) {
      car.remove();
      hud.showMessage('Car destroyed!', 3);
    }
    if (car.occupied && !car.isPolice) wanted.addStars(1, state.time);
  }
}

function punchAhead() {
  const from = player.pos.clone();
  const targets = [];
  for (const p of peds.peds) {
    if (!p.dead) targets.push({ pos: p.mesh.position, radius: 1.1, kind: 'ped', ref: p });
  }
  for (const cop of police.cops) {
    targets.push({ pos: cop.mesh.position, radius: 1.1, kind: 'cop', ref: cop });
  }
  const hit = combat.punch(from, player.heading, targets);
  if (!hit) return;
  if (hit.kind === 'ped') {
    peds.knockDown(hit.ref);
    wanted.addStars(1, state.time);
    peds.scare(hit.pos.x, hit.pos.z, 20);
  } else if (hit.kind === 'cop') {
    wanted.addStars(1, state.time);
    hud.showMessage('You punched an officer!', 3);
  }
}

// ---------- the frame loop ----------

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.time += dt;
  const playing = state.mode === 'playing';

  if (playing) {
    // --- input ---
    const axes = input.moveAxes();
    const running = input.held('ShiftLeft') || input.held('ShiftRight');
    if (input.wasPressed('KeyE')) {
      if (state.inCar) exitCar();
      else {
        const near = traffic.nearestCar(player.pos.x, player.pos.z, 4.5);
        if (near) enterCar(near);
      }
    }
    if (input.wasPressed('KeyM')) {
      if (!missions.active && !missions.done) {
        const start = missions.idleMarkerPos();
        const d = start ? Math.hypot(player.pos.x - start.x, player.pos.z - start.z) : Infinity;
        if (d < 8) missions.startMission();
        else hud.showMessage('Go to the gold marker at the hideout to start a mission.', 3);
      }
    }
    if (input.wasPressed('KeyR')) combat.reload();
    if (input.wasPressed('KeyF') && !state.inCar) punchAhead();
    if (input.wasPressed('Space') && !state.inCar) player.jump();
    if (input.wasPressed('Escape')) { state.mode = 'paused'; showScreen('pause'); }

    // --- mouse look ---
    const md = input.consumeMouse();
    cam.yaw -= md.dx * 0.004;
    cam.pitch = Math.max(-0.15, Math.min(0.9, cam.pitch + md.dy * 0.004));
    cam.dist = Math.max(6, Math.min(18, cam.dist - md.wheel * 0.01));
    if (md.down) {
      // Click to shoot, from the camera toward where it points.
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      shootAt(dir);
    }

    // --- movement ---
    if (state.inCar) {
      const car = state.inCar;
      const throttle = (input.held('KeyW') || input.held('ArrowUp') ? 1 : 0) + (input.held('KeyS') || input.held('ArrowDown') ? -1 : 0);
      const steer = (input.held('KeyA') || input.held('ArrowLeft') ? 1 : 0) + (input.held('KeyD') || input.held('ArrowRight') ? -1 : 0);
      const handbrake = input.held('Space');
      car.drive(throttle, steer, dt);
      if (handbrake) car.speed *= 0.9;
      sound.setEngine(Math.abs(car.speed), true);
      // Running over pedestrians.
      for (const p of peds.peds) {
        if (p.dead) continue;
        const d = Math.hypot(p.mesh.position.x - car.pos.x, p.mesh.position.z - car.pos.z);
        if (d < 2.2) {
          peds.knockDown(p);
          wanted.addStars(1, state.time);
          peds.scare(p.mesh.position.x, p.mesh.position.z, 25);
        }
      }
      // Ramming a traffic car counts as a crime if anyone is in it.
      for (const other of traffic.cars) {
        if (other === car || other.dead) continue;
        const d = Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z);
        if (d < 3.4 && Math.abs(car.speed) > 8) {
          other.slowTimer = 1.5;
          other.health -= 10;
          if (other.occupied) wanted.addStars(1, state.time);
        }
      }
      if (car.health <= 0) {
        sound.crash();
        exitCar();
        car.remove();
        hud.showMessage('Your car is wrecked!', 3);
      }
    } else {
      // On foot: move relative to the camera yaw.
      const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const mx = fwd.x * axes.y + right.x * axes.x;
      const mz = fwd.z * axes.y + right.z * axes.x;
      player.update(dt, mx, mz, running);
      sound.setEngine(0, false);
    }

    // --- world systems ---
    world.update(dt, state.time);
    traffic.update(dt);
    traffic.separate();
    peds.update(dt);
    combat.update(dt);
    missions.update(dt, player, state.inCar, wanted);

    // --- police ---
    const playerPos = state.inCar ? state.inCar.pos : player.pos;
    police.update(dt, playerPos, !!state.inCar, (cop) => {
      // Arrested: caught on foot by an officer.
      if (state.inCar) return;
      state.mode = 'busted';
      const fine = Math.min(state.money, 150);
      state.money -= fine;
      sound.busted();
      $('busted-fine').textContent = `The Bay City Police caught you. Fine: $${fine}.`;
      showScreen('busted');
      wanted.clear();
    }, (car) => {
      // Rammed by a police car.
      if (state.inCar) {
        state.inCar.health -= 8;
        sound.crash();
      } else {
        if (player.damage(12)) {
          state.mode = 'wasted';
          const lost = Math.min(state.money, 100);
          state.money -= lost;
          $('wasted-lost').textContent = `You were run down by the police. Lost $${lost}.`;
          showScreen('wasted');
        }
      }
      state.lastDamageAt = state.time;
    });
    police.copGunfire(playerPos, dt, (fromPos, hit) => {
      if (state.inCar) return;
      sound.gunshot();
      if (hit) {
        if (player.damage(9)) {
          state.mode = 'wasted';
          const lost = Math.min(state.money, 100);
          state.money -= lost;
          $('wasted-lost').textContent = `Shot by the Bay City Police. Lost $${lost}.`;
          showScreen('wasted');
        }
        state.lastDamageAt = state.time;
      }
    });
    wanted.update(dt, police.policeNear(playerPos, 45));

    // --- health regen ---
    if (state.time - state.lastDamageAt > 6 && player.health < PLAYER.maxHealth) {
      player.heal(3 * dt);
    }

    // --- idle mission marker ---
    if (!missions.active && !missions.done) {
      const start = missions.idleMarkerPos();
      if (start) world.setBeacon(start.x, start.z, true);
    }

    // --- HUD ---
    const step = missions.active ? missions.stepDef() : null;
    const target = missions.active ? missions.targetPos() : null;
    hud.update(dt, {
      health: player.health,
      money: state.money,
      wanted: wanted.stars,
      speed: state.inCar ? state.inCar.speed : 0,
      inCar: !!state.inCar,
      reloading: combat.reloadTimer > 0,
      ammo: combat.ammo,
      ammoMax: combat.ammoMax,
      missionTitle: missions.active ? `${missions.active.def.title} — $${missions.active.def.pay}` : null,
      objective: step ? step.label : '',
      timeLeft: missions.active ? missions.active.timeLeft : null,
      roadCenters: world.roadCenters,
      hideout: PLACES.hideout,
      missionTarget: target,
      policeCars: police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      cars: traffic.cars.filter((c) => !c.dead).map((c) => ({ x: c.pos.x, z: c.pos.z })),
      peds: peds.peds.filter((p) => !p.dead).map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z })),
      playerX: playerPos.x,
      playerZ: playerPos.z,
      heading: state.inCar ? state.inCar.heading : player.heading,
    });
  }

  input.endFrame();

  // --- camera ---
  const focus = state.inCar ? state.inCar.pos : player.pos;
  const followYaw = state.inCar ? state.inCar.heading + Math.PI : cam.yaw;
  const cx = focus.x + Math.sin(followYaw) * Math.cos(cam.pitch) * cam.dist;
  const cz = focus.z + Math.cos(followYaw) * Math.cos(cam.pitch) * cam.dist;
  const cy = 2.2 + Math.sin(cam.pitch) * cam.dist;
  camera.position.set(cx, cy, cz);
  camera.lookAt(focus.x, focus.y + 1.6, focus.z);

  renderer.render(scene, camera);
}

// A small public handle for tests and screenshots.
const api = {
  state, player, world, traffic, peds, police, wanted, missions, combat, sound,
  startGame, enterCar, exitCar, shootAt, punchAhead, respawn,
  get mode() { return state.mode; },
  get money() { return state.money; },
};
window.__game = api;

// ---------- shot mode (for screenshots) ----------

function setupShotMode() {
  const mode = state.shotMode;
  if (!mode) return;
  // Hide the menu and jump straight into the game.
  startGame(true);
  if (mode === 'drive') {
    const car = traffic.nearestCar(player.pos.x, player.pos.z, 60) || traffic.cars[0];
    if (car) { player.pos.set(car.pos.x, 0, car.pos.z); enterCar(car); }
    cam.dist = 11; cam.pitch = 0.3;
  } else if (mode === 'chase') {
    const car = traffic.cars.find((c) => !c.isTraffic) || traffic.cars[0];
    if (car) { player.pos.set(car.pos.x, 0, car.pos.z); enterCar(car); }
    wanted.addStars(3, state.time);
    cam.dist = 12; cam.pitch = 0.32;
  } else if (mode === 'mission') {
    missions.startMission();
    player.pos.set(PLACES.hideout.x + 6, 0, PLACES.hideout.z + 6);
    cam.dist = 11; cam.pitch = 0.35;
  } else if (mode === 'foot') {
    player.pos.set(60, 0, 120);
    cam.dist = 8; cam.pitch = 0.3;
  }
}

// ---------- boot ----------

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.addEventListener('error', (e) => {
  const el = document.getElementById('error');
  if (el) el.textContent = 'Error: ' + e.message;
});

$('story-text').textContent = STORY.intro;
if (state.shotMode) {
  setupShotMode();
} else {
  showScreen('menu');
}

requestAnimationFrame(frame);

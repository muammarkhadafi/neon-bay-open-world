// Neon Bay — the game itself: renderer, camera, states (menu / playing /
// paused / busted / wasted), driving and on-foot play, wanted + police,
// missions, combat, HUD, save/load and the ?shot= staging modes used for
// screenshots (real renders of the game's own code).

import * as THREE from 'three';
import { CITY, MISSIONS, PLACES, PLAYER, STORY, WANTED } from './config.js';
import { World } from './world.js';
import { Player, PedestrianManager } from './people.js';
import { TrafficManager, Car } from './vehicles.js';
import { WantedSystem, PoliceManager } from './police.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { HUD } from './hud.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { PALETTE } from './config.js';

const SHOT = new URLSearchParams(location.search).get('shot');

class ParticleBurst {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
  }
  burst(x, y, z, color, count) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshBasicMaterial({ color }),
      );
      m.position.set(x, y, z);
      this.scene.add(m);
      this.parts.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 2,
        vz: (Math.random() - 0.5) * 8,
        life: 0.7 + Math.random() * 0.4,
      });
    }
  }
  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.life <= 0 || p.mesh.position.y < 0) {
        this.scene.remove(p.mesh);
        this.parts.splice(i, 1);
      }
    }
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.clock = new THREE.Clock();
    this.time = 0;

    this.world = new World(this.scene);
    this.player = new Player(this.scene, this.world, PLACES.hideout.x + 6, PLACES.hideout.z + 4);
    this.traffic = new TrafficManager(this.scene, this.world);
    this.peds = new PedestrianManager(this.scene, this.world);
    this.wanted = new WantedSystem();
    this.sound = new SoundEngine();
    this.combat = new Combat(this.scene, this.world, this.sound);
    this.hud = new HUD();
    this.input = new Input(this.canvas);
    this.particles = new ParticleBurst(this.scene);
    this.police = new PoliceManager(this.scene, this.world, this.wanted, this.sound);
    this.missions = new MissionManager(this.scene, this.world, this.traffic, this.sound, {
      onEvent: (t) => this.hud.showMessage(t, 5),
      onPay: (amount) => { this.money += amount; },
      onComplete: () => { this.refreshObjective(); },
      onFail: () => { this.refreshObjective(); },
    });

    this.state = 'menu'; // menu | playing | paused | busted | wasted
    this.money = 120;
    this.playerCar = null;
    this.camYaw = Math.PI;
    this.camPitch = 0.42;
    this.camDist = 11;
    this.shake = 0;
    this.ramCooldown = 0;
    this.arrestCooldown = 0;
    this.regenTimer = 0;
    this.hideoutMarker = null;
    this.buildHideoutMarker();
    this.bindUI();
    this.refreshObjective();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('error', (e) => {
      const el = document.getElementById('error');
      if (el) el.textContent = `Error: ${e.message}`;
    });
    this.applyShotMode();
    this.loop();
  }

  buildHideoutMarker() {
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 0.4, 20);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5 });
    this.hideoutMarker = new THREE.Mesh(geo, mat);
    this.hideoutMarker.position.set(PLACES.hideout.x, 0.2, PLACES.hideout.z);
    this.scene.add(this.hideoutMarker);
  }

  bindUI() {
    const $ = (id) => document.getElementById(id);
    $('start-btn').addEventListener('click', () => { this.sound.unlock(); this.sound.click(); this.startGame(); });
    $('continue-btn').addEventListener('click', () => {
      this.sound.unlock();
      const data = loadGame();
      this.startGame();
      if (data) this.applySave(data);
    });
    if (hasSave()) $('continue-btn').style.display = 'inline-block';
    $('resume-btn').addEventListener('click', () => this.setPaused(false));
    $('save-btn').addEventListener('click', () => { this.doSave(); this.hud.showMessage('Game saved.', 2); });
    $('load-btn').addEventListener('click', () => {
      const data = loadGame();
      if (data) { this.applySave(data); this.hud.showMessage('Save loaded.', 2); }
    });
    $('sound-btn').addEventListener('click', () => this.toggleSound());
    $('sound-btn2').addEventListener('click', () => this.toggleSound());
    $('restart-btn').addEventListener('click', () => this.respawnAfterIncident());
    $('restart-btn2').addEventListener('click', () => this.respawnAfterIncident());
    $('quit-btn').addEventListener('click', () => this.toMenu());
    $('quit-btn2').addEventListener('click', () => this.toMenu());
    $('pause-btn').addEventListener('click', () => this.setPaused(true));
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || this.playerCar) return;
      if (e.button === 0) this.tryShoot();
    });
  }

  toggleSound() {
    this.sound.unlock();
    this.sound.setEnabled(!this.sound.enabled);
    document.getElementById('sound-btn').textContent = this.sound.enabled ? 'Sound: On' : 'Sound: Off';
    document.getElementById('sound-btn2').textContent = this.sound.enabled ? 'Sound: On' : 'Sound: Off';
  }

  startGame() {
    this.state = 'playing';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('busted-screen').style.display = 'none';
    document.getElementById('wasted-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    this.sound.unlock();
  }

  toMenu() {
    this.state = 'menu';
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('busted-screen').style.display = 'none';
    document.getElementById('wasted-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
  }

  setPaused(on) {
    if (this.state !== 'playing' && !(this.state === 'paused' && !on)) return;
    this.state = on ? 'paused' : 'playing';
    document.getElementById('pause-screen').style.display = on ? 'flex' : 'none';
  }

  doSave() {
    saveGame({
      money: this.money,
      health: this.player.health,
      missionIndex: this.missions.index,
      playerX: this.player.pos.x,
      playerZ: this.player.pos.z,
      wanted: this.wanted.stars,
    });
  }

  applySave(data) {
    this.money = data.money;
    this.player.health = data.health;
    this.missions.index = data.missionIndex;
    this.player.pos.x = data.playerX;
    this.player.pos.z = data.playerZ;
    this.wanted.stars = data.wanted;
    if (this.playerCar) this.exitCar();
    this.refreshObjective();
  }

  respawnAfterIncident() {
    this.player.health = PLAYER.maxHealth;
    this.wanted.clear();
    if (this.playerCar) this.exitCar();
    this.player.pos.set(PLACES.hideout.x + 6, 0, PLACES.hideout.z + 4);
    this.player.mesh.position.set(PLACES.hideout.x + 6, 0, PLACES.hideout.z + 4);
    document.getElementById('busted-screen').style.display = 'none';
    document.getElementById('wasted-screen').style.display = 'none';
    this.state = 'playing';
    this.refreshObjective();
  }

  refreshObjective() {
    const m = this.missions.active;
    if (m) {
      const step = this.missions.stepDef();
      this._objective = step ? step.label : '';
      this._missionTitle = `${m.def.title} — $${m.def.pay}`;
      this._timeLeft = m.timeLeft;
    } else if (!this.missions.done) {
      const next = this.missions.currentDef;
      this._objective = `Press M at the gold marker to start: ${next.title}`;
      this._missionTitle = `Next mission: ${next.title} ($${next.pay})`;
      this._timeLeft = null;
    } else {
      this._objective = 'All missions complete! Free roam Neon Bay.';
      this._missionTitle = 'Story complete';
      this._timeLeft = null;
    }
  }

  // ---- entering / exiting cars ----

  enterCar(car) {
    if (!car) return;
    if (car.isTraffic && car.occupied) {
      // Steal: the driver bails and runs.
      car.occupied = false;
      this.wanted.addStars(1, this.time);
      this.hud.showMessage('Car stolen! The driver ran off. Wanted +1.', 3);
      this.peds.scare(car.pos.x, car.pos.z, 12);
    } else if (car.isParked) {
      // The mission coupe's heat is set by the mission itself, not here.
      if (!car.isMissionCoupe) {
        this.wanted.addStars(1, this.time);
        this.hud.showMessage('Car stolen! Wanted +1.', 3);
      }
    }
    car.isTraffic = false;
    car.isParked = false;
    this.playerCar = car;
    this.player.mesh.visible = false;
    this.sound.click();
  }

  exitCar() {
    if (!this.playerCar) return;
    const car = this.playerCar;
    const side = car.pos.x + Math.cos(car.heading) * 2.2;
    const sideZ = car.pos.z - Math.sin(car.heading) * 2.2;
    const fixed = this.world.collideCircle(side, sideZ, PLAYER.radius);
    this.player.pos.x = fixed.x;
    this.player.pos.z = fixed.z;
    this.player.mesh.position.set(fixed.x, 0, fixed.z);
    this.player.mesh.visible = true;
    this.playerCar = null;
    this.sound.click();
  }

  // ---- combat ----

  shootTargets() {
    const targets = [];
    for (const p of this.peds.peds) {
      if (!p.dead) targets.push({ pos: p.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), radius: 1.0, kind: 'ped', ref: p });
    }
    for (const c of this.police.cops) {
      targets.push({ pos: c.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)), radius: 1.0, kind: 'cop', ref: c });
    }
    for (const car of this.traffic.cars) {
      if (!car.dead) targets.push({ pos: car.pos.clone().add(new THREE.Vector3(0, 1, 0)), radius: 2.2, kind: 'car', ref: car });
    }
    return targets;
  }

  tryShoot() {
    if (this.combat.ammo <= 0) { this.combat.reload(); return; }
    const from = this.player.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const hit = this.combat.shoot(from, dir, this.shootTargets());
    if (!hit) return;
    this.combat.sparkAt(from.clone().addScaledVector(dir, 12));
    if (hit.kind === 'ped') {
      this.peds.knockDown(hit.ref);
      this.wanted.addStars(1, this.time);
      this.peds.scare(hit.pos.x, hit.pos.z, 20);
      this.hud.showMessage('You hit a pedestrian! Wanted +1.', 3);
    } else if (hit.kind === 'cop') {
      this.scene.remove(hit.ref.mesh);
      this.police.cops = this.police.cops.filter((c) => c !== hit.ref);
      this.wanted.addStars(2, this.time);
      this.hud.showMessage('You took down an officer! Wanted +2.', 3);
    } else if (hit.kind === 'car') {
      if (hit.ref === this.missions.courierCar) {
        // Shooting the courier out stops it and drops the package.
        this.missions.dropPackage();
        this.missions.advanceStep();
        return;
      }
      hit.ref.health -= 25;
      if (hit.ref.health <= 0 && !hit.ref.dead) {
        this.particles.burst(hit.ref.pos.x, 1, hit.ref.pos.z, 0x888888, 24);
        this.sound.crash();
        hit.ref.remove();
        this.traffic.cars = this.traffic.cars.filter((c) => c !== hit.ref);
      }
    }
  }

  tryPunch() {
    const targets = [];
    for (const p of this.peds.peds) {
      if (!p.dead) targets.push({ pos: p.mesh.position.clone(), radius: 1, kind: 'ped', ref: p });
    }
    for (const c of this.police.cops) {
      targets.push({ pos: c.mesh.position.clone(), radius: 1, kind: 'cop', ref: c });
    }
    const hit = this.combat.punch(this.player.pos, this.player.heading, targets);
    if (!hit) return;
    this.combat.sparkAt(hit.pos.clone().add(new THREE.Vector3(0, 1.2, 0)));
    if (hit.kind === 'ped') {
      this.peds.knockDown(hit.ref);
      this.wanted.addStars(1, this.time);
      this.hud.showMessage('You punched a pedestrian! Wanted +1.', 3);
    } else {
      this.scene.remove(hit.ref.mesh);
      this.police.cops = this.police.cops.filter((c) => c !== hit.ref);
      this.wanted.addStars(1, this.time);
    }
  }

  // ---- screenshot staging ----

  applyShotMode() {
    if (!SHOT) return;
    // Every shot mode starts the game for real and stages a live scene.
    this.startGame();
    const road = this.world.roadCenters;
    if (SHOT === 'drive') {
      // Mid-block on a road, facing down the avenue, traffic ahead.
      const car = new Car(this.scene, this.world, road[4], road[2], 0, 0xd9382b, {});
      this.traffic.cars.push(car);
      this.player.pos.set(road[4], 0, road[2]);
      this.enterCar(car);
      for (const [tx, tz] of [[road[4] + 2, road[2] + 45], [road[4] - 2, road[2] + 80]]) {
        const t = new Car(this.scene, this.world, tx, tz, 0, 0x2b6fd9, { traffic: true, occupied: true });
        t.targetNode = { x: tx, z: tz + 120 };
        this.traffic.cars.push(t);
      }
    } else if (SHOT === 'chase') {
      const car = new Car(this.scene, this.world, road[3], road[5], 0, 0x2b6fd9, {});
      this.traffic.cars.push(car);
      this.player.pos.set(road[3], 0, road[5]);
      this.enterCar(car);
      car.speed = 20;
      this.wanted.addStars(3, 0);
      for (let i = 0; i < 3; i++) this.police.spawnCar(this.player.pos);
      // One police car in frame ahead-right so the chase reads on screen.
      if (this.police.cars[0]) {
        this.police.cars[0].pos.x = road[3] + 9;
        this.police.cars[0].pos.z = road[5] + 32;
        this.police.cars[0].heading = Math.PI;
        this.police.cars[0].mesh.rotation.y = Math.PI;
      }
    } else if (SHOT === 'mission') {
      this.missions.startMission();
      const car = new Car(this.scene, this.world, 40, road[6], Math.PI / 2, 0xf2c230, {});
      this.traffic.cars.push(car);
      this.player.pos.set(40, 0, road[6]);
      this.enterCar(car);
      car.speed = 12;
      this.camYaw = Math.PI * 0.75;
    } else if (SHOT === 'foot') {
      // On an intersection, cop closing in, parked car and pedestrians near.
      this.player.pos.set(road[3], 0, road[5] - 2);
      this.wanted.addStars(1, 0);
      this.police.spawnCop(this.player.pos);
      if (this.police.cops[0]) {
        this.police.cops[0].mesh.position.set(road[3] + 6, 0, road[5] - 12);
      }
      const parked = new Car(this.scene, this.world, road[3] + 5, road[5] + 12, Math.PI / 2, 0x37b24d, { parked: true });
      this.traffic.cars.push(parked);
      this.camYaw = Math.PI * 1.2;
    }
    document.title = 'Neon Bay — ready';
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- main loop ----

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.world.update(dt, this.time);
    this.particles.update(dt);
    this.combat.update(dt);
    if (this.state === 'playing') this.updatePlaying(dt);
    if (this.state === 'playing' || this.state === 'menu') {
      // Ambient life keeps moving behind the menu too.
      this.traffic.update(dt);
      this.traffic.separate();
      this.peds.update(dt);
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  updatePlaying(dt) {
    const input = this.input;
    // Camera orbit.
    const mouse = input.consumeMouse();
    this.camYaw -= mouse.dx * 0.004;
    this.camPitch = Math.max(0.05, Math.min(1.1, this.camPitch + mouse.dy * 0.003));

    if (input.wasPressed('Escape') || input.wasPressed('KeyP')) { this.setPaused(true); return; }
    if (input.wasPressed('KeyR')) this.combat.reload();
    if (input.wasPressed('KeyF')) this.tryPunch();
    if (input.wasPressed('KeyJ')) this.tryShoot();
    if (input.wasPressed('KeyE')) {
      if (this.playerCar) this.exitCar();
      else {
        const car = this.traffic.nearestCar(this.player.pos.x, this.player.pos.z, 4.5);
        if (car) this.enterCar(car);
      }
    }
    // Mission start at the hideout marker.
    const hideoutD = Math.hypot(this.player.pos.x - PLACES.hideout.x, this.player.pos.z - PLACES.hideout.z);
    if (!this.missions.active && !this.missions.done && hideoutD < 7) {
      if (input.wasPressed('KeyM')) {
        this.missions.startMission();
        this.refreshObjective();
      }
    }

    const axes = input.moveAxes();
    const running = input.held('ShiftLeft') || input.held('ShiftRight');

    if (this.playerCar) {
      const car = this.playerCar;
      const throttle = axes.y;
      const steer = -axes.x;
      car.drive(throttle, steer, dt);
      // Handbrake.
      if (input.held('Space')) car.speed *= Math.max(0, 1 - 3 * dt);
      // Running over pedestrians.
      for (const p of this.peds.peds) {
        if (p.dead) continue;
        const d = Math.hypot(p.mesh.position.x - car.pos.x, p.mesh.position.z - car.pos.z);
        if (d < 2.2 && Math.abs(car.speed) > 5) {
          this.peds.knockDown(p);
          this.wanted.addStars(1, this.time);
          this.peds.scare(p.mesh.position.x, p.mesh.position.z, 25);
          this.sound.crash();
          this.shake = 0.4;
        }
      }
      // Car destroyed.
      if (car.health <= 0) {
        this.particles.burst(car.pos.x, 1, car.pos.z, 0x555555, 30);
        this.sound.crash();
        this.exitCar();
        car.remove();
        this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
        this.wanted.addStars(1, this.time);
      }
      this.sound.setEngine(Math.abs(car.speed) / 34, true);
      // Camera follows the car's heading.
      let targetYaw = car.heading + Math.PI;
      let diff = targetYaw - this.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(mouse.dx) < 1) this.camYaw += diff * Math.min(1, dt * 1.2);
    } else {
      if (input.wasPressed('Space')) this.player.jump();
      // Camera-relative movement: forward is from the camera toward the
      // player, right is its perpendicular.
      const sin = Math.sin(this.camYaw), cos = Math.cos(this.camYaw);
      const moveX = -sin * axes.y + cos * axes.x;
      const moveZ = -cos * axes.y - sin * axes.x;
      this.player.update(dt, moveX, moveZ, running);
      this.sound.setEngine(0, false);
    }

    // Wanted + police.
    this.ramCooldown = Math.max(0, this.ramCooldown - dt);
    this.arrestCooldown = Math.max(0, this.arrestCooldown - dt);
    const playerPos = this.playerCar ? this.playerCar.pos : this.player.pos;
    const policeNear = this.police.policeNear(playerPos, 45);
    this.wanted.update(dt, policeNear);
    this.police.update(dt, playerPos, !!this.playerCar,
      (cop) => {
        if (this.arrestCooldown > 0 || this.playerCar) return;
        this.arrestCooldown = 3;
        this.busted();
      },
      (car) => {
        if (this.ramCooldown > 0) return;
        this.ramCooldown = 1.2;
        this.shake = 0.5;
        this.sound.crash();
        this.particles.burst(car.pos.x, 1, car.pos.z, 0xffdd55, 10);
        if (this.playerCar) {
          this.playerCar.health -= 12;
          this.playerCar.speed *= 0.5;
        } else {
          if (this.player.damage(12)) this.wasted();
        }
      });
    this.police.copGunfire(playerPos, dt, (from, hit) => {
      this.sound.gunshot();
      this.particles.burst(this.player.pos.x, 1.4, this.player.pos.z, 0xffe066, 4);
      if (hit && !this.playerCar) {
        if (this.player.damage(9)) this.wasted();
      }
    });

    // Missions.
    this.missions.update(dt, this.player, this.playerCar, this.wanted);
    this.refreshObjective();

    // Health regen when calm.
    if (this.wanted.stars === 0 && this.player.health < PLAYER.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer > 2) { this.player.heal(4 * dt); }
    } else this.regenTimer = 0;

    // HUD.
    const target = this.missions.targetPos() || this.missions.idleMarkerPos();
    this.hud.update(dt, {
      health: this.player.health,
      money: this.money,
      wanted: this.wanted.stars,
      inCar: !!this.playerCar,
      speed: this.playerCar ? this.playerCar.speed : 0,
      ammo: this.combat.ammo,
      ammoMax: this.combat.ammoMax,
      reloading: this.combat.reloadTimer > 0,
      missionTitle: this._missionTitle,
      objective: this._objective,
      timeLeft: this._timeLeft,
      playerX: playerPos.x,
      playerZ: playerPos.z,
      heading: this.playerCar ? this.playerCar.heading : this.player.heading,
      roadCenters: this.world.roadCenters,
      hideout: PLACES.hideout,
      missionTarget: target,
      policeCars: this.police.cars.map((c) => ({ x: c.pos.x, z: c.pos.z })),
      cars: this.traffic.cars.filter((c) => !c.dead).map((c) => ({ x: c.pos.x, z: c.pos.z })),
      peds: this.peds.peds.filter((p) => !p.dead).map((p) => ({ x: p.mesh.position.x, z: p.mesh.position.z })),
    });

    // Hideout marker pulse.
    if (this.hideoutMarker) {
      this.hideoutMarker.visible = !this.missions.active && !this.missions.done;
      this.hideoutMarker.scale.setScalar(1 + Math.sin(this.time * 3) * 0.15);
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
  }

  busted() {
    this.state = 'busted';
    const fine = Math.min(this.money, 200);
    this.money -= fine;
    this.wanted.clear();
    this.sound.busted();
    document.getElementById('busted-fine').textContent = `You were arrested. Fine: $${fine}.`;
    document.getElementById('busted-screen').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  }

  wasted() {
    this.state = 'wasted';
    const lost = Math.min(this.money, 150);
    this.money -= lost;
    this.wanted.clear();
    this.sound.missionFail();
    document.getElementById('wasted-lost').textContent = `You were taken out. Hospital bill: $${lost}.`;
    document.getElementById('wasted-screen').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  }

  updateCamera(dt) {
    const target = this.playerCar ? this.playerCar.pos : this.player.pos;
    const tx = target.x, ty = target.y + 1.6, tz = target.z;
    const dist = this.playerCar ? this.camDist + 3 : this.camDist;
    const cx = tx + Math.sin(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cz = tz + Math.cos(this.camYaw) * Math.cos(this.camPitch) * dist;
    const cy = ty + Math.sin(this.camPitch) * dist;
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.camera.position.set(cx + shakeX, Math.max(cy + shakeY, 1.2), cz);
    this.camera.lookAt(tx, ty, tz);
    void dt;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const story = document.getElementById('story-text');
  if (story) story.textContent = STORY.intro;
  try {
    window.__game = new Game();
  } catch (e) {
    const el = document.getElementById('error');
    if (el) el.textContent = `Error: ${e.message}`;
    console.error(e);
  }
});

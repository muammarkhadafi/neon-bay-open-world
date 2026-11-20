// Neon Bay — the story missions: three jobs from Sol Reyes, each with its
// steps, a timer, a target marker, and complete / fail states.

import * as THREE from 'three';
import { MISSIONS, PLACES } from './config.js';
import { Car } from './vehicles.js';
import { PALETTE } from './config.js';

export class MissionManager {
  constructor(scene, world, traffic, sound, callbacks) {
    this.scene = scene;
    this.world = world;
    this.traffic = traffic;
    this.sound = sound;
    this.cb = callbacks; // {onEvent(text), onPay(amount), onComplete(id), onFail(reason)}
    this.index = 0; // the next mission to run
    this.active = null; // {def, step, timeLeft, ...}
    this.markerMesh = null;
    this.courierCar = null;
    this.packageMesh = null;
    this.coupeCar = null;
    this.passenger = null;
    this.buildMarker();
  }

  buildMarker() {
    const geo = new THREE.ConeGeometry(1.2, 2.4, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    this.markerMesh = new THREE.Mesh(geo, mat);
    this.markerMesh.rotation.x = Math.PI;
    this.markerMesh.visible = false;
    this.scene.add(this.markerMesh);
  }

  get currentDef() { return MISSIONS[this.index] || null; }
  get done() { return this.index >= MISSIONS.length; }

  // A gold start marker floats over the hideout while a mission is open.
  idleMarkerPos() {
    return this.done ? null : PLACES.hideout;
  }

  startMission() {
    const def = this.currentDef;
    if (!def || this.active) return false;
    this.active = { def, step: 0, timeLeft: def.timeLimit, passenger: false, escaped: false };
    this.sound.missionStart();
    this.cb.onEvent(`Mission: ${def.title} — ${def.brief}`);
    this.setupStep();
    return true;
  }

  stepDef() {
    return this.active ? this.active.def.steps[this.active.step] : null;
  }

  targetPos() {
    const step = this.stepDef();
    if (!step) return null;
    if (step.type === 'chase' && this.courierCar) return { x: this.courierCar.pos.x, z: this.courierCar.pos.z };
    if (step.type === 'collect' && this.packageMesh) return { x: this.packageMesh.position.x, z: this.packageMesh.position.z };
    if (step.type === 'steal' && this.coupeCar) return { x: this.coupeCar.pos.x, z: this.coupeCar.pos.z };
    return PLACES[step.target] || null;
  }

  setupStep() {
    const step = this.stepDef();
    if (!step) return;
    this.world.setBeacon(0, 0, false);
    this.markerMesh.visible = false;
    if (step.type === 'steal' && !this.coupeCar) {
      const p = PLACES.coupe;
      this.coupeCar = new Car(this.scene, this.world, p.x, p.z, Math.PI / 2, 0xffd23f, { parked: true });
      this.coupeCar.isMissionCoupe = true;
      this.traffic.cars.push(this.coupeCar);
    }
    if (step.type === 'chase' && !this.courierCar) {
      const p = PLACES.courier;
      this.courierCar = new Car(this.scene, this.world, p.x, p.z, 0, 0x7048e8, { traffic: true, occupied: true });
      this.courierCar.cruiseSpeed = 13;
      this.traffic.cars.push(this.courierCar);
    }
    const pos = this.targetPos();
    if (pos && step.type !== 'escape') {
      this.world.setBeacon(pos.x, pos.z, true);
      this.markerMesh.position.set(pos.x, 6, pos.z);
      this.markerMesh.visible = true;
    }
  }

  advanceStep() {
    this.active.step++;
    if (this.active.step >= this.active.def.steps.length) {
      this.completeMission();
    } else {
      this.setupStep();
      this.cb.onEvent(`Objective: ${this.stepDef().label}`);
    }
  }

  completeMission() {
    const def = this.active.def;
    this.active = null;
    this.world.setBeacon(0, 0, false);
    this.markerMesh.visible = false;
    this.cleanupMissionProps();
    this.index++;
    this.sound.missionDone();
    this.cb.onPay(def.pay);
    this.cb.onEvent(`Mission complete: ${def.title} — paid $${def.pay}.`);
    this.cb.onComplete(def.id);
  }

  failMission(reason) {
    if (!this.active) return;
    const title = this.active.def.title;
    this.active = null;
    this.world.setBeacon(0, 0, false);
    this.markerMesh.visible = false;
    this.cleanupMissionProps();
    this.sound.missionFail();
    this.cb.onEvent(`Mission failed: ${title} — ${reason}`);
    this.cb.onFail(reason);
  }

  cleanupMissionProps() {
    if (this.courierCar) { this.courierCar.remove(); this.traffic.cars = this.traffic.cars.filter((c) => c !== this.courierCar); this.courierCar = null; }
    if (this.coupeCar) { this.coupeCar.remove(); this.traffic.cars = this.traffic.cars.filter((c) => c !== this.coupeCar); this.coupeCar = null; }
    if (this.packageMesh) { this.scene.remove(this.packageMesh); this.packageMesh = null; }
    this.passenger = null;
  }

  // Runs every frame with the player's state.
  update(dt, player, playerCar, wanted) {
    if (this.markerMesh.visible) {
      this.markerMesh.position.y = 6 + Math.sin(performance.now() * 0.003) * 0.6;
      this.markerMesh.rotation.y += dt * 2;
    }
    if (!this.active) return;
    const m = this.active;
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) { this.failMission('Time ran out.'); return; }
    const step = this.stepDef();
    if (!step) return;
    // While driving, use the car's spot — the on-foot mesh stays behind.
    const px = playerCar ? playerCar.pos.x : player.pos.x;
    const pz = playerCar ? playerCar.pos.z : player.pos.z;
    const inCar = !!playerCar;

    if (step.type === 'goto' || step.type === 'deliver' || step.type === 'collect') {
      const pos = this.targetPos();
      if (!pos) return;
      const d = Math.hypot(px - pos.x, pz - pos.z);
      if (d < 6) {
        if (step.type === 'goto') {
          m.passenger = true;
          this.sound.pickup();
          this.cb.onEvent('Client picked up. Drive them to the Azure Hotel.');
          this.advanceStep();
        } else if (step.type === 'deliver') {
          if (step.needsPassenger && !m.passenger) return;
          if (step.needsCar && !inCar) { this.cb.onEvent('Bring the car into the marker.'); return; }
          this.advanceStep();
        } else if (step.type === 'collect') {
          this.sound.pickup();
          this.advanceStep();
        }
      }
    } else if (step.type === 'steal') {
      if (playerCar && playerCar === this.coupeCar) {
        this.cb.onEvent('You have the coupe. Now lose the heat!');
        wanted.addStars(2, performance.now() / 1000);
        this.advanceStep();
      }
    } else if (step.type === 'escape') {
      if (wanted.stars === 0) {
        this.cb.onEvent('Heat is off. Deliver the coupe to the Palm Row garage.');
        this.advanceStep();
      }
    } else if (step.type === 'chase') {
      if (this.courierCar) {
        // The courier runs away from the player.
        const dx = this.courierCar.pos.x - px;
        const dz = this.courierCar.pos.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < 30) {
          this.courierCar.targetNode = { x: this.courierCar.pos.x + dx * 2, z: this.courierCar.pos.z + dz * 2 };
        }
        // Rammed hard or slowed right down counts as stopped.
        if (d < 4.5) this.courierCar.slowTimer = 1.5;
        if (d < 4.5 && Math.abs(this.courierCar.speed) < 3) {
          this.dropPackage();
          this.advanceStep();
        }
        // Or the player is on foot right beside it while it crawls.
        if (!inCar && d < 3.5 && Math.abs(this.courierCar.speed) < 3) {
          this.dropPackage();
          this.advanceStep();
        }
      }
    }
    // Keep the beacon on a moving target.
    const pos = this.targetPos();
    if (pos && step.type !== 'escape') {
      this.world.setBeacon(pos.x, pos.z, true);
      this.markerMesh.position.set(pos.x, 6, pos.z);
      this.markerMesh.visible = true;
    }
  }

  dropPackage() {
    if (this.courierCar) {
      const x = this.courierCar.pos.x, z = this.courierCar.pos.z;
      this.packageMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.7, 1),
        new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x554400 }),
      );
      this.packageMesh.position.set(x, 0.5, z);
      this.scene.add(this.packageMesh);
      this.courierCar.remove();
      this.traffic.cars = this.traffic.cars.filter((c) => c !== this.courierCar);
      this.courierCar = null;
      this.sound.pickup();
      this.cb.onEvent('Courier stopped! Grab the package.');
    }
  }
}

// Neon Bay — the wanted level and the Bay City Police: patrol cars that
// chase and ram, and officers on foot who chase and arrest.

import * as THREE from 'three';
import { Car, buildCarMesh } from './vehicles.js';
import { buildHumanMesh } from './people.js';
import { WANTED, PALETTE } from './config.js';

export class WantedSystem {
  constructor() {
    this.stars = 0;
    this.cleanTimer = 0;
    this.lastCrimeAt = 0;
  }

  addStars(n, now) {
    this.stars = Math.min(WANTED.maxStars, this.stars + n);
    this.cleanTimer = 0;
    this.lastCrimeAt = now;
  }

  // One star fades per clean interval, while no police are close by.
  update(dt, policeNear) {
    if (this.stars === 0) return;
    if (policeNear) { this.cleanTimer = 0; return; }
    this.cleanTimer += dt;
    if (this.cleanTimer >= WANTED.decaySeconds) {
      this.stars -= 1;
      this.cleanTimer = 0;
    }
  }

  clear() { this.stars = 0; this.cleanTimer = 0; }
}

export class PoliceManager {
  constructor(scene, world, wanted, sound) {
    this.scene = scene;
    this.world = world;
    this.wanted = wanted;
    this.sound = sound;
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
    this.sirenFlash = 0;
  }

  update(dt, playerPos, playerInCar, onArrest, onRam) {
    const stars = this.wanted.stars;
    this.sound.setSiren(stars > 0 && this.cars.length > 0);
    // Spawn up to the caps.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      const wantCars = WANTED.policeCarCap[stars];
      const wantCops = playerInCar ? 0 : WANTED.copCap[stars];
      while (this.cars.length < wantCars) this.spawnCar(playerPos);
      while (this.cops.length < wantCops) this.spawnCop(playerPos);
    }
    // Shed the extras when the heat falls.
    while (this.cars.length > WANTED.policeCarCap[stars]) this.cars.pop().remove();
    while (this.cops.length > (playerInCar ? 0 : WANTED.copCap[stars])) {
      const c = this.cops.pop();
      this.scene.remove(c.mesh);
    }
    // Chase cars: steer straight at the player and ram on contact.
    for (const car of this.cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 320) {
        // Pull it closer so the chase never dies of distance.
        car.pos.x = playerPos.x + (Math.random() - 0.5) * 90;
        car.pos.z = playerPos.z + (Math.random() - 0.5) * 90;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.speed = Math.min(30, 16 + stars * 2.5);
      const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = this.world.collideCircle(nx, nz, 1.6);
      car.pos.x = fixed.x;
      car.pos.z = fixed.z;
      car.mesh.rotation.y = car.heading;
      if (dist < 3.2 && onRam) onRam(car);
      // The flashing light bar.
      this.sirenFlash += dt;
      const lights = car.mesh.userData.lights;
      if (lights) {
        const on = Math.floor(this.sirenFlash * 4) % 2 === 0;
        lights.red.material.color.setHex(on ? 0xff2222 : 0x550000);
        lights.blue.material.color.setHex(on ? 0x112244 : 0x2266ff);
      }
    }
    // Officers on foot chase and arrest.
    for (const cop of this.cops) {
      const dx = playerPos.x - cop.mesh.position.x;
      const dz = playerPos.z - cop.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 200) {
        cop.mesh.position.x = playerPos.x + (Math.random() - 0.5) * 60;
        cop.mesh.position.z = playerPos.z + (Math.random() - 0.5) * 60;
      } else if (dist > 1.4) {
        const h = Math.atan2(dx, dz);
        const speed = 7.5;
        let x = cop.mesh.position.x + Math.sin(h) * speed * dt;
        let z = cop.mesh.position.z + Math.cos(h) * speed * dt;
        const fixed = this.world.collideCircle(x, z, 0.5);
        cop.mesh.position.x = fixed.x;
        cop.mesh.position.z = fixed.z;
        cop.mesh.rotation.y = h;
        cop.phase += dt * 12;
        const s = Math.sin(cop.phase);
        cop.mesh.userData.legL.rotation.x = s * 0.7;
        cop.mesh.userData.legR.rotation.x = -s * 0.7;
      } else if (onArrest) {
        onArrest(cop);
      }
    }
  }

  spawnCar(playerPos) {
    const x = playerPos.x + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40);
    const z = playerPos.z + (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 40);
    const car = new Car(this.scene, this.world, x, z, Math.random() * Math.PI * 2, PALETTE.policeCar, { police: true });
    this.cars.push(car);
  }

  spawnCop(playerPos) {
    const mesh = buildHumanMesh(0x1a1a2e, 0x1a1a2e, 0xd9a066);
    // A police cap.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.44), new THREE.MeshLambertMaterial({ color: 0x0a1a3a }));
    cap.position.y = 1.95;
    mesh.add(cap);
    mesh.position.set(
      playerPos.x + (Math.random() - 0.5) * 50,
      0,
      playerPos.z + (Math.random() - 0.5) * 50,
    );
    this.scene.add(mesh);
    this.cops.push({ mesh, phase: 0 });
  }

  policeNear(playerPos, radius) {
    for (const car of this.cars) {
      if (Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) < radius) return true;
    }
    for (const cop of this.cops) {
      if (Math.hypot(cop.mesh.position.x - playerPos.x, cop.mesh.position.z - playerPos.z) < radius) return true;
    }
    return false;
  }

  // Officers fire at wanted 2 and above, when the player is on foot and in
  // range.
  copGunfire(playerPos, dt, onShot) {
    if (this.wanted.stars < 2) return;
    this._fireTimer = (this._fireTimer || 0) - dt;
    if (this._fireTimer > 0) return;
    for (const cop of this.cops) {
      const d = Math.hypot(cop.mesh.position.x - playerPos.x, cop.mesh.position.z - playerPos.z);
      if (d < 26 && Math.random() < 0.5) {
        this._fireTimer = 1.1;
        if (onShot) onShot(cop.mesh.position, Math.random() < 0.3);
        break;
      }
    }
  }
}

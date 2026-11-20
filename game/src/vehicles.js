// Neon Bay — cars: the cars the player drives, the parked cars, and the
// traffic system that moves NPC cars around the road graph.

import * as THREE from 'three';
import { CAR, PALETTE } from './config.js';

let nextCarId = 0;

export function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a, emissive: 0x0a1420 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.25, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w);
    wheels.push(w);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(hx, 0.7, 2.21);
    group.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const hx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(hx, 0.7, -2.21);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.65, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.65, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.32, 1.65, -0.2);
    group.add(blue);
    group.userData.lights = { red, blue };
  }
  group.userData.wheels = wheels;
  return group;
}

export class Car {
  constructor(scene, world, x, z, heading, color, opts = {}) {
    this.id = ++nextCarId;
    this.scene = scene;
    this.world = world;
    this.isPolice = !!opts.police;
    this.isTraffic = !!opts.traffic;
    this.isParked = !!opts.parked;
    this.occupied = !!opts.occupied;
    this.health = 100;
    this.speed = 0;
    this.heading = heading || 0;
    this.steer = 0;
    this.mesh = buildCarMesh(color, this.isPolice);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
    this.dead = false;
    this.stuckTimer = 0;
    this.lastX = x; this.lastZ = z;
    // Traffic AI state.
    this.targetNode = null;
    this.cruiseSpeed = 7 + Math.random() * 4;
    this.slowTimer = 0; // being rammed or damaged slows a traffic car a while
  }

  get pos() { return this.mesh.position; }

  remove() {
    this.scene.remove(this.mesh);
    this.dead = true;
  }

  // The player driving: throttle -1..1, steer -1..1.
  drive(throttle, steer, dt) {
    const maxF = CAR.maxSpeed, maxR = CAR.maxReverse;
    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.reverseAccel * dt;
    } else {
      this.speed -= Math.sign(this.speed) * CAR.drag * 4 * dt;
      if (Math.abs(this.speed) < 0.2) this.speed = 0;
    }
    this.speed = Math.max(-maxR, Math.min(maxF, this.speed));
    const turn = steer * CAR.turnRate * dt * Math.sign(this.speed || 1) * Math.min(1, Math.abs(this.speed) / 6 + 0.25);
    this.heading += turn;
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const fixed = this.world.collideCircle(nx, nz, CAR.radius);
    const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
    if (hitWall && Math.abs(this.speed) > 6) {
      this.speed *= 0.35;
      this.health -= 4;
      if (this.onCrash) this.onCrash(Math.abs(this.speed));
    }
    this.pos.x = fixed.x;
    this.pos.z = fixed.z;
    this.mesh.rotation.y = this.heading;
    // Spin the wheels.
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 1.6;
    return hitWall;
  }

  // NPC traffic: drive the road graph toward a target intersection, then
  // pick another one.
  updateTraffic(dt) {
    if (!this.targetNode) this.targetNode = this.world.randomNode();
    const dx = this.targetNode.x - this.pos.x;
    const dz = this.targetNode.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      this.targetNode = this.world.randomNode();
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      this.speed = this.cruiseSpeed * 0.15;
    } else {
      this.speed = this.cruiseSpeed;
    }
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    const fixed = this.world.collideCircle(nx, nz, CAR.radius);
    this.pos.x = fixed.x;
    this.pos.z = fixed.z;
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 1.6;
    // Stuck check: if it barely moved, send it somewhere else.
    const moved = Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ);
    if (moved < 0.05) this.stuckTimer += dt; else this.stuckTimer = 0;
    this.lastX = this.pos.x; this.lastZ = this.pos.z;
    if (this.stuckTimer > 3) { this.targetNode = this.world.randomNode(); this.stuckTimer = 0; }
  }
}

export class TrafficManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.spawn();
  }

  spawn() {
    const centers = this.world.roadCenters;
    for (let i = 0; i < 14; i++) {
      const alongX = i % 2 === 0;
      const c = centers[1 + Math.floor(Math.random() * (centers.length - 2))];
      const t = -180 + Math.random() * 360;
      const color = PALETTE.carColors[i % PALETTE.carColors.length];
      const car = new Car(this.scene, this.world, alongX ? t : c, alongX ? c : t, alongX ? Math.PI / 2 : 0, color, { traffic: true, occupied: true });
      car.targetNode = this.world.randomNode();
      this.cars.push(car);
    }
    // Parked cars: ten of them, lined up along the road shoulder so they sit
    // parallel to the street instead of jutting into the buildings.
    const PARKED_COUNT = 10;
    const ROAD_EDGE = 5.5;
    for (let slot = 0; slot < PARKED_COUNT; slot++) {
      const street = centers[1 + Math.floor(Math.random() * (centers.length - 2))];
      const along = -170 + Math.random() * 340;
      const shade = PALETTE.carColors[(slot + 3) % PALETTE.carColors.length];
      const faceEast = slot % 2 === 0;
      const parked = new Car(this.scene, this.world, along, street + ROAD_EDGE, faceEast ? Math.PI / 2 : -Math.PI / 2, shade, { parked: true });
      this.cars.push(parked);
    }
  }

  nearestCar(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const car of this.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.pos.x - x, car.pos.z - z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  update(dt) {
    for (const car of this.cars) {
      if (car.dead || !car.isTraffic) continue;
      car.updateTraffic(dt);
    }
  }

  // Simple car-car separation so traffic does not drive through itself.
  separate() {
    const list = this.cars.filter((c) => !c.dead);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 3.4) {
          const push = (3.4 - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }
  }
}

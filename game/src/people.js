// Neon Bay — people: the player character on foot and the pedestrians who
// walk the sidewalks (and flee from trouble).

import * as THREE from 'three';
import { PLAYER } from './config.js';

export function buildHumanMesh(shirtColor, pantsColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor || 0xd9a066 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.68;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.44), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }));
  hair.position.y = 1.92;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
  legL.position.set(-0.17, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
  legR.position.set(0.17, 0.35, 0);
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), shirt);
  armL.position.set(-0.42, 1.05, 0);
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), shirt);
  armR.position.set(0.42, 1.05, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

export class Player {
  constructor(scene, world, x, z) {
    this.scene = scene;
    this.world = world;
    this.mesh = buildHumanMesh(0x2b6fd9, 0x222831, 0xd9a066);
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = 0;
    this.vy = 0;
    this.y = 0;
    this.onGround = true;
    this.health = PLAYER.maxHealth;
    this.walkPhase = 0;
    this.moving = false;
  }

  get pos() { return this.mesh.position; }

  update(dt, moveX, moveZ, running) {
    const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.hypot(moveX, moveZ);
    this.moving = len > 0.01;
    if (this.moving) {
      const nx = moveX / len, nz = moveZ / len;
      let x = this.pos.x + nx * speed * dt;
      let z = this.pos.z + nz * speed * dt;
      const fixed = this.world.collideCircle(x, z, PLAYER.radius);
      this.pos.x = fixed.x;
      this.pos.z = fixed.z;
      this.heading = Math.atan2(nx, nz);
      this.mesh.rotation.y = this.heading;
      this.walkPhase += dt * speed * 1.6;
      const s = Math.sin(this.walkPhase);
      this.mesh.userData.legL.rotation.x = s * 0.7;
      this.mesh.userData.legR.rotation.x = -s * 0.7;
      this.mesh.userData.armL.rotation.x = -s * 0.5;
      this.mesh.userData.armR.rotation.x = s * 0.5;
    } else {
      this.mesh.userData.legL.rotation.x *= 0.8;
      this.mesh.userData.legR.rotation.x *= 0.8;
      this.mesh.userData.armL.rotation.x *= 0.8;
      this.mesh.userData.armR.rotation.x *= 0.8;
    }
    // Jump / gravity.
    this.vy -= PLAYER.gravity * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; this.onGround = true; }
    this.pos.y = this.y;
  }

  jump() {
    if (this.onGround) {
      this.vy = PLAYER.jumpSpeed;
      this.onGround = false;
    }
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }
}

export class PedestrianManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.peds = [];
    const shirts = [0xe8590c, 0x37b24d, 0x7048e8, 0xf2c230, 0x12b886, 0xd9382b, 0x868e96];
    for (let i = 0; i < 26; i++) {
      const node = world.randomNode();
      const mesh = buildHumanMesh(shirts[i % shirts.length], 0x2b2f36, [0xd9a066, 0x8a5a3b, 0xe8b98a][i % 3]);
      mesh.position.set(node.x + (Math.random() - 0.5) * 6, 0, node.z + (Math.random() - 0.5) * 6);
      scene.add(mesh);
      this.peds.push({
        mesh,
        heading: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 1.2,
        target: world.randomNode(),
        fleeing: false,
        fleeTimer: 0,
        phase: Math.random() * 6,
        dead: false,
      });
    }
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < radius) {
        p.fleeing = true;
        p.fleeTimer = 4 + Math.random() * 2;
        p.heading = Math.atan2(p.mesh.position.x - x, p.mesh.position.z - z);
      }
    }
  }

  update(dt) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (p.fleeing) {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) p.fleeing = false;
      } else {
        const dx = p.target.x - p.mesh.position.x;
        const dz = p.target.z - p.mesh.position.z;
        if (Math.hypot(dx, dz) < 5) p.target = this.world.randomNode();
        else p.heading = Math.atan2(dx, dz);
      }
      const speed = p.fleeing ? p.speed * 2.6 : p.speed;
      let x = p.mesh.position.x + Math.sin(p.heading) * speed * dt;
      let z = p.mesh.position.z + Math.cos(p.heading) * speed * dt;
      const fixed = this.world.collideCircle(x, z, 0.5);
      p.mesh.position.x = fixed.x;
      p.mesh.position.z = fixed.z;
      p.mesh.rotation.y = p.heading;
      p.phase += dt * speed * 2.4;
      const s = Math.sin(p.phase);
      p.mesh.userData.legL.rotation.x = s * 0.6;
      p.mesh.userData.legR.rotation.x = -s * 0.6;
    }
  }

  // Nearest pedestrian within range (for melee / interaction).
  nearest(x, z, maxDist) {
    let best = null, bd = maxDist;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = Math.hypot(p.mesh.position.x - x, p.mesh.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  knockDown(ped) {
    ped.dead = true;
    ped.mesh.rotation.z = Math.PI / 2;
    ped.mesh.position.y = 0.3;
    setTimeout(() => {
      if (!ped.dead) return;
      ped.dead = false;
      ped.mesh.rotation.z = 0;
      ped.mesh.position.y = 0;
      ped.fleeing = true;
      ped.fleeTimer = 6;
    }, 5000);
  }
}

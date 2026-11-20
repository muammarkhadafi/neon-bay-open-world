// Neon Bay — fighting: the pistol (hitscan, with a tracer and a muzzle
// flash) and bare-handed punches. Kept tame: hits throw sparks, the target
// goes down, no gore.

import * as THREE from 'three';

export class Combat {
  constructor(scene, world, sound) {
    this.scene = scene;
    this.world = world;
    this.sound = sound;
    this.ammo = 12;
    this.ammoMax = 12;
    this.reloadTimer = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.tracer = null;
    this.muzzle = null;
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.tracer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), beamMat);
    this.tracer.visible = false;
    scene.add(this.tracer);
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0.9 }),
    );
    this.muzzle.visible = false;
    scene.add(this.muzzle);
    this._flashTimer = 0;
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = this.ammoMax;
    }
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        this.tracer.visible = false;
        this.muzzle.visible = false;
      }
    }
  }

  reload() {
    if (this.ammo < this.ammoMax && this.reloadTimer <= 0) {
      this.reloadTimer = 1.2;
      this.sound.click();
      return true;
    }
    return false;
  }

  // A hitscan shot fired from `from` along `dir`. Gives back the first thing
  // hit, or null. targets look like [{pos: Vector3, radius, kind, ref}],
  // with kind 'ped', 'cop' or 'car'.
  shoot(from, dir, targets) {
    if (this.shootCooldown > 0 || this.reloadTimer > 0) return null;
    if (this.ammo <= 0) { this.reload(); return null; }
    this.ammo--;
    this.shootCooldown = 0.28;
    this.sound.gunshot();
    const range = 60;
    let best = null, bestT = range;
    for (const t of targets) {
      const to = new THREE.Vector3().subVectors(t.pos, from);
      const along = to.dot(dir);
      if (along < 0 || along > bestT) continue;
      const perp = to.clone().addScaledVector(dir, -along).length();
      if (perp < (t.radius || 1.2)) { best = t; bestT = along; }
    }
    const end = from.clone().addScaledVector(dir, best ? bestT : range);
    // Tracer beam and muzzle flash.
    const mid = from.clone().add(end).multiplyScalar(0.5);
    this.tracer.position.copy(mid);
    this.tracer.lookAt(end);
    this.tracer.scale.set(1, 1, from.distanceTo(end));
    this.tracer.visible = true;
    this.muzzle.position.copy(from).addScaledVector(dir, 0.8);
    this.muzzle.visible = true;
    this._flashTimer = 0.07;
    return best;
  }

  // A melee punch straight ahead of the player. Gives back the first target
  // hit, or null.
  punch(from, heading, targets) {
    if (this.punchCooldown > 0) return null;
    this.punchCooldown = 0.45;
    this.sound.punch();
    const dir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    for (const t of targets) {
      const to = new THREE.Vector3().subVectors(t.pos, from);
      if (to.length() < 2.2 && to.normalize().dot(dir) > 0.3) return t;
    }
    return null;
  }

  sparkAt(pos) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    );
    spark.position.copy(pos);
    this.scene.add(spark);
    setTimeout(() => this.scene.remove(spark), 120);
  }
}

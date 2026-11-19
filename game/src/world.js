// Neon Bay — the city itself: roads, sidewalks, buildings, palms, beach,
// ocean, marina and props. Also owns collision (building AABBs) and the road
// graph that traffic, police and missions drive on.

import * as THREE from 'three';
import { CITY, PALETTE, roadCenters } from './config.js';

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#20242c';
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      g.fillStyle = Math.random() < 0.45 ? '#ffd97a' : '#3a5a78';
      g.fillRect(x, y, 9, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33363d';
  g.fillRect(0, 0, 128, 128);
  // Subtle asphalt speckle only — no stripes.
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.buildings = []; // {minX, maxX, minZ, maxZ, height, mesh}
    this.roadCenters = roadCenters();
    this.ocean = null;
    this.beacon = null; // floating mission marker mesh
    this.build();
  }

  build() {
    const scene = this.scene;
    scene.background = new THREE.Color(PALETTE.sky);
    scene.fog = new THREE.Fog(PALETTE.sky, 260, 620);

    const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    sun.position.set(120, 180, 60);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1));

    const span = CITY.halfSpan;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(span * 2 + 260, span * 2 + 260),
      new THREE.MeshLambertMaterial({ color: 0x6f8f5a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 40);
    scene.add(ground);

    // Roads: dark strips both directions + centre dashes.
    const roadTex = makeRoadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
    const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.roadLine });
    for (const c of this.roadCenters) {
      for (const [w, mat, y] of [[CITY.roadWidth, roadMat, 0.01], [CITY.roadWidth + 6, walkMat, 0.0]]) {
        const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(w, span * 2), mat);
        alongZ.rotation.x = -Math.PI / 2;
        alongZ.position.set(c, y, 0);
        scene.add(alongZ);
        const alongX = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, w), mat);
        alongX.rotation.x = -Math.PI / 2;
        alongX.position.set(0, y, c);
        scene.add(alongX);
      }
      // Yellow centre line down each road.
      const lineZ = new THREE.Mesh(new THREE.PlaneGeometry(0.4, span * 2), lineMat);
      lineZ.rotation.x = -Math.PI / 2;
      lineZ.position.set(c, 0.03, 0);
      scene.add(lineZ);
      const lineX = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, 0.4), lineMat);
      lineX.rotation.x = -Math.PI / 2;
      lineX.position.set(0, 0.03, c);
      scene.add(lineX);
    }
    roadTex.repeat.set(1, span / 8);

    // Buildings: one per block, varied heights and colours, lit windows.
    const winTex = makeWindowTexture();
    const blockCenters = [];
    for (let i = 0; i < CITY.blocks; i++) {
      blockCenters.push(-span + CITY.roadWidth + CITY.blockSize / 2 + i * CITY.pitch);
    }
    let bi = 0;
    for (const bx of blockCenters) {
      for (const bz of blockCenters) {
        const h = 8 + ((bi * 37) % 5) * 9 + ((bi * 13) % 3) * 4;
        const w = CITY.blockSize * (0.55 + ((bi * 7) % 4) * 0.1);
        const d = CITY.blockSize * (0.55 + ((bi * 11) % 4) * 0.1);
        const color = PALETTE.building[bi % PALETTE.building.length];
        const mat = new THREE.MeshLambertMaterial({ color, emissive: 0x111111 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(bx, h / 2, bz);
        scene.add(mesh);
        // Window skin: a slightly larger box with the window texture on top.
        const skin = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.15, h * 0.92, d + 0.15),
          new THREE.MeshBasicMaterial({ map: winTex, transparent: true, opacity: 0.55 }),
        );
        skin.position.set(bx, h / 2, bz);
        scene.add(skin);
        // Roof rim.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x2c2f36 }),
        );
        roof.position.set(bx, h + 0.25, bz);
        scene.add(roof);
        this.buildings.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2, height: h, mesh });
        bi++;
      }
    }

    // Paved plaza slabs under each block + corner bushes, so block interiors
    // read as city plaza instead of bare lawn.
    const plazaMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x3f7d33 });
    for (const bx of blockCenters) {
      for (const bz of blockCenters) {
        const plaza = new THREE.Mesh(new THREE.PlaneGeometry(CITY.blockSize, CITY.blockSize), plazaMat);
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(bx, 0.02, bz);
        scene.add(plaza);
        for (let b = 0; b < 3; b++) {
          const bush = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (b % 2) * 0.5, 8, 6), bushMat);
          bush.position.set(bx + (b - 1) * 12, 0.9, bz + ((b * 13) % 2 === 0 ? 13 : -13));
          scene.add(bush);
        }
      }
    }

    // Downtown towers near the centre for a skyline.
    const towerMat = new THREE.MeshLambertMaterial({ color: 0x4a6fa5, emissive: 0x0a1a2a });
    for (const [tx, tz, th] of [[-25, -25, 78], [25, 25, 92], [-25, 25, 64], [25, -25, 70]]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(18, th, 18), towerMat);
      tower.position.set(tx, th / 2, tz);
      scene.add(tower);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff5fa2 }));
      tip.position.set(tx, th + 3, tz);
      scene.add(tip);
    }

    this.addPalmsAndLamps();
    this.addBeach(scene, span);
    this.addMarina(scene, span);
    this.addBeacon();
  }

  addPalmsAndLamps() {
    const scene = this.scene;
    const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
    const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    let i = 0;
    for (const c of this.roadCenters) {
      for (let k = -CITY.halfSpan + 30; k < CITY.halfSpan - 20; k += 50) {
        const px = c + CITY.roadWidth / 2 + 3.5;
        const pz = k + ((i * 17) % 20);
        // Palm.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
        trunk.position.set(px, 3.5, pz);
        trunk.rotation.z = 0.08;
        scene.add(trunk);
        for (let l = 0; l < 5; l++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4), leafMat);
          leaf.position.set(px + Math.cos(l * 1.26) * 1.1, 7.2, pz + Math.sin(l * 1.26) * 1.1);
          leaf.rotation.z = Math.cos(l * 1.26) * 0.9;
          leaf.rotation.x = -Math.sin(l * 1.26) * 0.9;
          scene.add(leaf);
        }
        // Lamp on the opposite side.
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
        pole.position.set(c - CITY.roadWidth / 2 - 3.5, 3, pz + 25);
        scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
        bulb.position.set(c - CITY.roadWidth / 2 - 3.5, 6.2, pz + 25);
        scene.add(bulb);
        i++;
      }
    }
  }

  addBeach(scene, span) {
    // Sand strip + animated ocean south of the city (positive z).
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(span * 2 + 260, 70),
      new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, span + 35);
    scene.add(sand);
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(span * 2 + 260, 220),
      new THREE.MeshLambertMaterial({ color: PALETTE.ocean, transparent: true, opacity: 0.92 }),
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(0, 0.05, span + 180);
    scene.add(this.ocean);
    // Beach umbrellas.
    const umMat = new THREE.MeshLambertMaterial({ color: 0xff5fa2 });
    for (let k = 0; k < 6; k++) {
      const x = -160 + k * 60;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      pole.position.set(x, 1.5, span + 18);
      scene.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 8), umMat);
      top.position.set(x, 3.4, span + 18);
      scene.add(top);
    }
  }

  addMarina(scene, span) {
    // Pier jutting into the ocean + a few moored boats.
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 60),
      new THREE.MeshLambertMaterial({ color: 0x8a6b4f }),
    );
    pier.position.set(60, 0.5, span + 60);
    scene.add(pier);
    const boatMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xd9382b });
    for (let k = 0; k < 3; k++) {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 12), hullMat);
      hull.position.set(44 + k * 12, 0.4, span + 55 + k * 8);
      scene.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.5, 4), boatMat);
      cabin.position.set(44 + k * 12, 1.8, span + 55 + k * 8);
      scene.add(cabin);
    }
  }

  addBeacon() {
    // Golden floating marker column used for mission objectives.
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(0, 20, 0);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    this.beacon.add(ring);
    this.beacon.userData.ring = ring;
  }

  setBeacon(x, z, visible) {
    if (!this.beacon) return;
    this.beacon.position.x = x;
    this.beacon.position.z = z;
    this.beacon.visible = visible;
  }

  update(dt, time) {
    if (this.ocean) this.ocean.position.y = 0.05 + Math.sin(time * 0.7) * 0.12;
    if (this.beacon && this.beacon.visible) {
      this.beacon.rotation.y += dt * 0.8;
      const ring = this.beacon.userData.ring;
      if (ring) {
        const s = 1 + Math.sin(time * 3) * 0.15;
        ring.scale.set(s, s, 1);
      }
    }
  }

  // ---- collision / road helpers ----

  // Circle (x,z,r) vs building AABBs: push out, return corrected position.
  collideCircle(x, z, r) {
    for (const b of this.buildings) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest axis.
          const pushL = x - b.minX + r, pushR = b.maxX - x + r;
          const pushU = z - b.minZ + r, pushD = b.maxZ - z + r;
          const m = Math.min(pushL, pushR, pushU, pushD);
          if (m === pushL) x = b.minX - r;
          else if (m === pushR) x = b.maxX + r;
          else if (m === pushU) z = b.minZ - r;
          else z = b.maxZ + r;
        }
      }
    }
    const lim = CITY.halfSpan + 30;
    x = Math.max(-lim, Math.min(lim, x));
    z = Math.max(-lim - 10, Math.min(lim + 95, z));
    return { x, z };
  }

  isOnRoad(x, z) {
    const tol = CITY.roadWidth / 2 + 1;
    for (const c of this.roadCenters) {
      if (Math.abs(x - c) < tol || Math.abs(z - c) < tol) return true;
    }
    return false;
  }

  nearestRoadCenter(v) {
    let best = this.roadCenters[0], bd = Infinity;
    for (const c of this.roadCenters) {
      const d = Math.abs(v - c);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Random intersection node for spawning traffic / police.
  randomNode() {
    const c = this.roadCenters[Math.floor(Math.random() * this.roadCenters.length)];
    const d = this.roadCenters[Math.floor(Math.random() * this.roadCenters.length)];
    return { x: c, z: d };
  }
}

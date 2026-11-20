// Neon Bay — one home for every number the game runs on: the city grid,
// the palette, the player and car feel, the wanted rules, the story and the
// mission scripts, and the named places on the map.

export const CITY = {
  blocks: 8, // blocks along each side
  blockSize: 36, // a building block's side, in metres
  roadWidth: 14, // road width, in metres
  get pitch() { return this.blockSize + this.roadWidth; },
  get halfSpan() { return (this.blocks * this.pitch + this.roadWidth) / 2; },
};

// Street centre lines: streets sit at x = -halfSpan + roadWidth/2 + i*pitch.
export function roadCenters() {
  const lines = [];
  const first = -CITY.halfSpan + CITY.roadWidth / 2;
  for (let i = 0; i <= CITY.blocks; i++) lines.push(first + i * CITY.pitch);
  return lines;
}

export const PALETTE = {
  sky: 0x87c5e8,
  sun: 0xffe3b3,
  road: 0x33363d,
  roadLine: 0xf5d76e,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  ocean: 0x1e7fa8,
  grass: 0x5da24a,
  building: [0xd96a5f, 0x5f8fd9, 0xe0a458, 0x7fb069, 0xb565a7, 0x4a6fa5, 0xd9c25f, 0x8a7fd9],
  glass: 0x2c3e50,
  palmTrunk: 0x8a6b4f,
  palmLeaf: 0x2f9e44,
  carColors: [0xd9382b, 0x2b6fd9, 0xf2c230, 0x37b24d, 0xe8590c, 0x7048e8, 0x12b886, 0x868e96, 0x1c1c1e],
  policeCar: 0x1a1a2e,
  policeLight: [0xff2222, 0x2266ff],
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  jumpSpeed: 8,
  gravity: 22,
  radius: 0.6,
  maxHealth: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 34,
  maxReverse: 10,
  turnRate: 2.1,
  drag: 0.6,
  radius: 1.6,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 14, // clean seconds before one star fades
  policeCarCap: [0, 1, 2, 3, 4, 5],
  copCap: [0, 1, 2, 3, 4, 6],
};

// Story and missions. Every name here is original.
export const STORY = {
  hero: 'Rio Vale',
  fixer: 'Marisol "Sol" Reyes',
  city: 'Neon Bay',
  intro:
    'Neon Bay runs on wheels and whispers. You are Rio Vale, a driver-for-hire with a fast car and faster debts. Sol Reyes has work for you — three jobs, one way out.',
};

export const MISSIONS = [
  {
    id: 'fare',
    title: 'First Fare',
    giver: 'Sol Reyes',
    brief: 'A client is waiting at the Marina Steps. Pick them up and get them to the Azure Hotel before the clock runs out. Drive like you mean it — but the cops are watching.',
    pay: 350,
    timeLimit: 150,
    steps: [
      { type: 'goto', label: 'Pick up the client at the Marina Steps', target: 'pickup' },
      { type: 'deliver', label: 'Deliver the client to the Azure Hotel', target: 'hotel', needsPassenger: true },
    ],
  },
  {
    id: 'getaway',
    title: 'Bay Getaway',
    giver: 'Sol Reyes',
    brief: 'A coupe is parked outside the Coral Casino, engine warm. Take it, shake the 2-star heat, and bring it to the garage on Palm Row. No scratches — well, fewer scratches.',
    pay: 900,
    timeLimit: 240,
    steps: [
      { type: 'steal', label: 'Steal the marked coupe at the Coral Casino', target: 'coupe' },
      { type: 'escape', label: 'Lose the police (drop to 0 stars)', target: 'escape' },
      { type: 'deliver', label: 'Deliver the coupe to the Palm Row garage', target: 'garage', needsCar: true },
    ],
  },
  {
    id: 'chase',
    title: 'Harbor Chase',
    giver: 'Sol Reyes',
    brief: 'A courier is running Sol\'s package to the docks. Run their car down, stop it, grab the package and bring it home to the hideout. They will not stop for you.',
    pay: 1600,
    timeLimit: 300,
    steps: [
      { type: 'chase', label: 'Chase down the courier car', target: 'courier' },
      { type: 'collect', label: 'Grab the package from the stopped car', target: 'package' },
      { type: 'deliver', label: 'Bring the package back to the hideout', target: 'hideout' },
    ],
  },
];

// Named spots on the map (x, z). The city runs roughly -205 to 205.
export const PLACES = {
  hideout: { x: -170, z: 160, label: 'Hideout — Sol\'s Garage' },
  pickup: { x: 60, z: 190, label: 'Marina Steps' },
  hotel: { x: 170, z: -170, label: 'Azure Hotel' },
  coupe: { x: -60, z: -170, label: 'Coral Casino' },
  garage: { x: -170, z: -60, label: 'Palm Row Garage' },
  courier: { x: 120, z: 120, label: 'Courier route' },
  package: { x: 0, z: 0, label: 'Package' },
};

export const SHOOTING = {
  magSize: 12, reserveAmmo: 96, damage: 34, range: 80, cooldown: 0.18,
};

export const SAVE_KEY = 'neonbay-save-v1';

// Every tuning number and colour for Starlight Salvage in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves make a full run; clearing wave 10 wins the game. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 16,
  accel: 2600,
  maxSpeed: 430,
  drag: 2.6,
  fireInterval: 0.15,
  bulletSpeed: 760,
  bulletDamage: 1,
  invulnerable: 1.6,
  pickupRadius: 30,
  magnetRadius: 150,
};

export const BULLET = { radius: 4, life: 0.9 };

export const ASTEROID = {
  smallRadius: 18,
  largeRadius: 40,
  smallHp: 1,
  largeHp: 3,
  minSpeed: 42,
  maxSpeed: 130,
  smallPoints: 20,
  largePoints: 40,
};

export const DRONE = {
  radius: 15,
  hp: 2,
  speed: 95,
  shootInterval: 2.4,
  orbSpeed: 210,
  orbRadius: 6,
  points: 50,
  shieldDropChance: 0.18,
};

export const SALVAGE = {
  radius: 13,
  points: 25,
  drift: 26,
};

/** Chain steps per combo level; the multiplier caps at x5. */
export const COMBO = { stepsPerLevel: 3, maxLevel: 5, windowSeconds: 3.5 };

export const WAVES = {
  /** Asteroids in wave n, drones in wave n, salvage pods in wave n. */
  asteroids: (n) => 4 + 2 * n,
  drones: (n) => Math.min(1 + n, 8),
  salvage: (n) => 6 + 2 * n,
  /** Seconds between spawns; the trickle quickens as waves rise. */
  spawnGap: (n) => Math.max(0.55, 1.15 - n * 0.07),
  clearBonus: (n) => 100 * n,
  victoryBonus: 1000,
};

export const UPGRADES = [
  { id: 'rapid', name: 'RAPID CYCLER', desc: 'Fire rate +25%', max: 3 },
  { id: 'twin', name: 'TWIN BLASTER', desc: '+1 projectile per shot', max: 2 },
  { id: 'hull', name: 'REINFORCED HULL', desc: '+1 max hull, repair 1', max: 2 },
  { id: 'magnet', name: 'MAGNET COIL', desc: 'Pickup range +90', max: 3 },
  { id: 'swift', name: 'SWIFT THRUSTERS', desc: 'Ship speed +15%', max: 3 },
  { id: 'heavy', name: 'HEAVY ROUNDS', desc: 'Bullet damage +1', max: 2 },
  { id: 'aegis', name: 'AEGIS SHIELD', desc: 'Gain a shield charge', max: 3 },
];

export const PALETTE = {
  spaceTop: '#070b1d',
  spaceBottom: '#120a2a',
  nebulaA: 'rgba(88, 60, 180, 0.20)',
  nebulaB: 'rgba(16, 120, 140, 0.16)',
  nebulaC: 'rgba(180, 60, 120, 0.12)',
  star: '#dfe8ff',
  player: '#37e0ff',
  playerCore: '#eafcff',
  bullet: '#8ff4ff',
  salvage: '#ffc44d',
  salvageCore: '#fff3c4',
  asteroid: '#8a7f74',
  asteroidRim: '#cbb9a6',
  drone: '#ff5d8f',
  droneCore: '#ffd7e6',
  orb: '#ff7ad9',
  particle: '#ffd166',
  text: '#eef4ff',
  muted: '#9aa7c7',
  danger: '#ff5470',
  panel: 'rgba(10, 16, 38, 0.88)',
  panelEdge: '#2c3d66',
  good: '#5df2a6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'starlight-salvage.best';

// One factory per kind of thing in the field, and the small update each one needs.
// Entities are plain objects; the world owns the lists and the rules between them.
import { ASTEROID, BULLET, DRONE, FIELD, PLAYER, SALVAGE } from './config.js';
import { range } from './random.js';

/** The ship the player flies. */
export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: 3,
    maxHull: 3,
    shields: 0,
    invulnerable: 0,
    fireTimer: 0,
    thrust: 0,
  };
}

/** A bullet from the ship, or from a drone when `hostile` is set. */
export function createBullet(x, y, angle, speed, damage, hostile) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: BULLET.radius,
    life: BULLET.life,
    damage,
    hostile: !!hostile,
  };
}

/** A drifting rock; large ones split into two small ones when destroyed. */
export function createAsteroid(random, large, x, y) {
  const radius = large ? range(random, ASTEROID.largeRadius - 6, ASTEROID.largeRadius + 6)
    : range(random, ASTEROID.smallRadius - 3, ASTEROID.smallRadius + 3);
  const speed = range(random, ASTEROID.minSpeed, ASTEROID.maxSpeed);
  const drift = random() * Math.PI * 2;
  return {
    x: x ?? range(random, 0, FIELD.width),
    y: y ?? range(random, 0, FIELD.height),
    vx: Math.cos(drift) * speed,
    vy: Math.sin(drift) * speed,
    radius,
    hp: large ? ASTEROID.largeHp : ASTEROID.smallHp,
    large,
    spin: range(random, -1.4, 1.4),
    angle: random() * Math.PI * 2,
    points: large ? ASTEROID.largePoints : ASTEROID.smallPoints,
    // A jagged outline, fixed at birth so the rock keeps its shape.
    bumps: Array.from({ length: 9 }, () => range(random, 0.78, 1.18)),
  };
}

/** A hostile drone that closes in and shoots slow orbs at the ship. */
export function createDrone(random, x, y) {
  return {
    x: x ?? range(random, 0, FIELD.width),
    y: y ?? range(random, 0, FIELD.height),
    vx: 0,
    vy: 0,
    radius: DRONE.radius,
    hp: DRONE.hp,
    shootTimer: range(random, 1.2, DRONE.shootInterval),
    wobble: random() * Math.PI * 2,
  };
}

/** A glowing salvage pod, worth points and combo when collected. */
export function createSalvage(random, x, y) {
  return {
    x: x ?? range(random, 60, FIELD.width - 60),
    y: y ?? range(random, 60, FIELD.height - 60),
    vx: range(random, -SALVAGE.drift, SALVAGE.drift),
    vy: range(random, -SALVAGE.drift, SALVAGE.drift),
    radius: SALVAGE.radius,
    pulse: random() * Math.PI * 2,
  };
}

/** A short-lived spark, shard or smoke puff. */
export function createParticle(x, y, vx, vy, life, size, color) {
  return { x, y, vx, vy, life, maxLife: life, size, color };
}

/** Floating score text that rises and fades. */
export function createFloater(x, y, text, color) {
  return { x, y, text, color, life: 1.1, maxLife: 1.1 };
}

/** Move a thing and wrap it around the field edges, with a margin. */
export function wrapAround(entity, margin) {
  const m = margin ?? entity.radius;
  if (entity.x < -m) entity.x += FIELD.width + m * 2;
  else if (entity.x > FIELD.width + m) entity.x -= FIELD.width + m * 2;
  if (entity.y < -m) entity.y += FIELD.height + m * 2;
  else if (entity.y > FIELD.height + m) entity.y -= FIELD.height + m * 2;
}

/** True when two round things overlap. */
export function overlaps(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const reach = a.radius + b.radius;
  return dx * dx + dy * dy < reach * reach;
}

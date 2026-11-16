// The whole game state and its rules: waves, spawning, movement, collisions, combo,
// scoring and upgrades. The renderer only paints this state; the input only steers it.
import {
  ASTEROID,
  BULLET,
  COMBO,
  DRONE,
  FIELD,
  FINAL_WAVE,
  PLAYER,
  SALVAGE,
  UPGRADES,
  WAVES,
} from './config.js';
import { range } from './random.js';
import {
  createAsteroid,
  createBullet,
  createDrone,
  createFloater,
  createParticle,
  createPlayer,
  createSalvage,
  overlaps,
  wrapAround,
} from './entities.js';

export const EVENT_SHOOT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_KILL = 4;
export const EVENT_HIT = 8;
export const EVENT_OVER = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_VICTORY = 64;
export const EVENT_SHIELD = 128;
export const EVENT_UPGRADE = 256;
export const EVENT_BULLET_HIT = 512;

const FALLBACK_REPAIR = { id: 'repair', name: 'PATCH HULL', desc: 'Repair 1 hull' };
const FALLBACK_CACHE = { id: 'cache', name: 'SALVAGE CACHE', desc: '+500 score' };

export function createWorld(random) {
  const state = {
    phase: 'title',
    time: 0,
    score: 0,
    wave: 0,
    player: createPlayer(),
    bullets: [],
    orbs: [],
    asteroids: [],
    drones: [],
    salvage: [],
    particles: [],
    floaters: [],
    comboChain: 0,
    comboLevel: 1,
    comboTimer: 0,
    maxCombo: 1,
    salvageCollected: 0,
    kills: 0,
    shake: 0,
    flash: 0,
    spawnQueue: { asteroids: 0, drones: 0, salvage: 0 },
    spawnTimer: 0,
    choices: [],
    upgrades: {},
    fireRateMul: 1,
    projectiles: 1,
    bulletDamage: 1,
    magnetBonus: 0,
    speedMul: 1,
  };

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const v = range(random, speed * 0.3, speed);
      state.particles.push(
        createParticle(x, y, Math.cos(angle) * v, Math.sin(angle) * v, range(random, 0.3, 0.8), range(random, 2, 5), color),
      );
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push(createFloater(x, y, text, color));
  }

  function addScore(base, x, y) {
    const points = Math.round(base * state.comboLevel);
    state.score += points;
    if (x !== undefined) floater(x, y, `+${points}`, '#ffd166');
    return points;
  }

  function chainUp() {
    state.comboChain += 1;
    state.comboTimer = COMBO.windowSeconds;
    state.comboLevel = Math.min(1 + Math.floor(state.comboChain / COMBO.stepsPerLevel), COMBO.maxLevel);
    state.maxCombo = Math.max(state.maxCombo, state.comboLevel);
  }

  function spawnEdgeAsteroid(large) {
    const edge = Math.floor(random() * 4);
    let x;
    let y;
    if (edge === 0) { x = range(random, 0, FIELD.width); y = -50; }
    else if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + 50; }
    else if (edge === 2) { x = -50; y = range(random, 0, FIELD.height); }
    else { x = FIELD.width + 50; y = range(random, 0, FIELD.height); }
    const rock = createAsteroid(random, large, x, y);
    // Steer it roughly across the field instead of straight off an edge.
    const aim = Math.atan2(FIELD.height / 2 - y, FIELD.width / 2 - x) + range(random, -0.6, 0.6);
    const speed = Math.hypot(rock.vx, rock.vy);
    rock.vx = Math.cos(aim) * speed;
    rock.vy = Math.sin(aim) * speed;
    state.asteroids.push(rock);
  }

  function spawnEdgeDrone() {
    const edge = Math.floor(random() * 4);
    let x;
    let y;
    if (edge === 0) { x = range(random, 0, FIELD.width); y = -40; }
    else if (edge === 1) { x = range(random, 0, FIELD.width); y = FIELD.height + 40; }
    else if (edge === 2) { x = -40; y = range(random, 0, FIELD.height); }
    else { x = FIELD.width + 40; y = range(random, 0, FIELD.height); }
    state.drones.push(createDrone(random, x, y));
  }

  function drawChoices() {
    const available = UPGRADES.filter((u) => (state.upgrades[u.id] ?? 0) < u.max);
    const pool = available.slice();
    const picked = [];
    while (picked.length < 3 && pool.length > 0) {
      picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    while (picked.length < 3) {
      const fallback = picked.some((c) => c.id === 'repair') ? FALLBACK_CACHE : FALLBACK_REPAIR;
      picked.push(fallback);
    }
    state.choices = picked;
  }

  function startWave(n) {
    state.wave = n;
    state.phase = 'play';
    state.spawnQueue = { asteroids: WAVES.asteroids(n), drones: WAVES.drones(n), salvage: WAVES.salvage(n) };
    state.spawnTimer = 0.5;
  }

  function destroyAsteroid(index, byPlayer) {
    const rock = state.asteroids[index];
    state.asteroids.splice(index, 1);
    burst(rock.x, rock.y, '#cbb9a6', rock.large ? 16 : 8, 220);
    if (byPlayer) {
      state.kills += 1;
      chainUp();
      addScore(rock.points, rock.x, rock.y);
      if (rock.large) {
        for (let i = 0; i < 2; i += 1) {
          const shard = createAsteroid(random, false, rock.x, rock.y);
          shard.vx = range(random, -160, 160);
          shard.vy = range(random, -160, 160);
          state.asteroids.push(shard);
        }
        if (random() < 0.35) state.salvage.push(createSalvage(random, rock.x, rock.y));
      }
    }
  }

  function destroyDrone(index, byPlayer) {
    const drone = state.drones[index];
    state.drones.splice(index, 1);
    burst(drone.x, drone.y, '#ff5d8f', 18, 260);
    if (byPlayer) {
      state.kills += 1;
      chainUp();
      addScore(DRONE.points, drone.x, drone.y);
      if (random() < DRONE.shieldDropChance) {
        state.player.shields = Math.min(3, state.player.shields + 1);
        floater(drone.x, drone.y - 24, 'SHIELD +1', '#5df2a6');
      }
    }
  }

  function hurtPlayer(source) {
    const player = state.player;
    if (player.invulnerable > 0) return 0;
    if (player.shields > 0) {
      player.shields -= 1;
      player.invulnerable = 1.0;
      state.shake = Math.max(state.shake, 8);
      burst(player.x, player.y, '#5df2a6', 14, 240);
      return EVENT_SHIELD;
    }
    player.hull -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 14;
    state.flash = 0.5;
    state.comboChain = 0;
    state.comboLevel = 1;
    burst(player.x, player.y, '#ff5470', 20, 300);
    if (source) {
      // The thing that hit the ship is spent too.
      if (source.kind === 'asteroid') {
        const index = state.asteroids.indexOf(source);
        if (index !== -1) destroyAsteroid(index, false);
      } else if (source.kind === 'drone') {
        const index = state.drones.indexOf(source);
        if (index !== -1) destroyDrone(index, false);
      }
    }
    if (player.hull <= 0) {
      state.phase = 'over';
      burst(player.x, player.y, '#37e0ff', 40, 380);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function updatePlayer(dt, move, aimAngle, firing) {
    const player = state.player;
    const maxSpeed = PLAYER.maxSpeed * state.speedMul;
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const drag = Math.exp(-PLAYER.drag * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    wrapAround(player, 0);
    player.angle = aimAngle;
    player.thrust = Math.hypot(move.x, move.y);
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (speed > 60 && random() < 0.6) {
      const back = Math.atan2(player.vy, player.vx) + Math.PI;
      state.particles.push(createParticle(
        player.x + Math.cos(back) * 18,
        player.y + Math.sin(back) * 18,
        Math.cos(back) * 60 + range(random, -20, 20),
        Math.sin(back) * 60 + range(random, -20, 20),
        0.35, 3, '#37e0ff',
      ));
    }
    player.fireTimer -= dt;
    if (firing && player.fireTimer <= 0) {
      player.fireTimer = PLAYER.fireInterval * state.fireRateMul;
      const spread = 0.09;
      for (let i = 0; i < state.projectiles; i += 1) {
        const offset = (i - (state.projectiles - 1) / 2) * spread;
        const nose = player.radius + 6;
        state.bullets.push(createBullet(
          player.x + Math.cos(aimAngle + offset) * nose,
          player.y + Math.sin(aimAngle + offset) * nose,
          aimAngle + offset,
          PLAYER.bulletSpeed,
          state.bulletDamage,
          false,
        ));
      }
      return EVENT_SHOOT;
    }
    return 0;
  }

  function updateBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      let spent = false;
      for (let j = state.asteroids.length - 1; j >= 0; j -= 1) {
        const rock = state.asteroids[j];
        if (overlaps(bullet, rock)) {
          rock.hp -= bullet.damage;
          burst(bullet.x, bullet.y, '#ffd166', 4, 140);
          events |= EVENT_BULLET_HIT;
          if (rock.hp <= 0) {
            destroyAsteroid(j, true);
            events |= EVENT_KILL;
          }
          spent = true;
          break;
        }
      }
      if (!spent) {
        for (let j = state.drones.length - 1; j >= 0; j -= 1) {
          const drone = state.drones[j];
          if (overlaps(bullet, drone)) {
            drone.hp -= bullet.damage;
            burst(bullet.x, bullet.y, '#ff5d8f', 5, 160);
            events |= EVENT_BULLET_HIT;
            if (drone.hp <= 0) {
              destroyDrone(j, true);
              events |= EVENT_KILL;
            }
            spent = true;
            break;
          }
        }
      }
      if (spent) state.bullets.splice(i, 1);
    }
    return events;
  }

  function updateHazards(dt) {
    let events = 0;
    const player = state.player;
    for (const rock of state.asteroids) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.angle += rock.spin * dt;
      wrapAround(rock, 0);
      if (player.invulnerable <= 0 && overlaps(player, rock)) {
        rock.kind = 'asteroid';
        events |= hurtPlayer(rock);
      }
    }
    for (const drone of state.drones) {
      drone.wobble += dt * 2;
      const dx = player.x - drone.x;
      const dy = player.y - drone.y;
      const dist = Math.hypot(dx, dy) || 1;
      const approach = dist > 260 ? 1 : 0.25;
      drone.vx += (dx / dist) * DRONE.speed * approach * dt * 3;
      drone.vy += (dy / dist) * DRONE.speed * approach * dt * 3;
      drone.vx += Math.cos(drone.wobble) * 30 * dt;
      drone.vy += Math.sin(drone.wobble) * 30 * dt;
      const speed = Math.hypot(drone.vx, drone.vy);
      const cap = DRONE.speed * 1.4;
      if (speed > cap) {
        drone.vx = (drone.vx / speed) * cap;
        drone.vy = (drone.vy / speed) * cap;
      }
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;
      wrapAround(drone, 0);
      drone.shootTimer -= dt;
      if (drone.shootTimer <= 0 && dist < 560) {
        drone.shootTimer = DRONE.shootInterval;
        const angle = Math.atan2(dy, dx);
        state.orbs.push(createBullet(drone.x, drone.y, angle, DRONE.orbSpeed, 1, true));
      }
      if (player.invulnerable <= 0 && overlaps(player, drone)) {
        drone.kind = 'drone';
        events |= hurtPlayer(drone);
      }
    }
    for (let i = state.orbs.length - 1; i >= 0; i -= 1) {
      const orb = state.orbs[i];
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      orb.life -= dt;
      if (orb.life <= 0 || orb.x < -30 || orb.x > FIELD.width + 30 || orb.y < -30 || orb.y > FIELD.height + 30) {
        state.orbs.splice(i, 1);
        continue;
      }
      if (player.invulnerable <= 0 && overlaps(player, orb)) {
        state.orbs.splice(i, 1);
        events |= hurtPlayer(null);
      }
    }
    return events;
  }

  function updateSalvage(dt) {
    let events = 0;
    const player = state.player;
    const magnet = PLAYER.magnetRadius + state.magnetBonus;
    for (let i = state.salvage.length - 1; i >= 0; i -= 1) {
      const pod = state.salvage[i];
      const dx = player.x - pod.x;
      const dy = player.y - pod.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < magnet) {
        const pull = (1 - dist / magnet) * 620;
        pod.vx += (dx / dist) * pull * dt;
        pod.vy += (dy / dist) * pull * dt;
      }
      pod.vx *= Math.exp(-1.2 * dt);
      pod.vy *= Math.exp(-1.2 * dt);
      pod.x += pod.vx * dt;
      pod.y += pod.vy * dt;
      pod.pulse += dt * 4;
      wrapAround(pod, 0);
      if (dist < PLAYER.pickupRadius + pod.radius) {
        state.salvage.splice(i, 1);
        state.salvageCollected += 1;
        chainUp();
        addScore(SALVAGE.points, pod.x, pod.y);
        burst(pod.x, pod.y, '#ffc44d', 10, 180);
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function updateSpawning(dt) {
    const q = state.spawnQueue;
    if (q.asteroids + q.drones + q.salvage <= 0) return 0;
    state.spawnTimer -= dt;
    if (state.spawnTimer > 0) return 0;
    state.spawnTimer = WAVES.spawnGap(state.wave);
    // Round-robin across the three kinds, so salvage and drones show up early
    // instead of all the rocks arriving before anything else does.
    state.spawnCycle = (state.spawnCycle ?? 0) + 1;
    const order = state.spawnCycle % 3;
    if (order === 0 && q.salvage > 0) {
      q.salvage -= 1;
      state.salvage.push(createSalvage(random));
    } else if (order === 1 && q.asteroids > 0) {
      q.asteroids -= 1;
      spawnEdgeAsteroid(random() < 0.3);
    } else if (order === 2 && q.drones > 0) {
      q.drones -= 1;
      spawnEdgeDrone();
    } else if (q.asteroids > 0) {
      q.asteroids -= 1;
      spawnEdgeAsteroid(random() < 0.3);
    } else if (q.drones > 0) {
      q.drones -= 1;
      spawnEdgeDrone();
    } else if (q.salvage > 0) {
      q.salvage -= 1;
      state.salvage.push(createSalvage(random));
    }
    return 0;
  }

  function checkWaveEnd() {
    const q = state.spawnQueue;
    if (q.asteroids + q.drones + q.salvage > 0) return 0;
    if (state.asteroids.length > 0 || state.drones.length > 0) return 0;
    state.orbs.length = 0;
    state.floaters.length = 0;
    state.score += WAVES.clearBonus(state.wave);
    if (state.wave >= FINAL_WAVE) {
      state.score += WAVES.victoryBonus;
      state.phase = 'victory';
      return EVENT_WAVE_CLEAR | EVENT_VICTORY;
    }
    state.phase = 'upgrade';
    drawChoices();
    return EVENT_WAVE_CLEAR | EVENT_UPGRADE;
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2 * dt);
      p.vy *= Math.exp(-2 * dt);
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.y -= 34 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 34);
    state.flash = Math.max(0, state.flash - dt * 1.8);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboChain = 0;
        state.comboLevel = 1;
      }
    }
  }

  function ambient(dt) {
    // The title screen's living backdrop: a few rocks and pods drift, nothing shoots.
    if (state.asteroids.length < 5 && random() < 0.02) {
      state.asteroids.push(createAsteroid(random, random() < 0.4));
    }
    if (state.salvage.length < 4 && random() < 0.01) {
      state.salvage.push(createSalvage(random));
    }
    for (const rock of state.asteroids) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.angle += rock.spin * dt;
      wrapAround(rock, 0);
    }
    for (const pod of state.salvage) {
      pod.x += pod.vx * dt;
      pod.y += pod.vy * dt;
      pod.pulse += dt * 4;
      wrapAround(pod, 0);
    }
    updateParticles(dt);
  }

  return {
    state,
    /** Begin a fresh run from the title screen. */
    reset() {
      state.phase = 'title';
      state.time = 0;
      state.score = 0;
      state.wave = 0;
      state.player = createPlayer();
      state.bullets = [];
      state.orbs = [];
      state.asteroids = [];
      state.drones = [];
      state.salvage = [];
      state.particles = [];
      state.floaters = [];
      state.comboChain = 0;
      state.comboLevel = 1;
      state.comboTimer = 0;
      state.maxCombo = 1;
      state.salvageCollected = 0;
      state.kills = 0;
      state.shake = 0;
      state.flash = 0;
      state.spawnQueue = { asteroids: 0, drones: 0, salvage: 0 };
      state.spawnTimer = 0;
      state.choices = [];
      state.upgrades = {};
      state.fireRateMul = 1;
      state.projectiles = 1;
      state.bulletDamage = 1;
      state.magnetBonus = 0;
      state.speedMul = 1;
    },
    /** Start wave 1 from a fresh run. */
    startRun() {
      this.reset();
      startWave(1);
    },
    /** Take one of the offered upgrade choices, then start the next wave. */
    applyUpgrade(choiceIndex) {
      const choice = state.choices[choiceIndex];
      if (!choice) return false;
      const owned = state.upgrades[choice.id] ?? 0;
      state.upgrades[choice.id] = owned + 1;
      const player = state.player;
      if (choice.id === 'rapid') state.fireRateMul *= 0.8;
      else if (choice.id === 'twin') state.projectiles += 1;
      else if (choice.id === 'hull') {
        player.maxHull += 1;
        player.hull = Math.min(player.maxHull, player.hull + 1);
      } else if (choice.id === 'magnet') state.magnetBonus += 90;
      else if (choice.id === 'swift') state.speedMul *= 1.15;
      else if (choice.id === 'heavy') state.bulletDamage += 1;
      else if (choice.id === 'aegis') player.shields = Math.min(3, player.shields + 1);
      else if (choice.id === 'repair') player.hull = Math.min(player.maxHull, player.hull + 1);
      else if (choice.id === 'cache') state.score += 500;
      state.choices = [];
      startWave(state.wave + 1);
      return true;
    },
    /**
     * Advance the world one fixed step. `move` is a unit vector, `aimAngle` the firing
     * direction in radians, `firing` whether the trigger is held, `demo` whether this is
     * the title screen's ambient drift (no player, no waves). Returns an event bitmask.
     */
    step(dt, move, aimAngle, firing, demo) {
      state.time += dt;
      if (demo || state.phase === 'title') {
        ambient(dt);
        return 0;
      }
      if (state.phase !== 'play') {
        updateParticles(dt);
        return 0;
      }
      let events = 0;
      events |= updatePlayer(dt, move, aimAngle, firing);
      events |= updateBullets(dt);
      events |= updateHazards(dt);
      events |= updateSalvage(dt);
      events |= updateSpawning(dt);
      updateParticles(dt);
      if (state.phase === 'play') events |= checkWaveEnd();
      return events;
    },
  };
}

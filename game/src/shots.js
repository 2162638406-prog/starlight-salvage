// The screenshot scenes behind ?shot=start|play|upgrade|over. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 75;
const LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** The nearest thing of a kind, or null when the list is empty. */
function nearest(list, x, y) {
  let found = null;
  let best = Infinity;
  for (const item of list) {
    const dist = Math.hypot(item.x - x, item.y - y);
    if (dist < best) {
      best = dist;
      found = item;
    }
  }
  return found;
}

/**
 * Steer the ship: flee the closest rock when it is near, else chase the lowest
 * salvage pod; when `reckless` is set, chase salvage too but never fire and never
 * dodge, so the ship scores a little before the rocks catch it.
 */
function autopilot(state, reckless) {
  const player = state.player;
  const rock = nearest(state.asteroids, player.x, player.y);
  const pod = nearest(state.salvage, player.x, player.y);
  if (reckless) {
    if (pod) {
      const dx = pod.x - player.x;
      const dy = pod.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      return { move: { x: dx / dist, y: dy / dist }, aim: Math.atan2(dy, dx), firing: false };
    }
    if (rock) {
      const dx = rock.x - player.x;
      const dy = rock.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      return { move: { x: dx / dist, y: dy / dist }, aim: Math.atan2(dy, dx), firing: false };
    }
    return { move: { x: 0, y: 0 }, aim: -Math.PI / 2, firing: false };
  }
  let move = { x: 0, y: 0 };
  if (rock) {
    const dx = player.x - rock.x;
    const dy = player.y - rock.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 150) {
      move = { x: dx / dist, y: dy / dist };
    }
  }
  if (move.x === 0 && move.y === 0) {
    if (pod) {
      const dx = pod.x - player.x;
      const dy = pod.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 24) move = { x: dx / dist, y: dy / dist };
    } else if (rock) {
      // No salvage in sight: close in on a rock to shoot it, but hold off at range.
      const dx = rock.x - player.x;
      const dy = rock.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > 330) move = { x: dx / dist, y: dy / dist };
    }
  }
  const drone = nearest(state.drones, player.x, player.y);
  const target = drone ?? rock;
  const aim = target ? Math.atan2(target.y - player.y, target.x - player.x) : -Math.PI / 2;
  return { move, aim, firing: target !== null };
}

/** Run the world forward with the autopilot until `stop` says so, or the time cap. */
function simulate(world, seconds, reckless, stop) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    const pilot = autopilot(state, reckless);
    const events = world.step(SAMPLE, pilot.move, pilot.aim, pilot.firing, false);
    if (stop && stop(state, events)) break;
  }
}

/**
 * Play forward and keep the busiest, best-framed moment: after each step, score the
 * frame by what is on the field, how much of the action is near the ship, and
 * whether the ship sits away from the edges, and remember a deep copy of the state
 * at the peak, so the play screenshot shows the game at its liveliest instead of
 * after the autopilot cleared the field. When a wave clears, the autopilot takes
 * the first upgrade and keeps playing, so the peak can come from a later, busier
 * wave.
 */
function simulateBusiest(world, seconds) {
  let peak = -1;
  let snapshot = null;
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    if (state.phase === 'upgrade') {
      world.applyUpgrade(0);
      continue;
    }
    if (state.phase !== 'play') break;
    const pilot = autopilot(state, false);
    world.step(SAMPLE, pilot.move, pilot.aim, pilot.firing, false);
    if (state.phase !== 'play') continue;
    const near = [...state.asteroids, ...state.drones, ...state.salvage].filter(
      (item) => Math.hypot(item.x - state.player.x, item.y - state.player.y) < 380,
    ).length;
    const edge = Math.min(state.player.x, FIELD.width - state.player.x, state.player.y, FIELD.height - state.player.y);
    const frameScore = (state.asteroids.length + state.drones.length + state.salvage.length + state.bullets.length) * 10
      + near * 6 - (edge < 90 ? 25 : 0);
    if (frameScore > peak) {
      peak = frameScore;
      snapshot = structuredClone(state);
    }
  }
  if (snapshot) {
    for (const key of Object.keys(world.state)) delete world.state[key];
    Object.assign(world.state, snapshot);
  }
}

/**
 * Set `world` to the named scene (start, play, upgrade or over; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'upgrade' && name !== 'over') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, 0, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  world.startRun();
  if (name === 'play') {
    simulateBusiest(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'upgrade') {
    simulate(world, LIMIT_SECONDS, false, (state) => state.phase === 'upgrade' || state.phase === 'over');
    if (world.state.phase === 'over') return { screen: SCREEN_OVER, best: world.state.score };
    return { screen: SCREEN_UPGRADE, best: world.state.score };
  }
  // over: play well into the mid-game, auto-picking upgrades, then fly at the
  // rocks until the ship is lost, so the results screen shows a real run
  // instead of a wave-1 death.
  for (let played = 0; played < 120 && world.state.phase === 'play' && world.state.wave < 4; played += 10) {
    simulate(world, 10, false, (state) => state.phase === 'upgrade' || state.phase === 'over');
    if (world.state.phase === 'upgrade') world.applyUpgrade(0);
  }
  if (world.state.phase !== 'over') {
    simulate(world, LIMIT_SECONDS, true, (state, events) => (events & EVENT_OVER) !== 0);
  }
  if (world.state.phase === 'over') return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}

// Re-exported so main.js can name the victory screen without importing render twice.
export { SCREEN_VICTORY };

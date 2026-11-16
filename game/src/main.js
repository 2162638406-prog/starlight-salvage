// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, play, upgrade, paused, game over
// and victory.
//
// ?seed=N fixes the random pattern. ?shot=start|play|upgrade|over (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHIELD, EVENT_SHOOT, EVENT_UPGRADE, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_UPGRADE_1,
  ACTION_UPGRADE_2,
  ACTION_UPGRADE_3,
  createInput,
} from './input.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_VICTORY,
  createRenderer,
  upgradeCardAt,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.startRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. Wave 1 of 10.`);
  }

  function endGame(victory) {
    screen = victory ? SCREEN_VICTORY : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (victory) audio.victory();
    else audio.gameOver();
    announce(victory ? `Sector cleared. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_PICKUP) audio.pickup(world.state.comboLevel);
    if (events & EVENT_KILL) audio.explosion();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_SHIELD) audio.shield();
    if (events & EVENT_WAVE_CLEAR) audio.waveClear();
    if (events & EVENT_VICTORY) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_UPGRADE) {
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      let pick = -1;
      if (actions & ACTION_UPGRADE_1) pick = 0;
      else if (actions & ACTION_UPGRADE_2) pick = 1;
      else if (actions & ACTION_UPGRADE_3) pick = 2;
      else if (actions & ACTION_CONFIRM) {
        const aim = input.aim();
        if (aim.seen) {
          const field = renderer.toField(
            aim.x + canvas.getBoundingClientRect().left,
            aim.y + canvas.getBoundingClientRect().top,
          );
          pick = upgradeCardAt(field.x, field.y);
        }
      }
      if (pick >= 0 && world.applyUpgrade(pick)) {
        audio.upgrade();
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave} begins.`);
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, 0, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const aim = input.aim();
    let angle = world.state.player.angle;
    if (aim.seen) {
      const field = renderer.toField(
        aim.x + canvas.getBoundingClientRect().left,
        aim.y + canvas.getBoundingClientRect().top,
      );
      angle = Math.atan2(field.y - world.state.player.y, field.x - world.state.player.x);
    }
    const events = world.step(STEP, input.direction(), angle, input.firing(), false);
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting drones shoot unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Starlight Salvage. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

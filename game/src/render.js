// Everything the player sees: the starfield backdrop, every entity, the HUD and the
// title, upgrade, pause, game-over and victory screens. It only paints state; it
// never changes a rule. The playfield is a fixed 1280x720 logical area, scaled to
// the window with letterboxing, so the game looks the same on any screen.
import { COMBO, FIELD, FINAL_WAVE, FONT, PALETTE } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

/** The upgrade cards' geometry, shared by the painter and the click test. */
const UPGRADE_CARD = { width: 300, height: 210, gap: 36, top: 262 };

/** Which upgrade card (0-2) a playfield point falls on, or -1. */
export function upgradeCardAt(x, y) {
  const total = UPGRADE_CARD.width * 3 + UPGRADE_CARD.gap * 2;
  const startX = (FIELD.width - total) / 2;
  if (y < UPGRADE_CARD.top || y > UPGRADE_CARD.top + UPGRADE_CARD.height) return -1;
  for (let index = 0; index < 3; index += 1) {
    const left = startX + index * (UPGRADE_CARD.width + UPGRADE_CARD.gap);
    if (x >= left && x <= left + UPGRADE_CARD.width) return index;
  }
  return -1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewWidth = 0;
  let viewHeight = 0;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  // The backdrop is painted once to an offscreen canvas: nebula blobs and three
  // layers of stars, so every frame only blits one image.
  const backdrop = document.createElement('canvas');
  backdrop.width = FIELD.width;
  backdrop.height = FIELD.height;
  const backdropStars = [];
  {
    const bctx = backdrop.getContext('2d');
    const gradient = bctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    bctx.fillStyle = gradient;
    bctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const nebulae = [
      { x: 220, y: 150, r: 260, color: PALETTE.nebulaA },
      { x: 1050, y: 480, r: 300, color: PALETTE.nebulaB },
      { x: 700, y: 90, r: 200, color: PALETTE.nebulaC },
      { x: 150, y: 600, r: 220, color: PALETTE.nebulaB },
    ];
    for (const nebula of nebulae) {
      const glow = bctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
      glow.addColorStop(0, nebula.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      bctx.fillStyle = glow;
      bctx.fillRect(nebula.x - nebula.r, nebula.y - nebula.r, nebula.r * 2, nebula.r * 2);
    }
    const random = createRandom(20261117);
    for (let i = 0; i < 190; i += 1) {
      const star = {
        x: random() * FIELD.width,
        y: random() * FIELD.height,
        radius: random() < 0.85 ? 1 : 2,
        layer: Math.floor(random() * 3),
        twinkle: random() * Math.PI * 2,
      };
      backdropStars.push(star);
      bctx.fillStyle = PALETTE.star;
      bctx.globalAlpha = 0.35 + star.layer * 0.22;
      bctx.beginPath();
      bctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      bctx.fill();
    }
    bctx.globalAlpha = 1;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewWidth = canvas.clientWidth || window.innerWidth;
    viewHeight = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);
    scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    offsetX = (canvas.width - FIELD.width * scale) / 2;
    offsetY = (canvas.height - FIELD.height * scale) / 2;
  }

  function panel(x, y, width, height) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 14);
    ctx.fill();
    ctx.stroke();
  }

  function text(str, x, y, size, color, align, weight) {
    ctx.fillStyle = color;
    ctx.font = `${weight ?? 600} ${size}px ${FONT}`;
    ctx.textAlign = align ?? 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawShip(player) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }
    // Engine flame when thrusting.
    if (player.thrust > 0.1) {
      const flame = 14 + Math.sin(player.x * 0.05 + player.y * 0.05) * 0 + 10 + player.thrust * 8;
      ctx.fillStyle = '#ff9a3d';
      ctx.beginPath();
      ctx.moveTo(-14, 6);
      ctx.lineTo(-14 - flame, 0);
      ctx.lineTo(-14, -6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-12, 12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield ring, outside the rotation.
    if (player.shields > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(93, 242, 166, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAsteroid(rock) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.angle);
    ctx.fillStyle = PALETTE.asteroid;
    ctx.strokeStyle = PALETTE.asteroidRim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < rock.bumps.length; i += 1) {
      const angle = (i / rock.bumps.length) * Math.PI * 2;
      const radius = rock.radius * rock.bumps[i];
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(-rock.radius * 0.25, rock.radius * 0.2, rock.radius * 0.22, 0, Math.PI * 2);
    ctx.arc(rock.radius * 0.3, -rock.radius * 0.25, rock.radius * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawDrone(drone, time) {
    ctx.save();
    ctx.translate(drone.x, drone.y);
    const pulse = 0.75 + Math.sin(time * 5 + drone.wobble) * 0.25;
    ctx.rotate(Math.sin(drone.wobble * 0.7) * 0.3);
    ctx.fillStyle = PALETTE.drone;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-14, 6);
    ctx.lineTo(-14, -6);
    ctx.lineTo(0, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.droneCore;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(2, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSalvage(pod, time) {
    const glow = 0.6 + Math.sin(pod.pulse + time) * 0.25;
    ctx.save();
    ctx.translate(pod.x, pod.y);
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = glow;
    ctx.shadowColor = PALETTE.salvage;
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.salvage;
    const r = pod.radius;
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.salvageCore;
    ctx.fillRect(-r * 0.32, -r * 0.32, r * 0.64, r * 0.64);
    ctx.restore();
  }

  function drawHud(state, best) {
    // Score, top left.
    text('SCORE', 28, 30, 15, PALETTE.muted, 'left', 700);
    text(String(state.score), 28, 58, 34, PALETTE.text, 'left', 800);
    text(`BEST ${Math.max(best, state.score)}`, 28, 86, 14, PALETTE.muted, 'left', 600);
    // Combo meter under the score.
    if (state.comboLevel > 1) {
      const width = 150;
      text(`COMBO x${state.comboLevel}`, 28, 116, 18, '#ffd166', 'left', 800);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.25)';
      ctx.fillRect(28, 130, width, 6);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(28, 130, width * (state.comboTimer / COMBO.windowSeconds), 6);
    }
    // Wave, top centre.
    text(`WAVE ${Math.max(state.wave, 1)} / ${FINAL_WAVE}`, FIELD.width / 2, 30, 17, PALETTE.muted, 'center', 700);
    const remaining = state.asteroids.length + state.drones.length
      + state.spawnQueue.asteroids + state.spawnQueue.drones;
    text(`HOSTILES ${remaining}`, FIELD.width / 2, 56, 15, PALETTE.text, 'center', 700);
    // Hull hearts, top right.
    const hearts = '♥'.repeat(Math.max(0, state.player.hull)) + '♡'.repeat(Math.max(0, state.player.maxHull - state.player.hull));
    text(hearts, FIELD.width - 28, 36, 26, PALETTE.danger, 'right', 700);
    if (state.player.shields > 0) {
      text(`SHIELD x${state.player.shields}`, FIELD.width - 28, 66, 15, PALETTE.good, 'right', 700);
    }
    // Salvage count, bottom left.
    ctx.save();
    ctx.translate(40, FIELD.height - 34);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.salvage;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
    text(`SALVAGE ${state.salvageCollected}`, 60, FIELD.height - 34, 16, PALETTE.text, 'left', 700);
    // Controls hint, bottom right.
    text('WASD move · Mouse aim · Click fire · P pause · M mute', FIELD.width - 28, FIELD.height - 34, 13, PALETTE.muted, 'right', 500);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(4, 8, 24, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('STARLIGHT', FIELD.width / 2, 218, 84, PALETTE.player, 'center', 800);
    text('SALVAGE', FIELD.width / 2, 302, 84, PALETTE.salvage, 'center', 800);
    text('A salvage run through the asteroid belt', FIELD.width / 2, 372, 22, PALETTE.text, 'center', 500);
    text('Collect the glowing salvage. Blast the rocks. Outfly the drones.', FIELD.width / 2, 404, 18, PALETTE.muted, 'center', 500);
    text('Clear all 10 waves to win. Chain pickups and kills to raise your combo.', FIELD.width / 2, 430, 18, PALETTE.muted, 'center', 500);
    panel(FIELD.width / 2 - 250, 468, 500, 96);
    text('WASD / ARROWS — fly      MOUSE — aim      CLICK / SPACE — fire', FIELD.width / 2, 494, 16, PALETTE.text, 'center', 600);
    text('P — pause      M — mute      1 / 2 / 3 — pick an upgrade', FIELD.width / 2, 524, 16, PALETTE.text, 'center', 600);
    if (best > 0) text(`BEST SCORE ${best}`, FIELD.width / 2, 596, 18, '#ffd166', 'center', 700);
    const blink = Math.floor(state.time * 1.6 + 0.5) % 2 === 0;
    if (blink) text('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 646, 20, PALETTE.good, 'center', 800);
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(4, 8, 24, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 130, 44, PALETTE.good, 'center', 800);
    text(`Bonus +${100 * state.wave}   ·   Score ${state.score}`, FIELD.width / 2, 178, 20, PALETTE.text, 'center', 600);
    text('CHOOSE ONE UPGRADE', FIELD.width / 2, 226, 20, '#ffd166', 'center', 800);
    const cardWidth = UPGRADE_CARD.width;
    const cardHeight = UPGRADE_CARD.height;
    const gap = UPGRADE_CARD.gap;
    const total = cardWidth * 3 + gap * 2;
    const startX = (FIELD.width - total) / 2;
    state.choices.forEach((choice, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = UPGRADE_CARD.top;
      panel(x, y, cardWidth, cardHeight);
      text(`[${index + 1}]`, x + cardWidth / 2, y + 34, 18, PALETTE.muted, 'center', 700);
      text(choice.name, x + cardWidth / 2, y + 76, 21, PALETTE.text, 'center', 800);
      text(choice.desc, x + cardWidth / 2, y + 112, 16, PALETTE.muted, 'center', 600);
      const owned = state.upgrades[choice.id] ?? 0;
      const max = choice.max ?? 3;
      text('●'.repeat(owned) + '○'.repeat(Math.max(0, max - owned)), x + cardWidth / 2, y + 152, 16, PALETTE.good, 'center', 700);
      text('CLICK THE CARD OR PRESS ITS KEY', x + cardWidth / 2, y + 184, 11, PALETTE.muted, 'center', 500);
    });
    text('The next wave is harder. Choose well.', FIELD.width / 2, 540, 17, PALETTE.muted, 'center', 500);
  }

  function drawEnd(state, best, victory) {
    ctx.fillStyle = victory ? 'rgba(20, 16, 2, 0.55)' : 'rgba(24, 4, 10, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (victory) {
      text('SECTOR CLEARED!', FIELD.width / 2, 220, 64, '#ffd166', 'center', 800);
      text('All 10 waves survived. The belt is yours, salvager.', FIELD.width / 2, 292, 20, PALETTE.text, 'center', 500);
    } else {
      text('SHIP LOST', FIELD.width / 2, 220, 64, PALETTE.danger, 'center', 800);
      text('The belt keeps its salvage. Your score does not.', FIELD.width / 2, 292, 20, PALETTE.text, 'center', 500);
    }
    panel(FIELD.width / 2 - 260, 336, 520, 168);
    text(`FINAL SCORE   ${state.score}`, FIELD.width / 2, 372, 24, PALETTE.text, 'center', 800);
    text(`BEST   ${Math.max(best, state.score)}`, FIELD.width / 2, 410, 18, '#ffd166', 'center', 700);
    text(`WAVES CLEARED   ${victory ? FINAL_WAVE : Math.max(0, state.wave - 1)}   ·   SALVAGE   ${state.salvageCollected}   ·   KILLS   ${state.kills}`, FIELD.width / 2, 448, 17, PALETTE.muted, 'center', 600);
    text(`COMBO BEST   x${state.maxCombo}`, FIELD.width / 2, 478, 17, PALETTE.muted, 'center', 600);
    const blink = Math.floor(state.time * 1.6 + 0.5) % 2 === 0;
    if (blink) text('PRESS SPACE OR CLICK TO FLY AGAIN', FIELD.width / 2, 566, 20, PALETTE.good, 'center', 800);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(4, 8, 24, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 20, 56, PALETTE.text, 'center', 800);
    text('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 40, 18, PALETTE.muted, 'center', 500);
  }

  return {
    resize,
    /** Convert window client coordinates to playfield coordinates. */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const cssX = clientX - rect.left;
      const cssY = clientY - rect.top;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      return {
        x: (cssX * dpr - offsetX) / scale,
        y: (cssY * dpr - offsetY) / scale,
      };
    },
    draw(state, screen, best) {
      resize();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      // Screen shake: a visual kick only, never part of the game state.
      if (state.shake > 0.2) {
        const magnitude = state.shake * 0.6;
        ctx.translate((Math.random() * 2 - 1) * magnitude, (Math.random() * 2 - 1) * magnitude);
      }
      ctx.drawImage(backdrop, 0, 0);
      // Twinkling stars over the backdrop.
      for (const star of backdropStars) {
        if (star.layer !== 2) continue;
        ctx.globalAlpha = 0.4 + Math.abs(Math.sin(state.time * 1.5 + star.twinkle)) * 0.6;
        ctx.fillStyle = PALETTE.star;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const pod of state.salvage) drawSalvage(pod, state.time);
      for (const rock of state.asteroids) drawAsteroid(rock);
      for (const drone of state.drones) drawDrone(drone, state.time);
      for (const orb of state.orbs) {
        ctx.save();
        ctx.shadowColor = PALETTE.orb;
        ctx.shadowBlur = 12;
        ctx.fillStyle = PALETTE.orb;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const bullet of state.bullets) {
        ctx.save();
        ctx.shadowColor = PALETTE.bullet;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = PALETTE.bullet;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(bullet.x - bullet.vx * 0.022, bullet.y - bullet.vy * 0.022);
        ctx.lineTo(bullet.x, bullet.y);
        ctx.stroke();
        ctx.restore();
      }
      if (screen !== SCREEN_TITLE && state.phase !== 'title') drawShip(state.player);
      for (const particle of state.particles) {
        ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;
      for (const floater of state.floaters) {
        ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
        text(floater.text, floater.x, floater.y, 16, floater.color, 'center', 800);
      }
      ctx.globalAlpha = 1;
      // Damage flash.
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 60, 90, ${state.flash * 0.28})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_UPGRADE) {
        drawHud(state, best);
        drawUpgrade(state);
      } else if (screen === SCREEN_OVER) drawEnd(state, best, false);
      else if (screen === SCREEN_VICTORY) drawEnd(state, best, true);
      else if (screen === SCREEN_PAUSED) {
        drawHud(state, best);
        drawPaused();
      } else drawHud(state, best);
    },
  };
}

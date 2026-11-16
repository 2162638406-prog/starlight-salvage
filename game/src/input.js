// Keyboard and mouse state, read fresh every frame. Movement is WASD or the arrow
// keys; the mouse aims; holding the mouse button or Space fires. Enter, Space or a
// click confirms on menus; P pauses; M mutes; 1-3 picks an upgrade.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_UPGRADE_1 = 8;
export const ACTION_UPGRADE_2 = 16;
export const ACTION_UPGRADE_3 = 32;

const CONFIRM_KEYS = new Set(['Enter', ' ']);
const PAUSE_KEYS = new Set(['p', 'P', 'Escape']);

export function createInput(target) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.key);
    if (CONFIRM_KEYS.has(event.key)) actions |= ACTION_CONFIRM;
    else if (PAUSE_KEYS.has(event.key)) actions |= ACTION_PAUSE;
    else if (event.key === 'm' || event.key === 'M') actions |= ACTION_MUTE;
    else if (event.key === '1') actions |= ACTION_UPGRADE_1;
    else if (event.key === '2') actions |= ACTION_UPGRADE_2;
    else if (event.key === '3') actions |= ACTION_UPGRADE_3;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    keys.delete(event.key);
  }

  function mouseMove(event) {
    const rect = target.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  }

  function mouseDownAt(event) {
    mouseMove(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  }

  function mouseUp() {
    mouseDown = false;
  }

  function blur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);
  target.addEventListener('mousemove', mouseMove);
  target.addEventListener('mousedown', mouseDownAt);
  window.addEventListener('mouseup', mouseUp);

  return {
    /** Movement vector, normalised, from WASD or the arrow keys. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('A') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('D') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('W') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('S') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const length = Math.hypot(x, y);
        x /= length;
        y /= length;
      }
      return { x, y };
    },
    /** True while the mouse button is held or Space is down. */
    firing() {
      return mouseDown || keys.has(' ');
    },
    /** The mouse position in canvas CSS pixels, and whether it has moved yet. */
    aim() {
      return { x: mouseX, y: mouseY, seen: mouseSeen };
    },
    /** One-shot actions since the last call; reading them clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

// A small seeded random source (mulberry32) so a screenshot seed always stages the
// same scene, and the game never leans on Math.random for anything the world does.
/** Make a random function from a 32-bit seed. */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Pick one entry of an array at random. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

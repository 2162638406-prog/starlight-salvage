// Every sound is synthesized with WebAudio: no audio files, no network, nothing to
// load. The context only starts after the player's first gesture, so a browser's
// autoplay rules never block it; every call before that is a silent no-op.
export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
    } catch {
      return false;
    }
    return true;
  }

  /** A short oscillator blip that slides from `from` Hz to `to` Hz. */
  function blip(from, to, seconds, type, volume) {
    if (!context || muted) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + seconds);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  /** A burst of filtered noise, for explosions and impacts. */
  function noise(seconds, volume, cutoff) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
  }

  // A slow two-bar bass pulse with a high sparkle note: the whole soundtrack is six
  // notes, looped on a timer, so it never needs a file or a sequencer library.
  const BASS = [55, 0, 65.41, 0, 49, 0, 58.27, 0];
  const SPARKLE = [440, 0, 523.25, 0, 659.25, 0, 587.33, 0];
  let step = 0;

  function musicStep() {
    if (!context || muted || !musicOn) return;
    const bass = BASS[step % BASS.length];
    const sparkle = SPARKLE[step % SPARKLE.length];
    if (bass > 0) blip(bass, bass, 0.34, 'triangle', 0.5);
    if (sparkle > 0 && step % 2 === 0) blip(sparkle, sparkle, 0.22, 'sine', 0.16);
    step += 1;
  }

  return {
    /** Call from the first user gesture; unlocks sound and starts the music loop. */
    unlock() {
      if (!ensure()) return;
      if (!musicOn) {
        musicOn = true;
        musicTimer = window.setInterval(musicStep, 260);
      }
    },
    shoot() {
      if (!ensure()) return;
      blip(880, 320, 0.09, 'square', 0.1);
    },
    pickup(combo) {
      if (!ensure()) return;
      const base = 660 + Math.min(combo, 8) * 40;
      blip(base, base * 1.5, 0.12, 'sine', 0.22);
      window.setTimeout(() => blip(base * 1.5, base * 2, 0.14, 'sine', 0.18), 55);
    },
    explosion() {
      if (!ensure()) return;
      noise(0.35, 0.4, 900);
      blip(160, 40, 0.3, 'sawtooth', 0.22);
    },
    hit() {
      if (!ensure()) return;
      noise(0.2, 0.35, 500);
      blip(120, 50, 0.25, 'sawtooth', 0.3);
    },
    shield() {
      if (!ensure()) return;
      blip(300, 900, 0.25, 'sine', 0.2);
    },
    waveClear() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => {
        window.setTimeout(() => blip(note, note, 0.22, 'triangle', 0.22), i * 90);
      });
    },
    upgrade() {
      if (!ensure()) return;
      [392, 523.25, 659.25].forEach((note, i) => {
        window.setTimeout(() => blip(note, note * 1.01, 0.16, 'sine', 0.2), i * 70);
      });
    },
    gameOver() {
      if (!ensure()) return;
      [392, 311.13, 233.08, 155.56].forEach((note, i) => {
        window.setTimeout(() => blip(note, note * 0.97, 0.4, 'triangle', 0.22), i * 170);
      });
    },
    victory() {
      if (!ensure()) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((note, i) => {
        window.setTimeout(() => blip(note, note, 0.3, 'triangle', 0.22), i * 110);
      });
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer !== null) window.clearInterval(musicTimer);
      musicTimer = null;
    },
  };
}

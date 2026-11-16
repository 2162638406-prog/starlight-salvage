# starlight-salvage

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/2162638406-prog/starlight-salvage/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/2162638406-prog/starlight-salvage/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Starlight Salvage is a top-down arcade space game: fly a salvage ship through
an asteroid belt, collect glowing salvage pods, blast rocks and drones, chain
pickups and kills into a combo multiplier, and pick an upgrade after every
wave. Clear all 10 waves to win the sector.

## How to play

- **WASD / arrow keys** — fly
- **Mouse** — aim
- **Click / Space** — fire
- **P** — pause, **M** — mute, **1 / 2 / 3** — pick an upgrade (or click its card)

Waves get harder: more asteroids, more drones, faster spawns. Between waves
choose one of three upgrades — faster fire, twin blasters, reinforced hull,
magnet coil, swift thrusters, heavy rounds or an aegis shield. Three hits sink
the ship (a shield charge absorbs one).

## Run it

Serve `game/` with any static server and open `index.html` in a desktop
browser. No build step, no network request, no library: plain ES modules and
a canvas, with all sound synthesized by WebAudio.

```sh
node serve.ts
# open http://localhost:8080
```

## Hand it in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored make.fun
library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots are staged deterministically from the game's own code with
`?shot=start|play|upgrade|over&seed=1` — the autopilot in `game/src/shots.js`
plays the real rules forward, so each frame is what a short game really looks
like.

---

<sub>Entered on [make.fun](https://make.fun/?ref=k4bjy17v&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

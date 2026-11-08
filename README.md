# CyberRun 3D

An endless runner that runs in a browser tab. Three lanes, a city at night,
and a track generated as you go.

React · TypeScript · Three.js via React Three Fiber · Zustand · Vite.
No backend, no database, no asset pipeline — `npm install && npm run dev`.

## The decision the rest of it hangs off

**The game does not import Three.js.**

`src/game/` is the whole simulation — movement, jumping, sliding, collision,
spawning, difficulty, scoring — and it has no idea it is being drawn. It
exports a `World` and a `step()` that advances it one fixed tick. The renderer
reads that world and moves meshes. It decides nothing.

That split buys two things that are hard to get any other way.

**It can be tested without a screen.** 32 tests run in about a second with no
browser, no canvas and no mocking of WebGL. They are about the game rather
than about React.

**It cannot drift with frame rate.** The simulation runs at a fixed 120Hz
inside an accumulator, so a 60Hz laptop and a 144Hz monitor play the same
game. Written the usual way — multiplying by `delta` inside `useFrame` — jump
height and collision margins quietly depend on the hardware.

The test for that is the one I would point at first. Asserting that two frame
rates agree *exactly* is asking for something floating-point frame times
cannot give: `1/60` and `1/144` are not exact in binary, so the two
accumulators eventually land either side of a step boundary and differ by one
step. What matters is that the gap **does not grow with how long you play**,
so the test measures it after 2 seconds and again after 60, and demands the
same bound both times.

## The generator has to be fair, not just random

A random track is easy. A random track that is always survivable is not, and
an impossible row is exactly the sort of thing that shows up once in a
thousand runs — for a player, never for the person who wrote it.

`generateRow` guarantees two things, both tested across 60 seeds and 400 rows
each:

- **Survivable.** The three lanes are never all walled. A row of three blocks
  cannot be beaten by any input.
- **Reachable.** The lane that is open is next to one the player could already
  be in. A row can be survivable in principle and unfair in practice, if the
  only gap is two lanes away and you are moving too fast to cross. Rows are a
  fixed distance apart and a lane change takes a fixed time, so one lane of
  movement per row is the honest assumption.

The second is the one that bites, and it is why `generateRow` takes the set of
lanes you could be in *going into* a row and returns the set you can be in
*coming out* of it.

## What is measured

Frame timing, 120 frames in the dev build at 865×846, device pixel ratio
capped at 1.75:

| | |
|---|---|
| frames per second | 61 |
| median frame | 16.7 ms |
| 95th percentile | 16.8 ms |
| worst frame | 16.9 ms |

The gap between median and worst is the number worth looking at. 0.2 ms means
nothing was allocated and nothing collected during those two seconds:
entities are drawn through five instanced meshes whose `count` changes, rather
than components that mount and unmount, and the track and skyline are a fixed
ring of geometry slid backwards and wrapped rather than geometry built as you
run.

Production bundle: 317 KB gzipped, nearly all of it Three.js.

## Playing it

| | |
|---|---|
| `←` `→` or `A` `D` | change lane |
| `↑` / `Space` / `W` | jump the red barriers |
| `↓` / `S` | slide under the amber ones |
| purple blocks | fill the lane — go round |

On a phone: swipe to move, tap to jump.

Power-ups last seven seconds — a **shield** absorbs one hit, a **magnet**
widens your reach for coins, **slow** takes the pace off. The high score is
kept in `localStorage`, and the reads and writes are wrapped: a private window
throws on access rather than returning null, and a best score is not worth a
white screen.

## Sound, without any audio files

Five effects as `.wav` would be a few hundred kilobytes of binary in the
repository, each with a licence to get right. `src/audio.ts` synthesises them
from oscillators and an envelope instead: nothing to download, nothing to
attribute. The `AudioContext` is created on the first keypress or tap, because
browsers refuse to start one without a gesture.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 32 tests, no browser needed
npm run build
```

## Layout

```
src/game/          the simulation - no Three.js anywhere in here
  constants.ts     every tunable, in world units and seconds
  rng.ts           seeded, so a track can be replayed and tested
  generator.ts     rows, and the survivable/reachable guarantees
  world.ts         step(), collision, scoring, the fixed-step accumulator
  *.test.ts        32 tests
src/scene/         React Three Fiber - reads the world, decides nothing
src/ui/            HUD and overlays, in DOM rather than in WebGL
src/store.ts       the bridge: the world stays out of React state
src/audio.ts       synthesised effects
```

`src/store.ts` is deliberately thin. The world changes 120 times a second, and
putting it in React state would re-render the tree at that rate to move three
cubes. The store carries only what a person reads — score, coins, whether the
run is over — and the scene reads the world directly inside `useFrame`.

## What it does not do

There is no backend and no database, by design: the brief was a game that is
entirely a browser tab. The consequence is that the high score is per-browser
and cannot be shared or compared. A leaderboard would need a server, and
saying so is cheaper than implying otherwise.

## Author

Mohd Mudabbir Arafat

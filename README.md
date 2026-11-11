# CyberRun 3D

**Live: [cyberrun-tau.vercel.app](https://cyberrun-tau.vercel.app)**

[![CI](https://github.com/Mudabbirarafat/cyberrun/actions/workflows/ci.yml/badge.svg)](https://github.com/Mudabbirarafat/cyberrun/actions/workflows/ci.yml)

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

**It can be tested without a screen.** 44 tests run in about a second with no
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

## Why there is a combo at all

A flat ten points a coin gives you no reason to take a risk for one. Dodging
early is always correct, the safe lane is always right, and the only thing
that changes over a run is the number going up.

So coins and near misses chain. Every link shortens nothing and adds one; the
multiplier is a step function of the chain length rather than the length
itself, because `x4` is a thing you can read at speed and `37 links` is not.
Let the chain lapse for three and a half seconds and it drops. Crash and it
drops with you - the multiplier is part of what a mistake costs, not just the
run.

A near miss is the other half of it, and the width is the whole design. The
box that kills you is 1.37 units either side of an obstacle's centre. The next
lane's centre is 2.4 away. The near-miss band is **1.92**, which sits between
them on purpose: sitting safely one lane over earns nothing, because if it did
every obstacle you ever passed would pay out. You have to be part of the way
into the obstacle's lane, which only happens mid-change - so the reward is for
dodging late, and dodging late is the thing that was previously strictly
worse than dodging early.

Barriers pay the same way vertically: clear one by less than 0.75 and it
counts, sail over it and it does not. Overheads are deliberately excluded.
The clearance while sliding is a constant, so counting it would not be
rewarding skill, it would be paying you to press down.

## What is measured

Frame timing with the full effect stack running, 240 frames in the dev build
at 865×846, device pixel ratio capped at 1.25:

| | |
|---|---|
| frames per second | 60 |
| median frame | 16.7 ms |
| 95th percentile | 16.8 ms |
| worst frame | 17.4 ms |

The gap between median and worst is the number worth looking at. 0.2 ms means
nothing was allocated and nothing collected during those two seconds:
entities are drawn through five instanced meshes whose `count` changes, rather
than components that mount and unmount, and the track and skyline are a fixed
ring of geometry slid backwards and wrapped rather than geometry built as you
run.

Production bundle: 342 KB gzipped, nearly all of it Three.js and the
postprocessing library.

## How it looks

The first version was flat colours on hard cubes under a white key light, and
it looked like a toy. Four things changed that, none of them an asset.

**Bloom does most of the work.** Almost every surface is near-black and the
few that are not are emissive and marked `toneMapped={false}`, so they arrive
above the bloom threshold and bleed. The contrast between a black body and a
blown-out edge is the entire look.

**Obstacles are drawn twice.** A near-black body, then a slightly larger copy
with its faces flipped inwards — only the parts of that copy sticking out past
the body are visible, which gives a hard emissive rim for one extra instanced
draw. An outline pass or edge geometry would cost far more. The first attempt
pushed the rim 30% out in depth and the bodies disappeared entirely, so the
obstacles read as wireframe rectangles floating in the air; the rim is now a
few percent.

**The city's windows are a canvas texture, not geometry.** A skyline of lit
windows as meshes is tens of thousands of quads for something the fog eats
within eighty units. One 256px canvas, drawn once at startup and used as an
emissive map, gets there for nothing. Two thirds of the windows are dark,
because a uniformly lit block reads as a texture swatch rather than a building
at night.

**Nothing is shaded that does not need to be.** The road, the ground and the
buildings use Lambert; the rails, coins and power-ups are unlit `MeshBasic`,
because a neon strip is self-lit by definition and lighting maths on it is
wasted. Only the runner uses a physically based material, and it is a few
hundred pixels.

Bloom renders at half resolution. The result is blurred, so the pixels thrown
away are ones nobody can see.

### A measurement that was lying

Partway through this the frame rate appeared to collapse from 61fps to 18, and
a round of optimisation followed. It turned out the measurement was taken in a
**background browser tab**, which the browser throttles — the giveaway was a
median of exactly 33.3ms, which is two vsync intervals rather than anything a
renderer would produce on its own. Fronted, the same build ran at 60 with the
effects off *and* on.

The optimisations were kept, because they are all free in quality terms, but
the panic was caused by a number rather than by the game. Any frame-rate
figure taken from a tab that is not in front is worth nothing.

## Playing it

| | |
|---|---|
| `←` `→` or `A` `D` | change lane |
| `↑` / `Space` / `W` | jump the red barriers |
| `↓` / `S` | slide under the amber ones |
| purple blocks | fill the lane — go round |

On a phone: swipe to move, tap to jump.

Coins and near misses chain into a multiplier — it shows at the top of the
screen once it is worth something, with a bar for how long you have to keep
it. Dodge late to earn the near misses; see above for why that is the only
way to earn them.

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
npm test           # 44 tests, no browser needed
npm run build
```

## Layout

```
src/game/          the simulation - no Three.js anywhere in here
  constants.ts     every tunable, in world units and seconds
  rng.ts           seeded, so a track can be replayed and tested
  generator.ts     rows, and the survivable/reachable guarantees
  world.ts         step(), collision, scoring, the fixed-step accumulator
  *.test.ts        44 tests
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

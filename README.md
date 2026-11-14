# CyberRun 3D

**Live: [cyberrun-tau.vercel.app](https://cyberrun-tau.vercel.app)**

[![CI](https://github.com/Mudabbirarafat/cyberrun/actions/workflows/ci.yml/badge.svg)](https://github.com/Mudabbirarafat/cyberrun/actions/workflows/ci.yml)

An endless runner that runs in a browser tab. Three lanes, a city at night,
and a track generated as you go.

React · TypeScript · Three.js via React Three Fiber · Zustand · Vite.
No backend and no database — `npm install && npm run dev`. One asset: the
runner, a CC0 character converted to glTF by a build page in this repo.

## The decision the rest of it hangs off

**The game does not import Three.js.**

`src/game/` is the whole simulation — movement, jumping, sliding, collision,
spawning, difficulty, scoring — and it has no idea it is being drawn. It
exports a `World` and a `step()` that advances it one fixed tick. The renderer
reads that world and moves meshes. It decides nothing.

That split buys two things that are hard to get any other way.

**It can be tested without a screen.** 83 tests run in about a second with no
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

## Three goals at a time

Missions are **not** part of the simulation. `step()` runs 120 times a second
and knows nothing about them: a set is folded in once, when a run ends, as a
pure function of what you had and what the run came to. That keeps the hot
loop untouched and means the whole system can be tested by handing it numbers
rather than by playing.

A set is generated from its level number alone, so level 4 is the same three
goals for everybody and a test can assert on them without pinning a snapshot
of a random draw. Targets scale with the level and round to something a
person would say — 900m, not 873m.

Two scopes, and the distinction is the point. A `total` accumulates across
runs; a `run` keeps the best single one, so "reach 900m in one run" cannot be
satisfied by nine runs of a hundred metres. Every set is guaranteed one of
each: left purely to chance the draw produced "collect 60 coins", "finish 5
runs" and "pick up 5 power-ups" for level 1, which is three ways of saying
*keep playing* and asks nothing of the run itself.

Finish all three and the next set replaces them. Progress is kept in
`localStorage` and checked on the way back in rather than trusted — whatever
is in there was written by an older version of the code as far as this
build knows, and a renamed field should cost you your progress, not the
ability to load the game.

## The game talks, without shipping a voice

Crashing plays a four-note descending sting and then the game says something
about the run: *"You had a chain going and you threw it away."*

It is not a sound clip. A meme sound is someone else's recording with
someone else's licence on it, and a few hundred kilobytes of binary in a
repository whose only other binary is the runner. The browser already
has `speechSynthesis`, so the game picks a line and the browser reads it —
nothing to download, nothing to attribute, and funnier than a buzzer because
the voice is doing its sincere best with material it does not understand.

Choosing the line is kept apart from saying it, so the interesting half is a
pure function of what the run came to: a four-second run, a long chain
thrown away, six near misses and then a wall, a first-ever best. The roll is
passed in rather than taken from `Math.random`, so a test can pin which line
comes out, and the previous line is passed in too because hearing the same
one twice running is what makes it stale.

**The line is written on the panel as well as spoken.** Most tabs are muted,
and a joke that only exists as audio is no joke at all on a silent one.

Every line is about the run, never about the player — there is a test for
that, because the distance between teasing and nagging is one sentence and
it is easy to cross while writing jokes.

## The runner is a real character now

Boxes on pivot groups read as a toy whatever you do to the lighting, so the
figure is now Kenney's **Animated Characters Protagonists** (CC0), which ships
a rigged body and `idle`, `run` and `jump` as skeletal animation.

The pack is FBX: one body and three animation files, 1.9 MB, and three.js
needs its heavier `FBXLoader` to read any of it. Rather than add Blender or a
converter to the toolchain, `convert.html` at the repo root does the job with
the three.js that is already a dependency — `FBXLoader` in, `GLTFExporter`
out, one 530 KB `.glb` with the clips attached. The FBX inputs are not
committed; the page says where to get them.

Three things the conversion gets right that a naive one does not, each of
which was wrong on the first attempt and visible only by looking:

- **Clips are picked by length, not by index.** Every file carries two
  animation stacks, the real one and a `0.Targeting Pose` stub, and their
  order differs per file. Taking `animations[0]` gave a 0.042-second "run
  cycle" — a frozen pose that would have shipped as a bug nobody could name.
- **UVs are flipped on the geometry.** FBX puts the texture origin at the
  bottom left and glTF at the top left, so the first export sampled the skin
  upside down: a white head and a pink torso, which is the boots and the
  shorts in the wrong places.
- **Vertex colours are deleted.** Kenney's meshes carry them, the material
  here uses a texture and leaves `vertexColors` off, so they were 58 KB being
  downloaded and ignored.

The model is fitted to `PLAYER_RUN_HEIGHT` by measuring its bounding box
rather than by a hard-coded scale, so the silhouette and the box that kills
you stay the same thing, and swapping the character needs no new number. The
run clip's playback rate follows the world's speed — left alone, a runner at
full pelt looks like they are being towed.

**The pack ships three clips; the game has six.** `clips.ts` builds the
others on the rig at load time.

The slide is a full-body pose built from about fifteen bone rotations — hips reclined, lead leg out, trailing knee folded under, arms
swept back, head counter-rotated so the runner is still looking where they
are going. It blends through the same mixer as the exported clips and costs
no bytes. Rather than download a second pack and gamble on two skeletons
matching, the rig that is already here gets posed.

Every rotation is **relative to the bind pose**. A bone's rest orientation is
part of how the character was modelled, and writing absolute quaternions
throws that away. Two attempts were wrong before the third looked right, both
because of assumptions about the rig that only a screenshot could settle: on
this skeleton positive X *raises* an arm rather than lowering it, and the
bind pose is a T, so bringing the arms down to the body is a large Z rotation
rather than a small one. Until that was fixed the slide read as someone
falling over backwards with their arms out.

One compromise, written down rather than hidden: the figure used to be
squashed by the exact ratio of the two collision heights, which made the
drawn height and the collision height the same number by construction. A
posed skeleton is already most of the way down, and squashing it by another
53% on top made a pancake, so the scale is now a nudge and the pose does the
work. The silhouette during a slide is therefore *close to* the collision box
rather than equal to it. The box is still what the overhead check uses, so
this is a question of how it looks, not of what you get away with.

**Sprint and the landing crouch are additive layers**, not clips of their
own. An additive clip carries only the *difference* from the bind pose, so a
sprint lean does not have to contain a run cycle and a landing dip does not
have to fight the state machine for control of the legs: both sit on top of
whatever is already playing and the only thing that moves is a weight.

- **Sprint** follows the pace — chest down, head up, elbows in — and it does
  not start at zero. The first stride of a run should already look like
  somebody committing to it; a lean that only arrives at top speed arrives
  two minutes into a game most people lose in thirty seconds.
- **Crouch** spikes on landing and decays over about a fifth of a second.
  The simulation never announces a landing and does not need to: the
  posture's own fall out of `jump` is the signal. Coming out of a jump
  straight back into a full stride is the single thing that most makes a
  character look weightless.

Both are built with `makeClipAdditive`, which subtracts a clip's first frame
from the rest — so the clip is authored as one frame of nothing and one
frame of the pose, and what survives is the delta.

**The run plays faster than it was authored.** At 1x the cycle is 0.667
seconds, about a stride and a half a second, and against a city going past at
eleven units a second that reads as someone who does not much care whether
they make it. The rate is tied to the world's speed with a floor well above
1x.

## The run goes somewhere

Every 900 metres the city changes: a name, a palette, and a different
question. The zones cycle through five and the counter does not wrap, so the
second time you reach Downtown it is zone 6 — being told you were back in
zone 1 after four and a half kilometres would read as losing progress.

| zone | what it asks of you |
|---|---|
| Downtown | the baseline |
| Freight Yard | lane changes — half again as many lane-filling blocks |
| Neon Mile | a breather that pays — coins and power-ups up, obstacles down |
| Skyway | jumping and sliding — blocks cut by more than half |
| Overdrive | all of it at once, which is what makes arriving there mean something |

**A zone scales probabilities and never chooses a lane.** That is the whole
reason this was safe to add: `generateRow`'s guarantee — that every row
leaves a lane you can actually reach — is a property of *where* obstacles go,
and a zone has no say in that. There is a test that walks two full laps of
every zone across twelve seeds and checks the guarantee still holds, and
another that counts blocks in Freight Yard against Skyway, because a set of
multipliers that was not actually wired through would leave the zones as a
cosmetic rename of the same track.

They are called zones rather than levels because `Level` is already the
missions counter, and two different numbers both called "level" on the same
screen is a bug report waiting to happen.

The difficulty curve is unchanged and still runs underneath: `difficulty()`
climbs with total distance, so the second lap of the same five zones is
harder than the first. Zones supply variety, not difficulty.

The palette eases rather than switching — a boundary is a place you run
through, not a light switch — and the rails, their reflections and the
skyline's hue all move together, because changing only the rails reads as new
paint rather than as somewhere else.

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

Production bundle: 366 KB gzipped, nearly all of it Three.js and the
postprocessing library — 24 KB of that is the glTF loader and the animation
system the character needs. Plus `runner.glb` at 530 KB, which is already
compressed and does not gzip further. So a first visit is about 900 KB where
it used to be 342, and that is the price of a rigged character; everything
after the first visit is cached.

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

`Esc` or `P` pauses — the world is simply not advanced, and the frame's time
is dropped rather than banked, so unpausing does not pay back a minute of
simulation in one step. `M` mutes, and the button in the corner does the same
thing for anyone who would rather not hunt for a letter while the game is
talking. The setting is remembered.

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
npm test           # 83 tests, no browser needed
npm run build
```

## Layout

```
src/game/          the simulation - no Three.js anywhere in here
  constants.ts     every tunable, in world units and seconds
  rng.ts           seeded, so a track can be replayed and tested
  generator.ts     rows, and the survivable/reachable guarantees
  world.ts         step(), collision, scoring, the fixed-step accumulator
  *.test.ts        83 tests
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

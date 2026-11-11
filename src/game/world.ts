import * as C from "./constants";
import { difficulty, generateRow } from "./generator";
import { createRng, type Rng } from "./rng";
import type { GameEvent, Input, World } from "./types";

/**
 * The whole game, with no Three.js in sight.
 *
 * Everything here is a function of (world, input) and a fixed time step, so a
 * run with a given seed and a given set of inputs plays out identically every
 * time - on a 60Hz laptop, a 144Hz monitor, or in a test with no screen at
 * all. The renderer reads this; it never decides anything.
 */

export function createWorld(seed: number = Date.now() >>> 0): World {
  const world: World = {
    seed,
    rngState: createRng(seed).state,
    status: "ready",
    time: 0,
    distance: 0,
    speed: C.START_SPEED,
    score: 0,
    coins: 0,
    player: {
      lane: 1,
      x: C.LANE_X[1],
      y: 0,
      vy: 0,
      posture: "run",
      slideRemaining: 0,
    },
    entities: [],
    nextEntityId: 1,
    // The first rows start far enough ahead to be seen coming.
    nextRowZ: 40,
    reachableLanes: [0, 1, 2],
    shieldRemaining: 0,
    magnetRemaining: 0,
    slowRemaining: 0,
    combo: 0,
    comboRemaining: 0,
    multiplier: 1,
    bonus: 0,
    bestCombo: 0,
    nearMisses: 0,
    events: [],
  };
  fillTrack(world);
  return world;
}

export function startRun(world: World): void {
  if (world.status === "ready") world.status = "running";
}

export function applyInput(world: World, input: Input): void {
  if (world.status !== "running") return;
  const player = world.player;

  switch (input) {
    case "left":
    case "right": {
      const target = player.lane + (input === "left" ? -1 : 1);
      if (target >= 0 && target < C.LANE_COUNT) {
        player.lane = target;
        world.events.push("lane");
      }
      return;
    }
    case "jump": {
      // Only from the ground: double jumps would make the generator's
      // reachability guarantee meaningless.
      if (player.posture === "run") {
        player.posture = "jump";
        player.vy = C.JUMP_VELOCITY;
        player.slideRemaining = 0;
        world.events.push("jump");
      }
      return;
    }
    case "slide": {
      if (player.posture === "run") {
        player.posture = "slide";
        player.slideRemaining = C.SLIDE_DURATION;
        world.events.push("slide");
      } else if (player.posture === "jump") {
        // Slamming down out of a jump: lets a mistimed jump still be saved.
        player.vy = Math.min(player.vy, -C.JUMP_VELOCITY);
      }
      return;
    }
  }
}

/** One fixed step. The only function that advances the world. */
export function step(world: World): void {
  if (world.status !== "running") return;
  const dt = C.FIXED_DT;
  const player = world.player;

  world.time += dt;

  const base = Math.min(C.MAX_SPEED, C.START_SPEED + C.SPEED_RAMP * world.time);
  world.speed = world.slowRemaining > 0 ? base * C.SLOW_FACTOR : base;
  world.distance += world.speed * dt;

  // Lane position eases towards the target so a change reads as movement
  // rather than teleporting, but collision uses this same x - what you see
  // is what you are hit by.
  const targetX = C.LANE_X[player.lane]!;
  const delta = targetX - player.x;
  const travel = C.LANE_CHANGE_SPEED * dt;
  player.x = Math.abs(delta) <= travel ? targetX : player.x + Math.sign(delta) * travel;

  if (player.posture === "jump") {
    player.vy += C.GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.posture = "run";
    }
  } else if (player.posture === "slide") {
    player.slideRemaining -= dt;
    if (player.slideRemaining <= 0) {
      player.slideRemaining = 0;
      player.posture = "run";
    }
  }

  world.shieldRemaining = Math.max(0, world.shieldRemaining - dt);
  world.magnetRemaining = Math.max(0, world.magnetRemaining - dt);
  world.slowRemaining = Math.max(0, world.slowRemaining - dt);

  if (world.comboRemaining > 0) {
    world.comboRemaining = Math.max(0, world.comboRemaining - dt);
    if (world.comboRemaining === 0) breakCombo(world, "combobreak");
  }

  fillTrack(world);
  resolveCollisions(world);
  recycle(world);

  // Distance plus what was earned, rather than distance plus a flat rate per
  // coin: a coin picked up at x4 was worth four times as much at the moment
  // it was taken, and re-deriving it from a total would lose that.
  world.score = Math.floor(world.distance * C.DISTANCE_SCORE) + world.bonus;
}

/**
 * Advances by a frame's worth of real time, in fixed steps.
 *
 * The leftover is returned rather than dropped: dropping it makes the game
 * run slightly slow, and slightly differently, on every refresh rate. A long
 * frame - a backgrounded tab, a stall - is clamped instead of being paid back
 * all at once, which would teleport the player through a wall.
 */
export function advance(world: World, frameTime: number, carry: number): number {
  let accumulator = carry + Math.min(frameTime, C.MAX_FRAME_TIME);
  while (accumulator >= C.FIXED_DT) {
    step(world);
    accumulator -= C.FIXED_DT;
  }
  return accumulator;
}

export function drainEvents(world: World): GameEvent[] {
  if (world.events.length === 0) return [];
  const events = world.events.slice();
  world.events.length = 0;
  return events;
}

function rng(world: World): Rng {
  // The stream lives on the world so a saved world replays identically.
  return {
    get state() {
      return world.rngState;
    },
    set state(value: number) {
      world.rngState = value;
    },
  } as Rng;
}

function fillTrack(world: World): void {
  const source = rng(world);
  while (world.nextRowZ < world.distance + C.SPAWN_AHEAD) {
    const { entities, reachable } = generateRow(
      source,
      world.nextRowZ,
      world.nextRowZ,
      world.reachableLanes,
      () => world.nextEntityId++,
    );
    world.entities.push(...entities);
    world.reachableLanes = reachable;
    world.nextRowZ += C.ROW_SPACING;
  }
}

function resolveCollisions(world: World): void {
  const player = world.player;
  const height =
    player.posture === "slide" ? C.PLAYER_SLIDE_HEIGHT : C.PLAYER_RUN_HEIGHT;
  const magnet = world.magnetRemaining > 0;

  for (const entity of world.entities) {
    if (entity.spent) continue;

    const dz = entity.z - world.distance;
    const ex = C.LANE_X[entity.lane]!;

    if (entity.kind === "obstacle") {
      // Everything is judged while the obstacle is level with the player.
      // That is the only instant at which the gap is the real gap: a frame
      // later the lane change has carried on and the jump has fallen.
      if (Math.abs(dz) > C.OBSTACLE_HALF_DEPTH + C.PLAYER_HALF_DEPTH) continue;

      const lateral = Math.abs(ex - player.x);
      if (lateral <= C.OBSTACLE_HALF_WIDTH + C.PLAYER_HALF_WIDTH) {
        let hit = true;
        let clearance = 0;
        if (entity.obstacle === "barrier") {
          clearance = player.y - C.BARRIER_HEIGHT;
          hit = clearance < 0;
        } else if (entity.obstacle === "overhead") {
          clearance = C.OVERHEAD_CLEARANCE - (player.y + height);
          hit = clearance < 0;
        }

        if (hit) {
          entity.spent = true;
          entity.passed = true;
          breakCombo(world, null);
          if (world.shieldRemaining > 0) {
            world.shieldRemaining = 0;
            world.events.push("shielded");
          } else {
            world.status = "over";
            world.events.push("crash");
            return;
          }
          continue;
        }

        // Jumped it. Clearing by a mile is not a near miss; clearing by a
        // hair is the whole point. Overheads are excluded on purpose: the
        // clearance while sliding is a constant, so it would pay out on
        // every slide rather than on anything done well.
        if (!entity.passed) {
          entity.passed = true;
          if (entity.obstacle === "barrier" && clearance <= C.NEAR_MISS_CLEARANCE) {
            registerNearMiss(world);
          }
        }
        continue;
      }

      // A different lane, but close enough that it was a decision.
      if (!entity.passed && lateral <= C.NEAR_MISS_HALF_WIDTH) {
        entity.passed = true;
        registerNearMiss(world);
      }
      continue;
    }

    // Collectibles. A magnet widens the reach rather than teleporting them,
    // so what is picked up still matches what is drawn.
    const reach = magnet ? C.MAGNET_RADIUS : C.PICKUP_RADIUS;
    if (Math.abs(dz) > reach) continue;
    if (Math.abs(ex - player.x) > reach) continue;
    if (!magnet && Math.abs(player.y - 0.6) > 1.4) continue;

    entity.spent = true;
    if (entity.kind === "coin") {
      world.coins += 1;
      world.bonus += C.COIN_SCORE * world.multiplier;
      extendCombo(world);
      world.events.push("coin");
    } else {
      switch (entity.power) {
        case "shield":
          world.shieldRemaining = C.POWER_DURATION;
          break;
        case "magnet":
          world.magnetRemaining = C.POWER_DURATION;
          break;
        case "slow":
          world.slowRemaining = C.POWER_DURATION;
          break;
      }
      world.events.push("power");
    }
  }
}

/**
 * One more link in the chain.
 *
 * The multiplier is a step function of the chain length rather than the
 * chain length itself, so it is legible: a player can see "x3" and know
 * roughly what it is worth without counting coins.
 */
function extendCombo(world: World): void {
  world.combo += 1;
  world.comboRemaining = C.COMBO_WINDOW;
  if (world.combo > world.bestCombo) world.bestCombo = world.combo;

  const stepped = Math.min(
    C.MAX_MULTIPLIER,
    1 + Math.floor(world.combo / C.COMBO_PER_STEP),
  );
  if (stepped > world.multiplier) {
    world.multiplier = stepped;
    world.events.push("combostep");
  }
}

/**
 * Drop the chain.
 *
 * `bestCombo` deliberately survives: it is what the game-over panel reports,
 * and a run's best moment should outlive the mistake that ended it.
 */
function breakCombo(world: World, event: "combobreak" | null): void {
  if (world.combo === 0) return;
  world.combo = 0;
  world.comboRemaining = 0;
  world.multiplier = 1;
  if (event) world.events.push(event);
}

function registerNearMiss(world: World): void {
  world.nearMisses += 1;
  world.bonus += C.NEAR_MISS_SCORE * world.multiplier;
  extendCombo(world);
  world.events.push("nearmiss");
}

function recycle(world: World): void {
  const cutoff = world.distance - C.DESPAWN_BEHIND;
  if (world.entities.length === 0 || world.entities[0]!.z >= cutoff) return;
  // Entities are generated in z order, so everything past the first survivor
  // is still ahead: one filter is enough and the array stays short.
  world.entities = world.entities.filter((entity) => entity.z >= cutoff);
}

export { difficulty };

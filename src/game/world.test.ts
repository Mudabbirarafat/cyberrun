import { describe, expect, it } from "vitest";
import * as C from "./constants";
import type { Entity, Input, World } from "./types";
import { advance, applyInput, createWorld, drainEvents, startRun, step } from "./world";

/** A world with a clear track, so a test places exactly what it means to. */
function emptyWorld(seed = 1): World {
  const world = createWorld(seed);
  world.entities = [];
  // Far enough that fillTrack will not add anything during a short test.
  world.nextRowZ = 10_000;
  startRun(world);
  return world;
}

function place(world: World, entity: Partial<Entity> & Pick<Entity, "kind">): Entity {
  const full: Entity = {
    id: world.nextEntityId++,
    kind: entity.kind,
    lane: entity.lane ?? 1,
    z: entity.z ?? 6,
    obstacle: entity.obstacle,
    power: entity.power,
    spent: false,
    passed: false,
  };
  world.entities.push(full);
  return full;
}

/** Runs until the world has travelled `units`, or the run ends. */
function run(world: World, units: number): void {
  const target = world.distance + units;
  let guard = 0;
  while (world.distance < target && world.status === "running") {
    step(world);
    if (++guard > 200_000) throw new Error("run did not terminate");
  }
}

describe("stepping", () => {
  it("does nothing until the run is started", () => {
    const world = createWorld(1);
    const before = world.distance;
    step(world);
    expect(world.status).toBe("ready");
    expect(world.distance).toBe(before);
  });

  it("does not drift between frame rates", () => {
    // The whole reason for a fixed step. 1/60 and 1/144 are not exact in
    // binary, so after enough frames the two accumulators can land either
    // side of a step boundary - a difference of one step is the floor, and
    // asking for bit-equality here would be asking for something a float
    // clock cannot give.
    //
    // What must hold is that the gap does not grow with how long you play.
    // That is the difference between a fixed step and a per-frame one, and
    // the only way to see it is to measure the gap twice, far apart.
    const gapAfter = (seconds: number) => {
      const sixty = createWorld(99);
      const high = createWorld(99);
      startRun(sixty);
      startRun(high);

      let carrySixty = 0;
      for (let i = 0; i < seconds * 60; i++) carrySixty = advance(sixty, 1 / 60, carrySixty);
      let carryHigh = 0;
      for (let i = 0; i < seconds * 144; i++) carryHigh = advance(high, 1 / 144, carryHigh);

      return {
        distance: Math.abs(sixty.distance - high.distance),
        time: Math.abs(sixty.time - high.time),
      };
    };

    const oneStep = C.MAX_SPEED * C.FIXED_DT;
    const short = gapAfter(2);
    const long = gapAfter(60);

    expect(short.distance).toBeLessThan(oneStep);
    expect(short.time).toBeLessThanOrEqual(C.FIXED_DT + 1e-9);

    // Thirty times the play, the same bound.
    expect(long.distance).toBeLessThan(oneStep);
    expect(long.time).toBeLessThanOrEqual(C.FIXED_DT + 1e-9);
  });

  it("does not pay back a long stall all at once", () => {
    // A backgrounded tab must not teleport the player through a wall.
    const world = createWorld(5);
    startRun(world);
    const carry = advance(world, 30, 0);
    expect(world.time).toBeLessThanOrEqual(C.MAX_FRAME_TIME + C.FIXED_DT);
    expect(carry).toBeLessThan(C.FIXED_DT);
  });

  it("speeds up with time and then stops", () => {
    const world = createWorld(5);
    startRun(world);
    const early = world.speed;
    run(world, 300);
    expect(world.speed).toBeGreaterThan(early);
    for (let i = 0; i < 200_000; i++) step(world);
    expect(world.speed).toBeLessThanOrEqual(C.MAX_SPEED);
  });

  it("is reproducible from a seed", () => {
    const script: Input[] = ["left", "jump", "right", "slide", "jump"];
    const play = () => {
      const world = createWorld(4242);
      startRun(world);
      for (const input of script) {
        for (let i = 0; i < 40; i++) step(world);
        applyInput(world, input);
      }
      for (let i = 0; i < 400; i++) step(world);
      return { d: world.distance, score: world.score, status: world.status };
    };
    expect(play()).toEqual(play());
  });
});

describe("movement", () => {
  it("moves between lanes and stops at the edges", () => {
    const world = emptyWorld();
    expect(world.player.lane).toBe(1);
    applyInput(world, "left");
    expect(world.player.lane).toBe(0);
    applyInput(world, "left");
    expect(world.player.lane).toBe(0);
    applyInput(world, "right");
    applyInput(world, "right");
    expect(world.player.lane).toBe(2);
    applyInput(world, "right");
    expect(world.player.lane).toBe(2);
  });

  it("eases towards the lane rather than teleporting", () => {
    const world = emptyWorld();
    applyInput(world, "left");
    step(world);
    expect(world.player.x).toBeGreaterThan(C.LANE_X[0]);
    expect(world.player.x).toBeLessThan(C.LANE_X[1]);
  });

  it("comes back down from a jump", () => {
    const world = emptyWorld();
    applyInput(world, "jump");
    expect(world.player.posture).toBe("jump");
    let apex = 0;
    for (let i = 0; i < 400; i++) {
      step(world);
      apex = Math.max(apex, world.player.y);
      if (world.player.posture === "run") break;
    }
    expect(apex).toBeGreaterThan(C.BARRIER_HEIGHT);
    expect(world.player.posture).toBe("run");
    expect(world.player.y).toBe(0);
  });

  it("refuses a second jump in the air", () => {
    const world = emptyWorld();
    applyInput(world, "jump");
    step(world);
    const rising = world.player.vy;
    applyInput(world, "jump");
    expect(world.player.vy).toBeLessThanOrEqual(rising);
  });

  it("stands up again after a slide", () => {
    const world = emptyWorld();
    applyInput(world, "slide");
    expect(world.player.posture).toBe("slide");
    for (let i = 0; i < 400 && world.player.posture === "slide"; i++) step(world);
    expect(world.player.posture).toBe("run");
  });
});

describe("collision", () => {
  it("crashes into a barrier on the ground and clears it in a jump", () => {
    const crashed = emptyWorld();
    place(crashed, { kind: "obstacle", obstacle: "barrier", lane: 1, z: 20 });
    run(crashed, 40);
    expect(crashed.status).toBe("over");

    const jumped = emptyWorld();
    place(jumped, { kind: "obstacle", obstacle: "barrier", lane: 1, z: 20 });
    run(jumped, 18);
    applyInput(jumped, "jump");
    run(jumped, 22);
    expect(jumped.status).toBe("running");
  });

  it("will not save a jump left until the last moment", () => {
    // The window is generous but finite, and the test says where the edge is
    // rather than leaving it to be discovered. Jumping half a unit out, with
    // the collision box already entered, is too late.
    const world = emptyWorld();
    place(world, { kind: "obstacle", obstacle: "barrier", lane: 1, z: 20 });
    run(world, 19.5);
    applyInput(world, "jump");
    run(world, 2);
    expect(world.status).toBe("over");
  });

  it("crashes into an overhead upright and passes it sliding", () => {
    const upright = emptyWorld();
    place(upright, { kind: "obstacle", obstacle: "overhead", lane: 1, z: 20 });
    run(upright, 40);
    expect(upright.status).toBe("over");

    const sliding = emptyWorld();
    place(sliding, { kind: "obstacle", obstacle: "overhead", lane: 1, z: 20 });
    run(sliding, 18.6);
    applyInput(sliding, "slide");
    run(sliding, 3);
    expect(sliding.status).toBe("running");
  });

  it("cannot jump an overhead", () => {
    const world = emptyWorld();
    place(world, { kind: "obstacle", obstacle: "overhead", lane: 1, z: 20 });
    run(world, 18);
    applyInput(world, "jump");
    run(world, 22);
    expect(world.status).toBe("over");
  });

  it("cannot jump or slide a block, only go round it", () => {
    for (const escape of ["jump", "slide"] as const) {
      const world = emptyWorld();
      place(world, { kind: "obstacle", obstacle: "block", lane: 1, z: 20 });
      run(world, 18);
      applyInput(world, escape);
      run(world, 22);
      expect(world.status, `${escape} should not clear a block`).toBe("over");
    }

    const dodged = emptyWorld();
    place(dodged, { kind: "obstacle", obstacle: "block", lane: 1, z: 20 });
    applyInput(dodged, "left");
    run(dodged, 40);
    expect(dodged.status).toBe("running");
  });

  it("ignores an obstacle in another lane", () => {
    const world = emptyWorld();
    place(world, { kind: "obstacle", obstacle: "block", lane: 0, z: 20 });
    run(world, 40);
    expect(world.status).toBe("running");
  });
});

describe("collectibles", () => {
  it("counts coins and scores them", () => {
    const world = emptyWorld();
    place(world, { kind: "coin", lane: 1, z: 20 });
    run(world, 40);
    expect(world.coins).toBe(1);
    expect(world.score).toBeGreaterThanOrEqual(C.COIN_SCORE);
  });

  it("takes a coin once", () => {
    const world = emptyWorld();
    place(world, { kind: "coin", lane: 1, z: 20 });
    run(world, 40);
    const after = world.coins;
    run(world, 40);
    expect(world.coins).toBe(after);
  });

  it("spends a shield on the first hit and dies on the second", () => {
    const world = emptyWorld();
    place(world, { kind: "power", power: "shield", lane: 1, z: 15 });
    place(world, { kind: "obstacle", obstacle: "block", lane: 1, z: 40 });
    place(world, { kind: "obstacle", obstacle: "block", lane: 1, z: 70 });
    run(world, 50);
    expect(world.status).toBe("running");
    expect(world.shieldRemaining).toBe(0);
    run(world, 40);
    expect(world.status).toBe("over");
  });

  it("slows the world down while slow-motion lasts", () => {
    const world = emptyWorld();
    run(world, 30);
    const normal = world.speed;
    place(world, { kind: "power", power: "slow", lane: 1, z: world.distance + 10 });
    run(world, 20);
    expect(world.slowRemaining).toBeGreaterThan(0);
    expect(world.speed).toBeLessThan(normal);
  });

  it("reaches further for coins with a magnet", () => {
    const plain = emptyWorld();
    place(plain, { kind: "coin", lane: 0, z: 20 });
    run(plain, 40);
    expect(plain.coins).toBe(0);

    const magnetised = emptyWorld();
    magnetised.magnetRemaining = C.POWER_DURATION;
    place(magnetised, { kind: "coin", lane: 0, z: 20 });
    run(magnetised, 40);
    expect(magnetised.coins).toBe(1);
  });
});

describe("events", () => {
  it("reports what happened, once", () => {
    const world = emptyWorld();
    applyInput(world, "jump");
    place(world, { kind: "coin", lane: 1, z: 20 });
    run(world, 40);
    const events = drainEvents(world);
    expect(events).toContain("jump");
    expect(events).toContain("coin");
    expect(drainEvents(world)).toEqual([]);
  });

  it("reports a crash", () => {
    const world = emptyWorld();
    place(world, { kind: "obstacle", obstacle: "block", lane: 1, z: 20 });
    run(world, 40);
    expect(drainEvents(world)).toContain("crash");
  });
});

describe("housekeeping", () => {
  it("drops entities the player has left behind", () => {
    const world = emptyWorld();
    for (let i = 0; i < 50; i++) {
      place(world, { kind: "coin", lane: 0, z: i * 3 });
    }
    run(world, 300);
    expect(world.entities.length).toBeLessThan(50);
    for (const entity of world.entities) {
      expect(entity.z).toBeGreaterThanOrEqual(world.distance - C.DESPAWN_BEHIND);
    }
  });

  it("keeps the track stocked ahead of the player", () => {
    const world = createWorld(31);
    startRun(world);
    run(world, 600);
    const furthest = Math.max(...world.entities.map((e) => e.z));
    expect(furthest).toBeGreaterThan(world.distance + C.SPAWN_AHEAD / 2);
  });
});

describe("combo", () => {
  /** Places `count` coins in the player's lane, two units apart. */
  function coinRun(world: World, count: number): void {
    for (let i = 0; i < count; i++) {
      place(world, { kind: "coin", lane: 1, z: world.distance + 4 + i * 2 });
    }
    run(world, 4 + count * 2 + 2);
  }

  it("steps the multiplier every COMBO_PER_STEP links", () => {
    const world = emptyWorld();
    coinRun(world, C.COMBO_PER_STEP);
    expect(world.coins).toBe(C.COMBO_PER_STEP);
    expect(world.combo).toBe(C.COMBO_PER_STEP);
    expect(world.multiplier).toBe(2);
  });

  it("caps the multiplier", () => {
    const world = emptyWorld();
    coinRun(world, C.COMBO_PER_STEP * (C.MAX_MULTIPLIER + 4));
    expect(world.combo).toBeGreaterThan(C.COMBO_PER_STEP * C.MAX_MULTIPLIER);
    expect(world.multiplier).toBe(C.MAX_MULTIPLIER);
  });

  it("pays a coin at the multiplier it was taken with, not the final one", () => {
    const world = emptyWorld();
    // The first COMBO_PER_STEP coins are taken at x1 - the fourth is what
    // raises the multiplier, so it is itself still worth face value.
    coinRun(world, C.COMBO_PER_STEP + 1);
    expect(world.multiplier).toBe(2);
    const expected = C.COIN_SCORE * C.COMBO_PER_STEP + C.COIN_SCORE * 2;
    expect(world.bonus).toBe(expected);
  });

  it("drops the chain when nothing extends it in time, and says so", () => {
    const world = emptyWorld();
    coinRun(world, 2);
    expect(world.combo).toBe(2);
    drainEvents(world);

    const steps = Math.ceil(C.COMBO_WINDOW / C.FIXED_DT) + 2;
    for (let i = 0; i < steps; i++) step(world);

    expect(world.combo).toBe(0);
    expect(world.multiplier).toBe(1);
    expect(drainEvents(world)).toContain("combobreak");
  });

  it("drops the chain on a crash, without reporting it as a timeout", () => {
    const world = emptyWorld();
    coinRun(world, 2);
    drainEvents(world);

    place(world, { kind: "obstacle", obstacle: "block", lane: 1, z: world.distance + 4 });
    run(world, 10);

    expect(world.status).toBe("over");
    expect(world.combo).toBe(0);
    const events = drainEvents(world);
    expect(events).toContain("crash");
    expect(events).not.toContain("combobreak");
  });

  it("keeps the best chain after it is broken", () => {
    const world = emptyWorld();
    coinRun(world, 5);
    expect(world.bestCombo).toBe(5);
    const steps = Math.ceil(C.COMBO_WINDOW / C.FIXED_DT) + 2;
    for (let i = 0; i < steps; i++) step(world);
    expect(world.combo).toBe(0);
    expect(world.bestCombo).toBe(5);
  });
});

describe("near misses", () => {
  it("does not pay out for sitting safely in the next lane", () => {
    const world = emptyWorld();
    place(world, { kind: "obstacle", obstacle: "block", lane: 0, z: world.distance + 6 });
    run(world, 14);
    expect(world.status).toBe("running");
    expect(world.nearMisses).toBe(0);
  });

  it("pays out when the player is part way into the obstacle's lane", () => {
    const world = emptyWorld();
    // Mid lane change: inside the near-miss band, outside the one that hits.
    world.player.lane = 0;
    world.player.x = -0.6;
    place(world, { kind: "obstacle", obstacle: "block", lane: 0, z: world.distance + 0.2 });

    step(world);
    expect(world.status).toBe("running");
    expect(world.nearMisses).toBe(1);
    expect(world.combo).toBe(1);
  });

  it("counts one obstacle once, however many steps it is alongside for", () => {
    const world = emptyWorld();
    world.player.lane = 0;
    world.player.x = -0.6;
    place(world, { kind: "obstacle", obstacle: "block", lane: 0, z: world.distance + 0.2 });
    for (let i = 0; i < 40; i++) step(world);
    expect(world.nearMisses).toBe(1);
  });

  it("pays out for clearing a barrier by a hair", () => {
    const world = emptyWorld();
    world.player.posture = "jump";
    world.player.y = C.BARRIER_HEIGHT + 0.3;
    world.player.vy = 0;
    place(world, { kind: "obstacle", obstacle: "barrier", lane: 1, z: world.distance + 0.2 });

    step(world);
    expect(world.status).toBe("running");
    expect(world.nearMisses).toBe(1);
  });

  it("does not pay out for sailing over a barrier", () => {
    const world = emptyWorld();
    world.player.posture = "jump";
    world.player.y = C.BARRIER_HEIGHT + C.NEAR_MISS_CLEARANCE + 0.5;
    world.player.vy = 0;
    place(world, { kind: "obstacle", obstacle: "barrier", lane: 1, z: world.distance + 0.2 });

    step(world);
    expect(world.status).toBe("running");
    expect(world.nearMisses).toBe(0);
  });

  it("does not pay out for sliding under an overhead", () => {
    // The clearance while sliding is a constant, so counting it would pay
    // for every slide rather than for anything done well.
    const world = emptyWorld();
    applyInput(world, "slide");
    place(world, { kind: "obstacle", obstacle: "overhead", lane: 1, z: world.distance + 0.2 });

    step(world);
    expect(world.status).toBe("running");
    expect(world.nearMisses).toBe(0);
  });
});

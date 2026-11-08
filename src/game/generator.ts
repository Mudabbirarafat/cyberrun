import { DIFFICULTY_DISTANCE, LANE_COUNT } from "./constants";
import { chance, nextInt, pick, type Rng } from "./rng";
import type { Entity, ObstacleKind, PowerKind } from "./types";

/** 0 at the start of a run, 1 once it is as hard as it gets. */
export function difficulty(distance: number): number {
  return Math.min(1, Math.max(0, distance / DIFFICULTY_DISTANCE));
}

/** `block` fills a lane; the others are cleared by jumping or sliding. */
export function isPassable(kind: ObstacleKind | undefined): boolean {
  return kind !== "block";
}

const POWERS: readonly PowerKind[] = ["shield", "magnet", "slow"];

/**
 * One row of track at `z`.
 *
 * Two things have to hold, and the second is the one that is easy to miss.
 *
 * Survivable: some lane in the row can be got through. A row of three blocks
 * is a wall, and no amount of skill helps.
 *
 * Reachable: that lane is next to one the player could already be in. A row
 * can be survivable and still unfair, if the only gap is two lanes away and
 * the player is travelling too fast to cross. Rows are `ROW_SPACING` apart
 * and a lane change takes a fixed time, so one lane of movement per row is
 * the honest assumption.
 *
 * `reachable` is where the player could be coming into this row; the returned
 * `reachable` is where they can be coming out of it, and is never empty.
 */
export function generateRow(
  rng: Rng,
  z: number,
  distance: number,
  reachable: readonly number[],
  nextId: () => number,
): { entities: Entity[]; reachable: number[] } {
  const d = difficulty(distance);
  const entities: Entity[] = [];

  // Lanes adjacent to, or the same as, one the player could already hold.
  const candidates: number[] = [];
  for (const lane of reachable) {
    for (const delta of [-1, 0, 1]) {
      const candidate = lane + delta;
      if (candidate >= 0 && candidate < LANE_COUNT && !candidates.includes(candidate)) {
        candidates.push(candidate);
      }
    }
  }
  // Guaranteed non-empty: `reachable` is non-empty and delta 0 is allowed.
  const safeLane = pick(rng, candidates);

  // Obstacles never fill the row, and early on there is at most one.
  const allowed = d < 0.25 ? 1 : 2;
  let count = 0;
  if (chance(rng, 0.55 + d * 0.3)) count = 1;
  if (count === 1 && allowed === 2 && chance(rng, 0.15 + d * 0.55)) count = 2;

  const others = [0, 1, 2].filter((lane) => lane !== safeLane);
  // Fisher-Yates, so the pair chosen is not biased by lane order.
  for (let i = others.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    [others[i], others[j]] = [others[j]!, others[i]!];
  }

  for (let i = 0; i < count && i < others.length; i++) {
    entities.push({
      id: nextId(),
      kind: "obstacle",
      lane: others[i]!,
      z,
      obstacle: pickObstacle(rng, d),
      spent: false,
    });
  }

  // The safe lane can still ask for an action - jumping and sliding are the
  // game - but never for the one that cannot be answered.
  if (chance(rng, 0.25 + d * 0.4)) {
    entities.push({
      id: nextId(),
      kind: "obstacle",
      lane: safeLane,
      z,
      obstacle: chance(rng, 0.5) ? "barrier" : "overhead",
      spent: false,
    });
  }

  const blocked = new Set(
    entities.filter((e) => !isPassable(e.obstacle)).map((e) => e.lane),
  );
  const nextReachable = [0, 1, 2].filter(
    (lane) =>
      !blocked.has(lane) &&
      reachable.some((from) => Math.abs(lane - from) <= 1),
  );

  // Collectibles go where the player can actually follow them.
  const open = [0, 1, 2].filter((lane) => !blocked.has(lane));
  if (open.length > 0 && chance(rng, 0.65)) {
    const lane = pick(rng, open);
    const run = 1 + nextInt(rng, 3);
    for (let i = 0; i < run; i++) {
      entities.push({
        id: nextId(),
        kind: "coin",
        lane,
        z: z + i * 2.2,
        spent: false,
      });
    }
  }

  if (open.length > 0 && chance(rng, 0.05 + d * 0.03)) {
    entities.push({
      id: nextId(),
      kind: "power",
      lane: pick(rng, open),
      z: z + 1.1,
      power: pick(rng, POWERS),
      spent: false,
    });
  }

  return { entities, reachable: nextReachable };
}

function pickObstacle(rng: Rng, d: number): ObstacleKind {
  // Blocks force a lane change, so they get commoner once the player has had
  // a little practice at jumping and sliding.
  if (chance(rng, 0.15 + d * 0.3)) return "block";
  return chance(rng, 0.5) ? "barrier" : "overhead";
}

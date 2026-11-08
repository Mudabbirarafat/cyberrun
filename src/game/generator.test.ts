import { describe, expect, it } from "vitest";
import { difficulty, generateRow, isPassable } from "./generator";
import { createRng } from "./rng";
import { LANE_COUNT } from "./constants";

/**
 * The generator's job is not to be interesting, it is to never produce a run
 * that cannot be finished. These walk long tracks across many seeds, because
 * an impossible row is exactly the kind of thing that appears once in a
 * thousand and only ever for a player, never for the person who wrote it.
 */

const walk = (seed: number, rows: number) => {
  const rng = createRng(seed);
  let id = 0;
  const nextId = () => ++id;
  let reachable = [0, 1, 2];
  const history: { z: number; entities: ReturnType<typeof generateRow>["entities"]; reachable: number[] }[] = [];

  for (let i = 0; i < rows; i++) {
    const z = i * 9;
    const row = generateRow(rng, z, z, reachable, nextId);
    history.push({ z, entities: row.entities, reachable: row.reachable });
    reachable = row.reachable;
  }
  return history;
};

describe("generateRow", () => {
  it("never leaves the player with nowhere to go", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const row of walk(seed, 400)) {
        expect(
          row.reachable.length,
          `seed ${seed} produced an unreachable row at z=${row.z}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("never fills every lane with a wall", () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const row of walk(seed, 400)) {
        const blocked = row.entities.filter(
          (e) => e.kind === "obstacle" && !isPassable(e.obstacle),
        );
        const lanes = new Set(blocked.map((e) => e.lane));
        expect(lanes.size, `seed ${seed} walled z=${row.z}`).toBeLessThan(LANE_COUNT);
      }
    }
  });

  it("only offers lanes that are one step from the last ones", () => {
    for (let seed = 1; seed <= 30; seed++) {
      let previous = [0, 1, 2];
      const rng = createRng(seed);
      let id = 0;
      for (let i = 0; i < 300; i++) {
        const row = generateRow(rng, i * 9, i * 9, previous, () => ++id);
        for (const lane of row.reachable) {
          expect(
            previous.some((from) => Math.abs(lane - from) <= 1),
            `lane ${lane} at row ${i} is two lanes from anywhere reachable`,
          ).toBe(true);
        }
        previous = row.reachable;
      }
    }
  });

  it("puts collectibles only in lanes that are not walled", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const row of walk(seed, 200)) {
        const walled = new Set(
          row.entities
            .filter((e) => e.kind === "obstacle" && !isPassable(e.obstacle))
            .map((e) => e.lane),
        );
        for (const entity of row.entities) {
          if (entity.kind === "coin" || entity.kind === "power") {
            expect(walled.has(entity.lane)).toBe(false);
          }
        }
      }
    }
  });

  it("is reproducible from its seed", () => {
    const a = JSON.stringify(walk(12345, 120));
    const b = JSON.stringify(walk(12345, 120));
    expect(a).toEqual(b);
    expect(a).not.toEqual(JSON.stringify(walk(12346, 120)));
  });

  it("gets harder with distance, and stops", () => {
    expect(difficulty(0)).toBe(0);
    expect(difficulty(700)).toBeCloseTo(0.5, 5);
    expect(difficulty(1400)).toBe(1);
    expect(difficulty(99999)).toBe(1);
    expect(difficulty(-5)).toBe(0);
  });

  it("asks for more of the track later in a run", () => {
    const early = walk(7, 40).flatMap((r) => r.entities).filter((e) => e.kind === "obstacle");
    const late = walk(7, 400).slice(300).flatMap((r) => r.entities).filter((e) => e.kind === "obstacle");
    const earlyPerRow = early.length / 40;
    const latePerRow = late.length / 100;
    expect(latePerRow).toBeGreaterThan(earlyPerRow);
  });
});

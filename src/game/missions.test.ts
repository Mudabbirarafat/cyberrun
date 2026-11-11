import { describe, expect, it } from "vitest";
import {
  MISSIONS_PER_SET,
  applyRun,
  createMissions,
  describe as describeMission,
  type MissionState,
  type RunStats,
} from "./missions";

function stats(overrides: Partial<RunStats> = {}): RunStats {
  return {
    coins: 0,
    distance: 0,
    nearMisses: 0,
    bestCombo: 0,
    score: 0,
    powers: 0,
    ...overrides,
  };
}

/** Finishes a mission by brute force, however many runs that takes. */
function grind(state: MissionState, run: RunStats, limit = 200): MissionState {
  let current = state;
  for (let i = 0; i < limit; i++) {
    const outcome = applyRun(current, run);
    current = outcome.state;
    if (outcome.levelled) return current;
  }
  throw new Error("missions never completed");
}

/**
 * A mission to sit beside the one under test.
 *
 * Finishing every mission in a set replaces the set, so a single-mission
 * state disappears the moment it completes. This one never finishes, which
 * keeps the state alive to be asserted on.
 */
const UNREACHABLE = {
  id: "never",
  metric: "score",
  scope: "run",
  target: 99_999_999,
  progress: 0,
  done: false,
} as const;

describe("generating a set", () => {
  it("gives three distinct goals", () => {
    const { missions } = createMissions(1);
    expect(missions).toHaveLength(MISSIONS_PER_SET);
    expect(new Set(missions.map((m) => m.metric)).size).toBe(MISSIONS_PER_SET);
  });

  it("is a lookup, not a draw: the same level is always the same set", () => {
    expect(createMissions(4)).toEqual(createMissions(4));
    expect(createMissions(4).missions.map((m) => m.metric)).not.toEqual(
      createMissions(5).missions.map((m) => m.metric),
    );
  });

  it("asks for more as the levels go up", () => {
    // Compared per metric, because a later level is a different set and
    // comparing a coin target with a distance target would mean nothing.
    for (let level = 1; level < 12; level++) {
      for (const mission of createMissions(level).missions) {
        const later = createMissions(level + 4).missions.find(
          (m) => m.metric === mission.metric,
        );
        if (later) expect(later.target).toBeGreaterThan(mission.target);
      }
    }
  });

  it("rounds targets to something a person would say", () => {
    for (let level = 1; level < 20; level++) {
      for (const mission of createMissions(level).missions) {
        expect(mission.target).toBeGreaterThan(0);
        expect(Number.isInteger(mission.target)).toBe(true);
      }
    }
  });

  it("describes every mission it can generate", () => {
    for (let level = 1; level < 20; level++) {
      for (const mission of createMissions(level).missions) {
        const text = describeMission(mission);
        expect(text).not.toBe(mission.metric);
        expect(text.length).toBeGreaterThan(5);
      }
    }
  });
});

describe("folding in a run", () => {
  it("accumulates a total across runs", () => {
    let state = createMissions(1);
    const coins = state.missions.find((m) => m.scope === "total");
    if (!coins) return; // level 1 happens to be all per-run; nothing to assert

    const metric = coins.metric;
    const one = applyRun(state, stats({ coins: 5, nearMisses: 5, powers: 5 }));
    const two = applyRun(one.state, stats({ coins: 5, nearMisses: 5, powers: 5 }));
    const after = two.state.missions.find((m) => m.metric === metric)!;
    const first = one.state.missions.find((m) => m.metric === metric)!;
    expect(after.progress).toBeGreaterThan(first.progress);
  });

  it("keeps the best single run rather than adding them up", () => {
    const state: MissionState = {
      level: 1,
      missions: [
        {
          id: "x",
          metric: "distance",
          scope: "run",
          target: 1000,
          progress: 0,
          done: false,
        },
        { ...UNREACHABLE },
      ],
    };

    // Nine hundred metres, three times over, is not two thousand seven hundred.
    let current = state;
    for (let i = 0; i < 3; i++) current = applyRun(current, stats({ distance: 900 })).state;
    expect(current.missions[0]!.progress).toBe(900);
    expect(current.missions[0]!.done).toBe(false);

    current = applyRun(current, stats({ distance: 1000 })).state;
    expect(current.missions[0]!.done).toBe(true);
  });

  it("does not let a worse run undo a better one", () => {
    let state: MissionState = {
      level: 1,
      missions: [
        { id: "x", metric: "score", scope: "run", target: 5000, progress: 0, done: false },
        { id: "never", metric: "coins", scope: "total", target: 99_999_999, progress: 0, done: false },
      ],
    };
    state = applyRun(state, stats({ score: 3000 })).state;
    state = applyRun(state, stats({ score: 10 })).state;
    expect(state.missions[0]!.progress).toBe(3000);
  });

  it("never reports progress beyond the target", () => {
    let state: MissionState = {
      level: 1,
      missions: [
        { id: "x", metric: "coins", scope: "total", target: 10, progress: 0, done: false },
        { ...UNREACHABLE },
      ],
    };
    state = applyRun(state, stats({ coins: 999 })).state;
    expect(state.missions[0]!.progress).toBe(10);
  });

  it("reports what a run finished off", () => {
    const state: MissionState = {
      level: 1,
      missions: [
        { id: "a", metric: "coins", scope: "total", target: 5, progress: 0, done: false },
        { id: "b", metric: "score", scope: "run", target: 99_999, progress: 0, done: false },
      ],
    };
    const outcome = applyRun(state, stats({ coins: 5, score: 10 }));
    expect(outcome.completed.map((m) => m.id)).toEqual(["a"]);
    expect(outcome.levelled).toBe(false);
  });

  it("does not report a mission that was already finished", () => {
    let state: MissionState = {
      level: 1,
      missions: [
        { id: "a", metric: "coins", scope: "total", target: 5, progress: 0, done: false },
        { id: "b", metric: "score", scope: "run", target: 99_999, progress: 0, done: false },
      ],
    };
    state = applyRun(state, stats({ coins: 5 })).state;
    const again = applyRun(state, stats({ coins: 5 }));
    expect(again.completed).toEqual([]);
  });

  it("moves to the next set once all three are done", () => {
    const start = createMissions(1);
    const after = grind(start, stats({
      coins: 1000,
      distance: 100_000,
      nearMisses: 1000,
      bestCombo: 1000,
      score: 1_000_000,
      powers: 1000,
    }));
    expect(after.level).toBe(2);
    expect(after.missions.every((m) => !m.done)).toBe(true);
    expect(after.missions.every((m) => m.progress === 0)).toBe(true);
  });

  it("leaves the state it was given alone", () => {
    const state = createMissions(1);
    const snapshot = JSON.stringify(state);
    applyRun(state, stats({ coins: 50, distance: 5000, score: 9000, nearMisses: 50, bestCombo: 50, powers: 50 }));
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("counts a finished run for the runs mission however badly it went", () => {
    let state: MissionState = {
      level: 1,
      missions: [
        { id: "r", metric: "runs", scope: "total", target: 3, progress: 0, done: false },
        { ...UNREACHABLE },
      ],
    };
    for (let i = 0; i < 3; i++) state = applyRun(state, stats()).state;
    expect(state.missions[0]!.done).toBe(true);
  });
});

describe("the shape of a set", () => {
  it("always asks for something in a run, and something over time", () => {
    // Left to chance a set can come out as three totals, which is three
    // ways of saying "keep playing". Level 1 originally drew exactly that.
    for (let level = 1; level < 40; level++) {
      const scopes = createMissions(level).missions.map((m) => m.scope);
      expect(scopes).toContain("run");
      expect(scopes).toContain("total");
    }
  });
});

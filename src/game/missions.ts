/**
 * Three goals at a time, carried between runs.
 *
 * The important decision here is that missions are **not** part of the
 * simulation. `step()` runs 120 times a second and knows nothing about them;
 * missions are a pure function of (what you had, what that run came to),
 * applied once when a run ends. That keeps the hot loop untouched, and it
 * means the whole system can be tested by handing it numbers.
 *
 * A set is generated from its level number alone, so the missions you get at
 * level 4 are the missions everybody gets at level 4, and a test can assert
 * on them without pinning a snapshot of a random draw.
 */

import { createRng, nextInt } from "./rng";

export type MissionMetric =
  | "coins"
  | "distance"
  | "nearMisses"
  | "bestCombo"
  | "score"
  | "powers"
  | "runs";

/**
 * `run` means the best single run; `total` accumulates across all of them.
 *
 * The difference matters for what a goal asks of you. Collecting 200 coins
 * is patience; collecting 25 in one run is a good run.
 */
export type MissionScope = "run" | "total";

export interface Mission {
  id: string;
  metric: MissionMetric;
  scope: MissionScope;
  target: number;
  progress: number;
  done: boolean;
}

export interface MissionState {
  /** Rises by one each time all three are finished. */
  level: number;
  missions: Mission[];
}

/** What one run came to. Everything the metrics can be read from. */
export interface RunStats {
  coins: number;
  distance: number;
  nearMisses: number;
  bestCombo: number;
  score: number;
  powers: number;
}

interface Template {
  metric: MissionMetric;
  scope: MissionScope;
  base: number;
  step: number;
  /** Rounded to this, so a target is never "reach 1137m". */
  round: number;
  label: (target: number) => string;
}

/**
 * One template per metric, so a set of three never asks the same question
 * twice with different numbers.
 */
const TEMPLATES: readonly Template[] = [
  {
    metric: "coins",
    scope: "total",
    base: 60,
    step: 45,
    round: 5,
    label: (t) => `Collect ${t} coins`,
  },
  {
    metric: "distance",
    scope: "run",
    base: 900,
    step: 350,
    round: 50,
    label: (t) => `Reach ${t}m in one run`,
  },
  {
    metric: "nearMisses",
    scope: "total",
    base: 10,
    step: 8,
    round: 1,
    label: (t) => `Squeeze past ${t} obstacles`,
  },
  {
    metric: "bestCombo",
    scope: "run",
    base: 8,
    step: 4,
    round: 1,
    label: (t) => `Chain ${t} pickups without a break`,
  },
  {
    metric: "score",
    scope: "run",
    base: 1500,
    step: 800,
    round: 100,
    label: (t) => `Score ${t.toLocaleString()} in one run`,
  },
  {
    metric: "powers",
    scope: "total",
    base: 5,
    step: 4,
    round: 1,
    label: (t) => `Pick up ${t} power-ups`,
  },
  {
    metric: "runs",
    scope: "total",
    base: 5,
    step: 4,
    round: 1,
    label: (t) => `Finish ${t} runs`,
  },
];

export const MISSIONS_PER_SET = 3;

function targetFor(template: Template, level: number): number {
  const raw = template.base + template.step * (level - 1);
  return Math.max(template.round, Math.round(raw / template.round) * template.round);
}

export function describe(mission: Mission): string {
  const template = TEMPLATES.find((t) => t.metric === mission.metric);
  return template ? template.label(mission.target) : mission.metric;
}

/**
 * The three missions for a level.
 *
 * Seeded by the level, so this is a lookup rather than a draw: everyone sees
 * the same set at the same level, and a test can say what level 1 is.
 */
export function createMissions(level: number): MissionState {
  const rng = createRng(level * 7919);
  const pool = TEMPLATES.slice();
  const chosen: Template[] = [];

  const take = (from: Template[]): void => {
    if (from.length === 0) return;
    const template = from[nextInt(rng, from.length)]!;
    chosen.push(template);
    pool.splice(pool.indexOf(template), 1);
  };

  // One of each scope before anything else. Left to chance, a set can come
  // out as three totals - "collect 60 coins", "finish 5 runs", "pick up 5
  // power-ups" - which is three ways of saying "keep playing" and asks
  // nothing of the run. Level 1 drew exactly that.
  take(pool.filter((t) => t.scope === "run"));
  take(pool.filter((t) => t.scope === "total"));
  while (chosen.length < MISSIONS_PER_SET && pool.length > 0) take(pool);

  return {
    level,
    missions: chosen.map((template) => ({
      id: `${level}:${template.metric}`,
      metric: template.metric,
      scope: template.scope,
      target: targetFor(template, level),
      progress: 0,
      done: false,
    })),
  };
}

function statFor(metric: MissionMetric, stats: RunStats): number {
  switch (metric) {
    case "coins":
      return stats.coins;
    case "distance":
      return Math.floor(stats.distance);
    case "nearMisses":
      return stats.nearMisses;
    case "bestCombo":
      return stats.bestCombo;
    case "score":
      return stats.score;
    case "powers":
      return stats.powers;
    case "runs":
      // Finishing a run is the whole metric; nothing about the run matters.
      return 1;
  }
}

export interface MissionOutcome {
  state: MissionState;
  /** Missions this run finished off, in the order they are shown. */
  completed: Mission[];
  /** All three finished, so the state returned is already the next set. */
  levelled: boolean;
}

/**
 * Fold a finished run into the missions.
 *
 * Nothing is mutated: the caller holds the old state until this returns, so
 * a run that ends twice - a double event, a React strict-mode double call -
 * cannot count twice by accident.
 */
export function applyRun(state: MissionState, stats: RunStats): MissionOutcome {
  const completed: Mission[] = [];

  const missions = state.missions.map((mission) => {
    if (mission.done) return mission;

    const value = statFor(mission.metric, stats);
    // `run` keeps the best one rather than adding them up: "reach 900m in
    // one run" means one run, not nine runs of a hundred metres.
    const progress =
      mission.scope === "total"
        ? Math.min(mission.target, mission.progress + value)
        : Math.min(mission.target, Math.max(mission.progress, value));

    const done = progress >= mission.target;
    const next = { ...mission, progress, done };
    if (done) completed.push(next);
    return next;
  });

  const all = missions.every((mission) => mission.done);
  return {
    state: all ? createMissions(state.level + 1) : { level: state.level, missions },
    completed,
    levelled: all,
  };
}

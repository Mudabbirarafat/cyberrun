import { create } from "zustand";
import { HIGH_SCORE_KEY, MISSIONS_KEY } from "./game/constants";
import {
  MISSIONS_PER_SET,
  applyRun,
  createMissions,
  type Mission,
  type MissionState,
} from "./game/missions";
import type { GameEvent, Input, Status, World } from "./game/types";
import { advance, applyInput, createWorld, drainEvents, startRun } from "./game/world";

/**
 * The bridge between the simulation and React.
 *
 * The world itself is deliberately not in the store. It changes 120 times a
 * second, and putting it in React state would re-render the tree at that rate
 * to move three cubes. Instead the scene reads the world directly inside
 * `useFrame` and writes to meshes imperatively, and the store carries only
 * what a person actually looks at: the score, the coins, whether the run is
 * over. That updates tens of times a second, not thousands.
 */

let world: World = createWorld();
let carry = 0;

export function getWorld(): World {
  return world;
}

function readHighScore(): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const value = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. A high score is not worth a white screen.
    return 0;
  }
}

function writeHighScore(score: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // Same again: the run still counts, it just will not be remembered.
  }
}

/**
 * Missions, which are kept rather than recomputed.
 *
 * Whatever comes back out of storage was written by an older version of this
 * file as far as we know, so it is checked rather than trusted: a shape that
 * does not match starts again at level one. Losing progress is bad; a game
 * that will not load because a field was renamed is worse.
 */
function readMissions(): MissionState {
  try {
    const raw = localStorage.getItem(MISSIONS_KEY);
    if (raw === null) return createMissions(1);
    const parsed: unknown = JSON.parse(raw);
    if (!isMissionState(parsed)) return createMissions(1);
    return parsed;
  } catch {
    return createMissions(1);
  }
}

function isMissionState(value: unknown): value is MissionState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<MissionState>;
  if (typeof state.level !== "number" || !Number.isFinite(state.level) || state.level < 1) {
    return false;
  }
  if (!Array.isArray(state.missions) || state.missions.length !== MISSIONS_PER_SET) {
    return false;
  }
  return state.missions.every((mission: Partial<Mission>) =>
    typeof mission?.id === "string" &&
    typeof mission.metric === "string" &&
    (mission.scope === "run" || mission.scope === "total") &&
    typeof mission.target === "number" &&
    typeof mission.progress === "number" &&
    typeof mission.done === "boolean",
  );
}

function writeMissions(state: MissionState): void {
  try {
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(state));
  } catch {
    // Same as the high score: the run still counts, it is just not kept.
  }
}

export interface GameState {
  status: Status;
  score: number;
  coins: number;
  highScore: number;
  /** A fresh best, for the game-over screen to make something of. */
  beatBest: boolean;
  shield: boolean;
  magnet: boolean;
  slow: boolean;
  speed: number;
  /**
   * Steps rarely, so it belongs here. The seconds left on the chain do not:
   * they change every step, and the HUD reads them straight off the world
   * inside an animation frame rather than re-rendering React for a bar.
   */
  multiplier: number;
  nearMisses: number;
  bestCombo: number;
  missions: MissionState;
  /** What the run that just ended finished off, for the game-over panel. */
  completedMissions: Mission[];
  levelledUp: boolean;

  start: () => void;
  restart: () => void;
  send: (input: Input) => void;
  /** Advances the simulation and returns anything worth making a noise about. */
  tick: (frameTime: number) => GameEvent[];
}

export const useGame = create<GameState>((set, get) => ({
  status: "ready",
  score: 0,
  coins: 0,
  highScore: readHighScore(),
  beatBest: false,
  shield: false,
  magnet: false,
  slow: false,
  speed: 0,
  multiplier: 1,
  nearMisses: 0,
  bestCombo: 0,
  missions: readMissions(),
  completedMissions: [],
  levelledUp: false,

  start: () => {
    startRun(world);
    set({ status: world.status });
  },

  restart: () => {
    world = createWorld();
    carry = 0;
    startRun(world);
    set({
      status: world.status,
      score: 0,
      coins: 0,
      beatBest: false,
      shield: false,
      magnet: false,
      slow: false,
      speed: world.speed,
      multiplier: 1,
      nearMisses: 0,
      bestCombo: 0,
      // The missions themselves carry over; only the report of what the
      // last run did is cleared.
      completedMissions: [],
      levelledUp: false,
    });
  },

  send: (input) => {
    applyInput(world, input);
  },

  tick: (frameTime) => {
    carry = advance(world, frameTime, carry);
    const events = drainEvents(world);
    const previous = get();

    const shield = world.shieldRemaining > 0;
    const magnet = world.magnetRemaining > 0;
    const slow = world.slowRemaining > 0;

    if (
      previous.score !== world.score ||
      previous.coins !== world.coins ||
      previous.status !== world.status ||
      previous.shield !== shield ||
      previous.magnet !== magnet ||
      previous.slow !== slow ||
      previous.multiplier !== world.multiplier ||
      previous.nearMisses !== world.nearMisses ||
      previous.bestCombo !== world.bestCombo
    ) {
      const patch: Partial<GameState> = {
        status: world.status,
        score: world.score,
        coins: world.coins,
        shield,
        magnet,
        slow,
        speed: world.speed,
        multiplier: world.multiplier,
        nearMisses: world.nearMisses,
        bestCombo: world.bestCombo,
      };

      if (world.status === "over" && previous.status !== "over") {
        if (world.score > previous.highScore) {
          patch.highScore = world.score;
          patch.beatBest = true;
          writeHighScore(world.score);
        }

        // Missions are folded in once, here, rather than inside the step:
        // the simulation runs 120 times a second and has no business
        // knowing what a goal is.
        const outcome = applyRun(previous.missions, {
          coins: world.coins,
          distance: world.distance,
          nearMisses: world.nearMisses,
          bestCombo: world.bestCombo,
          score: world.score,
          powers: world.powersTaken,
        });
        patch.missions = outcome.state;
        patch.completedMissions = outcome.completed;
        patch.levelledUp = outcome.levelled;
        writeMissions(outcome.state);
      }

      set(patch);
    }

    return events;
  },
}));

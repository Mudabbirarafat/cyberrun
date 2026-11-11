export type Posture = "run" | "jump" | "slide";

export type Input = "left" | "right" | "jump" | "slide";

/**
 * - `barrier` is low: jump it.
 * - `overhead` hangs: slide under it.
 * - `block` fills the lane: go around.
 */
export type ObstacleKind = "barrier" | "overhead" | "block";

export type PowerKind = "shield" | "magnet" | "slow";

export type EntityKind = "obstacle" | "coin" | "power";

export interface Entity {
  id: number;
  kind: EntityKind;
  lane: number;
  z: number;
  obstacle?: ObstacleKind;
  power?: PowerKind;
  /** Collected or already survived; kept until it is recycled. */
  spent: boolean;
  /**
   * The player is past it. Near misses are judged once, on the way out,
   * because that is the only moment the whole pass is known.
   */
  passed: boolean;
}

export interface Player {
  lane: number;
  /** Lerped towards the lane's x, so a change reads as movement. */
  x: number;
  y: number;
  vy: number;
  posture: Posture;
  slideRemaining: number;
}

export type Status = "ready" | "running" | "over";

/** Emitted by a step for the view to turn into sound. */
export type GameEvent =
  | "jump"
  | "slide"
  | "lane"
  | "coin"
  | "power"
  | "shielded"
  | "nearmiss"
  /** The multiplier stepped up. */
  | "combostep"
  /** The chain ran out of time. A crash emits `crash`, not this. */
  | "combobreak"
  | "crash";

export interface World {
  seed: number;
  rngState: number;
  status: Status;
  /** Seconds of simulated time. */
  time: number;
  /** World units travelled. */
  distance: number;
  speed: number;
  score: number;
  coins: number;
  player: Player;
  entities: Entity[];
  nextEntityId: number;
  /** z of the next row to generate. */
  nextRowZ: number;
  /** Lanes a player could be in after the previous row, for reachability. */
  reachableLanes: number[];
  shieldRemaining: number;
  magnetRemaining: number;
  slowRemaining: number;
  /** Coins and near misses chained together, unbroken. */
  combo: number;
  /** Seconds left to extend the chain before it drops. */
  comboRemaining: number;
  /** Derived from `combo`, stored so the view does not recompute the rule. */
  multiplier: number;
  /** Points from coins and near misses, already multiplied when earned. */
  bonus: number;
  /** The longest chain this run, which outlives the chain itself. */
  bestCombo: number;
  nearMisses: number;
  /** Power-ups taken this run, for the missions to count. */
  powersTaken: number;
  events: GameEvent[];
}

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
  events: GameEvent[];
}

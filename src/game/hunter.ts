import * as C from "./constants";

/**
 * The thing behind you.
 *
 * It is one number - how many world units back it is - and a handful of rules
 * for moving that number. That is a deliberate choice and worth the paragraph:
 *
 * `generateRow` guarantees every row leaves a lane the player can actually
 * reach. A chaser that could occupy a lane, or cut across them, would break
 * that guarantee silently: the row would still be fair and the run would still
 * be unsurvivable. Keeping the hunter on a one-dimensional gap behind the
 * player means the fairness proof the generator already has is untouched.
 *
 * It also means the chase is a pure function of what the player did, so the
 * whole of it is tested here with no renderer, no canvas and no clock.
 *
 * The renderer draws it at `+gap` on the z axis, between the player and the
 * camera. That falls out of the geometry rather than being arranged: the
 * camera sits about ten units back, so a hunter twenty-six units behind is
 * behind the camera and simply not there, and one three units behind fills
 * the bottom of the frame. You never see it until it is a problem.
 */

export interface Hunter {
  /** World units behind the player. Caught at zero. */
  gap: number;
  /** The closest it ever got this run, for the game-over panel. */
  closest: number;
  /** How many times it lunged, likewise. */
  lunges: number;
  /** Whether the `hunted` warning has already fired at this approach. */
  alerted: boolean;
}

export function createHunter(): Hunter {
  return {
    gap: C.HUNTER_REST_GAP,
    closest: C.HUNTER_REST_GAP,
    lunges: 0,
    alerted: false,
  };
}

/**
 * Where it settles, given how far the run has gone.
 *
 * Linear, and clamped at both ends. A curve would be defensible but this is
 * a number a player has to feel rather than read, and the felt difference
 * between linear and eased here is nothing.
 */
export function restGap(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return C.HUNTER_REST_GAP;
  const t = Math.min(1, distance / C.HUNTER_CLOSE_IN_DISTANCE);
  return C.HUNTER_REST_GAP - t * (C.HUNTER_REST_GAP - C.HUNTER_MIN_REST_GAP);
}

export interface Drift {
  dt: number;
  distance: number;
  /** The `slow` power-up is running. */
  slowed: boolean;
}

/**
 * One step of drift, with no events and no judgement.
 *
 * Slowed, it closes. Otherwise it eases back towards the resting distance -
 * and only *towards* it: a hunter that has been pushed out past rest by a
 * good streak is pulled back in, so a lead has to keep being earned.
 */
export function drift(hunter: Hunter, { dt, distance, slowed }: Drift): void {
  if (slowed) {
    hunter.gap -= C.HUNTER_SLOW_CLOSE_RATE * dt;
  } else {
    const rest = restGap(distance);
    const travel = C.HUNTER_RECOVER_RATE * dt;
    const delta = rest - hunter.gap;
    hunter.gap += Math.abs(delta) <= travel ? delta : Math.sign(delta) * travel;
  }
  clamp(hunter);
}

/** It gains ground. Used for the mistakes that do not end the run outright. */
export function lunge(hunter: Hunter, amount: number): void {
  if (amount <= 0) return;
  hunter.gap -= amount;
  hunter.lunges += 1;
  clamp(hunter);
}

/** It loses ground. Coins and near misses buy daylight. */
export function push(hunter: Hunter, amount: number): void {
  if (amount <= 0) return;
  hunter.gap += amount;
  clamp(hunter);
}

export function isCaught(hunter: Hunter): boolean {
  return hunter.gap <= 0;
}

/**
 * Whether this step crossed into range and should announce itself.
 *
 * Latched, with hysteresis: a gap sitting on the threshold would otherwise
 * fire every few frames, which is a stutter in the vignette and a machine
 * gun in the speakers.
 */
export function takeAlert(hunter: Hunter): boolean {
  if (!hunter.alerted && hunter.gap < C.HUNTER_CLOSE_GAP) {
    hunter.alerted = true;
    return true;
  }
  if (hunter.alerted && hunter.gap > C.HUNTER_CLOSE_GAP + C.HUNTER_ALERT_HYSTERESIS) {
    hunter.alerted = false;
  }
  return false;
}

/**
 * How frightened to look, 0 to 1.
 *
 * The view's only input. Zero at the edge of close range, one at the moment
 * of being caught, and squared so the last couple of units - the ones that
 * matter - carry most of the change.
 */
export function menace(hunter: Hunter): number {
  if (hunter.gap >= C.HUNTER_CLOSE_GAP) return 0;
  if (hunter.gap <= 0) return 1;
  const linear = 1 - hunter.gap / C.HUNTER_CLOSE_GAP;
  return linear * linear;
}

function clamp(hunter: Hunter): void {
  if (hunter.gap > C.HUNTER_MAX_GAP) hunter.gap = C.HUNTER_MAX_GAP;
  if (hunter.gap < 0) hunter.gap = 0;
  if (hunter.gap < hunter.closest) hunter.closest = hunter.gap;
}

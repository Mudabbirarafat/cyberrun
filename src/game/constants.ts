// Every tunable in one place, in world units and seconds.
//
// The simulation runs on a fixed step (see `FIXED_DT`), so these are real
// quantities rather than per-frame nudges: changing a monitor from 60Hz to
// 144Hz must not change how high the player jumps.

/** x positions of the three lanes. */
export const LANE_X = [-2.4, 0, 2.4] as const;
export const LANE_COUNT = LANE_X.length;

/** Simulation step. 120Hz: small enough that a 16ms frame takes two steps. */
export const FIXED_DT = 1 / 120;

/** Guard against the spiral of death after a tab is backgrounded. */
export const MAX_FRAME_TIME = 0.25;

// Running
export const START_SPEED = 11;
export const MAX_SPEED = 30;
/** Units per second, per second. Reaches MAX_SPEED in a bit over two minutes. */
export const SPEED_RAMP = 0.16;

// Lane changes
export const LANE_CHANGE_SPEED = 13;

// Jumping
export const GRAVITY = -42;
export const JUMP_VELOCITY = 14;

// Sliding
export const SLIDE_DURATION = 0.55;

// Collision boxes, as half-extents around the centre.
export const PLAYER_HALF_WIDTH = 0.42;
export const PLAYER_HALF_DEPTH = 0.42;
export const PLAYER_RUN_HEIGHT = 1.7;
export const PLAYER_SLIDE_HEIGHT = 0.8;

export const OBSTACLE_HALF_WIDTH = 0.95;
export const OBSTACLE_HALF_DEPTH = 0.5;
/** A barrier you clear by jumping. */
export const BARRIER_HEIGHT = 0.9;
/** An overhead you pass by sliding: its underside. */
export const OVERHEAD_CLEARANCE = 1.15;

export const PICKUP_RADIUS = 0.9;

// Track generation
export const ROW_SPACING = 9;
/** How far ahead of the player rows exist. */
export const SPAWN_AHEAD = 150;
/** How far behind the player entities are kept before being recycled. */
export const DESPAWN_BEHIND = 18;

// Difficulty, as a function of distance travelled
export const DIFFICULTY_DISTANCE = 1400;

// Power-ups
export const POWER_DURATION = 7;
export const MAGNET_RADIUS = 5.5;
export const SLOW_FACTOR = 0.62;

// Scoring
export const COIN_SCORE = 10;
/** Score per world unit travelled. */
export const DISTANCE_SCORE = 1;

// Combo
//
// A flat 10 per coin gives you no reason to take a risk for one. The combo
// is what turns a coin from a trinket into a decision: it is worth more when
// you are already doing well, and a crash costs you the multiplier as well
// as the run.
/** Seconds of neither a coin nor a near miss before the chain is dropped. */
export const COMBO_WINDOW = 3.5;
/** Links per multiplier step. */
export const COMBO_PER_STEP = 4;
export const MAX_MULTIPLIER = 6;

// Near misses
//
// Rewarding the gap rather than the collision is what gives a lane change a
// reason to be late.
//
// The width sits between the box that kills you (1.37) and the next lane's
// centre (2.4), deliberately below the latter: sitting safely one lane over
// is not a near miss, and if it counted every obstacle you passed would pay
// out. You have to be part way into the lane, which means mid-change.
export const NEAR_MISS_HALF_WIDTH = OBSTACLE_HALF_WIDTH + PLAYER_HALF_WIDTH + 0.55;
/**
 * Clearing a barrier by less than this counts.
 *
 * Barriers only: a jump's height varies with when you pressed, so clearing
 * one narrowly is a thing you did. An overhead's clearance while sliding is
 * a constant, so rewarding it would just be paying you to slide.
 */
export const NEAR_MISS_CLEARANCE = 0.75;
export const NEAR_MISS_SCORE = 25;

// The hunter
//
// Something is behind you. It is not an obstacle and it never enters a lane:
// the generator promises every row leaves a lane you can reach, and a chaser
// that could stand in one would quietly break that promise. It lives on a
// single number instead - how far back it is - which keeps the guarantee
// intact and makes the whole thing testable without a screen.
//
// What it is for: a shielded crash used to be free. Now it costs you nine
// units of daylight, so the shield buys your life and not your comfort, and
// two mistakes close together are worse than two mistakes far apart. It also
// gives a good run something to earn - coins and near misses push it back -
// rather than only something to avoid.

/** How far back it settles when you are playing cleanly. Off camera. */
export const HUNTER_REST_GAP = 26;
/**
 * Where that resting distance ends up late in a run.
 *
 * This is the whole difficulty curve for the chase. Early on it sits far
 * enough back that one mistake is survivable; by the time the rest gap is
 * down to this, a shielded crash leaves barely two units, and the second
 * mistake is the one that ends it.
 */
export const HUNTER_MIN_REST_GAP = 11;
/** Distance over which the rest gap falls from REST to MIN. */
export const HUNTER_CLOSE_IN_DISTANCE = 3000;

/** Units per second it drifts back towards the resting distance. */
export const HUNTER_RECOVER_RATE = 2.2;
/**
 * While `slow` is active it gains instead of receding.
 *
 * Slowing the world down to pick a line is exactly when something chasing you
 * would close, and it gives that power-up a cost it did not have. 0.9/s over
 * the seven-second duration is about six units - enough to be a decision,
 * not enough to make the pickup a trap.
 */
export const HUNTER_SLOW_CLOSE_RATE = 0.9;

/** A crash you survived because of a shield. */
export const HUNTER_LUNGE_SHIELDED = 9;
/** The chain ran out. A small bite, not a disaster. */
export const HUNTER_LUNGE_COMBO_BREAK = 2.5;

export const HUNTER_PUSH_COIN = 0.35;
export const HUNTER_PUSH_NEAR_MISS = 1.6;

/** Inside this it is on camera, the HUD reddens, and `hunted` fires once. */
export const HUNTER_CLOSE_GAP = 9;
/**
 * It has to get this much further away before `hunted` can fire again.
 *
 * Without the hysteresis a gap hovering on the threshold emits the warning
 * every few frames, which is both a noise and a stutter in the vignette.
 */
export const HUNTER_ALERT_HYSTERESIS = 3;
/** Clamp, so a long clean run cannot bank an unlosable lead. */
export const HUNTER_MAX_GAP = 30;

export const HIGH_SCORE_KEY = "cyberrun.highScore";
/** The daily best, kept with its date so yesterday's does not look like today's. */
export const DAILY_KEY = "cyberrun.daily";
export const MISSIONS_KEY = "cyberrun.missions";
export const MUTED_KEY = "cyberrun.muted";

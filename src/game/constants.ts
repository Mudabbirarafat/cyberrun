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

export const HIGH_SCORE_KEY = "cyberrun.highScore";
export const MISSIONS_KEY = "cyberrun.missions";

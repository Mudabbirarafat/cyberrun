import { describe, expect, it } from "vitest";
import * as C from "./constants";
import {
  createHunter,
  drift,
  isCaught,
  lunge,
  menace,
  push,
  restGap,
  takeAlert,
  type Hunter,
} from "./hunter";

const step = (hunter: Hunter, seconds: number, distance = 0, slowed = false) => {
  // Real steps, not one big one: the drift clamps per step and a single
  // jumbo step would hide an overshoot that the fixed timestep cannot.
  const steps = Math.round(seconds / C.FIXED_DT);
  for (let i = 0; i < steps; i++) drift(hunter, { dt: C.FIXED_DT, distance, slowed });
};

describe("where it settles", () => {
  it("starts at the resting distance, which is off camera", () => {
    const hunter = createHunter();
    expect(hunter.gap).toBe(C.HUNTER_REST_GAP);
    // The camera sits about ten units back, so this is behind it. You should
    // not be able to see the thing before it has any reason to be there.
    expect(hunter.gap).toBeGreaterThan(C.HUNTER_CLOSE_GAP);
  });

  it("closes the resting distance as the run goes on", () => {
    expect(restGap(0)).toBe(C.HUNTER_REST_GAP);
    expect(restGap(C.HUNTER_CLOSE_IN_DISTANCE)).toBe(C.HUNTER_MIN_REST_GAP);
    const halfway = restGap(C.HUNTER_CLOSE_IN_DISTANCE / 2);
    expect(halfway).toBeLessThan(C.HUNTER_REST_GAP);
    expect(halfway).toBeGreaterThan(C.HUNTER_MIN_REST_GAP);
  });

  it("stops closing in rather than carrying on past the floor", () => {
    expect(restGap(C.HUNTER_CLOSE_IN_DISTANCE * 10)).toBe(C.HUNTER_MIN_REST_GAP);
  });

  it("survives a distance that is negative, zero or not a number", () => {
    for (const d of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(restGap(d)).toBeGreaterThanOrEqual(C.HUNTER_MIN_REST_GAP);
      expect(restGap(d)).toBeLessThanOrEqual(C.HUNTER_REST_GAP);
    }
  });
});

describe("drifting", () => {
  it("eases back towards rest after a lunge", () => {
    const hunter = createHunter();
    lunge(hunter, 10);
    const after = hunter.gap;
    step(hunter, 1);
    expect(hunter.gap).toBeGreaterThan(after);
    expect(hunter.gap).toBeCloseTo(after + C.HUNTER_RECOVER_RATE, 1);
  });

  it("does not overshoot rest", () => {
    const hunter = createHunter();
    lunge(hunter, 10);
    step(hunter, 60);
    expect(hunter.gap).toBeCloseTo(C.HUNTER_REST_GAP, 5);
  });

  it("pulls a lead back in, so daylight has to keep being earned", () => {
    const hunter = createHunter();
    push(hunter, 4);
    expect(hunter.gap).toBeGreaterThan(C.HUNTER_REST_GAP);
    step(hunter, 5);
    expect(hunter.gap).toBeCloseTo(C.HUNTER_REST_GAP, 5);
  });

  it("closes while the slow power-up is running", () => {
    const hunter = createHunter();
    const before = hunter.gap;
    step(hunter, C.POWER_DURATION, 0, true);
    expect(hunter.gap).toBeLessThan(before);
    expect(before - hunter.gap).toBeCloseTo(C.HUNTER_SLOW_CLOSE_RATE * C.POWER_DURATION, 1);
  });

  it("costs less over a full slow than a single shielded crash", () => {
    // Otherwise the power-up is a trap rather than a trade, and nobody
    // would ever pick it up twice.
    expect(C.HUNTER_SLOW_CLOSE_RATE * C.POWER_DURATION).toBeLessThan(
      C.HUNTER_LUNGE_SHIELDED,
    );
  });

  it("settles nearer the player late in a run than early", () => {
    const early = createHunter();
    const late = createHunter();
    lunge(early, 12);
    lunge(late, 12);
    step(early, 60, 0);
    step(late, 60, C.HUNTER_CLOSE_IN_DISTANCE);
    expect(late.gap).toBeLessThan(early.gap);
  });
});

describe("gaining and losing ground", () => {
  it("counts its lunges", () => {
    const hunter = createHunter();
    lunge(hunter, 3);
    lunge(hunter, 3);
    expect(hunter.lunges).toBe(2);
  });

  it("ignores a lunge or a push of zero or less", () => {
    const hunter = createHunter();
    const before = hunter.gap;
    lunge(hunter, 0);
    push(hunter, -5);
    expect(hunter.gap).toBe(before);
    expect(hunter.lunges).toBe(0);
  });

  it("cannot be pushed past the cap", () => {
    const hunter = createHunter();
    push(hunter, 500);
    expect(hunter.gap).toBe(C.HUNTER_MAX_GAP);
  });

  it("stops at zero rather than going negative", () => {
    const hunter = createHunter();
    lunge(hunter, 500);
    expect(hunter.gap).toBe(0);
    expect(isCaught(hunter)).toBe(true);
  });

  it("remembers the closest it ever got, even after recovering", () => {
    const hunter = createHunter();
    lunge(hunter, 20);
    const worst = hunter.gap;
    step(hunter, 60);
    expect(hunter.gap).toBeGreaterThan(worst);
    expect(hunter.closest).toBeCloseTo(worst, 5);
  });
});

describe("the warning", () => {
  it("fires once on the way in, not every step", () => {
    const hunter = createHunter();
    lunge(hunter, C.HUNTER_REST_GAP - C.HUNTER_CLOSE_GAP + 1);

    expect(takeAlert(hunter)).toBe(true);
    expect(takeAlert(hunter)).toBe(false);
    expect(takeAlert(hunter)).toBe(false);
  });

  it("does not fire while it is still far away", () => {
    expect(takeAlert(createHunter())).toBe(false);
  });

  it("re-arms only after it has backed well off", () => {
    const hunter = createHunter();
    lunge(hunter, C.HUNTER_REST_GAP - C.HUNTER_CLOSE_GAP + 1);
    expect(takeAlert(hunter)).toBe(true);

    // Just over the line is not enough: a gap hovering on the threshold
    // would otherwise fire the warning every few frames.
    hunter.gap = C.HUNTER_CLOSE_GAP + 1;
    expect(takeAlert(hunter)).toBe(false);
    hunter.gap = C.HUNTER_CLOSE_GAP - 1;
    expect(takeAlert(hunter)).toBe(false);

    hunter.gap = C.HUNTER_CLOSE_GAP + C.HUNTER_ALERT_HYSTERESIS + 1;
    expect(takeAlert(hunter)).toBe(false);
    hunter.gap = C.HUNTER_CLOSE_GAP - 1;
    expect(takeAlert(hunter)).toBe(true);
  });
});

describe("how frightened to look", () => {
  it("is nothing at all until it is in range", () => {
    const hunter = createHunter();
    expect(menace(hunter)).toBe(0);
    hunter.gap = C.HUNTER_CLOSE_GAP;
    expect(menace(hunter)).toBe(0);
  });

  it("is total at the moment of being caught", () => {
    const hunter = createHunter();
    hunter.gap = 0;
    expect(menace(hunter)).toBe(1);
  });

  it("rises faster the closer it gets", () => {
    // Squared on purpose: the last two units are the ones the player needs
    // to feel, and a linear ramp spends most of its range on the half of
    // the approach where nothing is really wrong yet.
    const hunter = createHunter();
    hunter.gap = C.HUNTER_CLOSE_GAP / 2;
    const half = menace(hunter);
    hunter.gap = C.HUNTER_CLOSE_GAP / 4;
    const quarter = menace(hunter);

    expect(half).toBeLessThan(0.3);
    expect(quarter - half).toBeGreaterThan(half - 0);
  });

  it("never leaves the 0 to 1 range", () => {
    const hunter = createHunter();
    for (const gap of [-5, 0, 1, 4, 9, 26, 500]) {
      hunter.gap = gap;
      expect(menace(hunter)).toBeGreaterThanOrEqual(0);
      expect(menace(hunter)).toBeLessThanOrEqual(1);
    }
  });
});

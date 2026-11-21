import { describe, expect, it } from "vitest";
import { dailySeed, dayKey, formatCountdown, msUntilNextDay } from "./daily";
import { createWorld } from "./world";

const utc = (iso: string) => new Date(iso);

describe("the day", () => {
  it("is the UTC date, not the local one", () => {
    expect(dayKey(utc("2026-11-21T00:00:00Z"))).toBe("2026-11-21");
    expect(dayKey(utc("2026-11-21T23:59:59Z"))).toBe("2026-11-21");
    expect(dayKey(utc("2026-11-22T00:00:00Z"))).toBe("2026-11-22");
  });

  it("pads the month and the day", () => {
    expect(dayKey(utc("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });

  it("rolls over at UTC midnight however late that is where you are", () => {
    // 05:29 in India on the 22nd is still the 21st in UTC, so two people in
    // different places comparing today's run are comparing the same track.
    // That is the whole reason this is UTC and not local.
    const indiaEarlyMorning = utc("2026-11-21T23:59:00Z");
    const californiaAfternoon = utc("2026-11-21T20:00:00Z");
    expect(dayKey(indiaEarlyMorning)).toBe(dayKey(californiaAfternoon));
  });
});

describe("the seed", () => {
  it("is the same all day", () => {
    const morning = dailySeed(utc("2026-11-21T00:00:01Z"));
    const night = dailySeed(utc("2026-11-21T23:59:59Z"));
    expect(morning).toBe(night);
  });

  it("changes from one day to the next", () => {
    expect(dailySeed(utc("2026-11-21T12:00:00Z"))).not.toBe(
      dailySeed(utc("2026-11-22T12:00:00Z")),
    );
  });

  it("is a usable uint32 and never zero", () => {
    // The rng rejects a zero state, and one day in four billion would hit it.
    for (let i = 0; i < 400; i++) {
      const seed = dailySeed(new Date(Date.UTC(2026, 0, 1 + i)));
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThan(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("spreads consecutive days apart rather than counting up", () => {
    // Adjacent dates differ by one character, so a weak hash would hand out
    // neighbouring seeds and the tracks would feel related.
    const seeds = Array.from({ length: 30 }, (_, i) =>
      dailySeed(new Date(Date.UTC(2026, 10, 1 + i))),
    );
    expect(new Set(seeds).size).toBe(30);
    const gaps = seeds.slice(1).map((s, i) => Math.abs(s - seeds[i]!));
    expect(Math.min(...gaps)).toBeGreaterThan(1000);
  });

  it("gives everybody the same track for that day", () => {
    // The point of the whole feature, asserted on the thing that actually
    // matters: not the seed, the track it produces.
    const seed = dailySeed(utc("2026-11-21T09:00:00Z"));
    const mine = createWorld(seed);
    const yours = createWorld(seed);

    const shape = (w: typeof mine) =>
      w.entities.map((e) => `${e.kind}:${e.obstacle ?? e.power ?? ""}:${e.lane}:${e.z}`);

    expect(shape(mine)).toEqual(shape(yours));
    expect(shape(mine).length).toBeGreaterThan(0);
  });

  it("gives a different track on a different day", () => {
    const today = createWorld(dailySeed(utc("2026-11-21T09:00:00Z")));
    const tomorrow = createWorld(dailySeed(utc("2026-11-22T09:00:00Z")));
    const shape = (w: typeof today) =>
      w.entities.map((e) => `${e.kind}:${e.lane}:${e.z}`).join("|");
    expect(shape(today)).not.toBe(shape(tomorrow));
  });
});

describe("the countdown", () => {
  it("counts to the next UTC midnight", () => {
    expect(msUntilNextDay(utc("2026-11-21T23:00:00Z"))).toBe(60 * 60 * 1000);
    expect(msUntilNextDay(utc("2026-11-21T00:00:00Z"))).toBe(24 * 60 * 60 * 1000);
  });

  it("crosses a month end without going negative", () => {
    expect(msUntilNextDay(utc("2026-11-30T23:30:00Z"))).toBe(30 * 60 * 1000);
    expect(msUntilNextDay(utc("2026-12-31T23:30:00Z"))).toBe(30 * 60 * 1000);
  });

  it("reads hours, then minutes, then seconds", () => {
    expect(formatCountdown(7 * 3600_000 + 12 * 60_000)).toBe("7h 12m");
    expect(formatCountdown(12 * 60_000 + 5000)).toBe("12m 5s");
    expect(formatCountdown(9000)).toBe("9s");
    expect(formatCountdown(0)).toBe("0s");
    expect(formatCountdown(-5000)).toBe("0s");
  });
});

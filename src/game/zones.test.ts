import { describe, expect, it } from "vitest";
import {
  ZONE_COUNT,
  ZONE_LENGTH,
  zoneAt,
  zoneIndexAt,
  zoneLabel,
  zoneProgress,
} from "./zones";

describe("where a zone starts and ends", () => {
  it("starts in the first zone", () => {
    expect(zoneIndexAt(0)).toBe(0);
    expect(zoneAt(0).name).toBe("Downtown");
  });

  it("changes exactly on the boundary, not a metre either side", () => {
    expect(zoneIndexAt(ZONE_LENGTH - 0.001)).toBe(0);
    expect(zoneIndexAt(ZONE_LENGTH)).toBe(1);
    expect(zoneIndexAt(ZONE_LENGTH * 2)).toBe(2);
  });

  it("counts up without wrapping, so zone 7 is zone 7", () => {
    // The *list* cycles; the number does not. Being told you are back in
    // zone 1 after five thousand metres would read as losing progress.
    const index = zoneIndexAt(ZONE_LENGTH * 7 + 10);
    expect(index).toBe(7);
    expect(zoneAt(ZONE_LENGTH * 7 + 10).index).toBe(7);
  });

  it("cycles the list once it runs out of zones", () => {
    const first = zoneAt(0);
    const lapped = zoneAt(ZONE_LENGTH * ZONE_COUNT);
    expect(lapped.name).toBe(first.name);
    expect(lapped.index).toBe(ZONE_COUNT);
    expect(lapped.index).not.toBe(first.index);
  });

  it("survives a distance that is negative, zero or not a number", () => {
    for (const d of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(zoneIndexAt(d)).toBeGreaterThanOrEqual(0);
      expect(zoneProgress(d)).toBeGreaterThanOrEqual(0);
      expect(zoneProgress(d)).toBeLessThanOrEqual(1);
    }
  });

  it("reports progress through the zone, not through the run", () => {
    expect(zoneProgress(0)).toBeCloseTo(0);
    expect(zoneProgress(ZONE_LENGTH / 2)).toBeCloseTo(0.5);
    expect(zoneProgress(ZONE_LENGTH * 3 + ZONE_LENGTH / 4)).toBeCloseTo(0.25);
  });
});

describe("what a zone asks for", () => {
  const sample = Array.from({ length: ZONE_COUNT * 3 }, (_, i) => zoneAt(i * ZONE_LENGTH));

  it("never asks for a multiplier that would switch something off entirely", () => {
    // A zone is a flavour, not a mode. Zero coins or zero obstacles would
    // be a different game for nine hundred metres.
    for (const zone of sample) {
      for (const key of ["density", "blocks", "coins", "powers"] as const) {
        expect(zone[key]).toBeGreaterThan(0.3);
        expect(zone[key]).toBeLessThan(2);
      }
    }
  });

  it("gives every zone a name and a palette", () => {
    for (const zone of sample) {
      expect(zone.name.length).toBeGreaterThan(2);
      expect(zone.rail).toMatch(/^#[0-9a-f]{6}$/i);
      expect(zone.fog).toMatch(/^#[0-9a-f]{6}$/i);
      expect(zone.hue).toBeGreaterThanOrEqual(0);
      expect(zone.hue).toBeLessThanOrEqual(1);
    }
  });

  it("makes the zones actually different from one another", () => {
    const shapes = Array.from({ length: ZONE_COUNT }, (_, i) =>
      JSON.stringify(
        (({ density, blocks, coins, powers, rail }) => ({ density, blocks, coins, powers, rail }))(
          zoneAt(i * ZONE_LENGTH),
        ),
      ),
    );
    expect(new Set(shapes).size).toBe(ZONE_COUNT);
  });

  it("labels a zone by its number and its name", () => {
    expect(zoneLabel(zoneAt(0))).toBe("Zone 1 · Downtown");
    expect(zoneLabel(zoneAt(ZONE_LENGTH))).toContain("Zone 2");
  });
});

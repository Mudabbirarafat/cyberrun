/**
 * The run is divided into zones, so that going further feels like going
 * somewhere rather than like the same corridor getting harder.
 *
 * A zone changes two things: what the generator reaches for, and what the
 * city looks like. It does **not** change the rules. The fairness guarantee
 * in `generateRow` - that every row leaves a lane you can actually reach -
 * holds whatever a zone asks for, because a zone only scales probabilities
 * and never decides where an obstacle goes.
 *
 * These are called zones rather than levels because `Level` is already the
 * missions counter and two different numbers both called "level" on the same
 * screen is a bug report waiting to happen.
 *
 * The list cycles. `difficulty()` keeps climbing with total distance
 * underneath it, so the second lap of the same five zones is harder than the
 * first; the zones supply variety, not the difficulty curve.
 */

export const ZONE_LENGTH = 900;

export interface Zone {
  /** Counts up for the whole run and never wraps: zone 7 is zone 7. */
  index: number;
  name: string;

  // Multipliers on the generator's own probabilities. 1 is "as before".
  /** A second obstacle in the same row. */
  density: number;
  /** An obstacle being a lane-filling block rather than one you can clear. */
  blocks: number;
  coins: number;
  powers: number;

  // Palette. Nothing in the simulation reads these; the renderer does.
  rail: string;
  fog: string;
  /** Hue for the skyline, 0-1 as `THREE.Color.setHSL` wants it. */
  hue: number;
}

/**
 * Five zones, cycled.
 *
 * Each one is a different question. Freight Yard is about lane changes,
 * Skyway is about jumping and sliding, Neon Mile is a breather that pays,
 * and Overdrive is all of it at once - which is what makes arriving there
 * mean something.
 */
const ZONES: readonly Omit<Zone, "index">[] = [
  {
    name: "Downtown",
    density: 1,
    blocks: 1,
    coins: 1,
    powers: 1,
    rail: "#8ffaff",
    fog: "#03040a",
    hue: 0.6,
  },
  {
    name: "Freight Yard",
    density: 1.1,
    blocks: 1.55,
    coins: 0.85,
    powers: 1,
    rail: "#ffb347",
    fog: "#0a0704",
    hue: 0.08,
  },
  {
    name: "Neon Mile",
    density: 0.85,
    blocks: 0.7,
    coins: 1.5,
    powers: 1.35,
    rail: "#ff5fd2",
    fog: "#0a0410",
    hue: 0.83,
  },
  {
    name: "Skyway",
    density: 1.2,
    blocks: 0.45,
    coins: 1,
    powers: 0.9,
    rail: "#9dff6b",
    fog: "#04090a",
    hue: 0.33,
  },
  {
    name: "Overdrive",
    density: 1.35,
    blocks: 1.25,
    coins: 1.15,
    powers: 0.75,
    rail: "#ff4d4d",
    fog: "#0b0305",
    hue: 0.98,
  },
];

export const ZONE_COUNT = ZONES.length;

/** Which zone a distance falls in. Counts up for the whole run. */
export function zoneIndexAt(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  return Math.floor(distance / ZONE_LENGTH);
}

export function zoneAt(distance: number): Zone {
  const index = zoneIndexAt(distance);
  // The modulo is what makes the list cycle; the index does not wrap, so
  // "Downtown" the second time round is still zone 5 and not zone 0.
  const shape = ZONES[index % ZONE_COUNT]!;
  return { ...shape, index };
}

/** How far into the current zone, 0 to 1. For the renderer's cross-fade. */
export function zoneProgress(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  return (distance % ZONE_LENGTH) / ZONE_LENGTH;
}

/** What the HUD announces: "Zone 6 · Freight Yard". */
export function zoneLabel(zone: Zone): string {
  return `Zone ${zone.index + 1} · ${zone.name}`;
}

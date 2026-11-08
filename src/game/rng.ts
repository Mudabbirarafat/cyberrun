// A seeded generator, so a run can be replayed.
//
// Math.random() would make the track unreproducible: a bug that only shows up
// on one layout could never be pinned down, and the generator's own
// guarantees could not be tested. mulberry32 is small, fast and good enough
// for picking lanes - it is not used for anything that needs real entropy.

export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  // Mixing the seed first, so that 1, 2, 3 produce unrelated streams rather
  // than three nearly identical ones.
  let h = seed >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return { state: (h ^ (h >>> 16)) >>> 0 };
}

/** The next float in [0, 1). Advances the stream. */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** An integer in [0, max). */
export function nextInt(rng: Rng, max: number): number {
  return Math.floor(next(rng) * max);
}

/** One element of `items`, which must not be empty. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[nextInt(rng, items.length)]!;
}

/** True with probability `chance`. */
export function chance(rng: Rng, probability: number): boolean {
  return next(rng) < probability;
}

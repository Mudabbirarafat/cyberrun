/**
 * One track a day, the same one for everybody.
 *
 * This costs almost nothing to build, which is the point: the simulation is
 * already a pure function of a seed and a list of inputs, so handing it a
 * seed derived from the date is the whole feature. Nothing else in the game
 * has to know it is happening - `createWorld(seed)` is the same call it
 * always was.
 *
 * It also has no server, which the rest of this project does not either. The
 * track is agreed by arithmetic rather than by anyone being told what it is.
 */

/**
 * The day, in UTC.
 *
 * UTC and not local time, deliberately. The alternative gives two people in
 * different time zones different tracks on the same date, which makes "did
 * you beat today's?" meaningless - and that question is the only reason this
 * exists. The cost is that the day turns over at an odd hour for most of the
 * world: half past five in the morning in India, late evening in California.
 * That is the better trade, but it is a trade.
 */
export function dayKey(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * A seed from that day, stable everywhere.
 *
 * FNV-1a, which is not a good hash for anything that matters and is an
 * excellent one for this: a handful of lines, no dependency, and identical
 * output on every machine that runs it. What it has to be is *reproducible*,
 * not unpredictable - if two browsers disagreed about today's seed they
 * would be playing different tracks and comparing scores anyway.
 */
export function dailySeed(now: Date = new Date()): number {
  const key = dayKey(now);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // The FNV prime, as shifts: a plain multiply overflows into a double and
    // stops being the same number on every machine, which is the one
    // property this function exists to have.
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  // The rng rejects a zero state, and one day in four billion would hit it.
  return hash === 0 ? 1 : hash;
}

/** Milliseconds until the next UTC midnight, for the countdown on the panel. */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(0, next - now.getTime());
}

/** "7h 12m", for the same countdown. Seconds only once it is nearly up. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

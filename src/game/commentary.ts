/**
 * Something to say when you crash.
 *
 * The game ships no audio files on purpose, so this is not a sound clip. The
 * line is chosen here and the browser's own speech synthesis reads it out,
 * which costs nothing to download, nothing to license, and is funnier than a
 * buzzer because the voice is doing its sincere best with material it does
 * not understand.
 *
 * Choosing is kept apart from speaking so the interesting half is a pure
 * function: given what a run came to, which line. The caller passes the roll
 * in rather than this reaching for `Math.random`, so a test can pin it.
 */

export interface RunReport {
  score: number;
  distance: number;
  coins: number;
  bestCombo: number;
  nearMisses: number;
  beatBest: boolean;
}

interface Bucket {
  /** Checked in order; the first that matches wins. */
  when: (report: RunReport) => boolean;
  lines: readonly string[];
}

/**
 * Ordered most specific first.
 *
 * Nothing here is about the player. The joke is always about the run, which
 * is the difference between a game that teases and a game that nags.
 */
const BUCKETS: readonly Bucket[] = [
  {
    when: (r) => r.beatBest,
    lines: [
      "New best. Quit while you're ahead.",
      "Personal record. Nobody saw it.",
      "That was your best one. Statistically, the next one is worse.",
      "A new high score. The bar was low.",
    ],
  },
  {
    when: (r) => r.distance < 60,
    lines: [
      "You lasted four seconds.",
      "Straight into it. Impressive commitment.",
      "That barely counts as a run.",
      "Did you mean to do that?",
    ],
  },
  {
    when: (r) => r.distance < 200,
    lines: [
      "Short and not at all sweet.",
      "The city will remember this briefly.",
      "We've all had worse. Not many of us, though.",
    ],
  },
  {
    when: (r) => r.bestCombo >= 12,
    lines: [
      "You had a chain going and you threw it away.",
      "All that work. One wall.",
      "The multiplier deserved better.",
    ],
  },
  {
    when: (r) => r.nearMisses >= 6,
    lines: [
      "Mostly luck, that one.",
      "You were asking for it the whole way.",
      "Six near misses and one hit. The hit is what counts.",
    ],
  },
  {
    when: (r) => r.distance >= 2000,
    lines: [
      "Genuinely good. Still dead.",
      "A long way to come for this ending.",
      "That was a real run. Shame about the last bit.",
    ],
  },
  {
    when: (r) => r.coins === 0,
    lines: [
      "Not a single coin. Bold strategy.",
      "You ran straight past all of it.",
    ],
  },
  {
    when: () => true,
    lines: [
      "Wiped out.",
      "The wall won.",
      "Again?",
      "That'll happen.",
      "Try the other lane next time.",
    ],
  },
];

/**
 * One line for this run.
 *
 * `roll` is a number in [0, 1). `avoid` is the previous line: with four or
 * five to a bucket, the same one twice running is common enough to notice,
 * and hearing it twice is what makes the joke stale rather than the joke
 * itself.
 */
export function commentate(report: RunReport, roll: number, avoid?: string): string {
  const bucket = BUCKETS.find((candidate) => candidate.when(report)) ?? BUCKETS[BUCKETS.length - 1]!;
  const lines = bucket.lines;

  const clamped = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  const index = Math.floor(clamped * lines.length);
  const chosen = lines[index] ?? lines[0]!;

  if (chosen !== avoid || lines.length === 1) return chosen;
  return lines[(index + 1) % lines.length]!;
}

/** Every line this can ever say, for a test to check them all. */
export function allLines(): readonly string[] {
  return BUCKETS.flatMap((bucket) => bucket.lines);
}

import { describe, expect, it } from "vitest";
import { allLines, commentate, type RunReport } from "./commentary";

function report(overrides: Partial<RunReport> = {}): RunReport {
  return {
    score: 500,
    distance: 500,
    coins: 5,
    bestCombo: 3,
    nearMisses: 1,
    beatBest: false,
    ...overrides,
  };
}

describe("choosing a line", () => {
  it("always says something", () => {
    for (let i = 0; i < 100; i++) {
      const line = commentate(report(), i / 100);
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("congratulates a best before it insults a short run", () => {
    // A four-second run that is still your best is a first run, and being
    // told it barely counts is the wrong note to open on.
    const line = commentate(report({ distance: 40, beatBest: true }), 0);
    expect(line.toLowerCase()).toContain("best");
  });

  it("has something specific for a run that ended immediately", () => {
    const line = commentate(report({ distance: 30, coins: 0 }), 0);
    expect(line).not.toBe("Wiped out.");
  });

  it("notices a long chain that was thrown away", () => {
    const line = commentate(report({ bestCombo: 20 }), 0);
    expect(line.toLowerCase()).toMatch(/chain|multiplier|work/);
  });

  it("notices a run that was all near misses", () => {
    const line = commentate(report({ nearMisses: 9 }), 0);
    expect(line.toLowerCase()).toMatch(/luck|asking|near miss/);
  });

  it("is kinder about a long run than a short one", () => {
    const long = commentate(report({ distance: 4000 }), 0);
    const short = commentate(report({ distance: 20 }), 0);
    expect(long).not.toBe(short);
    expect(long.toLowerCase()).toMatch(/good|real|long/);
  });

  it("does not repeat the line it was asked to avoid", () => {
    for (let i = 0; i < 50; i++) {
      const roll = i / 50;
      const first = commentate(report(), roll);
      const second = commentate(report(), roll, first);
      expect(second).not.toBe(first);
    }
  });

  it("survives a roll that is out of range or not a number", () => {
    for (const roll of [-1, 0, 1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(commentate(report(), roll).length).toBeGreaterThan(0);
    }
  });

  it("uses every line in a bucket as the roll sweeps", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(commentate(report(), i / 200));
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe("what it is allowed to say", () => {
  it("keeps every line short enough to finish before the panel is read", () => {
    // Speech synthesis reads at roughly fifteen characters a second, and the
    // panel is a button press away from being dismissed.
    for (const line of allLines()) expect(line.length).toBeLessThanOrEqual(70);
  });

  it("is about the run, never about the player", () => {
    // "You" doing a thing in the game is fine. These are the shapes that
    // stop being a joke about a game and start being a comment on a person.
    const personal = /\byou (are|were|'re)\s+(bad|terrible|awful|useless|rubbish|hopeless)/i;
    for (const line of allLines()) expect(line).not.toMatch(personal);
  });

  it("has no line that is only punctuation or whitespace", () => {
    for (const line of allLines()) expect(line.trim().replace(/[^\w]/g, "").length).toBeGreaterThan(2);
  });
});

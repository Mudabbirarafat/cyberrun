import { describe, expect, it } from "vitest";
import { distanceBar, shareText, type ShareResult } from "./share";

function result(overrides: Partial<ShareResult> = {}): ShareResult {
  return {
    score: 2340,
    distance: 1820,
    coins: 18,
    bestCombo: 4,
    nearMisses: 7,
    caught: false,
    ...overrides,
  };
}

describe("the bar", () => {
  it("is empty at the start and full at the top", () => {
    expect(distanceBar(0)).toBe("▱▱▱▱▱▱▱▱▱▱");
    expect(distanceBar(1500)).toBe("▰▰▰▰▰▰▰▰▰▰");
  });

  it("does not overflow past full", () => {
    expect(distanceBar(99_999)).toBe("▰▰▰▰▰▰▰▰▰▰");
    expect(distanceBar(99_999)).toHaveLength(10);
  });

  it("fills in proportion", () => {
    expect(distanceBar(750)).toBe("▰▰▰▰▰▱▱▱▱▱");
  });

  it("survives a distance that is negative or not a number", () => {
    for (const d of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(distanceBar(d)).toHaveLength(10);
    }
  });
});

describe("the share text", () => {
  it("names the day on a daily run", () => {
    const text = shareText(result({ day: "2026-11-21" }));
    expect(text.split("\n")[0]).toBe("CyberRun · daily 2026-11-21");
  });

  it("leaves the day out of an endless run", () => {
    const text = shareText(result());
    expect(text.split("\n")[0]).toBe("CyberRun");
    expect(text).not.toContain("daily");
  });

  it("says which way the run ended", () => {
    expect(shareText(result({ caught: true }))).toContain("caught at 1,820 m");
    expect(shareText(result({ caught: false }))).toContain("ran 1,820 m");
  });

  it("carries the numbers worth comparing", () => {
    const text = shareText(result());
    expect(text).toContain("2,340 pts");
    expect(text).toContain("18 coins");
    expect(text).toContain("chain x4");
    expect(text).toContain("7 near misses");
  });

  it("leaves near misses out when there were none", () => {
    // A line of zeroes is noise. Two people's results should differ at a
    // glance, which is the only reason to paste one at somebody.
    expect(shareText(result({ nearMisses: 0 }))).not.toContain("near misses");
  });

  it("ends with somewhere to go", () => {
    expect(shareText(result()).split("\n").at(-1)).toBe("cyberrun-tau.vercel.app");
  });

  it("holds no emoji, so it renders on anyone's phone", () => {
    // Block elements are safe; anything in the emoji planes is not.
    expect(shareText(result({ day: "2026-11-21", caught: true }))).not.toMatch(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u,
    );
  });

  it("stays short enough to paste anywhere", () => {
    const text = shareText(result({ day: "2026-11-21", caught: true }));
    expect(text.split("\n")).toHaveLength(5);
    expect(text.length).toBeLessThan(280);
  });

  it("does not report a distance it did not run", () => {
    expect(shareText(result({ distance: -40 }))).toContain("0 m");
  });
});

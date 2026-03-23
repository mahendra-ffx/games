import { describe, it, expect } from "vitest";
import {
  scoreBinarySortRound,
  buildBinarySortShareText,
  getBinarySortRank,
} from "@/lib/scoring";

describe("scoreBinarySortRound", () => {
  it("returns 100 for correct answer with full time remaining", () => {
    expect(
      scoreBinarySortRound({ correct: true, timeRemainingMs: 5000, timeLimitMs: 5000 })
    ).toBe(100);
  });

  it("returns 50 for correct answer with half time remaining", () => {
    expect(
      scoreBinarySortRound({ correct: true, timeRemainingMs: 2500, timeLimitMs: 5000 })
    ).toBe(50);
  });

  it("returns 0 for wrong answer regardless of time", () => {
    expect(
      scoreBinarySortRound({ correct: false, timeRemainingMs: 5000, timeLimitMs: 5000 })
    ).toBe(0);
  });

  it("returns 0 for timeout (0ms remaining)", () => {
    expect(
      scoreBinarySortRound({ correct: true, timeRemainingMs: 0, timeLimitMs: 5000 })
    ).toBe(0);
  });

  it("clamps negative time remaining to 0", () => {
    expect(
      scoreBinarySortRound({ correct: true, timeRemainingMs: -100, timeLimitMs: 5000 })
    ).toBe(0);
  });

  it("clamps score to 100 even if time remaining exceeds limit", () => {
    expect(
      scoreBinarySortRound({ correct: true, timeRemainingMs: 9999, timeLimitMs: 5000 })
    ).toBe(100);
  });
});

describe("getBinarySortRank", () => {
  it("gives top rank at 90%+", () => {
    expect(getBinarySortRank(1350, 1500)).toContain("Legend");
  });

  it("gives bottom rank at 0%", () => {
    expect(getBinarySortRank(0, 1500)).toContain("even from here");
  });

  it("handles zero maxScore without throwing", () => {
    expect(() => getBinarySortRank(0, 0)).not.toThrow();
  });

  it("gives glenloch rank between 20-40%", () => {
    const rank = getBinarySortRank(450, 1500); // 30%
    expect(rank).toContain("Glenloch");
  });
});

describe("buildBinarySortShareText", () => {
  it("includes score, date, and URL", () => {
    const text = buildBinarySortShareText({
      score: 750,
      maxScore: 1500,
      rounds: 15,
      correctCount: 10,
      shareGrid: "🟦🟥🟦🟦🟥\n🟦🟦🟥🟦🟦\n🟦🟥🟦🟦🟥",
      date: "2026-03-22",
    });
    expect(text).toContain("750");
    expect(text).toContain("1500");
    expect(text).toContain("2026-03-22");
    expect(text).toContain("games.canberratimes.com.au");
    expect(text).toContain("10/15");
  });
});

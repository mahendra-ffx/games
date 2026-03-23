import { describe, it, expect } from "vitest";
import { buildShareGrid } from "@/types/game";
import type { RoundResult } from "@/types/game";

function makeResult(override: Partial<RoundResult> = {}): RoundResult {
  return {
    item: "BRADDON",
    correctCategory: "NORTH",
    playerCategory: "NORTH",
    correct: true,
    timeMs: 2000,
    points: 60,
    ...override,
  };
}

describe("buildShareGrid", () => {
  it("returns blue squares for correct answers", () => {
    const results = [makeResult(), makeResult(), makeResult()];
    const grid = buildShareGrid(results);
    expect(grid).toContain("🟦");
    expect(grid).not.toContain("🟥");
  });

  it("returns red squares for wrong answers", () => {
    const results = [
      makeResult({ correct: false, playerCategory: "SOUTH" }),
    ];
    expect(buildShareGrid(results)).toContain("🟥");
  });

  it("returns black squares for timeouts", () => {
    const results = [makeResult({ correct: false, playerCategory: null })];
    expect(buildShareGrid(results)).toContain("⬛");
  });

  it("wraps into rows of 5", () => {
    const results = Array(10).fill(null).map(() => makeResult());
    const grid = buildShareGrid(results);
    const rows = grid.split("\n");
    expect(rows.length).toBe(2);
    // Each row has 5 emojis (each emoji is 2 chars in JS)
    expect([...rows[0]].filter((c) => c === "🟦" || c === "🟥" || c === "⬛").length).toBe(5);
  });

  it("handles 15 rounds (standard game) in 3 rows", () => {
    const results = Array(15).fill(null).map(() => makeResult());
    const rows = buildShareGrid(results).split("\n");
    expect(rows.length).toBe(3);
  });
});

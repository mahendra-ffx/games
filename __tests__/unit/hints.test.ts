import { describe, it, expect } from "vitest";
import { HINT_CONFIGS } from "@/lib/hints";

describe("HINT_CONFIGS", () => {
  it("defines hints for all 5 game types", () => {
    const expectedTypes = [
      "crossword",
      "landmark_hunt",
      "suburb_challenge",
      "binary_sort",
      "timeline_guess",
    ];
    for (const type of expectedTypes) {
      expect(HINT_CONFIGS).toHaveProperty(type);
      expect(HINT_CONFIGS[type as keyof typeof HINT_CONFIGS].length).toBeGreaterThan(0);
    }
  });

  it("crossword has a free tier-1 hint", () => {
    const t1 = HINT_CONFIGS.crossword.find((h) => h.tier === 1);
    expect(t1?.cost).toBe(0);
  });

  it("no hint costs more than 2 tokens", () => {
    for (const hints of Object.values(HINT_CONFIGS)) {
      for (const hint of hints) {
        expect(hint.cost).toBeLessThanOrEqual(2);
      }
    }
  });

  it("all hints have labels and descriptions", () => {
    for (const hints of Object.values(HINT_CONFIGS)) {
      for (const hint of hints) {
        expect(hint.label).toBeTruthy();
        expect(hint.description).toBeTruthy();
      }
    }
  });
});

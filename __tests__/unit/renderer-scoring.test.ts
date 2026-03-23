/**
 * Unit tests for W5-W9 renderer scoring logic (lib/scoring.ts)
 * and agent validation functions.
 */

import { describe, it, expect } from "vitest";
import {
  haversineKm,
  scoreLocationGuess,
  scoreTimelineYear,
} from "@/lib/scoring";
import {
  validateCrosswordDraft,
} from "@/agents/crossword-agent";
import {
  validateFlashbackDraft,
} from "@/agents/flashback-agent";

// ── haversineKm ───────────────────────────────────────────────────────────────

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(-35.28, 149.13, -35.28, 149.13)).toBe(0);
  });

  it("returns ~straight-line km between Parliament House and Telstra Tower", () => {
    // Parliament House: -35.3082, 149.1244
    // Telstra Tower: -35.2758, 149.0977
    const dist = haversineKm(-35.3082, 149.1244, -35.2758, 149.0977);
    // Roughly 4km apart
    expect(dist).toBeGreaterThan(3);
    expect(dist).toBeLessThan(5);
  });

  it("is symmetric (A→B = B→A)", () => {
    const d1 = haversineKm(-35.28, 149.13, -35.31, 149.14);
    const d2 = haversineKm(-35.31, 149.14, -35.28, 149.13);
    expect(d1).toBeCloseTo(d2, 8);
  });

  it("returns a positive value for non-zero distance", () => {
    expect(haversineKm(-35.28, 149.13, -35.31, 149.16)).toBeGreaterThan(0);
  });
});

// ── scoreLocationGuess ────────────────────────────────────────────────────────

describe("scoreLocationGuess", () => {
  it("returns max points plus time bonus for exact location with full time", () => {
    const score = scoreLocationGuess(0, 8000, 8000);
    // distanceScore = 1000/(1+0) = 1000; timeBonus = 1.2 → 1200
    expect(score).toBe(1200);
  });

  it("returns 1000 pts for exact location with no time remaining", () => {
    const score = scoreLocationGuess(0, 0, 8000);
    // distanceScore = 1000; timeRatio = 0 → 1.0 multiplier
    expect(score).toBe(1000);
  });

  it("halves at DISTANCE_HALF_KM (3km) with no time remaining", () => {
    const score = scoreLocationGuess(3, 0, 8000);
    // 1000 / (1 + 3/3) = 1000/2 = 500
    expect(score).toBe(500);
  });

  it("returns lower score for larger distance", () => {
    const close = scoreLocationGuess(0.5, 0, 8000);
    const far = scoreLocationGuess(10, 0, 8000);
    expect(close).toBeGreaterThan(far);
  });

  it("time bonus is additive up to 20%", () => {
    const noTime = scoreLocationGuess(3, 0, 8000);     // 500
    const fullTime = scoreLocationGuess(3, 8000, 8000); // 600
    expect(fullTime).toBeGreaterThan(noTime);
    expect(fullTime).toBeCloseTo(noTime * 1.2, 0);
  });

  it("does not return negative scores", () => {
    expect(scoreLocationGuess(1000, 0, 8000)).toBeGreaterThanOrEqual(0);
  });

  it("handles timeLimitMs = 0 without throwing", () => {
    expect(() => scoreLocationGuess(1, 0, 0)).not.toThrow();
  });
});

// ── scoreTimelineYear ─────────────────────────────────────────────────────────

describe("scoreTimelineYear", () => {
  it("returns 100 for exact year", () => {
    expect(scoreTimelineYear(1994, 1994)).toBe(100);
  });

  it("returns 90 for 1 year off", () => {
    expect(scoreTimelineYear(1993, 1994)).toBe(90);
    expect(scoreTimelineYear(1995, 1994)).toBe(90);
  });

  it("returns 80 for 2 years off", () => {
    expect(scoreTimelineYear(1992, 1994)).toBe(80);
  });

  it("returns 70 for 5 years off", () => {
    expect(scoreTimelineYear(1989, 1994)).toBe(70);
  });

  it("returns 50 for 10 years off", () => {
    expect(scoreTimelineYear(1984, 1994)).toBe(50);
  });

  it("returns 30 for 15 years off (within 20-year bracket)", () => {
    expect(scoreTimelineYear(1979, 1994)).toBe(30);
  });

  it("returns 5 for 30 years off", () => {
    expect(scoreTimelineYear(1964, 1994)).toBe(5);
  });

  it("returns 0 for 31+ years off", () => {
    expect(scoreTimelineYear(1960, 1994)).toBe(0);
  });

  it("is symmetric (over vs under)", () => {
    expect(scoreTimelineYear(1984, 1994)).toBe(scoreTimelineYear(2004, 1994));
  });

  it("returns non-negative for extreme guesses", () => {
    expect(scoreTimelineYear(1900, 2020)).toBeGreaterThanOrEqual(0);
  });
});

// ── validateCrosswordDraft ────────────────────────────────────────────────────

describe("validateCrosswordDraft", () => {
  const validDraft = {
    date: "2026-03-22",
    size: 5,
    solution: Array(25).fill("A"),
    clues: {
      across: { "1": "A clue" },
      down: { "1": "Another clue" },
    },
  };

  it("accepts a valid draft without throwing", () => {
    expect(() => validateCrosswordDraft(validDraft)).not.toThrow();
  });

  it("throws on invalid date format", () => {
    expect(() =>
      validateCrosswordDraft({ ...validDraft, date: "22-03-2026" })
    ).toThrow("Invalid date format");
  });

  it("throws when size is not 5", () => {
    expect(() =>
      validateCrosswordDraft({ ...validDraft, size: 7 })
    ).toThrow("5×5");
  });

  it("throws when solution has fewer than 25 elements", () => {
    expect(() =>
      validateCrosswordDraft({ ...validDraft, solution: Array(24).fill("A") })
    ).toThrow("25-element");
  });

  it("throws when solution has more than 25 elements", () => {
    expect(() =>
      validateCrosswordDraft({ ...validDraft, solution: Array(26).fill("A") })
    ).toThrow("25-element");
  });

  it("throws when across clues are empty", () => {
    expect(() =>
      validateCrosswordDraft({
        ...validDraft,
        clues: { across: {}, down: { "1": "clue" } },
      })
    ).toThrow("Across clues");
  });

  it("throws when down clues are empty", () => {
    expect(() =>
      validateCrosswordDraft({
        ...validDraft,
        clues: { across: { "1": "clue" }, down: {} },
      })
    ).toThrow("Down clues");
  });
});

// ── validateFlashbackDraft ────────────────────────────────────────────────────

describe("validateFlashbackDraft", () => {
  const validPhoto = {
    image: "cdn/photo.jpg",
    year: 1994,
    credit: "Canberra Times",
    desc: "A historic moment",
    hint_decade: "1990s",
    hint_context: "Grand Final",
  };

  const validDraft = {
    date: "2026-03-22",
    title: "Flashback Friday",
    year_range: [1920, 2020] as [number, number],
    photos: [validPhoto],
  };

  it("accepts a valid draft without throwing", () => {
    expect(() => validateFlashbackDraft(validDraft)).not.toThrow();
  });

  it("accepts 9 photos (max allowed)", () => {
    const ninePhotos = Array(9).fill(validPhoto);
    expect(() =>
      validateFlashbackDraft({ ...validDraft, photos: ninePhotos })
    ).not.toThrow();
  });

  it("throws when photos array is empty", () => {
    expect(() =>
      validateFlashbackDraft({ ...validDraft, photos: [] })
    ).toThrow();
  });

  it("throws when photos exceed 9", () => {
    const tenPhotos = Array(10).fill(validPhoto);
    expect(() =>
      validateFlashbackDraft({ ...validDraft, photos: tenPhotos })
    ).toThrow();
  });

  it("throws when a photo is missing image", () => {
    expect(() =>
      validateFlashbackDraft({
        ...validDraft,
        photos: [{ ...validPhoto, image: "" }],
      })
    ).toThrow();
  });

  it("throws when year is below 1900", () => {
    expect(() =>
      validateFlashbackDraft({
        ...validDraft,
        photos: [{ ...validPhoto, year: 1899 }],
      })
    ).toThrow("Invalid year");
  });

  it("throws when year is in the future", () => {
    const futureYear = new Date().getFullYear() + 1;
    expect(() =>
      validateFlashbackDraft({
        ...validDraft,
        photos: [{ ...validPhoto, year: futureYear }],
      })
    ).toThrow("Invalid year");
  });

  it("accepts current year as valid", () => {
    const currentYear = new Date().getFullYear();
    expect(() =>
      validateFlashbackDraft({
        ...validDraft,
        photos: [{ ...validPhoto, year: currentYear }],
      })
    ).not.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStreak, updateStreak, getTodayAEDT, getHintBalance, spendHintToken } from "@/lib/storage";

describe("getTodayAEDT", () => {
  it("returns a YYYY-MM-DD string", () => {
    const today = getTodayAEDT();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("streak management", () => {
  const gameType = "binary_sort";

  it("returns default streak for new game type", async () => {
    const streak = await getStreak(gameType);
    expect(streak).toEqual({ current: 0, longest: 0, lastPlayedDate: "" });
  });

  it("starts a streak on first play", async () => {
    const streak = await updateStreak(gameType, "2026-03-22");
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(1);
    expect(streak.lastPlayedDate).toBe("2026-03-22");
  });

  it("does not increment streak when already played today", async () => {
    await updateStreak(gameType, "2026-03-22");
    const streak = await updateStreak(gameType, "2026-03-22");
    expect(streak.current).toBe(1);
  });

  it("increments streak on consecutive days", async () => {
    await updateStreak(gameType, "2026-03-22");
    const streak = await updateStreak(gameType, "2026-03-23");
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(2);
  });

  it("resets streak after a missed day", async () => {
    await updateStreak(gameType, "2026-03-20");
    const streak = await updateStreak(gameType, "2026-03-22"); // skipped 21
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(1);
  });
});

describe("hint token system", () => {
  it("returns 5 tokens for premium tier", async () => {
    const balance = await getHintBalance("premium", "2026-03-22");
    expect(balance).toBe(5);
  });

  it("returns 3 tokens for anonymous tier", async () => {
    const balance = await getHintBalance("anonymous", "2026-03-22");
    expect(balance).toBe(3);
  });

  it("decrements on spend", async () => {
    await getHintBalance("premium", "2026-03-22"); // initialise
    const result = await spendHintToken(1);
    expect(result).toBe(true);
    const remaining = await getHintBalance("premium", "2026-03-22");
    expect(remaining).toBe(4);
  });

  it("rejects spend when balance insufficient", async () => {
    await getHintBalance("anonymous", "2026-03-22");
    // Drain all 3 tokens
    await spendHintToken(1);
    await spendHintToken(1);
    await spendHintToken(1);
    const result = await spendHintToken(1);
    expect(result).toBe(false);
  });
});

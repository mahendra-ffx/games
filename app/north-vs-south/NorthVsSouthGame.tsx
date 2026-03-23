"use client";

/**
 * NorthVsSouthGame — full-bleed map experience.
 *
 * Deliberately bypasses GameShell so the map can fill the entire
 * <main> area (full width, full remaining viewport height), matching
 * the original prototype where the map IS the page.
 *
 * Handles:
 * - Completion state + score persistence
 * - Analytics: game_complete, streak_milestone
 * - Score submission to /api/score
 */

import { useState, useCallback } from "react";
import { BinarySortRenderer } from "@/components/renderers/BinarySortRenderer";
import { saveProgress, updateStreak, getTodayAEDT } from "@/lib/storage";
import { trackGameComplete, trackStreakMilestone } from "@/lib/analytics";
import { buildShareGrid } from "@/types/game";
import { buildBinarySortShareText } from "@/lib/scoring";
import type { BinarySortConfig, RoundResult } from "@/types/game";

interface NorthVsSouthGameProps {
  config: BinarySortConfig;
}

export function NorthVsSouthGame({ config }: NorthVsSouthGameProps) {
  const [, setCompleted] = useState(false);
  const [, setFinalScore] = useState(0);

  const handleComplete = useCallback(
    async (results: RoundResult[], totalScore: number) => {
      const today = getTodayAEDT();
      const maxScore = config.items.length * 1000;
      const correctCount = results.filter((r) => r.correct).length;

      setCompleted(true);
      setFinalScore(totalScore);

      const grid = buildShareGrid(results);
      const text = buildBinarySortShareText({
        score: totalScore,
        maxScore,
        rounds: results.length,
        correctCount,
        shareGrid: grid,
        date: config.date,
      });
      void text; // share is handled inside BinarySortRenderer completion screen

      // Persist progress
      await saveProgress({
        gameType: "binary_sort",
        date: today,
        state: { results, totalScore },
        completed: true,
        score: totalScore,
      });

      // Update streak
      const streak = await updateStreak("binary_sort", today);

      // Analytics
      trackGameComplete({
        gameType: "binary_sort",
        score: totalScore,
        timeSpent: results.reduce((acc, r) => acc + r.timeMs, 0),
        attempts: results.length,
        streakLength: streak.current,
      });

      if ([7, 30, 100].includes(streak.current)) {
        trackStreakMilestone({ streakLength: streak.current, gameType: "binary_sort" });
      }

      // Submit score to server (non-blocking)
      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "binary_sort",
          gameId: config.date,
          date: config.date,
          score: totalScore,
          timeSpent: results.reduce((acc, r) => acc + r.timeMs, 0),
          completed: true,
        }),
      }).catch(() => null);
    },
    [config]
  );

  // Full-bleed: fills all of <main> (flex-1 flex flex-col set on <main> in layout.tsx)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <BinarySortRenderer config={config} onComplete={handleComplete} />
    </div>
  );
}

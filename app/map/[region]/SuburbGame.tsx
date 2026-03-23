"use client";

import { useCallback } from "react";
import { SuburbChallengeRenderer } from "@/components/renderers/SuburbChallengeRenderer";
import { trackGameComplete } from "@/lib/analytics";
import { saveProgress, getTodayAEDT } from "@/lib/storage";
import type { SuburbChallengeConfig } from "@/types/game";
import type { SuburbResult } from "@/components/renderers/SuburbChallengeRenderer";

interface SuburbGameProps {
  config: SuburbChallengeConfig;
}

export function SuburbGame({ config }: SuburbGameProps) {
  const gameId = `suburb_challenge_${config.region}`;

  const handleComplete = useCallback(
    async (score: number, results: SuburbResult[]) => {
      await saveProgress({
        gameType: "suburb_challenge",
        date: getTodayAEDT(),
        state: { region: config.region },
        completed: true,
        score,
      });

      const correctCount = results.filter((r) => r.correct).length;
      trackGameComplete({
        gameType: "suburb_challenge",
        gameId,
        score,
        timeSpent: 0,
        attempts: results.length,
        streakLength: 0,
      });

      // POST to score API
      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "suburb_challenge",
          gameId,
          score,
          meta: { region: config.region, correct: correctCount, total: results.length },
        }),
      }).catch(() => null);
    },
    [gameId, config.region]
  );

  // Full-bleed: fills all of <main> (flex-1 flex flex-col set on <main> in layout.tsx)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <SuburbChallengeRenderer config={config} onComplete={handleComplete} />
    </div>
  );
}

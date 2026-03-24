"use client";

import { useCallback } from "react";
import { LocationGuessRenderer } from "@/components/renderers/LocationGuessRenderer";
import { trackGameComplete } from "@/lib/analytics";
import { saveProgress, getTodayAEDT } from "@/lib/storage";
import type { LandmarkHuntConfig } from "@/types/game";
import type { LandmarkResult } from "@/components/renderers/LocationGuessRenderer";

export function LandmarkGame({ config }: { config: LandmarkHuntConfig }) {
  const gameId = `landmark_hunt_${config.date}`;

  const handleComplete = useCallback(
    async (score: number, results: LandmarkResult[]) => {
      await saveProgress({
        gameType: "landmark_hunt",
        date: getTodayAEDT(),
        state: {},
        completed: true,
        score,
      });

      trackGameComplete({
        gameType: "landmark_hunt",
        gameId,
        score,
        timeSpent: results.reduce((s, r) => s + r.timeUsedMs, 0),
        attempts: results.length,
        streakLength: 0,
      });

      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "landmark_hunt", gameId, score }),
      }).catch(() => null);
    },
    [gameId]
  );

  // Full-bleed: fills all of <main> (flex-1 flex flex-col set on <main> in layout.tsx)
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <LocationGuessRenderer config={config} onComplete={handleComplete} />
    </div>
  );
}

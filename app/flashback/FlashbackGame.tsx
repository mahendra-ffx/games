"use client";

import { useCallback } from "react";
import { GameShell } from "@/components/GameShell";
import { TimelineGuessRenderer } from "@/components/renderers/TimelineGuessRenderer";
import { trackGameComplete } from "@/lib/analytics";
import { saveProgress, getTodayAEDT } from "@/lib/storage";
import type { TimelineGuessConfig } from "@/types/game";
import type { TimelineResult } from "@/components/renderers/TimelineGuessRenderer";

export function FlashbackGame({ config }: { config: TimelineGuessConfig }) {
  const gameId = `timeline_${config.date}`;

  const handleComplete = useCallback(
    async (score: number, results: TimelineResult[]) => {
      await saveProgress({
        gameType: "timeline_guess",
        date: getTodayAEDT(),
        state: {},
        completed: true,
        score,
      });

      trackGameComplete({
        gameType: "timeline_guess",
        gameId,
        score,
        timeSpent: 0,
        attempts: results.length,
        streakLength: 0,
      });

      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "timeline_guess", gameId, score }),
      }).catch(() => null);
    },
    [gameId]
  );

  return (
    <GameShell
      gameType="timeline_guess"
      gameId={gameId}
      title={config.title}
      isPremium={true}
      wide
    >
      <TimelineGuessRenderer config={config} onComplete={handleComplete} />
    </GameShell>
  );
}

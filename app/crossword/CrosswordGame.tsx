"use client";

import { useCallback } from "react";
import { GameShell } from "@/components/GameShell";
import { CrosswordRenderer } from "@/components/renderers/CrosswordRenderer";
import { trackGameComplete } from "@/lib/analytics";
import { saveProgress, getTodayAEDT } from "@/lib/storage";
import type { CrosswordConfig } from "@/types/game";

export function CrosswordGame({ config }: { config: CrosswordConfig }) {
  const gameId = `crossword_${config.date}`;

  const handleComplete = useCallback(
    async (score: number) => {
      await saveProgress({
        gameType: "crossword",
        date: getTodayAEDT(),
        state: {},
        completed: true,
        score,
      });

      trackGameComplete({
        gameType: "crossword",
        gameId,
        score,
        timeSpent: 0,
        attempts: 1,
        streakLength: 0,
      });

      fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameType: "crossword", gameId, score }),
      }).catch(() => null);
    },
    [gameId]
  );

  return (
    <GameShell
      gameType="crossword"
      gameId={gameId}
      title="Daily Mini Crossword"
      isPremium={true}
    >
      <CrosswordRenderer
        gameId={gameId}
        size={config.size}
        clues={config.clues}
        onComplete={handleComplete}
      />
    </GameShell>
  );
}

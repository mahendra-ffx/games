"use client";

/**
 * useStreak
 *
 * Unified streak hook:
 * - Reads local streak from IndexedDB immediately (fast, offline-first)
 * - If user is authenticated, syncs with server (cloud backup)
 * - Returns the highest streak value (local vs server — they should agree)
 * - Detects milestone crossings (7/30/100 days) for celebration
 */

import { useEffect, useState, useCallback } from "react";
import { getStreak, updateStreak, getTodayAEDT } from "@/lib/storage";
import { usePiano } from "@/components/providers/PianoProvider";
import { captureGameError } from "@/lib/sentry";
import { trackStreakMilestone } from "@/lib/analytics";
import type { StreakData } from "@/lib/storage";
import type { GameType } from "@/lib/hints";

const MILESTONE_DAYS = [7, 30, 100];

export interface UseStreakResult {
  streak: StreakData;
  isLoading: boolean;
  /** Records today's play and updates streak — call on game completion */
  recordPlay: (gameType: GameType) => Promise<StreakData>;
  /** Pending milestone to celebrate (null if none) */
  milestone: number | null;
  dismissMilestone: () => void;
}

export function useStreak(gameType: GameType): UseStreakResult {
  const { user, tier } = usePiano();
  const [streak, setStreak] = useState<StreakData>({
    current: 0,
    longest: 0,
    lastPlayedDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [milestone, setMilestone] = useState<number | null>(null);

  // Load streak on mount
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // 1. Load from local IndexedDB immediately
      const local = await getStreak(gameType);

      if (!cancelled) setStreak(local);

      // 2. If authenticated, fetch from server and reconcile
      if (user?.uid) {
        try {
          const res = await fetch(`/api/streak?gameType=${gameType}&uid=${user.uid}`);
          if (res.ok) {
            const { streak: serverStreak } = (await res.json()) as {
              streak: StreakData;
            };
            if (!cancelled) {
              // Use whichever has the higher current streak
              const best =
                serverStreak.current >= local.current ? serverStreak : local;
              setStreak(best);
            }
          }
        } catch (err) {
          // Server unavailable — local data is sufficient
          captureGameError(err, { gameType, extra: { context: "streak_fetch" } });
        }
      }

      if (!cancelled) setIsLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [gameType, user?.uid]);

  const recordPlay = useCallback(
    async (gt: GameType): Promise<StreakData> => {
      const today = getTodayAEDT();
      const updated = await updateStreak(gt, today);
      setStreak(updated);

      // Detect milestones
      const prevStreak = streak.current;
      const crossedMilestone = MILESTONE_DAYS.find(
        (m) => updated.current >= m && prevStreak < m
      );
      if (crossedMilestone) {
        setMilestone(crossedMilestone);
        trackStreakMilestone({ streakLength: crossedMilestone, gameType: gt });
      }

      // Sync to server if authenticated (non-blocking)
      if (user?.uid) {
        fetch("/api/streak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: gt, streak: updated, uid: user.uid }),
        }).catch((err) => {
          captureGameError(err, { gameType: gt, extra: { context: "streak_sync" } });
        });
      }

      return updated;
    },
    [streak.current, user?.uid]
  );

  return {
    streak,
    isLoading,
    recordPlay,
    milestone,
    dismissMilestone: () => setMilestone(null),
  };
}

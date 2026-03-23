"use client";

/**
 * StreakDisplay
 *
 * Renders the user's current streak and triggers a milestone celebration modal
 * when the player crosses a milestone (7 / 30 / 100 days).
 */

import type { StreakData } from "@/lib/storage";

interface StreakDisplayProps {
  streak: StreakData;
  isLoading?: boolean;
  milestone: number | null;
  onDismissMilestone: () => void;
}

export function StreakDisplay({
  streak,
  isLoading = false,
  milestone,
  onDismissMilestone,
}: StreakDisplayProps) {
  if (isLoading) return null;
  if (streak.current === 0) return null;

  return (
    <>
      <div className="streak-badge" aria-label={`${streak.current}-day streak`}>
        🔥 {streak.current}-day streak
      </div>

      {milestone !== null && (
        <MilestoneCelebration days={milestone} onDismiss={onDismissMilestone} />
      )}
    </>
  );
}

// ── Milestone celebration modal ───────────────────────────────────────────────

const MILESTONE_EMOJI: Record<number, string> = {
  7: "🎉",
  30: "🏆",
  100: "🌟",
};

const MILESTONE_MESSAGE: Record<number, string> = {
  7: "One week straight — you're on a roll!",
  30: "30 days! You're a Canberra Times Games regular.",
  100: "100 days! Legendary dedication. Truly extraordinary.",
};

interface MilestoneCelebrationProps {
  days: number;
  onDismiss: () => void;
}

function MilestoneCelebration({ days, onDismiss }: MilestoneCelebrationProps) {
  const emoji = MILESTONE_EMOJI[days] ?? "🎊";
  const message = MILESTONE_MESSAGE[days] ?? `${days}-day streak achieved!`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="milestone-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-8 text-center shadow-2xl"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <div className="text-6xl mb-4">{emoji}</div>

        <p className="type-label mb-1" style={{ color: "var(--color-gray-500)" }}>
          Streak milestone
        </p>

        <h2
          id="milestone-title"
          className="type-headline mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {days} days!
        </h2>

        <p className="type-body mb-6" style={{ color: "var(--text-secondary)" }}>
          {message}
        </p>

        <button
          onClick={onDismiss}
          autoFocus
          className="type-button w-full py-3 rounded-lg text-white"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          Keep it going 🔥
        </button>
      </div>
    </div>
  );
}

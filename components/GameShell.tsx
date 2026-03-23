"use client";

/**
 * GameShell
 *
 * Shared wrapper used by every game renderer. Handles:
 * - Game header (title, streak badge, hint balance)
 * - Score display
 * - Share button
 * - Hint button
 * - Paywall gate (premium games)
 * - ARIA live region for score/timer announcements
 * - Analytics (game_start on mount, game_complete/abandon on unmount)
 */

import { useEffect, useRef, useState } from "react";
import { usePiano } from "@/components/providers/PianoProvider";
import { HintButton } from "@/components/HintButton";
import { ShareCard } from "@/components/ShareCard";
import { StreakDisplay } from "@/components/ui/StreakDisplay";
import { PushOptIn } from "@/components/ui/PushOptIn";
import { trackGameStart, trackGameAbandon } from "@/lib/analytics";
import { getTodayAEDT, getPreference } from "@/lib/storage";
import { useStreak } from "@/hooks/useStreak";
import type { GameType } from "@/lib/hints";

interface GameShellProps {
  gameType: GameType;
  gameId: string;
  title: string;
  isPremium?: boolean;
  /** Called when a hint is granted — game renderer applies the hint effect */
  onHintGranted?: (tier: 1 | 2) => void;
  children: React.ReactNode;
  /** Pass completed state up to show share card */
  completed?: boolean;
  score?: number;
  shareText?: string;
  /** Use a wider container (e.g. for side-by-side photo layouts) */
  wide?: boolean;
}

export function GameShell({
  gameType,
  gameId,
  title,
  isPremium = false,
  onHintGranted,
  children,
  completed = false,
  score,
  shareText,
  wide = false,
}: GameShellProps) {
  const { tier, openCheckout, user } = usePiano();
  const { streak, recordPlay, milestone, dismissMilestone } = useStreak(gameType);
  const [showShare, setShowShare] = useState(false);
  const [showPushOptIn, setShowPushOptIn] = useState(false);
  const [betaUnlocked, setBetaUnlocked] = useState(false);
  const startTimeRef = useRef(Date.now());
  const progressRef = useRef(0); // updated by child via prop callback

  // Paywall check — beta unlock bypasses Piano tier check
  const isPremiumLocked = isPremium && tier !== "premium" && !betaUnlocked;

  useEffect(() => {
    const today = getTodayAEDT();

    trackGameStart({
      gameType,
      gameId,
      date: today,
      isFree: !isPremium,
      userType: tier,
    });

    const capturedProgress = progressRef;
    const capturedStartTime = startTimeRef;
    return () => {
      // Track abandonment if not completed
      if (!completed) {
        trackGameAbandon({
          gameType,
          progressPct: capturedProgress.current,
          timeBeforeAbandon: Date.now() - capturedStartTime.current,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On completion: record streak, show share card, maybe show push opt-in
  useEffect(() => {
    if (!completed) return;

    recordPlay(gameType);
    setShowShare(true);

    // Show push opt-in once if not already seen
    getPreference("pushOptInSeen").then((seen) => {
      if (!seen) setShowPushOptIn(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  if (isPremiumLocked) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="type-headline mb-2" style={{ color: "var(--text-primary)" }}>
          {title} is a premium game
        </h2>
        <p className="type-body mb-6" style={{ color: "var(--text-secondary)" }}>
          Subscribe to The Canberra Times to unlock all daily games, sync your
          streaks, and join the leaderboard.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setBetaUnlocked(true)}
            className="type-button px-6 py-3 rounded-md text-white"
            style={{ backgroundColor: "var(--color-ct-blue)" }}
          >
            Play Now (beta users only)
          </button>
          <button
            onClick={openCheckout}
            className="type-button px-6 py-3 rounded-md border"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-secondary)" }}
          >
            Subscribe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${wide ? "max-w-5xl" : "max-w-2xl"} mx-auto px-4 py-6`}>
      {/* Game header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="type-label" style={{ color: "var(--color-gray-500)" }}>
            {isPremium ? "Premium" : "Free Daily"}
          </p>
          <h1 className="type-headline mt-0.5" style={{ color: "var(--text-primary)" }}>
            {title}
          </h1>
          <div className="mt-2">
            <StreakDisplay
              streak={streak}
              milestone={milestone}
              onDismissMilestone={dismissMilestone}
            />
          </div>
        </div>

        {/* Hint button — top right */}
        {onHintGranted && (
          <HintButton
            gameType={gameType}
            userType={tier}
            onHintGranted={onHintGranted}
          />
        )}
      </div>

      {/* Score display */}
      {score !== undefined && (
        <div
          className="mb-4 text-center font-semibold text-2xl"
          style={{ color: "var(--text-primary)" }}
          aria-live="polite"
          aria-label={`Score: ${score}`}
        >
          {score.toLocaleString()}
        </div>
      )}

      {/* Game content */}
      <div role="main" aria-label={`${title} game`}>
        {children}
      </div>

      {/* Share card (shown on completion) */}
      {showShare && shareText && (
        <ShareCard
          gameType={gameType}
          score={score ?? 0}
          shareText={shareText}
          streakLength={streak.current}
          onDismiss={() => setShowShare(false)}
        />
      )}

      {/* Push opt-in (shown once after first completion) */}
      {showPushOptIn && (
        <PushOptIn
          uid={user?.uid}
          onDismiss={() => setShowPushOptIn(false)}
        />
      )}

      {/* ARIA live region for score/timer announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="game-announcer"
      />
    </div>
  );
}

/** Helper to announce to screen readers */
export function announceToScreenReader(message: string): void {
  const el = document.getElementById("game-announcer");
  if (el) {
    el.textContent = "";
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }
}

"use client";

/**
 * ShareCard
 *
 * Generates a shareable result card and triggers the Web Share API.
 * Falls back to clipboard copy on desktop.
 * Tracks share events in PostHog.
 */

import { useState, useCallback } from "react";
import { trackShareResult } from "@/lib/analytics";
import type { GameType } from "@/lib/hints";

interface ShareCardProps {
  gameType: GameType;
  score: number;
  shareText: string;
  streakLength: number;
  onDismiss: () => void;
}

export function ShareCard({
  gameType,
  score,
  shareText,
  streakLength,
  onDismiss,
}: ShareCardProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${gameType.replace("_", "-")}`;

  const handleShare = useCallback(async () => {
    const data = {
      title: "Canberra Times Games",
      text: shareText,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        trackShareResult({
          gameType,
          score,
          shareChannel: "native",
          streakLength,
        });
      } catch (err) {
        // User cancelled — not an error
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      // Fallback: clipboard
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackShareResult({
        gameType,
        score,
        shareChannel: "clipboard",
        streakLength,
      });
    }
  }, [gameType, score, shareText, shareUrl, streakLength]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share your result"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-6"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        {/* Emoji score grid — Twitter/text friendly */}
        <div
          className="text-center text-2xl mb-4 font-mono tracking-widest"
          aria-label="Score emoji"
        >
          {shareText}
        </div>

        {streakLength > 0 && (
          <p
            className="text-center type-label mb-4"
            style={{ color: "var(--color-gray-500)" }}
          >
            🔥 {streakLength}-day streak
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="type-button w-full py-3 rounded-md text-white"
            style={{ backgroundColor: "var(--color-ct-blue)" }}
          >
            {copied ? "✓ Copied!" : "Share Result"}
          </button>

          <button
            onClick={onDismiss}
            className="type-button w-full py-3 rounded-md"
            style={{
              color: "var(--text-secondary)",
              border: `1px solid var(--border)`,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

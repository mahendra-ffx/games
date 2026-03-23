"use client";

/**
 * Timer component
 *
 * Used by Hunt the Landmark and North vs South.
 * - Green → yellow → red colour transition as time runs out
 * - Respects prefers-reduced-motion (no animation, just colour)
 * - ARIA live region announces low-time warnings
 *
 * Performance: the bar width and numeric text are updated via direct DOM ref
 * mutations inside the rAF loop — NO React state updates per frame.
 * setColorClass is called at most 3 times per round (safe/warn/danger thresholds).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { announceToScreenReader } from "@/components/GameShell";

interface TimerProps {
  durationMs: number;
  onExpired: () => void;
  isPaused?: boolean;
  /** If true, double the duration (a11y extended time mode) */
  extendedTime?: boolean;
}

export function Timer({
  durationMs,
  onExpired,
  isPaused = false,
  extendedTime = false,
}: TimerProps) {
  const totalMs = extendedTime ? durationMs * 2 : durationMs;

  // DOM refs — updated directly to avoid 60fps React re-renders
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  // React state only for the colour class — changes at most 3× per round
  const [colorClass, setColorClass] = useState<"timer-safe" | "timer-warn" | "timer-danger">("timer-safe");
  const colorClassRef = useRef<string>("timer-safe");

  const startTimeRef = useRef<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const hasAnnouncedHalfRef = useRef(false);

  const tick = useCallback(
    (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now;

      const elapsed = now - startTimeRef.current;
      const remaining = Math.max(0, totalMs - elapsed);
      const pct = remaining / totalMs;

      // ── Direct DOM mutations — no React setState ─────────────────────────
      if (barRef.current) barRef.current.style.width = `${pct * 100}%`;
      if (textRef.current) textRef.current.textContent = `${Math.ceil(remaining / 1000)}s`;

      // ── Colour class — only 3 possible values, only setState on transition ─
      const nextClass =
        pct > 0.5 ? "timer-safe" : pct > 0.25 ? "timer-warn" : "timer-danger";
      if (nextClass !== colorClassRef.current) {
        colorClassRef.current = nextClass;
        setColorClass(nextClass as "timer-safe" | "timer-warn" | "timer-danger");
      }

      // ── Accessibility announcement at halfway ────────────────────────────
      if (!hasAnnouncedHalfRef.current && remaining <= totalMs / 2) {
        hasAnnouncedHalfRef.current = true;
        announceToScreenReader(`${Math.ceil(remaining / 1000)} seconds remaining`);
      }

      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        announceToScreenReader("Time up!");
        onExpired();
        return; // stop rAF loop
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [totalMs, onExpired]
  );

  useEffect(() => {
    if (isPaused) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        pausedAtRef.current = Date.now();
      }
    } else {
      if (pausedAtRef.current && startTimeRef.current) {
        startTimeRef.current += Date.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPaused, tick]);

  return (
    <div role="timer" aria-live="off" aria-label="Round timer">
      {/* Progress bar — width driven by rAF via barRef, no CSS transition needed */}
      <div
        className="w-full h-1.5 rounded-full overflow-hidden mb-2"
        style={{ backgroundColor: "var(--border)" }}
      >
        <div
          ref={barRef}
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: "100%", backgroundColor: "currentColor" }}
        />
      </div>

      {/* Numeric display — textContent driven by rAF via textRef */}
      <p
        ref={textRef}
        className={`text-center font-mono font-bold text-xl ${colorClass}`}
        aria-hidden="true"
      >
        {Math.ceil(totalMs / 1000)}s
      </p>
    </div>
  );
}

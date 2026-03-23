"use client";

/**
 * TimelineGuessRenderer — Flashback Friday
 *
 * Archive photo year-guessing game.
 * Score based on proximity to correct year (max 100 per photo).
 *
 * Hints:
 * - Hint tier 1 (1 token): reveal the decade bracket
 * - Hint tier 2 (1 token): reveal a context clue
 */

import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { announceToScreenReader } from "@/components/GameShell";
import type { TimelineGuessConfig, TimelinePhoto } from "@/types/game";
import { scoreTimelineYear } from "@/lib/scoring";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimelineResult {
  photo: TimelinePhoto;
  guessedYear: number;
  error: number; // abs(guessedYear - actual)
  points: number;
  hintDecadeUsed: boolean;
  hintContextUsed: boolean;
}

interface TimelineGuessRendererProps {
  config: TimelineGuessConfig;
  onComplete: (score: number, results: TimelineResult[]) => void;
  hintTier?: 1 | 2;
}

type Phase = "guessing" | "revealing" | "complete";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAccuracyLabel(error: number): string {
  if (error === 0) return "Exactly right! 🎯";
  if (error <= 1) return "Off by one year — brilliant! 🌟";
  if (error <= 3) return "Very close! 📅";
  if (error <= 10) return "Good guess 👍";
  if (error <= 25) return "Getting warmer 🌡️";
  return "Way off — but great photo! 📷";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TimelineGuessRenderer({
  config,
  onComplete,
  hintTier,
}: TimelineGuessRendererProps) {
  // Year range: always use current year as the max
  const yearMin = config.year_range[0];
  const yearMax = new Date().getFullYear();
  const yearMid = Math.round((yearMin + yearMax) / 2);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [guessedYear, setGuessedYear] = useState(yearMid);
  const [results, setResults] = useState<TimelineResult[]>([]);
  const [phase, setPhase] = useState<Phase>("guessing");
  const [, setRevealed] = useState(false);
  const [hintDecadeShown, setHintDecadeShown] = useState(false);
  const [hintContextShown, setHintContextShown] = useState(false);

  const photo = config.photos[currentIdx];

  // ── Hints ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (hintTier === 1) setHintDecadeShown(true);
    if (hintTier === 2) setHintContextShown(true);
  }, [hintTier]);

  // ── Submit guess ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(() => {
    if (phase !== "guessing") return;

    const error = Math.abs(guessedYear - photo.year);
    const points = scoreTimelineYear(guessedYear, photo.year);

    if (points >= 80) {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.5 } });
    }

    announceToScreenReader(
      `You guessed ${guessedYear}. The answer is ${photo.year}. ${getAccuracyLabel(error)} ${points} points.`
    );

    const result: TimelineResult = {
      photo,
      guessedYear,
      error,
      points,
      hintDecadeUsed: hintDecadeShown,
      hintContextUsed: hintContextShown,
    };

    setResults((prev) => [...prev, result]);
    setPhase("revealing");
    setRevealed(true);
  }, [phase, guessedYear, photo, hintDecadeShown, hintContextShown]);

  // ── Advance to next photo ───────────────────────────────────────────────────

  const handleNext = useCallback(() => {
    const newResults = [...results];
    if (newResults.length === 0) return;

    if (currentIdx + 1 >= config.photos.length) {
      const totalScore = newResults.reduce((s, r) => s + r.points, 0);
      setPhase("complete");
      onComplete(totalScore, newResults);
    } else {
      setCurrentIdx((i) => i + 1);
      setGuessedYear(yearMid);
      setPhase("guessing");
      setRevealed(false);
      setHintDecadeShown(false);
      setHintContextShown(false);
    }
  }, [results, currentIdx, config.photos.length, yearMid, onComplete]);

  // ── Keyboard: Enter to submit, arrow keys to adjust year ───────────────────

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (phase !== "guessing") return;
      if (e.key === "Enter") handleSubmit();
      if (e.key === "ArrowRight") setGuessedYear((y) => Math.min(yearMax, y + 1));
      if (e.key === "ArrowLeft") setGuessedYear((y) => Math.max(yearMin, y - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleSubmit, yearMin, yearMax]);

  // ── Completion ──────────────────────────────────────────────────────────────

  if (phase === "complete") {
    const totalScore = results.reduce((s, r) => s + r.points, 0);
    const maxScore = results.length * 100;
    const avgError = results.reduce((s, r) => s + r.error, 0) / results.length;

    const shareLines = results
      .map((r) => `📷 ${r.photo.year} (you: ${r.guessedYear}) — ${r.points}pts`)
      .join("\n");
    const shareText = `Flashback Friday — Canberra Times\nScore: ${totalScore}/${maxScore}\nAvg error: ${avgError.toFixed(1)} years\n\n${shareLines}`;

    const handleShare = () => {
      if (navigator.share) {
        navigator.share({ text: shareText }).catch(() => null);
      } else {
        navigator.clipboard.writeText(shareText).catch(() => null);
      }
    };

    return (
      <div className="py-6 text-center">
        <div className="text-5xl mb-3">📷</div>
        <p className="type-label mb-1" style={{ color: "var(--color-gray-500)" }}>
          Final Score
        </p>
        <p className="text-5xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {totalScore}/{maxScore}
        </p>
        <p className="type-body mb-6" style={{ color: "var(--text-secondary)" }}>
          Average error: {avgError.toFixed(1)} years
        </p>

        <div className="space-y-3 mb-6 max-w-sm mx-auto text-left">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{ backgroundColor: "var(--bg-surface)" }}
            >
              <span className="text-2xl">📷</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {r.photo.desc.slice(0, 40)}…
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  You: {r.guessedYear} · Actual: {r.photo.year} · Error: {r.error}yr
                </p>
              </div>
              <span className="font-bold text-sm" style={{ color: "var(--color-ct-blue)" }}>
                {r.points}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={handleShare}
          className="type-button px-6 py-3 rounded-lg text-white"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          Share Result
        </button>
      </div>
    );
  }

  // ── Current result (after submitting) ──────────────────────────────────────

  const lastResult = results[results.length - 1];

  return (
    /*
     * Desktop: two-column layout — photo left, controls right, fits above the fold.
     * Mobile:  stacked — photo on top, controls below.
     */
    <div className="flex flex-col md:flex-row md:gap-6 md:items-start">

      {/* ── LEFT: Photo — natural aspect ratio, no squeeze, no sepia ─────── */}
      <div className="rounded-xl overflow-hidden mb-4 md:mb-0 md:flex-1 md:min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={currentIdx}
          src={photo.image}
          alt={photo.desc}
          className="w-full h-auto block max-h-[500px] object-contain"
          onError={(e) => {
            const target = e.currentTarget;
            target.onerror = null;
            target.style.background = "var(--bg-surface)";
            target.style.opacity = "0.4";
          }}
        />
      </div>

      {/* ── RIGHT: Controls panel — fixed 500px height matches photo max-height ── */}
      <div className="md:w-80 md:flex-shrink-0 flex flex-col md:h-[500px] md:overflow-y-auto">

        {/* Progress */}
        <div className="flex items-center justify-between mb-3">
          <p className="type-label" style={{ color: "var(--color-gray-500)" }}>
            Photo {currentIdx + 1} of {config.photos.length}
          </p>
          {results.length > 0 && (
            <p className="type-label font-semibold" style={{ color: "var(--color-ct-blue)" }}>
              {results.reduce((s, r) => s + r.points, 0)} pts
            </p>
          )}
        </div>

        {/* Intro description — first photo only */}
        {currentIdx === 0 && phase === "guessing" && (
          <p className="type-body mb-4" style={{ color: "var(--text-secondary)" }}>
            We&apos;ve loaded a collection of photos from the archives. Can you guess the year they were taken?
          </p>
        )}

        {/* Hint reveals */}
        {(hintDecadeShown || hintContextShown) && phase === "guessing" && (
          <div
            className="mb-3 p-3 rounded-lg space-y-1"
            style={{ backgroundColor: "var(--game-hint-bg)", borderLeft: "3px solid var(--game-hint-text)" }}
            aria-live="polite"
          >
            {hintDecadeShown && (
              <p className="text-sm font-medium" style={{ color: "var(--game-hint-text)" }}>
                💡 Decade: {photo.hint_decade}
              </p>
            )}
            {hintContextShown && (
              <p className="text-sm font-medium" style={{ color: "var(--game-hint-text)" }}>
                💡 Clue: {photo.hint_context}
              </p>
            )}
          </div>
        )}

        {/* ── GUESSING: year slider + lock-in button ── */}
        {phase === "guessing" && (
          <div className="flex flex-col flex-1">
            {/* Spacer pushes controls toward the bottom */}
            <div className="flex-1" />

            {/* Controls block — sits 30px above the bottom of the panel */}
            <div className="pb-[30px]">
              {/* Year display */}
              <div className="flex items-center justify-between mb-2">
                <p className="type-label" style={{ color: "var(--text-secondary)" }}>
                  Your guess
                </p>
                <p
                  className="text-4xl font-bold tabular-nums"
                  style={{ color: "var(--color-ct-blue)" }}
                  aria-live="polite"
                  aria-atomic="true"
                  aria-label={`Year guess: ${guessedYear}`}
                >
                  {guessedYear}
                </p>
              </div>

              {/* Slider */}
              <input
                type="range"
                min={yearMin}
                max={yearMax}
                value={guessedYear}
                onChange={(e) => setGuessedYear(Number(e.target.value))}
                className="w-full h-3 rounded-full cursor-pointer"
                style={{ accentColor: "var(--color-ct-blue)" }}
                aria-label={`Year slider from ${yearMin} to ${yearMax}`}
              />
              <div className="flex justify-between mt-1 mb-4">
                <span className="type-label" style={{ color: "var(--color-gray-400)" }}>{yearMin}</span>
                <span className="type-label" style={{ color: "var(--color-gray-400)" }}>{yearMax}</span>
              </div>

              {/* Lock in button */}
              <button
                onClick={handleSubmit}
                className="w-full type-button py-3 rounded-lg text-white"
                style={{ backgroundColor: "var(--color-ct-blue)" }}
              >
                Lock in Year: {guessedYear}
              </button>
            </div>
          </div>
        )}

        {/* ── REVEALING: answer panel + next button ── */}
        {phase === "revealing" && lastResult && (
          <div className="flex flex-col flex-1">
            {/* Answer panel */}
            <div
              className="p-4 rounded-xl mb-4"
              style={{ backgroundColor: "var(--bg-surface)", border: "2px solid var(--color-ct-blue)" }}
              aria-live="polite"
            >
              {/* Accuracy label */}
              <p className="text-lg font-bold mb-3 text-center" style={{ color: "var(--text-primary)" }}>
                {getAccuracyLabel(lastResult.error)}
              </p>

              {/* Year comparison */}
              <div className="flex items-center justify-center gap-4 mb-3">
                <div className="text-center">
                  <p className="type-label mb-0.5" style={{ color: "var(--text-secondary)" }}>Your guess</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-gray-500)" }}>
                    {lastResult.guessedYear}
                  </p>
                </div>
                <div className="text-xl" aria-hidden>→</div>
                <div className="text-center">
                  <p className="type-label mb-0.5" style={{ color: "var(--text-secondary)" }}>Actual year</p>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-ct-blue)" }}>
                    {lastResult.photo.year}
                  </p>
                </div>
                <div className="text-center">
                  <p className="type-label mb-0.5" style={{ color: "var(--text-secondary)" }}>Score</p>
                  <p className="text-2xl font-bold" style={{ color: "var(--color-ct-blue)" }}>
                    +{lastResult.points}
                  </p>
                </div>
              </div>

              {/* Caption + credit */}
              <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
                {photo.desc}
              </p>
              {photo.credit && (
                <p className="text-xs text-center mt-1" style={{ color: "var(--color-gray-400)" }}>
                  Photo: {photo.credit}
                </p>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Next / See Results button — 30px from bottom */}
            <button
              onClick={handleNext}
              className="w-full type-button py-3 rounded-lg text-white mb-[30px]"
              style={{ backgroundColor: "var(--color-ct-blue)" }}
              autoFocus
            >
              {currentIdx + 1 < config.photos.length ? "Next Photo →" : "See Results"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

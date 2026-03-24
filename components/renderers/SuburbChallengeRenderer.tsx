"use client";

/**
 * SuburbChallengeRenderer — Suburb Map Challenge
 *
 * Matches original HTML prototype game mechanics:
 *
 * Game flow:
 *   1. Start screen → "Start Game" button
 *   2. Each round: player sees suburb name, clicks it on the map
 *   3. Up to 3 attempts per suburb (3 pts → 2 pts → 1 pt → 0 pts + reveal)
 *   4. Per-answer reaction popup (random happy/sad image + message)
 *   5. Wrong click flashes red briefly; correct click turns green permanently
 *   6. After 3 wrong: suburb revealed orange, move on
 *   7. Skip / Give Up button forfeits current suburb
 *   8. After all suburbs → end screen with rank, confetti, share
 *
 * Map: full-bleed (fills <main>), UI card floats top-centre (max 400px)
 *
 * Scoring: 3 pts (1st correct) / 2 pts (2nd) / 1 pt (3rd) / 0 pts (miss/skip)
 * Rank: (score / maxPossible) × 100  where maxPossible = suburbs.length × 3
 */

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { MapBase } from "@/components/MapBase";
import { announceToScreenReader } from "@/components/GameShell";
import { captureGameError } from "@/lib/sentry";
import type { MapBaseHandle } from "@/components/MapBase";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { SuburbChallengeConfig } from "@/types/game";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SuburbResult {
  suburb: string;
  clickedSuburb: string | null;
  correct: boolean;
  attempts: number;
  points: number;
  hintUsed: boolean;
  skipped: boolean;
}

type Phase = "start" | "playing" | "complete";

interface SuburbChallengeRendererProps {
  config: SuburbChallengeConfig;
  onComplete: (score: number, results: SuburbResult[]) => void;
  hintTier?: 1 | 2;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const SOURCE_ID = "suburbs";
const FILL_LAYER = "suburbs-fill";
const LINE_LAYER = "suburbs-outline";
const LABEL_LAYER = "suburbs-labels";
const REACTION_DURATION_MS = 1200; // brief sad popup auto-hides
const ADVANCE_DELAY_MS = 3000;     // correct / 3rd-fail: stay 3s then advance

function getRank(scorePct: number, ranks: Record<string, string>): string {
  const thresholds = Object.keys(ranks).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) {
    if (scorePct >= t) return ranks[String(t)];
  }
  return ranks[String(thresholds[thresholds.length - 1])] ?? "Canberra Curious";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)] ?? "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SuburbChallengeRenderer({
  config,
  onComplete,
  hintTier,
}: SuburbChallengeRendererProps) {
  const mapRef = useRef<MapBaseHandle>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clickHandlerRef = useRef<((e: any) => void) | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref to handleClick — initialised with no-op so it's safe before handleClick is declared.
  // Updated via useEffect after every handleClick recreation (deps change).
  const handleClickRef = useRef<(clicked: string) => void>(() => {});

  const [phase, setPhase] = useState<Phase>("start");
  const [mapReady, setMapReady] = useState(false);

  // Per-round state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [attempts, setAttempts] = useState(0);   // 0-2 within current suburb
  const [results, setResults] = useState<SuburbResult[]>([]);
  const [feedback, setFeedback] = useState<string>("");  // inline feedback text
  const [feedbackColor, setFeedbackColor] = useState("#e67e22");
  const [roundActive, setRoundActive] = useState(false);

  // Reaction popup
  const [reactionImg, setReactionImg] = useState<string | null>(null);
  const [reactionMsg, setReactionMsg] = useState("");

  // Hint
  const [hintActive, setHintActive] = useState(false);

  // Fixed quiz order for session
  const [quizSuburbs] = useState<string[]>(() => shuffle(config.suburbs));

  const currentSuburb = quizSuburbs[currentIdx];
  const totalScore = results.reduce((s, r) => s + r.points, 0);
  const maxPossible = quizSuburbs.length * MAX_ATTEMPTS;

  // ── Map init ────────────────────────────────────────────────────────────────

  // Cache filtered GeoJSON so re-init (after theme change) doesn't re-fetch
  const regionDataRef = useRef<Record<string, unknown> | null>(null);

  const initMapLayers = useCallback(
    async (map: MapLibreMap) => {
      mapInstanceRef.current = map;
      try {
        // Remove existing layers/source if re-initialising (e.g. after theme switch)
        if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
        if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);

        // Fetch and filter GeoJSON (cached after first load)
        if (!regionDataRef.current) {
          const res = await fetch("/geo/act-suburbs.json");
          const geojson = await res.json();
          const suburbSet = new Set(config.suburbs.map((s) => s.toUpperCase()));
          regionDataRef.current = {
            ...geojson,
            features: geojson.features.filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f: any) => suburbSet.has((f.properties?.suburb ?? "").toUpperCase())
            ),
          };
        }

        map.addSource(SOURCE_ID, { type: "geojson", data: regionDataRef.current });

        // Fill — blue tint, clickable
        map.addLayer({
          id: FILL_LAYER,
          type: "fill",
          source: SOURCE_ID,
          paint: { "fill-color": "#007AFF", "fill-opacity": 0.3 },
        });

        // Outline
        map.addLayer({
          id: LINE_LAYER,
          type: "line",
          source: SOURCE_ID,
          paint: { "line-color": "white", "line-width": 1.5 },
        });

        map.on("mouseenter", FILL_LAYER, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", FILL_LAYER, () => { map.getCanvas().style.cursor = ""; });

        setMapReady(true);
      } catch (err) {
        captureGameError(err, { gameType: "suburb_challenge", extra: { context: "geojson_load" } });
      }
    },
    [config.suburbs]
  );

  // ── Register click handler whenever suburb changes ──────────────────────────

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !roundActive) return;

    if (clickHandlerRef.current) {
      map.off("click", FILL_LAYER, clickHandlerRef.current);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      if (!e.features?.length) return;
      const clicked: string = (e.features[0].properties?.suburb ?? "").toUpperCase();
      if (clicked) handleClickRef.current(clicked);
    };

    clickHandlerRef.current = handler;
    map.on("click", FILL_LAYER, handler);

    return () => { map.off("click", FILL_LAYER, handler); };
  }, [roundActive, currentIdx]);

  // ── Cleanup timer on unmount ────────────────────────────────────────────────

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  // ── Hint: show suburb name labels ───────────────────────────────────────────

  useEffect(() => {
    if (!hintTier) return;
    setHintActive(true);
    const map = mapInstanceRef.current;
    if (!map) return;
    if (!map.getLayer(LABEL_LAYER)) {
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "suburb"],
          "text-size": 10,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
          "text-max-width": 8,
        },
        paint: { "text-color": "#111827", "text-halo-color": "#fff", "text-halo-width": 1.5 },
      });
    }
  }, [hintTier]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const showReaction = useCallback((src: string, msg: string) => {
    setReactionImg(src);
    setReactionMsg(msg);
  }, []);

  const hideReaction = useCallback(() => {
    setReactionImg(null);
    setReactionMsg("");
  }, []);

  const setSuburbColor = useCallback(
    (suburb: string, color: string, opacity: number) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      try {
        map.setPaintProperty(FILL_LAYER, "fill-color", [
          "case",
          ["==", ["get", "suburb"], suburb], color,
          "#007AFF",
        ]);
        map.setPaintProperty(FILL_LAYER, "fill-opacity", [
          "case",
          ["==", ["get", "suburb"], suburb], opacity,
          0.3,
        ]);
      } catch { /* map may be removed */ }
    },
    []
  );

  const highlightWrongClick = useCallback(
    (clicked: string) => {
      const map = mapInstanceRef.current;
      if (!map) return;
      try {
        map.setPaintProperty(FILL_LAYER, "fill-color", [
          "case",
          ["==", ["get", "suburb"], clicked], "#e74c3c",
          "#007AFF",
        ]);
        map.setPaintProperty(FILL_LAYER, "fill-opacity", [
          "case",
          ["==", ["get", "suburb"], clicked], 0.8,
          0.3,
        ]);
        // Flash then reset after 400ms
        setTimeout(() => {
          if (!mapInstanceRef.current) return;
          try {
            map.setPaintProperty(FILL_LAYER, "fill-color", "#007AFF");
            map.setPaintProperty(FILL_LAYER, "fill-opacity", 0.3);
          } catch { /* ignore */ }
        }, 400);
      } catch { /* ignore */ }
    },
    []
  );

  const resetMapColors = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      map.setPaintProperty(FILL_LAYER, "fill-color", "#007AFF");
      map.setPaintProperty(FILL_LAYER, "fill-opacity", 0.3);
    } catch { /* ignore */ }
  }, []);

  // ── Start game ──────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setPhase("playing");
    setCurrentIdx(0);
    setAttempts(0);
    setResults([]);
    setFeedback("");
    setRoundActive(true);
  }, []);

  // ── Advance to next suburb ──────────────────────────────────────────────────

  const advanceToNext = useCallback(
    (latestResults: SuburbResult[]) => {
      hideReaction();
      resetMapColors();

      const nextIdx = currentIdx + 1;
      if (nextIdx >= quizSuburbs.length) {
        setRoundActive(false);
        setPhase("complete");
        const finalScore = latestResults.reduce((s, r) => s + r.points, 0);
        onComplete(finalScore, latestResults);

        // Confetti on completion
        const end = Date.now() + 3000;
        (function frame() {
          confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
          confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
          if (Date.now() < end) requestAnimationFrame(frame);
        })();
      } else {
        setCurrentIdx(nextIdx);
        setAttempts(0);
        setFeedback("");
        setHintActive(false);
        setRoundActive(true);
      }
    },
    [currentIdx, quizSuburbs.length, onComplete, hideReaction, resetMapColors]
  );

  // ── Main click handler ──────────────────────────────────────────────────────

  const handleClick = useCallback(
    (clicked: string) => {
      if (!roundActive) return;

      const isCorrect = clicked.toUpperCase() === currentSuburb.toUpperCase();
      const newAttempts = attempts + 1;

      if (isCorrect) {
        const pts = MAX_ATTEMPTS + 1 - newAttempts; // 3, 2, or 1
        setRoundActive(false);
        setSuburbColor(currentSuburb, "#2ecc71", 0.9);
        setFeedback(`Correct! +${pts}`);
        setFeedbackColor("#2ecc71");

        const result: SuburbResult = {
          suburb: currentSuburb,
          clickedSuburb: clicked,
          correct: true,
          attempts: newAttempts,
          points: pts,
          hintUsed: hintActive,
          skipped: false,
        };
        const newResults = [...results, result];
        setResults(newResults);

        announceToScreenReader(`Correct! That is ${currentSuburb}. +${pts} points.`);
        showReaction(pickRandom(config.happy_images), `Correct! +${pts} points`);

        advanceTimerRef.current = setTimeout(() => advanceToNext(newResults), ADVANCE_DELAY_MS);
      } else {
        // Wrong click
        highlightWrongClick(clicked);

        if (newAttempts >= MAX_ATTEMPTS) {
          // 3rd wrong — reveal and move on
          setAttempts(newAttempts);
          setRoundActive(false);
          setSuburbColor(currentSuburb, "#f39c12", 0.8);
          setFeedback("Missed! Location highlighted.");
          setFeedbackColor("#e74c3c");

          const result: SuburbResult = {
            suburb: currentSuburb,
            clickedSuburb: clicked,
            correct: false,
            attempts: newAttempts,
            points: 0,
            hintUsed: hintActive,
            skipped: false,
          };
          const newResults = [...results, result];
          setResults(newResults);

          announceToScreenReader(`Wrong. ${currentSuburb} is now highlighted. Moving on.`);
          showReaction(pickRandom(config.sad_images), "Too bad! Revealing location...");

          advanceTimerRef.current = setTimeout(() => advanceToNext(newResults), ADVANCE_DELAY_MS);
        } else {
          // Still have attempts left
          setAttempts(newAttempts);
          const remaining = MAX_ATTEMPTS - newAttempts;
          setFeedback("Try Again");
          setFeedbackColor("#e67e22");

          announceToScreenReader(`Wrong. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
          showReaction(pickRandom(config.sad_images), "Nope. Try again.");

          // Brief popup then hide
          advanceTimerRef.current = setTimeout(hideReaction, REACTION_DURATION_MS);
        }
      }
    },
    [
      roundActive, currentSuburb, attempts, results, hintActive,
      config.happy_images, config.sad_images,
      setSuburbColor, highlightWrongClick,
      showReaction, hideReaction, advanceToNext,
    ]
  );

  // Keep the ref in sync — MUST be after handleClick is declared to avoid TDZ
  useEffect(() => { handleClickRef.current = handleClick; }, [handleClick]);

  // ── Skip / Give Up ──────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    if (!roundActive) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    setRoundActive(false);

    const result: SuburbResult = {
      suburb: currentSuburb,
      clickedSuburb: null,
      correct: false,
      attempts,
      points: 0,
      hintUsed: hintActive,
      skipped: true,
    };
    const newResults = [...results, result];
    setResults(newResults);

    announceToScreenReader(`Skipped ${currentSuburb}.`);
    advanceToNext(newResults);
  }, [roundActive, currentSuburb, attempts, results, hintActive, advanceToNext]);

  // ── Completion screen ───────────────────────────────────────────────────────

  if (phase === "complete") {
    const finalScore = results.reduce((s, r) => s + r.points, 0);
    const scorePct = Math.round((finalScore / maxPossible) * 100);
    const rank = getRank(scorePct, config.ranks);
    const correctCount = results.filter((r) => r.correct).length;
    const reactionImg =
      scorePct >= 60
        ? pickRandom(config.happy_images)
        : pickRandom(config.sad_images);

    const shareEmoji = results.map((r) => (r.correct ? "🟩" : "🟥")).join("");
    const regionLabel = config.region === "master"
      ? "All Canberra"
      : config.region.charAt(0).toUpperCase() + config.region.slice(1);
    const shareText = `Canberra Suburb Challenge — ${regionLabel}\n${correctCount}/${results.length} correct · ${finalScore} pts\n${shareEmoji}\n${rank}`;

    const handleShare = async () => {
      if (navigator.share) {
        await navigator.share({ text: shareText }).catch(() => null);
      } else {
        await navigator.clipboard.writeText(shareText).catch(() => null);
      }
    };

    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-5 py-8 px-4"
        style={{ backgroundColor: "var(--bg-page)" }}
      >
        <span style={{ fontSize: 42 }}>🏆</span>

        {reactionImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reactionImg}
            alt={scorePct >= 60 ? "Happy reaction" : "Sad reaction"}
            className="h-36 w-auto object-contain"
            style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.3))" }}
          />
        )}

        <div className="text-center">
          <p className="type-label mb-1" style={{ color: "var(--text-secondary)" }}>All Done!</p>
          <p className="text-5xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            {finalScore} <span className="text-2xl font-normal" style={{ color: "var(--text-secondary)" }}>pts</span>
          </p>
          <p className="type-body mb-1" style={{ color: "var(--text-secondary)" }}>
            {correctCount}/{results.length} correct
          </p>
          <p className="font-semibold text-lg mt-3" style={{ color: "var(--color-ct-blue)" }}>{rank}</p>
        </div>

        {/* Emoji grid */}
        <div className="flex gap-1 flex-wrap justify-center" aria-label="Round results">
          {results.map((r, i) => (
            <span key={i} title={`${r.suburb}: ${r.correct ? "correct" : "wrong"}`} style={{ fontSize: 22 }}>
              {r.correct ? "🟩" : "🟥"}
            </span>
          ))}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full type-button py-3 rounded-xl text-white"
            style={{ backgroundColor: "#27ae60" }}
          >
            Share Score 📤
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full type-button py-3 rounded-xl text-white"
            style={{ backgroundColor: "#f39c12", fontSize: 14 }}
          >
            Play Again 🔄
          </button>
        </div>
      </div>
    );
  }

  // ── Full-bleed playing / start layout ───────────────────────────────────────
  // Map fills container. UI card floats top-centre (max 400px). Matches original.

  const attemptsRemaining = MAX_ATTEMPTS - attempts;

  return (
    <div className="relative flex-1 w-full overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── MAP — full bleed background ────────────────────────────────── */}
      <MapBase
        ref={mapRef}
        center={config.center}
        zoom={config.zoom}
        className="absolute inset-0 w-full h-full"
        onReady={initMapLayers}
        aria-label={`Suburb map for ${config.region} Canberra`}
      />

      {/* ── UI CARD — floats top-centre, max 400px ─────────────────────── */}
      <div
        className="absolute left-1/2 top-3"
        style={{ transform: "translateX(-50%)", width: "94%", maxWidth: 400, zIndex: 10 }}
      >
        <div
          className="rounded-2xl text-center shadow-lg"
          style={{
            backgroundColor: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(8px)",
            padding: "12px 15px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          {/* ── START SCREEN ── */}
          {phase === "start" && (
            <>
              <p className="type-label mb-1" style={{ color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, borderBottom: "1px solid #eee", paddingBottom: 5 }}>
                {config.region === "master" ? "All Canberra" : config.region.charAt(0).toUpperCase() + config.region.slice(1)} Map Challenge
              </p>
              <h1 style={{ margin: "10px 0", fontSize: 18, color: "#2c3e50", fontWeight: 600 }}>
                Find the Suburbs
              </h1>
              {mapReady ? (
                <button
                  onClick={startGame}
                  autoFocus
                  className="w-full type-button py-2.5 rounded-lg text-white font-semibold mt-2"
                  style={{ backgroundColor: "#007AFF" }}
                >
                  Start Game
                </button>
              ) : (
                <p style={{ fontSize: 12, color: "#ccc", fontStyle: "italic", marginTop: 10 }}>
                  Downloading Map Data…
                </p>
              )}
            </>
          )}

          {/* ── PLAYING SCREEN ── */}
          {phase === "playing" && (
            <>
              <p className="type-label" style={{ color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 9, borderBottom: "1px solid #eee", paddingBottom: 5, marginBottom: 6 }}>
                {config.region === "master" ? "All Canberra" : config.region.charAt(0).toUpperCase() + config.region.slice(1)} Map Challenge
              </p>

              {/* Stats row */}
              <div className="flex justify-between items-center mb-1">
                <div className="text-left">
                  <span style={{ fontSize: 9, color: "#888", fontWeight: "bold", textTransform: "uppercase" }}>Score</span>
                  <div style={{ fontSize: 18, color: "#007AFF", fontWeight: 800 }}>{totalScore}</div>
                </div>

                <div className="flex-1 text-center px-2">
                  <span
                    style={{ fontSize: 22, fontWeight: 900, color: "#2c3e50", display: "block", lineHeight: 1.1 }}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {currentSuburb}
                  </span>
                </div>

                <div className="text-right">
                  <span style={{ fontSize: 9, color: "#888", fontWeight: "bold", textTransform: "uppercase" }}>Attempts</span>
                  <div style={{ fontSize: 18, color: "#007AFF", fontWeight: 800 }}>{attemptsRemaining}</div>
                </div>
              </div>

              {/* Feedback line */}
              <p
                style={{ fontSize: 13, height: 16, color: feedbackColor, fontWeight: "bold", marginBottom: 5 }}
                aria-live="assertive"
              >
                {feedback}
              </p>

              {/* Skip button */}
              <button
                onClick={handleSkip}
                disabled={!roundActive}
                className="w-full type-button rounded-lg disabled:opacity-40"
                style={{ backgroundColor: "#95a5a6", fontSize: 12, padding: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}
              >
                Skip / Give Up
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── REACTION POPUP ─────────────────────────────────────────────────── */}
      {reactionImg && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            zIndex: 20,
            pointerEvents: "none",
          }}
          aria-live="polite"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reactionImg}
            alt="Reaction"
            style={{
              maxWidth: "85%", maxHeight: "50vh", marginBottom: 20,
              filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.6))",
              objectFit: "contain",
            }}
          />
          <div
            style={{
              background: "#1a1a1a", color: "white",
              padding: "15px 30px", borderRadius: 50,
              fontSize: 22, fontWeight: 700,
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
            }}
          >
            {reactionMsg}
          </div>
        </div>
      )}
    </div>
  );
}

// ── GeoJSON type helpers ──────────────────────────────────────────────────────

interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, string> | null;
  geometry: unknown;
}

void (null as unknown as GeoJSONFeature); // keep import

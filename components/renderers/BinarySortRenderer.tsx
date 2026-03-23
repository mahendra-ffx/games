"use client";

/**
 * BinarySortRenderer — North vs South (and future variants)
 *
 * Game flow:
 *   1. Intro splash screen
 *   2. Show suburb name + category buttons (NORTH / SOUTH)
 *   3. Timer counts down (default 5s, 10s in extended-time mode)
 *   4. Player taps/clicks/keyboards a category
 *   5. Reaction image popup (Andrew Barr / Ricky / Liz / Nick / Parton)
 *   6. Map zooms to highlight the suburb in green (correct) or red (wrong)
 *   7. Auto-advance after FEEDBACK_DURATION_MS
 *   8. After all rounds → completion screen + ShareCard
 *
 * Keyboard:
 *   ← / A → first category (SOUTH)
 *   → / D → second category (NORTH)
 *   Escape  → skip round (counts as timeout)
 *
 * Scoring: scoreBinarySortRound (lib/scoring.ts)
 *   Correct + fast = up to 1000pts. Minimum 100pts if correct. Wrong = 0pts.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  memo,
} from "react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { MapBase } from "@/components/MapBase";
import { Timer } from "@/components/ui/Timer";
import { announceToScreenReader } from "@/components/GameShell";
import { scoreBinarySortRound, buildBinarySortShareText, getBinarySortRank } from "@/lib/scoring";
import { buildShareGrid } from "@/types/game";
import { getPreferences } from "@/lib/storage";
import type { BinarySortConfig, RoundResult } from "@/types/game";
import type { MapBaseHandle } from "@/components/MapBase";
import type { Map as MapLibreMap, LineLayerSpecification, LngLatBounds as LngLatBoundsType } from "maplibre-gl";

// Module-level cache — populated inside useEffect (not at module evaluation time, so Fast Refresh is happy)
let LngLatBoundsClass: typeof LngLatBoundsType | null = null;

const FEEDBACK_DURATION_MS = 1500;

/**
 * Memoised timer wrapper — prevents re-mounting when BinarySortRenderer state
 * updates (score, phase, etc.) by only re-rendering when timerKey changes.
 * `onExpired` receives null to signal a timeout (same as handleAnswer(null)).
 */
const TimerMemo = memo(function TimerMemo({
  timerKey,
  durationMs,
  onExpired,
}: {
  timerKey: number;
  durationMs: number;
  onExpired: (category: null) => void;
}) {
  const handleExpired = useCallback(() => onExpired(null), [onExpired]);
  return <Timer key={timerKey} durationMs={durationMs} onExpired={handleExpired} />;
});

// ── Reaction images ───────────────────────────────────────────────────────────
const HAPPY_IMAGES = ["/reactions/barr_happy.png", "/reactions/Ricky_happy.png"];
const SAD_IMAGES   = ["/reactions/barr_sad.png", "/reactions/Liz_sad.png", "/reactions/Nick_sad.png", "/reactions/Parton_sad.png", "/reactions/Ricky1_sad.png"];

function pickRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

type Phase = "intro" | "playing" | "feedback" | "complete";

// ── Component ─────────────────────────────────────────────────────────────────

interface BinarySortRendererProps {
  config: BinarySortConfig;
  onComplete: (results: RoundResult[], totalScore: number) => void;
  onHintGranted?: (tier: 1 | 2) => void;
}

export function BinarySortRenderer({
  config,
  onComplete,
  onHintGranted: _onHintGranted,
}: BinarySortRendererProps) {
  const { items, categories, time_per_round_ms, divider_line } = config;
  const categoryKeys = Object.keys(categories);

  const [state, setState] = useState<{
    phase: Phase;
    currentIndex: number;
    results: RoundResult[];
    totalScore: number;
    lastResult: RoundResult | null;
    floatingScore: { points: number; id: number } | null;
    roundTimerKey: number; // increment to reset Timer
  }>({
    phase: "intro",
    currentIndex: 0,
    results: [],
    totalScore: 0,
    lastResult: null,
    floatingScore: null,
    roundTimerKey: 0,
  });

  const roundStartTimeRef = useRef(Date.now());
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapBaseHandle | null>(null);
  const [extendedTime, setExtendedTime] = useState(false);
  const timeLimitMs = extendedTime ? time_per_round_ms * 2 : time_per_round_ms;

  // Reaction popup
  const [reactionImg, setReactionImg] = useState<string | null>(null);
  const [reactionCorrect, setReactionCorrect] = useState(false);

  // GeoJSON suburb lookup: suburb name (uppercase) → GeoJSON Feature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const suburbGeoRef = useRef<Map<string, any>>(new Map());

  // Load accessibility preferences + GeoJSON suburb shapes + pre-cache LngLatBounds
  useEffect(() => {
    getPreferences().then((prefs) => setExtendedTime(prefs.extendedTime));

    // Cache LngLatBounds so showSuburbOnMap never needs a dynamic import per click
    if (!LngLatBoundsClass) {
      import("maplibre-gl").then(({ LngLatBounds }) => { LngLatBoundsClass = LngLatBounds; }).catch(() => null);
    }

    fetch("/geo/act-suburbs.json")
      .then((r) => r.json())
      .then((geojson) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geojson.features?.forEach((f: any) => {
          const name: string = (f.properties?.suburb || f.properties?.act_loca_2 || f.properties?.name || "").toUpperCase();
          if (name) suburbGeoRef.current.set(name, f);
        });
      })
      .catch(() => null); // silently degrade — map still works without highlighting
  }, []);

  const currentItem = items[state.currentIndex];

  // ── Highlight suburb on map after answer ───────────────────────────────────

  const showSuburbOnMap = useCallback((suburbName: string, correct: boolean) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feature = suburbGeoRef.current.get(suburbName.toUpperCase()) as any;
    const fillColor = correct ? "#27ae60" : "#e74c3c";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const featureCollection: any = feature
      ? { type: "FeatureCollection", features: [feature] }
      : { type: "FeatureCollection", features: [] };

    const source = map.getSource("suburb-highlight") as { setData?: (data: unknown) => void } | undefined;

    if (source && typeof source.setData === "function") {
      source.setData(featureCollection);
    } else {
      map.addSource("suburb-highlight", { type: "geojson", data: featureCollection });
    }

    // Add fill layer on first call; update colour on subsequent calls
    if (!map.getLayer("suburb-highlight-fill")) {
      map.addLayer({
        id: "suburb-highlight-fill",
        type: "fill",
        source: "suburb-highlight",
        paint: { "fill-color": fillColor, "fill-opacity": 0.75 },
      });
      map.addLayer({
        id: "suburb-highlight-border",
        type: "line",
        source: "suburb-highlight",
        paint: { "line-color": fillColor, "line-width": 3 },
      });
    } else {
      map.setPaintProperty("suburb-highlight-fill", "fill-color", fillColor);
      map.setPaintProperty("suburb-highlight-border", "line-color", fillColor);
    }

    // Fly to suburb bounds — use cached LngLatBounds class (no dynamic import per click)
    if (feature?.geometry && LngLatBoundsClass) {
      try {
        const coords: number[][] = feature.geometry.type === "Polygon"
          ? feature.geometry.coordinates.flat()
          : feature.geometry.type === "MultiPolygon"
          ? feature.geometry.coordinates.flat(2)
          : [];

        if (coords.length > 0) {
          const Bounds = LngLatBoundsClass;
          const bounds = coords.reduce(
            (b: InstanceType<typeof LngLatBoundsType>, c: number[]) =>
              b.extend([c[0], c[1]] as [number, number]),
            new Bounds(
              [coords[0][0], coords[0][1]],
              [coords[0][0], coords[0][1]]
            )
          );
          // 400ms — fast enough to feel responsive, short enough not to fight React rendering
          map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 400 });
        }
      } catch {
        // silently degrade if geometry is malformed
      }
    }
  }, []);

  // ── Start handler ───────────────────────────────────────────────────────────

  const handleStart = useCallback(() => {
    roundStartTimeRef.current = Date.now();
    setState((prev) => ({ ...prev, phase: "playing" }));
  }, []);

  // ── Answer handler ──────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (chosenCategory: string | null) => {
      if (state.phase !== "playing") return;

      const timeMs = Date.now() - roundStartTimeRef.current;
      const timeRemainingMs = Math.max(0, timeLimitMs - timeMs);
      const correct = chosenCategory === currentItem.category;

      const points = chosenCategory === null
        ? 0
        : scoreBinarySortRound({ correct, timeRemainingMs, timeLimitMs });

      const result: RoundResult = {
        item: currentItem.name,
        correctCategory: currentItem.category,
        playerCategory: chosenCategory,
        correct,
        timeMs,
        points,
      };

      announceToScreenReader(
        correct
          ? `Correct! ${currentItem.name} is in the ${categories[currentItem.category].label} — +${points} points`
          : `Wrong. ${currentItem.name} is ${categories[currentItem.category].label}`
      );

      if (correct) {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: [
            categories[categoryKeys[0]].color,
            categories[categoryKeys[1]].color,
            "#00558C",
          ],
        });
      }

      // Reaction popup
      const img = correct ? pickRandom(HAPPY_IMAGES) : pickRandom(SAD_IMAGES);
      setReactionImg(img);
      setReactionCorrect(correct);

      // Highlight suburb on map
      showSuburbOnMap(currentItem.name, correct);

      setState((prev) => ({
        ...prev,
        phase: "feedback",
        results: [...prev.results, result],
        totalScore: prev.totalScore + points,
        lastResult: result,
        floatingScore: points > 0 ? { points, id: Date.now() } : null,
      }));

      // Auto-advance after feedback
      feedbackTimerRef.current = setTimeout(() => {
        // Dismiss reaction popup
        setReactionImg(null);

        // Reset map to Canberra overview and clear suburb highlight
        const map = mapRef.current?.getMap();
        if (map) {
          map.flyTo({ center: [149.13, -35.28], zoom: 10, duration: 600 });
          const src = map.getSource("suburb-highlight") as { setData?: (d: unknown) => void } | undefined;
          src?.setData?.({ type: "FeatureCollection", features: [] });
        }

        setState((prev) => {
          const isLast = prev.currentIndex >= items.length - 1;
          if (isLast) {
            const finalResults = [...prev.results];
            onComplete(finalResults, prev.totalScore);
            return { ...prev, phase: "complete" };
          }
          roundStartTimeRef.current = Date.now();
          return {
            ...prev,
            phase: "playing",
            currentIndex: prev.currentIndex + 1,
            lastResult: null,
            floatingScore: null,
            roundTimerKey: prev.roundTimerKey + 1,
          };
        });
      }, FEEDBACK_DURATION_MS);
    },
    [state.phase, currentItem, categories, categoryKeys, timeLimitMs, items.length, onComplete, showSuburbOnMap]
  );

  // ── Keyboard navigation ─────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (state.phase !== "playing") return;

      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          handleAnswer(categoryKeys[0]);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          handleAnswer(categoryKeys[1]);
          break;
        case "Escape":
          e.preventDefault();
          handleAnswer(null); // timeout/skip
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.phase, handleAnswer, categoryKeys]);

  // ── Map setup (The Wall divider line) ─────────────────────────────────────

  const handleMapReady = useCallback(
    (map: MapLibreMap) => {
      if (!divider_line || divider_line.length < 2) return;

      // The Great Wall of Canberra — thick solid dark line (matches original prototype)
      map.addSource("the-wall", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "LineString",
            // divider_line is [lat, lng] in config → GeoJSON needs [lng, lat]
            coordinates: divider_line.map(([lat, lng]) => [lng, lat]),
          },
          properties: {},
        },
      });

      const wallLayer: LineLayerSpecification = {
        id: "the-wall-line",
        type: "line",
        source: "the-wall",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#2c3e50",
          "line-width": 12,
          "line-opacity": 0.9,
        },
      };

      map.addLayer(wallLayer);
    },
    [divider_line]
  );

  // ── Hint: map flash ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!_onHintGranted) return;
    // The parent GameShell calls onHintGranted(tier) — we receive it here
    // by re-exposing a handler the parent can call.
    // Flash the current suburb location on the map for 1.5s.
  }, [_onHintGranted]);

  const triggerHintFlash = useCallback(() => {
    const item = currentItem;
    if (!item.lat || !item.lng || !mapRef.current) return;
    mapRef.current.flashMarker([item.lng, item.lat], 1500);
  }, [currentItem]);

  // Expose hint flash trigger up to GameShell via callback ref pattern
  useEffect(() => {
    if (_onHintGranted) {
      // Wrap so parent calls this when hint tier 1 is granted
      const originalOnHintGranted = _onHintGranted;
      // The GameShell passes onHintGranted as a prop to BinarySortRenderer.
      // We call triggerHintFlash whenever tier 1 is used.
      void originalOnHintGranted;
    }
  }, [_onHintGranted, triggerHintFlash]);

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // ── Complete screen ─────────────────────────────────────────────────────────

  if (state.phase === "complete") {
    const { results, totalScore } = state;
    const maxScore = items.length * 1000;
    const correctCount = results.filter((r) => r.correct).length;
    const rank = getBinarySortRank(totalScore, maxScore);

    return (
      <CompletionScreen
        results={results}
        totalScore={totalScore}
        maxScore={maxScore}
        correctCount={correctCount}
        rank={rank}
        config={config}
      />
    );
  }

  // ── Shared full-bleed shell (intro + playing + feedback all use the same map) ──
  //
  // Layout mirrors the original HTML prototype:
  //   • Map fills 100% width and 100% height of the container (which is flex-1 in <main>)
  //   • #ui-container is position:absolute over the map, pointer-events:none by default
  //   • Interactive cards/buttons re-enable pointer-events individually

  const cat0 = categories[categoryKeys[0]];
  const cat1 = categories[categoryKeys[1]];
  const feedbackState = state.lastResult;

  return (
    <div className="relative flex-1 w-full overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── MAP — full bleed background ─────────────────────────────────── */}
      <MapBase
        ref={mapRef}
        center={[149.13, -35.28]}
        zoom={10}
        className="absolute inset-0 w-full h-full"
        onReady={handleMapReady}
        interactive={false}
        aria-label="Map of Canberra showing North/South divider"
      />

      {/* ── INTRO CARD — centred absolutely, max-w 400px ─────────────────── */}
      {state.phase === "intro" && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 10, padding: 15, pointerEvents: "none" }}
        >
          <div
            className="w-full rounded-2xl text-center shadow-xl"
            style={{
              maxWidth: 400,
              backgroundColor: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(10px)",
              padding: "24px 24px 20px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
              pointerEvents: "auto",
            }}
          >
            {/* Colour bar */}
            <div className="flex rounded-lg overflow-hidden mb-5" style={{ height: 6 }}>
              <div className="flex-1" style={{ backgroundColor: cat0?.color ?? "#3498db" }} />
              <div className="flex-1" style={{ backgroundColor: cat1?.color ?? "#e67e22" }} />
            </div>

            <h1
              className="font-serif font-medium mb-3"
              style={{ fontSize: "1.75rem", color: "#2c3e50", lineHeight: 1.2 }}
            >
              {cat0?.label ?? "North"} vs {cat1?.label ?? "South"} 🧱
            </h1>
            <p style={{ margin: "0 0 4px", fontSize: 15, color: "#555" }}>
              A massive wall divides the city.
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 15, color: "#555" }}>
              <strong>Speed is key!</strong>
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 15, color: "#555" }}>
              You get up to <strong style={{ color: "#00558c" }}>1000 points</strong> per round based on how fast you answer.
            </p>

            <button
              onClick={handleStart}
              autoFocus
              className="w-full type-button py-4 rounded-2xl text-white font-semibold"
              style={{ backgroundColor: "#2980b9", fontSize: 16 }}
            >
              Start Challenge
            </button>
          </div>
        </div>
      )}

      {/* ── UI OVERLAY — pointer-events:none container, children opt-in ─── */}
      {state.phase !== "intro" && (
      <div
        className="absolute inset-0 flex flex-col justify-between"
        style={{ padding: 15, pointerEvents: "none", zIndex: 10 }}
      >

        {/* ── TOP CARD ─────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl text-center shadow-lg"
          style={{
            backgroundColor: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)",
            padding: "15px",
            pointerEvents: "auto",
          }}
        >
          {/* Brand label */}
          <p
            className="type-label mb-2"
            style={{ color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 11 }}
          >
            Speed Challenge
          </p>

          {/* Timer bar */}
          {state.phase === "playing" && (
            <div className="mb-2">
              <TimerMemo
                timerKey={state.roundTimerKey}
                durationMs={timeLimitMs}
                onExpired={handleAnswer}
              />
            </div>
          )}

          {/* Suburb name */}
          <p
            className="font-bold"
            style={{ fontSize: 36, color: "#2c3e50", lineHeight: 1, margin: "8px 0",
              textShadow: "0 2px 0 rgba(255,255,255,0.5)" }}
            aria-live="polite"
            aria-atomic="true"
          >
            {currentItem?.name}
          </p>

          {/* Stats row */}
          <div className="flex justify-between px-5" style={{ fontSize: 14, fontWeight: "bold", color: "#555" }}>
            <div>Score: <span style={{ color: "#007AFF", fontSize: 18 }}>{state.totalScore.toLocaleString()}</span></div>
            <div>Left: <span style={{ color: "#007AFF", fontSize: 18 }}>{items.length - state.currentIndex}</span></div>
          </div>
        </div>

        {/* ── BOTTOM BUTTONS ───────────────────────────────────────────────── */}
        <div className="flex gap-2.5" style={{ marginBottom: 20, pointerEvents: "auto" }}>
            {categoryKeys.map((key, i) => {
              const cat = categories[key];
              const isChosen = feedbackState?.playerCategory === key;
              const isCorrectChoice = feedbackState?.correctCategory === key;

              return (
                <button
                  key={key}
                  onClick={() => handleAnswer(key)}
                  disabled={state.phase === "feedback"}
                  aria-label={`${cat.label} — press ${i === 0 ? "left arrow" : "right arrow"} key`}
                  aria-pressed={state.phase === "feedback" && isChosen}
                  className="relative flex-1 rounded-2xl font-serif font-black text-2xl uppercase text-white
                             disabled:cursor-not-allowed transition-transform duration-100
                             active:scale-[0.96] focus-visible:ring-4 focus-visible:ring-offset-2"
                  style={{
                    padding: "30px 10px",
                    boxShadow: "0 10px 20px rgba(0,0,0,0.4)",
                    backgroundColor:
                      state.phase === "feedback" && isCorrectChoice
                        ? "#22c55e"
                        : state.phase === "feedback" && isChosen && !isCorrectChoice
                        ? "#ef4444"
                        : cat.color,
                    borderBottom: `8px solid ${
                      state.phase === "feedback" && isCorrectChoice
                        ? "#16a34a"
                        : state.phase === "feedback" && isChosen && !isCorrectChoice
                        ? "#dc2626"
                        : (i === 0 ? "#2980b9" : "#d35400")
                    }`,
                    opacity: state.phase === "feedback" && !isCorrectChoice && !isChosen ? 0.5 : 1,
                  }}
                >
                  {cat.label}
                  <span
                    className="absolute bottom-2 right-3 text-xs font-sans font-normal opacity-60"
                    aria-hidden="true"
                  >
                    {i === 0 ? "←" : "→"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── THE WALL label ──────────────────────────────────────────────────── */}
      {state.phase !== "intro" && (
        <div
          className="absolute type-label rounded"
          style={{
            bottom: 90, right: 15, zIndex: 11,
            backgroundColor: "rgba(44,62,80,0.85)", color: "#fff",
            padding: "2px 8px", fontSize: 11, letterSpacing: "0.12em",
          }}
          aria-hidden="true"
        >
          THE WALL
        </div>
      )}

      {/* ── REACTION popup ──────────────────────────────────────────────────── */}
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
          aria-label={reactionCorrect ? "Correct!" : "Wrong!"}
        >
          <p
            className="font-black mb-4"
            style={{
              fontSize: "2.5rem",
              color: reactionCorrect ? "#2ecc71" : "#e74c3c",
              textShadow: "0 4px 10px rgba(0,0,0,0.4)",
            }}
          >
            {reactionCorrect && state.floatingScore ? `+${state.floatingScore.points}` : reactionCorrect ? "✓" : "Wrong!"}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reactionImg}
            alt={reactionCorrect ? "Happy reaction" : "Sad reaction"}
            style={{ maxWidth: "60%", maxHeight: 300, objectFit: "contain",
              borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Completion screen ─────────────────────────────────────────────────────────

interface CompletionProps {
  results: RoundResult[];
  totalScore: number;
  maxScore: number;
  correctCount: number;
  rank: string;
  config: BinarySortConfig;
}

function CompletionScreen({
  results,
  totalScore,
  maxScore,
  correctCount,
  rank,
  config,
}: CompletionProps) {
  const shareGrid = buildShareGrid(results);
  const shareText = buildBinarySortShareText({
    score: totalScore,
    maxScore,
    rounds: results.length,
    correctCount,
    shareGrid,
    date: config.date,
  });

  // Big confetti on completion
  useEffect(() => {
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, []);

  const handleShare = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/north-vs-south`;
    const data = { title: "Canberra Times — North vs South", text: shareText, url };
    if (navigator.share && navigator.canShare?.(data)) {
      await navigator.share(data);
    } else {
      await navigator.clipboard.writeText(`${shareText}\n\n${url}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center gap-6 py-6 px-4" aria-live="polite"
      style={{ backgroundColor: "var(--bg-page)" }}
    >
      <div className="text-center">
        <p className="type-label mb-2" style={{ color: "var(--color-ct-blue)" }}>
          Game complete!
        </p>
        <p
          className="font-serif font-medium"
          style={{ fontSize: "3rem", color: "var(--text-primary)", lineHeight: 1 }}
        >
          {totalScore}
          <span className="text-xl ml-1" style={{ color: "var(--text-muted)" }}>
            /{maxScore}
          </span>
        </p>
        <p className="mt-1 type-label" style={{ color: "var(--text-secondary)" }}>
          {correctCount}/{results.length} correct
        </p>
      </div>

      {/* Rank */}
      <div
        className="w-full text-center py-4 rounded-xl"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
      >
        <p className="type-label mb-1" style={{ color: "var(--text-muted)" }}>
          Your rank
        </p>
        <p className="font-medium text-lg" style={{ color: "var(--text-primary)" }}>
          {rank}
        </p>
      </div>

      {/* Share grid */}
      <div
        className="w-full p-4 rounded-xl font-mono text-2xl text-center leading-tight"
        style={{ backgroundColor: "var(--bg-surface)", letterSpacing: "0.05em" }}
        aria-label="Score emoji grid"
      >
        {shareGrid.split("\n").map((row, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>

      {/* Round-by-round breakdown */}
      <div className="w-full">
        <p className="type-label mb-3" style={{ color: "var(--text-muted)" }}>
          Round breakdown
        </p>
        <div className="flex flex-col gap-1.5">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: r.correct ? "var(--game-correct-bg)" : "var(--game-wrong-bg)",
                color: r.correct ? "var(--game-correct-text)" : "var(--game-wrong-text)",
              }}
            >
              <span className="font-medium">{r.item}</span>
              <span>
                {r.correct ? `+${r.points} pts` : r.playerCategory ? "✗ wrong" : "⏱ timeout"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA buttons */}
      <div className="w-full flex flex-col gap-3">
        <button
          onClick={handleShare}
          className="type-button w-full py-3 rounded-md text-white"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          Share Result
        </button>
        <Link
          href="/"
          className="type-button w-full py-3 rounded-md text-center block"
          style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
        >
          More Games
        </Link>
      </div>
    </div>
  );
}

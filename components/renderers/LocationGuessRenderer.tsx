"use client";

/**
 * LocationGuessRenderer — Hunt the Landmark
 *
 * Timed map-based location guessing game.
 * Each round: player sees an emoji clue and has time_limit_sec seconds
 * to click on the map where they think that landmark is.
 * Score is based on accuracy (distance in km) + time remaining.
 *
 * Hint tier 1: Zoom to the district the landmark is in
 * Hint tier 2: Show a 2km distance ring around the landmark
 *
 * Timer uses requestAnimationFrame to avoid battery drain from 50ms setInterval.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { MapBase } from "@/components/MapBase";
import { announceToScreenReader } from "@/components/GameShell";
import { haversineKm, scoreLocationGuess } from "@/lib/scoring";
import type { MapBaseHandle } from "@/components/MapBase";
import type { Map as MapLibreMap, LngLat } from "maplibre-gl";
import type { LandmarkHuntConfig, LandmarkHuntLocation } from "@/types/game";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LandmarkResult {
  location: LandmarkHuntLocation;
  clickedLng: number | null;
  clickedLat: number | null;
  distanceKm: number | null;
  timeUsedMs: number;
  points: number;
}

type Phase = "intro" | "playing" | "feedback" | "complete";

interface LocationGuessRendererProps {
  config: LandmarkHuntConfig;
  onComplete: (score: number, results: LandmarkResult[]) => void;
  hintTier?: 1 | 2;
}

// ── Scoring — imported from lib/scoring ───────────────────────────────────────
// haversineKm and scoreLocationGuess are re-exported from lib/scoring.ts

function getAccuracyLabel(km: number): string {
  if (km < 0.5) return "Spot on! 🎯";
  if (km < 2) return "Very close! 👌";
  if (km < 5) return "Not bad 🙂";
  if (km < 10) return "Getting warmer 🌡️";
  return "A long way off 📍";
}

const MAX_POINTS_PER_ROUND = 1000;

// Rank from average distance
function getRank(results: LandmarkResult[]): string {
  const totalScore = results.reduce((s, r) => s + r.points, 0);
  const maxScore = results.length * MAX_POINTS_PER_ROUND;
  const pct = totalScore / maxScore;
  if (pct > 0.85) return "Canberra GPS 🛰️";
  if (pct > 0.65) return "Local Legend 🌟";
  if (pct > 0.45) return "Reasonable Canberran 🙂";
  if (pct > 0.25) return "Tourist Mode 🗺️";
  return "Are you sure you're in Canberra? 😂";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CANBERRA_CENTER: [number, number] = [149.13, -35.28];
const CANBERRA_ZOOM = 11;
const MARKER_SOURCE = "guess-marker";
const MARKER_LAYER = "guess-marker-circle";
const CORRECT_SOURCE = "correct-marker";
const CORRECT_LAYER = "correct-marker-circle";
const LINE_SOURCE = "distance-line";
const LINE_LAYER_ID = "distance-line-layer";
const HINT_RING_SOURCE = "hint-ring";
const HINT_RING_LAYER = "hint-ring-layer";

// ── Component ─────────────────────────────────────────────────────────────────

export function LocationGuessRenderer({
  config,
  onComplete,
  hintTier,
}: LocationGuessRendererProps) {
  const mapRef = useRef<MapBaseHandle>(null);
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  const [phase, setPhase] = useState<Phase>("intro");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<LandmarkResult[]>([]);
  const [timeRemainingMs, setTimeRemainingMs] = useState(config.time_limit_sec * 1000);
  const [lastResult, setLastResult] = useState<LandmarkResult | null>(null);

  // Fixed quiz order for the session (use all locations, capped at config.rounds)
  const [quizLocations] = useState<LandmarkHuntLocation[]>(() => {
    const shuffled = [...config.locations].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(config.rounds, shuffled.length));
  });

  const current = quizLocations[currentIdx];
  const timeLimitMs = config.time_limit_sec * 1000;

  // ── Timer (RAF-based) ───────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const remaining = Math.max(0, timeLimitMs - elapsed);
      setTimeRemainingMs(remaining);

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Timed out — record as miss
        handleAnswer(null, null);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [timeLimitMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTimer = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    if (phase === "playing") {
      setTimeRemainingMs(timeLimitMs);
      startTimer();
    }
    return stopTimer;
  }, [phase, currentIdx, startTimer, stopTimer, timeLimitMs]);

  // ── Map setup ───────────────────────────────────────────────────────────────

  const initMap = useCallback((map: MapLibreMap) => {
    mapInstanceRef.current = map;

    // Empty sources for markers
    for (const [id, coord] of [
      [MARKER_SOURCE, [CANBERRA_CENTER[0], -90]] as [string, [number, number]],
      [CORRECT_SOURCE, [CANBERRA_CENTER[0], -90]] as [string, [number, number]],
    ]) {
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: coord }, properties: {} },
      });
    }

    map.addSource(LINE_SOURCE, {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} },
    });

    map.addSource(HINT_RING_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    // Guess marker (blue)
    map.addLayer({
      id: MARKER_LAYER,
      type: "circle",
      source: MARKER_SOURCE,
      paint: {
        "circle-radius": 12,
        "circle-color": "#00558C",
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // Correct marker (green)
    map.addLayer({
      id: CORRECT_LAYER,
      type: "circle",
      source: CORRECT_SOURCE,
      paint: {
        "circle-radius": 14,
        "circle-color": "#22c55e",
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // Distance line
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: LINE_SOURCE,
      paint: { "line-color": "#f59e0b", "line-width": 2, "line-dasharray": [4, 2] },
    });

    // Hint ring (dashed circle)
    map.addLayer({
      id: HINT_RING_LAYER,
      type: "line",
      source: HINT_RING_SOURCE,
      paint: { "line-color": "#8b5cf6", "line-width": 2, "line-dasharray": [6, 3] },
    });

    // Cursor
    map.getCanvas().style.cursor = "crosshair";

    // Click to guess
    map.on("click", (e) => {
      if (phase !== "playing") return; // stale closure — handled via ref below
      handleAnswer(e.lngLat.lng, e.lngLat.lat);
    });

    setPhase("playing");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attach click listener when phase changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handler = (e: { lngLat: LngLat }) => {
      if (phase === "playing") handleAnswer(e.lngLat.lng, e.lngLat.lat);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on("click", handler as any);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.off("click", handler as any);
    };
  }, [phase, currentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Answer handling ─────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (clickedLng: number | null, clickedLat: number | null) => {
      if (phase !== "playing") return;

      stopTimer();
      setPhase("feedback");

      const timeUsedMs = timeLimitMs - timeRemainingMs;
      const map = mapInstanceRef.current;

      let distanceKm: number | null = null;
      let points = 0;

      if (clickedLng !== null && clickedLat !== null) {
        distanceKm = haversineKm(clickedLat, clickedLng, current.lat, current.lng);
        points = scoreLocationGuess(distanceKm, timeRemainingMs, timeLimitMs);

        if (distanceKm < 1) {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        }

        // Show guess marker
        if (map?.getSource(MARKER_SOURCE)) {
          (map.getSource(MARKER_SOURCE) as unknown as { setData: (d: unknown) => void }).setData({
            type: "Feature",
            geometry: { type: "Point", coordinates: [clickedLng, clickedLat] },
            properties: {},
          });
        }
      }

      // Show correct location
      if (map?.getSource(CORRECT_SOURCE)) {
        (map.getSource(CORRECT_SOURCE) as unknown as { setData: (d: unknown) => void }).setData({
          type: "Feature",
          geometry: { type: "Point", coordinates: [current.lng, current.lat] },
          properties: {},
        });
      }

      // Draw distance line
      if (map?.getSource(LINE_SOURCE) && clickedLng !== null && clickedLat !== null) {
        (map.getSource(LINE_SOURCE) as unknown as { setData: (d: unknown) => void }).setData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [clickedLng, clickedLat],
              [current.lng, current.lat],
            ],
          },
          properties: {},
        });
        // Fit bounds to show both
        mapRef.current?.flyTo(
          [(clickedLng + current.lng) / 2, (clickedLat + current.lat) / 2],
          11
        );
      } else {
        mapRef.current?.flyTo([current.lng, current.lat], 13);
      }

      const result: LandmarkResult = {
        location: current,
        clickedLng,
        clickedLat,
        distanceKm,
        timeUsedMs,
        points,
      };
      setLastResult(result);

      const announcement =
        clickedLng === null
          ? `Time's up! ${current.name} was at ${current.emoji}`
          : `${distanceKm !== null ? distanceKm.toFixed(1) : "?"}km away. ${points} points.`;
      announceToScreenReader(announcement);

      const newResults = [...results, result];
      setResults(newResults);

      setTimeout(() => {
        // Clear markers
        clearMapMarkers(map);

        if (currentIdx + 1 >= quizLocations.length) {
          const totalScore = newResults.reduce((s, r) => s + r.points, 0);
          setPhase("complete");
          onComplete(totalScore, newResults);
        } else {
          setCurrentIdx((i) => i + 1);
          setLastResult(null);
          setPhase("playing");
          // Reset map view
          mapRef.current?.flyTo(CANBERRA_CENTER, CANBERRA_ZOOM);
        }
      }, 2500);
    },
    [phase, current, currentIdx, results, timeRemainingMs, timeLimitMs, quizLocations, onComplete, stopTimer]
  );

  // ── Hints ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || phase !== "playing") return;

    if (hintTier === 1) {
      // Zoom to district (rough zoom to Canberra sub-region containing the landmark)
      mapRef.current?.flyTo([current.lng, current.lat], 12);
    }

    if (hintTier === 2) {
      // 2km ring around correct location
      const circle = approximateCircle(current.lng, current.lat, 2);
      if (map.getSource(HINT_RING_SOURCE)) {
        (map.getSource(HINT_RING_SOURCE) as unknown as { setData: (d: unknown) => void }).setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: circle, properties: {} }],
        });
      }
    }
  }, [hintTier, phase, current]);

  // ── Timer colour (green → yellow → red) ────────────────────────────────────

  const timerPct = timeRemainingMs / timeLimitMs;
  const timerColor = timerPct > 0.5 ? "#22c55e" : timerPct > 0.25 ? "#f59e0b" : "#ef4444";

  // ── Completion ──────────────────────────────────────────────────────────────

  if (phase === "complete") {
    const totalScore = results.reduce((s, r) => s + r.points, 0);
    const rank = getRank(results);
    const avgDist =
      results.filter((r) => r.distanceKm !== null).reduce((s, r) => s + (r.distanceKm ?? 0), 0) /
      Math.max(1, results.filter((r) => r.distanceKm !== null).length);

    const shareLines = results
      .map((r) => {
        const d = r.distanceKm !== null ? `${r.distanceKm.toFixed(1)}km` : "missed";
        return `${r.location.emoji} ${r.location.name}: ${d} (${r.points}pts)`;
      })
      .join("\n");
    const shareText = `Hunt the Landmark — Canberra\nScore: ${totalScore.toLocaleString()}\n${rank}\n\n${shareLines}`;

    const handleShare = () => {
      if (navigator.share) {
        navigator.share({ text: shareText }).catch(() => null);
      } else {
        navigator.clipboard.writeText(shareText).catch(() => null);
      }
    };

    return (
      <div className="py-6 text-center">
        <div className="text-5xl mb-3">📍</div>
        <p className="type-label mb-1" style={{ color: "var(--color-gray-500)" }}>
          Final Score
        </p>
        <p className="text-5xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {totalScore.toLocaleString()}
        </p>
        <p className="type-body mb-1" style={{ color: "var(--text-secondary)" }}>
          Avg distance: {avgDist.toFixed(1)}km
        </p>
        <p className="type-headline mb-6" style={{ color: "var(--color-ct-blue)" }}>
          {rank}
        </p>

        {/* Per-round breakdown */}
        <div className="space-y-2 mb-6 max-w-xs mx-auto text-left">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-lg">{r.location.emoji}</span>
              <span className="flex-1" style={{ color: "var(--text-primary)" }}>
                {r.location.name}
              </span>
              <span style={{ color: "var(--text-secondary)" }}>
                {r.distanceKm !== null ? `${r.distanceKm.toFixed(1)}km` : "missed"}
              </span>
              <span className="font-semibold" style={{ color: "var(--color-ct-blue)" }}>
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

  // ── Intro ───────────────────────────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📍</div>
        <h2 className="type-headline mb-2" style={{ color: "var(--text-primary)" }}>
          Hunt the Landmark
        </h2>
        <p className="type-body mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
          You&apos;ll see a landmark name. Click where you think it is on the map.
          You have {config.time_limit_sec} seconds per round.
        </p>
        <button
          onClick={() => {
            setPhase("playing");
          }}
          className="type-button px-6 py-3 rounded-lg text-white"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          Start
        </button>
      </div>
    );
  }

  // ── Playing / feedback ──────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="type-label" style={{ color: "var(--color-gray-500)" }}>
            Round {currentIdx + 1} of {quizLocations.length}
          </p>
          {phase === "playing" && (
            <p
              className="type-label font-bold tabular-nums"
              style={{ color: timerColor }}
              aria-live="off"
            >
              {(timeRemainingMs / 1000).toFixed(1)}s
            </p>
          )}
        </div>

        <p className="text-2xl font-bold text-center" style={{ color: "var(--text-primary)" }}>
          {current.emoji} {current.name}
        </p>

        {/* Timer bar */}
        {phase === "playing" && (
          <div
            className="mt-2 h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--color-gray-200)" }}
            role="progressbar"
            aria-valuenow={Math.round(timerPct * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Time remaining"
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{ width: `${timerPct * 100}%`, backgroundColor: timerColor }}
            />
          </div>
        )}

        {/* Feedback overlay */}
        {phase === "feedback" && lastResult && (
          <div
            className="mt-2 p-3 rounded-lg text-center"
            style={{ backgroundColor: "var(--bg-surface)" }}
            aria-live="polite"
          >
            {lastResult.distanceKm !== null ? (
              <>
                <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {getAccuracyLabel(lastResult.distanceKm)}
                </p>
                <p className="type-body" style={{ color: "var(--text-secondary)" }}>
                  {lastResult.distanceKm.toFixed(2)} km away — {lastResult.points} pts
                </p>
              </>
            ) : (
              <p className="text-lg font-bold" style={{ color: "#ef4444" }}>
                Time&apos;s up! ⏱️
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="w-full rounded-xl overflow-hidden" style={{ height: "380px" }}>
        <MapBase
          ref={mapRef}
          center={CANBERRA_CENTER}
          zoom={CANBERRA_ZOOM}
          className="w-full h-full"
          onReady={initMap}
          aria-label="Canberra landmark location map — click to place your guess"
        />
      </div>

      <p className="mt-2 text-center type-label" style={{ color: "var(--color-gray-400)" }}>
        Click on the map to place your guess
      </p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearMapMarkers(map: MapLibreMap | null) {
  if (!map) return;
  for (const [srcId, coord] of [
    [MARKER_SOURCE, [CANBERRA_CENTER[0], -90]] as [string, [number, number]],
    [CORRECT_SOURCE, [CANBERRA_CENTER[0], -90]] as [string, [number, number]],
  ]) {
    if (map.getSource(srcId)) {
      (map.getSource(srcId) as unknown as { setData: (d: unknown) => void }).setData({
        type: "Feature",
        geometry: { type: "Point", coordinates: coord },
        properties: {},
      });
    }
  }
  if (map.getSource(LINE_SOURCE)) {
    (map.getSource(LINE_SOURCE) as unknown as { setData: (d: unknown) => void }).setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [] },
      properties: {},
    });
  }
  if (map.getSource(HINT_RING_SOURCE)) {
    (map.getSource(HINT_RING_SOURCE) as unknown as { setData: (d: unknown) => void }).setData({
      type: "FeatureCollection",
      features: [],
    });
  }
}

/** Approximate a circle as a GeoJSON polygon (64-point approximation) */
function approximateCircle(
  centerLng: number,
  centerLat: number,
  radiusKm: number
): { type: "Polygon"; coordinates: [number, number][][] } {
  const points = 64;
  const coords: [number, number][] = [];
  const kmPerLat = 111;
  const kmPerLng = 111 * Math.cos((centerLat * Math.PI) / 180);

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([
      centerLng + (radiusKm / kmPerLng) * Math.cos(angle),
      centerLat + (radiusKm / kmPerLat) * Math.sin(angle),
    ]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

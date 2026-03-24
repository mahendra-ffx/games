"use client";

/**
 * LocationGuessRenderer — Hunt the Landmark
 *
 * Full-bleed map with floating UI card overlay (matches SuburbChallengeRenderer pattern).
 * Each round: player sees an emoji clue + landmark name, clicks on the map.
 * Timer uses requestAnimationFrame. Score based on distance + time remaining.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { MapBase } from "@/components/MapBase";
import { announceToScreenReader } from "@/components/GameShell";
import { haversineKm, scoreLocationGuess } from "@/lib/scoring";
import type { MapBaseHandle } from "@/components/MapBase";
import type { Map as MapLibreMap } from "maplibre-gl";
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

type Phase = "start" | "playing" | "feedback" | "complete";

interface LocationGuessRendererProps {
  config: LandmarkHuntConfig;
  onComplete: (score: number, results: LandmarkResult[]) => void;
  hintTier?: 1 | 2;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAccuracyLabel(km: number): { label: string; color: string } {
  if (km < 0.5) return { label: "DIRECT HIT! 🎯", color: "#2ecc71" };
  if (km < 2) return { label: "Close Enough! 👍", color: "#f1c40f" };
  if (km < 5) return { label: "Bit of a walk... 🥾", color: "#e67e22" };
  return { label: "Miles off... ❌", color: "#e74c3c" };
}

const MAX_POINTS_PER_ROUND = 1000;

function getRank(results: LandmarkResult[]): string {
  const totalScore = results.reduce((s, r) => s + r.points, 0);
  const maxScore = results.length * MAX_POINTS_PER_ROUND;
  const pct = totalScore / maxScore;
  if (pct > 0.85) return "The Skywhale 🐋";
  if (pct > 0.65) return "Certified Ken Behrens 🦁";
  if (pct > 0.45) return "APS 6 Team Leader 📎";
  if (pct > 0.25) return "Summernats Spectator 🚗";
  return "Stuck in the Glenloch Interchange 😵‍💫";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
const FEEDBACK_DELAY_MS = 3000;

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
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable ref for handleMapClick — avoids stale closures in MapLibre event handlers
  const handleMapClickRef = useRef<(lng: number, lat: number) => void>(() => {});

  const [phase, setPhase] = useState<Phase>("start");
  const [mapReady, setMapReady] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<LandmarkResult[]>([]);
  const [score, setScore] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(config.time_limit_sec * 1000);
  const [lastResult, setLastResult] = useState<LandmarkResult | null>(null);

  // Fixed quiz order
  const [quizLocations] = useState<LandmarkHuntLocation[]>(() => {
    const shuffled = shuffle(config.locations);
    return shuffled.slice(0, Math.min(config.rounds, shuffled.length));
  });

  const current = quizLocations[currentIdx];
  const timeLimitMs = config.time_limit_sec * 1000;

  // ── Timer (RAF-based) ───────────────────────────────────────────────────────

  const stopTimer = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const remaining = Math.max(0, timeLimitMs - elapsed);
      setTimeRemainingMs(remaining);

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Time's up — record as miss
        handleMapClickRef.current(-999, -999); // sentinel for timeout
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [timeLimitMs]);

  // ── Map init ────────────────────────────────────────────────────────────────

  const initMap = useCallback((map: MapLibreMap) => {
    mapInstanceRef.current = map;

    // Idempotent — clean up if re-init (e.g. after theme switch)
    for (const layerId of [MARKER_LAYER, CORRECT_LAYER, LINE_LAYER_ID, HINT_RING_LAYER]) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    for (const srcId of [MARKER_SOURCE, CORRECT_SOURCE, LINE_SOURCE, HINT_RING_SOURCE]) {
      if (map.getSource(srcId)) map.removeSource(srcId);
    }

    // Empty sources
    for (const id of [MARKER_SOURCE, CORRECT_SOURCE]) {
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: [0, -90] }, properties: {} },
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
        "circle-radius": 10,
        "circle-color": "#2c3e50",
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // Correct marker (dynamic color — updated per round)
    map.addLayer({
      id: CORRECT_LAYER,
      type: "circle",
      source: CORRECT_SOURCE,
      paint: {
        "circle-radius": 12,
        "circle-color": "#2ecc71",
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });

    // Distance line (dashed)
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: LINE_SOURCE,
      paint: { "line-color": "#e67e22", "line-width": 3, "line-dasharray": [4, 4], "line-opacity": 0.8 },
    });

    // Hint ring
    map.addLayer({
      id: HINT_RING_LAYER,
      type: "line",
      source: HINT_RING_SOURCE,
      paint: { "line-color": "#8b5cf6", "line-width": 2, "line-dasharray": [6, 3] },
    });

    map.getCanvas().style.cursor = "crosshair";

    // Single click handler that delegates to ref
    map.on("click", (e) => {
      handleMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
    });

    setMapReady(true);
  }, []);

  // ── Click handler ─────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (clickedLng: number | null, clickedLat: number | null) => {
      if (phase !== "playing") return;

      stopTimer();
      setPhase("feedback");

      const timeUsedMs = timeLimitMs - timeRemainingMs;
      const map = mapInstanceRef.current;
      const isTimeout = clickedLng === -999;

      let distanceKm: number | null = null;
      let points = 0;

      if (!isTimeout && clickedLng !== null && clickedLat !== null) {
        distanceKm = haversineKm(clickedLat, clickedLng, current.lat, current.lng);
        points = scoreLocationGuess(distanceKm, timeRemainingMs, timeLimitMs);

        if (distanceKm < 0.5) {
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.8 } });
        }

        // Show guess marker
        setSourceData(map, MARKER_SOURCE, {
          type: "Feature",
          geometry: { type: "Point", coordinates: [clickedLng, clickedLat] },
          properties: {},
        });

        // Draw distance line
        setSourceData(map, LINE_SOURCE, {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [[clickedLng, clickedLat], [current.lng, current.lat]],
          },
          properties: {},
        });

        // Set correct marker color based on accuracy
        const { color } = getAccuracyLabel(distanceKm);
        if (map?.getLayer(CORRECT_LAYER)) {
          map.setPaintProperty(CORRECT_LAYER, "circle-color", color);
        }
      }

      // Show correct location marker
      setSourceData(map, CORRECT_SOURCE, {
        type: "Feature",
        geometry: { type: "Point", coordinates: [current.lng, current.lat] },
        properties: {},
      });

      // Fly to show both markers or just the correct location
      if (!isTimeout && clickedLng !== null && clickedLat !== null) {
        const midLng = (clickedLng + current.lng) / 2;
        const midLat = (clickedLat + current.lat) / 2;
        mapRef.current?.flyTo([midLng, midLat], 12);
      } else {
        mapRef.current?.flyTo([current.lng, current.lat], 13);
      }

      const result: LandmarkResult = {
        location: current,
        clickedLng: isTimeout ? null : clickedLng,
        clickedLat: isTimeout ? null : clickedLat,
        distanceKm,
        timeUsedMs,
        points,
      };
      setLastResult(result);
      setScore((s) => s + points);

      const newResults = [...results, result];
      setResults(newResults);

      announceToScreenReader(
        isTimeout
          ? `Time's up! ${current.name}.`
          : `${distanceKm !== null ? distanceKm.toFixed(1) : "?"}km away. ${points} points.`
      );

      // Auto-advance after feedback delay
      feedbackTimerRef.current = setTimeout(() => {
        clearMapMarkers(map);

        if (currentIdx + 1 >= quizLocations.length) {
          const totalScore = newResults.reduce((s, r) => s + r.points, 0);
          setPhase("complete");
          onComplete(totalScore, newResults);
        } else {
          setCurrentIdx((i) => i + 1);
          setLastResult(null);
          setPhase("playing");
          mapRef.current?.flyTo(CANBERRA_CENTER, CANBERRA_ZOOM);
        }
      }, FEEDBACK_DELAY_MS);
    },
    [phase, current, currentIdx, results, timeRemainingMs, timeLimitMs, quizLocations, onComplete, stopTimer]
  );

  // Keep ref in sync
  useEffect(() => {
    handleMapClickRef.current = (lng, lat) => handleAnswer(lng, lat);
  }, [handleAnswer]);

  // ── Start/restart timer when phase enters "playing" ────────────────────────

  useEffect(() => {
    if (phase === "playing") {
      setTimeRemainingMs(timeLimitMs);
      startTimer();
    }
    return stopTimer;
  }, [phase, currentIdx, startTimer, stopTimer, timeLimitMs]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
  }, []);

  // ── Hints ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || phase !== "playing") return;

    if (hintTier === 1) {
      mapRef.current?.flyTo([current.lng, current.lat], 12);
    }

    if (hintTier === 2) {
      const circle = approximateCircle(current.lng, current.lat, 2);
      setSourceData(map, HINT_RING_SOURCE, {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: circle, properties: {} }],
      });
    }
  }, [hintTier, phase, current]);

  // ── Derived values ──────────────────────────────────────────────────────

  const timerPct = timeRemainingMs / timeLimitMs;
  const timerColor = timerPct > 0.5 ? "#2ecc71" : timerPct > 0.25 ? "#f59e0b" : "#ef4444";
  const remaining = quizLocations.length - currentIdx;

  // ── Start game ──────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    setPhase("playing");
    setCurrentIdx(0);
    setScore(0);
    setResults([]);
  }, []);

  // ── Complete screen ─────────────────────────────────────────────────────

  if (phase === "complete") {
    const totalScore = results.reduce((s, r) => s + r.points, 0);
    const rank = getRank(results);

    const handleShare = () => {
      const shareText = `I scored ${totalScore} on Hunt the Landmark!\nRank: ${rank}\nCan you find the spots? 📍🕵️‍♂️`;
      if (navigator.share) {
        navigator.share({ title: "Hunt the Landmark", text: shareText }).catch(() => null);
      } else {
        navigator.clipboard.writeText(shareText).catch(() => null);
      }
    };

    // Fire confetti for high scores
    if (totalScore >= 7000) {
      const end = Date.now() + 4000;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10005 };
      const interval = setInterval(() => {
        if (Date.now() > end) return clearInterval(interval);
        confetti({ ...defaults, particleCount: 40, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      }, 250);
    }

    return (
      <div className="flex-1 overflow-y-auto flex flex-col items-center gap-5 py-8 px-4"
        style={{ backgroundColor: "var(--bg-page)" }}
      >
        <span style={{ fontSize: 42 }}>📍</span>
        <div className="text-center">
          <h2 className="type-headline mb-2" style={{ color: "var(--text-primary)" }}>Hunt Complete!</h2>
          <p className="font-bold text-lg mb-1" style={{ color: timerColor }}>{rank}</p>
          <p className="text-5xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            {totalScore.toLocaleString()} <span className="text-2xl font-normal" style={{ color: "var(--text-secondary)" }}>pts</span>
          </p>
        </div>

        {/* Per-round breakdown */}
        <div className="space-y-2 mb-4 w-full max-w-sm text-left">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="text-lg">{r.location.emoji}</span>
              <span className="flex-1" style={{ color: "var(--text-primary)" }}>{r.location.name}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {r.distanceKm !== null ? `${r.distanceKm.toFixed(1)}km` : "missed"}
              </span>
              <span className="font-semibold" style={{ color: "var(--color-ct-blue)" }}>{r.points}</span>
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm flex flex-col gap-3">
          <button onClick={handleShare} className="w-full type-button py-3 rounded-xl text-white" style={{ backgroundColor: "#2ecc71" }}>
            Share Score 📤
          </button>
          <button onClick={() => window.location.reload()} className="w-full type-button py-3 rounded-xl text-white" style={{ backgroundColor: "#f39c12" }}>
            Play Again 🔄
          </button>
        </div>
      </div>
    );
  }

  // ── Full-bleed playing layout (map fills container, UI floats) ──────────

  return (
    <div className="relative flex-1 w-full overflow-hidden" style={{ minHeight: 0 }}>

      {/* ── MAP — full bleed ────────────────────────────────────────── */}
      <MapBase
        ref={mapRef}
        center={CANBERRA_CENTER}
        zoom={CANBERRA_ZOOM}
        className="w-full h-full"
        onReady={initMap}
        aria-label="Canberra landmark map — click to place your guess"
      />

      {/* ── Floating UI card (top centre) ────────────────────────────── */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-[400px]"
        style={{ pointerEvents: "auto" }}
      >
        {/* Start screen overlay */}
        {phase === "start" && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
            }}
          >
            <h2 className="type-headline mb-2" style={{ color: "var(--text-primary)" }}>
              Hunt the Landmark 📍
            </h2>
            <p className="type-body mb-1" style={{ color: "var(--text-secondary)" }}>
              We give you a famous Canberra spot.
            </p>
            <p className="type-body mb-1" style={{ color: "var(--text-secondary)" }}>
              <strong>Tap the map to locate it.</strong>
            </p>
            <p className="font-bold mb-2" style={{ color: "#e74c3c", fontSize: 14 }}>
              ⚡ You have {config.time_limit_sec} seconds per round! ⚡
            </p>
            <p className="type-label mb-4" style={{ color: "var(--text-muted)" }}>
              Playing {quizLocations.length} Rounds
            </p>
            <button
              onClick={startGame}
              className="w-full type-button py-3 rounded-xl text-white"
              style={{ backgroundColor: "#2980b9" }}
              disabled={!mapReady}
            >
              {mapReady ? "Start Hunt" : "Loading map..."}
            </button>
          </div>
        )}

        {/* Playing: clue + timer + stats */}
        {(phase === "playing" || phase === "feedback") && current && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
            }}
          >
            {/* Timer bar at top of card */}
            {phase === "playing" && (
              <div className="h-1.5 w-full" style={{ backgroundColor: "#eee" }}>
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${timerPct * 100}%`,
                    backgroundColor: timerColor,
                  }}
                />
              </div>
            )}

            <div className="p-3 text-center">
              {/* Emoji clue box */}
              <div
                className="w-full rounded-xl flex items-center justify-center mb-2"
                style={{
                  height: 80,
                  backgroundColor: "#f0f2f5",
                  border: "2px solid #dfe4ea",
                  fontSize: 48,
                }}
              >
                {current.emoji}
              </div>

              {/* Landmark name */}
              <p className="font-bold text-lg" style={{ color: "#2c3e50", lineHeight: 1.2 }}>
                {current.name}
              </p>

              {/* Stats row */}
              <div className="flex justify-center gap-5 mt-2" style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>
                <div>Score: <span style={{ color: "#007AFF", fontSize: 15 }}>{score}</span></div>
                <div>Left: <span style={{ color: "#007AFF", fontSize: 15 }}>{remaining}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Result card (slides up from bottom) ─────────────────────── */}
      {phase === "feedback" && lastResult && (
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-[400px] rounded-2xl p-5 text-center"
          style={{
            backgroundColor: "white",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            animation: "slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        >
          {lastResult.distanceKm !== null ? (
            <>
              <p className="text-2xl font-black mb-1" style={{ color: getAccuracyLabel(lastResult.distanceKm).color }}>
                {getAccuracyLabel(lastResult.distanceKm).label}
              </p>
              <p className="text-lg font-semibold" style={{ color: "#555" }}>
                You were {formatDistance(lastResult.distanceKm)} away
              </p>
            </>
          ) : (
            <p className="text-2xl font-black" style={{ color: "#e74c3c" }}>
              Time&apos;s Up! ⏱️
            </p>
          )}
          {/* Auto-advance progress bar */}
          <div className="h-1 mt-4 rounded-full overflow-hidden" style={{ backgroundColor: "#eee" }}>
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: "#2c3e50",
                animation: `fillBar ${FEEDBACK_DELAY_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(120%); }
          to { transform: translateX(-50%) translateY(0); }
        }
        @keyframes fillBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ── Utility functions ─────────────────────────────────────────────────────────

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(2)}km`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setSourceData(map: MapLibreMap | null, sourceId: string, data: any) {
  if (!map) return;
  const src = map.getSource(sourceId);
  if (src && "setData" in src) {
    (src as unknown as { setData: (d: unknown) => void }).setData(data);
  }
}

function clearMapMarkers(map: MapLibreMap | null) {
  if (!map) return;
  for (const id of [MARKER_SOURCE, CORRECT_SOURCE]) {
    setSourceData(map, id, {
      type: "Feature",
      geometry: { type: "Point", coordinates: [0, -90] },
      properties: {},
    });
  }
  setSourceData(map, LINE_SOURCE, {
    type: "Feature",
    geometry: { type: "LineString", coordinates: [] },
    properties: {},
  });
  setSourceData(map, HINT_RING_SOURCE, {
    type: "FeatureCollection",
    features: [],
  });
}

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

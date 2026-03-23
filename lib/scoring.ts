/**
 * Scoring algorithms for all game types.
 *
 * North vs South (binary_sort):
 * - Correct answer: score = Math.max(100, Math.floor(1000 * (1 - elapsed/timeLimitMs)))
 *   → Fast correct = up to 1000pts, slow correct = minimum 100pts, timeout/wrong = 0pts
 * - Wrong answer: 0 pts
 * - Timeout (no answer): 0 pts
 * - Max per round: 1000. Max game (15 rounds): 15000.
 */

export interface BinarySortRoundInput {
  correct: boolean;
  timeRemainingMs: number;
  timeLimitMs: number;
}

export function scoreBinarySortRound({
  correct,
  timeRemainingMs,
  timeLimitMs,
}: BinarySortRoundInput): number {
  if (!correct) return 0;
  const elapsedMs = timeLimitMs - timeRemainingMs;
  return Math.max(100, Math.floor(1000 * (1 - elapsedMs / timeLimitMs)));
}

export function buildBinarySortShareText(params: {
  score: number;
  maxScore: number;
  rounds: number;
  correctCount: number;
  shareGrid: string;
  date: string;
}): string {
  const { score, maxScore, rounds, correctCount, shareGrid, date } = params;
  return [
    `Canberra Times — North vs South`,
    date,
    ``,
    shareGrid,
    ``,
    `${correctCount}/${rounds} correct · ${score}/${maxScore} pts`,
    `games.canberratimes.com.au/north-vs-south`,
  ].join("\n");
}

/**
 * Convert a score to a rank label.
 * Used across binary sort variants.
 */
export function getBinarySortRank(score: number, maxScore: number): string {
  // Thresholds match the original prototype (out of 15,000 max)
  if (score >= 12000) return "The Skywhale 🐋";
  if (score >= 8000)  return "Kingsley's Chicken 🍗";
  if (score >= 4000)  return "APS Level 4 📎";
  return "Stuck at a Roundabout 😵‍💫";
  void maxScore; // retained for API compatibility
}

// ── Location Guess (Hunt the Landmark) ────────────────────────────────────────

/** Earth radius used by haversine — 6371 km */
const EARTH_R_KM = 6371;
const LOCATION_MAX_POINTS = 1000;
const LOCATION_DISTANCE_HALF_KM = 3; // Score halves at 3km error

/**
 * Haversine distance between two lat/lng coordinates in kilometres.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Score a location guess.
 * Base score = 1000 / (1 + distanceKm / 3).
 * Time bonus adds up to 20% for instant answers.
 */
export function scoreLocationGuess(
  distanceKm: number,
  timeRemainingMs: number,
  timeLimitMs: number
): number {
  const distanceScore = LOCATION_MAX_POINTS / (1 + distanceKm / LOCATION_DISTANCE_HALF_KM);
  const timeRatio = timeLimitMs > 0 ? Math.max(0, Math.min(1, timeRemainingMs / timeLimitMs)) : 0;
  return Math.round(distanceScore * (1 + 0.2 * timeRatio));
}

// ── Timeline Guess (Flashback Friday) ─────────────────────────────────────────

/**
 * Score a year guess for the Flashback Friday / timeline_guess game.
 * Exact = 100, off by 1 = 90, off by 2 = 80 ... off by 30+ = 0.
 */
export function scoreTimelineYear(guessed: number, actual: number): number {
  const error = Math.abs(guessed - actual);
  if (error === 0) return 100;
  if (error <= 1) return 90;
  if (error <= 2) return 80;
  if (error <= 5) return 70;
  if (error <= 10) return 50;
  if (error <= 15) return 30;
  if (error <= 20) return 15;
  if (error <= 30) return 5;
  return 0;
}

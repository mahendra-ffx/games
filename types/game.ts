/**
 * Shared game types used across all renderers.
 * Every game config is a discriminated union keyed on game_type.
 */

// ── Binary Sort (North vs South) ─────────────────────────────────────────────

export interface BinarySortCategory {
  color: string;
  label: string;
}

export interface BinarySortItem {
  name: string;
  category: string;
  /** Optional lat/lng for hint map flash */
  lat?: number;
  lng?: number;
}

export interface BinarySortConfig {
  game_type: "binary_sort";
  date: string;
  rounds: number;
  time_per_round_ms: number;
  categories: Record<string, BinarySortCategory>;
  items: BinarySortItem[];
  /** GeoJSON line coords [[lat,lng], ...] for "The Wall" divider */
  divider_line: [number, number][];
}

// ── Crossword ────────────────────────────────────────────────────────────────

export interface CrosswordConfig {
  game_type: "crossword";
  date: string;
  size: number;
  clues: {
    across: Record<string, string>;
    down: Record<string, string>;
  };
}

// ── Landmark Hunt ─────────────────────────────────────────────────────────────

export interface LandmarkHuntLocation {
  name: string;
  emoji: string;
  lat: number;
  lng: number;
}

export interface LandmarkHuntConfig {
  game_type: "landmark_hunt";
  date: string;
  rounds: number;
  time_limit_sec: number;
  locations: LandmarkHuntLocation[];
}

// ── Suburb Challenge ─────────────────────────────────────────────────────────

export interface SuburbChallengeConfig {
  game_type: "suburb_challenge";
  region: string;
  center: [number, number];
  zoom: number;
  suburbs: string[];
  happy_images: string[];
  sad_images: string[];
  ranks: Record<string, string>;
}

// ── Timeline Guess (Flashback Friday) ────────────────────────────────────────

export interface TimelinePhoto {
  image: string;
  year: number;
  credit: string;
  desc: string;
  hint_decade: string;
  hint_context: string;
}

export interface TimelineGuessConfig {
  game_type: "timeline_guess";
  date: string;
  title: string;
  year_range: [number, number];
  photos: TimelinePhoto[];
}

// ── Union ─────────────────────────────────────────────────────────────────────

export type GameConfig =
  | BinarySortConfig
  | CrosswordConfig
  | LandmarkHuntConfig
  | SuburbChallengeConfig
  | TimelineGuessConfig;

// ── Round result ──────────────────────────────────────────────────────────────

export interface RoundResult {
  item: string;
  correctCategory: string;
  playerCategory: string | null; // null = timed out
  correct: boolean;
  timeMs: number;
  points: number;
}

// ── Score share emoji grid ─────────────────────────────────────────────────────

export function buildShareGrid(results: RoundResult[]): string {
  const emojis = results.map((r) => {
    if (!r.playerCategory) return "⬛"; // timeout
    return r.correct ? "🟦" : "🟥";
  });
  // 5 per row
  const rows: string[] = [];
  for (let i = 0; i < emojis.length; i += 5) {
    rows.push(emojis.slice(i, i + 5).join(""));
  }
  return rows.join("\n");
}

/**
 * lib/sanity.ts
 *
 * Sanity.io CMS client for fetching game configs.
 * Used in server-side data fetching (page.tsx files and API routes).
 *
 * Environment variables required:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID — Sanity project ID
 *   NEXT_PUBLIC_SANITY_DATASET    — "production" or "staging"
 *   SANITY_API_TOKEN              — Server-only read token (for draft preview)
 *
 * In production, game pages use ISR (revalidate = 3600).
 * On Sanity publish, a webhook fires:
 *   → Cloudflare cache purge for the game's CDN endpoint
 *   → Next.js ISR revalidation via /api/revalidate
 */

import type {
  BinarySortConfig,
  CrosswordConfig,
  LandmarkHuntConfig,
  SuburbChallengeConfig,
  TimelineGuessConfig,
} from "@/types/game";

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";
const API_VERSION = "2024-01-01";
const TOKEN = process.env.SANITY_API_TOKEN ?? "";

// ── Raw Sanity fetch ──────────────────────────────────────────────────────────

async function sanityFetch<T>(
  query: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  if (!PROJECT_ID) {
    // Not configured — return null so callers fall back to local JSON
    return null;
  }

  const encodedQuery = encodeURIComponent(query);
  const encodedParams = encodeURIComponent(JSON.stringify(params));
  const url = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}?query=${encodedQuery}&$params=${encodedParams}`;

  const res = await fetch(url, {
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;
  const data = await res.json();
  return (data.result ?? null) as T;
}

// ── GROQ queries per game type ────────────────────────────────────────────────

const QUERIES = {
  binarySort: (date: string) =>
    `*[_type == "binarySort" && date == "${date}" && status == "published"][0]`,
  crossword: (date: string) =>
    `*[_type == "crossword" && date == "${date}" && status == "published"][0]`,
  landmarkHunt: (date: string) =>
    `*[_type == "landmarkHunt" && date == "${date}" && status == "published"][0]`,
  suburbChallenge: (region: string) =>
    `*[_type == "suburbChallenge" && region == "${region}" && status == "published"] | order(_updatedAt desc)[0]`,
  timelineGuess: (date: string) =>
    `*[_type == "timelineGuess" && date == "${date}" && status == "published"][0]`,
  latestBinarySort: () =>
    `*[_type == "binarySort" && status == "published"] | order(date desc)[0]`,
  latestCrossword: () =>
    `*[_type == "crossword" && status == "published"] | order(date desc)[0]`,
  latestLandmarkHunt: () =>
    `*[_type == "landmarkHunt" && status == "published"] | order(date desc)[0]`,
  latestTimeline: () =>
    `*[_type == "timelineGuess" && status == "published"] | order(date desc)[0]`,
  /** Hub cards — latest published game per type */
  hubGames: () =>
    `{
      "binarySort": *[_type == "binarySort" && status == "published"] | order(date desc)[0] { date, _id },
      "crossword": *[_type == "crossword" && status == "published"] | order(date desc)[0] { date, _id },
      "landmarkHunt": *[_type == "landmarkHunt" && status == "published"] | order(date desc)[0] { date, _id },
      "timelineGuess": *[_type == "timelineGuess" && status == "published"] | order(date desc)[0] { date, _id }
    }`,
};

// ── Public helpers ────────────────────────────────────────────────────────────

export async function getBinarySortConfig(date: string): Promise<BinarySortConfig | null> {
  return sanityFetch<BinarySortConfig>(QUERIES.binarySort(date));
}

export async function getLatestBinarySortConfig(): Promise<BinarySortConfig | null> {
  return sanityFetch<BinarySortConfig>(QUERIES.latestBinarySort());
}

export async function getCrosswordConfig(date: string): Promise<CrosswordConfig | null> {
  return sanityFetch<CrosswordConfig>(QUERIES.crossword(date));
}

export async function getLatestCrosswordConfig(): Promise<CrosswordConfig | null> {
  return sanityFetch<CrosswordConfig>(QUERIES.latestCrossword());
}

export async function getLandmarkHuntConfig(date: string): Promise<LandmarkHuntConfig | null> {
  return sanityFetch<LandmarkHuntConfig>(QUERIES.landmarkHunt(date));
}

export async function getLatestLandmarkHuntConfig(): Promise<LandmarkHuntConfig | null> {
  return sanityFetch<LandmarkHuntConfig>(QUERIES.latestLandmarkHunt());
}

export async function getSuburbChallengeConfig(
  region: string
): Promise<SuburbChallengeConfig | null> {
  return sanityFetch<SuburbChallengeConfig>(QUERIES.suburbChallenge(region));
}

export async function getLatestTimelineConfig(): Promise<TimelineGuessConfig | null> {
  return sanityFetch<TimelineGuessConfig>(QUERIES.latestTimeline());
}

export async function getHubGames(): Promise<Record<string, { date: string; _id: string }> | null> {
  return sanityFetch<Record<string, { date: string; _id: string }>>(QUERIES.hubGames());
}

/**
 * GET /api/widget
 *
 * Returns a JSON payload consumed by Suzuka (site builder) to embed a
 * games strip on the main canberratimes.com.au homepage.
 *
 * Cached at CDN edge with a 1-hour TTL, revalidated on new game publish.
 * Falls back to static game list when Sanity is not configured.
 */

import { NextRequest, NextResponse } from "next/server";
import { getHubGames } from "@/lib/sanity";

interface GameWidgetItem {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  isFree: boolean;
  gameType: string;
  hasNewContent: boolean;
}

interface WidgetResponse {
  games: GameWidgetItem[];
  updatedAt: string;
}

// Static fallback game list (used when Sanity is not configured)
const STATIC_GAMES: GameWidgetItem[] = [
  {
    title: "North vs South",
    description: "Is that suburb north or south of the lake? Race the clock.",
    url: "/north-vs-south",
    isFree: true,
    gameType: "binary_sort",
    hasNewContent: true,
  },
  {
    title: "Daily Mini Crossword",
    description: "A fresh 5×5 crossword every day with emoji clues.",
    url: "/crossword",
    isFree: false,
    gameType: "crossword",
    hasNewContent: true,
  },
  {
    title: "Hunt the Landmark",
    description: "Spot 10 Canberra landmarks against the clock.",
    url: "/landmark",
    isFree: false,
    gameType: "landmark_hunt",
    hasNewContent: true,
  },
  {
    title: "Flashback Friday",
    description: "Guess the year from archive Canberra photos.",
    url: "/flashback",
    isFree: false,
    gameType: "timeline_guess",
    hasNewContent: new Date().getDay() === 5, // Only new on Fridays
  },
];

export async function GET(_req: NextRequest): Promise<NextResponse<WidgetResponse>> {
  // Compute today's AEDT date inline (avoid browser-only lib/storage import)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Canberra" });

  // Try to enrich with Sanity metadata (which games have fresh content today)
  let games = STATIC_GAMES;

  try {
    const hubData = await getHubGames();
    if (hubData) {
      games = STATIC_GAMES.map((g) => {
        const sanityKey = sanityKeyMap[g.gameType];
        const sanityEntry = sanityKey ? hubData[sanityKey] : undefined;
        return {
          ...g,
          hasNewContent: sanityEntry ? sanityEntry.date === today : g.hasNewContent,
        };
      });
    }
  } catch {
    // Sanity unavailable — serve static list
  }

  return NextResponse.json(
    { games, updatedAt: new Date().toISOString() },
    {
      headers: {
        // Cache at CDN — max 1 hour, stale-while-revalidate for 5 mins
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
        // Allow Suzuka to embed this endpoint cross-origin
        "Access-Control-Allow-Origin": "https://www.canberratimes.com.au",
      },
    }
  );
}

const sanityKeyMap: Record<string, string> = {
  binary_sort: "binarySort",
  crossword: "crossword",
  landmark_hunt: "landmarkHunt",
  timeline_guess: "timelineGuess",
};

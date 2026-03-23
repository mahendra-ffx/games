/**
 * POST /api/score
 *
 * Submit a game score and update cloud-synced streak for authenticated users.
 * Anonymous users get a 200 but data is not persisted server-side.
 *
 * Rate limited: 10 req/min (authenticated), 5 req/min (anonymous)
 *
 * Storage: Cloudflare KV (leaderboard aggregates) + D1 (individual scores).
 * During the experiment phase the KV/D1 writes are stubbed with TODO comments
 * but the validation, rate limiting, and score sanitisation logic is live.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

interface ScoreRequest {
  gameType: string;
  gameId: string;
  date: string; // YYYY-MM-DD
  score: number;
  timeSpent: number; // seconds
  completed: boolean;
  streakLength?: number;
}

interface ScoreResponse {
  saved: boolean;
  reason?: string;
  rank?: number;
}

const VALID_GAME_TYPES = new Set([
  "binary_sort",
  "crossword",
  "landmark_hunt",
  "suburb_challenge",
  "timeline_guess",
]);

const MAX_SCORES: Record<string, number> = {
  binary_sort: 1500,    // 15 rounds × 100pts max
  crossword: 1000,
  landmark_hunt: 10000, // 10 rounds × 1000pts max
  suburb_challenge: 1000,
  timeline_guess: 900,  // 9 photos × 100pts max
};

export async function POST(req: NextRequest): Promise<NextResponse<ScoreResponse>> {
  const rateLimit = await checkRateLimit(req, "score");
  if (!rateLimit.allowed) {
    return NextResponse.json({ saved: false, reason: "rate_limited" }, { status: 429 });
  }

  let body: ScoreRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ saved: false, reason: "invalid_json" }, { status: 400 });
  }

  const { gameType, gameId, date, score, timeSpent, completed, streakLength } = body;

  // Validate required fields
  if (!gameType || !gameId || !date || score === undefined) {
    return NextResponse.json({ saved: false, reason: "missing_fields" }, { status: 400 });
  }

  // Validate game type
  if (!VALID_GAME_TYPES.has(gameType)) {
    return NextResponse.json({ saved: false, reason: "invalid_game_type" }, { status: 400 });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ saved: false, reason: "invalid_date" }, { status: 400 });
  }

  // Validate score is a non-negative finite number within plausible range
  if (typeof score !== "number" || score < 0 || !Number.isFinite(score)) {
    return NextResponse.json({ saved: false, reason: "invalid_score" }, { status: 400 });
  }

  const maxScore = MAX_SCORES[gameType] ?? 10000;
  if (score > maxScore) {
    // Flag suspicious score but still acknowledge — don't reveal the cap to clients
    Sentry.captureMessage("Suspicious score submitted", {
      level: "warning",
      tags: { game_type: gameType },
      extra: { score, maxScore, gameId },
    });
    return NextResponse.json({ saved: false, reason: "invalid_score" }, { status: 400 });
  }

  // Check Piano session cookie to determine authentication
  const pianoUid = req.cookies.get("__ppid")?.value;
  const isAuthenticated = Boolean(pianoUid);

  if (!isAuthenticated) {
    // Anonymous — acknowledge receipt but don't persist server-side
    return NextResponse.json({ saved: false, reason: "anonymous" });
  }

  try {
    // ── Persist score to Cloudflare D1 ─────────────────────────────────────
    // TODO: Wire to Cloudflare D1 in production
    // await env.DB.prepare(
    //   `INSERT OR REPLACE INTO scores
    //    (piano_uid, game_type, game_id, date, score, time_spent, completed, streak_length, submitted_at)
    //    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    // ).bind(pianoUid, gameType, gameId, date, score, timeSpent, completed ? 1 : 0, streakLength ?? 0).run();

    // ── Update leaderboard aggregate in Cloudflare KV ──────────────────────
    // Key pattern: leaderboard:{gameType}:{YYYY-MM} → sorted list of {uid, score}
    // TODO: Wire to Cloudflare KV in production
    // const monthKey = `leaderboard:${gameType}:${date.slice(0, 7)}`;
    // const existing = await env.KV.get(monthKey, "json") ?? [];
    // const updated = upsertScore(existing, pianoUid, score);
    // await env.KV.put(monthKey, JSON.stringify(updated), { expirationTtl: 90 * 24 * 3600 });

    // Suppress unused variable warnings until TODO is wired
    void timeSpent;
    void completed;
    void streakLength;

    return NextResponse.json({ saved: true });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { game_type: gameType, context: "score_route" },
      extra: { gameId, date },
    });
    return NextResponse.json({ saved: false, reason: "server_error" }, { status: 500 });
  }
}

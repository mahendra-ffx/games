/**
 * GET /api/streak?gameType=binary_sort&uid=xxx
 * Returns cloud-synced streak for an authenticated user.
 *
 * POST /api/streak
 * Body: { gameType, streak: StreakData, uid }
 * Upserts streak data to Cloudflare KV (keyed by uid:gameType).
 *
 * Only authenticated users (valid Piano session cookie) can read/write streaks.
 * Anonymous users get local-only streaks via IndexedDB.
 */

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import type { StreakData } from "@/lib/storage";

function getAuthenticatedUid(req: NextRequest): string | null {
  // Piano session cookie is __ppid on the shared .canberratimes.com.au domain
  const session = req.cookies.get("__ppid")?.value;
  return session ?? null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const uid = getAuthenticatedUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const gameType = req.nextUrl.searchParams.get("gameType");
  if (!gameType) {
    return NextResponse.json({ error: "Missing gameType" }, { status: 400 });
  }

  try {
    const streak = await getStreakFromKV(uid, gameType);
    return NextResponse.json({ streak });
  } catch (err) {
    Sentry.captureException(err, { tags: { context: "streak_get" } });
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const uid = getAuthenticatedUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let body: { gameType: string; streak: StreakData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gameType, streak } = body;

  if (!gameType || !streak) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Validate streak shape
  if (
    typeof streak.current !== "number" ||
    typeof streak.longest !== "number" ||
    typeof streak.lastPlayedDate !== "string"
  ) {
    return NextResponse.json({ error: "Invalid streak data" }, { status: 400 });
  }

  // Sanity check: streak values can't be absurdly large
  if (streak.current > 3650 || streak.longest > 3650) {
    return NextResponse.json({ error: "Invalid streak values" }, { status: 400 });
  }

  try {
    await putStreakToKV(uid, gameType, streak);
    return NextResponse.json({ saved: true });
  } catch (err) {
    Sentry.captureException(err, { tags: { context: "streak_post" } });
    return NextResponse.json({ error: "Failed to save streak" }, { status: 500 });
  }
}

// ── KV storage helpers ────────────────────────────────────────────────────────
// TODO (Week 5+): Replace with Cloudflare KV binding via @cloudflare/next-on-pages
// For now: in-process Map (dev/experiment only — resets on each deployment)

const kvStore = new Map<string, StreakData>();

async function getStreakFromKV(uid: string, gameType: string): Promise<StreakData> {
  const key = `streak:${uid}:${gameType}`;
  return (
    kvStore.get(key) ?? { current: 0, longest: 0, lastPlayedDate: "" }
  );
}

async function putStreakToKV(
  uid: string,
  gameType: string,
  streak: StreakData
): Promise<void> {
  const key = `streak:${uid}:${gameType}`;
  const existing = kvStore.get(key);

  // Server is the authority on longest streak — never let client downgrade it
  const merged: StreakData = {
    current: streak.current,
    longest: Math.max(streak.longest, existing?.longest ?? 0),
    lastPlayedDate: streak.lastPlayedDate,
  };

  kvStore.set(key, merged);
}

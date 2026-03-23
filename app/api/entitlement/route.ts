/**
 * GET /api/entitlement?uid=xxx
 *
 * Returns the Piano entitlement tier for a given user.
 * Called by lib/piano.ts checkEntitlement() after Piano.getUser().
 *
 * In production this verifies the Piano session server-side via Piano's
 * Publisher API. For the experiment, it reads the session cookie and
 * returns "basic" for authenticated users (Piano SDK handles premium gating
 * on the client via checkEntitlement in the Piano JS SDK directly).
 */

import { NextRequest, NextResponse } from "next/server";
import type { UserTier } from "@/lib/piano";

export async function GET(req: NextRequest): Promise<NextResponse<{ tier: UserTier }>> {
  const session = req.cookies.get("__ppid")?.value;

  if (!session) {
    return NextResponse.json({ tier: "anonymous" });
  }

  // TODO (production): Call Piano Publisher API to verify session + entitlements
  // const pianoTier = await verifyPianoSession(session);
  // For experiment: authenticated = basic tier minimum
  // Piano SDK on the client already gates premium content — this endpoint
  // is just used to sync the tier server-side for API route decisions.

  return NextResponse.json({ tier: "basic" });
}

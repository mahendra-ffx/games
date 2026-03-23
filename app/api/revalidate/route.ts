/**
 * POST /api/revalidate
 *
 * Triggered by Sanity webhook on content publish.
 * Revalidates the ISR cache for the relevant game page.
 *
 * Body: { gameType: string, region?: string, secret: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "";

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { gameType?: string; region?: string; secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!REVALIDATE_SECRET || body.secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const paths: string[] = ["/"];

  switch (body.gameType) {
    case "binary_sort": paths.push("/north-vs-south"); break;
    case "crossword": paths.push("/crossword"); break;
    case "landmark_hunt": paths.push("/landmark"); break;
    case "suburb_challenge":
      if (body.region) paths.push(`/map/${body.region}`);
      break;
    case "timeline_guess": paths.push("/flashback"); break;
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: paths });
}

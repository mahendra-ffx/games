/**
 * POST /api/validate
 *
 * Server-side answer validation. Solutions are NEVER sent to the client.
 * The client submits a guess; the server compares against the stored answer.
 *
 * Rate limited: 30 req/min (authenticated), 15 req/min (anonymous)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

interface ValidateRequest {
  gameType: string;
  gameId: string;
  guess: unknown;
}

interface ValidateResponse {
  correct: boolean;
  feedback?: string;
  letter?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit check
  const rateLimit = await checkRateLimit(req, "validate");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  let body: ValidateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gameType, gameId, guess } = body;

  if (!gameType || !gameId || guess === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await validateGuess(gameType, gameId, guess);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { game_type: gameType, context: "validate_route" },
    });
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}

/**
 * Validate a guess against the stored answer for a game.
 *
 * Solutions are stored server-side only — loaded from env or CMS.
 * The client NEVER sees the answer; it only sends guesses.
 *
 * In production: fetch from Sanity CMS via secret API token.
 * For experiment: use hardcoded answer maps keyed by gameId.
 */
async function validateGuess(
  gameType: string,
  gameId: string,
  guess: unknown
): Promise<ValidateResponse> {
  if (gameType === "crossword") {
    return validateCrosswordGuess(gameId, guess as CrosswordGuess);
  }

  // Other game types validated differently (suburb click is client-side visible,
  // landmark distance is geometric — only crossword needs server-side letter check)
  return { correct: false, feedback: "Validation not supported for this game type via this endpoint" };
}

// ── Crossword validation ──────────────────────────────────────────────────────

interface CrosswordGuess {
  row: number;
  col: number;
  letter: string | null;
  reveal?: boolean;
}

/**
 * Crossword answers keyed by gameId (date string).
 * In production, these come from Sanity CMS via the secret token.
 * NEVER expose this object to the client.
 *
 * Grid is stored as a flat array of 25 letters (row-major, '' for black cells).
 */
/**
 * Crossword solution grid (row-major, 25 entries for 5×5).
 * " " marks black cells — these are never validated against a player guess.
 *
 * Correct layout (matches prototype):
 *   H E A R T   row 0  (1-Across: HEART)
 *   E ■ R ■ E   row 1  — black at [1,1] and [1,3]
 *   A R E N A   row 2  (4-Across: ARENA)
 *   P ■ A ■ M   row 3  — black at [3,1] and [3,3]
 *   S T A R S   row 4  (5-Across: STARS)
 *
 * Down words:  1=HEAPS  2=AREAA*  3=TEAMS
 * (* 2-Down has a content inconsistency in the prototype grid — editor to resolve)
 */
const CROSSWORD_SOLUTIONS: Record<string, string[]> = {
  "crossword_2026-03-22": [
    "H","E","A","R","T",   // row 0: HEART   (1-Across)
    "E"," ","R"," ","E",   // row 1: E■R■E   (black at cols 1,3)
    "A","R","E","N","A",   // row 2: ARENA   (4-Across)
    "P"," ","A"," ","M",   // row 3: P■A■M   (black at cols 1,3)
    "S","T","A","R","S",   // row 4: STARS   (5-Across)
  ],
};

async function validateCrosswordGuess(
  gameId: string,
  guess: CrosswordGuess
): Promise<ValidateResponse> {
  const solution = CROSSWORD_SOLUTIONS[gameId];
  if (!solution) {
    return { correct: false, feedback: "Game not found" };
  }

  const { row, col, letter, reveal } = guess;
  const size = 5;

  if (row < 0 || row >= size || col < 0 || col >= size) {
    return { correct: false, feedback: "Invalid cell" };
  }

  const cellIndex = row * size + col;
  const correctLetter = solution[cellIndex];

  if (correctLetter === " ") {
    return { correct: false, feedback: "Black cell" };
  }

  if (reveal) {
    // Hint: reveal the correct letter (costs token — deducted client-side)
    return { correct: true, feedback: correctLetter, letter: correctLetter };
  }

  if (!letter) {
    return { correct: false, feedback: "No letter provided" };
  }

  const correct = letter.toUpperCase() === correctLetter;
  return { correct, feedback: correct ? "Correct!" : "Incorrect" };
}

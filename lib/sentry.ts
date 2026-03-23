/**
 * Sentry helpers
 *
 * Centralises error reporting with consistent context tags.
 * All errors carry: piano_uid, game_type, user_type, masthead.
 */

import * as Sentry from "@sentry/nextjs";
import type { UserType } from "@/lib/analytics";

export interface GameErrorContext {
  gameType?: string;
  userType?: UserType;
  pianoUid?: string;
  round?: number;
  extra?: Record<string, unknown>;
}

/**
 * Set user context on Sentry scope.
 * Call this once after Piano resolves the user.
 */
export function setSentryUser(pianoUid: string, userType: UserType): void {
  Sentry.setUser({ id: pianoUid });
  Sentry.setTag("user_type", userType);
  Sentry.setTag("masthead", process.env.NEXT_PUBLIC_MASTHEAD ?? "unknown");
}

/**
 * Clear user context (on logout).
 */
export function clearSentryUser(): void {
  Sentry.setUser(null);
}

/**
 * Capture a game-specific error with standardised context.
 */
export function captureGameError(
  error: unknown,
  context: GameErrorContext = {}
): void {
  Sentry.withScope((scope) => {
    if (context.gameType) scope.setTag("game_type", context.gameType);
    if (context.userType) scope.setTag("user_type", context.userType);
    if (context.pianoUid) scope.setUser({ id: context.pianoUid });
    if (context.round !== undefined) scope.setExtra("round", context.round);
    if (context.extra) {
      Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture a non-fatal warning (e.g. Piano degradation, SW cache miss).
 */
export function captureGameWarning(
  message: string,
  context: GameErrorContext = {}
): void {
  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    if (context.gameType) scope.setTag("game_type", context.gameType);
    Sentry.captureMessage(message);
  });
}

/**
 * Wrap an async function with Sentry error capture.
 * Returns undefined on error rather than throwing — safe for fire-and-forget calls.
 */
export async function withSentryCapture<T>(
  fn: () => Promise<T>,
  context: GameErrorContext = {}
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    captureGameError(err, context);
    return undefined;
  }
}

/**
 * PostHog analytics helpers
 *
 * All events carry piano_uid as a user property — this is the join key
 * to Dijon subscription data for churn/retention analysis.
 *
 * Event taxonomy defined in CLAUDE.md §9.
 */

// posthog-js is browser-only — guard against SSR evaluation.
// All analytics functions become no-ops on the server.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const posthog: any =
  typeof window !== "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("posthog-js").default
    : { identify: () => {}, reset: () => {}, capture: () => {} };

export type UserType = "anonymous" | "basic" | "premium";

// ── User identification ────────────────────────────────────────────────────

export function identifyUser(pianoUid: string, userType: UserType): void {
  posthog.identify(pianoUid, { user_type: userType });
}

export function resetUser(): void {
  posthog.reset();
}

// ── Core game events ───────────────────────────────────────────────────────

export function trackGameStart(params: {
  gameType: string;
  gameId: string;
  date: string;
  isFree: boolean;
  userType: UserType;
}): void {
  posthog.capture("game_start", params);
}

export function trackGameComplete(params: {
  gameType: string;
  gameId?: string;
  score: number;
  timeSpent: number;
  attempts: number;
  streakLength: number;
}): void {
  posthog.capture("game_complete", params);
}

export function trackGameAbandon(params: {
  gameType: string;
  progressPct: number;
  timeBeforeAbandon: number;
}): void {
  posthog.capture("game_abandon", params);
}

// ── Social / sharing ───────────────────────────────────────────────────────

export function trackShareResult(params: {
  gameType: string;
  score: number;
  shareChannel: string;
  streakLength: number;
}): void {
  posthog.capture("share_result", params);
}

export function trackShareClickThrough(params: {
  shareId: string;
  landingGame: string;
  convertedToPlay: boolean;
}): void {
  posthog.capture("share_click_through", params);
}

// ── Paywall / conversion ───────────────────────────────────────────────────

export function trackPaywallImpression(params: {
  gameType: string;
  userGamesPlayed: number;
  triggerContext: string;
}): void {
  posthog.capture("paywall_impression", params);
}

export function trackPaywallClick(params: {
  ctaVariant: string;
  priceShown: string;
  userStreakLength: number;
}): void {
  posthog.capture("paywall_click", params);
}

export function trackSubscriptionStart(params: {
  planType: string;
  entryPoint: string;
  referrerGame: string;
}): void {
  posthog.capture("subscription_start", params);
}

// ── Engagement ─────────────────────────────────────────────────────────────

export function trackStreakMilestone(params: {
  streakLength: number;
  gameType: string;
}): void {
  posthog.capture("streak_milestone", params);
}

/**
 * THE key metric: subscriber cross-engagement (news + games).
 * Fired at end of session when both games and articles were read.
 */
export function trackCrossEngage(params: {
  sessionGamesPlayed: number;
  sessionArticlesRead: number;
}): void {
  posthog.capture("cross_engage", params);
}

// ── Hints ──────────────────────────────────────────────────────────────────

export function trackHintUsed(params: {
  gameType: string;
  hintTier: number;
  round: number;
  timeBeforeHint: number;
}): void {
  posthog.capture("hint_used", params);
}

// ── Push notifications ─────────────────────────────────────────────────────

export function trackPushReceived(params: {
  notificationType: string;
  gameType: string;
}): void {
  posthog.capture("push_received", params);
}

export function trackPushOpened(params: {
  notificationType: string;
  gameType: string;
}): void {
  posthog.capture("push_opened", params);
}

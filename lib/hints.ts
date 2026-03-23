/**
 * Hint token economy
 *
 * Tokens reset at midnight AEDT daily.
 * Free/basic: 3 tokens/day. Premium: 5 tokens/day.
 *
 * Hint costs per game (from CLAUDE.md §8):
 * - Crossword: Check cell (0) → Reveal letter (1) → Reveal word (2)
 * - Landmark Hunt: Zoom to district (1) → Distance ring 2km (2)
 * - Map Games: Highlight neighbours (1)
 * - North vs South: Brief map flash (1)
 * - Flashback Friday: Decade bracket (1) → Context clue (1)
 */

import { getHintBalance, spendHintToken, getTodayAEDT } from "@/lib/storage";
import { trackHintUsed } from "@/lib/analytics";
import type { UserType } from "@/lib/analytics";

export type GameType =
  | "crossword"
  | "landmark_hunt"
  | "suburb_challenge"
  | "binary_sort"
  | "timeline_guess";

export interface HintConfig {
  tier: 1 | 2;
  cost: number;
  label: string;
  description: string;
}

export const HINT_CONFIGS: Record<GameType, HintConfig[]> = {
  crossword: [
    { tier: 1, cost: 0, label: "Check cell", description: "See if your letter is correct" },
    { tier: 2, cost: 1, label: "Reveal letter", description: "Reveal one letter" },
  ],
  landmark_hunt: [
    { tier: 1, cost: 1, label: "Zoom to district", description: "Narrow down the area" },
    { tier: 2, cost: 2, label: "Distance ring", description: "Show a 2km radius ring" },
  ],
  suburb_challenge: [
    { tier: 1, cost: 1, label: "Highlight neighbours", description: "Show neighbouring suburbs" },
  ],
  binary_sort: [
    { tier: 1, cost: 1, label: "Map flash", description: "Briefly see the suburb on the map" },
  ],
  timeline_guess: [
    { tier: 1, cost: 1, label: "Decade bracket", description: "Narrow down to a decade" },
    { tier: 2, cost: 1, label: "Context clue", description: "Get a written context clue" },
  ],
};

/**
 * Attempt to use a hint. Returns true if successful, false if insufficient tokens.
 * Tracks the event in PostHog regardless.
 */
export async function useHint(params: {
  gameType: GameType;
  hintTier: 1 | 2;
  round: number;
  timeIntoGame: number;
  userType: UserType;
}): Promise<{ success: boolean; remainingTokens: number; hint: HintConfig }> {
  const hints = HINT_CONFIGS[params.gameType];
  const hint = hints.find((h) => h.tier === params.hintTier);

  if (!hint) throw new Error(`No tier-${params.hintTier} hint for ${params.gameType}`);

  const today = getTodayAEDT();
  const balance = await getHintBalance(params.userType, today);

  if (balance < hint.cost) {
    return { success: false, remainingTokens: balance, hint };
  }

  const spent = hint.cost > 0 ? await spendHintToken(hint.cost) : true;

  if (spent) {
    trackHintUsed({
      gameType: params.gameType,
      hintTier: params.hintTier,
      round: params.round,
      timeBeforeHint: params.timeIntoGame,
    });
  }

  return {
    success: spent,
    remainingTokens: balance - hint.cost,
    hint,
  };
}

export async function getAvailableHints(
  gameType: GameType,
  userType: UserType
): Promise<{ configs: HintConfig[]; balance: number }> {
  const today = getTodayAEDT();
  const balance = await getHintBalance(userType, today);
  return { configs: HINT_CONFIGS[gameType] ?? [], balance };
}

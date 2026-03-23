/**
 * agents/crossword-agent.ts
 *
 * AI agent: generates a locally-themed 5×5 crossword and pushes it to Sanity
 * as a "draft" for editorial review.
 *
 * Execution: Cloud Function (scheduled daily at 06:00 AEDT).
 * Output is NEVER auto-published — editor must approve in Sanity Studio.
 *
 * Pipeline:
 * 1. Query Silverstone (ACM story archive) for recent local stories
 * 2. Extract 5-6 key themes / proper nouns
 * 3. Call Claude API (via Sochi outbound proxy) with structured output prompt
 * 4. Validate JSON output against crossword schema
 * 5. Push draft to Sanity CMS
 * 6. Notify editor via Slack webhook
 *
 * TODO Week 10+: Wire to Claude API + Silverstone + Sanity write endpoint.
 */

interface CrosswordDraft {
  date: string;
  size: number;
  solution: string[];
  clues: {
    across: Record<string, string>;
    down: Record<string, string>;
  };
}

interface AgentContext {
  masthead: string;
  targetDate: string;
  slackWebhookUrl?: string;
}

export async function runCrosswordAgent(context: AgentContext): Promise<void> {
  const { masthead, targetDate } = context;

  console.log(`[crossword-agent] Generating crossword for ${masthead} on ${targetDate}`);

  // Step 1: Fetch recent stories from Silverstone
  // const stories = await fetchSilverstoneStories(masthead, { limit: 20, days: 7 });

  // Step 2: Extract themes
  // const themes = await extractThemes(stories);

  // Step 3: Generate crossword via Claude API
  // const draft = await generateWithClaude(themes, targetDate);

  // Step 4: Validate
  // validateCrosswordDraft(draft);

  // Step 5: Push to Sanity as draft
  // await pushToSanity(draft, masthead);

  // Step 6: Notify editor
  // await notifyEditor(context.slackWebhookUrl, targetDate, masthead);

  console.log("[crossword-agent] Stub complete — wire to Claude API in Week 10+");
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateCrosswordDraft(draft: CrosswordDraft): void {
  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    throw new Error("Invalid date format");
  }
  if (draft.size !== 5) {
    throw new Error("Only 5×5 grids supported");
  }
  if (!Array.isArray(draft.solution) || draft.solution.length !== 25) {
    throw new Error("Solution must be a 25-element array");
  }
  if (!draft.clues.across || Object.keys(draft.clues.across).length === 0) {
    throw new Error("Across clues are required");
  }
  if (!draft.clues.down || Object.keys(draft.clues.down).length === 0) {
    throw new Error("Down clues are required");
  }
}

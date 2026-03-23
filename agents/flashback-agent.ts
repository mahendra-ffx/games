/**
 * agents/flashback-agent.ts
 *
 * AI agent: queries Valencia (ACM digital asset management) for archive photos
 * with date metadata, then generates a Flashback Friday set as a Sanity draft.
 *
 * Execution: Cloud Function (scheduled weekly — Wednesday 06:00 AEDT).
 * Output is NEVER auto-published — editor must approve in Sanity Studio.
 *
 * Pipeline:
 * 1. Query Valencia API for photos with `dateCreated` metadata, filtering by masthead
 * 2. Select up to 12 candidates across different decades
 * 3. Call Claude API (via Sochi) to generate editorial descriptions + hint clues
 * 4. Call Transform API to generate responsive image URLs for each photo
 * 5. Validate output against timelineGuess schema
 * 6. Push 9-photo batch to Sanity as draft
 * 7. Notify editor via Slack
 *
 * TODO Week 10+: Wire to Valencia + Transform + Claude API + Sanity.
 */

interface FlashbackDraft {
  date: string;
  title: string;
  year_range: [number, number];
  photos: {
    image: string;
    year: number;
    credit: string;
    desc: string;
    hint_decade: string;
    hint_context: string;
  }[];
}

interface AgentContext {
  masthead: string;
  targetFriday: string; // YYYY-MM-DD
  slackWebhookUrl?: string;
}

export async function runFlashbackAgent(context: AgentContext): Promise<void> {
  const { masthead, targetFriday } = context;

  console.log(`[flashback-agent] Generating Flashback Friday for ${masthead} on ${targetFriday}`);

  // Step 1: Query Valencia for archive photos
  // const candidates = await queryValencia(masthead, { hasDates: true, limit: 40 });

  // Step 2: Select diverse set across decades
  // const selected = selectByDecade(candidates, 9);

  // Step 3: Generate descriptions via Claude
  // const withDesc = await enrichWithClaude(selected);

  // Step 4: Get responsive image URLs from Transform
  // const withImages = await transformImages(withDesc, { width: 800, format: "webp" });

  // Step 5: Validate
  // validateFlashbackDraft({ date: targetFriday, title: "Flashback Friday", ... });

  // Step 6: Push to Sanity
  // await pushToSanity(draft, masthead);

  // Step 7: Notify
  // await notifyEditor(context.slackWebhookUrl, targetFriday, masthead);

  console.log("[flashback-agent] Stub complete — wire to Valencia + Claude API in Week 10+");
}

export function validateFlashbackDraft(draft: FlashbackDraft): void {
  if (draft.photos.length < 1 || draft.photos.length > 9) {
    throw new Error("Flashback set must have 1-9 photos");
  }
  for (const photo of draft.photos) {
    if (!photo.image || !photo.year || !photo.desc) {
      throw new Error("Each photo requires image, year, and desc");
    }
    if (photo.year < 1900 || photo.year > new Date().getFullYear()) {
      throw new Error(`Invalid year: ${photo.year}`);
    }
  }
}

/**
 * app/archive/page.tsx
 *
 * Browse past daily games.
 * Premium feature: anonymous/basic users see a teaser (last 7 days),
 * premium users can access the full archive.
 *
 * Data: Sanity query for published games, ordered by date desc.
 * Falls back to static placeholder list when Sanity is unconfigured.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Archive | Daily Games | The Canberra Times",
  description: "Browse past Canberra Times daily game challenges.",
};

export const revalidate = 3600;

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArchiveEntry {
  date: string; // YYYY-MM-DD
  gameType: "binary_sort" | "crossword" | "landmark_hunt" | "timeline_guess";
  title: string;
  href: string;
  emoji: string;
  isPremium: boolean;
}

// ── Static placeholder archive (TODO: replace with Sanity query) ───────────────

function generatePlaceholderArchive(): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  const baseDate = new Date("2026-03-22");
  const gameTypes: Array<Omit<ArchiveEntry, "date" | "href">> = [
    { gameType: "binary_sort", title: "North vs South", emoji: "🗺️", isPremium: false },
    { gameType: "crossword", title: "Daily Mini Crossword", emoji: "✏️", isPremium: true },
    { gameType: "landmark_hunt", title: "Hunt the Landmark", emoji: "🏛️", isPremium: true },
    { gameType: "timeline_guess", title: "Flashback Friday", emoji: "📷", isPremium: true },
  ];

  for (let i = 0; i < 30; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    for (const g of gameTypes) {
      // Flashback is Friday-only
      if (g.gameType === "timeline_guess" && d.getDay() !== 5) continue;

      const hrefMap: Record<string, string> = {
        binary_sort: `/north-vs-south?date=${dateStr}`,
        crossword: `/crossword?date=${dateStr}`,
        landmark_hunt: `/landmark?date=${dateStr}`,
        timeline_guess: `/flashback?date=${dateStr}`,
      };

      entries.push({ ...g, date: dateStr, href: hrefMap[g.gameType] });
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function groupByDate(entries: ArchiveEntry[]): Map<string, ArchiveEntry[]> {
  const map = new Map<string, ArchiveEntry[]>();
  for (const entry of entries) {
    const existing = map.get(entry.date) ?? [];
    existing.push(entry);
    map.set(entry.date, existing);
  }
  return map;
}

function formatArchiveDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Canberra",
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArchivePage() {
  const archive = generatePlaceholderArchive();
  const grouped = groupByDate(archive);
  const dates = Array.from(grouped.keys()).slice(0, 30);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="type-hero" style={{ color: "var(--text-primary)" }}>
          Archive
        </h1>
        <p className="type-body mt-2" style={{ color: "var(--text-secondary)" }}>
          Every past puzzle, ready to replay. Premium members get unlimited access.
        </p>
      </div>

      {/* Premium gate banner */}
      <div
        className="rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div>
          <p
            className="type-label"
            style={{ color: "var(--color-ct-blue)" }}
          >
            Premium Feature
          </p>
          <p className="type-body mt-1" style={{ color: "var(--text-primary)" }}>
            <strong>Unlimited archive access</strong> is available to premium subscribers.
            Free members can replay the last 7 days.
          </p>
        </div>
        <Link
          href="/subscribe"
          className="type-button px-5 py-2.5 rounded-lg text-white shrink-0"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          Upgrade
        </Link>
      </div>

      {/* Archive list grouped by date */}
      <div className="space-y-8">
        {dates.map((date, dateIdx) => {
          const entries = grouped.get(date)!;
          const isLocked = dateIdx >= 7; // Lock entries older than 7 days for non-premium

          return (
            <section key={date} aria-label={formatArchiveDate(date)}>
              {/* Date heading */}
              <h2
                className="type-label mb-3"
                style={{ color: "var(--text-secondary)" }}
              >
                {formatArchiveDate(date)}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {entries.map((entry) => (
                  <ArchiveCard
                    key={`${entry.date}-${entry.gameType}`}
                    entry={entry}
                    isLocked={isLocked && entry.isPremium}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Load more — placeholder */}
      <div className="mt-10 text-center">
        <button
          className="type-button px-6 py-3 rounded-lg"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
          disabled
          aria-disabled="true"
        >
          Load earlier games (Premium)
        </button>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link
          href="/"
          className="type-body"
          style={{ color: "var(--color-ct-blue)" }}
        >
          ← Back to games
        </Link>
      </div>
    </div>
  );
}

// ── ArchiveCard ───────────────────────────────────────────────────────────────

function ArchiveCard({
  entry,
  isLocked,
}: {
  entry: ArchiveEntry;
  isLocked: boolean;
}) {
  const content = (
    <div
      className="flex items-center gap-3 p-4 rounded-xl transition-colors"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
        opacity: isLocked ? 0.6 : 1,
      }}
    >
      <span className="text-2xl" aria-hidden="true">
        {isLocked ? "🔒" : entry.emoji}
      </span>
      <div className="min-w-0">
        <p className="type-body font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {entry.title}
        </p>
        {entry.isPremium && !isLocked && (
          <p className="type-label mt-0.5" style={{ color: "var(--color-ct-blue)" }}>
            Premium
          </p>
        )}
        {isLocked && (
          <p className="type-label mt-0.5" style={{ color: "var(--text-muted)" }}>
            Upgrade to play
          </p>
        )}
      </div>
    </div>
  );

  if (isLocked) {
    return (
      <Link href="/subscribe" aria-label={`Upgrade to play ${entry.title} from ${entry.date}`}>
        {content}
      </Link>
    );
  }

  return (
    <Link href={entry.href} aria-label={`Play ${entry.title} from ${entry.date}`}>
      {content}
    </Link>
  );
}

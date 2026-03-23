/**
 * app/leaderboard/page.tsx
 *
 * Unified cross-game leaderboard.
 * Authenticated users see their rank and top scores.
 * Anonymous users see the board but are prompted to sign in.
 *
 * Data: In production, scores come from Cloudflare D1/KV.
 * During the experiment phase we use static placeholder data.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaderboard | Daily Games | The Canberra Times",
  description: "See how you rank against other Canberra Times games players.",
};

export const revalidate = 300; // 5-minute leaderboard refresh

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  streak: number;
  gamesPlayed: number;
  badge?: string;
}

type GameFilter = "all" | "binary_sort" | "crossword" | "landmark_hunt" | "suburb_challenge" | "timeline_guess";

interface GameTab {
  key: GameFilter;
  label: string;
  emoji: string;
}

// ── Static data (TODO: replace with Cloudflare D1 query in production) ────────

const GAME_TABS: GameTab[] = [
  { key: "all", label: "All Games", emoji: "🏆" },
  { key: "binary_sort", label: "North vs South", emoji: "🗺️" },
  { key: "crossword", label: "Crossword", emoji: "✏️" },
  { key: "landmark_hunt", label: "Landmark Hunt", emoji: "🏛️" },
  { key: "suburb_challenge", label: "Suburb Challenge", emoji: "📍" },
  { key: "timeline_guess", label: "Flashback", emoji: "📷" },
];

// Placeholder entries — these will be real scores from Cloudflare D1 in production
const PLACEHOLDER_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, displayName: "CapitolHillGuru", score: 9840, streak: 47, gamesPlayed: 89, badge: "🔥" },
  { rank: 2, displayName: "LakeSideLocal", score: 9210, streak: 31, gamesPlayed: 74, badge: "⭐" },
  { rank: 3, displayName: "BraddonBrain", score: 8870, streak: 22, gamesPlayed: 65, badge: "✨" },
  { rank: 4, displayName: "GungahlinGenius", score: 8340, streak: 18, gamesPlayed: 58 },
  { rank: 5, displayName: "TuggeranongTitan", score: 7920, streak: 15, gamesPlayed: 52 },
  { rank: 6, displayName: "InnerNorthNerd", score: 7680, streak: 12, gamesPlayed: 49 },
  { rank: 7, displayName: "WodenWizard", score: 7210, streak: 9, gamesPlayed: 44 },
  { rank: 8, displayName: "CanberraCracker", score: 6980, streak: 8, gamesPlayed: 40 },
  { rank: 9, displayName: "FlindersSt_Fan", score: 6540, streak: 7, gamesPlayed: 37 },
  { rank: 10, displayName: "SouthsideChamp", score: 6120, streak: 6, gamesPlayed: 33 },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Canberra",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <p className="type-label" style={{ color: "var(--color-ct-blue)" }}>
          {today}
        </p>
        <h1 className="type-hero mt-1" style={{ color: "var(--text-primary)" }}>
          Leaderboard
        </h1>
        <p className="type-body mt-2" style={{ color: "var(--text-secondary)" }}>
          Top players across all daily games. Scores reset monthly.
        </p>
      </div>

      {/* Game filter tabs */}
      <div
        className="flex flex-wrap gap-2 mb-6 pb-4"
        style={{ borderBottom: "1px solid var(--border)" }}
        role="tablist"
        aria-label="Filter by game"
      >
        {GAME_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={tab.key === "all"}
            className="type-label px-3 py-1.5 rounded-full text-xs transition-colors"
            style={
              tab.key === "all"
                ? {
                    backgroundColor: "var(--color-ct-blue)",
                    color: "#fff",
                  }
                : {
                    backgroundColor: "var(--bg-surface)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }
            }
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Sign-in prompt */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--color-warning-bg)",
          color: "var(--color-warning-text)",
        }}
        role="status"
      >
        <p className="type-body text-sm">
          <strong>Sign in</strong> to see your rank and sync your streak across devices.
        </p>
        <Link
          href="/sign-in"
          className="type-button px-4 py-2 rounded-lg text-white text-xs shrink-0"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          Sign In
        </Link>
      </div>

      {/* Leaderboard table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {/* Table header */}
        <div
          className="grid gap-4 px-4 py-3 type-label text-xs"
          style={{
            gridTemplateColumns: "3rem 1fr 6rem 5rem 5rem",
            backgroundColor: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Streak</span>
          <span className="text-right">Games</span>
        </div>

        {/* Entries */}
        {PLACEHOLDER_ENTRIES.map((entry, idx) => (
          <LeaderboardRow key={entry.rank} entry={entry} isEven={idx % 2 === 0} />
        ))}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        {[
          { label: "Players this month", value: "1,284" },
          { label: "Games completed", value: "9,470" },
          { label: "Avg streak", value: "6 days" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-4 text-center"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
          >
            <p
              className="type-hero"
              style={{ color: "var(--color-ct-blue)", fontSize: "1.5rem" }}
            >
              {stat.value}
            </p>
            <p className="type-label mt-1" style={{ color: "var(--text-secondary)" }}>
              {stat.label}
            </p>
          </div>
        ))}
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

// ── LeaderboardRow ────────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  isEven,
}: {
  entry: LeaderboardEntry;
  isEven: boolean;
}) {
  const medalEmoji =
    entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : null;

  return (
    <div
      className="grid gap-4 px-4 py-3 items-center"
      style={{
        gridTemplateColumns: "3rem 1fr 6rem 5rem 5rem",
        backgroundColor: isEven ? "transparent" : "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Rank */}
      <span
        className="type-label font-bold text-sm"
        style={{ color: medalEmoji ? "var(--color-ct-blue)" : "var(--text-muted)" }}
      >
        {medalEmoji ?? `#${entry.rank}`}
      </span>

      {/* Player name */}
      <span className="type-body truncate" style={{ color: "var(--text-primary)" }}>
        {entry.displayName}
        {entry.badge && (
          <span className="ml-1.5" aria-label="achievement">
            {entry.badge}
          </span>
        )}
      </span>

      {/* Score */}
      <span
        className="type-label text-right font-bold"
        style={{ color: "var(--text-primary)" }}
      >
        {entry.score.toLocaleString()}
      </span>

      {/* Streak */}
      <span className="text-right">
        <span className="streak-badge">🔥 {entry.streak}</span>
      </span>

      {/* Games played */}
      <span
        className="type-label text-right"
        style={{ color: "var(--text-secondary)" }}
      >
        {entry.gamesPlayed}
      </span>
    </div>
  );
}

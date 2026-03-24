import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Daily Games | The Canberra Times",
  description: "Play daily puzzles, map games and more. New challenges every day.",
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

// ── Game definitions ───────────────────────────────────────────────────────────

interface GameDef {
  id: string;
  href: string;
  title: string;
  emoji: string;
  color: string;          // flat background for NYT-style header
  badge?: string;         // "FREE" | "NEW" corner badge
  actions: { label: string; href: string }[];
  description?: string;   // optional subtitle below title
}

const GAMES: GameDef[] = [
  {
    id: "north-vs-south",
    href: "/north-vs-south",
    title: "North vs South",
    emoji: "🧭",
    color: "#0c4a6e",
    badge: "FREE",
    description: "North or south of the lake? 15 rounds, beat the clock.",
    actions: [
      { label: "Play", href: "/north-vs-south" },
    ],
  },
  {
    id: "crossword",
    href: "/crossword",
    title: "Daily Crossword",
    emoji: "✏️",
    color: "#4c1d95",
    description: "5x5 grid with emoji clues. A new puzzle every day.",
    actions: [
      { label: "Play", href: "/crossword" },
      { label: "Archive", href: "/archive" },
    ],
  },
  {
    id: "suburb-challenge",
    href: "/map/inner",
    title: "Suburb Challenge",
    emoji: "📍",
    color: "#064e3b",
    actions: [
      { label: "Play", href: "/map/inner" },
      { label: "All Regions", href: "/map/inner" },
    ],
  },
  {
    id: "landmark-hunt",
    href: "/landmark",
    title: "Hunt the Landmark",
    emoji: "🏛️",
    color: "#78350f",
    badge: "NEW",
    actions: [
      { label: "Play", href: "/landmark" },
    ],
  },
  {
    id: "flashback",
    href: "/flashback",
    title: "Flashback Friday",
    emoji: "📷",
    color: "#44403c",
    description: "Guess the year from Canberra archive photos.",
    actions: [
      { label: "Play", href: "/flashback" },
      { label: "Past Puzzles", href: "/archive" },
    ],
  },
];

const MAP_REGIONS = [
  { href: "/map/inner", label: "Inner Canberra", free: true },
  { href: "/map/belconnen", label: "Belconnen", free: false },
  { href: "/map/gungahlin", label: "Gungahlin", free: false },
  { href: "/map/tuggeranong", label: "Tuggeranong", free: false },
  { href: "/map/woden", label: "Woden / Weston", free: false },
  { href: "/map/master", label: "All Canberra", free: false },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GamesHubPage() {
  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Canberra",
  });

  return (
    <div style={{ backgroundColor: "var(--bg-page)" }}>
      {/* ── Hub intro strip ─────────────────────────────────────── */}
      <div
        className="border-b"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-surface)" }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <p className="type-label" style={{ color: "var(--color-ct-blue)" }}>
            {today.toUpperCase()}
          </p>
          <Link
            href="/leaderboard"
            className="type-label flex items-center gap-1 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>🏆</span>
            <span>Leaderboard</span>
          </Link>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 lg:py-12">

        {/* ── Section heading ──────────────────────────────────── */}
        <h2
          className="type-hero text-center mb-8"
          style={{ color: "var(--text-primary)", fontSize: "clamp(1.5rem, 3vw, 2rem)" }}
        >
          Today&apos;s Games
        </h2>

        {/* ── NYT-inspired game card grid ──────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {GAMES.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </section>

        {/* ── Suburb Challenge region strip ──────────────────────── */}
        <section
          className="rounded-xl p-5 mb-10 border"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="type-headline" style={{ color: "var(--text-primary)" }}>
              Suburb Challenge
            </h2>
            <span className="type-label" style={{ color: "var(--text-secondary)" }}>
              Choose your region
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MAP_REGIONS.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="type-label px-4 py-2 rounded-full border transition-colors text-xs"
                style={{
                  borderColor: r.free ? "var(--color-ct-blue)" : "var(--border-strong)",
                  color: r.free ? "var(--color-ct-blue)" : "var(--text-secondary)",
                }}
              >
                {r.label}
                {r.free && (
                  <span
                    className="ml-1.5 px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: "var(--color-ct-blue)", fontSize: "9px" }}
                  >
                    FREE
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* ── Footer strip ──────────────────────────────────────── */}
        <div
          className="flex flex-wrap gap-x-6 gap-y-2 pt-6 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          {[
            { href: "/leaderboard", label: "Leaderboard" },
            { href: "/archive", label: "Game archive" },
            { href: "/north-vs-south", label: "Today's free game" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="type-body text-sm transition-opacity hover:opacity-70"
              style={{ color: "var(--color-ct-blue)" }}
            >
              {l.label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NYT-inspired game card ────────────────────────────────────────────────────

function GameCard({ game }: { game: GameDef }) {
  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Colored header with emoji icon */}
      <div
        className="relative flex items-center justify-center"
        style={{ backgroundColor: game.color, height: "180px" }}
        aria-hidden="true"
      >
        <span className="text-7xl select-none drop-shadow-lg">{game.emoji}</span>

        {/* Corner badge (FREE / NEW) */}
        {game.badge && (
          <span
            className="absolute top-3 right-3 type-label px-2.5 py-1 rounded text-white text-xs tracking-wider"
            style={{
              backgroundColor: game.badge === "FREE" ? "var(--color-ct-blue)" : "#111827",
            }}
          >
            {game.badge}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 px-5 pt-5 pb-4 text-center">
        {/* Game title — Playfair Display */}
        <h3
          className="type-headline mb-1"
          style={{
            color: "var(--text-primary)",
            fontSize: "1.25rem",
            fontWeight: 600,
          }}
        >
          {game.title}
        </h3>

        {/* Optional short description */}
        {game.description && (
          <p
            className="type-body text-sm mb-3"
            style={{ color: "var(--text-secondary)", lineHeight: "1.5" }}
          >
            {game.description}
          </p>
        )}

        {/* Spacer to push buttons to bottom */}
        <div className="flex-1" />

        {/* Action buttons — outlined pill style like NYT */}
        <div className="flex flex-col gap-2 mt-3">
          {game.actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="pill-btn type-button py-2.5 rounded-full border text-center text-sm"
              style={{
                borderColor: "var(--border-strong)",
                color: "var(--text-primary)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={undefined}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

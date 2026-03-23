import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Daily Games | The Canberra Times",
  description: "Play daily puzzles, map games and more. New challenges every day.",
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

// ── Game definitions ───────────────────────────────────────────────────────────

const FEATURED_GAME = {
  id: "north-vs-south",
  href: "/north-vs-south",
  title: "North vs South",
  category: "Free Daily",
  description:
    "Is that Canberra suburb north or south of the lake? Race the clock — 15 rounds, 5 seconds each. The fastest fingers in the ACT play every day.",
  emoji: "🗺️",
  isFree: true,
  gradient: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 45%, #0ea5e9 100%)",
  accentColor: "#0ea5e9",
  tagline: "2 min · Free to play · Share your score",
} as const;

const GAMES = [
  {
    id: "suburb-challenge",
    href: "/map/inner",
    title: "Suburb Challenge",
    category: "Map Game",
    description:
      "Click the highlighted suburb on the map. Inner Canberra is free — unlock Belconnen, Gungahlin, Tuggeranong and Woden.",
    emoji: "📍",
    isFree: false,
    gradient: "linear-gradient(135deg, #064e3b 0%, #059669 60%, #34d399 100%)",
    accentColor: "#10b981",
  },
  {
    id: "landmark-hunt",
    href: "/landmark",
    title: "Hunt the Landmark",
    category: "Map Game",
    description:
      "60+ Canberra landmarks. 8 seconds per round. Pin the exact spot on the map before time runs out.",
    emoji: "🏛️",
    isFree: false,
    gradient: "linear-gradient(135deg, #78350f 0%, #b45309 50%, #fbbf24 100%)",
    accentColor: "#f59e0b",
  },
  {
    id: "crossword",
    href: "/crossword",
    title: "Daily Mini Crossword",
    category: "Word Game",
    description:
      "A fresh 5×5 crossword every day with emoji clues and locally themed answers. How fast can you finish?",
    emoji: "✏️",
    isFree: false,
    gradient: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #a78bfa 100%)",
    accentColor: "#8b5cf6",
  },
  {
    id: "flashback",
    href: "/flashback",
    title: "Flashback Friday",
    category: "Archive",
    description:
      "Guess the year of iconic Canberra archive photos. Watch them transform from sepia to full colour as you get closer.",
    emoji: "📷",
    isFree: false,
    gradient: "linear-gradient(135deg, #44403c 0%, #78716c 50%, #d4a574 100%)",
    accentColor: "#a8956a",
  },
] as const;

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

        {/* ── Featured hero game ─────────────────────────────────── */}
        <section className="mb-10">
          <FeaturedGameCard game={FEATURED_GAME} />
        </section>

        {/* ── Section divider ────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <h2
            className="type-headline flex-shrink-0"
            style={{ color: "var(--text-primary)" }}
          >
            More Games
          </h2>
          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border)" }} />
          <Link
            href="/archive"
            className="type-label flex-shrink-0 transition-opacity hover:opacity-70"
            style={{ color: "var(--text-secondary)" }}
          >
            Archive →
          </Link>
        </div>

        {/* ── Game card grid ─────────────────────────────────────── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
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
                  backgroundColor: r.free ? "transparent" : "transparent",
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

// ── Featured hero card ─────────────────────────────────────────────────────────

interface FeaturedGame {
  href: string;
  title: string;
  category: string;
  description: string;
  emoji: string;
  gradient: string;
  accentColor: string;
  tagline: string;
}

function FeaturedGameCard({ game }: { game: FeaturedGame }) {
  return (
    <article
      className="overflow-hidden rounded-xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: `1px solid var(--border)`,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Thumbnail — gradient with emoji */}
        <div
          className="relative flex items-center justify-center"
          style={{
            background: game.gradient,
            minHeight: "260px",
          }}
          aria-hidden="true"
        >
          {/* Decorative map grid lines */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <span className="relative text-8xl drop-shadow-lg select-none">{game.emoji}</span>
          {/* Free badge */}
          <span
            className="absolute top-4 left-4 type-label px-3 py-1 rounded-full text-white text-xs"
            style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
          >
            FREE DAILY
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col justify-center p-7 lg:p-10">
          <p className="type-label mb-2" style={{ color: "var(--text-secondary)" }}>
            {game.category.toUpperCase()}
          </p>
          <h2
            className="type-hero mb-3"
            style={{ color: "var(--text-primary)", fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}
          >
            {game.title}
          </h2>
          <p
            className="type-body mb-2"
            style={{ color: "var(--text-secondary)", lineHeight: "1.65" }}
          >
            {game.description}
          </p>
          <p className="type-label mb-6" style={{ color: "var(--text-muted)" }}>
            {game.tagline}
          </p>
          <Link
            href={game.href}
            className="type-button inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-white transition-opacity hover:opacity-90 self-start"
            style={{ backgroundColor: "var(--color-ct-blue)" }}
          >
            Play Now →
          </Link>
        </div>
      </div>
    </article>
  );
}

// ── Standard game card (Figma editorial style) ─────────────────────────────────

interface GameDef {
  href: string;
  title: string;
  category: string;
  description: string;
  emoji: string;
  isFree: boolean;
  gradient: string;
  accentColor: string;
}

function GameCard({ game }: { game: GameDef }) {
  return (
    <article
      className="game-card flex flex-col overflow-hidden rounded-xl group"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: `1px solid var(--border)`,
      }}
    >
      {/* Thumbnail */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ background: game.gradient, height: "160px" }}
        aria-hidden="true"
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <span className="relative text-5xl drop-shadow select-none transition-transform duration-300 group-hover:scale-110">
          {game.emoji}
        </span>
        {/* Premium lock badge */}
        {!game.isFree && (
          <span
            className="absolute top-3 right-3 type-label px-2 py-0.5 rounded text-white text-xs"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
          >
            PREMIUM
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        <p className="type-label mb-1" style={{ color: "var(--color-gray-500)" }}>
          {game.category.toUpperCase()}
        </p>
        <h3
          className="type-headline mb-2"
          style={{ color: "var(--text-primary)", fontSize: "1.1rem" }}
        >
          {game.title}
        </h3>
        <p
          className="type-body flex-1 mb-4 text-sm"
          style={{ color: "var(--text-secondary)", lineHeight: "1.55" }}
        >
          {game.description}
        </p>
        <Link
          href={game.href}
          className="type-button text-center py-2.5 rounded-lg text-white text-xs transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-ct-blue)" }}
        >
          {game.isFree ? "PLAY FREE" : "PLAY →"}
        </Link>
      </div>
    </article>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Map Games — Suburb Challenge",
  description:
    "Test your Canberra suburb knowledge. Pick a region and click the right suburb on the map before time runs out.",
};

const REGIONS = [
  {
    slug: "inner",
    title: "Inner Canberra",
    description: "Braddon, Civic, Griffith, Kingston and the lake-side suburbs.",
    emoji: "🏙️",
    tier: "free" as const,
  },
  {
    slug: "belconnen",
    title: "Belconnen",
    description: "Bruce, Macquarie, Evatt, Charnwood and the north-west.",
    emoji: "🛒",
    tier: "premium" as const,
  },
  {
    slug: "gungahlin",
    title: "Gungahlin",
    description: "Amaroo, Casey, Bonner, Ngunnawal and the new north.",
    emoji: "🚊",
    tier: "premium" as const,
  },
  {
    slug: "tuggeranong",
    title: "Tuggeranong",
    description: "Kambah, Calwell, Greenway, Gordon and the deep south.",
    emoji: "🏔️",
    tier: "premium" as const,
  },
  {
    slug: "woden",
    title: "Woden & Weston",
    description: "Phillip, Garran, Curtin, Weston Creek and surrounds.",
    emoji: "🏥",
    tier: "premium" as const,
  },
  {
    slug: "master",
    title: "All Canberra",
    description: "The ultimate test — every suburb across all five regions.",
    emoji: "🗺️",
    tier: "premium" as const,
  },
];

export default function MapGamesPage() {
  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      {/* Page header */}
      <p className="type-label mb-1" style={{ color: "var(--color-ct-blue)" }}>
        MAP GAMES
      </p>
      <h1 className="type-hero mb-2" style={{ color: "var(--text-primary)" }}>
        Suburb Challenge
      </h1>
      <p className="type-body mb-8" style={{ color: "var(--text-secondary)" }}>
        A suburb is highlighted on the map — click it before time runs out. Choose
        your region below. Inner Canberra is free to play every day.
      </p>

      {/* Region grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REGIONS.map((region) => (
          <Link
            key={region.slug}
            href={`/map/${region.slug}`}
            className="game-card group block p-5 focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ textDecoration: "none" }}
          >
            {/* Top row: emoji + tier badge */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-3xl leading-none" aria-hidden>
                {region.emoji}
              </span>
              <span
                className="type-label px-2 py-0.5 rounded-full"
                style={
                  region.tier === "free"
                    ? {
                        backgroundColor: "var(--game-correct-bg)",
                        color: "var(--game-correct-text)",
                      }
                    : {
                        backgroundColor: "var(--color-warning-bg)",
                        color: "var(--color-warning-text)",
                      }
                }
              >
                {region.tier === "free" ? "FREE" : "PREMIUM"}
              </span>
            </div>

            {/* Region name */}
            <h2
              className="type-headline mb-1 group-hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {region.title}
            </h2>

            {/* Description */}
            <p className="text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {region.description}
            </p>

            {/* CTA */}
            <p
              className="mt-3 type-label"
              style={{ color: "var(--color-ct-blue)" }}
            >
              Play →
            </p>
          </Link>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-8 text-sm text-center" style={{ color: "var(--text-muted)" }}>
        Premium regions unlock with a Canberra Times subscription.{" "}
        <Link
          href="/north-vs-south"
          className="underline"
          style={{ color: "var(--color-ct-blue)" }}
        >
          Try North vs South
        </Link>{" "}
        — it&apos;s always free.
      </p>
    </div>
  );
}

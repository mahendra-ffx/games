import type { Metadata } from "next";
import { NorthVsSouthLoader } from "./NorthVsSouthLoader";
import type { BinarySortConfig } from "@/types/game";

export const metadata: Metadata = {
  title: "North vs South",
  description:
    "Is that Canberra suburb north or south of the lake? Race the clock — 15 rounds, 5 seconds each.",
  openGraph: {
    title: "North vs South | Canberra Times Games",
    description: "Is that suburb north or south of the lake? Play free every day.",
    images: [{ url: "/og-north-vs-south.png", width: 1200, height: 630 }],
  },
};

// Revalidate every hour — daily game JSON is published at midnight AEDT
export const revalidate = 3600;
export const dynamic = "force-dynamic";

async function getConfig(): Promise<BinarySortConfig> {
  // TODO (Week 10): Fetch from Sanity CMS using lib/sanity.ts
  // For now: serve the bundled Canberra suburb config
  const config = await import("@/data/north-vs-south-canberra.json");
  return config.default as unknown as BinarySortConfig;
}

export default async function NorthVsSouthPage() {
  const config = await getConfig();

  return <NorthVsSouthLoader config={config} />;
}

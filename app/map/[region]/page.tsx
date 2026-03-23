import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuburbLoader } from "./SuburbLoader";
import type { SuburbChallengeConfig } from "@/types/game";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

const REGION_CONFIGS: Record<string, string> = {
  belconnen: "data/suburb-challenge-belconnen.json",
  gungahlin: "data/suburb-challenge-gungahlin.json",
  inner: "data/suburb-challenge-inner.json",
  tuggeranong: "data/suburb-challenge-tuggeranong.json",
  woden: "data/suburb-challenge-woden.json",
  master: "data/suburb-challenge-master.json",
};

const REGION_TITLES: Record<string, string> = {
  belconnen: "Belconnen",
  gungahlin: "Gungahlin",
  inner: "Inner Canberra",
  tuggeranong: "Tuggeranong",
  woden: "Woden & Weston",
  master: "All Canberra",
};

export async function generateStaticParams() {
  return Object.keys(REGION_CONFIGS).map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  const title = REGION_TITLES[region] ?? "Suburb Challenge";
  return {
    title: `${title} Suburb Challenge`,
    description: `Test your ${title} suburb knowledge. Click the right suburb on the map!`,
  };
}

export default async function SuburbChallengePage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;

  if (!REGION_CONFIGS[region]) notFound();

  // Load config from local JSON (TODO Week 10: fetch from Sanity)
  const configModule = await import(
    `@/data/suburb-challenge-${region}.json`
  ).catch(() => null);

  if (!configModule) notFound();

  const config = configModule.default as SuburbChallengeConfig;

  return <SuburbLoader config={config} />;
}

import type { Metadata } from "next";
import { FlashbackLoader } from "./FlashbackLoader";
import config from "@/data/flashback-weekly.json";
import type { TimelineGuessConfig } from "@/types/game";

// Flashback Friday — revalidates weekly (7 days in seconds)
export const revalidate = 604800;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Flashback Friday",
  description: "Guess the year of iconic Canberra archive photos. A fresh set every Friday.",
};

export default function FlashbackPage() {
  return <FlashbackLoader config={config as unknown as TimelineGuessConfig} />;
}

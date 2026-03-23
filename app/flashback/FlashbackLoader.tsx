"use client";
import dynamic from "next/dynamic";
import type { TimelineGuessConfig } from "@/types/game";

const FlashbackGame = dynamic(
  () => import("./FlashbackGame").then((m) => m.FlashbackGame),
  { ssr: false, loading: () => <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading game…</div> }
);

export function FlashbackLoader({ config }: { config: TimelineGuessConfig }) {
  return <FlashbackGame config={config} />;
}

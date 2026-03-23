"use client";
import dynamic from "next/dynamic";
import type { LandmarkHuntConfig } from "@/types/game";

const LandmarkGame = dynamic(
  () => import("./LandmarkGame").then((m) => m.LandmarkGame),
  { ssr: false, loading: () => <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading game…</div> }
);

export function LandmarkLoader({ config }: { config: LandmarkHuntConfig }) {
  return <LandmarkGame config={config} />;
}

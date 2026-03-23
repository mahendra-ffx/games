"use client";
import dynamic from "next/dynamic";
import type { SuburbChallengeConfig } from "@/types/game";

const SuburbGame = dynamic(
  () => import("./SuburbGame").then((m) => m.SuburbGame),
  { ssr: false, loading: () => <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading game…</div> }
);

export function SuburbLoader({ config }: { config: SuburbChallengeConfig }) {
  return <SuburbGame config={config} />;
}

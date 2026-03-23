"use client";
import dynamic from "next/dynamic";
import type { CrosswordConfig } from "@/types/game";

const CrosswordGame = dynamic(
  () => import("./CrosswordGame").then((m) => m.CrosswordGame),
  { ssr: false, loading: () => <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading game…</div> }
);

export function CrosswordLoader({ config }: { config: CrosswordConfig }) {
  return <CrosswordGame config={config} />;
}

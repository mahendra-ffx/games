"use client";
// Client-side loader — prevents SSR for browser-only dependencies
// (canvas-confetti, maplibre-gl, idb-keyval)
import dynamic from "next/dynamic";
import type { BinarySortConfig } from "@/types/game";

const NorthVsSouthGame = dynamic(
  () => import("./NorthVsSouthGame").then((m) => m.NorthVsSouthGame),
  { ssr: false, loading: () => <div className="p-8 text-center" style={{ color: "var(--text-secondary)" }}>Loading game…</div> }
);

export function NorthVsSouthLoader({ config }: { config: BinarySortConfig }) {
  return <NorthVsSouthGame config={config} />;
}

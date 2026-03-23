import type { Metadata } from "next";
import { CrosswordLoader } from "./CrosswordLoader";
import config from "@/data/crossword-daily.json";
import type { CrosswordConfig } from "@/types/game";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Mini Crossword",
  description: "A fresh 5×5 crossword every day. Emoji clues, Canberra themes.",
};

export default function CrosswordPage() {
  return <CrosswordLoader config={config as unknown as CrosswordConfig} />;
}

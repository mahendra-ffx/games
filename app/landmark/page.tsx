import type { Metadata } from "next";
import { LandmarkLoader } from "./LandmarkLoader";
import config from "@/data/landmark-hunt.json";
import type { LandmarkHuntConfig } from "@/types/game";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hunt the Landmark",
  description: "60 Canberra landmarks. 8 seconds each. How well do you know your city?",
};

export default function LandmarkPage() {
  return <LandmarkLoader config={config as unknown as LandmarkHuntConfig} />;
}

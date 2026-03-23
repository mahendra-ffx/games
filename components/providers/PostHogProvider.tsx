"use client";

import { useEffect, useState } from "react";

// PostHog is browser-only — lazy import prevents SSR evaluation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PHProviderType = React.ComponentType<{ client: any; children: React.ReactNode }>;

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [PHProvider, setPHProvider] = useState<PHProviderType | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phClient, setPhClient] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    // Dynamic import ensures PostHog is never bundled into the SSR build
    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
        },
        respect_dnt: true,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        persistence: "localStorage+cookie",
      });

      void import("posthog-js/react").then(({ PostHogProvider: PHProv }) => {
        setPHProvider(() => PHProv as unknown as PHProviderType);
        setPhClient(posthog);
      });
    });
  }, []);

  if (!PHProvider || !phClient) return <>{children}</>;
  return <PHProvider client={phClient}>{children}</PHProvider>;
}

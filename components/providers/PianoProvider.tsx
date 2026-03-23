"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { initPiano, getPianoUser, checkEntitlement } from "@/lib/piano";
import type { PianoUser, UserTier } from "@/lib/piano";

interface PianoContextValue {
  user: PianoUser | null;
  tier: UserTier;
  isLoading: boolean;
  openCheckout: () => void;
  openLogin: () => void;
}

const PianoContext = createContext<PianoContextValue | null>(null);

export function PianoProvider({
  children,
  masthead,
}: {
  children: React.ReactNode;
  masthead: string;
}) {
  const [user, setUser] = useState<PianoUser | null>(null);
  const [tier, setTier] = useState<UserTier>("anonymous");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initPiano(masthead)
      .then(async () => {
        const pianoUser = await getPianoUser();
        if (pianoUser) {
          setUser(pianoUser);
          const entitlement = await checkEntitlement(pianoUser.uid);
          setTier(entitlement);
        }
      })
      .catch((err) => {
        // Piano outage — degrade gracefully, all users treated as anonymous
        console.error("[Piano] Init failed, degrading to anonymous:", err);
        import("@sentry/nextjs").then(({ captureException }) =>
          captureException(err, { tags: { context: "piano_init" } })
        );
      })
      .finally(() => setIsLoading(false));
  }, [masthead]);

  const openCheckout = useCallback(() => {
    if (typeof window === "undefined") return;
    window.tp?.offer?.startCheckout?.();
  }, []);

  const openLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    window.tp?.pianoId?.show?.({ screen: "login" });
  }, []);

  return (
    <PianoContext.Provider
      value={{ user, tier, isLoading, openCheckout, openLogin }}
    >
      {children}
    </PianoContext.Provider>
  );
}

export function usePiano() {
  const ctx = useContext(PianoContext);
  if (!ctx) throw new Error("usePiano must be used within PianoProvider");
  return ctx;
}

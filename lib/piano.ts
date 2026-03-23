/**
 * Piano SDK wrapper
 *
 * Piano is the primary reader auth system. This module:
 * - Initialises the Piano TP object (loaded via script tag in layout.tsx)
 * - Provides typed helpers for user/session/entitlement checks
 * - Implements a circuit breaker: if Piano fails, all users degrade to anonymous
 *
 * NEVER expose raw tp object outside this file.
 */

export type UserTier = "anonymous" | "basic" | "premium";

export interface PianoUser {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
}

// Extend window type for Piano's tp object
declare global {
  interface Window {
    tp?: {
      push: (args: unknown[]) => void;
      pianoId?: {
        show: (opts: { screen: string }) => void;
        isUserValid: () => boolean;
        getUser: () => { uid: string; email: string; firstName: string; lastName: string } | null;
      };
      offer?: {
        startCheckout: () => void;
      };
      experience?: {
        init: () => void;
      };
    };
  }
}

const PIANO_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Piano timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Initialise Piano SDK for a given masthead.
 * Resolves once tp is ready, rejects on timeout.
 */
export async function initPiano(_masthead: string): Promise<void> {
  if (typeof window === "undefined") return;

  return withTimeout(
    new Promise<void>((resolve) => {
      // tp may already be available if script loaded synchronously
      const tryInit = () => {
        if (window.tp) {
          window.tp.push(["setAid", process.env.NEXT_PUBLIC_PIANO_AID ?? ""]);
          window.tp.push(["setSandbox", process.env.NODE_ENV !== "production"]);
          window.tp.push(["addHandler", "init", resolve]);
          window.tp.experience?.init();
        } else {
          // Poll until the Piano script loads
          setTimeout(tryInit, 100);
        }
      };
      tryInit();
    }),
    PIANO_TIMEOUT_MS
  );
}

/**
 * Get the currently authenticated Piano user.
 * Returns null if not logged in.
 */
export async function getPianoUser(): Promise<PianoUser | null> {
  if (typeof window === "undefined" || !window.tp?.pianoId) return null;

  if (!window.tp.pianoId.isUserValid()) return null;

  const raw = window.tp.pianoId.getUser();
  if (!raw) return null;

  return {
    uid: raw.uid,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
  };
}

/**
 * Check a user's entitlement tier.
 * Falls back to "basic" if the Piano entitlement API is unavailable.
 */
export async function checkEntitlement(uid: string): Promise<UserTier> {
  if (!uid) return "anonymous";

  try {
    const res = await withTimeout(
      fetch(`/api/entitlement?uid=${encodeURIComponent(uid)}`),
      PIANO_TIMEOUT_MS
    );

    if (!res.ok) return "basic";
    const data = (await res.json()) as { tier: UserTier };
    return data.tier ?? "basic";
  } catch {
    // Circuit breaker: Piano down → degrade gracefully
    return "basic";
  }
}

"use client";

/**
 * PushOptIn
 *
 * Modal shown after the user's first game completion.
 * Requests Web Push permission and registers the subscription.
 * Only rendered once — once dismissed or accepted, preference is stored
 * in IndexedDB via UserPreferences so it is not shown again.
 */

import { useState } from "react";
import { optInToPush, isPushSupported } from "@/lib/push";
import { setPreference } from "@/lib/storage";
import { captureGameError } from "@/lib/sentry";

interface PushOptInProps {
  uid?: string;
  onDismiss: () => void;
}

export function PushOptIn({ uid, onDismiss }: PushOptInProps) {
  const [loading, setLoading] = useState(false);

  if (!isPushSupported()) return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await optInToPush(uid);
    } catch (err) {
      captureGameError(err, { extra: { context: "push_opt_in" } });
    } finally {
      await setPreference("pushOptInSeen", true);
      setLoading(false);
      onDismiss();
    }
  };

  const handleDecline = async () => {
    await setPreference("pushOptInSeen", true);
    onDismiss();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-opt-in-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <div className="text-3xl mb-3 text-center">🔔</div>

        <h2
          id="push-opt-in-title"
          className="type-headline text-center mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Never miss a daily game
        </h2>

        <p
          className="type-body text-center mb-6"
          style={{ color: "var(--text-secondary)" }}
        >
          Get a notification each morning when your next Canberra Times game is ready.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="type-button w-full py-3 rounded-lg text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-ct-blue)" }}
          >
            {loading ? "Setting up…" : "Yes, remind me daily"}
          </button>

          <button
            onClick={handleDecline}
            className="type-button w-full py-3 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

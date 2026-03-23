"use client";

/**
 * OfflineBanner
 *
 * Shown when the browser reports navigator.onLine === false.
 * Game state is saved locally to IndexedDB so play can continue offline.
 * The banner reassures the user that their progress is safe.
 */

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-40 py-2 px-4 text-center type-label text-white"
      style={{ backgroundColor: "#b45309" }} // amber-700 — warning, not error
    >
      You&rsquo;re offline — your progress is saved locally and will sync when you reconnect.
    </div>
  );
}

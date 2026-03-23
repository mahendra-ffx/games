"use client";

/**
 * useOnlineStatus
 *
 * Tracks browser online/offline state.
 * On reconnect, flushes the IndexedDB offline event queue.
 */

import { useEffect, useState, useCallback } from "react";
import { flushEventQueue } from "@/lib/storage";
import { captureGameWarning } from "@/lib/sentry";

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const handleOnline = useCallback(async () => {
    setIsOnline(true);
    try {
      await flushEventQueue();
    } catch (err) {
      captureGameWarning("Offline queue flush failed on reconnect", {
        extra: { error: String(err) },
      });
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}

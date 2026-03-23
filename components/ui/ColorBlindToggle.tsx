"use client";

/**
 * components/ui/ColorBlindToggle.tsx
 *
 * Adds/removes the `colour-blind` class on <html> so CSS pattern overlays
 * replace colour-only game state indicators with accessible patterns.
 *
 * Persisted in IndexedDB via setPreference("colourBlindMode").
 * Loaded on mount from getPreference("colourBlindMode").
 *
 * Used in the settings panel (accessible via GameShell settings cog).
 */

import { useEffect, useState } from "react";
import { getPreference, setPreference } from "@/lib/storage";

export default function ColorBlindToggle() {
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read saved preference on mount
  useEffect(() => {
    getPreference("colourBlindMode").then((val) => {
      setEnabled(val);
      applyClass(val);
      setMounted(true);
    });
  }, []);

  function applyClass(active: boolean) {
    if (active) {
      document.documentElement.classList.add("colour-blind");
    } else {
      document.documentElement.classList.remove("colour-blind");
    }
  }

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    applyClass(next);
    await setPreference("colourBlindMode", next);
  }

  // Don't render until we've read prefs (avoids flicker)
  if (!mounted) return null;

  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={toggle}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-colors text-left"
      style={{
        backgroundColor: enabled ? "var(--bg-surface)" : "transparent",
        border: `1px solid ${enabled ? "var(--color-ct-blue)" : "var(--border)"}`,
      }}
    >
      {/* Pattern swatch */}
      <span
        className="w-8 h-8 rounded-md shrink-0 flex items-center justify-center text-lg"
        aria-hidden="true"
        style={{
          background: enabled
            ? "repeating-linear-gradient(45deg, #22c55e, #22c55e 3px, transparent 3px, transparent 8px)"
            : "linear-gradient(135deg, #22c55e 50%, #ef4444 50%)",
        }}
      />

      <div className="flex-1 min-w-0">
        <p className="type-body text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Colour-blind mode
        </p>
        <p className="type-label mt-0.5" style={{ color: "var(--text-secondary)" }}>
          {enabled ? "On — using patterns + colour" : "Off — colour only"}
        </p>
      </div>

      {/* Toggle pill */}
      <span
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
        style={{
          backgroundColor: enabled ? "var(--color-ct-blue)" : "var(--border-strong)",
        }}
        aria-hidden="true"
      >
        <span
          className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
          style={{
            transform: enabled ? "translateX(1.375rem)" : "translateX(0.25rem)",
          }}
        />
      </span>
    </button>
  );
}

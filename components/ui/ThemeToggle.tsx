"use client";

import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycle = () => {
    const order: typeof theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  return (
    <button
      onClick={cycle}
      aria-label={`Switch theme (currently ${theme})`}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={`Theme: ${theme}`}
    >
      {resolvedTheme === "dark" ? "🌙" : "☀️"}
    </button>
  );
}

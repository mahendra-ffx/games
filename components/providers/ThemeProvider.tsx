"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { get, set } from "idb-keyval";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Load persisted theme from IndexedDB on mount
  useEffect(() => {
    get<Theme>("theme").then((stored) => {
      if (stored) setThemeState(stored);
    });
  }, []);

  // Resolve and apply theme class to <html>
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = (t: Theme) => {
      const resolved =
        t === "system" ? (mediaQuery.matches ? "dark" : "light") : t;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle("dark", resolved === "dark");
    };

    apply(theme);

    if (theme === "system") {
      const handler = () => apply("system");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    set("theme", t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

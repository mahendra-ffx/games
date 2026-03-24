"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { usePiano } from "@/components/providers/PianoProvider";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_ITEMS = [
  { href: "/north-vs-south", label: "Daily Challenge" },
  { href: "/crossword", label: "Crossword" },
  { href: "/landmark", label: "Landmark Hunt" },
  { href: "/flashback", label: "Flashback" },
  { href: "/map", label: "Map Games" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/archive", label: "Archive" },
];

export function SiteHeader() {
  const { user, openLogin, openCheckout, tier } = usePiano();
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      {/* ── Row 1: CT masthead bar ──────────────────────────────── */}
      <div
        className="transition-all duration-200 overflow-hidden"
        style={{
          maxHeight: isScrolled ? "0px" : "56px",
          borderBottom: isScrolled ? "none" : `1px solid var(--border)`,
          backgroundColor: "var(--bg-page)",
        }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center">
          {/* Left: hamburger + search */}
          <div className="flex items-center gap-1 w-16 sm:w-24 flex-shrink-0">
            <button
              aria-label="Open navigation menu"
              aria-expanded={isMobileMenuOpen}
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </button>
            <button
              aria-label="Search"
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="M15 15l-3-3" />
              </svg>
            </button>
          </div>

          {/* Centre: CT masthead logo */}
          <div className="flex-1 flex justify-center px-2">
            <Link
              href="https://www.canberratimes.com.au"
              aria-label="The Canberra Times home"
              className="flex-shrink-0"
            >
              <Image
                src="/logo.svg"
                alt="The Canberra Times"
                width={220}
                height={48}
                priority
                className="h-7 sm:h-10 w-auto dark:invert"
              />
            </Link>
          </div>

          {/* Right: theme toggle + account */}
          <div className="flex items-center gap-2 w-16 sm:w-24 flex-shrink-0 justify-end">
            <ThemeToggle />
            {user ? (
              <button
                className="hidden sm:block type-button px-3 py-1.5 rounded border text-sm"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Account
              </button>
            ) : (
              <button
                onClick={openLogin}
                className="type-button px-3 py-1.5 rounded text-white text-xs"
                style={{ backgroundColor: "var(--color-ct-blue)" }}
              >
                Sign&nbsp;in
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Games vertical nav (always visible, sticky) ──── */}
      <nav
        aria-label="Games navigation"
        className="transition-shadow duration-200"
        style={{
          backgroundColor: "var(--bg-page)",
          borderBottom: `1px solid var(--border)`,
          boxShadow: isScrolled ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
        }}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-11 flex items-center gap-5 overflow-x-auto scrollbar-hide">
          {/* "games" wordmark */}
          <Link
            href="/"
            prefetch={false}
            className="flex-shrink-0 font-serif font-medium text-base leading-none tracking-tight transition-opacity hover:opacity-70"
            style={{ color: "var(--color-ct-blue)" }}
          >
            games
          </Link>

          {/* Divider */}
          <span aria-hidden className="h-4 w-px flex-shrink-0" style={{ backgroundColor: "var(--border-strong)" }} />

          {/* Nav links */}
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="flex-shrink-0 whitespace-nowrap transition-colors"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: active ? 600 : 500,
                  fontSize: "11px",
                  lineHeight: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: active ? "var(--color-ct-blue)" : "var(--text-secondary)",
                  borderBottom: active ? "2px solid var(--color-ct-blue)" : "2px solid transparent",
                  paddingBottom: "2px",
                }}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Subscribe CTA — right aligned */}
          {tier !== "premium" && (
            <button
              onClick={openCheckout}
              className="flex-shrink-0 ml-auto type-button px-3 py-1 rounded-full text-white text-xs"
              style={{ backgroundColor: "var(--color-ct-blue)", fontSize: "11px" }}
            >
              Subscribe
            </button>
          )}
        </div>
      </nav>

      {/* ── Mobile menu drawer ───────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="absolute inset-x-0 top-full z-50 shadow-lg"
          style={{ backgroundColor: "var(--bg-page)", borderBottom: `1px solid var(--border)` }}
        >
          <nav className="max-w-screen-xl mx-auto px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={() => setIsMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-md type-label text-sm transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

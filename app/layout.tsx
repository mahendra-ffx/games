import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { PianoProvider } from "@/components/providers/PianoProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { OfflineBanner } from "@/components/ui/OfflineBanner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["500"],
  display: "swap",
});

const masthead = process.env.NEXT_PUBLIC_MASTHEAD ?? "canberratimes";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://games.canberratimes.com.au";

export const metadata: Metadata = {
  title: {
    default: "Games | The Canberra Times",
    template: "%s | Games | The Canberra Times",
  },
  description: "Play daily puzzles, map games and more from The Canberra Times. New challenges every day.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_AU",
    url: siteUrl,
    siteName: "Canberra Times Games",
    title: "Games | The Canberra Times",
    description: "Play daily puzzles, map games and more from The Canberra Times.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Games | The Canberra Times",
    description: "Play daily puzzles, map games and more.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CT Games",
  },
  other: {
    "msapplication-TileColor": "#00558C",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00558C" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AU"
      // Class set server-side to avoid FOUC — ThemeProvider overrides on mount
      suppressHydrationWarning
    >
      <head />
      <body
        className={`${inter.variable} ${playfair.variable} antialiased flex flex-col min-h-dvh`}
        style={{ fontFamily: "var(--font-inter, var(--font-sans))" }}
      >
        <ThemeProvider>
          <PostHogProvider>
            <PianoProvider masthead={masthead}>
              {/* Skip to content — a11y */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ct-blue focus:text-white focus:rounded-md focus:type-button"
              >
                Skip to content
              </a>

              {/* Piano SDK — afterInteractive so it never blocks the HTML parser */}
              <Script
                src={`https://experience.tinypass.com/xbuilder/experience/load?aid=${process.env.NEXT_PUBLIC_PIANO_AID ?? "PIANO_AID_PLACEHOLDER"}`}
                strategy="afterInteractive"
              />
              <OfflineBanner />
              <SiteHeader />

              <main id="main-content" tabIndex={-1} className="flex flex-col flex-1 min-h-0">
                {children}
              </main>
            </PianoProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

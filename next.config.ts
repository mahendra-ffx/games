import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  // Disable the service worker in development to prevent an infinite recompile loop:
  // next-pwa writes worker-development.js to public/, Next.js file-watcher detects the
  // write, triggers a webpack recompile, which rebuilds the worker, which writes again…
  // Setting disable:true in dev breaks the cycle entirely. PWA is active in production only.
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Merges worker/index.ts into the generated Workbox SW (push + notification handlers)
  customWorkerSrc: "worker",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // App shell — cache first
      {
        urlPattern: /^https:\/\/games\.canberratimes\.com\.au\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "app-shell",
          expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 * 30 },
        },
      },
      // Game JSON — stale while revalidate
      {
        urlPattern: /^https:\/\/games\.canberratimes\.com\.au\/api\/game\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "game-configs",
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      // GeoJSON suburbs — cache first (rarely changes)
      {
        urlPattern: /\/geo\/act-suburbs\.json/i,
        handler: "CacheFirst",
        options: {
          cacheName: "geodata",
          expiration: { maxEntries: 4, maxAgeSeconds: 24 * 60 * 60 * 90 },
        },
      },
      // Archive images from Transform CDN — cache first with size limit
      {
        urlPattern: /\/transform\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "archive-images",
          expiration: { maxEntries: 128, maxAgeSeconds: 24 * 60 * 60 * 30 },
        },
      },
      // API calls (scores, leaderboard) — network first
      {
        urlPattern: /^https:\/\/games\.canberratimes\.com\.au\/api\/(score|validate|leaderboard)\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-dynamic",
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 5 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // Strict mode for React 19
  reactStrictMode: true,

  // Image optimization
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.canberratimes.com.au" },
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

// Only wrap with Sentry when credentials are available (avoids build errors without env vars)
const pwaConfig = withPWA(nextConfig);
const finalConfig = process.env.SENTRY_ORG
  ? withSentryConfig(pwaConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : pwaConfig;

export default finalConfig;

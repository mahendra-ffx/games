import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./__tests__/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ...(process.env.CI ? [["github"] as [string]] : []),
  ],

  use: {
    baseURL,
    // Screenshot on failure
    screenshot: "only-on-failure",
    // Record video on first retry
    video: "on-first-retry",
    // Trace on first retry
    trace: "on-first-retry",
    // Locale for date formatting
    locale: "en-AU",
    timezoneId: "Australia/Canberra",
  },

  projects: [
    // Main E2E — mobile first (most traffic)
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
    // Desktop coverage
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    // Accessibility audit project — runs axe on every page
    {
      name: "a11y",
      testMatch: "**/__tests__/e2e/a11y/**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Auto-start dev server in local mode
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});

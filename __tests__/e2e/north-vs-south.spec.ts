import { test, expect } from "@playwright/test";

test.describe("North vs South — full game flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/north-vs-south");
    await page.waitForLoadState("networkidle");
  });

  test("page has correct title and free daily label", async ({ page }) => {
    await expect(page).toHaveTitle(/North vs South/);
    await expect(page.getByText(/Free Daily/i)).toBeVisible();
    await expect(page.getByText(/North vs South/i).first()).toBeVisible();
  });

  test("no paywall — game renders immediately", async ({ page }) => {
    // Free game: should NOT show subscribe paywall
    await expect(page.getByText(/Subscribe to The Canberra Times/i)).not.toBeVisible();
    // Should show category buttons
    await expect(page.getByRole("button", { name: /North/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /South/i })).toBeVisible();
  });

  test("shows suburb name on load", async ({ page }) => {
    // A suburb name in ALL CAPS should be visible
    const suburbEl = page.locator("p.font-serif, div p").filter({ hasText: /^[A-Z']+$/ }).first();
    await expect(suburbEl).toBeVisible();
  });

  test("timer bar is visible", async ({ page }) => {
    // Timer renders a progress bar and numeric countdown
    const timer = page.locator('[role="timer"]');
    await expect(timer).toBeVisible();
  });

  test("clicking North button triggers feedback", async ({ page }) => {
    const northBtn = page.getByRole("button", { name: /North/i });
    await northBtn.click();
    // Feedback: correct/wrong message appears
    await expect(
      page.getByText(/Correct!|It's (North|South)/i)
    ).toBeVisible({ timeout: 2000 });
  });

  test("keyboard → arrow answers South category", async ({ page }) => {
    // Focus the page first
    await page.click("main");
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByText(/Correct!|It's (North|South)/i)
    ).toBeVisible({ timeout: 2000 });
  });

  test("keyboard → arrow answers North category", async ({ page }) => {
    await page.click("main");
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByText(/Correct!|It's (North|South)/i)
    ).toBeVisible({ timeout: 2000 });
  });

  test("progress bar advances after answering", async ({ page }) => {
    // Click North — advance one round
    await page.getByRole("button", { name: /North/i }).click();
    await page.waitForTimeout(FEEDBACK_DURATION_MS + 200);

    // Progress text should show 2/N
    await expect(page.getByText(/2\//)).toBeVisible({ timeout: 3000 });
  });

  test("skip to content link present", async ({ page }) => {
    await page.keyboard.press("Tab");
    await expect(page.getByText("Skip to content")).toBeVisible();
  });

  test("map is visible on page", async ({ page }) => {
    const map = page.locator('[role="application"][aria-label*="map" i]');
    await expect(map).toBeVisible();
  });
});

const FEEDBACK_DURATION_MS = 1400; // slightly longer than component's 1200ms

import { test, expect } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AxeBuilder } = require("axe-playwright");

test.describe("Games Hub — accessibility", () => {
  test("hub page passes WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("skip to content link is visible on focus", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skipLink = page.getByText("Skip to content");
    await expect(skipLink).toBeVisible();
  });

  test("nav items are keyboard navigable", async ({ page }) => {
    await page.goto("/");
    // Tab through nav items — should not get stuck
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
    }
    const focusedEl = page.locator(":focus");
    await expect(focusedEl).toBeVisible();
  });
});

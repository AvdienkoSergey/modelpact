import { expect, test } from "@playwright/test";

// Smoke test: it proves the playwright step in CI installs a browser, boots it
// and evaluates inside the page. It asserts nothing about the contract — the
// real suite replaces it.
test("chromium evaluates", async ({ page }) => {
  await page.goto("about:blank");
  expect(await page.evaluate(() => 2 + 2)).toBe(4);
});

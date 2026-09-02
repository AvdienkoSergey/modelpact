import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // No `webServer`: these specs assert platform behaviour on about:blank, so
  // there is nothing to serve until a provider has a page to run in.
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? "github" : "list",
  projects: [
    // Chromium only. The Prompt API this contract mirrors ships nowhere else,
    // so a second engine would test the assertions, not the target.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

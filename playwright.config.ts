import { defineConfig, devices } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = 5199;
const ORIGIN = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // The demo, on a port of its own so a dev server already running on Vite's
  // default is neither borrowed nor fought over. `--strictPort` makes a clash
  // fail here rather than move the app somewhere the specs do not look, and
  // `--host` is not optional: left to itself vite binds `localhost`, which
  // resolves to `[::1]` and nothing else here — a wait on 127.0.0.1 then times
  // out against a server that started fine (measured).
  webServer: {
    command: `npm --prefix demo run dev -- --host ${HOST} --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: !process.env["CI"],
  },
  use: { baseURL: ORIGIN },
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: process.env["CI"] ? "github" : "list",
  projects: [
    // Chromium only. The Prompt API this contract mirrors ships nowhere else,
    // so a second engine would test the assertions, not the target.
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});

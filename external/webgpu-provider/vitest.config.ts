import { defineConfig } from "vitest/config";

// Node, and no aliases: `modelpact` has to resolve through the package's own
// `exports`, or this directory proves nothing.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});

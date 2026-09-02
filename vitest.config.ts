import { defineConfig } from "vitest/config";

// Node rather than jsdom: nothing here touches the DOM, and Node 22 already has
// ReadableStream, DOMException and AbortSignal.any as globals — so this is not
// a downgrade, it is the environment the server half of the adapter runs in.
export default defineConfig({
  test: {
    environment: "node",
    // Colocated with the code. `*.test-d.ts` is the type-level suite —
    // compiled by tsc, never run — and this glob deliberately misses it, as it
    // misses `contract.test-suite.ts`, which is a function called by others.
    include: ["src/**/*.test.ts"],
  },
});

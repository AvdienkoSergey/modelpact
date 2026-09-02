import { expect, test } from "vitest";

// Smoke test: it proves the vitest step in CI has something to run and that
// the runner resolves this project's config. It asserts nothing about the
// contract — the real suite replaces it.
test("vitest runs", () => {
  expect(2 + 2).toBe(4);
});

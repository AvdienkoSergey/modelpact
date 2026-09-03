import { describe, expect, test } from "vitest";

import { makeMockProvider } from "./mock.js";
import { defineProviders, findProviderName } from "./registry.js";

const PROVIDERS = defineProviders({
  mock: makeMockProvider(),
  "mock-tiny": makeMockProvider({ contextWindow: 1 }),
});

describe("provider registry", () => {
  test("a registered name comes back and indexes the registry", () => {
    const name = findProviderName(PROVIDERS, "mock-tiny");
    expect(name).toBe("mock-tiny");
    if (name === null) return;
    expect(PROVIDERS[name].name).toBe("mock");
  });

  test("a name nobody registered is nothing", () => {
    expect(findProviderName(PROVIDERS, "ollama")).toBeNull();
  });

  test("inherited names are not registered names", () => {
    // `in` would say yes to both, which is how a saved string turns into a
    // function nobody put in the registry.
    expect(findProviderName(PROVIDERS, "toString")).toBeNull();
    expect(findProviderName(PROVIDERS, "__proto__")).toBeNull();
  });

  test("defining hands back the same object", () => {
    const registry = { mock: makeMockProvider() };
    expect(defineProviders(registry)).toBe(registry);
  });
});

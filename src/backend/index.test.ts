/**
 * The door has exactly the runtime names a transport reaches for. A name
 * dropped from here breaks every backend written outside the package, and
 * this list is where that shows before a consumer's build does.
 */

import { expect, test } from "vitest";

import * as backendEntry from "./index.js";

test("the backend entry carries what the built-in transports use", () => {
  expect(Object.keys(backendEntry).sort()).toEqual([
    "AiError",
    "contextUsage",
    "createProvider",
    "err",
    "failureFromError",
    "findTool",
    "fraction",
    "jsonSchema",
    "ndjsonLines",
    "ok",
    "runTool",
    "tokens",
    "toolThrewFailure",
  ]);
});

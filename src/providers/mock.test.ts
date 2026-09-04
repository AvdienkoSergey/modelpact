/**
 * The contract suite against the one provider with nothing behind it.
 *
 * All four scenarios can be staged here, which is the point: this run is the
 * only one that never skips, so a skip anywhere else is a property of that
 * backend rather than a hole in the suite.
 */

import { describe, expect, test } from "vitest";

import { CONTRACT_SCHEMA, describeContract } from "../testing/contract.js";
import { jsonSchema, type JsonSchema } from "../types/foundations.js";
import type { Tool } from "../types/tools.js";
import { makeMockProvider } from "./mock.js";

const asSchema = (value: Record<string, unknown>): JsonSchema => {
  const schema = jsonSchema(value);
  if (schema === null) throw new Error("not a schema");
  return schema;
};

// The suite validates the answer against `CONTRACT_SCHEMA` itself, so the mock
// is handed one that fits it rather than a validator that would have to agree.
const SCHEMA_REPLY = JSON.stringify({ city: "Paris" });

describeContract("mock", (scenario) => {
  switch (scenario) {
    case "ready":
      return makeMockProvider({ schemaReply: SCHEMA_REPLY });
    case "unavailable":
      return makeMockProvider({ access: "unavailable" });
    case "needs-download":
      return makeMockProvider({ access: "needs-download" });
    case "tiny-window":
      // One word over, so the first ordinary turn crosses the line.
      return makeMockProvider({ contextWindow: 1, schemaReply: SCHEMA_REPLY });
  }
});

describe("mock configuration", () => {
  test("a schema is refused when no reply was configured for one", async () => {
    const access = await makeMockProvider().access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const sessionResult = await access.open();
    if (!sessionResult.ok) throw new Error("expected a session");

    const answerResult = await sessionResult.value.prompt("hello", {
      schema: CONTRACT_SCHEMA,
    });
    expect(answerResult.ok).toBe(false);
    if (!answerResult.ok) expect(answerResult.error.kind).toBe("failed");
    sessionResult.value.close();
  });

  test("history handed at open is already charged", async () => {
    const access = await makeMockProvider().access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const sessionResult = await access.open({
      history: [{ role: "user", content: "three words here" }],
    });
    if (!sessionResult.ok) throw new Error("expected a session");

    const usage = sessionResult.value.usage();
    expect(usage.kind).toBe("bounded");
    if (usage.kind === "bounded") expect(usage.used).toBe(3);
    sessionResult.value.close();
  });

  test("a request for a modality it cannot serve is refused by name", async () => {
    const access = await makeMockProvider().access({
      outputs: [{ type: "audio" }],
    });
    expect(access.kind).toBe("unavailable");
    if (access.kind !== "unavailable") return;
    expect(access.reason.kind).toBe("unsupported-config");
    if (access.reason.kind === "unsupported-config") {
      expect(access.reason.modalities).toEqual(["audio"]);
    }
  });

  test("a tool named in the input runs, with the input as its argument", async () => {
    let seenInput: Record<string, unknown> | null = null;
    const tool: Tool = {
      name: "lookupColour",
      description: "two words",
      inputSchema: asSchema({ type: "object" }),
      execute: (input) => {
        seenInput = input;
        return "teal";
      },
    };
    const access = await makeMockProvider().access({ tools: [tool] });
    if (access.kind !== "ready") throw new Error("expected ready");
    const sessionResult = await access.open();
    if (!sessionResult.ok) throw new Error("expected a session");

    const answerResult = await sessionResult.value.prompt(
      "Use lookupColour for the kettle.",
    );
    expect(answerResult.ok).toBe(true);
    if (answerResult.ok) expect(answerResult.value.endsWith("teal")).toBe(true);
    expect(seenInput).toEqual({ input: "Use lookupColour for the kettle." });
    sessionResult.value.close();
  });

  test("tool declarations are charged at open", async () => {
    const tool: Tool = {
      name: "lookupColour",
      description: "two words",
      inputSchema: asSchema({ type: "object" }),
      execute: () => "teal",
    };
    const access = await makeMockProvider().access({ tools: [tool] });
    if (access.kind !== "ready") throw new Error("expected ready");
    const sessionResult = await access.open();
    if (!sessionResult.ok) throw new Error("expected a session");

    const usage = sessionResult.value.usage();
    expect(usage.kind).toBe("bounded");
    if (usage.kind === "bounded") expect(usage.used).toBe(3);
    sessionResult.value.close();
  });
});

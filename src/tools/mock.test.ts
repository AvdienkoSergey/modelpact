/**
 * The mock tool through the mock provider: the two fixtures together stage
 * every promise the contract makes about tools, and the suite already asserts
 * those. What is checked here is the tool's own record and its knobs.
 */

import { describe, expect, test } from "vitest";

import { makeMockProvider } from "../providers/mock.js";
import type { AiSession } from "../types/session.js";
import { makeMockTool, type MockTool } from "./mock.js";

const NEVER_ABORTED = new AbortController().signal;

const openWith = async (tool: MockTool): Promise<AiSession> => {
  const access = await makeMockProvider().access({ tools: [tool] });
  if (access.kind !== "ready")
    throw new Error(`expected ready, got ${access.kind}`);
  const sessionResult = await access.open();
  if (!sessionResult.ok)
    throw new Error(`open refused: ${sessionResult.error.kind}`);
  return sessionResult.value;
};

describe("mock tool", () => {
  test("echoes the text it is handed, and records the call", async () => {
    const tool = makeMockTool();
    expect(await tool.execute({ text: "kettle" }, NEVER_ABORTED)).toBe(
      "kettle",
    );
    expect(tool.calls()).toEqual([
      { input: { text: "kettle" }, aborted: false },
    ]);
  });

  test("an input without text comes back whole", async () => {
    const tool = makeMockTool();
    expect(await tool.execute({ item: "kettle" }, NEVER_ABORTED)).toBe(
      '{"item":"kettle"}',
    );
  });

  test("the record is a snapshot", async () => {
    const tool = makeMockTool();
    const before = tool.calls();
    await tool.execute({ text: "one" }, NEVER_ABORTED);
    expect(before).toEqual([]);
    expect(tool.calls()).toHaveLength(1);
  });

  test("a configured reply answers instead of the echo", async () => {
    const tool = makeMockTool({
      name: "lookupColour",
      reply: (input) => `${String(input.text)} is teal`,
    });
    expect(await tool.execute({ text: "kettle" }, NEVER_ABORTED)).toBe(
      "kettle is teal",
    );
  });

  test("through the mock provider, the reply is the end of the answer", async () => {
    const tool = makeMockTool({ reply: () => "teal" });
    const session = await openWith(tool);
    const answerResult = await session.prompt("Use echo for the kettle.");
    expect(answerResult.ok).toBe(true);
    if (answerResult.ok) expect(answerResult.value.endsWith("teal")).toBe(true);
    expect(tool.calls()).toHaveLength(1);
    session.close();
  });

  test("a reply that throws is a failed turn naming the tool", async () => {
    const tool = makeMockTool({
      reply: () => {
        throw new Error("the record is locked");
      },
    });
    const session = await openWith(tool);
    const answerResult = await session.prompt("Use echo for the kettle.");
    expect(answerResult.ok).toBe(false);
    if (answerResult.ok) return;
    expect(answerResult.error.kind).toBe("failed");
    if (answerResult.error.kind === "failed")
      expect(answerResult.error.detail).toContain('"echo"');
    session.close();
  });
});

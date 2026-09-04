/**
 * A tool with nothing behind it: words in, words out, and a record of every
 * call. The counterpart of the mock provider — the contract's fixture on the
 * tool side, for a suite that needs a call to have happened and a demo that
 * needs one to show.
 */

import { jsonSchema, type JsonSchema } from "../types/foundations.js";
import type { Tool } from "../types/tools.js";

export interface MockToolConfig {
  readonly name?: string;
  readonly description?: string;
  readonly inputSchema?: JsonSchema;
  /**
   * What the tool says for an input. Throwing here is the way to stage a tool
   * that breaks: the contract turns it into a failed turn naming the tool.
   */
  readonly reply?: (input: Record<string, unknown>) => string;
  /** Milliseconds before answering; zero would make "while a tool runs" unreachable. */
  readonly delayMs?: number;
}

export interface MockToolCall {
  readonly input: Record<string, unknown>;
  /** The turn's signal as it stood when the call was made. */
  readonly aborted: boolean;
}

/** The record is the whole reason a mock exists; `calls` is the tool's `history()`. */
export interface MockTool extends Tool {
  readonly calls: () => readonly MockToolCall[];
}

const DEFAULT_SCHEMA: JsonSchema = (() => {
  const shape = jsonSchema({
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  });
  if (shape === null) throw new Error("the default shape is not a schema");
  return shape;
})();

const DEFAULTS = {
  name: "echo",
  description: "Repeats the text it is handed. There is nothing behind it.",
  delayMs: 1,
  /** The `text` field where there is one, the whole input otherwise. */
  reply: (input: Record<string, unknown>): string =>
    typeof input.text === "string" ? input.text : JSON.stringify(input),
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const makeMockTool = (config: MockToolConfig = {}): MockTool => {
  const reply = config.reply ?? DEFAULTS.reply;
  const delayMs = config.delayMs ?? DEFAULTS.delayMs;
  let calls: readonly MockToolCall[] = [];
  return {
    name: config.name ?? DEFAULTS.name,
    description: config.description ?? DEFAULTS.description,
    inputSchema: config.inputSchema ?? DEFAULT_SCHEMA,
    execute: async (input, signal) => {
      calls = [...calls, { input, aborted: signal.aborted }];
      await sleep(delayMs);
      return reply(input);
    },
    // A snapshot, as `history()` is: a later call builds a new array.
    calls: () => calls,
  };
};

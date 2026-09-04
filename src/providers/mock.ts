/**
 * A backend with nothing behind it: no daemon, no browser, no network.
 *
 * It exists to hold the contract still. `../lifecycle` supplies every
 * guarantee in `../types`, this file supplies only the model — words in,
 * words out, a download that never happens — and `../testing/contract.js`
 * runs against the pair on every commit. A backend that cannot be reached from
 * a test runner is checked against the same assertions this one passes.
 */

import type {
  Availability,
  ConnectOptions,
  GenerateRequest,
  ModelConnection,
  ModelBackend,
} from "../types/backend.js";
import {
  err,
  fraction,
  ok,
  tokens,
  type Fraction,
  type JsonSchema,
  type Result,
} from "../types/foundations.js";
import type { AiFailure } from "../types/failures.js";
import type { AiProvider } from "../types/provider.js";
import type { Tool } from "../types/tools.js";
import { runTool } from "../helpers/tools.js";
import { contextUsage, type ContextUsage } from "../types/usage.js";
import { createProvider } from "./create.js";

export interface MockConfig {
  /**
   * Narrow it and one ordinary turn overflows, which is the only way to reach
   * the `contextoverflow` path without generating for minutes.
   */
  readonly contextWindow?: number;
  /**
   * The answer, already cut into deltas. More than one, or a caller cannot
   * tell a stream from a single write.
   */
  readonly reply?: (input: string) => readonly string[];
  /**
   * What to answer when a caller sends a schema. Absent, the provider refuses
   * such a call — the contract allows honouring or refusing, never ignoring,
   * and a mock that answered prose would be the ignoring case.
   */
  readonly schemaReply?: string;
  /** Which branch `access` takes; `ready` unless said otherwise. */
  readonly access?: "ready" | "unavailable" | "needs-download";
  /** Progress to report before opening on the `needs-download` branch. */
  readonly downloadSteps?: readonly number[];
  /** Milliseconds per delta, and per download step. Zero would make "while the first runs" untestable. */
  readonly delayMs?: number;
}

const DEFAULTS = {
  contextWindow: 4096,
  reply: (input: string): readonly string[] => {
    const preview = input.slice(0, 40);
    const sentence = `Answering «${preview}». `;
    const words = sentence.match(/\S+\s*/g);
    return words ?? ["Answer."];
  },
  downloadSteps: [0, 0.5, 1] as readonly number[],
  delayMs: 1,
};

const NO_SCHEMA_REPLY: AiFailure = {
  kind: "failed",
  detail: "no schemaReply configured",
};

const ZERO_TOKENS = tokens(0) as NonNullable<ReturnType<typeof tokens>>;

/** Words in, words out: a count that grows the way a real one does, without pretending to be a tokenizer. */
const countTokens = (text: string): number => {
  const pieces = text.split(/\s+/);
  const words = pieces.filter(Boolean);
  return words.length;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

class MockModel implements ModelConnection {
  readonly #contextWindow: number;
  readonly #reply: (input: string) => readonly string[];
  readonly #schemaReply: string | undefined;
  readonly #delayMs: number;
  readonly #tools: readonly Tool[];
  #usedTokens = 0;

  constructor(config: MockConfig, options: ConnectOptions) {
    this.#contextWindow = config.contextWindow ?? DEFAULTS.contextWindow;
    this.#reply = config.reply ?? DEFAULTS.reply;
    this.#schemaReply = config.schemaReply;
    this.#delayMs = config.delayMs ?? DEFAULTS.delayMs;
    this.#tools = options.request.tools ?? [];
    // Charged at open, as a real backend charges a transcript it was handed,
    // and the tools with it: the spec loads them into the window at create.
    for (const message of options.session.history ?? []) {
      this.#usedTokens += countTokens(message.content);
    }
    for (const tool of this.#tools) {
      this.#usedTokens += countTokens(`${tool.name} ${tool.description}`);
    }
  }

  readonly generateStream = async (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    const replyParts = this.#chooseReply(input, request.schema);
    if (replyParts === null) return err(NO_SCHEMA_REPLY);
    const toolsResult = await this.#callNamedTools(input, request.signal);
    if (!toolsResult.ok) return toolsResult;
    const stream = this.#streamReply(input, [
      ...replyParts,
      ...toolsResult.value,
    ]);
    return ok(stream);
  };

  readonly usage = (): ContextUsage => {
    const used = tokens(this.#usedTokens) ?? ZERO_TOKENS;
    return contextUsage(used, this.#contextWindow);
  };

  readonly dispose = (): void => undefined;

  /**
   * A tool runs when the input names it, with the whole input as its one
   * argument, and its answer is a delta of its own after the reply. Enough to
   * stage every promise the suite makes about tools without parsing anything.
   */
  async #callNamedTools(
    input: string,
    signal: AbortSignal,
  ): Promise<Result<readonly string[], AiFailure>> {
    const namedTools = this.#tools.filter((tool) => input.includes(tool.name));
    const toolTexts: string[] = [];
    for (const tool of namedTools) {
      const toolResult = await runTool(tool, { input }, signal);
      if (!toolResult.ok) return toolResult;
      toolTexts.push(toolResult.value);
    }
    return ok(toolTexts);
  }

  /** Null is the refusal: a schema with no reply configured for it. */
  #chooseReply(
    input: string,
    schema: JsonSchema | undefined,
  ): readonly string[] | null {
    if (schema === undefined) return this.#reply(input);
    if (this.#schemaReply === undefined) return null;
    return [this.#schemaReply];
  }

  /** One delta per pull, `delayMs` apart: the pace is what makes "while the first one runs" a reachable state. */
  #streamReply(
    input: string,
    replyParts: readonly string[],
  ): ReadableStream<string> {
    let index = 0;
    return new ReadableStream<string>({
      pull: async (controller) => {
        await sleep(this.#delayMs);
        const part = replyParts[index];
        if (part === undefined) {
          this.#charge(input, replyParts.join(""));
          controller.close();
          return;
        }
        index += 1;
        controller.enqueue(part);
      },
    });
  }

  #charge(input: string, answer: string): void {
    this.#usedTokens += countTokens(input) + countTokens(answer);
  }
}

const getAvailability = (config: MockConfig): Availability => {
  if (config.access === "unavailable") {
    return { kind: "unavailable", reason: { kind: "unsupported" } };
  }
  if (config.access === "needs-download") {
    return { kind: "needs-download", started: false };
  }
  return { kind: "ready" };
};

const reportDownload = async (
  steps: readonly number[],
  delayMs: number,
  reportProgress: (loaded: Fraction) => void,
): Promise<void> => {
  for (const step of steps) {
    await sleep(delayMs);
    const progress = fraction(step);
    if (progress !== null) reportProgress(progress);
  }
};

const connectMock = async (
  config: MockConfig,
  options: ConnectOptions,
): Promise<Result<ModelConnection, AiFailure>> => {
  if (config.access === "needs-download") {
    const steps = config.downloadSteps ?? DEFAULTS.downloadSteps;
    const delayMs = config.delayMs ?? DEFAULTS.delayMs;
    await reportDownload(steps, delayMs, options.reportProgress);
  }
  const model = new MockModel(config, options);
  return ok(model);
};

export function makeMockProvider(config: MockConfig = {}): AiProvider {
  const backend: ModelBackend = {
    name: "mock",
    modalities: ["text"],
    tools: true,
    availability: () => getAvailability(config),
    connect: (options) => connectMock(config, options),
  };
  return createProvider(backend);
}

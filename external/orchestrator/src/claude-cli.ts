/**
 * Claude, from the terminal you already pay for.
 *
 * `claude -p` is a subprocess that prints NDJSON: `stream_event` lines carry
 * the deltas, one `result` line carries the answer, the usage and the cost.
 * That is a third transport after HTTP and an in-page class, and the one thing
 * this backend exists to show — the four answers are the same, the wire is a
 * child process.
 *
 * Stateless per turn on purpose. `--resume` would let the CLI keep the
 * conversation, but a router that hands turns to different backends needs
 * every backend to read `request.history`, so the conversation is rendered
 * into the prompt each time and nothing is left in the CLI's own session store.
 *
 * Shapes were read off `claude` 2.1.138 with `--include-partial-messages`;
 * nothing here is from the docs.
 */

import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import {
  AiError,
  contextUsage,
  createProvider,
  err,
  ndjsonLines,
  ok,
  tokens,
  type AiFailure,
  type AiMessage,
  type AiProvider,
  type Availability,
  type ConnectOptions,
  type ContextUsage,
  type GenerateRequest,
  type Model,
  type ModelBackend,
  type Result,
} from "modelpact";

/**
 * What the backend needs of a child process, and no more. Structural so that
 * the emitted `.d.ts` names nothing from `@types/node`: a consumer without it
 * still compiles this package, and a test hands in a process made of strings.
 */
export interface Spawned {
  readonly stdout: ReadableStream<BufferSource>;
  readonly stderr: ReadableStream<BufferSource>;
  /** Exit code, or null when a signal ended it. Rejects when it could not start. */
  readonly exited: Promise<number | null>;
  kill(): void;
}

export type Spawner = (args: readonly string[]) => Spawned;

export interface ClaudeCliConfig {
  /** An alias the CLI accepts (`opus`, `sonnet`) or a full model id. Absent, the CLI's default. */
  readonly model?: string;
  /** The window the meter is measured against; the CLI reports usage, not a limit. */
  readonly contextWindow?: number;
  /** A ceiling the CLI enforces per call, in dollars. */
  readonly maxBudgetUsd?: number;
  /** The executable; `claude` on PATH unless said otherwise. */
  readonly command?: string;
  /** For a test: a process that answers from strings. */
  readonly spawn?: Spawner;
}

const DEFAULTS = { contextWindow: 200_000, command: "claude" };

const ZERO = tokens(0) ?? (0 as never);

const spawnReal =
  (command: string): Spawner =>
  (args) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code));
    });
    return {
      stdout: Readable.toWeb(child.stdout) as ReadableStream<BufferSource>,
      stderr: Readable.toWeb(child.stderr) as ReadableStream<BufferSource>,
      exited,
      kill: () => {
        child.kill("SIGTERM");
      },
    };
  };

const spawnerOf = (config: ClaudeCliConfig): Spawner =>
  config.spawn ?? spawnReal(config.command ?? DEFAULTS.command);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const readAll = async (
  stream: ReadableStream<BufferSource>,
): Promise<string> => {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let text = "";
  for (;;) {
    const next = await reader.read();
    if (next.done) return text;
    text += next.value;
  }
};

/** Ready when `--version` exits 0; unsupported when the binary is not there. */
const getAvailability = async (
  config: ClaudeCliConfig,
): Promise<Availability> => {
  try {
    const probe = spawnerOf(config)(["--version"]);
    void readAll(probe.stdout);
    void readAll(probe.stderr);
    const code = await probe.exited;
    if (code === 0) return { kind: "ready" };
    return {
      kind: "unavailable",
      reason: { kind: "failed", detail: `claude --version exited ${code}` },
    };
  } catch (cause) {
    return { kind: "unavailable", reason: { kind: "unsupported", cause } };
  }
};

/**
 * The conversation as one prompt. Lossy against real turns, and honest about
 * it: the CLI takes a single prompt, and a router needs history from outside
 * the CLI's own store.
 */
const renderPrompt = (history: readonly AiMessage[], input: string): string => {
  if (history.length === 0) return input;
  const earlier = history
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n\n");
  return `<conversation>\n${earlier}\n</conversation>\n\nuser: ${input}`;
};

const CONTINUE =
  "When a <conversation> block is present, it is the conversation so far; reply to the final user turn only, without restating it.";

class ClaudeCliModel implements Model {
  readonly #config: ClaudeCliConfig;
  readonly #system: string | undefined;
  #usedTokens = 0;

  constructor(config: ClaudeCliConfig, options: ConnectOptions) {
    this.#config = config;
    this.#system = options.session.system;
  }

  readonly generate = (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    // Refused, not dropped: `--json-schema` returned `is_error` in this mode
    // on 2.1.138, and the contract allows a refusal, never a silent prose reply.
    if (request.schema !== undefined) {
      return Promise.resolve(
        err({
          kind: "unsupported-config",
          languages: [],
          cause: 'claude -p --json-schema fails with --tools ""',
        }),
      );
    }
    const args = this.#argsFor(input, request);
    let child: Spawned;
    try {
      child = spawnerOf(this.#config)(args);
    } catch (cause) {
      return Promise.resolve(
        err({ kind: "failed", detail: "could not start claude", cause }),
      );
    }
    return Promise.resolve(ok(this.#deltasOf(child, request.signal)));
  };

  readonly usage = (): ContextUsage =>
    contextUsage(
      tokens(this.#usedTokens) ?? ZERO,
      this.#config.contextWindow ?? DEFAULTS.contextWindow,
    );

  /** Every turn is its own process and it has already exited; nothing is held. */
  readonly dispose = (): void => undefined;

  #argsFor(input: string, request: GenerateRequest): string[] {
    const system = [this.#system, CONTINUE].filter(Boolean).join("\n\n");
    const args = [
      "-p",
      renderPrompt(request.history, input),
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--max-turns",
      "1",
      "--no-session-persistence",
      // No tools: this is a model behind a contract, not an agent in a repo.
      "--tools",
      "",
      "--system-prompt",
      system,
    ];
    if (this.#config.model !== undefined)
      args.push("--model", this.#config.model);
    if (this.#config.maxBudgetUsd !== undefined)
      args.push("--max-budget-usd", String(this.#config.maxBudgetUsd));
    return args;
  }

  /**
   * Deltas out of the NDJSON, usage out of the last line. The abort is the
   * lifecycle's to notice; what is ours is to stop the process when it does,
   * and to close rather than error when the CLI itself ended the turn.
   */
  #deltasOf(child: Spawned, signal: AbortSignal): ReadableStream<string> {
    const lines = child.stdout
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(ndjsonLines())
      .getReader();
    const stderr = readAll(child.stderr);
    // Once: the abort and the lifecycle's cancel both reach it, and one
    // SIGTERM is the message.
    let stopped = false;
    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      signal.removeEventListener("abort", stop);
      child.kill();
    };
    signal.addEventListener("abort", stop, { once: true });

    return new ReadableStream<string>({
      // A pull must make progress — enqueue, close or throw — before it
      // returns. One that returns empty-handed is not called again unless a
      // read arrived while it ran, and two housekeeping lines in a row
      // (`init`, `message_start`) are enough to leave a reader waiting for
      // ever. Measured, not reasoned: the stream stalled after exactly the
      // second skip.
      pull: async (controller) => {
        for (;;) {
          const next = await lines.read();
          if (next.done) {
            signal.removeEventListener("abort", stop);
            const code = await child.exited;
            // 143 is SIGTERM, our own kill: the lifecycle has already errored
            // the stream as `aborted` by the time this is reached.
            if (code !== 0 && code !== null && code !== 143) {
              const said = (await stderr).trim();
              throw new AiError({
                kind: "failed",
                detail: said === "" ? `claude exited ${code}` : said,
              });
            }
            controller.close();
            return;
          }
          const line = asRecord(parseJson(next.value));
          if (line === null) continue;
          if (line.type === "result") this.#finish(line);
          const delta = this.#deltaOf(line);
          if (delta !== null) {
            controller.enqueue(delta);
            return;
          }
        }
      },
      cancel: stop,
    });
  }

  #deltaOf(line: Record<string, unknown>): string | null {
    if (line.type !== "stream_event") return null;
    const event = asRecord(line.event);
    if (event?.type !== "content_block_delta") return null;
    const delta = asRecord(event.delta);
    return delta?.type === "text_delta" && typeof delta.text === "string"
      ? delta.text
      : null;
  }

  /** The `result` line: the CLI's own error flag, and the counts for the meter. */
  #finish(line: Record<string, unknown>): void {
    if (line.is_error === true) {
      const result = line.result;
      const detail =
        typeof result === "string" ? result : "claude reported an error";
      throw new AiError({ kind: "failed", detail });
    }
    const usage = asRecord(line.usage) ?? {};
    this.#usedTokens =
      asNumber(usage.input_tokens) +
      asNumber(usage.cache_read_input_tokens) +
      asNumber(usage.cache_creation_input_tokens) +
      asNumber(usage.output_tokens);
  }
}

export function makeClaudeCliProvider(
  config: ClaudeCliConfig = {},
): AiProvider {
  return createProvider(makeClaudeCliBackend(config));
}

/** The backend itself, for composing under a router rather than opening alone. */
export function makeClaudeCliBackend(
  config: ClaudeCliConfig = {},
): ModelBackend {
  return {
    name: "claude-cli",
    modalities: ["text"],
    availability: () => getAvailability(config),
    connect: (options) =>
      Promise.resolve(ok(new ClaudeCliModel(config, options))),
  };
}

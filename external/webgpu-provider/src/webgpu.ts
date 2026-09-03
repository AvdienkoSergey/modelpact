/**
 * A model in the tab itself, on WebGPU, through `@mlc-ai/web-llm`.
 *
 * Written from outside the package: `modelpact` here is the published entry
 * and nothing else, so if a backend cannot be built from what is exported,
 * this file is where that shows. It imports no path into `src/`, and the
 * `exports` map would refuse if it tried.
 *
 * What the engine brings that the other backends do not: the download is the
 * page's own, several hundred megabytes into browser storage, and it is the
 * only one where `needs-download` costs the user their bandwidth rather than a
 * daemon's.
 */

import {
  contextUsage,
  createProvider,
  err,
  failureFrom,
  fraction,
  ok,
  tokens,
  type AiFailure,
  type AiProvider,
  type Availability,
  type ConnectOptions,
  type ContextUsage,
  type GenerateRequest,
  type Model,
  type ModelBackend,
  type Result,
} from "modelpact";
import {
  CreateMLCEngine,
  type ChatCompletionChunk,
  type InitProgressReport,
  type MLCEngineInterface,
} from "@mlc-ai/web-llm";

export interface WebGpuConfig {
  /** A tag from the engine's own catalogue, such as `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`. */
  readonly model: string;
  /** Tokens the session is measured against; the engine reports no window of its own. */
  readonly contextWindow?: number;
  /** For a test: the engine, already built, instead of one loaded from the network. */
  readonly engine?: (
    report: (loaded: number) => void,
  ) => Promise<MLCEngineInterface>;
}

const DEFAULTS = { contextWindow: 4096 };

const ZERO = tokens(0) ?? (0 as never);

/** WebGPU or nothing: the engine has a WASM path, but not one worth offering. */
const hasWebGpu = (): boolean =>
  typeof navigator !== "undefined" && "gpu" in navigator;

/**
 * Weights live in the browser's cache, so "downloaded" is a question about
 * this profile rather than about the machine. The engine exposes no such
 * check, so the cache is asked directly.
 */
const isCached = async (model: string): Promise<boolean> => {
  if (typeof caches === "undefined") return false;
  try {
    const names = await caches.keys();
    for (const name of names) {
      const opened = await caches.open(name);
      const held = await opened.keys();
      if (held.some((request) => request.url.includes(model))) return true;
    }
    return false;
  } catch {
    return false;
  }
};

const getAvailability = async (config: WebGpuConfig): Promise<Availability> => {
  if (config.engine !== undefined) return { kind: "ready" };
  if (!hasWebGpu()) {
    return {
      kind: "unavailable",
      reason: { kind: "unsupported-config", languages: [], modalities: [] },
    };
  }
  const cached = await isCached(config.model);
  return cached
    ? { kind: "ready" }
    : { kind: "needs-download", started: false };
};

/** The engine reports a stage and a percentage; only the number is ours to pass on. */
const progressOf = (report: InitProgressReport): number =>
  typeof report.progress === "number" ? report.progress : 0;

class WebGpuModel implements Model {
  readonly #engine: MLCEngineInterface;
  readonly #model: string;
  readonly #contextWindow: number;
  readonly #system: string | undefined;
  #usedTokens = 0;

  constructor(
    engine: MLCEngineInterface,
    config: WebGpuConfig,
    options: ConnectOptions,
  ) {
    this.#engine = engine;
    this.#model = config.model;
    this.#contextWindow = config.contextWindow ?? DEFAULTS.contextWindow;
    this.#system = options.session.system;
  }

  readonly generate = async (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    try {
      const chunks = await this.#engine.chat.completions.create({
        model: this.#model,
        messages: this.#messagesFor(input, request),
        stream: true,
        stream_options: { include_usage: true },
        ...(request.schema === undefined
          ? {}
          : {
              response_format: {
                type: "json_object",
                schema: JSON.stringify(request.schema),
              },
            }),
      });
      return ok(this.#deltasOf(chunks));
    } catch (error) {
      return err(failureFrom(error));
    }
  };

  readonly usage = (): ContextUsage =>
    contextUsage(tokens(this.#usedTokens) ?? ZERO, this.#contextWindow);

  readonly dispose = (): void => {
    void this.#engine.unload();
  };

  #messagesFor(input: string, request: GenerateRequest) {
    const said = request.history.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    const asked = { role: "user" as const, content: input };
    return this.#system === undefined
      ? [...said, asked]
      : [{ role: "system" as const, content: this.#system }, ...said, asked];
  }

  /**
   * An async iterable into a `ReadableStream`, because that is what the
   * contract carries.
   *
   * The abort is deliberately not policed here. The lifecycle checks the signal
   * around every read and errors the stream itself, in the vocabulary; a
   * backend that raced it to the punch with a plain `Error` would land in
   * `unknown` instead of `aborted`, which is what the conformance suite caught
   * when this file did exactly that.
   *
   * What is left to do is tell the engine, since it takes no signal of its own:
   * `cancel` reaches every way out — the reader stopping, the abort, the close.
   */
  #deltasOf(
    chunks: AsyncIterable<ChatCompletionChunk>,
  ): ReadableStream<string> {
    const iterator = chunks[Symbol.asyncIterator]();
    return new ReadableStream<string>({
      pull: async (controller) => {
        const next = await iterator.next();
        if (next.done === true) {
          controller.close();
          return;
        }
        const chunk = next.value;
        if (chunk.usage != null) this.#usedTokens = chunk.usage.total_tokens;
        const delta = chunk.choices[0]?.delta.content ?? "";
        if (delta !== "") controller.enqueue(delta);
      },
      cancel: async () => {
        this.#engine.interruptGenerate();
        await iterator.return?.();
      },
    });
  }
}

const connectEngine = async (
  config: WebGpuConfig,
  options: ConnectOptions,
): Promise<Result<Model, AiFailure>> => {
  const report = (loaded: number): void => {
    const at = fraction(loaded);
    if (at !== null) options.reportProgress(at);
  };
  try {
    const engine =
      config.engine === undefined
        ? await CreateMLCEngine(config.model, {
            initProgressCallback: (progress) => {
              report(progressOf(progress));
            },
          })
        : await config.engine(report);
    return ok(new WebGpuModel(engine, config, options));
  } catch (error) {
    return err(failureFrom(error));
  }
};

export function makeWebGpuProvider(config: WebGpuConfig): AiProvider {
  const backend: ModelBackend = {
    name: "webgpu",
    modalities: ["text"],
    availability: () => getAvailability(config),
    connect: (options) => connectEngine(config, options),
  };
  return createProvider(backend);
}

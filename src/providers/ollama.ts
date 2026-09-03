/**
 * Ollama on a machine you can reach over HTTP.
 *
 * The daemon keeps nothing between requests: `/api/chat` is handed the whole
 * conversation every time, which is what `request.history` is for. Three
 * endpoints are the whole backend — `/api/tags` says what is downloaded,
 * `/api/pull` downloads, `/api/chat` generates — and everything else the
 * contract promises is `../lifecycle`'s.
 *
 * Shapes here were read off a running daemon, not off the docs: a chat stream
 * is NDJSON whose last line carries the counts, a pull line carries `completed`
 * and `total` per layer, and an error is an HTTP status with `{"error": "…"}`.
 */

import { ndjsonLines } from "../helpers/ndjson.js";
import {
  err,
  fraction,
  ok,
  tokens,
  type Fraction,
  type Result,
} from "../types/foundations.js";
import { AiError, type AiFailure } from "../types/failures.js";
import type { AiMessage } from "../types/messages.js";
import type {
  Availability,
  ConnectOptions,
  GenerateRequest,
  Model,
  ModelBackend,
} from "../types/backend.js";
import type { AiProvider } from "../types/provider.js";
import { contextUsage, type ContextUsage } from "../types/usage.js";
import { createProvider } from "./create.js";

export interface OllamaConfig {
  /** The tag as `/api/tags` lists it, such as `granite4:350m`. */
  readonly model: string;
  /**
   * `127.0.0.1` and not `localhost`: the daemon binds the one, and the name
   * can resolve to the other family first and refuse the connection.
   */
  readonly host?: string;
  /**
   * Sent as `num_ctx`, and therefore the window in force rather than a guess
   * at one. The default matches the daemon's own; a model that can take more
   * will, at the price of the memory the cache for it costs.
   */
  readonly contextWindow?: number;
  /** For a proxy, an auth header, or a test with no daemon behind it. */
  readonly fetch?: typeof globalThis.fetch;
}

const DEFAULTS = {
  host: "http://127.0.0.1:11434",
  contextWindow: 4096,
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  const isObject = typeof value === "object" && value !== null;
  return isObject && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

interface Endpoint {
  readonly host: string;
  readonly call: typeof globalThis.fetch;
}

const toEndpoint = (config: OllamaConfig): Endpoint => ({
  host: config.host ?? DEFAULTS.host,
  // Bound, and not optional: in a browser `fetch` is a method of the window and
  // throws `TypeError: Illegal invocation` once it is held on its own. Node
  // does not care, so nothing but a page catches this (measured).
  call: config.fetch ?? globalThis.fetch.bind(globalThis),
});

const postTo = (
  endpoint: Endpoint,
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> =>
  endpoint.call(`${endpoint.host}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  });

/** The daemon says what went wrong in the body; a status alone would lose it. */
const failureFromResponse = async (response: Response): Promise<AiFailure> => {
  const text = await response.text().catch(() => "");
  const errorText = asString(asRecord(parseJson(text))?.error);
  const detail = errorText ?? `${response.status} from the daemon`;
  // 400 is the daemon reading the request and refusing it, which is a bug on
  // this side. Everything else is the daemon's own trouble.
  return response.status === 400
    ? { kind: "invalid-input", detail }
    : { kind: "failed", detail };
};

const listModels = async (endpoint: Endpoint): Promise<readonly string[]> => {
  const response = await endpoint.call(`${endpoint.host}/api/tags`);
  if (!response.ok) return [];
  const listedModels = asRecord(
    await response.json().catch(() => null),
  )?.models;
  if (!Array.isArray(listedModels)) return [];
  const names = listedModels.map((entry) => asString(asRecord(entry)?.model));
  return names.filter((name): name is string => name !== null);
};

const getAvailability = async (config: OllamaConfig): Promise<Availability> => {
  const endpoint = toEndpoint(config);
  let downloadedModels: readonly string[];
  try {
    downloadedModels = await listModels(endpoint);
  } catch (cause) {
    // Nothing answering is not a failed request, it is no Ollama here.
    return { kind: "unavailable", reason: { kind: "unsupported", cause } };
  }
  const isDownloaded = downloadedModels.includes(config.model);
  return isDownloaded
    ? { kind: "ready" }
    : { kind: "needs-download", started: false };
};

/**
 * Pull progress is per layer, and layers are announced as the pull reaches
 * them, so the denominator grows while it runs. The share can therefore stall,
 * and `ProgressMonitor` drops it if it would step back. `success` is what
 * makes the last report a 1, since that line carries no numbers.
 */
const readPullProgress = (
  reportProgress: (progress: Fraction) => void,
): TransformStream<string, string> => {
  const layers = new Map<string, { total: number; completed: number }>();
  return new TransformStream({
    transform: (line, controller) => {
      const parsedLine = asRecord(parseJson(line));
      if (parsedLine === null) return;
      const errorText = asString(parsedLine.error);
      if (errorText !== null)
        throw new AiError({ kind: "failed", detail: errorText });

      const digest = asString(parsedLine.digest);
      const total = asNumber(parsedLine.total);
      const completed = asNumber(parsedLine.completed) ?? 0;
      if (digest !== null && total !== null && total > 0) {
        layers.set(digest, { total, completed });
      }

      const isDone = asString(parsedLine.status) === "success";
      const pulledShare = isDone ? 1 : getPulledShare(layers);
      const progress = fraction(pulledShare);
      if (progress !== null) reportProgress(progress);
      controller.enqueue(line);
    },
  });
};

const getPulledShare = (
  layers: Map<string, { total: number; completed: number }>,
): number => {
  let total = 0;
  let completed = 0;
  for (const layer of layers.values()) {
    total += layer.total;
    completed += layer.completed;
  }
  return total === 0 ? 0 : completed / total;
};

const pullModel = async (
  endpoint: Endpoint,
  model: string,
  reportProgress: (progress: Fraction) => void,
): Promise<Result<null, AiFailure>> => {
  const response = await postTo(endpoint, "/api/pull", { model, stream: true });
  if (!response.ok) return err(await failureFromResponse(response));
  if (response.body === null)
    return err({ kind: "failed", detail: "the pull sent no body" });

  const lines = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(ndjsonLines())
    .pipeThrough(readPullProgress(reportProgress));
  const reader = lines.getReader();
  try {
    // Read to the end: the transform above is where the reporting happens, and
    // the body is not finished until it stops yielding.
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return ok(null);
    }
  } catch (error) {
    return err(
      error instanceof AiError
        ? error.failure
        : { kind: "failed", detail: "the pull was interrupted", cause: error },
    );
  }
};

interface ChatBody {
  readonly model: string;
  readonly messages: readonly AiMessage[];
  readonly stream: boolean;
  readonly options: { readonly num_ctx: number };
  readonly format?: Record<string, unknown>;
}

class OllamaModel implements Model {
  readonly #endpoint: Endpoint;
  readonly #model: string;
  readonly #contextWindow: number;
  readonly #system: string | undefined;
  /** The last turn's counts, which is what the context holds now rather than a running sum. */
  #usedTokens = 0;

  constructor(config: OllamaConfig, options: ConnectOptions) {
    this.#endpoint = toEndpoint(config);
    this.#model = config.model;
    this.#contextWindow = config.contextWindow ?? DEFAULTS.contextWindow;
    this.#system = options.session.system;
  }

  readonly generate = async (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    const responseResult = await this.#chat(input, request, true);
    if (!responseResult.ok) return responseResult;
    const body = responseResult.value.body;
    if (body === null)
      return err({ kind: "failed", detail: "the chat sent no body" });

    const deltas = body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(ndjsonLines())
      .pipeThrough(this.#readChatLines());
    return ok(deltas);
  };

  readonly generateWhole = async (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<string, AiFailure>> => {
    const responseResult = await this.#chat(input, request, false);
    if (!responseResult.ok) return responseResult;
    const parsedBody = asRecord(
      await responseResult.value.json().catch(() => null),
    );
    if (parsedBody === null)
      return err({ kind: "failed", detail: "the chat sent no JSON" });
    const answerText = asString(asRecord(parsedBody.message)?.content);
    if (answerText === null)
      return err({ kind: "failed", detail: "the chat sent no message" });
    this.#charge(parsedBody);
    return ok(answerText);
  };

  readonly usage = (): ContextUsage => {
    const used = tokens(this.#usedTokens) ?? ZERO_TOKENS;
    return contextUsage(used, this.#contextWindow);
  };

  /**
   * Nothing to release. The daemon unloads on its own timer, and telling it to
   * unload here would take the model out from under whoever else is on it.
   */
  readonly dispose = (): void => undefined;

  async #chat(
    input: string,
    request: GenerateRequest,
    stream: boolean,
  ): Promise<Result<Response, AiFailure>> {
    const askedMessage: AiMessage = { role: "user", content: input };
    const conversation = [...request.history, askedMessage];
    const messages =
      this.#system === undefined
        ? conversation
        : [{ role: "user" as const, content: this.#system }, ...conversation];
    const body: ChatBody = {
      model: this.#model,
      messages,
      stream,
      options: { num_ctx: this.#contextWindow },
      ...(request.schema === undefined ? {} : { format: request.schema }),
    };
    const response = await postTo(
      this.#endpoint,
      "/api/chat",
      body,
      request.signal,
    );
    return response.ok
      ? ok(response)
      : err(await failureFromResponse(response));
  }

  /** Content out, counts kept: the last line carries both `done` and the totals. */
  #readChatLines(): TransformStream<string, string> {
    return new TransformStream({
      transform: (line, controller) => {
        const parsedLine = asRecord(parseJson(line));
        if (parsedLine === null) return;
        const errorText = asString(parsedLine.error);
        if (errorText !== null)
          throw new AiError({ kind: "failed", detail: errorText });
        if (parsedLine.done === true) this.#charge(parsedLine);
        const delta = asString(asRecord(parsedLine.message)?.content) ?? "";
        if (delta !== "") controller.enqueue(delta);
      },
    });
  }

  /**
   * `prompt_eval_count` is the whole prompt, history included, so the two
   * counts together are what the window holds after this turn. Summing across
   * turns would count the history once per turn.
   */
  #charge(finishedLine: Record<string, unknown>): void {
    const promptTokens = asNumber(finishedLine.prompt_eval_count) ?? 0;
    const answerTokens = asNumber(finishedLine.eval_count) ?? 0;
    this.#usedTokens = promptTokens + answerTokens;
  }
}

const ZERO_TOKENS = tokens(0) as NonNullable<ReturnType<typeof tokens>>;

const connectOllama = async (
  config: OllamaConfig,
  options: ConnectOptions,
): Promise<Result<Model, AiFailure>> => {
  const endpoint = toEndpoint(config);
  let downloadedModels: readonly string[];
  try {
    downloadedModels = await listModels(endpoint);
  } catch (cause) {
    return err({ kind: "unsupported", cause });
  }
  if (!downloadedModels.includes(config.model)) {
    const pullResult = await pullModel(
      endpoint,
      config.model,
      options.reportProgress,
    );
    if (!pullResult.ok) return pullResult;
  }
  return ok(new OllamaModel(config, options));
};

export function makeOllamaProvider(config: OllamaConfig): AiProvider {
  const backend: ModelBackend = {
    name: "ollama",
    modalities: ["text"],
    availability: () => getAvailability(config),
    connect: (options) => connectOllama(config, options),
  };
  return createProvider(backend);
}

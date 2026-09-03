/**
 * Chrome's built-in model, through the Prompt API.
 *
 * The one backend that keeps the conversation itself: `LanguageModel` is a
 * session object, `prompt()` appends to it, and `request.history` is therefore
 * read by nobody here. Two more things it owns that the others do not — it
 * fires its own `contextoverflow`, which is forwarded rather than re-derived,
 * and it reports usage against a window it decides.
 *
 * It lives in a page and nowhere else. In node the global is missing, and
 * `access` answers `unavailable` with `unsupported` rather than throwing.
 *
 * The declarations are `@types/dom-chromium-ai`, patched under `patches/` to
 * close the gap between the IDL and the spec; `src/types.test-d.ts` is where
 * the two meet. They are named in function bodies and nowhere in a signature
 * that leaves this file: an exported type naming `LanguageModel` puts the same
 * name in the emitted `.d.ts`, and a consumer who has not installed those
 * declarations, or who lists `types` explicitly, then cannot compile the
 * package at all. `external/webgpu-provider` is where that was found.
 */

import { failureFromError, type AiFailure } from "../types/failures.js";
import {
  err,
  fraction,
  ok,
  tokens,
  type Result,
} from "../types/foundations.js";
import type { ModelRequest } from "../types/messages.js";
import type {
  Availability,
  ConnectOptions,
  GenerateRequest,
  ModelConnection,
  ModelBackend,
} from "../types/backend.js";
import type { AiProvider } from "../types/provider.js";
import type { SessionOptions } from "../types/session.js";
import { contextUsage, type ContextUsage } from "../types/usage.js";
import { createProvider } from "./create.js";

/**
 * The page's own class, or nothing.
 *
 * There is no way to hand one in. A polyfill is already this — it defines the
 * global — and a test sets the global too, which is the same path the browser
 * takes rather than one beside it.
 *
 * `typeof` and not a bare read: outside a page the name is not declared, and
 * naming it there throws rather than answering undefined.
 */
const getPlatformApi = (): typeof LanguageModel | null =>
  typeof LanguageModel === "undefined" ? null : LanguageModel;

const toExpectations = (
  askedExpectations: ModelRequest["inputs"],
): LanguageModelExpected[] | undefined => {
  if (askedExpectations === undefined || askedExpectations.length === 0)
    return undefined;
  return askedExpectations.map((expectation) => ({
    type: expectation.type,
    ...(expectation.languages === undefined
      ? {}
      : { languages: [...expectation.languages] }),
  }));
};

const toCoreOptions = (
  request: ModelRequest,
): LanguageModelCreateCoreOptions => {
  const inputs = toExpectations(request.inputs);
  const outputs = toExpectations(request.outputs);
  return {
    ...(inputs === undefined ? {} : { expectedInputs: inputs }),
    ...(outputs === undefined ? {} : { expectedOutputs: outputs }),
  };
};

/** The spec's four strings, read off the declaration so a fifth cannot be missed. */
type SpecAvailability = Awaited<ReturnType<typeof LanguageModel.availability>>;

/**
 * The four the spec has, against the three the contract has. `downloading` and
 * `downloadable` are one branch here and differ only in `started`, which is the
 * question a caller actually has: is someone already fetching this.
 */
const toAvailability = (specAvailability: SpecAvailability): Availability => {
  switch (specAvailability) {
    case "available":
      return { kind: "ready" };
    case "downloadable":
      return { kind: "needs-download", started: false };
    case "downloading":
      return { kind: "needs-download", started: true };
    case "unavailable":
      // Empty lists: the spec says no for the whole request without naming a
      // part, and inventing one would be worse than saying nothing.
      return {
        kind: "unavailable",
        reason: { kind: "unsupported-config", languages: [] },
      };
  }
};

const getAvailability = async (
  request: ModelRequest,
): Promise<Availability> => {
  const api = getPlatformApi();
  if (api === null)
    return { kind: "unavailable", reason: { kind: "unsupported" } };
  try {
    const specAvailability = await api.availability(toCoreOptions(request));
    return toAvailability(specAvailability);
  } catch (error) {
    // `NotAllowedError` for the permissions policy, `InvalidStateError` for a
    // document that is not fully active: both are refusals, not crashes.
    return { kind: "unavailable", reason: failureFromError(error) };
  }
};

/** System first or not at all, which is what the patched tuple type says too. */
const toInitialPrompts = (
  session: SessionOptions,
): LanguageModelCreateOptions["initialPrompts"] => {
  const historyPrompts: LanguageModelMessage[] = (session.history ?? []).map(
    (message) => ({ role: message.role, content: message.content }),
  );
  if (session.system === undefined)
    return historyPrompts.length === 0 ? undefined : historyPrompts;
  return [{ role: "system", content: session.system }, ...historyPrompts];
};

const toPromptOptions = (
  request: GenerateRequest,
): LanguageModelPromptOptions =>
  request.schema === undefined
    ? { signal: request.signal }
    : { signal: request.signal, responseConstraint: request.schema };

/**
 * `contextUsage` and `contextWindow` replaced `inputUsage` and `inputQuota`,
 * and a browser in the field may have either pair. Read as unknown because the
 * declarations promise the new names on a version that has only the old.
 */
const readUsage = (session: LanguageModel): ContextUsage => {
  const sessionFields = session as unknown as Record<string, unknown>;
  const used = readNumber(sessionFields, "contextUsage", "inputUsage");
  const windowTokens = readNumber(sessionFields, "contextWindow", "inputQuota");
  if (used === null || windowTokens === null) return { kind: "unknown" };
  const usedTokens = tokens(used);
  return usedTokens === null
    ? { kind: "unknown" }
    : contextUsage(usedTokens, windowTokens);
};

const readNumber = (
  sessionFields: Record<string, unknown>,
  currentName: string,
  olderName: string,
): number | null => {
  const value = sessionFields[currentName] ?? sessionFields[olderName];
  return typeof value === "number" ? value : null;
};

class PromptApiModel implements ModelConnection {
  readonly #session: LanguageModel;

  constructor(session: LanguageModel) {
    this.#session = session;
  }

  readonly generateStream = (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    try {
      const deltas = this.#session.promptStreaming(
        input,
        toPromptOptions(request),
      );
      return Promise.resolve(ok(deltas));
    } catch (error) {
      return Promise.resolve(err(this.#refineFailure(error)));
    }
  };

  readonly generateWhole = async (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<string, AiFailure>> => {
    try {
      const answerText = await this.#session.prompt(
        input,
        toPromptOptions(request),
      );
      return ok(answerText);
    } catch (error) {
      return err(this.#refineFailure(error));
    }
  };

  readonly usage = (): ContextUsage => readUsage(this.#session);

  readonly dispose = (): void => {
    this.#session.destroy();
  };

  /**
   * `QuotaExceededError` carries no measurement, and the generic mapping says
   * so; holding the session is what lets this one attach the reading.
   */
  #refineFailure(error: unknown): AiFailure {
    const failure = failureFromError(error);
    return failure.kind === "context-overflow"
      ? { ...failure, usage: this.usage() }
      : failure;
  }
}

const connectPromptApi = async (
  options: ConnectOptions,
): Promise<Result<ModelConnection, AiFailure>> => {
  const api = getPlatformApi();
  if (api === null) return err({ kind: "unsupported" });

  const initialPrompts = toInitialPrompts(options.session);
  try {
    const session = await api.create({
      ...toCoreOptions(options.request),
      ...(initialPrompts === undefined ? {} : { initialPrompts }),
      ...(options.session.signal === undefined
        ? {}
        : { signal: options.session.signal }),
      // Translated rather than forwarded, though the browser's monitor would
      // satisfy `DownloadMonitor` as it stands: going through the lifecycle's
      // own is what applies the never-decreasing rule to every backend alike.
      monitor: (monitor) => {
        monitor.ondownloadprogress = (event) => {
          const progress = fraction(
            event.total === 0 ? 0 : event.loaded / event.total,
          );
          if (progress !== null) options.reportProgress(progress);
        };
      },
    });
    // Forwarded, not re-derived: by the time a listener reads the counters the
    // dropped turns are gone, and `used` can be back under the window.
    session.oncontextoverflow = () => {
      options.reportOverflow();
    };
    return ok(new PromptApiModel(session));
  } catch (error) {
    return err(failureFromError(error));
  }
};

export function makePromptApiProvider(): AiProvider {
  const backend: ModelBackend = {
    name: "prompt-api",
    // Text only, because that is all `AiMessage` carries. The model takes more,
    // and asking for it would promise a message this contract cannot build.
    modalities: ["text"],
    availability: (request) => getAvailability(request),
    connect: (options) => connectPromptApi(options),
  };
  return createProvider(backend);
}

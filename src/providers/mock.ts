/**
 * A provider with nothing behind it: no daemon, no browser, no network.
 *
 * It exists to hold the contract still. Every guarantee in `../types` — one
 * generation at a time, an abort that does not end the session, an overflow
 * that fires once, a close that refuses everything after it — is implemented
 * here out of the four helpers, and `../testing/contract.js` runs against it on
 * every commit. A backend that cannot be reached from a test runner is checked
 * against the same assertions this one passes.
 *
 * It is also the first place the helpers meet: `turn` serializes, `abort`
 * mixes the session's lifetime into each call, `overflow` decides when the
 * event fires, `monitor` reports a download that never happens.
 */

import { abortFailure, linkSignals } from "../helpers/abort.js";
import { ProgressMonitor } from "../helpers/monitor.js";
import { ContextEvents, withEvents } from "../helpers/overflow.js";
import { turn } from "../helpers/turn.js";
import {
  err,
  fraction,
  ok,
  tokens,
  type Result,
} from "../types/foundations.js";
import { AiError, type AiFailure } from "../types/failures.js";
import type { Modality } from "../types/messages.js";
import type { AiProvider } from "../types/provider.js";
import type {
  AiSession,
  GenerateOptions,
  ModelAccess,
  SessionOptions,
} from "../types/session.js";
import { contextUsage, type ContextUsage } from "../types/usage.js";

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
  /** Milliseconds per delta. Zero would make "while the first runs" untestable. */
  readonly delayMs?: number;
}

const DEFAULTS = {
  contextWindow: 4096,
  reply: (input: string): readonly string[] =>
    `Answering «${input.slice(0, 40)}». `.match(/\S+\s*/g) ?? ["Answer."],
  downloadSteps: [0, 0.5, 1] as readonly number[],
  delayMs: 1,
};

/** Words in, words out: a count that grows the way a real one does, without pretending to be a tokenizer. */
const spend = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Non-text is what a mock cannot serve, and saying so exercises the branch a real backend needs. */
const unservable = (request?: {
  readonly inputs?: readonly { readonly type: Modality }[];
  readonly outputs?: readonly { readonly type: Modality }[];
}): readonly Modality[] =>
  [...(request?.inputs ?? []), ...(request?.outputs ?? [])]
    .map((one) => one.type)
    .filter((type) => type !== "text");

class MockSession {
  readonly #events = new ContextEvents();
  readonly #lifetime = new AbortController();
  readonly #turn = turn();
  readonly #window: number;
  readonly #reply: (input: string) => readonly string[];
  readonly #schemaReply: string | undefined;
  readonly #delay: number;
  #used = 0;

  constructor(config: MockConfig, history: SessionOptions["history"]) {
    this.#window = config.contextWindow ?? DEFAULTS.contextWindow;
    this.#reply = config.reply ?? DEFAULTS.reply;
    this.#schemaReply = config.schemaReply;
    this.#delay = config.delayMs ?? DEFAULTS.delayMs;
    // Charged at open, as a real backend charges a transcript it was handed.
    for (const message of history ?? []) this.#used += spend(message.content);
  }

  /** The two refusals every generating call owes before it starts. */
  #refuse(
    options?: GenerateOptions,
  ): { failure: AiFailure; signal: AbortSignal } | { signal: AbortSignal } {
    const signal = linkSignals(this.#lifetime.signal, options?.signal);
    const busy = this.#turn.conflict();
    if (busy !== null) return { failure: busy, signal };
    if (signal.aborted) return { failure: abortFailure(signal), signal };
    return { signal };
  }

  #charge(input: string, answer: string): void {
    this.#used += spend(input) + spend(answer);
    this.#events.report(this.usage());
  }

  readonly prompt = async (
    input: string,
    options?: GenerateOptions,
  ): Promise<Result<string, AiFailure>> => {
    const checked = this.#refuse(options);
    if ("failure" in checked) return err(checked.failure);

    this.#turn.begin("prompt");
    try {
      // Assembled one delta at a time, at the pace a stream would: the wait is
      // what makes "while the first one runs" a state a caller can reach.
      let answer = "";
      for (const part of this.#reply(input)) {
        await wait(this.#delay);
        if (checked.signal.aborted) return err(abortFailure(checked.signal));
        answer += part;
      }
      if (options?.schema !== undefined) {
        if (this.#schemaReply === undefined) {
          return err({ kind: "failed", detail: "no schemaReply configured" });
        }
        this.#charge(input, this.#schemaReply);
        return ok(this.#schemaReply);
      }
      this.#charge(input, answer);
      return ok(answer);
    } finally {
      this.#turn.end();
    }
  };

  /** Not `async`: every await belongs to `pull`, and the start itself decides synchronously. */
  readonly promptStream = (
    input: string,
    options?: GenerateOptions,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    const checked = this.#refuse(options);
    if ("failure" in checked) return Promise.resolve(err(checked.failure));
    if (options?.schema !== undefined && this.#schemaReply === undefined) {
      return Promise.resolve(
        err({ kind: "failed", detail: "no schemaReply configured" }),
      );
    }

    this.#turn.begin("promptStream");
    const parts =
      options?.schema === undefined
        ? this.#reply(input)
        : [this.#schemaReply ?? ""];
    let index = 0;

    return Promise.resolve(
      ok(
        new ReadableStream<string>({
          pull: async (controller) => {
            await wait(this.#delay);
            if (checked.signal.aborted) {
              this.#turn.end();
              // Thrown, not returned: a reader has nowhere to put a Result, so
              // this is the one place a failure leaves the vocabulary.
              controller.error(new AiError(abortFailure(checked.signal)));
              return;
            }
            const next = parts[index];
            if (next === undefined) {
              this.#charge(input, parts.join(""));
              this.#turn.end();
              controller.close();
              return;
            }
            index += 1;
            controller.enqueue(next);
          },
          // A reader that stops reading ends the turn; the session stays open.
          cancel: () => {
            this.#turn.end();
          },
        }),
      ),
    );
  };

  readonly usage = (): ContextUsage =>
    contextUsage(tokens(this.#used) ?? ZERO, this.#window);

  readonly close = (): void => {
    // Idempotent on both halves: `abort` twice is a no-op, and so is `end`.
    this.#lifetime.abort();
    this.#turn.end();
  };

  /** The event target the contract's session extends; see `withEvents`. */
  readonly events = this.#events;
}

const ZERO = tokens(0) as NonNullable<ReturnType<typeof tokens>>;

const build = (
  config: MockConfig,
  options?: SessionOptions,
): Result<AiSession, AiFailure> => {
  if (options?.signal?.aborted === true)
    return err(abortFailure(options.signal));
  const session = new MockSession(config, options?.history);
  return ok(
    withEvents(session.events, {
      prompt: session.prompt,
      promptStream: session.promptStream,
      usage: session.usage,
      close: session.close,
    }),
  );
};

/** Split out so `access` has nothing to await and need not pretend it does. */
function accessOf(
  config: MockConfig,
  request?: Parameters<AiProvider["access"]>[0],
): ModelAccess {
  const missing = unservable(request);
  if (missing.length > 0) {
    return {
      kind: "unavailable",
      reason: {
        kind: "unsupported-config",
        languages: [],
        modalities: missing,
      },
    };
  }
  if (config.access === "unavailable") {
    return { kind: "unavailable", reason: { kind: "unsupported" } };
  }
  if (config.access === "needs-download") {
    return {
      kind: "needs-download",
      started: false,
      open: async (subscribe, options) => {
        const monitor = new ProgressMonitor();
        // Before the first await: subscribing after the promise settles is
        // subscribing after the download.
        subscribe(monitor);
        for (const step of config.downloadSteps ?? DEFAULTS.downloadSteps) {
          await wait(0);
          const at = fraction(step);
          if (at !== null) monitor.report(at);
        }
        return build(config, options);
      },
    };
  }
  return {
    kind: "ready",
    open: (options) => Promise.resolve(build(config, options)),
  };
}

export function makeMockProvider(config: MockConfig = {}): AiProvider {
  return {
    name: "mock",
    access: (request) => Promise.resolve(accessOf(config, request)),
  };
}

import type { JsonSchema, Result } from "./foundations.js";
import type { AiMessage } from "./messages.js";
import type { ContextUsage } from "./usage.js";
import type { AiFailure } from "./failures.js";

/**
 * Per-session options. Modalities and tools are deliberately not here: they
 * belong to `ModelRequest`, because they decide which model gets loaded rather
 * than how one session behaves.
 */
export interface SessionOptions {
  /** A field rather than a leading history entry, which is what makes a misplaced system turn unwritable. */
  readonly system?: string;
  // A plain array, not a non-empty tuple: an empty history is harmless, while a
  // tuple would reject the `AiMessage[]` that any caller holding React state has.
  readonly history?: readonly AiMessage[];
  /** Aborts the create, including a model download in progress. */
  readonly signal?: AbortSignal;
}

export interface GenerateOptions {
  readonly signal?: AbortSignal;
  /**
   * `responseConstraint`: it constrains decoding, so the model cannot emit
   * another shape.
   *
   * Honoured or refused, never ignored. A provider that cannot constrain
   * decoding fails the call; answering anyway would hand back prose where the
   * caller is about to run `JSON.parse`, and nothing in the Result says the
   * constraint was dropped.
   */
  readonly schema?: JsonSchema;
}

/**
 * One generation at a time: while a `prompt` or a `promptStream` is running,
 * both calls fail with `busy`. A session is one transcript, and interleaving
 * two turns into it produces a history no caller can repair; the refusal
 * itself is `src/helpers/lifetime.ts`. Like the guarantee on `close`, this one is
 * runtime: a type cannot say "not while that promise is pending".
 *
 * Callbacks are fields, not methods: `strictFunctionTypes` checks argument
 * types strictly only on function-typed properties, while method syntax stays
 * bivariant and would let an implementation narrow an argument.
 */
export interface AiSession extends EventTarget {
  /**
   * The transcript has outgrown the window, and the oldest turns are being
   * dropped to fit the newest — silently, wherever the backend does it. Fires
   * once: the window does not un-overflow, and every turn after the first is
   * over the same line.
   *
   * An `onevent` property rather than a typed `addEventListener`, for the
   * reason spelled out on `DownloadMonitor`. The event carries nothing: what a
   * listener wants next is `usage()`, which is current by the time this fires.
   */
  oncontextoverflow: ((event: Event) => void) | null;
  readonly prompt: (
    input: string,
    options?: GenerateOptions,
  ) => Promise<Result<string, AiFailure>>;
  /**
   * A `ReadableStream`, not a bare async iterable, so the caller keeps `tee()`,
   * `pipeThrough()` and `cancel()`.
   *
   * Consume it with a reader loop: async iteration of a stream is missing in
   * Safari, and `dom.asynciterable` is deliberately left out of `lib` so the
   * compiler rejects `for await` here. It also hides a trap — leaving such a
   * loop with `break` cancels generation unless you iterate
   * `stream.values({ preventCancel: true })`.
   *
   * Only a failure to start lands in Result; a break after the first chunk
   * surfaces as a stream error, and that error is an `AiError` — a reader has
   * nowhere to put a Result, so this is the one place a failure is thrown.
   */
  readonly promptStream: (
    input: string,
    options?: GenerateOptions,
  ) => Promise<Result<ReadableStream<string>, AiFailure>>;
  readonly usage: () => ContextUsage;
  /**
   * The conversation so far: what was handed at open, then every completed
   * turn. An aborted or cancelled turn adds nothing, and nothing is ever
   * dropped — `src/helpers/transcript.ts` holds both rules.
   *
   * Hand it back to `open` and the conversation continues where it was, which
   * is how it survives a reload. Each call is a snapshot: later turns do not
   * write into an array already handed out.
   */
  readonly history: () => readonly AiMessage[];
  /**
   * In-flight and later calls fail with `aborted`, matching `destroy()`.
   *
   * Types cannot carry that guarantee — a value cannot be spent in TypeScript,
   * so the old reference stays valid. Stating it as a runtime guarantee is
   * honest; pretending the types hold it would not be.
   */
  readonly close: () => void;
}

type OpenSession = (
  options?: SessionOptions,
) => Promise<Result<AiSession, AiFailure>>;

/**
 * The download monitor, shaped after the spec's `CreateMonitor`: an
 * `EventTarget` firing `downloadprogress` with a `ProgressEvent`. The browser's
 * own monitor satisfies this too, so a Prompt API provider can hand its one
 * through — `src/types.test-d.ts` checks that against the ambient declaration.
 * `src/helpers/monitor.ts` is the implementation for a provider with no browser
 * behind it.
 *
 * `ondownloadprogress` is the whole surface because it is the only typed way
 * in. An `addEventListener` overload narrowed to `downloadprogress` does not
 * survive extending `EventTarget`: the inherited listener parameter is
 * `EventListener`, a listener taking a `ProgressEvent` is not one, and neither
 * this interface's implementations nor the ambient `CreateMonitor` then satisfy
 * it (TS2420 and TS2322, measured). A caller wanting several listeners uses
 * `addEventListener` and casts the event.
 *
 * What a provider owes a listener: `loaded` is 0..1, never decreasing, and
 * `total` is 1 — see `DownloadProgressEvent` for where that normalization
 * comes from, and `Fraction` for what carries it.
 */
export interface DownloadMonitor extends EventTarget {
  ondownloadprogress: ((event: ProgressEvent) => void) | null;
}

/**
 * Availability and session creation are one value, not two calls. `open`
 * exists only on the variants where opening can work, so "create a session
 * from an unavailable model" is not a mistake to guard against — it is
 * unwritable.
 */
export type ModelAccess =
  // A full AiFailure, not a string: the reasons are the same ones any other
  // call fails with.
  | { readonly kind: "unavailable"; readonly reason: AiFailure }
  | { readonly kind: "ready"; readonly open: OpenSession }
  | {
      readonly kind: "needs-download";
      /** True when another caller already started the fetch (`downloading` in the spec). */
      readonly started: boolean;
      /**
       * The monitor is the first argument and required: this is the one branch
       * where weights are certainly being fetched, and a silent download of
       * hundreds of megabytes reads as a frozen UI.
       *
       * A callback handed the monitor, not a monitor handed back, and it runs
       * before `open` awaits anything — subscribing after the promise settles
       * is subscribing after the download. The spec's `monitor` option works
       * the same way and for the same reason.
       */
      readonly open: (
        monitor: (monitor: DownloadMonitor) => void,
        options?: SessionOptions,
      ) => Promise<Result<AiSession, AiFailure>>;
    };

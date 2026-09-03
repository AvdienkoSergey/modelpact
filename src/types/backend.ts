/**
 * What a backend supplies; `../lifecycle` turns it into an `AiProvider`.
 *
 * The contract's runtime guarantees — one generation at a time, an abort that
 * leaves the session open, a close that refuses everything after it, an
 * overflow that fires once — are implemented once, in `../lifecycle/01_access.ts`
 * through `05_close.ts`. A backend never sees them: it says what the model is
 * and how to talk to it, and the order of calls is the lifecycle's business.
 */

import type { Fraction, JsonSchema, Result } from "./foundations.js";
import type { AiFailure } from "./failures.js";
import type { Modality, ModelRequest } from "./messages.js";
import type { ProviderName } from "./provider.js";
import type { SessionOptions } from "./session.js";
import type { ContextUsage } from "./usage.js";

/** `ModelAccess` without `open`; the lifecycle attaches that. */
export type Availability =
  | { readonly kind: "unavailable"; readonly reason: AiFailure }
  | { readonly kind: "ready" }
  | { readonly kind: "needs-download"; readonly started: boolean };

export interface ConnectOptions {
  /** The request `access` was asked with; the Prompt API wants it again as `expectedInputs`. */
  readonly request: ModelRequest;
  readonly session: SessionOptions;
  /** Already subscribed to when `connect` runs; a no-op on the `ready` branch. */
  readonly reportProgress: (loaded: Fraction) => void;
  /** For a backend that hears its own overflow event. Idempotent. */
  readonly reportOverflow: () => void;
}

export interface GenerateRequest {
  /** The session's lifetime linked with the call's own; pass it on wherever the backend can be interrupted. */
  readonly signal: AbortSignal;
  readonly schema?: JsonSchema;
}

/** One open connection to a model. Busy, abort and usage are checked around these calls, not inside them. */
export interface Model {
  readonly generate: (
    input: string,
    request: GenerateRequest,
  ) => Promise<Result<ReadableStream<string>, AiFailure>>;
  /** Absent, `prompt` drains `generate`; present for a backend with a cheaper whole-answer call. */
  readonly generateWhole?: (
    input: string,
    request: GenerateRequest,
  ) => Promise<Result<string, AiFailure>>;
  readonly usage: () => ContextUsage;
  /** Called once, from `close`. */
  readonly dispose: () => void;
}

export interface ModelBackend {
  readonly name: ProviderName;
  /** What the model can be asked for; a request outside it is refused before `availability` runs. */
  readonly modalities: readonly Modality[];
  readonly availability: (
    request: ModelRequest,
  ) => Availability | Promise<Availability>;
  /** Downloads if it must, reporting through `reportProgress`, then connects. */
  readonly connect: (
    options: ConnectOptions,
  ) => Promise<Result<Model, AiFailure>>;
}

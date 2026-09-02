import type { Modality } from "./messages.js";
import type { ContextUsage } from "./usage.js";

// Prettier reindents this union and hoists the first member's doc above the
// opening paren, where it reads as a doc for the whole intersection.
// prettier-ignore
/**
 * The contract's failure vocabulary: any refusal from any provider — browser,
 * Ollama, mock — is one of these kinds.
 *
 * The set is cut by the caller's next move, not by exception name: kinds merge
 * where the reaction would be the same and split where it differs, even when
 * the spec throws one exception for both (`unsupported-config` vs
 * `unsupported-input`). The mechanical name-to-kind mapping lives in
 * `failureFrom`; the kinds with no spec exception behind them (`unsupported`,
 * `busy`, `unknown`) say so in their own docs below.
 *
 * Each failure carries exactly the data its kind implies. `cause` is factored
 * into an intersection to avoid repeating it; narrowing on `kind` still works
 * through that, which `src/types.test-d.ts` checks.
 */
export type AiFailure = { readonly cause?: unknown } & (
  /** No such API in this runtime. */
  | { readonly kind: "unsupported" }
  /** Blocked by the `language-model` Permissions-Policy (`NotAllowedError`). */
  | { readonly kind: "not-allowed" }
  /**
   * The environment has a model, but not for this request. Both lists name the
   * parts that did not fit; empty or absent means the provider did not narrow
   * it down.
   */
  | {
      readonly kind: "unsupported-config";
      readonly languages: readonly string[];
      readonly modalities?: readonly Modality[];
    }
  /**
   * The message the caller built is not accepted. Kept apart from
   * `unsupported-config` because it is a bug in the caller, not the
   * environment — the spec throws one `NotSupportedError` for both.
   */
  | { readonly kind: "unsupported-input"; readonly detail: string }
  /**
   * `QuotaExceededError`: usage passed the window. Retrying without trimming
   * history will fail again, hence the measurement travels along.
   */
  | { readonly kind: "context-overflow"; readonly usage: ContextUsage }
  /** Explicit abort, or a call on a closed session — the spec throws `AbortError` for both. */
  | { readonly kind: "aborted"; readonly reason: string }
  /** Malformed request: empty message list, misplaced system turn, conflicting options. */
  | { readonly kind: "invalid-input"; readonly detail: string }
  /** Document not fully active. */
  | { readonly kind: "invalid-state"; readonly detail: string }
  /**
   * A generation is already running on this session; `detail` names the call
   * holding it. Its own kind rather than a shade of `invalid-state`: the spec
   * spends that one on a single condition (the document is not fully active),
   * and the caller's move differs — wait, or open a second session.
   *
   * Not a spec exception: the spec says nothing about two `prompt()` calls at
   * once, and points at `clone()` for work meant to run in parallel. A
   * provider here has to serialize instead.
   */
  | { readonly kind: "busy"; readonly detail: string }
  /** The browser's own catch-all (`OperationError`). */
  | { readonly kind: "failed"; readonly detail: string }
  | { readonly kind: "unknown" }
);

/**
 * Where thrown exceptions enter the vocabulary: whatever a provider caught
 * becomes an `AiFailure`, mapped by DOMException name. This is the generic
 * half of the mapping — a provider that knows the call site refines what a
 * name alone cannot say (see the `NotSupportedError` and
 * `QuotaExceededError` branches).
 *
 * Matches on `error.name` rather than `instanceof DOMException`, because the
 * spec throws a plain `TypeError` that the latter would miss. The trade-off is
 * that a genuine `TypeError` from a bug in the adapter also lands in
 * `invalid-input`.
 */
export function failureFrom(error: unknown): AiFailure {
  const name = error instanceof Error ? error.name : "";
  const detail = error instanceof Error ? error.message : String(error);
  const fromDom =
    typeof DOMException !== "undefined" && error instanceof DOMException;

  switch (name) {
    case "AbortError":
      return { kind: "aborted", reason: detail, cause: error };
    case "InvalidStateError":
      return { kind: "invalid-state", detail, cause: error };
    case "NotAllowedError":
      return { kind: "not-allowed", cause: error };
    case "NotSupportedError":
      // The name covers both "wrong environment" and "wrong message" and
      // cannot tell them apart; a provider that knows the call site must build
      // `unsupported-input` itself. Empty list means "not narrowed down".
      return { kind: "unsupported-config", languages: [], cause: error };
    case "OperationError":
      return { kind: "failed", detail, cause: error };
    case "QuotaExceededError":
      // The exception carries no measurement; a provider holding the session
      // can refine this.
      return {
        kind: "context-overflow",
        usage: { kind: "unknown" },
        cause: error,
      };
    case "SyntaxError":
      // The spec's SyntaxError is a DOMException; JSON.parse on a truncated
      // frame throws a native one under the same name. Only the former means
      // "the caller sent nonsense". A provider should still convert its own
      // parse errors where they happen rather than let them reach here.
      return fromDom
        ? { kind: "invalid-input", detail, cause: error }
        : { kind: "failed", detail, cause: error };
    case "TypeError":
      // No such split available: the spec throws a native TypeError too.
      return { kind: "invalid-input", detail, cause: error };
    default:
      return { kind: "unknown", cause: error };
  }
}

/**
 * For the boundaries where throwing is unavoidable — React error boundaries,
 * tests. Inside the adapter, failures travel as values.
 */
export class AiError extends Error {
  constructor(readonly failure: AiFailure) {
    // Only the kind: the details are in `failure`, and restating them as a
    // string would create a second version of the truth.
    super(failure.kind, { cause: failure.cause });
    this.name = "AiError";
  }
}

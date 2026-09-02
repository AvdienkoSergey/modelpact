/**
 * The abort mechanics every provider shares: one session-wide signal mixed
 * into every generation, so a close ends the in-flight calls and the later
 * ones alike.
 */

import type { AiFailure } from "../types/failures.js";

export function abortFailure(signal: AbortSignal): AiFailure {
  const reason: unknown = signal.reason;
  return {
    kind: "aborted",
    reason: reason instanceof Error ? reason.message : String(reason),
    cause: reason,
  };
}

/**
 * Skips `AbortSignal.any` when there is nothing to link: `any([s])` allocates
 * a fresh signal and a listener on the original, for nothing. The `reason`
 * survives either way — it propagates by identity, not by copy.
 */
export const linkSignals = (
  lifetime: AbortSignal,
  extra?: AbortSignal,
): AbortSignal =>
  extra === undefined ? lifetime : AbortSignal.any([lifetime, extra]);

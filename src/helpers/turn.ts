/**
 * One generation at a time, per session.
 *
 * A session is a transcript, appended to in the order the answers arrive. Two
 * generations over one list splice into it in whatever order the network
 * settles, and no caller can detect that afterwards — hence a refusal at the
 * door rather than a queue.
 *
 * Shared rather than written twice: the contract suite would see each provider
 * refuse and never notice they refuse different things.
 */

import type { AiFailure } from "../types/failures.js";

/** The two contract calls that generate; `usage` and `close` never conflict. */
export type Generating = "prompt" | "promptStream";

export interface Turn {
  /** The failure to report, or null when nothing is running. */
  readonly conflict: () => AiFailure | null;
  /** Records the running call. Pair with `end` in a `finally`. */
  readonly begin: (call: Generating) => void;
  /** Idempotent: the abort and the completion path can both reach it. */
  readonly end: () => void;
}

export function turn(): Turn {
  let running: Generating | null = null;
  return {
    conflict: () =>
      running === null
        ? null
        : {
            kind: "busy",
            detail: `${running} is already running on this session`,
          },
    begin: (call) => {
      running = call;
    },
    end: () => {
      running = null;
    },
  };
}

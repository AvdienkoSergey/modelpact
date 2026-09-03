/**
 * A session is idle, generating, or closed: one cell, not three flags.
 *
 * A `running` name beside an `aborted` signal beside a `disposed` boolean lets
 * every combination compile — closed but busy, a turn with no signal to end
 * it, an `end()` from a turn abandoned two turns ago freeing the one running
 * now. Here the phase is a union, the running phase carries the signal that
 * ends it, and it is its own token: `end` compares identity, so a stale hook
 * has nothing to free.
 *
 * Shared rather than written per provider, for the reason `overflow.ts` is
 * shared: the contract suite would see each one refuse and never notice they
 * refuse different things.
 */

import { err, ok, type Result } from "../types/foundations.js";
import type { AiFailure } from "../types/failures.js";
import { abortFailure, linkSignals } from "./abort.js";

/** The two contract calls that generate; `usage` and `close` never conflict. */
export type Generating = "prompt" | "promptStream";

/** Proof that the door was open: the only way to hold one is `begin` agreeing. */
export interface RunningTurn {
  readonly call: Generating;
  /** The session's own abort linked with the caller's; hand this to the backend. */
  readonly signal: AbortSignal;
}

type Phase =
  | { readonly kind: "idle" }
  | {
      readonly kind: "generating";
      readonly turn: RunningTurn;
      /** Aborted by `close`, by nothing else. */
      readonly abort: AbortController;
    }
  | { readonly kind: "closed" };

export interface SessionLifetime {
  /** A running turn, or what this call owes the caller: `busy` while another runs, `aborted` once closed. */
  readonly begin: (
    call: Generating,
    signal?: AbortSignal,
  ) => Result<RunningTurn, AiFailure>;
  /** Ignored unless `turn` is the one running, which is what keeps an abandoned turn from freeing its successor. */
  readonly end: (turn: RunningTurn) => void;
  /** `closed-now` once per session; the caller releases the model on that one. */
  readonly close: () => "closed-now" | "already-closed";
}

/** No signal to read a reason from: closing is not an abort with a cause, it is the end of the session. */
const CLOSED: AiFailure = {
  kind: "aborted",
  reason: "the session is closed",
};

const busyOn = (call: Generating): AiFailure => ({
  kind: "busy",
  detail: `${call} is already running on this session`,
});

export function createSessionLifetime(): SessionLifetime {
  let phase: Phase = { kind: "idle" };

  return {
    begin: (call, signal) => {
      switch (phase.kind) {
        case "closed":
          return err(CLOSED);
        case "generating":
          return err(busyOn(phase.turn.call));
        case "idle": {
          // The caller's own signal, not the linked one: its reason is the one
          // worth reporting, and linking an aborted signal only to read it back
          // is work for nothing.
          if (signal?.aborted === true) return err(abortFailure(signal));
          const abort = new AbortController();
          const turn = { call, signal: linkSignals(abort.signal, signal) };
          phase = { kind: "generating", turn, abort };
          return ok(turn);
        }
      }
    },

    end: (turn) => {
      if (phase.kind !== "generating") return;
      if (phase.turn !== turn) return;
      phase = { kind: "idle" };
    },

    close: () => {
      if (phase.kind === "closed") return "already-closed";
      // Moved before the abort: the listeners run synchronously, and one of
      // them reaching back in must find a closed session rather than this one.
      const closing = phase;
      phase = { kind: "closed" };
      if (closing.kind === "generating") closing.abort.abort();
      return "closed-now";
    },
  };
}

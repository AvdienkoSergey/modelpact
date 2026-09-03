import { describe, expect, test } from "vitest";

import { abortFailure, linkSignals } from "./abort.js";

/** A signal already aborted, with the platform's reason unless given one. */
const abortedSignal = (reason?: unknown): AbortSignal => {
  const controller = new AbortController();
  controller.abort(reason);
  return controller.signal;
};

describe("abortFailure", () => {
  test("the platform default is a DOMException and reaches cause intact", () => {
    const signal = abortedSignal();
    const failure = abortFailure(signal);

    expect(failure.kind).toBe("aborted");
    expect(failure.cause).toBeInstanceOf(DOMException);
    expect(failure.cause).toBe(signal.reason);
  });

  test("an Error reason is read for its message", () => {
    const reason = new Error("the page went away");
    const failure = abortFailure(abortedSignal(reason));

    expect(failure).toMatchObject({
      kind: "aborted",
      reason: "the page went away",
    });
    expect(failure.cause).toBe(reason);
  });

  test("a non-Error reason is stringified, and kept whole in cause", () => {
    // `abort(x)` takes any value at all — which is why `signal.reason` is
    // typed `unknown` and why this normalization exists at all.
    expect(abortFailure(abortedSignal("just because"))).toMatchObject({
      kind: "aborted",
      reason: "just because",
    });
  });

  test("the original object survives by identity, not by copy", () => {
    // A caller that aborted with a rich reason can still read it back off
    // `cause`; only the human-facing string is flattened.
    const reason = { code: 7, retryable: false };
    expect(abortFailure(abortedSignal(reason)).cause).toBe(reason);
  });
});

describe("linkSignals", () => {
  test("with nothing to link it hands back the very same signal", () => {
    const sessionSignal = new AbortController().signal;

    // The same object, not an equal one. `AbortSignal.any([s])` would allocate
    // a fresh signal and register a listener on the original, for one input.
    expect(linkSignals(sessionSignal)).toBe(sessionSignal);
  });

  test("the caller's own signal aborts the generation", () => {
    const sessionAbort = new AbortController();
    const callerAbort = new AbortController();
    const linked = linkSignals(sessionAbort.signal, callerAbort.signal);
    expect(linked.aborted).toBe(false);

    callerAbort.abort(new Error("caller changed their mind"));

    expect(linked.aborted).toBe(true);
  });

  test("close() aborts a call that brought its own signal", () => {
    // The half that makes `close()` end in-flight work: the session's signal
    // is mixed into every generation, whatever the caller passed.
    const sessionAbort = new AbortController();
    const linked = linkSignals(
      sessionAbort.signal,
      new AbortController().signal,
    );

    sessionAbort.abort(new Error("close()"));

    expect(linked.aborted).toBe(true);
  });

  test("the reason propagates by identity, not by copy", () => {
    // What the shortcut above rests on: a linked signal reports the very
    // object it was aborted with, so `abortFailure` reads the same reason
    // whether or not `AbortSignal.any` was involved.
    const sessionAbort = new AbortController();
    const linked = linkSignals(
      sessionAbort.signal,
      new AbortController().signal,
    );
    const reason = new Error("close()");

    sessionAbort.abort(reason);

    const seenReason: unknown = linked.reason;
    expect(seenReason).toBe(reason);
    expect(abortFailure(linked).cause).toBe(reason);
  });

  test("a lifetime already spent yields a signal already aborted", () => {
    // A generation started after `close()` fails at once rather than running
    // and being cancelled a tick later.
    const linked = linkSignals(abortedSignal(new Error("closed earlier")));

    expect(linked.aborted).toBe(true);
    expect(abortFailure(linked)).toMatchObject({
      kind: "aborted",
      reason: "closed earlier",
    });
  });
});

import { describe, expect, test } from "vitest";

import { createSessionLifetime } from "./lifetime.js";

/** A begun turn or a thrown test: the failure branch is asserted where it is the subject. */
const beginOrThrow = (
  lifetime: ReturnType<typeof createSessionLifetime>,
  call: "prompt" | "promptStream",
  signal?: AbortSignal,
) => {
  const begun = lifetime.begin(call, signal);
  if (!begun.ok) throw new Error(`expected a turn, got ${begun.error.kind}`);
  return begun.value;
};

describe("session lifetime", () => {
  test("a fresh session opens the door and hands over a live signal", () => {
    const turn = beginOrThrow(createSessionLifetime(), "prompt");
    expect(turn.call).toBe("prompt");
    expect(turn.signal.aborted).toBe(false);
  });

  test("the refusal names the call holding the session", () => {
    const lifetime = createSessionLifetime();
    beginOrThrow(lifetime, "promptStream");

    const second = lifetime.begin("prompt");
    expect(second.ok).toBe(false);
    if (second.ok) return;
    // `busy` rather than a shade of `invalid-state`: the caller's move is to
    // wait or open a second session, and the detail says what to wait for.
    expect(second.error).toEqual({
      kind: "busy",
      detail: "promptStream is already running on this session",
    });
  });

  test("ending frees the session for the next turn", () => {
    const lifetime = createSessionLifetime();
    const first = beginOrThrow(lifetime, "prompt");
    lifetime.end(first);
    expect(lifetime.begin("prompt").ok).toBe(true);
  });

  test("an abandoned turn cannot free the one that replaced it", () => {
    const lifetime = createSessionLifetime();
    const abandoned = beginOrThrow(lifetime, "promptStream");
    lifetime.end(abandoned);
    beginOrThrow(lifetime, "prompt");

    // The late `cancel` of a stream nobody reads any more, arriving after the
    // next turn has started.
    lifetime.end(abandoned);
    expect(lifetime.begin("prompt").ok).toBe(false);
  });

  test("an already-aborted signal is refused without holding the session", () => {
    const lifetime = createSessionLifetime();
    const refused = lifetime.begin("prompt", AbortSignal.abort());
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.kind).toBe("aborted");
    expect(lifetime.begin("prompt").ok).toBe(true);
  });

  test("the caller's signal ends the turn without closing the session", () => {
    const lifetime = createSessionLifetime();
    const caller = new AbortController();
    const turn = beginOrThrow(lifetime, "prompt", caller.signal);

    caller.abort();
    expect(turn.signal.aborted).toBe(true);
    lifetime.end(turn);
    expect(lifetime.begin("prompt").ok).toBe(true);
  });

  test("closing aborts the turn in flight", () => {
    const lifetime = createSessionLifetime();
    const turn = beginOrThrow(lifetime, "prompt");
    expect(lifetime.close()).toBe("closed-now");
    expect(turn.signal.aborted).toBe(true);
  });

  test("closed is terminal: later turns are refused and ending does not reopen", () => {
    const lifetime = createSessionLifetime();
    const turn = beginOrThrow(lifetime, "prompt");
    lifetime.close();

    lifetime.end(turn);
    const later = lifetime.begin("prompt");
    expect(later.ok).toBe(false);
    if (!later.ok) expect(later.error.kind).toBe("aborted");
  });

  test("closing twice says so, which is how the model is released once", () => {
    const lifetime = createSessionLifetime();
    expect(lifetime.close()).toBe("closed-now");
    expect(lifetime.close()).toBe("already-closed");
  });

  test("two sessions do not share a door", () => {
    const first = createSessionLifetime();
    const second = createSessionLifetime();
    beginOrThrow(first, "prompt");
    expect(second.begin("prompt").ok).toBe(true);
  });
});

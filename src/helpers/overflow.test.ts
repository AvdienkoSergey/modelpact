import { describe, expect, test } from "vitest";

import { ok, tokens, type Tokens } from "../types/foundations.js";
import type { AiSession } from "../types/session.js";
import { contextUsage } from "../types/usage.js";
import { CONTEXT_OVERFLOW, ContextEvents, withEvents } from "./overflow.js";

const t = (value: number): Tokens => {
  const parsed = tokens(value);
  if (parsed === null) throw new RangeError(`not a token count: ${value}`);
  return parsed;
};

/** Collects every `contextoverflow` the object dispatches. */
const fired = (events: ContextEvents): Event[] => {
  const seen: Event[] = [];
  events.oncontextoverflow = (event) => seen.push(event);
  return seen;
};

/** The closures a provider builds, minus everything the event target supplies. */
const closures = (): Omit<
  AiSession,
  keyof EventTarget | "oncontextoverflow"
> => ({
  prompt: (input) => Promise.resolve(ok(input)),
  promptStream: () => Promise.resolve(ok(new ReadableStream<string>())),
  usage: () => ({ kind: "unknown" }),
  history: () => [],
  close: () => undefined,
});

describe("ContextEvents.report", () => {
  test("a window filled to the brim does not fire", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    // Strictly greater: a transcript that exactly fills the window still fits,
    // and nothing has been dropped yet.
    events.report(contextUsage(t(100), 100));

    expect(seen).toEqual([]);
  });

  test("spending past the window fires", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    events.report(contextUsage(t(101), 100));

    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe(CONTEXT_OVERFLOW);
  });

  test("it fires once and stays quiet however far past the line it goes", () => {
    // The window does not un-overflow. Every turn after the first is over the
    // same line, and a listener wants the fact, not a reminder each turn.
    const events = new ContextEvents();
    const seen = fired(events);

    events.report(contextUsage(t(101), 100));
    events.report(contextUsage(t(200), 100));
    events.report(contextUsage(t(300), 100));

    expect(seen).toHaveLength(1);
  });

  test("an unbounded window has no line to cross", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    events.report(contextUsage(t(1_000_000), Infinity));

    expect(seen).toEqual([]);
  });

  test("an unknown window has no line to cross", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    // A fractional total is what a backend returning something unexpected
    // becomes. Guessing an overflow from it would be inventing a number.
    events.report(contextUsage(t(1_000_000), 10.5));

    expect(seen).toEqual([]);
  });
});

describe("ContextEvents.announce", () => {
  test("a backend that decided for itself fires without counters", () => {
    // The browser fires its own `contextoverflow`; forwarding that beats
    // re-deriving it from counters whose dropped turns are already gone.
    const events = new ContextEvents();
    const seen = fired(events);

    events.announce();

    expect(seen).toHaveLength(1);
  });

  test("the two doors lead into one state", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    events.announce();
    events.report(contextUsage(t(500), 100));
    events.announce();

    expect(seen).toHaveLength(1);
  });

  test("a report that already fired closes the announce door too", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    events.report(contextUsage(t(101), 100));
    events.announce();

    expect(seen).toHaveLength(1);
  });
});

describe("ContextEvents.oncontextoverflow", () => {
  test("assigning twice replaces rather than adds", () => {
    // An `onevent` property is one registration, not a growing list — the
    // whole difference from `addEventListener`.
    const events = new ContextEvents();
    const first: Event[] = [];
    const second: Event[] = [];

    events.oncontextoverflow = (event) => first.push(event);
    events.oncontextoverflow = (event) => second.push(event);
    events.announce();

    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
  });

  test("null unsubscribes", () => {
    const events = new ContextEvents();
    const seen = fired(events);

    events.oncontextoverflow = null;
    events.announce();

    expect(seen).toEqual([]);
    expect(events.oncontextoverflow).toBeNull();
  });

  test("listeners added both ways both fire", () => {
    const events = new ContextEvents();
    const property = fired(events);
    const listeners: Event[] = [];
    events.addEventListener(CONTEXT_OVERFLOW, (event) => listeners.push(event));

    events.announce();

    expect(property).toHaveLength(1);
    expect(listeners).toHaveLength(1);
  });
});

describe("withEvents", () => {
  test("the session is the event target, not a copy of one", () => {
    const events = new ContextEvents();
    const session = withEvents(events, closures());

    // `Object.assign` mutates and returns its target. That is the point: the
    // contract extends `EventTarget`, and an object literal is not one.
    expect(session).toBe(events);
    expect(session).toBeInstanceOf(EventTarget);
  });

  test("the closures come through and the event still reaches a listener", async () => {
    const events = new ContextEvents();
    const session: AiSession = withEvents(events, closures());
    const seen: Event[] = [];
    session.oncontextoverflow = (event) => seen.push(event);

    const reply = await session.prompt("hi");

    expect(reply.ok && reply.value).toBe("hi");
    expect(session.usage()).toEqual({ kind: "unknown" });

    events.announce();
    expect(seen).toHaveLength(1);
  });
});

import { describe, expect, test } from "vitest";

import { ok, tokens, type Tokens } from "../types/foundations.js";
import type { AiSession } from "../types/session.js";
import { contextUsage } from "../types/usage.js";
import { CONTEXT_OVERFLOW, ContextEvents, withEvents } from "./overflow.js";

const toTokens = (value: number): Tokens => {
  const parsedTokens = tokens(value);
  if (parsedTokens === null)
    throw new RangeError(`not a token count: ${value}`);
  return parsedTokens;
};

/** Collects every `contextoverflow` the object dispatches. */
const collectOverflows = (events: ContextEvents): Event[] => {
  const seenEvents: Event[] = [];
  events.oncontextoverflow = (event) => seenEvents.push(event);
  return seenEvents;
};

/** The closures a provider builds, minus everything the event target supplies. */
const makeSessionClosures = (): Omit<
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
    const seenEvents = collectOverflows(events);

    // Strictly greater: a transcript that exactly fills the window still fits,
    // and nothing has been dropped yet.
    events.report(contextUsage(toTokens(100), 100));

    expect(seenEvents).toEqual([]);
  });

  test("spending past the window fires", () => {
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.report(contextUsage(toTokens(101), 100));

    expect(seenEvents).toHaveLength(1);
    expect(seenEvents[0]?.type).toBe(CONTEXT_OVERFLOW);
  });

  test("it fires once and stays quiet however far past the line it goes", () => {
    // The window does not un-overflow. Every turn after the first is over the
    // same line, and a listener wants the fact, not a reminder each turn.
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.report(contextUsage(toTokens(101), 100));
    events.report(contextUsage(toTokens(200), 100));
    events.report(contextUsage(toTokens(300), 100));

    expect(seenEvents).toHaveLength(1);
  });

  test("an unbounded window has no line to cross", () => {
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.report(contextUsage(toTokens(1_000_000), Infinity));

    expect(seenEvents).toEqual([]);
  });

  test("an unknown window has no line to cross", () => {
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    // A fractional total is what a backend returning something unexpected
    // becomes. Guessing an overflow from it would be inventing a number.
    events.report(contextUsage(toTokens(1_000_000), 10.5));

    expect(seenEvents).toEqual([]);
  });
});

describe("ContextEvents.announce", () => {
  test("a backend that decided for itself fires without counters", () => {
    // The browser fires its own `contextoverflow`; forwarding that beats
    // re-deriving it from counters whose dropped turns are already gone.
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.announce();

    expect(seenEvents).toHaveLength(1);
  });

  test("the two doors lead into one state", () => {
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.announce();
    events.report(contextUsage(toTokens(500), 100));
    events.announce();

    expect(seenEvents).toHaveLength(1);
  });

  test("a report that already fired closes the announce door too", () => {
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.report(contextUsage(toTokens(101), 100));
    events.announce();

    expect(seenEvents).toHaveLength(1);
  });
});

describe("ContextEvents.oncontextoverflow", () => {
  test("assigning twice replaces rather than adds", () => {
    // An `onevent` property is one registration, not a growing list — the
    // whole difference from `addEventListener`.
    const events = new ContextEvents();
    const firstSeen: Event[] = [];
    const secondSeen: Event[] = [];

    events.oncontextoverflow = (event) => firstSeen.push(event);
    events.oncontextoverflow = (event) => secondSeen.push(event);
    events.announce();

    expect(firstSeen).toEqual([]);
    expect(secondSeen).toHaveLength(1);
  });

  test("null unsubscribes", () => {
    const events = new ContextEvents();
    const seenEvents = collectOverflows(events);

    events.oncontextoverflow = null;
    events.announce();

    expect(seenEvents).toEqual([]);
    expect(events.oncontextoverflow).toBeNull();
  });

  test("listeners added both ways both fire", () => {
    const events = new ContextEvents();
    const propertyEvents = collectOverflows(events);
    const listenerEvents: Event[] = [];
    events.addEventListener(CONTEXT_OVERFLOW, (event) =>
      listenerEvents.push(event),
    );

    events.announce();

    expect(propertyEvents).toHaveLength(1);
    expect(listenerEvents).toHaveLength(1);
  });
});

describe("withEvents", () => {
  test("the session is the event target, not a copy of one", () => {
    const events = new ContextEvents();
    const session = withEvents(events, makeSessionClosures());

    // `Object.assign` mutates and returns its target. That is the point: the
    // contract extends `EventTarget`, and an object literal is not one.
    expect(session).toBe(events);
    expect(session).toBeInstanceOf(EventTarget);
  });

  test("the closures come through and the event still reaches a listener", async () => {
    const events = new ContextEvents();
    const session: AiSession = withEvents(events, makeSessionClosures());
    const seenEvents: Event[] = [];
    session.oncontextoverflow = (event) => seenEvents.push(event);

    const replyResult = await session.prompt("hi");

    expect(replyResult.ok && replyResult.value).toBe("hi");
    expect(session.usage()).toEqual({ kind: "unknown" });

    events.announce();
    expect(seenEvents).toHaveLength(1);
  });
});

/**
 * The paths the mock never takes: a backend that throws, and one with a
 * whole-answer call. Everything else about the lifecycle is the contract suite
 * in `./mock.test.ts`.
 */

import { describe, expect, test } from "vitest";

import { ok } from "../types/foundations.js";
import { AiError } from "../types/failures.js";
import type { AiMessage } from "../types/messages.js";
import type { AiSession, SessionOptions } from "../types/session.js";
import type { ModelConnection } from "../types/backend.js";
import { createProvider } from "./create.js";

const makeStream = (...chunks: string[]): ReadableStream<string> =>
  new ReadableStream<string>({
    start: (controller) => {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

/** One delta, then the platform's own abort. */
const failingStream = (): ReadableStream<string> =>
  new ReadableStream<string>({
    start: (controller) => {
      controller.enqueue("one ");
      controller.error(new DOMException("interrupted", "AbortError"));
    },
  });

const makeModel = (
  generateStream: ModelConnection["generateStream"],
): ModelConnection => ({
  generateStream,
  usage: () => ({ kind: "unknown" }),
  dispose: () => undefined,
});

const openSessionWith = async (
  model: ModelConnection,
  options?: SessionOptions,
): Promise<AiSession> => {
  const provider = createProvider({
    name: "mock",
    modalities: ["text"],
    availability: () => ({ kind: "ready" }),
    connect: () => Promise.resolve(ok(model)),
  });
  const access = await provider.access();
  if (access.kind !== "ready") throw new Error("expected ready");
  const sessionResult = await access.open(options);
  if (!sessionResult.ok) throw new Error("expected a session");
  return sessionResult.value;
};

const drainStream = async (stream: ReadableStream<string>): Promise<string> => {
  const reader = stream.getReader();
  const answerParts: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return answerParts.join("");
    answerParts.push(value);
  }
};

describe("lifecycle", () => {
  test("a stream the backend errors is an AiError, and the session is free after it", async () => {
    let calls = 0;
    const session = await openSessionWith(
      makeModel(() => {
        calls += 1;
        const stream = calls === 1 ? failingStream() : makeStream("fine");
        return Promise.resolve(ok(stream));
      }),
    );

    const streamResult = await session.promptStream("hello");
    if (!streamResult.ok) throw new Error("expected a stream");
    const caughtError = await drainStream(streamResult.value).catch(
      (error: unknown) => error,
    );
    expect(caughtError).toBeInstanceOf(AiError);
    if (caughtError instanceof AiError)
      expect(caughtError.failure.kind).toBe("aborted");

    const answerResult = await session.prompt("again");
    expect(answerResult).toEqual(ok("fine"));
    session.close();
  });

  test("a backend that throws is answered in the vocabulary", async () => {
    const session = await openSessionWith(
      makeModel(() => {
        throw new DOMException("boom", "OperationError");
      }),
    );
    const answerResult = await session.prompt("hello");
    expect(answerResult.ok).toBe(false);
    if (!answerResult.ok) expect(answerResult.error.kind).toBe("failed");
    session.close();
  });

  test("the record reaches the backend without this turn's input", async () => {
    const seenHistories: (readonly AiMessage[])[] = [];
    const session = await openSessionWith(
      makeModel((input, request) => {
        seenHistories.push(request.history);
        return Promise.resolve(ok(makeStream(`re: ${input}`)));
      }),
      { history: [{ role: "user", content: "earlier" }] },
    );

    await session.prompt("first");
    await session.prompt("second");
    expect(seenHistories[0]).toEqual([{ role: "user", content: "earlier" }]);
    expect(seenHistories[1]).toEqual([
      { role: "user", content: "earlier" },
      { role: "user", content: "first" },
      { role: "assistant", content: "re: first" },
    ]);
    session.close();
  });

  test("the whole-answer call is preferred by prompt and skipped by promptStream", async () => {
    let streamed = 0;
    const model: ModelConnection = {
      ...makeModel(() => {
        streamed += 1;
        return Promise.resolve(ok(makeStream("a", "b")));
      }),
      generateWhole: () => Promise.resolve(ok("whole")),
    };
    const session = await openSessionWith(model);

    expect(await session.prompt("hello")).toEqual(ok("whole"));
    expect(streamed).toBe(0);
    const streamResult = await session.promptStream("hello");
    if (!streamResult.ok) throw new Error("expected a stream");
    expect(await drainStream(streamResult.value)).toBe("ab");
    expect(streamed).toBe(1);
    session.close();
  });
});

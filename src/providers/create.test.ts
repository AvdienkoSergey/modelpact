/**
 * The paths the mock never takes: a backend that throws, and one with a
 * whole-answer call. Everything else about the lifecycle is the contract suite
 * in `./mock.test.ts`.
 */

import { describe, expect, test } from "vitest";

import { ok } from "../types/foundations.js";
import { AiError } from "../types/failures.js";
import type { AiSession } from "../types/session.js";
import type { Model } from "../types/backend.js";
import { createProvider } from "./create.js";

const streamOf = (...parts: string[]): ReadableStream<string> =>
  new ReadableStream<string>({
    start: (controller) => {
      for (const part of parts) controller.enqueue(part);
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

const modelOf = (generate: Model["generate"]): Model => ({
  generate,
  usage: () => ({ kind: "unknown" }),
  dispose: () => undefined,
});

const openWith = async (model: Model): Promise<AiSession> => {
  const provider = createProvider({
    name: "mock",
    modalities: ["text"],
    availability: () => ({ kind: "ready" }),
    connect: () => Promise.resolve(ok(model)),
  });
  const access = await provider.access();
  if (access.kind !== "ready") throw new Error("expected ready");
  const opened = await access.open();
  if (!opened.ok) throw new Error("expected a session");
  return opened.value;
};

const drain = async (stream: ReadableStream<string>): Promise<string> => {
  const reader = stream.getReader();
  const parts: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return parts.join("");
    parts.push(value);
  }
};

describe("lifecycle", () => {
  test("a stream the backend errors is an AiError, and the session is free after it", async () => {
    let calls = 0;
    const session = await openWith(
      modelOf(() => {
        calls += 1;
        const stream = calls === 1 ? failingStream() : streamOf("fine");
        return Promise.resolve(ok(stream));
      }),
    );

    const first = await session.promptStream("hello");
    if (!first.ok) throw new Error("expected a stream");
    const caught = await drain(first.value).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(AiError);
    if (caught instanceof AiError) expect(caught.failure.kind).toBe("aborted");

    const second = await session.prompt("again");
    expect(second).toEqual(ok("fine"));
    session.close();
  });

  test("a backend that throws is answered in the vocabulary", async () => {
    const session = await openWith(
      modelOf(() => {
        throw new DOMException("boom", "OperationError");
      }),
    );
    const answer = await session.prompt("hello");
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.kind).toBe("failed");
    session.close();
  });

  test("the whole-answer call is preferred by prompt and skipped by promptStream", async () => {
    let streamed = 0;
    const model: Model = {
      ...modelOf(() => {
        streamed += 1;
        return Promise.resolve(ok(streamOf("a", "b")));
      }),
      generateWhole: () => Promise.resolve(ok("whole")),
    };
    const session = await openWith(model);

    expect(await session.prompt("hello")).toEqual(ok("whole"));
    expect(streamed).toBe(0);
    const started = await session.promptStream("hello");
    if (!started.ok) throw new Error("expected a stream");
    expect(await drain(started.value)).toBe("ab");
    expect(streamed).toBe(1);
    session.close();
  });
});

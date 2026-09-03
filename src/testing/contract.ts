/**
 * One set of assertions, run against every `AiProvider`.
 *
 * Written once and called for each backend, which sets a hard rule for what
 * may be asserted here: only what `../types` promises. Anything about how a
 * provider works inside — how many requests it made, what the prompt string
 * looked like, which internal method ran first — differs between backends and
 * would quietly turn this into a test of one of them.
 *
 * Published as `modelpact/testing`, so a backend written outside this package
 * is held to the same standard as the ones inside it. `vitest` is a peer
 * dependency: the file is `describe`/`test` calls, and two copies of the runner
 * would register them in the wrong one.
 *
 * The filename carries no `.test` — the runner's glob is `src/**\/*.test.ts`
 * and misses this file, which is a function others call rather than a suite of
 * its own.
 */

import { describe, expect, test, type TestContext } from "vitest";

import { jsonSchema, type JsonSchema } from "../types/foundations.js";
import { AiError } from "../types/failures.js";
import type { AiMessage } from "../types/messages.js";
import type { AiProvider } from "../types/provider.js";
import type {
  AiSession,
  ModelAccess,
  SessionOptions,
} from "../types/session.js";

/**
 * `unavailable`, `needs-download` and a narrow window cannot be staged by every
 * backend, so the factory returns null for a scenario it cannot produce and
 * those tests skip. Skipping shows in the run output; silently passing would
 * not.
 */
export type ContractScenario =
  | "ready"
  | "unavailable"
  | "needs-download"
  /**
   * A window so narrow that one ordinary turn spends more than it holds. Its
   * own scenario because overflowing a real window means minutes of
   * generation, and a backend that cannot be told how wide to load returns
   * null for it.
   */
  | "tiny-window";

export type ProviderFactory = (
  scenario: ContractScenario,
) => AiProvider | null | Promise<AiProvider | null>;

/**
 * A question whose answer is several words in any implementation. The suite
 * asserts the answer arrives in more than one delta, which needs an answer long
 * enough that no reasonable backend sends it whole.
 */
const LONG_QUESTION = "List the numbers from one to ten, separated by commas.";

// A literal written on the next line: null here would be a typo in this file,
// not a case a provider can reach.
const asSchema = (value: Record<string, unknown>): JsonSchema => {
  const schema = jsonSchema(value);
  if (schema === null) throw new Error("not a schema");
  return schema;
};

/**
 * The constraint the suite sends, and the shape a provider that honours one is
 * measured against.
 *
 * Exported because a backend able to honour a schema has to be handed an answer
 * that fits this exact one — a mock configures its reply against it. Kept to
 * four keywords because the suite validates the answer itself: a general JSON
 * Schema validator would be a dependency, and a second thing that can be wrong.
 */
export const CONTRACT_SCHEMA = asSchema({
  type: "object",
  properties: { city: { type: "string" } },
  required: ["city"],
  additionalProperties: false,
});

/** Reader loop, not `for await`: async iteration of a stream is missing in Safari, and `lib` excludes it on purpose. */
async function drainStream(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

/** The `ready` branch or a failed test: every group below this line needs a session. */
async function mustOpenSession(
  access: ModelAccess,
  options?: SessionOptions,
): Promise<AiSession> {
  if (access.kind !== "ready")
    throw new Error(`expected ready, got ${access.kind}`);
  const sessionResult = await access.open(options);
  if (!sessionResult.ok)
    throw new Error(`open refused: ${sessionResult.error.kind}`);
  return sessionResult.value;
}

/** A signal that fires after the call has started, which is what "in flight" means here. */
const soonAbortedSignal = (): AbortSignal => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 0);
  return controller.signal;
};

export function describeContract(
  name: string,
  makeProvider: ProviderFactory,
): void {
  /**
   * A session for the scenario, or null once the test has been marked skipped.
   *
   * Null rather than a throw or a narrowing `skip`: the caller returns on it,
   * which the compiler follows without a non-null assertion.
   */
  const stageSession = async (
    ctx: TestContext,
    scenario: ContractScenario,
  ): Promise<AiSession | null> => {
    const provider = await makeProvider(scenario);
    if (provider === null) {
      ctx.skip(`${scenario} cannot be staged`);
      return null;
    }
    return mustOpenSession(await provider.access());
  };

  describe(`AiProvider contract: ${name}`, () => {
    describe("access", () => {
      test("resolves instead of throwing", async (ctx) => {
        const provider = await makeProvider("ready");
        if (provider === null) return ctx.skip();
        const access = await provider.access();
        expect(["ready", "needs-download", "unavailable"]).toContain(
          access.kind,
        );
      });

      test("unavailable carries a reason and no way to open", async (ctx) => {
        const provider = await makeProvider("unavailable");
        if (provider === null) return ctx.skip();
        const access = await provider.access();
        expect(access.kind).toBe("unavailable");
        if (access.kind !== "unavailable") return;
        expect(typeof access.reason.kind).toBe("string");
        // The whole point of the union: there is nothing to call by mistake.
        expect("open" in access).toBe(false);
      });

      test("the request is part of the question", async (ctx) => {
        const provider = await makeProvider("ready");
        if (provider === null) return ctx.skip();
        // A modality no text backend serves. Answering `ready` is allowed —
        // the contract does not promise a refusal — but an answer there must
        // be, and a refusal must name the vocabulary rather than throw.
        const access = await provider.access({ outputs: [{ type: "audio" }] });
        expect(["ready", "needs-download", "unavailable"]).toContain(
          access.kind,
        );
        if (access.kind === "unavailable") {
          expect(typeof access.reason.kind).toBe("string");
        }
      });

      test("needs-download reports progress, then opens", async (ctx) => {
        const provider = await makeProvider("needs-download");
        if (provider === null) return ctx.skip();
        const access = await provider.access();
        expect(access.kind).toBe("needs-download");
        if (access.kind !== "needs-download") return;

        const seenProgress: number[] = [];
        const sessionResult = await access.open((monitor) => {
          monitor.ondownloadprogress = (event) =>
            seenProgress.push(event.loaded / event.total);
        });

        expect(seenProgress.length).toBeGreaterThan(0);
        // Never decreasing, and finished: a bar that goes backwards or stops
        // short is worse than no bar.
        let previousProgress = 0;
        for (const progress of seenProgress) {
          expect(progress).toBeGreaterThanOrEqual(previousProgress);
          previousProgress = progress;
        }
        expect(seenProgress.at(-1)).toBe(1);
        expect(sessionResult.ok).toBe(true);
        if (sessionResult.ok) sessionResult.value.close();
      });
    });

    describe("prompt", () => {
      test("answers with text", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const answerResult = await session.prompt(
          "Name the capital of France.",
        );
        expect(answerResult.ok).toBe(true);
        if (answerResult.ok)
          expect(answerResult.value.length).toBeGreaterThan(0);
        session.close();
      });

      test("usage grows from one turn to the next", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const usageBefore = session.usage();
        // A backend that reports no budget has nothing to compare.
        if (usageBefore.kind === "unknown") {
          session.close();
          ctx.skip("usage is unknown for this backend");
        }
        await session.prompt("Name the capital of France.");
        const usageAfter = session.usage();
        if (usageAfter.kind !== "unknown" && usageBefore.kind !== "unknown") {
          expect(usageAfter.used).toBeGreaterThan(usageBefore.used);
        }
        session.close();
      });
    });

    describe("promptStream", () => {
      test("delivers the answer in more than one delta", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        expect(streamResult.ok).toBe(true);
        if (streamResult.ok)
          expect(
            (await drainStream(streamResult.value)).length,
          ).toBeGreaterThan(1);
        session.close();
      });

      test("stays a stream: tee gives two readable branches", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        const [leftBranch, rightBranch] = streamResult.value.tee();
        const [leftChunks, rightChunks] = await Promise.all([
          drainStream(leftBranch),
          drainStream(rightBranch),
        ]);
        expect(leftChunks.join("")).toBe(rightChunks.join(""));
        session.close();
      });
    });

    describe("schema", () => {
      test("a schema is honoured or refused, never ignored", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const answerResult = await session.prompt(
          "Name the capital of France.",
          {
            schema: CONTRACT_SCHEMA,
          },
        );

        if (!answerResult.ok) {
          // A refusal is the other half of the promise: a provider that cannot
          // constrain decoding says so instead of answering prose.
          expect(typeof answerResult.error.kind).toBe("string");
          session.close();
          return;
        }
        const parsedAnswer: unknown = JSON.parse(answerResult.value);
        expect(typeof parsedAnswer).toBe("object");
        expect(parsedAnswer).not.toBeNull();
        expect(typeof (parsedAnswer as { city?: unknown }).city).toBe("string");
        session.close();
      });
    });

    describe("one at a time", () => {
      test("a second generation is refused while the first runs", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const firstTurn = session.prompt(LONG_QUESTION);
        const secondResult = await session.prompt("and again");
        expect(secondResult.ok).toBe(false);
        if (!secondResult.ok) expect(secondResult.error.kind).toBe("busy");
        await firstTurn;
        session.close();
      });

      test("a stream in flight holds the session too", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        const duringResult = await session.prompt("and again");
        expect(duringResult.ok).toBe(false);
        if (!duringResult.ok) expect(duringResult.error.kind).toBe("busy");
        await drainStream(streamResult.value);
        session.close();
      });

      test("a finished stream frees the session", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        await drainStream(streamResult.value);
        // The turn is over, so the next one is allowed: `busy` is about a
        // generation in flight, not about the session having been used.
        const nextResult = await session.prompt("Name the capital of France.");
        expect(nextResult.ok).toBe(true);
        session.close();
      });
    });

    describe("abort", () => {
      test("an already-aborted signal fails the call, not the process", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const answerResult = await session.prompt("hello", {
          signal: AbortSignal.abort(),
        });
        expect(answerResult.ok).toBe(false);
        if (!answerResult.ok) expect(answerResult.error.kind).toBe("aborted");
        session.close();
      });

      test("aborting a prompt in flight fails it", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const answerResult = await session.prompt(LONG_QUESTION, {
          signal: soonAbortedSignal(),
        });
        expect(answerResult.ok).toBe(false);
        if (!answerResult.ok) expect(answerResult.error.kind).toBe("aborted");
        session.close();
      });

      test("aborting a stream in flight errors it", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION, {
          signal: soonAbortedSignal(),
        });
        // Either the start is refused, or the stream errors partway: both are
        // the same refusal, and which one arrives depends on timing the
        // contract does not fix.
        if (streamResult.ok)
          await expect(drainStream(streamResult.value)).rejects.toThrow();
        else expect(streamResult.error.kind).toBe("aborted");
        session.close();
      });

      test("an aborted generation does not end the session", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        await session.prompt(LONG_QUESTION, { signal: soonAbortedSignal() });
        const nextResult = await session.prompt("Name the capital of France.");
        expect(nextResult.ok).toBe(true);
        session.close();
      });

      test("cancelling the reader does not end the session either", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        const reader = streamResult.value.getReader();
        await reader.read();
        await reader.cancel();
        const nextResult = await session.prompt("Name the capital of France.");
        expect(nextResult.ok).toBe(true);
        session.close();
      });
    });

    describe("contextoverflow", () => {
      test("fires when a turn spends more than the window holds", async (ctx) => {
        const session = await stageSession(ctx, "tiny-window");
        if (session === null) return;
        let fired = 0;
        session.oncontextoverflow = () => (fired += 1);
        await session.prompt(LONG_QUESTION);
        await session.prompt(LONG_QUESTION);
        expect(fired).toBeGreaterThan(0);
        // Once: the window does not un-overflow, and every turn after the
        // first is over the same line.
        expect(fired).toBe(1);
        session.close();
      });

      test("stays quiet while the transcript fits", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        let fired = 0;
        session.oncontextoverflow = () => (fired += 1);
        await session.prompt("hi");
        expect(fired).toBe(0);
        session.close();
      });

      test("the handler unsubscribes when set back to null", async (ctx) => {
        const session = await stageSession(ctx, "tiny-window");
        if (session === null) return;
        let fired = 0;
        session.oncontextoverflow = () => (fired += 1);
        session.oncontextoverflow = null;
        await session.prompt(LONG_QUESTION);
        await session.prompt(LONG_QUESTION);
        expect(fired).toBe(0);
        session.close();
      });
    });

    describe("history", () => {
      const HANDED_HISTORY: readonly AiMessage[] = [
        { role: "user", content: "Name the capital of France." },
        { role: "assistant", content: "Paris." },
      ];

      test("starts as what was handed at open", async (ctx) => {
        const provider = await makeProvider("ready");
        if (provider === null) return ctx.skip();
        const session = await mustOpenSession(await provider.access(), {
          history: HANDED_HISTORY,
        });
        expect(session.history()).toEqual(HANDED_HISTORY);
        session.close();
      });

      test("a completed prompt adds the question and the answer", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const answerResult = await session.prompt(
          "Name the capital of France.",
        );
        if (!answerResult.ok) throw new AiError(answerResult.error);
        expect(session.history()).toEqual([
          { role: "user", content: "Name the capital of France." },
          { role: "assistant", content: answerResult.value },
        ]);
        session.close();
      });

      test("a drained stream adds the answer as one message", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        const deltas = await drainStream(streamResult.value);
        expect(session.history().at(-1)).toEqual({
          role: "assistant",
          content: deltas.join(""),
        });
        session.close();
      });

      test("only turns that returned ok are in it", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const answerResult = await session.prompt(LONG_QUESTION, {
          signal: soonAbortedSignal(),
        });
        // The record and the Result agree by construction: a turn that was
        // refused or interrupted is in neither.
        expect(session.history()).toHaveLength(answerResult.ok ? 2 : 0);
        session.close();
      });

      test("a cancelled stream adds nothing", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        const reader = streamResult.value.getReader();
        await reader.read();
        await reader.cancel();
        expect(session.history()).toEqual([]);
        session.close();
      });

      test("what was read does not change under later turns", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const historyBefore = session.history();
        await session.prompt("Name the capital of France.");
        expect(historyBefore).toEqual([]);
        session.close();
      });

      test("handed back to open, it continues the same conversation", async (ctx) => {
        const provider = await makeProvider("ready");
        if (provider === null) return ctx.skip();
        const firstSession = await mustOpenSession(await provider.access());
        await firstSession.prompt("Name the capital of France.");
        const savedHistory = firstSession.history();
        firstSession.close();
        // A reload: the session is gone, the record is not.
        const reopenedSession = await mustOpenSession(await provider.access(), {
          history: savedHistory,
        });
        expect(reopenedSession.history()).toEqual(savedHistory);
        reopenedSession.close();
      });
    });

    describe("close", () => {
      test("later calls fail with aborted", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        session.close();
        const answerResult = await session.prompt("hello");
        expect(answerResult.ok).toBe(false);
        if (!answerResult.ok) expect(answerResult.error.kind).toBe("aborted");
      });

      test("a call in flight fails too", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const flightTurn = session.prompt(LONG_QUESTION);
        session.close();
        const answerResult = await flightTurn;
        expect(answerResult.ok).toBe(false);
        if (!answerResult.ok) expect(answerResult.error.kind).toBe("aborted");
      });

      test("a stream in flight errors", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        const streamResult = await session.promptStream(LONG_QUESTION);
        if (!streamResult.ok) throw new AiError(streamResult.error);
        session.close();
        await expect(drainStream(streamResult.value)).rejects.toThrow();
      });

      test("closing twice is a no-op", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        session.close();
        expect(() => session.close()).not.toThrow();
      });

      test("usage still answers", async (ctx) => {
        const session = await stageSession(ctx, "ready");
        if (session === null) return;
        session.close();
        // Reading the meter is not generating: a closed session still knows
        // what it spent, which is what a caller shows after an abort.
        expect(typeof session.usage().kind).toBe("string");
      });
    });
  });
}

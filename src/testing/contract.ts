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
import type { AiProvider } from "../types/provider.js";
import type { AiSession, ModelAccess } from "../types/session.js";

/**
 * `unavailable`, `needs-download` and a narrow window cannot be staged by every
 * backend, so the factory returns null for a scenario it cannot produce and
 * those tests skip. Skipping shows in the run output; silently passing would
 * not.
 */
export type Scenario =
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
  scenario: Scenario,
) => AiProvider | null | Promise<AiProvider | null>;

/**
 * A question whose answer is several words in any implementation. The suite
 * asserts the answer arrives in more than one delta, which needs an answer long
 * enough that no reasonable backend sends it whole.
 */
const LONG = "List the numbers from one to ten, separated by commas.";

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
async function drain(stream: ReadableStream<string>): Promise<string[]> {
  const reader = stream.getReader();
  const chunks: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    if (value !== undefined) chunks.push(value);
  }
}

/** The `ready` branch or a failed test: every group below this line needs a session. */
async function sessionFrom(access: ModelAccess): Promise<AiSession> {
  if (access.kind !== "ready") throw new Error(`expected ready, got ${access.kind}`);
  const opened = await access.open();
  if (!opened.ok) throw new Error(`open refused: ${opened.error.kind}`);
  return opened.value;
}

/** A signal that fires after the call has started, which is what "in flight" means here. */
const soon = (): AbortSignal => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 0);
  return controller.signal;
};

export function describeContract(name: string, make: ProviderFactory): void {
  /** Opens a session for `ready`, or skips the test when the backend cannot stage the scenario. */
  const staged = async (ctx: TestContext, scenario: Scenario): Promise<AiSession> => {
    const provider = await make(scenario);
    if (provider === null) ctx.skip(`${scenario} cannot be staged`);
    return sessionFrom(await provider!.access());
  };

  describe(`AiProvider contract: ${name}`, () => {
    describe("access", () => {
      test("resolves instead of throwing", async (ctx) => {
        const provider = await make("ready");
        if (provider === null) ctx.skip();
        const access = await provider!.access();
        expect(["ready", "needs-download", "unavailable"]).toContain(access.kind);
      });

      test("unavailable carries a reason and no way to open", async (ctx) => {
        const provider = await make("unavailable");
        if (provider === null) ctx.skip();
        const access = await provider!.access();
        expect(access.kind).toBe("unavailable");
        if (access.kind !== "unavailable") return;
        expect(typeof access.reason.kind).toBe("string");
        // The whole point of the union: there is nothing to call by mistake.
        expect("open" in access).toBe(false);
      });

      test("the request is part of the question", async (ctx) => {
        const provider = await make("ready");
        if (provider === null) ctx.skip();
        // A modality no text backend serves. Answering `ready` is allowed —
        // the contract does not promise a refusal — but an answer there must
        // be, and a refusal must name the vocabulary rather than throw.
        const access = await provider!.access({ outputs: [{ type: "audio" }] });
        expect(["ready", "needs-download", "unavailable"]).toContain(access.kind);
        if (access.kind === "unavailable") {
          expect(typeof access.reason.kind).toBe("string");
        }
      });

      test("needs-download reports progress, then opens", async (ctx) => {
        const provider = await make("needs-download");
        if (provider === null) ctx.skip();
        const access = await provider!.access();
        expect(access.kind).toBe("needs-download");
        if (access.kind !== "needs-download") return;

        const seen: number[] = [];
        const opened = await access.open((monitor) => {
          monitor.ondownloadprogress = (event) => seen.push(event.loaded / event.total);
        });

        expect(seen.length).toBeGreaterThan(0);
        // Never decreasing, and finished: a bar that goes backwards or stops
        // short is worse than no bar.
        for (let i = 1; i < seen.length; i += 1) {
          expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!);
        }
        expect(seen.at(-1)).toBe(1);
        expect(opened.ok).toBe(true);
        if (opened.ok) opened.value.close();
      });
    });

    describe("prompt", () => {
      test("answers with text", async (ctx) => {
        const session = await staged(ctx, "ready");
        const answer = await session.prompt("Name the capital of France.");
        expect(answer.ok).toBe(true);
        if (answer.ok) expect(answer.value.length).toBeGreaterThan(0);
        session.close();
      });

      test("usage grows from one turn to the next", async (ctx) => {
        const session = await staged(ctx, "ready");
        const before = session.usage();
        // A backend that reports no budget has nothing to compare.
        if (before.kind === "unknown") {
          session.close();
          ctx.skip("usage is unknown for this backend");
        }
        await session.prompt("Name the capital of France.");
        const after = session.usage();
        if (after.kind !== "unknown" && before.kind !== "unknown") {
          expect(after.used).toBeGreaterThan(before.used);
        }
        session.close();
      });
    });

    describe("promptStream", () => {
      test("delivers the answer in more than one delta", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG);
        expect(started.ok).toBe(true);
        if (started.ok) expect((await drain(started.value)).length).toBeGreaterThan(1);
        session.close();
      });

      test("stays a stream: tee gives two readable branches", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG);
        if (!started.ok) throw new AiError(started.error);
        const [left, right] = started.value.tee();
        const [a, b] = await Promise.all([drain(left), drain(right)]);
        expect(a.join("")).toBe(b.join(""));
        session.close();
      });
    });

    describe("schema", () => {
      test("a schema is honoured or refused, never ignored", async (ctx) => {
        const session = await staged(ctx, "ready");
        const answer = await session.prompt("Name the capital of France.", {
          schema: CONTRACT_SCHEMA,
        });

        if (!answer.ok) {
          // A refusal is the other half of the promise: a provider that cannot
          // constrain decoding says so instead of answering prose.
          expect(typeof answer.error.kind).toBe("string");
          session.close();
          return;
        }
        const parsed: unknown = JSON.parse(answer.value);
        expect(typeof parsed).toBe("object");
        expect(parsed).not.toBeNull();
        expect(typeof (parsed as { city?: unknown }).city).toBe("string");
        session.close();
      });
    });

    describe("one at a time", () => {
      test("a second generation is refused while the first runs", async (ctx) => {
        const session = await staged(ctx, "ready");
        const first = session.prompt(LONG);
        const second = await session.prompt("and again");
        expect(second.ok).toBe(false);
        if (!second.ok) expect(second.error.kind).toBe("busy");
        await first;
        session.close();
      });

      test("a stream in flight holds the session too", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG);
        if (!started.ok) throw new AiError(started.error);
        const during = await session.prompt("and again");
        expect(during.ok).toBe(false);
        if (!during.ok) expect(during.error.kind).toBe("busy");
        await drain(started.value);
        session.close();
      });

      test("a finished stream frees the session", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG);
        if (!started.ok) throw new AiError(started.error);
        await drain(started.value);
        // The turn is over, so the next one is allowed: `busy` is about a
        // generation in flight, not about the session having been used.
        const next = await session.prompt("Name the capital of France.");
        expect(next.ok).toBe(true);
        session.close();
      });
    });

    describe("abort", () => {
      test("an already-aborted signal fails the call, not the process", async (ctx) => {
        const session = await staged(ctx, "ready");
        const answer = await session.prompt("hello", { signal: AbortSignal.abort() });
        expect(answer.ok).toBe(false);
        if (!answer.ok) expect(answer.error.kind).toBe("aborted");
        session.close();
      });

      test("aborting a prompt in flight fails it", async (ctx) => {
        const session = await staged(ctx, "ready");
        const answer = await session.prompt(LONG, { signal: soon() });
        expect(answer.ok).toBe(false);
        if (!answer.ok) expect(answer.error.kind).toBe("aborted");
        session.close();
      });

      test("aborting a stream in flight errors it", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG, { signal: soon() });
        // Either the start is refused, or the stream errors partway: both are
        // the same refusal, and which one arrives depends on timing the
        // contract does not fix.
        if (started.ok) await expect(drain(started.value)).rejects.toThrow();
        else expect(started.error.kind).toBe("aborted");
        session.close();
      });

      test("an aborted generation does not end the session", async (ctx) => {
        const session = await staged(ctx, "ready");
        await session.prompt(LONG, { signal: soon() });
        const next = await session.prompt("Name the capital of France.");
        expect(next.ok).toBe(true);
        session.close();
      });

      test("cancelling the reader does not end the session either", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG);
        if (!started.ok) throw new AiError(started.error);
        const reader = started.value.getReader();
        await reader.read();
        await reader.cancel();
        const next = await session.prompt("Name the capital of France.");
        expect(next.ok).toBe(true);
        session.close();
      });
    });

    describe("contextoverflow", () => {
      test("fires when a turn spends more than the window holds", async (ctx) => {
        const session = await staged(ctx, "tiny-window");
        let fired = 0;
        session.oncontextoverflow = () => (fired += 1);
        await session.prompt(LONG);
        await session.prompt(LONG);
        expect(fired).toBeGreaterThan(0);
        // Once: the window does not un-overflow, and every turn after the
        // first is over the same line.
        expect(fired).toBe(1);
        session.close();
      });

      test("stays quiet while the transcript fits", async (ctx) => {
        const session = await staged(ctx, "ready");
        let fired = 0;
        session.oncontextoverflow = () => (fired += 1);
        await session.prompt("hi");
        expect(fired).toBe(0);
        session.close();
      });

      test("the handler unsubscribes when set back to null", async (ctx) => {
        const session = await staged(ctx, "tiny-window");
        let fired = 0;
        session.oncontextoverflow = () => (fired += 1);
        session.oncontextoverflow = null;
        await session.prompt(LONG);
        await session.prompt(LONG);
        expect(fired).toBe(0);
        session.close();
      });
    });

    describe("close", () => {
      test("later calls fail with aborted", async (ctx) => {
        const session = await staged(ctx, "ready");
        session.close();
        const answer = await session.prompt("hello");
        expect(answer.ok).toBe(false);
        if (!answer.ok) expect(answer.error.kind).toBe("aborted");
      });

      test("a call in flight fails too", async (ctx) => {
        const session = await staged(ctx, "ready");
        const flight = session.prompt(LONG);
        session.close();
        const answer = await flight;
        expect(answer.ok).toBe(false);
        if (!answer.ok) expect(answer.error.kind).toBe("aborted");
      });

      test("a stream in flight errors", async (ctx) => {
        const session = await staged(ctx, "ready");
        const started = await session.promptStream(LONG);
        if (!started.ok) throw new AiError(started.error);
        session.close();
        await expect(drain(started.value)).rejects.toThrow();
      });

      test("closing twice is a no-op", async (ctx) => {
        const session = await staged(ctx, "ready");
        session.close();
        expect(() => session.close()).not.toThrow();
      });

      test("usage still answers", async (ctx) => {
        const session = await staged(ctx, "ready");
        session.close();
        // Reading the meter is not generating: a closed session still knows
        // what it spent, which is what a caller shows after an abort.
        expect(typeof session.usage().kind).toBe("string");
      });
    });
  });
}

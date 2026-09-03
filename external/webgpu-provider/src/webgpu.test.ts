/**
 * The contract suite, imported from `modelpact/testing` and pointed at a
 * backend written outside the package.
 *
 * The engine is stood in for. A real one downloads several hundred megabytes
 * into browser storage and then wants a GPU, neither of which a node run has,
 * so what is under test here is the adapter and the shape of the public API
 * that let it be written at all.
 *
 * If this file compiles and passes, a third party can write a backend with
 * nothing but the published entry points. That is the whole experiment.
 */

import { describe, expect, test } from "vitest";
import { describeContract } from "modelpact/testing";

import {
  makeWebGpuProvider,
  type EngineChunk,
  type EngineRequest,
  type WebGpuEngine,
} from "./webgpu.js";

const MODEL = "Stub-0.5B-MLC";

interface StubOptions {
  readonly reply?: string;
  readonly usedTokens?: number;
  readonly failWith?: () => never;
  readonly steps?: readonly number[];
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Deltas the way the engine sends them: word by word, usage on the last one. */
async function* chunksOf(
  text: string,
  used: number,
): AsyncGenerator<EngineChunk> {
  const words = text.match(/\S+\s*/g) ?? [text];
  for (const word of words) {
    await sleep(1);
    yield { choices: [{ delta: { content: word } }] };
  }
  yield { choices: [{ delta: {} }], usage: { total_tokens: used } };
}

/** Typed as what the backend needs and not cast: the stub is held to the same shape the real engine is. */
const stubEngine = (options: StubOptions): WebGpuEngine => ({
  chat: {
    completions: {
      create: (given: EngineRequest) => {
        options.failWith?.();
        const asked = given.messages.at(-1)?.content ?? "";
        // Prose unless a schema was asked for, as a real engine does: a
        // constrained answer is one word and would fail "more than one delta"
        // for a reason that says nothing about the backend.
        const said =
          given.response_format === undefined
            ? `Answering «${asked}» at some length, in several words.`
            : (options.reply ?? "{}");
        const used = options.usedTokens ?? said.split(/\s+/).length;
        return Promise.resolve(chunksOf(said, used));
      },
    },
  },
  unload: () => Promise.resolve(),
  interruptGenerate: () => undefined,
});

const stubbed = (options: StubOptions = {}, contextWindow?: number) =>
  makeWebGpuProvider({
    model: MODEL,
    ...(contextWindow === undefined ? {} : { contextWindow }),
    engine: async (report) => {
      for (const step of options.steps ?? []) {
        await sleep(0);
        report(step);
      }
      return stubEngine(options);
    },
  });

describeContract("webgpu, written from outside the package", (scenario) => {
  switch (scenario) {
    case "ready":
      return stubbed({ reply: JSON.stringify({ city: "Paris" }) });
    case "unavailable":
      // `navigator.gpu` is what decides it, and node has no navigator at all,
      // so this is the one scenario that needs no stub.
      return makeWebGpuProvider({ model: MODEL });
    case "needs-download":
      // The engine hook answers `ready`, so the branch cannot be staged from
      // out here without a browser cache to empty.
      return null;
    case "tiny-window":
      return stubbed({ reply: JSON.stringify({ city: "Paris" }) }, 1);
  }
});

describe("webgpu from outside", () => {
  test("no WebGPU is a refusal that names the vocabulary", async () => {
    const access = await makeWebGpuProvider({ model: MODEL }).access();
    expect(access.kind).toBe("unavailable");
    if (access.kind !== "unavailable") return;
    expect(access.reason.kind).toBe("unsupported-config");
  });

  test("the engine's own throw comes back as a Result", async () => {
    const provider = stubbed({
      failWith: () => {
        throw new Error("no adapter");
      },
    });
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");

    const answer = await opened.value.prompt("hello");
    expect(answer.ok).toBe(false);
    // `failureFrom` is exported, so a backend outside the package maps its
    // exceptions with the same table the ones inside it use.
    if (!answer.ok) expect(typeof answer.error.kind).toBe("string");
    opened.value.close();
  });

  test("usage comes from the engine's own count", async () => {
    const provider = stubbed({ reply: "two words", usedTokens: 40 }, 100);
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");

    await opened.value.prompt("hello");
    const usage = opened.value.usage();
    expect(usage.kind).toBe("bounded");
    if (usage.kind === "bounded") {
      expect(usage.used).toBe(40);
      expect(usage.remaining).toBe(60);
    }
    opened.value.close();
  });
});

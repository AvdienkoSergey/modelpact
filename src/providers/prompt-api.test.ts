/**
 * The adapter, against a `LanguageModel` written here.
 *
 * The real one is a browser and a downloaded model, so a node run cannot reach
 * it: `e2e/demo-e2e.spec.ts` drives the real one and skips where it is absent,
 * and what stays here is every branch of the mapping, made to happen on demand.
 * The fake is not a convenience — it is the list of what this backend needs
 * from the platform, and nothing else in `../types` is allowed to grow past it.
 *
 * `access` against the missing global is the one case that is not a fake: in
 * node there is no `LanguageModel`, and that is the answer under test.
 */

import { describe, expect, test } from "vitest";

import { CONTRACT_SCHEMA, describeContract } from "../testing/contract.js";
import { makePromptApiProvider } from "./prompt-api.js";

interface FakeOptions {
  readonly availability?: Awaited<
    ReturnType<typeof LanguageModel.availability>
  >;
  /** Thrown from `availability`, from `create`, or from a turn. */
  readonly failCreate?: () => never;
  readonly failPrompt?: () => never;
  readonly downloadSteps?: readonly number[];
  readonly contextWindow?: number;
  /** Absent, the fake answers by echoing; present, it answers this. */
  readonly schemaReply?: string;
  readonly delayMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Long enough that a second call lands while the first is still running. */
const reply = (input: string): string[] => {
  const sentence = `Answering «${input.slice(0, 40)}» at some length. `;
  return sentence.match(/\S+\s*/g) ?? ["Answer."];
};

const countWords = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

/**
 * A stand-in for the platform's class: the same statics, the same session
 * shape, the same exceptions by `name`, which is all `failureFrom` reads.
 */
function fakeLanguageModel(options: FakeOptions = {}): typeof LanguageModel {
  const window = options.contextWindow ?? 4096;
  const delayMs = options.delayMs ?? 1;

  class FakeSession extends EventTarget {
    contextUsage = 0;
    readonly contextWindow = window;
    oncontextoverflow: ((event: Event) => void) | null = null;
    #destroyed = false;
    #fired = false;

    constructor(initial: readonly { content: string }[]) {
      super();
      for (const message of initial)
        this.contextUsage += countWords(message.content);
    }

    async prompt(
      input: string,
      given?: { signal?: AbortSignal; responseConstraint?: unknown },
    ): Promise<string> {
      const stream = this.promptStreaming(input, given);
      const reader = stream.getReader();
      const parts: string[] = [];
      for (;;) {
        const next = await reader.read();
        if (next.done) return parts.join("");
        parts.push(next.value);
      }
    }

    promptStreaming(
      input: string,
      given?: { signal?: AbortSignal; responseConstraint?: unknown },
    ): ReadableStream<string> {
      if (this.#destroyed) throw abortError("the session is destroyed");
      options.failPrompt?.();
      const signal = given?.signal;
      if (signal?.aborted === true) throw abortError("aborted");
      const constrained = given?.responseConstraint !== undefined;
      if (constrained && options.schemaReply === undefined)
        throw named("NotSupportedError", "no constraint support");
      const parts = constrained ? [options.schemaReply ?? ""] : reply(input);

      let index = 0;
      return new ReadableStream<string>({
        pull: async (controller) => {
          await sleep(delayMs);
          if (signal?.aborted === true || this.#destroyed) {
            controller.error(abortError("aborted"));
            return;
          }
          const part = parts[index];
          if (part === undefined) {
            this.#charge(input, parts.join(""));
            controller.close();
            return;
          }
          index += 1;
          controller.enqueue(part);
        },
      });
    }

    destroy(): void {
      this.#destroyed = true;
    }

    #charge(input: string, answer: string): void {
      this.contextUsage += countWords(input) + countWords(answer);
      if (this.contextUsage <= this.contextWindow || this.#fired) return;
      // The browser fires its own; forwarding it is what this exercises.
      this.#fired = true;
      this.oncontextoverflow?.(new Event("contextoverflow"));
    }
  }

  return {
    availability: () => {
      options.failCreate?.();
      return Promise.resolve(options.availability ?? "available");
    },
    create: async (given?: LanguageModelCreateOptions) => {
      options.failCreate?.();
      if (given?.signal?.aborted === true) throw abortError("aborted");
      // Before any await, as the spec requires and the contract asserts.
      given?.monitor?.(reportingMonitor(options.downloadSteps ?? []));
      await sleep(0);
      const initial = given?.initialPrompts ?? [];
      const carried = [...initial].filter(
        (one) => one.role !== "system" && typeof one.content === "string",
      ) as { content: string }[];
      return new FakeSession(carried) as unknown as LanguageModel;
    },
  } as unknown as typeof LanguageModel;
}

/** The platform's monitor: an EventTarget that has already fired by the time `create` awaits. */
const reportingMonitor = (steps: readonly number[]): CreateMonitor => {
  const monitor = new EventTarget() as CreateMonitor & {
    ondownloadprogress: ((event: ProgressEvent) => void) | null;
  };
  monitor.ondownloadprogress = null;
  queueMicrotask(() => {
    for (const step of steps) {
      const event = Object.assign(new Event("downloadprogress"), {
        loaded: step,
        total: 1,
        lengthComputable: true,
      }) as unknown as ProgressEvent;
      monitor.ondownloadprogress?.(event);
    }
  });
  return monitor;
};

const named = (name: string, message: string): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const abortError = (message: string): Error => named("AbortError", message);

const SCHEMA_REPLY = JSON.stringify({ city: "Paris" });

describeContract("prompt-api on a written LanguageModel", (scenario) => {
  switch (scenario) {
    case "ready":
      return makePromptApiProvider({
        languageModel: fakeLanguageModel({ schemaReply: SCHEMA_REPLY }),
      });
    case "unavailable":
      return makePromptApiProvider({
        languageModel: fakeLanguageModel({ availability: "unavailable" }),
      });
    case "needs-download":
      return makePromptApiProvider({
        languageModel: fakeLanguageModel({
          availability: "downloadable",
          downloadSteps: [0, 0.5, 1],
        }),
      });
    case "tiny-window":
      return makePromptApiProvider({
        languageModel: fakeLanguageModel({
          contextWindow: 1,
          schemaReply: SCHEMA_REPLY,
        }),
      });
  }
});

describe("prompt-api mapping", () => {
  test("no global at all is unsupported, not a crash", async () => {
    // Node has no `LanguageModel`, and this is the one case with nothing faked.
    const access = await makePromptApiProvider().access();
    expect(access.kind).toBe("unavailable");
    if (access.kind !== "unavailable") return;
    expect(access.reason.kind).toBe("unsupported");
  });

  test("`downloading` is the same branch as `downloadable`, and says so", async () => {
    const started = makePromptApiProvider({
      languageModel: fakeLanguageModel({ availability: "downloading" }),
    });
    const access = await started.access();
    expect(access.kind).toBe("needs-download");
    if (access.kind !== "needs-download") return;
    // The only difference a caller can act on: somebody is already fetching.
    expect(access.started).toBe(true);
  });

  test("a blocked permissions policy is a reason, not an exception", async () => {
    const provider = makePromptApiProvider({
      languageModel: fakeLanguageModel({
        failCreate: () => {
          throw named("NotAllowedError", "language-model is not allowed here");
        },
      }),
    });
    const access = await provider.access();
    expect(access.kind).toBe("unavailable");
    if (access.kind !== "unavailable") return;
    expect(access.reason.kind).toBe("not-allowed");
  });

  test("an overflow the browser announces is forwarded, once", async () => {
    const provider = makePromptApiProvider({
      languageModel: fakeLanguageModel({ contextWindow: 1 }),
    });
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");

    let fired = 0;
    opened.value.oncontextoverflow = () => (fired += 1);
    await opened.value.prompt("one");
    await opened.value.prompt("two");
    expect(fired).toBe(1);
    opened.value.close();
  });

  test("a quota exception comes back carrying the reading", async () => {
    const provider = makePromptApiProvider({
      languageModel: fakeLanguageModel({
        contextWindow: 500,
        failPrompt: () => {
          throw named("QuotaExceededError", "over the window");
        },
      }),
    });
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");

    const answer = await opened.value.prompt("hello");
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.kind).toBe("context-overflow");
    // The generic mapping cannot fill this in; holding the session is what can.
    if (answer.error.kind === "context-overflow")
      expect(answer.error.usage.kind).toBe("bounded");
    opened.value.close();
  });

  test("a schema it cannot constrain is refused, never answered in prose", async () => {
    const provider = makePromptApiProvider({
      languageModel: fakeLanguageModel(),
    });
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");

    const answer = await opened.value.prompt("Name the capital of France.", {
      schema: CONTRACT_SCHEMA,
    });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.kind).toBe("unsupported-config");
    opened.value.close();
  });

  test("the system turn goes in first, and the history after it", async () => {
    let seen: LanguageModelCreateOptions | undefined;
    const api = fakeLanguageModel();
    const watched = {
      availability: api.availability.bind(api),
      create: (given?: LanguageModelCreateOptions) => {
        seen = given;
        return api.create(given);
      },
    } as unknown as typeof LanguageModel;

    const provider = makePromptApiProvider({ languageModel: watched });
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open({
      system: "Answer in one sentence.",
      history: [{ role: "user", content: "earlier" }],
    });
    if (!opened.ok) throw new Error("expected a session");

    expect(seen?.initialPrompts).toEqual([
      { role: "system", content: "Answer in one sentence." },
      { role: "user", content: "earlier" },
    ]);
    opened.value.close();
  });
});

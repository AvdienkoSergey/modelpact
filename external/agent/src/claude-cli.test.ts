/**
 * The CLI backend on a process made of strings. The lines are the ones a real
 * `claude -p --output-format stream-json --include-partial-messages` printed
 * on 2.1.138, so the parser is held to the real shape, not a convenient one.
 * `live.test.ts` is where the real binary runs, when it is there.
 */
import { describe, expect, test } from "vitest";
import { describeContract, CONTRACT_SCHEMA } from "modelpact/testing";
import type { AiProvider } from "modelpact";

import {
  makeClaudeCliProvider,
  type Spawned,
  type Spawner,
} from "./claude-cli.js";

const bytes = (text: string): ReadableStream<BufferSource> =>
  new ReadableStream<BufferSource>({
    start: (controller) => {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });

const line = (value: unknown): string => `${JSON.stringify(value)}\n`;

interface ScriptOptions {
  readonly answer?: string;
  readonly outputTokens?: number;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly isError?: boolean;
  readonly delayMs?: number;
}

/** What the CLI prints for one turn, delta by delta, at a pace a test can interrupt. */
const scriptOf = (options: ScriptOptions): ReadableStream<BufferSource> => {
  const answer = options.answer ?? "one, two, three, four, five";
  const words = answer.match(/\S+\s*/g) ?? [answer];
  const delay = options.delayMs ?? 1;
  const encoder = new TextEncoder();
  let step = 0;
  const lines = [
    line({ type: "system", subtype: "init", model: "claude-opus-4-7" }),
    line({ type: "stream_event", event: { type: "message_start" } }),
    ...words.map((text) =>
      line({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text },
        },
      }),
    ),
    line({ type: "stream_event", event: { type: "message_stop" } }),
    line({
      type: "result",
      subtype: options.isError === true ? "error" : "success",
      is_error: options.isError === true,
      result: options.isError === true ? "budget exceeded" : answer,
      usage: {
        input_tokens: 6,
        cache_read_input_tokens: 10,
        cache_creation_input_tokens: 4,
        output_tokens: options.outputTokens ?? words.length,
      },
    }),
  ];
  return new ReadableStream<BufferSource>({
    pull: async (controller) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      const next = lines[step];
      if (next === undefined) {
        controller.close();
        return;
      }
      step += 1;
      controller.enqueue(encoder.encode(next));
    },
  });
};

interface Recorded {
  readonly calls: string[][];
  readonly killed: number;
}

/** A spawner that answers from a script and remembers what it was asked to run. */
const spawnerOf = (
  options: ScriptOptions = {},
): { spawn: Spawner; seen: Recorded } => {
  const seen = { calls: [] as string[][], killed: 0 };
  const spawn: Spawner = (args) => {
    seen.calls.push([...args]);
    if (args[0] === "--version") {
      return {
        stdout: bytes("2.1.138\n"),
        stderr: bytes(""),
        exited: Promise.resolve(0),
        kill: () => undefined,
      };
    }
    let resolveExit: (code: number | null) => void = () => undefined;
    const exited = new Promise<number | null>((resolve) => {
      resolveExit = resolve;
    });
    const stdout = scriptOf(options).pipeThrough(
      new TransformStream<BufferSource, BufferSource>({
        flush: () => {
          resolveExit(options.exitCode ?? 0);
        },
      }),
    );
    const spawned: Spawned = {
      stdout,
      stderr: bytes(options.stderr ?? ""),
      exited,
      kill: () => {
        seen.killed += 1;
        resolveExit(143);
      },
    };
    return spawned;
  };
  return { spawn, seen };
};

const stubbed = (
  options: ScriptOptions = {},
  contextWindow?: number,
): AiProvider =>
  makeClaudeCliProvider({
    spawn: spawnerOf(options).spawn,
    ...(contextWindow === undefined ? {} : { contextWindow }),
  });

const missingBinary: Spawner = () => ({
  stdout: bytes(""),
  stderr: bytes(""),
  exited: Promise.reject(
    Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }),
  ),
  kill: () => undefined,
});

describeContract("claude-cli on a scripted process", (scenario) => {
  switch (scenario) {
    case "ready":
      return stubbed();
    case "unavailable":
      return makeClaudeCliProvider({ spawn: missingBinary });
    case "needs-download":
      return null;
    case "tiny-window":
      // 6 + 10 + 4 + 5 = 25 counted tokens against a window of 1.
      return stubbed({}, 1);
  }
});

const openWith = async (provider: AiProvider) => {
  const access = await provider.access();
  if (access.kind !== "ready")
    throw new Error(`expected ready, got ${access.kind}`);
  const opened = await access.open({ system: "Be brief." });
  if (!opened.ok) throw new Error(`open refused: ${opened.error.kind}`);
  return opened.value;
};

describe("claude-cli mapping", () => {
  test("no binary is unsupported, not a crash", async () => {
    const access = await makeClaudeCliProvider({
      spawn: missingBinary,
    }).access();
    expect(access.kind).toBe("unavailable");
    if (access.kind === "unavailable")
      expect(access.reason.kind).toBe("unsupported");
  });

  test("the conversation is rendered into the prompt, with the new turn last", async () => {
    const { spawn, seen } = spawnerOf({ answer: "ok" });
    const session = await openWith(makeClaudeCliProvider({ spawn }));
    await session.prompt("first");
    await session.prompt("second");
    const args = seen.calls.at(-1) ?? [];
    const prompt = args[args.indexOf("-p") + 1] ?? "";
    expect(prompt).toContain("user: first");
    expect(prompt).toContain("assistant: ok");
    expect(prompt.endsWith("user: second")).toBe(true);
    // A model behind a contract, not an agent in a repo.
    expect(args).toContain("--tools");
    expect(args[args.indexOf("--tools") + 1]).toBe("");
    expect(args).toContain("--no-session-persistence");
    expect(args[args.indexOf("--system-prompt") + 1]).toContain("Be brief.");
    session.close();
  });

  test("a schema is refused, because the CLI's own flag fails in this mode", async () => {
    const session = await openWith(stubbed());
    const answer = await session.prompt("Name the capital of France.", {
      schema: CONTRACT_SCHEMA,
    });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.kind).toBe("unsupported-config");
    session.close();
  });

  test("an abort kills the process and the turn is reported as aborted", async () => {
    const { spawn, seen } = spawnerOf({ delayMs: 15 });
    const session = await openWith(makeClaudeCliProvider({ spawn }));
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    const answer = await session.prompt("a long one", {
      signal: controller.signal,
    });
    expect(answer.ok).toBe(false);
    if (!answer.ok) expect(answer.error.kind).toBe("aborted");
    expect(seen.killed).toBe(1);
    session.close();
  });

  test("a non-zero exit carries the CLI's stderr as the detail", async () => {
    const session = await openWith(
      stubbed({ exitCode: 1, stderr: "Not logged in. Run claude login." }),
    );
    const answer = await session.prompt("hello");
    expect(answer.ok).toBe(false);
    if (!answer.ok) {
      expect(answer.error.kind).toBe("failed");
      if (answer.error.kind === "failed")
        expect(answer.error.detail).toContain("Not logged in");
    }
    session.close();
  });

  test("a result line flagged is_error is a failure with its own words", async () => {
    const session = await openWith(stubbed({ isError: true }));
    const answer = await session.prompt("hello");
    expect(answer.ok).toBe(false);
    if (!answer.ok && answer.error.kind === "failed")
      expect(answer.error.detail).toBe("budget exceeded");
    session.close();
  });

  test("the meter is the result line's counts, all four of them", async () => {
    const session = await openWith(stubbed({ outputTokens: 7 }, 1000));
    await session.prompt("hello");
    const usage = session.usage();
    expect(usage.kind).toBe("bounded");
    if (usage.kind === "bounded") expect(usage.used).toBe(6 + 10 + 4 + 7);
    session.close();
  });
});

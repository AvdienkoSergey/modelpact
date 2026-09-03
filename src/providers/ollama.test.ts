/**
 * Two halves. The contract suite runs against a daemon if one answers, and
 * skips loudly if none does — a skip is in the run output, a silent pass is
 * not. The tests under it run always, on a `fetch` that answers from strings:
 * a download, a daemon that is not there, and the errors a real one returns
 * are none of them stageable on a machine where everything works.
 */

import { describe, expect, test, vi } from "vitest";

import { CONTRACT_SCHEMA, describeContract } from "../testing/contract.js";
import { makeOllamaProvider, type OllamaConfig } from "./ollama.js";

// The model answers in a second or two, but the first call of a run loads it.
vi.setConfig({ testTimeout: 60_000 });

// Written out rather than read from the environment: `process` is kept out of
// tsconfig's `types` on purpose, so browser-side code cannot reach for it by
// accident. The `ollama` job in CI pins the same two.
const HOST = "http://127.0.0.1:11434";
const MODEL = "granite4:350m";

/** Nothing listens on port 1, and refusing is quick. */
const NOWHERE = "http://127.0.0.1:1";

const daemonAnswers = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${HOST}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return false;
    const listed: unknown = await response.json();
    const models = (listed as { models?: { model?: string }[] }).models ?? [];
    return models.some((one) => one.model === MODEL);
  } catch {
    return false;
  }
};

const reachable = await daemonAnswers();

describeContract("ollama", (scenario) => {
  if (!reachable) return null;
  switch (scenario) {
    case "ready":
      return makeOllamaProvider({ model: MODEL, host: HOST });
    case "unavailable":
      return makeOllamaProvider({ model: MODEL, host: NOWHERE });
    case "needs-download":
      // Staging it means the model is absent, and opening then downloads it
      // for real. The stubbed run below walks the same branch for nothing.
      return null;
    case "tiny-window":
      // Under one turn of `num_ctx`, so the first answer crosses the line.
      return makeOllamaProvider({
        model: MODEL,
        host: HOST,
        contextWindow: 64,
      });
  }
});

/** `String(request)` is `[object Object]`; the url lives in one of three places. */
const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
};

/** Everything this backend sends is a JSON string, and nothing else is read. */
const sentBody = (init: RequestInit | undefined): Record<string, unknown> =>
  typeof init?.body === "string"
    ? (JSON.parse(init.body) as Record<string, unknown>)
    : {};

/** A daemon made of strings: each call answers from the first matching rule. */
const daemonOf =
  (
    routes: Record<string, (init: RequestInit | undefined) => Response>,
  ): NonNullable<OllamaConfig["fetch"]> =>
  (input, init) => {
    const url = urlOf(input);
    for (const [path, answer] of Object.entries(routes)) {
      if (url.includes(path)) return Promise.resolve(answer(init));
    }
    return Promise.reject(new Error(`nothing routed for ${url}`));
  };

const jsonOf = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const ndjsonOf = (...lines: unknown[]): Response =>
  new Response(lines.map((line) => `${JSON.stringify(line)}\n`).join(""), {
    status: 200,
  });

const tagsOf = (...models: string[]): Response =>
  jsonOf({ models: models.map((model) => ({ model })) });

/**
 * Both shapes the daemon has, chosen the way it chooses: `stream: true` is
 * NDJSON ending on the line that carries the counts, `stream: false` is one
 * object. A stub that answered the same either way would hide which of
 * `generate` and `generateWhole` the lifecycle took.
 */
const chatOf =
  (...deltas: string[]) =>
  (init: RequestInit | undefined): Response => {
    const counts = { prompt_eval_count: 30, eval_count: deltas.length };
    const whole = {
      message: { content: deltas.join("") },
      done: true,
      ...counts,
    };
    if (sentBody(init).stream !== true) return jsonOf(whole);
    return ndjsonOf(
      ...deltas.map((content) => ({ message: { content }, done: false })),
      { message: { content: "" }, done: true, ...counts },
    );
  };

const stubbed = (
  routes: Record<string, (init: RequestInit | undefined) => Response>,
) => makeOllamaProvider({ model: MODEL, host: HOST, fetch: daemonOf(routes) });

const sessionOf = async (provider: ReturnType<typeof stubbed>) => {
  const access = await provider.access();
  if (access.kind !== "ready")
    throw new Error(`expected ready, got ${access.kind}`);
  const opened = await access.open();
  if (!opened.ok) throw new Error(`open refused: ${opened.error.kind}`);
  return opened.value;
};

describe("ollama without a daemon", () => {
  test("nothing listening is unavailable, not a failed request", async () => {
    const provider = makeOllamaProvider({ model: MODEL, host: NOWHERE });
    const access = await provider.access();
    expect(access.kind).toBe("unavailable");
    if (access.kind !== "unavailable") return;
    expect(access.reason.kind).toBe("unsupported");
  });

  test("a model the daemon does not have needs downloading", async () => {
    const provider = stubbed({ "/api/tags": () => tagsOf("something:else") });
    const access = await provider.access();
    expect(access.kind).toBe("needs-download");
  });

  test("the download reports progress, reaches one, and opens", async () => {
    const provider = stubbed({
      "/api/tags": () => tagsOf("something:else"),
      "/api/pull": () =>
        ndjsonOf(
          { status: "pulling manifest" },
          { status: "pulling a", digest: "a", total: 100, completed: 40 },
          { status: "pulling a", digest: "a", total: 100, completed: 100 },
          // A second layer announced late: the denominator grows, so the share
          // would step back and the monitor drops it rather than rewind.
          { status: "pulling b", digest: "b", total: 100, completed: 0 },
          { status: "pulling b", digest: "b", total: 100, completed: 100 },
          { status: "success" },
        ),
      "/api/chat": chatOf("done"),
    });

    const access = await provider.access();
    if (access.kind !== "needs-download")
      throw new Error("expected a download");
    const seen: number[] = [];
    const opened = await access.open((monitor) => {
      monitor.ondownloadprogress = (event) => seen.push(event.loaded);
    });

    expect(seen.length).toBeGreaterThan(1);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(1);
    expect(opened.ok).toBe(true);
    if (opened.ok) opened.value.close();
  });

  test("a refused pull is a failure, not a session", async () => {
    const provider = stubbed({
      "/api/tags": () => tagsOf("something:else"),
      "/api/pull": () =>
        new Response(JSON.stringify({ error: "file does not exist" }), {
          status: 500,
        }),
    });
    const access = await provider.access();
    if (access.kind !== "needs-download")
      throw new Error("expected a download");
    const opened = await access.open(() => undefined);
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.error.kind).toBe("failed");
    if (opened.error.kind === "failed")
      expect(opened.error.detail).toContain("file does not exist");
  });

  test("the daemon's own words survive the mapping", async () => {
    const session = await sessionOf(
      stubbed({
        "/api/tags": () => tagsOf(MODEL),
        "/api/chat": () =>
          new Response(JSON.stringify({ error: "model is required" }), {
            status: 400,
          }),
      }),
    );
    const answer = await session.prompt("hello");
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    // 400 is this side reading badly; the detail is what the daemon said.
    expect(answer.error.kind).toBe("invalid-input");
    if (answer.error.kind === "invalid-input")
      expect(answer.error.detail).toBe("model is required");
  });

  test("the whole conversation goes out, with this turn last", async () => {
    const sent: unknown[] = [];
    const provider = makeOllamaProvider({
      model: MODEL,
      host: HOST,
      fetch: (input, init) => {
        const url = urlOf(input);
        if (url.includes("/api/tags")) return Promise.resolve(tagsOf(MODEL));
        sent.push(sentBody(init));
        return Promise.resolve(chatOf("ok")(init));
      },
    });

    const session = await sessionOf(provider);
    await session.prompt("first");
    await session.prompt("second");
    const second = sent[1] as { messages: { role: string; content: string }[] };
    expect(second.messages).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "second" },
    ]);
    session.close();
  });

  test("a schema travels as `format`, which constrains decoding", async () => {
    const sent: Record<string, unknown>[] = [];
    const provider = makeOllamaProvider({
      model: MODEL,
      host: HOST,
      fetch: (input, init) => {
        const url = urlOf(input);
        if (url.includes("/api/tags")) return Promise.resolve(tagsOf(MODEL));
        sent.push(sentBody(init));
        return Promise.resolve(chatOf('{"city":"Paris"}')(init));
      },
    });

    const session = await sessionOf(provider);
    await session.prompt("Name the capital of France.", {
      schema: CONTRACT_SCHEMA,
    });
    expect(sent[0]?.format).toEqual(CONTRACT_SCHEMA);
    session.close();
  });

  test("the counts are what the window holds, not a running sum", async () => {
    const session = await sessionOf(
      stubbed({
        "/api/tags": () => tagsOf(MODEL),
        "/api/chat": chatOf("a", "b"),
      }),
    );
    await session.prompt("first");
    const first = session.usage();
    await session.prompt("second");
    const second = session.usage();
    // Both turns report the same counts, and `prompt_eval_count` already holds
    // the history — so the meter repeats rather than doubling.
    expect(first).toEqual(second);
    if (first.kind === "bounded") expect(first.used).toBe(32);
    session.close();
  });
});

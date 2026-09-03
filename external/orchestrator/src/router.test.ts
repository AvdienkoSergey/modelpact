/**
 * The router under the same suite every single backend passes, then each
 * policy on its own. Both sides are the mock, reached through `backendOf`
 * because the package hands out providers and a router wants backends.
 */
import { describe, expect, test } from "vitest";
import { describeContract } from "modelpact/testing";
import {
  createProvider,
  makeMockProvider,
  ok,
  type Model,
  type ModelBackend,
} from "modelpact";

import { backendOf } from "./backend-of.js";
import { makeRouterBackend, type Policy, type Route } from "./router.js";

const SCHEMA_REPLY = JSON.stringify({ city: "Paris" });

const mockSide = (
  name: string,
  reply?: (input: string) => readonly string[],
): ModelBackend =>
  backendOf(
    name,
    makeMockProvider({
      schemaReply: SCHEMA_REPLY,
      delayMs: 1,
      ...(reply === undefined ? {} : { reply }),
    }),
  );

const says =
  (prefix: string) =>
  (input: string): readonly string[] =>
    `${prefix} answering «${input.slice(0, 20)}» in several words.`.match(
      /\S+\s*/g,
    ) ?? [prefix];

const routed = (
  policy: Policy,
  onRoute?: (route: Route, reason: string) => void,
) =>
  createProvider(
    makeRouterBackend({
      local: mockSide("local", says("LOCAL")),
      cloud: mockSide("cloud", says("CLOUD")),
      policy,
      ...(onRoute === undefined ? {} : { onRoute }),
    }),
  );

describeContract("router over two mocks, predicate policy", (scenario) => {
  const policy: Policy = {
    kind: "predicate",
    cloudWhen: (input) => input.length > 30,
  };
  switch (scenario) {
    case "ready":
      return routed(policy);
    case "unavailable":
      return createProvider(
        makeRouterBackend({
          local: mockSide("local"),
          cloud: backendOf(
            "cloud",
            makeMockProvider({ access: "unavailable" }),
          ),
          policy,
        }),
      );
    case "needs-download":
      return createProvider(
        makeRouterBackend({
          local: mockSide("local"),
          cloud: backendOf(
            "cloud",
            makeMockProvider({ access: "needs-download", delayMs: 1 }),
          ),
          policy,
        }),
      );
    case "tiny-window":
      return createProvider(
        makeRouterBackend({
          local: backendOf(
            "local",
            makeMockProvider({
              contextWindow: 1,
              schemaReply: SCHEMA_REPLY,
              delayMs: 1,
            }),
          ),
          cloud: backendOf(
            "cloud",
            makeMockProvider({
              contextWindow: 1,
              schemaReply: SCHEMA_REPLY,
              delayMs: 1,
            }),
          ),
          policy,
        }),
      );
  }
});

const sessionOf = async (
  policy: Policy,
  onRoute?: (route: Route, reason: string) => void,
) => {
  const access = await routed(policy, onRoute).access();
  if (access.kind !== "ready")
    throw new Error(`expected ready, got ${access.kind}`);
  const opened = await access.open();
  if (!opened.ok) throw new Error(`open refused: ${opened.error.kind}`);
  return opened.value;
};

describe("router policies", () => {
  test("predicate: the condition picks the side, and the record is one conversation", async () => {
    const routes: Route[] = [];
    const session = await sessionOf(
      { kind: "predicate", cloudWhen: (input) => input.startsWith("hard:") },
      (r) => routes.push(r),
    );
    const easy = await session.prompt("hi");
    const hard = await session.prompt("hard: prove it");
    expect(routes).toEqual(["local", "cloud"]);
    if (easy.ok) expect(easy.value.startsWith("LOCAL")).toBe(true);
    if (hard.ok) expect(hard.value.startsWith("CLOUD")).toBe(true);
    expect(session.history()).toHaveLength(4);
    session.close();
  });

  test("escalate: a rejected local answer is thrown away and the cloud asked", async () => {
    const reasons: string[] = [];
    const session = await sessionOf(
      { kind: "escalate", accept: (answer) => !answer.startsWith("LOCAL") },
      (_, why) => reasons.push(why),
    );
    const answer = await session.prompt("anything");
    expect(answer.ok).toBe(true);
    if (answer.ok) expect(answer.value.startsWith("CLOUD")).toBe(true);
    expect(reasons).toEqual(["local answer rejected"]);
    // The rejected answer never reached the record.
    expect(
      session.history().filter((m) => m.content.startsWith("LOCAL")),
    ).toHaveLength(0);
    session.close();
  });

  test("escalate: an accepted local answer still arrives as a stream in pieces", async () => {
    const session = await sessionOf({ kind: "escalate", accept: () => true });
    const started = await session.promptStream("anything");
    if (!started.ok) throw new Error("expected a stream");
    const reader = started.value.getReader();
    let deltas = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      deltas += 1;
    }
    expect(deltas).toBeGreaterThan(1);
    session.close();
  });

  test("classify: the judge's schema answer picks the side; outside the schema means local", async () => {
    const CLOUD = JSON.stringify({ route: "cloud" });
    const NOT_JSON = "not json at all";
    const judge = backendOf(
      "judge",
      makeMockProvider({ delayMs: 1, schemaReply: CLOUD }),
    );
    const routes: Route[] = [];
    const reasons: string[] = [];
    let session = await sessionOf({ kind: "classify", judge }, (r, why) => {
      routes.push(r);
      reasons.push(why);
    });
    await session.prompt("something");
    session.close();
    const judgeOff = backendOf(
      "judge",
      makeMockProvider({ delayMs: 1, schemaReply: NOT_JSON }),
    );
    session = await sessionOf(
      { kind: "classify", judge: judgeOff },
      (r, why) => {
        routes.push(r);
        reasons.push(why);
      },
    );
    await session.prompt("something");
    session.close();
    expect(routes).toEqual(["cloud", "local"]);
    expect(reasons).toEqual(["judge", "judge answered outside the schema"]);
  });

  test("availability is the worse of the sides", async () => {
    const ready = mockSide("a");
    const down = backendOf("b", makeMockProvider({ access: "unavailable" }));
    const fetching = backendOf(
      "c",
      makeMockProvider({ access: "needs-download" }),
    );
    const policy: Policy = { kind: "predicate", cloudWhen: () => false };
    expect(
      (
        await makeRouterBackend({
          local: ready,
          cloud: down,
          policy,
        }).availability({})
      ).kind,
    ).toBe("unavailable");
    expect(
      (
        await makeRouterBackend({
          local: ready,
          cloud: fetching,
          policy,
        }).availability({})
      ).kind,
    ).toBe("needs-download");
    expect(
      (
        await makeRouterBackend({
          local: ready,
          cloud: ready,
          policy,
        }).availability({})
      ).kind,
    ).toBe("ready");
  });

  test("dispose reaches every side", async () => {
    let disposed = 0;
    const counting = (name: string): ModelBackend => ({
      name,
      modalities: ["text"],
      availability: () => ({ kind: "ready" }),
      connect: () =>
        Promise.resolve(
          ok<Model>({
            generate: () =>
              Promise.resolve(
                ok(new ReadableStream<string>({ start: (c) => c.close() })),
              ),
            usage: () => ({ kind: "unknown" }),
            dispose: () => {
              disposed += 1;
            },
          }),
        ),
    });
    const provider = createProvider(
      makeRouterBackend({
        local: counting("l"),
        cloud: counting("c"),
        policy: { kind: "classify", judge: counting("j") },
      }),
    );
    const access = await provider.access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");
    opened.value.close();
    expect(disposed).toBe(3);
  });
});

/**
 * The orchestrator is not a provider and does not take the conformance suite:
 * a usage meter and an overflow event belong to one model, and it holds two.
 * What is tested is what it actually promises — which side answers, and that
 * both sides see the whole conversation however it was split between them.
 */
import { describe, expect, test } from "vitest";
import { makeMockProvider, type AiProvider } from "modelpact";

import { orchestrate, type Policy, type Side } from "./orchestrate.js";

/** The mock echoes its input, so what a side says shows what it was handed. */
const side = (tag: string): AiProvider =>
  makeMockProvider({
    delayMs: 1,
    reply: (input) =>
      `${tag} to «${input.slice(0, 24)}» in several words.`.match(
        /\S+\s*/g,
      ) ?? [tag],
  });

/** Answers with how many messages it was opened on, which is the record it saw. */
const counting = (): AiProvider =>
  makeMockProvider({ delayMs: 1, reply: (input) => [`saw:${input}`] });

const routed = (policy: Policy, onRoute?: (s: Side, why: string) => void) =>
  orchestrate({
    local: side("LOCAL"),
    cloud: side("CLOUD"),
    policy,
    ...(onRoute === undefined ? {} : { onRoute }),
  });

describe("orchestrator", () => {
  test("a predicate picks the side and the record is one conversation", async () => {
    const sides: Side[] = [];
    const chat = routed(
      { kind: "predicate", cloudWhen: (input) => input.startsWith("hard:") },
      (s) => sides.push(s),
    );
    const easy = await chat.ask("hi");
    const hard = await chat.ask("hard: prove it");
    expect(sides).toEqual(["local", "cloud"]);
    expect(easy.ok && easy.value.text.startsWith("LOCAL")).toBe(true);
    expect(hard.ok && hard.value.text.startsWith("CLOUD")).toBe(true);
    expect(easy.ok && easy.value.side).toBe("local");
    expect(chat.record()).toHaveLength(4);
    chat.close();
  });

  test("a side sees the turns the other side answered", async () => {
    // local, cloud, local: the third turn is the one that used to be blind.
    let turn = 0;
    const chat = orchestrate({
      local: counting(),
      cloud: side("CLOUD"),
      policy: { kind: "predicate", cloudWhen: () => (turn += 1) === 2 },
    });
    const first = await chat.ask("one");
    await chat.ask("two");
    const third = await chat.ask("three");
    expect(first.ok && third.ok).toBe(true);
    if (!first.ok || !third.ok) return;
    expect(first.value.usage.kind).toBe("bounded");
    expect(third.value.usage.kind).toBe("bounded");
    if (
      first.value.usage.kind !== "bounded" ||
      third.value.usage.kind !== "bounded"
    )
      return;

    // The mock's meter counts the words it was opened on plus the turn. Had the
    // local side kept its first session, the third turn would count only its
    // own two turns — `first.used` again, plus this one. Reopened on the
    // record, it also carries the turn the cloud answered.
    const ownTurnsOnly = first.value.usage.used * 2;
    expect(third.value.usage.used).toBeGreaterThan(ownTurnsOnly);
    expect(chat.record()).toHaveLength(6);
    chat.close();
  });

  test("a warm side is not reopened while it keeps answering", async () => {
    let opens = 0;
    const watched: AiProvider = {
      name: "mock",
      access: async (request) => {
        const access = await side("WARM").access(request);
        if (access.kind !== "ready") return access;
        return {
          kind: "ready",
          open: (options) => {
            opens += 1;
            return access.open(options);
          },
        };
      },
    };
    const chat = orchestrate({
      local: watched,
      cloud: side("CLOUD"),
      policy: { kind: "predicate", cloudWhen: () => false },
    });
    await chat.ask("one");
    await chat.ask("two");
    await chat.ask("three");
    // Opened once and kept: reopening a model that holds its own transcript
    // costs the state it built, and nothing has gone stale.
    expect(opens).toBe(1);
    chat.close();
  });

  test("escalate: a rejected local answer is thrown away and never recorded", async () => {
    const reasons: string[] = [];
    const chat = routed(
      { kind: "escalate", accept: (answer) => !answer.startsWith("LOCAL") },
      (_, why) => reasons.push(why),
    );
    const answered = await chat.ask("anything");
    expect(answered.ok && answered.value.side).toBe("cloud");
    expect(reasons).toEqual(["local answer rejected"]);
    expect(
      chat.record().filter((m) => m.content.startsWith("LOCAL")),
    ).toHaveLength(0);
    expect(chat.record()).toHaveLength(2);
    chat.close();
  });

  test("escalate: an accepted answer is kept, and arrives whole", async () => {
    const chat = routed({ kind: "escalate", accept: () => true });
    const started = await chat.askStream("anything");
    if (!started.ok) throw new Error("expected a stream");
    const reader = started.value.getReader();
    let pieces = 0;
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      pieces += 1;
    }
    // One piece: the policy has to read the answer before it can judge it.
    expect(pieces).toBe(1);
    expect(chat.record()).toHaveLength(2);
    chat.close();
  });

  test("a streamed turn arrives in pieces and lands in the record once", async () => {
    const chat = routed({ kind: "predicate", cloudWhen: () => false });
    const started = await chat.askStream("say something");
    if (!started.ok) throw new Error("expected a stream");
    const reader = started.value.getReader();
    const parts: string[] = [];
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      parts.push(next.value);
    }
    expect(parts.length).toBeGreaterThan(1);
    expect(chat.record()).toHaveLength(2);
    expect(chat.record()[1]?.content).toBe(parts.join(""));
    chat.close();
  });

  test("classify: the judge's answer picks the side; anything else means local", async () => {
    const judged = async (verdict: string): Promise<Side[]> => {
      const sides: Side[] = [];
      const chat = routed(
        {
          kind: "classify",
          judge: makeMockProvider({ delayMs: 1, reply: () => [verdict] }),
        },
        (s) => sides.push(s),
      );
      await chat.ask("something");
      chat.close();
      return sides;
    };
    expect(await judged(JSON.stringify({ route: "cloud" }))).toEqual(["cloud"]);
    expect(await judged("no idea, sorry")).toEqual(["local"]);
  });

  test("an unavailable side is a refusal, not a throw", async () => {
    const chat = orchestrate({
      local: makeMockProvider({ access: "unavailable" }),
      cloud: side("CLOUD"),
      policy: { kind: "predicate", cloudWhen: () => false },
    });
    const answered = await chat.ask("hello");
    expect(answered.ok).toBe(false);
    if (!answered.ok) expect(answered.error.kind).toBe("unsupported");
    chat.close();
  });

  test("a history handed in starts the conversation", async () => {
    const chat = orchestrate({
      local: side("LOCAL"),
      cloud: side("CLOUD"),
      policy: { kind: "predicate", cloudWhen: () => false },
      history: [
        { role: "user", content: "earlier" },
        { role: "assistant", content: "quite" },
      ],
    });
    expect(chat.record()).toHaveLength(2);
    await chat.ask("next");
    expect(chat.record()).toHaveLength(4);
    chat.close();
  });
});

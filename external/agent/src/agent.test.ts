/**
 * The loop, on a brain made of strings.
 *
 * A scripted brain rather than a model, because what is under test is the
 * control flow: when a tool runs, what reaches the model after it, what a
 * denial and a throw look like from the inside, and where the loop stops.
 * `live.test.ts` runs the same loop on a real model.
 */
import { describe, expect, test } from "vitest";
import { makeMockProvider, type AiFailure, type Result } from "modelpact";

import { runAgent, type AgentEvent, type Tool } from "./agent.js";
import { brainOfSession, type Brain } from "./brain.js";

const step = (fields: Partial<Record<string, unknown>>): string =>
  JSON.stringify({
    reason: "because",
    action: "answer",
    tool: "",
    args: {},
    answer: "",
    ...fields,
  });

const callTool = (tool: string, args: Record<string, unknown> = {}): string =>
  step({ action: "tool", tool, args });

const answer = (text: string): string =>
  step({ action: "answer", answer: text });

interface Scripted {
  readonly brain: Brain;
  readonly asked: { input: string; constrained: boolean }[];
}

/** Replies in order; runs out into a final answer so a runaway test still ends. */
const scripted = (
  replies: readonly string[],
  refuseSchema = false,
): Scripted => {
  const asked: { input: string; constrained: boolean }[] = [];
  let index = 0;
  const brain: Brain = {
    ask: (input, options): Promise<Result<string, AiFailure>> => {
      const constrained = options?.schema !== undefined;
      if (constrained && refuseSchema)
        return Promise.resolve({
          ok: false,
          error: { kind: "unsupported-config", languages: [] },
        });
      asked.push({ input, constrained });
      const reply = replies[index] ?? answer("ran out of script");
      index += 1;
      return Promise.resolve({ ok: true, value: reply });
    },
    record: () => [],
  };
  return { brain, asked };
};

const echoTool = (name = "echo"): Tool => ({
  name,
  description: "Echoes its text back.",
  parameters: { type: "object" } as never,
  execute: (args) => `echoed: ${String(args["text"] ?? "")}`,
});

describe("the agent loop", () => {
  test("calls a tool, feeds the result back, then answers", async () => {
    const { brain, asked } = scripted([
      callTool("echo", { text: "hi" }),
      answer("all done"),
    ]);
    const events: AgentEvent[] = [];
    const run = await runAgent(
      { brain, tools: [echoTool()], onEvent: (e) => events.push(e) },
      "do it",
    );

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.text).toBe("all done");
    expect(run.value.steps).toBe(2);
    expect(run.value.constrained).toBe(true);
    // The tool's output is what the model saw on the second turn.
    expect(asked[1]?.input).toContain("Result of echo:");
    expect(asked[1]?.input).toContain("echoed: hi");
    expect(events.map((e) => e.kind)).toEqual([
      "step",
      "thought",
      "tool",
      "result",
      "step",
      "thought",
      "answer",
    ]);
  });

  test("a tool that throws comes back as text the model can act on", async () => {
    const angry: Tool = {
      name: "angry",
      description: "Always fails.",
      parameters: { type: "object" } as never,
      execute: () => {
        throw new Error("the disk is on fire");
      },
    };
    const { brain, asked } = scripted([callTool("angry"), answer("noted")]);
    const run = await runAgent({ brain, tools: [angry] }, "try it");

    expect(run.ok).toBe(true);
    // Handed back, not thrown: the run continues and the model is told why.
    expect(asked[1]?.input).toContain("ERROR: the disk is on fire");
  });

  test("an unknown tool is named back, with the ones that exist", async () => {
    const { brain, asked } = scripted([callTool("nosuch"), answer("fine")]);
    await runAgent({ brain, tools: [echoTool()] }, "try it");
    expect(asked[1]?.input).toContain('there is no tool called "nosuch"');
    expect(asked[1]?.input).toContain("Tools: echo");
  });

  test("a tool that needs approval is denied when nobody can approve", async () => {
    const guarded: Tool = { ...echoTool("guarded"), needsApproval: true };
    const { brain, asked } = scripted([
      callTool("guarded"),
      answer("understood"),
    ]);
    const run = await runAgent({ brain, tools: [guarded] }, "try it");

    expect(run.ok).toBe(true);
    // No approver means no approval, rather than a default yes.
    expect(asked[1]?.input).toContain("DENIED");
  });

  test("an approver can let it through, and sees the arguments", async () => {
    const guarded: Tool = { ...echoTool("guarded"), needsApproval: true };
    const seen: Record<string, unknown>[] = [];
    const { brain, asked } = scripted([
      callTool("guarded", { text: "ok" }),
      answer("done"),
    ]);
    await runAgent(
      {
        brain,
        tools: [guarded],
        approve: (tool, args) => {
          seen.push({ name: tool.name, ...args });
          return true;
        },
      },
      "try it",
    );
    expect(seen).toEqual([{ name: "guarded", text: "ok" }]);
    expect(asked[1]?.input).toContain("echoed: ok");
  });

  test("a long result is cut before it goes back", async () => {
    const long: Tool = {
      ...echoTool("long"),
      execute: () => "x".repeat(500),
    };
    const { brain, asked } = scripted([callTool("long"), answer("done")]);
    await runAgent({ brain, tools: [long], maxResultChars: 100 }, "try it");
    const fed = asked[1]?.input ?? "";
    expect(fed).toContain("cut by the harness");
    expect(fed.length).toBeLessThan(400);
  });

  test("the same call with the same answer is named as a repeat, not fed back again", async () => {
    const { brain, asked } = scripted([
      callTool("echo", { text: "x" }),
      callTool("echo", { text: "x" }),
      answer("fine"),
    ]);
    const events: AgentEvent[] = [];
    await runAgent(
      { brain, tools: [echoTool()], onEvent: (e) => events.push(e) },
      "loop a bit",
    );

    const statuses = events
      .filter((e) => e.kind === "result")
      .map((e) => (e.kind === "result" ? e.status : ""));
    expect(statuses).toEqual(["ok", "repeat"]);
    // The second time it is told so, instead of being handed the same text.
    expect(asked[2]?.input).toContain("Calling it again will not help");
  });

  test("a tool that answers differently each time is not a repeat", async () => {
    let calls = 0;
    const clock: Tool = {
      ...echoTool("clock"),
      execute: () => `tick ${(calls += 1)}`,
    };
    const { brain } = scripted([
      callTool("clock"),
      callTool("clock"),
      answer("fine"),
    ]);
    const events: AgentEvent[] = [];
    await runAgent(
      { brain, tools: [clock], onEvent: (e) => events.push(e) },
      "read the clock twice",
    );

    const statuses = events
      .filter((e) => e.kind === "result")
      .map((e) => (e.kind === "result" ? e.status : ""));
    // Same arguments, different answers: legitimate, and left alone.
    expect(statuses).toEqual(["ok", "ok"]);
  });

  test("a third identical call stops the run, with the call named", async () => {
    const { brain } = scripted([
      callTool("echo"),
      callTool("echo"),
      callTool("echo"),
      answer("never reached"),
    ]);
    const run = await runAgent(
      { brain, tools: [echoTool()], maxSteps: 20 },
      "loop",
    );
    expect(run.ok).toBe(false);
    if (run.ok || run.error.kind !== "failed") return;
    // Early and specific, rather than burning every step to say the same thing.
    expect(run.error.detail).toContain("echo(");
    expect(run.error.detail).toContain("3 times");
  });

  test("a repeated failure is a loop too, which is the one that happens", async () => {
    const { brain, asked } = scripted([
      callTool("nosuch"),
      callTool("nosuch"),
      answer("fine"),
    ]);
    const events: AgentEvent[] = [];
    await runAgent(
      { brain, tools: [echoTool()], onEvent: (e) => events.push(e) },
      "ask for a ghost",
    );

    const statuses = events
      .filter((e) => e.kind === "result")
      .map((e) => (e.kind === "result" ? e.status : ""));
    expect(statuses).toEqual(["error", "repeat"]);
    expect(asked[2]?.input).toContain("Calling it again will not help");
  });

  test("running out of steps is a failure with a reason, not a hang", async () => {
    // Different arguments each time, so this is slow progress rather than the
    // stuck detector above; the bound is what ends it.
    const { brain } = scripted([
      callTool("echo", { text: "a" }),
      callTool("echo", { text: "b" }),
      callTool("echo", { text: "c" }),
    ]);
    const run = await runAgent(
      { brain, tools: [echoTool()], maxSteps: 3 },
      "work slowly",
    );
    expect(run.ok).toBe(false);
    if (run.ok) return;
    expect(run.error.kind).toBe("failed");
    if (run.error.kind === "failed")
      expect(run.error.detail).toContain("within 3 steps");
  });

  test("output outside the shape costs a step and is asked for again", async () => {
    const { brain, asked } = scripted([
      "I think I will just chat instead.",
      answer("sorry, done"),
    ]);
    const run = await runAgent({ brain, tools: [echoTool()] }, "do it");
    expect(run.ok).toBe(true);
    if (run.ok) expect(run.value.steps).toBe(2);
    expect(asked[1]?.input).toContain("not the shape asked for");
  });

  test('"call a tool" with no name is a shape error, not a missing tool', async () => {
    const { brain, asked } = scripted([
      step({ action: "tool", tool: "" }),
      answer("recovered"),
    ]);
    const run = await runAgent({ brain, tools: [echoTool()] }, "do it");
    expect(run.ok).toBe(true);
    // `granite4:350m` emitted exactly this, and being handed a list of tool
    // names told it nothing it could use.
    expect(asked[1]?.input).toContain("not the shape asked for");
    expect(asked[1]?.input).not.toContain("there is no tool called");
  });

  test("a refused schema drops the loop into prose, and it still finishes", async () => {
    // `claude -p` refuses schemas, measured. The refusal is the signal, and the
    // object is read out of the text instead.
    const { brain, asked } = scripted(
      [`Sure! Here you go:\n\`\`\`json\n${answer("read from prose")}\n\`\`\``],
      true,
    );
    const run = await runAgent({ brain, tools: [echoTool()] }, "do it");

    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.value.text).toBe("read from prose");
    expect(run.value.constrained).toBe(false);
    // Asked once, unconstrained: the refusal did not cost a step.
    expect(asked).toHaveLength(1);
    expect(asked[0]?.constrained).toBe(false);
  });

  test("a refusal that is not about the schema ends the run", async () => {
    const brain: Brain = {
      ask: () =>
        Promise.resolve({
          ok: false,
          error: { kind: "busy", detail: "another turn" },
        }),
      record: () => [],
    };
    const run = await runAgent({ brain, tools: [] }, "do it");
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error.kind).toBe("busy");
  });

  test("an empty answer is asked for again rather than returned", async () => {
    const { brain } = scripted([answer("   "), answer("really done")]);
    const run = await runAgent({ brain, tools: [] }, "do it");
    expect(run.ok && run.value.text).toBe("really done");
  });

  test("on a real session, through the adapter", async () => {
    // The mock honours a schema when it is given a reply for one, so this is
    // the loop over the library's own session rather than over a stub brain.
    const access = await makeMockProvider({
      delayMs: 1,
      schemaReply: answer("from the mock"),
    }).access();
    if (access.kind !== "ready") throw new Error("expected ready");
    const opened = await access.open();
    if (!opened.ok) throw new Error("expected a session");

    const run = await runAgent(
      { brain: brainOfSession(opened.value), tools: [] },
      "say something",
    );
    expect(run.ok && run.value.text).toBe("from the mock");
    // The turn went through the session, so it is in the session's record.
    expect(opened.value.history()).toHaveLength(2);
    opened.value.close();
  });
});

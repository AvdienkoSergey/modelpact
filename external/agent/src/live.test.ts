/**
 * The real thing, when it is here: `claude` on PATH and a daemon on 11434.
 * Skips loudly otherwise. One-liners and a capped budget, because this spends
 * the account's own money.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { makeOllamaProvider } from "modelpact";

import { runAgent, type AgentEvent } from "./agent.js";
import { makeSessionBrain } from "./brain.js";
import { makeClaudeCliProvider } from "./claude-cli.js";
import { listFilesTool, readFileTool } from "./tools.js";
import { orchestrate, type Side } from "./orchestrate.js";

const isClaudeHere =
  spawnSync("claude", ["--version"], { encoding: "utf8" }).status === 0;
const isOllamaHere = await (async () => {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2_000),
    });
    return response.ok;
  } catch {
    return false;
  }
})();

/** Big enough to hold a tool-calling shape; the 350m model fills the fields but not the intent. */
const AGENT_MODEL = "qwen3:14b";

describe.skipIf(!isClaudeHere || !isOllamaHere)(
  "live: claude -p and ollama in one conversation",
  () => {
    test("local, cloud, local — and the third turn saw the second", async () => {
      const sides: Side[] = [];
      let turn = 0;
      const chat = orchestrate({
        local: makeOllamaProvider({ model: "granite4:350m" }),
        cloud: makeClaudeCliProvider({ model: "sonnet", maxBudgetUsd: 0.2 }),
        policy: { kind: "predicate", cloudWhen: () => (turn += 1) === 2 },
        system: "Answer in at most eight words.",
        onRoute: (side) => sides.push(side),
      });

      const firstResult = await chat.ask(
        "My favourite colour is teal. Acknowledge.",
      );
      const secondResult = await chat.ask("Name the capital of France.");
      const thirdResult = await chat.ask(
        "What did I say my favourite colour was?",
      );

      expect(firstResult.ok && secondResult.ok && thirdResult.ok).toBe(true);
      expect(sides).toEqual(["local", "cloud", "local"]);
      expect(chat.record()).toHaveLength(6);
      // The local model was reopened on the whole record, so the answer it gives
      // is about a fact stated before a turn it did not answer.
      if (thirdResult.ok)
        expect(thirdResult.value.text.toLowerCase()).toContain("teal");
      chat.close();
    }, 180_000);
  },
);

/**
 * The same loop on the other kind of brain. `claude -p` refuses a schema, so
 * this run goes down the prose branch end to end — the branch the unit tests
 * only reach through a stub. What it proves is that a refusal is a mode and
 * not a failure: the tool still runs and the answer still comes from its output.
 */
describe.skipIf(!isClaudeHere)(
  "live: the agent loop on a brain that refuses schemas",
  () => {
    test("claude reads the file through a tool and answers from it, in prose mode", async () => {
      const root = await mkdtemp(join(tmpdir(), "agent-live-claude-"));
      await writeFile(
        join(root, "colour.txt"),
        "The colour on file is teal.\n",
        "utf8",
      );

      const access = await makeClaudeCliProvider({
        model: "sonnet",
        maxBudgetUsd: 0.3,
      }).access();
      if (access.kind !== "ready")
        throw new Error(`expected ready, got ${access.kind}`);
      const sessionResult = await access.open();
      if (!sessionResult.ok)
        throw new Error(`open refused: ${sessionResult.error.kind}`);

      const events: AgentEvent[] = [];
      const runResult = await runAgent(
        {
          brain: makeSessionBrain(sessionResult.value),
          tools: [listFilesTool(root), readFileTool(root)],
          maxSteps: 6,
          onEvent: (event) => events.push(event),
        },
        "Read colour.txt in the workspace and tell me the colour it names. Use the tools.",
      );

      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;
      expect(runResult.value.text.toLowerCase()).toContain("teal");
      // The refusal picked the mode; the loop finished anyway.
      expect(runResult.value.constrained).toBe(false);
      expect(events.some((event) => event.kind === "tool")).toBe(true);
      sessionResult.value.close();
    }, 300_000);
  },
);

describe.skipIf(!isOllamaHere)("live: the agent loop on a real model", () => {
  test("it calls a tool, reads the result, and answers from it", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-live-"));
    await writeFile(
      join(root, "colour.txt"),
      "The colour on file is teal.\n",
      "utf8",
    );

    const access = await makeOllamaProvider({
      model: AGENT_MODEL,
      contextWindow: 8192,
    }).access();
    if (access.kind !== "ready")
      throw new Error(`expected ready, got ${access.kind}`);
    const sessionResult = await access.open();
    if (!sessionResult.ok)
      throw new Error(`open refused: ${sessionResult.error.kind}`);

    const events: AgentEvent[] = [];
    const runResult = await runAgent(
      {
        brain: makeSessionBrain(sessionResult.value),
        tools: [listFilesTool(root), readFileTool(root)],
        maxSteps: 6,
        onEvent: (event) => events.push(event),
      },
      "Read colour.txt in the workspace and tell me the colour it names. Use the tools.",
    );

    expect(runResult.ok).toBe(true);
    if (!runResult.ok) return;
    // The answer can only contain the word if the tool actually ran and its
    // output came back into the conversation.
    expect(runResult.value.text.toLowerCase()).toContain("teal");
    expect(runResult.value.constrained).toBe(true);
    expect(
      events.filter((event) => event.kind === "tool").length,
    ).toBeGreaterThan(0);
    sessionResult.value.close();
  }, 300_000);
});

/**
 * A terminal agent: a task in, tools called, an answer out. `npm run chat`.
 *
 *   BRAIN=single|routed     one model, or two behind a policy. Default single.
 *   AGENT_MODEL=qwen3:14b   the model that does the thinking
 *   CLAUDE_MODEL=sonnet     the cloud side, routed only
 *   POLICY=predicate|escalate|classify   routed only, default predicate
 *   APPROVE=always          let guarded tools through; the default is to deny
 *   ROOT=.                  the workspace the tools are confined to
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout, env, cwd } from "node:process";
import { resolve } from "node:path";
import { makeOllamaProvider, type AiSession } from "modelpact";

import { runAgent, type AgentEvent } from "./agent.js";
import { brainOfChat, brainOfSession, type Brain } from "./brain.js";
import { makeClaudeCliProvider } from "./claude-cli.js";
import { orchestrate, type Orchestrator, type Policy } from "./orchestrate.js";
import { listFilesTool, readFileTool, writeNoteTool } from "./tools.js";

const AGENT_MODEL = env.AGENT_MODEL ?? "qwen3:14b";

const policyOf = (): Policy => {
  switch (env.POLICY) {
    case "escalate":
      return { kind: "escalate", accept: (said) => said.length > 40 };
    case "classify":
      return {
        kind: "classify",
        judge: makeOllamaProvider({ model: "granite4:350m" }),
      };
    default:
      return { kind: "predicate", cloudWhen: (input) => input.length > 240 };
  }
};

interface Thinker {
  readonly brain: Brain;
  readonly close: () => void;
  readonly what: string;
}

const routedThinker = (): Thinker => {
  const chat: Orchestrator = orchestrate({
    local: makeOllamaProvider({ model: AGENT_MODEL, contextWindow: 8192 }),
    cloud: makeClaudeCliProvider({
      model: env.CLAUDE_MODEL ?? "sonnet",
      maxBudgetUsd: 0.5,
    }),
    policy: policyOf(),
    onRoute: (side, why) => stdout.write(`  · routed ${side} (${why})\n`),
  });
  return {
    brain: brainOfChat(chat),
    close: () => chat.close(),
    what: `routed · ${AGENT_MODEL} + claude`,
  };
};

const singleThinker = async (): Promise<Thinker | null> => {
  const access = await makeOllamaProvider({
    model: AGENT_MODEL,
    contextWindow: 8192,
  }).access();
  if (access.kind === "unavailable") {
    stdout.write(`no model: ${access.reason.kind}\n`);
    return null;
  }
  const opened =
    access.kind === "ready"
      ? await access.open()
      : await access.open(() => undefined);
  if (!opened.ok) {
    stdout.write(`open refused: ${opened.error.kind}\n`);
    return null;
  }
  const session: AiSession = opened.value;
  return {
    brain: brainOfSession(session),
    close: () => session.close(),
    what: AGENT_MODEL,
  };
};

const show = (event: AgentEvent): void => {
  if (event.kind === "thought") stdout.write(`  · ${event.reason}\n`);
  if (event.kind === "tool")
    stdout.write(`  → ${event.name}(${JSON.stringify(event.args)})\n`);
  if (event.kind === "result")
    stdout.write(
      `  ← ${event.status}: ${event.preview.split("\n")[0] ?? ""}\n`,
    );
};

const main = async (): Promise<void> => {
  const thinker =
    env.BRAIN === "routed" ? routedThinker() : await singleThinker();
  if (thinker === null) return;

  const root = resolve(env.ROOT ?? cwd());
  const tools = [listFilesTool(root), readFileTool(root), writeNoteTool(root)];
  // Explicit, and off by default: a gate that opens itself is not a gate.
  const approving = env.APPROVE === "always";

  const rl = createInterface({ input: stdin, output: stdout });
  stdout.write(
    `brain=${thinker.what} · root=${root} · approve=${approving ? "always" : "never"}\n`,
  );
  stdout.write("Give it a task, or /q to quit.\n");
  rl.setPrompt("> ");
  rl.prompt();
  for await (const raw of rl) {
    const task = raw.trim();
    if (task === "/q" || task === "") break;
    const run = await runAgent(
      {
        brain: thinker.brain,
        tools,
        maxSteps: 8,
        approve: () => approving,
        onEvent: show,
      },
      task,
    );
    if (run.ok)
      stdout.write(
        `\n${run.value.text}\n  (${run.value.steps} steps, ${run.value.constrained ? "schema" : "prose"})\n`,
      );
    else stdout.write(`  refused: ${run.error.kind}\n`);
    rl.prompt();
  }
  rl.close();
  thinker.close();
};

void main();

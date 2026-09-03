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
import { makeOllamaProvider, type AiFailure, type AiSession } from "modelpact";

import { runAgent, type AgentEvent } from "./agent.js";
import { makeChatBrain, makeSessionBrain, type Brain } from "./brain.js";
import { makeClaudeCliProvider } from "./claude-cli.js";
import { orchestrate, type Orchestrator, type Policy } from "./orchestrate.js";
import { listFilesTool, readFileTool, writeNoteTool } from "./tools.js";

const AGENT_MODEL = env.AGENT_MODEL ?? "qwen3:14b";

const getPolicy = (): Policy => {
  switch (env.POLICY) {
    case "escalate":
      return { kind: "escalate", accept: (answer) => answer.length > 40 };
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
  readonly label: string;
}

const makeRoutedThinker = (): Thinker => {
  const chat: Orchestrator = orchestrate({
    local: makeOllamaProvider({ model: AGENT_MODEL, contextWindow: 8192 }),
    cloud: makeClaudeCliProvider({
      model: env.CLAUDE_MODEL ?? "sonnet",
      maxBudgetUsd: 0.5,
    }),
    policy: getPolicy(),
    onRoute: (side, reason) => stdout.write(`  · routed ${side} (${reason})\n`),
  });
  return {
    brain: makeChatBrain(chat),
    close: () => chat.close(),
    label: `routed · ${AGENT_MODEL} + claude`,
  };
};

const makeSingleThinker = async (): Promise<Thinker | null> => {
  const access = await makeOllamaProvider({
    model: AGENT_MODEL,
    contextWindow: 8192,
  }).access();
  if (access.kind === "unavailable") {
    stdout.write(`no model: ${access.reason.kind}\n`);
    return null;
  }
  const sessionResult =
    access.kind === "ready"
      ? await access.open()
      : await access.open(() => undefined);
  if (!sessionResult.ok) {
    stdout.write(`open refused: ${sessionResult.error.kind}\n`);
    return null;
  }
  const session: AiSession = sessionResult.value;
  return {
    brain: makeSessionBrain(session),
    close: () => session.close(),
    label: AGENT_MODEL,
  };
};

/** The kind alone says almost nothing; every failure that carries a detail carries the reason. */
const explainFailure = (failure: AiFailure): string =>
  "detail" in failure ? `${failure.kind}: ${failure.detail}` : failure.kind;

const showEvent = (event: AgentEvent): void => {
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
    env.BRAIN === "routed" ? makeRoutedThinker() : await makeSingleThinker();
  if (thinker === null) return;

  const root = resolve(env.ROOT ?? cwd());
  const tools = [listFilesTool(root), readFileTool(root), writeNoteTool(root)];
  // Explicit, and off by default: a gate that opens itself is not a gate.
  const isApproving = env.APPROVE === "always";

  const readline = createInterface({ input: stdin, output: stdout });
  stdout.write(
    `brain=${thinker.label} · root=${root} · approve=${isApproving ? "always" : "never"}\n`,
  );
  stdout.write("Give it a task, or /q to quit.\n");
  readline.setPrompt("> ");
  readline.prompt();
  for await (const rawLine of readline) {
    const task = rawLine.trim();
    if (task === "/q" || task === "") break;
    const runResult = await runAgent(
      {
        brain: thinker.brain,
        tools,
        maxSteps: 8,
        approve: () => isApproving,
        onEvent: showEvent,
      },
      task,
    );
    if (runResult.ok)
      stdout.write(
        `\n${runResult.value.text}\n  (${runResult.value.steps} steps, ${runResult.value.constrained ? "schema" : "prose"})\n`,
      );
    else stdout.write(`  refused: ${explainFailure(runResult.error)}\n`);
    readline.prompt();
  }
  readline.close();
  thinker.close();
};

void main();

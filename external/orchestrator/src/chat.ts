/**
 * A terminal chat over the router: Claude from `claude -p`, a local model from
 * Ollama, and a small local judge deciding which one speaks. `npm run chat`.
 *
 *   POLICY=predicate|escalate|classify   default classify
 *   LOCAL_MODEL=qwen3:14b                the local side
 *   JUDGE_MODEL=granite4:350m            the judge, classify only
 *   CLAUDE_MODEL=sonnet                  alias or id for the cloud side
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout, env } from "node:process";
import {
  createProvider,
  makeOllamaProvider,
  type ModelBackend,
} from "modelpact";

import { backendOf } from "./backend-of.js";
import { makeClaudeCliBackend } from "./claude-cli.js";
import { makeRouterBackend, type Policy } from "./router.js";

const ollamaBackend = (model: string): ModelBackend =>
  backendOf("ollama", makeOllamaProvider({ model }));

const policyOf = (): Policy => {
  const judge = ollamaBackend(env.JUDGE_MODEL ?? "granite4:350m");
  switch (env.POLICY) {
    case "predicate":
      return {
        kind: "predicate",
        cloudWhen: (input) =>
          input.length > 240 || /\bwhy\b|\bprove\b|\bdesign\b/i.test(input),
      };
    case "escalate":
      return {
        kind: "escalate",
        accept: (answer) =>
          answer.length > 40 && !/i (don't|do not) know/i.test(answer),
      };
    default:
      return { kind: "classify", judge };
  }
};

const main = async (): Promise<void> => {
  const parts = {
    local: ollamaBackend(env.LOCAL_MODEL ?? "qwen3:14b"),
    cloud: makeClaudeCliBackend({
      model: env.CLAUDE_MODEL ?? "sonnet",
      maxBudgetUsd: 0.5,
    }),
    policy: policyOf(),
    onRoute: (route: string, reason: string) =>
      stdout.write(`\n  [${route}: ${reason}]\n`),
  };
  const access = await createProvider(makeRouterBackend(parts)).access();
  if (access.kind !== "ready") {
    stdout.write(
      `not ready: ${access.kind}${access.kind === "unavailable" ? ` (${access.reason.kind})` : ""}\n`,
    );
    return;
  }
  const opened = await access.open({ system: "Answer briefly." });
  if (!opened.ok) {
    stdout.write(`open refused: ${opened.error.kind}\n`);
    return;
  }
  const session = opened.value;
  const rl = createInterface({ input: stdin, output: stdout });
  stdout.write(`policy=${parts.policy.kind}. Type a message, or /q to quit.\n`);
  // Iterated, not `question()` in a loop: a piped stdin closes the interface
  // at EOF before a second question can be asked, and `for await` drains the
  // lines it already holds and ends cleanly — in a terminal it is the same
  // prompt loop it always was.
  rl.setPrompt("> ");
  rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    if (line === "/q" || line === "") break;
    const started = await session.promptStream(line);
    if (!started.ok) {
      stdout.write(`  refused: ${started.error.kind}\n`);
      rl.prompt();
      continue;
    }
    const reader = started.value.getReader();
    try {
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        stdout.write(next.value);
      }
    } catch (error) {
      stdout.write(`\n  stream error: ${String(error)}`);
    }
    const usage = session.usage();
    stdout.write(
      `\n  (${usage.kind === "bounded" ? `${usage.used}/${usage.total}` : usage.kind})\n`,
    );
    rl.prompt();
  }
  rl.close();
  session.close();
};

void main();

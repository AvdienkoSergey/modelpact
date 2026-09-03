/**
 * A terminal chat over two models: Claude from `claude -p`, a local one from
 * Ollama, and a policy deciding which answers. `npm run chat`.
 *
 *   POLICY=predicate|escalate|classify   default classify
 *   LOCAL_MODEL=qwen3:14b                the local side
 *   JUDGE_MODEL=granite4:350m            the judge, classify only
 *   CLAUDE_MODEL=sonnet                  alias or id for the cloud side
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout, env } from "node:process";
import { makeOllamaProvider } from "modelpact";

import { makeClaudeCliProvider } from "./claude-cli.js";
import { orchestrate, type Policy } from "./orchestrate.js";

const policyOf = (): Policy => {
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
      return {
        kind: "classify",
        judge: makeOllamaProvider({
          model: env.JUDGE_MODEL ?? "granite4:350m",
        }),
      };
  }
};

const main = async (): Promise<void> => {
  const policy = policyOf();
  const chat = orchestrate({
    local: makeOllamaProvider({ model: env.LOCAL_MODEL ?? "qwen3:14b" }),
    cloud: makeClaudeCliProvider({
      model: env.CLAUDE_MODEL ?? "sonnet",
      maxBudgetUsd: 0.5,
    }),
    policy,
    system: "Answer briefly.",
    onRoute: (side, reason) => stdout.write(`\n  [${side}: ${reason}]\n`),
  });

  const rl = createInterface({ input: stdin, output: stdout });
  stdout.write(`policy=${policy.kind}. Type a message, or /q to quit.\n`);
  // Iterated, not `question()` in a loop: a piped stdin closes the interface at
  // EOF before a second question can be asked, and `for await` drains what it
  // holds and ends cleanly. In a terminal it is the same prompt loop.
  rl.setPrompt("> ");
  rl.prompt();
  for await (const raw of rl) {
    const line = raw.trim();
    if (line === "/q" || line === "") break;
    const started = await chat.askStream(line);
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
    stdout.write(`\n  (${chat.record().length} messages)\n`);
    rl.prompt();
  }
  rl.close();
  chat.close();
};

void main();

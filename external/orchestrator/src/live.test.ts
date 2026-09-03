/**
 * The real thing, when it is here: `claude` on PATH and a daemon on 11434.
 * Skips loudly otherwise. Prompts are one-liners and the cloud side is
 * capped, because this spends the account's own budget.
 */
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { createProvider, makeOllamaProvider } from "modelpact";

import { backendOf } from "./backend-of.js";
import { makeClaudeCliBackend } from "./claude-cli.js";
import { makeRouterBackend, type Route } from "./router.js";

const claudeHere =
  spawnSync("claude", ["--version"], { encoding: "utf8" }).status === 0;
const ollamaHere = await (async () => {
  try {
    const answer = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2_000),
    });
    return answer.ok;
  } catch {
    return false;
  }
})();

describe.skipIf(!claudeHere || !ollamaHere)(
  "live: claude -p and ollama under one router",
  () => {
    test("a predicate sends one turn each way and both answer", async () => {
      const routes: Route[] = [];
      const provider = createProvider(
        makeRouterBackend({
          local: backendOf(
            "ollama",
            makeOllamaProvider({ model: "granite4:350m" }),
          ),
          cloud: makeClaudeCliBackend({ model: "sonnet", maxBudgetUsd: 0.2 }),
          policy: {
            kind: "predicate",
            cloudWhen: (input) => input.startsWith("cloud:"),
          },
          onRoute: (route) => routes.push(route),
        }),
      );
      const access = await provider.access();
      expect(access.kind).toBe("ready");
      if (access.kind !== "ready") return;
      const opened = await access.open({
        system: "Answer in at most five words.",
      });
      if (!opened.ok) throw new Error(`open refused: ${opened.error.kind}`);
      const session = opened.value;

      const local = await session.prompt("Name the capital of France.");
      const cloud = await session.prompt("cloud: And of Italy?");
      expect(local.ok && local.value.length > 0).toBe(true);
      expect(cloud.ok && cloud.value.length > 0).toBe(true);
      expect(routes).toEqual(["local", "cloud"]);
      expect(session.history()).toHaveLength(4);
      session.close();
    }, 120_000);
  },
);

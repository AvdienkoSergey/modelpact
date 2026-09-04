import type { JsonSchema } from "./foundations.js";

/**
 * A function the model may call during a turn. Handed over in `ModelRequest`,
 * so it takes part in choosing the model and is loaded into the window at
 * open — both as the Prompt API spec has it.
 *
 * `execute` is run by whoever executes tools: the browser on the Prompt API,
 * the backend on Ollama. The signal is the turn's, and the backend supplies it
 * — the browser hands `execute` nothing but the arguments — so a tool that
 * listens to it stops when the turn is aborted. A throw or a rejection ends
 * the turn with `failed` naming the tool; a tool that wants the model to see
 * the problem and recover returns it as text.
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  /** The argument shape, shown to the model; a `JsonSchema` so a `Date` or a class cannot reach the platform. */
  readonly inputSchema: JsonSchema;
  readonly execute: (
    input: Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<string> | string;
}

/**
 * Running one tool under the turn's rules, shared by every backend that
 * executes tools itself.
 */

import { abortFailure } from "./abort.js";
import type { AiFailure } from "../types/failures.js";
import { err, ok, type Result } from "../types/foundations.js";
import type { Tool } from "../types/tools.js";

/** Read through a call: to the checker `signal.aborted` is a constant across an `await`, and it is not. */
const isAborted = (signal: AbortSignal): boolean => signal.aborted;

export const findTool = (
  tools: readonly Tool[],
  name: string,
): Tool | undefined => tools.find((candidate) => candidate.name === name);

/** A throw names the tool: the model asked for it, and the caller has to know which one broke. */
export const toolThrewFailure = (tool: Tool, error: unknown): AiFailure => {
  const message = error instanceof Error ? error.message : String(error);
  return {
    kind: "failed",
    detail: `tool "${tool.name}" threw: ${message}`,
    cause: error,
  };
};

/**
 * An abort is checked on both sides of `execute`: before, so an aborted turn
 * runs nothing, and after, because a tool that ignored the signal has still
 * produced an answer the turn must not use.
 */
export const runTool = async (
  tool: Tool,
  input: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Result<string, AiFailure>> => {
  if (isAborted(signal)) return err(abortFailure(signal));
  try {
    const toolText = await tool.execute(input, signal);
    return isAborted(signal) ? err(abortFailure(signal)) : ok(toolText);
  } catch (error) {
    return err(toolThrewFailure(tool, error));
  }
};

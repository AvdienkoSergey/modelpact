/**
 * The loop: ask, call a tool, feed the result back, ask again.
 *
 * Storey three, and thicker than the router that lived here before. The shape
 * is the one from HowProgrammingWorks/Agent — a step-limited loop, tool errors
 * returned to the model rather than thrown, results truncated before they are
 * fed back, an approval gate in front of anything that acts. What is different
 * is everything below the loop: that agent talks to one OpenAI-compatible
 * endpoint and reads native `tool_calls`; this one talks to whatever a `Brain`
 * is, and this contract has no tool protocol at all.
 *
 * So a call is a constrained answer instead. The contract does have schemas,
 * honoured or refused and never ignored, and a tool call is a shape. Where the
 * schema is honoured the model can only answer in it; where it is refused —
 * `claude -p` refuses, measured — the same question is asked in prose and the
 * object is read out of the text. The refusal is not an obstacle here, it is
 * the signal that picks the mode.
 */

import {
  jsonSchema,
  type AiFailure,
  type JsonSchema,
  type Result,
} from "modelpact";

import type { Brain } from "./brain.js";

export interface Tool {
  readonly name: string;
  readonly description: string;
  /** The argument shape, shown to the model in the prompt. */
  readonly parameters: JsonSchema;
  /** Denied unless `approve` says otherwise; the default answer is no. */
  readonly needsApproval?: boolean;
  readonly execute: (args: Record<string, unknown>) => Promise<string> | string;
}

export type ResultStatus = "ok" | "error" | "denied";

export type AgentEvent =
  | { readonly kind: "step"; readonly step: number; readonly maxSteps: number }
  | { readonly kind: "thought"; readonly step: number; readonly reason: string }
  | {
      readonly kind: "tool";
      readonly step: number;
      readonly name: string;
      readonly args: Record<string, unknown>;
    }
  | {
      readonly kind: "result";
      readonly step: number;
      readonly name: string;
      readonly status: ResultStatus;
      readonly preview: string;
    }
  | { readonly kind: "answer"; readonly step: number; readonly text: string };

export interface AgentParts {
  readonly brain: Brain;
  readonly tools: readonly Tool[];
  /** The loop is bounded, and running out is a failure with a reason, not a hang. */
  readonly maxSteps?: number;
  readonly instructions?: string;
  /**
   * A tool result longer than this is cut before it goes back to the model.
   * The default is small on purpose: the reference agent allows 60k characters
   * because it talks to a 200k-token cloud model, and one file read at that
   * size fills a 4096-token local window on its own.
   */
  readonly maxResultChars?: number;
  readonly approve?: (
    tool: Tool,
    args: Record<string, unknown>,
  ) => Promise<boolean> | boolean;
  readonly onEvent?: (event: AgentEvent) => void;
}

export interface AgentRun {
  readonly text: string;
  readonly steps: number;
  /** False when the brain refused the schema and the loop read prose instead. */
  readonly constrained: boolean;
}

const DEFAULTS = { maxSteps: 12, maxResultChars: 4_000 };

const INSTRUCTIONS =
  "You are a careful assistant with tools. Work in small steps: call one tool, read its result, then decide. Answer only when the task is done or cannot be done.";

/**
 * Every field is required, which is not tidiness.
 *
 * Under constrained decoding a model stops at what the schema demands, so an
 * optional `tool` is simply never emitted: `granite4:350m` answered
 * `{"action":"tool"}` with no tool name until all five were required, and then
 * answered `{"action":"tool","tool":"listFiles","args":{},"answer":""}`.
 * Measured on 2026-09-03, against `qwen3:14b` as the control.
 */
const STEP_SHAPE = {
  type: "object",
  properties: {
    reason: { type: "string" },
    action: { type: "string", enum: ["tool", "answer"] },
    tool: { type: "string" },
    args: { type: "object" },
    answer: { type: "string" },
  },
  required: ["reason", "action", "tool", "args", "answer"],
  additionalProperties: false,
};

const STEP_SCHEMA: JsonSchema = (() => {
  const built = jsonSchema(STEP_SHAPE);
  if (built === null) throw new Error("the step shape is not a schema");
  return built;
})();

interface Step {
  readonly reason: string;
  readonly action: "tool" | "answer";
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly answer: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asText = (value: unknown): string =>
  typeof value === "string" ? value : "";

const parseObject = (text: string): Record<string, unknown> | null => {
  try {
    return asRecord(JSON.parse(text));
  } catch {
    return null;
  }
};

/** Whole first, then the widest braces in it: prose mode wraps the object in words or a fence. */
const readObject = (text: string): Record<string, unknown> | null => {
  const whole = parseObject(text.trim());
  if (whole !== null) return whole;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return parseObject(text.slice(start, end + 1));
};

const readStep = (text: string): Step | null => {
  const held = readObject(text);
  if (held === null) return null;
  const action = held["action"];
  if (action !== "tool" && action !== "answer") return null;
  return {
    reason: asText(held["reason"]),
    action,
    tool: asText(held["tool"]),
    args: asRecord(held["args"]) ?? {},
    answer: asText(held["answer"]),
  };
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const truncate = (text: string, maxChars: number): string =>
  text.length <= maxChars
    ? text
    : `${text.slice(0, maxChars)}\n…[cut by the harness]`;

/** A refusal of the schema, as against a refusal of the question. */
const refusedTheSchema = (failure: AiFailure): boolean =>
  failure.kind === "unsupported-config" || failure.kind === "unsupported";

const describeTools = (tools: readonly Tool[]): string => {
  if (tools.length === 0) return "There are no tools. Answer directly.";
  const lines = tools.map(
    (tool) =>
      `- ${tool.name}: ${tool.description}\n  args: ${JSON.stringify(tool.parameters)}`,
  );
  return `Tools:\n${lines.join("\n")}`;
};

const SHAPE_REMINDER =
  'Answer with one JSON object and nothing else: {"reason": why, "action": "tool" or "answer", "tool": the name or "", "args": an object, "answer": the final text or ""}.';

const openingPrompt = (
  task: string,
  tools: readonly Tool[],
  instructions: string,
): string =>
  `${instructions}\n\n${describeTools(tools)}\n\n${SHAPE_REMINDER}\n\nTask: ${task}`;

const runTool = async (
  step: Step,
  parts: AgentParts,
): Promise<{ status: ResultStatus; rendered: string }> => {
  const tool = parts.tools.find((one) => one.name === step.tool);
  if (tool === undefined) {
    const names = parts.tools.map((one) => one.name).join(", ");
    return {
      status: "error",
      rendered: `ERROR: there is no tool called "${step.tool}". Tools: ${names}`,
    };
  }
  if (tool.needsApproval === true) {
    // No approver means no approval: a tool that says it needs one does not
    // get to act because nobody was there to say no.
    const approved = (await parts.approve?.(tool, step.args)) ?? false;
    if (!approved)
      return {
        status: "denied",
        rendered: "DENIED: the user did not approve this call.",
      };
  }
  try {
    const said = await tool.execute(step.args);
    return {
      status: "ok",
      rendered: truncate(said, parts.maxResultChars ?? DEFAULTS.maxResultChars),
    };
  } catch (error) {
    // Handed back rather than thrown: a model that is told what went wrong can
    // fix its arguments, and a thrown error ends a run that could have finished.
    return { status: "error", rendered: `ERROR: ${errorText(error)}` };
  }
};

export async function runAgent(
  parts: AgentParts,
  task: string,
): Promise<Result<AgentRun, AiFailure>> {
  const maxSteps = parts.maxSteps ?? DEFAULTS.maxSteps;
  const emit = (event: AgentEvent): void => parts.onEvent?.(event);
  let constrained = true;

  const think = async (input: string): Promise<Result<string, AiFailure>> => {
    if (constrained) {
      const asked = await parts.brain.ask(input, { schema: STEP_SCHEMA });
      if (asked.ok) return asked;
      if (!refusedTheSchema(asked.error)) return asked;
      // The contract's own answer, put to use: honoured or refused, never
      // ignored. Refused means ask again in prose and read the object out.
      constrained = false;
    }
    return parts.brain.ask(input);
  };

  let input = openingPrompt(
    task,
    parts.tools,
    parts.instructions ?? INSTRUCTIONS,
  );

  for (let step = 1; step <= maxSteps; step += 1) {
    emit({ kind: "step", step, maxSteps });
    const said = await think(input);
    if (!said.ok) return said;

    const decided = readStep(said.value);
    if (decided === null) {
      // A repair costs a step, which keeps the bound honest.
      input = `That was not the shape asked for. ${SHAPE_REMINDER}`;
      continue;
    }
    emit({ kind: "thought", step, reason: decided.reason });

    if (decided.action === "answer") {
      const text = decided.answer.trim();
      if (text === "") {
        input =
          'The answer was empty. Give the final text in "answer", or call a tool.';
        continue;
      }
      emit({ kind: "answer", step, text });
      return { ok: true, value: { text, steps: step, constrained } };
    }

    emit({ kind: "tool", step, name: decided.tool, args: decided.args });
    const outcome = await runTool(decided, parts);
    emit({
      kind: "result",
      step,
      name: decided.tool,
      status: outcome.status,
      preview: outcome.rendered.slice(0, 200),
    });
    // The contract carries user and assistant turns and nothing else, so a
    // tool result goes back as the next user message. That is the whole of the
    // mapping, and it is why no tool protocol was needed in the contract.
    input = `Result of ${decided.tool}:\n${outcome.rendered}\n\n${SHAPE_REMINDER}`;
  }

  return {
    ok: false,
    error: {
      kind: "failed",
      detail: `the agent did not finish within ${maxSteps} steps`,
    },
  };
}

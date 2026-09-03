/**
 * What the agent thinks with: a turn, and the record that turn joined.
 *
 * Two lines each, because the library already does the work. A session is one
 * model's; an orchestrator is two behind a policy. The loop above cares about
 * neither, only that asking a question appends a turn somewhere and the record
 * comes back.
 */

import type {
  AiFailure,
  AiMessage,
  AiSession,
  JsonSchema,
  Result,
} from "modelpact";

import type { Orchestrator } from "./orchestrate.js";

export interface AskOptions {
  /** Constrained decoding, honoured or refused; the agent reads the refusal and adapts. */
  readonly schema?: JsonSchema;
}

export interface Brain {
  readonly ask: (
    input: string,
    options?: AskOptions,
  ) => Promise<Result<string, AiFailure>>;
  readonly record: () => readonly AiMessage[];
}

export const makeSessionBrain = (session: AiSession): Brain => ({
  ask: (input, options) =>
    session.prompt(
      input,
      options?.schema === undefined ? {} : { schema: options.schema },
    ),
  record: () => session.history(),
});

export const makeChatBrain = (chat: Orchestrator): Brain => ({
  ask: async (input, options) => {
    const answerResult = await chat.ask(
      input,
      options?.schema === undefined ? {} : { schema: options.schema },
    );
    return answerResult.ok
      ? { ok: true, value: answerResult.value.text }
      : answerResult;
  },
  record: () => chat.record(),
});

/**
 * Stage four, once per turn: refuse at the door, hold the session, guard the
 * stream, record the turn, free the session.
 *
 * `prompt` is `promptStream` drained, unless the backend has a whole-answer
 * call. Either way a turn cannot leave the session held: every exit from the
 * guarded stream — done, error, abort, reader cancel — ends it.
 */

import { abortFailure } from "../helpers/abort.js";
import type { Generating, RunningTurn } from "../helpers/lifetime.js";
import { err, ok, type Result } from "../types/foundations.js";
import { AiError, failureFrom, type AiFailure } from "../types/failures.js";
import type { GenerateOptions } from "../types/session.js";
import type { GenerateRequest, Model } from "../types/backend.js";
import type { SessionState } from "./03_open.js";

interface StartedTurn {
  readonly turn: RunningTurn;
  readonly request: GenerateRequest;
}

interface TurnHooks {
  /** The source ran to its end; `answer` is every delta joined. */
  readonly finish: (answer: string) => void;
  /** The source was left before its end: error, abort or cancel. */
  readonly abandon: () => void;
}

/**
 * The one place a turn counts: the record and the meter move together, so a
 * turn that reached here is in both and one that did not is in neither.
 */
const completeTurn = (
  state: SessionState,
  input: string,
  answer: string,
): void => {
  state.transcript.append(input, answer);
  const usage = state.model.usage();
  state.events.report(usage);
};

const toGenerateRequest = (
  state: SessionState,
  signal: AbortSignal,
  options?: GenerateOptions,
): GenerateRequest => {
  const history = state.transcript.entries();
  return options?.schema === undefined
    ? { signal, history }
    : { signal, history, schema: options.schema };
};

const toFailure = (error: unknown): AiFailure =>
  error instanceof AiError ? error.failure : failureFrom(error);

const toAiError = (error: unknown): AiError =>
  error instanceof AiError ? error : new AiError(failureFrom(error));

/** Every refusal a generating call owes is `begin`'s to make; past it, the session is held. */
const startTurn = (
  state: SessionState,
  call: Generating,
  options?: GenerateOptions,
): Result<StartedTurn, AiFailure> => {
  const begun = state.lifetime.begin(call, options?.signal);
  if (!begun.ok) return begun;
  const turn = begun.value;
  const request = toGenerateRequest(state, turn.signal, options);
  return ok({ turn, request });
};

/** `cancel` on a source that already errored rejects, and there is nothing to do about that. */
const releaseReader = (reader: ReadableStreamDefaultReader<string>): void => {
  reader.cancel().catch(() => undefined);
};

/**
 * The backend's stream under the lifecycle's rules. An abort errors it with an
 * `AiError` — a reader has nowhere to put a Result — and so does anything the
 * source throws, mapped through `failureFrom`.
 */
const guardStream = (
  source: ReadableStream<string>,
  signal: AbortSignal,
  hooks: TurnHooks,
): ReadableStream<string> => {
  const reader = source.getReader();
  const parts: string[] = [];
  return new ReadableStream<string>({
    pull: async (controller) => {
      try {
        const next = await reader.read();
        if (signal.aborted) throw new AiError(abortFailure(signal));
        if (next.done) {
          hooks.finish(parts.join(""));
          controller.close();
          return;
        }
        parts.push(next.value);
        controller.enqueue(next.value);
      } catch (error) {
        hooks.abandon();
        releaseReader(reader);
        throw toAiError(error);
      }
    },
    cancel: (reason) => {
      hooks.abandon();
      return reader.cancel(reason);
    },
  });
};

const callGenerate = async (
  model: Model,
  input: string,
  request: GenerateRequest,
): Promise<Result<ReadableStream<string>, AiFailure>> => {
  try {
    return await model.generate(input, request);
  } catch (error) {
    return err(toFailure(error));
  }
};

const startStream = async (
  state: SessionState,
  call: Generating,
  input: string,
  options?: GenerateOptions,
): Promise<Result<ReadableStream<string>, AiFailure>> => {
  const started = startTurn(state, call, options);
  if (!started.ok) return started;
  const { turn, request } = started.value;
  const generated = await callGenerate(state.model, input, request);
  if (!generated.ok) {
    state.lifetime.end(turn);
    return generated;
  }
  // The token travels into the hooks, so a stream abandoned long ago cannot
  // end the turn running when its `cancel` finally arrives.
  const guarded = guardStream(generated.value, turn.signal, {
    finish: (answer) => {
      completeTurn(state, input, answer);
      state.lifetime.end(turn);
    },
    abandon: () => {
      state.lifetime.end(turn);
    },
  });
  return ok(guarded);
};

const drainStream = async (
  stream: ReadableStream<string>,
): Promise<Result<string, AiFailure>> => {
  const reader = stream.getReader();
  const parts: string[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return ok(parts.join(""));
      parts.push(next.value);
    }
  } catch (error) {
    return err(toFailure(error));
  }
};

const promptWhole = async (
  state: SessionState,
  generateWhole: NonNullable<Model["generateWhole"]>,
  input: string,
  options?: GenerateOptions,
): Promise<Result<string, AiFailure>> => {
  const started = startTurn(state, "prompt", options);
  if (!started.ok) return started;
  const { turn, request } = started.value;
  try {
    const answer = await generateWhole(input, request);
    if (!answer.ok) return answer;
    if (turn.signal.aborted) return err(abortFailure(turn.signal));
    completeTurn(state, input, answer.value);
    return answer;
  } catch (error) {
    return err(toFailure(error));
  } finally {
    state.lifetime.end(turn);
  }
};

export const prompt = async (
  state: SessionState,
  input: string,
  options?: GenerateOptions,
): Promise<Result<string, AiFailure>> => {
  const generateWhole = state.model.generateWhole;
  if (generateWhole !== undefined)
    return promptWhole(state, generateWhole, input, options);
  const started = await startStream(state, "prompt", input, options);
  if (!started.ok) return started;
  const answer = await drainStream(started.value);
  return answer;
};

export const promptStream = (
  state: SessionState,
  input: string,
  options?: GenerateOptions,
): Promise<Result<ReadableStream<string>, AiFailure>> =>
  startStream(state, "promptStream", input, options);

/**
 * Stage three: a connected model becomes an `AiSession` with the lifecycle's
 * closures on it. `SessionState` is what those closures share from here on.
 */

import { abortFailure } from "../helpers/abort.js";
import { ContextEvents, withEvents } from "../helpers/overflow.js";
import {
  createSessionLifetime,
  type SessionLifetime,
} from "../helpers/lifetime.js";
import { createTranscript, type Transcript } from "../helpers/transcript.js";
import { err, ok, type Fraction, type Result } from "../types/foundations.js";
import type { AiFailure } from "../types/failures.js";
import type { ModelRequest } from "../types/messages.js";
import type { AiSession, SessionOptions } from "../types/session.js";
import type { ModelConnection, ModelBackend } from "../types/backend.js";
import { prompt, promptStream } from "./04_generate.js";
import { closeSession } from "./05_close.js";

export interface SessionState {
  readonly model: ModelConnection;
  /** Idle, generating or closed, and the only way between the three. */
  readonly lifetime: SessionLifetime;
  readonly events: ContextEvents;
  /** Seeded from `options.history`; the backend got the same seed at `connect`. */
  readonly transcript: Transcript;
}

export const openSession = async (
  backend: ModelBackend,
  request: ModelRequest,
  options: SessionOptions | undefined,
  reportProgress: (loaded: Fraction) => void,
): Promise<Result<AiSession, AiFailure>> => {
  if (options?.signal?.aborted === true)
    return err(abortFailure(options.signal));

  const events = new ContextEvents();
  const modelResult = await backend.connect({
    request,
    session: options ?? {},
    reportProgress,
    reportOverflow: () => events.announce(),
  });
  if (!modelResult.ok) return modelResult;

  const state: SessionState = {
    model: modelResult.value,
    lifetime: createSessionLifetime(),
    events,
    transcript: createTranscript(options?.history),
  };
  const session = withEvents(events, {
    prompt: (input, generateOptions) => prompt(state, input, generateOptions),
    promptStream: (input, generateOptions) =>
      promptStream(state, input, generateOptions),
    usage: () => state.model.usage(),
    history: () => state.transcript.entries(),
    close: () => closeSession(state),
  });
  return ok(session);
};

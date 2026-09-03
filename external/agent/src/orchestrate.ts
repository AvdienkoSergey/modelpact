/**
 * Two models in one conversation, and a policy that picks between them.
 *
 * A consumer of `modelpact`, not an extension of it. The first version of this
 * file was a `ModelBackend` composed of two others, and every guarantee a
 * session makes leaked through it: a usage meter over two different windows, an
 * overflow event that means nothing for the side that did not fire it, an inner
 * session that had to be reopened to be told about turns it had not answered.
 * None of that was a hard problem badly solved. It was one storey too low.
 *
 * Up here nothing has to be forced. A session is one model's; this holds two of
 * them and a record of its own, and `open({ history })` — the door the contract
 * already has — is how a side is handed the conversation it missed.
 */

import type {
  AiFailure,
  AiMessage,
  AiProvider,
  AiSession,
  ContextUsage,
  GenerateOptions,
  ModelAccess,
  Result,
} from "modelpact";

export type Side = "local" | "cloud";

export type Policy =
  /** Decided from the input alone: length, a keyword, a marker of private data. */
  | {
      readonly kind: "predicate";
      readonly cloudWhen: (
        input: string,
        history: readonly AiMessage[],
      ) => boolean;
    }
  /**
   * The local side answers first, whole, and the answer is kept only if
   * `accept` says so. Nothing streams before the decision, because an answer
   * that is thrown away cannot be un-shown. That is the cost of the policy,
   * not a limitation of anything under it.
   */
  | { readonly kind: "escalate"; readonly accept: (answer: string) => boolean }
  /** A judge — meant to be a small local model — is asked with a schema which way to send the turn. */
  | {
      readonly kind: "classify";
      readonly judge: AiProvider;
      readonly brief?: string;
    };

export interface OrchestratorParts {
  readonly local: AiProvider;
  readonly cloud: AiProvider;
  readonly policy: Policy;
  /** Given to every session opened, on either side. */
  readonly system?: string;
  /** The conversation to start from, as `AiSession` takes one. */
  readonly history?: readonly AiMessage[];
  readonly onRoute?: (side: Side, reason: string) => void;
}

export interface Answer {
  readonly side: Side;
  readonly text: string;
  /** The answering side's own meter. Two models have two windows; there is no third. */
  readonly usage: ContextUsage;
}

export interface Orchestrator {
  /** The conversation both sides are part of, oldest first. */
  readonly record: () => readonly AiMessage[];
  readonly ask: (
    input: string,
    options?: GenerateOptions,
  ) => Promise<Result<Answer, AiFailure>>;
  /**
   * The same turn, in pieces. `escalate` cannot stream: it has to read the
   * local answer whole before it knows whether to keep it, so the accepted
   * answer arrives as one piece.
   */
  readonly askStream: (
    input: string,
  ) => Promise<Result<ReadableStream<string>, AiFailure>>;
  readonly close: () => void;
}

const ROUTE_BRIEF =
  "You route a user's message to one of two models. Answer local for greetings, small talk, simple factual questions, formatting and short tasks. Answer cloud for multi-step reasoning, long writing, code that must be correct, or anything where a mistake is costly.";

const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

const openOn = async (
  provider: AiProvider,
  history: readonly AiMessage[],
  system: string | undefined,
): Promise<Result<AiSession, AiFailure>> => {
  const access: ModelAccess = await provider.access();
  if (access.kind === "unavailable") return err(access.reason);
  const options = {
    history,
    ...(system === undefined ? {} : { system }),
  };
  // The download, if there is one, is the caller's to have consented to; a
  // second open finds it done.
  return access.kind === "ready"
    ? access.open(options)
    : access.open(() => undefined, options);
};

const drain = async (stream: ReadableStream<string>): Promise<string> => {
  const reader = stream.getReader();
  const parts: string[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) return parts.join("");
    parts.push(next.value);
  }
};

const oneMessage = (text: string): ReadableStream<string> =>
  new ReadableStream<string>({
    start: (controller) => {
      controller.enqueue(text);
      controller.close();
    },
  });

/**
 * One side's session, opened lazily and kept while it stays current.
 *
 * A model that keeps its own transcript is warm: reopening it costs the state
 * it built. So it is reopened only when the other side has spoken since, which
 * is the one case where its own idea of the conversation has gone stale. A
 * model with no memory does not care either way and is handed the record
 * every time by the same rule.
 */
class SideSession {
  readonly #provider: AiProvider;
  readonly #system: string | undefined;
  #session: AiSession | null = null;
  #seenTurns = 0;

  constructor(provider: AiProvider, system: string | undefined) {
    this.#provider = provider;
    this.#system = system;
  }

  /** Current when it has answered every turn in the record since it was opened. */
  async sessionFor(
    record: readonly AiMessage[],
  ): Promise<Result<AiSession, AiFailure>> {
    const held = this.#session;
    if (held !== null && this.#seenTurns === record.length) return ok(held);
    held?.close();
    const opened = await openOn(this.#provider, record, this.#system);
    if (!opened.ok) return opened;
    this.#session = opened.value;
    this.#seenTurns = record.length;
    return opened;
  }

  /** Told after a turn it answered, so the next one can reuse it. */
  answered(recordLength: number): void {
    this.#seenTurns = recordLength;
  }

  usage(): ContextUsage {
    return this.#session?.usage() ?? { kind: "unknown" };
  }

  close(): void {
    this.#session?.close();
    this.#session = null;
  }
}

class TwoModelChat implements Orchestrator {
  readonly #parts: OrchestratorParts;
  readonly #local: SideSession;
  readonly #cloud: SideSession;
  readonly #judge: SideSession | null;
  #record: readonly AiMessage[];

  constructor(parts: OrchestratorParts) {
    this.#parts = parts;
    this.#local = new SideSession(parts.local, parts.system);
    this.#cloud = new SideSession(parts.cloud, parts.system);
    this.#judge =
      parts.policy.kind === "classify"
        ? new SideSession(parts.policy.judge, undefined)
        : null;
    this.#record = [...(parts.history ?? [])];
  }

  readonly record = (): readonly AiMessage[] => this.#record;

  readonly ask = async (
    input: string,
    options?: GenerateOptions,
  ): Promise<Result<Answer, AiFailure>> => {
    const policy = this.#parts.policy;
    if (policy.kind === "escalate")
      return this.#escalate(input, policy.accept, options);
    const side = await this.#choose(input);
    return this.#turn(side, input, options);
  };

  readonly askStream = async (
    input: string,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    const policy = this.#parts.policy;
    // Whole first, then one piece: `escalate` has to see the answer to judge it.
    if (policy.kind === "escalate") {
      const answered = await this.#escalate(input, policy.accept);
      return answered.ok ? ok(oneMessage(answered.value.text)) : answered;
    }
    const side = await this.#choose(input);
    const sides = this.#sideOf(side);
    const session = await sides.sessionFor(this.#record);
    if (!session.ok) return session;
    const started = await session.value.promptStream(input);
    if (!started.ok) return started;
    return ok(this.#recordingStream(started.value, side, input, sides));
  };

  readonly close = (): void => {
    this.#local.close();
    this.#cloud.close();
    this.#judge?.close();
  };

  #sideOf(side: Side): SideSession {
    return side === "cloud" ? this.#cloud : this.#local;
  }

  #tell(side: Side, reason: string): Side {
    this.#parts.onRoute?.(side, reason);
    return side;
  }

  async #choose(input: string): Promise<Side> {
    const policy = this.#parts.policy;
    if (policy.kind === "predicate")
      return this.#tell(
        policy.cloudWhen(input, this.#record) ? "cloud" : "local",
        "predicate",
      );
    if (policy.kind !== "classify") return this.#tell("local", "no policy");
    return this.#askJudge(input, policy.brief ?? ROUTE_BRIEF);
  }

  /** The judge sees the message and nothing else: it decides where a turn goes, not what it says. */
  async #askJudge(input: string, brief: string): Promise<Side> {
    const judge = this.#judge;
    if (judge === null) return this.#tell("local", "no judge");
    const session = await judge.sessionFor([]);
    if (!session.ok)
      return this.#tell("local", `judge unavailable: ${session.error.kind}`);
    const asked = await session.value.prompt(
      `${brief}\n\nMessage:\n${input}\n\nAnswer with JSON: {"route":"local"} or {"route":"cloud"}.`,
    );
    if (!asked.ok)
      return this.#tell("local", `judge refused: ${asked.error.kind}`);
    const parsed: unknown = (() => {
      try {
        return JSON.parse(asked.value);
      } catch {
        return null;
      }
    })();
    const route = (parsed as { route?: unknown } | null)?.route;
    if (route === "cloud" || route === "local")
      return this.#tell(route, "judge");
    return this.#tell("local", "judge answered outside the shape");
  }

  async #turn(
    side: Side,
    input: string,
    options?: GenerateOptions,
  ): Promise<Result<Answer, AiFailure>> {
    const sides = this.#sideOf(side);
    const session = await sides.sessionFor(this.#record);
    if (!session.ok) return session;
    const answered = await session.value.prompt(input, options ?? {});
    if (!answered.ok) return answered;
    this.#append(input, answered.value, sides);
    return ok({ side, text: answered.value, usage: sides.usage() });
  }

  async #escalate(
    input: string,
    accept: (answer: string) => boolean,
    options?: GenerateOptions,
  ): Promise<Result<Answer, AiFailure>> {
    const first = await this.#turnUnrecorded("local", input, options);
    if (first.ok && accept(first.value)) {
      this.#tell("local", "accepted");
      this.#append(input, first.value, this.#local);
      return ok({
        side: "local",
        text: first.value,
        usage: this.#local.usage(),
      });
    }
    this.#tell(
      "cloud",
      first.ok ? "local answer rejected" : `local failed: ${first.error.kind}`,
    );
    return this.#turn("cloud", input, options);
  }

  /**
   * A turn whose answer may be thrown away, so it is not appended here. The
   * local session did append it to its own transcript; the next `sessionFor`
   * finds it stale against the record and reopens, which is the same rule that
   * carries a turn across sides.
   */
  async #turnUnrecorded(
    side: Side,
    input: string,
    options?: GenerateOptions,
  ): Promise<Result<string, AiFailure>> {
    const session = await this.#sideOf(side).sessionFor(this.#record);
    if (!session.ok) return session;
    return session.value.prompt(input, options ?? {});
  }

  /** The record grows only on a turn that was kept, and the answering side is current again. */
  #append(input: string, answer: string, sides: SideSession): void {
    this.#record = [
      ...this.#record,
      { role: "user", content: input },
      { role: "assistant", content: answer },
    ];
    sides.answered(this.#record.length);
  }

  #recordingStream(
    source: ReadableStream<string>,
    side: Side,
    input: string,
    sides: SideSession,
  ): ReadableStream<string> {
    const reader = source.getReader();
    const parts: string[] = [];
    return new ReadableStream<string>({
      pull: async (controller) => {
        const next = await reader.read();
        if (next.done) {
          // Completed turns only, as the session's own record does it.
          this.#append(input, parts.join(""), sides);
          this.#tell(side, "streamed");
          controller.close();
          return;
        }
        parts.push(next.value);
        controller.enqueue(next.value);
      },
      cancel: (reason) => reader.cancel(reason),
    });
  }
}

export function orchestrate(parts: OrchestratorParts): Orchestrator {
  return new TwoModelChat(parts);
}

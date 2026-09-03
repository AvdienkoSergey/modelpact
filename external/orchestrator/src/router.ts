/**
 * Two backends under one session, and a condition between them.
 *
 * The router is itself a `ModelBackend`. That is the point: composition needs
 * nothing from the lifecycle it does not already give every other backend —
 * the four answers, and `request.history` on every turn so that whichever side
 * answers sees the same conversation. Neither side keeps its own transcript;
 * the lifecycle keeps the one, and hands it to the side that speaks.
 *
 * Three ways to decide, as a union so a fourth is a new member and not a flag:
 * a predicate on the input, a local answer checked before it is kept, and a
 * small model asked which way to send it. The last one is two models
 * cooperating — the judge is a backend too.
 */

import {
  AiError,
  err,
  jsonSchema,
  ok,
  type AiFailure,
  type AiMessage,
  type Availability,
  type ConnectOptions,
  type ContextUsage,
  type GenerateRequest,
  type JsonSchema,
  type Model,
  type ModelBackend,
  type ModelRequest,
  type Result,
} from "modelpact";

export type Route = "local" | "cloud";

export type CloudWhen = (
  input: string,
  history: readonly AiMessage[],
) => boolean;

export type Policy =
  /** Decided from the input alone: length, a keyword, a marker of sensitive data. */
  | {
      readonly kind: "predicate";
      readonly cloudWhen: CloudWhen;
    }
  /**
   * The local side answers first, whole; the answer is kept when `accept` says
   * so and otherwise thrown away and the cloud asked instead. Nothing streams
   * before the decision, since a rejected answer cannot be un-shown.
   */
  | { readonly kind: "escalate"; readonly accept: (answer: string) => boolean }
  /**
   * A judge — any backend, meant to be a small local one — is asked with a
   * schema whether the turn is local or cloud. A judge that fails to answer in
   * the schema sends the turn local: the cheaper mistake.
   */
  | {
      readonly kind: "classify";
      readonly judge: ModelBackend;
      readonly brief?: string;
    };

export interface RouterParts {
  readonly local: ModelBackend;
  readonly cloud: ModelBackend;
  readonly policy: Policy;
  readonly name?: string;
  /** Told once per turn which way it went, and why in a few words. */
  readonly onRoute?: (route: Route, reason: string) => void;
}

const ROUTE_SCHEMA: JsonSchema = (() => {
  const built = jsonSchema({
    type: "object",
    properties: { route: { type: "string", enum: ["local", "cloud"] } },
    required: ["route"],
    additionalProperties: false,
  });
  // A literal written three lines up: null here is a typo in this file.
  if (built === null) throw new Error("route schema is not a schema");
  return built;
})();

const DEFAULT_BRIEF =
  "You route a user's message to one of two models. Answer local for greetings, small talk, simple factual questions, formatting and short tasks. Answer cloud for multi-step reasoning, long writing, code that must be correct, or anything where a mistake is costly.";

/** The worse of two answers: unavailable beats needs-download beats ready. */
const worseOf = (a: Availability, b: Availability): Availability => {
  if (a.kind === "unavailable") return a;
  if (b.kind === "unavailable") return b;
  if (a.kind === "needs-download" || b.kind === "needs-download") {
    const started =
      (a.kind === "needs-download" && a.started) ||
      (b.kind === "needs-download" && b.started);
    return { kind: "needs-download", started };
  }
  return { kind: "ready" };
};

const drain = async (
  model: Model,
  input: string,
  request: GenerateRequest,
): Promise<Result<string, AiFailure>> => {
  if (model.generateWhole !== undefined)
    return model.generateWhole(input, request);
  const started = await model.generate(input, request);
  if (!started.ok) return started;
  const reader = started.value.getReader();
  const parts: string[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return ok(parts.join(""));
      parts.push(next.value);
    }
  } catch (error) {
    return err(
      error instanceof AiError
        ? error.failure
        : { kind: "unknown", cause: error },
    );
  }
};

/** A whole answer, delivered in pieces: the contract's stream is a stream even when the text was decided at once. */
const streamOf = (text: string): ReadableStream<string> => {
  const pieces = text.match(/\S+\s*/g) ?? [text];
  let index = 0;
  return new ReadableStream<string>({
    pull: (controller) => {
      const piece = pieces[index];
      if (piece === undefined) {
        controller.close();
        return;
      }
      index += 1;
      controller.enqueue(piece);
    },
  });
};

interface Connected {
  readonly local: Model;
  readonly cloud: Model;
  readonly judge: Model | null;
}

class RouterModel implements Model {
  readonly #parts: RouterParts;
  readonly #sides: Connected;
  #last: Model;

  constructor(parts: RouterParts, sides: Connected) {
    this.#parts = parts;
    this.#sides = sides;
    this.#last = sides.local;
  }

  readonly generate = async (
    input: string,
    request: GenerateRequest,
  ): Promise<Result<ReadableStream<string>, AiFailure>> => {
    const policy = this.#parts.policy;
    if (policy.kind === "escalate")
      return this.#escalate(input, request, policy.accept);
    const chosen =
      policy.kind === "predicate"
        ? this.#byPredicate(input, request, policy.cloudWhen)
        : await this.#byJudge(input, request, policy.brief ?? DEFAULT_BRIEF);
    const model = chosen === "cloud" ? this.#sides.cloud : this.#sides.local;
    this.#last = model;
    return model.generate(input, request);
  };

  readonly usage = (): ContextUsage => this.#last.usage();

  readonly dispose = (): void => {
    this.#sides.local.dispose();
    this.#sides.cloud.dispose();
    this.#sides.judge?.dispose();
  };

  #tell(route: Route, reason: string): Route {
    this.#parts.onRoute?.(route, reason);
    return route;
  }

  #byPredicate(
    input: string,
    request: GenerateRequest,
    cloudWhen: CloudWhen,
  ): Route {
    const cloud = cloudWhen(input, request.history);
    return this.#tell(cloud ? "cloud" : "local", "predicate");
  }

  async #byJudge(
    input: string,
    request: GenerateRequest,
    brief: string,
  ): Promise<Route> {
    const judge = this.#sides.judge;
    if (judge === null) return this.#tell("local", "no judge");
    const question = `${brief}\n\nMessage:\n${input}\n\nReply as JSON.`;
    const verdict = await drain(judge, question, {
      signal: request.signal,
      history: [],
      schema: ROUTE_SCHEMA,
    });
    if (!verdict.ok)
      return this.#tell("local", `judge refused: ${verdict.error.kind}`);
    const parsed: unknown = (() => {
      try {
        return JSON.parse(verdict.value);
      } catch {
        return null;
      }
    })();
    const route = (parsed as { route?: unknown } | null)?.route;
    if (route === "cloud" || route === "local")
      return this.#tell(route, "judge");
    return this.#tell("local", "judge answered outside the schema");
  }

  async #escalate(
    input: string,
    request: GenerateRequest,
    accept: (answer: string) => boolean,
  ): Promise<Result<ReadableStream<string>, AiFailure>> {
    this.#last = this.#sides.local;
    const first = await drain(this.#sides.local, input, request);
    if (first.ok && accept(first.value)) {
      this.#tell("local", "accepted");
      return ok(streamOf(first.value));
    }
    this.#tell(
      "cloud",
      first.ok ? "local answer rejected" : `local failed: ${first.error.kind}`,
    );
    this.#last = this.#sides.cloud;
    return this.#sides.cloud.generate(input, request);
  }
}

const availabilityOf = async (
  parts: RouterParts,
  request: ModelRequest,
): Promise<Availability> => {
  const sides = [parts.local, parts.cloud];
  if (parts.policy.kind === "classify") sides.push(parts.policy.judge);
  const answers = await Promise.all(
    sides.map((side) => side.availability(request)),
  );
  return answers.reduce(worseOf);
};

const connectAll = async (
  parts: RouterParts,
  options: ConnectOptions,
): Promise<Result<Model, AiFailure>> => {
  const local = await parts.local.connect(options);
  if (!local.ok) return local;
  const cloud = await parts.cloud.connect(options);
  if (!cloud.ok) {
    local.value.dispose();
    return cloud;
  }
  let judge: Model | null = null;
  if (parts.policy.kind === "classify") {
    const opened = await parts.policy.judge.connect(options);
    if (!opened.ok) {
      local.value.dispose();
      cloud.value.dispose();
      return opened;
    }
    judge = opened.value;
  }
  return ok(
    new RouterModel(parts, { local: local.value, cloud: cloud.value, judge }),
  );
};

export function makeRouterBackend(parts: RouterParts): ModelBackend {
  return {
    name: parts.name ?? "router",
    // What both can take; text is all `AiMessage` carries anyway.
    modalities: parts.local.modalities.filter((one) =>
      parts.cloud.modalities.includes(one),
    ),
    availability: (request) => availabilityOf(parts, request),
    connect: (options) => connectAll(parts, options),
  };
}

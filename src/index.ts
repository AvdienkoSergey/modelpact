/**
 * The package: a contract for language-model backends, the lifecycle that
 * holds it, and one backend with nothing behind it.
 *
 * Three ways in. An app picks a provider and talks to a session — `AiSession`
 * and the failure vocabulary are the whole surface for that. An app that ships
 * several picks from its own registry. A backend author fills in `ModelBackend`
 * and hands it to `createProvider`, then proves it with `modelpact/testing`;
 * `modelpact/backend` is the door for that, and `modelpact-providers` is what
 * came through it.
 *
 * The one provider here has nothing behind it. It is the contract's fixture,
 * not a way to reach a model: every guarantee below is asserted against it on
 * every commit, and the transports that reach real models are their own
 * package for the same reason a policy is.
 */

export { createProvider } from "./providers/create.js";
export {
  defineProviders,
  findProviderName,
  type ProviderRegistry,
} from "./providers/registry.js";
export { makeMockProvider, type MockConfig } from "./providers/mock.js";

export type { AiProvider, ProviderName } from "./types/provider.js";
export type {
  AccessKind,
  AiSession,
  DownloadMonitor,
  GenerateOptions,
  ModelAccess,
  SessionOptions,
} from "./types/session.js";
export type {
  AiMessage,
  AiRole,
  Modality,
  ModalityExpectation,
  ModelRequest,
} from "./types/messages.js";
export type { Tool } from "./types/tools.js";
export {
  AiError,
  failureFromError,
  type AiFailure,
  type FailureKind,
} from "./types/failures.js";
export {
  contextUsage,
  type ContextUsage,
  type UsageKind,
} from "./types/usage.js";
export {
  err,
  fraction,
  jsonSchema,
  ok,
  tokens,
  type Fraction,
  type JsonSchema,
  type Result,
  type Tokens,
} from "./types/foundations.js";

// For writing a backend: the four answers, and the NDJSON reader a
// line-per-delta HTTP backend needs.
export type {
  Availability,
  ConnectOptions,
  GenerateRequest,
  ModelBackend,
  ModelConnection,
} from "./types/backend.js";
export { ndjsonLines } from "./helpers/ndjson.js";

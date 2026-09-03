/**
 * The package: a contract for language-model backends, the lifecycle that
 * holds it, and one backend with nothing behind it.
 *
 * Three ways in. An app picks a provider and talks to a session — `AiSession`
 * and the failure vocabulary are the whole surface for that. An app that ships
 * several picks from its own registry. A backend author fills in `ModelBackend`
 * and hands it to `createProvider`, then proves it with `modelpact/testing`.
 */

export { createProvider } from "./providers/create.js";
export {
  defineProviders,
  findProviderName,
  type ProviderRegistry,
} from "./providers/registry.js";
export { makeMockProvider, type MockConfig } from "./providers/mock.js";
export { makeOllamaProvider, type OllamaConfig } from "./providers/ollama.js";

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
export {
  AiError,
  failureFrom,
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
  Model,
  ModelBackend,
} from "./types/backend.js";
export { ndjsonLines } from "./helpers/ndjson.js";

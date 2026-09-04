/**
 * `modelpact/backend`: the door for whoever writes a transport.
 *
 * A backend answers four questions — `ModelBackend` — and hands them to
 * `createProvider`; the lifecycle does the rest. Everything a backend needs
 * to answer them is here and nothing an app needs is: the app's door is the
 * main entry, and a transport written against this one depends on one small
 * surface rather than on the whole package. The main entry keeps re-exporting
 * these names until the next major, so nothing already written breaks.
 */

export { createProvider } from "../providers/create.js";
export { ndjsonLines } from "../helpers/ndjson.js";
export { findTool, runTool, toolThrewFailure } from "../helpers/tools.js";
export {
  AiError,
  failureFromError,
  type AiFailure,
  type FailureKind,
} from "../types/failures.js";
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
} from "../types/foundations.js";
export {
  contextUsage,
  type ContextUsage,
  type UsageKind,
} from "../types/usage.js";
export type {
  Availability,
  ConnectOptions,
  GenerateRequest,
  ModelBackend,
  ModelConnection,
} from "../types/backend.js";
export type {
  AiMessage,
  AiRole,
  Modality,
  ModalityExpectation,
  ModelRequest,
} from "../types/messages.js";
export type { AiProvider, ProviderName } from "../types/provider.js";
export type { SessionOptions } from "../types/session.js";
export type { Tool } from "../types/tools.js";

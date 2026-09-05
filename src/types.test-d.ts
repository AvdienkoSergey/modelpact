// Type-level test for the contract in ./types.
//
// It is compiled, not run. Every line that must NOT compile carries a
// `@ts-expect-error`, and TypeScript reports `TS2578: Unused '@ts-expect-error'
// directive` when the expected error fails to appear — so the file builds
// exactly while each listed state stays unrepresentable. Loosen a type in
// ./types and the build breaks.
//
// It falls under the project tsconfig's `include`, so `npm run typecheck`
// checks it. Vitest deliberately misses it: `include` there is `*.test.ts`.
//
// Line breaks are semantics here: a directive covers the next line only, so an
// assertion Prettier splits across lines stops being covered. Those carry
// `// prettier-ignore`. The break is loud, not silent — it surfaces as TS2578.

import { jsonSchema, tokens } from "./types/foundations.js";
import type { AiMessage, ModelRequest } from "./types/messages.js";
import type { Tool } from "./types/tools.js";
import {
  contextUsage,
  type ContextUsage,
  type UsageKind,
} from "./types/usage.js";
import type { AiFailure, FailureKind } from "./types/failures.js";
import type {
  AccessKind,
  AiSession,
  DownloadMonitor,
  GenerateOptions,
  ModelAccess,
  SessionOptions,
} from "./types/session.js";
import type { AiProvider } from "./types/provider.js";
import { defineProviders, findProviderName } from "./providers/registry.js";

// --- 1. A session cannot be opened on an unavailable model ---
export async function openSession(
  access: ModelAccess,
): Promise<AiSession | null> {
  switch (access.kind) {
    case "unavailable": {
      // @ts-expect-error open does not exist in this branch
      await access.open();
      return null;
    }
    case "ready": {
      const sessionResult = await access.open();
      return sessionResult.ok ? sessionResult.value : null;
    }
    case "needs-download": {
      const sessionResult = await access.open((monitor) => {
        monitor.ondownloadprogress = (event) =>
          console.log(event.loaded / event.total);
      });
      return sessionResult.ok ? sessionResult.value : null;
    }
  }
  // No default branch on purpose: a fourth ModelAccess variant would leave a
  // path without a return, which noImplicitReturns catches.
}

// --- 2. A result cannot be used without handling the failure ---
export async function readAnswer(session: AiSession) {
  const answerResult = await session.prompt("hello");
  // @ts-expect-error value appears only after `ok` is checked
  answerResult.value.trim();
  return answerResult.ok ? answerResult.value.trim() : answerResult.error.kind;
}

// --- 3. Each failure carries only its own fields ---
// Also checks that narrowing on `kind` survives the `{ cause?: unknown } & (…)`
// intersection that factors out the shared cause.
export function describeFailure(failure: AiFailure): string {
  switch (failure.kind) {
    case "context-overflow":
      return failure.usage.kind;
    case "unsupported-config":
      return failure.languages.join(",");
    case "aborted":
      // @ts-expect-error languages exists only on unsupported-config
      return failure.languages.join(",");
    default:
      return failure.kind;
  }
}

// --- 4. An unbounded window cannot be subtracted from by accident ---
export function readRemaining(usage: ContextUsage): number {
  switch (usage.kind) {
    case "bounded":
      return usage.remaining;
    case "unbounded":
      // @ts-expect-error remaining does not exist in this branch, and cannot
      return usage.remaining;
    case "unknown":
      return 0;
  }
}
// A contradictory value cannot be built by hand either — not because
// used > total is rejected (types cannot say that), but because plain numbers
// are not Tokens, and the constructor is the only door in.
// prettier-ignore
// @ts-expect-error used and total are Tokens, plain numbers do not fit
export const bogusUsage: ContextUsage = { kind: "bounded", used: 100, total: 10, remaining: 0 };
export const honestUsage = contextUsage(tokens(100)!, 10); // the constructor computes remaining

// --- 5. A system turn cannot be smuggled into the history ---
export const sessionOptions: SessionOptions = {
  system: "you are an assistant",
  history: [{ role: "user", content: "hello" }],
};
// prettier-ignore
// @ts-expect-error there is no system role
export const smuggledSystemMessage: AiMessage = { role: "system", content: "you are an assistant" };
// An empty history is legal, and so is a plain mutable array — this is the case
// a NonEmpty tuple would have rejected, and the reason it is not used here.
declare const fromReactState: AiMessage[];
export const stateHistoryOptions: SessionOptions = { history: fromReactState };
export const emptyHistoryOptions: SessionOptions = { history: [] };
// This line would compile without exactOptionalPropertyTypes.
// @ts-expect-error an explicit undefined is not the same as an absent field
export const explicitUndefined: SessionOptions = { system: undefined };

// --- 6. A schema is not just any object ---
export const goodSchema: GenerateOptions = {
  schema: jsonSchema({ type: "object" })!,
};
// @ts-expect-error an object literal is not branded, and an array would not be either
export const badSchema: GenerateOptions = { schema: { type: "object" } };

// --- 7. Availability is asked for a specific request ---
// Regression guard: access() used to take no arguments, which made "is an image
// input available?" unaskable even though the answer depends on it.
export async function askAvailability(provider: AiProvider) {
  const access = await provider.access({
    inputs: [{ type: "image", languages: ["en"] }],
  });
  // @ts-expect-error "video" is not a modality
  await provider.access({ inputs: [{ type: "video" }] });
  return access.kind;
}

// --- 8. The provider list is the app's, and switches over it stay exhaustive ---
// A saved choice returns from storage as a string, and turning it back into a
// provider is a switch. The set it switches over is the app's registry, not a
// union in this package: a backend written elsewhere names itself. Add a member
// below without a branch and noImplicitReturns fails the build.
const unavailableProvider: AiProvider = {
  name: "stub",
  access: () =>
    Promise.resolve({ kind: "unavailable", reason: { kind: "unsupported" } }),
};
const PROVIDERS = defineProviders({
  "prompt-api": unavailableProvider,
  ollama: unavailableProvider,
});
type AppProvider = keyof typeof PROVIDERS;

export function getProviderLabel(providerName: AppProvider): string {
  switch (providerName) {
    case "prompt-api":
      return "built-in model";
    case "ollama":
      return "Ollama on localhost";
  }
}
// @ts-expect-error a typo is not a key of this registry
export const typo: AppProvider = "olama";
// @ts-expect-error a string from storage is not a name until the registry says so
export const uncheckedLabel: string = getProviderLabel(readSaved());

declare function readSaved(): string;

// The one way across: null when nobody registered it, a key when they did.
export function getChosenLabel(saved: string): string {
  const providerName = findProviderName(PROVIDERS, saved);
  return providerName === null ? "none" : getProviderLabel(providerName);
}

// --- 9. The stream stays a stream ---
// Not a prohibition but a presence check: these methods are why the contract
// returns a ReadableStream rather than a bare async iterable.
export async function readStream(session: AiSession) {
  const streamResult = await session.promptStream("hello");
  // Not failureFromError(r.error): that takes a thrown value and reads `error.name`,
  // so a well-formed AiFailure would come back as { kind: "unknown" }. The
  // signature `unknown -> AiFailure` accepts it, which is exactly the kind of
  // nonsense a type-level test cannot catch.
  if (!streamResult.ok) return streamResult.error;
  const [firstBranch, secondBranch] = streamResult.value.tee();
  await secondBranch.cancel(); // an unread branch must be dropped explicitly or it buffers in memory

  // A reader loop, not for await: stream async iteration is not everywhere, and
  // dom.asynciterable is left out of `lib` so the compiler rejects it here.
  const reader = firstBranch.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    console.log(value);
  }
  return null;
}

// --- 10. The monitor is the platform's, and ours passes for it ---
// `LanguageModel.create()` hands its own `CreateMonitor` to the `monitor`
// callback, and a backend on that platform can forward it instead of
// translating it — which is only true while ours is a supertype of theirs.
// `CreateMonitor` is ambient, from `@types/dom-chromium-ai` named in
// tsconfig's `types`, and this line is the only reason that package is still
// a dependency: it is the one place the two declarations meet.
export const platformMonitor = (monitor: CreateMonitor): DownloadMonitor =>
  monitor;

// --- 11. A kind alias names the set without closing it to literals ---
// Why these are type aliases and not enums: an enum member is a value, and a
// nominal one, so a caller's own "ready" would stop being assignable and the
// object behind it would reach their bundle. Derived is the other half — a
// variant added to the union is in the alias rather than forgotten here.
declare const openReady: Extract<ModelAccess, { kind: "ready" }>["open"];
export const asKind: AccessKind = "needs-download";
export const stillALiteral: ModelAccess["kind"] = asKind;
// @ts-expect-error a kind that no variant carries
export const notAKind: AccessKind = "downloading";
// @ts-expect-error the alias is the tag alone, not the variant it came from
export const notTheVariant: AccessKind = { kind: "ready", open: openReady };

// A Record over the set is the shape these exist for: leave a key out and the
// build names it.
export function getNotice(kind: FailureKind, usage: UsageKind): string {
  const usageNotices: Record<UsageKind, string> = {
    unknown: "no budget reported",
    unbounded: "no limit",
    bounded: "counting",
  };
  return `${kind}: ${usageNotices[usage]}`;
}

// --- 12. The record is a snapshot, not a handle ---
// `history()` is for persisting, not for editing the session through it:
// continuing a conversation goes through `open`, where the seed is checked.
export function persistRecord(session: AiSession): readonly AiMessage[] {
  const record = session.history();
  // @ts-expect-error the record is read-only
  record.push({ role: "user", content: "smuggled" });
  return record;
}

export function listenToMonitor(monitor: DownloadMonitor) {
  // @ts-expect-error `report` belongs to ProgressMonitor, not to the contract:
  // a caller listens, a provider reports.
  monitor.report(1);
  // addEventListener survives, untyped — the event arrives as a bare Event.
  monitor.addEventListener("downloadprogress", (event) =>
    console.log(event.type),
  );
  // @ts-expect-error and that is the point: loaded is not on Event
  monitor.addEventListener("downloadprogress", (e) => console.log(e.loaded));
}

// --- 13. A tool is a schema and a function, not a bag of fields ---
// `inputSchema` goes through the same door as `responseConstraint`: only a
// value the constructor has checked is a `JsonSchema`, so a `Date` or a class
// cannot reach the platform under that name.
export const lookupTool: Tool = {
  name: "lookupColour",
  description: "Return the colour recorded for an item name.",
  inputSchema: jsonSchema({ type: "object" })!,
  // Fewer parameters than the contract hands over is fine: a tool that never
  // looks at the signal is still a tool.
  execute: (input) => String(input.item),
};
// prettier-ignore
// @ts-expect-error an object literal is not a JsonSchema until the constructor said so
export const looseTool: Tool = { name: "x", description: "y", inputSchema: { type: "object" }, execute: () => "" };
// prettier-ignore
// @ts-expect-error a tool without execute is a description, not a tool
export const inertTool: Tool = { name: "x", description: "y", inputSchema: jsonSchema({})! };
export const requestWithTools: ModelRequest = { tools: [lookupTool] };
// The refusal a request with tools gets from a backend without them carries
// the field that says so, and only that variant carries it.
export function describeToolRefusal(failure: AiFailure): boolean {
  if (failure.kind === "unsupported-config") return failure.tools === true;
  // @ts-expect-error tools exists only on unsupported-config
  return failure.tools === true;
}

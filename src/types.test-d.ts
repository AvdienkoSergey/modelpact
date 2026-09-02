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

import { jsonSchema, tokens } from "./types/foundations.types.js";
import type { AiMessage } from "./types/messages.types.js";
import { contextUsage, type ContextUsage } from "./types/usage.types.js";
import type { AiFailure } from "./types/failures.types.js";
import type {
  AiSession,
  DownloadMonitor,
  GenerateOptions,
  ModelAccess,
  SessionOptions,
} from "./types/session.types.js";
import type { AiProvider, ProviderName } from "./types/providers.types.js";

// --- 1. A session cannot be opened on an unavailable model ---
export async function open(access: ModelAccess): Promise<AiSession | null> {
  switch (access.kind) {
    case "unavailable": {
      // @ts-expect-error open does not exist in this branch
      await access.open();
      return null;
    }
    case "ready": {
      const r = await access.open();
      return r.ok ? r.value : null;
    }
    case "needs-download": {
      const r = await access.open((monitor) => {
        monitor.ondownloadprogress = (e) => console.log(e.loaded / e.total);
      });
      return r.ok ? r.value : null;
    }
  }
  // No default branch on purpose: a fourth ModelAccess variant would leave a
  // path without a return, which noImplicitReturns catches.
}

// --- 2. A result cannot be used without handling the failure ---
export async function result(session: AiSession) {
  const r = await session.prompt("hello");
  // @ts-expect-error value appears only after `ok` is checked
  r.value.trim();
  return r.ok ? r.value.trim() : r.error.kind;
}

// --- 3. Each failure carries only its own fields ---
// Also checks that narrowing on `kind` survives the `{ cause?: unknown } & (…)`
// intersection that factors out the shared cause.
export function failure(f: AiFailure): string {
  switch (f.kind) {
    case "context-overflow":
      return f.usage.kind;
    case "unsupported-config":
      return f.languages.join(",");
    case "aborted":
      // @ts-expect-error languages exists only on unsupported-config
      return f.languages.join(",");
    default:
      return f.kind;
  }
}

// --- 4. An unbounded window cannot be subtracted from by accident ---
export function remaining(usage: ContextUsage): number {
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
export const bogus: ContextUsage = { kind: "bounded", used: 100, total: 10, remaining: 0 };
export const honest = contextUsage(tokens(100)!, 10); // the constructor computes remaining

// --- 5. A system turn cannot be smuggled into the history ---
export const options: SessionOptions = {
  system: "you are an assistant",
  history: [{ role: "user", content: "hello" }],
};
// prettier-ignore
// @ts-expect-error there is no system role
export const smuggled: AiMessage = { role: "system", content: "you are an assistant" };
// An empty history is legal, and so is a plain mutable array — this is the case
// a NonEmpty tuple would have rejected, and the reason it is not used here.
declare const fromReactState: AiMessage[];
export const fromState: SessionOptions = { history: fromReactState };
export const empty: SessionOptions = { history: [] };
// This line would compile without exactOptionalPropertyTypes.
// @ts-expect-error an explicit undefined is not the same as an absent field
export const undef: SessionOptions = { system: undefined };

// --- 6. A schema is not just any object ---
export const good: GenerateOptions = {
  schema: jsonSchema({ type: "object" })!,
};
// @ts-expect-error an object literal is not branded, and an array would not be either
export const bad: GenerateOptions = { schema: { type: "object" } };

// --- 7. Availability is asked for a specific request ---
// Regression guard: access() used to take no arguments, which made "is an image
// input available?" unaskable even though the answer depends on it.
export async function requested(provider: AiProvider) {
  const access = await provider.access({
    inputs: [{ type: "image", languages: ["en"] }],
  });
  // @ts-expect-error "video" is not a modality
  await provider.access({ inputs: [{ type: "video" }] });
  return access.kind;
}

// --- 8. The provider list is closed, and switches over it stay exhaustive ---
// This is what the union is for: a saved choice returns from storage as a
// string, and turning it back into a provider is a switch. Add a fourth member
// without a branch here and noImplicitReturns fails the build.
export function label(name: ProviderName): string {
  switch (name) {
    case "prompt-api":
      return "built-in model";
    case "ollama":
      return "Ollama on localhost";
    case "mock":
      return "mock";
  }
}
// @ts-expect-error a typo is not a provider name
export const typo: ProviderName = "olama";

// --- 9. The stream stays a stream ---
// Not a prohibition but a presence check: these methods are why the contract
// returns a ReadableStream rather than a bare async iterable.
export async function stream(session: AiSession) {
  const r = await session.promptStream("hello");
  // Not failureFrom(r.error): that takes a thrown value and reads `error.name`,
  // so a well-formed AiFailure would come back as { kind: "unknown" }. The
  // signature `unknown -> AiFailure` accepts it, which is exactly the kind of
  // nonsense a type-level test cannot catch.
  if (!r.ok) return r.error;
  const [a, b] = r.value.tee();
  await b.cancel(); // an unread branch must be dropped explicitly or it buffers in memory

  // A reader loop, not for await: stream async iteration is not everywhere, and
  // dom.asynciterable is left out of `lib` so the compiler rejects it here.
  const reader = a.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    console.log(value);
  }
  return null;
}

// --- 10. The monitor is the platform's, and ours passes for it ---
// `LanguageModel.create()` hands its own `CreateMonitor` to the `monitor`
// callback; because that object is a `DownloadMonitor`, the Prompt API provider
// forwards it instead of translating it. `CreateMonitor` is ambient, from
// `@types/dom-chromium-ai` named in tsconfig's `types`, so this line is the
// only place the two declarations meet.
export const platform = (monitor: CreateMonitor): DownloadMonitor => monitor;

export function listen(monitor: DownloadMonitor) {
  // @ts-expect-error `report` belongs to ProgressMonitor, not to the contract:
  // a caller listens, a provider reports.
  monitor.report(1);
  // addEventListener survives, untyped — the event arrives as a bare Event.
  monitor.addEventListener("downloadprogress", (e) => console.log(e.type));
  // @ts-expect-error and that is the point: loaded is not on Event
  monitor.addEventListener("downloadprogress", (e) => console.log(e.loaded));
}

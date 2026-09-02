# modelpact

**One way to talk to a local language model — the one built into the browser,
Ollama on your machine, or a mock in your tests. Swap the backend, keep the
code.**

## Why you'd want it

Chrome now ships a language model inside the browser. It runs on the user's
device: free, offline, private, no API key. For a web app that is the best deal
in AI — as long as your users are on Chrome.

Everyone else needs a fallback, and every fallback speaks its own dialect. A
different way to ask "are you available?", a different download story, different
errors, a different streaming format. Support two backends and you maintain two
integrations that share nothing.

modelpact is one dialect for all of them.

## What you get

**Swap backends with one line.** The provider is the only place a backend is
named. Everything after it is identical.

```ts
const provider = promptApi(); // Chrome's built-in model
const provider = ollama(); // …or a daemon on localhost
const provider = mock(); // …or nothing at all, in tests
```

**Failures that say what to do next.** No parsing exception names. Each failure
is a plain word with the data you need to act on it: `context-overflow` comes
with the usage so you can trim, `busy` tells you which call holds the session,
`unsupported-input` says what was wrong with your message.

**Bugs that don't compile.** You cannot open a session on a model that isn't
there — the method doesn't exist on that branch. You cannot read an answer
without handling the failure — the field isn't in the type. TypeScript catches
it before your users do.

**Download progress for free.** The first time a browser model is used, hundreds
of megabytes move. You get a progress event; your users get a bar instead of a
frozen page.

---

```
Here, you'll need to add commands to run the React app so that users can go through the onboarding process and see how easy and simple it all is.
```

---

**Tests that need no GPU.** The mock provider is a first-class backend. Your
suite runs on any CI box.

**Bring your own backend and prove it.** Wrote an adapter for something else?
Run it through the same conformance suite the built-in providers pass. If it's
green, it behaves like the others — not "probably", provably.

---

```
Here, we'll show how easy it is to add the built-in granite4:350m model—which is only 708 MB in size—that runs on WebGL, even offline, and doesn't require an internet connection.
```

---

## Quick start

```sh
npm install modelpact
```

```ts
import { promptApi } from "modelpact";

const access = await promptApi().access();
if (access.kind !== "ready") return; // unavailable, or needs a download first

const opened = await access.open({ system: "Answer in one sentence." });
if (!opened.ok) return;

const reply = await opened.value.prompt("What is this page about?");
console.log(reply.ok ? reply.value : reply.error.kind);
```

> **Early.** The contract and its type-level test are in; the providers and the
> conformance suite are not yet. The API above is what they are being built
> against — the shape is settled, the install is not.

---

## A Deep Dive for Techno-Geeks

`@types/dom-chromium-ai` follows the IDL, and the IDL is looser than
[the spec](docs/mdn/prompt_api/spec.md):
several states the algorithm rejects at runtime are writable in the types. A TS
error at the keyboard beats a `TypeError` in the browser, so
[`patches/@types+dom-chromium-ai+0.0.17.patch`](patches/@types+dom-chromium-ai+0.0.17.patch) closes the gap. |

The patch is applied by `patch-package` on `postinstall`. `skipLibCheck` is
deliberately **off** in `tsconfig.json`: these declarations are the only
third-party ones in the project, and type-checking them is how a patch that
stops applying cleanly gets caught.

## The contract

[`src/types`](src/types) is six files and no runtime dependencies. Each holds one
layer, and a fact lives on the type it is about: what a field means sits on the
type rather than at every place it is read, so go-to-definition walks the
reasoning instead of finding it restated.

| File                                         | Holds                                                            |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [`foundations.ts`](src/types/foundations.ts) | `Result`, and the branded `Tokens`, `Fraction`, `JsonSchema`.    |
| [`messages.ts`](src/types/messages.ts)       | `AiMessage`, `Modality`, `ModelRequest`.                         |
| [`usage.ts`](src/types/usage.ts)             | `ContextUsage` — unknown, unbounded or bounded.                  |
| [`failures.ts`](src/types/failures.ts)       | `AiFailure`, the mapping `failureFrom`, and `AiError`.           |
| [`session.ts`](src/types/session.ts)         | `AiSession`, `ModelAccess`, `DownloadMonitor`, the option types. |
| [`provider.ts`](src/types/provider.ts)       | `ProviderName`, `AiProvider`.                                    |

Four ideas carry the rest:

**Refusals are values.** `Result<T, AiFailure>` on the adapter boundary, so the
failure path is in the signature and cannot be skipped in silence. Inside a
provider's own implementation, exceptions are fine: `Result` spreads into every
signature it touches, and only the boundary is worth that cost.

**The failure vocabulary is cut by the caller's next move.** Not by exception
name. Kinds merge where the reaction would be the same and split where it
differs, even when the spec throws one exception for both — `unsupported-config`
(wrong environment) and `unsupported-input` (wrong message) are one
`NotSupportedError` upstream and two kinds here, because one is fixed by asking
for less and the other by sending something else.

**Mistakes are made unwritable, not guarded against.** `ModelAccess` carries
`open` only on the variants where opening can work, so "create a session on an
unavailable model" is not an error to check for at runtime — there is no
expression for it.

**A plain number is not a measurement.** `Tokens` and `Fraction` are separate
brands over `number`, because a ratio and a percentage (0.5 against 50) are both
numbers and swapping them is silent. A constructor that validates is the only way
in.

Four compiler flags beyond `strict` are load-bearing, `exactOptionalPropertyTypes`
most of all: without it `{ system: undefined }` passes as `SessionOptions`, and
every invariant that rests on an absent optional field falls apart.

### The types have their own test

[`src/types.test-d.ts`](src/types.test-d.ts) is compiled, never run. Every line
that must **not** compile carries a `@ts-expect-error`, and TypeScript reports
`TS2578: Unused '@ts-expect-error' directive` when the expected error fails to
appear. So the file builds exactly while each listed state stays
unrepresentable — loosen a type and the build breaks.

It covers ten of them:

1. A session cannot be opened on an unavailable model
2. A result cannot be used without handling the failure
3. Each failure carries only its own fields
4. An unbounded window cannot be subtracted from by accident
5. A system turn cannot be smuggled into the history
6. A schema is not just any object
7. Availability is asked for a specific request
8. The provider list is closed, and switches over it stay exhaustive
9. The stream stays a stream
10. The monitor is the platform's, and ours passes for it

It falls under the project tsconfig's `include`, so `npm run typecheck` checks
it. Vitest deliberately misses it — `include` there is `*.test.ts`.

## License

MIT

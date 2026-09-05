# modelpact

[![npm](https://img.shields.io/npm/v/modelpact)](https://www.npmjs.com/package/modelpact)
[![ci](https://github.com/AvdienkoSergey/modelpact/actions/workflows/ci.yml/badge.svg?event=pull_request)](https://github.com/AvdienkoSergey/modelpact/actions/workflows/ci.yml)
![dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen)
![min+gzip: 3.3 kB](https://img.shields.io/badge/min%2Bgzip-3.3%20kB-blue)
![types: TypeScript](https://img.shields.io/badge/types-TypeScript-3178c6)
![node: ≥22](https://img.shields.io/badge/node-%E2%89%A522-339933)
[![license: MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

**One way to talk to a language model — the one built into the browser, a
daemon on your machine, a cloud endpoint, or a mock in your tests. Swap the
backend, keep the code.**

## Why you'd want it

Every model speaks its own dialect. A different way to ask "are you available?",
a different download story, different errors, a different streaming format,
a different shape for a tool call. Support two of them and you maintain two
integrations that share nothing; support four and you maintain four.

modelpact is one dialect for all of them, and this package is only the dialect:
the contract, the lifecycle that holds it, and the suite that proves a backend
speaks it. The backends themselves live in
[modelpact-providers](https://github.com/AvdienkoSergey/modelpact-providers),
because a daemon's JSON and a browser's origin trial move on their own clocks
and neither should move a contract.

## What you get

**Swap backends with one line.** The provider is the only place a backend is
named. Everything after it is identical.

```ts
const provider = makePromptApiProvider(); // Chrome's built-in model
const provider = makeOllamaProvider({ model: "granite4:350m" }); // …or a daemon
const provider = makeOpenAiProvider({ baseUrl, apiKey }); // …or an endpoint
const provider = makeMockProvider(); // …or nothing at all, in tests
```

The first three are `modelpact-providers`; the last one is here, because a
contract needs a fixture more than it needs a transport.

**Failures that say what to do next.** No parsing exception names. Each failure
is a plain word with the data you need to act on it: `context-overflow` comes
with the usage so you can trim, `busy` tells you which call holds the session,
`unsupported-input` says what was wrong with your message.

**Bugs that don't compile.** You cannot open a session on a model that isn't
there — the method doesn't exist on that branch. You cannot read an answer
without handling the failure — the field isn't in the type. TypeScript catches
it before your users do.

**A conversation you can carry across a reload.** The session keeps the record:
what you handed it, then every completed turn. It lives in memory for one tab,
so storing it is yours — `localStorage`, IndexedDB, your server. Read it, store
it, hand it back to `open`, and the conversation continues where it was. An
aborted turn never gets in, so what you store is what the model actually saw.

**Download progress for free.** The first time a browser model is used, hundreds
of megabytes move. You get a progress event; your users get a bar instead of a
frozen page.

**Tests that need no GPU.** The mock provider is a first-class backend. Your
suite runs on any CI box.

**Bring your own backend and prove it.** Wrote an adapter for something else?
Run it through the same conformance suite the built-in providers pass. If it's
green, it behaves like the others — not "probably", provably.

## See it before you install it

[`demo/`](demo/) is one chat screen with a picker at the top, and there is
nothing behind any entry in it.

```sh
cd demo && npm install && npm run dev
```

| Pick            | What answers                                                      |
| --------------- | ----------------------------------------------------------------- |
| `mock`          | canned words, streamed one at a time                              |
| `mock-narrow`   | the same, on a 60-token window, so the overflow branch is a click |
| `mock-download` | the same, wanting weights first, so the consent branch is a click |

<p align="center">
  <img src="docs/screenshots/demo-overflow.png" width="49%" alt="The mock on a 60-token window: three turns in, the meter reads 140 / 60 and the overflow notice has fired once.">
  <img src="docs/screenshots/demo-chat.png" width="49%" alt="The demo mid-answer: words arriving one at a time and a Stop button in place of Send.">
</p>

That is deliberate. Every promise on this page is a promise the contract makes
whether a model answers or not: words arriving one at a time, a **Stop** that
leaves the session open, the interrupted answer gone from the record, a meter, a
chip per `AccessKind`, an overflow warning that fires once, a download bar that
waits to be asked, a tool called inside a turn, and a conversation that survives
a reload and stays in step across two tabs. Seven Playwright specs drive it in
Chromium, and every one of them runs on any machine — no daemon, no browser
model, no GPU.

A picker with real models behind it is
[modelpact-providers](https://github.com/AvdienkoSergey/modelpact-providers)'
demo, and it is a different claim: that four transports answer the same way.
This one is the claim underneath it.

## The step, and what stands on it

Talking to a model has three storeys. A transport reaches **one model**. A
session holds **one conversation** with it and carries the guarantees — one
generation at a time, an abort that leaves the session open, an overflow that
fires once, a close that refuses everything after it. Above that, several
models, a policy, a loop over turns: orchestration.

modelpact is the middle storey, and it is deliberately only that.

| Storey        | What lives there                      | Where                                                                                                                                                    |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transport     | one model, four answers               | [modelpact-providers](https://github.com/AvdienkoSergey/modelpact-providers), or your own                                                                |
| session       | one conversation, the guarantees      | **this package**, and nothing above it                                                                                                                   |
| orchestration | several models, a policy, a tool loop | [modelpact-orchestrator](https://github.com/AvdienkoSergey/modelpact-orchestrator), [modelpact-agent](https://github.com/AvdienkoSergey/modelpact-agent) |

Each storey is a repository, and each one is a stranger to this package: it
depends on `modelpact` from npm, through the `exports` map, with no path into
`src/`. That is not tidiness. Whatever the published API is not enough for
shows up out there first, and three times now it has:

**A transport found a hole in the types.** The WebGPU backend is a model in the
tab through `@mlc-ai/web-llm`, and it compiled here and broke there: a
published type named `LanguageModel`, an ambient global from a dev dependency
nobody downstream receives. The same suite then caught the backend erroring its
own stream on abort, which lands in `unknown` instead of `aborted`. Both fixed,
both guarded, and the guard — the emitted `.d.ts` read with `types: []` — is
now the first check in every package built on this one.

**A policy found the storey.** The orchestrator's first version was a
`ModelBackend` composed of two, and it passed the conformance suite while every
guarantee leaked: a meter over two windows, an overflow that meant nothing for
the other side. Rebuilt one storey up it needed **nothing new from the
package** — `open({ history })` was already the door for handing a side the
turns it missed. That is the test of whether a storey is right.

**A loop found the missing protocol.** The agent faked tool calls with a
constrained schema, because this contract had none. It worked, and it cost two
model calls per tool and a record that called a tool result a user turn — while
Ollama was returning native calls and the Prompt API spec was taking `tools` at
`create`. Tools are in `ModelRequest` now, executed inside the turn, refused by
name where a backend has no protocol. See [Tools](#tools).

What is not here — storage, a router, a third role — is not missing; it lives
upstairs. The next transport is an afternoon and a green suite. The next policy
or loop is a consumer, not a feature.

## Quick start

```sh
npm install modelpact
```

```ts
import { makeMockProvider } from "modelpact";

const access = await makeMockProvider().access();
if (access.kind !== "ready") return; // unavailable, or needs a download first

const opened = await access.open({ system: "Answer in one sentence." });
if (!opened.ok) return;

const reply = await opened.value.prompt("What is this page about?");
console.log(reply.ok ? reply.value : reply.error.kind);
```

Swap `makeMockProvider` for any other provider and nothing below it changes.
That is the whole point of the line.

> **What is in.** The contract, its type-level test, the lifecycle, the
> conformance suite, tools, and one backend with nothing behind it. Everything
> a backend needs is exported at `modelpact/backend`, and four transports, an
> orchestrator and an agent have been written outside the package on exactly
> that — see [The step, and what stands on it](#the-step-and-what-stands-on-it).

### Bring your own backend

A backend answers four questions. The lifecycle does the rest — one generation
at a time, an abort that leaves the session open, an overflow that fires once, a
close that refuses everything after it.

```ts
import { createProvider, ok, type ModelBackend } from "modelpact/backend";

const backend: ModelBackend = {
  name: "echo",
  modalities: ["text"],
  availability: () => ({ kind: "ready" }),
  connect: () => Promise.resolve(ok(model)), // your `generateStream`, `usage`, `dispose`
};

export const echo = createProvider(backend);
```

Then prove it behaves like the others:

```ts
import { describeContract } from "modelpact/testing";

describeContract("echo", () => echo);
```

`modelpact/backend` is the door for a transport author: the four answers, the
helpers that fill them — `createProvider`, `ndjsonLines`, `runTool` — and the
types they name, and nothing an app reaches for. A backend written against it
depends on that small surface rather than on the whole package; every backend
outside this repo does, and their surface guards read this entry with `types`
empty. The main entry keeps re-exporting the same names until the next major.

`modelpact/testing` needs `vitest`, which is an optional peer dependency: an app
that only consumes a provider never loads it.

A backend whose transport executes tools says `tools: true`, and the suite's
tool assertions then run against it; one that does not is refused for a request
carrying tools before its `availability` is asked, and the suite checks that
refusal instead.

### Tools

A tool is a name, a description, a `JsonSchema` for its arguments and an
`execute`. It is part of the request, because it takes part in choosing the
model and is loaded into the window at open — both as the Prompt API spec has
it. The backend or the platform calls `execute` inside the turn; `prompt`
returns the final text.

```ts
const lookupColour: Tool = {
  name: "lookupColour",
  description: "Return the colour recorded for an item name.",
  inputSchema: jsonSchema({
    type: "object",
    properties: { item: { type: "string" } },
    required: ["item"],
  })!,
  execute: ({ item }, signal) => colours.get(String(item)) ?? "unknown",
};

const access = await provider.access({ tools: [lookupColour] });
```

What the session promises while a tool runs is what it promises anyway, held
for the whole turn: a second `prompt` gets `busy`; an abort reaches `execute`
through the signal it is handed, and fails the turn with `aborted`; a tool that
throws fails the turn with `failed` naming the tool, and the session stays
open. A tool that wants the model to see a problem and recover returns it as
text.

A refusal comes in two places, and a loop above has to expect both. A backend
without a protocol answers `unavailable` at `access`, with `tools: true` in the
`unsupported-config` reason. A backend with one can still fail at `open`:
Chrome 152 does — `availability()` says `available` with tools and `create()`
throws `InvalidStateError`, measured — and that lands as `invalid-state` from
`open`. Either way the move is the same: ask again without tools, and read the
call out of a schema-constrained answer, which is what
[modelpact-agent](https://github.com/AvdienkoSergey/modelpact-agent) already
does.

`modelpact/tools` is a third entry, and what it holds is the fixture: a mock
tool, the counterpart of the mock provider. Words in, words out, a record of
every call, and a `reply` that can throw to stage a tool that breaks. The demo
runs its "Read the page" scene on it, and a suite that needs a call to have
happened opens a session with it. Tools that read a real page are a package
of their own, the way real transports are.

Tools cost window. Measured on Ollama across three models, one tool with a
one-sentence description and a few parameters is about 50 tokens, plus 100 to
200 for the preamble, and on Gemini Nano the window is 9 216. Eight tools are
five per cent of it; thirty-two are a fifth. A stateless transport resends them
every turn; the Prompt API loads them once. How many rounds one turn may take
before it is failed is the backend's to bound, because a small model asked for
the same listing until something stopped it.

### Several backends in one app

The list of names belongs to the app, not to this package — a backend written
elsewhere names itself. Your registry is where the set is known, so a switch over
it stays exhaustive and a string out of storage cannot pretend to be a name.

```ts
import { defineProviders, findProviderName } from "modelpact";

const PROVIDERS = defineProviders({ echo, mock: makeMockProvider() });

const name = findProviderName(
  PROVIDERS,
  localStorage.getItem("provider") ?? "",
);
const provider = name === null ? null : PROVIDERS[name];
```

## Status

**Versioned, and released by machine.** Semantic versioning from conventional
commits: [release-please](https://github.com/googleapis/release-please) opens
the release PR, [`CHANGELOG.md`](CHANGELOG.md) is written from the history, and
the tagged tree is what `npm publish` builds. A `!` in a commit is a major, and
2.0 was one — four public names changed for the better, and the changelog says
which.

**Published without a key.** npm trusts this repository and this workflow file
by name, so the release job signs in with its own OIDC identity and a
credential that lives for one publish. There is no long-lived token to leak,
and every version carries a
[provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
saying which commit and which workflow built it.

**Small on purpose.** ESM only, zero runtime dependencies, and the whole entry
is 8.4 kB minified, 3.3 kB gzipped — it lost two thirds of its weight the day
the transports moved out, which is the clearest thing anyone can say about what
a contract costs. `modelpact/testing`, `modelpact/tools` and
`modelpact/backend` are separate entries, so an app that only consumes a
provider loads none of them.

**Where it runs.** Node ≥ 22 and any current browser: nothing here names a
platform, and the one backend in it has nothing behind it. What a transport
needs of a runtime is that transport's business. The published declarations are
checked from outside by every package built on this one, with `skipLibCheck`
off and `types: []` — if a `.d.ts` ever names a global you do not have, that
build goes red before yours does.

**What a pull request has to pass.** Typecheck, lint, format, the vitest suites
and seven Playwright specs in Chromium, on every change, in one run. Every one
of them runs on a machine with no model on it, which is why this repository's
CI has no daemon in it and no browser weights to cache.

**Next.** A record that can hold a tool turn. `AiMessage` is a role and a
string, so a session opened with tools answers correctly and then remembers the
conversation without the calls in it — hand that record back to `open` and the
tool turns are gone. The spec solves it by making `content` a list of parts,
`tool-call` and `tool-response` among them, and that is the same door image and
audio will want. It is a major, and it is the next one.

---

## A Deep Dive for Techno-Geeks

Zero runtime dependencies, and one dev dependency that is not a tool:
`@types/dom-chromium-ai`. It is here for a single line —
[`src/types.test-d.ts`](src/types.test-d.ts) proves that the browser's own
`CreateMonitor` satisfies this contract's `DownloadMonitor`, which is what lets
a backend on that platform forward the object instead of translating it. The
[vendored spec](docs/mdn/prompt_api/spec.md) beside it is where the failure
vocabulary came from: kinds are cut by the caller's next move, and reading the
algorithm is how the cuts were chosen.

## The contract

[`src/types`](src/types) is eight files and no runtime dependencies. Each holds one
layer, and a fact lives on the type it is about: what a field means sits on the
type rather than at every place it is read, so go-to-definition walks the
reasoning instead of finding it restated.

| File                                         | Holds                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| [`foundations.ts`](src/types/foundations.ts) | `Result`, and the branded `Tokens`, `Fraction`, `JsonSchema`.                     |
| [`messages.ts`](src/types/messages.ts)       | `AiMessage`, `Modality`, `ModelRequest`.                                          |
| [`usage.ts`](src/types/usage.ts)             | `ContextUsage` — unknown, unbounded or bounded — and `UsageKind`.                 |
| [`failures.ts`](src/types/failures.ts)       | `AiFailure` and `FailureKind`, the mapping `failureFromError`, `AiError`.         |
| [`session.ts`](src/types/session.ts)         | `AiSession`, `ModelAccess` and `AccessKind`, `DownloadMonitor`, the option types. |
| [`provider.ts`](src/types/provider.ts)       | `ProviderName`, `AiProvider`.                                                     |
| [`backend.ts`](src/types/backend.ts)         | `ModelBackend`, `ModelConnection` — the four answers a provider supplies.         |
| [`tools.ts`](src/types/tools.ts)             | `Tool` — a name, a description, a schema and an `execute`.                        |

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

**A tag is a string, not an enum.** Every union here is discriminated by a
`kind`, and `AccessKind`, `FailureKind` and `UsageKind` name those sets for a
`Record` or a signature. They are derived aliases, so a new variant is in them
already, and they stay types: `"ready"` still passes where one is asked for, and
nothing of them reaches your bundle. An enum member would be a value, and a
nominal one — your own `"ready"` would stop being assignable to ours.

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

It covers thirteen of them:

1. A session cannot be opened on an unavailable model
2. A result cannot be used without handling the failure
3. Each failure carries only its own fields
4. An unbounded window cannot be subtracted from by accident
5. A system turn cannot be smuggled into the history
6. A schema is not just any object
7. Availability is asked for a specific request
8. The provider list is the app's, and switches over it stay exhaustive
9. The stream stays a stream
10. The monitor is the platform's, and ours passes for it
11. A kind alias names the set without closing it to literals
12. The record is a snapshot, not a handle
13. A tool is a schema and a function, not a bag of fields

It falls under the project tsconfig's `include`, so `npm run typecheck` checks
it. Vitest deliberately misses it — `include` there is `*.test.ts`.

## Contributing

A backend is the most useful thing to bring: four answers, `createProvider`,
and `describeContract` green. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the
setup, every check CI runs and how to run it first, the commit convention, the
two rules the conformance suite will otherwise find for you, and where a change
belongs among the three storeys.

[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) is the short version of be decent.
[`SECURITY.md`](SECURITY.md) is how to report a vulnerability privately, and
what this package does and does not do with what a model says.

## License

[MIT](LICENSE)

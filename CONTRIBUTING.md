# Contributing

The most useful thing you can bring is **a backend**. The second is a case the
contract gets wrong. Both are below.

## Getting set up

```sh
git clone https://github.com/AvdienkoSergey/modelpact
cd modelpact
npm ci            # runs `prepare`, which is patch-package — see the README
npm test
```

Node 22 or newer, which is what [`.nvmrc`](.nvmrc) says and what CI installs.

## What CI runs, and how to run it first

CI is the reviewer that has to say yes before a human looks. All of it runs
locally, and none of it needs a GPU:

```sh
npm run typecheck   # the package, and e2e's own tsconfig
npm run lint
npm run format:check
npm test            # vitest: the unit suites and the contract suite
npm run test:e2e    # Playwright in Chromium; the demo server starts itself
npm run demo:check  # the demo has its own tsconfig and is outside eslint

npm run external               # the WebGPU backend, written from outside
npm run external:orchestrator  # two models and a policy
npm run external:agent         # a tool-calling loop
npm run external:surface       # the published .d.ts, read as a stranger reads it
```

The last one is worth understanding before you change a public type: it
compiles every exported name with `skipLibCheck` off and `types: []`, so a
declaration that names a global a consumer does not have fails there rather
than in someone's build.

## Commits

[Conventional commits](https://www.conventionalcommits.org) — release-please
reads them to decide the next version and to write
[`CHANGELOG.md`](CHANGELOG.md). `feat:` is a minor, `fix:` a patch, and a `!`
after the type is a major:

```
feat(providers): an OpenAI-compatible backend
fix(lifecycle): a cancelled reader no longer frees the next turn
refactor!: name the connection a connection
```

The subject is a sentence about what changed for the reader, not a label. The
body is where the reason goes, and it is worth writing: this repository's
history is meant to be readable a year later.

## Naming, because it is a house style here

Names carry the reading load, so they follow a small vocabulary: verb + noun
for what runs (`readUsage`, `makeStubbedProvider`, `toEndpoint`), adjective +
noun for what is held (`seenProgress`, `parsedLine`, `answerParts`), `is`/`has`
for booleans, and a `Result` suffix wherever a value is a `Result` — so the
failure branch below it is visible before you read the body. One word means
one thing per file.

## Bringing a backend

A backend answers four questions, and the lifecycle supplies every guarantee
around them:

```ts
import { createProvider, ok, type ModelBackend } from "modelpact";

const backend: ModelBackend = {
  name: "yours",
  modalities: ["text"],
  availability: () => ({ kind: "ready" }),
  connect: () => Promise.resolve(ok(connection)),
};
```

Then prove it behaves like the others:

```ts
import { describeContract } from "modelpact/testing";

describeContract("yours", () => createProvider(backend));
```

Two rules that the suite will find for you, and that are easier to know first:

- **Do not police the abort yourself.** The lifecycle checks the signal around
  every read and errors the stream in the vocabulary. A backend that races it
  with a plain `Error` lands in `unknown` instead of `aborted`.
- **A `pull` must make progress.** Enqueue, close, or throw before returning —
  a pull that comes back empty-handed is not called again unless a read
  arrived meanwhile, and two content-free chunks in a row will stall a stream.
  Both sibling packages hit this.

If the backend needs an API the package does not export, that is worth an
issue on its own — it is the kind of gap `external/` exists to find.

## Where a change belongs

Three storeys, and the answer to "should this go in the library" is usually
"which storey is it":

| Storey        | What lives there                      | Where it goes                |
| ------------- | ------------------------------------- | ---------------------------- |
| transport     | one model, four answers               | a `ModelBackend`             |
| session       | one conversation, the guarantees      | this package                 |
| orchestration | several models, a policy, a tool loop | a consumer — see `external/` |

A router that picks between two models is not a backend, however well it fits
the slot: it was tried, it passed the suite, and every guarantee leaked. That
story is in [`external/orchestrator`](external/orchestrator/README.md) and it
is the shortest way to understand where the line is.

## Pull requests

One change per pull request, against `main`. Say what a reader gets that they
did not have before, and what you measured. A behaviour change wants a test
that goes red without it — the contract suite is the right place when the
behaviour is one the contract promises.

Comments in this codebase carry facts the code cannot state: why a shape is
what it is, what was measured, what was tried and abandoned. Restating what
the line already says is the one comment style that gets asked about in
review.

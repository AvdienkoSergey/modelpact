# The demo

A chat on the mock provider. There is no model behind it: the answers are
canned and streamed one word at a time, which is enough to show everything the
contract promises and nothing else.

```sh
npm install   # in this directory, once
npm run dev
```

## What it is here to show

| On screen                        | In the library                                                |
| -------------------------------- | ------------------------------------------------------------- |
| Words arriving one at a time     | `promptStream` and a reader loop                              |
| **Stop** halfway through         | `signal`, and a session that is still open afterwards         |
| The interrupted answer vanishing | only completed turns reach `session.history()`                |
| The meter beside the picker      | `session.usage()`                                             |
| The chip beside it               | `AccessKind`, one line per branch of `ModelAccess`            |
| "The conversation outgrew…"      | `oncontextoverflow`, fired once, on the narrow-window backend |
| The progress line on first open  | the `needs-download` branch and its monitor                   |
| Reload, and it is still there    | `session.history()` out, `open({ history })` back in          |
| A second tab staying in step     | the `storage` event, not a library feature                    |
| The `ollama` entry answering     | a real model, through the same session as the three mocks     |
| "Download them" before a fetch   | the `needs-download` branch, not opened unasked               |
| The `prompt-api` entry           | Chrome's own model, mapped by the same four answers           |
| The `webgpu` entry               | a backend from another package, installed like any other      |

The picker holds six entries of one registry. Three are the mock with
different settings; the others are Ollama, Chrome's built-in model, and a
WebGPU backend from [`external/webgpu-provider`](../external/webgpu-provider),
which this app depends on the way it would on any package from npm. Each was
one line in [`src/providers.ts`](src/providers.ts) and nothing anywhere else.
That is the claim the rest of this app exists to make honest.

The Ollama entry wants a daemon on `127.0.0.1:11434` holding `granite4:350m`.
Without one it answers `unavailable` and the chip says so, which is the branch
the three mocks cannot stage.

The Chrome entry needs no configuring. What it usually lands on is
`needs-download`, and that branch is not opened for you: Gemini Nano is
gigabytes, and a dropdown is not consent. The button is. The WebGPU entry sits
behind the same button, for a few hundred megabytes of its own.

## Where the interesting parts are

- [`src/useChat.ts`](src/useChat.ts) — every call into the library. A session is
  a resource, so it lives in a ref and is closed by the effect that opened it.
- [`src/storage.ts`](src/storage.ts) — the part the library deliberately does
  not do. The record it hands out is plain `{ role, content }` objects, so
  storing it is `JSON.stringify` and nothing more.
- [`src/providers.ts`](src/providers.ts) — the registry, and the exhaustive
  switch its keys buy.
- [`src/App.tsx`](src/App.tsx) — three `Record`s keyed by `AccessKind`,
  `FailureKind` and `UsageKind`. The middle one is the reason those aliases
  exist: a UI that owes a sentence to every refusal the vocabulary has, and a
  build that stops here when a new one is added rather than showing someone a
  tag.

## Tests

[`e2e/demo-e2e.spec.ts`](../e2e/demo-e2e.spec.ts) drives this app in Chromium,
and it is the repo's whole browser suite:

```sh
npm run test:e2e     # from the repo root; the demo server starts itself
```

Nine specs — one per promise in the table above, and one per real backend in
the picker — plus a fixture that fails any of them on an uncaught error or an
`error` in the console. They assert the contract, not the UI — a stream that
has a shorter prefix partway, a stopped turn absent from the record with the
session still usable, an overflow that fires once and stays once. The vitest
suites check the same promises against the mock directly; these check they
survive a bundler, React, and a person clicking.

## Notes

`modelpact` is a dependency here at `file:..`, and `modelpact-webgpu` at
`file:../external/webgpu-provider`. Both resolve through their own `exports`
into `dist` — the same files `npm i` would hand a stranger — and neither has a
path into anyone's `src/`. `predev` builds them first, so an edit to the
library reaches this page after a rebuild and not before. That is deliberate:
the library is developed against its tests, and this is its shop window.

This directory is outside the repo's eslint: it has its own tsconfig, and
`npm run demo:check` from the root is what type-checks it. CI installs its
dependencies for the browser suite.

# A backend written from outside

This directory is an experiment with a question behind it: **is the published
API enough to write a backend with?**

So it is not part of the package. It depends on `modelpact` the way anyone else
would — through the `exports` map, at `file:../..` — and it has no path into
`src/`. What it gets is what npm hands a stranger:

```
доступно: modelpact                            15 exports
доступно: modelpact/testing                     2 exports
закрыто:  modelpact/dist/lifecycle/03_open.js   ERR_PACKAGE_PATH_NOT_EXPORTED
закрыто:  modelpact/src/types/backend.js        ERR_PACKAGE_PATH_NOT_EXPORTED
```

The backend itself is a model in the tab, on WebGPU, through
[`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm). It answers the same four
questions every other one does, and `describeContract` from `modelpact/testing`
runs against it: 34 passed, 1 skipped.

```sh
npm install
npm test          # builds the package first, then runs the suite against it
npm run check:surface
```

## What it found

**The published types did not compile.** `PromptApiConfig` had a
`languageModel` field typed `typeof LanguageModel`, so the emitted `.d.ts` named
an ambient global — one that lives in `@types/dom-chromium-ai`, a
_dev_ dependency nobody downstream receives. A consumer got `TS2304: Cannot find
name 'LanguageModel'` from a file they never wrote. Installing the types as a
real dependency did not fix it either: a project that lists `types` explicitly
still misses them.

The field existed for tests and for a polyfill, and turned out to be needed for
neither: a polyfill defines the global, and a test can set the global too, which
is the same path a browser takes rather than one beside it. It is gone, and
`makePromptApiProvider()` now takes no argument at all.

**The conformance suite caught two bugs in this backend.** It errored its own
stream on abort, with a plain `Error` — which lands in `unknown`, not
`aborted`, because the vocabulary is mapped by exception name. The lifecycle
already checks the signal around every read and errors in the vocabulary
itself, so a backend racing it to the punch can only get it wrong. Both showed
up as red on the first run, in `abort` and in `close`.

**And then this package leaked the same way.** `WebGpuConfig.engine` was
typed with `MLCEngineInterface` from `@mlc-ai/web-llm`, whose own `.d.ts`
files name packages they do not depend on. The moment the demo started
resolving this package through `exports` — `skipLibCheck` off, as a careful
consumer would — it inherited that break through a type it never asked for.
The fix is the one from the paragraph above: `WebGpuEngine`, a structural type
of exactly what the backend uses, named here, and no third-party type in any
exported signature. Same lesson, one package over, found by the same method.

**Nothing else was missing.** `ok`, `err`, `failureFrom`, `contextUsage`,
`fraction`, `tokens`, `createProvider` and the four backend types were the
whole of what this needed, and all of them are exported.

## The two tsconfigs, and why

[`tsconfig.surface.json`](tsconfig.surface.json) compiles
[`src/surface.ts`](src/surface.ts) — every exported name, and nothing else —
with `skipLibCheck` off and `types: []`. That is the guard: it fails the moment
a published declaration needs something a consumer does not have.

[`tsconfig.json`](tsconfig.json) has `skipLibCheck` on, for the provider. It has
to: `@mlc-ai/web-llm` ships declarations naming packages it does not depend on.
Turning it on globally would have hidden the finding above, which is the whole
reason the two are separate.

## What is stubbed, and what that costs

The engine. A real one downloads several hundred megabytes into browser storage
and then wants a GPU, and a node run has neither. `needs-download` is the one
scenario the suite skips here for the same reason — from out here there is no
browser cache to empty.

So this proves the adapter and the shape of the API, not WebGPU. The real
engine is a browser and a few hundred megabytes away — and the demo is that
browser: [`demo/`](../demo) depends on this package at `file:`, resolves it
through the `exports` map above like anything from npm, and lists it in its
picker. Nothing in the code changed to get there.

```sh
npm run build   # the package first, then this one, into dist/
```

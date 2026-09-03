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
| "The conversation outgrew…"      | `oncontextoverflow`, fired once, on the narrow-window backend |
| The progress line on first open  | the `needs-download` branch and its monitor                   |
| Reload, and it is still there    | `session.history()` out, `open({ history })` back in          |
| A second tab staying in step     | the `storage` event, not a library feature                    |

The picker holds three entries of one registry. They are all the mock with
different settings, because the mock is the only backend there is yet. Swapping
one for Ollama or the browser's built-in model is an edit to
[`src/providers.ts`](src/providers.ts) and to nothing else — that is the claim
the rest of this app exists to make honest.

## Where the interesting parts are

- [`src/useChat.ts`](src/useChat.ts) — every call into the library. A session is
  a resource, so it lives in a ref and is closed by the effect that opened it.
- [`src/storage.ts`](src/storage.ts) — the part the library deliberately does
  not do. The record it hands out is plain `{ role, content }` objects, so
  storing it is `JSON.stringify` and nothing more.
- [`src/providers.ts`](src/providers.ts) — the registry, and the exhaustive
  switch its keys buy.

## Notes

`modelpact` here resolves to `../src`, not to the built package, so an edit to
the library reloads the page. What the published package looks like from
outside is checked separately, against a packed tarball.

This directory is outside the repo's eslint and CI: it has its own tsconfig and
its own `npm run typecheck`.

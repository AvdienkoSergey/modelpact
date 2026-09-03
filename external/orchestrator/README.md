# Two models, one session: an orchestrator written from outside

Claude from the `claude` you already pay for, a local model from Ollama, and a
condition between them — composed into a single `AiSession` and, like
[`../webgpu-provider`](../webgpu-provider), written against the published
package only: `modelpact` at `file:../..`, resolved through `exports`, no path
into `src/`.

```sh
npm install
npm test            # builds the package, then the suites (live one skips without claude + ollama)
npm run chat        # a terminal chat over the router; POLICY=predicate|escalate|classify
```

## What it adds to the picture

**A third transport.** Ollama was HTTP and NDJSON; Chrome was a class in the
page; WebGPU was an engine in the tab. `claude -p --output-format stream-json`
is a child process — deltas on stdout, the answer, the usage and the cost on the
last line. The four answers are the same. [`src/claude-cli.ts`](src/claude-cli.ts).

**Composition is a backend.** [`src/router.ts`](src/router.ts) is a
`ModelBackend` made of two `ModelBackend`s and a policy, and it passes the same
conformance suite as any single one. The lifecycle keeps the one conversation
and hands `request.history` to whichever side speaks, so a turn answered by
Ollama is in Claude's context on the next turn, and the other way round. Three
policies, as a union:

| `policy.kind` | Decides by                                                         |
| ------------- | ------------------------------------------------------------------ |
| `predicate`   | a function of the input — length, a keyword, a privacy marker      |
| `escalate`    | the local answer, whole, kept only if `accept` says so; else cloud |
| `classify`    | a judge backend asked with a schema; a small Ollama model fits     |

`classify` is two models cooperating: `granite4:350m` decides, `qwen3:14b` or
Claude answers.

## What it found

**Providers out, backends in — and that is the right way round.** The
package hands out `AiProvider`s, and a router composes `ModelBackend`s. There
is no `makeOllamaBackend`, and this package first recommended one; withdrawn.
The two are different kinds, not one thing in two wrappers: a backend is
asked with the whole history on every turn, a provider's session keeps the
conversation itself. So a provider cannot be unwrapped into a backend — it can
only be _reopened_ on the router's history each turn, which is what
[`src/backend-of.ts`](src/backend-of.ts) does. The first version opened once
and reused the session, and the local side then missed every turn the cloud
had answered; a test now sends local → cloud → local and checks the third
turn saw the second. Composing two finished providers costs one `open` per
turn, and that cost belongs to the composer, not to the package's surface.

**`claude -p --json-schema` fails under `--tools ""` on 2.1.138** — `is_error`
on the result line, no structured output. So a schema is refused with
`unsupported-config`, which the contract allows; it is never dropped.

**SIGTERM is exit 143, and the lifecycle has already spoken.** By the time the
process is gone the stream has been errored as `aborted` from outside, so 143
is not reported again as a failure.

**Stateless per turn, on purpose.** `--resume` would let the CLI keep the
conversation, but then a turn Ollama answered would be missing from Claude's
side. The conversation is rendered into each prompt instead; lossy against real
turns, and the price of routing.

**The spawner is structural** — `Spawned` names `ReadableStream<BufferSource>`,
a promise and `kill()`, not `ChildProcess`. Same lesson as `LanguageModel` and
`MLCEngineInterface` before it, applied before a consumer had to find it:
`tsconfig.surface.json` compiles the exports with `types: []`, and a node type
in a public signature would fail there.

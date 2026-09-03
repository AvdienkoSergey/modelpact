# Two models in one conversation — and one storey up

Claude from the `claude` you already pay for, a local model from Ollama, and a
policy that picks between them. Written from outside `modelpact`: it depends on
the package at `file:../..`, resolves through `exports`, and has no path into
`src/`.

```sh
npm install
npm test            # builds the package, then the suites (the live one skips without claude + ollama)
npm run chat        # a terminal chat; POLICY=predicate|escalate|classify
```

## The mistake this package is mostly about

The first version made the router a `ModelBackend` — two backends and a policy,
composed into one, plugged in where a transport goes. It passed the conformance
suite. It was still wrong, and everything that had to be forced said so:

- a usage meter had to pick a side, though two models have two windows and two
  tokenizers, so the number it reported was true of neither;
- an overflow event from one side meant nothing for the other;
- the inner provider had to be reopened every turn to be told about turns it
  had not answered, because a provider keeps its own conversation and a backend
  is handed one;
- `escalate` had to read the local answer whole before judging it, which killed
  streaming from inside a slot whose whole promise is a stream.

Five leaks, one hole. A session is a relationship with **one** model, and every
guarantee it makes assumes that. Two models under one session share a
transcript and nothing else.

There are three storeys, and the router belongs on the third:

| Storey        | What lives there                            | Who owns it                                        |
| ------------- | ------------------------------------------- | -------------------------------------------------- |
| transport     | how to reach one model                      | `ModelBackend` — `src/claude-cli.ts` is a good one |
| session       | one conversation, one model, the guarantees | the library                                        |
| orchestration | several models, a policy, a loop            | this file, `src/orchestrate.ts`                    |

Moved up, nothing has to be forced — and it needed **nothing new from the
package**, which is the check that the storey is right. `open({ history })` is
already the door for handing a session a conversation it did not have.

## What it is, and honestly is not

`orchestrate()` holds two providers, a record of its own, and a policy. It is
not an `AiSession` and does not pretend to be: `ask()` returns the answer, the
side that gave it, and **that side's** meter. No third meter over two models,
because there is no such thing.

| `policy.kind` | Decides by                                                             |
| ------------- | ---------------------------------------------------------------------- |
| `predicate`   | a function of the input — length, a keyword, a privacy marker          |
| `escalate`    | the local answer, whole, kept only if `accept` says so; else cloud     |
| `classify`    | a judge provider asked which way to send it; a small Ollama model fits |

`classify` is two models cooperating: `granite4:350m` decides, `qwen3:14b` or
Claude answers.

**How a side is kept in the conversation.** A session that has answered every
turn since it was opened is current, and is left alone — reopening a model that
keeps its own transcript costs the state it built. When the other side has
spoken since, it is reopened on the record. That is the whole rule, and it is a
decision this package makes about its own conversation, not something the
library had to be talked into.

`escalate` still cannot stream, and that is the policy's cost rather than a
leak: an answer that may be thrown away cannot be shown first. The other two
stream normally.

## The transport underneath

`src/claude-cli.ts` is the part that was right from the start: `claude -p
--output-format stream-json` as a third transport after HTTP and an in-page
class. A child process, deltas on stdout, the answer and the cost on the last
line — and the same four answers every other backend gives. Shapes read off
2.1.138, not off the docs:

- `--json-schema` fails with `is_error` under `--tools ""`, so a schema is
  refused with `unsupported-config` rather than dropped;
- SIGTERM is exit 143, and by then the lifecycle has already errored the stream
  as `aborted`, so it is not reported twice;
- stateless per turn on purpose — rendered history instead of `--resume`, or a
  turn the local side answered would be missing from Claude's context;
- the spawner is structural (`ReadableStream<BufferSource>`, a promise, a
  `kill()`), so the emitted `.d.ts` names nothing from `@types/node`.
  `tsconfig.surface.json` reads the built declarations with `types: []` to keep
  it that way.

## One more bug it found

A `ReadableStream` pull that returns without enqueueing is not called again
unless a read arrived while it ran. Two housekeeping lines in a row — `init`
then `message_start` — stalled every turn. The same latent bug was in the
WebGPU backend next door, where two text-less chunks would have done it, and it
was fixed there before it bit.

## Tests

`src/orchestrate.test.ts` does **not** run the conformance suite, because this
was never honestly a provider. It tests what it actually promises: which side
answers, that a warm side is not reopened for nothing, that a rejected answer
never reaches the record, and — the one that matters — local, cloud, local,
with the third turn seeing the second. That test goes red if the reopen rule is
removed, checked by removing it.

`src/claude-cli.test.ts` runs the conformance suite against a process made of
strings, because that one _is_ a provider. `src/live.test.ts` runs the real
binary and the real daemon in one conversation when both are present: it states
a fact to the local model, asks the cloud something else, then asks the local
model about the fact — and skips loudly when either is missing.

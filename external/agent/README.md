# An agent, on the storey where one belongs

A tool-calling loop over the sessions `modelpact` already owns. Written from
outside the package: it depends on it at `file:../..`, resolves through
`exports`, and has no path into `src/`.

```sh
npm install --legacy-peer-deps   # see the note at the bottom
npm test                         # the live suites skip without ollama + claude
npm run chat                     # a terminal agent; BRAIN=single|routed
```

## Why this is a separate storey and not a bigger session

The sibling package, [`../orchestrator`](../orchestrator), learned this the
expensive way: a policy that picks between two models was first built as a
`ModelBackend`, and every guarantee a session makes leaked through it. The rule
that came out of it holds here too. A transport reaches one model. A session
holds one conversation with it. **A loop over turns is neither**, and it goes
above both, as an ordinary consumer.

So `runAgent` opens nothing, closes nothing, and owns no conversation. It is
handed a `Brain` — two methods, `ask` and `record` — and loops.

| Brain               | Is             | Adapter                   |
| ------------------- | -------------- | ------------------------- |
| one model           | `AiSession`    | `brainOfSession(session)` |
| two behind a policy | `Orchestrator` | `brainOfChat(chat)`       |

Both adapters are two lines, because the library already did the work.

## What came from the reference agent

[HowProgrammingWorks/Agent](https://github.com/HowProgrammingWorks/Agent) is a
coding agent in Node: one OpenAI-compatible endpoint, a directory of tools, and
a loop. Its **shape** is the right shape, and it is the shape here:

- a step-limited loop, `for step = 1..maxSteps`, that fails with a reason
  rather than running forever;
- tool errors returned **to the model** as `ERROR: …` instead of thrown, so a
  model that gets its arguments wrong can fix them;
- a denial that reads the same way, `DENIED: …`, so refusing is a fact the
  model can act on rather than a hole;
- results truncated before they go back;
- an approval gate in front of anything that acts;
- events emitted per step, so a terminal can show the work.

## What could not come, and what replaced it

**Native tool calls.** That agent reads `message.tool_calls` off the response,
because its endpoint speaks the OpenAI protocol. This contract has no tool
protocol at all, and adding one would have been a large change to a package
that did not ask for it.

It did not need one. The contract already has constrained decoding, honoured or
refused and never ignored, and a tool call is a shape:

```json
{
  "reason": "...",
  "action": "tool",
  "tool": "readFile",
  "args": { "path": "x" },
  "answer": ""
}
```

Where the schema is honoured the model can only answer in it. Where it is
refused — `claude -p` refuses, measured, with and without `--tools ""` — the
same question is asked again in prose and the object is read out of the text.
The refusal is not an obstacle here; it is the signal that picks the mode, and
`AgentRun.constrained` reports which one ran.

**A tool result is a user turn.** `AiRole` is `user` or `assistant`, so there is
nowhere for a third role. The result goes back as the next user message, and
that is the whole of the mapping — the reason no tool protocol was needed.

**The path-token parser.** That agent resolves every path out of a shell
command and refuses what leaves the trust root, which takes a hundred lines
because its `bash` tool can reach anywhere. These tools take a path and nothing
else, so containment is a `resolve` and a prefix test. Shipping a shell tool
would mean shipping the hundred lines too, and this package does not.

**Tools loaded from disk, the TUI, the git integration.** A library takes its
tools as an argument. The rest is that project's application, not its idea.

## Measured, not assumed

**Every field of the step schema is required, and that is not tidiness.** Under
constrained decoding a model stops at what the schema demands. With `tool` and
`args` optional, `granite4:350m` answered `{"reason":"…","action":"tool"}` and
nothing else — an action with no verb. With all five required it answered
`{"reason":"…","action":"tool","tool":"listFiles","args":{},"answer":""}`.
`qwen3:14b` was the control and got it right either way.

**The truncation default is 4 000 characters, not 60 000.** That agent talks to
a 200k-token cloud model. A local 4096-token window is filled by one file read
at 60k, so the small default is the one that keeps a local model working.

**`--legacy-peer-deps` on install.** npm 10.9.8 crashes with
`Cannot read properties of null (reading 'edgesOut')` while resolving the
optional `vitest` peer of a `file:` linked package. The flag skips that
resolution and installs cleanly; the sibling packages predate the crash and
install without it.

## Tests

`src/agent.test.ts` runs the loop on a brain made of strings, because what is
under test is control flow: what reaches the model after a tool, what a denial
and a throw look like from inside, where the loop stops. `src/tools.test.ts`
covers the one part of a tool that has to be right, which is not leaving the
workspace.

`src/live.test.ts` runs the real loop on both kinds of brain, with the same
workspace and the same question: what colour does the file name. Either can
only answer if the tool really ran and its output really came back.

| Brain       | Schema   | Branch      | Answers |
| ----------- | -------- | ----------- | ------- |
| `qwen3:14b` | honoured | constrained | teal    |
| `claude -p` | refused  | prose       | teal    |

The second row is the point: a refusal picks the mode, it does not end the run.
The unit tests reach that branch through a stub; this reaches it through the
CLI that actually refuses.

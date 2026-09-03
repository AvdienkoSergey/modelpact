# Security

## Supported versions

The latest release, and no branches behind it. This package is small and
young: a fix goes out as a new version rather than as a backport.

| Version | Supported |
| ------- | --------- |
| 2.x     | yes       |
| 1.x     | no        |

## Reporting a vulnerability

Please do not open a public issue for a vulnerability. Use
[private vulnerability reporting](https://github.com/AvdienkoSergey/modelpact/security/advisories/new)
on this repository — it is private between you and the maintainer until a fix
exists. Expect an acknowledgement within a week; if the Security tab is closed
to you for any reason, open an ordinary issue saying only that you have
something to report, and it will be moved.

Useful in a report: the version, the provider in use, what you sent, what
happened, and what you expected instead. A failing test against the mock
provider is the fastest possible bug report.

## What this package is, in security terms

`modelpact` is a contract and a lifecycle. It has **no runtime dependencies**
and makes no network calls of its own — the transport belongs to the backend
you choose:

- **mock** — nothing leaves the process.
- **prompt-api** — the browser's own model, on the user's device.
- **ollama** — HTTP to the host you configured, `127.0.0.1:11434` by default.
- **anything you write** — yours to review.

So the surface worth attention here is what the library does with what a model
says, and what it hands a backend:

- A model's answer is **text**, and this package never evaluates it. Where the
  answer is meant to be JSON, `JSON.parse` is the caller's to run — the
  contract carries a schema so the model is constrained, honoured or refused,
  never silently ignored.
- `history` handed to `open()` is sent to the backend as the conversation.
  Treat it as untrusted input to the model, because that is what prompt
  injection is.
- `AiFailure` carries a `cause`, which may hold an exception from the backend.
  Logging it wholesale can log a URL or a header the backend put there.
- The published declarations name nothing a consumer does not have, and three
  packages under `external/` check that on every change with `skipLibCheck`
  off.

## How releases are published

Every version is published from CI by
[trusted publishing](https://docs.npmjs.com/trusted-publishers/): npm trusts
this repository and one workflow file by name, and the runner signs in with a
credential that lives for one publish. There is no long-lived npm token to
leak. Each version carries a
[provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
naming the commit and the workflow that built it, which `npm audit signatures`
verifies.

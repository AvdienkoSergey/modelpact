<!--
Commits follow conventional commits — release-please reads them to decide the
next version and to write the changelog. `feat:` minor, `fix:` patch, a `!`
after the type is a major.
-->

## What this changes

<!-- What a reader gets that they did not have before. One or two sentences. -->

## Why it is right

<!--
What you measured, or the case that goes wrong without it. An opinion in this
codebase moves on evidence: a failing test, a shape read off a running daemon,
a number.
-->

## Checks

<!-- CI runs all of these; running them first is faster than a red PR. -->

- [ ] `npm run typecheck && npm run lint && npm run format:check`
- [ ] `npm test` — including the contract suite
- [ ] `npm run test:e2e`, if the demo or the lifecycle moved
- [ ] `npm run external`, `external:orchestrator`, `external:agent`, if a public type moved
- [ ] A behaviour change has a test that goes red without it

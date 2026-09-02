# modelpact

A contract for language-model backends, and the test suite that proves yours conforms to it.

One interface for backends that answer with text: a daemon on localhost, the
browser's own built-in model, a mock in memory. A page picks a backend and
changes nothing else.

Failures travel as values rather than exceptions, and the vocabulary of refusals
is cut by what the caller does next, not by exception name. Availability and
opening a session are one value: "create a session on a model that is not there"
is not a mistake to guard against — it is an expression that does not compile.

Your own backend is checked by the same suite as the built-in ones:
`describeContract("mine", factory)` from `modelpact/testing`. A scenario your
backend cannot stage is skipped visibly; passing in silence is not available.

## Status

Early. The code is being moved in from the repository it grew in; this one
starts with its release automation so every commit after it is versioned.

## License

MIT

/**
 * A `ModelBackend` recovered from an `AiProvider`.
 *
 * The package exports `makeMockProvider` and `makeOllamaProvider`, and a router
 * wants what is under them. There is no `makeOllamaBackend`, so this adapter
 * re-derives the four answers from the session API — which works, and is the
 * one place this package had to go around the public surface rather than
 * through it. Recorded in the README as a finding.
 */
import type { AiProvider, ModelBackend } from "modelpact";

export const backendOf = (
  name: string,
  provider: AiProvider,
): ModelBackend => ({
  name,
  modalities: ["text"],
  availability: async (request) => {
    const access = await provider.access(request);
    if (access.kind === "unavailable") return access;
    return access.kind === "ready"
      ? { kind: "ready" }
      : { kind: "needs-download", started: access.started };
  },
  connect: async (options) => {
    const access = await provider.access(options.request);
    if (access.kind === "unavailable")
      return { ok: false, error: access.reason };
    const opened =
      access.kind === "ready"
        ? await access.open(options.session)
        : await access.open((monitor) => {
            monitor.ondownloadprogress = (event) => {
              const share = event.total === 0 ? 0 : event.loaded / event.total;
              options.reportProgress(share as never);
            };
          }, options.session);
    if (!opened.ok) return opened;
    const session = opened.value;
    session.oncontextoverflow = () => {
      options.reportOverflow();
    };
    return {
      ok: true,
      value: {
        generate: (input, request) =>
          session.promptStream(input, {
            signal: request.signal,
            ...(request.schema === undefined ? {} : { schema: request.schema }),
          }),
        usage: () => session.usage(),
        dispose: () => {
          session.close();
        },
      },
    };
  },
});

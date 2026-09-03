/**
 * A `ModelBackend` recovered from an `AiProvider`, for composing under a router.
 *
 * Not an unwrapping, because there is nothing to unwrap: a provider is
 * stateful — its session keeps the conversation — and a backend is asked with
 * the whole history on every turn. The only way to hand a session someone
 * else's history is `open({ history })`, so this adapter opens the inner
 * session once per turn, seeded with `request.history`. Without that, the
 * inner side would miss every turn the other side answered — a router's whole
 * promise, broken quietly on the local side after the first cloud turn.
 *
 * The package rightly hands out providers and not their backends. This is the
 * price of composing two of them, and it is paid here, not in the package.
 */
import type {
  AiProvider,
  ModelAccess,
  ModelBackend,
  AiSession,
  SessionOptions,
} from "modelpact";

const openOn = (
  access: Exclude<ModelAccess, { kind: "unavailable" }>,
  session: SessionOptions,
  reportProgress: (loaded: number) => void,
) =>
  access.kind === "ready"
    ? access.open(session)
    : access.open((monitor) => {
        monitor.ondownloadprogress = (event) => {
          reportProgress(event.total === 0 ? 0 : event.loaded / event.total);
        };
      }, session);

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
    // Asked once here, so a turn costs one `open` and not an `access` as well.
    const access = await provider.access(options.request);
    if (access.kind === "unavailable")
      return { ok: false, error: access.reason };
    const report = (loaded: number): void => {
      options.reportProgress(loaded as never);
    };
    // The download, if any, happens on this first open; later ones find it done.
    const first = await openOn(access, options.session, report);
    if (!first.ok) return first;
    let current: AiSession = first.value;
    current.close();

    return {
      ok: true,
      value: {
        generate: async (input, request) => {
          // Reopened per turn on the router's history, which is the one
          // conversation both sides are part of.
          const opened = await openOn(
            access,
            { ...options.session, history: request.history },
            report,
          );
          if (!opened.ok) return opened;
          current = opened.value;
          current.oncontextoverflow = () => {
            options.reportOverflow();
          };
          return current.promptStream(input, {
            signal: request.signal,
            ...(request.schema === undefined ? {} : { schema: request.schema }),
          });
        },
        usage: () => current.usage(),
        dispose: () => {
          current.close();
        },
      },
    };
  },
});

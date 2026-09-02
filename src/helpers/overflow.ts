/**
 * The `contextoverflow` event, carried for every provider by one object.
 *
 * Shared for the reason `turn.ts` is shared: the contract suite would watch
 * each provider fire and never notice that they fire on different arithmetic.
 * The rule lives here — a session that has spent more of the window than the
 * window holds — and nothing but this file decides it.
 *
 * A session is not an `EventTarget` by construction: a provider builds one as
 * an object of closures. So the closures are assigned onto an instance of
 * this class, the way `ProgressMonitor` carries `downloadprogress`.
 */

import type { AiSession } from "../types/session.js";
import type { ContextUsage } from "../types/usage.js";

export const CONTEXT_OVERFLOW = "contextoverflow";

export class ContextEvents extends EventTarget {
  #handler: ((event: Event) => void) | null = null;
  #fired = false;

  /**
   * As on `DownloadMonitor`: an `onevent` property is not free with
   * `EventTarget`, and it is the only registration that carries the event's
   * type — `addEventListener` on a subclass takes a bare `EventListener`.
   */
  get oncontextoverflow(): ((event: Event) => void) | null {
    return this.#handler;
  }

  set oncontextoverflow(handler: ((event: Event) => void) | null) {
    if (this.#handler !== null) {
      this.removeEventListener(CONTEXT_OVERFLOW, this.#handler);
    }
    this.#handler = handler;
    if (handler !== null) this.addEventListener(CONTEXT_OVERFLOW, handler);
  }

  /**
   * Called with what the session now holds, after a turn has been charged.
   *
   * Fires at most once. The window does not un-overflow: the backend has
   * already dropped the oldest turns to make the last one fit, and every turn
   * after it is over the same line. A listener wants to hear that the conversation
   * started losing its beginning, not to be told again each turn.
   *
   * `unbounded` and `unknown` never fire — there is no line to cross.
   */
  report(usage: ContextUsage): void {
    if (this.#fired || usage.kind !== "bounded") return;
    // Strictly greater: a transcript that exactly fills the window still fits.
    if (usage.used <= usage.total) return;
    this.announce();
  }

  /**
   * For a backend that decides this itself. The browser fires its own
   * `contextoverflow`, and forwarding that is more truthful than re-deriving it
   * from counters it may already have trimmed — by the time a listener reads
   * them the dropped turns are gone and `used` can be under the window again.
   */
  announce(): void {
    if (this.#fired) return;
    this.#fired = true;
    this.dispatchEvent(new Event(CONTEXT_OVERFLOW));
  }
}

/**
 * A session's closures on top of an event target, which is the one way to build
 * an `AiSession` — the contract extends `EventTarget`, and an object literal is
 * not one.
 */
export function withEvents(
  events: ContextEvents,
  session: Omit<AiSession, keyof EventTarget | "oncontextoverflow">,
): AiSession {
  return Object.assign(events, session);
}

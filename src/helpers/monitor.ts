/**
 * Download progress as the platform reports it: an `EventTarget` that fires
 * `downloadprogress`.
 *
 * The Prompt API hands `create()` a `CreateMonitor` and fires a `ProgressEvent`
 * on it. This is the same object for a provider with no browser behind it, and
 * both satisfy `DownloadMonitor` from `../types/session.ts` —
 * `src/types.test-d.ts` checks the ambient declaration against it.
 *
 * `ProgressEvent` is not a global in Node 22 — `typeof ProgressEvent` is
 * `"undefined"` there, while `Event`, `EventTarget` and `CustomEvent` are
 * present — and the vitest suites run in the node environment. So the event is
 * a subclass of `Event` carrying the three `ProgressEvent` fields, which is
 * what a listener reads. `CustomEvent` was the alternative and puts the numbers
 * behind `detail`, where a listener written against the spec would not look.
 */

import type { Fraction } from "../types/foundations.js";
import type { DownloadMonitor } from "../types/session.js";

export const DOWNLOAD_PROGRESS = "downloadprogress";

/**
 * `total` is 1 and `loaded` is the ratio. MDN names the normalization on
 * `ProgressEvent` itself ("if using 1 as a total, then loaded would be a
 * decimal value between 0 and 1"), and it settles the one thing the Prompt API
 * docs disagree about: `e.loaded / e.total` and a bare `e.loaded` are the same
 * number here.
 */
export class DownloadProgressEvent extends Event {
  readonly lengthComputable = true;
  readonly total = 1;

  constructor(readonly loaded: Fraction) {
    super(DOWNLOAD_PROGRESS);
  }
}

/**
 * Our `CreateMonitor`. `report` is not part of `DownloadMonitor`, so a caller
 * holding the contract type can listen but cannot invent progress —
 * `src/types.test-d.ts` checks that it cannot.
 */
export class ProgressMonitor extends EventTarget implements DownloadMonitor {
  #handler: ((event: ProgressEvent) => void) | null = null;
  #loaded: Fraction | null = null;

  /**
   * An `onevent` property is not free with `EventTarget`: only interfaces the
   * platform defines have one, and it is a listener registration behind an
   * accessor — assigning twice replaces, assigning null unsubscribes. Here it
   * also carries the event's type, which `addEventListener` cannot: see the
   * note on `DownloadMonitor`.
   */
  get ondownloadprogress(): ((event: ProgressEvent) => void) | null {
    return this.#handler;
  }

  set ondownloadprogress(handler: ((event: ProgressEvent) => void) | null) {
    if (this.#handler !== null) {
      this.removeEventListener(
        DOWNLOAD_PROGRESS,
        this.#handler as EventListener,
      );
    }
    this.#handler = handler;
    if (handler !== null) {
      this.addEventListener(DOWNLOAD_PROGRESS, handler as EventListener);
    }
  }

  /** Dropped rather than dispatched when it does not move forward — the contract's non-decreasing guarantee. */
  report(loaded: Fraction): void {
    if (this.#loaded !== null && loaded <= this.#loaded) return;
    this.#loaded = loaded;
    this.dispatchEvent(new DownloadProgressEvent(loaded));
  }
}

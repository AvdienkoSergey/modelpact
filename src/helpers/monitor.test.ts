import { describe, expect, test } from "vitest";

import {
  DOWNLOAD_PROGRESS,
  DownloadProgressEvent,
  ProgressMonitor,
} from "./monitor.js";
import { fraction, type Fraction } from "../types/foundations.js";

const f = (value: number): Fraction => {
  const parsed = fraction(value);
  if (parsed === null) throw new RangeError(`not a fraction: ${value}`);
  return parsed;
};

/** What a listener written against the spec reads off the event. */
const loaded = (monitor: ProgressMonitor): number[] => {
  const seen: number[] = [];
  monitor.ondownloadprogress = (e) => seen.push(e.loaded / e.total);
  return seen;
};

describe("ProgressMonitor", () => {
  test("the event carries what a ProgressEvent carries", () => {
    const monitor = new ProgressMonitor();
    const events: Event[] = [];
    monitor.addEventListener(DOWNLOAD_PROGRESS, (e) => events.push(e));

    monitor.report(f(0.25));

    const event = events[0];
    expect(event).toBeInstanceOf(DownloadProgressEvent);
    if (!(event instanceof DownloadProgressEvent)) return;
    expect(event.type).toBe("downloadprogress");
    expect(event.loaded).toBe(0.25);
    // Normalized, so `loaded / total` and a bare `loaded` are the same number.
    expect(event.total).toBe(1);
    expect(event.lengthComputable).toBe(true);
  });

  test("this runtime has no ProgressEvent to construct", () => {
    // Node 22, which is where the suites run: `Event` and `EventTarget` are
    // globals, `ProgressEvent` is not. Hence the Event subclass — it is not a
    // preference.
    expect(typeof ProgressEvent).toBe("undefined");
    expect(typeof Event).toBe("function");
    expect(new DownloadProgressEvent(f(1))).toBeInstanceOf(Event);
  });

  test("progress that does not move forward is dropped", () => {
    const monitor = new ProgressMonitor();
    const seen = loaded(monitor);

    monitor.report(f(0.5));
    monitor.report(f(0.4)); // a layer appearing grows the denominator
    monitor.report(f(0.5)); // and the ratio climbs back to where it was
    monitor.report(f(0.6));

    expect(seen).toEqual([0.5, 0.6]);
  });

  test("assigning the handler twice replaces it, and null unsubscribes", () => {
    const monitor = new ProgressMonitor();
    const first: number[] = [];
    const second: number[] = [];

    monitor.ondownloadprogress = (e) => first.push(e.loaded);
    monitor.ondownloadprogress = (e) => second.push(e.loaded);
    monitor.report(f(0.5));
    monitor.ondownloadprogress = null;
    monitor.report(f(1));

    // An `onevent` property is one registration, not a growing list — which is
    // the whole difference from addEventListener.
    expect(first).toEqual([]);
    expect(second).toEqual([0.5]);
    expect(monitor.ondownloadprogress).toBe(null);
  });

  test("listeners added both ways both fire", () => {
    const monitor = new ProgressMonitor();
    const property = loaded(monitor);
    const listeners: number[] = [];
    monitor.addEventListener(DOWNLOAD_PROGRESS, () => listeners.push(1));
    monitor.addEventListener(DOWNLOAD_PROGRESS, () => listeners.push(2));

    monitor.report(f(1));

    expect(property).toEqual([1]);
    expect(listeners).toEqual([1, 2]);
  });
});

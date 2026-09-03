import { describe, expect, test } from "vitest";

import {
  DOWNLOAD_PROGRESS,
  DownloadProgressEvent,
  ProgressMonitor,
} from "./monitor.js";
import { fraction, type Fraction } from "../types/foundations.js";

const toFraction = (value: number): Fraction => {
  const parsedFraction = fraction(value);
  if (parsedFraction === null) throw new RangeError(`not a fraction: ${value}`);
  return parsedFraction;
};

/** What a listener written against the spec reads off the event. */
const collectProgress = (monitor: ProgressMonitor): number[] => {
  const seenProgress: number[] = [];
  monitor.ondownloadprogress = (event) =>
    seenProgress.push(event.loaded / event.total);
  return seenProgress;
};

describe("ProgressMonitor", () => {
  test("the event carries what a ProgressEvent carries", () => {
    const monitor = new ProgressMonitor();
    const events: Event[] = [];
    monitor.addEventListener(DOWNLOAD_PROGRESS, (event) => events.push(event));

    monitor.report(toFraction(0.25));

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
    expect(new DownloadProgressEvent(toFraction(1))).toBeInstanceOf(Event);
  });

  test("progress that does not move forward is dropped", () => {
    const monitor = new ProgressMonitor();
    const seenProgress = collectProgress(monitor);

    monitor.report(toFraction(0.5));
    monitor.report(toFraction(0.4)); // a layer appearing grows the denominator
    monitor.report(toFraction(0.5)); // and the ratio climbs back to where it was
    monitor.report(toFraction(0.6));

    expect(seenProgress).toEqual([0.5, 0.6]);
  });

  test("assigning the handler twice replaces it, and null unsubscribes", () => {
    const monitor = new ProgressMonitor();
    const firstSeen: number[] = [];
    const secondSeen: number[] = [];

    monitor.ondownloadprogress = (event) => firstSeen.push(event.loaded);
    monitor.ondownloadprogress = (event) => secondSeen.push(event.loaded);
    monitor.report(toFraction(0.5));
    monitor.ondownloadprogress = null;
    monitor.report(toFraction(1));

    // An `onevent` property is one registration, not a growing list — which is
    // the whole difference from addEventListener.
    expect(firstSeen).toEqual([]);
    expect(secondSeen).toEqual([0.5]);
    expect(monitor.ondownloadprogress).toBe(null);
  });

  test("listeners added both ways both fire", () => {
    const monitor = new ProgressMonitor();
    const propertyProgress = collectProgress(monitor);
    const listenerCalls: number[] = [];
    monitor.addEventListener(DOWNLOAD_PROGRESS, () => listenerCalls.push(1));
    monitor.addEventListener(DOWNLOAD_PROGRESS, () => listenerCalls.push(2));

    monitor.report(toFraction(1));

    expect(propertyProgress).toEqual([1]);
    expect(listenerCalls).toEqual([1, 2]);
  });
});

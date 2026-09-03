/** Stage two, on the `needs-download` branch only: subscribe the monitor, then let the backend fetch and connect. */

import { ProgressMonitor } from "../helpers/monitor.js";
import type { Fraction, Result } from "../types/foundations.js";
import type { AiFailure } from "../types/failures.js";
import type { ModelRequest } from "../types/messages.js";
import type {
  AiSession,
  DownloadMonitor,
  SessionOptions,
} from "../types/session.js";
import type { ModelBackend } from "../types/backend.js";
import { openSession } from "./03_open.js";

export const openAfterDownload = (
  backend: ModelBackend,
  request: ModelRequest,
  subscribe: (monitor: DownloadMonitor) => void,
  options?: SessionOptions,
): Promise<Result<AiSession, AiFailure>> => {
  const monitor = new ProgressMonitor();
  // Before the first await: subscribing after the promise settles is
  // subscribing after the download.
  subscribe(monitor);
  const reportProgress = (loaded: Fraction): void => monitor.report(loaded);
  return openSession(backend, request, options, reportProgress);
};

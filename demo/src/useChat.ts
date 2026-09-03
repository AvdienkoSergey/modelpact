/**
 * Every call into the library the demo makes, in one place.
 *
 * The shape it settles on: a session is a resource, not state, so it lives in
 * a ref and is closed by the effect that opened it. What React renders comes
 * from `session.history()` after each turn, which is also what goes to storage
 * — one record, not two.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AiError,
  err,
  type AiFailure,
  type AiMessage,
  type AiSession,
  type ContextUsage,
  type Result,
} from "modelpact";

import { PROVIDERS, type ProviderName } from "./providers";
import { clearRecord, loadRecord, saveRecord, watchRecord } from "./storage";

export interface Chat {
  readonly record: readonly AiMessage[];
  /** The answer as it arrives; null when no turn is running. */
  readonly streaming: string | null;
  readonly usage: ContextUsage;
  readonly overflowed: boolean;
  readonly failure: AiFailure | null;
  /** 0..1 while weights are moving, null otherwise. */
  readonly downloading: number | null;
  readonly ready: boolean;
  readonly send: (input: string) => void;
  readonly stop: () => void;
  readonly reset: () => void;
}

/**
 * Both branches that can open, behind one call. `needs-download` wants the
 * monitor subscribed before anything is awaited, which the callback shape
 * enforces.
 */
async function openSession(
  name: ProviderName,
  history: readonly AiMessage[],
  onProgress: (loaded: number) => void,
): Promise<Result<AiSession, AiFailure>> {
  const access = await PROVIDERS[name].access();
  if (access.kind === "unavailable") return err(access.reason);
  if (access.kind === "needs-download") {
    return access.open(
      (monitor) => {
        monitor.ondownloadprogress = (event) => {
          onProgress(event.loaded / event.total);
        };
      },
      { history },
    );
  }
  return access.open({ history });
}

export function useChat(name: ProviderName): Chat {
  // The conversation a session is opened on. Set by storage on load, and again
  // whenever another tab writes — which is what reopens the session below.
  const [seed, setSeed] = useState<readonly AiMessage[]>(loadRecord);
  const [record, setRecord] = useState<readonly AiMessage[]>(seed);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [usage, setUsage] = useState<ContextUsage>({ kind: "unknown" });
  const [overflowed, setOverflowed] = useState(false);
  const [failure, setFailure] = useState<AiFailure | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  const session = useRef<AiSession | null>(null);
  const turn = useRef<AbortController | null>(null);

  useEffect(() => watchRecord(setSeed), []);

  useEffect(() => {
    let current: AiSession | null = null;
    let live = true;
    setReady(false);
    setOverflowed(false);
    setFailure(null);

    void (async () => {
      const opened = await openSession(name, seed, (loaded) => {
        if (live) setDownloading(loaded);
      });
      setDownloading(null);
      if (!live) {
        // Unmounted while opening, or the effect re-ran: this session belongs
        // to nobody, and leaving it open would leave its backend open too.
        if (opened.ok) opened.value.close();
        return;
      }
      if (!opened.ok) {
        setFailure(opened.error);
        return;
      }
      current = opened.value;
      current.oncontextoverflow = () => {
        setOverflowed(true);
      };
      session.current = current;
      setRecord(current.history());
      setUsage(current.usage());
      setReady(true);
    })();

    return () => {
      live = false;
      current?.close();
      session.current = null;
    };
  }, [name, seed]);

  const send = useCallback((input: string) => {
    const current = session.current;
    if (current === null) return;

    const controller = new AbortController();
    turn.current = controller;
    setFailure(null);
    setStreaming("");

    void (async () => {
      try {
        const started = await current.promptStream(input, {
          signal: controller.signal,
        });
        if (!started.ok) {
          setFailure(started.error);
          return;
        }
        // A reader loop, not `for await`: stream iteration is not portable, and
        // leaving such a loop early cancels the generation.
        const reader = started.value.getReader();
        let answer = "";
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          answer += next.value;
          setStreaming(answer);
        }
      } catch (error) {
        // The one place the library throws: a reader has nowhere to put a
        // Result, so an interrupted stream errors with an AiError.
        setFailure(
          error instanceof AiError ? error.failure : { kind: "unknown" },
        );
      } finally {
        setStreaming(null);
        turn.current = null;
        // The record is the library's answer to what happened, so it is read
        // rather than assembled here: an interrupted turn is simply not in it.
        const next = current.history();
        setRecord(next);
        setUsage(current.usage());
        saveRecord(next);
      }
    })();
  }, []);

  const stop = useCallback(() => {
    turn.current?.abort();
  }, []);

  const reset = useCallback(() => {
    turn.current?.abort();
    clearRecord();
    // A new seed reopens the session; the old one is closed by the cleanup.
    setSeed([]);
  }, []);

  return {
    record,
    streaming,
    usage,
    overflowed,
    failure,
    downloading,
    ready,
    send,
    stop,
    reset,
  };
}

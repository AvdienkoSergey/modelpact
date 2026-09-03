/**
 * Where the conversation is kept between reloads.
 *
 * The library hands the record out and takes one back; it does not store. That
 * is this file, and it is the whole of it: read on open, write after a turn,
 * listen for another tab writing.
 */

import type { AiMessage } from "modelpact";

const KEY = "modelpact-demo-chat";

export function loadRecord(): readonly AiMessage[] {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as AiMessage[]) : [];
  } catch {
    // A private window, cleared site data, or something else in this key.
    return [];
  }
}

export function saveRecord(record: readonly AiMessage[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Out of quota or blocked: the conversation still works, it just will not
    // be there next time.
  }
}

export function clearRecord(): void {
  localStorage.removeItem(KEY);
}

/**
 * `storage` fires in every tab except the one that wrote, so this cannot loop
 * back on itself. A null key means the whole store was cleared.
 */
export function watchRecord(
  handle: (record: readonly AiMessage[]) => void,
): () => void {
  const listener = (event: StorageEvent): void => {
    if (event.key !== KEY && event.key !== null) return;
    handle(loadRecord());
  };
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("storage", listener);
  };
}

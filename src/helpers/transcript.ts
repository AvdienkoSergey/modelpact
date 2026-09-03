/**
 * The conversation as the session has actually had it: what was handed at
 * open, then every completed turn, in order.
 *
 * Completed only. An aborted, cancelled or failed turn adds nothing, and the
 * event that appends is the one that charges usage (`04_generate.ts`), so the
 * meter and the record cannot disagree. It also keeps the prefix a stateless
 * backend resends stable from turn to turn, which is what a server's KV cache
 * matches on — any edit before the end invalidates everything after it.
 *
 * Never trimmed. What to drop when the window overflows is a decision about
 * the conversation, and only the app knows what it can lose; the lifecycle
 * reports the overflow and keeps the whole record.
 */

import type { AiMessage } from "../types/messages.js";

export interface Transcript {
  /** Stable once read: a later `append` builds a new array rather than writing into this one. */
  readonly entries: () => readonly AiMessage[];
  readonly append: (input: string, answer: string) => void;
}

export function createTranscript(seed: readonly AiMessage[] = []): Transcript {
  let entries: readonly AiMessage[] = [...seed];
  return {
    entries: () => entries,
    append: (input, answer) => {
      const question: AiMessage = { role: "user", content: input };
      const reply: AiMessage = { role: "assistant", content: answer };
      entries = [...entries, question, reply];
    },
  };
}

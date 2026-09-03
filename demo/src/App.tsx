import { useState, type FormEvent } from "react";
import type {
  AccessKind,
  AiFailure,
  ContextUsage,
  FailureKind,
  UsageKind,
} from "modelpact";

import { PROVIDER_NAMES, labelOf, type ProviderName } from "./providers";
import { useChat, type Chat } from "./useChat";

/** One line per branch of `ModelAccess`, which is the whole of that union. */
const ACCESS: Record<AccessKind, string> = {
  ready: "ready",
  "needs-download": "fetching weights",
  unavailable: "unavailable",
};

/**
 * Every refusal the vocabulary has, in words a person can read.
 *
 * A `Record` rather than a switch with a default: the default is what lets a
 * kind added upstream reach someone as its own name, and keying by
 * `FailureKind` means the build stops here instead.
 */
const NOTICE: Record<FailureKind, string> = {
  aborted:
    "Stopped. The turn is not in the record, so the words above are gone from it.",
  busy: "One generation at a time on a session",
  "context-overflow":
    "The window is full. Reset, or hand back a shorter conversation.",
  failed: "The backend could not answer",
  "invalid-input": "That message was not accepted",
  "invalid-state": "The page is not fully active",
  "not-allowed": "Blocked by this page's permissions policy",
  unknown: "Something else went wrong",
  unsupported: "No model API in this runtime",
  "unsupported-config": "No model for what was asked for",
  "unsupported-input": "That message was built wrong",
};

/** The two branches with no numbers to draw; `bounded` renders a bar instead. */
const NO_BUDGET: Record<Exclude<UsageKind, "bounded">, string> = {
  unknown: "budget unknown",
  unbounded: "no limit",
};

/**
 * The branch until a session is open, and `ready` once one is: however the
 * download branch was reached, a session on the other side of it is ready.
 */
function statusOf(chat: Chat): string {
  if (chat.access === null) return "asking…";
  return chat.ready ? ACCESS.ready : ACCESS[chat.access];
}

function explain(failure: AiFailure): string {
  const notice = NOTICE[failure.kind];
  // Only some kinds carry a detail, and narrowing is what says which.
  return failure.kind === "busy" ? `${notice}: ${failure.detail}` : notice;
}

function Meter({ usage }: { usage: ContextUsage }) {
  if (usage.kind !== "bounded")
    return <span className="meter-text">{NO_BUDGET[usage.kind]}</span>;
  const share = Math.min(1, usage.used / usage.total);
  return (
    <span className="meter">
      <span className="meter-bar">
        <span className="meter-fill" style={{ width: `${share * 100}%` }} />
      </span>
      <span className="meter-text">
        {usage.used} / {usage.total}
      </span>
    </span>
  );
}

export function App() {
  const [name, setName] = useState<ProviderName>("mock");
  const [draft, setDraft] = useState("");
  const chat = useChat(name);
  const busy = chat.streaming !== null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input = draft.trim();
    if (input === "" || busy || !chat.ready) return;
    chat.send(input);
    setDraft("");
  };

  return (
    <main>
      <header>
        <h1>modelpact</h1>
        <select
          value={name}
          onChange={(event) => setName(event.target.value as ProviderName)}
        >
          {PROVIDER_NAMES.map((one) => (
            <option key={one} value={one}>
              {labelOf(one)}
            </option>
          ))}
        </select>
        <span className="status">
          <span className="chip">{statusOf(chat)}</span>
          <Meter usage={chat.usage} />
        </span>
        <button type="button" onClick={chat.reset}>
          Reset
        </button>
      </header>

      {chat.downloading !== null && (
        <p className="notice">
          Downloading weights… {Math.round(chat.downloading * 100)}%
        </p>
      )}
      {chat.overflowed && (
        <p className="notice warn">
          The conversation outgrew the window. Older turns are being dropped.
        </p>
      )}

      <ol className="record">
        {chat.record.map((message, index) => (
          <li key={index} className={message.role}>
            {message.content}
          </li>
        ))}
        {chat.streaming !== null && (
          <li className="assistant streaming">{chat.streaming || "…"}</li>
        )}
      </ol>

      {chat.failure !== null && (
        <p className="notice warn">{explain(chat.failure)}</p>
      )}

      <form onSubmit={submit}>
        <input
          value={draft}
          placeholder={chat.ready ? "Ask it something" : "Opening a session…"}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!chat.ready}
        />
        {busy ? (
          <button type="button" onClick={chat.stop}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!chat.ready}>
            Send
          </button>
        )}
      </form>

      <footer>
        The conversation is in <code>localStorage</code>. Reload and it is still
        here; open a second tab and both stay in step.
      </footer>
    </main>
  );
}

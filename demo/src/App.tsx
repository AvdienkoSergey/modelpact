import { useState, type FormEvent } from "react";
import type {
  AccessKind,
  AiFailure,
  ContextUsage,
  FailureKind,
  UsageKind,
} from "modelpact";

import {
  PROVIDER_NAMES,
  getProviderLabel,
  type ProviderName,
} from "./providers";
import { useChat, type Chat } from "./useChat";

/** One line per branch of `ModelAccess`, which is the whole of that union. */
const ACCESS_LABELS: Record<AccessKind, string> = {
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
const FAILURE_NOTICES: Record<FailureKind, string> = {
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
const NO_BUDGET_LABELS: Record<Exclude<UsageKind, "bounded">, string> = {
  unknown: "budget unknown",
  unbounded: "no limit",
};

/**
 * The branch until a session is open, and `ready` once one is: however the
 * download branch was reached, a session on the other side of it is ready.
 */
function getStatusLabel(chat: Chat): string {
  if (chat.access === null) return "asking…";
  return chat.ready ? ACCESS_LABELS.ready : ACCESS_LABELS[chat.access];
}

/** Three states, three prompts: nothing here should read as "still loading". */
function getPlaceholder(chat: Chat): string {
  if (chat.ready) return "Ask it something";
  return chat.awaitingDownload
    ? "Waiting on the download"
    : "Opening a session…";
}

function explainFailure(failure: AiFailure): string {
  const notice = FAILURE_NOTICES[failure.kind];
  // Only some kinds carry a detail, and narrowing is what says which.
  return failure.kind === "busy" ? `${notice}: ${failure.detail}` : notice;
}

function Meter({ usage }: { usage: ContextUsage }) {
  if (usage.kind !== "bounded")
    return <span className="meter-text">{NO_BUDGET_LABELS[usage.kind]}</span>;
  const usedShare = Math.min(1, usage.used / usage.total);
  return (
    <span className="meter">
      <span className="meter-bar">
        <span className="meter-fill" style={{ width: `${usedShare * 100}%` }} />
      </span>
      <span className="meter-text">
        {usage.used} / {usage.total}
      </span>
    </span>
  );
}

export function App() {
  const [providerName, setProviderName] = useState<ProviderName>("mock");
  const [draft, setDraft] = useState("");
  const chat = useChat(providerName);
  const isBusy = chat.streamingAnswer !== null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedDraft = draft.trim();
    if (trimmedDraft === "" || isBusy || !chat.ready) return;
    chat.send(trimmedDraft);
    setDraft("");
  };

  return (
    <main>
      <header>
        <h1>modelpact</h1>
        <select
          value={providerName}
          onChange={(event) =>
            setProviderName(event.target.value as ProviderName)
          }
        >
          {PROVIDER_NAMES.map((optionName) => (
            <option key={optionName} value={optionName}>
              {getProviderLabel(optionName)}
            </option>
          ))}
        </select>
        <span className="status">
          <span className="chip">{getStatusLabel(chat)}</span>
          <Meter usage={chat.usage} />
        </span>
        <button type="button" onClick={chat.reset}>
          Reset
        </button>
      </header>

      {chat.awaitingDownload && (
        <p className="notice">
          This backend has no weights on this machine yet.{" "}
          <button type="button" onClick={chat.startDownload}>
            Download them
          </button>
        </p>
      )}
      {chat.downloadProgress !== null && (
        <p className="notice">
          Downloading weights… {Math.round(chat.downloadProgress * 100)}%
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
        {chat.streamingAnswer !== null && (
          <li className="assistant streaming">{chat.streamingAnswer || "…"}</li>
        )}
      </ol>

      {chat.failure !== null && (
        <p className="notice warn">{explainFailure(chat.failure)}</p>
      )}

      <form onSubmit={handleSubmit}>
        <input
          value={draft}
          placeholder={getPlaceholder(chat)}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!chat.ready}
        />
        {isBusy ? (
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

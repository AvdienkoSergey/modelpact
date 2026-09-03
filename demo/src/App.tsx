import { useState, type FormEvent } from "react";
import type { AiFailure, ContextUsage } from "modelpact";

import { PROVIDER_NAMES, labelOf, type ProviderName } from "./providers";
import { useChat } from "./useChat";

/** What each refusal means for the person looking at the screen. */
function explain(failure: AiFailure): string {
  switch (failure.kind) {
    case "aborted":
      return "Stopped. The turn is not in the record, so the words above are gone from it.";
    case "busy":
      return `Already generating: ${failure.detail}`;
    case "context-overflow":
      return "The window is full. Reset, or hand back a shorter conversation.";
    default:
      return `Refused: ${failure.kind}`;
  }
}

function Meter({ usage }: { usage: ContextUsage }) {
  if (usage.kind !== "bounded")
    return <span className="meter-text">{usage.kind}</span>;
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
        <Meter usage={chat.usage} />
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

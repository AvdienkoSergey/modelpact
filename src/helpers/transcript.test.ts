import { describe, expect, test } from "vitest";

import { createTranscript } from "./transcript.js";

describe("transcript", () => {
  test("starts as a copy of what it was seeded with", () => {
    const seed = [{ role: "user" as const, content: "hello" }];
    const transcript = createTranscript(seed);
    expect(transcript.entries()).toEqual(seed);
    expect(transcript.entries()).not.toBe(seed);
  });

  test("a turn is a question and an answer, in that order", () => {
    const transcript = createTranscript();
    transcript.append("Capital of France?", "Paris.");
    expect(transcript.entries()).toEqual([
      { role: "user", content: "Capital of France?" },
      { role: "assistant", content: "Paris." },
    ]);
  });

  test("what was read stays what was read", () => {
    const transcript = createTranscript();
    transcript.append("one", "1");
    const snapshot = transcript.entries();
    transcript.append("two", "2");
    // The array handed out earlier is not the one written to: an app that
    // saved it keeps the conversation as it was at that moment.
    expect(snapshot).toHaveLength(2);
    expect(transcript.entries()).toHaveLength(4);
  });
});

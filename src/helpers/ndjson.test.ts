/**
 * The splitter on its own, fed the chunk boundaries a socket produces and a
 * hand-written test rarely does.
 */

import { describe, expect, test } from "vitest";

import { ndjsonLines } from "./ndjson.js";

/** Feeds the chunks in order and collects everything the stage emitted. */
async function through(chunks: readonly string[]): Promise<string[]> {
  const source = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  const reader = source.pipeThrough(ndjsonLines()).getReader();
  const lines: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return lines;
    lines.push(value);
  }
}

describe("ndjsonLines", () => {
  test("a chunk carrying several lines yields all of them", async () => {
    await expect(through(['{"a":1}\n{"a":2}\n{"a":3}\n'])).resolves.toEqual([
      '{"a":1}',
      '{"a":2}',
      '{"a":3}',
    ]);
  });

  test("a line split across chunks is rejoined", async () => {
    await expect(through(['{"a', '":1}\n{"b":', "2}\n"])).resolves.toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  test("a chunk that ends exactly on a newline leaves no empty line behind", async () => {
    await expect(through(['{"a":1}\n', '{"a":2}\n'])).resolves.toEqual([
      '{"a":1}',
      '{"a":2}',
    ]);
  });

  test("one byte at a time is the same answer", async () => {
    const text = '{"a":1}\n{"b":2}\n';
    await expect(through(Array.from(text))).resolves.toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  test("a body that stops without a trailing newline still yields its last line", async () => {
    // `flush`, and the reason this is a stage and not a `let` in a read loop.
    await expect(through(['{"a":1}\n{"b":2}'])).resolves.toEqual([
      '{"a":1}',
      '{"b":2}',
    ]);
  });

  test("blank lines are dropped, CRLF is left for JSON.parse to eat", async () => {
    const lines = await through(['{"a":1}\r\n\n\n{"b":2}\r\n']);
    expect(lines).toEqual(['{"a":1}\r', '{"b":2}\r']);
    expect(lines.map((line): unknown => JSON.parse(line))).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });

  test("an empty body yields nothing rather than one empty line", async () => {
    await expect(through([])).resolves.toEqual([]);
    await expect(through([""])).resolves.toEqual([]);
  });

  test("a multi-byte character survives being cut in half upstream", async () => {
    // The split TextDecoderStream is there to absorb: the two halves of `Ю`
    // arrive in different network chunks, and this stage sees only decoded
    // text because of it.
    const bytes = new TextEncoder().encode('{"a":"Юникод"}\n');
    const source = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) {
          controller.enqueue(bytes.slice(i, i + 3));
        }
        controller.close();
      },
    });
    const reader = source
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(ndjsonLines())
      .getReader();
    const { value } = await reader.read();
    expect(JSON.parse(value ?? "")).toEqual({ a: "Юникод" });
  });
});

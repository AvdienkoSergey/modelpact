/**
 * The tool against a page made of objects. `innerText` is a layout question
 * and node has no layout, so the root here is the two things the tool reads:
 * a `querySelector` and, on what it returns, an `innerText` or a
 * `textContent`. What is under test is the cutting, the selector handling and
 * that every problem comes back as words rather than a throw.
 */

import { describe, expect, test } from "vitest";

import { makePageTextTool } from "./page-text.js";

interface FakeNode {
  readonly innerText?: string;
  readonly textContent?: string | null;
}

const NEVER_ABORTED = new AbortController().signal;

const makeRoot = (
  text: string,
  parts: Record<string, FakeNode> = {},
): Element =>
  ({
    innerText: text,
    querySelector: (selector: string) => {
      if (selector === "!!") throw new SyntaxError("not a selector");
      return parts[selector] ?? null;
    },
  }) as unknown as Element;

const run = (root: Element, input: Record<string, unknown> = {}) =>
  makePageTextTool({ root }).execute(input, NEVER_ABORTED);

describe("pageText", () => {
  test("reads the visible text of the root, tidied", async () => {
    const root = makeRoot("  modelpact \n\n\n\n one   way to   talk  ");
    expect(await run(root)).toBe("modelpact\n\none way to talk");
  });

  test("reads one element by selector", async () => {
    const root = makeRoot("everything", {
      article: { innerText: "just the article" },
    });
    expect(await run(root, { selector: "article" })).toBe("just the article");
  });

  test("falls back to textContent where there is no innerText", async () => {
    const root = makeRoot("everything", {
      svg: { textContent: "a label in an svg" },
    });
    expect(await run(root, { selector: "svg" })).toBe("a label in an svg");
  });

  test("cuts long text and says how much it cut", async () => {
    const root = makeRoot("x".repeat(100));
    const text = await makePageTextTool({ root, maxChars: 40 }).execute(
      {},
      NEVER_ABORTED,
    );
    expect(text.startsWith("x".repeat(40))).toBe(true);
    expect(text).toContain("[cut: 40 of 100 characters]");
  });

  test("a selector that matches nothing is words, not a throw", async () => {
    expect(await run(makeRoot("page"), { selector: "table" })).toBe(
      'nothing on the page matches "table"',
    );
  });

  test("a selector that is not one is words too", async () => {
    expect(await run(makeRoot("page"), { selector: "!!" })).toBe(
      '"!!" is not a valid CSS selector',
    );
  });

  test("an empty page says so instead of answering nothing", async () => {
    expect(await run(makeRoot("   \n  "))).toBe("the page has no visible text");
  });

  test("the schema takes one optional string and nothing else", () => {
    const tool = makePageTextTool({ root: makeRoot("page") });
    expect(tool.inputSchema).toMatchObject({
      type: "object",
      properties: { selector: { type: "string" } },
      additionalProperties: false,
    });
    expect(tool.inputSchema).not.toHaveProperty("required");
  });
});

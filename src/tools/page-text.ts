/**
 * The page as the model can read it: visible text, cut to a size that leaves
 * the window room for a question and an answer.
 *
 * Eyes, not hands — nothing on the page changes. The one argument is a CSS
 * selector, so the model can narrow to an article or a table once it knows
 * the page; without one it gets the body. Every problem goes back as text
 * rather than a throw: a selector that matches nothing, or is not a selector,
 * is a mistake the model can correct on its next call, and a failed turn is
 * not.
 */

import { jsonSchema, type JsonSchema } from "../types/foundations.js";
import type { Tool } from "../types/tools.js";

export interface PageTextConfig {
  /** Where the text is read from; the document by default. */
  readonly root?: Document | Element;
  /**
   * What the tool hands back at most. The default is small on purpose: one
   * page at full length fills a local model's window on its own, and the
   * Prompt API's is 9 216 tokens, measured.
   */
  readonly maxChars?: number;
}

const DEFAULTS = { maxChars: 4_000 };

const ARGUMENTS: JsonSchema = (() => {
  const shape = jsonSchema({
    type: "object",
    properties: {
      selector: {
        type: "string",
        description:
          "A CSS selector for the part of the page to read. Omit it to read the whole page.",
      },
    },
    additionalProperties: false,
  });
  if (shape === null) throw new Error("the argument shape is not a schema");
  return shape;
})();

/**
 * `innerText` is what a person sees — no hidden nodes, no script — and only an
 * HTML element has it; the document reads through its body, which is null
 * before the parser reaches it. Read as unknown rather than through
 * `instanceof HTMLElement`: that name is not a global in node, where a fake
 * root stands in for the page.
 */
const findBody = (document: Document): Element | null => document.body;

const readVisibleText = (node: Document | Element): string => {
  const element = "body" in node ? findBody(node) : node;
  if (element === null) return "";
  const textFields = element as { innerText?: unknown; textContent?: unknown };
  if (typeof textFields.innerText === "string") return textFields.innerText;
  return typeof textFields.textContent === "string"
    ? textFields.textContent
    : "";
};

const tidyWhitespace = (text: string): string =>
  text
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const cutToFit = (text: string, maxChars: number): string =>
  text.length <= maxChars
    ? text
    : `${text.slice(0, maxChars)}\n…[cut: ${maxChars} of ${text.length} characters]`;

const findTarget = (
  root: Document | Element,
  selector: unknown,
): Document | Element | string => {
  if (selector === undefined || selector === "") return root;
  if (typeof selector !== "string") return "selector must be a string";
  let matched: Element | null;
  try {
    matched = root.querySelector(selector);
  } catch {
    return `"${selector}" is not a valid CSS selector`;
  }
  return matched ?? `nothing on the page matches "${selector}"`;
};

export const makePageTextTool = (config: PageTextConfig = {}): Tool => ({
  name: "pageText",
  description:
    "Read the visible text of the current page, or of the element matching a CSS selector. Long text is cut to fit.",
  inputSchema: ARGUMENTS,
  execute: (input) => {
    const root = config.root ?? document;
    const target = findTarget(root, input.selector);
    if (typeof target === "string") return target;
    const text = tidyWhitespace(readVisibleText(target));
    if (text === "") return "the page has no visible text";
    return cutToFit(text, config.maxChars ?? DEFAULTS.maxChars);
  },
});

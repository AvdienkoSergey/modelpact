/**
 * Two tools, and the one safety idea worth taking from the reference agent.
 *
 * That one resolves every path token out of a shell command and refuses what
 * leaves the trust root — a hundred lines, because its `bash` tool can reach
 * anywhere. These two take a path and nothing else, so containment is a
 * `resolve` and a prefix test, and that is the whole of it. Shipping a shell
 * tool would mean shipping the hundred lines too; this package does not.
 */

import { appendFile, readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { jsonSchema, type JsonSchema } from "modelpact";

import type { Tool } from "./agent.js";

const schemaOf = (shape: Record<string, unknown>): JsonSchema => {
  const built = jsonSchema(shape);
  if (built === null) throw new Error("not a schema");
  return built;
};

const PATH_ARG = schemaOf({
  type: "object",
  properties: { path: { type: "string" } },
  required: ["path"],
  additionalProperties: false,
});

const NO_ARGS = schemaOf({
  type: "object",
  properties: {},
  additionalProperties: false,
});

/** Inside, or refused by name. `..` and an absolute path both land outside and are caught the same way. */
const within = (root: string, asked: unknown): string => {
  if (typeof asked !== "string" || asked === "")
    throw new Error("path must be a non-empty string");
  const full = resolve(root, asked);
  const step = relative(root, full);
  const escapes =
    step.startsWith(`..${sep}`) || step === ".." || step.startsWith(sep);
  if (escapes) throw new Error(`path leaves the workspace: ${asked}`);
  return full;
};

export const readFileTool = (root: string): Tool => ({
  name: "readFile",
  description: "Read a UTF-8 text file inside the workspace. Args: { path }.",
  parameters: PATH_ARG,
  execute: async (args) => {
    const full = within(root, args["path"]);
    const found = await stat(full);
    if (found.isDirectory())
      throw new Error("that is a directory; use listFiles");
    return readFile(full, "utf8");
  },
});

export const listFilesTool = (root: string): Tool => ({
  name: "listFiles",
  description:
    'List the entries of a directory inside the workspace. Args: { path }, "." for the root.',
  parameters: PATH_ARG,
  execute: async (args) => {
    const full = within(root, args["path"] ?? ".");
    const held = await readdir(full, { withFileTypes: true });
    if (held.length === 0) return "(empty)";
    const lines = held.map((one) =>
      one.isDirectory() ? `${one.name}/` : one.name,
    );
    return lines.sort().join("\n");
  },
});

/**
 * The one tool here that changes something, and therefore the one behind the
 * gate. It really appends: a tool that asks permission and then does nothing
 * teaches the opposite of what the gate is for, and it lies to the model —
 * asked to write, told "would write", the model reports back that it wrote.
 *
 * The gate is the safety, and containment is the same `within` the readers use,
 * so the worst an approved call can do is add a line to one file in the
 * workspace.
 */
export const writeNoteTool = (root: string): Tool => ({
  name: "writeNote",
  description: "Append a line to notes.txt in the workspace. Args: { line }.",
  parameters: schemaOf({
    type: "object",
    properties: { line: { type: "string" } },
    required: ["line"],
    additionalProperties: false,
  }),
  needsApproval: true,
  execute: async (args) => {
    const line = args["line"];
    if (typeof line !== "string" || line === "")
      throw new Error("line must be a non-empty string");
    const full = within(root, "notes.txt");
    await appendFile(full, `${line}\n`, "utf8");
    return `appended to notes.txt: ${line}`;
  },
});

/**
 * Every exported name, read from the *emitted* declarations the way a consumer
 * without `@types/node` reads them: `types: []`, `skipLibCheck` off. A node type
 * in a public signature fails here; a node import in a function body does not,
 * because it never reaches the `.d.ts`.
 */
import {
  makeClaudeCliBackend,
  makeClaudeCliProvider,
  makeRouterBackend,
  type ClaudeCliConfig,
  type CloudWhen,
  type Policy,
  type Route,
  type RouterParts,
  type Spawned,
  type Spawner,
} from "../dist/index.js";
export const values = {
  makeClaudeCliBackend,
  makeClaudeCliProvider,
  makeRouterBackend,
};
export type Types = [
  ClaudeCliConfig,
  CloudWhen,
  Policy,
  Route,
  RouterParts,
  Spawned,
  Spawner,
];

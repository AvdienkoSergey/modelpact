/**
 * Every exported name, read from the *emitted* declarations the way a consumer
 * without `@types/node` reads them: `types: []`, `skipLibCheck` off. A node
 * type in a public signature fails here; a node import in a function body does
 * not, because it never reaches the `.d.ts`.
 */
import {
  listFilesTool,
  makeChatBrain,
  makeClaudeCliBackend,
  makeClaudeCliProvider,
  makeSessionBrain,
  orchestrate,
  readFileTool,
  runAgent,
  writeNoteTool,
  type AgentEvent,
  type AgentParts,
  type AgentRun,
  type Answer,
  type AskOptions,
  type Brain,
  type ClaudeCliConfig,
  type Orchestrator,
  type OrchestratorParts,
  type Policy,
  type ResultStatus,
  type Side,
  type Spawned,
  type Spawner,
  type Tool,
} from "../dist/index.js";

export const values = {
  listFilesTool,
  makeChatBrain,
  makeClaudeCliBackend,
  makeClaudeCliProvider,
  makeSessionBrain,
  orchestrate,
  readFileTool,
  runAgent,
  writeNoteTool,
};
export type Types = [
  AgentEvent,
  AgentParts,
  AgentRun,
  Answer,
  AskOptions,
  Brain,
  ClaudeCliConfig,
  Orchestrator,
  OrchestratorParts,
  Policy,
  ResultStatus,
  Side,
  Spawned,
  Spawner,
  Tool,
];

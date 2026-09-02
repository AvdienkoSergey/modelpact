import type { ModelRequest } from "./messages.js";
import type { ModelAccess } from "./session.js";

/**
 * A closed list, and closing it buys something concrete: a provider choice is
 * persisted as a string and comes back as one, so the code that turns it into a
 * provider is a switch that has to stay exhaustive. `src/types.test-d.ts`
 * holds one — add a member without a branch and the build breaks.
 *
 * "mock" is a member on the same footing as the other two, not a fixture
 * bolted on beside them.
 */
export type ProviderName = "prompt-api" | "ollama" | "mock";

export interface AiProvider {
  readonly name: ProviderName;
  /**
   * The single entry point; everything else hangs off the returned access.
   * The request travels with it because it decides the answer: asking whether
   * a model is available without saying what for is meaningless.
   */
  readonly access: (request?: ModelRequest) => Promise<ModelAccess>;
}

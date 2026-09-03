import type { ModelRequest } from "./messages.js";
import type { ModelAccess } from "./session.js";

/**
 * Free-form, because a backend written outside this package names itself and
 * the package cannot know that name in advance.
 *
 * The exhaustive switch a persisted choice needs did not disappear, it moved:
 * an app's registry is the only place the full set is known, and
 * `src/providers/registry.ts` derives the union from it. `src/types.test-d.ts`
 * holds one — add a member without a branch and the build breaks.
 */
export type ProviderName = string;

export interface AiProvider {
  readonly name: ProviderName;
  /**
   * The single entry point; everything else hangs off the returned access.
   * The request travels with it because it decides the answer: asking whether
   * a model is available without saying what for is meaningless.
   */
  readonly access: (request?: ModelRequest) => Promise<ModelAccess>;
}

/** The entry: a backend behind the lifecycle is an `AiProvider`. */

import { checkAccess } from "../lifecycle/01_access.js";
import type { ModelBackend } from "../types/backend.js";
import type { AiProvider } from "../types/provider.js";

export const createProvider = (backend: ModelBackend): AiProvider => ({
  name: backend.name,
  access: (request) => checkAccess(backend, request),
});

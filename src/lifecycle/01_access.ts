/**
 * Stage one: is there a model for this request. `open` is attached only to the
 * branches that can, which is what makes opening an unavailable model
 * unwritable.
 *
 * The backend the stages run on is `../types/backend.ts`; the entry that puts
 * them together is `../providers/create.ts`.
 */

import type { Modality, ModelRequest } from "../types/messages.js";
import type { ModelAccess } from "../types/session.js";
import type { ModelBackend } from "../types/backend.js";
import { openAfterDownload } from "./02_download.js";
import { openSession } from "./03_open.js";

const findUnsupportedModalities = (
  request: ModelRequest,
  supported: readonly Modality[],
): readonly Modality[] => {
  const expectations = [...(request.inputs ?? []), ...(request.outputs ?? [])];
  const modalities = expectations.map((expectation) => expectation.type);
  const unsupported = modalities.filter(
    (modality) => !supported.includes(modality),
  );
  return unsupported;
};

const ignoreProgress = (): void => undefined;

export const checkAccess = async (
  backend: ModelBackend,
  request: ModelRequest = {},
): Promise<ModelAccess> => {
  const unsupportedModalities = findUnsupportedModalities(
    request,
    backend.modalities,
  );
  if (unsupportedModalities.length > 0) {
    return {
      kind: "unavailable",
      reason: {
        kind: "unsupported-config",
        languages: [],
        modalities: unsupportedModalities,
      },
    };
  }
  const availability = await backend.availability(request);
  if (availability.kind === "unavailable") return availability;
  if (availability.kind === "needs-download") {
    return {
      kind: "needs-download",
      started: availability.started,
      open: (subscribe, options) =>
        openAfterDownload(backend, request, subscribe, options),
    };
  }
  return {
    kind: "ready",
    open: (options) => openSession(backend, request, options, ignoreProgress),
  };
};

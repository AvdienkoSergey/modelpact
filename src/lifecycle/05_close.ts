/** Stage five: the closed phase ends the call in flight and refuses the later ones; the model is released on the one close that does it. */

import type { SessionState } from "./03_open.js";

export const closeSession = (state: SessionState): void => {
  const closing = state.lifetime.close();
  if (closing === "already-closed") return;
  state.model.dispose();
};

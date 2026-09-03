import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `modelpact` resolves to the source, not to `dist`: the point of running this
// is to feel the API while changing it, and a build step between the two would
// be paid on every edit. What the published package looks like from outside is
// checked against a packed tarball instead.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      modelpact: fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
});

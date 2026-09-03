import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// No alias for `modelpact`, and none for `modelpact-webgpu`: both are
// dependencies at `file:`, resolved through their own `exports` into `dist`,
// which is what `npm i` hands anyone else. `predev` builds them first. The
// price is that an edit to either needs a rebuild to reach this page, and that
// is the right price: they are developed against their tests, and this is the
// shop window.
export default defineConfig({
  plugins: [react()],
});

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// No alias for `modelpact`: it is a dependency at `file:`, resolved through
// its own `exports` into `dist`, which is what `npm i` hands anyone else.
// `predev` builds it first. The price is that an edit to the package needs a
// rebuild to reach this page, and that is the right price: it is developed
// against its tests, and this is the shop window.
export default defineConfig({
  plugins: [react()],
});

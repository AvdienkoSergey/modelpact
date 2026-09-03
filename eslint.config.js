import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default defineConfig(
  // Vendored MDN copies, patch payloads and build output are not ours to lint.
  // `demo/` joins them: it has its own tsconfig, so the type-aware rules here
  // read it without types and report on what they cannot see — a `let` set
  // from a cleanup closure comes back as "always falsy". `npm run demo:check`
  // is what checks it.
  { ignores: ["dist/**", "demo/**", "external/**", "docs/**", "patches/**"] },
  {
    files: ["**/*.ts", "**/*.js"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      // Last, so it switches off every rule Prettier already decides.
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        // The config files sit outside tsconfig's `include`; without this the
        // type-aware parser refuses to read them at all.
        projectService: { allowDefaultProject: ["*.config.js", "*.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `el.onx = (e) => console.log(e)` is the shape the DOM asks for.
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      // A number in a template literal needs no ceremony; the rule is aimed at
      // objects that stringify to "[object Object]".
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
      // `while (true)` with a `break` is how a stream reader loop is written —
      // see the one in types.test-d.ts, which `for await` cannot replace here.
      "@typescript-eslint/no-unnecessary-condition": [
        "error",
        { allowConstantLoopConditions: true },
      ],
    },
  },
  {
    // Config files are outside tsconfig's `include` (which is just `src`), so
    // tsc never types them and the type-aware rules have nothing to read —
    // `import.meta.dirname` alone comes back as an error type.
    files: ["**/*.config.{js,ts}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // A type-level test is a file whose point is to contain type errors: every
    // line under a `@ts-expect-error` has type `error`, and the type-aware
    // rules read that as unsafe. Turning them off here costs nothing — `tsc`
    // is what actually checks this file, and TS2578 is what makes it a test.
    files: ["**/*.test-d.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      // The `!` is deliberate: a branded constructor returns `T | null`, and
      // the test asserts the brand, not the runtime check.
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // design-sync build output + its staged converter scripts. Both are
    // gitignored, but ESLint's flat config doesn't read .gitignore — without
    // these, `npm run lint` reports ~113 errors and 1400+ warnings from
    // generated bundles, burying the handful that come from our own source.
    "ds-bundle/**",
    ".ds-sync/**",
  ]),
]);

export default eslintConfig;

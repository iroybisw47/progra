import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Tests cover the pure calculation/date layer only (no DB, React, or network).
// The `@/` alias mirrors tsconfig so test imports match app imports.
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});

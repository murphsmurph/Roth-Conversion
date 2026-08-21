import { defineConfig } from "vitest/config";

// Vitest doubles as the test runner; Vite is the bundler for the eventual static UI.
// Dependency budget (CLAUDE.md Rule 8): TypeScript, Vitest, and a bundler. Nothing else.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

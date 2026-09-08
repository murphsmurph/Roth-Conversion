import { defineConfig, configDefaults } from "vitest/config";

// Vitest doubles as the test runner; Vite is the bundler for the eventual static UI.
// Dependency budget (CLAUDE.md Rule 8): TypeScript, Vitest, and a bundler. Nothing else.
//
// The gating suite excludes the Track B PKT runner (tests/packet/pkt.test.ts), which is
// EXPECTED RED until session B1 (see vitest.packet.config.ts / `npm run test:packet`). The Track B
// architecture guards (tests/packet/guards.test.ts) are NOT excluded — they gate.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "tests/packet/pkt.test.ts"],
  },
});

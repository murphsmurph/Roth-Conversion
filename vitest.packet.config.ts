import { defineConfig } from "vitest/config";

// Track B PKT fixture suite — run via `npm run test:packet`. EXPECTED RED until session B1
// (buildPacket is a stub). Kept out of the gating `npm test` run so the validated-engine suite
// stays green; CI runs this step non-gating until the ledger/renderer land.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/packet/pkt.test.ts"],
  },
});

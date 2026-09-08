// PKT fixture runner (Track B, session B0). EXPECTED RED — buildPacket is a stub that throws, so
// every PKT case fails, exactly as the engine did in Phase 0. This proves the ten fixtures exist and
// drive sessions B1-B3; they turn green as the ledger, flags, cross-references and suppression land.
//
// This file is EXCLUDED from the gating `npm test` run and run only via `npm run test:packet`
// (non-gating in CI) until B1, so the validated-engine suite stays green. The guard tests in
// guards.test.ts are separate and DO gate.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { buildPacket } from "../../src/packet/buildPacket";
import type { PacketContext } from "../../src/packet/types";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "packet");
interface Row { id: string; folder: string; title: string }
const index: Row[] = JSON.parse(readFileSync(join(FIX, "INDEX.json"), "utf8"));

describe("fixtures/packet (B0 — expected red until B1)", () => {
  for (const row of index) {
    const f = JSON.parse(readFileSync(join(FIX, `${row.id}.json`), "utf8"));
    it(`${f.id} — ${f.title}`, () => {
      const res = buildPacket(f.input as PacketContext);
      // Design target for B1-B3 (unreached in B0 because buildPacket throws):
      if (f.expected.chrome) expect(res.chrome).toEqual(f.expected.chrome);
      if (f.expected.suppressedSections)
        expect(res.suppressedSections.sort()).toEqual([...f.expected.suppressedSections].sort());
      if (f.expected.sectionStatus)
        for (const [sec, st] of Object.entries(f.expected.sectionStatus))
          expect(res.sectionStatus[sec], `${f.id}:${sec}`).toBe(st);
      if (f.expected.flags)
        for (const id of f.expected.flags as string[])
          expect(res.flags.map(x => x.id)).toContain(id);
    });
  }
});

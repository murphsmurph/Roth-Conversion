/**
 * Packet builder — B0 STUB. Throws NotImplementedError so the PKT fixture suite is red, exactly as
 * the engine threw in Phase 0. The ledger aggregation, section-status derivation, flag evaluation,
 * cross-reference computation and suppression are implemented in sessions B1–B3.
 *
 * Standing rule (CLAUDE.md 8.5): this module never imports src/rules/** or the legacy engine.
 */
import type { PacketContext, SectionStatus, RaisedFlag, CrossReference } from "./types";
import { pageChrome, type PageChrome } from "./outputMode";

export interface PacketResult {
  chrome: PageChrome;
  /** section id -> derived status (never hand-set) */
  sectionStatus: Record<string, SectionStatus>;
  /** sections omitted entirely this run (all not_applicable) */
  suppressedSections: string[];
  flags: RaisedFlag[];
  crossReferences: CrossReference[];
}

export class NotImplementedError extends Error {
  constructor(msg: string) { super(msg); this.name = "NotImplementedError"; }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function buildPacket(ctx: PacketContext): PacketResult {
  // pageChrome is real (B0); everything else awaits B1. Reference it so the dependency is exercised.
  void pageChrome;
  throw new NotImplementedError(
    "buildPacket: ledger aggregation / section status / flags / cross-references not implemented (sessions B1–B3)",
  );
}

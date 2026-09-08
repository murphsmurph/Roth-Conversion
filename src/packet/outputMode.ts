/**
 * Output-mode switch (spec section 2). Pure: given the compliance config, returns the per-page
 * footer label and watermark. No I/O, no imports from src/rules or the legacy engine.
 *
 * - educational (default): a light footer, no watermark, no attestation.
 * - client_delivery: a DRAFT watermark on EVERY page until an approval record exists
 *   (approvedForClientUse === true with a reviewer name and date). The watermark is not something
 *   to flip off to preview the layout — it is the tripwire that attaches the obligations.
 */
import type { ComplianceConfig } from "./types";

export const EDUCATIONAL_FOOTER = "Educational example — not an advisory deliverable.";
export const DRAFT_WATERMARK = "DRAFT — NOT APPROVED FOR CLIENT USE";
export const CLIENT_FOOTER = "Client delivery — approved.";

export interface PageChrome {
  footerLabel: string;
  /** null = no watermark. A string is stamped across every page. */
  watermark: string | null;
}

/** True only when a client_delivery packet has a complete approval record. */
export function isApprovedForClientUse(c: ComplianceConfig): boolean {
  return c.mode === "client_delivery"
    && c.approvedForClientUse === true
    && typeof c.approvedBy === "string" && c.approvedBy.length > 0
    && typeof c.approvedDate === "string" && c.approvedDate.length > 0;
}

export function pageChrome(c: ComplianceConfig): PageChrome {
  if (c.mode === "educational") {
    return { footerLabel: EDUCATIONAL_FOOTER, watermark: null };
  }
  // client_delivery
  return isApprovedForClientUse(c)
    ? { footerLabel: CLIENT_FOOTER, watermark: null }
    : { footerLabel: EDUCATIONAL_FOOTER, watermark: DRAFT_WATERMARK };
}

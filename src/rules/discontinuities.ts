// The enumerated cliff registry (PHASE-0-FIXTURE-SPEC.md §5, CLAUDE-CODE-ADDENDUM.md §3).
//
// A JUMP changes the LEVEL of the cost curve and MUST register here with a rule ID.
// A KINK changes the SLOPE (bracket boundaries, the Social Security phase-in, the
// senior-deduction phaseout). Kinks are continuous and DO NOT belong in this registry.
// Adding a kink here makes the tool report phantom cliffs to clients.
//
// Registry only — no logic in this file.

export const ENUMERATED_DISCONTINUITIES = [
  'ACA_36B_400FPL_CLIFF',
  'IRMAA_TIER_1',
  'IRMAA_TIER_2',
  'IRMAA_TIER_3',
  'IRMAA_TIER_4',
  'IRMAA_TIER_5',
] as const;

export type DiscontinuityId = (typeof ENUMERATED_DISCONTINUITIES)[number];

export function isEnumeratedDiscontinuity(id: string): id is DiscontinuityId {
  return (ENUMERATED_DISCONTINUITIES as readonly string[]).includes(id);
}

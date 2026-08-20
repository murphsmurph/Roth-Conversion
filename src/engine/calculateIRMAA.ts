// IRMAA surcharge — 2-year MAGI lookback, inclusive tier boundaries, per enrollee.
// Session 0: signature only. Body implemented in Phase 2.
import type { FilingStatus, IrmaaResult, MagiIrmaa } from "./types";
import { NotImplementedError } from "./notImplemented";

export function calculateIrmaa(
  _magiIrmaa: MagiIrmaa,
  _status: FilingStatus,
  _enrolled: number,
): IrmaaResult {
  throw new NotImplementedError("calculateIrmaa");
}

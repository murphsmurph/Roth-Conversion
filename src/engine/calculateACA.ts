// ACA premium tax credit 400% FPL cliff — a first-class modeled cost (addendum §2.1).
// Session 0: signature only. Body implemented in Phase 2.
import type { AcaResult, MagiAca } from "./types";
import { NotImplementedError } from "./notImplemented";

export function calculateAca(_magiAca: MagiAca, _householdSize: number): AcaResult {
  throw new NotImplementedError("calculateAca");
}

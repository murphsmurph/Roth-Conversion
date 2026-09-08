/**
 * COMPILE-TIME GUARD (Track B, session B1a — INH-02 / IRC 1014(c)).
 *
 * The `ird_no_stepup` branch of BasisModel has NO `taxBasis` field. This file proves it: the
 * `@ts-expect-error` below fires on the excess `taxBasis` property. If anyone adds `taxBasis` to the
 * IRD branch, the error disappears, the directive becomes "unused", and `tsc --noEmit` (npm run
 * typecheck) FAILS. Copying a date-of-death value into basis on income in respect of a decedent is a
 * compile error, not a bug caught in review. This file is type-only; it exports and runs nothing.
 */
import type { BasisModel } from "./types";
import type { Sourced } from "../ledger/types";

const u = <T>(): Sourced<T> => ({ state: "unknown", value: null });

const _irdHasNoTaxBasis: Extract<BasisModel, { stepUpRegime: "ird_no_stepup" }> = {
  stepUpRegime: "ird_no_stepup",
  valueAtDeath: u<number>(),
  decedentAfterTaxBasis: u<number>(),
  section691cDeductionAvailable: u<boolean>(),
  federalEstateTaxPaidOnIRD: u<number>(),
  // @ts-expect-error - taxBasis is not a member of the ird_no_stepup branch (IRC 1014(c))
  taxBasis: u<number>(),
};
void _irdHasNoTaxBasis;

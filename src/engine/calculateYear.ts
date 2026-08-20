// Single-year federal calculation — the frozen R4 order of operations.
// Session 0: signature and output shape only. Body implemented in Phase 2.
import type { YearInput, YearResult } from "./types";
import { NotImplementedError } from "./notImplemented";

export function computeYear(_input: YearInput): YearResult {
  throw new NotImplementedError("computeYear");
}

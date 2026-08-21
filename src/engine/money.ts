// Round to cents, half-up for non-negative money (matches the oracle's Decimal ROUND_HALF_UP
// over the ranges this engine handles). Uses only the allowed literal 100.
export const cents = (x: number): number => Math.round(x * 100) / 100;

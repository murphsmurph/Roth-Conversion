// State income tax — v1 FLAT-RATE resolver. The nine no-income-tax states resolve to 0 on ordinary
// income (including Roth conversions); every other state requires an ADVISOR-SUPPLIED effective
// marginal rate. The engine NEVER guesses a state's rate or brackets (CLAUDE.md Rule 4): when no rate
// is supplied for a taxing state, it returns 0 but flags state tax as NOT MODELED so the caller can
// disclose that rather than silently under-taxing. All rates come from the caller or the rules file,
// so this module holds no magic numbers of its own.
import { noIncomeTaxStates, stateDefaultRate, STATE_RULE_ID } from "./rules";

export interface StateTaxInput {
  stateCode: string | null;             // e.g. "TX"; null/"" = unspecified
  advisorMarginalRate: number | null;   // effective marginal rate for a taxing state (0..1)
}

export type StateBasis =
  | "no_income_tax_state"       // one of the nine — modeled at 0
  | "advisor_supplied"          // advisor gave an effective marginal rate — modeled
  | "unspecified_default_zero"; // taxing state but no rate supplied — NOT modeled, defaulted to 0

export interface StateTaxResolution {
  rate: number;
  basis: StateBasis;
  modeled: boolean;
  ruleId: string;
  note: string;
}

// Resolve the flat ordinary-income state rate for a household without ever guessing a rate.
export function resolveStateOrdinaryRate(input: StateTaxInput): StateTaxResolution {
  const code = input.stateCode ? input.stateCode.trim().toUpperCase() : null;
  const ruleId = STATE_RULE_ID;

  if (code && noIncomeTaxStates().includes(code)) {
    return {
      rate: stateDefaultRate(), basis: "no_income_tax_state", modeled: true, ruleId,
      note: `${code} has no broad-based personal income tax in 2026 (0% on ordinary income and Roth conversions).`,
    };
  }
  if (input.advisorMarginalRate !== null && input.advisorMarginalRate >= 0) {
    return {
      rate: input.advisorMarginalRate, basis: "advisor_supplied", modeled: true, ruleId,
      note: "Flat advisor-supplied effective marginal state rate applied to incremental ordinary income. Per-state brackets, retirement-income exclusions, and state SS/conversion rules are not modeled (v1).",
    };
  }
  return {
    rate: stateDefaultRate(), basis: "unspecified_default_zero", modeled: false, ruleId,
    note: code
      ? `No effective marginal rate was supplied for ${code}; state tax is NOT MODELED and defaulted to 0. The engine does not guess state rates (Rule 4). Supply the household's effective marginal state rate to model it.`
      : "No state specified; state tax is NOT MODELED (defaulted to 0). Supply a state code and/or an effective marginal rate to model it.",
  };
}

// Flat state tax on an incremental ordinary amount (conversion or withdrawal).
export function stateTaxOnOrdinary(ordinaryAmount: number, rate: number): number {
  return Math.max(0, ordinaryAmount) * rate;
}

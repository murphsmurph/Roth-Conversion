// Engine barrel. Public entry points the test harness and the UI import.
export * from "./types";
export { computeYear } from "./calculateYear";
export { rmdApplicableAge, rmdAmount, rmdOrdering } from "./calculateRMD";
export { calculateIrmaa } from "./calculateIRMAA";
export { calculateAca } from "./calculateACA";
export { sweepConversion, type SweepOpts, type SweepResult, type SweepStep, type Crossing } from "./sweepConversion";
export { projectLifetime, crossoverYear, type LifetimeInput, type LifetimeResult, type LifetimeRow, type LifetimeSpouse } from "./projectLifetime";
export { optimizeConversion, type OptimizerOpts, type OptimizerResult, type SensitivityRow } from "./optimizeConversion";
export { resolveStateOrdinaryRate, stateTaxOnOrdinary, type StateTaxInput, type StateTaxResolution } from "./calculateState";
export { calculationMetadata, ENGINE_VERSION, noIncomeTaxStates } from "./rules";

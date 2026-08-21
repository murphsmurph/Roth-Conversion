// Phase 0: the engine is deliberately unimplemented. Every entry point throws this,
// so the fixture suite runs and is ALL RED — which is the Phase 0 success condition.
// No numeric literals here (the magic-number CI check scans src/engine/**).
export class NotImplementedError extends Error {
  constructor(fn: string) {
    super(`${fn} is not implemented yet — engine logic lands in Phase 1+ (see CLAUDE.md §5).`);
    this.name = "NotImplementedError";
  }
}

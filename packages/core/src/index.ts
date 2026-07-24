// @sopscape/core — orchestration, lifecycle, budget, projections, persistence
export { CORE_VERSION } from './version.js';
export {
  isValidTransition,
  applyDecision,
  type LifecycleState,
  type VersionedState,
  type DecisionSuccess,
  type DecisionConflict,
} from './lifecycle.js';
export { AttemptBudget } from './attempt-budget.js';
export {
  startGeneration,
  FakeProvider,
  SlowFakeProvider,
  type GenerationResult,
  type GenerationOptions,
  type GenerationProgress,
  type CouncilResult,
  type LLMConfig,
} from './generate.js';
export {
  LLMProvider,
  parseAgentRole,
  parseFinding,
} from './llm-provider.js';

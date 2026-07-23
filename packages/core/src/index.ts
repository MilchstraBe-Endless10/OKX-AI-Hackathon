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
  type GenerationResult,
  type GenerationOptions,
  type GenerationProgress,
  type CouncilResult,
} from './generate.js';
export { LLMProvider, type LLMConfig } from './llm-provider.js';
export { FakeProvider, SlowFakeProvider } from './generate-fake.js';
export { generateScenario, type ScenarioGenerationConfig } from './scenario-generator.js';

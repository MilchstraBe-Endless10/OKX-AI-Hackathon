// @sopscape/core — orchestration: FakeProvider + LLMProvider with partial failure handling
// ponytail: minimal orchestration — LLMProvider is optional, FakeProvider is default.
// Fixed order: 3 specialists parallel → moderator → persist.
// Partial failure: < 3 specialists → PARTIAL_FAILED, no moderator, no decision nodes.

import {
  CouncilResultSchema,
  SopInputSchema,
  type CouncilResult,
  type Finding,
  type AgentRole,
} from '@sopscape/contracts';
import { AttemptBudget } from './attempt-budget.js';
import { LifecycleState } from './lifecycle.js';
import { LLMProvider, type LLMConfig, parseFinding } from './llm-provider.js';

export type { CouncilResult, LLMConfig };

export interface GenerationResult {
  rehearsalId: string;
  status: LifecycleState;
  council?: CouncilResult;
  partialFindings?: Finding[];
  failedRoles?: AgentRole[];
  error?: string;
}

export interface GenerationOptions {
  progressSink?: (event: { phase: LifecycleState }) => void;
  signal?: AbortSignal;
  llm?: LLMConfig; // provide for real model calls
}

export interface GenerationProgress {
  phase: LifecycleState;
}

/**
 * startGeneration — the Core API entry point.
 * Uses FakeProvider by default; pass llm config for real model calls.
 */
export async function startGeneration(
  input: { title: string; content: string; locale?: string },
  options?: GenerationOptions,
): Promise<GenerationResult> {
  const llmConfig = options?.llm;
  if (llmConfig?.apiKey && llmConfig.baseUrl && llmConfig.modelName) {
    return runRealProvider(input, llmConfig, options);
  }
  return runFakeProvider(input, options);
}

// ─── Real LLM Provider ───────────────────────────────────────────

async function runRealProvider(
  input: { title: string; content: string; locale?: string },
  llmConfig: LLMConfig,
  options?: GenerationOptions,
): Promise<GenerationResult> {
  const { progressSink, signal } = options ?? {};

  if (signal?.aborted) {
    return { rehearsalId: genId(), status: 'CANCELLED', error: 'ABORTED' };
  }

  const parsed = SopInputSchema.safeParse(input);
  if (!parsed.success) {
    return { rehearsalId: genId(), status: 'FAILED', error: 'VALIDATION_ERROR' };
  }

  const rehearsalId = genId();
  const budget = new AttemptBudget({ compression: false });
  const provider = new LLMProvider(llmConfig);

  emit(progressSink, 'QUEUED');
  emit(progressSink, 'SPECIALISTS_RUNNING');

  // Run specialists with retry via LLMProvider
  const { successes, failures } = await provider.runSpecialists(input, signal);

  // Track budget for successful specialist attempts
  for (const s of successes) {
    try {
      budget.startAttempt(s.role);
    } catch {
      // budget exceeded but we already have the result
    }
  }

  if (signal?.aborted) {
    return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
  }

  // Partial failure: not all 3 specialists succeeded
  if (successes.length < 3) {
    const failedRoles = failures.map((f) => f.role);
    return {
      rehearsalId,
      status: 'PARTIAL_FAILED',
      partialFindings: successes.map((s) => s.finding),
      failedRoles,
      error: `Specialist(s) failed: ${failedRoles.join(', ')}`,
    };
  }

  // All 3 succeeded → proceed to moderator
  emit(progressSink, 'MODERATING');

  try {
    budget.startAttempt('moderator');
  } catch {
    return { rehearsalId, status: 'FAILED', error: 'BUDGET_EXCEEDED' };
  }

  const findings = successes.map((s) => s.finding);
  const council = await provider.runModerator(findings, signal);

  if (!council) {
    // Moderator failed but specialists succeeded → partial
    return {
      rehearsalId,
      status: 'PARTIAL_FAILED',
      partialFindings: findings,
      failedRoles: ['moderator'],
      error: 'Moderator failed to produce valid council result',
    };
  }

  const councilValid = CouncilResultSchema.safeParse(council);
  if (!councilValid.success) {
    return {
      rehearsalId,
      status: 'PARTIAL_FAILED',
      partialFindings: findings,
      failedRoles: ['moderator'],
      error: 'Moderator result validation failed',
    };
  }

  emit(progressSink, 'PERSISTING');
  emit(progressSink, 'READY');

  return { rehearsalId, status: 'READY', council: councilValid.data };
}

// ─── Fake Provider (test fixtures) ───────────────────────────────

async function runFakeProvider(
  input: { title: string; content: string; locale?: string },
  options?: GenerationOptions,
): Promise<GenerationResult> {
  const provider = new FakeProvider();
  return provider.run(input, options);
}

/**
 * FakeProvider produces deterministic CouncilResult fixtures.
 * No real model calls.
 */
export class FakeProvider {
  private failRole?: string;
  readonly execOrder: string[] = [];

  setFailRole(role: string): void {
    this.failRole = role;
  }

  async run(
    input: { title: string; content: string; locale?: string },
    options?: GenerationOptions,
  ): Promise<GenerationResult> {
    const { progressSink, signal } = options ?? {};

    if (signal?.aborted) {
      return { rehearsalId: genId(), status: 'CANCELLED', error: 'ABORTED' };
    }

    const parsed = SopInputSchema.safeParse(input);
    if (!parsed.success) {
      return { rehearsalId: genId(), status: 'FAILED', error: 'VALIDATION_ERROR' };
    }

    const rehearsalId = genId();
    const budget = new AttemptBudget({ compression: false });

    emit(progressSink, 'QUEUED');
    emit(progressSink, 'SPECIALISTS_RUNNING');

    const roles = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;

    let specialists: Array<{
      role: (typeof roles)[number];
      finding: Finding;
    }>;
    try {
      const specialistResults = await Promise.all(
        roles.map((role) =>
          (async () => {
            budget.startAttempt(role);
            if (this.failRole === role) {
              throw new Error('PROVIDER_FAILURE');
            }
            return {
              role,
              finding: makeFixtureFinding(role, input.title),
            };
          })(),
        ),
      );
      specialists = specialistResults;
    } catch {
      return { rehearsalId, status: 'FAILED', error: 'SPECIALIST_FAILED' };
    }
    this.execOrder.push('specialists-parallel');

    if (signal?.aborted) {
      return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
    }

    emit(progressSink, 'MODERATING');

    try {
      budget.startAttempt('moderator');
    } catch {
      return { rehearsalId, status: 'FAILED', error: 'BUDGET_EXCEEDED' };
    }

    const council: CouncilResult = {
      consensus: specialists.map((s) => s.finding),
      disagreements: [],
      evidenceGaps: [],
      recommendedPath: ['verify', 'report'],
      decisionNodes: [
        {
          id: 'action',
          prompt: '如何处理此 SOP？',
          options: [
            { id: 'execute', label: '执行', consequence: 'done' },
            { id: 'review', label: '复核后执行', consequence: 'verified' },
          ],
        },
      ],
    };

    const councilParsed = CouncilResultSchema.safeParse(council);
    if (!councilParsed.success) {
      return { rehearsalId, status: 'FAILED', error: 'COUNCIL_VALIDATION_FAILED' };
    }

    this.execOrder.push('moderator');

    emit(progressSink, 'PERSISTING');
    emit(progressSink, 'READY');

    return { rehearsalId, status: 'READY', council };
  }
}

/**
 * SlowFakeProvider — test-only variant that delays execution for deadline testing.
 */
export class SlowFakeProvider extends FakeProvider {
  private delayMs: number;

  constructor(delayMs: number = 100) {
    super();
    this.delayMs = delayMs;
  }

  override async run(
    input: { title: string; content: string; locale?: string },
    options?: GenerationOptions,
  ): Promise<GenerationResult> {
    const { progressSink, signal } = options ?? {};

    if (signal?.aborted) {
      return { rehearsalId: genId(), status: 'CANCELLED', error: 'ABORTED' };
    }

    const parsed = SopInputSchema.safeParse(input);
    if (!parsed.success) {
      return { rehearsalId: genId(), status: 'FAILED', error: 'VALIDATION_ERROR' };
    }

    const rehearsalId = genId();

    emit(progressSink, 'QUEUED');
    emit(progressSink, 'SPECIALISTS_RUNNING');

    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    if (signal?.aborted) {
      return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
    }

    const roles = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;

    const specialists = roles.map((role) => ({
      role,
      finding: makeFixtureFinding(role, input.title),
    }));

    emit(progressSink, 'MODERATING');

    const council: CouncilResult = {
      consensus: specialists.map((s) => s.finding),
      disagreements: [],
      evidenceGaps: [],
      recommendedPath: ['verify', 'report'],
      decisionNodes: [
        {
          id: 'action',
          prompt: '如何处理此 SOP？',
          options: [
            { id: 'execute', label: '执行', consequence: 'done' },
            { id: 'review', label: '复核后执行', consequence: 'verified' },
          ],
        },
      ],
    };

    const councilParsed = CouncilResultSchema.safeParse(council);
    if (!councilParsed.success) {
      return { rehearsalId, status: 'FAILED', error: 'COUNCIL_VALIDATION_FAILED' };
    }

    emit(progressSink, 'PERSISTING');
    emit(progressSink, 'READY');

    return { rehearsalId, status: 'READY', council };
  }
}

function emit(
  sink: ((e: { phase: LifecycleState }) => void) | undefined,
  phase: LifecycleState,
): void {
  sink?.({ phase });
}

let counter = 0;
function genId(): string {
  counter += 1;
  return `r-${Date.now()}-${counter}`;
}

function makeFixtureFinding(role: string, title: string): Finding {
  return {
    role: role as Finding['role'],
    claim: `${role} analysis of: ${title}`,
    evidenceRefs: ['step-1'],
    confidence: 0.85,
    severity: 'medium',
    affectedStepIds: ['step-1'],
    unsupported: false,
  };
}

export { isValidTransition } from './lifecycle.js';
export { applyDecision, type VersionedState, type LifecycleState } from './lifecycle.js';
export { AttemptBudget } from './attempt-budget.js';

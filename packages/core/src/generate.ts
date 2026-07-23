// @sopscape/core — orchestration: startGeneration with real LLM provider
// ponytail: minimal orchestration — LLMProvider for real calls, FakeProvider for tests.
// Fixed order: 3 specialists parallel → moderator → persist.

import {
  CouncilResultSchema,
  SopInputSchema,
  type CouncilResult,
  type Finding,
} from '@sopscape/contracts';
import { AttemptBudget } from './attempt-budget.js';
import { LifecycleState } from './lifecycle.js';
import { LLMProvider, type LLMConfig } from './llm-provider.js';

export type { CouncilResult };

export interface GenerationResult {
  rehearsalId: string;
  status: LifecycleState;
  council?: CouncilResult;
  error?: string;
}

export interface GenerationOptions {
  progressSink?: (event: { phase: LifecycleState }) => void;
  signal?: AbortSignal;
  /** LLM config — if omitted, uses FakeProvider (for tests). */
  llm?: LLMConfig;
}

export interface GenerationProgress {
  phase: LifecycleState;
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

/**
 * startGeneration — the Core API entry point.
 * Uses LLMProvider when llm config is provided, FakeProvider otherwise (for tests).
 * Preserves AttemptBudget, AbortSignal, and Schema validation.
 */
export async function startGeneration(
  input: { title: string; content: string; locale?: string },
  options?: GenerationOptions,
): Promise<GenerationResult> {
  const { progressSink, signal, llm } = options ?? {};

  // Check abort before starting
  if (signal?.aborted) {
    return { rehearsalId: genId(), status: 'CANCELLED', error: 'ABORTED' };
  }

  // Validate input at schema level
  const parsed = SopInputSchema.safeParse(input);
  if (!parsed.success) {
    return { rehearsalId: genId(), status: 'FAILED', error: 'VALIDATION_ERROR' };
  }

  const rehearsalId = genId();
  const budget = new AttemptBudget({ compression: false });

  // QUEUED
  emit(progressSink, 'QUEUED');

  // SPECIALISTS_RUNNING — 3 parallel
  emit(progressSink, 'SPECIALISTS_RUNNING');

  try {
    if (llm) {
      // Real LLM provider path
      const provider = new LLMProvider(llm);
      const findings = await provider.runSpecialists(input, budget, signal);

      if (signal?.aborted) {
        return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
      }

      // MODERATING
      emit(progressSink, 'MODERATING');

      const moderation = await provider.runModerator(findings, budget, signal);
      const council: CouncilResult = {
        consensus: moderation.consensus,
        disagreements: moderation.disagreements,
        evidenceGaps: moderation.evidenceGaps,
        recommendedPath: moderation.recommendedPath,
        decisionNodes: moderation.decisionNodes,
      };

      // Validate council result
      const councilParsed = CouncilResultSchema.safeParse(council);
      if (!councilParsed.success) {
        console.error(
          'Council validation failed:',
          JSON.stringify(councilParsed.error.issues, null, 2),
        );
        console.error('Raw council:', JSON.stringify(council, null, 2));
        return { rehearsalId, status: 'FAILED', error: 'COUNCIL_VALIDATION_FAILED' };
      }

      // PERSISTING
      emit(progressSink, 'PERSISTING');

      // READY
      emit(progressSink, 'READY');

      return { rehearsalId, status: 'READY', council };
    }

    // FakeProvider path (for tests — no LLM config)
    const roles = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;

    const specialists = await Promise.all(
      roles.map(async (role) => {
        budget.startAttempt(role);
        return {
          role,
          finding: makeFixtureFinding(role, input.title),
        };
      }),
    );

    if (signal?.aborted) {
      return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
    }

    // MODERATING
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

    // Validate council result
    const councilParsed = CouncilResultSchema.safeParse(council);
    if (!councilParsed.success) {
      return { rehearsalId, status: 'FAILED', error: 'COUNCIL_VALIDATION_FAILED' };
    }

    // PERSISTING
    emit(progressSink, 'PERSISTING');

    // READY
    emit(progressSink, 'READY');

    return { rehearsalId, status: 'READY', council };
  } catch (error) {
    return {
      rehearsalId,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    };
  }
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

// Re-exports for tests
export { FakeProvider, SlowFakeProvider } from './generate-fake.js';

export { isValidTransition } from './lifecycle.js';
export { applyDecision, type VersionedState, type LifecycleState } from './lifecycle.js';
export { AttemptBudget } from './attempt-budget.js';
export { LLMProvider, type LLMConfig } from './llm-provider.js';

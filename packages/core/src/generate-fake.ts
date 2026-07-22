// @sopscape/core — FakeProvider for tests (no LLM calls)
// Separate file to avoid circular deps with generate.ts

import {
  CouncilResultSchema,
  SopInputSchema,
  type CouncilResult,
  type Finding,
} from '@sopscape/contracts';
import { AttemptBudget } from './attempt-budget.js';
import { LifecycleState } from './lifecycle.js';
import type { GenerationOptions, GenerationResult } from './generate.js';

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

/**
 * FakeProvider produces deterministic CouncilResult fixtures.
 * No real model calls. Used only in tests.
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

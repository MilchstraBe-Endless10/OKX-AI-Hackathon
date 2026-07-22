// @sopscape/core — orchestration: startGeneration with fixture-driven FakeProvider
// ponytail: minimal orchestration — no real model, no DB, no MCP.
// Fixed order: 3 specialists parallel → moderator → persist.

import {
  CouncilResultSchema,
  SopInputSchema,
  type CouncilResult,
  type Finding,
} from '@sopscape/contracts';
import { AttemptBudget } from './attempt-budget.js';
import { LifecycleState } from './lifecycle.js';

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
}

export interface GenerationProgress {
  phase: LifecycleState;
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

    const roles = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;

    // Run specialists in parallel — fail-fast if any throws
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

    this.execOrder.push('moderator');

    // PERSISTING
    emit(progressSink, 'PERSISTING');

    // READY
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

    // QUEUED
    emit(progressSink, 'QUEUED');

    // SPECIALISTS_RUNNING — 3 parallel (with delay)
    emit(progressSink, 'SPECIALISTS_RUNNING');

    // Artificial delay to test deadline
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));

    // Check abort after delay
    if (signal?.aborted) {
      return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
    }

    // Rest of the flow is the same as FakeProvider
    const roles = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;

    const specialists = roles.map((role) => ({
      role,
      finding: makeFixtureFinding(role, input.title),
    }));

    // MODERATING
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

    // PERSISTING
    emit(progressSink, 'PERSISTING');

    // READY
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

/**
 * startGeneration — the Core API entry point.
 * Uses FakeProvider for this vertical slice; replace with real provider later.
 */
export async function startGeneration(
  input: { title: string; content: string; locale?: string },
  options?: GenerationOptions,
): Promise<GenerationResult> {
  const provider = new FakeProvider();
  return provider.run(input, options);
}

export { isValidTransition } from './lifecycle.js';
export { applyDecision, type VersionedState, type LifecycleState } from './lifecycle.js';
export { AttemptBudget } from './attempt-budget.js';

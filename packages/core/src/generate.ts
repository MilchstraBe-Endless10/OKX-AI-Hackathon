// @sopscape/core — orchestration: real LLM provider with partial failure handling
// ponytail: minimal orchestration — LLMProvider with retry/fallback, FakeProvider for tests.
// Sequential: specialists run one-by-one to avoid burst QPS → rate limits.
// Partial failure: < 3 specialists → PARTIAL_FAILED, no moderator, no decision nodes.

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
  originalRehearsalId?: string; // preserved from retry
  status: LifecycleState;
  council?: CouncilResult;
  partialFindings?: Finding[];
  failedRoles?: Array<'procedure-analyst' | 'risk-challenger' | 'evidence-auditor' | 'moderator'>;
  error?: string;
}

export interface GenerationOptions {
  progressSink?: (event: { phase: LifecycleState }) => void;
  signal?: AbortSignal;
  /** LLM config — if omitted, uses FakeProvider (for tests). */
  llm?: LLMConfig;
  /** Selective retry: already-successful findings to merge with retry results */
  savedFindings?: Finding[];
  /** Selective retry: which roles failed and need retrying */
  failedRoles?: Array<'procedure-analyst' | 'risk-challenger' | 'evidence-auditor'>;
  /** Override rehearsal ID (used for retry to preserve original ID) */
  rehearsalId?: string;
}

export interface GenerationProgress {
  phase: LifecycleState;
}

const ALL_SPECIALIST_ROLES = ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const;
type Role = (typeof ALL_SPECIALIST_ROLES)[number];

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
 * Handles partial failure, selective retry, and merge of saved findings.
 */
export async function startGeneration(
  input: { title: string; content: string; locale?: string },
  options?: GenerationOptions,
): Promise<GenerationResult> {
  const {
    progressSink,
    signal,
    llm,
    savedFindings,
    failedRoles,
    rehearsalId: overrideRehearsalId,
  } = options ?? {};
  const isRetry = savedFindings !== undefined && savedFindings.length > 0;

  if (signal?.aborted) {
    return {
      rehearsalId: overrideRehearsalId ?? genId(),
      originalRehearsalId: overrideRehearsalId,
      status: 'CANCELLED',
      error: 'ABORTED',
    };
  }

  const parsed = SopInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      rehearsalId: overrideRehearsalId ?? genId(),
      originalRehearsalId: overrideRehearsalId,
      status: 'FAILED',
      error: 'VALIDATION_ERROR',
    };
  }

  const rehearsalId = overrideRehearsalId ?? genId();
  const budget = new AttemptBudget({ compression: false });

  emit(progressSink, 'QUEUED');
  emit(progressSink, 'SPECIALISTS_RUNNING');

  let findings: Finding[];

  if (isRetry && failedRoles && failedRoles.length > 0 && llm) {
    // Selective retry: only retry failed specialists, merge with saved findings
    const retryRoles = ALL_SPECIALIST_ROLES.filter((r) =>
      (failedRoles as string[]).includes(r),
    ) as readonly Role[];

    const provider = new LLMProvider(llm);
    const { successes, failures } = await provider.runSpecialistsForRoles(
      retryRoles,
      input,
      signal,
    );

    if (signal?.aborted) {
      return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
    }

    // Track budget for successful retries
    for (const s of successes) {
      try {
        budget.startAttempt(s.role);
      } catch {
        // budget exceeded but we already have the result
      }
    }

    // If retry also fails, return PARTIAL_FAILED with saved findings + remaining failures
    if (failures.length > 0) {
      return {
        rehearsalId,
        status: 'PARTIAL_FAILED',
        partialFindings: savedFindings,
        failedRoles: [...savedFindings.map((f) => f.role), ...failures.map((f) => f.role)],
        error: `Retry failed for: ${failures.map((f) => f.role).join(', ')}`,
      };
    }

    // All retried specialists succeeded — merge with saved findings
    const merged = [...savedFindings];
    for (const s of successes) {
      const idx = merged.findIndex((f) => f.role === s.role);
      if (idx >= 0) {
        // Replace old saved finding with new retry result
        merged[idx] = s.finding;
      } else {
        merged.push(s.finding);
      }
    }
    findings = merged;
  } else if (llm) {
    // Real LLM provider — full generation with per-specialist retry/fallback
    const provider = new LLMProvider(llm);
    const { successes, failures } = await provider.runSpecialists(input, budget, signal);

    if (signal?.aborted) {
      return { rehearsalId, status: 'CANCELLED', error: 'ABORTED' };
    }

    // Partial failure: < 3 valid specialists → PARTIAL_FAILED, no moderator
    if (successes.length < 3) {
      return {
        rehearsalId,
        status: 'PARTIAL_FAILED',
        partialFindings: successes.map((s) => s.finding),
        failedRoles: failures.map((f) => f.role),
        error: `Specialist(s) failed: ${failures.map((f) => f.role).join(', ')}`,
      };
    }

    findings = successes.map((s) => s.finding);
  } else {
    // FakeProvider path (for tests — no LLM config)
    const roles = ALL_SPECIALIST_ROLES;

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

    findings = specialists.map((s) => s.finding);
  }

  // All 3 findings available → proceed to moderator
  emit(progressSink, 'MODERATING');

  try {
    budget.startAttempt('moderator');
  } catch {
    return { rehearsalId, status: 'FAILED', error: 'BUDGET_EXCEEDED' };
  }

  let council: CouncilResult | null = null;

  if (llm) {
    const provider = new LLMProvider(llm);
    const findingsMap: Record<Role, Finding> = {} as Record<Role, Finding>;
    for (const f of findings) {
      if (ALL_SPECIALIST_ROLES.includes(f.role as Role)) {
        findingsMap[f.role as Role] = f;
      }
    }
    council = await provider.runModerator(findingsMap, budget, signal);
  } else {
    // Fake provider council
    council = {
      consensus: findings,
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
  }

  if (!council) {
    return {
      rehearsalId,
      status: 'PARTIAL_FAILED',
      partialFindings: findings,
      failedRoles: ['moderator'],
      error: 'Moderator failed to produce valid council result',
    };
  }

  // Validate council result
  const councilParsed = CouncilResultSchema.safeParse(council);
  if (!councilParsed.success) {
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

  return { rehearsalId, status: 'READY', council: councilParsed.data };
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

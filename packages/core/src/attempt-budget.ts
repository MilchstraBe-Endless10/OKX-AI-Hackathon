// @sopscape/core — provider attempt budget tracking
// ponytail: caps defined here — shared across all provider call sites.

const SPECIALIST_CAP = 1200;
const MODERATOR_CAP = 2000;
const COMPRESSION_CAP = 1200;

type Role = 'procedure-analyst' | 'risk-challenger' | 'evidence-auditor' | 'moderator' | 'compress';

const ROLE_MAX_ATTEMPTS: Record<Role, number> = {
  'procedure-analyst': 2,
  'risk-challenger': 2,
  'evidence-auditor': 2,
  moderator: 2,
  compress: 1,
};

const ROLE_CAP: Record<Role, number> = {
  'procedure-analyst': SPECIALIST_CAP,
  'risk-challenger': SPECIALIST_CAP,
  'evidence-auditor': SPECIALIST_CAP,
  moderator: MODERATOR_CAP,
  compress: COMPRESSION_CAP,
};

/**
 * Tracks provider attempt budget for one generation job.
 *
 * With compression: 9 calls / 12,400 output tokens
 *   - 1 compression × 1,200
 *   - 3 specialists × 2 attempts × 1,200 = 7,200
 *   - 1 moderator × 2 attempts × 2,000 = 4,000
 *
 * Without compression: 8 calls / 11,200 output tokens
 */
export class AttemptBudget {
  private attempts: Map<Role, number> = new Map();
  readonly maxCalls: number;
  readonly maxOutputTokens: number;

  constructor(opts: { compression: boolean }) {
    this.maxCalls = opts.compression ? 9 : 8;
    this.maxOutputTokens = opts.compression ? 12_400 : 11_200;
  }

  get remainingCalls(): number {
    return this.maxCalls - this.totalAttempts;
  }

  get remainingOutputTokens(): number {
    return this.maxOutputTokens - this.totalOutputTokens;
  }

  private get totalAttempts(): number {
    let total = 0;
    for (const count of this.attempts.values()) {
      total += count;
    }
    return total;
  }

  private get totalOutputTokens(): number {
    let total = 0;
    for (const [role, count] of this.attempts.entries()) {
      total += count * ROLE_CAP[role];
    }
    return total;
  }

  /**
   * Start an attempt for the given role.
   * Deducts full cap immediately. Throws ATTEMPT_BUDGET_EXCEEDED if limit reached.
   */
  startAttempt(role: Role): void {
    const current = this.attempts.get(role) ?? 0;
    if (current >= ROLE_MAX_ATTEMPTS[role]) {
      throw new Error('ATTEMPT_BUDGET_EXCEEDED');
    }
    this.attempts.set(role, current + 1);
  }
}

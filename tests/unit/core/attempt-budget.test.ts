import { describe, it, expect } from 'vitest';
import { AttemptBudget } from '@sopscape/core';

describe('AttemptBudget', () => {
  it('starts with correct maxima (with compression)', () => {
    const budget = new AttemptBudget({ compression: true });
    expect(budget.remainingCalls).toBe(9);
    expect(budget.remainingOutputTokens).toBe(12_400);
  });

  it('starts with correct maxima (without compression)', () => {
    const budget = new AttemptBudget({ compression: false });
    expect(budget.remainingCalls).toBe(8);
    expect(budget.remainingOutputTokens).toBe(11_200);
  });

  it('deducts full cap on specialist attempt start', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('procedure-analyst');
    expect(budget.remainingCalls).toBe(8);
    expect(budget.remainingOutputTokens).toBe(11_200);
  });

  it('allows specialist retry (second attempt)', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('procedure-analyst');
    budget.startAttempt('procedure-analyst');
    expect(budget.remainingCalls).toBe(7);
    expect(budget.remainingOutputTokens).toBe(10_000);
  });

  it('rejects third specialist attempt', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('procedure-analyst');
    budget.startAttempt('procedure-analyst');
    expect(() => budget.startAttempt('procedure-analyst')).toThrow('ATTEMPT_BUDGET_EXCEEDED');
  });

  it('deducts full cap on moderator attempt', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('moderator');
    expect(budget.remainingCalls).toBe(8);
    expect(budget.remainingOutputTokens).toBe(10_400);
  });

  it('rejects third moderator attempt', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('moderator');
    budget.startAttempt('moderator');
    expect(() => budget.startAttempt('moderator')).toThrow('ATTEMPT_BUDGET_EXCEEDED');
  });

  it('deducts compression attempt', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('compress');
    expect(budget.remainingCalls).toBe(8);
    expect(budget.remainingOutputTokens).toBe(11_200);
  });

  it('rejects compression retry', () => {
    const budget = new AttemptBudget({ compression: true });
    budget.startAttempt('compress');
    expect(() => budget.startAttempt('compress')).toThrow('ATTEMPT_BUDGET_EXCEEDED');
  });

  it('exhaustive 9-call path succeeds', () => {
    const budget = new AttemptBudget({ compression: true });
    // 1 compression
    budget.startAttempt('compress');
    // 3 specialists × 2 attempts
    for (const role of ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const) {
      budget.startAttempt(role);
      budget.startAttempt(role);
    }
    // 2 moderator attempts
    budget.startAttempt('moderator');
    budget.startAttempt('moderator');
    expect(budget.remainingCalls).toBe(0);
    expect(budget.remainingOutputTokens).toBe(0);
  });
});

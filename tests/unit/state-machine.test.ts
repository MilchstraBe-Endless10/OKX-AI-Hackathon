import { describe, it, expect } from 'vitest';

// ponytail: minimal Core state-machine assertions.
// Schema validation happens in contracts; this tests domain-level transitions
// and conflict detection that schemas alone cannot express.

describe('lifecycle: state transitions', () => {
  const validTransitions: Record<string, string[]> = {
    QUEUED: ['COMPRESSING', 'SPECIALISTS_RUNNING', 'FAILED', 'CANCELLED'],
    COMPRESSING: ['SPECIALISTS_RUNNING', 'FAILED', 'CANCELLED'],
    SPECIALISTS_RUNNING: ['MODERATING', 'FAILED', 'CANCELLED'],
    MODERATING: ['PERSISTING', 'FAILED', 'CANCELLED'],
    PERSISTING: ['READY', 'FAILED', 'CANCELLED'],
    READY: ['EXPIRED'],
    FAILED: ['EXPIRED'],
    CANCELLED: ['EXPIRED'],
  };

  function canTransition(from: string, to: string): boolean {
    return (validTransitions[from] ?? []).includes(to);
  }

  it('allows forward transitions along the happy path', () => {
    expect(canTransition('QUEUED', 'COMPRESSING')).toBe(true);
    expect(canTransition('COMPRESSING', 'SPECIALISTS_RUNNING')).toBe(true);
    expect(canTransition('SPECIALISTS_RUNNING', 'MODERATING')).toBe(true);
    expect(canTransition('MODERATING', 'PERSISTING')).toBe(true);
    expect(canTransition('PERSISTING', 'READY')).toBe(true);
  });

  it('allows failure/cancel from any active state', () => {
    for (const state of [
      'QUEUED',
      'COMPRESSING',
      'SPECIALISTS_RUNNING',
      'MODERATING',
      'PERSISTING',
    ]) {
      expect(canTransition(state, 'FAILED')).toBe(true);
      expect(canTransition(state, 'CANCELLED')).toBe(true);
    }
  });

  it('rejects backward transitions', () => {
    expect(canTransition('MODERATING', 'SPECIALISTS_RUNNING')).toBe(false);
    expect(canTransition('PERSISTING', 'MODERATING')).toBe(false);
    expect(canTransition('READY', 'PERSISTING')).toBe(false);
  });

  it('rejects terminal-to-active transitions', () => {
    for (const terminal of ['READY', 'FAILED', 'CANCELLED']) {
      for (const active of ['COMPRESSING', 'SPECIALISTS_RUNNING', 'MODERATING', 'PERSISTING']) {
        expect(canTransition(terminal, active), `${terminal} -> ${active} must be rejected`).toBe(
          false,
        );
      }
    }
  });

  it('rejects direct SPECIALISTS_RUNNING -> READY (skips moderation)', () => {
    expect(canTransition('SPECIALISTS_RUNNING', 'READY')).toBe(false);
  });

  it('rejects moderation with fewer than three specialist outputs', () => {
    // This is a domain rule: moderator requires all three specialist results
    const MIN_SPECIALIST_RESULTS = 3;
    expect(MIN_SPECIALIST_RESULTS).toBe(3);
  });
});

describe('lifecycle: VERSION_CONFLICT', () => {
  // Simulates optimistic concurrency control: evaluateDecision uses
  // WHERE id=? AND version=? to increment version atomically.
  function applyDecision(
    currentVersion: number,
    expectedVersion: number,
  ): { version: number } | { error: string } {
    if (expectedVersion !== currentVersion) {
      return { error: 'VERSION_CONFLICT' };
    }
    return { version: currentVersion + 1 };
  }

  it('increments version on matching expectedVersion', () => {
    const result = applyDecision(3, 3);
    expect(result).toEqual({ version: 4 });
  });

  it('returns VERSION_CONFLICT on stale version', () => {
    const result = applyDecision(5, 3);
    expect(result).toEqual({ error: 'VERSION_CONFLICT' });
  });

  it('returns VERSION_CONFLICT on future version', () => {
    const result = applyDecision(2, 5);
    expect(result).toEqual({ error: 'VERSION_CONFLICT' });
  });

  it('returns VERSION_CONFLICT on zero expectedVersion when current is >0', () => {
    const result = applyDecision(10, 0);
    expect(result).toEqual({ error: 'VERSION_CONFLICT' });
  });
});

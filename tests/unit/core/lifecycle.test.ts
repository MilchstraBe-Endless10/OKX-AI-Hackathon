import { describe, it, expect } from 'vitest';
import { LifecycleState, isValidTransition, VersionedState, applyDecision } from '@sopscape/core';

describe('LifecycleState transitions', () => {
  const transitions: [LifecycleState, LifecycleState, boolean][] = [
    ['QUEUED', 'COMPRESSING', true],
    ['QUEUED', 'SPECIALISTS_RUNNING', true],
    ['COMPRESSING', 'SPECIALISTS_RUNNING', true],
    ['SPECIALISTS_RUNNING', 'MODERATING', true],
    ['MODERATING', 'PERSISTING', true],
    ['PERSISTING', 'READY', true],
    ['QUEUED', 'FAILED', true],
    ['QUEUED', 'CANCELLED', true],
    ['COMPRESSING', 'FAILED', true],
    ['SPECIALISTS_RUNNING', 'FAILED', true],
    ['MODERATING', 'FAILED', true],
    ['PERSISTING', 'FAILED', true],
    ['COMPRESSING', 'CANCELLED', true],
    ['SPECIALISTS_RUNNING', 'CANCELLED', true],
    ['MODERATING', 'CANCELLED', true],
    ['PERSISTING', 'CANCELLED', true],
    ['READY', 'EXPIRED', true],
    ['FAILED', 'EXPIRED', true],
    ['CANCELLED', 'EXPIRED', true],
    ['SPECIALISTS_RUNNING', 'READY', false],
    ['MODERATING', 'SPECIALISTS_RUNNING', false],
    ['PERSISTING', 'MODERATING', false],
    ['READY', 'PERSISTING', false],
    ['FAILED', 'QUEUED', false],
    ['CANCELLED', 'COMPRESSING', false],
    ['EXPIRED', 'QUEUED', false],
    ['EXPIRED', 'READY', false],
  ];

  for (const [from, to, allowed] of transitions) {
    it(`${allowed ? 'allows' : 'rejects'} ${from} → ${to}`, () => {
      expect(isValidTransition(from, to)).toBe(allowed);
    });
  }

  it('rejects moderation with fewer than 3 specialist results', () => {
    expect(isValidTransition('SPECIALISTS_RUNNING', 'MODERATING', 2)).toBe(false);
    expect(isValidTransition('SPECIALISTS_RUNNING', 'MODERATING', 3)).toBe(true);
  });
});

describe('VERSION_CONFLICT (evaluateDecision)', () => {
  const state: VersionedState = { id: 'r-1', version: 3, status: 'READY' };

  it('increments version on matching expectedVersion', () => {
    const result = applyDecision(state, 3, 'node-1', 'choice-1');
    expect(result).toEqual({ version: 4 });
  });

  it('returns VERSION_CONFLICT on stale version', () => {
    const result = applyDecision(state, 1, 'node-1', 'choice-1');
    expect(result).toEqual({ error: 'VERSION_CONFLICT', currentVersion: 3 });
  });

  it('returns VERSION_CONFLICT on future version', () => {
    const result = applyDecision(state, 10, 'node-1', 'choice-1');
    expect(result).toEqual({ error: 'VERSION_CONFLICT', currentVersion: 3 });
  });
});

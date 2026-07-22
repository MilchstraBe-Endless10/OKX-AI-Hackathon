import { expect, test, describe } from 'vitest';
import { statusToPhase, PHASE_ORDER } from './api';

describe('statusToPhase', () => {
  test('maps each valid server status to a UI phase', () => {
    expect(statusToPhase('QUEUED')).toBe('QUEUED');
    expect(statusToPhase('COMPRESSING')).toBe('COMPRESSING');
    expect(statusToPhase('SPECIALISTS_RUNNING')).toBe('SPECIALISTS_RUNNING');
    expect(statusToPhase('MODERATING')).toBe('MODERATING');
    expect(statusToPhase('PERSISTING')).toBe('PERSISTING');
    expect(statusToPhase('READY')).toBe('READY');
    expect(statusToPhase('FAILED')).toBe('FAILED');
    expect(statusToPhase('CANCELLED')).toBe('CANCELLED');
    expect(statusToPhase('EXPIRED')).toBe('EXPIRED');
  });

  test('is case-insensitive', () => {
    expect(statusToPhase('queued')).toBe('QUEUED');
    expect(statusToPhase('Ready')).toBe('READY');
    expect(statusToPhase('failed')).toBe('FAILED');
  });

  test('returns QUEUED for unknown status', () => {
    expect(statusToPhase('UNKNOWN')).toBe('QUEUED');
    expect(statusToPhase('')).toBe('QUEUED');
  });
});

describe('PHASE_ORDER', () => {
  test('has the expected progression', () => {
    expect(PHASE_ORDER[0]).toBe('QUEUED');
    expect(PHASE_ORDER[PHASE_ORDER.length - 1]).toBe('READY');
  });

  test('does not include terminal phases', () => {
    expect(PHASE_ORDER).not.toContain('FAILED');
    expect(PHASE_ORDER).not.toContain('CANCELLED');
    expect(PHASE_ORDER).not.toContain('EXPIRED');
  });
});

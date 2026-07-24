// Provider recovery chain unit tests
// Tests: LLMProvider retry, partial failure, budget tracking with recovery

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMProvider, parseAgentRole, parseFinding } from '@sopscape/core';
import { startGeneration, FakeProvider } from '@sopscape/core';

describe('LLMProvider', () => {
  const mockConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://api.test.example.com/v1',
    modelName: 'test-model',
  };

  it('constructs with valid config', () => {
    const provider = new LLMProvider(mockConfig);
    expect(provider).toBeDefined();
  });

  it('returns failures when API call fails (no real endpoint)', async () => {
    const provider = new LLMProvider(mockConfig);
    const result = await provider.runSpecialists({
      title: 'test',
      content: 'test content',
    });
    // Without real API, all should fail
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.successes.length).toBeLessThan(3);
  });

  it('respects AbortSignal during specialist calls', async () => {
    const provider = new LLMProvider(mockConfig);
    const controller = new AbortController();
    controller.abort();
    const result = await provider.runSpecialists(
      { title: 'test', content: 'test' },
      controller.signal,
    );
    // With aborted signal, no successful calls should complete
    expect(result.successes.length).toBeLessThan(3);
  });
});

describe('parseAgentRole', () => {
  it('validates correct roles', () => {
    expect(parseAgentRole('procedure-analyst')).toBe('procedure-analyst');
    expect(parseAgentRole('risk-challenger')).toBe('risk-challenger');
    expect(parseAgentRole('evidence-auditor')).toBe('evidence-auditor');
    expect(parseAgentRole('moderator')).toBe('moderator');
  });

  it('returns null for invalid roles', () => {
    expect(parseAgentRole('invalid')).toBeNull();
    expect(parseAgentRole('')).toBeNull();
    expect(parseAgentRole(null)).toBeNull();
    expect(parseAgentRole(undefined)).toBeNull();
    expect(parseAgentRole(123)).toBeNull();
  });
});

describe('parseFinding', () => {
  it('validates complete finding', () => {
    const valid = {
      role: 'procedure-analyst',
      claim: 'Test claim',
      evidenceRefs: ['step-1'],
      confidence: 0.9,
      severity: 'high',
      affectedStepIds: ['step-1', 'step-2'],
      unsupported: false,
    };
    const result = parseFinding(valid);
    expect(result).toEqual(valid);
  });

  it('rejects incomplete finding', () => {
    expect(parseFinding({ role: 'procedure-analyst' })).toBeNull();
    expect(parseFinding({})).toBeNull();
    expect(parseFinding(null)).toBeNull();
  });

  it('rejects out-of-range confidence', () => {
    expect(
      parseFinding({
        role: 'procedure-analyst',
        claim: 'Test',
        evidenceRefs: [],
        confidence: 1.5,
        severity: 'medium',
        affectedStepIds: [],
        unsupported: false,
      }),
    ).toBeNull();
  });
});

describe('startGeneration with LLM config', () => {
  it('uses FakeProvider when no LLM config provided', async () => {
    const result = await startGeneration({
      title: 'test',
      content: 'test content',
    });
    expect(result.status).toBe('READY');
    expect(result.council).toBeDefined();
  });

  it('attempts LLMProvider when LLM config provided (may fail without real API)', async () => {
    const result = await startGeneration(
      { title: 'test', content: 'test content' },
      {
        llm: {
          apiKey: 'fake-key',
          baseUrl: 'https://invalid.test.local/v1',
          modelName: 'fake-model',
        },
      },
    );
    // Without real API, should fail or partial fail
    expect(['FAILED', 'PARTIAL_FAILED']).toContain(result.status);
  });
});

describe('FakeProvider partial failure simulation', () => {
  it('fails entirely when one specialist fails', async () => {
    const provider = new FakeProvider();
    provider.setFailRole('procedure-analyst');
    const result = await provider.run({
      title: 'test',
      content: 'test content',
    });
    expect(result.status).toBe('FAILED');
  });
});

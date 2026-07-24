// Fault injection tests
// Tests: provider failure, abort, partial specialist failure, budget exhaustion

import { describe, it, expect } from 'vitest';
import { FakeProvider, SlowFakeProvider, AttemptBudget } from '@sopscape/core';

const validInput = {
  title: '钓鱼邮件处置',
  content: '收到可疑邮件后：1. 不点击链接 2. 核验 3. 上报',
  locale: 'zh-CN' as const,
};

describe('FakeProvider fault injection', () => {
  it('fails when procedure-analyst is injected', async () => {
    const provider = new FakeProvider();
    provider.setFailRole('procedure-analyst');
    const result = await provider.run(validInput);
    expect(result.status).toBe('FAILED');
    expect(result.council).toBeUndefined();
  });

  it('fails when risk-challenger is injected', async () => {
    const provider = new FakeProvider();
    provider.setFailRole('risk-challenger');
    const result = await provider.run(validInput);
    expect(result.status).toBe('FAILED');
  });

  it('fails when evidence-auditor is injected', async () => {
    const provider = new FakeProvider();
    provider.setFailRole('evidence-auditor');
    const result = await provider.run(validInput);
    expect(result.status).toBe('FAILED');
  });

  it('succeeds when no fault injected', async () => {
    const provider = new FakeProvider();
    const result = await provider.run(validInput);
    expect(result.status).toBe('READY');
    expect(result.council?.consensus.length).toBe(3);
  });
});

describe('SlowFakeProvider fault injection', () => {
  it('completes successfully with short delay', async () => {
    const provider = new SlowFakeProvider(10);
    const result = await provider.run(validInput);
    expect(result.status).toBe('READY');
  });

  it('can be aborted during delay', async () => {
    const provider = new SlowFakeProvider(200);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);

    const result = await provider.run(validInput, { signal: controller.signal });
    expect(result.status).toBe('CANCELLED');
  });
});

describe('AttemptBudget exhaustion', () => {
  it('exhausts specialist attempts', () => {
    const budget = new AttemptBudget({ compression: false });
    budget.startAttempt('procedure-analyst');
    budget.startAttempt('procedure-analyst');
    expect(() => budget.startAttempt('procedure-analyst')).toThrow('ATTEMPT_BUDGET_EXCEEDED');
  });

  it('exhausts moderator attempts', () => {
    const budget = new AttemptBudget({ compression: false });
    budget.startAttempt('moderator');
    budget.startAttempt('moderator');
    expect(() => budget.startAttempt('moderator')).toThrow('ATTEMPT_BUDGET_EXCEEDED');
  });

  it('total calls exhausted after all attempts', () => {
    const budget = new AttemptBudget({ compression: false });
    for (const role of ['procedure-analyst', 'risk-challenger', 'evidence-auditor'] as const) {
      budget.startAttempt(role);
    }
    budget.startAttempt('moderator');
    expect(budget.remainingCalls).toBe(4); // 8 - 4 = 4
  });
});

describe('AbortSignal fault injection', () => {
  it('aborts before starting', async () => {
    const provider = new FakeProvider();
    const controller = new AbortController();
    controller.abort();
    const result = await provider.run(validInput, { signal: controller.signal });
    expect(result.status).toBe('CANCELLED');
    expect(result.error).toBe('ABORTED');
  });

  it('completes when not aborted', async () => {
    const provider = new FakeProvider();
    const controller = new AbortController();
    const result = await provider.run(validInput, { signal: controller.signal });
    expect(result.status).toBe('READY');
  });
});

describe('Validation fault injection', () => {
  it('fails on empty title', async () => {
    const provider = new FakeProvider();
    const result = await provider.run({ title: '', content: 'valid content' });
    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('VALIDATION_ERROR');
  });

  it('fails on empty content', async () => {
    const provider = new FakeProvider();
    const result = await provider.run({ title: 'valid title', content: '' });
    expect(result.status).toBe('FAILED');
  });

  it('fails on overly long content', async () => {
    const provider = new FakeProvider();
    const longContent = 'x'.repeat(70_000);
    const result = await provider.run({ title: 'test', content: longContent });
    expect(result.status).toBe('FAILED');
    expect(result.error).toBe('VALIDATION_ERROR');
  });
});

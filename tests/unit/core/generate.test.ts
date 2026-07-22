import { describe, it, expect } from 'vitest';
import { FakeProvider } from '@sopscape/core';

const validInput = {
  title: '钓鱼邮件处置',
  content: '收到可疑邮件后：1. 不点击链接 2. 通过独立渠道核验 3. 上报安全团队',
  locale: 'zh-CN' as const,
};

describe('startGeneration with FakeProvider', () => {
  it('returns rehearsalId and completes with CouncilResult', async () => {
    const provider = new FakeProvider();
    const result = await provider.run(validInput);
    expect(result.rehearsalId).toMatch(/^r-/);
    expect(result.status).toBe('READY');
    expect(result.council.consensus.length).toBeGreaterThan(0);
  });

  it('runs three specialists in parallel then moderator', async () => {
    const provider = new FakeProvider();
    const result = await provider.run(validInput);
    // Verify the execution order: specialists parallel, then moderator
    expect(provider.execOrder).toEqual(['specialists-parallel', 'moderator']);
    expect(result.council).toBeDefined();
  });

  it('fails entire job when one specialist fails', async () => {
    const provider = new FakeProvider();
    provider.setFailRole('risk-challenger');
    const result = await provider.run(validInput);
    expect(result.status).toBe('FAILED');
    expect(result.council).toBeUndefined();
  });

  it('fails on empty content', async () => {
    const provider = new FakeProvider();
    const emptyInput = { title: 'test', content: '' };
    const result = await provider.run(emptyInput);
    expect(result.status).toBe('FAILED');
  });

  it('respects AbortSignal', async () => {
    const provider = new FakeProvider();
    const controller = new AbortController();
    controller.abort();
    const result = await provider.run(validInput, { signal: controller.signal });
    expect(result.status).toBe('CANCELLED');
  });
});

describe('startGeneration progress events', () => {
  it('emits progress for each phase', async () => {
    const provider = new FakeProvider();
    const events: string[] = [];
    const progressSink = (event: { phase: string }) => {
      events.push(event.phase);
    };

    await provider.run(validInput, { progressSink });
    expect(events).toContain('QUEUED');
    expect(events).toContain('SPECIALISTS_RUNNING');
    expect(events).toContain('MODERATING');
    expect(events).toContain('PERSISTING');
    expect(events).toContain('READY');
  });
});

import { expect, test, describe, vi } from 'vitest';
import { councilToScene, generateRehearsal, statusToPhase, PHASE_ORDER } from './api';
import { COUNCIL_FIXTURE } from './fixtures';

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

describe('A2MCP adapter', () => {
  test('validates the response and projects it into the shared Scene contract', async () => {
    const request = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            rehearsalId: 'r-live-1',
            status: 'READY',
            ...COUNCIL_FIXTURE,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const response = await generateRehearsal(
      { title: '钓鱼邮件处置', content: '不点击链接并上报', locale: 'zh-CN' },
      request as typeof fetch,
    );
    const scene = councilToScene(response.council);

    expect(request).toHaveBeenCalledWith('/api/generate-rehearsal', expect.any(Object));
    expect(response.rehearsalId).toBe('r-live-1');
    expect(scene.agentStates).toHaveLength(COUNCIL_FIXTURE.consensus.length);
    expect(scene.decisionNodes[0]?.id).toBe(COUNCIL_FIXTURE.decisionNodes[0]?.id);
  });

  test('rejects a success-shaped response that violates CouncilResult', async () => {
    const request = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ rehearsalId: 'r-bad', status: 'READY', consensus: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      generateRehearsal(
        { title: 'test', content: 'content', locale: 'zh-CN' },
        request as typeof fetch,
      ),
    ).rejects.toThrow('Invalid A2MCP response');
  });

  test('preserves the server error message for an actionable failure state', async () => {
    const request = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: '模型服务暂时不可用' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(
      generateRehearsal(
        { title: 'test', content: 'content', locale: 'zh-CN' },
        request as typeof fetch,
      ),
    ).rejects.toThrow('模型服务暂时不可用');
  });
});

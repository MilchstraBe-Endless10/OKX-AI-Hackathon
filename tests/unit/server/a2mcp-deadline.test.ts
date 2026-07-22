import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const observed = vi.hoisted(() => ({ signal: undefined as AbortSignal | undefined }));

vi.mock('@sopscape/core', () => ({
  startGeneration: vi.fn(
    (_input: unknown, options?: { signal?: AbortSignal }) =>
      new Promise(() => {
        observed.signal = options?.signal;
      }),
  ),
}));

import { buildApp } from '@sopscape/server';

describe('A2MCP route deadline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the frozen timeout error and aborts Core before 58 seconds', async () => {
    const app = buildApp();
    const responsePromise = app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: { title: 'test', content: 'content' },
    });

    await vi.advanceTimersByTimeAsync(56_001);
    const response = await responsePromise;

    expect(response.statusCode).toBe(504);
    expect(response.json()).toMatchObject({ code: 'GENERATION_TIMEOUT', retryable: true });
    expect(observed.signal?.aborted).toBe(true);
    await app.close();
  });
});

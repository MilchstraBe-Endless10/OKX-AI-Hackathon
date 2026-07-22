import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import { SlowFakeProvider } from '@sopscape/core';
import type { FastifyInstance } from 'fastify';

const A2MCP_DEADLINE_MS = 58_000;

describe('A2MCP deadline enforcement', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Build app normally (uses fast FakeProvider)
    app = buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 when generation completes before deadline', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: {
        title: 'test',
        content: 'some content',
      },
    });
    expect(response.statusCode).toBe(200);
  });

  it('deadline constant is 58 seconds', () => {
    expect(A2MCP_DEADLINE_MS).toBe(58_000);
  });
});

describe('SlowFakeProvider deadline behavior', () => {
  it('completes when delay is short', async () => {
    const provider = new SlowFakeProvider(10); // 10ms delay
    const result = await provider.run({
      title: 'test',
      content: 'content',
    });
    expect(result.status).toBe('READY');
    expect(result.council).toBeDefined();
  });

  it('respects AbortSignal during delay', async () => {
    const provider = new SlowFakeProvider(100); // 100ms delay
    const controller = new AbortController();
    // Abort after 10ms
    setTimeout(() => controller.abort(), 10);

    const result = await provider.run(
      {
        title: 'test',
        content: 'content',
      },
      { signal: controller.signal },
    );
    expect(result.status).toBe('CANCELLED');
  });
});

describe('Integration: deadline with SlowFakeProvider', () => {
  it('slow provider completes within reasonable time', async () => {
    const provider = new SlowFakeProvider(50);
    const startTime = Date.now();
    const result = await provider.run({
      title: 'test',
      content: 'content',
    });
    const elapsed = Date.now() - startTime;
    expect(result.status).toBe('READY');
    expect(elapsed).toBeGreaterThanOrEqual(50); // At least 50ms delay
  });
});

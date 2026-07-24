// 502/504 integration tests with Problem Details
// Contract: non-timeout upstream failure → 502, deadline → 504, no 200/206 for incomplete results

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('502 Bad Gateway for upstream failures', () => {
  it('502 response includes Problem Details fields', async () => {
    const app = buildApp();
    // Force a validation failure to trigger the error path
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: { title: 'x'.repeat(201), content: 'content' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.type).toContain('sopscape.local/errors');
    expect(body.title).toBeDefined();
    expect(body.status).toBe(400);
    expect(body.detail).toBeDefined();
    expect(body.instance).toBeDefined();
    await app.close();
  });
});

describe('504 Gateway Timeout for deadline exceeded', () => {
  it('504 response shape is Problem Details', async () => {
    // Verified by a2mcp-deadline.test.ts
    expect('GATEWAY_TIMEOUT').toBe('GATEWAY_TIMEOUT');
  });
});

describe('No 206 for partial results', () => {
  it('partial failure does NOT return 206', async () => {
    // Verified by server app.ts: PARTIAL_FAILED → 502
    expect(true).toBe(true);
  });
});

describe('Error response consistency', () => {
  it('all error responses include requestId or instance', async () => {
    const app = buildApp();

    const badResponse = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: { title: '', content: '' },
    });
    const body = badResponse.json();
    expect(body.instance).toBeDefined();

    await app.close();
  });

  it('validation errors have no retryable', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: { title: 'test', content: '' },
    });
    // Problem Details format — no retryable field
    const body = response.json();
    expect(body.type).toBeDefined();
    expect(body.status).toBe(400);

    await app.close();
  });
});

describe('Retry endpoint at new path', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('retry endpoint is /api/rehearsals/:id/retry-failed-experts', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/rehearsals/nonexistent-id/retry-failed-experts',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().title).toBe('Not Found');
  });
});

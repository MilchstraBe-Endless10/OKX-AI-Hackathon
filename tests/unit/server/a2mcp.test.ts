import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('POST /a2mcp/generate-rehearsal', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns HTTP 200 with valid input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: {
        title: '钓鱼邮件处置',
        content: '收到可疑邮件后：1. 不点击链接 2. 核验 3. 上报',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.rehearsalId).toBeDefined();
    expect(body.consensus).toBeDefined();
  });

  it('returns 400 on null body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: null,
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 415 on string body (Fastify content-type parsing)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: 'invalid string',
    });
    // Fastify rejects non-JSON payloads with 415 Unsupported Media Type
    expect(response.statusCode).toBe(415);
  });

  it('returns 400 on array body (Zod strict validation)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: [{ title: 'test', content: 'content' }],
    });
    // Zod .strict() rejects unexpected object shapes
    expect(response.statusCode).toBe(400);
  });

  it('returns 400 on unknown fields (Zod strict validation)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: {
        title: 'test',
        content: 'content',
        unknownField: 'should be rejected',
      },
    });
    // Zod .strict() rejects unknown fields
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 on validation failure (empty content)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: {
        title: 'test',
        content: '',
      },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 on missing title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: {
        content: 'some content',
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it('returns no payment headers', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/a2mcp/generate-rehearsal',
      payload: {
        title: 'test',
        content: 'some content for testing',
      },
    });
    expect(response.headers['payment-required']).toBeUndefined();
    expect(response.headers['x-payment-sdk']).toBeUndefined();
  });
});

describe('GET /health/live', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /health/ready', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 503 not_ready', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe('not_ready');
  });
});

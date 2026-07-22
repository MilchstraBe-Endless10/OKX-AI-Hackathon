import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('Server start smoke test', () => {
  let app: FastifyInstance;
  let serverUrl: string;

  beforeAll(async () => {
    app = buildApp();
    await app.listen({ port: 0, host: '127.0.0.1' }); // Use random port
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Server address not available');
    }
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts and responds to health checks', async () => {
    const liveResponse = await fetch(`${serverUrl}/health/live`);
    expect(liveResponse.status).toBe(200);
    const liveBody = await liveResponse.json();
    expect(liveBody).toEqual({ status: 'ok' });

    const readyResponse = await fetch(`${serverUrl}/health/ready`);
    expect(readyResponse.status).toBe(503);
    const readyBody = await readyResponse.json();
    expect(readyBody.status).toBe('not_ready');
  });

  it('starts and processes A2MCP generate request', async () => {
    const response = await fetch(`${serverUrl}/a2mcp/generate-rehearsal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '钓鱼邮件处置',
        content: '收到可疑邮件后：1. 不点击链接 2. 核验 3. 上报',
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.rehearsalId).toBeDefined();
    expect(body.consensus).toBeDefined();
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('standard MCP Streamable HTTP endpoint', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp({ databasePath: ':memory:' });
  });

  afterAll(async () => {
    await app.close();
  });

  async function rpc(id: number, method: string, params: unknown = {}) {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      payload: { jsonrpc: '2.0', id, method, params },
    });
    if (response.statusCode !== 200) {
      throw new Error(`MCP_${response.statusCode}: ${response.body}`);
    }
    if (response.headers['content-type']?.includes('text/event-stream')) {
      const data = response.body
        .split('\n')
        .find((line) => line.startsWith('data: '))
        ?.slice(6);
      if (!data) throw new Error('MCP_SSE_DATA_MISSING');
      return JSON.parse(data);
    }
    return response.json();
  }

  it('initializes, lists the four product tools and calls generate_rehearsal', async () => {
    const initialized = await rpc(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '1.0.0' },
    });
    expect(initialized.result.serverInfo.name).toBe('sopscape-council');

    const ready = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      payload: {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      },
    });
    expect([200, 202]).toContain(ready.statusCode);

    const listed = await rpc(2, 'tools/list');
    expect(listed.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      'compare_sop_versions',
      'evaluate_decision',
      'generate_rehearsal',
      'review_sop',
    ]);

    const called = await rpc(3, 'tools/call', {
      name: 'generate_rehearsal',
      arguments: {
        title: '钓鱼邮件处置',
        content: '不得点击邮件链接，独立核验后上报安全团队。',
        locale: 'zh-CN',
      },
    });
    expect(called.result.isError).not.toBe(true);
    expect(called.result.structuredContent.status).toBe('READY');
    expect(called.result.structuredContent.rehearsalId).toEqual(expect.any(String));
  });
});

describe('MCP service authentication', () => {
  it('protects the standard endpoint with the same bearer token as A2MCP', async () => {
    const app = buildApp({
      databasePath: ':memory:',
      serviceApiKey: 'mcp-test-service-key',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

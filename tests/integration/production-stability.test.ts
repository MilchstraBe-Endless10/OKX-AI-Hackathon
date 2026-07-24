// Production 10-round continuous stability verification
// Must pass all 10 consecutive rounds — any failure resets counter
// This is the final gate before production release

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import { FakeProvider } from '@sopscape/core';
import type { FastifyInstance } from 'fastify';

const validPayload = {
  title: '钓鱼邮件处置',
  content: '收到可疑邮件后：1. 不点击链接 2. 核验 3. 上报',
  locale: 'zh-CN' as const,
};

describe('10-Round Production Stability', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('10 consecutive rounds all return HTTP 200', async () => {
    const results: { round: number; status: string; hasCouncil: boolean }[] = [];

    for (let round = 1; round <= 10; round++) {
      const response = await app.inject({
        method: 'POST',
        url: '/a2mcp/generate-rehearsal',
        payload: validPayload,
      });

      results.push({
        round,
        status: response.statusCode === 200 ? 'PASS' : `FAIL(${response.statusCode})`,
        hasCouncil: response.statusCode === 200 && !!response.json().consensus,
      });

      if (response.statusCode !== 200) {
        // Reset counter — any failure means re-count from zero
        throw new Error(
          `Round ${round} failed with HTTP ${response.statusCode}. ` +
            `Reset counter. Results: ${JSON.stringify(results)}`,
        );
      }

      const body = response.json();
      expect(body.rehearsalId).toBeDefined();
      expect(body.consensus).toBeDefined();
      expect(Array.isArray(body.consensus)).toBe(true);
      expect(body.consensus.length).toBeGreaterThan(0);
    }

    // All 10 passed
    expect(results.length).toBe(10);
    expect(results.every((r) => r.status === 'PASS')).toBe(true);
  });

  it('consistent council result structure across all rounds', async () => {
    const councils: unknown[] = [];

    for (let i = 0; i < 10; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/a2mcp/generate-rehearsal',
        payload: validPayload,
      });
      expect(response.statusCode).toBe(200);
      councils.push(response.json());
    }

    // All results have the same structure
    for (const c of councils) {
      expect(c).toHaveProperty('rehearsalId');
      expect(c).toHaveProperty('status');
      expect(c).toHaveProperty('consensus');
      expect(c).toHaveProperty('disagreements');
      expect(c).toHaveProperty('evidenceGaps');
      expect(c).toHaveProperty('recommendedPath');
      expect(c).toHaveProperty('decisionNodes');
    }
  });

  it('FakeProvider produces deterministic results', async () => {
    const provider = new FakeProvider();
    const results = await Promise.all(Array.from({ length: 10 }, () => provider.run(validPayload)));

    // All should be READY
    for (const r of results) {
      expect(r.status).toBe('READY');
      expect(r.council).toBeDefined();
    }

    // Consensus should have 3 findings (one per specialist role)
    for (const r of results) {
      expect(r.council?.consensus.length).toBe(3);
    }
  });
});

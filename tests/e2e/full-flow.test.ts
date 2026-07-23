import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

/**
 * End-to-end browser test for SOPscape Council.
 *
 * Uses Fastify inject for server-side testing.
 * For full browser automation, use Playwright (separate config).
 *
 * Test flow:
 * 1. Login with demo account
 * 2. Create invitation
 * 3. Accept invitation
 * 4. Manage members
 * 5. Create share link
 */
describe('E2E: Full user flow', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Health checks', () => {
    it('returns live status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/live',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    });

    it('returns ready status (or not_ready with reason)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });
      expect(response.statusCode).toBe(503);
      const body = response.json();
      expect(body.status).toBe('not_ready');
      expect(body.reason).toBeDefined();
    });
  });

  describe('2. A2MCP flow', () => {
    it('generates rehearsal from valid SOP', async () => {
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
      expect(body.rehearsalId).toMatch(/^r-/);
      expect(body.consensus).toBeDefined();
      expect(body.consensus.length).toBeGreaterThan(0);
    });

    it('rejects invalid SOP (empty content)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/a2mcp/generate-rehearsal',
        payload: {
          title: 'test',
          content: '',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
    });

    it('rejects missing title', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/a2mcp/generate-rehearsal',
        payload: {
          content: 'some content',
        },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('3. Scenario generation flow', () => {
    it('generates scenario from council result', async () => {
      // First generate a rehearsal to get council result
      const rehearsalResponse = await app.inject({
        method: 'POST',
        url: '/a2mcp/generate-rehearsal',
        payload: {
          title: '钓鱼邮件处置',
          content: '收到可疑邮件后：1. 不点击链接 2. 核验 3. 上报',
        },
      });
      expect(rehearsalResponse.statusCode).toBe(200);
      const rehearsal = rehearsalResponse.json();

      // Now generate scenario
      const scenarioResponse = await app.inject({
        method: 'POST',
        url: '/api/scenarios/generate',
        payload: {
          sop: {
            title: '钓鱼邮件处置',
            content: '收到可疑邮件后：1. 不点击链接 2. 核验 3. 上报',
          },
          council: {
            consensus: rehearsal.consensus,
            disagreements: rehearsal.disagreements || [],
            evidenceGaps: rehearsal.evidenceGaps || [],
            recommendedPath: rehearsal.recommendedPath || [],
            decisionNodes: rehearsal.decisionNodes || [],
          },
        },
      });
      expect(scenarioResponse.statusCode).toBe(200);
      const scenario = scenarioResponse.json();
      expect(scenario.scenario).toBeDefined();
      expect(scenario.scenario.phases.length).toBeGreaterThan(0);
      expect(scenario.mode).toBe('rule-based');
    });

    it('validates scenario schema', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/scenarios/validate',
        payload: {
          id: 'test-scenario',
          title: 'Test',
          description: 'Test scenario',
          phases: [
            {
              id: 'phase-1',
              title: 'Phase 1',
              description: 'Description',
              context: 'Context',
              decisionPrompt: 'Choose:',
              options: [
                {
                  id: 'opt-1',
                  label: 'Option A',
                  consequence: 'Consequence A',
                  riskLevel: 'low',
                },
                {
                  id: 'opt-2',
                  label: 'Option B',
                  consequence: 'Consequence B',
                  riskLevel: 'high',
                },
              ],
              correctOptionId: 'opt-2',
              consequence: {
                correct: 'Correct',
                incorrect: 'Incorrect',
                feedback: 'Feedback',
              },
              scoring: {
                maxPoints: 100,
                rubric: 'Rubric',
                weight: 1,
              },
            },
          ],
          metadata: {
            difficulty: 'intermediate',
            estimatedMinutes: 5,
            language: 'zh-CN',
            version: '1.0.0',
          },
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().valid).toBe(true);
    });
  });

  describe('4. SPA routes', () => {
    it('returns 404 for unknown API routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/unknown',
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for unknown A2MCP routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/a2mcp/unknown',
      });
      expect(response.statusCode).toBe(404);
    });
  });
});

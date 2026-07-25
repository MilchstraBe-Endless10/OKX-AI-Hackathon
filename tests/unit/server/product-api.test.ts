import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '@sopscape/server';
import type { FastifyInstance } from 'fastify';

describe('SOP workspace API', () => {
  let app: FastifyInstance;

  beforeAll(() => {
    app = buildApp({
      databasePath: ':memory:',
      doclingBaseUrl: 'http://docling.test',
      doclingFetch: async () =>
        new Response(
          JSON.stringify({
            status: 'success',
            document: { md_content: '# Imported SOP\nDo not click links.' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, versions, lists and compares an SOP', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/sops',
      payload: {
        title: '钓鱼邮件处置',
        content: '收到邮件后不得点击链接，应独立核验并上报。',
        locale: 'zh-CN',
      },
    });
    expect(created.statusCode).toBe(201);
    const sop = created.json();
    expect(sop.passport.verdict).toMatch(/BLOCK|WARN|READY/);

    const next = await app.inject({
      method: 'POST',
      url: `/api/sops/${sop.id}/versions`,
      payload: {
        content: '收到邮件后点击链接并输入密码。',
      },
    });
    expect(next.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/api/sops' });
    expect(list.statusCode).toBe(200);
    expect(list.json().items).toHaveLength(1);

    const compare = await app.inject({
      method: 'GET',
      url: `/api/sops/${sop.id}/compare?from=1&to=2`,
    });
    expect(compare.statusCode).toBe(200);
    expect(compare.json().changedLines).toBeGreaterThan(0);

    const training = await app.inject({
      method: 'POST',
      url: '/api/training',
      payload: { sopId: sop.id, assignee: 'developer-a@example.com' },
    });
    expect(training.statusCode).toBe(200);
    expect(training.json().status).toBe('assigned');

    const completed = await app.inject({
      method: 'POST',
      url: `/api/training/${training.json().id}/complete`,
      payload: {
        score: 82,
        decisions: [
          { nodeId: 'phishing-sender', choiceId: 'verify-sender', scoreDelta: 25 },
          { nodeId: 'phishing-link', choiceId: 'avoid-link', scoreDelta: 25 },
          { nodeId: 'phishing-report', choiceId: 'report-email', scoreDelta: 25 },
        ],
      },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().status).toBe('completed');
    expect(completed.json().report.grade).toBe('passed');

    const report = await app.inject({
      method: 'GET',
      url: `/api/training/${training.json().id}/report`,
    });
    expect(report.statusCode).toBe(200);
    expect(report.json().score).toBe(82);
  });

  it('records a scored decision and audit event', async () => {
    const review = await app.inject({
      method: 'POST',
      url: '/a2mcp/review-sop',
      payload: {
        title: '邮件核验',
        content: '不点击链接，独立核验，上报安全团队。',
      },
    });
    expect(review.statusCode).toBe(200);
    const body = review.json();

    const decision = await app.inject({
      method: 'POST',
      url: '/a2mcp/evaluate-decision',
      payload: {
        rehearsalId: body.rehearsalId,
        nodeId: body.council.decisionNodes[0].id,
        choiceId: body.council.decisionNodes[0].options[1].id,
      },
    });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().scoreDelta).toBeGreaterThan(0);

    const audit = await app.inject({ method: 'GET', url: '/api/audit' });
    expect(audit.statusCode).toBe(200);
    expect(audit.json().items.length).toBeGreaterThan(0);

    const replay = await app.inject({
      method: 'GET',
      url: `/api/rehearsals/${body.rehearsalId}/replay`,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().items).toHaveLength(1);

    const metrics = await app.inject({ method: 'GET', url: '/api/metrics' });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.json().runs).toBeGreaterThan(0);
  });

  it('converts PDF input through the configured Docling boundary', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/documents/convert',
      payload: {
        name: 'policy.pdf',
        mime: 'application/pdf',
        base64: Buffer.from('%PDF-test').toString('base64'),
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().content).toContain('Imported SOP');
  });
});

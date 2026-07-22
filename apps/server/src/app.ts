import Fastify, { type FastifyInstance } from 'fastify';
import { SopInputSchema, CouncilResultSchema } from '@sopscape/contracts';
import { startGeneration } from '@sopscape/core';

// ponytail: A2MCP is the competition ingress — 58s absolute deadline interface, no payment.
// All real orchestration happens in @sopscape/core; this route only maps transport.

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    return reply.code(503).send({
      status: 'not_ready',
      reason: 'database and admission not configured',
    });
  });

  app.post('/a2mcp/generate-rehearsal', async (request, reply) => {
    // Validate input against SopInputSchema
    const body = request.body as Record<string, unknown>;
    const parsed = SopInputSchema.safeParse({
      title: body.title,
      content: body.content,
      locale: body.locale,
      scenarioMetadata: body.scenarioMetadata,
    });
    if (!parsed.success) {
      return reply.code(400).send({
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Start generation (uses FakeProvider in this vertical slice)
    const result = await startGeneration(parsed.data);

    if (result.status === 'CANCELLED') {
      return reply.code(499).send({
        code: 'CANCELLED',
        message: 'Generation was cancelled',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    if (result.status === 'FAILED') {
      return reply.code(500).send({
        code: 'GENERATION_FAILED',
        message: result.error ?? 'Unknown error',
        retryable: true,
        requestId: crypto.randomUUID(),
      });
    }

    // Validate council result
    const councilValid = CouncilResultSchema.safeParse(result.council);
    if (!councilValid || !councilValid.success) {
      return reply.code(500).send({
        code: 'PROJECTION_ERROR',
        message: 'Council result validation failed',
        retryable: false,
        requestId: crypto.randomUUID(),
      });
    }

    // Return A2MCP success projection
    return reply.code(200).send({
      rehearsalId: result.rehearsalId,
      status: result.status,
      consensus: result.council!.consensus,
      disagreements: result.council!.disagreements,
      evidenceGaps: result.council!.evidenceGaps,
      recommendedPath: result.council!.recommendedPath,
      decisionNodes: result.council!.decisionNodes,
    });
  });

  return app;
}
